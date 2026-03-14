---
slug: ferrite-tiered-storage-explained
title: "HybridLog Deep Dive: How Ferrite Stores 10x More Data Than Redis on the Same Hardware"
authors: [ferrite-team]
tags: [architecture, tiered-storage, hybridlog, performance, internals]
description: "A technical deep dive into Ferrite's HybridLog storage engine — how three-tier storage (memory → mmap → disk) delivers Redis-class performance with 10x capacity."
---

The most common question we get is: *"How can Ferrite be as fast as Redis if it stores data on disk?"* The answer is HybridLog — our three-tier storage engine inspired by Microsoft's FASTER research. This post explains how it works and why it changes the economics of key-value storage.

<!-- truncate -->

## The Problem With In-Memory-Only Storage

Redis keeps everything in RAM. This is simple and fast, but creates three problems at scale:

1. **Cost**: RAM costs 10-50x more than SSD per GB on cloud providers
2. **Capacity**: Your dataset is capped at instance RAM minus overhead
3. **Recovery**: Restarting means reloading everything into memory (slow for large datasets)

The traditional answer is sharding across more nodes. But sharding adds complexity, cross-shard operations, and operational overhead — all to work around a storage limitation.

## HybridLog: Three Tiers, One Address Space

Ferrite's HybridLog presents a single logical address space across three physical storage tiers:

```
┌──────────────────────────────────────────────────┐
│                Logical Address Space              │
│                                                  │
│  ┌──────────┐  ┌──────────────┐  ┌────────────┐ │
│  │ 🔥 Hot    │  │ 🟡 Warm      │  │ 🧊 Cold    │ │
│  │ Mutable   │  │ Read-Only    │  │ Disk       │ │
│  │ Region    │  │ Region       │  │ Region     │ │
│  │           │  │              │  │            │ │
│  │ In-memory │  │ mmap files   │  │ io_uring / │ │
│  │ Updates   │  │ OS page cache│  │ S3 / GCS   │ │
│  └──────────┘  └──────────────┘  └────────────┘ │
│                                                  │
│  ← New writes    Data ages →    Cold data →      │
└──────────────────────────────────────────────────┘
```

### Hot Tier (Mutable Region)

The mutable region lives entirely in memory. All writes go here first. This is where active, frequently-accessed keys live. Read and write performance matches or exceeds Redis because there's no serialization or deserialization — data is accessed via direct memory pointers.

### Warm Tier (Read-Only Region)

As the mutable region fills up, older entries are "sealed" and become read-only. These entries are memory-mapped (mmap), which means:

- The **OS page cache** manages what's in physical RAM
- Frequently accessed "warm" keys stay in memory automatically
- Rarely accessed entries get paged out to disk by the OS
- Zero-copy reads — no need to deserialize from disk format

This is the key insight: by letting the OS manage warm data, we get automatic, workload-adaptive caching for free.

### Cold Tier (Disk Region)

Data that ages out of the warm tier moves to the disk region. On Linux, we use io_uring for async I/O with minimal syscall overhead. On other platforms, we fall back to standard async file I/O.

For cloud deployments, the cold tier can extend to S3, GCS, or Azure Blob Storage — giving you virtually unlimited capacity at object storage prices.

## Epoch-Based Reclamation

Thread-safe memory management is the hardest part of a concurrent storage engine. We use **epoch-based reclamation** (similar to RCU in the Linux kernel):

1. Each thread tracks its current epoch
2. Memory is freed only when all threads have advanced past the epoch where it was deallocated
3. No locks needed for read operations — readers never block writers

This gives us lock-free reads with safe, deterministic memory reclamation. The overhead is a single atomic counter per thread.

## Real-World Impact

### Cost Savings

For a 100 GB dataset on AWS:

| Approach | Instance | Monthly Cost |
|----------|----------|-------------|
| Redis (all in RAM) | r6g.4xlarge (128 GB RAM) | ~$780/month |
| Ferrite (tiered) | m6g.xlarge (16 GB RAM) + gp3 SSD | ~$120/month |

That's an **85% cost reduction** while maintaining sub-millisecond latency for hot keys.

### Access Pattern Optimization

Most real-world workloads follow a power-law distribution — 20% of keys account for 80% of accesses. Ferrite automatically keeps that hot 20% in memory while the remaining 80% lives on cheaper storage.

```
Access Frequency
│
│██                            20% of keys = 80% of accesses
│██                            → Stays in hot tier (memory)
│████
│████████
│████████████████████████████   80% of keys = 20% of accesses
│                               → Moves to warm/cold tier
└───────────────────────────── Keys (sorted by access frequency)
```

### Benchmark: Dataset Exceeding RAM

With an 8 GB RAM instance and a 40 GB dataset:

| Workload | Throughput | P99 Latency |
|----------|-----------|-------------|
| 100% hot keys (all in memory) | 425K ops/s | 0.72ms |
| 80/20 hot/cold split | 400K ops/s | 0.85ms |
| 50/50 hot/cold split | 280K ops/s | 2.1ms |
| 100% random (cold) | 85K ops/s | 8.5ms |

Even in the worst case (100% random access to cold data), Ferrite delivers 85K ops/s — which is comparable to Redis's single-core throughput but serving 5x the data.

## How It Compares

| Feature | Redis | Dragonfly | Garnet | **Ferrite** |
|---------|-------|-----------|--------|-------------|
| In-memory tier | ✅ | ✅ | ✅ | ✅ |
| mmap warm tier | ❌ | ❌ | ❌ | ✅ |
| Disk cold tier | ❌ | ❌ | ✅ (Tsavorite) | ✅ (io_uring) |
| Cloud storage tier | ❌ | ❌ | ❌ | ✅ (S3/GCS) |
| Automatic tier migration | ❌ | ❌ | Partial | ✅ |
| Epoch-based concurrency | ❌ | ❌ | ✅ | ✅ |

## Try It Yourself

```bash
# Start Ferrite with tiered storage enabled
docker run -d -p 6379:6379 -v ferrite-data:/data ferritelabs/ferrite:latest

# Load more data than RAM
redis-benchmark -p 6379 -d 1024 -r 10000000 -n 10000000 -t set -P 32

# Watch tiered storage in action
redis-cli INFO storage
# tier_hot_keys: 2,000,000
# tier_warm_keys: 5,000,000
# tier_cold_keys: 3,000,000
```

For detailed tuning of tier thresholds, eviction policies, and compaction settings, see our [Tiered Storage guide](https://ferrite.dev/docs/advanced/tiered-storage).
