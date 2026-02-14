---
sidebar_position: 6
maturity: experimental
---

:::caution Experimental Feature
This feature is **experimental** and subject to change. APIs, behavior, and performance characteristics may evolve significantly between releases. Use with caution in production environments.
:::

# LLM Caching

Cache LLM responses using semantic similarity to reduce costs and latency.

## Overview

LLM caching stores responses to similar queries, avoiding redundant API calls. Unlike exact-match caching, semantic caching finds matches based on meaning:

```
Query: "What is machine learning?"
Cached: "Explain machine learning"
→ Cache HIT (92% similarity)

Without semantic caching:
→ Cache MISS (different string)
```

### Cost Savings

| Scenario | API Calls | Cost |
|----------|-----------|------|
| No caching | 100,000 | $200 |
| Exact caching | 70,000 | $140 |
| Semantic caching | 20,000 | $40 |

Typical savings: **60-80% reduction** in LLM API costs.

## Quick Start

```bash
# Cache an LLM response
SEMANTIC.SET "What is Python?" "Python is a programming language..." [0.1, 0.2, ...]

# Query with similar text (auto-embeds if configured)
SEMANTIC.GETTEXT "Explain Python programming" THRESHOLD 0.85
# Returns cached response if similarity >= 0.85

# Or query with pre-computed embedding
SEMANTIC.GET [0.12, 0.19, ...] THRESHOLD 0.85
```

## Configuration

```toml
[semantic]
enabled = true

[semantic.cache]
max_entries = 100000         # Maximum cached responses
default_threshold = 0.85     # Similarity threshold
default_ttl_secs = 3600      # 1 hour TTL

[semantic.index]
type = "hnsw"                # Index type
dimensions = 384             # Embedding dimensions
metric = "cosine"            # Distance metric

[semantic.embedding]
provider = "openai"          # or "cohere", "local", "huggingface"
model = "text-embedding-3-small"
api_key = "${OPENAI_API_KEY}"
```

## Commands

### SEMANTIC.SET

Cache a query-response pair:

```bash
SEMANTIC.SET <query> <response> <embedding> [TTL_SECS]

# Example
SEMANTIC.SET "What is Redis?" "Redis is an in-memory data store..." [0.1, 0.2, ...] 7200
```

### SEMANTIC.GET

Retrieve by embedding vector:

```bash
SEMANTIC.GET <embedding> [THRESHOLD] [COUNT]

# Single best match
SEMANTIC.GET [0.1, 0.2, ...] 0.85

# Multiple matches
SEMANTIC.GET [0.1, 0.2, ...] 0.80 5
```

### SEMANTIC.GETTEXT

Retrieve by text (auto-generates embedding):

```bash
SEMANTIC.GETTEXT <query_text> [THRESHOLD] [COUNT]

# Example
SEMANTIC.GETTEXT "Explain Redis database" 0.85
```

### SEMANTIC.DEL

Delete a cached entry:

```bash
SEMANTIC.DEL <cache_id>
```

### SEMANTIC.CLEAR

Clear all cached entries:

```bash
SEMANTIC.CLEAR
```

### SEMANTIC.INFO

Get cache configuration:

```bash
SEMANTIC.INFO
# Returns:
# semantic_enabled: true
# embedding_dim: 384
# default_threshold: 0.85
# max_entries: 100000
# index_type: hnsw
# distance_metric: cosine
```

### SEMANTIC.STATS

Get cache statistics:

```bash
SEMANTIC.STATS
# Returns:
# entries: 45000
# hits: 95000
# misses: 5000
# hit_rate: 0.95
# avg_similarity: 0.91
# evictions: 1000
```

## Threshold Guidelines

| Threshold | Hit Rate | Quality | Use Case |
|-----------|----------|---------|----------|
| 0.95+ | Low | Highest | Critical accuracy needed |
| 0.90 | Medium | High | Production default |
| 0.85 | High | Good | General LLM caching |
| 0.80 | Very High | Moderate | Cost-sensitive apps |
| < 0.80 | Highest | Lower | Maximum cost savings |

## TTL Strategies

```bash
# No expiration (reference data)
SEMANTIC.SET "What is the speed of light?" "..." [...] 0

# Short TTL (time-sensitive)
SEMANTIC.SET "What's the weather today?" "..." [...] 900  # 15 minutes

# Medium TTL (general knowledge)
SEMANTIC.SET "Explain quantum computing" "..." [...] 3600  # 1 hour

# Long TTL (stable content)
SEMANTIC.SET "What is Python?" "..." [...] 86400  # 24 hours
```

## Rust API

```rust
use ferrite::semantic::{LlmCache, LlmCacheConfig, EmbeddingProvider};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Create LLM cache
    let cache = LlmCache::new(LlmCacheConfig {
        embedding: EmbeddingConfig {
            provider: EmbeddingProvider::OpenAI {
                api_key: std::env::var("OPENAI_API_KEY")?,
                model: "text-embedding-3-small".to_string(),
            },
            ..Default::default()
        },
        cache: CacheConfig {
            max_entries: 100_000,
            default_threshold: 0.85,
            default_ttl: Duration::from_secs(3600),
            ..Default::default()
        },
        ..Default::default()
    })?;

    let query = "What is machine learning?";

    // Check cache before calling LLM
    if let Some(cached) = cache.get(query).await? {
        println!("Cache hit! Similarity: {:.2}", cached.similarity);
        println!("Response: {}", cached.response);
        println!("Cost saved: ${:.4}", cached.cost_saved);
        return Ok(());
    }

    // Cache miss - call LLM
    let response = call_llm(query).await?;

    // Cache the response
    cache.set(query, &response, None).await?;  // Use default TTL

    // Get statistics
    let stats = cache.stats();
    println!("Hit rate: {:.1}%", stats.hit_rate * 100.0);
    println!("Total cost saved: ${:.2}", stats.cost_saved);

    Ok(())
}
```

## Embedding Providers

### OpenAI

```toml
[semantic.embedding]
provider = "openai"
model = "text-embedding-3-small"  # 1536 dims, $0.02/1M tokens
api_key = "${OPENAI_API_KEY}"
```

### Cohere

```toml
[semantic.embedding]
provider = "cohere"
model = "embed-english-v3.0"  # 1024 dims
api_key = "${COHERE_API_KEY}"
```

### Local ONNX

```toml
[semantic.embedding]
provider = "local"
model_path = "/models/all-MiniLM-L6-v2.onnx"  # 384 dims
tokenizer_path = "/models/tokenizer.json"
```

### HuggingFace

```toml
[semantic.embedding]
provider = "huggingface"
model = "sentence-transformers/all-MiniLM-L6-v2"
api_key = "${HF_API_KEY}"
```

## Resilience Patterns

### Circuit Breaker

Automatically fail fast when embedding provider is down:

```toml
[semantic.resilience.circuit_breaker]
enabled = true
failure_threshold = 5        # Open after 5 failures
success_threshold = 3        # Close after 3 successes
timeout_secs = 30            # Reset timeout
```

### Retry Policy

Retry failed embedding requests:

```toml
[semantic.resilience.retry]
max_retries = 3
initial_delay_ms = 100
max_delay_ms = 10000
backoff_multiplier = 2.0
add_jitter = true
```

### Fallback Strategy

Use fallback when primary provider fails:

```toml
[semantic.resilience.fallback]
strategy = "secondary"       # or "cache_only", "skip"
secondary_provider = "local"
```

## Cost Tracking

```rust
let stats = cache.cost_stats();

println!("Embedding Costs:");
println!("  API calls: {}", stats.embedding_calls);
println!("  Tokens: {}", stats.embedding_tokens);
println!("  Cost: ${:.4}", stats.embedding_cost);

println!("\nSavings:");
println!("  LLM calls saved: {}", stats.llm_calls_saved);
println!("  Cost saved: ${:.2}", stats.cost_saved);
println!("  Savings rate: {:.1}%", stats.savings_rate * 100.0);
```

## Hybrid Caching

Combine exact-match and semantic caching:

```rust
// Check exact match first (fastest)
if let Some(exact) = exact_cache.get(&query_hash)? {
    return Ok(exact);
}

// Then check semantic similarity
if let Some(semantic) = semantic_cache.get(&query, 0.85).await? {
    return Ok(semantic);
}

// Cache miss - call LLM and cache both ways
let response = call_llm(&query).await?;
exact_cache.set(&query_hash, &response)?;
semantic_cache.set(&query, &response).await?;
```

## Cache Warming

Pre-populate cache with common queries:

```rust
let common_queries = vec![
    ("What is Python?", "Python is a programming language..."),
    ("Explain machine learning", "Machine learning is..."),
    ("How does HTTP work?", "HTTP is a protocol..."),
];

for (query, response) in common_queries {
    cache.set(query, response, Some(Duration::from_secs(86400))).await?;
}
```

## Performance

| Operation | Latency |
|-----------|---------|
| Cache hit (exact) | < 1ms |
| Cache hit (semantic) | 1-5ms |
| Embedding (local ONNX) | 5-20ms |
| Embedding (OpenAI API) | 50-200ms |
| LLM API call | 500ms - 5s |

## Best Practices

1. **Choose appropriate threshold** - 0.85 is good default, adjust based on domain
2. **Use local embeddings** - Lower latency, no API costs
3. **Implement fallbacks** - Don't let embedding failures break your app
4. **Monitor hit rates** - Aim for > 70% hit rate
5. **Set appropriate TTLs** - Balance freshness vs. cache efficiency
6. **Warm the cache** - Pre-populate with common queries
7. **Track costs** - Monitor savings to justify caching infrastructure

## Next Steps

- [Embeddings](/docs/ai-ml/embeddings) - Embedding provider configuration
- [Semantic Search](/docs/ai-ml/semantic-search) - Vector similarity search
- [RAG Pipeline](/docs/ai-ml/rag-pipeline) - Document retrieval
