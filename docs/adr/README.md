# Architecture Decision Records

This directory contains Architecture Decision Records (ADRs) for the Ferrite project. ADRs document significant architectural decisions, their context, and consequences.

## What is an ADR?

An Architecture Decision Record captures an important architectural decision made along with its context and consequences. They help new team members understand "why is it built this way?"

## ADR Index

| ADR | Title | Status | Summary |
|-----|-------|--------|---------|
| [0001](ADR-0001-hybridlog-three-tier-storage.md) | HybridLog Three-Tier Storage | Accepted | Three-tier storage (Mutable/ReadOnly/Disk) inspired by Microsoft FASTER for optimal performance at any data size |
| [0002](ADR-0002-io-uring-first-with-fallback.md) | io_uring-First I/O | Accepted | Use Linux io_uring for maximum performance with automatic fallback to tokio::fs on other platforms |
| [0003](ADR-0003-redis-resp-protocol-compatibility.md) | Redis RESP Protocol | Accepted | Full RESP2/RESP3 compatibility for drop-in Redis replacement |
| [0004](ADR-0004-tokio-async-runtime.md) | Tokio Async Runtime | Accepted | Tokio with connection-per-task model for high concurrency |
| [0005](ADR-0005-dashmap-concurrent-access.md) | DashMap Concurrent Access | Accepted | DashMap for lock-free concurrent HashMap operations |
| [0006](ADR-0006-redis-cluster-hash-slots.md) | Redis Cluster Hash Slots | Accepted | 16384 hash slot model for horizontal scaling compatibility |
| [0007](ADR-0007-dual-persistence-aof-rdb.md) | Dual Persistence (AOF + RDB) | Accepted | AOF for durability + RDB snapshots for fast recovery |
| [0008](ADR-0008-modular-command-handlers.md) | Modular Command Handlers | Accepted | Category-based handler modules for maintainability |
| [0009](ADR-0009-wasm-user-defined-functions.md) | WASM User Defined Functions | Accepted | WebAssembly for polyglot, secure, high-performance UDFs |
| [0010](ADR-0010-distributed-transactions-2pc-mvcc.md) | Distributed Transactions | Accepted | 2PC for atomicity + MVCC for snapshot isolation |
| [0011](ADR-0011-embedded-vector-search.md) | Embedded Vector Search | Accepted | Native HNSW/IVF vector indexes for AI/ML workloads |
| [0012](ADR-0012-acl-based-permissions.md) | ACL-Based Permissions | Accepted | Redis-compatible ACL for fine-grained access control |
| [0013](ADR-0013-rust-implementation-language.md) | Rust Implementation Language | Accepted | Rust for zero-cost abstractions, memory safety, and predictable performance |
| [0014](ADR-0014-epoch-based-memory-reclamation.md) | Epoch-Based Memory Reclamation | Accepted | Lock-free concurrent access using crossbeam-epoch |
| [0015](ADR-0015-dual-execution-modes.md) | Dual Execution Modes | Accepted | Server mode (TCP) and embedded mode (library) as first-class citizens |
| [0016](ADR-0016-trait-based-storage-backends.md) | Trait-Based Storage Backends | Accepted | Pluggable storage backends via Rust traits |
| [0017](ADR-0017-feature-flags-optional-capabilities.md) | Feature Flags | Accepted | Cargo features for optional capabilities (vector, wasm, onnx, etc.) |
| [0018](ADR-0018-production-observability-stack.md) | Production Observability Stack | Accepted | Tracing, Prometheus metrics, and OpenTelemetry integration |

## Reading Order

For new team members, we recommend reading ADRs in this order:

### Foundation (Start Here)
1. **ADR-0013**: Rust Implementation Language - Why Rust was chosen
2. **ADR-0003**: Redis RESP Protocol - Understand our compatibility goal
3. **ADR-0001**: HybridLog Storage - Core storage architecture
4. **ADR-0004**: Tokio Runtime - Async execution model
5. **ADR-0005**: DashMap - Concurrency approach
6. **ADR-0014**: Epoch-Based Memory Reclamation - Lock-free reads

### Storage Architecture
7. **ADR-0016**: Trait-Based Storage Backends - Pluggable storage
8. **ADR-0015**: Dual Execution Modes - Server vs embedded

### Persistence & I/O
9. **ADR-0002**: io_uring I/O - High-performance disk access
10. **ADR-0007**: AOF + RDB - Durability strategy

### Scaling & Distribution
11. **ADR-0006**: Cluster Hash Slots - Horizontal scaling
12. **ADR-0010**: Distributed Transactions - Cross-shard ACID

### Security & Extensibility
13. **ADR-0012**: ACL Permissions - Access control
14. **ADR-0008**: Command Handlers - Code organization
15. **ADR-0009**: WASM Functions - Extensibility
16. **ADR-0011**: Vector Search - AI/ML features

### Operations & Build
17. **ADR-0017**: Feature Flags - Optional capabilities
18. **ADR-0018**: Production Observability - Metrics, tracing, logging

## ADR Format

Each ADR follows this structure:

```markdown
# ADR-NNNN: Title

## Status
Accepted | Superseded | Deprecated

## Context
What prompted this decision? What problem are we solving?

## Decision
What was decided? How does it work?

## Consequences
What are the tradeoffs? What does this enable or prevent?
```

## Creating New ADRs

1. Copy the template: `cp template.md ADR-NNNN-short-title.md`
2. Assign the next sequential number
3. Fill in all sections
4. Submit for review
5. Update this index

## Status Definitions

- **Accepted**: Currently in use
- **Superseded**: Replaced by a newer ADR (link to replacement)
- **Deprecated**: No longer recommended, but may still exist in code

## References

- [Michael Nygard's ADR Blog Post](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions)
- [ADR GitHub Organization](https://adr.github.io/)
