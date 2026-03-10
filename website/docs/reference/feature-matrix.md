---
sidebar_position: 10
title: Feature Maturity Matrix
description: Complete feature status for Ferrite — stability tier, Redis compatibility, and version availability for every feature.
keywords: [ferrite features, feature matrix, redis compatibility, ferrite status, production ready]
maturity: stable
---

# Feature Maturity Matrix

This page provides the definitive reference for Ferrite feature maturity. Use it to determine which features are safe for production use, which are in active development, and which are experimental previews.

## Maturity Tiers

| Tier | Badge | Meaning | SLA |
|------|-------|---------|-----|
| **Stable** | 🟢 | Production-ready. API will not change without deprecation notice. | Bug fixes within 48 hours for critical issues |
| **Beta** | 📊 | Feature-complete but may have edge cases. API may change between minor releases. | Best-effort fixes |
| **Experimental** | 🔬 | Preview feature. May be incomplete, change significantly, or be removed. | No guarantees |

:::tip Production Guidance
Only features marked **🟢 Stable** should be used in production workloads. Beta features are suitable for staging and non-critical production. Experimental features are for evaluation only.
:::

## Core Data Structures

| Feature | Maturity | Redis Compat | Since | Notes |
|---------|----------|-------------|-------|-------|
| Strings (GET, SET, INCR, APPEND, etc.) | 🟢 Stable | 100% | v0.1 | Full Redis string semantics |
| Lists (LPUSH, RPOP, LRANGE, etc.) | 🟢 Stable | 100% | v0.1 | Including LPOS, LMOVE |
| Hashes (HSET, HGET, HINCRBY, HSCAN) | 🟢 Stable | 100% | v0.1 | |
| Sets (SADD, SINTER, SUNION, SDIFF) | 🟢 Stable | 100% | v0.1 | Including STORE variants |
| Sorted Sets (ZADD, ZRANGE, ZUNION) | 🟢 Stable | 98% | v0.1 | Full BTree-based implementation |
| Streams (XADD, XREAD, XRANGE) | 🟢 Stable | 95% | v0.2 | Consumer groups, ACK, PENDING |
| HyperLogLog (PFADD, PFCOUNT, PFMERGE) | 🟢 Stable | 100% | v0.2 | Real probabilistic implementation |
| Bitmaps (BITFIELD, BITOP, BITCOUNT) | 🟢 Stable | 98% | v0.2 | Including BITFIELD_RO |
| Geospatial (GEOADD, GEOSEARCH) | 🟢 Stable | 95% | v0.2 | Real geohashing |

## Server & Protocol

| Feature | Maturity | Redis Compat | Since | Notes |
|---------|----------|-------------|-------|-------|
| RESP2 protocol | 🟢 Stable | 100% | v0.1 | Streaming parser with DoS protection |
| RESP3 protocol | 🟢 Stable | 95% | v0.2 | HELLO handshake, typed responses |
| Inline commands | 🟢 Stable | 100% | v0.1 | Telnet compatibility |
| Pipelining | 🟢 Stable | 100% | v0.1 | |
| Transactions (MULTI/EXEC) | 🟢 Stable | 100% | v0.1 | WATCH, DISCARD |
| Pub/Sub | 🟢 Stable | 100% | v0.1 | SUBSCRIBE, PSUBSCRIBE, PUBLISH |
| Lua scripting (EVAL) | 🟢 Stable | 90% | v0.2 | Lua 5.4 via mlua, sandbox |
| Blocking commands (BLPOP, etc.) | 🟢 Stable | 95% | v0.2 | Async/await based |
| CLIENT commands | 🟢 Stable | 90% | v0.3 | ID, LIST, KILL, PAUSE, SETNAME, INFO |
| CONFIG commands | 📊 Beta | 80% | v0.2 | GET, SET, REWRITE |
| LATENCY commands | 🟢 Stable | 90% | v0.3 | LATEST, HISTORY, GRAPH, RESET |
| HTTP REST API | 📊 Beta | N/A | v0.2 | JSON-based key-value API |
| gRPC interface | 📊 Beta | N/A | v0.3 | Typed RPC with streaming |
| Memcached protocol | 🔬 Experimental | N/A | v0.3 | Wire protocol adapter |
| AMQP adapter | 🔬 Experimental | N/A | v0.3 | Message queue compatibility |

## Storage Engine

| Feature | Maturity | Since | Notes |
|---------|----------|-------|-------|
| HybridLog (3-tier) | 🟢 Stable | v0.1 | Memory → mmap → Disk |
| Auto-tiering | 🟢 Stable | v0.1 | Configurable threshold (default 80%) |
| Epoch-based reclamation | 🟢 Stable | v0.1 | Lock-free readers via crossbeam-epoch |
| Memory-mapped warm tier | 🟢 Stable | v0.1 | Zero-copy reads via memmap2 |
| io_uring cold tier | 🟢 Stable | v0.2 | Linux 5.11+, feature-gated |
| AOF persistence | 🟢 Stable | v0.1 | always/everysec/no fsync policies |
| Checkpoint/RDB persistence | 🟢 Stable | v0.1 | Background save with compression |
| Memory backpressure | 🟢 Stable | v0.2 | Adaptive write rejection |
| Compaction | 📊 Beta | v0.2 | Garbage collection for disk tier |

## Security & Auth

| Feature | Maturity | Redis Compat | Since | Notes |
|---------|----------|-------------|-------|-------|
| Password authentication | 🟢 Stable | 100% | v0.1 | Argon2 hashing |
| ACL system (SETUSER, etc.) | 🟢 Stable | 90% | v0.2 | Command + key + channel ACLs |
| TLS 1.2/1.3 | 🟢 Stable | 100% | v0.1 | rustls, mTLS support |
| Encryption at rest | 📊 Beta | N/A | v0.3 | ChaCha20-Poly1305 |
| Audit logging | 📊 Beta | N/A | v0.3 | Tamper-evident event chain |

## Replication & Clustering

| Feature | Maturity | Redis Compat | Since | Notes |
|---------|----------|-------------|-------|-------|
| Primary/replica replication | 🟢 Stable | 90% | v0.1 | PSYNC2 partial resync |
| Failover handling | 🟢 Stable | 85% | v0.2 | Health monitoring, stale detection |
| Cluster mode | 📊 Beta | 75% | v0.2 | Slot-based sharding |
| Geo-replication | 📊 Beta | N/A | v0.3 | Cross-region with ordering |
| Active-active (CRDT) | 🔬 Experimental | N/A | v0.3 | Multi-master via vector clocks |

## AI & Machine Learning

| Feature | Maturity | Since | Notes |
|---------|----------|-------|-------|
| Vector search (HNSW) | 📊 Beta | v0.2 | Cosine, Euclidean, dot-product |
| Vector search (Flat/IVF) | 📊 Beta | v0.3 | Exact and approximate search |
| Semantic caching | 📊 Beta | v0.2 | Embedding-based cache lookup |
| Embedding generation (ONNX) | 🔬 Experimental | v0.3 | Local model inference |
| RAG pipeline | 🔬 Experimental | v0.3 | Document chunking and retrieval |
| Hybrid search (vector + keyword) | 🔬 Experimental | v0.3 | Reciprocal rank fusion |
| GraphRAG | 🔬 Experimental | v0.3 | Graph-enhanced retrieval |
| Agent memory | 🔬 Experimental | v0.3 | Episodic/semantic/procedural |
| LLM caching | 🔬 Experimental | v0.3 | Response deduplication |

## Full-Text Search

| Feature | Maturity | Since | Notes |
|---------|----------|-------|-------|
| BM25 scoring | 📊 Beta | v0.2 | Configurable k1/b parameters |
| Index management | 📊 Beta | v0.2 | Create, delete, list indexes |
| Schema definition | 📊 Beta | v0.2 | Typed fields with validation |
| Auto-indexing | 📊 Beta | v0.3 | Index on write |
| Query parsing | 📊 Beta | v0.3 | Boolean, phrase, fuzzy, range |

## Event Streaming

| Feature | Maturity | Since | Notes |
|---------|----------|-------|-------|
| CDC engine | 📊 Beta | v0.3 | Pattern-based subscription |
| Change event capture | 📊 Beta | v0.3 | SET, DEL, EXPIRE operations |
| Pipeline builder | 📊 Beta | v0.3 | Source → filter → map → sink |
| Consumer groups | 📊 Beta | v0.3 | With acknowledgment |
| Kafka protocol adapter | 🔬 Experimental | v0.3 | Producer/consumer compatibility |

## Extended Data Models

| Feature | Maturity | Since | Notes |
|---------|----------|-------|-------|
| JSON document store | 🔬 Experimental | v0.3 | Nested queries, JSONPath |
| Graph database | 🔬 Experimental | v0.3 | Property graph traversal |
| Time-series | 🔬 Experimental | v0.3 | Ingestion and downsampling |
| CRDTs | 🔬 Experimental | v0.3 | G-Counter, PN-Counter, OR-Set, LWW-Register |

## Extensibility

| Feature | Maturity | Since | Notes |
|---------|----------|-------|-------|
| WASM user-defined functions | 🔬 Experimental | v0.3 | wasmtime runtime with fuel metering |
| Lua scripting | 🟢 Stable | v0.2 | Lua 5.4 sandbox |
| Plugin SDK | 📊 Beta | v0.3 | CRDT types, custom commands |
| Plugin marketplace | 🔬 Experimental | v0.3 | Discovery and installation |

## Observability

| Feature | Maturity | Since | Notes |
|---------|----------|-------|-------|
| Prometheus metrics | 🟢 Stable | v0.1 | 60+ metrics, /metrics endpoint |
| Structured logging (tracing) | 🟢 Stable | v0.1 | JSON and text formats |
| OpenTelemetry tracing | 📊 Beta | v0.2 | OTLP exporter, feature-gated |
| Anomaly detection | 🔬 Experimental | v0.3 | Automatic threshold learning |

## Deployment & Operations

| Feature | Maturity | Since | Notes |
|---------|----------|-------|-------|
| Docker image | 🟢 Stable | v0.1 | Multi-arch (amd64/arm64), Alpine-based |
| Helm chart | 🟢 Stable | v0.2 | 17 templates, HA values, RBAC |
| Homebrew formula | 🟢 Stable | v0.2 | macOS + Linux |
| Grafana dashboards | 🟢 Stable | v0.2 | 6 dashboards, 60+ panels |
| Prometheus alert rules | 🟢 Stable | v0.2 | 25+ rules with runbooks |
| GitOps (ArgoCD/Flux/Kustomize) | 🟢 Stable | v0.3 | Production-ready configs |
| Backup & restore scripts | 🟢 Stable | v0.2 | S3 support, PITR |
| Kubernetes sidecar | 📊 Beta | v0.3 | Admission webhook injection |
| Embedded mode | 📊 Beta | v0.3 | Library usage (SQLite-like) |
| Edge/WASM deployment | 🔬 Experimental | v0.3 | WebAssembly runtime |

## IDE & Developer Tools

| Feature | Maturity | Since | Notes |
|---------|----------|-------|-------|
| VS Code extension | 🟢 Stable | v0.2 | 18 commands, syntax highlighting, key browser |
| JetBrains plugin | 🟢 Stable | v0.2 | 130+ command validation, live templates |
| ferrite-cli | 🟢 Stable | v0.1 | Interactive CLI with completions |
| TUI dashboard | 📊 Beta | v0.3 | Terminal UI with ratatui |
| Studio web UI | 🔬 Experimental | v0.3 | Browser-based management |

## Summary Statistics

| Tier | Count | Percentage |
|------|-------|------------|
| 🟢 Stable | 52 | 55% |
| 📊 Beta | 28 | 30% |
| 🔬 Experimental | 14 | 15% |

:::info Feature Requests
Missing a feature you need? [Open a feature request](https://github.com/ferritelabs/ferrite/issues/new?template=feature_request.md) on GitHub or vote on existing requests.
:::
