---
sidebar_position: 3
maturity: experimental
---

:::info Beta Feature
This feature is in **beta**. It is feature-complete but still undergoing testing. APIs may change in minor ways before stabilization.
:::

# Vector Indexes

Store and search high-dimensional vectors with multiple index types.

## Overview

Ferrite supports three vector index types:

| Index | Build Time | Query Time | Memory | Recall |
|-------|-----------|------------|--------|--------|
| HNSW | Medium | Fast | High | ~95-99% |
| IVF | Fast | Medium | Medium | ~85-95% |
| Flat | O(n) | O(n) | Low | 100% |

## Index Types

### HNSW (Hierarchical Navigable Small World)

Best for most use cases - fast queries with high recall.

```bash
VECTOR.CREATE products DIMS 384 METRIC cosine INDEX hnsw

# With parameters
VECTOR.CREATE products DIMS 384 METRIC cosine INDEX hnsw M 16 EF_CONSTRUCTION 200
```

**Parameters:**
- `M` - Maximum connections per node (default: 16). Higher = better recall, more memory
- `EF_CONSTRUCTION` - Build-time beam width (default: 200). Higher = better quality, slower build

### IVF (Inverted File Index)

Good for large datasets where memory is constrained.

```bash
VECTOR.CREATE products DIMS 384 METRIC cosine INDEX ivf

# With parameters
VECTOR.CREATE products DIMS 384 METRIC cosine INDEX ivf NLIST 100 NPROBE 10
```

**Parameters:**
- `NLIST` - Number of clusters (default: 100). Higher = more partitions
- `NPROBE` - Clusters to search (default: 10). Higher = better recall, slower

### Flat (Brute Force)

Exact search, best for small datasets or when recall must be 100%.

```bash
VECTOR.CREATE products DIMS 384 METRIC cosine INDEX flat
```

## Similarity Metrics

| Metric | Description | Use Case |
|--------|-------------|----------|
| `cosine` | Cosine similarity | Text embeddings |
| `euclidean` | L2 distance | Image features |
| `dotproduct` | Dot product | Normalized vectors |
| `manhattan` | L1 distance | Sparse vectors |

```bash
VECTOR.CREATE images DIMS 512 METRIC euclidean INDEX hnsw
VECTOR.CREATE docs DIMS 1536 METRIC cosine INDEX hnsw
```

## Basic Operations

### Create Index

```bash
VECTOR.CREATE products DIMS 384 METRIC cosine INDEX hnsw
```

### Add Vectors

```bash
# Add single vector
VECTOR.ADD products item1 [0.1, 0.2, 0.3, ...]

# Add with metadata
VECTOR.ADD products item1 [0.1, 0.2, ...] METADATA '{"category": "electronics"}'

# Bulk add
VECTOR.ADDBULK products '[
  {"id": "item1", "vector": [0.1, ...], "metadata": {"category": "electronics"}},
  {"id": "item2", "vector": [0.2, ...], "metadata": {"category": "clothing"}}
]'
```

### Search

```bash
# Basic search
VECTOR.SEARCH products [0.1, 0.2, 0.3, ...] K 10

# With threshold
VECTOR.SEARCH products [0.1, ...] K 10 THRESHOLD 0.7

# With filtering
VECTOR.SEARCH products [0.1, ...] K 10 FILTER '{"category": "electronics"}'
```

### Get/Delete

```bash
# Get vector
VECTOR.GET products item1

# Delete vector
VECTOR.DEL products item1

# Delete index
VECTOR.DROP products
```

### Info

```bash
VECTOR.INFO products
# Returns:
# name: products
# dimensions: 384
# metric: cosine
# index_type: hnsw
# vector_count: 10000
# memory_bytes: 15360000
```

## Filtering

### Pre-filtering

Filter before vector search (more accurate, slower):

```bash
VECTOR.SEARCH products [0.1, ...] K 10 FILTER '{"category": "electronics"}' FILTER_MODE pre
```

### Post-filtering

Filter after vector search (faster, may return fewer results):

```bash
VECTOR.SEARCH products [0.1, ...] K 10 FILTER '{"category": "electronics"}' FILTER_MODE post
```

### Filter Operators

```json
// Equality
{"category": "electronics"}

// Comparison
{"price": {"$lt": 100}}
{"price": {"$gte": 50, "$lte": 200}}

// In list
{"category": {"$in": ["electronics", "computers"]}}

// Boolean
{"in_stock": true}

// AND (implicit)
{"category": "electronics", "price": {"$lt": 100}}

// OR
{"$or": [{"category": "electronics"}, {"featured": true}]}

// NOT
{"category": {"$ne": "clothing"}}
```

## Hybrid Search

Combine vector and keyword search:

```bash
# 50% vector, 50% keyword
VECTOR.SEARCH products [0.1, ...] K 10 HYBRID "wireless headphones" WEIGHT 0.5

# More vector weight
VECTOR.SEARCH products [0.1, ...] K 10 HYBRID "query" WEIGHT 0.8
```

## Rust API

```rust
use ferrite::vector::{VectorStore, VectorConfig, IndexType, Metric};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Create vector store
    let store = VectorStore::new(VectorConfig {
        dimensions: 384,
        metric: Metric::Cosine,
        index_type: IndexType::HNSW { m: 16, ef_construction: 200 },
    })?;

    // Add vectors
    store.add("item1", vec![0.1, 0.2, 0.3, ...], Some(metadata))?;

    // Batch add
    let items = vec![
        VectorItem { id: "item2", vector: vec![...], metadata: Some(...) },
        VectorItem { id: "item3", vector: vec![...], metadata: None },
    ];
    store.add_batch(items)?;

    // Search
    let results = store.search(
        vec![0.1, 0.2, 0.3, ...],
        SearchOptions {
            k: 10,
            threshold: Some(0.7),
            filter: Some(Filter::eq("category", "electronics")),
            ..Default::default()
        }
    )?;

    for result in results {
        println!("{}: {:.3}", result.id, result.score);
    }

    Ok(())
}
```

## Index Tuning

### HNSW Tuning

```
Recall vs Speed tradeoff:

High Recall (99%+):
  M = 32, EF_CONSTRUCTION = 400, EF_SEARCH = 200
  Memory: ~1.5KB per vector

Balanced (95%):
  M = 16, EF_CONSTRUCTION = 200, EF_SEARCH = 100
  Memory: ~1KB per vector

Fast (90%):
  M = 8, EF_CONSTRUCTION = 100, EF_SEARCH = 50
  Memory: ~0.5KB per vector
```

### IVF Tuning

```
NLIST = sqrt(n)  # Rule of thumb for number of vectors
NPROBE = NLIST / 10  # Search 10% of clusters

1M vectors:
  NLIST = 1000, NPROBE = 100

10M vectors:
  NLIST = 3162, NPROBE = 316
```

## Memory Estimation

```
HNSW memory per vector:
  = dimensions × 4 bytes (float32)
  + M × 2 × 4 bytes (neighbors)
  + overhead (~64 bytes)

Example (384 dims, M=16):
  = 384 × 4 + 16 × 2 × 4 + 64
  = 1536 + 128 + 64
  = 1728 bytes per vector

1M vectors = ~1.7 GB
```

## Performance

| Index | 1M Vectors Query Time |
|-------|----------------------|
| HNSW (ef=100) | ~1ms |
| IVF (nprobe=10) | ~5ms |
| Flat | ~50ms |

## Best Practices

1. **Choose HNSW for most cases** - Best balance of speed and recall
2. **Use IVF for memory constraints** - When HNSW is too large
3. **Use Flat for &lt;10K vectors** - Simple and exact
4. **Normalize vectors for cosine** - Better numerical stability
5. **Set appropriate thresholds** - Filter low-quality matches
6. **Monitor recall** - Test against ground truth periodically
7. **Batch inserts** - Much faster than individual adds

## Next Steps

- [Embeddings](/docs/ai-ml/embeddings) - Generate vectors from text
- [Semantic Search](/docs/ai-ml/semantic-search) - Build search applications
- [Vector Commands](/docs/reference/commands/vector) - Full command reference
