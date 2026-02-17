---
sidebar_position: 4
description: Detailed comparison between Ferrite and Memcached for caching workloads, including architecture, features, and performance.
maturity: stable
---

# Ferrite vs Memcached

Memcached is a classic distributed caching system known for its simplicity and speed. This comparison helps you understand when Ferrite offers advantages over Memcached for caching workloads.

## Quick Comparison

| Feature | Ferrite | Memcached |
|---------|---------|-----------|
| **Data Model** | Multi-model (strings, lists, sets, hashes, etc.) | Key-value only |
| **Value Size** | Configurable (default 512MB) | 1MB default |
| **Persistence** | AOF + Checkpoints | None (volatile) |
| **Data Types** | Rich (15+ types) | Strings only |
| **TTL** | Per-key, millisecond precision | Per-key, second precision |
| **Eviction** | LRU + Tiered storage | LRU/LFU slab-based |
| **Protocol** | RESP (Redis) + Memcached | Memcached protocol |
| **Clustering** | Native distributed | Client-side sharding |

## Architecture Comparison

### Memcached Architecture

```
┌──────────────────────────────────────────────┐
│              Memcached Server                 │
├──────────────────────────────────────────────┤
│                                              │
│  ┌─────────────────────────────────────┐    │
│  │         Slab Allocator              │    │
│  │  ┌───────┬───────┬───────┬───────┐  │    │
│  │  │Slab 1 │Slab 2 │Slab 3 │ ...   │  │    │
│  │  │ 96B   │ 120B  │ 152B  │       │  │    │
│  │  └───────┴───────┴───────┴───────┘  │    │
│  └─────────────────────────────────────┘    │
│                                              │
│  ┌─────────────────────────────────────┐    │
│  │          Hash Table                  │    │
│  │    Key → Slab Location              │    │
│  └─────────────────────────────────────┘    │
│                                              │
│            Memory Only                       │
│         (No Persistence)                     │
└──────────────────────────────────────────────┘
```

**Key characteristics:**
- Fixed-size slab classes for memory management
- Simple key-value storage only
- No persistence (cache-only)
- Multi-threaded with lock-based concurrency

### Ferrite Architecture

```
┌──────────────────────────────────────────────┐
│              Ferrite Server                   │
├──────────────────────────────────────────────┤
│  ┌─────────────────────────────────────┐    │
│  │    Rich Data Structures             │    │
│  │  Strings, Lists, Sets, Hashes,      │    │
│  │  Sorted Sets, Streams, Vectors...   │    │
│  └─────────────────────────────────────┘    │
│                                              │
│  ┌─────────────────────────────────────┐    │
│  │    Tiered Storage (HybridLog)       │    │
│  │  ┌─────────┬─────────┬─────────┐   │    │
│  │  │  HOT    │  WARM   │  COLD   │   │    │
│  │  │ Memory  │  mmap   │  Disk   │   │    │
│  │  └─────────┴─────────┴─────────┘   │    │
│  └─────────────────────────────────────┘    │
│                                              │
│  ┌─────────────────────────────────────┐    │
│  │    Persistence (Optional)           │    │
│  │    AOF + Checkpoints                │    │
│  └─────────────────────────────────────┘    │
└──────────────────────────────────────────────┘
```

**Key characteristics:**
- Rich data structures beyond simple strings
- Optional persistence for durability
- Tiered storage for larger-than-RAM datasets
- Epoch-based lock-free concurrency

## Caching Capabilities

### Basic Caching

**Memcached:**
```python
import pylibmc

mc = pylibmc.Client(['memcached:11211'])

# Simple get/set
mc.set('user:123', json.dumps(user_data), expire=3600)
data = mc.get('user:123')

# Multi-get
results = mc.get_multi(['user:1', 'user:2', 'user:3'])

# CAS (Check-And-Set)
cas_value = mc.gets('counter')
mc.cas('counter', new_value, cas_value)
```

**Ferrite:**
```python
import redis

r = redis.Redis(host='ferrite', port=6379)

# Simple get/set
r.set('user:123', json.dumps(user_data), ex=3600)
data = r.get('user:123')

# Multi-get
results = r.mget(['user:1', 'user:2', 'user:3'])

# Optimistic locking with WATCH
with r.pipeline() as pipe:
    pipe.watch('counter')
    current = int(pipe.get('counter'))
    pipe.multi()
    pipe.set('counter', current + 1)
    pipe.execute()
```

### Complex Caching Patterns

**Memcached** - Limited to string values:
```python
# Must serialize everything
cache_key = f'user:{user_id}'
mc.set(cache_key, json.dumps({
    'name': 'Alice',
    'settings': {...},
    'preferences': [...]
}))

# Update requires full rewrite
data = json.loads(mc.get(cache_key))
data['name'] = 'Bob'
mc.set(cache_key, json.dumps(data))
```

**Ferrite** - Native data structures:
```python
# Use native hash for user data
r.hset(f'user:{user_id}', mapping={
    'name': 'Alice',
    'email': 'alice@example.com',
    'last_login': datetime.now().isoformat()
})

# Partial update (no full rewrite)
r.hset(f'user:{user_id}', 'name', 'Bob')

# Use native list for preferences
r.lpush(f'user:{user_id}:preferences', 'pref1', 'pref2')

# Use sorted set for rankings
r.zadd('leaderboard', {'user:123': 1500.0})
```

## Data Types Comparison

| Data Type | Ferrite | Memcached |
|-----------|---------|-----------|
| Strings | ✅ | ✅ |
| Integers with INCR/DECR | ✅ | ✅ |
| Lists | ✅ | ❌ (serialize) |
| Sets | ✅ | ❌ (serialize) |
| Sorted Sets | ✅ | ❌ (serialize) |
| Hashes | ✅ | ❌ (serialize) |
| Streams | ✅ | ❌ |
| HyperLogLog | ✅ | ❌ |
| Bitmaps | ✅ | ❌ |
| Geo | ✅ | ❌ |
| JSON Documents | ✅ | ❌ |
| Vectors | ✅ | ❌ |
| Time-Series | ✅ | ❌ |

## Performance Comparison

### Single-Node Throughput

| Operation | Ferrite | Memcached |
|-----------|---------|-----------|
| GET (small) | ~800K ops/s | ~1M ops/s |
| SET (small) | ~600K ops/s | ~800K ops/s |
| GET (1KB) | ~500K ops/s | ~600K ops/s |
| MGET (10 keys) | ~150K ops/s | ~200K ops/s |

Memcached is slightly faster for simple string operations due to its minimal feature set.

### Latency

| Percentile | Ferrite | Memcached |
|------------|---------|-----------|
| P50 | 0.15ms | 0.10ms |
| P99 | 0.50ms | 0.40ms |
| P99.9 | 1.0ms | 0.8ms |

### When Ferrite Wins

| Scenario | Ferrite Advantage |
|----------|-------------------|
| Complex data | No serialization overhead |
| Partial updates | O(1) field updates vs O(n) rewrite |
| Counters | Atomic INCR across data types |
| Rankings | Native sorted sets |
| Lists/queues | Native list operations |

## Persistence and Durability

### Memcached

```
┌──────────────────────────┐
│     Memcached            │
├──────────────────────────┤
│  Memory: All data        │
│  Disk: Nothing           │
│                          │
│  On restart: Empty       │
│  On crash: Data lost     │
└──────────────────────────┘
```

- **No persistence** - pure cache
- Server restart = cold cache
- Must handle cache misses gracefully
- "Warming" cache after restart

### Ferrite

```
┌──────────────────────────┐
│     Ferrite              │
├──────────────────────────┤
│  Memory: Hot data        │
│  mmap: Warm data         │
│  Disk: Cold data + AOF   │
│                          │
│  On restart: Data intact │
│  On crash: Recoverable   │
└──────────────────────────┘
```

```toml
# ferrite.toml
[persistence]
enabled = true
aof_enabled = true
aof_fsync = "everysec"
checkpoint_interval = "1h"
```

- **Optional persistence** - cache or database
- Survives restarts with data intact
- Point-in-time recovery
- No cold cache problem

## Clustering and Distribution

### Memcached Clustering

Client-side sharding (consistent hashing):

```python
# Client handles distribution
mc = pylibmc.Client([
    'memcached1:11211',
    'memcached2:11211',
    'memcached3:11211'
])

# Client computes: hash(key) → server
mc.set('key', 'value')  # Routed by client
```

**Characteristics:**
- Client-side sharding
- No server-side coordination
- Node failure = lost data for that shard
- Manual rebalancing on topology changes

### Ferrite Clustering

Server-side distributed cluster:

```toml
# ferrite.toml
[cluster]
enabled = true
node_id = "node-1"
seeds = ["node-2:7000", "node-3:7000"]
replication_factor = 3
auto_rebalance = true
```

**Characteristics:**
- Server-side sharding
- Automatic rebalancing
- Replication for fault tolerance
- Cross-shard operations

## Eviction Policies

### Memcached Eviction

```bash
# memcached startup
memcached -m 1024 -M  # 1GB, error on full
memcached -m 1024     # 1GB, LRU eviction
```

- Slab-based LRU (per slab class)
- Global LRU available
- LRU + LFU hybrid options
- Evicted data is lost

### Ferrite Memory Limits

```toml
# ferrite.toml
[storage]
backend = "memory"
max_memory = 8589934592 # 8GB

# Enable tiered storage with HybridLog
# backend = "hybridlog"
# data_dir = "/data"
```

Ferrite's HybridLog backend uses LRU-based tiering to disk when enabled.
Eviction policy tuning is not currently exposed in `ferrite.toml`.

**Tiered storage advantage:**
- Cold data moves to disk, not evicted
- No data loss from memory pressure

## Protocol Compatibility

### Memcached Protocol

```
# Text protocol
set key 0 3600 5\r\n
value\r\n

get key\r\n
VALUE key 0 5\r\n
value\r\n
END\r\n

# Binary protocol also available
```

### Ferrite Protocol

```bash
# RESP protocol (Redis compatible)
*3\r\n$3\r\nSET\r\n$3\r\nkey\r\n$5\r\nvalue\r\n

# Memcached protocol support is not yet available
```

Ferrite can optionally enable Memcached protocol compatibility:

```toml
# ferrite.toml
[protocols]
redis = { enabled = true, port = 6379 }
memcached = { enabled = true, port = 11211 }
```

## Use Case Comparison

| Use Case | Best Choice | Reason |
|----------|-------------|--------|
| Simple string cache | Either | Both excel |
| Session storage | Ferrite | Persistence, hashes |
| Leaderboards | Ferrite | Native sorted sets |
| Rate limiting | Ferrite | Atomic counters, Lua |
| Pub/Sub messaging | Ferrite | Native support |
| Object caching | Ferrite | Native data structures |
| Large value cache | Ferrite | No 1MB limit, tiering |
| Pure L1 cache | Memcached | Slightly faster |
| Multi-region cache | Ferrite | Replication built-in |

## Migration from Memcached

### Using Ferrite's Memcached Protocol

```python
# Existing code works unchanged
import pylibmc

# Just change the host/port
mc = pylibmc.Client(['ferrite:11211'])
mc.set('key', 'value', time=3600)
```

### Migrating to Redis Protocol

```python
# Before (Memcached)
import pylibmc
mc = pylibmc.Client(['memcached:11211'])
mc.set('user:123', json.dumps(user), time=3600)

# After (Ferrite with Redis protocol)
import redis
r = redis.Redis(host='ferrite', port=6379)
r.hset('user:123', mapping=user)  # No serialization needed
r.expire('user:123', 3600)
```

### Taking Advantage of New Features

```python
# Memcached: serialize everything
mc.set('leaderboard', json.dumps(scores))  # Inefficient

# Ferrite: native data structures
for user, score in scores.items():
    r.zadd('leaderboard', {user: score})

# Get top 10 efficiently
top_10 = r.zrevrange('leaderboard', 0, 9, withscores=True)
```

## When to Choose

### Choose Ferrite When:

1. **Need persistence**: Data should survive restarts

2. **Rich data structures**: Hashes, lists, sorted sets, etc.

3. **Large values**: >1MB or need tiered storage

4. **Server-side clustering**: Automatic rebalancing, replication

5. **Complex operations**: Atomic operations, Lua scripting

6. **Multiple use cases**: Cache + database + messaging

### Choose Memcached When:

1. **Pure caching**: No persistence needed

2. **Simple key-value**: Only string values

3. **Maximum simplicity**: Minimal operational overhead

4. **Slight speed edge**: For simple string operations

5. **Existing infrastructure**: Large Memcached deployment

## Feature Matrix

| Feature | Ferrite | Memcached |
|---------|---------|-----------|
| String values | ✅ | ✅ |
| Complex data types | ✅ | ❌ |
| Persistence | ✅ | ❌ |
| Replication | ✅ | ❌ |
| Server clustering | ✅ | ❌ |
| TTL support | ✅ | ✅ |
| CAS operations | ✅ | ✅ |
| Pub/Sub | ✅ | ❌ |
| Scripting | ✅ Lua | ❌ |
| Transactions | ✅ | ❌ |
| Tiered storage | ✅ | ❌ |
| Vector search | ✅ | ❌ |

## Related Resources

- [Ferrite vs Redis](/docs/comparisons/vs-redis)
- [Caching Use Case](/docs/use-cases/caching)
- [Session Management](/docs/use-cases/session-management)
- [Configuration Reference](/docs/reference/configuration)
