# Embedded/Library Mode

## Executive Summary

Run Ferrite as an embedded database library (like SQLite) without a separate server process. Enables edge computing, CLI tools, mobile backends, and desktop applications to use Redis-compatible data structures with zero operational overhead.

**Status**: Proposal
**Priority**: Medium
**Estimated Effort**: 4-6 weeks
**Target Release**: v0.4.0

---

## Problem Statement

### The Embedded Database Market

SQLite is the most deployed database in the world:
- Every smartphone, browser, and desktop OS uses it
- CLI tools embed it for local state
- Edge functions use it for persistent caching
- Desktop apps use it for user data

### Why No Redis Equivalent?

Redis requires:
1. A running server process
2. TCP connections (even locally)
3. Network serialization overhead
4. External process management

For many use cases, this is overkill:
- CLI tool storing user preferences
- Edge function caching API responses
- Desktop app managing session data
- Mobile app with offline-first data

### The Opportunity

**Ferrite Embedded** = Redis data structures + SQLite deployment model

```rust
// Like SQLite, but with Redis semantics
let db = ferrite::embedded::open("./myapp.ferrite")?;

// Full Redis API, zero network overhead
db.set("user:123:name", "Alice")?;
db.hset("user:123", "email", "alice@example.com")?;
db.lpush("user:123:history", "login")?;

// Automatic persistence
db.close()?;  // Data survives restart
```

---

## Technical Design

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    Ferrite Embedded                             │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                      User API                               │ │
│  │  Rust: ferrite::embedded::Database                         │ │
│  │  C:    ferrite_open(), ferrite_set(), ferrite_get()        │ │
│  │  Python: ferrite.Database                                  │ │
│  └──────────────────────────┬──────────────────────────────────┘ │
│                             ▼                                    │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                   Command Executor                          │ │
│  │  Same command implementations as server mode                │ │
│  │  Direct function calls, no RESP encoding                   │ │
│  └──────────────────────────┬──────────────────────────────────┘ │
│                             ▼                                    │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                      Storage Layer                          │ │
│  │  HybridLog (configurable tiers)                            │ │
│  │  File-based persistence                                     │ │
│  │  Optional memory-only mode                                  │ │
│  └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘

No network layer!
No RESP protocol!
No TCP overhead!
```

### Core API Design

```rust
// ferrite-embedded crate

/// Configuration for embedded database
pub struct EmbeddedConfig {
    /// Data directory (None for in-memory only)
    pub path: Option<PathBuf>,
    /// Maximum memory for hot data
    pub memory_limit: usize,
    /// Enable write-ahead logging
    pub wal_enabled: bool,
    /// Sync mode
    pub sync_mode: SyncMode,
    /// Number of databases (default: 16)
    pub num_databases: u8,
}

#[derive(Clone)]
pub enum SyncMode {
    /// No sync (fastest, data loss on crash)
    None,
    /// Sync on commit
    Normal,
    /// Sync every write (slowest, safest)
    Full,
}

/// Embedded database instance
pub struct Database {
    store: Arc<Store>,
    config: EmbeddedConfig,
    persistence: Option<PersistenceManager>,
}

impl Database {
    /// Open a database (creates if doesn't exist)
    pub fn open<P: AsRef<Path>>(path: P) -> Result<Self> {
        Self::open_with_config(EmbeddedConfig {
            path: Some(path.as_ref().to_path_buf()),
            ..Default::default()
        })
    }

    /// Open with custom configuration
    pub fn open_with_config(config: EmbeddedConfig) -> Result<Self>;

    /// Create an in-memory database
    pub fn memory() -> Result<Self> {
        Self::open_with_config(EmbeddedConfig {
            path: None,
            ..Default::default()
        })
    }

    /// Close the database (flushes data)
    pub fn close(self) -> Result<()>;

    /// Force sync to disk
    pub fn sync(&self) -> Result<()>;

    /// Get database statistics
    pub fn stats(&self) -> DatabaseStats;
}
```

### String Commands

```rust
impl Database {
    // GET key
    pub fn get(&self, key: impl AsRef<[u8]>) -> Result<Option<Vec<u8>>>;

    // GET as string (convenience)
    pub fn get_str(&self, key: impl AsRef<str>) -> Result<Option<String>>;

    // SET key value [EX seconds] [PX milliseconds] [NX|XX]
    pub fn set(&self, key: impl AsRef<[u8]>, value: impl AsRef<[u8]>) -> Result<()>;

    // SET with options
    pub fn set_ex(&self, key: impl AsRef<[u8]>, value: impl AsRef<[u8]>, ttl: Duration) -> Result<()>;
    pub fn set_nx(&self, key: impl AsRef<[u8]>, value: impl AsRef<[u8]>) -> Result<bool>;
    pub fn set_xx(&self, key: impl AsRef<[u8]>, value: impl AsRef<[u8]>) -> Result<bool>;

    // INCR / DECR
    pub fn incr(&self, key: impl AsRef<[u8]>) -> Result<i64>;
    pub fn incr_by(&self, key: impl AsRef<[u8]>, delta: i64) -> Result<i64>;
    pub fn incr_by_float(&self, key: impl AsRef<[u8]>, delta: f64) -> Result<f64>;

    // APPEND
    pub fn append(&self, key: impl AsRef<[u8]>, value: impl AsRef<[u8]>) -> Result<usize>;

    // STRLEN
    pub fn strlen(&self, key: impl AsRef<[u8]>) -> Result<usize>;

    // MGET / MSET
    pub fn mget(&self, keys: &[impl AsRef<[u8]>]) -> Result<Vec<Option<Vec<u8>>>>;
    pub fn mset(&self, pairs: &[(impl AsRef<[u8]>, impl AsRef<[u8]>)]) -> Result<()>;
}
```

### Hash Commands

```rust
impl Database {
    // HSET
    pub fn hset(&self, key: impl AsRef<[u8]>, field: impl AsRef<[u8]>, value: impl AsRef<[u8]>) -> Result<bool>;

    // HGET
    pub fn hget(&self, key: impl AsRef<[u8]>, field: impl AsRef<[u8]>) -> Result<Option<Vec<u8>>>;

    // HMSET / HMGET
    pub fn hmset(&self, key: impl AsRef<[u8]>, pairs: &[(impl AsRef<[u8]>, impl AsRef<[u8]>)]) -> Result<()>;
    pub fn hmget(&self, key: impl AsRef<[u8]>, fields: &[impl AsRef<[u8]>]) -> Result<Vec<Option<Vec<u8>>>>;

    // HGETALL
    pub fn hgetall(&self, key: impl AsRef<[u8]>) -> Result<HashMap<Vec<u8>, Vec<u8>>>;

    // HDEL
    pub fn hdel(&self, key: impl AsRef<[u8]>, fields: &[impl AsRef<[u8]>]) -> Result<usize>;

    // HEXISTS
    pub fn hexists(&self, key: impl AsRef<[u8]>, field: impl AsRef<[u8]>) -> Result<bool>;

    // HINCRBY
    pub fn hincrby(&self, key: impl AsRef<[u8]>, field: impl AsRef<[u8]>, delta: i64) -> Result<i64>;

    // HKEYS / HVALS / HLEN
    pub fn hkeys(&self, key: impl AsRef<[u8]>) -> Result<Vec<Vec<u8>>>;
    pub fn hvals(&self, key: impl AsRef<[u8]>) -> Result<Vec<Vec<u8>>>;
    pub fn hlen(&self, key: impl AsRef<[u8]>) -> Result<usize>;
}
```

### List Commands

```rust
impl Database {
    // LPUSH / RPUSH
    pub fn lpush(&self, key: impl AsRef<[u8]>, values: &[impl AsRef<[u8]>]) -> Result<usize>;
    pub fn rpush(&self, key: impl AsRef<[u8]>, values: &[impl AsRef<[u8]>]) -> Result<usize>;

    // LPOP / RPOP
    pub fn lpop(&self, key: impl AsRef<[u8]>) -> Result<Option<Vec<u8>>>;
    pub fn rpop(&self, key: impl AsRef<[u8]>) -> Result<Option<Vec<u8>>>;

    // LRANGE
    pub fn lrange(&self, key: impl AsRef<[u8]>, start: i64, stop: i64) -> Result<Vec<Vec<u8>>>;

    // LINDEX
    pub fn lindex(&self, key: impl AsRef<[u8]>, index: i64) -> Result<Option<Vec<u8>>>;

    // LSET
    pub fn lset(&self, key: impl AsRef<[u8]>, index: i64, value: impl AsRef<[u8]>) -> Result<()>;

    // LLEN
    pub fn llen(&self, key: impl AsRef<[u8]>) -> Result<usize>;

    // LTRIM
    pub fn ltrim(&self, key: impl AsRef<[u8]>, start: i64, stop: i64) -> Result<()>;
}
```

### Set Commands

```rust
impl Database {
    // SADD
    pub fn sadd(&self, key: impl AsRef<[u8]>, members: &[impl AsRef<[u8]>]) -> Result<usize>;

    // SREM
    pub fn srem(&self, key: impl AsRef<[u8]>, members: &[impl AsRef<[u8]>]) -> Result<usize>;

    // SMEMBERS
    pub fn smembers(&self, key: impl AsRef<[u8]>) -> Result<HashSet<Vec<u8>>>;

    // SISMEMBER
    pub fn sismember(&self, key: impl AsRef<[u8]>, member: impl AsRef<[u8]>) -> Result<bool>;

    // SCARD
    pub fn scard(&self, key: impl AsRef<[u8]>) -> Result<usize>;

    // Set operations
    pub fn sunion(&self, keys: &[impl AsRef<[u8]>]) -> Result<HashSet<Vec<u8>>>;
    pub fn sinter(&self, keys: &[impl AsRef<[u8]>]) -> Result<HashSet<Vec<u8>>>;
    pub fn sdiff(&self, keys: &[impl AsRef<[u8]>]) -> Result<HashSet<Vec<u8>>>;
}
```

### Sorted Set Commands

```rust
impl Database {
    // ZADD
    pub fn zadd(&self, key: impl AsRef<[u8]>, members: &[(f64, impl AsRef<[u8]>)]) -> Result<usize>;

    // ZREM
    pub fn zrem(&self, key: impl AsRef<[u8]>, members: &[impl AsRef<[u8]>]) -> Result<usize>;

    // ZSCORE
    pub fn zscore(&self, key: impl AsRef<[u8]>, member: impl AsRef<[u8]>) -> Result<Option<f64>>;

    // ZRANK / ZREVRANK
    pub fn zrank(&self, key: impl AsRef<[u8]>, member: impl AsRef<[u8]>) -> Result<Option<usize>>;

    // ZRANGE / ZREVRANGE
    pub fn zrange(&self, key: impl AsRef<[u8]>, start: i64, stop: i64) -> Result<Vec<Vec<u8>>>;
    pub fn zrange_with_scores(&self, key: impl AsRef<[u8]>, start: i64, stop: i64) -> Result<Vec<(Vec<u8>, f64)>>;

    // ZRANGEBYSCORE
    pub fn zrangebyscore(&self, key: impl AsRef<[u8]>, min: f64, max: f64) -> Result<Vec<Vec<u8>>>;

    // ZINCRBY
    pub fn zincrby(&self, key: impl AsRef<[u8]>, increment: f64, member: impl AsRef<[u8]>) -> Result<f64>;

    // ZCARD
    pub fn zcard(&self, key: impl AsRef<[u8]>) -> Result<usize>;
}
```

### Key Commands

```rust
impl Database {
    // DEL
    pub fn del(&self, keys: &[impl AsRef<[u8]>]) -> Result<usize>;

    // EXISTS
    pub fn exists(&self, keys: &[impl AsRef<[u8]>]) -> Result<usize>;

    // EXPIRE / EXPIREAT
    pub fn expire(&self, key: impl AsRef<[u8]>, ttl: Duration) -> Result<bool>;
    pub fn expire_at(&self, key: impl AsRef<[u8]>, timestamp: SystemTime) -> Result<bool>;

    // TTL / PTTL
    pub fn ttl(&self, key: impl AsRef<[u8]>) -> Result<Option<Duration>>;

    // PERSIST
    pub fn persist(&self, key: impl AsRef<[u8]>) -> Result<bool>;

    // TYPE
    pub fn key_type(&self, key: impl AsRef<[u8]>) -> Result<Option<KeyType>>;

    // KEYS (use with caution)
    pub fn keys(&self, pattern: impl AsRef<str>) -> Result<Vec<Vec<u8>>>;

    // SCAN
    pub fn scan(&self, cursor: u64, pattern: Option<&str>, count: Option<usize>) -> Result<(u64, Vec<Vec<u8>>)>;

    // RENAME
    pub fn rename(&self, key: impl AsRef<[u8]>, new_key: impl AsRef<[u8]>) -> Result<()>;
}

pub enum KeyType {
    String,
    List,
    Hash,
    Set,
    ZSet,
    Stream,
}
```

### Transactions

```rust
impl Database {
    /// Execute operations atomically
    pub fn transaction<F, T>(&self, f: F) -> Result<T>
    where
        F: FnOnce(&Transaction) -> Result<T>;
}

/// Transaction context
pub struct Transaction<'a> {
    db: &'a Database,
    batch: BatchedWrites,
}

impl<'a> Transaction<'a> {
    // All Database methods available
    pub fn set(&self, key: impl AsRef<[u8]>, value: impl AsRef<[u8]>) -> Result<()>;
    pub fn get(&self, key: impl AsRef<[u8]>) -> Result<Option<Vec<u8>>>;
    // etc.
}

// Usage:
db.transaction(|tx| {
    let balance = tx.get("account:123:balance")?.unwrap_or(b"0".to_vec());
    let balance: i64 = String::from_utf8_lossy(&balance).parse()?;

    if balance >= 100 {
        tx.incr_by("account:123:balance", -100)?;
        tx.incr_by("account:456:balance", 100)?;
        Ok(true)
    } else {
        Ok(false)
    }
})?;
```

### Iterator API

```rust
impl Database {
    /// Iterate over all keys matching pattern
    pub fn iter_keys(&self, pattern: &str) -> KeyIterator;

    /// Iterate over hash fields
    pub fn iter_hash(&self, key: impl AsRef<[u8]>) -> HashIterator;

    /// Iterate over list
    pub fn iter_list(&self, key: impl AsRef<[u8]>) -> ListIterator;

    /// Iterate over set
    pub fn iter_set(&self, key: impl AsRef<[u8]>) -> SetIterator;

    /// Iterate over sorted set
    pub fn iter_zset(&self, key: impl AsRef<[u8]>) -> ZSetIterator;
}

// Usage:
for key in db.iter_keys("user:*") {
    println!("Key: {}", String::from_utf8_lossy(&key));
}

for (field, value) in db.iter_hash("user:123") {
    println!("{} = {}",
        String::from_utf8_lossy(&field),
        String::from_utf8_lossy(&value)
    );
}
```

---

## Language Bindings

### C API

```c
// ferrite.h

typedef struct ferrite_db ferrite_db;
typedef struct ferrite_error ferrite_error;

// Open/close
ferrite_db* ferrite_open(const char* path, ferrite_error** err);
ferrite_db* ferrite_open_memory(ferrite_error** err);
void ferrite_close(ferrite_db* db);

// String operations
int ferrite_set(ferrite_db* db, const char* key, size_t key_len,
                const char* value, size_t value_len, ferrite_error** err);
char* ferrite_get(ferrite_db* db, const char* key, size_t key_len,
                  size_t* value_len, ferrite_error** err);

// Hash operations
int ferrite_hset(ferrite_db* db, const char* key, size_t key_len,
                 const char* field, size_t field_len,
                 const char* value, size_t value_len, ferrite_error** err);
char* ferrite_hget(ferrite_db* db, const char* key, size_t key_len,
                   const char* field, size_t field_len,
                   size_t* value_len, ferrite_error** err);

// Key operations
int ferrite_del(ferrite_db* db, const char* key, size_t key_len, ferrite_error** err);
int ferrite_exists(ferrite_db* db, const char* key, size_t key_len, ferrite_error** err);

// Error handling
const char* ferrite_error_message(ferrite_error* err);
void ferrite_error_free(ferrite_error* err);
void ferrite_free(void* ptr);
```

### Python Binding

```python
# ferrite.py (using PyO3)

import ferrite

# Open database
db = ferrite.Database("./myapp.ferrite")

# Or in-memory
db = ferrite.Database.memory()

# String operations
db.set("key", "value")
db.set("key", "value", ex=3600)  # With expiry
value = db.get("key")  # Returns bytes or None

# Hash operations
db.hset("user:123", "name", "Alice")
db.hset("user:123", {"email": "alice@example.com", "age": "30"})
user = db.hgetall("user:123")  # Returns dict

# List operations
db.lpush("queue", "item1", "item2")
item = db.rpop("queue")
items = db.lrange("queue", 0, -1)

# Set operations
db.sadd("tags", "python", "redis", "database")
is_member = db.sismember("tags", "python")
all_tags = db.smembers("tags")

# Sorted set
db.zadd("leaderboard", {"alice": 100, "bob": 95})
top_players = db.zrange("leaderboard", 0, 9, withscores=True)

# Transactions
with db.transaction() as tx:
    tx.incr("counter")
    tx.lpush("log", "incremented counter")

# Context manager for cleanup
with ferrite.Database("./myapp.ferrite") as db:
    db.set("key", "value")
# Automatically closed and synced
```

### Node.js Binding

```javascript
// Using napi-rs

const ferrite = require('ferrite-embedded');

// Open database
const db = ferrite.open('./myapp.ferrite');

// Or in-memory
const db = ferrite.memory();

// Async API (recommended)
await db.set('key', 'value');
const value = await db.get('key');

await db.hset('user:123', 'name', 'Alice');
const user = await db.hgetall('user:123');

// Sync API (for simple cases)
db.setSync('key', 'value');
const value = db.getSync('key');

// Transactions
await db.transaction(async (tx) => {
    await tx.incr('counter');
    await tx.lpush('log', 'incremented');
});

// Cleanup
await db.close();
```

### Go Binding

```go
package main

import "github.com/ferrite/go-embedded"

func main() {
    // Open database
    db, err := ferrite.Open("./myapp.ferrite")
    if err != nil {
        panic(err)
    }
    defer db.Close()

    // String operations
    db.Set("key", []byte("value"))
    value, _ := db.Get("key")

    // Hash operations
    db.HSet("user:123", "name", []byte("Alice"))
    name, _ := db.HGet("user:123", "name")

    // Transactions
    db.Transaction(func(tx *ferrite.Tx) error {
        tx.Incr("counter")
        tx.LPush("log", []byte("incremented"))
        return nil
    })
}
```

---

## Implementation Plan

### Phase 1: Core Library (2 weeks)

#### Week 1: API Structure

- [ ] Create `ferrite-embedded` crate
- [ ] Define public API types
- [ ] Implement `Database::open` and `Database::memory`
- [ ] Wire up to existing `Store`

#### Week 2: Command Implementation

- [ ] Implement string commands
- [ ] Implement hash commands
- [ ] Implement list commands
- [ ] Implement set commands
- [ ] Implement sorted set commands
- [ ] Implement key commands

### Phase 2: Persistence (2 weeks)

#### Week 3: File-Based Storage

- [ ] Implement file-based HybridLog
- [ ] Add WAL for durability
- [ ] Implement recovery on open
- [ ] Add sync modes

#### Week 4: Testing & Optimization

- [ ] Unit tests for all operations
- [ ] Benchmark vs. Redis client
- [ ] Memory optimization
- [ ] Error handling polish

### Phase 3: Language Bindings (2 weeks)

#### Week 5: C and Python

- [ ] Implement C API
- [ ] Create Python binding with PyO3
- [ ] Python package (pip installable)
- [ ] Documentation

#### Week 6: Node.js and Go

- [ ] Node.js binding with napi-rs
- [ ] Go binding with cgo
- [ ] Package publishing
- [ ] Integration tests

---

## Configuration

### Rust Configuration

```rust
let config = EmbeddedConfig {
    path: Some("./data".into()),
    memory_limit: 256 * 1024 * 1024,  // 256MB
    wal_enabled: true,
    sync_mode: SyncMode::Normal,
    num_databases: 16,
    ..Default::default()
};

let db = Database::open_with_config(config)?;
```

### Environment Variables

```bash
# Default memory limit
FERRITE_MEMORY_LIMIT=256M

# Sync mode
FERRITE_SYNC_MODE=normal

# Enable debug logging
FERRITE_LOG=debug
```

---

## Performance Considerations

### Compared to Redis Client

| Operation | Redis (localhost) | Ferrite Embedded |
|-----------|-------------------|------------------|
| SET | ~50μs | ~1μs |
| GET | ~50μs | ~0.5μs |
| HSET | ~60μs | ~1μs |
| LPUSH | ~55μs | ~1μs |

**~50x faster** by eliminating:
- TCP socket overhead
- RESP serialization/deserialization
- System call overhead

### Memory Overhead

- Base footprint: ~5MB
- Per-key overhead: ~100 bytes
- Suitable for embedded/edge use cases

### Optimization Strategies

1. **Memory-Mapped Files**
   - Zero-copy reads
   - OS manages paging

2. **Direct Access**
   - No serialization layer
   - Direct struct access

3. **Lock-Free Reads**
   - Epoch-based reclamation
   - Minimal contention

---

## Use Cases

### 1. CLI Tools

```rust
// Config storage for CLI
fn main() {
    let db = Database::open("~/.myapp/config.ferrite")?;

    // Store user preferences
    db.hset("config", "theme", "dark")?;
    db.hset("config", "editor", "vim")?;

    // Recent files
    db.lpush("recent_files", current_file)?;
    db.ltrim("recent_files", 0, 9)?;  // Keep last 10
}
```

### 2. Desktop Applications

```rust
// Session management for desktop app
fn main() {
    let db = Database::open("./session.ferrite")?;

    // Window state
    db.hset("window", "width", "1200")?;
    db.hset("window", "height", "800")?;

    // Open documents
    db.sadd("open_docs", &doc_path)?;

    // Undo history per document
    db.lpush(&format!("undo:{}", doc_id), &serialized_state)?;
}
```

### 3. Edge Functions

```rust
// Cloudflare Worker / Deno Deploy / etc.
async fn handle_request(req: Request) -> Response {
    let db = Database::memory();  // Per-request cache

    // Cache expensive computations
    if let Some(cached) = db.get(&cache_key)? {
        return Response::new(cached);
    }

    let result = expensive_computation();
    db.set(&cache_key, &result)?;

    Response::new(result)
}
```

### 4. Mobile Applications

```swift
// iOS app with offline-first data
class DataStore {
    let db = try! Ferrite.open(documentsPath + "/app.ferrite")

    func saveUser(_ user: User) {
        db.hset("user:\(user.id)", "name", user.name)
        db.hset("user:\(user.id)", "email", user.email)
        db.sadd("users", user.id)
    }

    func getUser(_ id: String) -> User? {
        guard let data = db.hgetall("user:\(id)") else { return nil }
        return User(data)
    }
}
```

---

## Testing Strategy

### Unit Tests

```rust
#[test]
fn test_set_get() {
    let db = Database::memory().unwrap();
    db.set("key", "value").unwrap();
    assert_eq!(db.get("key").unwrap(), Some(b"value".to_vec()));
}

#[test]
fn test_persistence() {
    let path = tempdir().unwrap().path().join("test.ferrite");

    {
        let db = Database::open(&path).unwrap();
        db.set("key", "value").unwrap();
    }

    {
        let db = Database::open(&path).unwrap();
        assert_eq!(db.get("key").unwrap(), Some(b"value".to_vec()));
    }
}

#[test]
fn test_transaction_rollback() {
    let db = Database::memory().unwrap();
    db.set("balance", "100").unwrap();

    let result = db.transaction(|tx| {
        tx.incr_by("balance", -200)?;
        // This would make balance negative
        Err(anyhow!("Insufficient funds"))
    });

    assert!(result.is_err());
    assert_eq!(db.get_str("balance").unwrap(), Some("100".to_string()));
}
```

### Integration Tests

- [ ] All Redis commands work correctly
- [ ] Persistence across restarts
- [ ] Concurrent access
- [ ] Memory limits respected

### Language Binding Tests

- [ ] Python pytest suite
- [ ] Node.js jest tests
- [ ] Go test suite

---

## Risks and Mitigations

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| API surface too large | Medium | High | Focus on core commands first |
| Binding maintenance burden | Medium | High | Code generation, prioritize key languages |
| Performance parity with server | Low | Low | Direct access should be faster |
| Threading safety issues | High | Medium | Extensive testing, clear documentation |

---

## Success Metrics

### Technical Metrics

- < 5MB base memory footprint
- < 1μs for simple operations
- 100% API compatibility with common commands
- Bindings for 4+ languages

### Business Metrics

- 10K+ downloads across package managers
- Used in 3+ popular CLI tools
- Featured in "SQLite alternatives" discussions

---

## Future Enhancements

1. **Browser Target** - Compile to WASM for browser use
2. **Replication** - Sync embedded DBs to server
3. **Encryption at Rest** - Built-in encryption
4. **Compression** - Automatic value compression
5. **Reactive Queries** - Subscribe to changes

---

## References

- [SQLite Architecture](https://www.sqlite.org/arch.html)
- [RocksDB Embedded](https://rocksdb.org/)
- [LevelDB](https://github.com/google/leveldb)
- [Sled](https://github.com/spacejam/sled)
- [PyO3](https://pyo3.rs/)
- [napi-rs](https://napi.rs/)
