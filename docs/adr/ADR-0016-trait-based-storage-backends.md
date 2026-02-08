# ADR-0016: Trait-Based Storage Backend Abstraction

## Status

Accepted

## Context

Ferrite's storage layer must support multiple deployment scenarios:

1. **Development/Testing**: Fast, simple in-memory storage
2. **Production (small datasets)**: Optimized memory storage with persistence
3. **Production (large datasets)**: Tiered HybridLog storage (memory → mmap → disk)
4. **Cloud-native**: Object storage backends (S3, GCS, Azure Blob)
5. **Edge deployments**: Constrained memory, SSD-optimized

Hardcoding a single storage implementation would force all users into the same trade-offs. Different use cases have different requirements:

| Scenario | Memory | Latency | Capacity | Durability |
|----------|--------|---------|----------|------------|
| Cache | Unlimited | <1ms | RAM-bound | Optional |
| Session store | Limited | <5ms | 10GB+ | Required |
| Time-series | Minimal | <10ms | 100GB+ | Required |
| Archive | Minimal | <100ms | 1TB+ | Required |

Rather than one-size-fits-all, we need pluggable backends that share a common interface.

## Decision

We define storage operations through **Rust traits**, allowing multiple backend implementations:

### Core Storage Trait

```rust
// src/storage/engine.rs

use async_trait::async_trait;
use bytes::Bytes;

/// Core storage operations trait
#[async_trait]
pub trait StorageEngine: Send + Sync {
    /// Get value by key
    async fn get(&self, key: &[u8]) -> Result<Option<Bytes>>;

    /// Set key-value pair with optional TTL
    async fn set(&self, key: Bytes, value: Bytes, ttl: Option<Duration>) -> Result<()>;

    /// Delete key
    async fn del(&self, key: &[u8]) -> Result<bool>;

    /// Check if key exists
    async fn exists(&self, key: &[u8]) -> Result<bool>;

    /// Get multiple keys
    async fn mget(&self, keys: &[&[u8]]) -> Result<Vec<Option<Bytes>>> {
        // Default implementation: sequential gets
        let mut results = Vec::with_capacity(keys.len());
        for key in keys {
            results.push(self.get(key).await?);
        }
        Ok(results)
    }

    /// Scan keys matching pattern
    async fn scan(&self, pattern: &str, cursor: u64, count: usize)
        -> Result<(u64, Vec<Bytes>)>;

    /// Get storage statistics
    fn stats(&self) -> StorageStats;
}
```

### Extended Traits for Data Types

```rust
/// List operations (optional capability)
#[async_trait]
pub trait ListOps: StorageEngine {
    async fn lpush(&self, key: &[u8], values: &[Bytes]) -> Result<usize>;
    async fn rpush(&self, key: &[u8], values: &[Bytes]) -> Result<usize>;
    async fn lpop(&self, key: &[u8], count: usize) -> Result<Vec<Bytes>>;
    async fn rpop(&self, key: &[u8], count: usize) -> Result<Vec<Bytes>>;
    async fn lrange(&self, key: &[u8], start: i64, stop: i64) -> Result<Vec<Bytes>>;
    async fn llen(&self, key: &[u8]) -> Result<usize>;
}

/// Hash operations (optional capability)
#[async_trait]
pub trait HashOps: StorageEngine {
    async fn hget(&self, key: &[u8], field: &[u8]) -> Result<Option<Bytes>>;
    async fn hset(&self, key: &[u8], field: Bytes, value: Bytes) -> Result<bool>;
    async fn hdel(&self, key: &[u8], fields: &[&[u8]]) -> Result<usize>;
    async fn hgetall(&self, key: &[u8]) -> Result<Vec<(Bytes, Bytes)>>;
    async fn hkeys(&self, key: &[u8]) -> Result<Vec<Bytes>>;
}

/// Sorted set operations (optional capability)
#[async_trait]
pub trait SortedSetOps: StorageEngine {
    async fn zadd(&self, key: &[u8], members: &[(f64, Bytes)]) -> Result<usize>;
    async fn zscore(&self, key: &[u8], member: &[u8]) -> Result<Option<f64>>;
    async fn zrange(&self, key: &[u8], start: i64, stop: i64) -> Result<Vec<Bytes>>;
    async fn zrank(&self, key: &[u8], member: &[u8]) -> Result<Option<usize>>;
}

/// Persistence operations (optional capability)
#[async_trait]
pub trait PersistenceOps: StorageEngine {
    async fn checkpoint(&self) -> Result<PathBuf>;
    async fn restore(&self, path: &Path) -> Result<()>;
    async fn compact(&self) -> Result<()>;
}
```

### Backend Implementations

**Memory Backend** (Phase 1, simple):
```rust
// src/storage/memory.rs

pub struct MemoryStore {
    data: DashMap<Bytes, Entry>,
}

#[async_trait]
impl StorageEngine for MemoryStore {
    async fn get(&self, key: &[u8]) -> Result<Option<Bytes>> {
        Ok(self.data.get(key)
            .filter(|e| !e.is_expired())
            .map(|e| e.value.clone()))
    }

    async fn set(&self, key: Bytes, value: Bytes, ttl: Option<Duration>) -> Result<()> {
        let entry = Entry::new(value, ttl);
        self.data.insert(key, entry);
        Ok(())
    }

    // ... other implementations
}

impl ListOps for MemoryStore { /* ... */ }
impl HashOps for MemoryStore { /* ... */ }
impl SortedSetOps for MemoryStore { /* ... */ }
```

**HybridLog Backend** (Production, tiered):
```rust
// src/storage/hybridlog/mod.rs

pub struct HybridLogStore {
    mutable: MutableRegion,
    readonly: ReadOnlyRegion,
    disk: DiskRegion,
    index: HashIndex,
}

#[async_trait]
impl StorageEngine for HybridLogStore {
    async fn get(&self, key: &[u8]) -> Result<Option<Bytes>> {
        let guard = EpochGuard::pin();

        // Check index for key location
        let location = match self.index.lookup(key, &guard) {
            Some(loc) => loc,
            None => return Ok(None),
        };

        // Fetch from appropriate tier
        match location.tier {
            Tier::Mutable => self.mutable.get(location.offset),
            Tier::ReadOnly => self.readonly.get(location.offset),
            Tier::Disk => self.disk.get(location.offset).await,
        }
    }

    async fn set(&self, key: Bytes, value: Bytes, ttl: Option<Duration>) -> Result<()> {
        // Always write to mutable region
        let offset = self.mutable.append(key.clone(), value, ttl)?;

        // Update index to point to new location
        let guard = EpochGuard::pin();
        self.index.update(key, LogAddress::mutable(offset), &guard);

        Ok(())
    }

    // ... tiered implementations
}

impl PersistenceOps for HybridLogStore {
    async fn checkpoint(&self) -> Result<PathBuf> {
        // Flush mutable to readonly, snapshot to disk
        self.flush_and_checkpoint().await
    }
}
```

**Cloud Backend** (Object storage):
```rust
// src/storage/cloud.rs

pub struct CloudStore {
    client: S3Client,
    cache: Arc<MemoryStore>,  // Local cache
    bucket: String,
}

#[async_trait]
impl StorageEngine for CloudStore {
    async fn get(&self, key: &[u8]) -> Result<Option<Bytes>> {
        // Check local cache first
        if let Some(value) = self.cache.get(key).await? {
            return Ok(Some(value));
        }

        // Fetch from S3
        let object_key = self.key_to_path(key);
        match self.client.get_object(&self.bucket, &object_key).await {
            Ok(data) => {
                // Populate cache
                self.cache.set(key.into(), data.clone(), None).await?;
                Ok(Some(data))
            }
            Err(NotFound) => Ok(None),
            Err(e) => Err(e.into()),
        }
    }
}
```

### Backend Selection

Runtime backend selection via configuration:

```rust
// src/storage/mod.rs

pub fn create_storage(config: &StorageConfig) -> Result<Box<dyn StorageEngine>> {
    match config.backend {
        Backend::Memory => {
            Ok(Box::new(MemoryStore::new(config.memory)))
        }
        Backend::HybridLog => {
            Ok(Box::new(HybridLogStore::new(config.hybridlog)?))
        }
        Backend::Cloud { provider } => {
            Ok(Box::new(CloudStore::new(provider, config.cloud)?))
        }
    }
}
```

Configuration:
```toml
[storage]
backend = "hybridlog"  # "memory", "hybridlog", "cloud"

[storage.memory]
max_size = "1GB"

[storage.hybridlog]
mutable_size = "256MB"
readonly_size = "1GB"
data_dir = "/var/lib/ferrite"

[storage.cloud]
provider = "s3"
bucket = "ferrite-data"
region = "us-east-1"
```

## Consequences

### Positive

- **Flexibility**: Choose backend appropriate for workload
- **Testability**: Mock storage for unit tests
- **Evolution**: Add new backends without changing commands
- **Migration path**: Start simple (memory), scale up (HybridLog)
- **Composition**: Wrap backends with caching, metrics, etc.
- **Type safety**: Compile-time verification of backend capabilities

### Negative

- **Indirection**: Trait objects have dynamic dispatch overhead (~2ns)
- **Complexity**: More code to maintain across backends
- **Feature parity**: Hard to keep all backends at same capability level
- **Testing matrix**: Need to test each backend separately
- **Abstraction leaks**: Some optimizations are backend-specific

### Trade-offs

- **Genericity vs optimization**: Generic interface may miss backend-specific optimizations
- **Simple API vs full control**: Trade ease-of-use for fine-grained control
- **Runtime vs compile-time selection**: Flexibility vs performance

## Implementation Notes

Key files:
- `src/storage/mod.rs` - Module root, factory function
- `src/storage/engine.rs` - Core trait definitions
- `src/storage/memory.rs` - In-memory backend
- `src/storage/hybridlog/` - Tiered storage backend
- `src/storage/cloud.rs` - Cloud storage backend
- `src/storage/backend.rs` - Serialization helpers

Backend capability detection:
```rust
/// Check if storage supports lists at runtime
pub fn supports_lists(storage: &dyn StorageEngine) -> bool {
    storage.as_any().is::<dyn ListOps>()
}

/// Downcast to list operations
pub fn as_list_ops(storage: &dyn StorageEngine) -> Option<&dyn ListOps> {
    storage.as_any().downcast_ref::<dyn ListOps>()
}
```

Middleware/wrapper pattern for cross-cutting concerns:
```rust
pub struct MetricsWrapper<S: StorageEngine> {
    inner: S,
    metrics: Metrics,
}

#[async_trait]
impl<S: StorageEngine> StorageEngine for MetricsWrapper<S> {
    async fn get(&self, key: &[u8]) -> Result<Option<Bytes>> {
        let start = Instant::now();
        let result = self.inner.get(key).await;
        self.metrics.observe_get(start.elapsed(), result.is_ok());
        result
    }
}
```

## Future Backends

Planned backend implementations:
- **RocksDB**: LSM-tree for write-heavy workloads
- **LMDB**: Memory-mapped B-tree for read-heavy workloads
- **FoundationDB**: Distributed transactions
- **TiKV**: Distributed storage layer

## References

- [Rust Async Trait Pattern](https://docs.rs/async-trait/)
- [FASTER Storage Abstractions](https://github.com/microsoft/FASTER/blob/main/cs/src/core/Device/IDevice.cs)
- [LevelDB/RocksDB Interface](https://github.com/google/leveldb/blob/main/include/leveldb/db.h)
- [Strategy Pattern](https://refactoring.guru/design-patterns/strategy)
