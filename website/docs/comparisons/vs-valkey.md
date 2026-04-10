---
sidebar_position: 7
title: Ferrite vs Valkey
description: Comparison between Ferrite and Valkey, the Linux Foundation fork of Redis.
keywords: [ferrite vs valkey, valkey alternative, redis fork, open source redis]
---

# Ferrite vs Valkey

[Valkey](https://github.com/valkey-io/valkey) is the Linux Foundation-backed fork of Redis, maintaining full compatibility after Redis changed to RSALv2/SSPL licensing. Ferrite takes a different approach — Redis compatibility with next-generation features.

## Quick Comparison

| Feature | Ferrite | Valkey |
|---------|---------|--------|
| **Language** | Rust | C |
| **Origin** | Clean-room implementation | Redis fork |
| **Redis Compatibility** | ~72% | ~100% |
| **Storage** | Tiered (Memory + mmap + Disk) | Memory-first |
| **Vector Search** | ✅ Native | ⚠️ Module |
| **Graph Model** | ✅ Native | ⚠️ Module |
| **Time-Series** | ✅ Native | ⚠️ Module |
| **Document Store** | ✅ Native | ⚠️ Module |
| **WASM Plugins** | ✅ | ❌ |
| **Query Language** | ✅ FerriteQL | ❌ |
| **Multi-Tenancy** | ✅ Native | ❌ |
| **Semantic Caching** | ✅ Native | ❌ |
| **License** | Apache 2.0 | BSD-3 |
| **Governance** | Independent | Linux Foundation |

## Philosophy Difference

- **Valkey**: Conservative evolution. Maintain 100% Redis compatibility. Stable foundation for existing Redis deployments. Community-governed successor to Redis.
- **Ferrite**: Innovative leap. Redis protocol as a foundation, but add AI-native features, tiered storage, multi-model, and WASM extensibility. Built from scratch in Rust.

## Migration Considerations

### From Redis to Valkey
- **Effort**: Near-zero. Drop-in replacement.
- **Risk**: Minimal. Same codebase, same APIs.
- **Benefit**: Open-source license, community governance.

### From Redis to Ferrite
- **Effort**: Low-to-moderate. Most Redis commands work, but verify your command set against the [compatibility matrix](/docs/migration/compatibility).
- **Risk**: Moderate. Different storage engine behavior under edge cases.
- **Benefit**: Tiered storage cost savings, AI/ML features, WASM plugins, multi-model capabilities.

## When to Choose Each

**Choose Ferrite when:**
- You need more than a cache — vector search, graphs, time-series, documents
- You want tiered storage to reduce memory costs
- AI/ML workloads are a primary use case
- You want a modern Rust codebase with memory safety
- You need WASM-based extensibility

**Choose Valkey when:**
- You need 100% Redis command compatibility
- You're migrating from Redis and want zero risk
- You rely on Redis modules that Ferrite doesn't support yet
- You need the backing of the Linux Foundation
- You want a battle-tested codebase with years of production use

## Architecture Comparison

| Aspect | Ferrite | Valkey |
|--------|---------|--------|
| **Storage** | Three-tier HybridLog (memory → mmap → disk) | In-memory with optional RDB/AOF persistence |
| **Memory model** | Rust ownership (compile-time) | Manual C memory management |
| **Concurrency** | Thread-per-core + epoch reclamation | Single-threaded event loop (with I/O threads) |
| **I/O** | io_uring (Linux), kqueue (macOS) | epoll/kqueue |
| **Data beyond RAM** | ✅ Tiered storage serves from disk | ❌ All data must fit in RAM |
| **Extension model** | WASM sandboxed plugins | Redis modules (C shared objects) |

## Performance Characteristics

| Metric | Ferrite | Valkey |
|--------|---------|--------|
| **GET/SET throughput** | Competitive | Mature, well-optimized |
| **Tail latency** | Predictable (no GC, lock-free reads) | Predictable (single-threaded) |
| **Memory efficiency** | Higher (tiered storage offloads cold data) | All data in RAM |
| **Large datasets** | ✅ Handles datasets larger than RAM | ❌ Limited by available RAM |
| **Multi-core scaling** | Thread-per-core utilizes all CPUs | Primarily single-threaded per shard |

## Cost Implications

For large datasets, Ferrite's tiered storage can significantly reduce infrastructure costs:

- **Hot data** stays in memory for microsecond latency
- **Warm data** in memory-mapped files (mmap) — near-memory speed, no RAM cost
- **Cold data** on NVMe/SSD via io_uring — still fast, fraction of RAM cost

Valkey requires all data in RAM, which can be expensive at scale. The trade-off is simpler operational model and guaranteed uniform latency.

## Further Reading

- [Migration from Redis](/docs/getting-started/migration-from-redis) — Step-by-step migration guide
- [Compatibility matrix](/docs/migration/compatibility) — Command-by-command comparison
- [Tiered storage guide](/docs/advanced/tiered-storage) — How Ferrite manages data across tiers
