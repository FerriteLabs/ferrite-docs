---
sidebar_position: 2
maturity: experimental
---

:::info Beta Feature
This feature is in **beta**. It is feature-complete but still undergoing testing. APIs may change in minor ways before stabilization.
:::

# Embeddings

Generate and manage embeddings from text using multiple providers.

## Overview

Embeddings are dense vector representations of text that capture semantic meaning. Ferrite supports multiple embedding providers:

| Provider | Model | Dimensions | Batch Size |
|----------|-------|------------|------------|
| OpenAI | text-embedding-3-small | 1536 | 2048 |
| OpenAI | text-embedding-ada-002 | 1536 | 2048 |
| Cohere | embed-english-v3.0 | 1024 | 96 |
| HuggingFace | sentence-transformers/* | varies | varies |
| Local ONNX | all-MiniLM-L6-v2 | 384 | unlimited |

## Quick Start

```bash
# Generate embedding
SEMANTIC.EMBED "What is machine learning?"
# Returns: [0.123, -0.456, 0.789, ...]

# Embed with specific provider
SEMANTIC.EMBED "Hello world" PROVIDER openai

# Batch embed
SEMANTIC.EMBED.BATCH '["text 1", "text 2", "text 3"]'
```

## Provider Configuration

### OpenAI

```toml
[semantic.providers.openai]
api_key = "${OPENAI_API_KEY}"
model = "text-embedding-3-small"  # or "text-embedding-ada-002"
batch_size = 2048
timeout_ms = 30000
```

```bash
# Use OpenAI
SEMANTIC.EMBED "text" PROVIDER openai
```

### Cohere

```toml
[semantic.providers.cohere]
api_key = "${COHERE_API_KEY}"
model = "embed-english-v3.0"
input_type = "search_document"  # or "search_query"
batch_size = 96
```

```bash
# Use Cohere
SEMANTIC.EMBED "text" PROVIDER cohere
```

### HuggingFace

```toml
[semantic.providers.huggingface]
api_key = "${HF_API_KEY}"
model = "sentence-transformers/all-MiniLM-L6-v2"
```

```bash
# Use HuggingFace
SEMANTIC.EMBED "text" PROVIDER huggingface
```

### Local ONNX

```toml
[semantic.providers.local]
model_path = "/models/all-MiniLM-L6-v2.onnx"
tokenizer_path = "/models/tokenizer.json"
```

```bash
# Use local model
SEMANTIC.EMBED "text" PROVIDER local
```

## Caching

Embeddings are automatically cached to avoid redundant API calls:

```toml
[semantic.cache]
enabled = true
max_entries = 10000
ttl_seconds = 86400  # 24 hours
```

### Cache Stats

```bash
SEMANTIC.CACHE.STATS
# Returns:
# hits: 9500
# misses: 500
# hit_rate: 0.95
# entries: 5000
# memory_bytes: 10485760
```

### Manual Cache Control

```bash
# Check if cached
SEMANTIC.CACHE.EXISTS "text"

# Clear cache
SEMANTIC.CACHE.CLEAR

# Clear specific entry
SEMANTIC.CACHE.DEL "text"
```

## Batch Processing

For efficiency, batch multiple texts:

```bash
# Batch embed
SEMANTIC.EMBED.BATCH '[
  "First document",
  "Second document",
  "Third document"
]'
# Returns: [[0.1, 0.2, ...], [0.3, 0.4, ...], [0.5, 0.6, ...]]
```

### Rust API

```rust
use ferrite::semantic::{Embedder, EmbeddingProvider};

let embedder = Embedder::new(EmbeddingProvider::OpenAI {
    api_key: env::var("OPENAI_API_KEY")?,
    model: "text-embedding-3-small".to_string(),
});

// Single embedding
let embedding = embedder.embed("Hello world").await?;

// Batch embedding
let texts = vec!["text 1", "text 2", "text 3"];
let embeddings = embedder.embed_batch(&texts).await?;

// Check cache
let stats = embedder.cache_stats();
println!("Cache hit rate: {:.2}%", stats.hit_rate * 100.0);
```

## Embedding Dimensions

Different models produce different dimension sizes:

| Model | Dimensions | Quality | Cost |
|-------|------------|---------|------|
| text-embedding-3-large | 3072 | Highest | Higher |
| text-embedding-3-small | 1536 | High | Medium |
| embed-english-v3.0 | 1024 | High | Medium |
| all-MiniLM-L6-v2 | 384 | Good | Free |

### Dimension Reduction

OpenAI's text-embedding-3 supports dimension reduction:

```toml
[semantic.providers.openai]
model = "text-embedding-3-small"
dimensions = 512  # Reduce from 1536 to 512
```

## Error Handling

```rust
match embedder.embed("text").await {
    Ok(embedding) => use_embedding(embedding),
    Err(EmbeddingError::RateLimited { retry_after }) => {
        tokio::time::sleep(retry_after).await;
        // Retry
    }
    Err(EmbeddingError::InvalidInput(msg)) => {
        eprintln!("Invalid input: {}", msg);
    }
    Err(EmbeddingError::ProviderError(msg)) => {
        eprintln!("Provider error: {}", msg);
    }
    Err(EmbeddingError::Timeout) => {
        eprintln!("Request timed out");
    }
}
```

## Cost Tracking

Monitor embedding API costs:

```bash
SEMANTIC.STATS
# Returns:
# total_requests: 10000
# total_tokens: 5000000
# estimated_cost_usd: 0.50
# provider_breakdown: {
#   "openai": {"requests": 8000, "tokens": 4000000},
#   "cohere": {"requests": 2000, "tokens": 1000000}
# }
```

## Performance

| Operation | Latency |
|-----------|---------|
| Cache hit | &lt;1ms |
| Local ONNX | 5-20ms |
| OpenAI API | 50-200ms |
| Cohere API | 50-200ms |
| HuggingFace API | 100-500ms |

## Best Practices

1. **Use caching** - Avoid re-embedding the same text
2. **Batch requests** - More efficient than single requests
3. **Choose appropriate model** - Balance quality vs. cost
4. **Set timeouts** - Handle slow API responses
5. **Monitor costs** - Track token usage
6. **Use local for dev** - Faster iteration, no costs

## Next Steps

- [Vector Indexes](/docs/ai-ml/vector-indexes) - Store and search embeddings
- [Semantic Search](/docs/ai-ml/semantic-search) - Build search applications
- [RAG Pipeline](/docs/ai-ml/rag-pipeline) - Document retrieval
