# Ferrite Performance Tuning Guide

This guide covers performance optimization strategies for Ferrite deployments.

## Table of Contents

1. [Quick Performance Checklist](#quick-performance-checklist)
2. [Server Configuration](#server-configuration)
3. [Memory Optimization](#memory-optimization)
4. [Network Tuning](#network-tuning)
5. [Persistence Tuning](#persistence-tuning)
6. [Command Optimization](#command-optimization)
7. [Monitoring & Profiling](#monitoring--profiling)
8. [Benchmarking](#benchmarking)

---

## Quick Performance Checklist

Before diving into detailed tuning, ensure these basics:

- [ ] Running release build (`cargo build --release`)
- [ ] Sufficient RAM for dataset + overhead (~20% buffer)
- [ ] Fast storage (NVMe SSD for persistence)
- [ ] Network latency < 1ms between client and server
- [ ] Disable swap or set `vm.swappiness=1`
- [ ] Use connection pooling in clients

---

## Server Configuration

### Thread Configuration

```toml
[server]
# Number of I/O threads (default: CPU cores)
io_threads = 8

# Thread-per-core architecture maximizes cache locality
# Set to number of physical cores, not hyperthreads
```

**Recommendation**: Set `io_threads` to the number of physical CPU cores.

### Connection Limits

```toml
[server]
# Maximum concurrent client connections
maxclients = 10000

# TCP backlog for pending connections
tcp_backlog = 511

# TCP keepalive interval (seconds)
tcp_keepalive = 300
```

**Tuning tips**:
- Increase `maxclients` for high-connection workloads
- Increase `tcp_backlog` if seeing connection timeouts under load
- Enable `tcp_keepalive` to detect dead connections

### Timeout Settings

```toml
[server]
# Client idle timeout (0 = disabled)
timeout = 0

# Lua script timeout (milliseconds)
lua_time_limit = 5000
```

---

## Memory Optimization

### Memory Limits

```toml
[memory]
# Maximum memory usage
maxmemory = "8gb"

# Eviction policy when maxmemory is reached
maxmemory_policy = "allkeys-lru"

# Percentage of maxmemory for samples
maxmemory_samples = 5
```

### Eviction Policies

| Policy | Use Case |
|--------|----------|
| `noeviction` | Return errors when memory limit reached |
| `allkeys-lru` | Evict least recently used keys (recommended for cache) |
| `allkeys-lfu` | Evict least frequently used keys |
| `volatile-lru` | Evict LRU keys with TTL set |
| `volatile-lfu` | Evict LFU keys with TTL set |
| `allkeys-random` | Random eviction |
| `volatile-random` | Random eviction of keys with TTL |
| `volatile-ttl` | Evict keys with shortest TTL |

### Memory-Efficient Data Structures

**Hashes** - Use for objects with many fields:
```bash
# Instead of multiple keys:
SET user:1:name "Alice"
SET user:1:email "alice@example.com"

# Use a hash:
HSET user:1 name "Alice" email "alice@example.com"
```

**Sorted Sets** - Efficient for leaderboards and ranges:
```bash
ZADD leaderboard 100 "player1" 200 "player2"
ZRANGE leaderboard 0 9 WITHSCORES  # Top 10
```

### Memory Analysis

```bash
# Overall memory stats
redis-cli INFO memory

# Memory usage by key
redis-cli MEMORY USAGE <key>

# Memory doctor recommendations
redis-cli MEMORY DOCTOR

# Key count by database
redis-cli INFO keyspace
```

---

## Network Tuning

### System-Level Settings (Linux)

```bash
# Increase socket buffer sizes
echo 'net.core.rmem_max=16777216' >> /etc/sysctl.conf
echo 'net.core.wmem_max=16777216' >> /etc/sysctl.conf
echo 'net.ipv4.tcp_rmem=4096 87380 16777216' >> /etc/sysctl.conf
echo 'net.ipv4.tcp_wmem=4096 65536 16777216' >> /etc/sysctl.conf

# Increase connection backlog
echo 'net.core.somaxconn=65535' >> /etc/sysctl.conf
echo 'net.ipv4.tcp_max_syn_backlog=65535' >> /etc/sysctl.conf

# Apply changes
sysctl -p
```

### Pipelining

Client pipelining dramatically improves throughput:

```python
# Without pipelining (slow)
for i in range(1000):
    r.set(f"key:{i}", f"value:{i}")

# With pipelining (fast)
pipe = r.pipeline()
for i in range(1000):
    pipe.set(f"key:{i}", f"value:{i}")
pipe.execute()
```

**Performance impact**: 10-100x improvement for bulk operations.

### Connection Pooling

Always use connection pools in production:

```python
# Python example with redis-py
pool = redis.ConnectionPool(
    host='localhost',
    port=6379,
    max_connections=50,
    socket_timeout=5,
    socket_connect_timeout=5
)
r = redis.Redis(connection_pool=pool)
```

---

## Persistence Tuning

### AOF Configuration

```toml
[persistence]
# AOF sync policy
appendfsync = "everysec"  # Balance durability/performance

# Rewrite AOF when it doubles in size
auto_aof_rewrite_percentage = 100
auto_aof_rewrite_min_size = "64mb"
```

**Sync policies**:
| Policy | Durability | Performance |
|--------|------------|-------------|
| `always` | Highest (every write) | Slowest |
| `everysec` | Good (1 second loss max) | Fast |
| `no` | Lowest (OS decides) | Fastest |

### RDB Configuration

```toml
[persistence]
# RDB snapshot triggers
save = ["900 1", "300 10", "60 10000"]

# Use compression for smaller snapshots
rdb_compression = true

# Enable checksum for integrity
rdb_checksum = true
```

### Hybrid Persistence

For best durability with good performance:

```toml
[persistence]
# Use both RDB and AOF
appendonly = true
rdb_compression = true
appendfsync = "everysec"

# AOF uses RDB preamble for faster loads
aof_use_rdb_preamble = true
```

### Disable Persistence (Pure Cache)

For maximum performance when data loss is acceptable:

```toml
[persistence]
enabled = false
appendonly = false
save = []
```

---

## Command Optimization

### Avoid Expensive Commands

| Command | Issue | Alternative |
|---------|-------|-------------|
| `KEYS *` | Blocks server, O(N) | Use `SCAN` |
| `SMEMBERS` | Returns all members | Use `SSCAN` |
| `HGETALL` | Returns all fields | Use `HSCAN` or specific fields |
| `LRANGE 0 -1` | Returns entire list | Paginate with `LRANGE 0 100` |

### Use SCAN for Iteration

```bash
# Instead of KEYS (blocks server)
KEYS user:*

# Use SCAN (non-blocking, cursor-based)
SCAN 0 MATCH user:* COUNT 100
```

### Batch Operations

```bash
# Instead of multiple GETs
GET key1
GET key2
GET key3

# Use MGET
MGET key1 key2 key3

# Instead of multiple SETs
MSET key1 val1 key2 val2 key3 val3
```

### Lua Scripts for Atomic Operations

```lua
-- Atomic increment with limit
local current = redis.call('GET', KEYS[1])
if current and tonumber(current) >= tonumber(ARGV[1]) then
    return nil
end
return redis.call('INCR', KEYS[1])
```

---

## Monitoring & Profiling

### Key Metrics to Monitor

```bash
# Real-time stats
redis-cli INFO stats

# Key metrics:
# - instantaneous_ops_per_sec: Current throughput
# - total_connections_received: Connection rate
# - rejected_connections: Capacity issues
# - expired_keys: Expiration activity
# - evicted_keys: Memory pressure indicator
```

### Latency Monitoring

```bash
# Built-in latency monitoring
redis-cli --latency
redis-cli --latency-history

# Intrinsic latency baseline
redis-cli --intrinsic-latency 100

# Latency doctor
redis-cli LATENCY DOCTOR
```

### Slowlog Analysis

```bash
# Configure slowlog threshold (microseconds)
CONFIG SET slowlog-log-slower-than 10000

# Get slow queries
SLOWLOG GET 10

# Reset slowlog
SLOWLOG RESET
```

### Memory Profiling

```bash
# Memory stats
redis-cli INFO memory

# Big keys analysis
redis-cli --bigkeys

# Memory usage by type
redis-cli MEMORY STATS
```

### CPU Profiling

For detailed CPU analysis:

```bash
# Generate flamegraph
cargo flamegraph --bin ferrite

# Or use perf
perf record -g ./target/release/ferrite
perf report
```

---

## Benchmarking

### Using redis-benchmark

```bash
# Basic throughput test
redis-benchmark -h localhost -p 6379 -c 50 -n 100000

# Test specific commands
redis-benchmark -t set,get -n 100000 -q

# Pipelined benchmark
redis-benchmark -t set -n 100000 -P 16

# With key randomization
redis-benchmark -t set -n 100000 -r 100000
```

### Using memtier_benchmark

```bash
# Install memtier
apt-get install memtier-benchmark

# Run benchmark
memtier_benchmark \
    --server=localhost \
    --port=6379 \
    --clients=50 \
    --threads=4 \
    --ratio=1:1 \
    --test-time=60 \
    --data-size=256 \
    --key-pattern=R:R
```

### Performance Targets

| Metric | Target | Notes |
|--------|--------|-------|
| GET throughput | >500K ops/sec/core | Single key |
| SET throughput | >400K ops/sec/core | Single key |
| P50 latency | <0.3ms | Local connection |
| P99 latency | <1ms | Local connection |
| P99.9 latency | <2ms | Local connection |

### Interpreting Results

- **Low throughput**: Check network, persistence settings, slow commands
- **High P99**: Check for blocking operations, GC pauses, swap usage
- **High CPU**: Profile for hot spots, check for O(N) commands

---

## Hardware Recommendations

### CPU
- Modern multi-core processor (8+ cores recommended)
- High single-thread performance benefits command processing
- Disable hyperthreading for more predictable latency

### Memory
- ECC RAM recommended for data integrity
- Size for dataset + 20% overhead
- Faster memory (DDR4-3200+) improves throughput

### Storage
- NVMe SSD for persistence (2000+ MB/s)
- Consider RAID 10 for redundancy
- Separate drive for AOF if high write volume

### Network
- 10GbE or faster for high-throughput workloads
- Low latency (<100μs) between client and server
- Consider NUMA topology for multi-socket systems

---

## Common Performance Issues

### Issue: High Latency Spikes

**Causes**:
- AOF fsync on every write
- Background RDB save
- Slow commands (KEYS, large SORT)
- Memory swap

**Solutions**:
- Use `appendfsync = "everysec"`
- Schedule RDB saves during low traffic
- Use SCAN instead of KEYS
- Disable swap or set `vm.swappiness=1`

### Issue: Throughput Plateau

**Causes**:
- Single-threaded bottleneck
- Network saturation
- Client-side bottleneck

**Solutions**:
- Use pipelining
- Enable io_threads
- Use connection pooling
- Scale horizontally with cluster

### Issue: Memory Growth

**Causes**:
- No TTL on keys
- Memory fragmentation
- Large keys accumulating

**Solutions**:
- Set TTL on all cache keys
- Monitor with `MEMORY DOCTOR`
- Use `--bigkeys` to find large keys
- Consider `activedefrag` if available

---

## Further Reading

- [CLAUDE.md](../CLAUDE.md) - Developer guide
- [TROUBLESHOOTING.md](TROUBLESHOOTING.md) - Problem resolution
- [Redis Performance Tuning](https://redis.io/docs/management/optimization/)
