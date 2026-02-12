---
sidebar_position: 16
maturity: beta
---

# Vector Commands

Commands for vector storage and similarity search.

## Overview

Vector commands enable storing high-dimensional vectors and performing similarity searches using HNSW, IVF, or flat indexes.

## Commands

### VECTOR.CREATE

Create a vector index.

```bash
VECTOR.CREATE index_name
  DIM dimensions
  [DISTANCE L2 | COSINE | IP]
  [TYPE HNSW | IVF | FLAT]
  [M connectivity]
  [EF_CONSTRUCTION ef]
  [NLIST num_clusters]
```

**Parameters:**
- `DIM` - Vector dimensions (required)
- `DISTANCE` - Distance metric (default: COSINE)
- `TYPE` - Index type (default: HNSW)
- `M` - HNSW connectivity (default: 16)
- `EF_CONSTRUCTION` - HNSW build-time search depth (default: 200)
- `NLIST` - IVF cluster count (default: 100)

**Examples:**
```bash
# Create HNSW index for 384-dim embeddings
VECTOR.CREATE embeddings DIM 384 DISTANCE COSINE TYPE HNSW M 16

# Create IVF index for faster builds
VECTOR.CREATE products DIM 768 DISTANCE L2 TYPE IVF NLIST 256

# Create flat index for small datasets
VECTOR.CREATE small_set DIM 128 DISTANCE IP TYPE FLAT
```

---

### VECTOR.ADD

Add vector to index.

```bash
VECTOR.ADD index_name id vector [PAYLOAD json]
```

**Parameters:**
- `id` - Unique identifier
- `vector` - Float array as JSON or binary
- `PAYLOAD` - Optional metadata JSON

**Examples:**
```bash
VECTOR.ADD embeddings doc:1 "[0.1, 0.2, 0.3, ...]" PAYLOAD '{"title":"Doc 1"}'

VECTOR.ADD embeddings doc:2 "[0.2, 0.3, 0.4, ...]"
```

---

### VECTOR.GET

Get vector by ID.

```bash
VECTOR.GET index_name id [WITHVECTOR]
```

**Examples:**
```bash
VECTOR.GET embeddings doc:1
# {"id": "doc:1", "payload": {"title": "Doc 1"}}

VECTOR.GET embeddings doc:1 WITHVECTOR
# {"id": "doc:1", "vector": [0.1, 0.2, ...], "payload": {"title": "Doc 1"}}
```

---

### VECTOR.DEL

Delete vector from index.

```bash
VECTOR.DEL index_name id
```

**Examples:**
```bash
VECTOR.DEL embeddings doc:1
# (integer) 1
```

---

### VECTOR.SEARCH

Similarity search.

```bash
VECTOR.SEARCH index_name vector
  K count
  [EF search_depth]
  [FILTER expression]
  [RETURN fields...]
  [WITHSCORES]
  [WITHVECTORS]
```

**Parameters:**
- `K` - Number of results
- `EF` - HNSW search depth (higher = more accurate, slower)
- `FILTER` - Payload filter expression
- `RETURN` - Payload fields to return
- `WITHSCORES` - Include similarity scores
- `WITHVECTORS` - Include vectors in results

**Examples:**
```bash
# Basic search
VECTOR.SEARCH embeddings "[0.1, 0.2, ...]" K 10

# With scores
VECTOR.SEARCH embeddings "[0.1, 0.2, ...]" K 10 WITHSCORES
# 1) "doc:5"
# 2) "0.95"
# 3) "doc:3"
# 4) "0.87"

# With filter
VECTOR.SEARCH embeddings "[0.1, 0.2, ...]" K 10 FILTER "category = 'tech'"

# Return specific fields
VECTOR.SEARCH embeddings "[0.1, 0.2, ...]" K 10 RETURN title category
```

---

### VECTOR.MSEARCH

Multi-vector search.

```bash
VECTOR.MSEARCH index_name
  VECTORS vector1 vector2 ...
  K count
  [AGGREGATE AVG | MAX | MIN]
  [FILTER expression]
```

**Examples:**
```bash
# Search with multiple query vectors
VECTOR.MSEARCH embeddings VECTORS "[0.1,...]" "[0.2,...]" K 10 AGGREGATE AVG
```

---

### VECTOR.HYBRID

Hybrid vector + keyword search.

```bash
VECTOR.HYBRID index_name vector
  K count
  QUERY text_query
  [ALPHA weight]
  [FILTER expression]
```

**Parameters:**
- `ALPHA` - Vector weight (0.0-1.0), text is 1-alpha

**Examples:**
```bash
# Hybrid search
VECTOR.HYBRID embeddings "[0.1, 0.2, ...]" K 10 QUERY "machine learning" ALPHA 0.7
```

---

### VECTOR.INFO

Get index information.

```bash
VECTOR.INFO index_name
```

**Examples:**
```bash
VECTOR.INFO embeddings
# {
#   "name": "embeddings",
#   "dimensions": 384,
#   "distance": "cosine",
#   "type": "hnsw",
#   "vectors": 10000,
#   "memory": "12.5 MB"
# }
```

---

### VECTOR.DROP

Delete an index.

```bash
VECTOR.DROP index_name
```

---

### VECTOR.LIST

List all indexes.

```bash
VECTOR.LIST
```

---

### VECTOR.UPDATE

Update vector payload.

```bash
VECTOR.UPDATE index_name id PAYLOAD json
```

**Examples:**
```bash
VECTOR.UPDATE embeddings doc:1 PAYLOAD '{"title": "Updated Title"}'
```

---

### VECTOR.REINDEX

Rebuild index.

```bash
VECTOR.REINDEX index_name [BACKGROUND]
```

## Filter Expressions

### Comparison Operators

```bash
# Equality
FILTER "category = 'tech'"

# Inequality
FILTER "price != 0"

# Numeric comparisons
FILTER "price > 10"
FILTER "price >= 10"
FILTER "price < 100"
FILTER "price <= 100"
```

### Logical Operators

```bash
# AND
FILTER "category = 'tech' AND price < 100"

# OR
FILTER "category = 'tech' OR category = 'science'"

# NOT
FILTER "NOT archived"

# Parentheses
FILTER "(category = 'tech' OR category = 'science') AND price < 100"
```

### Array Operators

```bash
# Contains
FILTER "tags CONTAINS 'ai'"

# Any match
FILTER "tags ANY ['ai', 'ml', 'data']"

# All match
FILTER "tags ALL ['verified', 'published']"
```

## Use Cases

### Semantic Search

```bash
# Create index
VECTOR.CREATE articles DIM 384 DISTANCE COSINE

# Add article embeddings
VECTOR.ADD articles art:1 "[0.1, ...]" PAYLOAD '{"title": "AI Overview", "category": "tech"}'

# Search for similar articles
VECTOR.SEARCH articles "[query_embedding]" K 10 FILTER "category = 'tech'"
```

### Recommendation System

```bash
# Create product index
VECTOR.CREATE products DIM 768 DISTANCE COSINE

# Add products
VECTOR.ADD products prod:1 "[0.1, ...]" PAYLOAD '{"name": "Laptop", "price": 999}'

# Find similar products
VECTOR.SEARCH products "[user_preference_embedding]" K 5 FILTER "price < 1000"
```

### Image Similarity

```bash
# Create image index
VECTOR.CREATE images DIM 512 DISTANCE L2 TYPE HNSW

# Add image embeddings
VECTOR.ADD images img:1 "[0.1, ...]" PAYLOAD '{"filename": "cat.jpg", "tags": ["animal", "pet"]}'

# Find similar images
VECTOR.SEARCH images "[query_image_embedding]" K 20 FILTER "tags CONTAINS 'animal'"
```

## Rust API

```rust
use ferrite::Client;
use ferrite::vector::{VectorIndex, DistanceMetric, IndexType};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let client = Client::connect("localhost:6379").await?;

    // Create index
    client.vector_create(
        "embeddings",
        384,
        DistanceMetric::Cosine,
        IndexType::Hnsw { m: 16, ef_construction: 200 },
    ).await?;

    // Add vectors
    client.vector_add(
        "embeddings",
        "doc:1",
        &[0.1, 0.2, 0.3, /* ... */],
        Some(json!({"title": "Document 1"})),
    ).await?;

    // Search
    let results = client.vector_search(
        "embeddings",
        &[0.1, 0.2, 0.3, /* ... */],
        10,
        VectorSearchOptions::default()
            .with_scores()
            .filter("category = 'tech'"),
    ).await?;

    for result in results {
        println!("ID: {}, Score: {}", result.id, result.score);
    }

    // Hybrid search
    let hybrid_results = client.vector_hybrid(
        "embeddings",
        &[0.1, 0.2, 0.3],
        10,
        "machine learning",
        0.7,
    ).await?;

    Ok(())
}
```

## Performance Tips

1. **Choose the right index type**
   - HNSW: Best for search quality, more memory
   - IVF: Faster builds, good for frequent updates
   - FLAT: Small datasets only (&lt;10K vectors)

2. **Tune parameters**
   - Higher M = better recall, more memory
   - Higher EF = better recall, slower search
   - Adjust based on your accuracy needs

3. **Use filters effectively**
   - Pre-filtering is faster for selective filters
   - Post-filtering better for non-selective

4. **Batch operations**
   - Add vectors in batches of 100-1000
   - Use background reindexing

## Related Commands

- [Semantic Commands](/docs/reference/commands/semantic) - Semantic caching
- [Search Commands](/docs/reference/commands/search) - Full-text search
- [RAG Guide](/docs/ai-ml/rag-pipeline) - Retrieval-augmented generation
