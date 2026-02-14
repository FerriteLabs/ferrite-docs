---
sidebar_position: 5
maturity: experimental
---

# Capacity Planning

Size your Ferrite deployment for optimal performance and cost.

## Overview

Proper capacity planning ensures your Ferrite deployment can handle current load with room for growth.

## Memory Sizing

### Memory Formula

```
Total Memory = Data Size + Index Overhead + Buffer + OS Reserve

Where:
- Data Size = Sum of all key-value sizes
- Index Overhead ≈ 15% of data size
- Buffer ≈ 10% for operations
- OS Reserve ≈ 10% of total
```

### Estimation Examples

| Keys | Avg Size | Data | Overhead | Total |
|------|----------|------|----------|-------|
| 1M | 1 KB | 1 GB | 350 MB | ~1.5 GB |
| 10M | 1 KB | 10 GB | 3.5 GB | ~15 GB |
| 100M | 1 KB | 100 GB | 35 GB | ~150 GB |
| 1M | 10 KB | 10 GB | 3.5 GB | ~15 GB |

### Memory by Data Type

| Type | Overhead per Entry |
|------|-------------------|
| String | ~50 bytes |
| List (per item) | ~24 bytes |
| Hash (per field) | ~64 bytes |
| Set (per member) | ~40 bytes |
| ZSet (per member) | ~48 bytes |
| Stream (per entry) | ~100 bytes |

### Vector Memory

```
Vector Memory = vectors × dimensions × 4 bytes × index_multiplier

HNSW index_multiplier ≈ 1.5
IVF index_multiplier ≈ 1.2
Flat index_multiplier ≈ 1.0

Example (1M vectors, 384 dims, HNSW):
= 1,000,000 × 384 × 4 × 1.5
= 2.3 GB
```

## CPU Sizing

### Operations per Core

| Operation | Ops/sec/core |
|-----------|-------------|
| GET | 100,000+ |
| SET | 80,000+ |
| LPUSH/LPOP | 80,000+ |
| HSET/HGET | 70,000+ |
| Vector search | 10,000+ |

### CPU Formula

```
Required Cores = Peak Ops/sec ÷ Ops/core × Safety Factor

Safety Factor = 1.5 to 2.0 for headroom

Example:
Peak: 200,000 ops/sec
= 200,000 ÷ 100,000 × 1.5
= 3 cores minimum
```

### Workload Profiles

| Profile | CPU:Memory Ratio |
|---------|-----------------|
| Cache (read-heavy) | 1:4 |
| Session store | 1:4 |
| Queue (write-heavy) | 1:2 |
| Analytics | 1:8 |
| Vector search | 1:4 |

## Storage Sizing

### Persistence Storage

```
Storage = Max Memory × 2 + AOF Growth Buffer

AOF Growth Buffer = Daily writes × Days before rewrite
```

### Tiered Storage

```
Hot Tier (Memory) = Frequently accessed data (20-30%)
Warm Tier (SSD) = Less frequent data (50-60%)
Cold Tier (HDD) = Archive data (20-30%)
```

### IOPS Requirements

| Operation | IOPS |
|-----------|------|
| Checkpoint write | 5,000+ |
| AOF fsync | 1,000+ |
| Cold tier read | 500+ |

## Network Sizing

### Bandwidth Formula

```
Bandwidth = (Request Size + Response Size) × Ops/sec

Example:
GET 1KB value at 100K ops/sec:
= (50 bytes + 1024 bytes) × 100,000
= 107 MB/s = 856 Mbps
```

### Connection Limits

```
Max Connections = Concurrent Users × Connections/User × Safety

Example:
10,000 concurrent users × 2 connections × 1.5
= 30,000 connections
```

## Cluster Sizing

### Sharding

```
Shards = Total Memory ÷ Memory per Node

Example:
100 GB data ÷ 32 GB per node = 4 shards (minimum)
Add replicas: 4 shards × 2 = 8 nodes total
```

### Node Count Formula

```
Nodes = max(
  ceil(Memory / Node_Memory),
  ceil(Ops / Node_Ops),
  ceil(Connections / Node_Connections)
) × Replication_Factor
```

## Sizing Calculator

### Quick Estimates

| Tier | Keys | Memory | CPU | Storage |
|------|------|--------|-----|---------|
| Small | &lt;1M | 4 GB | 2 cores | 20 GB |
| Medium | 1-10M | 16 GB | 4 cores | 100 GB |
| Large | 10-100M | 64 GB | 8 cores | 500 GB |
| XLarge | 100M-1B | 256 GB | 16 cores | 2 TB |

### Detailed Worksheet

```
1. Data Volume
   - Number of keys: __________
   - Average key size: __________
   - Average value size: __________
   - Total data size: __________ GB

2. Traffic
   - Peak read ops/sec: __________
   - Peak write ops/sec: __________
   - Average request size: __________ bytes
   - Average response size: __________ bytes

3. Growth
   - Monthly data growth: __________%
   - Monthly traffic growth: __________%
   - Planning horizon: __________ months

4. Calculated Requirements
   - Memory: __________ GB
   - CPU cores: __________
   - Network: __________ Mbps
   - Storage: __________ GB

5. With Safety Margin (1.5x)
   - Memory: __________ GB
   - CPU cores: __________
   - Network: __________ Mbps
   - Storage: __________ GB
```

## Growth Planning

### Scaling Triggers

| Metric | Yellow | Red | Action |
|--------|--------|-----|--------|
| Memory | 70% | 85% | Add memory or shard |
| CPU | 60% | 80% | Add cores or shard |
| Connections | 70% | 90% | Add nodes |
| Storage | 70% | 85% | Expand storage |

### Horizontal vs Vertical Scaling

| Scaling | When to Use | Pros | Cons |
|---------|-------------|------|------|
| Vertical | &lt;64 GB, simple | Simple | Limits |
| Horizontal | >64 GB, high ops | Unlimited | Complexity |

## Reference Architectures

### Small (Startup)

```
1 node:
- 4 GB RAM
- 2 vCPUs
- 50 GB SSD
- Supports: ~500K keys, 10K ops/sec
```

### Medium (Growing Business)

```
3-node cluster (1 master + 2 replicas):
- 16 GB RAM each
- 4 vCPUs each
- 200 GB SSD each
- Supports: ~10M keys, 100K ops/sec
```

### Large (Enterprise)

```
6-node cluster (3 shards × 2 replicas):
- 64 GB RAM each
- 8 vCPUs each
- 500 GB SSD each
- Supports: ~100M keys, 500K ops/sec
```

### XLarge (High-Scale)

```
18-node cluster (6 shards × 3 replicas):
- 128 GB RAM each
- 16 vCPUs each
- 1 TB NVMe each
- Supports: ~1B keys, 2M ops/sec
```

## Cost Optimization

### Reserved Instances

| Term | Savings |
|------|---------|
| 1 year | 30-40% |
| 3 year | 50-60% |

### Right-Sizing Tips

1. **Monitor actual usage** - Don't over-provision
2. **Use spot instances** - For replicas (with care)
3. **Tiered storage** - Move cold data to cheaper storage
4. **Auto-scaling** - Scale down during off-hours
5. **Regular reviews** - Quarterly capacity review

## Benchmarking

### Run Benchmarks

```bash
# Measure current capacity
ferrite-benchmark -h localhost -p 6379 \
  -c 50 -n 1000000 \
  --csv > benchmark.csv

# Key metrics:
# - Requests per second
# - Latency (p50, p99, p99.9)
# - Memory usage
# - CPU usage
```

### Stress Testing

```bash
# Find breaking point
ferrite-benchmark \
  -c 100 \
  -n 10000000 \
  --pipeline 16 \
  -d 1024
```

## Best Practices

1. **Start conservative** - Easier to scale up than down
2. **Plan for 2x growth** - 12-18 month horizon
3. **Test at scale** - Benchmark with production-like data
4. **Monitor continuously** - Track trends, not just current state
5. **Document assumptions** - Update as you learn
6. **Review quarterly** - Adjust based on actual usage

## Next Steps

- [High Availability](/docs/deployment/high-availability) - HA patterns
- [Performance Tuning](/docs/operations/performance-tuning) - Optimization
- [Monitoring](/docs/operations/monitoring) - Track usage
