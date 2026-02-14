---
sidebar_position: 7
title: Embedded Mode
description: Use Ferrite as an in-process library without a network server. Covers configuration, API reference, edge/IoT deployment, binary size tuning, and performance characteristics.
keywords: [embedded, library, edge, iot, lite, in-process, sqlite-style, no-server]
maturity: beta
---

# Embedded Mode

Ferrite can be used as an **in-process library** -- like SQLite for key-value data -- without running a separate server process. All operations go through direct function calls with zero network overhead.

## Getting Started

Add Ferrite to your `Cargo.toml`:

```toml
[dependencies]
ferrite = "0.1"
bytes = "1"
anyhow = "1"
```

For the smallest possible binary, use the `lite` feature flag and disable defaults:

```toml
[dependencies]
ferrite = { version = "0.1", default-features = false, features = ["lite"] }
```

### Minimal Example

```rust
use ferrite::embedded::Ferrite;

fn main() -> anyhow::Result<()> {
    let db = Ferrite::builder()
        .max_memory("256mb")
        .persistence(false)
        .build()?;

    db.set("key", "value")?;
    let val = db.get("key")?;
    assert_eq!(val, Some(bytes::Bytes::from("value")));

    Ok(())
}
```

## Configuration

Use the builder API to configure the database:

```rust
use ferrite::embedded::{Ferrite, EvictionPolicy};

let db = Ferrite::builder()
    .max_memory("512mb")           // Human-readable memory limit
    .databases(4)                  // Number of logical databases
    .persistence(false)            // In-memory only
    .eviction_policy(EvictionPolicy::AllKeysLru)
    .compression(true)             // LZ4 compression for large values
    .build()?;
```

### Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `max_memory` | `&str` | `"256mb"` | Maximum memory budget. Accepts `"128mb"`, `"1gb"`, `"512kb"`, or raw byte counts. |
| `max_memory_bytes` | `usize` | 268435456 | Maximum memory in bytes (alternative to the string form). |
| `databases` | `u8` | 16 | Number of logical databases (Redis SELECT 0..N-1). |
| `persistence` | `bool` | `false` | Enable on-disk persistence. |
| `data_dir` | `PathBuf` | None | Directory for persistence files. Implies `persistence(true)`. |
| `eviction_policy` | `EvictionPolicy` | `NoEviction` | Policy when memory limit is reached. |
| `compression` | `bool` | `false` | Enable transparent LZ4 compression. |

### Eviction Policies

| Policy | Description |
|--------|-------------|
| `NoEviction` | Return errors when memory limit is reached. |
| `AllKeysLru` | Evict least-recently-used keys. |
| `AllKeysLfu` | Evict least-frequently-used keys. |
| `AllKeysRandom` | Evict random keys. |
| `VolatileLru` | Evict LRU keys that have a TTL set. |
| `VolatileLfu` | Evict LFU keys that have a TTL set. |
| `VolatileTtl` | Evict keys with the nearest expiry. |
| `VolatileRandom` | Evict random keys that have a TTL set. |

## API Reference

### String Operations

```rust
db.set("key", "value")?;                // SET
let val = db.get("key")?;               // GET -> Option<Bytes>
db.del("key")?;                         // DEL -> bool
db.exists("key");                       // EXISTS -> bool
db.incr("counter")?;                    // INCR -> i64
db.incr_by("counter", 10)?;            // INCRBY -> i64
db.expire("key", 3600)?;               // EXPIRE (seconds) -> bool
db.ttl("key")?;                         // TTL -> i64
```

### Hash Operations

```rust
db.hset("user:1", "name", "Alice")?;    // HSET -> bool (true if new)
let name = db.hget("user:1", "name")?;  // HGET -> Option<Bytes>
let all = db.hgetall("user:1")?;        // HGETALL -> Vec<(Bytes, Bytes)>
```

### List Operations

```rust
use bytes::Bytes;

db.lpush("queue", &[Bytes::from("a")])?;   // LPUSH -> i64 (new length)
db.rpush("queue", &[Bytes::from("b")])?;   // RPUSH -> i64
let item = db.lpop("queue")?;              // LPOP -> Option<Bytes>
let range = db.lrange("queue", 0, -1)?;    // LRANGE -> Vec<Bytes>
```

### Set Operations

```rust
use bytes::Bytes;

db.sadd("tags", &[Bytes::from("rust")])?;   // SADD -> i64 (added count)
let members = db.smembers("tags")?;          // SMEMBERS -> Vec<Bytes>
db.sismember("tags", "rust");                // SISMEMBER -> bool
```

### Utility Operations

```rust
let keys = db.keys("user:*")?;    // KEYS pattern -> Vec<Bytes>
let size = db.dbsize();           // DBSIZE -> usize
db.flushdb()?;                    // FLUSHDB
let info = db.info();             // INFO -> String
db.save()?;                       // Synchronous persist
db.bgsave()?;                     // Background persist
```

## Use Cases

### IoT / Edge Gateway

Ferrite is ideal for IoT gateways that need to buffer and aggregate sensor data before forwarding it to the cloud:

```rust
use bytes::Bytes;
use ferrite::embedded::Ferrite;

let db = Ferrite::builder()
    .max_memory("64mb")
    .persistence(false)
    .build()?;

// Ingest sensor readings
db.set("sensor:temp-001:latest", "22.5")?;
db.lpush("sensor:temp-001:history", &[Bytes::from("22.5")])?;

// Track active sensors
db.sadd("active_sensors", &[Bytes::from("temp-001")])?;

// Running aggregation in a hash
db.hset("sensor:temp-001:agg", "count", "1")?;
db.hset("sensor:temp-001:agg", "sum", "22.5")?;

// Automatic TTL-based cleanup for ephemeral alerts
db.set("alert:high-temp", "sensor:temp-001")?;
db.expire("alert:high-temp", 300)?; // 5-minute alert window
```

See the complete example: `cargo run --example embedded_iot`

### Edge Caching

Use Ferrite as a local cache in front of a remote service:

```rust
use ferrite::embedded::{Ferrite, EvictionPolicy};

let cache = Ferrite::builder()
    .max_memory("128mb")
    .eviction_policy(EvictionPolicy::AllKeysLru)
    .build()?;

// Cache-aside pattern
fn get_user(cache: &Ferrite, user_id: &str) -> anyhow::Result<String> {
    let key = format!("user:{}", user_id);

    if let Some(cached) = cache.get(key.as_str())? {
        return Ok(String::from_utf8_lossy(&cached).to_string());
    }

    // Miss -- fetch from upstream (simulated)
    let data = format!("{{\"id\":\"{}\",\"name\":\"User {}\"}}", user_id, user_id);
    cache.set(key.as_str(), data.as_str())?;
    cache.expire(key.as_str(), 3600)?; // 1-hour TTL
    Ok(data)
}
```

### Testing

Embedded Ferrite is excellent for unit tests that need a Redis-compatible store without external dependencies:

```rust
#[cfg(test)]
mod tests {
    use ferrite::embedded::Ferrite;

    fn test_db() -> Ferrite {
        Ferrite::builder()
            .max_memory("16mb")
            .persistence(false)
            .build()
            .unwrap()
    }

    #[test]
    fn test_user_creation() {
        let db = test_db();
        db.hset("user:1", "name", "Alice").unwrap();
        db.hset("user:1", "email", "alice@test.com").unwrap();

        let name = db.hget("user:1", "name").unwrap();
        assert_eq!(name, Some(bytes::Bytes::from("Alice")));
    }
}
```

### CLI Tools

Embed persistent storage in a command-line tool:

```rust
use ferrite::embedded::Ferrite;

let db = Ferrite::builder()
    .max_memory("32mb")
    .data_dir("~/.myapp/data")   // Automatically enables persistence
    .build()?;

// State persists across invocations
let run_count = db.incr("run_count")?;
println!("This tool has been run {} times", run_count);
```

## Binary Size Comparison

Building with different feature profiles affects the final binary size significantly. The numbers below are approximate and measured on x86-64 Linux with `--release` and `strip = true`:

| Profile | Feature Flags | Approximate Binary Size |
|---------|---------------|------------------------|
| **Lite** | `--no-default-features --features lite` | ~3 MB |
| **Default** | (default features) | ~12 MB |
| **All** | `--features all` | ~25 MB |

Tips for reducing binary size:

- Use `--no-default-features` and enable only what you need.
- Set `lto = true` and `codegen-units = 1` in your release profile.
- Set `panic = "abort"` and `strip = true`.
- Disable TLS, scripting, and cloud features if not needed.

## Performance: Embedded vs Server Mode

Direct function calls eliminate the TCP/RESP protocol overhead:

| Operation | Embedded (direct call) | Server (localhost TCP) | Speedup |
|-----------|----------------------|----------------------|---------|
| GET | ~80 ns | ~45 us | ~560x |
| SET | ~120 ns | ~48 us | ~400x |
| HGET | ~95 ns | ~46 us | ~480x |
| LPUSH | ~110 ns | ~47 us | ~430x |
| INCR | ~90 ns | ~46 us | ~510x |

**When to prefer server mode:**

- Multiple processes or machines need to share the same data.
- You need replication, clustering, or Pub/Sub.
- Clients use the Redis protocol from different languages.

**When to prefer embedded mode:**

- Single-process application (CLI, desktop, edge device).
- Lowest possible latency is critical.
- You want to avoid deploying and managing a separate server.

## Limitations and Caveats

1. **Single-process only.** The embedded database cannot be accessed from another process. If you need inter-process or network access, use server mode.

2. **No Pub/Sub or cluster.** Features that require a network layer (Pub/Sub, replication, cluster mode) are not available in embedded mode.

3. **Persistence is basic.** The current embedded API supports `save()` and `bgsave()` calls but does not implement AOF or continuous snapshotting. For durability-critical workloads, use the full server with AOF enabled.

4. **Memory tracking is approximate.** The `max_memory` budget counts the size of stored values but does not account for all internal overhead (hash table buckets, entry metadata, etc.). Plan for roughly 20% overhead on top of your raw data size.

5. **No Lua scripting in embedded mode.** The scripting runtime is part of the server command layer and is not exposed through the embedded API.

6. **Drop flushes best-effort.** When a `Ferrite` instance is dropped it attempts a final `save()`, but if the process crashes the data written since the last explicit save may be lost.

## Core Embedded Module

For lower-level access, Ferrite also exposes the core embedded module at `ferrite::core_embedded` (or `ferrite::embedded::core`). This provides:

- **`Database`** -- full Redis-compatible API with multi-database support.
- **`EdgeStore`** -- size-optimized store with inline values and LZ4 compression.
- **`LiteDatabase`** -- resource-limited store for edge deployments.
- **`Transaction`** -- atomic multi-operation transactions.
- **`SyncEngine`** -- delta-based sync for offline-first applications.

See the [API documentation](https://docs.rs/ferrite) for complete details.
