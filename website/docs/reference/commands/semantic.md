---
sidebar_position: 21
maturity: beta
---

# Semantic Commands

Commands for semantic caching and similarity-based operations.

## Overview

Semantic commands enable caching and retrieving data based on semantic similarity rather than exact key matching, powered by embeddings and vector search.

## Commands

### SEMANTIC.CACHE.SET

Store value with semantic key.

```bash
SEMANTIC.CACHE.SET key value
  [EX seconds]
  [THRESHOLD similarity]
  [EMBEDDING vector]
```

**Options:**
- `EX` - Expiration in seconds
- `THRESHOLD` - Minimum similarity for match (0.0-1.0)
- `EMBEDDING` - Pre-computed embedding vector

**Examples:**
```bash
# Auto-generate embedding from key text
SEMANTIC.CACHE.SET "What is the capital of France?" "Paris is the capital of France."

# With expiration
SEMANTIC.CACHE.SET "Explain machine learning" "Machine learning is..." EX 3600

# With custom threshold
SEMANTIC.CACHE.SET "Python tutorials" "..." THRESHOLD 0.85
```

---

### SEMANTIC.CACHE.GET

Retrieve by semantic similarity.

```bash
SEMANTIC.CACHE.GET query
  [THRESHOLD similarity]
  [WITHSCORE]
```

**Examples:**
```bash
# Semantic lookup
SEMANTIC.CACHE.GET "What's the capital city of France?"
# Returns: "Paris is the capital of France."

# With similarity score
SEMANTIC.CACHE.GET "capital of france" WITHSCORE
# 1) "Paris is the capital of France."
# 2) "0.92"

# Stricter threshold
SEMANTIC.CACHE.GET "france capital" THRESHOLD 0.9
# (nil) if no match above 0.9
```

---

### SEMANTIC.CACHE.DEL

Delete semantic cache entry.

```bash
SEMANTIC.CACHE.DEL key
```

---

### SEMANTIC.CACHE.CLEAR

Clear all semantic cache entries.

```bash
SEMANTIC.CACHE.CLEAR [PATTERN pattern]
```

---

### SEMANTIC.CACHE.INFO

Get cache statistics.

```bash
SEMANTIC.CACHE.INFO
```

**Examples:**
```bash
SEMANTIC.CACHE.INFO
# {
#   "entries": 10000,
#   "memory": "45.5 MB",
#   "hits": 8500,
#   "misses": 1500,
#   "hit_rate": 0.85,
#   "avg_similarity": 0.89
# }
```

---

### SEMANTIC.SEARCH

Search by semantic similarity.

```bash
SEMANTIC.SEARCH namespace query
  K count
  [THRESHOLD similarity]
  [FILTER expression]
  [WITHSCORES]
```

**Examples:**
```bash
# Search similar documents
SEMANTIC.SEARCH docs "machine learning basics" K 10

# With filter
SEMANTIC.SEARCH docs "python programming" K 10 FILTER "category = 'tutorials'"

# With scores
SEMANTIC.SEARCH docs "data science" K 5 WITHSCORES
```

---

### SEMANTIC.ADD

Add item to semantic store.

```bash
SEMANTIC.ADD namespace id content
  [METADATA json]
  [EMBEDDING vector]
```

**Examples:**
```bash
SEMANTIC.ADD docs doc:1 "Introduction to machine learning..."
  METADATA '{"author": "Alice", "category": "tutorials"}'

SEMANTIC.ADD faqs faq:1 "How do I reset my password?"
  METADATA '{"topic": "account"}'
```

---

### SEMANTIC.GET

Get item by ID.

```bash
SEMANTIC.GET namespace id
```

---

### SEMANTIC.DEL

Delete item.

```bash
SEMANTIC.DEL namespace id
```

---

### SEMANTIC.SIMILAR

Find similar items.

```bash
SEMANTIC.SIMILAR namespace id
  K count
  [THRESHOLD similarity]
  [WITHSCORES]
```

**Examples:**
```bash
# Find items similar to doc:1
SEMANTIC.SIMILAR docs doc:1 K 10 WITHSCORES
```

---

### SEMANTIC.EMBED

Generate embedding for text.

```bash
SEMANTIC.EMBED text [MODEL model]
```

**Examples:**
```bash
SEMANTIC.EMBED "What is machine learning?"
# Returns embedding vector

SEMANTIC.EMBED "Hello world" MODEL openai-ada-002
```

---

### SEMANTIC.CONFIG

Configure semantic settings.

```bash
SEMANTIC.CONFIG GET parameter
SEMANTIC.CONFIG SET parameter value
```

**Parameters:**
- `default_model` - Embedding model
- `default_threshold` - Default similarity threshold
- `cache_ttl` - Default cache TTL

## LLM Caching Commands

### SEMANTIC.LLM.CACHE

Cache LLM response with semantic matching.

```bash
SEMANTIC.LLM.CACHE prompt response
  [EX seconds]
  [THRESHOLD similarity]
  [MODEL model]
  [TOKENS token_count]
```

**Examples:**
```bash
SEMANTIC.LLM.CACHE
  "Explain quantum computing in simple terms"
  "Quantum computing uses quantum bits..."
  EX 86400
  MODEL gpt-4
  TOKENS 150
```

---

### SEMANTIC.LLM.GET

Get cached LLM response.

```bash
SEMANTIC.LLM.GET prompt
  [THRESHOLD similarity]
  [WITHMETADATA]
```

**Examples:**
```bash
SEMANTIC.LLM.GET "What is quantum computing?" WITHMETADATA
# 1) "Quantum computing uses quantum bits..."
# 2) {"similarity": 0.94, "model": "gpt-4", "tokens_saved": 150}
```

---

### SEMANTIC.LLM.STATS

Get LLM cache statistics.

```bash
SEMANTIC.LLM.STATS
```

**Examples:**
```bash
SEMANTIC.LLM.STATS
# {
#   "cache_entries": 5000,
#   "total_hits": 12000,
#   "total_misses": 3000,
#   "hit_rate": 0.80,
#   "tokens_saved": 1800000,
#   "estimated_cost_saved": "$36.00"
# }
```

## Use Cases

### FAQ Matching

```bash
# Add FAQs
SEMANTIC.ADD faqs faq:1 "How do I reset my password?"
  METADATA '{"answer": "Click forgot password on login page..."}'

SEMANTIC.ADD faqs faq:2 "How to change my email address?"
  METADATA '{"answer": "Go to Settings > Account > Email..."}'

# Match user question
SEMANTIC.SEARCH faqs "I forgot my password what should I do?" K 1
# Returns faq:1 with high similarity
```

### Documentation Search

```bash
# Index documentation
SEMANTIC.ADD docs doc:api:auth "Authentication API documentation..."
  METADATA '{"section": "api", "topic": "auth"}'

SEMANTIC.ADD docs doc:api:users "User management API documentation..."
  METADATA '{"section": "api", "topic": "users"}'

# Search docs
SEMANTIC.SEARCH docs "how to authenticate users" K 5
  FILTER "section = 'api'"
```

### LLM Response Caching

```bash
# Application code
response = SEMANTIC.LLM.GET prompt THRESHOLD 0.9

if response is nil:
    response = call_openai(prompt)
    SEMANTIC.LLM.CACHE prompt response EX 86400 TOKENS token_count

return response
```

### Product Recommendations

```bash
# Add products with descriptions
SEMANTIC.ADD products prod:1 "Wireless noise-canceling headphones with 30-hour battery"
  METADATA '{"category": "electronics", "price": 299}'

# Find similar products
SEMANTIC.SIMILAR products prod:1 K 5
# Returns similar headphones

# Search by description
SEMANTIC.SEARCH products "headphones for travel with long battery" K 10
  FILTER "price < 400"
```

## Rust API

```rust
use ferrite::Client;
use ferrite::semantic::{SemanticOptions, LLMCacheOptions};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let client = Client::connect("localhost:6379").await?;

    // Semantic cache
    client.semantic_cache_set(
        "What is the capital of France?",
        "Paris is the capital of France.",
        SemanticOptions::default().ex(3600),
    ).await?;

    // Semantic lookup
    let result = client.semantic_cache_get(
        "capital of france",
        SemanticOptions::default().threshold(0.85).with_score(),
    ).await?;

    if let Some((value, score)) = result {
        println!("Found: {} (similarity: {})", value, score);
    }

    // LLM caching
    let prompt = "Explain quantum computing";
    let cached = client.semantic_llm_get(prompt, 0.9).await?;

    let response = match cached {
        Some(r) => r,
        None => {
            let response = call_llm(prompt).await?;
            client.semantic_llm_cache(
                prompt,
                &response,
                LLMCacheOptions::default()
                    .ex(86400)
                    .model("gpt-4")
                    .tokens(150),
            ).await?;
            response
        }
    };

    // Semantic search
    client.semantic_add("docs", "doc:1", "Machine learning tutorial...", json!({
        "category": "tutorials"
    })).await?;

    let results = client.semantic_search(
        "docs",
        "ML basics",
        10,
        SemanticSearchOptions::default()
            .filter("category = 'tutorials'")
            .with_scores(),
    ).await?;

    Ok(())
}
```

## Configuration

```toml
[semantic]
enabled = true
default_model = "sentence-transformers/all-MiniLM-L6-v2"
default_threshold = 0.85
cache_ttl = 3600

[semantic.embedding]
provider = "local"  # local, openai, cohere
batch_size = 32
dimensions = 384

[semantic.llm_cache]
enabled = true
default_ttl = 86400
max_entries = 100000
```

## Related Commands

- [Vector Commands](/docs/reference/commands/vector) - Vector operations
- [Search Commands](/docs/reference/commands/search) - Full-text search
- [Semantic Caching Guide](/docs/ai-ml/llm-caching) - Detailed guide
