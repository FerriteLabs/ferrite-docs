# Why We Built Ferrite: A Redis Alternative for the Tiered Storage Era

_Published by the FerriteLabs Team_

---

## The Problem: Redis Memory Costs at Scale

Redis is brilliant. It's fast, it's simple, and it's everywhere. We've built countless systems on top of it — caches, session stores, real-time analytics pipelines, leaderboards. For years, Redis was the obvious answer to "I need fast data."

But Redis has a fundamental constraint: **everything lives in RAM**.

When your dataset fits in a few gigabytes, that's fine. When it grows to hundreds of gigabytes or terabytes, the math stops working. At cloud prices, keeping 500 GB of data in memory costs thousands of dollars per month — and that's before replication. Teams end up making painful trade-offs:

- **Evict data aggressively**, losing the "I can always read it" guarantee.
- **Shard across dozens of instances**, adding operational complexity.
- **Move cold data to a separate store**, splitting your application logic across two systems.
- **Just pay the bill**, and hope finance doesn't notice.

We lived this pain at scale. We watched teams spend more on Redis memory than on their entire compute fleet. We saw engineers build increasingly complex tiering layers on top of Redis — bolting on SSDs, building custom eviction policies, maintaining read-through caches — all to work around a single limitation.

We asked ourselves: **what if the storage engine itself understood tiering?**

## The Solution: Tiered Storage with Redis Protocol Compatibility

Ferrite is a key-value store built from scratch in Rust. It speaks the Redis protocol (RESP2/RESP3), so your existing clients, libraries, and tools just work. But under the hood, it's a completely different engine.

### The HybridLog Storage Engine

Inspired by Microsoft's [FASTER](https://www.microsoft.com/en-us/research/project/faster/) research, Ferrite uses a three-tier HybridLog architecture:

```
┌─────────────────────┐
│   Mutable Region    │  ← Hot data in memory, direct read/write
│     (Memory)        │
├─────────────────────┤
│  Read-Only Region   │  ← Warm data, memory-mapped for fast reads
│     (mmap)          │
├─────────────────────┤
│    Disk Region      │  ← Cold data on SSD via io_uring
│   (io_uring)        │
└─────────────────────┘
        │
        ▼ (optional)
┌─────────────────────┐
│   Cloud Storage     │  ← Archive tier (S3-compatible)
│    (S3/MinIO)       │
└─────────────────────┘
```

Data flows naturally from hot to cold. Recent, frequently accessed keys live in memory — just as fast as Redis. As data ages or memory pressure increases, it migrates to memory-mapped files (still fast, near-zero cost) and then to disk. The key insight: **most workloads follow a power-law distribution.** A small percentage of keys receive the vast majority of requests. Ferrite keeps those keys in memory while the long tail sits comfortably on NVMe.

The result? You can store **terabytes of data** with only gigabytes of RAM, and hot-path latency stays in the sub-microsecond range.

### Drop-In Redis Compatibility

Ferrite implements the Redis protocol natively. That means:

- **ioredis**, **redis-py**, **Jedis**, **Lettuce** — they all connect without changes.
- **Redis CLI** works out of the box.
- Your existing application code doesn't need to change. Point it at Ferrite and go.

We're not building a "Redis-like" store with a custom protocol. We're building a Redis-compatible store with a better engine.

## What Makes Ferrite Different

There are other Redis alternatives out there. Here's what sets Ferrite apart:

### 🦀 Rust Safety, Zero Compromises

Ferrite is written entirely in Rust with strict safety practices. Every `unsafe` block has a documented `// SAFETY:` comment explaining why it's necessary. We use epoch-based reclamation instead of garbage collection, giving us deterministic memory management without stop-the-world pauses.

The result: no segfaults, no data races, no surprise GC pauses at 3 AM.

### ⚡ Thread-Per-Core Architecture

Instead of a single-threaded event loop (Redis) or a thread pool with shared state, Ferrite uses a thread-per-core model. Each core gets its own io_uring instance, its own event loop, and its own slice of the keyspace. Cross-core coordination happens through lock-free epoch-based synchronization.

This scales linearly with core count. More cores = more throughput, without lock contention.

### 🔌 Embedded Mode

Need an embedded key-value store in your Rust application? Ferrite can run as a library, embedded directly in your process — no network hop, no serialization overhead. Think of it as RocksDB ergonomics with Redis semantics.

```rust
use ferrite::EmbeddedStore;

let store = EmbeddedStore::open("./data")?;
store.set("user:1001", "Alice").await?;
let name = store.get("user:1001").await?;
```

### 🧩 Multi-Model Data

Beyond strings, hashes, lists, sets, and sorted sets, Ferrite supports:

- **Full-text search** (`FT.SEARCH`) — built-in indexing without a separate search cluster.
- **Graph queries** (`GRAPH.QUERY`) — Cypher-compatible graph operations on your data.
- **JSON documents** (`JSON.SET`, `JSON.GET`) — native JSON path queries.
- **Vector similarity** — nearest-neighbor search for AI/ML embedding workloads.
- **Time series** — optimized ingestion and range queries for metrics data.

One server, many data models. No more stitching together Redis + Elasticsearch + Neo4j + a vector database.

### 🧬 WASM Plugin System

Extend Ferrite with WebAssembly plugins. Write custom commands, data transformations, or business logic in any language that compiles to WASM, and deploy them without restarting the server.

```bash
FERRITE.PLUGIN LOAD ./my_plugin.wasm
```

Plugins run in a sandboxed environment with controlled access to the keyspace. They can't crash the server or access memory they shouldn't.

### 📡 Lua and JavaScript Scripting

For simpler extensions, Ferrite supports server-side scripting with Lua (Redis-compatible `EVAL`) and JavaScript. Run atomic operations, complex transactions, and custom logic without round trips.

## Performance: The Numbers

We benchmark obsessively. Here are results from our internal benchmarks on a 16-core AMD EPYC with NVMe storage:

| Operation | Throughput | P99 Latency |
|-----------|-----------|-------------|
| GET (hot) | **11.8M ops/sec** | **< 250ns** |
| SET | **8.2M ops/sec** | < 500ns |
| GET (warm/mmap) | 4.1M ops/sec | < 2μs |
| GET (cold/disk) | 850K ops/sec | < 50μs |

The hot-path numbers are competitive with Redis. The difference is what happens when your data doesn't fit in memory — Redis returns `nil` or evicts something important. Ferrite transparently fetches from the next tier.

> **Note:** These are internal benchmarks. We're building [ferrite-bench](https://github.com/FerriteLabs/ferrite-bench) as an independent, reproducible benchmark suite. We invite the community to verify and challenge these numbers.

## Who Is Ferrite For?

Ferrite is a good fit if you:

- **Run Redis at scale** and your memory costs are growing faster than your budget.
- **Need a cache with persistence guarantees** — not just "best effort" with RDB/AOF.
- **Want multi-model capabilities** without operating separate databases.
- **Build latency-sensitive systems** where GC pauses or single-threaded bottlenecks are unacceptable.
- **Need an embedded store** for Rust applications with Redis-like ergonomics.

Ferrite is **not** trying to replace every database. If your dataset fits comfortably in memory and Redis works well for you, keep using Redis. We built Ferrite for the cases where Redis stops being enough.

## The Road Ahead

Ferrite is under active development. Here's what we're working on:

- **Cluster mode** — automatic sharding and failover across nodes.
- **Cloud-native tiering** — seamless S3/GCS/Azure Blob as the coldest tier.
- **Enhanced replication** — multi-datacenter active-active replication.
- **Observability** — built-in Prometheus metrics, Grafana dashboards, and distributed tracing.
- **Ecosystem** — VS Code extension, JetBrains plugin, Homebrew tap, Helm charts.

## Try Ferrite Today

```bash
# Install from source
git clone https://github.com/FerriteLabs/ferrite.git
cd ferrite
cargo build --release
cargo run --release

# Or use Docker
docker run -p 6379:6379 ferritelabs/ferrite:latest

# Connect with any Redis client
redis-cli -p 6379
> SET hello "world"
OK
> GET hello
"world"
```

## Get Involved

Ferrite is open source under the MIT License. We're building this in the open and we want your help:

- ⭐ **[Star the repo](https://github.com/FerriteLabs/ferrite)** — it helps others discover the project.
- 🐛 **[Report bugs](https://github.com/FerriteLabs/ferrite/issues)** — every issue report makes Ferrite better.
- 💬 **[Join the discussion](https://github.com/FerriteLabs/ferrite/discussions)** — share your use case, ask questions, suggest features.
- 🔧 **[Contribute code](https://github.com/FerriteLabs/ferrite/blob/main/CONTRIBUTING.md)** — check out `good first issue` labels to get started.
- 📖 **[Improve the docs](https://github.com/FerriteLabs/ferrite-docs)** — clear documentation is just as valuable as code.

We believe the future of caching and real-time data is tiered, multi-model, and safe. Come build it with us.

---

_Ferrite is built by [FerriteLabs](https://github.com/FerriteLabs). Follow us for updates._
