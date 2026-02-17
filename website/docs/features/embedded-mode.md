---
title: Embedded Mode
sidebar_label: Embedded Mode
sidebar_position: 2
description: Use Ferrite as an in-process embedded database library — like SQLite but with Redis semantics. Ideal for mobile apps, edge computing, IoT devices, and desktop applications.
keywords: [ferrite embedded, embedded database, sqlite alternative, rust embedded db, edge computing, iot database, lite mode, in-process database]
maturity: experimental
---

:::caution Experimental Feature
This feature is **experimental** and subject to change. APIs, behavior, and performance characteristics may evolve significantly between releases. Use with caution in production environments.
:::

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Embedded Mode

Ferrite can run as an **in-process embedded database** — no server, no network, no separate process. Add it as a Rust dependency and call functions directly, just like SQLite. This makes it perfect for resource-constrained environments where running a full database server is impractical.

## What Is Embedded Mode?

In embedded mode, Ferrite runs inside your application process. All operations are direct function calls with **zero network overhead**, giving you Redis-compatible data structures and semantics without a TCP connection.

```text
┌─────────────────────────────────┐
│         Your Application        │
│                                 │
│   ┌─────────────────────────┐   │
│   │    Ferrite (embedded)   │   │
│   │  • In-memory storage    │   │
│   │  • Optional persistence │   │
│   │  • Thread-safe (Arc)    │   │
│   └─────────────────────────┘   │
│                                 │
└─────────────────────────────────┘
```

### Key Properties

| Property | Details |
|----------|---------|
| **Deployment** | In-process library, no separate server |
| **Thread safety** | `Send + Sync` — share via `Arc<Ferrite>` |
| **Memory** | Configurable limits with eviction policies |
| **Persistence** | Optional — in-memory-only or disk-backed |
| **Overhead** | Zero network overhead, direct function calls |
| **Compatibility** | Full Redis data structure semantics |

## Use Cases

### Mobile Apps
Embed Ferrite as a local cache with Redis-style data structures. Use hashes for user profiles, lists for activity feeds, and sets for tags — all without a network round-trip.

### Edge Computing
Deploy on edge nodes (Raspberry Pi, ARM gateways) with the `lite` feature for minimal binary size. Collect data locally and sync to the cloud periodically.

### IoT Devices
Run on constrained devices with as little as 2 MB of memory using `EdgeConfig::iot()`. Supports TTL-based cleanup, LZ4 compression, and LRU eviction to stay within tight memory budgets.

### Desktop Applications
Use Ferrite as a fast local cache or session store in desktop apps. The builder API makes it simple to configure persistence for data that should survive restarts.

### CLI Tools
Add persistent state to command-line tools without requiring users to run a background service. Enable persistence for configuration storage or caching.

## Getting Started

### Add Ferrite as a Dependency

```toml title="Cargo.toml"
[dependencies]
ferrite = "0.1"
anyhow = "1"
bytes = "1"
```

For resource-constrained environments, use the `lite` feature:

```toml title="Cargo.toml"
[dependencies]
ferrite = { version = "0.1", features = ["lite"] }
```

### Open a Database

<Tabs groupId="embedded-api">
  <TabItem value="builder" label="Builder API (Recommended)" default>

```rust
use ferrite::embedded::Ferrite;

fn main() -> anyhow::Result<()> {
    let db = Ferrite::builder()
        .max_memory("256mb")
        .persistence(false)
        .build()?;

    db.set("hello", "world")?;
    let value = db.get("hello")?;
    println!("Got: {:?}", value); // Got: Some(b"world")

    Ok(())
}
```

  </TabItem>
  <TabItem value="defaults" label="Quick Open">

```rust
use ferrite::embedded::Ferrite;

fn main() -> anyhow::Result<()> {
    // Open with defaults: 256 MiB, in-memory, no persistence
    let db = Ferrite::open()?;

    db.set("key", "value")?;
    Ok(())
}
```

  </TabItem>
  <TabItem value="persistent" label="With Persistence">

```rust
use ferrite::embedded::Ferrite;

fn main() -> anyhow::Result<()> {
    let db = Ferrite::builder()
        .max_memory("512mb")
        .persistence(true)
        .data_dir("./ferrite-data")
        .build()?;

    db.set("persistent-key", "survives restarts")?;
    db.save()?; // Flush to disk

    Ok(())
}
```

  </TabItem>
</Tabs>

## API Reference

### Database Operations

The `Ferrite` struct provides a Redis-compatible API for all core data types:

#### String Operations

```rust
// SET / GET / DEL
db.set("key", "value")?;
let val: Option<Bytes> = db.get("key")?;
let deleted: bool = db.del("key")?;
let exists: bool = db.exists("key");

// Counters
db.set("counter", "0")?;
let new_val: i64 = db.incr("counter")?;        // 1
let new_val: i64 = db.incr_by("counter", 10)?;  // 11
```

#### Hash Operations

```rust
// HSET / HGET / HGETALL
db.hset("user:1", "name", "Alice")?;
db.hset("user:1", "email", "alice@example.com")?;

let name: Option<Bytes> = db.hget("user:1", "name")?;
let fields: Vec<(Bytes, Bytes)> = db.hgetall("user:1")?;
```

#### List Operations

```rust
use bytes::Bytes;

// LPUSH / RPUSH / LPOP / LRANGE
db.rpush("queue", &[Bytes::from("task1"), Bytes::from("task2")])?;
let task: Option<Bytes> = db.lpop("queue")?;
let items: Vec<Bytes> = db.lrange("queue", 0, -1)?;
```

#### Set Operations

```rust
use bytes::Bytes;

// SADD / SMEMBERS / SISMEMBER
db.sadd("tags", &[Bytes::from("rust"), Bytes::from("database")])?;
let members: Vec<Bytes> = db.smembers("tags")?;
let is_member: bool = db.sismember("tags", "rust");
```

#### TTL & Expiration

```rust
db.set("session", "data")?;
db.expire("session", 3600)?;  // Expires in 1 hour
let ttl: i64 = db.ttl("session")?;
```

#### Utility

```rust
let count: usize = db.dbsize();
let keys: Vec<String> = db.keys("user:*")?;
let info: String = db.info();
```

### Transactions

Execute multiple operations atomically using the `Ferrite` API within a logical transaction scope:

```rust
use ferrite::embedded::Ferrite;
use std::sync::Arc;

let db = Arc::new(Ferrite::builder().max_memory("128mb").build()?);

// Operations within a scope are executed sequentially on the same store
db.set("account:1:balance", "1000")?;
db.set("account:2:balance", "500")?;
db.incr_by("account:1:balance", -200)?;
db.incr_by("account:2:balance", 200)?;
```

### Batch Operations

For bulk data loading, batch your operations to minimize lock contention:

```rust
use ferrite::embedded::Ferrite;
use std::sync::Arc;
use std::thread;

let db = Arc::new(Ferrite::builder().max_memory("256mb").build()?);
let mut handles = Vec::new();

for batch_id in 0..4 {
    let db = Arc::clone(&db);
    handles.push(thread::spawn(move || {
        for i in 0..1000 {
            let key = format!("batch:{}:{}", batch_id, i);
            db.set(key.as_str(), format!("{}", i * batch_id)).ok();
        }
    }));
}

for h in handles {
    h.join().unwrap();
}
println!("Loaded {} keys", db.dbsize()); // 4000
```

## Configuration for Resource-Constrained Environments

### EmbeddedConfig

The `EmbeddedConfig` struct controls memory, persistence, and eviction:

| Field | Default | Description |
|-------|---------|-------------|
| `max_memory` | 256 MiB | Maximum memory budget in bytes |
| `databases` | 16 | Number of logical databases (SELECT 0–15) |
| `persistence` | `false` | Enable on-disk persistence |
| `data_dir` | `None` | Directory for data files |
| `eviction_policy` | `NoEviction` | Policy when memory limit is reached |
| `compression` | `false` | LZ4 compression for large values |

### Eviction Policies

Ferrite supports Redis-compatible eviction policies:

| Policy | Behavior |
|--------|----------|
| `NoEviction` | Return errors when memory limit is reached |
| `AllKeysLru` | Evict least-recently-used keys from all keys |
| `AllKeysLfu` | Evict least-frequently-used keys from all keys |
| `AllKeysRandom` | Evict random keys from all keys |
| `VolatileLru` | Evict LRU keys that have an expiry set |
| `VolatileLfu` | Evict LFU keys that have an expiry set |
| `VolatileTtl` | Evict keys with the nearest TTL first |
| `VolatileRandom` | Evict random keys that have an expiry |

### Configuration Presets for Edge/IoT

The `EdgeConfig` provides ready-made presets for constrained environments:

<Tabs groupId="presets">
  <TabItem value="iot" label="IoT (2 MB)" default>

```rust
use ferrite_core::embedded::edge::EdgeConfig;

let config = EdgeConfig::iot();
// max_memory: 2 MB
// max_keys: 1,000
// compression: true (level 9, maximum)
// sync_interval: 60s
// max_value_size: 4 KB
// TTL enabled, check every 300s
```

  </TabItem>
  <TabItem value="minimal" label="Minimal (4 MB)">

```rust
use ferrite_core::embedded::edge::EdgeConfig;

let config = EdgeConfig::minimal();
// max_memory: 4 MB
// max_keys: 10,000
// compression: disabled
// no persistence, no sync
// max_value_size: 64 KB
```

  </TabItem>
  <TabItem value="mobile" label="Mobile (32 MB)">

```rust
use ferrite_core::embedded::edge::EdgeConfig;

let config = EdgeConfig::mobile();
// max_memory: 32 MB
// max_keys: 50,000
// compression: true (level 6)
// sync_interval: 10s (battery-friendly)
// persistence enabled
```

  </TabItem>
  <TabItem value="full" label="Full Edge (64 MB)">

```rust
use ferrite_core::embedded::edge::EdgeConfig;

let config = EdgeConfig::full();
// max_memory: 64 MB
// max_keys: 1,000,000
// compression: true (level 3)
// sync_interval: 5s
// persistence enabled
```

  </TabItem>
</Tabs>

## Memory Management and Limits

### How Memory Tracking Works

Ferrite tracks memory at the key-value entry level. Each `set` operation calculates the entry size (key length + value length) and updates the global memory counter atomically. When a key is overwritten, the old entry size is subtracted before the new size is added.

```rust
let db = Ferrite::builder()
    .max_memory("64mb")
    .eviction_policy(EvictionPolicy::AllKeysLru)
    .build()?;

// Memory is tracked per-operation
db.set("key1", "small value")?;        // ~16 bytes tracked
db.set("key2", "a".repeat(1024))?;     // ~1028 bytes tracked
```

### Compact Value Storage (EdgeStore)

The `EdgeStore` uses a three-tier value representation to minimize memory:

| Tier | Size | Storage | Allocation |
|------|------|---------|------------|
| **Inline** | ≤ 23 bytes | Stack-allocated array | Zero heap allocation |
| **Heap** | 24 bytes – 64 bytes | `Bytes` on heap | One allocation |
| **Compressed** | > 64 bytes | LZ4-compressed `Bytes` | One allocation, smaller |

This means short values like counters, flags, and small strings never touch the heap — critical for IoT devices where every allocation counts.

### Memory Reclamation

Call `compact()` on `LiteDatabase` to shrink the internal HashMap and reclaim allocator overhead:

```rust
use ferrite_core::embedded::lite::LiteDatabase;

let db = LiteDatabase::new(config)?;
// ... many inserts and deletes ...
let result = db.compact()?;
println!("Reclaimed {} bytes", result.bytes_reclaimed);
```

## Persistence Options

### In-Memory Only (Default)

```rust
let db = Ferrite::builder()
    .persistence(false)  // default
    .build()?;
// All data lost when process exits
```

### Disk-Backed

```rust
let db = Ferrite::builder()
    .persistence(true)
    .data_dir("./ferrite-data")
    .build()?;

// Explicit save
db.save()?;

// Background save (non-blocking)
db.bgsave()?;
```

### Persistence with LiteDatabase

```rust
use ferrite_core::embedded::lite::{LiteConfig, LiteDatabase};

let config = LiteConfig {
    enable_persistence: true,
    data_dir: "/var/lib/ferrite".to_string(),
    ..Default::default()
};

let db = LiteDatabase::new(config)?;
```

## Cloud Sync for Edge Deployments

The `LiteDatabase` supports periodic cloud synchronization for offline-first architectures:

```rust
use ferrite_core::embedded::lite::{LiteConfig, LiteDatabase};

let config = LiteConfig {
    enable_sync: true,
    sync_endpoint: Some("https://api.example.com/sync".to_string()),
    sync_interval_secs: 60,
    ..Default::default()
};

let db = LiteDatabase::new(config)?;

// Data is collected locally
db.set("sensor:temp", "22.5")?;
db.set("sensor:humidity", "45.2")?;

// Trigger manual sync
let result = db.sync_now()?;
println!("Synced {} keys ({} bytes)", result.keys_synced, result.bytes_transferred);
```

For advanced sync with conflict resolution, see the [SyncEngine](/docs/tutorials/embedded-iot#edge-caching-with-cloud-sync) in the IoT tutorial.

## Comparison with Embedded Alternatives

| Feature | **Ferrite** | SQLite | RocksDB | sled |
|---------|------------|--------|---------|------|
| **Data model** | Key-value + Redis types | Relational (SQL) | Key-value (bytes) | Key-value (bytes) |
| **In-memory mode** | ✅ First-class | ✅ `:memory:` | ❌ Disk-first | ❌ Disk-first |
| **Data structures** | Strings, Hashes, Lists, Sets, Sorted Sets | Tables, Indexes | Raw bytes | Raw bytes |
| **TTL / Expiration** | ✅ Built-in | ❌ Manual | ❌ Manual | ❌ Manual |
| **Compression** | ✅ LZ4 (automatic) | ❌ | ✅ Snappy/LZ4/Zstd | ✅ zstd |
| **Cloud sync** | ✅ Delta sync | ❌ | ❌ | ❌ |
| **Thread safety** | ✅ Lock-free reads | ✅ WAL mode | ✅ | ✅ |
| **Memory control** | ✅ Budgets + eviction | ❌ Page cache only | ✅ Block cache | ❌ |
| **Binary size** | ~2 MB (lite) | ~1.5 MB | ~10 MB | ~3 MB |
| **Language** | Rust | C | C++ | Rust |
| **Ideal for** | Caching, sessions, IoT | Structured queries | Write-heavy workloads | Simple persistence |

### When to Choose Ferrite Embedded

- You need **Redis-style data structures** (hashes, lists, sets) without a server
- Your workload is **read-heavy** and benefits from in-memory storage
- You need **TTL-based expiration** out of the box
- You're building an **edge/IoT** application that needs **cloud sync**
- You want **configurable memory budgets** with eviction policies

### When to Choose Alternatives

- **SQLite** — You need relational queries with SQL, joins, and complex aggregations
- **RocksDB** — You have write-heavy workloads with data larger than RAM
- **sled** — You need a simple embedded Rust key-value store with ACID transactions

## Examples

- [`embedded_basic.rs`](https://github.com/FerriteLabs/ferrite/blob/main/examples/embedded_basic.rs) — Strings, hashes, lists, sets, and utility operations
- [`embedded_iot.rs`](https://github.com/FerriteLabs/ferrite/blob/main/examples/embedded_iot.rs) — IoT sensor ingestion with sliding-window aggregations
- [`embedded_edge_cache.rs`](https://github.com/FerriteLabs/ferrite/blob/main/examples/embedded_edge_cache.rs) — Edge caching with periodic cloud sync

## Next Steps

- [Edge/IoT Deployment Tutorial](/docs/tutorials/embedded-iot) — Cross-compilation, Raspberry Pi setup, and real-world patterns
- [Server Mode](/docs/guides/server-mode) — When you outgrow embedded mode
- [Persistence Guide](/docs/guides/persistence) — Durability configuration in depth
