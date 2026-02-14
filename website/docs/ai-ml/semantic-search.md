---
sidebar_position: 4
maturity: experimental
---

:::info Beta Feature
This feature is in **beta**. It is feature-complete but still undergoing testing. APIs may change in minor ways before stabilization.
:::

# Semantic Search

Build powerful search applications using vector similarity and hybrid retrieval.

## Overview

Semantic search finds results based on meaning rather than exact keyword matches. Ferrite combines vector similarity search with traditional keyword search for high-quality retrieval.

```
User Query: "How do I fix a flat tire?"

Traditional Search (keyword):
❌ "How to repair a punctured wheel" (no keyword match)
✓ "How do I fix a flat tire" (exact match only)

Semantic Search (meaning):
✓ "How to repair a punctured wheel" (similar meaning)
✓ "Steps to change a flat tire" (similar meaning)
✓ "Tire repair guide" (related concept)
```

## Quick Start

```bash
# Create a searchable index
VECTOR.CREATE products DIMS 384 METRIC cosine INDEX hnsw

# Add documents with embeddings
VECTOR.ADD products doc1 [0.1, 0.2, ...] METADATA '{"title": "Wireless Headphones", "category": "electronics"}'
VECTOR.ADD products doc2 [0.15, 0.18, ...] METADATA '{"title": "Bluetooth Earbuds", "category": "electronics"}'

# Search by meaning
VECTOR.SEARCH products [0.12, 0.19, ...] K 10
```

## Search Modes

### Pure Vector Search

Search based solely on vector similarity:

```bash
# Find 10 most similar items
VECTOR.SEARCH products [0.1, 0.2, ...] K 10

# With similarity threshold
VECTOR.SEARCH products [0.1, 0.2, ...] K 10 THRESHOLD 0.8
```

### Filtered Search

Combine vector search with metadata filters:

```bash
# Vector search with category filter
VECTOR.SEARCH products [0.1, ...] K 10 FILTER '{"category": "electronics"}'

# Multiple filter conditions
VECTOR.SEARCH products [0.1, ...] K 10 FILTER '{"category": "electronics", "price": {"$lt": 100}}'

# Complex filters
VECTOR.SEARCH products [0.1, ...] K 10 FILTER '{
  "$or": [
    {"category": "electronics"},
    {"featured": true}
  ]
}'
```

### Hybrid Search

Combine vector similarity with keyword relevance:

```bash
# 50% vector, 50% keyword
VECTOR.SEARCH products [0.1, ...] K 10 HYBRID "wireless headphones" WEIGHT 0.5

# More weight on semantic similarity (80%)
VECTOR.SEARCH products [0.1, ...] K 10 HYBRID "bluetooth audio" WEIGHT 0.8

# More weight on keywords (20% vector)
VECTOR.SEARCH products [0.1, ...] K 10 HYBRID "exact product name" WEIGHT 0.2
```

## Search Pipeline

### 1. Query Processing

```bash
# Generate embedding for query text
SEMANTIC.EMBED "wireless noise cancelling headphones"
# Returns: [0.12, 0.19, 0.05, ...]
```

### 2. Vector Search

```bash
# Search with generated embedding
VECTOR.SEARCH products [0.12, 0.19, 0.05, ...] K 20 THRESHOLD 0.7
```

### 3. Re-ranking (Optional)

```bash
# Re-rank results with a more accurate model
SEMANTIC.RERANK products [result_ids...] "original query" MODEL cross-encoder
```

## Scoring & Ranking

### Similarity Metrics

| Metric | Range | Best For |
|--------|-------|----------|
| Cosine | 0 to 1 | Text embeddings |
| Euclidean | 0 to ∞ | Dense features |
| Dot Product | -∞ to ∞ | Normalized vectors |

### Score Interpretation

```
Cosine Similarity:
1.0  = Identical meaning
0.9+ = Very similar
0.8+ = Similar
0.7+ = Related
<0.7 = Weak relationship
```

### Hybrid Scoring

```
final_score = (weight × vector_score) + ((1 - weight) × keyword_score)

Example (weight = 0.7):
  vector_score = 0.85
  keyword_score = 0.60
  final_score = (0.7 × 0.85) + (0.3 × 0.60) = 0.775
```

## Filter Operators

### Comparison

```json
{"price": {"$eq": 100}}      // Equal
{"price": {"$ne": 100}}      // Not equal
{"price": {"$gt": 100}}      // Greater than
{"price": {"$gte": 100}}     // Greater or equal
{"price": {"$lt": 100}}      // Less than
{"price": {"$lte": 100}}     // Less or equal
```

### Range

```json
{"price": {"$gte": 50, "$lte": 200}}  // Between 50 and 200
```

### Set Operations

```json
{"category": {"$in": ["electronics", "computers"]}}     // In list
{"category": {"$nin": ["clothing", "food"]}}            // Not in list
```

### Boolean Logic

```json
// AND (implicit)
{"category": "electronics", "in_stock": true}

// OR
{"$or": [{"category": "electronics"}, {"featured": true}]}

// NOT
{"category": {"$ne": "clothing"}}

// Complex
{
  "$and": [
    {"price": {"$lt": 100}},
    {"$or": [{"category": "electronics"}, {"rating": {"$gte": 4}}]}
  ]
}
```

### Text Matching

```json
{"title": {"$contains": "wireless"}}           // Contains substring
{"title": {"$startswith": "Premium"}}          // Starts with
{"title": {"$endswith": "Edition"}}            // Ends with
{"description": {"$regex": "(?i)bluetooth"}}   // Regex (case insensitive)
```

## Filter Modes

### Pre-filtering

Filter candidates **before** vector search (more accurate, slower):

```bash
VECTOR.SEARCH products [0.1, ...] K 10 FILTER '{"category": "electronics"}' FILTER_MODE pre
```

Best for:
- Highly selective filters (small result set)
- When filter matches < 10% of data

### Post-filtering

Filter results **after** vector search (faster, may return fewer results):

```bash
VECTOR.SEARCH products [0.1, ...] K 10 FILTER '{"category": "electronics"}' FILTER_MODE post
```

Best for:
- Broad filters
- When filter matches > 50% of data
- Low-latency requirements

## Rust API

```rust
use ferrite::semantic::{SemanticSearch, SearchOptions, Filter};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let search = SemanticSearch::new(config)?;

    // Generate query embedding
    let query_embedding = search.embed("wireless headphones").await?;

    // Pure vector search
    let results = search.search(
        "products",
        query_embedding.clone(),
        SearchOptions {
            k: 10,
            threshold: Some(0.7),
            ..Default::default()
        }
    ).await?;

    // Filtered search
    let results = search.search(
        "products",
        query_embedding.clone(),
        SearchOptions {
            k: 10,
            filter: Some(Filter::and(vec![
                Filter::eq("category", "electronics"),
                Filter::lt("price", 100),
            ])),
            ..Default::default()
        }
    ).await?;

    // Hybrid search
    let results = search.hybrid_search(
        "products",
        query_embedding,
        "wireless headphones",
        SearchOptions {
            k: 10,
            hybrid_weight: 0.7,  // 70% vector, 30% keyword
            ..Default::default()
        }
    ).await?;

    for result in results {
        println!("{}: {:.3} - {}",
            result.id,
            result.score,
            result.metadata.get("title").unwrap_or(&"".to_string())
        );
    }

    Ok(())
}
```

## Search Results

```rust
pub struct SearchResult {
    pub id: String,
    pub score: f32,
    pub vector: Option<Vec<f32>>,
    pub metadata: HashMap<String, Value>,
    pub distance: f32,
}
```

```bash
# CLI result format
1) id: doc1
   score: 0.923
   metadata: {"title": "Wireless Headphones", "category": "electronics"}
2) id: doc2
   score: 0.891
   metadata: {"title": "Bluetooth Earbuds", "category": "electronics"}
```

## Performance Optimization

### Index Selection

| Dataset Size | Recommended Index |
|-------------|-------------------|
| < 10K | Flat (exact) |
| 10K - 1M | HNSW (default) |
| > 1M | IVF or HNSW |

### Query Tuning

```bash
# Increase ef_search for better recall (slower)
VECTOR.CONFIG products EF_SEARCH 200

# Decrease for faster queries (lower recall)
VECTOR.CONFIG products EF_SEARCH 50
```

### Caching

```bash
# Enable query result caching
SEMANTIC.CACHE.ENABLE

# Cache frequently searched queries
SEMANTIC.CACHE.SET "popular query" [results...]
```

## Use Cases

### E-commerce Product Search

```bash
# Index products
VECTOR.CREATE products DIMS 384 METRIC cosine INDEX hnsw

# User searches for "comfortable running shoes"
# 1. Embed query
# 2. Search with filters
VECTOR.SEARCH products [query_embedding...] K 20 FILTER '{
  "category": "footwear",
  "in_stock": true,
  "price": {"$lte": 150}
}'
```

### Document Search

```bash
# Index documents
VECTOR.CREATE documents DIMS 1536 METRIC cosine INDEX hnsw

# Search with date filter
VECTOR.SEARCH documents [query_embedding...] K 10 FILTER '{
  "created_at": {"$gte": "2024-01-01"},
  "status": "published"
}'
```

### Similar Item Recommendations

```bash
# Find items similar to a given item
VECTOR.GET products item123
# Returns: [0.1, 0.2, ...]

VECTOR.SEARCH products [0.1, 0.2, ...] K 10 FILTER '{"id": {"$ne": "item123"}}'
```

## Best Practices

1. **Choose appropriate threshold** - Start at 0.7, adjust based on quality
2. **Use hybrid search** - Combines precision of keywords with recall of vectors
3. **Pre-compute embeddings** - Batch embed documents during indexing
4. **Monitor search quality** - Track click-through rates, relevance feedback
5. **Index metadata** - Enable efficient filtering without full scan
6. **Tune HNSW parameters** - Balance recall vs. latency for your use case

## Next Steps

- [Embeddings](/docs/ai-ml/embeddings) - Generate vectors from text
- [Vector Indexes](/docs/ai-ml/vector-indexes) - Index configuration
- [RAG Pipeline](/docs/ai-ml/rag-pipeline) - Document retrieval for LLMs
