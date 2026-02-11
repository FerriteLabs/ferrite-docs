---
sidebar_position: 1
slug: /
title: Introduction to Ferrite
description: Ferrite is a high-performance, Redis-compatible key-value store with tiered storage, vector search, and semantic caching. Built in Rust for speed and reliability.
keywords: [ferrite, redis alternative, key-value store, vector search, rust database, tiered storage]
maturity: stable
---

# Introduction to Ferrite

[![Build Status](https://img.shields.io/github/actions/workflow/status/ferrite-rs/ferrite/ci.yml?branch=main&style=flat-square)](https://github.com/ferrite-rs/ferrite/actions)
[![Crates.io](https://img.shields.io/crates/v/ferrite?style=flat-square)](https://crates.io/crates/ferrite)
[![Documentation](https://img.shields.io/docsrs/ferrite?style=flat-square)](https://docs.rs/ferrite)
[![License](https://img.shields.io/badge/license-Apache%202.0-blue?style=flat-square)](https://github.com/ferrite-rs/ferrite/blob/main/LICENSE)
[![Rust Version](https://img.shields.io/badge/rust-1.88%2B-orange?style=flat-square)](https://www.rust-lang.org/)

Ferrite is a high-performance, tiered-storage key-value store designed as a drop-in Redis replacement. Built in Rust with epoch-based concurrency and io_uring-first persistence.

**The speed of memory, the capacity of disk, the economics of cloud.**

## What is Ferrite?

Ferrite combines the familiar Redis API with next-generation features designed for the AI/cloud-native era:

- **Redis Compatible**: Full RESP2/RESP3 wire protocol support. Works with any Redis client.
- **Tiered Storage**: Inspired by Microsoft FASTER - hot data in memory, warm data in mmap, cold data on disk.
- **Vector Search**: Native HNSW and IVF indexes for AI/ML workloads.
- **Semantic Caching**: Cache by meaning, not just exact keys - reduces LLM API costs by 40-60%.
- **Embedded Mode**: Use as a library like SQLite - no separate server process.
- **Time-Travel Queries**: Query data at any point in time for debugging and auditing.

## Quick Example

### Server Mode (Redis Compatible)

```bash
$ redis-cli -p 6379
127.0.0.1:6379> SET mykey "Hello, Ferrite!"
OK
127.0.0.1:6379> GET mykey
"Hello, Ferrite!"
```

### Embedded Mode (Library)

```rust
use ferrite::embedded::Database;

fn main() -> anyhow::Result<()> {
    let db = Database::open("./my_data")?;

    db.set("user:1", r#"{"name": "Alice"}"#)?;
    let user = db.get("user:1")?;

    Ok(())
}
```

## Why Ferrite?

| Feature | Redis | Dragonfly | Garnet | Ferrite |
|---------|-------|-----------|--------|---------|
| Multi-threaded | - | + | + | + |
| Tiered Storage | - | - | + | + |
| Vector Search | + | - | - | + |
| Semantic Caching | - | - | - | + |
| Time-Travel Queries | - | - | - | + |
| CRDT Replication | - | - | - | + |
| Embedded Mode | - | - | - | + |
| WASM Functions | - | - | - | + |

## Architecture Overview

Ferrite implements a three-tier storage architecture inspired by Microsoft FASTER:

```mermaid
flowchart TB
    subgraph Hot["🔥 Hot Tier (Memory)"]
        direction LR
        H1["In-place updates"]
        H2["Lock-free reads"]
        H3["Epoch-based reclamation"]
    end

    subgraph Warm["📦 Warm Tier (mmap)"]
        direction LR
        W1["Memory-mapped files"]
        W2["Zero-copy reads"]
        W3["Copy-on-write updates"]
    end

    subgraph Cold["❄️ Cold Tier (Disk/Cloud)"]
        direction LR
        C1["io_uring async I/O"]
        C2["S3/GCS/Azure storage"]
        C3["Compression & encryption"]
    end

    Hot -->|"Eviction"| Warm
    Warm -->|"Eviction"| Cold
    Cold -->|"Access"| Warm
    Warm -->|"Update"| Hot

    style Hot fill:#ff6b6b,stroke:#c0392b,color:#fff
    style Warm fill:#f39c12,stroke:#d68910,color:#fff
    style Cold fill:#3498db,stroke:#2980b9,color:#fff
```

## Next Steps

- [Installation Guide](/docs/getting-started/installation) - Get Ferrite up and running
- [Quick Start](/docs/getting-started/quick-start) - Your first commands
- [Configuration](/docs/getting-started/configuration) - Configure Ferrite for your needs
