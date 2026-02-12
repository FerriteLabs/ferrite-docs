---
maturity: beta
---

# Semantic Caching

Semantic caching stores LLM responses indexed by the semantic meaning of queries, enabling cache hits even when queries are phrased differently but have the same intent.

## Overview

Traditional caching requires exact key matches. Semantic caching uses vector embeddings to find similar queries:

```
┌─────────────────────────────────────────────────────────────┐
│                    Semantic Cache Flow                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   Query: "What's the weather in NYC?"                       │
│              │                                               │
│              ▼                                               │
│   ┌──────────────────┐                                      │
│   │  Generate        │                                      │
│   │  Embedding       │                                      │
│   └────────┬─────────┘                                      │
│            │                                                 │
│            ▼                                                 │
│   ┌──────────────────┐    Similar Query Found?              │
│   │  Vector Search   │──────────────────────────┐           │
│   │  (similarity)    │                          │           │
│   └────────┬─────────┘                          │           │
│            │                                    │           │
│     No     │                             Yes    │           │
│   match    ▼                                    ▼           │
│   ┌──────────────────┐              ┌──────────────────┐   │
│   │  Call LLM API    │              │  Return Cached   │   │
│   │  (expensive)     │              │  Response        │   │
│   └────────┬─────────┘              │  (fast + cheap)  │   │
│            │                        └──────────────────┘   │
│            ▼                                                │
│   ┌──────────────────┐                                      │
│   │  Cache Response  │                                      │
│   │  with Embedding  │                                      │
│   └──────────────────┘                                      │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Quick Start

### Enable Semantic Caching

```bash
# Connect to Ferrite
ferrite-cli

# Configure embedding provider
SEMANTIC.CONFIG PROVIDER openai API_KEY $OPENAI_API_KEY MODEL text-embedding-3-small

# Create semantic cache
SEMANTIC.CACHE.CREATE llm_cache DIMENSIONS 1536 SIMILARITY 0.92
```

### Use the Cache

```bash
# Store a response with its query
SEMANTIC.CACHE.SET llm_cache "What is the capital of France?" "The capital of France is Paris."

# Query with similar phrasing (cache hit!)
SEMANTIC.CACHE.GET llm_cache "What's France's capital city?"
# Returns: "The capital of France is Paris."

# Different topic (cache miss)
SEMANTIC.CACHE.GET llm_cache "What is the capital of Germany?"
# Returns: (nil)
```

## Configuration

### Cache Settings

```bash
SEMANTIC.CACHE.CREATE cache_name
  DIMENSIONS 1536           # Embedding dimensions
  SIMILARITY 0.92           # Similarity threshold (0-1)
  TTL 86400                 # Cache TTL in seconds
  MAX_ENTRIES 100000        # Maximum cached entries
  INDEX_TYPE hnsw           # Vector index type
  METADATA_FILTER true      # Enable metadata filtering
```

### Embedding Providers

```bash
# OpenAI
SEMANTIC.CONFIG PROVIDER openai
  API_KEY $OPENAI_API_KEY
  MODEL text-embedding-3-small
  DIMENSIONS 1536

# Cohere
SEMANTIC.CONFIG PROVIDER cohere
  API_KEY $COHERE_API_KEY
  MODEL embed-english-v3.0

# Local ONNX model
SEMANTIC.CONFIG PROVIDER onnx
  MODEL_PATH /models/all-MiniLM-L6-v2.onnx
  DIMENSIONS 384

# Multiple providers (fallback)
SEMANTIC.CONFIG PROVIDERS
  PRIMARY openai API_KEY $OPENAI_KEY MODEL text-embedding-3-small
  FALLBACK onnx MODEL_PATH /models/fallback.onnx
```

## Rust Usage

### Basic Caching

```rust
use ferrite::semantic::{SemanticCache, CacheConfig, EmbeddingProvider};

// Create cache
let cache = SemanticCache::new(CacheConfig {
    name: "llm_cache".to_string(),
    dimensions: 1536,
    similarity_threshold: 0.92,
    ttl: Some(Duration::from_secs(86400)),
    max_entries: Some(100_000),
    provider: EmbeddingProvider::OpenAI {
        api_key: std::env::var("OPENAI_API_KEY")?,
        model: "text-embedding-3-small".to_string(),
    },
})?;

// Store response
cache.set("What is Rust?", "Rust is a systems programming language...").await?;

// Get cached response (or None if no similar query)
if let Some(response) = cache.get("Tell me about Rust programming").await? {
    println!("Cache hit: {}", response);
} else {
    println!("Cache miss - call LLM");
}
```

### With LLM Integration

```rust
use ferrite::semantic::{SemanticCache, LlmClient};

struct CachedLlm {
    cache: SemanticCache,
    llm: LlmClient,
}

impl CachedLlm {
    pub async fn query(&self, prompt: &str) -> Result<String> {
        // Check cache first
        if let Some(cached) = self.cache.get(prompt).await? {
            tracing::info!("Cache hit for: {}", prompt);
            return Ok(cached);
        }

        // Cache miss - call LLM
        tracing::info!("Cache miss, calling LLM: {}", prompt);
        let response = self.llm.complete(prompt).await?;

        // Store in cache
        self.cache.set(prompt, &response).await?;

        Ok(response)
    }
}
```

### With Metadata Filtering

```rust
use std::collections::HashMap;

// Store with metadata
let mut metadata = HashMap::new();
metadata.insert("user_id".to_string(), "123".to_string());
metadata.insert("model".to_string(), "gpt-4".to_string());
metadata.insert("temperature".to_string(), "0.7".to_string());

cache.set_with_metadata(
    "Explain quantum computing",
    "Quantum computing uses quantum mechanics...",
    metadata,
).await?;

// Query with metadata filter (only match same user's queries)
let filter = json!({ "user_id": "123" });
let response = cache.get_with_filter("What is quantum computing?", Some(filter)).await?;
```

### Batch Operations

```rust
// Store multiple entries
let entries = vec![
    ("What is AI?", "AI is artificial intelligence..."),
    ("What is ML?", "ML is machine learning..."),
    ("What is deep learning?", "Deep learning uses neural networks..."),
];

cache.set_batch(entries).await?;

// Query multiple (returns all cache hits)
let queries = vec![
    "Tell me about AI",
    "Explain machine learning",
    "What's the weather?",
];

let results = cache.get_batch(queries).await?;
// results[0] = Some("AI is artificial intelligence...")
// results[1] = Some("ML is machine learning...")
// results[2] = None (no match)
```

## Python Usage

```python
from ferrite import SemanticCache, CacheConfig, EmbeddingProvider

# Create cache
config = CacheConfig(
    name="llm_cache",
    dimensions=1536,
    similarity_threshold=0.92,
    ttl=86400,
    max_entries=100_000,
    provider=EmbeddingProvider.OpenAI(
        api_key=os.environ["OPENAI_API_KEY"],
        model="text-embedding-3-small",
    ),
)

cache = SemanticCache(config)

# Store response
await cache.set("What is Python?", "Python is a programming language...")

# Get cached response
response = await cache.get("Tell me about Python programming")
if response:
    print(f"Cache hit: {response}")
else:
    print("Cache miss")
```

### With LangChain

```python
from langchain.cache import BaseCache
from ferrite import SemanticCache

class FerriteSemanticCache(BaseCache):
    def __init__(self, cache: SemanticCache):
        self.cache = cache

    def lookup(self, prompt: str, llm_string: str) -> Optional[str]:
        # Include LLM config in metadata filter
        filter = {"llm_string": llm_string}
        return self.cache.get_sync(prompt, filter=filter)

    def update(self, prompt: str, llm_string: str, response: str):
        metadata = {"llm_string": llm_string}
        self.cache.set_sync(prompt, response, metadata=metadata)

# Use with LangChain
from langchain.globals import set_llm_cache

cache = SemanticCache(config)
set_llm_cache(FerriteSemanticCache(cache))

# Now LangChain will use semantic caching automatically
llm = ChatOpenAI()
response = llm.invoke("What is the capital of France?")  # Cached semantically
```

## TypeScript Usage

```typescript
import { SemanticCache, CacheConfig, EmbeddingProvider } from "@ferrite/client";

// Create cache
const cache = new SemanticCache({
  name: "llm_cache",
  dimensions: 1536,
  similarityThreshold: 0.92,
  ttl: 86400,
  maxEntries: 100_000,
  provider: EmbeddingProvider.OpenAI({
    apiKey: process.env.OPENAI_API_KEY!,
    model: "text-embedding-3-small",
  }),
});

// Store response
await cache.set("What is JavaScript?", "JavaScript is a programming language...");

// Get cached response
const response = await cache.get("Tell me about JS programming");
if (response) {
  console.log(`Cache hit: ${response}`);
} else {
  console.log("Cache miss");
}
```

### With OpenAI SDK

```typescript
import OpenAI from "openai";
import { SemanticCache } from "@ferrite/client";

const openai = new OpenAI();
const cache = new SemanticCache({ /* config */ });

async function cachedCompletion(prompt: string): Promise<string> {
  // Check cache
  const cached = await cache.get(prompt);
  if (cached) {
    return cached;
  }

  // Call OpenAI
  const completion = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [{ role: "user", content: prompt }],
  });

  const response = completion.choices[0].message.content!;

  // Cache response
  await cache.set(prompt, response);

  return response;
}
```

## Tuning Similarity Threshold

The similarity threshold controls cache hit sensitivity:

| Threshold | Behavior | Use Case |
|-----------|----------|----------|
| 0.99 | Very strict | Exact semantic match required |
| 0.95 | Strict | Minor variations allowed |
| 0.92 | Balanced | Good for most use cases |
| 0.85 | Loose | More cache hits, risk of wrong matches |
| 0.80 | Very loose | Aggressive caching |

### Finding the Right Threshold

```rust
// Experiment with different thresholds
let test_pairs = vec![
    ("What is AI?", "What is artificial intelligence?", true),  // Should match
    ("What is AI?", "What is machine learning?", false),        // Should not match
    ("Capital of France?", "What city is France's capital?", true),
    ("Capital of France?", "Capital of Germany?", false),
];

for threshold in [0.80, 0.85, 0.90, 0.92, 0.95, 0.99] {
    let cache = SemanticCache::with_threshold(threshold);

    let mut correct = 0;
    for (query1, query2, should_match) in &test_pairs {
        cache.set(query1, "response").await?;
        let result = cache.get(query2).await?;

        if result.is_some() == *should_match {
            correct += 1;
        }
    }

    println!("Threshold {}: {}/{} correct", threshold, correct, test_pairs.len());
}
```

## Cache Management

### Statistics

```bash
# Get cache statistics
SEMANTIC.CACHE.STATS llm_cache

# Returns:
# {
#   "entries": 45632,
#   "hits": 892341,
#   "misses": 123456,
#   "hit_rate": 0.878,
#   "avg_similarity": 0.946,
#   "memory_bytes": 234567890
# }
```

### Maintenance

```bash
# Clear expired entries
SEMANTIC.CACHE.CLEANUP llm_cache

# Clear entire cache
SEMANTIC.CACHE.CLEAR llm_cache

# Delete specific entry
SEMANTIC.CACHE.DELETE llm_cache "exact query text"

# Invalidate by metadata
SEMANTIC.CACHE.INVALIDATE llm_cache FILTER '{"model": "gpt-3.5"}'
```

### Rust Maintenance API

```rust
// Get statistics
let stats = cache.stats().await?;
println!("Hit rate: {:.1}%", stats.hit_rate * 100.0);

// Cleanup expired
let removed = cache.cleanup().await?;
println!("Removed {} expired entries", removed);

// Invalidate by metadata
cache.invalidate(json!({ "model": "gpt-3.5" })).await?;

// Clear all
cache.clear().await?;
```

## Cost Savings Analysis

```rust
use ferrite::semantic::{SemanticCache, CostTracker};

let cache = SemanticCache::with_cost_tracking(config)?;

// After some usage...
let savings = cache.cost_tracker().calculate_savings(
    0.002,  // Cost per 1K input tokens
    0.006,  // Cost per 1K output tokens
    500,    // Average input tokens
    1000,   // Average output tokens
);

println!("Cache Statistics:");
println!("  Total queries: {}", savings.total_queries);
println!("  Cache hits: {}", savings.cache_hits);
println!("  Hit rate: {:.1}%", savings.hit_rate * 100.0);
println!("");
println!("Cost Savings:");
println!("  API calls avoided: {}", savings.api_calls_avoided);
println!("  Estimated savings: ${:.2}", savings.estimated_savings);
println!("  Cache cost: ${:.4}", savings.cache_cost);
println!("  Net savings: ${:.2}", savings.net_savings);
```

## Best Practices

### 1. Normalize Queries

```rust
fn normalize_query(query: &str) -> String {
    query
        .to_lowercase()
        .trim()
        .replace("\n", " ")
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
}

// Use normalized query for caching
let normalized = normalize_query(user_query);
cache.set(&normalized, response).await?;
```

### 2. Use Metadata for Context

```rust
// Include relevant context in metadata
let metadata = json!({
    "user_id": user.id,
    "language": "en",
    "model": "gpt-4",
    "temperature": 0.7,
    "system_prompt_hash": hash_prompt(&system_prompt),
});

cache.set_with_metadata(query, response, metadata).await?;

// Filter by context when retrieving
cache.get_with_filter(query, Some(json!({
    "language": "en",
    "model": "gpt-4"
}))).await?;
```

### 3. Set Appropriate TTL

```rust
// Factual queries - longer TTL
let factual_cache = SemanticCache::new(CacheConfig {
    ttl: Some(Duration::from_secs(86400 * 7)), // 1 week
    ..default_config()
});

// Time-sensitive queries - shorter TTL
let news_cache = SemanticCache::new(CacheConfig {
    ttl: Some(Duration::from_secs(3600)), // 1 hour
    ..default_config()
});
```

### 4. Monitor and Tune

```rust
// Track cache performance
let metrics = cache.metrics();

if metrics.hit_rate() < 0.5 {
    // Consider lowering similarity threshold
    tracing::warn!("Low hit rate: {:.1}%", metrics.hit_rate() * 100.0);
}

if metrics.avg_similarity() < 0.85 {
    // Threshold might be too low, risking wrong matches
    tracing::warn!("Low avg similarity: {:.3}", metrics.avg_similarity());
}
```

## Related Topics

- [Vector Search](/docs/guides/vector-search) - Underlying vector index
- [Embeddings](/docs/ai-ml/embeddings) - Embedding providers
- [LLM Caching](/docs/ai-ml/llm-caching) - Traditional LLM caching
- [RAG Pipeline](/docs/ai-ml/rag-pipeline) - Building RAG systems
