---
sidebar_position: 10
title: Connection Pooling
description: Best practices for connection pooling with Ferrite in production
keywords: [ferrite, connection pool, production, redis, performance]
---

# Connection Pooling

Ferrite is wire-compatible with Redis, which means all Redis connection pooling libraries work out of the box. This guide covers best practices for configuring connection pools in production.

:::tip
Ferrite supports the same connection semantics as Redis. If you already have a Redis connection pool, just change the host/port to point to Ferrite.
:::

## Why Connection Pooling?

Creating a new TCP connection for every command is expensive. Connection pools:
- **Reduce latency** by reusing established connections
- **Limit resource usage** by capping the number of concurrent connections
- **Improve throughput** through multiplexed pipelining
- **Handle failures** with automatic reconnection

## Recommended Pool Sizes

| Deployment | Pool Size | Rationale |
|-----------|-----------|-----------|
| Development | 2–5 | Minimal overhead for local testing |
| Web application | 10–25 per app instance | Handles concurrent request bursts |
| Microservice | 5–15 per service | Balanced for event-driven workloads |
| High-throughput pipeline | 25–50 | Maximizes pipelining throughput |
| Background workers | 2–5 per worker | Workers process sequentially |

**Rule of thumb**: Start with `num_cpu_cores * 2` and adjust based on observed connection wait times.

## Language-Specific Examples

### Python (redis-py)

```python
import redis

# Connection pool (recommended for production)
pool = redis.ConnectionPool(
    host='localhost',
    port=6379,
    db=0,
    max_connections=20,
    socket_timeout=5.0,
    socket_connect_timeout=2.0,
    retry_on_timeout=True,
    health_check_interval=30,
)

client = redis.Redis(connection_pool=pool)

# Use the client normally
client.set('key', 'value')
value = client.get('key')
```

**With async (aioredis)**:
```python
import redis.asyncio as aioredis

pool = aioredis.ConnectionPool.from_url(
    "redis://localhost:6379",
    max_connections=20,
    decode_responses=True,
)
client = aioredis.Redis(connection_pool=pool)
```

### Node.js (ioredis)

```javascript
const Redis = require('ioredis');

// Single connection with auto-reconnect
const client = new Redis({
  host: 'localhost',
  port: 6379,
  maxRetriesPerRequest: 3,
  retryStrategy(times) {
    return Math.min(times * 50, 2000);
  },
  enableReadyCheck: true,
  lazyConnect: true,
});

// Connection pool using ioredis Cluster or generic-pool
const GenericPool = require('generic-pool');

const factory = {
  create: () => new Redis({ host: 'localhost', port: 6379, lazyConnect: true }),
  destroy: (client) => client.disconnect(),
};

const pool = GenericPool.createPool(factory, {
  max: 20,
  min: 5,
  acquireTimeoutMillis: 3000,
});
```

### Rust (redis-rs)

```rust
use redis::Client;
use deadpool_redis::{Config, Runtime};

#[tokio::main]
async fn main() {
    // Using deadpool-redis for connection pooling
    let cfg = Config::from_url("redis://localhost:6379");
    let pool = cfg.create_pool(Some(Runtime::Tokio1)).unwrap();

    // Get a connection from the pool
    let mut conn = pool.get().await.unwrap();
    let _: () = redis::cmd("SET")
        .arg("key")
        .arg("value")
        .query_async(&mut conn)
        .await
        .unwrap();
}
```

### Go (go-redis)

```go
package main

import (
    "context"
    "time"

    "github.com/redis/go-redis/v9"
)

func main() {
    // go-redis has built-in connection pooling
    client := redis.NewClient(&redis.Options{
        Addr:         "localhost:6379",
        PoolSize:     20,
        MinIdleConns: 5,
        PoolTimeout:  30 * time.Second,
        DialTimeout:  5 * time.Second,
        ReadTimeout:  3 * time.Second,
        WriteTimeout: 3 * time.Second,
    })

    ctx := context.Background()
    client.Set(ctx, "key", "value", 0)
}
```

### Java (Lettuce)

```java
import io.lettuce.core.RedisClient;
import io.lettuce.core.api.StatefulRedisConnection;
import org.apache.commons.pool2.impl.GenericObjectPoolConfig;
import io.lettuce.core.support.ConnectionPoolSupport;
import java.time.Duration;

// Lettuce with connection pooling
RedisClient client = RedisClient.create("redis://localhost:6379");

GenericObjectPoolConfig<StatefulRedisConnection<String, String>> poolConfig =
    new GenericObjectPoolConfig<>();
poolConfig.setMaxTotal(20);
poolConfig.setMinIdle(5);
poolConfig.setMaxWait(Duration.ofSeconds(3));
poolConfig.setTestOnBorrow(true);

var pool = ConnectionPoolSupport.createGenericObjectPool(
    client::connect, poolConfig);

// Borrow a connection
try (var conn = pool.borrowObject()) {
    conn.sync().set("key", "value");
}
```

## Production Configuration

### Health Checks

Configure your pool to periodically validate connections:

```python
# Python — enable health checks
pool = redis.ConnectionPool(
    host='localhost', port=6379,
    health_check_interval=30,  # seconds
)
```

### Timeouts

Always set timeouts to prevent connection leaks:

| Timeout | Recommended | Purpose |
|---------|------------|---------|
| Connect timeout | 2–5s | Max time to establish TCP connection |
| Socket timeout | 3–5s | Max time to wait for a response |
| Pool acquire timeout | 3–10s | Max time to wait for a free connection |
| Idle timeout | 300s | Close connections idle longer than this |

### TLS Connections

When using TLS, pool connections benefit even more since TLS handshakes are expensive:

```python
# Python with TLS
pool = redis.ConnectionPool(
    host='ferrite.example.com',
    port=6380,
    ssl=True,
    ssl_cert_reqs='required',
    ssl_ca_certs='/path/to/ca.crt',
    max_connections=20,
)
```

### Pipelining

Combine connection pooling with pipelining for maximum throughput:

```python
# Pipeline multiple commands over a single connection
pipe = client.pipeline(transaction=False)
for i in range(1000):
    pipe.set(f'key:{i}', f'value:{i}')
pipe.execute()  # Sends all commands in one batch
```

## Monitoring Pool Health

Use Ferrite's `INFO clients` command to monitor connections:

```bash
redis-cli -p 6379 INFO clients
# connected_clients:15
# blocked_clients:0
# tracking_clients:0
# maxclients:10000
```

Track these Prometheus metrics (available at `:9090/metrics`):
- `ferrite_connected_clients` — Current number of client connections
- `ferrite_total_connections_received` — Total connections since startup
- `ferrite_rejected_connections` — Connections rejected due to maxclients

## Troubleshooting

### Connection pool exhaustion
**Symptom**: `Timeout waiting for connection` errors
**Fix**: Increase pool size or investigate slow commands with `SLOWLOG GET`

### Connection reset errors
**Symptom**: `Connection reset by peer` during operations
**Fix**: Enable health checks and set `retry_on_timeout=True`

### High latency with small pool
**Symptom**: P99 latency spikes despite fast median
**Fix**: Increase minimum idle connections to reduce cold-start penalty
