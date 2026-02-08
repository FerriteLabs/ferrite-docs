# ADR-0011: Embedded Vector Search with HNSW Indexes

## Status

Accepted

## Context

AI/ML applications increasingly need vector similarity search for:
- Semantic search (find similar documents)
- Recommendation systems (find similar items)
- RAG (Retrieval Augmented Generation)
- Image/audio similarity
- Anomaly detection

Current solutions require separate infrastructure:
- Pinecone, Weaviate, Qdrant (managed vector DBs)
- Milvus, Chroma (self-hosted)
- pgvector (PostgreSQL extension)
- Redis Stack with RediSearch

For applications already using Redis/Ferrite as primary cache:
- Extra operational complexity for another database
- Data synchronization between systems
- Increased latency (network hop to vector DB)
- Higher costs

Embedding vector search directly into Ferrite:
- Single data layer for cache + vectors
- Atomic updates (key + vector together)
- Simpler architecture
- Lower latency

## Decision

We implement **native vector similarity search** with the FT.* command namespace:

### Supported Index Types
```rust
pub enum IndexType {
    /// Flat index: brute-force, exact results
    /// Best for: <10K vectors, when accuracy critical
    Flat,

    /// HNSW: Hierarchical Navigable Small World
    /// Best for: 10K-10M vectors, balanced speed/accuracy
    Hnsw,

    /// IVF: Inverted File Index
    /// Best for: >1M vectors, memory constrained
    Ivf,
}
```

### Distance Metrics
```rust
pub enum DistanceMetric {
    /// Cosine similarity (normalized dot product)
    /// Best for: text embeddings, normalized vectors
    Cosine,

    /// Euclidean distance (L2)
    /// Best for: spatial data, image features
    Euclidean,

    /// Inner product (dot product)
    /// Best for: when vectors are not normalized
    DotProduct,
}
```

### Architecture
```
┌─────────────────────────────────────────────────────────────┐
│                    Vector Subsystem                          │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  VectorStore │  │  IndexEngine │  │  Quantizer   │      │
│  │              │  │              │  │              │      │
│  │ - Create idx │  │ - HNSW impl  │  │ - PQ (prod   │      │
│  │ - Drop idx   │  │ - Flat impl  │  │   quantize)  │      │
│  │ - Add vector │  │ - IVF impl   │  │ - SQ (scalar)│      │
│  │ - Search     │  │              │  │              │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │                   Embedding Cache                     │   │
│  │  Optional: Auto-embed text using OpenAI/Cohere/local │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### HNSW Implementation
```rust
pub struct HnswIndex {
    /// Entry point to the graph
    entry_point: AtomicUsize,

    /// Maximum layer
    max_level: usize,

    /// Nodes organized by layer
    layers: Vec<RwLock<Vec<HnswNode>>>,

    /// Index configuration
    config: HnswConfig,
}

pub struct HnswConfig {
    /// Max connections per node (default: 16)
    pub m: usize,

    /// Construction ef (default: 200)
    pub ef_construction: usize,

    /// Search ef (default: 50)
    pub ef_search: usize,

    /// Level generation multiplier (default: 1/ln(M))
    pub ml: f64,
}

pub struct HnswNode {
    id: VectorId,
    vector: Vec<f32>,
    connections: Vec<Vec<usize>>,  // Per-layer connections
}
```

### Command Interface
```
# Create index
FT.CREATE idx ON HASH PREFIX 1 doc:
    SCHEMA
        title TEXT
        embedding VECTOR HNSW 6
            TYPE FLOAT32
            DIM 768
            DISTANCE_METRIC COSINE
            M 16
            EF_CONSTRUCTION 200

# Add document with vector
HSET doc:1 title "Hello World" embedding <768 floats>

# Or add vector directly
FT.ADD idx doc:1 <vector_bytes> [PAYLOAD <json>]

# Search by vector
FT.SEARCH idx "*=>[KNN 10 @embedding $vec AS score]"
    PARAMS 2 vec <query_vector>
    RETURN 2 title score
    SORTBY score ASC

# Alternative simple syntax
FT.SEARCH idx <query_vector> LIMIT 10
```

### Integration with Storage
```rust
impl VectorStore {
    /// Create a new index
    pub fn create_index(&self, config: VectorIndexConfig) -> Result<(), VectorError> {
        let index = match config.index_type {
            IndexType::Flat => Box::new(FlatIndex::new(config)?),
            IndexType::Hnsw => Box::new(HnswIndex::new(config)?),
            IndexType::Ivf => Box::new(IvfIndex::new(config)?),
        };

        self.indexes.insert(config.name.clone(), index);
        Ok(())
    }

    /// Search for similar vectors
    pub fn search(
        &self,
        index_name: &str,
        query: &[f32],
        k: usize,
    ) -> Result<Vec<SearchResult>, VectorError> {
        let index = self.indexes.get(index_name)
            .ok_or(VectorError::IndexNotFound)?;

        index.search(query, k)
    }
}

pub struct SearchResult {
    pub id: VectorId,
    pub score: f32,
    pub payload: Option<Bytes>,
}
```

## Consequences

### Positive
- **Unified data layer**: Cache and vectors in one system
- **Atomic updates**: Key and vector updated together
- **Lower latency**: No network hop to separate vector DB
- **Simpler ops**: One system to deploy and monitor
- **RediSearch compatible**: Existing clients work with minor changes
- **Flexible indexes**: Choose accuracy vs speed tradeoff

### Negative
- **Memory usage**: Vectors are large (768 floats = 3KB per vector)
- **CPU intensive**: Search is compute-heavy
- **Specialized domain**: Vector search algorithms are complex
- **Index rebuild**: Changing parameters requires reindex

### Trade-offs
- **HNSW accuracy**: ef_search tunable (higher = more accurate, slower)
- **Memory vs speed**: IVF uses less memory but slower
- **Build time vs search time**: Higher ef_construction = better graph, slower build

## Implementation Notes

Key files:
- `src/vector/mod.rs` - Vector subsystem entry
- `src/vector/store.rs` - Index management
- `src/vector/hnsw.rs` - HNSW implementation
- `src/vector/flat.rs` - Brute-force baseline
- `src/vector/ivf.rs` - IVF implementation
- `src/vector/quantize.rs` - Vector compression
- `src/commands/handlers/vector.rs` - FT.* commands
- `src/rag/embed.rs` - Embedding providers

Configuration:
```toml
[vector]
enabled = true
default_metric = "cosine"
max_dimensions = 4096
cache_embeddings = true

[vector.hnsw]
default_m = 16
default_ef_construction = 200
default_ef_search = 50

[vector.embedding]
provider = "openai"  # or "cohere", "local", "custom"
model = "text-embedding-3-small"
dimensions = 1536
cache_ttl_secs = 3600
```

Memory estimation:
```
Per vector: dim * 4 bytes (f32) + metadata
HNSW overhead: ~8 * M * sizeof(usize) per vector

Example: 1M vectors, 768 dims, M=16
- Vector data: 1M * 768 * 4 = 3GB
- HNSW links: 1M * 16 * 8 * 8 = 1GB
- Total: ~4GB
```

## Performance Characteristics

| Index | Build Time | Search Time | Memory | Recall@10 |
|-------|-----------|-------------|--------|-----------|
| Flat | O(n) | O(n) | 1x | 100% |
| HNSW | O(n log n) | O(log n) | 1.3x | 95-99% |
| IVF | O(n) | O(√n) | 1.1x | 90-95% |

*1M vectors, 768 dimensions, ef_search=50*

## Embedding Providers

Built-in support for text-to-vector conversion:

| Provider | Dimensions | Notes |
|----------|------------|-------|
| OpenAI | 1536/3072 | text-embedding-3-small/large |
| Cohere | 1024 | embed-english-v3.0 |
| HuggingFace | 384-1024 | sentence-transformers |
| Local ONNX | varies | Self-hosted, no API costs |

## References

- [HNSW Paper](https://arxiv.org/abs/1603.09320)
- [RediSearch Vector Similarity](https://redis.io/docs/stack/search/reference/vectors/)
- [Faiss: A Library for Efficient Similarity Search](https://github.com/facebookresearch/faiss)
- [Approximate Nearest Neighbor Benchmarks](http://ann-benchmarks.com/)
