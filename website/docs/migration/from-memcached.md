---
sidebar_position: 2
maturity: beta
---

# Migrating from Memcached

Migrate from Memcached to Ferrite for enhanced functionality while maintaining simplicity.

## Overview

Ferrite provides a superset of Memcached functionality with additional features like persistence, data structures, and clustering.

```
┌─────────────────┐         ┌─────────────────┐
│   Memcached     │   ───►  │     Ferrite     │
│                 │         │                 │
│ • Simple K/V    │         │ • Rich data     │
│ • No persistence│         │ • Persistence   │
│ • No clustering │         │ • Clustering    │
└─────────────────┘         └─────────────────┘
```

## Feature Comparison

| Feature | Memcached | Ferrite |
|---------|-----------|---------|
| Key-Value operations | ✅ | ✅ |
| Binary protocol | ✅ | ✅ |
| Text protocol | ✅ | ✅ |
| Persistence | ❌ | ✅ |
| Replication | ❌ | ✅ |
| Clustering | ❌ | ✅ |
| Data structures | ❌ | ✅ |
| Pub/Sub | ❌ | ✅ |
| Lua scripting | ❌ | ✅ |
| TTL | ✅ | ✅ |
| CAS (Compare-and-Swap) | ✅ | ✅ |
| Max value size | 1 MB | 512 MB |

## Command Mapping

### Basic Operations

| Memcached | Ferrite | Notes |
|-----------|---------|-------|
| `get <key>` | `GET <key>` | Identical |
| `gets <key>` | `GET <key>` + `OBJECT ENCODING` | CAS via WATCH |
| `set <key> <flags> <exptime> <bytes>` | `SET <key> <value> EX <exptime>` | Flags not supported |
| `add <key> ...` | `SET <key> <value> NX` | Only set if not exists |
| `replace <key> ...` | `SET <key> <value> XX` | Only set if exists |
| `append <key> <data>` | `APPEND <key> <data>` | Identical |
| `prepend <key> <data>` | Lua script | No direct equivalent |
| `cas <key> ...` | `WATCH` + `MULTI`/`EXEC` | Optimistic locking |
| `delete <key>` | `DEL <key>` | Identical |
| `incr <key> <value>` | `INCRBY <key> <value>` | Identical |
| `decr <key> <value>` | `DECRBY <key> <value>` | Identical |
| `touch <key> <exptime>` | `EXPIRE <key> <exptime>` | Identical |
| `stats` | `INFO` | More detailed |
| `flush_all` | `FLUSHALL` | Identical |

### Multi-Key Operations

| Memcached | Ferrite | Notes |
|-----------|---------|-------|
| `get <key1> <key2> ...` | `MGET <key1> <key2> ...` | Identical |
| `gat <exptime> <key>` | `GETEX <key> EX <exptime>` | Get and update TTL |
| `gats <exptime> <key>` | `GETEX` + `WATCH` | With CAS |

## Migration Strategies

### Strategy 1: Dual-Write

Write to both Memcached and Ferrite during transition:

```python
import pylibmc
import redis

memcached = pylibmc.Client(['localhost:11211'])
ferrite = redis.Redis(host='localhost', port=6379)

def set_value(key, value, ttl=None):
    # Write to both
    memcached.set(key, value, time=ttl or 0)
    if ttl:
        ferrite.setex(key, ttl, value)
    else:
        ferrite.set(key, value)

def get_value(key):
    # Read from Ferrite, fallback to Memcached
    value = ferrite.get(key)
    if value is None:
        value = memcached.get(key)
        if value:
            # Backfill to Ferrite
            ferrite.set(key, value)
    return value
```

### Strategy 2: Cache Warming

Pre-populate Ferrite with active keys:

```python
import pylibmc
import redis

memcached = pylibmc.Client(['localhost:11211'])
ferrite = redis.Redis(host='localhost', port=6379)

def warm_cache(keys):
    """Copy keys from Memcached to Ferrite"""
    for key in keys:
        value = memcached.get(key)
        if value:
            ferrite.set(key, value)
            print(f"Copied: {key}")

# Warm cache from access logs
with open('/var/log/memcached/access.log') as f:
    keys = extract_keys(f)
    warm_cache(keys)
```

### Strategy 3: Gradual Migration

Route traffic gradually using feature flags:

```python
import random

FERRITE_PERCENTAGE = 50  # Gradually increase

def get_cache_client():
    if random.randint(1, 100) <= FERRITE_PERCENTAGE:
        return ferrite_client
    return memcached_client
```

## Adapter Library

Use a compatibility adapter for minimal code changes:

### Python Adapter

```python
class MemcachedAdapter:
    """Ferrite adapter with Memcached-compatible API"""

    def __init__(self, host='localhost', port=6379):
        self.client = redis.Redis(host=host, port=port)

    def get(self, key):
        value = self.client.get(key)
        return value.decode() if value else None

    def get_multi(self, keys):
        values = self.client.mget(keys)
        return {k: v.decode() if v else None
                for k, v in zip(keys, values)}

    def set(self, key, value, time=0):
        if time > 0:
            return self.client.setex(key, time, value)
        return self.client.set(key, value)

    def add(self, key, value, time=0):
        if time > 0:
            return self.client.set(key, value, ex=time, nx=True)
        return self.client.setnx(key, value)

    def replace(self, key, value, time=0):
        if time > 0:
            return self.client.set(key, value, ex=time, xx=True)
        return self.client.set(key, value, xx=True)

    def delete(self, key):
        return self.client.delete(key)

    def incr(self, key, delta=1):
        return self.client.incrby(key, delta)

    def decr(self, key, delta=1):
        return self.client.decrby(key, delta)

    def touch(self, key, time):
        return self.client.expire(key, time)

    def flush_all(self):
        return self.client.flushall()

    def stats(self):
        return self.client.info()

# Drop-in replacement
# Before: cache = pylibmc.Client(['localhost:11211'])
# After:
cache = MemcachedAdapter('localhost', 6379)
```

### Node.js Adapter

```javascript
const Redis = require('ioredis');

class MemcachedAdapter {
    constructor(host = 'localhost', port = 6379) {
        this.client = new Redis({ host, port });
    }

    async get(key) {
        return await this.client.get(key);
    }

    async getMulti(keys) {
        const values = await this.client.mget(keys);
        return Object.fromEntries(
            keys.map((k, i) => [k, values[i]])
        );
    }

    async set(key, value, lifetime = 0) {
        if (lifetime > 0) {
            return await this.client.setex(key, lifetime, value);
        }
        return await this.client.set(key, value);
    }

    async add(key, value, lifetime = 0) {
        if (lifetime > 0) {
            return await this.client.set(key, value, 'EX', lifetime, 'NX');
        }
        return await this.client.setnx(key, value);
    }

    async replace(key, value, lifetime = 0) {
        if (lifetime > 0) {
            return await this.client.set(key, value, 'EX', lifetime, 'XX');
        }
        return await this.client.set(key, value, 'XX');
    }

    async delete(key) {
        return await this.client.del(key);
    }

    async incr(key, delta = 1) {
        return await this.client.incrby(key, delta);
    }

    async decr(key, delta = 1) {
        return await this.client.decrby(key, delta);
    }

    async touch(key, lifetime) {
        return await this.client.expire(key, lifetime);
    }

    async flush() {
        return await this.client.flushall();
    }
}

module.exports = MemcachedAdapter;
```

## Handling CAS Operations

Memcached's CAS (Compare-and-Swap) uses version numbers. In Ferrite, use WATCH for optimistic locking:

### Memcached CAS

```python
# Memcached approach
value, cas = mc.gets("counter")
new_value = int(value) + 1
mc.cas("counter", new_value, cas)  # Fails if changed
```

### Ferrite Equivalent

```python
# Ferrite approach with WATCH
pipe = ferrite.pipeline()
while True:
    try:
        ferrite.watch("counter")
        value = int(ferrite.get("counter") or 0)
        pipe.multi()
        pipe.set("counter", value + 1)
        pipe.execute()
        break
    except redis.WatchError:
        continue  # Retry on conflict
    finally:
        pipe.reset()
```

### Lua Script Alternative

```lua
-- Atomic increment with validation
local current = redis.call('GET', KEYS[1])
if current == ARGV[1] then
    return redis.call('SET', KEYS[1], ARGV[2])
else
    return nil
end
```

## Binary Protocol Support

Ferrite supports the Memcached binary protocol for compatibility:

```toml
# ferrite.toml
[compatibility]
memcached_protocol = true
memcached_port = 11211
```

```bash
# Connect using memcached binary protocol
echo "get mykey" | nc localhost 11211
```

## Configuration Migration

### Memcached Config

```bash
# Typical Memcached settings
memcached -m 1024 -c 10000 -t 4
```

### Equivalent Ferrite Config

```toml
# ferrite.toml
[storage]
max_memory = 1073741824 # 1GB

[server]
max_connections = 10000
```

## Benefits After Migration

### Immediate Benefits

1. **Persistence** - Data survives restarts
   ```toml
   [persistence]
   aof_enabled = true
   ```

2. **Replication** - Automatic failover
   ```toml
   [replication]
   role = "replica"
   master_host = "primary.example.com"
   ```

3. **Rich Data Structures** - Beyond simple key-value
   ```bash
   # Use lists for queues
   LPUSH queue task1 task2
   RPOP queue

   # Use hashes for objects
   HSET user:1 name "Alice" email "alice@example.com"
   ```

### Advanced Features

After migration, you can leverage:

- **Pub/Sub** for real-time messaging
- **Streams** for event sourcing
- **Lua Scripting** for complex operations
- **Clustering** for horizontal scaling
- **Vector Search** for AI applications

## Validation

### Functional Testing

```python
def test_compatibility():
    # Test basic operations
    adapter.set("test_key", "test_value", time=60)
    assert adapter.get("test_key") == "test_value"

    # Test increment
    adapter.set("counter", "0")
    assert adapter.incr("counter") == 1
    assert adapter.decr("counter") == 0

    # Test add (only if not exists)
    assert adapter.add("new_key", "value") == True
    assert adapter.add("new_key", "other") == False

    # Test replace (only if exists)
    assert adapter.replace("new_key", "updated") == True
    assert adapter.replace("missing", "value") == False

    print("All tests passed!")
```

### Performance Testing

```bash
# Memcached benchmark
memtier_benchmark -s localhost -p 11211 -P memcache_text \
  --ratio=1:1 -c 50 -t 4 --data-size=100

# Ferrite benchmark
memtier_benchmark -s localhost -p 6379 -P redis \
  --ratio=1:1 -c 50 -t 4 --data-size=100
```

## Troubleshooting

### Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| Value too large | Memcached 1MB limit vs 512MB | Just works in Ferrite |
| Flags not stored | Ferrite doesn't support flags | Store in value or use hash |
| CAS mismatch | Different CAS mechanism | Use WATCH/MULTI/EXEC |
| Connection refused | Different port | Update to 6379 |

### Flag Handling

If your application uses Memcached flags:

```python
import struct
import pickle

class FlagAwareAdapter(MemcachedAdapter):
    """Adapter that preserves Memcached-style flags"""

    FLAG_PICKLE = 1
    FLAG_INTEGER = 2
    FLAG_LONG = 4

    def set(self, key, value, time=0):
        # Store value with flag prefix
        if isinstance(value, int):
            data = struct.pack('>I', self.FLAG_INTEGER) + str(value).encode()
        elif isinstance(value, bytes):
            data = struct.pack('>I', 0) + value
        else:
            data = struct.pack('>I', self.FLAG_PICKLE) + pickle.dumps(value)

        return super().set(key, data, time)

    def get(self, key):
        data = super().get(key)
        if not data:
            return None

        flags = struct.unpack('>I', data[:4])[0]
        value = data[4:]

        if flags == self.FLAG_INTEGER:
            return int(value)
        elif flags == self.FLAG_PICKLE:
            return pickle.loads(value)
        return value
```

## Next Steps

- [Redis Compatibility](/docs/migration/compatibility) - Full command reference
- [Clustering](/docs/advanced/clustering) - Scale horizontally
- [Persistence](/docs/guides/persistence) - Durability options
- [Data Structures](/docs/reference/commands/lists) - Beyond key-value
