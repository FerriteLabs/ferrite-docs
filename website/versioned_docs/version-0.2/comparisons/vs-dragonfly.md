---
sidebar_position: 2
description: Detailed comparison between Ferrite and Dragonfly, covering architecture, tiered storage vs in-memory, multi-model support, and performance.
maturity: stable
---

# Ferrite vs Dragonfly

Dragonfly is a Redis-compatible in-memory datastore focused on vertical scaling. This comparison helps you understand the architectural differences and when each solution fits best.

## Quick Comparison

| Feature | Ferrite | Dragonfly |
|---------|---------|-----------|
| **Architecture** | Tiered storage (HybridLog) | Shared-nothing memory |
| **Storage** | Memory + Disk + Cloud | Memory only |
| **Data Models** | Multi-model (6+) | Redis-compatible |
| **Vector Search** | Built-in | Not available |
| **Query Language** | FerriteQL (SQL-like) | Redis commands only |
| **Multi-Tenancy** | Native | Not built-in |
| **Persistence** | AOF + Checkpoints + Tiering | Snapshot + AOF |
| **License** | Apache 2.0 | BSL 1.1 |
| **Language** | Rust | C++ |

## Architecture Comparison

### Dragonfly Architecture

Dragonfly uses a shared-nothing architecture optimized for multi-core systems:

```
┌───────────────────────────────────────────────┐
│                 Dragonfly Node                 │
├───────────────────────────────────────────────┤
│  ┌─────────┐ ┌─────────┐ ┌─────────┐         │
│  │ Shard 0 │ │ Shard 1 │ │ Shard N │  ...    │
│  │ (Core 0)│ │ (Core 1)│ │ (Core N)│         │
│  └────┬────┘ └────┬────┘ └────┬────┘         │
│       │           │           │               │
│       ▼           ▼           ▼               │
│  ┌─────────────────────────────────────┐     │
│  │         Memory (All Data)           │     │
│  └─────────────────────────────────────┘     │
├───────────────────────────────────────────────┤
│  ┌─────────────────────────────────────┐     │
│  │         Disk (Persistence)          │     │
│  └─────────────────────────────────────┘     │
└───────────────────────────────────────────────┘
```

**Key characteristics:**
- Each CPU core owns a shard
- Lock-free within shards
- All data must fit in memory
- Optimized for high core count machines

### Ferrite Architecture

Ferrite uses HybridLog tiered storage inspired by Microsoft FASTER:

```
┌───────────────────────────────────────────────┐
│                 Ferrite Node                   │
├───────────────────────────────────────────────┤
│  ┌─────────────────────────────────────┐     │
│  │    HOT TIER (In-Memory Region)      │     │
│  │    - Frequently accessed data       │     │
│  │    - In-place updates               │     │
│  │    - Sub-millisecond latency        │     │
│  └─────────────────────────────────────┘     │
│  ┌─────────────────────────────────────┐     │
│  │    WARM TIER (Memory-Mapped)        │     │
│  │    - Read-heavy data                │     │
│  │    - Zero-copy reads                │     │
│  │    - Copy-on-write updates          │     │
│  └─────────────────────────────────────┘     │
│  ┌─────────────────────────────────────┐     │
│  │    COLD TIER (io_uring/Disk)        │     │
│  │    - Rarely accessed data           │     │
│  │    - Async I/O                      │     │
│  │    - Compression enabled            │     │
│  └─────────────────────────────────────┘     │
├───────────────────────────────────────────────┤
│  ┌─────────────────────────────────────┐     │
│  │    ARCHIVE TIER (S3/GCS/Azure)      │     │
│  │    - Long-term storage              │     │
│  │    - Cost-optimized                 │     │
│  └─────────────────────────────────────┘     │
└───────────────────────────────────────────────┘
```

**Key characteristics:**
- Data automatically tiered by access pattern
- Datasets can exceed available RAM
- Epoch-based concurrency control
- io_uring for async disk I/O

## Performance Comparison

### Memory-Resident Workloads

When all data fits in memory, both systems perform similarly:

| Operation | Ferrite | Dragonfly | Notes |
|-----------|---------|-----------|-------|
| GET | ~800K ops/s | ~900K ops/s | Hot tier comparable |
| SET | ~600K ops/s | ~750K ops/s | Dragonfly slightly faster |
| MGET (10 keys) | ~150K ops/s | ~180K ops/s | Batch operations |
| Pipeline (100) | ~2M ops/s | ~2.5M ops/s | Pipelining |

### Mixed Workloads (Hot/Cold Data)

When dataset exceeds memory or has mixed access patterns:

| Scenario | Ferrite | Dragonfly |
|----------|---------|-----------|
| 50GB data, 16GB RAM | ✅ Works | ❌ OOM |
| 80% hot, 20% cold | 750K ops/s | N/A |
| Historical queries | Async I/O | N/A |
| Archive to S3 | ✅ Built-in | ❌ Manual |

### Large Value Handling

| Value Size | Ferrite | Dragonfly |
|------------|---------|-----------|
| < 1KB | Similar | Similar |
| 1KB - 1MB | Tiering helps | Memory pressure |
| > 1MB | Cold tier | Memory issues |

## Feature Comparison

### Data Structure Support

| Data Type | Ferrite | Dragonfly |
|-----------|---------|-----------|
| Strings | ✅ | ✅ |
| Lists | ✅ | ✅ |
| Sets | ✅ | ✅ |
| Sorted Sets | ✅ | ✅ |
| Hashes | ✅ | ✅ |
| Streams | ✅ | ✅ |
| JSON Documents | ✅ Native | ❌ |
| Graphs | ✅ Native | ❌ |
| Time-Series | ✅ Native | ❌ |
| Vectors | ✅ Native | ❌ |
| CRDTs | ✅ Native | ❌ |

### Query Capabilities

**Dragonfly:**
```bash
# Standard Redis commands
GET user:1
HGETALL user:1
ZRANGEBYSCORE scores 0 100
```

**Ferrite (FerriteQL):**
```sql
-- SQL-like queries
SELECT * FROM users:* WHERE status = 'active';

-- Aggregations
SELECT category, SUM(amount)
FROM orders:*
GROUP BY category;

-- Vector search
SELECT * FROM products
WHERE VECTOR_SIMILARITY(embedding, $query) > 0.8;
```

### Multi-Model Support

**Ferrite:**
```bash
# Document operations
DOC.INSERT users '{"name": "Alice", "email": "alice@example.com"}'
DOC.FIND users '{"status": "active"}'

# Graph operations
GRAPH.VERTEX.ADD social user:1 '{"name": "Alice"}'
GRAPH.EDGE.ADD social user:1 user:2 FOLLOWS

# Time-series
TIMESERIES.ADD metrics:cpu * 85.5
TIMESERIES.RANGE metrics:cpu - + AGGREGATION avg 60000

# Vector search
VECTOR.SEARCH embeddings [0.1, 0.2, ...] 10
```

**Dragonfly:**
- Redis-compatible commands only
- No native document, graph, or vector support

### Multi-Tenancy

**Ferrite:**
```bash
# Create tenant with resource limits
TENANT.CREATE acme MEMORY_LIMIT 2gb RATE_LIMIT 5000

# Tenant isolation
TENANT.USE acme
SET key value  # Isolated to acme namespace

# Monitoring per tenant
TENANT.STATS acme
```

**Dragonfly:**
- No built-in multi-tenancy
- Requires separate instances for isolation

## Storage and Persistence

### Dragonfly Persistence

```yaml
# dragonfly.conf
dbfilename dump.rdb
dir /data

# Snapshot settings
snapshot_cron "0 */6 * * *"  # Every 6 hours

# AOF (append-only file)
aof true
aof_fsync always  # or everysec
```

**Characteristics:**
- Traditional RDB snapshots
- AOF for durability
- Fork-based snapshotting (memory spike)
- All data must fit in RAM

### Ferrite Persistence

```toml
# ferrite.toml
[storage]
hot_tier_size = "16GB"
warm_tier_size = "64GB"
cold_tier_path = "/data/cold"

[persistence]
aof_enabled = true
aof_fsync = "everysec"
checkpoint_interval = "1h"
checkpoint_type = "forkless"  # No memory spike

[tiering]
cloud_enabled = true
cloud_provider = "s3"
cloud_bucket = "ferrite-archive"
archive_after = "30d"
```

**Characteristics:**
- Fork-less checkpoints (no memory spike)
- Automatic tiering to disk
- Cloud archival for cold data
- Point-in-time recovery

## Clustering

### Dragonfly Clustering

```yaml
# Primary node
--cluster_mode=emulated  # Redis cluster compatible
--cluster_announce_ip=node1

# Replication
--replicaof primary:6379
```

**Characteristics:**
- Emulated Redis cluster mode
- Primary-replica replication
- Manual failover
- Vertical scaling focus

### Ferrite Clustering

```toml
# ferrite.toml
[cluster]
enabled = true
node_id = "node-1"
seeds = ["node-2:7000", "node-3:7000"]

[cluster.sharding]
slots = 16384
replication_factor = 3
auto_rebalance = true

[cluster.consensus]
protocol = "raft"
election_timeout = "500ms"
```

**Characteristics:**
- Native distributed mode
- Automatic resharding
- Raft consensus for leader election
- Cross-shard transactions
- Geo-distributed deployments

## Cost Comparison

### Infrastructure Costs (100GB Dataset)

| Solution | Memory Required | Instance Type | Monthly Cost* |
|----------|----------------|---------------|---------------|
| Dragonfly | 100GB+ RAM | r6g.4xlarge | ~$800 |
| Ferrite (tiered) | 20GB RAM + SSD | r6g.xlarge + io1 | ~$350 |

*Approximate AWS costs, varies by region

### Total Cost of Ownership

| Factor | Ferrite | Dragonfly |
|--------|---------|-----------|
| Memory costs | Lower (tiering) | Higher (all RAM) |
| Additional modules | Included | N/A |
| Multi-tenancy infra | Single cluster | Multiple instances |
| Cold storage | S3 integration | External solution |

## When to Choose

### Choose Ferrite When:

1. **Dataset may exceed RAM**: Tiered storage handles overflow

2. **Multi-model required**: Document, graph, vector, time-series

3. **Multi-tenancy needed**: Native tenant isolation

4. **SQL queries desired**: FerriteQL for complex queries

5. **Cost optimization**: Tiered storage reduces infrastructure costs

6. **Long-term archival**: Built-in cloud tiering

### Choose Dragonfly When:

1. **Pure in-memory workload**: All data fits comfortably in RAM

2. **Maximum single-node throughput**: Optimized vertical scaling

3. **Simple Redis replacement**: No additional features needed

4. **High core count machines**: Excellent multi-core utilization

5. **Existing Redis tooling**: Full compatibility required

## Migration Considerations

Both Ferrite and Dragonfly are Redis-compatible:

```python
# Same client code works for both
import redis

# Works with Dragonfly
dragonfly_client = redis.Redis(host='dragonfly', port=6379)

# Works with Ferrite
ferrite_client = redis.Redis(host='ferrite', port=6379)

# Standard operations work identically
for client in [dragonfly_client, ferrite_client]:
    client.set('key', 'value')
    client.get('key')
```

## Related Resources

- [Ferrite vs Redis](/docs/comparisons/vs-redis)
- [Ferrite vs KeyDB](/docs/comparisons/vs-keydb)
- [Migration from Redis](/docs/migration/from-redis)
- [Performance Tuning](/docs/operations/performance-tuning)
