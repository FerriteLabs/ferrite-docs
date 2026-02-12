---
sidebar_position: 3
maturity: stable
---

# Persistence

Ferrite provides multiple persistence options to ensure your data survives restarts and crashes.

## Persistence Options

### AOF (Append-Only File)

AOF logs every write operation. On restart, Ferrite replays the log to restore state.

**Pros:**
- More durable (configurable sync policy)
- Human-readable log
- Can recover from partial corruption

**Cons:**
- Larger file size
- Slower restarts with large datasets

### Checkpoints

Periodic snapshots of the entire dataset. Similar to Redis RDB.

**Pros:**
- Compact file size
- Fast restarts
- Good for backups

**Cons:**
- Potential data loss between checkpoints
- CPU-intensive during checkpoint creation

### Hybrid (Recommended)

Use both AOF and checkpoints together for optimal durability and performance.

## Configuration

### AOF Configuration

```toml
[persistence]
aof_enabled = true
aof_sync = "everysec"           # always, everysec, no
aof_file = "appendonly.aof"
aof_rewrite_percentage = 100    # Trigger rewrite when AOF grows by 100%
aof_rewrite_min_size = "64MB"   # Minimum size before considering rewrite
```

#### Sync Policies

| Policy | Durability | Performance |
|--------|------------|-------------|
| `always` | No data loss | Slowest |
| `everysec` | Up to 1 second of data loss | Balanced |
| `no` | OS-dependent (could be minutes) | Fastest |

### Checkpoint Configuration

```toml
[persistence]
checkpoint_enabled = true
checkpoint_interval = 300       # Seconds between checkpoints
checkpoint_file = "ferrite.ckpt"
checkpoint_compression = true   # Compress checkpoint files
```

## Operations

### Manual Checkpoint

Force an immediate checkpoint:

```bash
127.0.0.1:6379> BGSAVE
Background saving started
```

Check status:

```bash
127.0.0.1:6379> LASTSAVE
(integer) 1610000000

127.0.0.1:6379> INFO persistence
# Persistence
aof_enabled:1
aof_current_size:1048576
aof_last_write_status:ok
checkpoint_in_progress:0
checkpoint_last_save_time:1610000000
```

### AOF Rewrite

Compact the AOF file:

```bash
127.0.0.1:6379> BGREWRITEAOF
Background append only file rewriting started
```

This creates a new AOF with only the minimal commands needed to restore current state.

### Manual Sync

Force AOF sync:

```bash
127.0.0.1:6379> AOF SYNC
OK
```

## Recovery

### Automatic Recovery

On startup, Ferrite automatically:
1. Loads the latest checkpoint (if available)
2. Replays AOF entries since the checkpoint

### Manual Recovery

If automatic recovery fails:

```bash
# Move aside corrupted files
mv appendonly.aof appendonly.aof.bad
mv checkpoints checkpoints.bad

# Start with a clean data directory
ferrite --data-dir ./data-clean
```

### Point-in-Time Recovery

With AOF enabled, you can recover to any point in time by restoring from
checkpoints and replaying AOF externally. Ferrite does not yet include AOF
truncation tooling.

```bash
cp appendonly.aof appendonly.aof.backup
cp -r checkpoints checkpoints.backup
```

## Tiered Storage

Ferrite's unique tiered storage architecture affects persistence:

```
┌─────────────────────────────────────────┐
│           Hot Tier (Memory)              │
│  - All writes go here first              │
│  - Logged to AOF immediately             │
├─────────────────────────────────────────┤
│           Warm Tier (mmap)               │
│  - Memory-mapped files                   │
│  - Automatically persisted               │
├─────────────────────────────────────────┤
│           Cold Tier (Disk/Cloud)         │
│  - Compressed, encrypted                 │
│  - Can tier to S3/GCS/Azure              │
└─────────────────────────────────────────┘
```

### Cloud Tiering

Configure cold tier to use cloud storage (requires `storage.backend = "hybridlog"`):

```toml
[cloud]
enabled = true
provider = "s3"
bucket = "my-ferrite-bucket"
region = "us-east-1"
prefix = "cold-data/"
```

## Backup Strategies

### Hot Backup

Create a backup without stopping the server:

```bash
# Using BGSAVE
127.0.0.1:6379> BGSAVE
127.0.0.1:6379> LASTSAVE
# Copy the checkpoint file when LASTSAVE updates

# Using filesystem snapshot (if supported)
lvcreate --snapshot --name ferrite-snap /dev/vg/ferrite
```

### Cold Backup

For consistent backups, briefly pause writes:

```bash
# Pause writes
127.0.0.1:6379> CLIENT PAUSE 5000 WRITE

# Trigger checkpoint
127.0.0.1:6379> BGSAVE

# Copy files
cp /var/lib/ferrite/*.ckpt /backup/
cp /var/lib/ferrite/*.aof /backup/
```

### Automated Backups

Example backup script:

```bash
#!/bin/bash
BACKUP_DIR="/backup/ferrite/$(date +%Y%m%d)"
DATA_DIR="/var/lib/ferrite"

mkdir -p "$BACKUP_DIR"

# Trigger checkpoint
redis-cli BGSAVE
sleep 5  # Wait for checkpoint

# Copy files
cp "$DATA_DIR"/*.ckpt "$BACKUP_DIR/"
cp "$DATA_DIR"/*.aof "$BACKUP_DIR/"

# Compress
tar -czf "$BACKUP_DIR.tar.gz" "$BACKUP_DIR"
rm -rf "$BACKUP_DIR"

# Keep last 7 days
find /backup/ferrite -name "*.tar.gz" -mtime +7 -delete
```

## Monitoring

Key metrics to monitor:

```bash
127.0.0.1:6379> INFO persistence
# Persistence
aof_enabled:1
aof_current_size:104857600
aof_last_rewrite_time_sec:5
checkpoint_in_progress:0
checkpoint_last_save_time:1610000000
checkpoint_last_duration_sec:2
```

Prometheus metrics:
- `ferrite_aof_size_bytes` - Current AOF file size
- `ferrite_aof_rewrite_duration_seconds` - Last rewrite duration
- `ferrite_checkpoint_duration_seconds` - Last checkpoint duration
- `ferrite_checkpoint_size_bytes` - Last checkpoint size

## Best Practices

1. **Production**: Use both AOF (`everysec`) and checkpoints
2. **Development**: AOF with `no` sync is usually sufficient
3. **High durability**: AOF with `always` sync (slower but safest)
4. **Large datasets**: Enable checkpoint compression
5. **Cloud deployments**: Use cloud tiering for cost efficiency

## Next Steps

- [Transactions](/docs/guides/transactions) - Atomic operations
- [Replication](/docs/advanced/replication) - High availability
- [Clustering](/docs/advanced/clustering) - Horizontal scaling
