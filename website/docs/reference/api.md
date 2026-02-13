---
sidebar_position: 3
title: API Reference
description: Complete Ferrite Rust API reference. Learn about embedded mode, client connections, storage engine, and feature-specific modules.
keywords: [api, rust, embedded, client, storage, vector, semantic, temporal]
maturity: stable
---

# API Reference

Ferrite provides a comprehensive Rust API for both embedded and client-server usage. This page provides local documentation with examples, complementing the auto-generated API docs.

> Note: The public surface spans core and experimental modules. Refer to
> `src/lib.rs` for the current maturity grouping.

## API Stability & Versioning

- **Stable**: Core Redis compatibility and foundational modules.
- **Beta**: Feature-complete but still evolving.
- **Experimental**: Under active development; expect breaking changes.

Ferrite follows semantic versioning after 1.0. Until then, `0.x` releases may
include breaking changes, especially in beta/experimental modules.

## Documentation Resources

| Resource | Description |
|----------|-------------|
| **[docs.rs/ferrite](https://docs.rs/ferrite)** | Full API documentation with all types and functions |
| **[Playground](/playground)** | Try commands interactively in your browser |
| **[Examples](https://github.com/ferrite-rs/ferrite/tree/main/examples)** | Complete runnable examples |

## Quick Links

### Core Modules

- [`ferrite::embedded`](https://docs.rs/ferrite/latest/ferrite/embedded/) - Embedded database API
- [`ferrite::server`](https://docs.rs/ferrite/latest/ferrite/server/) - Server runtime
- [`ferrite::storage`](https://docs.rs/ferrite/latest/ferrite/storage/) - Storage engine
- [`ferrite::protocol`](https://docs.rs/ferrite/latest/ferrite/protocol/) - RESP protocol implementation
- [`ferrite::config`](https://docs.rs/ferrite/latest/ferrite/config/) - Configuration types

### Feature-Specific Modules

- [`ferrite::vector`](https://docs.rs/ferrite/latest/ferrite/vector/) - Vector search API
- [`ferrite::semantic`](https://docs.rs/ferrite/latest/ferrite/semantic/) - Semantic caching
- [`ferrite::temporal`](https://docs.rs/ferrite/latest/ferrite/temporal/) - Time-travel queries
- [`ferrite::cdc`](https://docs.rs/ferrite/latest/ferrite/cdc/) - Change data capture

### Error Handling

- [`ferrite::error`](https://docs.rs/ferrite/latest/ferrite/error/) - Error types

## Embedded Mode Quick Reference

```rust
use ferrite::embedded::Database;

// Open database with defaults
let db = Database::open("./data")?;

// Open an in-memory database
let db = Database::memory()?;

// Basic operations
db.set("key", "value")?;
let value: Option<String> = db.get("key")?;
db.del("key")?;

// Lists
db.lpush("list", &["a", "b", "c"])?;
let items: Vec<String> = db.lrange("list", 0, -1)?;

// Hashes
db.hset("hash", "field", "value")?;
let value: Option<String> = db.hget("hash", "field")?;

// Sets
db.sadd("set", &["a", "b", "c"])?;
let members: HashSet<String> = db.smembers("set")?;

// Sorted Sets
db.zadd("zset", &[("alice", 100.0), ("bob", 85.0)])?;
let top: Vec<(String, f64)> = db.zrange_withscores("zset", 0, 9)?;

// Transactions
let tx = db.transaction();
tx.set("key1", "value1")?;
tx.incr("counter")?;
tx.commit()?;

// Vector search
db.vector_create("index", 384, DistanceMetric::Cosine)?;
db.vector_add("index", "id", &embedding, &metadata)?;
let results = db.vector_search("index", &query, 10)?;

// Semantic cache
db.semantic_set("query", "response")?;
let cached = db.semantic_get("similar query", 0.85)?;

// Graceful shutdown
db.close()?;
```

## Building Documentation Locally

Generate and view documentation locally:

```bash
# Generate docs
cargo doc --open

# Generate docs with all features
cargo doc --all-features --open

# Generate docs including private items
cargo doc --document-private-items --open
```

## Feature Flags

Different features are available depending on which Cargo features are enabled:

| Feature | Modules Available | Description |
|---------|------------------|-------------|
| `io-uring` | `ferrite::io` | Linux io_uring support |
| `tui` | `ferrite-tui` | Terminal dashboard binary |
| `wasm` | `ferrite::wasm` | WebAssembly runtime |
| `onnx` | `ferrite::semantic` | ONNX embedding support |
| `otel` | `ferrite::metrics` | OpenTelemetry integration |
| `graph` | `ferrite::graph` | Graph database with Cypher-like queries |
| `document` | `ferrite::document` | JSON document store with indexing |
| `timeseries` | `ferrite::timeseries` | Time-series data with aggregations |
| `wasm` | `ferrite::wasm` | WebAssembly function execution |
| `cluster` | `ferrite::cluster` | Clustering and sharding support |
| `otel` | OpenTelemetry integration | Distributed tracing and metrics |

Enable features in `Cargo.toml`:

```toml
[dependencies]
ferrite = { version = "0.1", features = ["vector", "semantic", "temporal"] }
```

## Error Handling

Ferrite uses a unified error type for all operations:

```rust
use ferrite::{Database, Error, Result};

fn example() -> Result<()> {
    let db = Database::open("./data")?;

    match db.get("key") {
        Ok(Some(value)) => println!("Found: {}", value),
        Ok(None) => println!("Key not found"),
        Err(Error::ConnectionClosed) => eprintln!("Connection lost"),
        Err(Error::OutOfMemory) => eprintln!("OOM - consider increasing maxmemory"),
        Err(e) => eprintln!("Error: {}", e),
    }

    Ok(())
}
```

### Error Types

```rust
#[derive(Debug, thiserror::Error)]
pub enum Error {
    #[error("key not found: {0}")]
    KeyNotFound(String),

    #[error("wrong type for key")]
    WrongType,

    #[error("connection closed")]
    ConnectionClosed,

    #[error("out of memory")]
    OutOfMemory,

    #[error("command not allowed: {0}")]
    CommandNotAllowed(String),

    #[error("authentication required")]
    AuthRequired,

    #[error("invalid argument: {0}")]
    InvalidArgument(String),

    #[error("cluster error: {0}")]
    Cluster(String),

    #[error("I/O error: {0}")]
    Io(#[from] std::io::Error),
}
```

## Async vs Sync APIs

Ferrite provides both async and sync interfaces:

```rust
// Async API (default)
use ferrite::Database;

#[tokio::main]
async fn main() -> ferrite::Result<()> {
    let db = Database::open("./data").await?;
    db.set("key", "value").await?;
    let value = db.get("key").await?;
    Ok(())
}

// Sync API (enable 'sync' feature)
use ferrite::sync::Database;

fn main() -> ferrite::Result<()> {
    let db = Database::open("./data")?;
    db.set("key", "value")?;
    let value = db.get("key")?;
    Ok(())
}
```

## Connection Pooling

For high-throughput applications, use connection pooling:

```rust
use ferrite::{Pool, PoolConfig};

#[tokio::main]
async fn main() -> ferrite::Result<()> {
    let pool = Pool::builder()
        .max_connections(32)
        .min_connections(4)
        .connection_timeout(Duration::from_secs(5))
        .idle_timeout(Duration::from_secs(300))
        .build("redis://localhost:6379")
        .await?;

    // Get connection from pool
    let mut conn = pool.get().await?;
    conn.set("key", "value").await?;

    // Connection returned to pool when dropped
    Ok(())
}
```

## Pipeline Support

Batch multiple commands for efficiency:

```rust
use ferrite::Database;

async fn example(db: &Database) -> ferrite::Result<()> {
    let mut pipe = db.pipeline();

    pipe.set("key1", "value1");
    pipe.set("key2", "value2");
    pipe.incr("counter");
    pipe.get("key1");

    let results = pipe.execute().await?;

    // Results are in order
    assert_eq!(results[0], Response::Ok);
    assert_eq!(results[1], Response::Ok);
    assert_eq!(results[2], Response::Integer(1));
    assert_eq!(results[3], Response::Bulk(b"value1".to_vec()));

    Ok(())
}
```

## Type Conversions

Ferrite supports automatic type conversions:

```rust
use ferrite::Database;

async fn example(db: &Database) -> ferrite::Result<()> {
    // Automatic serialization
    db.set("count", 42).await?;
    db.set("price", 19.99).await?;
    db.set("active", true).await?;

    // Automatic deserialization
    let count: i64 = db.get("count").await?.unwrap();
    let price: f64 = db.get("price").await?.unwrap();
    let active: bool = db.get("active").await?.unwrap();

    // Custom types with serde
    #[derive(Serialize, Deserialize)]
    struct User {
        name: String,
        age: u32,
    }

    db.set_json("user:1", &User { name: "Alice".into(), age: 30 }).await?;
    let user: User = db.get_json("user:1").await?.unwrap();

    Ok(())
}
```

## Thread Safety

All Ferrite types are `Send + Sync`:

```rust
use ferrite::Database;
use std::sync::Arc;

#[tokio::main]
async fn main() -> ferrite::Result<()> {
    let db = Arc::new(Database::open("./data").await?);

    let handles: Vec<_> = (0..10).map(|i| {
        let db = Arc::clone(&db);
        tokio::spawn(async move {
            db.incr("counter").await
        })
    }).collect();

    for handle in handles {
        handle.await??;
    }

    let count: i64 = db.get("counter").await?.unwrap();
    assert_eq!(count, 10);

    Ok(())
}
```

## Performance Tips

### Use Pipelining

```rust
// Slow: 1000 round trips
for i in 0..1000 {
    db.set(format!("key:{}", i), i).await?;
}

// Fast: 1 round trip
let mut pipe = db.pipeline();
for i in 0..1000 {
    pipe.set(format!("key:{}", i), i);
}
pipe.execute().await?;
```

### Prefer MGET/MSET

```rust
// Slow
for key in &keys {
    let value = db.get(key).await?;
}

// Fast
let values = db.mget(&keys).await?;
```

### Use Connection Pooling

```rust
// For high-throughput, use a connection pool
let pool = Pool::builder()
    .max_connections(num_cpus::get() * 2)
    .build("redis://localhost")
    .await?;
```

## References

- [Embedded Mode Guide](/docs/guides/embedded-mode)
- [Configuration Reference](/docs/reference/configuration)
- [Error Reference](/docs/reference/errors)
- [Performance Tuning](/docs/operations/performance-tuning)
