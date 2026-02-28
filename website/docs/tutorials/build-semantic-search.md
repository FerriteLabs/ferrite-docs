---
sidebar_position: 5
maturity: experimental
---

# Build a Semantic Search Application

Learn how to build a powerful semantic search system using Ferrite's vector database capabilities.

## What You'll Build

A semantic search application with:

- Document ingestion with automatic embedding
- Similarity-based search
- Hybrid search (vector + keyword)
- Faceted filtering
- Real-time indexing

## Prerequisites

- Ferrite server running
- OpenAI API key (or alternative embedding provider)
- Basic understanding of vector embeddings

## Architecture

```text
┌─────────────┐     ┌─────────────────┐     ┌─────────────┐
│  Documents  │────▶│ Embedding Model │────▶│   Ferrite   │
└─────────────┘     └─────────────────┘     │             │
                                            │  HNSW Index │
┌─────────────┐     ┌─────────────────┐     │             │
│   Query     │────▶│ Query Embedding │────▶│   Search    │
└─────────────┘     └─────────────────┘     └─────────────┘
```

## Step 1: Project Setup

```bash
cargo new semantic-search
cd semantic-search
```

```toml
# Cargo.toml
[dependencies]
ferrite-client = "0.1"
tokio = { version = "1", features = ["full"] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
reqwest = { version = "0.11", features = ["json"] }
uuid = { version = "1", features = ["v4"] }
```

## Step 2: Define Models

```rust
// src/models.rs
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Document {
    pub id: String,
    pub title: String,
    pub content: String,
    pub metadata: DocumentMetadata,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DocumentMetadata {
    pub author: Option<String>,
    pub category: Option<String>,
    pub tags: Vec<String>,
    pub created_at: String,
    pub source: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchResult {
    pub document: Document,
    pub score: f32,
    pub highlights: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchQuery {
    pub query: String,
    pub limit: usize,
    pub min_score: Option<f32>,
    pub filters: SearchFilters,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct SearchFilters {
    pub categories: Vec<String>,
    pub tags: Vec<String>,
    pub author: Option<String>,
    pub date_from: Option<String>,
    pub date_to: Option<String>,
}
```

## Step 3: Embedding Service

```rust
// src/embeddings.rs
use reqwest::Client as HttpClient;
use serde::{Deserialize, Serialize};

pub struct EmbeddingService {
    http_client: HttpClient,
    api_key: String,
    model: String,
}

#[derive(Serialize)]
struct EmbeddingRequest {
    input: Vec<String>,
    model: String,
}

#[derive(Deserialize)]
struct EmbeddingResponse {
    data: Vec<EmbeddingData>,
}

#[derive(Deserialize)]
struct EmbeddingData {
    embedding: Vec<f32>,
}

impl EmbeddingService {
    pub fn new(api_key: &str) -> Self {
        Self {
            http_client: HttpClient::new(),
            api_key: api_key.to_string(),
            model: "text-embedding-3-small".to_string(),
        }
    }

    pub fn with_model(mut self, model: &str) -> Self {
        self.model = model.to_string();
        self
    }

    pub async fn embed(&self, texts: &[&str]) -> Result<Vec<Vec<f32>>, Box<dyn std::error::Error>> {
        let request = EmbeddingRequest {
            input: texts.iter().map(|s| s.to_string()).collect(),
            model: self.model.clone(),
        };

        let response = self.http_client
            .post("https://api.openai.com/v1/embeddings")
            .header("Authorization", format!("Bearer {}", self.api_key))
            .json(&request)
            .send()
            .await?;

        let data: EmbeddingResponse = response.json().await?;
        Ok(data.data.into_iter().map(|d| d.embedding).collect())
    }

    pub async fn embed_one(&self, text: &str) -> Result<Vec<f32>, Box<dyn std::error::Error>> {
        let embeddings = self.embed(&[text]).await?;
        embeddings.into_iter().next().ok_or("No embedding returned".into())
    }
}
```

## Step 4: Search Index Service

```rust
// src/search_index.rs
use crate::embeddings::EmbeddingService;
use crate::models::*;
use ferrite_client::Client;
use uuid::Uuid;

pub struct SearchIndex {
    client: Client,
    embedding_service: EmbeddingService,
    index_name: String,
    dimensions: usize,
}

impl SearchIndex {
    pub async fn new(
        ferrite_addr: &str,
        openai_api_key: &str,
        index_name: &str,
    ) -> Result<Self, Box<dyn std::error::Error>> {
        let client = Client::connect(ferrite_addr).await?;
        let embedding_service = EmbeddingService::new(openai_api_key);

        Ok(Self {
            client,
            embedding_service,
            index_name: index_name.to_string(),
            dimensions: 1536, // text-embedding-3-small dimension
        })
    }

    /// Initialize the vector index
    pub async fn create_index(&self) -> Result<(), Box<dyn std::error::Error>> {
        // Create HNSW vector index
        self.client.vector_create_index(
            &self.index_name,
            self.dimensions,
            "hnsw",
            "cosine",
            json!({
                "m": 16,
                "ef_construction": 200,
                "ef_search": 100
            }),
        ).await?;

        // Create full-text search index for hybrid search
        self.client.search_index_create(
            &format!("{}_fts", self.index_name),
            &["title", "content"],
            json!({
                "tokenizer": "standard",
                "stemmer": "english"
            }),
        ).await?;

        Ok(())
    }

    /// Index a document
    pub async fn index_document(&self, doc: &Document) -> Result<(), Box<dyn std::error::Error>> {
        // Generate embedding from title + content
        let text_for_embedding = format!("{}\n\n{}", doc.title, doc.content);
        let embedding = self.embedding_service.embed_one(&text_for_embedding).await?;

        // Store document data
        let doc_key = format!("doc:{}", doc.id);
        self.client.set(&doc_key, &serde_json::to_string(doc)?).await?;

        // Add to vector index
        self.client.vector_add(
            &self.index_name,
            &doc.id,
            &embedding,
            json!({
                "title": doc.title,
                "category": doc.metadata.category,
                "tags": doc.metadata.tags,
                "author": doc.metadata.author,
                "created_at": doc.metadata.created_at
            }),
        ).await?;

        // Add to full-text index
        self.client.search_add(
            &format!("{}_fts", self.index_name),
            &doc.id,
            json!({
                "title": doc.title,
                "content": doc.content
            }),
        ).await?;

        Ok(())
    }

    /// Index multiple documents with batching
    pub async fn index_documents(&self, docs: &[Document]) -> Result<(), Box<dyn std::error::Error>> {
        // Batch embedding generation
        let texts: Vec<String> = docs.iter()
            .map(|d| format!("{}\n\n{}", d.title, d.content))
            .collect();
        let text_refs: Vec<&str> = texts.iter().map(|s| s.as_str()).collect();

        let embeddings = self.embedding_service.embed(&text_refs).await?;

        // Use pipeline for efficient batch indexing
        let mut pipe = self.client.pipeline();

        for (doc, embedding) in docs.iter().zip(embeddings.iter()) {
            let doc_key = format!("doc:{}", doc.id);
            pipe.set(&doc_key, &serde_json::to_string(doc)?);

            pipe.vector_add(
                &self.index_name,
                &doc.id,
                embedding,
                json!({
                    "title": doc.title,
                    "category": doc.metadata.category,
                    "tags": doc.metadata.tags,
                    "author": doc.metadata.author,
                    "created_at": doc.metadata.created_at
                }),
            );
        }

        pipe.execute().await?;

        Ok(())
    }

    /// Perform semantic search
    pub async fn search(&self, query: &SearchQuery) -> Result<Vec<SearchResult>, Box<dyn std::error::Error>> {
        // Generate query embedding
        let query_embedding = self.embedding_service.embed_one(&query.query).await?;

        // Build filter expression
        let filter = self.build_filter(&query.filters);

        // Perform vector search
        let results = self.client.vector_search(
            &self.index_name,
            &query_embedding,
            query.limit,
            filter,
        ).await?;

        // Fetch full documents and build results
        let mut search_results = Vec::new();
        for (doc_id, score, _metadata) in results {
            if let Some(min_score) = query.min_score {
                if score < min_score {
                    continue;
                }
            }

            let doc_key = format!("doc:{}", doc_id);
            if let Some(doc_json) = self.client.get::<String>(&doc_key).await? {
                if let Ok(doc) = serde_json::from_str::<Document>(&doc_json) {
                    search_results.push(SearchResult {
                        document: doc,
                        score,
                        highlights: vec![], // Would extract from content
                    });
                }
            }
        }

        Ok(search_results)
    }

    /// Perform hybrid search (vector + keyword)
    pub async fn hybrid_search(&self, query: &SearchQuery) -> Result<Vec<SearchResult>, Box<dyn std::error::Error>> {
        // Get vector search results
        let vector_results = self.search(query).await?;

        // Get full-text search results
        let fts_results = self.client.search_query(
            &format!("{}_fts", self.index_name),
            &query.query,
            query.limit,
        ).await?;

        // Combine results using Reciprocal Rank Fusion (RRF)
        let mut scores: std::collections::HashMap<String, f32> = std::collections::HashMap::new();

        let k = 60.0; // RRF constant

        for (rank, result) in vector_results.iter().enumerate() {
            let rrf_score = 1.0 / (k + rank as f32 + 1.0);
            *scores.entry(result.document.id.clone()).or_default() += rrf_score * 0.6; // 60% weight for vector
        }

        for (rank, (doc_id, _)) in fts_results.iter().enumerate() {
            let rrf_score = 1.0 / (k + rank as f32 + 1.0);
            *scores.entry(doc_id.clone()).or_default() += rrf_score * 0.4; // 40% weight for FTS
        }

        // Sort by combined score
        let mut combined: Vec<_> = scores.into_iter().collect();
        combined.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap());

        // Fetch documents for top results
        let mut results = Vec::new();
        for (doc_id, score) in combined.into_iter().take(query.limit) {
            let doc_key = format!("doc:{}", doc_id);
            if let Some(doc_json) = self.client.get::<String>(&doc_key).await? {
                if let Ok(doc) = serde_json::from_str::<Document>(&doc_json) {
                    results.push(SearchResult {
                        document: doc,
                        score,
                        highlights: vec![],
                    });
                }
            }
        }

        Ok(results)
    }

    fn build_filter(&self, filters: &SearchFilters) -> Option<String> {
        let mut conditions = Vec::new();

        if !filters.categories.is_empty() {
            let cats = filters.categories.iter()
                .map(|c| format!("'{}'", c))
                .collect::<Vec<_>>()
                .join(", ");
            conditions.push(format!("category IN ({})", cats));
        }

        if !filters.tags.is_empty() {
            let tags = filters.tags.iter()
                .map(|t| format!("'{}'", t))
                .collect::<Vec<_>>()
                .join(", ");
            conditions.push(format!("tags ANY ({})", tags));
        }

        if let Some(author) = &filters.author {
            conditions.push(format!("author = '{}'", author));
        }

        if let Some(date_from) = &filters.date_from {
            conditions.push(format!("created_at >= '{}'", date_from));
        }

        if let Some(date_to) = &filters.date_to {
            conditions.push(format!("created_at <= '{}'", date_to));
        }

        if conditions.is_empty() {
            None
        } else {
            Some(conditions.join(" AND "))
        }
    }

    /// Find similar documents
    pub async fn find_similar(&self, doc_id: &str, limit: usize) -> Result<Vec<SearchResult>, Box<dyn std::error::Error>> {
        let results = self.client.vector_search_by_id(
            &self.index_name,
            doc_id,
            limit + 1, // +1 because the document itself will be in results
        ).await?;

        let mut search_results = Vec::new();
        for (id, score, _) in results {
            if id == doc_id {
                continue; // Skip the query document itself
            }

            let doc_key = format!("doc:{}", id);
            if let Some(doc_json) = self.client.get::<String>(&doc_key).await? {
                if let Ok(doc) = serde_json::from_str::<Document>(&doc_json) {
                    search_results.push(SearchResult {
                        document: doc,
                        score,
                        highlights: vec![],
                    });
                }
            }
        }

        Ok(search_results)
    }

    /// Delete a document
    pub async fn delete_document(&self, doc_id: &str) -> Result<(), Box<dyn std::error::Error>> {
        self.client.vector_delete(&self.index_name, doc_id).await?;
        self.client.search_delete(&format!("{}_fts", self.index_name), doc_id).await?;
        self.client.del(&[&format!("doc:{}", doc_id)]).await?;
        Ok(())
    }
}
```

## Step 5: API Server

```rust
// src/api.rs
use axum::{
    extract::{Extension, Path, Query},
    http::StatusCode,
    response::Json,
    routing::{delete, get, post},
    Router,
};
use serde::Deserialize;
use std::sync::Arc;

pub fn create_router(index: Arc<SearchIndex>) -> Router {
    Router::new()
        .route("/documents", post(index_document))
        .route("/documents/batch", post(index_documents_batch))
        .route("/documents/:id", get(get_document))
        .route("/documents/:id", delete(delete_document))
        .route("/documents/:id/similar", get(find_similar))
        .route("/search", post(search))
        .route("/search/hybrid", post(hybrid_search))
        .layer(Extension(index))
}

async fn index_document(
    Extension(index): Extension<Arc<SearchIndex>>,
    Json(doc): Json<Document>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    index.index_document(&doc).await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(json!({ "id": doc.id, "status": "indexed" })))
}

async fn index_documents_batch(
    Extension(index): Extension<Arc<SearchIndex>>,
    Json(docs): Json<Vec<Document>>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    let count = docs.len();
    index.index_documents(&docs).await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(json!({ "indexed": count })))
}

async fn get_document(
    Extension(index): Extension<Arc<SearchIndex>>,
    Path(id): Path<String>,
) -> Result<Json<Document>, (StatusCode, String)> {
    let doc_key = format!("doc:{}", id);
    let doc_json: Option<String> = index.client.get(&doc_key).await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    match doc_json {
        Some(json) => {
            let doc: Document = serde_json::from_str(&json)
                .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
            Ok(Json(doc))
        }
        None => Err((StatusCode::NOT_FOUND, "Document not found".to_string()))
    }
}

async fn delete_document(
    Extension(index): Extension<Arc<SearchIndex>>,
    Path(id): Path<String>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    index.delete_document(&id).await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(json!({ "deleted": id })))
}

async fn search(
    Extension(index): Extension<Arc<SearchIndex>>,
    Json(query): Json<SearchQuery>,
) -> Result<Json<Vec<SearchResult>>, (StatusCode, String)> {
    let results = index.search(&query).await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(results))
}

async fn hybrid_search(
    Extension(index): Extension<Arc<SearchIndex>>,
    Json(query): Json<SearchQuery>,
) -> Result<Json<Vec<SearchResult>>, (StatusCode, String)> {
    let results = index.hybrid_search(&query).await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(results))
}

#[derive(Deserialize)]
struct SimilarQuery {
    limit: Option<usize>,
}

async fn find_similar(
    Extension(index): Extension<Arc<SearchIndex>>,
    Path(id): Path<String>,
    Query(params): Query<SimilarQuery>,
) -> Result<Json<Vec<SearchResult>>, (StatusCode, String)> {
    let limit = params.limit.unwrap_or(10);
    let results = index.find_similar(&id, limit).await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(results))
}
```

## Step 6: Main Application

```rust
// src/main.rs
mod api;
mod embeddings;
mod models;
mod search_index;

use search_index::SearchIndex;
use std::sync::Arc;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let openai_key = std::env::var("OPENAI_API_KEY")?;

    // Initialize search index
    let index = Arc::new(
        SearchIndex::new("localhost:6379", &openai_key, "documents").await?
    );

    // Create index if needed
    index.create_index().await?;

    // Create API router
    let app = api::create_router(index);

    println!("Starting semantic search server on http://localhost:3000");
    axum::Server::bind(&"0.0.0.0:3000".parse()?)
        .serve(app.into_make_service())
        .await?;

    Ok(())
}
```

## Usage Examples

### Index Documents

```bash
# Index a single document
curl -X POST http://localhost:3000/documents \
  -H "Content-Type: application/json" \
  -d '{
    "id": "doc-1",
    "title": "Introduction to Machine Learning",
    "content": "Machine learning is a subset of artificial intelligence...",
    "metadata": {
      "category": "technology",
      "tags": ["ml", "ai", "tutorial"],
      "created_at": "2024-01-15"
    }
  }'
```

### Search

```bash
# Semantic search
curl -X POST http://localhost:3000/search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "how do neural networks learn",
    "limit": 10,
    "min_score": 0.7,
    "filters": {
      "categories": ["technology"]
    }
  }'

# Hybrid search
curl -X POST http://localhost:3000/search/hybrid \
  -H "Content-Type: application/json" \
  -d '{
    "query": "python machine learning tutorial",
    "limit": 10
  }'
```

### Find Similar

```bash
curl "http://localhost:3000/documents/doc-1/similar?limit=5"
```

## Performance Optimizations

### 1. Embedding Caching

```rust
// Cache embeddings for frequently searched queries
pub async fn search_with_cache(&self, query: &SearchQuery) -> Result<Vec<SearchResult>, Error> {
    let cache_key = format!("embedding:query:{}", hash(&query.query));

    // Try cache first
    let embedding = if let Some(cached) = self.client.get::<Vec<u8>>(&cache_key).await? {
        deserialize_embedding(&cached)
    } else {
        let embedding = self.embedding_service.embed_one(&query.query).await?;
        self.client.setex(&cache_key, 3600, &serialize_embedding(&embedding)).await?;
        embedding
    };

    self.search_with_embedding(&embedding, query).await
}
```

### 2. Batch Processing

```rust
// Process documents in batches for efficient indexing
pub async fn bulk_index(&self, docs: &[Document], batch_size: usize) -> Result<(), Error> {
    for batch in docs.chunks(batch_size) {
        self.index_documents(batch).await?;
    }
    Ok(())
}
```

## Related Resources

- [Vector Commands](/docs/reference/commands/vector) - Vector operations
- [Search Commands](/docs/reference/commands/search) - Full-text search
- [AI/ML Guide](/docs/ai-ml/overview) - AI capabilities
