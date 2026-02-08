# Ferrite Architecture

This document describes the internal architecture of Ferrite, a high-performance Redis-compatible key-value store.

## Overview

Ferrite is built around several core architectural principles:

1. **Thread-per-core**: Each CPU core has dedicated resources to minimize cross-thread coordination
2. **Epoch-based reclamation**: Lock-free reads with safe memory reclamation
3. **Tiered storage**: Hot/Warm/Cold data tiers for optimal memory/cost efficiency
4. **RESP protocol compatibility**: Drop-in replacement for Redis clients

## Component Diagram

```
┌────────────────────────────────────────────────────────────────────┐
│                           Client Connections                        │
│                        (redis-cli, redis-py, etc.)                 │
└───────────────────────────────────┬────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────┐
│                           Network Layer                             │
│  ┌─────────────┐  ┌─────────────────┐  ┌─────────────────────────┐ │
│  │ TCP Listener │  │ TLS Termination │  │ Connection Pool        │ │
│  │  (Tokio)    │  │  (rustls)       │  │  (per-client state)    │ │
│  └─────────────┘  └─────────────────┘  └─────────────────────────┘ │
└───────────────────────────────────┬────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────┐
│                         Protocol Layer                              │
│  ┌─────────────────┐  ┌─────────────────┐  ┌───────────────────┐  │
│  │ RESP2 Parser    │  │ RESP3 Parser    │  │ Frame Encoder     │  │
│  │ (streaming)     │  │ (optional)      │  │ (zero-copy)       │  │
│  └─────────────────┘  └─────────────────┘  └───────────────────┘  │
└───────────────────────────────────┬────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────┐
│                         Command Layer                               │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────────────┐  │
│  │ Command Parser │  │ Command Router │  │ ACL Checker         │  │
│  │               │  │               │  │                       │  │
│  └───────────────┘  └───────────────┘  └───────────────────────┘  │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │              Command Handlers (Strings, Lists, etc.)         │  │
│  └─────────────────────────────────────────────────────────────┘  │
└───────────────────────────────────┬────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────┐
│                         Storage Layer                               │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │                    Store (16 Databases)                      │  │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐            │  │
│  │  │ Database 0  │ │ Database 1  │ │ Database N  │ ...        │  │
│  │  │ (DashMap)   │ │ (DashMap)   │ │ (DashMap)   │            │  │
│  │  └─────────────┘ └─────────────┘ └─────────────┘            │  │
│  └─────────────────────────────────────────────────────────────┘  │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │                      HybridLog (Tiered)                      │  │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────────────────┐│  │
│  │  │  Mutable    │ │  Read-Only  │ │  Head (Disk/Cloud)     ││  │
│  │  │  (Hot)      │ │  (Warm)     │ │  (Cold)                ││  │
│  │  └─────────────┘ └─────────────┘ └─────────────────────────┘│  │
│  └─────────────────────────────────────────────────────────────┘  │
└───────────────────────────────────┬────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────┐
│                       Persistence Layer                             │
│  ┌───────────────┐  ┌───────────────────┐  ┌─────────────────────┐│
│  │ AOF Writer    │  │ Checkpoint Manager │  │ Backup Manager     ││
│  │ (write-ahead) │  │ (fork-less)       │  │ (local + cloud)    ││
│  └───────────────┘  └───────────────────┘  └─────────────────────┘│
└────────────────────────────────────────────────────────────────────┘
```

## Data Structures

### Value Types

```rust
pub enum Value {
    String(Bytes),
    List(VecDeque<Bytes>),
    Hash(HashMap<Bytes, Bytes>),
    Set(HashSet<Bytes>),
    SortedSet {
        by_score: BTreeMap<(OrderedFloat<f64>, Bytes), ()>,
        by_member: HashMap<Bytes, f64>,
    },
}
```

### Entry Structure

Each key-value pair is wrapped in an Entry:

```rust
pub struct Entry {
    value: Value,
    expires_at: Option<Instant>,
    access_count: AtomicU64,
    last_access: AtomicU64,
}
```

- **expires_at**: TTL support with lazy expiration
- **access_count**: LRU tracking for tiering decisions
- **last_access**: Timestamp for cache eviction

## Storage Engine

### In-Memory Store

The primary storage uses DashMap, a concurrent hashmap:

```
Database {
    data: DashMap<Bytes, Entry>
}
```

Key characteristics:
- Sharded internally for concurrent access
- Lock-free reads via epoch-based reclamation
- Lazy expiration on read path

### HybridLog (Tiered Storage)

Inspired by Microsoft FASTER, the HybridLog provides three tiers:

**1. Mutable Region (Hot)**
- In-memory, in-place updates
- Lock-free reads
- Newest data lives here

**2. Read-Only Region (Warm)**
- Memory-mapped files
- Zero-copy reads
- Copy-on-write for updates

**3. Head Region (Cold)**
- Disk-based (io_uring on Linux)
- Optional cloud storage (S3, GCS, Azure)
- Async prefetch on access

### Epoch-Based Reclamation

Safe memory reclamation without garbage collection:

```
Thread A: [---Pin Epoch 5---]
Thread B:      [---Pin Epoch 5---]
Thread C:           [---Pin Epoch 6---]
                          ↑
                    Safe to free memory
                    allocated before Epoch 5
```

Using `crossbeam-epoch`:
- Threads pin an epoch when accessing data
- Memory is deferred for reclamation
- Reclaim when all threads have advanced

## Network Layer

### Connection Handling

```
TcpListener
    │
    ├─ spawn task per connection
    │
    ▼
Connection {
    stream: TcpStream,
    read_buf: BytesMut,   // Buffered reads
    write_buf: BytesMut,  // Buffered writes
    database: u8,         // Current DB (SELECT)
    transaction: Option<Transaction>,
    subscriptions: HashSet<Bytes>,
}
```

### Protocol Parsing

RESP2 streaming parser:

```
Client sends: *3\r\n$3\r\nSET\r\n$3\r\nkey\r\n$5\r\nvalue\r\n

Parser yields:
Frame::Array(vec![
    Frame::Bulk(Some("SET")),
    Frame::Bulk(Some("key")),
    Frame::Bulk(Some("value")),
])
```

Features:
- Streaming (handles partial reads)
- Zero-copy where possible
- RESP3 support with HELLO negotiation

## Command Execution

### Command Pipeline

```
1. Parse Frame → Command enum
2. ACL check (if enabled)
3. Route to handler
4. Execute against Store
5. Generate response Frame
6. Encode and send
```

### Transaction Support

MULTI/EXEC implementation:

```
MULTI
    │
    ▼
┌─────────────────────┐
│ Queue commands      │
│ (no execution yet)  │
└─────────────────────┘
    │
EXEC
    │
    ▼
┌─────────────────────┐
│ Execute atomically  │
│ (all-or-nothing)    │
└─────────────────────┘
```

WATCH provides optimistic locking:
- Track watched keys
- Abort if modified before EXEC

## Persistence

### Append-Only File (AOF)

Write-ahead logging for durability:

```
┌─────────────────────┐
│ Command arrives     │
├─────────────────────┤
│ Write to AOF buffer │
├─────────────────────┤
│ Sync based on policy│
│  - always           │
│  - everysec         │
│  - no               │
├─────────────────────┤
│ Execute command     │
└─────────────────────┘
```

AOF Entry format:
```rust
struct AofEntry {
    timestamp: u64,
    database: u8,
    command: SerializedCommand,
}
```

### Checkpointing

Fork-less snapshots:

1. Mark current epoch
2. Copy-on-write for modifications
3. Serialize data to checkpoint file
4. Update checkpoint metadata

### Backup System

Supports local and cloud storage:

```
BackupManager
    │
    ├─ LocalBackupStorage (filesystem)
    │   └─ Gzip compression
    │
    └─ CloudBackupStorage
        ├─ S3
        ├─ GCS
        └─ Azure Blob
```

## Replication

### Primary-Replica Model

```
Primary                 Replica
   │                       │
   │  ◄── REPLICAOF ───────│
   │                       │
   │ ──── FULLRESYNC ─────►│
   │ ──── RDB transfer ───►│
   │                       │
   │ ◄── ACK offset ───────│
   │                       │
   │ ──── Replication ────►│
   │      stream           │
```

### Partial Resync

Backlog buffer allows catching up without full sync:

```
Primary Backlog: [cmd1][cmd2][cmd3][cmd4][cmd5]
                  ▲                          ▲
                  │                          │
            Replica offset          Current offset
```

## Cluster Mode

### Hash Slot Distribution

16384 slots distributed across nodes:

```
Slot = CRC16(key) mod 16384

Node A: slots 0-5460
Node B: slots 5461-10922
Node C: slots 10923-16383
```

### Cluster Communication

MOVED redirect for wrong node:
```
Client → Node A: GET key1
Node A → Client: -MOVED 12345 node_c:6379
Client → Node C: GET key1
Node C → Client: "value"
```

ASK redirect during migration:
```
-ASK 12345 node_c:6379
```

## Security

### TLS

Using rustls for TLS 1.3 support:

```
TcpListener
    │
    └─ TlsAcceptor (rustls)
        │
        └─ TlsStream<TcpStream>
```

Features:
- TLS 1.2/1.3
- Optional mTLS (client certificates)
- Configurable cipher suites

### Access Control Lists (ACLs)

Permission model:

```rust
struct User {
    name: String,
    password_hash: Vec<u8>,
    flags: UserFlags,
    key_patterns: Vec<Pattern>,
    channel_patterns: Vec<Pattern>,
    allowed_commands: HashSet<String>,
    denied_commands: HashSet<String>,
}
```

Command checking:
1. Authenticate user (AUTH)
2. Check command permission
3. Check key pattern match
4. Execute or reject

## Observability

### Metrics

Prometheus-compatible metrics:

```
ferrite_commands_total{cmd="GET"} 1234567
ferrite_connections_current 42
ferrite_memory_used_bytes 1073741824
ferrite_keyspace_keys{db="0"} 100000
ferrite_latency_seconds_bucket{le="0.001"} 99999
```

### Tracing

Structured logging with tracing crate:

```
TRACE ferrite::server: Accepted connection from 127.0.0.1:45678
DEBUG ferrite::commands: Executing GET key1
INFO  ferrite::persistence: AOF rewrite completed in 1.23s
```

## Performance Optimizations

### Zero-Copy Operations

- `Bytes` crate for reference-counted buffers
- Memory-mapped I/O for warm tier
- Direct buffer passing in protocol layer

### Lock-Free Reads

- DashMap provides concurrent access
- Epoch pinning for safe reads
- Atomic operations for access tracking

### Batch Processing

- Pipelining support (multiple commands per read)
- Transaction batching
- AOF write coalescing

## Platform Support

### Linux-Specific

- io_uring for async disk I/O
- epoll for network I/O (via tokio)

### macOS/Other

- tokio::fs fallback for disk I/O
- kqueue for network I/O (via tokio)
- Full feature parity except io_uring

## Advanced Features Architecture

### Vector Search Engine

Native vector similarity search with multiple index types:

```
┌─────────────────────────────────────────────────────────────┐
│                    Vector Index Layer                        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │    HNSW     │  │     IVF     │  │       Flat          │ │
│  │  (default)  │  │  (large)    │  │    (small/exact)    │ │
│  │ O(log n)    │  │ O(√n)       │  │    O(n)             │ │
│  └─────────────┘  └─────────────┘  └─────────────────────┘ │
├─────────────────────────────────────────────────────────────┤
│                   Distance Functions                         │
│  • Cosine similarity  • Euclidean (L2)  • Dot product       │
├─────────────────────────────────────────────────────────────┤
│                   Storage Integration                        │
│  Vectors stored in HybridLog with metadata in DashMap       │
└─────────────────────────────────────────────────────────────┘
```

**Index Types:**
- **HNSW**: Hierarchical Navigable Small World graphs for fast approximate search
- **IVF**: Inverted File Index with k-means clustering for large datasets
- **Flat**: Brute-force exact search for small datasets or validation

### Semantic Caching

Cache by meaning using vector similarity:

```
┌──────────────────────────────────────────────────────────────┐
│                    Semantic Cache Flow                        │
│                                                              │
│  Query ──► Embed ──► Vector Search ──► Similarity Check     │
│              │              │               │                │
│              ▼              ▼               ▼                │
│         ┌────────┐    ┌──────────┐    ┌──────────┐         │
│         │ ONNX   │    │  HNSW    │    │ Threshold │         │
│         │ OpenAI │    │  Index   │    │  Check    │         │
│         │ Cohere │    │          │    │  (0.85)   │         │
│         └────────┘    └──────────┘    └──────────┘         │
│                                              │               │
│                              ┌───────────────┴───────────┐  │
│                              ▼                           ▼  │
│                        Cache Hit               Cache Miss   │
│                     (return cached)        (compute & cache)│
└──────────────────────────────────────────────────────────────┘
```

**Embedding Providers:**
- ONNX Runtime (local, no API calls)
- OpenAI API
- Cohere API
- Custom providers via plugin system

### Temporal Data (Time-Travel)

Point-in-time queries leveraging HybridLog history:

```
┌──────────────────────────────────────────────────────────────┐
│                    Time-Travel Architecture                   │
│                                                              │
│  HybridLog                                                   │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ [v1@t1] ──► [v2@t2] ──► [v3@t3] ──► [v4@t4] (current)│    │
│  └─────────────────────────────────────────────────────┘    │
│       ▲           ▲           ▲           ▲                 │
│       │           │           │           │                 │
│   GET AS OF   GET AS OF   GET AS OF   GET (default)        │
│     t1          t2          t3                              │
│                                                              │
│  HISTORY key ──► Returns all versions with timestamps       │
└──────────────────────────────────────────────────────────────┘
```

**Retention Policies:**
- Configurable retention period per key pattern
- Automatic garbage collection of expired versions
- Checkpoint integration for long-term history

### Change Data Capture (CDC)

Real-time event streaming for data mutations:

```
┌──────────────────────────────────────────────────────────────┐
│                       CDC Pipeline                           │
│                                                              │
│  Write ──► CDC Log ──► Subscriptions ──► Sinks              │
│              │              │                │               │
│              ▼              ▼                ▼               │
│         ┌────────┐    ┌──────────┐    ┌──────────────┐      │
│         │ Persist │    │ Pattern  │    │ • Kafka      │      │
│         │ to disk │    │ Matching │    │ • Kinesis    │      │
│         │ (replay)│    │ users:*  │    │ • PubSub     │      │
│         └────────┘    └──────────┘    │ • HTTP       │      │
│                                        │ • RESP3      │      │
│                                        └──────────────┘      │
│                                                              │
│  Event Format:                                               │
│  { "op": "SET", "key": "users:1", "value": {...},           │
│    "timestamp": 1704067200, "sequence": 12345 }             │
└──────────────────────────────────────────────────────────────┘
```

### CRDTs (Conflict-free Replicated Data Types)

Built-in CRDTs for multi-master replication:

```
┌──────────────────────────────────────────────────────────────┐
│                    CRDT Data Types                           │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │  G-Counter   │  │  PN-Counter  │  │  OR-Set      │       │
│  │  (grow-only) │  │  (+/- ops)   │  │  (add/remove)│       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │ LWW-Register │  │  MV-Register │  │   OR-Map     │       │
│  │ (last-write) │  │  (multi-val) │  │  (nested)    │       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
│                                                              │
│  Conflict Resolution:                                        │
│  • Hybrid Logical Clocks (HLC) for ordering                 │
│  • Automatic merge on sync                                   │
│  • No coordination required                                  │
└──────────────────────────────────────────────────────────────┘
```

### FerriteQL Query Engine

SQL-like query language with query planning:

```
┌──────────────────────────────────────────────────────────────┐
│                   Query Processing Pipeline                  │
│                                                              │
│  QUERY ──► Lexer ──► Parser ──► Planner ──► Optimizer ──►   │
│                                                              │
│                                    ┌───────────────────┐     │
│                              ──►   │    Executor       │     │
│                                    │  • Scan           │     │
│                                    │  • Filter         │     │
│                                    │  • Join           │     │
│                                    │  • Aggregate      │     │
│                                    │  • Sort           │     │
│                                    └───────────────────┘     │
│                                                              │
│  Materialized Views:                                         │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ VIEW ──► Incremental Refresh ──► Cached Results     │    │
│  │          (on underlying data change)                 │    │
│  └─────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────┘
```

### WebAssembly Runtime

Secure sandbox for user-defined functions:

```
┌──────────────────────────────────────────────────────────────┐
│                    WASM Execution Model                      │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │                   wasmtime Runtime                   │    │
│  │  ┌───────────────┐  ┌───────────────────────────┐   │    │
│  │  │  WASM Module  │  │    Capability Grants      │   │    │
│  │  │ (user code)   │  │  • read_key              │   │    │
│  │  │               │  │  • write_key             │   │    │
│  │  │  Rust / Go /  │  │  • http_fetch            │   │    │
│  │  │  TypeScript   │  │  • time_now              │   │    │
│  │  └───────────────┘  └───────────────────────────┘   │    │
│  │                                                      │    │
│  │  Memory: Isolated  |  CPU: Fuel-limited             │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
│  Host Functions:                                             │
│  • ferrite_get(key) -> value                                │
│  • ferrite_set(key, value)                                  │
│  • ferrite_publish(channel, message)                        │
└──────────────────────────────────────────────────────────────┘
```

### Multi-Model Database

**Document Store:**
```
Document {
    _id: String,
    data: JSON,
    indexes: Vec<SecondaryIndex>,
    schema: Option<JSONSchema>,
}

Operations:
  • Insert, Update, Delete, Find
  • Aggregation Pipeline
  • Change Streams
```

**Graph Database:**
```
Vertex {
    id: String,
    labels: Vec<String>,
    properties: HashMap<String, Value>,
}

Edge {
    from: VertexId,
    to: VertexId,
    label: String,
    properties: HashMap<String, Value>,
}

Algorithms:
  • BFS, DFS traversal
  • Shortest path
  • PageRank
  • Pattern matching
```

### Stream Processing Engine

Kafka Streams-compatible processing:

```
┌──────────────────────────────────────────────────────────────┐
│                  Stream Processing Topology                  │
│                                                              │
│  Source ──► Map ──► Filter ──► Window ──► Aggregate ──► Sink│
│                                   │                          │
│                                   ▼                          │
│                          ┌──────────────┐                   │
│                          │  Windowing   │                   │
│                          │  • Tumbling  │                   │
│                          │  • Sliding   │                   │
│                          │  • Session   │                   │
│                          │  • Global    │                   │
│                          └──────────────┘                   │
│                                                              │
│  State Management:                                           │
│  • RocksDB-backed state stores                              │
│  • Changelog for fault tolerance                            │
│  • Exactly-once semantics                                   │
└──────────────────────────────────────────────────────────────┘
```

### Multi-Tenancy

First-class tenant isolation:

```
┌──────────────────────────────────────────────────────────────┐
│                    Multi-Tenancy Model                       │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │                  Tenant Registry                     │    │
│  │  tenant_1: { memory: 1GB, ops: 10K/s, keys: 100K }  │    │
│  │  tenant_2: { memory: 2GB, ops: 20K/s, keys: 500K }  │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
│  Key Isolation:                                              │
│  • Prefix-based: tenant_1:key1, tenant_2:key1              │
│  • Transparent to application code                          │
│                                                              │
│  Resource Enforcement:                                       │
│  • Memory quotas per tenant                                 │
│  • Rate limiting per tenant                                 │
│  • Connection limits per tenant                             │
│  • Billing metrics per tenant                               │
└──────────────────────────────────────────────────────────────┘
```

### Embedded Mode

Library mode for embedded use cases:

```rust
// No server process needed
let db = Database::open("./data")?;

// Direct function calls
db.set("key", "value")?;
let val = db.get("key")?;

// Thread-safe concurrent access
let db = Arc::new(db);
let db_clone = db.clone();
thread::spawn(move || {
    db_clone.incr("counter")?;
});
```

**Use Cases:**
- CLI tools with local state
- Edge computing / IoT
- Desktop applications
- Unit testing

### Kubernetes Operator

Custom Resource Definitions for cluster management:

```yaml
apiVersion: ferrite.io/v1
kind: FerriteCluster
metadata:
  name: my-cluster
spec:
  replicas: 3
  resources:
    memory: 8Gi
    cpu: 4
  persistence:
    enabled: true
    storageClass: fast-ssd
  tls:
    enabled: true
    secretName: ferrite-tls
---
apiVersion: ferrite.io/v1
kind: FerriteBackup
metadata:
  name: daily-backup
spec:
  cluster: my-cluster
  schedule: "0 2 * * *"
  retention: 7d
  destination:
    type: s3
    bucket: ferrite-backups
```

**Operator Capabilities:**
- Automatic provisioning and scaling
- Rolling upgrades with zero downtime
- Automatic failover
- Backup and restore management
- TLS certificate rotation

## Design Principles

1. **Correctness First**: Get it right before making it fast
2. **Predictable Performance**: P99.9 matters more than P50
3. **No Magic**: Prefer explicit over implicit
4. **Test Everything**: Especially edge cases and error paths
5. **Document Why**: Code shows what, comments explain why
6. **Zero-Copy Where Possible**: Minimize allocations in hot paths
7. **Graceful Degradation**: Fallback paths for unsupported features
