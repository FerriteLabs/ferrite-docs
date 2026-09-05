---
sidebar_position: 2
title: Ferrite Roadmap
description: Planned features and improvements for Ferrite including performance enhancements, AI/ML features, enterprise capabilities, and ecosystem integrations.
keywords: [ferrite roadmap, upcoming features, ferrite future, redis alternative roadmap]
maturity: stable
---

# Roadmap

This roadmap outlines planned features and improvements for Ferrite. Items are organized by release version, with feature maturity tracked using our standard tiers: 🟢 Stable, 📊 Beta, 🔬 Experimental.

> **Last updated:** September 2026 · See the [Feature Maturity Matrix](/docs/reference/feature-matrix) and [Changelog](/docs/community/changelog) for shipped behavior.

## Release in Preparation: v0.5.0

The coordinated release branches target Ferrite v0.5.0. The capability list below describes the release candidate; maturity labels remain authoritative over roadmap headings, and unchecked roadmap items are not release commitments:

- 🟢 **Full Redis protocol compatibility** — 100+ commands, RESP2/RESP3
- 🟢 **Three-tier HybridLog storage** — Memory → mmap → Disk with auto-tiering
- 🟢 **Replication** — Primary/replica with PSYNC2 partial resync
- 🟢 **TLS encryption** — rustls-based TLS 1.2/1.3 with mTLS support
- 🟢 **ACL authentication** — Argon2 password hashing, fine-grained command/key ACLs
- 🟢 **Lua scripting** — Full Lua 5.4 via EVAL/EVALSHA
- 🟢 **Observability** — Prometheus metrics, structured logging, OpenTelemetry tracing
- 📊 **Vector search** — HNSW/IVF/Flat indexes with cosine/euclidean/dot-product distance
- 📊 **Full-text search** — BM25 scoring, schema management, auto-indexing
- 📊 **Semantic caching** — Embedding-based cache lookup with similarity threshold
- 📊 **Event streaming** — CDC engine, pipeline builder, consumer groups
- 🔬 **Graph database** — Property graph traversal
- 🔬 **WASM functions** — User-defined functions via WebAssembly
- 🔬 **Multi-tenancy** — Namespace isolation and resource quotas

## Historical v0.4.0 Planning Target — Depth & Polish

**Focus:** Promote 📊 Beta features to 🟢 Stable. Fix edge cases, improve error messages, expand test coverage.

### Performance
- [ ] Multi-threaded command processing with work-stealing scheduler
- [ ] io_uring batched submission for sequential writes (IORING_SETUP_SQPOLL)
- [ ] Memory-mapped warm tier read-ahead optimization
- [ ] Adaptive hash index for hot keys

### Stability Promotions (📊 → 🟢)
- [ ] **Vector search** — Stabilize VECTOR.CREATE/ADD/SEARCH API, add persistence
- [ ] **Full-text search** — Stabilize FT.CREATE/ADD/SEARCH, add index snapshotting
- [ ] **Semantic caching** — Stabilize SEMANTIC.SET/GET, add TTL-based eviction
- [ ] **CDC engine** — Stabilize subscription API, add delivery guarantees

### Replication & Clustering
- [ ] Redis Sentinel wire-protocol compatibility
- [ ] Improved cluster resharding with live migration
- [ ] Online backup improvements with point-in-time recovery
- [ ] Replica catch-up optimization for large datasets

### Developer Experience
- [ ] Improved error messages with suggestion hints
- [ ] `ferrite doctor` diagnostic command for common issues
- [ ] Shell completion generation for Bash/Zsh/Fish
- [ ] Interactive TUI dashboard improvements

## v0.5.0 Planning Themes — AI & Intelligence

**Focus:** Make AI/ML features production-grade. Built-in embeddings without external API dependencies.

### AI/ML Features
- [ ] Built-in embedding models (ONNX) — no external API needed
- [ ] RAG pipeline primitives with document chunking
- [ ] Batch vector operations for bulk ingestion
- [ ] Hybrid search (vector + keyword) with reciprocal rank fusion
- [ ] LLM response caching with semantic deduplication
- [ ] GraphRAG — graph-enhanced retrieval augmented generation

### Observability
- [ ] Anomaly detection alerting (automatic threshold learning)
- [ ] Query performance analyzer with slow query suggestions
- [ ] Cost-savings dashboard (vs Redis Cloud/ElastiCache)

### SDK Ecosystem
- [ ] Official Python SDK with AI extensions
- [ ] Official TypeScript SDK with AI extensions
- [ ] Go SDK with connection pooling
- [ ] Rust SDK (embedded mode)

## v0.6.0 — Enterprise

**Focus:** Multi-tenancy, compliance, and operational maturity for enterprise adoption.

### Enterprise Features
- [ ] Multi-tenancy GA — complete namespace isolation, quotas, metering
- [ ] Row-level security with attribute-based access control
- [ ] Audit logging with tamper-proof event chain
- [ ] Data residency controls (geographic data pinning)
- [ ] RBAC with LDAP/SAML/OIDC integration

### Compliance
- [ ] SOC 2 Type II audit preparation documentation
- [ ] GDPR data subject access request (DSAR) tooling
- [ ] Encryption at rest with customer-managed keys (BYOK)
- [ ] FIPS 140-2 validated cryptography option

### Operations
- [ ] Kubernetes Operator GA with auto-scaling
- [ ] Blue-green deployment support
- [ ] Cross-region active-active replication
- [ ] Automated capacity planning recommendations

## v1.0.0 — Stable Release

**Focus:** API stability guarantee, long-term support, comprehensive compatibility.

### Stability Guarantees
- [ ] Semantic versioning with API stability contract
- [ ] Long-term support (LTS) branch with 2-year security patches
- [ ] Full backward compatibility for wire protocol and configuration
- [ ] Migration tooling for all previous versions

### Compatibility
- [ ] Redis 7.4 command parity (target: 98%+ coverage)
- [ ] Comprehensive compatibility testing with top 50 Redis client libraries
- [ ] Drop-in replacement certification with popular frameworks
- [ ] Performance parity or better than Redis for all core commands

### Documentation
- [ ] Complete command reference with behavioral specifications
- [ ] Migration guides from Redis, Dragonfly, KeyDB, Garnet, Valkey
- [ ] Performance tuning guide with workload-specific recommendations
- [ ] Architecture decision records (ADRs) for all major decisions

### Ecosystem
- [ ] Official client libraries for 10+ languages
- [ ] Plugin marketplace with community modules
- [ ] Terraform provider for infrastructure-as-code
- [ ] GitHub Actions for CI/CD integration

## Future Considerations

These are ideas under evaluation for post-1.0 releases:

### Advanced Data Types
- Probabilistic data structures (Count-Min Sketch, Top-K, Bloom filters)
- JSON document query improvements (JSONPath, indexing)
- Graph query language enhancements (Cypher-like syntax)
- Time-series aggregation and downsampling

### Storage Innovation
- NVMe direct I/O with io_uring passthrough
- Learned indexes for adaptive data placement
- Compression (LZ4/Zstd) for cold tier data
- S3/GCS/Azure Blob cold storage tiering

### Distributed Systems
- Global transactions with 2PC
- Raft-based consensus for strong consistency mode
- Geographic partitioning with latency-aware routing
- Multi-cluster federation

### AI/ML Frontier
- Model serving integration (ONNX, TensorRT)
- Feature store with point-in-time lookups
- Online learning and model update pipelines
- Agent memory with episodic/semantic/procedural stores

## Contributing

Want to help with a roadmap item? Check the [contributing guide](/docs/community/contributing) and look for issues tagged with the corresponding milestone on [GitHub](https://github.com/ferritelabs/ferrite/milestones).

## Feedback

Have suggestions for the roadmap? We'd love to hear from you:
- Start a discussion on [GitHub Discussions](https://github.com/ferritelabs/ferrite/discussions)
- Join our [Discord community](https://discord.gg/ferrite)
- Open an issue with the `roadmap` label

## Release Schedule

We aim for regular, predictable releases:

| Release Type | Cadence | Purpose |
|---|---|---|
| **Patch** (0.x.y) | As needed | Bug fixes, security patches |
| **Minor** (0.x.0) | Every 2-3 months | New features, stability promotions |
| **Major** (x.0.0) | When API stability is achieved | API guarantees, LTS commitment |

All releases follow [semantic versioning](https://semver.org/).
