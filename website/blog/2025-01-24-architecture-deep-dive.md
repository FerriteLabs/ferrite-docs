---
slug: architecture-deep-dive
title: "Inside Ferrite: A Deep Dive into HybridLog Storage"
authors: [ferrite-team]
tags: [architecture, engineering, performance]
description: Technical deep dive into Ferrite's HybridLog storage engine, covering tiered storage, epoch-based memory reclamation, and io_uring integration.
---

How do you build a key-value store that's as fast as Redis for hot data while handling datasets 100x larger than available memory? In this post, we dive deep into Ferrite's HybridLog storage engine.

<!-- truncate -->

## The Problem with Pure In-Memory Stores

Redis is blazing fast because everything lives in memory. But this creates challenges:

1. **Cost**: RAM is 10-20x more expensive than SSD per GB
2. **Capacity**: You're limited by memory size
3. **Cold starts**: Loading 100GB from disk takes minutes

We wanted the best of both worlds: memory-speed for hot data, disk economics for cold data.

## Enter HybridLog

HybridLog is a three-tier storage architecture inspired by [Microsoft FASTER](https://www.microsoft.com/en-us/research/publication/faster-a-concurrent-key-value-store-with-in-place-updates/). The key insight: most workloads have a small "hot" working set that's accessed frequently, while most data is rarely touched.

### The Three Tiers

```
┌─────────────────────────────────────────────────────────────┐
│                    Mutable Region (Hot)                      │
│  Location: RAM          Access: In-place updates             │
│  Size: Configurable     Latency: ~100ns                      │
├─────────────────────────────────────────────────────────────┤
│                    Read-Only Region (Warm)                   │
│  Location: mmap         Access: Zero-copy reads              │
│  Size: Configurable     Latency: ~1-5μs                      │
├─────────────────────────────────────────────────────────────┤
│                    Disk Region (Cold)                        │
│  Location: SSD/Cloud    Access: Async I/O                    │
│  Size: Unlimited        Latency: ~50-200μs                   │
└─────────────────────────────────────────────────────────────┘
```

### How It Works

**Writes** always go to the mutable region:

```rust
// Simplified write path
fn set(&self, key: Key, value: Value) {
    // 1. Append to mutable log (fast, in-memory)
    let address = self.mutable.append(key, value);

    // 2. Update index to point to new location
    self.index.update(key, address);

    // Old value will be garbage collected by epoch system
}
```

**Reads** check tiers in order:

```rust
// Simplified read path
async fn get(&self, key: &Key) -> Option<Value> {
    let address = self.index.lookup(key)?;

    match address.tier() {
        Tier::Mutable => self.mutable.get(address),      // ~100ns
        Tier::ReadOnly => self.readonly.get(address),    // ~1μs
        Tier::Disk => self.disk.get(address).await,      // ~50μs
    }
}
```

## Epoch-Based Memory Reclamation

One of the trickiest problems in concurrent data structures: when is it safe to free memory?

Consider this scenario:
1. Thread A reads a value at address 0x1000
2. Thread B updates the same key, creating a new version
3. Thread B wants to free the old value at 0x1000
4. But Thread A might still be reading it!

### The Epoch Solution

We use [epoch-based reclamation](https://aturon.github.io/blog/2015/08/27/epoch/) from the Crossbeam library:

```rust
fn read(&self, key: &Key) -> Option<Value> {
    // Pin the current epoch
    let guard = epoch::pin();

    // Safe to read - memory won't be freed while we're pinned
    let value = self.do_read(key, &guard);

    // Guard dropped here - we're done reading
    value
}

fn update(&self, key: Key, value: Value) {
    let guard = epoch::pin();

    let old_address = self.index.swap(key, new_address, &guard);

    // Schedule old value for deferred deletion
    // Will only be freed when ALL threads have advanced past this epoch
    unsafe { guard.defer_destroy(old_address); }
}
```

The beauty: readers never block writers, and writers never block readers. Memory is reclaimed only when provably safe.

## io_uring: Kernel-Bypass I/O

For cold tier reads, we use Linux's io_uring for maximum I/O efficiency:

```rust
// Traditional async I/O (simplified)
async fn read_file_tokio(path: &Path) -> Vec<u8> {
    let file = File::open(path).await?;  // syscall
    let mut buf = vec![0u8; 4096];
    file.read(&mut buf).await?;           // syscall
    buf
}

// io_uring batched I/O
async fn read_files_uring(paths: &[Path]) -> Vec<Vec<u8>> {
    let ring = IoUring::new(256)?;

    // Submit ALL reads in one syscall
    for path in paths {
        ring.submit_read(path);
    }

    // Wait for ALL completions in one syscall
    ring.wait_all().await
}
```

Benefits:
- **Batching**: Submit hundreds of I/O operations in one syscall
- **Registered buffers**: Zero-copy between kernel and userspace
- **Completion polling**: No context switches for high-throughput I/O

On non-Linux platforms, we fall back to tokio's standard async I/O.

## The Index: DashMap

For O(1) key lookups, we use [DashMap](https://github.com/xacrimon/dashmap), a concurrent hash map:

```
┌─────────────────────────────────────────────────────┐
│                    DashMap                           │
├────────┬────────┬────────┬────────┬────────┬───────┤
│ Shard0 │ Shard1 │ Shard2 │ Shard3 │ ...    │ ShardN│
│ (lock) │ (lock) │ (lock) │ (lock) │        │ (lock)│
├────────┼────────┼────────┼────────┼────────┼───────┤
│  keys  │  keys  │  keys  │  keys  │        │ keys  │
└────────┴────────┴────────┴────────┴────────┴───────┘
```

Keys are sharded across multiple independent hash maps. A read only locks one shard, allowing high concurrency.

## Putting It All Together

Here's what happens when you run `GET user:123`:

1. **Parse** RESP protocol (< 100ns)
2. **Index lookup** in DashMap (< 200ns)
3. **Tier check** based on logical address
4. **Data fetch**:
   - Hot: Direct memory read (100ns)
   - Warm: mmap page access (1-5μs)
   - Cold: io_uring async read (50-200μs)
5. **Encode** RESP response (< 100ns)

For hot data, total latency is under 500ns. That's why we achieve 11.8M GET ops/sec.

## Benchmarks

Single-threaded, Apple M1 Pro:

| Operation | Tier | Throughput | P99 Latency |
|-----------|------|------------|-------------|
| GET | Hot (memory) | 11.8M/s | 125ns |
| GET | Warm (mmap) | 2.1M/s | 1.2μs |
| GET | Cold (disk) | 180K/s | 85μs |
| SET | Always hot | 2.6M/s | 250ns |

The key insight: with proper tiering, 95%+ of requests hit the hot tier even when total data far exceeds memory.

## What's Next

We're working on:

- **Adaptive tiering**: ML-based prediction of access patterns
- **Compression**: LZ4/Zstd for cold tier with minimal CPU overhead
- **Cloud tiering**: Automatic offload to S3/GCS for archival data

## Learn More

- [Architecture docs](/docs/core-concepts/architecture)
- [HybridLog internals](/docs/internals/hybridlog)
- [Epoch reclamation](/docs/internals/epoch-reclamation)
- [FASTER paper](https://www.microsoft.com/en-us/research/publication/faster-a-concurrent-key-value-store-with-in-place-updates/)

---

*The speed of memory, the capacity of disk, the economics of cloud.*
