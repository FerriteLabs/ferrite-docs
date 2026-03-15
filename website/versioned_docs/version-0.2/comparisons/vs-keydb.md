---
sidebar_position: 3
description: Detailed comparison between Ferrite and KeyDB, covering threading models, storage architecture, and feature differences.
maturity: stable
---

# Ferrite vs KeyDB

KeyDB is a multi-threaded Redis fork that improves on Redis's single-threaded architecture. This comparison helps you understand when Ferrite or KeyDB better fits your needs.

## Quick Comparison

| Feature | Ferrite | KeyDB |
|---------|---------|-------|
| **Base** | Ground-up Rust implementation | Redis fork (C) |
| **Threading** | Multi-threaded + sharded | Multi-threaded Redis |
| **Storage** | Tiered (Memory + Disk) | Memory-first |
| **Data Models** | Multi-model (6+) | Redis-compatible |
| **Vector Search** | Built-in | Not available |
| **Query Language** | FerriteQL | Redis commands |
| **Active-Active** | Raft consensus | CRDT-based |
| **License** | Apache 2.0 | BSD 3-Clause |

## Architecture Comparison

### KeyDB Architecture

KeyDB extends Redis with multi-threading:

```
┌─────────────────────────────────────────────┐
│                KeyDB Server                  │
├─────────────────────────────────────────────┤
│                                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│  │ Thread 0 │  │ Thread 1 │  │ Thread N │  │
│  │  (I/O)   │  │  (I/O)   │  │  (I/O)   │  │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  │
│       │             │             │         │
│       └─────────────┼─────────────┘         │
│                     ▼                       │
│  ┌─────────────────────────────────────┐   │
│  │     Shared Data Structures          │   │
│  │     (with spinlocks)                │   │
│  └─────────────────────────────────────┘   │
│                                             │
│  ┌─────────────────────────────────────┐   │
│  │          Memory (All Data)          │   │
│  └─────────────────────────────────────┘   │
└─────────────────────────────────────────────┘
```

**Key characteristics:**
- Multiple I/O threads share data structures
- Spinlocks for thread synchronization
- All data in memory
- Fork-based persistence

### Ferrite Architecture

Ferrite uses epoch-based concurrency with tiered storage:

```
┌─────────────────────────────────────────────┐
│                Ferrite Server                │
├─────────────────────────────────────────────┤
│  ┌────────┐ ┌────────┐ ┌────────┐          │
│  │ Shard 0│ │ Shard 1│ │ Shard N│  ...     │
│  │Thread 0│ │Thread 1│ │Thread N│          │
│  └───┬────┘ └───┬────┘ └───┬────┘          │
│      │          │          │                │
│      ▼          ▼          ▼                │
│  ┌─────────────────────────────────────┐   │
│  │   Epoch-based Concurrency Control   │   │
│  │   (Lock-free reads, RCU updates)    │   │
│  └─────────────────────────────────────┘   │
│                                             │
│  ┌─────────────────────────────────────┐   │
│  │  HOT TIER  │  WARM TIER  │  COLD    │   │
│  │  (Memory)  │   (mmap)    │ (Disk)   │   │
│  └─────────────────────────────────────┘   │
└─────────────────────────────────────────────┘
```

**Key characteristics:**
- Each shard owned by dedicated thread
- Epoch-based reclamation (no locks on read path)
- Tiered storage for datasets larger than RAM
- io_uring for async I/O

## Threading Model

### KeyDB Threading

```
Client Request → I/O Thread → Acquire Lock → Process → Release Lock → Response
                              ↑
                              └─ Contention point
```

**Pros:**
- Simple upgrade from Redis (same codebase)
- Better utilization than single-threaded Redis

**Cons:**
- Lock contention under high load
- All threads compete for same data structures

### Ferrite Threading

```
Client Request → Route to Shard → Shard Thread → Process → Response
                      │
                      └─ Based on key hash, no cross-shard locking
```

**Pros:**
- No lock contention within shard
- Predictable latency
- Better CPU cache locality

**Cons:**
- Cross-shard operations require coordination

## Performance Comparison

### Single-Node Throughput

| Operation | Ferrite | KeyDB | Redis |
|-----------|---------|-------|-------|
| GET | ~800K ops/s | ~600K ops/s | ~150K ops/s |
| SET | ~600K ops/s | ~500K ops/s | ~120K ops/s |
| MGET (10) | ~150K ops/s | ~100K ops/s | ~50K ops/s |
| Pipeline | ~2M ops/s | ~1.5M ops/s | ~500K ops/s |

### Latency Under Load

| Percentile | Ferrite | KeyDB |
|------------|---------|-------|
| P50 | 0.2ms | 0.3ms |
| P99 | 0.8ms | 1.5ms |
| P99.9 | 1.2ms | 5ms |

KeyDB shows higher tail latencies due to lock contention at high throughput.

### Multi-Core Scaling

| Cores | Ferrite Throughput | KeyDB Throughput |
|-------|-------------------|------------------|
| 4 | 600K ops/s | 400K ops/s |
| 8 | 1.1M ops/s | 650K ops/s |
| 16 | 2M ops/s | 900K ops/s |
| 32 | 3.5M ops/s | 1.2M ops/s |

Ferrite scales more linearly due to sharded architecture.

## Feature Comparison

### Data Models

| Feature | Ferrite | KeyDB |
|---------|---------|-------|
| String/List/Set/Hash | ✅ | ✅ |
| Sorted Sets | ✅ | ✅ |
| Streams | ✅ | ✅ |
| JSON Documents | ✅ Native | ❌ |
| Graph | ✅ Native | ❌ |
| Time-Series | ✅ Native | ❌ |
| Vector Search | ✅ Native | ❌ |
| CRDTs | ✅ Native | ❌ |
| Full-Text Search | ✅ Native | ❌ |

### Query Language

**KeyDB:**
```bash
# Standard Redis commands only
GET user:1
HGETALL user:1
ZRANGE leaderboard 0 10 WITHSCORES
```

**Ferrite (FerriteQL):**
```sql
-- SQL-like queries
SELECT id, name, email
FROM users:*
WHERE status = 'active'
LIMIT 100;

-- Aggregations
SELECT category, COUNT(*), AVG(price)
FROM products:*
GROUP BY category;

-- Vector similarity
SELECT id, title
FROM articles
ORDER BY VECTOR_DISTANCE(embedding, $query)
LIMIT 10;
```

### Replication and HA

**KeyDB Active-Active:**
```bash
# KeyDB active-replica (multi-master)
keydb-server --active-replica yes \
  --replicaof node1 6379 \
  --replicaof node2 6379
```

- CRDT-based conflict resolution
- Active-active replication
- Eventually consistent

**Ferrite Replication:**
```toml
# ferrite.toml
[cluster]
enabled = true
replication_factor = 3

[cluster.consensus]
protocol = "raft"  # Strong consistency
```

- Raft consensus for leader election
- Configurable consistency levels
- Strong consistency option

### Multi-Tenancy

**KeyDB:**
- No built-in multi-tenancy
- Separate instances required

**Ferrite:**
```bash
TENANT.CREATE company_a
  MEMORY_LIMIT 2gb
  OPS_LIMIT 10000
  CONNECTIONS_LIMIT 50

TENANT.USE company_a
# All operations isolated
```

## Storage Comparison

### KeyDB Storage

```yaml
# keydb.conf
# All data must fit in memory
maxmemory 64gb
maxmemory-policy allkeys-lru

# Persistence options
save 900 1          # RDB snapshot
appendonly yes      # AOF
```

**Limitations:**
- Dataset must fit in RAM
- LRU eviction loses data
- Fork-based snapshots cause memory spike

### Ferrite Storage

```toml
# ferrite.toml
[storage]
hot_tier_size = "16GB"      # Fast in-memory
warm_tier_size = "64GB"     # Memory-mapped
cold_tier_path = "/data"    # Disk storage

[tiering]
promotion_threshold = 0.8   # Promote hot data
demotion_threshold = 0.2    # Demote cold data
```

**Advantages:**
- Dataset can exceed RAM
- Automatic hot/cold tiering
- No data loss from eviction
- Cloud archival support

## Clustering

### KeyDB Clustering

KeyDB supports Redis Cluster protocol:

```bash
# Create cluster
keydb-cli --cluster create \
  node1:6379 node2:6379 node3:6379 \
  --cluster-replicas 1
```

**Characteristics:**
- Redis Cluster compatible
- 16384 hash slots
- Manual resharding
- No cross-slot transactions

### Ferrite Clustering

```toml
# ferrite.toml
[cluster]
enabled = true
node_id = "node-1"
seeds = ["node-2:7000", "node-3:7000"]

[cluster.sharding]
auto_rebalance = true
live_migration = true

[cluster.transactions]
cross_shard = true  # 2PC support
```

**Characteristics:**
- Automatic rebalancing
- Live migration without downtime
- Cross-shard transactions
- Configurable consistency

## FLASH/Tiered Storage

### KeyDB FLASH

KeyDB offers FLASH storage (Enterprise feature):

```bash
# KeyDB Enterprise only
keydb-server --storage-provider flash \
  --flash-dir /mnt/nvme
```

### Ferrite Tiered Storage

```toml
# Open source feature
[storage]
tiering_enabled = true
hot_tier_size = "16GB"
cold_tier_path = "/mnt/nvme"

[tiering]
compression = "lz4"
cloud_enabled = true
cloud_bucket = "s3://archive"
```

**Ferrite advantages:**
- Open source (not enterprise-only)
- Multiple tiers (hot/warm/cold/archive)
- Cloud integration built-in

## When to Choose

### Choose Ferrite When:

1. **Multi-model needs**: Document, graph, vector, time-series

2. **Dataset exceeds RAM**: Tiered storage handles overflow

3. **SQL queries needed**: FerriteQL for complex operations

4. **Predictable latency**: Sharded architecture avoids contention

5. **Strong consistency**: Raft consensus option

6. **Multi-tenancy**: Native tenant isolation

7. **Modern stack**: Rust, io_uring, memory safety

### Choose KeyDB When:

1. **Redis codebase familiarity**: Same code, just multi-threaded

2. **Active-active replication**: CRDT-based conflict resolution

3. **Simple Redis upgrade**: Minimal migration effort

4. **Existing Redis modules**: Some compatibility

5. **BSD license preference**: Simpler than AGPL alternatives

## Migration Path

Both are Redis-compatible, making migration straightforward:

```python
import redis

# Same client works for both
keydb = redis.Redis(host='keydb-host', port=6379)
ferrite = redis.Redis(host='ferrite-host', port=6379)

# Standard operations identical
for client in [keydb, ferrite]:
    client.set('key', 'value')
    client.get('key')
    client.lpush('list', 'item')
    client.zadd('sorted', {'member': 1.0})
```

### KeyDB to Ferrite Migration

```bash
# Sync data from KeyDB to Ferrite
ferrite-migrate sync \
  --source redis://keydb:6379 \
  --target ferrite://ferrite:6379 \
  --live

# Verify data integrity
ferrite-migrate verify \
  --source redis://keydb:6379 \
  --target ferrite://ferrite:6379
```

## Summary Table

| Aspect | Ferrite | KeyDB |
|--------|---------|-------|
| **Performance** | Better scaling | Good single-node |
| **Latency** | Lower P99 | Higher tail latency |
| **Storage** | Tiered | Memory-only |
| **Features** | Multi-model | Redis-compatible |
| **Queries** | FerriteQL | Commands only |
| **Replication** | Raft (strong) | CRDT (eventual) |
| **Multi-tenancy** | Native | Not built-in |
| **License** | Apache 2.0 | BSD 3-Clause |

## Related Resources

- [Ferrite vs Redis](/docs/comparisons/vs-redis)
- [Ferrite vs Dragonfly](/docs/comparisons/vs-dragonfly)
- [Migration from Redis](/docs/migration/from-redis)
- [Clustering Guide](/docs/advanced/clustering)
