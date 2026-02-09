# Vector Search Native

## Executive Summary

Native vector similarity search capabilities for Ferrite, enabling AI/ML workloads without external modules. Leverages tiered storage for billion-scale vector indexes with hot vectors in memory and cold vectors on SSD/cloud.

**Status**: Proposal
**Priority**: High
**Estimated Effort**: 3-4 months
**Target Release**: v0.5.0

---

## Problem Statement

### Current Landscape

- **Redis**: Requires RediSearch module (not open source under SSPL)
- **Dedicated Vector DBs**: Pinecone, Milvus, Qdrant - separate infrastructure
- **Postgres pgvector**: Good but not Redis-compatible, different access patterns

### Market Opportunity

- Vector search market growing 25%+ CAGR
- 80% of AI applications need vector similarity search
- Organizations want to consolidate infrastructure (cache + vectors)

### User Pain Points

1. Managing separate vector database infrastructure
2. Data synchronization between cache and vector store
3. Cost of dedicated vector database services
4. Latency of cross-service queries

---

## Technical Design

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        Vector Search Engine                      │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │   HNSW      │  │    IVF      │  │      Flat (Brute)       │  │
│  │   Index     │  │   Index     │  │        Index            │  │
│  └──────┬──────┘  └──────┬──────┘  └────────────┬────────────┘  │
│         │                │                      │                │
│         └────────────────┼──────────────────────┘                │
│                          ▼                                       │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                  Vector Storage Layer                      │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐    │  │
│  │  │   Memory    │  │    mmap     │  │    Disk/Cloud   │    │  │
│  │  │  (Hot 10%)  │  │ (Warm 30%)  │  │   (Cold 60%)    │    │  │
│  │  └─────────────┘  └─────────────┘  └─────────────────┘    │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### Index Types

#### 1. HNSW (Hierarchical Navigable Small World)

Best for: High recall, moderate dataset sizes (< 10M vectors)

```rust
pub struct HnswIndex {
    /// Maximum number of connections per node at layer 0
    m0: usize,
    /// Maximum connections per node at higher layers
    m: usize,
    /// Size of dynamic candidate list during construction
    ef_construction: usize,
    /// Size of dynamic candidate list during search
    ef_search: usize,
    /// Vector dimension
    dim: usize,
    /// Distance metric
    metric: DistanceMetric,
    /// Layered graph structure
    layers: Vec<HnswLayer>,
    /// Entry point node
    entry_point: Option<NodeId>,
}

pub struct HnswLayer {
    /// Adjacency lists for each node
    neighbors: DashMap<NodeId, Vec<NodeId>>,
}
```

#### 2. IVF (Inverted File Index)

Best for: Large datasets (10M+ vectors), memory-efficient

```rust
pub struct IvfIndex {
    /// Number of clusters (centroids)
    n_clusters: usize,
    /// Centroid vectors
    centroids: Vec<Vector>,
    /// Inverted lists: cluster_id -> vector_ids
    inverted_lists: Vec<RwLock<Vec<NodeId>>>,
    /// Number of clusters to probe during search
    n_probe: usize,
    /// Product quantization for compression (optional)
    pq: Option<ProductQuantizer>,
}
```

#### 3. Flat Index (Brute Force)

Best for: Small datasets (< 100K), exact results required

```rust
pub struct FlatIndex {
    /// All vectors stored contiguously
    vectors: RwLock<Vec<f32>>,
    /// Vector dimension
    dim: usize,
    /// Number of vectors
    count: AtomicUsize,
}
```

### Vector Storage

```rust
/// A single vector with metadata
pub struct VectorEntry {
    /// Unique identifier
    id: VectorId,
    /// The vector data (f32 or quantized)
    data: VectorData,
    /// Associated Redis key (optional)
    redis_key: Option<Bytes>,
    /// Custom attributes for filtering
    attributes: HashMap<String, AttributeValue>,
    /// Tier location
    tier: StorageTier,
    /// Last access timestamp
    last_accessed: Instant,
}

pub enum VectorData {
    /// Full precision float32
    F32(Vec<f32>),
    /// Half precision float16
    F16(Vec<f16>),
    /// Product quantized
    PQ(Vec<u8>),
    /// Binary quantized
    Binary(BitVec),
}

pub enum DistanceMetric {
    Cosine,
    Euclidean,
    DotProduct,
    Manhattan,
}
```

### Tiered Vector Storage

```rust
pub struct TieredVectorStore {
    /// Hot vectors in memory (frequently accessed)
    hot: DashMap<VectorId, VectorEntry>,
    /// Warm vectors memory-mapped
    warm: MmapVectorStore,
    /// Cold vectors on disk/cloud
    cold: DiskVectorStore,
    /// Access frequency tracker
    access_tracker: AccessTracker,
    /// Tiering policy
    policy: TieringPolicy,
}

impl TieredVectorStore {
    /// Get vector, promoting to hotter tier if needed
    pub async fn get(&self, id: VectorId) -> Option<VectorEntry> {
        // Check hot tier first
        if let Some(entry) = self.hot.get(&id) {
            self.access_tracker.record(id);
            return Some(entry.clone());
        }

        // Check warm tier
        if let Some(entry) = self.warm.get(id).await {
            self.maybe_promote(id, &entry);
            return Some(entry);
        }

        // Check cold tier
        if let Some(entry) = self.cold.get(id).await {
            self.maybe_promote(id, &entry);
            return Some(entry);
        }

        None
    }
}
```

---

## API Design

### Index Management

```redis
# Create a vector index
VSIM.CREATE <index>
    DIM <dimensions>
    [DISTANCE COSINE|EUCLIDEAN|DOT|MANHATTAN]
    [TYPE HNSW|IVF|FLAT]
    [M <connections>]                    # HNSW: max connections (default: 16)
    [EF_CONSTRUCTION <size>]             # HNSW: construction quality (default: 200)
    [N_CLUSTERS <count>]                 # IVF: number of centroids
    [N_PROBE <count>]                    # IVF: clusters to probe (default: 10)
    [QUANTIZATION NONE|PQ|BINARY]        # Compression method
    [ON <key_prefix>]                    # Auto-index keys matching prefix

# Examples
VSIM.CREATE embeddings DIM 384 DISTANCE cosine TYPE HNSW M 32
VSIM.CREATE products DIM 768 TYPE IVF N_CLUSTERS 1000 QUANTIZATION PQ
VSIM.CREATE small_index DIM 128 TYPE FLAT

# Drop an index
VSIM.DROP <index>

# Get index info
VSIM.INFO <index>
# Returns: dimensions, count, memory usage, index type, tier distribution
```

### Vector Operations

```redis
# Add a vector
VSIM.ADD <index> <id> <vector>
    [PAYLOAD <json>]                     # Filterable attributes
    [REPLACE]                            # Overwrite if exists

# Examples
VSIM.ADD embeddings doc:1 [0.1, 0.2, 0.3, ...] PAYLOAD '{"category": "tech"}'
VSIM.ADD embeddings doc:2 [0.15, 0.25, 0.35, ...]

# Add multiple vectors (batch)
VSIM.MADD <index>
    <id1> <vector1> [PAYLOAD <json1>]
    <id2> <vector2> [PAYLOAD <json2>]
    ...

# Get a vector by ID
VSIM.GET <index> <id>

# Delete a vector
VSIM.DEL <index> <id>

# Check if vector exists
VSIM.EXISTS <index> <id>
```

### Search Operations

```redis
# K-nearest neighbors search
VSIM.SEARCH <index> <vector>
    [K <count>]                          # Number of results (default: 10)
    [EF <size>]                          # HNSW search quality (default: 50)
    [RADIUS <distance>]                  # Maximum distance threshold
    [FILTER <expression>]                # Attribute filter
    [RETURN <fields...>]                 # Fields to return
    [WITHSCORES]                         # Include similarity scores
    [WITHVECTORS]                        # Include vector data

# Examples
VSIM.SEARCH embeddings [0.12, 0.22, 0.32, ...] K 10 WITHSCORES
VSIM.SEARCH products [0.5, 0.6, ...] K 5 FILTER "category = 'electronics' AND price < 100"

# Range search (all vectors within radius)
VSIM.RANGE <index> <vector> <radius>
    [FILTER <expression>]
    [LIMIT <count>]

# Multi-vector search (find vectors similar to multiple queries)
VSIM.MSEARCH <index>
    VECTORS <vector1> <vector2> ...
    [K <count>]
    [AGGREGATE MIN|MAX|AVG|SUM]          # How to combine scores
```

### Filter Expression Syntax

```
# Comparison operators
field = value
field != value
field > value
field >= value
field < value
field <= value

# Logical operators
expr AND expr
expr OR expr
NOT expr
(expr)

# List operators
field IN [value1, value2, ...]
field NOT IN [value1, value2, ...]

# String operators
field CONTAINS "substring"
field STARTSWITH "prefix"

# Examples
"category = 'tech' AND (price < 100 OR rating >= 4.5)"
"tags IN ['featured', 'new'] AND NOT archived"
```

### Hybrid Search (Vector + Full-Text)

```redis
# Combine vector similarity with text search
VSIM.HYBRID <index>
    VECTOR <vector>
    TEXT <query>
    [VECTOR_WEIGHT <0-1>]                # Balance between vector and text
    [K <count>]
    [FILTER <expression>]
```

---

## Implementation Plan

### Phase 1: Core Infrastructure (4 weeks)

#### Week 1-2: Vector Storage Layer

- [ ] Define `VectorEntry` and `VectorData` types
- [ ] Implement in-memory vector store with `DashMap`
- [ ] Add vector serialization/deserialization
- [ ] Create `VectorId` type with efficient hashing
- [ ] Unit tests for storage operations

#### Week 3-4: Distance Functions

- [ ] Implement SIMD-optimized distance functions
  - [ ] Cosine similarity (with normalization caching)
  - [ ] Euclidean distance (L2)
  - [ ] Dot product
  - [ ] Manhattan distance (L1)
- [ ] Benchmark against reference implementations
- [ ] Add AVX2/AVX-512/NEON detection and dispatch

```rust
// Example SIMD implementation
#[cfg(target_arch = "x86_64")]
pub fn cosine_similarity_avx2(a: &[f32], b: &[f32]) -> f32 {
    use std::arch::x86_64::*;

    unsafe {
        let mut dot = _mm256_setzero_ps();
        let mut norm_a = _mm256_setzero_ps();
        let mut norm_b = _mm256_setzero_ps();

        for i in (0..a.len()).step_by(8) {
            let va = _mm256_loadu_ps(a.as_ptr().add(i));
            let vb = _mm256_loadu_ps(b.as_ptr().add(i));

            dot = _mm256_fmadd_ps(va, vb, dot);
            norm_a = _mm256_fmadd_ps(va, va, norm_a);
            norm_b = _mm256_fmadd_ps(vb, vb, norm_b);
        }

        // Horizontal sum and compute final result
        let dot_sum = hsum_avx(dot);
        let norm_a_sum = hsum_avx(norm_a).sqrt();
        let norm_b_sum = hsum_avx(norm_b).sqrt();

        dot_sum / (norm_a_sum * norm_b_sum)
    }
}
```

### Phase 2: HNSW Index (4 weeks)

#### Week 5-6: Basic HNSW

- [ ] Implement HNSW graph structure
- [ ] Add node insertion with layer selection
- [ ] Implement greedy search algorithm
- [ ] Add neighbor selection heuristic
- [ ] Basic construction and query tests

#### Week 7-8: HNSW Optimization

- [ ] Implement concurrent insertion (lock-free where possible)
- [ ] Add incremental index updates
- [ ] Optimize memory layout for cache efficiency
- [ ] Implement index serialization/loading
- [ ] Performance benchmarks (recall vs. QPS)

### Phase 3: Redis Protocol Integration (3 weeks)

#### Week 9-10: Command Implementation

- [ ] Add `VSIM.*` commands to parser
- [ ] Implement command handlers in executor
- [ ] Add vector index management to Store
- [ ] Implement search result formatting
- [ ] Add filter expression parser

#### Week 11: Testing & Polish

- [ ] Integration tests with redis-cli
- [ ] Compatibility tests with Redis clients
- [ ] Error handling and edge cases
- [ ] Documentation and examples

### Phase 4: Tiered Storage (3 weeks)

#### Week 12-13: Tiering Implementation

- [ ] Integrate with HybridLog for vector storage
- [ ] Implement access tracking for vectors
- [ ] Add promotion/demotion logic
- [ ] Handle index updates across tiers

#### Week 14: Production Readiness

- [ ] Memory pressure handling
- [ ] Graceful degradation under load
- [ ] Metrics and observability
- [ ] Performance tuning guide

### Phase 5: Advanced Features (4 weeks)

#### Week 15-16: IVF Index

- [ ] Implement k-means clustering for centroids
- [ ] Build inverted file structure
- [ ] Add product quantization (PQ)
- [ ] Implement IVF search with configurable n_probe

#### Week 17-18: Advanced Search

- [ ] Filtered search optimization (pre-filter vs. post-filter)
- [ ] Batch search API
- [ ] Hybrid search (vector + text)
- [ ] Auto-indexing for key prefixes

---

## Data Structures

### File Format for Persistence

```
┌─────────────────────────────────────────┐
│           Vector Index File             │
├─────────────────────────────────────────┤
│ Magic: "FVEC" (4 bytes)                 │
│ Version: u32                            │
│ Index Type: u8 (HNSW=1, IVF=2, FLAT=3) │
│ Dimension: u32                          │
│ Metric: u8                              │
│ Count: u64                              │
│ Params: [type-specific parameters]      │
├─────────────────────────────────────────┤
│           Vector Data Section           │
│ ┌─────────────────────────────────────┐ │
│ │ Vector 0: [f32; dim]                │ │
│ │ Vector 1: [f32; dim]                │ │
│ │ ...                                 │ │
│ └─────────────────────────────────────┘ │
├─────────────────────────────────────────┤
│           Index Structure               │
│ [HNSW layers / IVF centroids / etc.]    │
├─────────────────────────────────────────┤
│           Metadata Section              │
│ [ID mappings, attributes, etc.]         │
└─────────────────────────────────────────┘
```

### Memory Layout

```rust
/// Optimized vector storage for cache efficiency
#[repr(C, align(64))]  // Cache line aligned
pub struct AlignedVectorBlock {
    /// Vectors stored contiguously
    data: [f32; BLOCK_SIZE * MAX_DIM],
    /// Number of vectors in block
    count: u32,
    /// Starting vector ID
    start_id: u32,
}
```

---

## Performance Considerations

### Benchmarks Target

| Metric | Target | Notes |
|--------|--------|-------|
| Insertion | 10K vec/sec | 768-dim vectors |
| Search (K=10) | 5K QPS | 1M vectors, recall@10 > 0.95 |
| Memory/vector | < 1KB | 384-dim with HNSW overhead |
| Index build | < 30 min | 10M vectors |

### Optimization Strategies

1. **SIMD Distance Calculation**
   - AVX2/AVX-512 on x86_64
   - NEON on ARM
   - Fallback scalar implementation

2. **Memory Prefetching**
   - Prefetch next nodes during graph traversal
   - Prefetch vector data before distance calculation

3. **Quantization**
   - Product Quantization: 32x memory reduction
   - Binary Quantization: 32x with fast Hamming distance
   - Scalar Quantization: 4x with minimal recall loss

4. **Tiering Optimization**
   - Keep graph structure in memory
   - Tier only vector data
   - Lazy loading of cold vectors during search

---

## Testing Strategy

### Unit Tests

```rust
#[cfg(test)]
mod tests {
    #[test]
    fn test_cosine_similarity() {
        let a = vec![1.0, 0.0, 0.0];
        let b = vec![1.0, 0.0, 0.0];
        assert!((cosine_similarity(&a, &b) - 1.0).abs() < 1e-6);
    }

    #[test]
    fn test_hnsw_insert_and_search() {
        let mut index = HnswIndex::new(128, DistanceMetric::Cosine);
        // ... insert vectors
        // ... verify search results
    }
}
```

### Integration Tests

- [ ] Create index via redis-cli
- [ ] Bulk insert 10K vectors
- [ ] Search accuracy verification
- [ ] Filter query correctness
- [ ] Persistence and recovery

### Benchmark Suite

```bash
# Add to benches/vector.rs
cargo bench --bench vector

# Metrics to track:
# - Insert throughput (vectors/sec)
# - Search QPS at various K values
# - Recall@K vs. ground truth
# - Memory usage
# - Index build time
```

---

## Compatibility

### Client Library Support

| Client | Support Level | Notes |
|--------|--------------|-------|
| redis-py | Full | Custom commands via execute_command |
| node-redis | Full | sendCommand API |
| jedis | Full | Custom command support |
| go-redis | Full | Do() method |

### Example Client Usage

```python
import redis
import numpy as np

r = redis.Redis()

# Create index
r.execute_command('VSIM.CREATE', 'myindex', 'DIM', 384, 'DISTANCE', 'cosine')

# Add vectors
embedding = np.random.rand(384).astype(np.float32)
r.execute_command('VSIM.ADD', 'myindex', 'doc:1', *embedding.tolist())

# Search
query = np.random.rand(384).astype(np.float32)
results = r.execute_command('VSIM.SEARCH', 'myindex', *query.tolist(), 'K', 10)
```

---

## Risks and Mitigations

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| SIMD complexity across platforms | Medium | High | Feature detection + fallbacks |
| Memory usage with large indexes | High | Medium | Quantization + tiering |
| Recall degradation with scale | High | Medium | Tunable parameters, IVF for large scale |
| Index corruption on crash | High | Low | WAL for index updates |
| Competition from dedicated vector DBs | Medium | High | Integration advantage + cost story |

---

## Success Metrics

### Technical Metrics

- Recall@10 > 0.95 for HNSW (default params)
- Search latency P99 < 10ms for 1M vectors
- Insert throughput > 5K vectors/sec
- Memory overhead < 50% vs. raw vectors

### Business Metrics

- 20% of new Ferrite users enable vector search
- 3+ customer case studies within 6 months
- Mentioned in AI/ML infrastructure discussions

---

## Future Enhancements

1. **GPU Acceleration** - CUDA/Metal for batch operations
2. **Distributed Index** - Sharded indexes across cluster
3. **Streaming Updates** - Real-time index updates from data changes
4. **Multi-Vector Search** - ColBERT-style late interaction
5. **Learned Indexes** - ML-optimized index structures

---

## References

- [HNSW Paper](https://arxiv.org/abs/1603.09320)
- [Product Quantization Paper](https://ieeexplore.ieee.org/document/5432202)
- [Faiss Library](https://github.com/facebookresearch/faiss)
- [Qdrant Architecture](https://qdrant.tech/documentation/guides/distributed_deployment/)
- [Redis Vector Similarity](https://redis.io/docs/stack/search/reference/vectors/)
