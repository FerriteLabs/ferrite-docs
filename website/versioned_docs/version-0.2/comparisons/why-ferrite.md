---
sidebar_position: 0
title: Why Ferrite?
description: Understand what makes Ferrite unique compared to Redis, Dragonfly, Garnet, Valkey, and other key-value stores.
keywords: [ferrite, why ferrite, redis alternative, database comparison, rust database]
---

# Why Ferrite?

Ferrite is a **Rust-native, tiered-storage key-value store** designed as a drop-in Redis replacement with next-generation capabilities. Here's why teams choose Ferrite.

## The Problem

Modern applications need more than a simple cache:

- **AI/ML workloads** need vector search and semantic caching alongside traditional data
- **Cost pressure** demands tiered storage — not everything belongs in RAM
- **Polyglot persistence** leads to operational sprawl (Redis + Elasticsearch + Neo4j + InfluxDB + ...)
- **Memory safety** matters — C/C++ databases have entire classes of CVEs that Rust eliminates

## How Ferrite is Different

### 🧠 AI-Native from Day One

Ferrite is the only Redis-compatible database with built-in:

- **Vector search** (HNSW + IVF indexes) for similarity search
- **Semantic caching** to deduplicate LLM API calls and cut costs
- **RAG pipeline support** with document chunking and embedding
- **Agent memory** for AI agent state management

No modules to install. No sidecars. Just `VSIM.SEARCH`.

### 💾 Three-Tier Storage Architecture

Inspired by [Microsoft FASTER](https://microsoft.github.io/FASTER/), Ferrite's HybridLog provides:

| Tier | Medium | Latency | Cost |
|------|--------|---------|------|
| **Mutable** | Memory | ~1μs | $$$$ |
| **Read-Only** | Memory-mapped | ~10μs | $$$ |
| **Disk** | io_uring / SSD | ~100μs | $ |

Hot data stays in memory. Warm data is memory-mapped. Cold data lives on disk. Automatic promotion and eviction — no manual sharding.

### 🔌 WASM Plugin System

Extend Ferrite with custom logic without forking:

```
WASM.LOAD my_filter ./filters/deduplicate.wasm
WASM.CALL my_filter key1 key2
```

Write plugins in Rust, Go, AssemblyScript, or any language that compiles to WASM. Sandboxed execution with fuel metering.

### 📊 Multi-Model in One Binary

Replace multiple databases with one:

| Capability | Replaces | Ferrite Commands |
|-----------|----------|-----------------|
| Full-text search | Elasticsearch | `FT.SEARCH`, `FT.CREATE` |
| Graph queries | Neo4j | `GRAPH.QUERY`, `GRAPH.PATH` |
| Time-series | InfluxDB | `TS.ADD`, `TS.RANGE` |
| Document store | MongoDB | `DOC.INSERT`, `DOC.FIND` |
| Vector search | Pinecone | `VSIM.SEARCH`, `VSIM.ADD` |
| SQL-like queries | — | `QUERY "SELECT * FROM ..."` |

### 🦀 Built in Rust

- **Memory-safe** by default — no buffer overflows, use-after-free, or data races
- **Epoch-based concurrency** for lock-free read paths
- **Thread-per-core** architecture with per-thread io_uring instances
- **Zero-copy** RESP parsing for minimal allocation overhead

## At a Glance: Competitive Comparison

| Feature | Ferrite | Redis | Dragonfly | Garnet | Valkey |
|---------|:---:|:---:|:---:|:---:|:---:|
| **Language** | Rust 🦀 | C | C++ | C# | C |
| **Redis Protocol** | ✅ ~72% | ✅ 100% | ✅ ~95% | ✅ Partial | ✅ 100% |
| **Tiered Storage** | ✅ 3-tier | ❌ | ⚠️ SSD only | ✅ FASTER | ❌ |
| **Vector Search** | ✅ Native | ⚠️ Module | ❌ | ❌ | ⚠️ Module |
| **Semantic Cache** | ✅ Native | ❌ | ❌ | ❌ | ❌ |
| **Graph Model** | ✅ Native | ⚠️ Module | ❌ | ❌ | ⚠️ Module |
| **Time-Series** | ✅ Native | ⚠️ Module | ❌ | ❌ | ⚠️ Module |
| **Document Store** | ✅ Native | ⚠️ Module | ❌ | ❌ | ⚠️ Module |
| **WASM Plugins** | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Query Language** | ✅ FerriteQL | ❌ | ❌ | ❌ | ❌ |
| **Multi-Tenancy** | ✅ Native | ❌ | ❌ | ❌ | ❌ |
| **Embedded Mode** | ✅ | ❌ | ❌ | ✅ | ❌ |
| **License** | Apache 2.0 | RSALv2 | BSL 1.1 | MIT | BSD-3 |

## When to Choose Ferrite

✅ **Choose Ferrite when you need:**
- AI/ML workloads with vector search and semantic caching
- Cost-efficient tiered storage (not all data needs RAM)
- Multiple data models without running separate databases
- Custom server-side logic via WASM plugins
- An Apache 2.0 licensed Redis alternative
- Memory safety guarantees from Rust

⚠️ **Consider alternatives when you need:**
- 100% Redis command compatibility today (→ Valkey)
- Proven production track record with 10K+ deployments (→ Redis, Dragonfly)
- .NET ecosystem integration (→ Garnet)

## Detailed Comparisons

- [Ferrite vs Redis](./vs-redis.md) — the most comprehensive comparison
- [Ferrite vs Dragonfly](./vs-dragonfly.md) — multi-threaded C++ vs Rust
- [Ferrite vs KeyDB](./vs-keydb.md) — multi-threaded Redis fork
- [Ferrite vs Memcached](./vs-memcached.md) — pure caching comparison
- [Ferrite vs Dedicated Databases](./vs-dedicated-dbs.md) — vs Elasticsearch, Neo4j, InfluxDB

## Getting Started

```bash
# Install via Homebrew
brew tap ferritelabs/ferrite
brew install ferrite

# Or via Docker
docker run -p 6379:6379 ghcr.io/ferritelabs/ferrite:latest

# Connect with any Redis client
redis-cli -p 6379
127.0.0.1:6379> SET hello "world"
OK
127.0.0.1:6379> VSIM.CREATE myindex DIM 128 M 16
OK
```
