# Feature Maturity Matrix

> **Last updated**: v0.1.0
>
> This document classifies every Ferrite module into a maturity tier so users
> know exactly what is production-ready and what is experimental.

## Maturity Tiers

| Tier | Label | Meaning |
|------|-------|---------|
| 🟢 **1 — Stable** | `stable` | Production-ready. Fully tested, benchmarked, and supported. Breaking changes follow semver. |
| 🔵 **2 — Beta** | `beta` | Substantial implementation with good test coverage. API may change. Suitable for staging workloads. |
| 🟡 **3 — Alpha** | `alpha` | Functional code with unit tests. Not validated in production. API will change. |
| 🔴 **4 — Experimental** | `experimental` | Early-stage. Requires `--features experimental` to compile. Expect instability. |

## Promotion Criteria

To move **up** one tier a module must satisfy:

| Criterion | Experimental → Alpha | Alpha → Beta | Beta → Stable |
|-----------|---------------------|--------------|---------------|
| Unit test coverage | >50% | >70% | >80% |
| Integration tests | — | ≥3 scenarios | ≥10 scenarios |
| Fuzz testing | — | — | Parsers / I/O paths |
| Doc comments | Partial | All public items | All public items + examples |
| Benchmarks | — | Hot-path microbenchmarks | CI regression tracking |
| Unsafe audit | — | All blocks documented | All blocks documented + tested |
| Used in CI/dogfood | — | ✓ | ✓ |

---

## Module Classification

### 🟢 Tier 1 — Stable (Core)

These modules ship in every build and must be rock-solid.

| Module | Files | LOC | Tests | Description |
|--------|-------|-----|-------|-------------|
| `commands` | 43 | 49,805 | 219 | Redis command implementations (strings, lists, hashes, sets, sorted sets, keys, server, pub/sub, etc.) |
| `storage` | 15 | 7,113 | 83 | DashMap in-memory backend + HybridLog tiered backend |
| `persistence` | 7 | 6,519 | 46 | AOF, RDB snapshots, checkpoint/recovery |
| `protocol` | 4 | 1,363 | 41 | RESP2/RESP3 parser and encoder |
| `server` | 6 | 2,191 | 18 | TCP listener, connection handling, request routing |
| `config` | 1 | 1,563 | 20 | TOML configuration parsing and validation |
| `error` | 1 | 180 | 2 | Error type definitions (`FerriteError`) |
| `startup_errors` | 1 | 778 | 8 | Startup validation and diagnostics |
| `auth` | 3 | 2,891 | 39 | ACL, password hashing (Argon2), user management |
| `io` | 7 | 4,629 | 50 | I/O abstractions, buffer management, io_uring integration |
| `metrics` | 4 | 417 | 4 | Prometheus metrics exposition |
| `crypto` | 2 | 681 | 21 | Encryption at rest (ChaCha20-Poly1305) |
| `runtime` | 5 | 1,621 | 29 | Tokio runtime configuration and management |

**Total**: 99 files, 79,751 LOC, 580 tests

### 🔵 Tier 2 — Beta

Substantial implementations with good test coverage. Suitable for non-critical workloads.

| Module | Files | LOC | Tests | Description |
|--------|-------|-----|-------|-------------|
| `cluster` | 9 | 7,614 | 116 | Raft consensus, gossip protocol, hash slots, slot migration, failover |
| `replication` | 7 | 5,946 | 63 | Primary/replica, PSYNC2, replication backlog, geo-replication |
| `network` | 7 | 6,564 | 44 | Connection pooling, pipeline handling, backpressure |
| `embedded` | 10 | 6,696 | 86 | Library mode — use Ferrite without a server process |
| `tiering` | 13 | 6,854 | 105 | Hot/warm/cold data movement, eviction policies |
| `observability` | 12 | 6,750 | 101 | Distributed tracing, structured logging, health checks |
| `compatibility` | 7 | 3,765 | 33 | Redis protocol compatibility layer and migration helpers |
| `transaction` | 9 | 5,642 | 20 | MULTI/EXEC, WATCH, optimistic locking |

**Total**: 74 files, 49,831 LOC, 568 tests

### 🟡 Tier 3 — Alpha

Functional code with unit tests. Not yet validated in integration or production.

| Module | Files | LOC | Tests | Description |
|--------|-------|-----|-------|-------------|
| `search` | 10 | 7,897 | 115 | Full-text search with indexing and query language |
| `query` | 15 | 10,605 | 102 | Query engine, planner, and optimizer |
| `graph` | 9 | 6,943 | 100 | Graph data model and traversal operations |
| `document` | 8 | 7,621 | 48 | JSON document store with path queries |
| `timeseries` | 11 | 6,702 | 90 | Time-series data ingestion and downsampling |
| `vector` | 7 | 3,072 | 55 | Vector similarity search (HNSW) |
| `semantic` | 10 | 7,191 | 52 | Semantic caching for LLM responses |
| `streaming` | 11 | 7,107 | 32 | Event streaming and consumer groups |
| `cdc` | 7 | 4,569 | 36 | Change data capture for external systems |
| `crdt` | 8 | 3,287 | 60 | Conflict-free replicated data types |
| `temporal` | 4 | 2,407 | 32 | Time-travel queries and versioned data |
| `schema` | 9 | 4,775 | 54 | Schema validation and evolution |
| `wasm` | 5 | 3,463 | 56 | WASM user-defined functions |
| `plugin` | 9 | 5,129 | 109 | Plugin system and lifecycle management |
| `adaptive` | 8 | 4,196 | 38 | ML-based auto-tuning |
| `rag` | 9 | 6,548 | 51 | Retrieval-augmented generation pipelines |
| `routing` | 7 | 2,549 | 25 | Query routing and index selection |
| `cloud` | 10 | 3,969 | 50 | Cloud storage integration (S3/GCS/Azure) |
| `migration` | 9 | 4,950 | 50 | Data import/export and live migration |
| `sdk` | 8 | 5,199 | 61 | Client SDK generation and helpers |
| `autoindex` | 5 | 2,838 | 34 | Automatic index creation and management |
| `s3` | 6 | 1,997 | 21 | S3-compatible API layer |

**Total**: 185 files, 113,013 LOC, 1,171 tests

### 🔴 Tier 4 — Experimental

Requires `--features experimental`. Early-stage modules exploring future directions.

| Module | Files | LOC | Tests | Description |
|--------|-------|-----|-------|-------------|
| `graphrag` | 4 | 1,698 | 16 | Graph-enhanced RAG |
| `marketplace` | 4 | 895 | 18 | Plugin marketplace |
| `federation` | 4 | 1,229 | 14 | Multi-cluster federation |
| `studio` | 5 | 3,295 | 23 | Web-based management UI |
| `playground` | 4 | 2,981 | 14 | Interactive query playground |
| `edge` | 4 | 1,219 | 21 | Edge deployment mode |
| `insights` | 3 | 916 | 16 | Automated performance insights |
| `costoptimizer` | 5 | 1,628 | 12 | Storage cost optimization |
| `agent_memory` | 8 | 2,885 | 65 | AI agent memory backend |
| `conversation` | 6 | 1,993 | 32 | Conversation history store |
| `serverless` | 7 | 3,256 | 33 | Serverless deployment mode |
| `multicloud` | 9 | 2,825 | 37 | Multi-cloud abstraction layer |
| `proxy` | 4 | 1,546 | 38 | Redis proxy mode |
| `policy` | 5 | 1,511 | 16 | Data governance policies |
| `pipeline` | 4 | 973 | 20 | Data processing pipelines |
| `governance` | 8 | 4,017 | 46 | Compliance and governance framework |
| `inference` | 6 | 2,202 | 18 | ML model inference at the data layer |
| `k8s` | 7 | 4,308 | 27 | Kubernetes operator and integration |
| `triggers` | 4 | 2,358 | 14 | Event-driven triggers and webhooks |
| `audit` | 2 | 567 | 8 | Audit logging |
| `tenancy` | 6 | 2,588 | 22 | Multi-tenant isolation |
| `grpc` | 3 | 1,230 | 13 | gRPC API interface |
| `embedding` | 3 | 1,603 | 5 | Embedding generation (ONNX/API) |

**Total**: 113 files, 47,723 LOC, 569 tests

### Binaries (not tiered — build targets)

| Module | Files | LOC | Description |
|--------|-------|-----|-------------|
| `bin` | 13 | 6,134 | `ferrite`, `ferrite-cli`, `ferrite-migrate`, `ferrite-tui`, `ferrite-bench` |

---

## Summary

| Tier | Modules | Files | LOC | Tests |
|------|---------|-------|-----|-------|
| 🟢 Stable | 13 | 99 | 79,751 | 580 |
| 🔵 Beta | 8 | 74 | 49,831 | 568 |
| 🟡 Alpha | 22 | 185 | 113,013 | 1,171 |
| 🔴 Experimental | 23 | 113 | 47,723 | 569 |
| **Total** | **66** | **471** | **290,318** | **2,888** |

## Feature Flags

```toml
[features]
# Default build includes Stable + Beta modules
default = ["scripting", "tls", "crypto", "cli"]

# Opt-in for Alpha modules (search, graph, vector, etc.)
alpha = []

# Opt-in for Experimental modules (studio, playground, etc.)
experimental = []

# Include everything
all = ["default", "alpha", "experimental", "otel", "tui", "wasm", "onnx", "io-uring"]
```

## How to Use

```bash
# Production build — Stable + Beta only (recommended)
cargo build --release

# With alpha features (search, vector, graph, etc.)
cargo build --release --features alpha

# Everything including experimental
cargo build --release --features all
```
