---
title: Migrating from Redis to Ferrite
sidebar_position: 2
---

# Migrating from Redis to Ferrite

This guide walks you through migrating an existing Redis deployment to Ferrite
with zero data loss and minimal downtime.

## Prerequisites

- Ferrite v0.2.0+ installed (`cargo install ferrite-server` or Docker)
- Access to your Redis instance
- redis-cli installed for verification

## Step 1: Assess Compatibility

Before migrating, check which Redis commands your application uses:

```bash
# On your Redis server, check command usage
redis-cli INFO commandstats | head -30

# Run the Ferrite compatibility checker
redis-cli -h your-redis COMMAND LIST | ferrite-cli compat-check
```

**Ferrite supports 100+ Redis commands.** Check the
[compatibility matrix](https://ferritelabs.github.io/ferrite/) for per-command
status. Commands used by >95% of applications are fully supported.

### Unsupported Commands (as of v0.2.0)

| Category | Status |
|----------|--------|
| String, List, Hash, Set, Sorted Set | ✅ Full support |
| Streams | ✅ Full support |
| Pub/Sub | ✅ Full support |
| Transactions (MULTI/EXEC) | ✅ Full support |
| Lua Scripting (EVAL) | ✅ Full support |
| Bitmap, HyperLogLog, Geo | ✅ Full support |
| Cluster commands | 🧪 Beta (single-node migration first) |
| Redis Modules (RedisJSON, RediSearch) | ⚠️ Use native Ferrite equivalents |

## Step 2: Install Ferrite

Choose your installation method:

```bash
# Option A: Docker (recommended for evaluation)
docker run -d --name ferrite -p 6380:6379 ferritelabs/ferrite:latest

# Option B: Binary
curl -fsSL https://get.ferrite.dev | bash
ferrite --port 6380

# Option C: Cargo
cargo install ferrite-server
ferrite --port 6380

# Option D: Homebrew (macOS/Linux)
brew install ferritelabs/tap/ferrite
ferrite --port 6380
```

## Step 3: Import Redis Data (RDB Snapshot)

### Option A: RDB File Import

```bash
# 1. Create RDB snapshot on Redis
redis-cli -h your-redis BGSAVE
# Wait for completion
redis-cli -h your-redis LASTSAVE

# 2. Copy the RDB file
scp your-redis:/var/lib/redis/dump.rdb ./dump.rdb

# 3. Import into Ferrite
ferrite-migrate import-rdb --file dump.rdb --target ferrite://localhost:6380
```

### Option B: Live Replication (Zero-Downtime)

```bash
# Ferrite can act as a Redis replica for live migration
ferrite --port 6380 --replicaof your-redis-host 6379

# Monitor replication progress
redis-cli -p 6380 INFO replication
# Wait until "master_link_status:up" and "master_repl_offset" matches source

# When caught up, promote Ferrite to primary
redis-cli -p 6380 REPLICAOF NO ONE
```

### Option C: Key-by-Key Migration

```bash
# For selective migration of specific key patterns
ferrite-migrate live \
  --source redis://your-redis:6379 \
  --target ferrite://localhost:6380 \
  --pattern "user:*" \
  --pattern "session:*" \
  --batch-size 1000
```

## Step 4: Verify Data Integrity

```bash
# Compare key counts
echo "Redis keys: $(redis-cli -h your-redis DBSIZE)"
echo "Ferrite keys: $(redis-cli -p 6380 DBSIZE)"

# Spot-check specific keys
redis-cli -h your-redis GET user:1:name
redis-cli -p 6380 GET user:1:name

# Run application test suite against Ferrite
# (change REDIS_URL=redis://localhost:6380 in your app config)
```

## Step 5: Shadow Traffic (Optional but Recommended)

Route a copy of production traffic to both Redis and Ferrite simultaneously:

```bash
# Using a proxy (e.g., Envoy, twemproxy, or application-level)
# Write to both, read from Redis (primary), compare responses

# Ferrite provides a built-in shadow mode:
ferrite --port 6380 --shadow-source redis://your-redis:6379 --shadow-compare
```

Monitor for differences:
```bash
redis-cli -p 6380 INFO shadow
# shadow_requests: 1234567
# shadow_matches: 1234560
# shadow_mismatches: 7
# shadow_match_rate: 99.999%
```

## Step 6: Cutover

When you're confident in compatibility:

```bash
# 1. Update application config to point to Ferrite
# REDIS_URL=redis://localhost:6380

# 2. Restart application instances (rolling restart for zero downtime)

# 3. Monitor Ferrite metrics
redis-cli -p 6380 INFO stats
redis-cli -p 6380 INFO memory
redis-cli -p 6380 INFO clients
```

## Step 7: Enable Ferrite-Specific Features (Optional)

After successful migration, you can enable features Redis doesn't have:

```bash
# Enable tiered storage (use disk for cold data, save memory costs)
redis-cli -p 6380 CONFIG SET tiering-enabled yes

# Enable FerriteQL queries
redis-cli -p 6380 QUERY "SELECT * FROM user:* WHERE status = 'active' LIMIT 10"

# Enable vector search
redis-cli -p 6380 VECTOR.CREATE myindex DIMENSIONS 384 DISTANCE cosine

# Enable semantic caching for LLM applications
redis-cli -p 6380 SEMANTIC.SET "what is rust" "Rust is a systems programming language"
```

## Rollback Plan

If issues arise, rollback is straightforward:

```bash
# 1. Point application back to Redis
# REDIS_URL=redis://your-redis:6379

# 2. If data was written only to Ferrite during cutover:
ferrite-migrate export-rdb --source ferrite://localhost:6380 --file rollback.rdb
redis-cli -h your-redis --rdb rollback.rdb

# 3. Stop Ferrite
redis-cli -p 6380 SHUTDOWN SAVE
```

## Troubleshooting

### "ERR unknown command"
Check the [compatibility matrix](https://ferritelabs.github.io/ferrite/).
If the command is listed as unsupported, file a GitHub issue — most commands
can be added quickly.

### Performance Differences
Ferrite's tiered storage adds ~0.1ms latency for cold-tier reads. For
latency-sensitive keys, pin them to memory:
```bash
redis-cli -p 6380 TIERING PIN mykey MEMORY
```

### Client Library Compatibility
Ferrite works with all standard Redis client libraries:
- **Node.js**: ioredis, redis
- **Python**: redis-py
- **Java**: Jedis, Lettuce
- **Go**: go-redis
- **Rust**: redis-rs
- **C#**: StackExchange.Redis

### Memory Usage Differences
Ferrite uses ~10-20% more memory per key due to tiering metadata. However,
enabling disk tiering typically reduces total memory usage by 40-80% for
datasets with hot/cold access patterns.

## Getting Help

- [GitHub Discussions](https://github.com/ferritelabs/ferrite/discussions) — Questions
- [GitHub Issues](https://github.com/ferritelabs/ferrite/issues) — Bug reports
- [Documentation](https://docs.ferrite.dev) — Full reference
