---
sidebar_position: 5
title: Vector Search Guide
description: Native vector similarity search for AI/ML workloads. Supports HNSW, IVF, and flat indexes with cosine, L2, and dot product distance metrics.
keywords: [vector search, hnsw, ivf, similarity search, embeddings, ai ml]
maturity: beta
---

# Vector Search

Ferrite includes native vector similarity search for AI/ML workloads, supporting HNSW, IVF, and flat indexes.

## Creating an Index

### CLI

```bash
# Create HNSW index (recommended for most use cases)
127.0.0.1:6379> VECTOR.CREATE myindex DIM 384 DISTANCE cosine

# With custom parameters
127.0.0.1:6379> VECTOR.CREATE myindex DIM 384 DISTANCE cosine TYPE hnsw M 16 EF_CONSTRUCTION 200

# Create IVF index (faster indexing, slightly lower recall)
127.0.0.1:6379> VECTOR.CREATE myindex DIM 384 DISTANCE l2 TYPE ivf NLIST 100

# Create flat index (exact search, slower but 100% recall)
127.0.0.1:6379> VECTOR.CREATE myindex DIM 384 DISTANCE cosine TYPE flat
```

### Embedded Mode

```rust
use ferrite::vector::{VectorIndex, DistanceMetric, IndexType};

// Create HNSW index
db.vector_create_index(
    "embeddings",
    VectorIndexConfig::new(384, DistanceMetric::Cosine)
        .index_type(IndexType::Hnsw { m: 16, ef_construction: 200 })
)?;
```

## Index Types

| Type | Best For | Indexing Speed | Query Speed | Recall |
|------|----------|----------------|-------------|--------|
| HNSW | General purpose | Medium | Fast | ~98% |
| IVF | Large datasets | Fast | Medium | ~95% |
| Flat | Small datasets, exact search | N/A | Slow | 100% |

## Distance Metrics

- `cosine` - Cosine similarity (recommended for text embeddings)
- `l2` - Euclidean distance
- `ip` - Inner product (dot product)

## Adding Vectors

### CLI

```bash
# Add a single vector
127.0.0.1:6379> VECTOR.ADD myindex doc1 [0.1, 0.2, 0.3, ...] '{"title": "Hello World"}'

# Add with optional ID
127.0.0.1:6379> VECTOR.ADD myindex AUTO [0.1, 0.2, ...] '{"source": "web"}'
```

### Embedded Mode

```rust
let embedding = vec![0.1, 0.2, 0.3, /* ... 384 dimensions */];
let metadata = json!({
    "title": "Introduction to Rust",
    "category": "programming",
    "author": "Alice"
});

db.vector_add("embeddings", "doc1", &embedding, &metadata)?;
```

### Batch Add

```rust
let vectors = vec![
    ("doc1", embedding1, metadata1),
    ("doc2", embedding2, metadata2),
    ("doc3", embedding3, metadata3),
];

db.vector_add_batch("embeddings", &vectors)?;
```

## Searching

### Basic Search

```bash
# Search for top 10 similar vectors
127.0.0.1:6379> VECTOR.SEARCH myindex [0.1, 0.2, ...] TOP 10
1) "doc1"
2) "0.95"
3) "{\"title\": \"Hello World\"}"
4) "doc5"
5) "0.89"
6) "{\"title\": \"Hello Universe\"}"
...
```

### With Filters

```bash
# Filter by metadata
127.0.0.1:6379> VECTOR.SEARCH myindex [0.1, 0.2, ...] TOP 10 FILTER $.category == "programming"

# Multiple filters
127.0.0.1:6379> VECTOR.SEARCH myindex [0.1, 0.2, ...] TOP 10 FILTER "$.category == 'tech' AND $.year >= 2024"
```

### Search Parameters

```bash
# HNSW: Adjust ef for speed/recall tradeoff
127.0.0.1:6379> VECTOR.SEARCH myindex [0.1, 0.2, ...] TOP 10 EF 100

# IVF: Adjust nprobe for speed/recall tradeoff
127.0.0.1:6379> VECTOR.SEARCH myindex [0.1, 0.2, ...] TOP 10 NPROBE 10
```

### Embedded Mode

```rust
let query = vec![0.1, 0.2, /* ... */];

// Basic search
let results = db.vector_search("embeddings", &query, 10)?;

// With filter
let results = db.vector_search_with_filter(
    "embeddings",
    &query,
    10,
    r#"$.category == "programming""#
)?;

for result in results {
    println!("ID: {}, Score: {:.4}", result.id, result.score);
    println!("Metadata: {:?}", result.metadata);
}
```

## Semantic Caching

Cache LLM responses by semantic similarity:

```bash
# Store a response
127.0.0.1:6379> SEMANTIC.SET "What is the capital of France?" "Paris is the capital of France. It's known for the Eiffel Tower."

# Query with similar phrasing
127.0.0.1:6379> SEMANTIC.GET "France's capital city?" 0.85
"Paris is the capital of France. It's known for the Eiffel Tower."

# Returns nil if no match above threshold
127.0.0.1:6379> SEMANTIC.GET "What is Rust?" 0.85
(nil)
```

### Configuration

```toml
[semantic]
embedding_model = "onnx"           # onnx, openai, or custom
onnx_model_path = "./models/all-MiniLM-L6-v2.onnx"
similarity_threshold = 0.85
cache_ttl = 3600                   # Cache entries expire after 1 hour
```

### Embedded Mode

```rust
// Configure semantic cache
let config = SemanticCacheConfig::new()
    .model(EmbeddingModel::Onnx("./models/all-MiniLM-L6-v2.onnx"))
    .threshold(0.85)
    .ttl(Duration::from_secs(3600));

db.configure_semantic_cache(config)?;

// Cache a response
db.semantic_set("What is Rust?", "Rust is a systems programming language...")?;

// Query
if let Some(response) = db.semantic_get("Tell me about Rust", 0.85)? {
    println!("Cache hit: {}", response);
}
```

## Managing Indexes

### Index Info

```bash
127.0.0.1:6379> VECTOR.INFO myindex
1) name
2) "myindex"
3) dimensions
4) (integer) 384
5) distance
6) "cosine"
7) type
8) "hnsw"
9) count
10) (integer) 1000000
11) memory_bytes
12) (integer) 524288000
```

### Delete Vectors

```bash
# Delete by ID
127.0.0.1:6379> VECTOR.DEL myindex doc1

# Delete multiple
127.0.0.1:6379> VECTOR.DEL myindex doc1 doc2 doc3
```

### Drop Index

```bash
127.0.0.1:6379> VECTOR.DROP myindex
OK
```

## Performance Tuning

### HNSW Parameters

| Parameter | Default | Effect |
|-----------|---------|--------|
| M | 16 | Higher = better recall, more memory |
| ef_construction | 200 | Higher = better recall, slower indexing |
| ef (search) | 50 | Higher = better recall, slower search |

### IVF Parameters

| Parameter | Default | Effect |
|-----------|---------|--------|
| nlist | 100 | More lists = faster search, slower indexing |
| nprobe | 10 | More probes = better recall, slower search |

### Best Practices

1. **Batch inserts**: Use `VECTOR.ADD_BATCH` for bulk loading
2. **Right index type**: HNSW for under 10M vectors, IVF for larger
3. **Tune ef/nprobe**: Start low, increase until recall is acceptable
4. **Use filters wisely**: Pre-filter when possible, post-filter for complex queries

## Generating Embeddings

### With ONNX (Local)

```rust
use ferrite::embeddings::OnnxEmbedder;

let embedder = OnnxEmbedder::new("./models/all-MiniLM-L6-v2.onnx")?;
let embedding = embedder.embed("Hello, world!")?;
```

### With OpenAI

```rust
use ferrite::embeddings::OpenAIEmbedder;

let embedder = OpenAIEmbedder::new(std::env::var("OPENAI_API_KEY")?);
let embedding = embedder.embed("Hello, world!").await?;
```

## Next Steps

- [Commands Reference](/docs/reference/commands) - All vector commands
- [Benchmarks](/benchmarks) - Vector search performance
