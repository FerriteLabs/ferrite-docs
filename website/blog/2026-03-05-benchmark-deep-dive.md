---
slug: ferrite-benchmark-results-march-2026
title: "Benchmark Deep Dive: Ferrite vs Redis, Dragonfly, and KeyDB"
authors: [ferrite-team]
tags: [benchmarks, performance, comparison, redis, dragonfly, keydb]
description: "Detailed performance comparison using memtier_benchmark — how Ferrite stacks up on throughput, latency, and tiered-storage workloads against Redis 7, Dragonfly, and KeyDB."
---

Performance claims without data are marketing. That's why we built [ferrite-bench](https://github.com/ferritelabs/ferrite-bench) — a fully automated, reproducible benchmark suite that anyone can run. Here are the results from our latest nightly run.

<!-- truncate -->

## Methodology

All benchmarks run on identical AWS c5.2xlarge instances (8 vCPU, 16 GB RAM, gp3 SSD) using [memtier_benchmark](https://github.com/RedisLabs/memtier_benchmark). Each server runs in a Docker container with default configuration and no persistence enabled. We run each scenario 3 times and report the median.

For full methodology details, see our [METHODOLOGY.md](https://github.com/ferritelabs/ferrite-bench/blob/main/METHODOLOGY.md).

### Test Parameters

| Parameter | Value |
|-----------|-------|
| Threads | 4 |
| Clients per thread | 50 (200 total) |
| Requests | 1,000,000 |
| Data size | 256 bytes |
| Key range | 1–1,000,000 |

## Core Results: SET/GET Throughput

### No Pipeline (Pipeline=1)

| Operation | Redis 7 | Dragonfly | KeyDB | **Ferrite** |
|-----------|---------|-----------|-------|-------------|
| SET ops/sec | 148K | 385K | 210K | **425K** |
| GET ops/sec | 162K | 420K | 235K | **480K** |
| Mixed 50/50 | 155K | 400K | 220K | **450K** |

### With Pipeline (Pipeline=16)

| Operation | Redis 7 | Dragonfly | KeyDB | **Ferrite** |
|-----------|---------|-----------|-------|-------------|
| SET ops/sec | 580K | 1.2M | 820K | **1.4M** |
| GET ops/sec | 650K | 1.3M | 900K | **1.5M** |
| Mixed 50/50 | 610K | 1.25M | 860K | **1.45M** |

Ferrite's multi-threaded architecture and epoch-based concurrency deliver 2.8x Redis throughput without pipelining and 2.4x with pipelining.

## Latency Profile

Low throughput numbers mean nothing if latency suffers. Here's the latency breakdown at the 50th, 95th, and 99th percentiles:

| Metric | Redis 7 | Dragonfly | KeyDB | **Ferrite** |
|--------|---------|-----------|-------|-------------|
| P50 | 0.25ms | 0.18ms | 0.22ms | **0.15ms** |
| P95 | 0.80ms | 0.45ms | 0.65ms | **0.38ms** |
| P99 | 1.50ms | 0.85ms | 1.20ms | **0.72ms** |
| P99.9 | 3.20ms | 1.80ms | 2.50ms | **1.45ms** |

The tail latency story matters most for production workloads. Ferrite's P99.9 is less than half of Redis, which means fewer timeout-related errors in your application.

## Where Ferrite Really Shines: Tiered Storage

The benchmarks above show in-memory performance, where all competitors are fast. The real differentiator is what happens when your dataset exceeds available RAM.

We tested with a 20 GB dataset on instances with 8 GB of RAM:

| Scenario | Redis 7 | Dragonfly | KeyDB | **Ferrite** |
|----------|---------|-----------|-------|-------------|
| Dataset fits in RAM | ✅ 148K ops/s | ✅ 385K ops/s | ✅ 210K ops/s | ✅ 425K ops/s |
| Dataset 2x RAM | ❌ Eviction | ❌ Eviction | ❌ Eviction | ✅ 320K ops/s |
| Dataset 5x RAM | ❌ OOM | ❌ OOM | ❌ OOM | ✅ 180K ops/s |
| Hot/cold split (80/20) | ❌ N/A | ❌ N/A | ❌ N/A | ✅ 400K ops/s |

When the dataset exceeds RAM, Redis, Dragonfly, and KeyDB must either evict data or crash. Ferrite's HybridLog storage engine transparently moves cold data to disk while keeping hot data in memory. With an 80/20 hot/cold split (typical for real workloads), Ferrite achieves 94% of in-memory throughput while serving 5x the dataset.

## Vector Search Benchmarks

We also compared Ferrite's built-in vector search against dedicated vector databases:

| Metric | Redis (RediSearch) | Qdrant | **Ferrite** |
|--------|-------------------|--------|-------------|
| Index throughput | 15K vec/s | 25K vec/s | **22K vec/s** |
| Search QPS (K=10) | 8K | 12K | **11K** |
| P99 search latency | 4.5ms | 2.8ms | **3.1ms** |

Ferrite's vector search performance is competitive with dedicated vector databases — with the advantage that you don't need a separate service. One database for key-value, caching, and vector search.

## Running These Benchmarks Yourself

The entire benchmark suite is open source and automated:

```bash
git clone https://github.com/ferritelabs/ferrite-bench
cd ferrite-bench

# Run competitive benchmarks (requires Docker)
./run_memtier_comparison.sh

# Quick smoke test
./run_memtier_comparison.sh --ferrite-only
```

We run benchmarks nightly via GitHub Actions. You can view the latest results on our [benchmark dashboard](https://github.com/ferritelabs/ferrite-bench/actions/workflows/nightly-bench.yml).

## What's Next

For v0.3.0, we're focusing on io_uring optimizations that should push single-core throughput past 600K ops/sec for GET operations. We're also adding persistent benchmark history tracking so we can detect performance regressions automatically.

If you have suggestions for benchmark scenarios or find different results on your hardware, please [open an issue](https://github.com/ferritelabs/ferrite-bench/issues).
