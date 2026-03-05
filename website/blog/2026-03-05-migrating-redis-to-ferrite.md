---
slug: migrating-redis-to-ferrite
title: "Migrating from Redis to Ferrite: A Practical Guide"
authors: [ferrite-team]
tags: [migration, redis, guide, operations]
description: "Step-by-step guide to migrating from Redis to Ferrite — from compatibility assessment through zero-downtime cutover. Covers common pitfalls and real-world patterns."
---

Ferrite is designed as a drop-in Redis replacement, but "drop-in" doesn't mean "zero thought required." This guide covers what you need to know for a successful migration, from initial assessment through production cutover.

<!-- truncate -->

## Step 1: Assess Compatibility

Ferrite currently passes **92% of the Redis TCL test suite**. Before migrating, check that the commands your application uses are covered.

### Commands That Work Identically

All core data structure commands work with identical semantics:

- **Strings**: GET, SET, MGET, MSET, INCR, DECR, APPEND, STRLEN, GETRANGE, SETRANGE
- **Hashes**: HSET, HGET, HDEL, HGETALL, HKEYS, HVALS, HINCRBY, HSCAN
- **Lists**: LPUSH, RPUSH, LPOP, RPOP, LRANGE, LLEN, LINDEX, LINSERT, LTRIM, BLPOP, BRPOP
- **Sets**: SADD, SREM, SMEMBERS, SCARD, SINTER, SUNION, SDIFF, SRANDMEMBER
- **Sorted Sets**: ZADD, ZREM, ZRANGE, ZREVRANGE, ZCARD, ZSCORE, ZRANGEBYSCORE
- **Streams**: XADD, XREAD, XRANGE, XLEN, XINFO, XGROUP, XACK
- **Key Management**: DEL, EXISTS, EXPIRE, TTL, PTTL, KEYS, SCAN, TYPE, RENAME, PERSIST
- **Transactions**: MULTI, EXEC, DISCARD, WATCH
- **Pub/Sub**: SUBSCRIBE, PUBLISH, PSUBSCRIBE, UNSUBSCRIBE
- **HyperLogLog**: PFADD, PFCOUNT, PFMERGE
- **Geo**: GEOADD, GEODIST, GEOPOS, GEORADIUS
- **Scripting**: EVAL, EVALSHA, SCRIPT LOAD/EXISTS/FLUSH

### Commands with Minor Differences

| Command | Difference | Impact |
|---------|-----------|--------|
| `INFO` | Additional sections for tiered storage | Low — extra fields, existing parsers work |
| `CONFIG GET/SET` | Ferrite-specific configuration keys | Low — Redis keys work, extras available |
| `CLIENT LIST` | Additional fields for client metadata | Low — existing parsers ignore extra fields |

### Quick Compatibility Test

The fastest way to test compatibility is to point your test suite at Ferrite:

```bash
# Start Ferrite on an alternate port
docker run -d -p 6380:6379 ferritelabs/ferrite:latest

# Point your tests at Ferrite
REDIS_URL=redis://localhost:6380 npm test
# or
REDIS_URL=redis://localhost:6380 pytest
```

If all tests pass, you're ready to migrate.

## Step 2: Prepare the Infrastructure

### Option A: Docker / Kubernetes

Replace your Redis container image:

```yaml
# Before
image: redis:7-alpine

# After
image: ferritelabs/ferrite:latest
```

For Kubernetes with Helm:

```bash
helm repo add ferritelabs https://ferritelabs.github.io/homebrew-tap
helm install ferrite ferritelabs/ferrite -f values.yaml
```

### Option B: Bare Metal / VMs

```bash
# Install via Homebrew
brew tap ferritelabs/ferrite && brew install ferrite

# Or via install script
curl -fsSL https://raw.githubusercontent.com/ferritelabs/ferrite/main/scripts/install.sh | bash
```

### Configuration Translation

Ferrite uses TOML for configuration, but most Redis concepts map directly:

```toml
# ferrite.toml — equivalent to redis.conf
[server]
bind = "0.0.0.0"
port = 6379
tcp_keepalive = 300

[storage]
databases = 16
max_memory = 4294967296     # maxmemory 4gb

[persistence]
aof_enabled = true           # appendonly yes
aof_sync = "everysec"        # appendfsync everysec

[logging]
level = "info"               # loglevel notice
```

## Step 3: Data Migration

### Option A: Live Migration (Recommended)

Use Ferrite as a replica of your existing Redis, then promote it:

```bash
# 1. Start Ferrite
ferrite --config /etc/ferrite/ferrite.toml

# 2. Connect Ferrite as a replica of Redis
redis-cli -h ferrite-host -p 6379 REPLICAOF redis-host 6379

# 3. Wait for sync to complete
redis-cli -h ferrite-host -p 6379 INFO replication
# Look for: master_link_status:up, master_sync_in_progress:0

# 4. Promote Ferrite to primary
redis-cli -h ferrite-host -p 6379 REPLICAOF NO ONE
```

This approach gives you zero-downtime migration with automatic data transfer.

### Option B: RDB Import

Export from Redis and import into Ferrite:

```bash
# On Redis
redis-cli BGSAVE
# Wait for completion
scp /var/lib/redis/dump.rdb ferrite-host:/var/lib/ferrite/

# On Ferrite
ferrite --config /etc/ferrite/ferrite.toml
# Ferrite loads the RDB file on startup
```

### Option C: Dual-Write Migration

For applications that can't afford any risk, write to both Redis and Ferrite simultaneously during a validation period:

```python
class DualWriteClient:
    def __init__(self):
        self.redis = redis.Redis(host='redis-host', port=6379)
        self.ferrite = redis.Redis(host='ferrite-host', port=6379)

    def set(self, key, value, **kwargs):
        self.redis.set(key, value, **kwargs)
        self.ferrite.set(key, value, **kwargs)

    def get(self, key):
        redis_result = self.redis.get(key)
        ferrite_result = self.ferrite.get(key)
        if redis_result != ferrite_result:
            logger.warning(f"Mismatch for {key}: redis={redis_result}, ferrite={ferrite_result}")
        return redis_result  # Read from Redis during validation
```

## Step 4: Validate

Before cutting over production traffic:

```bash
# Run Redis compatibility test
redis-cli -h ferrite-host PING   # → PONG

# Test basic operations
redis-cli -h ferrite-host SET test:key "hello"
redis-cli -h ferrite-host GET test:key   # → "hello"

# Check memory and stats
redis-cli -h ferrite-host INFO memory
redis-cli -h ferrite-host INFO stats
```

## Step 5: Cut Over

Update your application's connection string to point to Ferrite:

```bash
# Environment variable change
REDIS_URL=redis://ferrite-host:6379
```

No client library changes are needed — your existing Redis client works with Ferrite.

## Common Pitfalls

1. **Lua scripts with `redis.call`**: These work, but test them specifically. Some edge cases in error handling may differ.
2. **Redis Modules**: Ferrite doesn't support Redis modules (RediSearch, RedisJSON). However, Ferrite has native equivalents: `FT.*` for search, `DOC.*` for JSON documents, `VECTOR.*` for vector search.
3. **CONFIG REWRITE**: Ferrite uses TOML config and doesn't support `CONFIG REWRITE`. Manage config through files or Helm values.
4. **WAIT command**: Not yet implemented. If you use synchronous replication confirmation, check the [compatibility matrix](/docs/sdks/compatibility).

## Bonus: Unlock Ferrite-Specific Features

After migration, you can start using Ferrite's extended capabilities without changing clients:

```bash
# Vector search (no separate vector DB needed)
redis-cli VECTOR.CREATE my_index HNSW DIM 384 DISTANCE COSINE
redis-cli VECTOR.ADD my_index doc1 [0.1, 0.2, ...]

# Semantic caching (reduce LLM API costs)
redis-cli SEMANTIC.SET "What is Rust?" "Rust is a systems programming language..." TTL 3600

# Time series (no separate TSDB needed)
redis-cli TS.ADD temperature:sensor1 * 23.5
```

These commands return errors on Redis but work on Ferrite, so you can adopt them incrementally without breaking Redis fallback.
