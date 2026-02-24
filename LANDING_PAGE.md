# Ferrite Landing Page Content
# For use at ferrite.dev — adapt to your site generator (Docusaurus, Astro, etc.)

## Hero Section

**Headline**: The Redis You Wish Existed

**Subheadline**: Drop-in Redis replacement with tiered storage, SQL queries, and AI-native features — all in one Rust binary.

**CTA Primary**: Get Started →
**CTA Secondary**: Try in Browser →

**Stats Bar**:
- 450K+ lines of Rust
- 5,500+ tests passing
- 100+ Redis commands
- Apache-2.0 license

---

## Three Pillars

### 1. The Speed of Memory
Redis-compatible RESP protocol with 100+ commands. Your existing Redis
clients work unchanged — ioredis, redis-py, Jedis, go-redis, and more.

### 2. The Capacity of Disk
Three-tier HybridLog engine: hot data in memory, warm data on mmap,
cold data on disk. Datasets 10x larger than RAM — no OOM, no sharding.

### 3. The Economics of Cloud
Automatic tiering to S3/GCS/Azure for archival data. ML-driven placement
reduces memory costs by 40-80% with <5% latency impact.

---

## Features Grid

| Feature | Description |
|---------|-------------|
| **Redis Compatible** | 100+ commands, RESP2/RESP3, works with all Redis clients |
| **Tiered Storage** | Memory → mmap → disk → S3 with ML-driven auto-placement |
| **FerriteQL** | SQL-like queries with JOINs across key-value data |
| **Vector Search** | HNSW/IVF indexing for semantic search and RAG |
| **Graph Database** | Cypher queries on graph data structures |
| **Time Series** | Ingestion, downsampling, retention policies |
| **Document Store** | JSONPath queries, aggregation pipelines |
| **Full-Text Search** | BM25 + semantic hybrid search with faceting |
| **Streaming/CDC** | Change data capture with Kafka/NATS connectors |
| **Distributed ACID** | 2PC + MVCC + Raft consensus across nodes |

---

## Comparison Table

|  | Ferrite | Redis | Dragonfly | Valkey |
|--|---------|-------|-----------|--------|
| License | Apache-2.0 | SSPL | BSL | BSD-3 |
| Disk Tiering | ✅ | ❌ | ❌ | ❌ |
| SQL Queries | ✅ FerriteQL | ❌ | ❌ | ❌ |
| Vector Search | ✅ Built-in | ⚠️ Module | ❌ | ⚠️ Module |
| Multi-model | ✅ 6 types | ⚠️ Modules | ❌ | ⚠️ Modules |
| GraphQL/REST | ✅ Native | ❌ | ❌ | ❌ |
| Distributed TX | ✅ ACID | ❌ | ❌ | ❌ |
| AI/RAG Native | ✅ | ❌ | ❌ | ❌ |
| Language | Rust | C | C++ | C |

---

## Quick Start

```bash
# Install (< 60 seconds)
curl -fsSL https://get.ferrite.dev | bash

# Or Docker
docker run -d -p 6379:6379 ferritelabs/ferrite

# Or Homebrew
brew install ferritelabs/tap/ferrite

# Connect with any Redis client
redis-cli PING    # → PONG
redis-cli SET hello ferrite
redis-cli GET hello    # → "ferrite"

# Try FerriteQL
redis-cli QUERY "SELECT * FROM user:* WHERE status = 'active' LIMIT 10"

# Try vector search
redis-cli VECTOR.CREATE docs DIMENSIONS 384 DISTANCE cosine
```

---

## Social Media Drafts

### Twitter/X Launch

🧲 Introducing Ferrite — a drop-in Redis replacement built in Rust

✅ 100+ Redis commands
✅ Tiered storage (10x dataset size, 40-80% cost savings)
✅ FerriteQL — SQL for your cache
✅ Built-in vector search, RAG, graph, time-series
✅ Apache-2.0 license

Try it: docker run ferritelabs/ferrite

### Hacker News Title

Show HN: Ferrite – Rust Redis replacement with tiered storage and SQL queries

### Reddit r/rust

[ANN] Ferrite v0.2.0 — A tiered-storage Redis replacement in Rust

We've been building Ferrite, a Redis-compatible key-value store in Rust that
adds disk tiering (memory→mmap→disk→S3), a SQL-like query language (FerriteQL),
and built-in vector search — all in one binary.

- 450K lines of Rust, 5,500+ tests
- Works with existing Redis clients (ioredis, redis-py, etc.)
- Apache-2.0 license, no CLA required
- Contributions welcome: 20 good-first-issues tagged

### LinkedIn

Excited to announce Ferrite v0.2.0 — a Redis-compatible database built in Rust
that solves the memory cost problem with tiered storage, adds SQL queries to
your cache layer, and includes built-in AI features (vector search, RAG,
semantic caching). Apache-2.0 licensed and looking for contributors.

---

## Blog Post Outlines

### Post 1: "Why We Built Ferrite"
- The Redis licensing problem (SSPL)
- The memory cost problem (everything in RAM)
- The multi-database problem (Redis + Elasticsearch + Pinecone)
- How Ferrite solves all three
- Architecture overview with diagrams

### Post 2: "How Ferrite's Tiered Storage Works"
- Microsoft FASTER paper inspiration
- HybridLog: mutable → read-only → disk regions
- Epoch-based reclamation for lock-free reads
- ML-driven data placement
- Benchmark: 10x dataset size, 40% cost savings

### Post 3: "FerriteQL: SQL for Redis"
- Why key-value stores need queries
- SELECT, WHERE, JOIN across key patterns
- Materialized views for dashboards
- Integration with GraphQL/REST gateway
- Performance: <2ms overhead for simple queries

### Post 4: "AI-Native Features in a Cache"
- Vector search without a separate database
- Semantic caching for LLM applications
- RAG pipeline in 5 commands
- Embedding generation with ONNX

### Post 5: "Ferrite Performance: Benchmarks and Analysis"
- Methodology (link to METHODOLOGY.md)
- Results vs Redis, Dragonfly, Valkey
- Where Ferrite wins (tiered storage scenarios)
- Where Ferrite loses (raw single-thread throughput)
- Honest assessment and roadmap
