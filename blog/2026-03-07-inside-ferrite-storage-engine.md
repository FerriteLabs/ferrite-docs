---
title: "Inside Ferrite's Storage Engine: How HybridLog Makes Tiered Storage Fast"
date: 2026-03-07
author: Jose David Baena
tags: [ferrite, architecture, storage, hybridlog, rust, performance]
---

# Inside Ferrite's Storage Engine

Ferrite's key differentiator is **tiered storage** — the ability to serve datasets
much larger than available RAM while maintaining sub-millisecond latency for hot
data. This post explains how the HybridLog storage engine makes that possible.

## The Three Tiers

Ferrite's storage engine is inspired by Microsoft Research's
[FASTER](https://www.microsoft.com/en-us/research/uploads/prod/2018/03/faster-sigmod18.pdf)
paper. Data moves through three tiers based on access patterns:

### Tier 1: Mutable Region (Memory)

Hot data lives in a lock-free, concurrent hash index backed by
[DashMap](https://crates.io/crates/dashmap). Reads and writes are in-place with
no copying. This tier handles the vast majority of operations — our benchmarks
show 500K+ GET ops/sec/core here.

### Tier 2: Read-Only Region (mmap)

When the mutable region reaches its configured size, pages are "sealed" and
moved to a memory-mapped read-only region. Reads are still zero-copy (the OS
handles paging), but writes trigger a copy-on-write promotion back to Tier 1.

### Tier 3: Disk Region (io_uring)

Cold pages that haven't been accessed migrate to disk. On Linux 5.11+, we use
**io_uring** for asynchronous I/O, eliminating system call overhead. On macOS
and Windows, we fall back to `tokio::fs` with the same API.

## Epoch-Based Reclamation

The biggest challenge in a concurrent tiered store is memory safety. When one
thread is reading a record that another thread wants to evict, who wins?

Ferrite uses **epoch-based reclamation** (EBR), similar to the approach used in
crossbeam. Each thread "pins" an epoch when it starts an operation. Memory is
only reclaimed when all threads have advanced past the epoch where it was freed.

This gives us:
- **Lock-free reads** on the hot path
- **No garbage collection pauses**
- **Predictable P99 latency** (no stop-the-world events)

## Thread-Per-Core Architecture

Each CPU core gets a dedicated thread with its own io_uring instance. Keys are
routed to threads via consistent hashing:

```
shard = hash(key) % num_shards
```

There are no cross-thread locks on the data path. This means:
- Linear scaling with core count
- No lock contention under load
- Cache-friendly access patterns (each core works its own data)

## Automatic Tiering

Ferrite monitors access patterns and automatically moves data between tiers. The
promotion/demotion policy is configurable:

```toml
[storage]
backend = "hybridlog"

[storage.hybridlog]
mutable_size = "1gb"      # Tier 1 capacity
readonly_size = "4gb"     # Tier 2 capacity
# Tier 3: bounded only by disk
auto_tier = true
tier_threshold = 0.85     # Promote when tier reaches 85% capacity
```

When the mutable region hits 85% capacity, cold pages are automatically sealed
and moved to the read-only tier. When that fills, pages move to disk. All of
this happens in the background without blocking client operations.

## What This Means in Practice

For a 100GB dataset with a typical 80/20 access pattern (80% of requests hit
20% of keys):

| Approach | RAM Required | Monthly Cost (cloud) |
|----------|-------------|---------------------|
| Redis | 100 GB | $500-1000 |
| Ferrite (tiered) | 20 GB | $100-200 |

That's a **5x cost reduction** while maintaining sub-millisecond P99 latency
for hot data. Cold data access adds 1-5ms depending on disk speed, which is
acceptable for the long tail of infrequent reads.

## Try It

```bash
# Install
brew install ferritelabs/tap/ferrite

# Run with HybridLog enabled
ferrite --config ferrite.toml
```

Check the [Architecture Guide](/docs/ARCHITECTURE) for the full technical
deep-dive, and the [Performance Tuning Guide](/docs/PERFORMANCE_TUNING) for
production optimization tips.
