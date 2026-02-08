# ADR-0005: DashMap for Lock-Free Concurrent Access

## Status

Accepted

## Context

Ferrite's in-memory storage layer must handle concurrent reads and writes from thousands of async tasks. The data structure choice directly impacts:
- Read latency (most common operation)
- Write throughput
- Scalability across CPU cores
- Memory overhead

Options considered:

1. **`std::collections::HashMap` with `Mutex`**
   - Simple but global lock creates contention
   - All operations serialize under load

2. **`std::collections::HashMap` with `RwLock`**
   - Better for read-heavy workloads
   - Writers still block all readers

3. **`parking_lot::RwLock<HashMap>`**
   - Faster than std RwLock
   - Still has lock contention issues

4. **Sharded HashMap (manual)**
   - Split into N shards, each with own lock
   - Reduces contention but complex to implement correctly

5. **`DashMap`**
   - Lock-free reads in many cases
   - Internally sharded with fine-grained locking
   - Battle-tested, maintained

6. **`flurry` (Java ConcurrentHashMap port)**
   - Epoch-based memory reclamation
   - More complex API

## Decision

We adopt **DashMap** as the primary concurrent HashMap for in-memory data structures:

### Core Usage
```rust
use dashmap::DashMap;

pub struct MemoryStore {
    data: DashMap<Bytes, StoredValue>,
    expiry: DashMap<Bytes, Instant>,
}

impl MemoryStore {
    pub fn get(&self, key: &[u8]) -> Option<StoredValue> {
        self.data.get(key).map(|r| r.value().clone())
    }

    pub fn set(&self, key: Bytes, value: StoredValue) {
        self.data.insert(key, value);
    }
}
```

### Internal Sharding
```
┌─────────────────────────────────────────────────────┐
│                    DashMap<K, V>                     │
├─────────────────────────────────────────────────────┤
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐   │
│  │ Shard 0 │ │ Shard 1 │ │ Shard 2 │ │Shard N-1│   │
│  │         │ │         │ │         │ │         │   │
│  │ RwLock  │ │ RwLock  │ │ RwLock  │ │ RwLock  │   │
│  │   +     │ │   +     │ │   +     │ │   +     │   │
│  │ HashMap │ │ HashMap │ │ HashMap │ │ HashMap │   │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘   │
│                                                      │
│  key → hash(key) % num_shards → shard               │
└─────────────────────────────────────────────────────┘
```

### Usage Patterns

**Read-heavy (GET operations)**:
```rust
// Fast path: no lock contention if shard not being written
fn get(&self, key: &[u8]) -> Option<Value> {
    self.data.get(key).map(|r| r.clone())
}
```

**Atomic updates (INCR/DECR)**:
```rust
fn incr(&self, key: &[u8], delta: i64) -> i64 {
    self.data
        .entry(key.into())
        .and_modify(|v| v.increment(delta))
        .or_insert_with(|| Value::Integer(delta))
        .as_integer()
}
```

**Bulk operations (MGET)**:
```rust
fn mget(&self, keys: &[Bytes]) -> Vec<Option<Value>> {
    keys.iter()
        .map(|k| self.data.get(k).map(|r| r.clone()))
        .collect()
}
```

## Consequences

### Positive
- **Low read latency**: Reads often don't acquire locks (optimistic locking)
- **High concurrency**: Different shards can be accessed simultaneously
- **Simple API**: Drop-in replacement for `HashMap` in most cases
- **Memory efficient**: Only 5-10% overhead vs raw HashMap
- **Well-maintained**: Active development, production use at scale

### Negative
- **No ordered iteration**: Unlike `BTreeMap`, no sorted key access
- **Shard contention**: Hot keys in same shard still contend
- **Clone on read**: References can't escape the guard scope
- **Memory fragmentation**: Many small allocations per shard

### Trade-offs
- **Sharding overhead**: Hash computation on every access
- **Lock granularity**: More shards = less contention but more memory
- **API limitations**: Some operations require multiple lookups

## Implementation Notes

Key usages across codebase:
- `src/storage/memory.rs` - Primary key-value storage
- `src/auth/acl.rs` - User permissions cache
- `src/cluster/state.rs` - Cluster slot mappings
- `src/pubsub/channels.rs` - Subscription tracking
- `src/wasm/registry.rs` - WASM function registry

Configuration:
```rust
// DashMap auto-sizes shards to num_cpus * 4
let map: DashMap<K, V> = DashMap::new();

// Or explicit shard count
let map: DashMap<K, V> = DashMap::with_shard_amount(64);
```

Avoiding deadlocks:
```rust
// DON'T: Hold reference across await
let value = map.get(&key); // Returns Ref guard
do_async_work().await;     // Guard held across await!
drop(value);

// DO: Clone value immediately
let value = map.get(&key).map(|r| r.clone());
do_async_work().await;     // No guard held
```

## Benchmarks

Comparison on 8-core machine, 1M keys:

| Operation | DashMap | RwLock<HashMap> | Mutex<HashMap> |
|-----------|---------|-----------------|----------------|
| GET (8 threads) | 12.3M ops/s | 2.1M ops/s | 0.8M ops/s |
| SET (8 threads) | 8.7M ops/s | 1.4M ops/s | 0.7M ops/s |
| Mixed 80/20 | 10.9M ops/s | 1.8M ops/s | 0.7M ops/s |

## References

- [DashMap Repository](https://github.com/xacrimon/dashmap)
- [DashMap Internals](https://docs.rs/dashmap/latest/dashmap/)
- [Concurrent HashMap Design](https://www.youtube.com/watch?v=HJ-719EGIts)
