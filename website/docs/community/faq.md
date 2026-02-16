---
sidebar_position: 3
title: Frequently Asked Questions
description: Common questions about Ferrite including installation, performance, Redis compatibility, vector search, clustering, and troubleshooting.
keywords: [ferrite faq, redis alternative questions, ferrite help, troubleshooting, redis compatibility]
maturity: stable
---

# Frequently Asked Questions

Common questions about Ferrite, its features, and how to use it effectively.

## General

### What is Ferrite?

Ferrite is a high-performance, Redis-compatible data platform built in Rust. It combines the speed of in-memory caching with the capacity of disk storage and adds advanced features like vector search, document store, graph database, and more.

### Is Ferrite a Redis drop-in replacement?

Yes, for the vast majority of use cases. Ferrite implements the Redis protocol (RESP2/RESP3) and supports all common Redis commands. You can use existing Redis clients and switch from Redis to Ferrite with minimal code changes.

### What makes Ferrite different from Redis?

1. **Multi-model**: Beyond key-value, Ferrite includes document store, graph database, time-series, vector search, and full-text search
2. **Tiered storage**: Automatic data movement between memory, mmap, and disk
3. **Modern architecture**: Built in Rust with io_uring, epoch-based reclamation
4. **Extended features**: FerriteQL, WASM functions, programmable triggers, CDC

### Is Ferrite open source?

Yes, Ferrite is open source under the Apache 2.0 license. You can use it freely in commercial applications, modify it, and distribute modifications.

### What languages are supported?

Ferrite works with any Redis client library. We also provide official SDKs for:
- Rust
- Python
- TypeScript/Node.js
- Go
- Java

## Installation & Setup

### What are the system requirements?

**Minimum:**
- 2 CPU cores
- 4GB RAM
- Linux, macOS, or Windows

**Recommended for production:**
- 8+ CPU cores
- 32GB+ RAM
- NVMe SSD storage
- Linux (for io_uring support)

### How do I install Ferrite?

```bash
# Using cargo
cargo install ferrite

# Using Docker
docker run -p 6380:6380 ferrite/ferrite

# Using Homebrew (macOS)
brew install ferrite

# Download binary
curl -sSL https://get.ferrite.dev | sh
```

### What port does Ferrite use?

By default, Ferrite listens on port 6380 (not 6379) to avoid conflicts with existing Redis installations. You can change this in the configuration.

### Can I run Ferrite alongside Redis?

Yes, you can run both on different ports. This is useful during migration testing.

## Performance

### How fast is Ferrite compared to Redis?

In benchmarks, Ferrite achieves comparable or better performance than Redis for most operations:
- GET: >500K ops/sec/core
- SET: >400K ops/sec/core
- P99 latency: &lt;1ms

For workloads that exceed memory, Ferrite's tiered storage provides significant advantages.

### Does Ferrite use more memory than Redis?

For pure in-memory workloads, memory usage is similar. Ferrite's tiered storage allows you to store more data with less memory by automatically moving cold data to disk.

### How does tiered storage affect latency?

- Hot tier (memory): Microseconds
- Warm tier (mmap): 10-50 microseconds
- Cold tier (disk): 100-500 microseconds with io_uring

The adaptive engine keeps frequently accessed data in faster tiers automatically.

## Features

### Does Ferrite support Redis Cluster?

Yes, Ferrite supports Redis Cluster protocol for horizontal scaling. You can run a cluster of Ferrite nodes with automatic sharding and failover.

### Can I use Lua scripts?

Yes, Ferrite fully supports Lua scripting with EVAL and EVALSHA commands. Scripts execute atomically just like in Redis.

### Does Ferrite support Pub/Sub?

Yes, full Pub/Sub support including pattern subscriptions and sharded Pub/Sub for clusters.

### How do vector search and embeddings work?

Ferrite includes built-in vector search with HNSW and IVF indexing:

```bash
# Create vector index
VECTOR.INDEX.CREATE embeddings DIM 384 DISTANCE COSINE TYPE HNSW

# Add vector
VECTOR.ADD embeddings doc:1 [0.1, 0.2, ...]

# Search
VECTOR.SEARCH embeddings [0.1, 0.2, ...] TOPK 10
```

You can also use automatic embeddings with OpenAI, Cohere, or local ONNX models.

### What is FerriteQL?

FerriteQL is a SQL-like query language for complex operations across multiple keys:

```sql
SELECT * FROM users WHERE age > 21 ORDER BY created_at DESC LIMIT 10
```

### Can I store JSON documents?

Yes, Ferrite includes a MongoDB-compatible document store:

```bash
DOC.INSERT articles {"title": "Hello", "author": "Alice"}
DOC.FIND articles {"author": "Alice"}
DOC.AGGREGATE articles [{"$group": {"_id": "$author", "count": {"$sum": 1}}}]
```

## Data & Storage

### Where does Ferrite store data?

By default:
- Data directory: `/var/lib/ferrite/data`
- AOF file: `/var/lib/ferrite/appendonly.aof`
- Checkpoints: `/var/lib/ferrite/checkpoints/`

These are configurable in `ferrite.toml`.

### How does persistence work?

Ferrite supports multiple persistence modes:
1. **AOF (Append-Only File)**: Logs every write for durability
2. **Checkpoints**: Periodic snapshots for faster recovery
3. **Hybrid**: Both AOF and checkpoints (recommended)

### What happens if Ferrite crashes?

On restart, Ferrite recovers data from:
1. The latest checkpoint (fastest)
2. Replaying the AOF from checkpoint position

No data loss if AOF is enabled with `fsync=always`.

### How much data can Ferrite handle?

With tiered storage, Ferrite can handle datasets larger than available RAM. In practice:
- Memory: Limited by RAM
- With tiering: Limited by disk space (tested to 10TB+)

### Does Ferrite support TTL/expiration?

Yes, full TTL support with lazy and active expiration:

```bash
SET key value EX 3600  # Expires in 1 hour
EXPIRE key 3600        # Set expiration on existing key
TTL key                # Check remaining time
```

## Security

### Does Ferrite support authentication?

Yes, Ferrite supports:
- Password authentication (AUTH command)
- ACL (Access Control Lists) for fine-grained permissions
- TLS/SSL encryption
- At-rest encryption (Enterprise)

### How do I enable TLS?

```toml
[tls]
enabled = true
cert_file = "/path/to/server.crt"
key_file = "/path/to/server.key"
ca_file = "/path/to/ca.crt"
```

### Is data encrypted at rest?

At-rest encryption is available in Ferrite Enterprise. Community edition stores data unencrypted (you can use encrypted filesystems).

## Clustering & High Availability

### How does Ferrite handle replication?

Ferrite supports:
- Primary-replica replication (async and sync modes)
- Raft-based consensus for automatic failover
- CRDT-based conflict resolution for multi-master

### What happens during a primary failure?

With automatic failover enabled:
1. Replicas detect primary failure (heartbeat timeout)
2. Raft election selects new primary
3. Clients are redirected automatically
4. Typical failover time: 1-3 seconds

### Can I add nodes without downtime?

Yes, you can:
- Add replicas at any time
- Reshard data online
- Remove nodes with migration

## Migration

### How do I migrate from Redis?

1. **Compatibility check**: Run `ferrite-migrate analyze` to check compatibility
2. **Sync setup**: Configure Ferrite as a replica of Redis
3. **Live sync**: Data syncs in real-time
4. **Cutover**: Switch clients to Ferrite
5. **Validation**: Verify data integrity

See the [Migration Guide](/docs/migration/from-redis) for details.

### Are there breaking changes from Redis?

Most Redis functionality works identically. Known differences:
- Some administrative commands may behave differently
- Cluster slot migration has different semantics
- Certain edge cases in Lua scripting

Run the compatibility analyzer for your specific use case.

## Troubleshooting

### Ferrite won't start - what do I check?

1. **Port in use**: Check if port 6379 is available
2. **Permissions**: Verify data directory permissions
3. **Configuration**: Check `ferrite.toml` syntax
4. **Logs**: Check `/var/log/ferrite/ferrite.log`

```bash
# Check if port is in use
lsof -i :6380

# Verify config syntax
ferrite --config ferrite.toml --test-config

# Start with verbose logging
RUST_LOG=ferrite=debug ferrite --config ferrite.toml
```

### Why is Ferrite using so much memory?

Common causes:
1. **No max_memory set**: Configure `max_memory` limit
2. **Cold tier disabled**: Enable tiered storage
3. **Memory fragmentation**: Monitor with INFO memory
4. **Large values**: Consider compression

```bash
# Check memory breakdown
INFO memory

# Find large keys
redis-cli --bigkeys

# Enable tiered storage to reduce memory
# In ferrite.toml:
# [storage]
# backend = "hybridlog"
# data_dir = "./data"
```

### How do I debug slow queries?

```bash
# Enable slow log
CONFIG SET slowlog-log-slower-than 10000  # 10ms
CONFIG SET slowlog-max-len 128

# View slow queries
SLOWLOG GET 10

# Enable query tracing
TRACE.ENABLE slow
```

### I'm getting "WRONGTYPE Operation against a key holding the wrong kind of value"

This means you're using a command for one data type on a key that holds a different type.

```bash
# Check the key type first
TYPE mykey

# Common mistake: using GET on a hash
HGET myhash field    # Correct for hashes
GET myhash           # Wrong - will give WRONGTYPE error
```

### Vector search returns no results or poor results

1. **Dimension mismatch**: Ensure query vectors have the same dimensions as indexed vectors
2. **Wrong distance metric**: Check if COSINE, L2, or IP matches your embeddings
3. **Empty index**: Verify vectors were added successfully

```bash
# Check index info
VECTOR.INFO myindex

# Verify dimensions match
# Your embedding model's output dimensions must match DIM in VECTOR.CREATE

# Try a broader search
VECTOR.SEARCH myindex "[0.1, 0.2, ...]" K 100
```

### Tiered storage data not being evicted to disk

1. **Warm threshold too high**: Lower the threshold
2. **Access patterns**: Frequently accessed data stays hot
3. **Compaction not running**: Check background job status

```bash
# Check tier distribution
INFO storage

# Force tier management
DEBUG TIER COMPACT

# Adjust thresholds
CONFIG SET storage.warm_threshold "512mb"
```

### Migrating from Redis: commands behaving differently

Some differences to watch for:

| Scenario | Redis | Ferrite |
|----------|-------|---------|
| Default port | 6379 | 6380 |
| KEYS on large DB | Blocking | Still blocking (use SCAN) |
| Cluster MIGRATE | One-shot | Streaming |

```bash
# Run compatibility analyzer before migration
ferrite-migrate analyze redis://localhost:6379

# Check specific command compatibility
ferrite-migrate check-command "EVALSHA script 0"
```

### Cluster node shows as "fail" but is running

1. **Network partition**: Check connectivity between nodes
2. **Gossip port blocked**: Ensure port+10000 is open (e.g., 16380)
3. **Clock skew**: Synchronize clocks with NTP

```bash
# Check node connectivity
CLUSTER NODES

# Test gossip port
nc -zv node-address 16380

# Meet the node again
CLUSTER MEET node-address 6380
```

### "OOM command not allowed" but memory looks fine

This can happen when:
1. **Maxmemory reached**: Check actual vs configured limit
2. **Replica with writes**: Replicas reject writes when master is OOM
3. **Transaction OOM**: Large transactions can exceed limits

```bash
# Check memory status
INFO memory

# See exact maxmemory setting
CONFIG GET maxmemory

# Check if you're on a replica
ROLE
```

### Lua scripts failing that worked in Redis

Common differences:
1. **redis.call vs ferrite.call**: Both work, but check return types
2. **cjson availability**: Use `ferrite.json` instead
3. **Cluster restrictions**: Scripts must access keys in same slot

```lua
-- Use JSON encoding
local data = ferrite.json.encode({key = "value"})

-- Ensure all keys in same hash slot
-- Keys should share a {hashtag}
EVAL "return redis.call('GET', KEYS[1])" 1 user:{123}:name
```

### Client connections being dropped randomly

1. **Timeout settings**: Client or server timeouts too aggressive
2. **Max clients reached**: Check connection limits
3. **TCP keepalive**: Not configured properly

```bash
# Check client count
INFO clients

# See connected clients
CLIENT LIST

# Adjust timeout (0 = no timeout)
CONFIG SET timeout 0

# Set TCP keepalive
CONFIG SET tcp-keepalive 300
```

### AOF file growing too large

1. **Rewrite not happening**: Trigger manually or adjust thresholds
2. **Write-heavy workload**: Normal for high-write scenarios
3. **No compaction**: Check if auto-rewrite is enabled

```bash
# Check AOF status
INFO persistence

# Trigger rewrite manually
BGREWRITEAOF

# Adjust auto-rewrite settings
CONFIG SET auto-aof-rewrite-percentage 100
CONFIG SET auto-aof-rewrite-min-size 64mb
```

### How do I report a bug?

1. Check [GitHub Issues](https://github.com/ferrite-rs/ferrite/issues) for existing reports
2. Gather: version, config, error messages, steps to reproduce
3. Create a new issue with the bug report template
4. For security issues, email security@ferrite.dev

```bash
# Generate diagnostic report for bug reports
ferrite-cli DEBUG REPORT > diagnostics.txt
```

## Licensing & Support

### What license is Ferrite under?

Ferrite is released under the Apache 2.0 license, which allows:
- Commercial use
- Modification
- Distribution
- Patent use
- Private use

### Is there commercial support?

Yes, Ferrite Enterprise includes:
- 24/7 support
- SLA guarantees
- Additional features (at-rest encryption, audit logging)
- Professional services

Contact sales@ferrite.dev for information.

### How do I contribute?

See our [Contributing Guide](/docs/community/contributing). We welcome:
- Bug reports and fixes
- Feature implementations
- Documentation improvements
- Test coverage

## Still Have Questions?

- [Discord Community](https://discord.gg/ferrite)
- [GitHub Discussions](https://github.com/ferrite-rs/ferrite/discussions)
- [Stack Overflow](https://stackoverflow.com/questions/tagged/ferrite)
- [Email Support](mailto:support@ferrite.dev)
