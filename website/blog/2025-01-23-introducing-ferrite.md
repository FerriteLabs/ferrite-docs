---
slug: introducing-ferrite
title: Introducing Ferrite - A Next-Generation Redis Alternative
authors: [ferrite-team]
tags: [announcement, release]
description: Announcing Ferrite, a high-performance Redis-compatible database with tiered storage, native vector search, and embedded mode support.
---

We're excited to announce **Ferrite**, a high-performance, tiered-storage key-value store designed as a drop-in Redis replacement.

<!-- truncate -->

## Why Ferrite?

Redis is an incredible piece of software that has shaped how we think about in-memory data stores. However, as application requirements have evolved—particularly with the rise of AI/ML workloads—we saw an opportunity to build something that addresses modern needs while maintaining full Redis compatibility.

Ferrite brings together:

- **Full Redis compatibility** - Works with any Redis client library
- **Tiered storage** - Hot data in memory, warm data in mmap, cold data on disk
- **Native vector search** - Built-in HNSW and IVF indexes for AI workloads
- **Embedded mode** - Use as a library like SQLite, no server needed
- **Time-travel queries** - Query data at any point in time

## Performance

We've obsessed over performance. Built in Rust with epoch-based concurrency and io_uring-first persistence, Ferrite delivers:

| Operation | Throughput | P99 Latency |
|-----------|------------|-------------|
| GET | 11.8M ops/sec | 125ns |
| SET | 2.6M ops/sec | 250ns |
| Vector Search (k=10) | 45K ops/sec | 85us |

## Getting Started

Getting started is simple:

```bash
# Clone and build
git clone https://github.com/ferrite-rs/ferrite.git
cd ferrite
cargo build --release

# Run the server
./target/release/ferrite

# Connect with redis-cli
redis-cli -p 6379
```

Or use the embedded mode directly in your Rust application:

```rust
use ferrite::embedded::Database;

let db = Database::open("./my_data")?;
db.set("hello", "world")?;
println!("{:?}", db.get("hello")?);
```

## What's Next

We're actively working on:

- Multi-threaded command processing
- Full Lua scripting support
- Kubernetes Operator GA
- Built-in embedding models

Check out our [roadmap](/docs/community/roadmap) for the full plan.

## Get Involved

Ferrite is open source under the Apache 2.0 license. We welcome contributions of all kinds:

- [GitHub Repository](https://github.com/ferrite-rs/ferrite)
- [Documentation](/docs)
- [Discord Community](https://discord.gg/ferrite)

Give us a star on GitHub, try it out, and let us know what you think!

---

*The speed of memory, the capacity of disk, the economics of cloud.*
