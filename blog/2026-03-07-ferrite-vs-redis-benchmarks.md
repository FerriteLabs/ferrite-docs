---
title: "Ferrite vs Redis: Benchmark Results on Real-World Workloads"
date: 2026-03-07
author: Jose David Baena
tags: [ferrite, redis, benchmarks, performance, comparison]
---

# Ferrite vs Redis: Benchmark Results

We built Ferrite as a drop-in Redis replacement, so the natural question is:
how does it actually perform? This post shares our benchmark methodology and
results against Redis 7, Dragonfly, KeyDB, and Valkey.

## Methodology

All benchmarks run on **AWS c5.2xlarge** instances (8 vCPU, 16 GB RAM, EBS gp3)
using [memtier_benchmark](https://github.com/RedisLabs/memtier_benchmark) for
client load generation. Full methodology is documented in our
[METHODOLOGY.md](https://github.com/ferritelabs/ferrite-bench/blob/main/METHODOLOGY.md).

Key parameters:
- **4 client threads**, 50 connections each
- **10 million requests** per scenario
- **Pipeline depth**: 1 (no pipelining) and 16
- **Data sizes**: 64B, 256B, 1KB, 10KB values

## Results: In-Memory Workloads

When data fits entirely in RAM, Ferrite is competitive with Redis on pure
throughput and wins on tail latency:

### GET-only (64B values, no pipeline)

| Server | Ops/sec | P50 (ms) | P99 (ms) | P99.9 (ms) |
|--------|---------|----------|----------|------------|
| Ferrite | 485,000 | 0.18 | 0.52 | 0.89 |
| Redis 7 | 510,000 | 0.17 | 0.58 | 1.42 |
| Dragonfly | 520,000 | 0.17 | 0.48 | 0.91 |
| KeyDB | 475,000 | 0.19 | 0.61 | 1.55 |

### SET-only (64B values, no pipeline)

| Server | Ops/sec | P50 (ms) | P99 (ms) | P99.9 (ms) |
|--------|---------|----------|----------|------------|
| Ferrite | 410,000 | 0.21 | 0.58 | 0.95 |
| Redis 7 | 430,000 | 0.20 | 0.65 | 1.51 |
| Dragonfly | 445,000 | 0.19 | 0.52 | 0.98 |
| KeyDB | 395,000 | 0.22 | 0.68 | 1.62 |

### Mixed 50/50 GET/SET (pipeline 16)

| Server | Ops/sec | P50 (ms) | P99 (ms) | P99.9 (ms) |
|--------|---------|----------|----------|------------|
| Ferrite | 1,850,000 | 0.35 | 1.10 | 1.85 |
| Redis 7 | 1,920,000 | 0.33 | 1.25 | 2.80 |
| Dragonfly | 2,100,000 | 0.30 | 0.95 | 1.70 |
| KeyDB | 1,720,000 | 0.38 | 1.35 | 3.10 |

**Takeaway**: On pure in-memory workloads, Ferrite is within 5-10% of Redis on
throughput while consistently delivering **better P99.9 latency** thanks to
epoch-based reclamation (no GC pauses, no fork-based persistence jitter).

## Results: Tiered Storage (Ferrite's Sweet Spot)

This is where Ferrite shines. When the dataset exceeds available RAM, Redis
either evicts data or OOMs. Ferrite's HybridLog keeps serving:

### 50GB dataset, 8GB RAM limit

| Scenario | Ferrite (tiered) | Redis (eviction) |
|----------|-----------------|-------------------|
| GET hot keys | 460K ops/sec, P99 0.55ms | 480K ops/sec, P99 0.60ms |
| GET cold keys | 85K ops/sec, P99 3.2ms | N/A (evicted) |
| SET (any key) | 380K ops/sec, P99 0.62ms | 390K ops/sec, P99 0.70ms |
| **Data accessible** | **100%** | **16% (rest evicted)** |
| **RAM cost** | **8 GB ($40/mo)** | **50 GB ($250/mo)** |

**Takeaway**: For datasets larger than RAM, Ferrite provides **100% data
availability** at a fraction of the cost. Hot-path performance is nearly
identical to Redis; cold-path adds 2-5ms — acceptable for the long tail.

## Persistence Performance

Ferrite's AOF and checkpoint system avoids the `fork()` penalty that causes
Redis latency spikes during BGSAVE:

| Operation | Ferrite | Redis 7 |
|-----------|---------|---------|
| AOF fsync (everysec) | 0.1ms overhead | 0.1ms overhead |
| Background save (10GB) | No latency impact | +15ms P99 spike |
| Recovery time (10GB) | 8.2s | 12.5s |

Redis uses `fork()` for snapshots, which copies page tables and causes
copy-on-write amplification under write load. Ferrite's incremental checkpoint
system operates on sealed read-only pages, avoiding any interference with the
hot path.

## Reproducing These Results

Our full benchmark suite is open source:

```bash
git clone https://github.com/ferritelabs/ferrite-bench
cd ferrite-bench
docker compose up -d  # Starts Ferrite + Redis + monitoring
./benchmarks/harness.sh --scenario all --duration 60
```

Results are written to CSV and can be visualized with the included report
generator:

```bash
python3 benchmarks/report_generator.py results/ > report.md
```

## Conclusion

Ferrite isn't trying to be faster than Redis on every micro-benchmark. Instead,
it targets the **total cost of ownership** story:

1. **Same performance** for in-memory workloads (within 5-10%)
2. **Better tail latency** (no GC pauses, no fork-based persistence)
3. **Dramatically lower cost** for datasets larger than RAM (tiered storage)
4. **100% data availability** (no eviction needed)

If your dataset fits comfortably in RAM and you're happy with Redis, keep using
Redis. If you're hitting the memory wall, sharding for cost reasons, or losing
data to eviction — give Ferrite a try.

```bash
brew install ferritelabs/tap/ferrite
```
