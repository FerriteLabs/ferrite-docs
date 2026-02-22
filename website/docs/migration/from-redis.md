---
sidebar_position: 1
maturity: stable
---

# Migrating from Redis

Step-by-step guide to migrate from Redis to Ferrite.

## Compatibility

Ferrite is designed as a drop-in Redis replacement with full RESP protocol compatibility.

### Supported Features

| Feature | Status |
|---------|--------|
| Data types (String, List, Hash, Set, ZSet) | ✅ Full |
| Pub/Sub | ✅ Full |
| Transactions (MULTI/EXEC) | ✅ Full |
| Lua scripting | ✅ Full |
| Cluster mode | ✅ Full |
| Sentinel | ✅ Full |
| Streams | ✅ Full |
| ACL | ✅ Full |
| TLS | ✅ Full |
| Persistence (RDB/AOF) | ✅ Compatible |

### Ferrite-Only Features

- Vector search
- Document store
- Graph database
- Time-series
- Full-text search
- Semantic caching
- Multi-tenancy
- WASM functions

## Migration Strategies

### 1. Blue-Green Migration

**Best for:** Zero-downtime requirement, can run parallel infrastructure

```
┌─────────────┐     ┌─────────────┐
│    Redis    │     │   Ferrite   │
│   (Blue)    │     │   (Green)   │
└──────┬──────┘     └──────┬──────┘
       │                   │
       └───────┬───────────┘
               │
        ┌──────┴──────┐
        │ Load        │
        │ Balancer    │
        └─────────────┘
```

### 2. Live Sync Migration

**Best for:** Large datasets, minimal downtime

### 3. Dump and Restore

**Best for:** Small datasets, scheduled maintenance window

## Blue-Green Migration

### Step 1: Set Up Ferrite

```bash
# Start Ferrite with same configuration
ferrite --config ferrite.toml
```

### Step 2: Sync Data

```bash
# Use migration tool
ferrite-migrate sync \
  --source redis://localhost:6379 \
  --target ferrite://localhost:6380 \
  --live

# Or use Redis replication
# On Ferrite:
REPLICAOF redis-host 6379
```

### Step 3: Verify Sync

```bash
# Compare key counts
redis-cli -h redis-host DBSIZE
ferrite-cli -h ferrite-host DBSIZE

# Sample key verification
ferrite-migrate verify \
  --source redis://localhost:6379 \
  --target ferrite://localhost:6380 \
  --sample 1000
```

### Step 4: Switch Traffic

```bash
# Update load balancer/DNS
# Point to Ferrite

# Or update application config
REDIS_HOST=ferrite-host
```

### Step 5: Stop Replication

```bash
# On Ferrite
REPLICAOF NO ONE
```

## Live Sync Migration

### Using ferrite-migrate

```bash
# Start live sync
ferrite-migrate sync \
  --source redis://redis-host:6379 \
  --target ferrite://ferrite-host:6379 \
  --live \
  --verify

# Monitor progress
ferrite-migrate status

# Output:
# Phase: live_sync
# Keys synced: 1000000
# Lag: 50 keys
# Estimated completion: 2 minutes
```

### Using RIOT

```bash
# Redis Input/Output Tools
riot replicate \
  redis://redis-host:6379 \
  redis://ferrite-host:6379 \
  --mode live
```

## Dump and Restore

### Export from Redis

```bash
# Create RDB snapshot
redis-cli -h redis-host BGSAVE

# Wait for completion
redis-cli -h redis-host LASTSAVE

# Copy RDB file
scp redis-host:/var/lib/redis/dump.rdb ./
```

### Import to Ferrite

```bash
# Convert RDB to Ferrite format
ferrite-migrate convert dump.rdb ferrite-dump.fcpt

# Or import directly
ferrite-migrate import dump.rdb --target ferrite://localhost:6379
```

### Alternative: Key-by-Key

```bash
# Export keys
redis-cli -h redis-host --rdb dump.rdb

# Import
ferrite-cli -h ferrite-host --rdb dump.rdb

# Or using DUMP/RESTORE
redis-cli -h redis-host DUMP mykey | ferrite-cli -h ferrite-host RESTORE mykey 0
```

## Client Migration

### Python

```python
# Before (redis-py)
import redis
client = redis.Redis(host='redis-host', port=6379)

# After (same library, different host)
import redis
client = redis.Redis(host='ferrite-host', port=6379)

# No code changes needed!
```

### Node.js

```javascript
// Before (ioredis)
const Redis = require('ioredis');
const client = new Redis({ host: 'redis-host', port: 6379 });

// After
const client = new Redis({ host: 'ferrite-host', port: 6379 });
```

### Go

```go
// Before (go-redis)
client := redis.NewClient(&redis.Options{
    Addr: "redis-host:6379",
})

// After
client := redis.NewClient(&redis.Options{
    Addr: "ferrite-host:6379",
})
```

## Configuration Mapping

### Redis Config → Ferrite Config

```toml
# Redis: maxmemory 2gb
[memory]
maxmemory = "2gb"

# Redis: maxmemory-policy allkeys-lru
maxmemory_policy = "allkeys-lru"

# Redis: appendonly yes
[persistence.aof]
enabled = true

# Redis: appendfsync everysec
fsync = "everysec"

# Redis: requirepass secret
[security]
requirepass = "secret"

# Redis: bind 0.0.0.0
[network]
bind = "0.0.0.0"

# Redis: port 6379
port = 6379
```

## Cluster Migration

### Redis Cluster → Ferrite Cluster

```bash
# 1. Set up Ferrite cluster with same slot distribution
redis-cli --cluster create \
  ferrite1:6379 ferrite2:6379 ferrite3:6379 \
  --cluster-replicas 1

# 2. Migrate slots one at a time
ferrite-migrate cluster \
  --source redis-cluster-host:6379 \
  --target ferrite-cluster-host:6379 \
  --parallel 4

# 3. Update client configuration
# Most clients auto-discover cluster topology
```

## Sentinel Migration

```bash
# 1. Add Ferrite nodes to existing Sentinel setup
# Sentinels will discover and manage Ferrite

# 2. Promote Ferrite to master
redis-cli -h sentinel-host -p 26379 SENTINEL FAILOVER mymaster

# 3. Remove old Redis nodes
redis-cli -h sentinel-host -p 26379 SENTINEL REMOVE redis-node
```

## Verification

### Data Integrity Check

```bash
ferrite-migrate verify \
  --source redis://redis-host:6379 \
  --target ferrite://ferrite-host:6379 \
  --full

# Output:
# Total keys: 1000000
# Verified: 1000000
# Mismatches: 0
# Missing: 0
# Status: PASSED
```

### Performance Comparison

```bash
# Benchmark Redis
redis-benchmark -h redis-host -p 6379 -c 50 -n 100000

# Benchmark Ferrite
ferrite-benchmark -h ferrite-host -p 6379 -c 50 -n 100000
```

### Functional Testing

```bash
# Run your test suite against Ferrite
REDIS_HOST=ferrite-host npm test
REDIS_HOST=ferrite-host pytest
```

## Rollback Plan

### Quick Rollback

```bash
# Switch traffic back to Redis
# Update load balancer/DNS/config

# If using replication, Ferrite was replica:
# Redis still has all data
```

### Data Rollback

```bash
# Sync changes back to Redis
ferrite-migrate sync \
  --source ferrite://ferrite-host:6379 \
  --target redis://redis-host:6379
```

## Common Issues

### Connection Refused

```bash
# Check Ferrite is running
ferrite-cli PING

# Check bind address
grep bind ferrite.toml
# Ensure: bind = "0.0.0.0"
```

### Authentication Failed

```bash
# Verify password
ferrite-cli -a yourpassword PING

# Check config
grep requirepass ferrite.toml
```

### Incompatible Commands

```bash
# Check command support
ferrite-cli COMMAND INFO commandname

# Most Redis commands work unchanged
```

## Best Practices

1. **Test thoroughly** - Run full test suite against Ferrite
2. **Start with non-production** - Migrate dev/staging first
3. **Monitor closely** - Watch metrics during migration
4. **Have rollback plan** - Know how to switch back
5. **Migrate incrementally** - Start with low-traffic services
6. **Document changes** - Track configuration differences
7. **Train team** - Familiarize with Ferrite-specific features

## Known Behavioral Differences

While Ferrite aims for Redis compatibility, some behaviors differ by design:

| Behavior | Redis | Ferrite | Impact |
|----------|-------|---------|--------|
| **Memory eviction** | LRU/LFU in-memory only | Automatic tier demotion to disk | Data is preserved, not evicted |
| **`OBJECT FREQ/IDLETIME`** | Supported | Not yet implemented | Monitor scripts may need updates |
| **`MODULE LOAD`** | Native C modules | WASM modules only (`WASM.LOAD`) | Existing modules need porting |
| **`FUNCTION`** | Redis Functions (7.0+) | Not yet implemented | Use Lua or WASM instead |
| **Cluster slot migration** | `CLUSTER SETSLOT` | `CLUSTER SETSLOT` + auto-resharding | Additional automation available |
| **Default persistence** | AOF off, RDB on | AOF on, checkpoints on | More durable by default |
| **Max key size** | 512MB | 512MB | Same |
| **Max value size** | 512MB | Configurable (default 512MB) | Same default, can increase |

### Tiered Storage Implications

Unlike Redis which evicts data when memory is full, Ferrite demotes cold data to disk. This means:

- `DBSIZE` returns total keys across all tiers, not just in-memory keys
- `INFO memory` shows memory usage for the mutable tier; use `INFO storage` for full tier breakdown
- `RANDOMKEY` may return a key from disk tier (slightly higher latency)
- Background compaction may cause brief I/O spikes — monitor with `INFO hybridlog`

## Next Steps

- [Compatibility](/docs/migration/compatibility) - Detailed compatibility matrix
- [Migration Tools](/docs/migration/migration-tools) - Tool reference
- [Configuration](/docs/getting-started/configuration) - Ferrite configuration
