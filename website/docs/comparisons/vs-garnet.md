---
sidebar_position: 6
title: Ferrite vs Garnet
description: Comparison between Ferrite and Microsoft Garnet, two modern Redis-compatible stores with FASTER-inspired storage.
keywords: [ferrite vs garnet, garnet alternative, microsoft garnet, redis alternative comparison]
---

# Ferrite vs Garnet

Both Ferrite and [Microsoft Garnet](https://github.com/microsoft/garnet) are modern Redis-compatible stores inspired by the [FASTER](https://microsoft.github.io/FASTER/) research project. Here's how they compare.

## Quick Comparison

| Feature | Ferrite | Garnet |
|---------|---------|--------|
| **Language** | Rust | C# (.NET) |
| **Storage Engine** | HybridLog (FASTER-inspired) | Tsavorite (FASTER fork) |
| **Redis Protocol** | RESP2/RESP3 (~72%) | RESP (~80%) |
| **Vector Search** | ✅ Native HNSW/IVF | ❌ |
| **Graph Model** | ✅ Native | ❌ |
| **Time-Series** | ✅ Native | ❌ |
| **Document Store** | ✅ Native | ❌ |
| **WASM Plugins** | ✅ | ❌ |
| **Custom Procedures** | WASM + Lua | C# (in-process) |
| **Multi-Tenancy** | ✅ Native | ❌ |
| **Embedded Mode** | ✅ | ✅ (.NET library) |
| **Cluster Mode** | ✅ | ✅ |
| **License** | Apache 2.0 | MIT |
| **Backing** | Independent | Microsoft Research |

## Architecture

Both projects share a philosophical lineage from FASTER's hybrid log-structured storage:

- **Ferrite**: Three-tier HybridLog (mutable memory → read-only mmap → io_uring disk) with epoch-based reclamation. Written in Rust with thread-per-core architecture.
- **Garnet**: Tsavorite (a fork of FASTER) as the storage layer. Written in C# with .NET runtime. Strong .NET ecosystem integration.

### Key Architectural Differences

| Aspect | Ferrite | Garnet |
|--------|---------|--------|
| **Memory management** | Rust ownership (compile-time) | .NET GC (runtime) |
| **I/O** | io_uring (Linux), kqueue (macOS) | .NET async I/O |
| **Concurrency** | Epoch-based, lock-free reads | Epoch-based (FASTER heritage) |
| **Extension model** | WASM sandboxed plugins | In-process C# procedures |

## When to Choose Each

**Choose Ferrite when:**
- You need AI/ML capabilities (vector search, semantic caching)
- You want multi-model data (graph, time-series, documents)
- You prefer Rust's memory safety and performance characteristics
- You need WASM-based extensibility
- You're running on Linux with io_uring

**Choose Garnet when:**
- You're in a .NET ecosystem and want tight integration
- You need in-process C# custom procedures
- You want Microsoft-backed support and development
- You're deploying on Windows Server

## Performance Characteristics

Both engines benefit from FASTER's hybrid log design, but differ in execution:

| Metric | Ferrite | Garnet |
|--------|---------|--------|
| **Cold start** | Fast (native binary) | Moderate (.NET JIT warmup) |
| **Tail latency** | Predictable (no GC pauses) | GC pauses possible under heavy allocation |
| **Throughput** | Competitive with Redis 7.x+ | Competitive with Redis 7.x+ |
| **Disk I/O** | io_uring (zero-copy on Linux) | Standard .NET async I/O |
| **Memory overhead** | Low (no runtime overhead) | Higher (.NET runtime + GC metadata) |

## Ecosystem Maturity

| Aspect | Ferrite | Garnet |
|--------|---------|--------|
| **Production deployments** | Early adopters | Growing, Microsoft-internal use |
| **Client SDKs** | 10 languages | Any Redis client |
| **Community size** | Growing | Growing (Microsoft backing) |
| **Plugin ecosystem** | WASM Marketplace (early) | C# procedures |
| **Monitoring** | Prometheus + OpenTelemetry | .NET metrics + ETW |

## Further Reading

- [Benchmark methodology](/docs/performance/benchmarks) — How we measure performance
- [Migration guide](/docs/getting-started/migration-from-redis) — Switching from Redis or Garnet
- [Architecture deep dive](/docs/core-concepts/architecture) — Ferrite's HybridLog internals
