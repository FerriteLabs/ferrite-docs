---
sidebar_position: 4
description: Complete changelog documenting all notable changes, releases, and version history for Ferrite.
maturity: stable
---

# Changelog

All notable changes to Ferrite are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- SDK generator for custom client libraries
- Interactive playground with tutorials
- Kubernetes operator v2 with StatefulSet support

### Changed
- Improved HNSW index build performance by 40%
- Reduced memory overhead for small values

### Fixed
- Race condition in cluster slot migration
- Memory leak in Pub/Sub pattern subscriptions

---

## [1.0.0] - 2026-01-15

### Added

#### Core Features
- **HybridLog Storage Engine**: Three-tier architecture (hot/warm/cold) with automatic data movement
- **Epoch-Based Reclamation**: Lock-free memory management for high concurrency
- **io_uring Integration**: High-performance async I/O on Linux 5.11+
- **RESP2/RESP3 Protocol**: Full Redis protocol compatibility

#### Data Structures
- Strings with all Redis string commands
- Lists (LPUSH, RPUSH, LPOP, RPOP, LRANGE, etc.)
- Hashes (HSET, HGET, HGETALL, HINCRBY, etc.)
- Sets (SADD, SREM, SMEMBERS, SINTER, SUNION, etc.)
- Sorted Sets (ZADD, ZRANGE, ZRANK, etc.)
- Streams (XADD, XREAD, XREADGROUP, etc.)
- HyperLogLog (PFADD, PFCOUNT, PFMERGE)
- Geo (GEOADD, GEODIST, GEORADIUS, etc.)
- Bitmaps (SETBIT, GETBIT, BITCOUNT, etc.)

#### Extended Features
- **Vector Search**: HNSW and IVF indexes, cosine/L2/dot-product distance
- **Document Store**: MongoDB-compatible JSON documents with indexes
- **Graph Database**: Property graphs with Cypher-like query language
- **Time Series**: Automatic downsampling and retention policies
- **Full-Text Search**: BM25 scoring, faceted search, highlighting
- **CRDTs**: G-Counter, PN-Counter, OR-Set, LWW-Register
- **FerriteQL**: SQL-like query language for complex queries

#### Event-Driven
- **Pub/Sub**: Channel and pattern subscriptions
- **Streams**: Consumer groups with acknowledgment
- **CDC**: Change Data Capture with external sinks
- **Triggers**: Programmable event-driven actions

#### Extensibility
- **Lua Scripting**: EVAL/EVALSHA with Redis-compatible API
- **WASM Functions**: WebAssembly user-defined functions
- **Plugin System**: Hot-loadable plugins with sandboxing

#### Clustering
- **Redis Cluster**: Compatible cluster protocol
- **Raft Consensus**: Automatic leader election and failover
- **CRDT Replication**: Multi-master with conflict resolution

#### Persistence
- **AOF**: Append-only file with configurable fsync
- **Checkpoints**: Fork-less snapshots
- **Tiered Storage**: Automatic hot/warm/cold tiering

#### Observability
- **Prometheus Metrics**: /metrics endpoint
- **Distributed Tracing**: OpenTelemetry integration
- **Query Profiler**: Slow query analysis

#### Security
- **Authentication**: Password and ACL support
- **TLS/SSL**: Encrypted connections
- **Audit Logging**: Security event logging

### Changed
- Initial release, no changes from previous versions

### Deprecated
- Nothing deprecated in initial release

### Removed
- Nothing removed in initial release

### Fixed
- Initial release, no fixes

### Security
- Initial security review completed
- No known vulnerabilities

---

## [0.9.0] - 2025-12-01 (Beta)

### Added
- WASM function execution environment
- Graph database with traversal queries
- Multi-tenancy with resource quotas
- SDK generator tool

### Changed
- Improved vector search accuracy with optimized HNSW parameters
- Reduced checkpoint time by 60%

### Fixed
- Connection leak in cluster mode
- Incorrect ZRANGEBYSCORE results with inf bounds

---

## [0.8.0] - 2025-10-15 (Beta)

### Added
- Semantic caching with embedding similarity
- RAG pipeline for document ingestion
- Time series automatic downsampling
- CDC sinks for Kafka, Kinesis, S3

### Changed
- Migrated to Rust 2024 edition
- Updated tokio to 1.40

### Fixed
- Memory fragmentation under heavy write load
- Cluster rebalancing race condition

---

## [0.7.0] - 2025-08-01 (Alpha)

### Added
- Document store with aggregation pipeline
- Full-text search with BM25
- Programmable triggers
- FerriteQL query language

### Changed
- Redesigned persistence layer for better durability

### Fixed
- Data loss during checkpoint with concurrent writes

---

## [0.6.0] - 2025-06-01 (Alpha)

### Added
- Vector search with HNSW index
- Automatic embedding generation
- Basic clustering support

### Changed
- Improved memory efficiency by 30%

---

## [0.5.0] - 2025-04-01 (Alpha)

### Added
- RESP3 protocol support
- Pub/Sub with pattern subscriptions
- Lua scripting support
- TLS/SSL encryption

---

## [0.4.0] - 2025-02-01 (Alpha)

### Added
- Redis Streams support
- Sorted set operations
- Persistence (AOF and checkpoints)

---

## [0.3.0] - 2024-12-01 (Alpha)

### Added
- Hash, Set, List data types
- TTL and key expiration
- Basic replication

---

## [0.2.0] - 2024-10-01 (Alpha)

### Added
- HybridLog storage engine
- Epoch-based reclamation
- io_uring integration

---

## [0.1.0] - 2024-08-01 (Alpha)

### Added
- Initial implementation
- Basic string operations (GET, SET)
- RESP2 protocol parser
- In-memory storage

---

## Upgrade Guides

### Upgrading to 1.0.0

From 0.9.x:
```bash
# Backup data
ferrite-cli BGSAVE

# Stop old version
systemctl stop ferrite

# Install new version
cargo install ferrite@1.0.0

# Start with migration
ferrite --migrate-from 0.9

# Verify
ferrite-cli INFO
```

### Breaking Changes in 1.0.0

1. **Configuration format**: TOML configuration keys renamed for consistency
2. **Cluster protocol**: Some internal cluster messages changed format
3. **API changes**: Some CLI flags renamed

See [Migration Guide](/docs/migration/from-redis) for detailed instructions.

---

## Release Schedule

Ferrite follows a regular release schedule:
- **Major releases**: Annually (breaking changes possible)
- **Minor releases**: Quarterly (new features, backward compatible)
- **Patch releases**: As needed (bug fixes, security patches)

### Version Support

| Version | Status | Support Until |
|---------|--------|---------------|
| 1.0.x | Current | January 2028 |
| 0.9.x | Maintenance | June 2026 |
| 0.8.x | End of Life | - |

---

## Links

- [GitHub Releases](https://github.com/ferrite-rs/ferrite/releases)
- [Docker Hub](https://hub.docker.com/r/ferrite/ferrite)
- [Upgrade Guides](/docs/migration/from-redis)
