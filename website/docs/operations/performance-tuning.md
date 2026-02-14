---
sidebar_position: 3
maturity: stable
---

# Performance Tuning

Optimize Ferrite for maximum throughput and minimum latency.

> Note: Configuration examples are conceptual. For supported `ferrite.toml`
> keys and byte/second values, see `/docs/reference/configuration`.

## Overview

Ferrite is designed for high performance out of the box, but tuning can improve results for specific workloads.

## Quick Wins

### 1. Use Connection Pooling

```python
# Python - use connection pool
import redis

pool = redis.ConnectionPool(host='localhost', port=6379, max_connections=100)
client = redis.Redis(connection_pool=pool)
```

### 2. Enable Pipelining

```python
# Batch commands
pipe = client.pipeline()
for i in range(1000):
    pipe.set(f'key:{i}', f'value:{i}')
pipe.execute()  # Single round-trip
```

### 3. Use Appropriate Data Structures

| Use Case | Best Structure |
|----------|---------------|
| Counters | Strings (INCR) |
| Object fields | Hash |
| FIFO queue | List |
| Unique items | Set |
| Ranked data | Sorted Set |
| Time series | Streams or TIMESERIES |

## Memory Optimization

### Key Design

```bash
# BAD: Long keys waste memory
SET "user:profile:data:for:user:with:id:12345:including:email:and:preferences" "value"

# GOOD: Short, efficient keys
SET "u:12345:profile" "value"
```

### Value Compression

```toml
[storage]
compression = true
compression_threshold = 1024  # Compress values > 1KB
compression_level = 6
```

### Memory Policy

```toml
[memory]
maxmemory = "8gb"
maxmemory_policy = "volatile-lru"  # or allkeys-lru, volatile-ttl, etc.
```

### Eviction Policies

| Policy | Description |
|--------|-------------|
| `noeviction` | Return error when full |
| `volatile-lru` | LRU among keys with TTL |
| `allkeys-lru` | LRU among all keys |
| `volatile-lfu` | LFU among keys with TTL |
| `allkeys-lfu` | LFU among all keys |
| `volatile-random` | Random among keys with TTL |
| `allkeys-random` | Random among all keys |
| `volatile-ttl` | Shortest TTL first |

## Network Optimization

### TCP Settings

```toml
[network]
tcp_backlog = 511
tcp_keepalive = 300
timeout = 0  # 0 = no timeout
```

### Connection Limits

```toml
[network]
maxclients = 10000
```

### Protocol Selection

```toml
[network]
# Use RESP3 for better performance
protocol = "resp3"
```

## Persistence Tuning

### AOF Configuration

```toml
[persistence.aof]
enabled = true
fsync = "everysec"  # Balanced durability/performance
# fsync = "always"  # Maximum durability, slower
# fsync = "no"      # Maximum performance, less durable
```

### Checkpoint Configuration

```toml
[persistence.checkpoint]
enabled = true
interval_secs = 3600  # Every hour
# Triggered also by key changes
changes_threshold = 100000
```

### Tiered Storage

```toml
[storage.tiering]
enabled = true
hot_tier_size = "4gb"      # Memory (hot)
warm_tier_size = "16gb"    # mmap (warm)
cold_tier_path = "/data"   # Disk (cold)
```

## CPU Optimization

### Thread Configuration

```toml
[server]
# io_threads = 0 means auto-detect
io_threads = 0

# Worker threads for CPU-bound operations
worker_threads = 4
```

### Thread-Per-Core

```toml
[server]
# Pin threads to cores for better cache locality
thread_affinity = true
```

### Async Operations

```toml
[server]
# Use io_uring for async I/O (Linux 5.11+)
io_backend = "io_uring"
```

## Query Optimization

### Use Indexes

```bash
# Create index for frequent queries
CREATE INDEX idx_user_status ON hash:user:* (status)
```

### Avoid Large Scans

```bash
# BAD: Scanning all keys
KEYS user:*

# GOOD: Use SCAN with cursor
SCAN 0 MATCH user:* COUNT 100
```

### Use COUNT with SCAN

```bash
# Adjust COUNT for batch size
SCAN 0 MATCH pattern:* COUNT 1000
```

## Benchmark Your Workload

### Built-in Benchmark

```bash
ferrite-benchmark -h localhost -p 6379 -c 50 -n 100000
```

### Custom Benchmark

```bash
# Test specific commands
ferrite-benchmark -t get,set -c 100 -n 1000000

# Test with specific key/value sizes
ferrite-benchmark --keysize 100 --valuesize 1024

# Test pipelining
ferrite-benchmark -P 16  # Pipeline 16 commands
```

### memtier_benchmark

```bash
memtier_benchmark \
  -s localhost \
  -p 6379 \
  -c 50 \
  -t 4 \
  --ratio=1:1 \
  --key-pattern=R:R \
  -d 256
```

## Configuration Reference

### High Throughput

```toml
# Optimize for maximum ops/sec

[server]
io_threads = 0  # Auto-detect
thread_affinity = true

[network]
tcp_backlog = 1024
maxclients = 50000
timeout = 0

[memory]
maxmemory = "64gb"
maxmemory_policy = "allkeys-lfu"

[persistence.aof]
fsync = "everysec"

[storage]
compression = false  # Faster without compression
```

### Low Latency

```toml
# Optimize for minimum latency

[server]
io_threads = 4
worker_threads = 2
thread_affinity = true

[network]
tcp_nodelay = true
tcp_keepalive = 60

[memory]
maxmemory = "32gb"
maxmemory_policy = "volatile-lru"

[persistence.aof]
fsync = "everysec"

[storage]
compression = false
```

### Memory Constrained

```toml
# Optimize for limited memory

[memory]
maxmemory = "4gb"
maxmemory_policy = "allkeys-lru"

[storage]
compression = true
compression_level = 9

[storage.tiering]
enabled = true
hot_tier_size = "2gb"
warm_tier_path = "/mnt/ssd"
```

## Monitoring Performance

### Key Metrics

```bash
# Commands per second
rate(ferrite_commands_total[1m])

# P99 latency
histogram_quantile(0.99, rate(ferrite_command_duration_seconds_bucket[5m]))

# Memory efficiency
ferrite_memory_used_bytes / ferrite_keys_total
```

### Slow Log

```bash
# Get slow queries
SLOWLOG GET 10

# Configure threshold
CONFIG SET slowlog-log-slower-than 10000  # 10ms in microseconds
CONFIG SET slowlog-max-len 128
```

## Common Issues

### High Latency

1. **Check slow log** - Identify slow commands
2. **Review memory** - Swap or OOM can cause latency
3. **Check persistence** - AOF fsync settings
4. **Network issues** - TCP settings, connection limits

### Low Throughput

1. **Enable pipelining** - Reduce round-trips
2. **Use connection pooling** - Reuse connections
3. **Check CPU** - May need more io_threads
4. **Review data structures** - Use appropriate types

### Memory Growth

1. **Set maxmemory** - Prevent unbounded growth
2. **Use TTL** - Expire unnecessary keys
3. **Monitor keyspace** - Identify large keys
4. **Enable eviction** - Choose appropriate policy

## Best Practices

1. **Benchmark before tuning** - Establish baseline
2. **Change one thing at a time** - Isolate improvements
3. **Monitor continuously** - Track performance metrics
4. **Test under load** - Simulate production traffic
5. **Document changes** - Track what works
6. **Plan for growth** - Leave headroom

## Next Steps

- [Monitoring](/docs/operations/monitoring) - Track performance metrics
- [Observability](/docs/operations/observability) - Deep performance analysis
- [Troubleshooting](/docs/operations/troubleshooting) - Debug issues
