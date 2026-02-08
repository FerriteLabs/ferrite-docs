# Ferrite AI/ML Features Guide

This guide covers Ferrite's AI and Machine Learning features, including vector search, semantic caching, RAG pipelines, GraphRAG, inference, and conversation memory.

## Table of Contents

1. [Vector Search](#vector-search)
2. [Semantic Caching](#semantic-caching)
3. [RAG Pipeline](#rag-pipeline)
4. [GraphRAG](#graphrag)
5. [Inference Engine](#inference-engine)
6. [Conversation Memory](#conversation-memory)
7. [Auto-Indexing](#auto-indexing)
8. [Cost Optimizer](#cost-optimizer)
9. [Best Practices](#best-practices)

---

## Vector Search

Native vector similarity search for AI/ML workloads with HNSW, IVF, and flat indexes.

### Overview

Ferrite provides built-in vector search capabilities without requiring external services. Vectors are stored alongside your regular data and benefit from the same persistence, replication, and cluster features.

### Index Types

| Type | Best For | Time | Space | Recall |
|------|----------|------|-------|--------|
| **HNSW** | General purpose | O(log n) | High | ~98% |
| **IVF** | Large datasets (>1M vectors) | O(√n) | Low | ~95% |
| **Flat** | Small datasets, exact search | O(n) | Low | 100% |

### Creating an Index

```bash
# HNSW (recommended for most use cases)
VECTOR.CREATE embeddings DIM 384 DISTANCE cosine TYPE hnsw M 16 EF_CONSTRUCTION 200

# IVF (for large datasets)
VECTOR.CREATE embeddings DIM 384 DISTANCE cosine TYPE ivf NLIST 1000 NPROBE 50

# Flat (for exact search)
VECTOR.CREATE embeddings DIM 384 DISTANCE euclidean TYPE flat
```

**Parameters:**
- `DIM`: Vector dimensions (must match your embedding model)
- `DISTANCE`: Distance metric (cosine, euclidean, dot)
- `M`: HNSW connections per node (higher = better recall, more memory)
- `EF_CONSTRUCTION`: HNSW build quality (higher = better recall, slower build)
- `NLIST`: IVF cluster count
- `NPROBE`: IVF clusters to search

### Adding Vectors

```bash
# Add single vector
VECTOR.ADD embeddings doc:1 [0.1, 0.2, 0.3, ...] METADATA '{"title": "Document 1"}'

# Add without metadata
VECTOR.ADD embeddings doc:2 [0.2, 0.3, 0.4, ...]
```

### Searching

```bash
# Basic search
VECTOR.SEARCH embeddings [0.15, 0.22, ...] TOP 10

# Search with filter
VECTOR.SEARCH embeddings [0.15, 0.22, ...] TOP 10 FILTER '$.category == "tech"'

# Search with minimum score
VECTOR.SEARCH embeddings [0.15, 0.22, ...] TOP 10 MIN_SCORE 0.8
```

### Rust API

```rust
use ferrite::vector::{IndexType, DistanceMetric};

// Create index
db.vector_create_index(
    "embeddings",
    384,
    IndexType::Hnsw { m: 16, ef_construction: 200 },
    DistanceMetric::Cosine,
)?;

// Add vectors
let embedding = get_embedding("Hello world");  // Your embedding function
db.vector_add("embeddings", "doc:1", &embedding, Some(json!({"title": "Hello"})))?;

// Search
let query_embedding = get_embedding("Hi there");
let results = db.vector_search("embeddings", &query_embedding, 10, None)?;

for result in results {
    println!("{}: score={:.4}", result.id, result.score);
}
```

### Common Embedding Models

| Model | Dimensions | Notes |
|-------|------------|-------|
| `all-MiniLM-L6-v2` | 384 | Fast, good for general text |
| `all-mpnet-base-v2` | 768 | Better quality, slower |
| `text-embedding-3-small` | 1536 | OpenAI, excellent quality |
| `text-embedding-3-large` | 3072 | OpenAI, best quality |
| `embed-english-v3.0` | 1024 | Cohere, multilingual |

---

## Semantic Caching

Cache LLM responses by meaning, not exact keys. Reduces API costs by 40-60%.

### How It Works

```
1. User query arrives: "What's the capital of France?"
2. Generate embedding for the query
3. Search vector index for similar queries
4. If similarity > threshold: return cached response
5. Otherwise: call LLM, cache response with embedding
```

### Configuration

```toml
[semantic]
enabled = true
similarity_threshold = 0.85  # Minimum similarity for cache hit

[semantic.embedding]
provider = "onnx"  # Local embeddings, no API calls
model_path = "./models/all-MiniLM-L6-v2.onnx"
```

### Usage via RESP

```bash
# Cache a response
SEMANTIC.SET "What is the capital of France?" "Paris is the capital of France."

# Query (returns cached if similar)
SEMANTIC.GET "France's capital city?" 0.85
# Returns: "Paris is the capital of France."

# Query (no match if below threshold)
SEMANTIC.GET "What is Python?" 0.85
# Returns: (nil)
```

### Rust API

```rust
use ferrite::semantic::{SemanticCache, EmbeddingProvider};

// Create cache with local ONNX embeddings
let cache = SemanticCache::new(&db, EmbeddingProvider::Onnx {
    model_path: "./models/all-MiniLM-L6-v2.onnx".into(),
})?;

// Cache LLM response
async fn get_llm_response(query: &str) -> Result<String> {
    // Check cache first
    if let Some(cached) = cache.get(query, 0.85).await? {
        return Ok(cached);
    }

    // Call LLM
    let response = call_llm(query).await?;

    // Cache for future queries
    cache.set(query, &response, None).await?;

    Ok(response)
}
```

### Embedding Providers

**ONNX (Recommended for production)**:
```rust
EmbeddingProvider::Onnx {
    model_path: "./models/all-MiniLM-L6-v2.onnx".into(),
}
// Pros: No API calls, fast, free
// Cons: Requires model file
```

**OpenAI**:
```rust
EmbeddingProvider::OpenAi {
    api_key: env::var("OPENAI_API_KEY")?,
    model: "text-embedding-3-small".into(),
}
// Pros: Best quality
// Cons: API costs, latency
```

**Cohere**:
```rust
EmbeddingProvider::Cohere {
    api_key: env::var("COHERE_API_KEY")?,
    model: "embed-english-v3.0".into(),
}
```

---

## RAG Pipeline

Retrieval-Augmented Generation for building context-aware AI applications.

### Components

```
Documents → Chunking → Embedding → Vector Index
                                        ↓
Query → Embedding → Search → Rerank → Context → LLM
```

### Setup

```rust
use ferrite::rag::{RagPipeline, RagConfig, ChunkingStrategy};

let rag = RagPipeline::new(&db, RagConfig {
    embedding_provider: EmbeddingProvider::Onnx {
        model_path: "./models/all-MiniLM-L6-v2.onnx".into(),
    },
    chunking: ChunkingStrategy::Semantic {
        max_tokens: 512,
        overlap: 50,
    },
    vector_index: "rag_docs".to_string(),
})?;
```

### Ingesting Documents

```rust
// Single document
rag.ingest_document(Document {
    id: "doc1".to_string(),
    content: "Long document text...".to_string(),
    metadata: json!({"source": "manual", "category": "tech"}),
})?;

// Batch ingest
let documents = load_documents_from_folder("./docs")?;
rag.ingest_batch(&documents)?;
```

### Chunking Strategies

| Strategy | Description | Best For |
|----------|-------------|----------|
| `FixedSize` | Split at fixed character count | Simple documents |
| `Sentence` | Split at sentence boundaries | Articles, prose |
| `Semantic` | Split at semantic boundaries | Technical docs |
| `Paragraph` | Split at paragraph breaks | Structured docs |

```rust
// Fixed size (simple but can split mid-sentence)
ChunkingStrategy::FixedSize { size: 1000, overlap: 100 }

// Sentence-based (respects sentence boundaries)
ChunkingStrategy::Sentence { max_sentences: 5 }

// Semantic (uses embeddings to find natural breaks)
ChunkingStrategy::Semantic { max_tokens: 512, overlap: 50 }
```

### Retrieving Context

```rust
// Simple retrieval
let results = rag.retrieve("How do I configure auth?", RetrieveOptions {
    top_k: 5,
    min_score: 0.7,
    filter: None,
    rerank: true,
})?;

// Build context for LLM
let context = rag.build_context(&results, ContextOptions {
    max_tokens: 4000,
    include_metadata: true,
})?;

// Pass to LLM
let prompt = format!(
    "Context:\n{}\n\nQuestion: {}\n\nAnswer:",
    context.text,
    "How do I configure auth?"
);
let answer = call_llm(&prompt).await?;
```

---

## GraphRAG

Enhanced RAG using knowledge graphs for better context understanding.

### How It Works

```
1. Extract entities from documents (people, places, concepts)
2. Build knowledge graph of relationships
3. During retrieval:
   - Vector search for relevant chunks
   - Graph traversal for related entities
   - Combine for richer context
```

### Setup

```rust
use ferrite::graphrag::{GraphRagRetriever, GraphRagConfig};

let retriever = GraphRagRetriever::new(&db, GraphRagConfig {
    embedding_provider: EmbeddingProvider::Onnx { ... },
    entity_extraction: EntityExtraction::Llm {
        model: "gpt-4".into(),
    },
    graph_depth: 2,  // How far to traverse
})?;
```

### Indexing Documents

```rust
// Index builds both vectors AND knowledge graph
retriever.index_document("doc1", "Apple Inc. released the iPhone in 2007.")?;

// This creates:
// - Vectors for semantic search
// - Entities: [Apple Inc., iPhone, 2007]
// - Relationships: [Apple Inc. -[released]-> iPhone]
```

### Querying

```rust
let results = retriever.retrieve("What products did Apple release?", GraphRagOptions {
    top_k: 5,
    graph_expansion: true,  // Include related entities
    max_graph_depth: 2,
})?;

// Results include:
// - Directly matching chunks
// - Related entities from graph
// - Relationship context
```

---

## Inference Engine

Run ML models directly on cached data with batching and caching.

### Features

- **Automatic Batching**: Groups requests for better GPU utilization
- **Result Caching**: Cache inference results to avoid recomputation
- **CDC Triggers**: Automatically run inference on data changes

### Setup

```rust
use ferrite::inference::{InferenceEngine, InferenceConfig, ModelConfig};

let inference = InferenceEngine::new(&db, InferenceConfig {
    batch_size: 32,
    batch_timeout: Duration::from_millis(10),
    cache_results: true,
})?;

// Load models
inference.load_model("sentiment", ModelConfig::onnx("sentiment.onnx")).await?;
inference.load_model("embedding", ModelConfig::onnx("embeddings.onnx")).await?;
```

### Running Inference

```rust
// Single prediction
let result = inference.predict("sentiment", InferenceInput::Text("Great!".into())).await?;
println!("Sentiment: {:?}", result);  // Positive, confidence 0.95

// Batch prediction
let results = inference.predict_batch("sentiment", &[
    InferenceInput::Text("Great!".into()),
    InferenceInput::Text("Terrible.".into()),
]).await?;
```

### CDC-Triggered Inference

Automatically run inference when data changes:

```rust
// Setup trigger: When a review is added, compute sentiment
inference.create_trigger(InferenceTrigger {
    model: "sentiment".to_string(),
    source_pattern: "reviews:*".to_string(),
    output_pattern: "sentiment:{}".to_string(),
    input_transform: |value| {
        InferenceInput::Text(value["text"].as_str()?.to_string())
    },
})?;

// Now when you set a review...
db.set("reviews:123", json!({"text": "Great product!", "rating": 5}))?;

// ...sentiment is automatically computed and stored
let sentiment = db.get("sentiment:123")?;  // "positive"
```

---

## Conversation Memory

Manage LLM conversations with token limits and automatic summarization.

### Features

- **Token-aware context windows**: Stay within LLM limits
- **Automatic summarization**: Compress old messages
- **Multiple window strategies**: Sliding, fixed, summarizing

### Setup

```rust
use ferrite::conversation::{ConversationStore, WindowStrategy};

let store = ConversationStore::new(&db, ConversationConfig {
    window_strategy: WindowStrategy::SlidingTokens {
        max_tokens: 4000,
        preserve_system: true,
    },
    summarize_old_messages: true,
    ttl: Some(Duration::from_secs(86400 * 7)),  // 7 days
})?;
```

### Usage

```rust
// Create conversation
let conv_id = store.create("user:123")?;

// Add messages
store.add_message(&conv_id, Message::system("You are a helpful assistant."))?;
store.add_message(&conv_id, Message::user("Hello!"))?;
store.add_message(&conv_id, Message::assistant("Hi! How can I help?"))?;

// Get context for LLM (auto-managed to fit token limit)
let context = store.get_context(&conv_id)?;

// Pass to LLM
let response = call_llm(context.messages).await?;

// Add response to conversation
store.add_message(&conv_id, Message::assistant(&response))?;
```

### Window Strategies

```rust
// Sliding window: Keep last N tokens
WindowStrategy::SlidingTokens { max_tokens: 4000, preserve_system: true }

// Fixed count: Keep last N messages
WindowStrategy::FixedCount { max_messages: 20 }

// Summarizing: Summarize old messages
WindowStrategy::Summarizing {
    max_tokens: 4000,
    summarize_after: 10,  // Summarize when > 10 messages
}
```

---

## Auto-Indexing

AI-powered automatic index creation based on query patterns.

### How It Works

1. Collects query patterns and access times
2. Analyzes patterns for optimization opportunities
3. Recommends indexes with confidence scores
4. Optionally auto-applies recommendations

### Configuration

```toml
[autoindex]
enabled = true
collection_window = "1h"
min_samples = 100
confidence_threshold = 0.8
auto_apply = false  # Set true to auto-create indexes
```

### Usage

```rust
use ferrite::autoindex::AutoIndexEngine;

let autoindex = AutoIndexEngine::new(&db, AutoIndexConfig::default())?;

// Get recommendations
let recommendations = autoindex.analyze()?;

for rec in &recommendations {
    println!("Pattern: {}", rec.pattern);
    println!("  Index: {:?}", rec.index_type);
    println!("  Confidence: {:.1}%", rec.confidence * 100.0);
    println!("  Estimated speedup: {:.1}x", rec.estimated_speedup);
}

// Apply a recommendation
autoindex.apply_recommendation(&recommendations[0])?;
```

---

## Cost Optimizer

Optimize queries based on infrastructure costs.

### Features

- Models costs for compute, storage, network
- Rewrites queries for cost efficiency
- Prefers cached data when available
- Routes to appropriate storage tiers

### Usage

```rust
use ferrite::costoptimizer::{CostOptimizer, CostModel};

let optimizer = CostOptimizer::new(&db, CostModel::aws_us_east_1())?;

// Optimize a query
let original = "SELECT * FROM logs:* WHERE $.level = 'error'";
let optimized = optimizer.optimize(original)?;

// optimized might:
// - Add index hints
// - Rewrite to use cached aggregations
// - Route to warm/cold storage appropriately
```

---

## Best Practices

### Vector Search

1. **Choose the right index**: HNSW for most cases, IVF for >1M vectors
2. **Tune parameters**: Start with M=16, ef_construction=200
3. **Match dimensions**: Ensure index matches embedding model
4. **Use filters**: Filter before vector search when possible

### Semantic Caching

1. **Use local embeddings**: ONNX avoids API latency
2. **Tune threshold**: Start at 0.85, adjust based on needs
3. **Monitor hit rate**: Target 40-60% for LLM workloads
4. **Set TTL**: Cache responses expire for freshness

### RAG Pipeline

1. **Choose chunking wisely**: Semantic for technical docs
2. **Overlap chunks**: 10-20% overlap prevents context loss
3. **Rerank results**: Improves relevance significantly
4. **Include metadata**: Helps with filtering and citations

### Conversation Memory

1. **Use token-based windows**: Respects LLM limits
2. **Preserve system prompts**: Keep instructions visible
3. **Enable summarization**: Keeps context meaningful
4. **Set TTL**: Clean up old conversations

### General

1. **Batch operations**: Group similar requests
2. **Cache aggressively**: Inference results, embeddings
3. **Monitor costs**: Track API usage and compute
4. **Profile regularly**: Identify bottlenecks

---

## Further Reading

- [API_REFERENCE.md](API_REFERENCE.md) - Complete API documentation
- [CONFIGURATION.md](CONFIGURATION.md) - Configuration options
- [PERFORMANCE_TUNING.md](PERFORMANCE_TUNING.md) - Performance optimization
- [docs/adr/ADR-0011-embedded-vector-search.md](adr/ADR-0011-embedded-vector-search.md) - Vector search design
