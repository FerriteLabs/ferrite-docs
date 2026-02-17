---
sidebar_position: 1
title: Ferrite vs Redis Comparison
description: In-depth comparison between Ferrite and Redis, covering compatibility, extended features, storage architecture, and performance.
keywords: [ferrite vs redis, redis alternative, redis comparison, key-value database comparison, when to use ferrite]
maturity: stable
---

# Ferrite vs Redis

Ferrite is designed as a Redis-compatible database with enhanced capabilities. This guide provides an in-depth comparison to help you understand when Ferrite offers advantages over Redis.

## Quick Comparison

| Feature | Ferrite | Redis |
|---------|---------|-------|
| **Redis Protocol** | RESP2/RESP3 compatible | Native |
| **Data Structures** | All Redis types + extensions | Standard types |
| **Multi-Model** | Document, Graph, Time-Series, Vector | Redis Modules |
| **Storage** | Tiered (Memory + Disk) | Memory-first |
| **Persistence** | AOF + Checkpoints | AOF + RDB |
| **Vector Search** | Built-in HNSW/IVF | RediSearch module |
| **Query Language** | FerriteQL (SQL-like) | Basic |
| **Multi-Tenancy** | Native | Not built-in |
| **License** | Apache 2.0 | RSALv2/SSPL |

## Feature Comparison

### Core Data Structures

Both Ferrite and Redis support the same fundamental data structures:

| Data Type | Ferrite | Redis |
|-----------|---------|-------|
| Strings | ✅ | ✅ |
| Lists | ✅ | ✅ |
| Sets | ✅ | ✅ |
| Sorted Sets | ✅ | ✅ |
| Hashes | ✅ | ✅ |
| Streams | ✅ | ✅ |
| HyperLogLog | ✅ | ✅ |
| Bitmaps | ✅ | ✅ |
| Geospatial | ✅ | ✅ |
| Pub/Sub | ✅ | ✅ |

### Extended Data Models

Ferrite extends beyond Redis with native multi-model support:

| Model | Ferrite | Redis |
|-------|---------|-------|
| JSON Documents | Native DOC.* commands | RedisJSON module |
| Graph | Native GRAPH.* commands | RedisGraph module (discontinued) |
| Time-Series | Native TIMESERIES.* commands | RedisTimeSeries module |
| Vector Search | Native VECTOR.* commands | RediSearch module |
| Full-Text Search | Native SEARCH.* commands | RediSearch module |
| CRDTs | Native CRDT.* commands | Not available |

### Storage Architecture

**Redis:**
```
┌─────────────────────────────────────┐
│           Memory (RAM)              │
│  ┌─────────────────────────────┐    │
│  │    All Data (Hot + Cold)   │    │
│  └─────────────────────────────┘    │
├─────────────────────────────────────┤
│        Persistence (Disk)           │
│  ┌─────────────┬───────────────┐    │
│  │    RDB     │     AOF       │    │
│  │  Snapshots │  Append Log   │    │
│  └─────────────┴───────────────┘    │
└─────────────────────────────────────┘
```

**Ferrite (HybridLog):**
```
┌─────────────────────────────────────┐
│         HOT TIER (Memory)           │
│  ┌─────────────────────────────┐    │
│  │  Frequently Accessed Data   │    │
│  │  In-place Updates, <1ms     │    │
│  └─────────────────────────────┘    │
├─────────────────────────────────────┤
│        WARM TIER (mmap)             │
│  ┌─────────────────────────────┐    │
│  │   Read-mostly Data          │    │
│  │   Zero-copy Reads           │    │
│  └─────────────────────────────┘    │
├─────────────────────────────────────┤
│        COLD TIER (io_uring)         │
│  ┌─────────────────────────────┐    │
│  │   Rarely Accessed Data      │    │
│  │   Async I/O, Compressed     │    │
│  └─────────────────────────────┘    │
└─────────────────────────────────────┘
```

**Key Differences:**
- **Redis**: All data must fit in memory; disk is only for persistence
- **Ferrite**: Tiered storage allows datasets larger than RAM with automatic data movement

### Query Capabilities

**Redis:**
```bash
# Basic key-value operations
GET user:1
HGET user:1 email
ZRANGEBYSCORE leaderboard 100 200

# Lua scripting for complex queries
EVAL "local v = redis.call('GET', KEYS[1]); return v" 1 mykey
```

**Ferrite (FerriteQL):**
```sql
-- SQL-like queries across keys
SELECT user_id, email, created_at
FROM users:*
WHERE status = 'active'
ORDER BY created_at DESC
LIMIT 10;

-- Aggregations
SELECT category, COUNT(*), AVG(price)
FROM products:*
GROUP BY category;

-- Joins
SELECT o.*, u.name
FROM orders:* o
JOIN users:* u ON o.user_id = u.id;
```

### Vector Search

**Redis (RediSearch):**
```bash
# Create index with separate module
FT.CREATE idx ON HASH PREFIX 1 doc: SCHEMA
  embedding VECTOR HNSW 6 DIM 768 DISTANCE_METRIC COSINE

# Search
FT.SEARCH idx "*=>[KNN 10 @embedding $vec]"
  PARAMS 2 vec "\x00\x01..." DIALECT 2
```

**Ferrite (Built-in):**
```bash
# Native vector commands
VECTOR.INDEX.CREATE embeddings DIM 768 METRIC cosine ALGORITHM hnsw

# Semantic search with text
SEMANTIC.SEARCH embeddings "What is machine learning?" 10

# With filters
VECTOR.SEARCH embeddings $embedding 10
  FILTER "category = 'science' AND year > 2020"
```

### Multi-Tenancy

**Redis:**
- Database selection (SELECT 0-15) with shared memory
- No resource isolation between tenants
- Requires separate instances for true isolation

**Ferrite:**
```bash
# Create isolated tenant
TENANT.CREATE acme_corp
  MEMORY_LIMIT 1gb
  CONNECTIONS_LIMIT 100
  OPS_LIMIT 10000

# Switch context
TENANT.USE acme_corp

# All subsequent commands isolated to tenant
SET user:1 "data"  # Stored as acme_corp:user:1

# Resource monitoring
TENANT.STATS acme_corp
```

### Persistence

**Redis Persistence Options:**

| Option | Durability | Performance | Use Case |
|--------|-----------|-------------|----------|
| No persistence | None | Fastest | Cache only |
| RDB only | Low | Fast | Periodic backups |
| AOF everysec | Medium | Good | Balanced |
| AOF always | High | Slower | Maximum durability |

**Ferrite Persistence:**

| Feature | Description |
|---------|-------------|
| **AOF** | Append-only file with configurable sync |
| **Checkpoints** | Fork-less snapshots (no memory spike) |
| **Tiered Storage** | Cold data persisted automatically |
| **Point-in-time Recovery** | Restore to any timestamp |
| **Cloud Tiering** | Automatic S3/GCS/Azure archival |

### Clustering

**Redis Cluster:**
- 16384 hash slots
- Manual resharding
- Client-side routing or proxy
- No cross-slot transactions

**Ferrite Cluster:**
- Configurable slot count
- Automatic resharding with live migration
- Built-in proxy mode
- Cross-shard transactions (2PC)
- Geo-distributed deployment support

## Performance Comparison

### Single-Node Throughput

| Operation | Ferrite | Redis | Notes |
|-----------|---------|-------|-------|
| GET (cache hit) | ~800K ops/s | ~750K ops/s | Memory tier |
| SET | ~600K ops/s | ~650K ops/s | Comparable |
| GET (warm) | ~500K ops/s | N/A | mmap tier |
| GET (cold) | ~100K ops/s | N/A | io_uring async |
| HSET | ~550K ops/s | ~500K ops/s | Comparable |
| Vector Search | ~50K qps | ~30K qps | HNSW index |

### Memory Efficiency

| Scenario | Ferrite | Redis |
|----------|---------|-------|
| 10M string keys | ~3.2 GB | ~4.5 GB |
| 10M hash keys | ~3.5 GB | ~5.2 GB |
| With compression | ~1.8 GB | N/A |
| Tiered (20% hot) | ~0.8 GB RAM | ~4.5 GB RAM |

### Large Dataset Handling

**100GB Dataset:**
- **Redis**: Requires 100GB+ RAM, expensive
- **Ferrite**: 20GB RAM (hot tier) + disk, cost-effective

## Migration Path

### Compatibility Layer

Ferrite supports the Redis protocol, allowing most Redis clients to work without modification:

```python
# Python - redis-py works unchanged
import redis
client = redis.Redis(host='ferrite-host', port=6379)
client.set('key', 'value')
client.get('key')
```

```javascript
// Node.js - ioredis works unchanged
const Redis = require('ioredis');
const client = new Redis(6379, 'ferrite-host');
await client.set('key', 'value');
await client.get('key');
```

### Command Compatibility

```bash
# All standard commands work
SET key value
GET key
HSET user:1 name "Alice"
LPUSH queue item1
ZADD leaderboard 100 player1
PUBLISH channel message

# Lua scripting works
EVAL "return redis.call('GET', KEYS[1])" 1 mykey

# Transactions work
MULTI
SET a 1
SET b 2
EXEC
```

### Migration Tools

```bash
# Live sync from Redis to Ferrite
ferrite-migrate sync \
  --source redis://old-redis:6379 \
  --target ferrite://new-ferrite:6379 \
  --live

# Verify compatibility
ferrite-migrate verify \
  --source redis://old-redis:6379 \
  --target ferrite://new-ferrite:6379
```

## When to Choose Ferrite

### Choose Ferrite When:

1. **Dataset exceeds RAM**: Tiered storage handles larger-than-memory workloads

2. **Multi-model requirements**: Need document, graph, or time-series alongside key-value

3. **Vector search needed**: Built-in semantic search without additional modules

4. **Multi-tenancy required**: Native tenant isolation with resource quotas

5. **SQL-like queries**: FerriteQL provides familiar query semantics

6. **Cost optimization**: Tiered storage reduces infrastructure costs

7. **Open source licensing**: Apache 2.0 vs Redis's RSALv2/SSPL

### Choose Redis When:

1. **Maximum compatibility**: Established ecosystem and tooling

2. **Redis Stack features**: Specific module features not in Ferrite

3. **Cloud managed service**: AWS ElastiCache, Redis Cloud, etc.

4. **Existing expertise**: Team already experienced with Redis operations

5. **Simpler deployment**: Single-tier architecture is easier to reason about

## Feature Matrix

| Category | Feature | Ferrite | Redis OSS | Redis Stack |
|----------|---------|---------|-----------|-------------|
| **Core** | Key-Value | ✅ | ✅ | ✅ |
| | Transactions | ✅ | ✅ | ✅ |
| | Pub/Sub | ✅ | ✅ | ✅ |
| | Lua Scripting | ✅ | ✅ | ✅ |
| | Cluster | ✅ | ✅ | ✅ |
| **Extended** | JSON Documents | ✅ | ❌ | ✅ |
| | Graph | ✅ | ❌ | ⚠️ Deprecated |
| | Time-Series | ✅ | ❌ | ✅ |
| | Vector Search | ✅ | ❌ | ✅ |
| | Full-Text Search | ✅ | ❌ | ✅ |
| **Advanced** | CRDTs | ✅ | ❌ | ❌ |
| | Multi-Tenancy | ✅ | ❌ | ❌ |
| | SQL Queries | ✅ | ❌ | ❌ |
| | Tiered Storage | ✅ | ❌ | ❌ |
| | WASM Functions | ✅ | ❌ | ❌ |
| | CDC | ✅ | ❌ | ❌ |
| | Triggers | ✅ | ❌ | ❌ |

## Related Resources

- [Migration from Redis Guide](/docs/migration/from-redis)
- [Compatibility Matrix](/docs/migration/compatibility)
- [Ferrite vs KeyDB](/docs/comparisons/vs-keydb)
- [Ferrite vs Dragonfly](/docs/comparisons/vs-dragonfly)
