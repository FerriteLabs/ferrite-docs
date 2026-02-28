---
sidebar_position: 6
maturity: experimental
---

# Build a RAG-Powered Chatbot

Learn how to build an AI chatbot powered by Retrieval-Augmented Generation (RAG) using Ferrite's vector database and semantic caching.

## What You'll Build

An intelligent chatbot with:
- Document-grounded responses
- Semantic search for context retrieval
- LLM response caching
- Conversation history
- Source attribution

## Prerequisites

- Ferrite server running
- OpenAI API key
- Basic understanding of LLMs and embeddings

## Architecture

```text
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│    User      │────▶│   Chatbot    │────▶│   Ferrite    │
│   Question   │     │   Service    │     │              │
└──────────────┘     └──────────────┘     │ - Vectors    │
                            │             │ - Documents  │
                            ▼             │ - Cache      │
                     ┌──────────────┐     │ - History    │
                     │  LLM (GPT)   │◀────└──────────────┘
                     └──────────────┘
                            │
                            ▼
                     ┌──────────────┐
                     │   Response   │
                     └──────────────┘
```

## Step 1: Project Setup

```toml
# Cargo.toml
[dependencies]
ferrite-client = "0.1"
tokio = { version = "1", features = ["full"] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
reqwest = { version = "0.11", features = ["json"] }
uuid = { version = "1", features = ["v4"] }
chrono = { version = "0.4", features = ["serde"] }
```

## Step 2: Define Models

```rust
// src/models.rs
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Document {
    pub id: String,
    pub title: String,
    pub content: String,
    pub source: String,
    pub metadata: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Chunk {
    pub id: String,
    pub document_id: String,
    pub content: String,
    pub embedding: Vec<f32>,
    pub position: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Message {
    pub role: String,
    pub content: String,
    pub timestamp: DateTime<Utc>,
    pub sources: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Conversation {
    pub id: String,
    pub messages: Vec<Message>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatRequest {
    pub conversation_id: Option<String>,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatResponse {
    pub conversation_id: String,
    pub message: String,
    pub sources: Vec<SourceAttribution>,
    pub cached: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SourceAttribution {
    pub document_id: String,
    pub title: String,
    pub snippet: String,
    pub relevance_score: f32,
}
```

## Step 3: Knowledge Base Service

```rust
// src/knowledge_base.rs
use crate::models::*;
use ferrite_client::Client;
use uuid::Uuid;

pub struct KnowledgeBase {
    client: Client,
    embedding_service: EmbeddingService,
    index_name: String,
    chunk_size: usize,
    chunk_overlap: usize,
}

impl KnowledgeBase {
    pub async fn new(
        ferrite_addr: &str,
        openai_api_key: &str,
        index_name: &str,
    ) -> Result<Self, Box<dyn std::error::Error>> {
        let client = Client::connect(ferrite_addr).await?;
        let embedding_service = EmbeddingService::new(openai_api_key);

        // Create vector index
        client.vector_create_index(
            index_name,
            1536, // OpenAI embedding dimensions
            "hnsw",
            "cosine",
            json!({
                "m": 16,
                "ef_construction": 200,
                "ef_search": 100
            }),
        ).await.ok(); // Ignore if exists

        Ok(Self {
            client,
            embedding_service,
            index_name: index_name.to_string(),
            chunk_size: 512,
            chunk_overlap: 50,
        })
    }

    /// Ingest a document into the knowledge base
    pub async fn ingest(&self, doc: &Document) -> Result<usize, Box<dyn std::error::Error>> {
        // Store document
        self.client.set(
            &format!("doc:{}", doc.id),
            &serde_json::to_string(doc)?,
        ).await?;

        // Chunk the content
        let chunks = self.chunk_text(&doc.content);

        // Generate embeddings for chunks
        let chunk_texts: Vec<&str> = chunks.iter().map(|s| s.as_str()).collect();
        let embeddings = self.embedding_service.embed(&chunk_texts).await?;

        // Store chunks with embeddings
        for (i, (chunk_text, embedding)) in chunks.iter().zip(embeddings.iter()).enumerate() {
            let chunk_id = format!("{}:{}", doc.id, i);

            // Add to vector index
            self.client.vector_add(
                &self.index_name,
                &chunk_id,
                embedding,
                json!({
                    "document_id": doc.id,
                    "title": doc.title,
                    "source": doc.source,
                    "position": i,
                    "content": chunk_text
                }),
            ).await?;
        }

        Ok(chunks.len())
    }

    /// Search for relevant chunks
    pub async fn search(
        &self,
        query: &str,
        limit: usize,
    ) -> Result<Vec<(Chunk, f32)>, Box<dyn std::error::Error>> {
        // Generate query embedding
        let query_embedding = self.embedding_service.embed_one(query).await?;

        // Search vector index
        let results = self.client.vector_search(
            &self.index_name,
            &query_embedding,
            limit,
            None,
        ).await?;

        let mut chunks = Vec::new();
        for (chunk_id, score, metadata) in results {
            let parts: Vec<&str> = chunk_id.split(':').collect();
            let document_id = parts.get(0).unwrap_or(&"").to_string();

            chunks.push((
                Chunk {
                    id: chunk_id,
                    document_id,
                    content: metadata.get("content")
                        .and_then(|v| v.as_str())
                        .unwrap_or("")
                        .to_string(),
                    embedding: vec![],
                    position: metadata.get("position")
                        .and_then(|v| v.as_u64())
                        .unwrap_or(0) as usize,
                },
                score,
            ));
        }

        Ok(chunks)
    }

    fn chunk_text(&self, text: &str) -> Vec<String> {
        let words: Vec<&str> = text.split_whitespace().collect();
        let mut chunks = Vec::new();

        let mut i = 0;
        while i < words.len() {
            let end = (i + self.chunk_size).min(words.len());
            let chunk = words[i..end].join(" ");
            chunks.push(chunk);

            if end >= words.len() {
                break;
            }
            i += self.chunk_size - self.chunk_overlap;
        }

        chunks
    }
}
```

## Step 4: LLM Service with Caching

```rust
// src/llm_service.rs
use ferrite_client::Client;
use reqwest::Client as HttpClient;
use serde::{Deserialize, Serialize};

pub struct LLMService {
    client: Client,
    http_client: HttpClient,
    api_key: String,
    cache_threshold: f32,
}

#[derive(Serialize)]
struct ChatCompletionRequest {
    model: String,
    messages: Vec<ChatMessage>,
    temperature: f32,
}

#[derive(Serialize, Deserialize)]
struct ChatMessage {
    role: String,
    content: String,
}

#[derive(Deserialize)]
struct ChatCompletionResponse {
    choices: Vec<Choice>,
    usage: Usage,
}

#[derive(Deserialize)]
struct Choice {
    message: ChatMessage,
}

#[derive(Deserialize)]
struct Usage {
    total_tokens: u32,
}

impl LLMService {
    pub async fn new(
        ferrite_addr: &str,
        openai_api_key: &str,
    ) -> Result<Self, Box<dyn std::error::Error>> {
        let client = Client::connect(ferrite_addr).await?;
        let http_client = HttpClient::new();

        Ok(Self {
            client,
            http_client,
            api_key: openai_api_key.to_string(),
            cache_threshold: 0.92, // Similarity threshold for cache hit
        })
    }

    pub async fn generate(
        &self,
        system_prompt: &str,
        user_message: &str,
        context: &str,
    ) -> Result<(String, bool), Box<dyn std::error::Error>> {
        // Combine user message with context for cache key
        let cache_query = format!("{}\n\nContext: {}", user_message, &context[..500.min(context.len())]);

        // Try semantic cache first
        if let Some(cached) = self.check_cache(&cache_query).await? {
            return Ok((cached, true));
        }

        // Build prompt with context
        let full_prompt = format!(
            "{}\n\nRelevant context:\n{}\n\nUser question: {}",
            system_prompt,
            context,
            user_message
        );

        // Call LLM
        let messages = vec![
            ChatMessage {
                role: "system".to_string(),
                content: system_prompt.to_string(),
            },
            ChatMessage {
                role: "user".to_string(),
                content: format!(
                    "Based on the following context, please answer the question.\n\nContext:\n{}\n\nQuestion: {}",
                    context,
                    user_message
                ),
            },
        ];

        let request = ChatCompletionRequest {
            model: "gpt-4".to_string(),
            messages,
            temperature: 0.7,
        };

        let response = self.http_client
            .post("https://api.openai.com/v1/chat/completions")
            .header("Authorization", format!("Bearer {}", self.api_key))
            .json(&request)
            .send()
            .await?;

        let completion: ChatCompletionResponse = response.json().await?;
        let answer = completion.choices
            .first()
            .map(|c| c.message.content.clone())
            .unwrap_or_default();

        // Cache the response
        self.cache_response(&cache_query, &answer, completion.usage.total_tokens).await?;

        Ok((answer, false))
    }

    async fn check_cache(&self, query: &str) -> Result<Option<String>, Box<dyn std::error::Error>> {
        let result: Option<(String, f32)> = self.client
            .semantic_llm_get(query, self.cache_threshold)
            .await?;

        Ok(result.map(|(response, _score)| response))
    }

    async fn cache_response(
        &self,
        query: &str,
        response: &str,
        tokens: u32,
    ) -> Result<(), Box<dyn std::error::Error>> {
        self.client.semantic_llm_cache(
            query,
            response,
            json!({
                "ex": 86400,  // 24 hour TTL
                "model": "gpt-4",
                "tokens": tokens
            }),
        ).await?;

        Ok(())
    }
}
```

## Step 5: Conversation Manager

```rust
// src/conversation.rs
use crate::models::*;
use ferrite_client::Client;
use chrono::Utc;
use uuid::Uuid;

pub struct ConversationManager {
    client: Client,
    max_history: usize,
}

impl ConversationManager {
    pub async fn new(ferrite_addr: &str) -> Result<Self, Box<dyn std::error::Error>> {
        let client = Client::connect(ferrite_addr).await?;

        Ok(Self {
            client,
            max_history: 10, // Keep last 10 messages for context
        })
    }

    pub async fn get_or_create(
        &self,
        conversation_id: Option<&str>,
    ) -> Result<Conversation, Box<dyn std::error::Error>> {
        if let Some(id) = conversation_id {
            if let Some(conv) = self.get(id).await? {
                return Ok(conv);
            }
        }

        // Create new conversation
        let conv = Conversation {
            id: Uuid::new_v4().to_string(),
            messages: Vec::new(),
            created_at: Utc::now(),
            updated_at: Utc::now(),
        };

        self.save(&conv).await?;
        Ok(conv)
    }

    pub async fn get(&self, id: &str) -> Result<Option<Conversation>, Box<dyn std::error::Error>> {
        let key = format!("conversation:{}", id);
        let data: Option<String> = self.client.get(&key).await?;

        Ok(data.and_then(|d| serde_json::from_str(&d).ok()))
    }

    pub async fn save(&self, conv: &Conversation) -> Result<(), Box<dyn std::error::Error>> {
        let key = format!("conversation:{}", conv.id);
        self.client.setex(
            &key,
            86400 * 7, // 7 day TTL
            &serde_json::to_string(conv)?,
        ).await?;

        Ok(())
    }

    pub async fn add_message(
        &self,
        conversation_id: &str,
        message: Message,
    ) -> Result<(), Box<dyn std::error::Error>> {
        if let Some(mut conv) = self.get(conversation_id).await? {
            conv.messages.push(message);
            conv.updated_at = Utc::now();

            // Trim old messages
            if conv.messages.len() > self.max_history * 2 {
                conv.messages = conv.messages
                    .into_iter()
                    .skip(conv.messages.len() - self.max_history * 2)
                    .collect();
            }

            self.save(&conv).await?;
        }

        Ok(())
    }

    pub fn format_history(&self, conv: &Conversation) -> String {
        conv.messages
            .iter()
            .take(self.max_history)
            .map(|m| format!("{}: {}", m.role, m.content))
            .collect::<Vec<_>>()
            .join("\n\n")
    }
}
```

## Step 6: RAG Chatbot Service

```rust
// src/chatbot.rs
use crate::conversation::ConversationManager;
use crate::knowledge_base::KnowledgeBase;
use crate::llm_service::LLMService;
use crate::models::*;
use chrono::Utc;

pub struct RAGChatbot {
    knowledge_base: KnowledgeBase,
    llm_service: LLMService,
    conversation_manager: ConversationManager,
    system_prompt: String,
}

impl RAGChatbot {
    pub async fn new(
        ferrite_addr: &str,
        openai_api_key: &str,
        index_name: &str,
    ) -> Result<Self, Box<dyn std::error::Error>> {
        let knowledge_base = KnowledgeBase::new(ferrite_addr, openai_api_key, index_name).await?;
        let llm_service = LLMService::new(ferrite_addr, openai_api_key).await?;
        let conversation_manager = ConversationManager::new(ferrite_addr).await?;

        let system_prompt = r#"
You are a helpful AI assistant that answers questions based on the provided context.
Guidelines:
- Only answer based on the provided context
- If the context doesn't contain relevant information, say so
- Be concise and accurate
- Cite sources when possible
- If asked about something not in the context, politely explain you can only answer based on the available documents
"#.to_string();

        Ok(Self {
            knowledge_base,
            llm_service,
            conversation_manager,
            system_prompt,
        })
    }

    pub async fn chat(&self, request: ChatRequest) -> Result<ChatResponse, Box<dyn std::error::Error>> {
        // Get or create conversation
        let conversation = self.conversation_manager
            .get_or_create(request.conversation_id.as_deref())
            .await?;

        // Get conversation history for context
        let history = self.conversation_manager.format_history(&conversation);

        // Search knowledge base
        let search_query = if history.is_empty() {
            request.message.clone()
        } else {
            format!("{}\n\nCurrent question: {}", history, request.message)
        };

        let relevant_chunks = self.knowledge_base.search(&search_query, 5).await?;

        // Build context from chunks
        let context = relevant_chunks
            .iter()
            .map(|(chunk, _score)| chunk.content.clone())
            .collect::<Vec<_>>()
            .join("\n\n---\n\n");

        // Generate response
        let (answer, cached) = self.llm_service.generate(
            &self.system_prompt,
            &request.message,
            &context,
        ).await?;

        // Build source attributions
        let sources: Vec<SourceAttribution> = relevant_chunks
            .iter()
            .map(|(chunk, score)| SourceAttribution {
                document_id: chunk.document_id.clone(),
                title: chunk.document_id.clone(), // Would fetch from doc
                snippet: chunk.content.chars().take(200).collect(),
                relevance_score: *score,
            })
            .collect();

        // Save messages to conversation
        self.conversation_manager.add_message(
            &conversation.id,
            Message {
                role: "user".to_string(),
                content: request.message,
                timestamp: Utc::now(),
                sources: None,
            },
        ).await?;

        self.conversation_manager.add_message(
            &conversation.id,
            Message {
                role: "assistant".to_string(),
                content: answer.clone(),
                timestamp: Utc::now(),
                sources: Some(sources.iter().map(|s| s.document_id.clone()).collect()),
            },
        ).await?;

        Ok(ChatResponse {
            conversation_id: conversation.id,
            message: answer,
            sources,
            cached,
        })
    }

    pub async fn ingest_document(&self, doc: &Document) -> Result<usize, Box<dyn std::error::Error>> {
        self.knowledge_base.ingest(doc).await
    }
}
```

## Step 7: API Server

```rust
// src/main.rs
use axum::{
    extract::Extension,
    routing::post,
    Json, Router,
};
use std::sync::Arc;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let openai_key = std::env::var("OPENAI_API_KEY")?;

    let chatbot = Arc::new(
        RAGChatbot::new("localhost:6379", &openai_key, "knowledge_base").await?
    );

    let app = Router::new()
        .route("/chat", post(chat))
        .route("/ingest", post(ingest))
        .layer(Extension(chatbot));

    println!("RAG Chatbot starting on http://localhost:3000");
    axum::Server::bind(&"0.0.0.0:3000".parse()?)
        .serve(app.into_make_service())
        .await?;

    Ok(())
}

async fn chat(
    Extension(chatbot): Extension<Arc<RAGChatbot>>,
    Json(request): Json<ChatRequest>,
) -> Json<ChatResponse> {
    match chatbot.chat(request).await {
        Ok(response) => Json(response),
        Err(e) => Json(ChatResponse {
            conversation_id: "error".to_string(),
            message: format!("Error: {}", e),
            sources: vec![],
            cached: false,
        }),
    }
}

async fn ingest(
    Extension(chatbot): Extension<Arc<RAGChatbot>>,
    Json(doc): Json<Document>,
) -> Json<serde_json::Value> {
    match chatbot.ingest_document(&doc).await {
        Ok(chunks) => Json(json!({ "chunks_created": chunks })),
        Err(e) => Json(json!({ "error": e.to_string() })),
    }
}
```

## Usage

### Ingest Documents

```bash
curl -X POST http://localhost:3000/ingest \
  -H "Content-Type: application/json" \
  -d '{
    "id": "doc-1",
    "title": "Company Policies",
    "content": "Our vacation policy allows employees to take...",
    "source": "HR Handbook",
    "metadata": {}
  }'
```

### Chat

```bash
# Start a conversation
curl -X POST http://localhost:3000/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "What is the vacation policy?"
  }'

# Continue conversation
curl -X POST http://localhost:3000/chat \
  -H "Content-Type: application/json" \
  -d '{
    "conversation_id": "uuid-from-previous-response",
    "message": "How many days do I get?"
  }'
```

## Performance Tips

1. **Cache embeddings** for frequently asked questions
2. **Batch document ingestion** for large datasets
3. **Tune chunk size** based on your content type
4. **Monitor cache hit rate** to optimize threshold

## Related Resources

- [RAG Pipeline Guide](/docs/ai-ml/rag-pipeline) - Detailed RAG guide
- [Semantic Commands](/docs/reference/commands/semantic) - Semantic caching
- [Vector Commands](/docs/reference/commands/vector) - Vector operations
