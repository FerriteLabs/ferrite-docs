---
sidebar_position: 6
description: How Ferrite automatically manages data across memory, SSD, and cloud storage tiers based on access patterns.
maturity: beta
---

# Tiered Storage

Ferrite's tiered storage architecture automatically manages data across memory, SSD, and cloud storage tiers based on access patterns.

> Note: The configuration examples below describe the target tiered-storage
> model. The current `ferrite.toml` schema exposes `storage.backend`,
> `storage.hybridlog_*`, and the `[cloud]` section (see
> `/docs/reference/configuration`). Use those keys in production today. The
> `storage.tiers.*` and `eviction_policy` examples are illustrative only.
> Current config values are bytes/seconds; examples below use human-readable
> units.

## Overview

Ferrite uses a three-tier storage hierarchy:

```
┌─────────────────────────────────────────────────────────────┐
│                      HOT TIER (Memory)                       │
│  • Frequently accessed data                                  │
│  • In-place updates                                          │
│  • Sub-millisecond latency                                   │
│  • ~$8/GB/month                                              │
├─────────────────────────────────────────────────────────────┤
│                    WARM TIER (mmap/SSD)                      │
│  • Moderately accessed data                                  │
│  • Memory-mapped files                                       │
│  • ~1-5ms latency                                            │
│  • ~$0.10/GB/month                                           │
├─────────────────────────────────────────────────────────────┤
│                   COLD TIER (Disk/Cloud)                     │
│  • Rarely accessed data                                      │
│  • Async I/O (io_uring)                                      │
│  • ~5-50ms latency                                           │
│  • ~$0.02/GB/month                                           │
└─────────────────────────────────────────────────────────────┘
```

## Configuration

### Basic Tiered Storage

```toml
# ferrite.toml
[storage]
engine = "hybridlog"

[storage.tiers]
# Hot tier (memory)
[storage.tiers.hot]
max_size = "8GB"
eviction_policy = "lru"

# Warm tier (SSD)
[storage.tiers.warm]
enabled = true
path = "/data/ferrite/warm"
max_size = "100GB"

# Cold tier (disk or cloud)
[storage.tiers.cold]
enabled = true
path = "/data/ferrite/cold"
max_size = "1TB"
```

### Cloud Storage Backend

```toml
# AWS S3 cold tier
[storage.tiers.cold]
enabled = true
backend = "s3"

[storage.tiers.cold.s3]
bucket = "ferrite-cold-storage"
region = "us-east-1"
prefix = "data/"
storage_class = "INTELLIGENT_TIERING"

# Google Cloud Storage
[storage.tiers.cold]
enabled = true
backend = "gcs"

[storage.tiers.cold.gcs]
bucket = "ferrite-cold-storage"
project = "my-project"

# Azure Blob Storage
[storage.tiers.cold]
enabled = true
backend = "azure"

[storage.tiers.cold.azure]
container = "ferrite-cold-storage"
account = "mystorageaccount"
```

## How It Works

### Data Placement

Data automatically moves between tiers based on:

1. **Access Frequency**: Hot data stays in memory
2. **Access Recency**: Recently accessed data promoted up
3. **Memory Pressure**: Data evicted down when memory full
4. **Explicit Policy**: TTL and tier hints

### The HybridLog

Ferrite's HybridLog manages tier transitions:

```
┌─────────────────────────────────────────────────────────────┐
│                        HybridLog                             │
│                                                              │
│  Head ──────────────────────────────────────────────> Tail  │
│                                                              │
│  ├── Mutable Region ──┼── Read-Only Region ──┼── On-Disk ──┤│
│  │   (Hot Tier)       │   (Warm Tier)        │  (Cold)     ││
│  │                    │                      │             ││
│  │  In-place updates  │  Copy-on-write       │  Async I/O  ││
│  │  Lock-free reads   │  Zero-copy reads     │  Batched    ││
│  └────────────────────┴──────────────────────┴─────────────┘│
└─────────────────────────────────────────────────────────────┘
```

### Tier Transitions

```
              ┌─────────┐
    Write ───>│   HOT   │<─── Read (fast path)
              └────┬────┘
                   │ Eviction (memory pressure)
                   ▼
              ┌─────────┐
              │  WARM   │<─── Read (promote on access)
              └────┬────┘
                   │ Aging (time-based)
                   ▼
              ┌─────────┐
              │  COLD   │<─── Read (async, promote on access)
              └─────────┘
```

## Tier Policies

### Eviction Policies

```toml
[storage.tiers.hot]
eviction_policy = "lru"  # Options: lru, lfu, fifo, random
```

| Policy | Description | Best For |
|--------|-------------|----------|
| `lru` | Least Recently Used | General workloads |
| `lfu` | Least Frequently Used | Skewed access patterns |
| `fifo` | First In First Out | Time-series data |
| `random` | Random eviction | Uniform access |

### Promotion Policies

```toml
[storage.tiers.warm]
promotion_policy = "access"  # Options: access, threshold, manual
promotion_threshold = 3       # Accesses before promotion

[storage.tiers.cold]
promotion_policy = "access"
promotion_threshold = 2
```

### Demotion Policies

```toml
[storage.tiers.hot]
# Time-based demotion
demotion_policy = "age"
max_age_seconds = 3600  # Demote after 1 hour without access

# Or access-based
demotion_policy = "idle"
idle_threshold_seconds = 300
```

## Key-Level Tier Control

### Tier Hints

```bash
# Set key with tier hint
SET mykey "value" TIER HOT

# Pin key to hot tier (never demote)
SET important_key "value" TIER HOT PIN

# Force to cold tier (archival)
SET archive_key "value" TIER COLD
```

### Tier Queries

```bash
# Get current tier for a key
DEBUG TIER mykey
# Output: "hot"

# Get tier statistics
INFO tiers
# Output:
# hot_keys: 1234567
# hot_memory: 4.2GB
# warm_keys: 5678901
# warm_size: 45GB
# cold_keys: 12345678
# cold_size: 450GB
```

## Performance Optimization

### Read Path Optimization

```toml
[storage]
# Prefetch from warm/cold tiers
prefetch_enabled = true
prefetch_size = 64  # Keys to prefetch

# Read-ahead for sequential access
readahead_enabled = true
readahead_size = "1MB"

# Bloom filters for cold tier
bloom_filter_enabled = true
bloom_filter_fp_rate = 0.01
```

### Write Path Optimization

```toml
[storage]
# Batch writes to cold tier
cold_write_batch_size = 1000
cold_write_interval_ms = 100

# Compression for cold tier
cold_compression = "zstd"
cold_compression_level = 3
```

### Memory Management

```toml
[storage.tiers.hot]
# Reserve memory for index
index_memory_ratio = 0.2  # 20% for index

# Memory allocation strategy
allocation = "jemalloc"

# Huge pages for large datasets
huge_pages = true
```

## Monitoring

### Tier Metrics

```bash
ferrite-cli INFO tiers
```

Output:
```
# Hot Tier
hot_tier_keys: 1234567
hot_tier_bytes: 4521234567
hot_tier_hit_rate: 0.95
hot_tier_evictions: 12345

# Warm Tier
warm_tier_keys: 5678901
warm_tier_bytes: 48318234567
warm_tier_hit_rate: 0.85
warm_tier_promotions: 5678
warm_tier_demotions: 6789

# Cold Tier
cold_tier_keys: 12345678
cold_tier_bytes: 483182345670
cold_tier_reads: 1234
cold_tier_writes: 567
```

### Prometheus Metrics

```
# Tier sizes
ferrite_tier_keys{tier="hot"} 1234567
ferrite_tier_keys{tier="warm"} 5678901
ferrite_tier_keys{tier="cold"} 12345678

ferrite_tier_bytes{tier="hot"} 4521234567
ferrite_tier_bytes{tier="warm"} 48318234567
ferrite_tier_bytes{tier="cold"} 483182345670

# Tier operations
ferrite_tier_hits_total{tier="hot"} 98765432
ferrite_tier_hits_total{tier="warm"} 12345678
ferrite_tier_hits_total{tier="cold"} 123456

ferrite_tier_promotions_total{from="warm",to="hot"} 5678
ferrite_tier_demotions_total{from="hot",to="warm"} 6789

# Latency by tier
ferrite_read_latency_seconds{tier="hot",quantile="0.99"} 0.0001
ferrite_read_latency_seconds{tier="warm",quantile="0.99"} 0.003
ferrite_read_latency_seconds{tier="cold",quantile="0.99"} 0.025
```

## Cost Optimization

### Estimating Costs

| Tier | Storage Cost | Access Cost | Monthly Cost (100GB) |
|------|--------------|-------------|---------------------|
| Hot (Memory) | $8/GB | Negligible | $800 |
| Warm (SSD) | $0.10/GB | Negligible | $10 |
| Cold (S3) | $0.023/GB | $0.0004/1K reads | $2.30 + access |

### Optimization Strategies

```toml
# Aggressive demotion for cost savings
[storage.tiers.hot]
max_size = "2GB"  # Smaller hot tier
demotion_policy = "age"
max_age_seconds = 300  # Quick demotion

# Use S3 Intelligent-Tiering
[storage.tiers.cold.s3]
storage_class = "INTELLIGENT_TIERING"

# Compress cold data
[storage.tiers.cold]
compression = "zstd"
compression_level = 9  # Maximum compression
```

### Access Pattern Analysis

```bash
# Analyze access patterns
ferrite-cli DEBUG ACCESSPATTERNS

# Output:
# Key pattern     Hot%   Warm%  Cold%  Recommendation
# user:*          85%    12%    3%     Keep hot tier size
# session:*       95%    5%     0%     Consider pinning to hot
# logs:*          5%     15%    80%    Move to cold faster
# cache:*         99%    1%     0%     Already optimal
```

## Data Lifecycle

### TTL Integration

```toml
[storage]
# Expire keys in cold tier without loading
lazy_expire_cold = true

# Scan cold tier for expiration
cold_expire_scan_interval = 3600  # Every hour
```

### Archival Policies

```toml
[storage.archival]
enabled = true

# Archive keys older than 30 days
archive_after_days = 30

# Archive to separate S3 bucket
archive_backend = "s3"
archive_bucket = "ferrite-archive"
archive_storage_class = "GLACIER"
```

## Disaster Recovery

### Tier-Aware Backups

```toml
[backup]
# Only backup cold tier to S3 (hot/warm will rebuild)
tiers = ["cold"]

# Or full backup
tiers = ["hot", "warm", "cold"]
```

### Recovery Priority

```toml
[recovery]
# Restore hot tier first for faster startup
tier_priority = ["hot", "warm", "cold"]

# Lazy load cold tier
lazy_load_cold = true
```

## Use Cases

### High-Performance Caching

```toml
# Maximize hot tier, minimal cold storage
[storage.tiers.hot]
max_size = "32GB"
eviction_policy = "lfu"

[storage.tiers.warm]
enabled = true
max_size = "100GB"

[storage.tiers.cold]
enabled = false  # No cold tier needed
```

### Cost-Optimized Storage

```toml
# Minimal hot tier, maximize cold storage
[storage.tiers.hot]
max_size = "4GB"
demotion_policy = "age"
max_age_seconds = 60

[storage.tiers.warm]
enabled = true
max_size = "50GB"

[storage.tiers.cold]
enabled = true
backend = "s3"
storage_class = "GLACIER_IR"
```

### Time-Series Workload

```toml
# Recent data hot, historical cold
[storage.tiers.hot]
max_size = "16GB"
eviction_policy = "fifo"

[storage.tiers.warm]
enabled = true
max_size = "200GB"

[storage.tiers.cold]
enabled = true
backend = "s3"
compression = "zstd"
```

## Troubleshooting

### High Cold Tier Latency

```bash
# Check cold tier performance
ferrite-cli DEBUG TIER cold

# Possible causes:
# - Network latency to S3
# - Too many cold reads
# - No read caching

# Solutions:
# - Enable read cache
# - Adjust promotion policy
# - Use regional S3 bucket
```

### Memory Pressure

```bash
# Check eviction rate
ferrite-cli INFO tiers | grep evictions

# If too high:
# - Increase hot tier size
# - Enable warm tier
# - Tune eviction policy
```

## See Also

- [HybridLog Internals](/docs/internals/hybridlog)
- [Performance Tuning](/docs/operations/performance-tuning)
- [Backup and Restore](/docs/operations/backup-restore)
