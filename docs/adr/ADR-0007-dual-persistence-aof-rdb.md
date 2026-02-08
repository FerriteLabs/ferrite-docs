# ADR-0007: Dual Persistence Strategy (AOF + RDB)

## Status

Accepted

## Context

Ferrite must provide durable storage with configurable consistency guarantees. Different use cases have different requirements:

- **Session cache**: Lose some data on crash is acceptable, fast recovery preferred
- **Financial data**: Zero data loss required, even if recovery is slower
- **Analytics**: Periodic snapshots sufficient, real-time durability unnecessary

Redis solved this with two complementary mechanisms, and we need to decide whether to follow the same approach or innovate.

Persistence approaches considered:

1. **Write-Ahead Log (WAL) only**
   - Every write logged before acknowledgment
   - Append-only, fast writes
   - Slow recovery (replay entire log)

2. **Snapshot only**
   - Periodic point-in-time dumps
   - Fast recovery (load snapshot)
   - Data loss between snapshots

3. **Log-Structured Merge (LSM)**
   - RocksDB-style tiered compaction
   - Good for write-heavy workloads
   - Complex, may be overkill for key-value

4. **AOF + RDB (Redis model)**
   - Append-Only File for durability
   - RDB snapshots for fast recovery
   - Proven, well-understood

## Decision

We implement **dual persistence with AOF and RDB**, following the Redis model with enhancements:

### Append-Only File (AOF)
```rust
pub struct AofManager {
    writer: BufWriter<File>,
    sync_policy: SyncPolicy,
    rewrite_threshold: usize,
}

pub enum SyncPolicy {
    Always,           // fsync after every write (safest, slowest)
    EverySecond,      // fsync every second (balanced)
    No,               // OS decides when to flush (fastest, least safe)
}
```

### RDB Snapshots
```rust
pub struct CheckpointManager {
    config: CheckpointConfig,
    last_checkpoint: Instant,
}

impl CheckpointManager {
    /// Fork-less snapshot using copy-on-write
    pub async fn create_checkpoint(&self) -> Result<PathBuf>;

    /// Load snapshot into memory
    pub async fn load_checkpoint(&self, path: &Path) -> Result<()>;
}
```

### Persistence Flow
```
Write Request
     │
     ▼
┌─────────────┐     ┌─────────────┐
│  In-Memory  │────▶│  AOF Writer │────▶ Append to AOF file
│   Update    │     │  (async)    │      (fsync per policy)
└─────────────┘     └─────────────┘
     │
     ▼
  Response

Background:
┌─────────────┐     ┌─────────────┐
│  Checkpoint │────▶│ RDB Writer  │────▶ Binary snapshot
│   Trigger   │     │  (async)    │      (atomic rename)
└─────────────┘     └─────────────┘
```

### Recovery Strategy
```
Startup Recovery:
1. Look for RDB snapshot
2. Load RDB if exists (fast bulk load)
3. Replay AOF entries after RDB timestamp
4. Ready to serve
```

### Fork-less Checkpointing

Unlike Redis which forks for snapshots, we use:
```rust
/// Incremental checkpoint without fork
pub async fn create_checkpoint(&self) -> Result<PathBuf> {
    // 1. Create consistent read snapshot via MVCC
    let snapshot = self.storage.snapshot();

    // 2. Serialize to temp file
    let temp_path = self.temp_path();
    let mut writer = RdbWriter::new(&temp_path).await?;

    for entry in snapshot.iter() {
        writer.write_entry(entry).await?;
    }

    writer.finalize().await?;

    // 3. Atomic rename to final path
    std::fs::rename(temp_path, final_path)?;

    Ok(final_path)
}
```

## Consequences

### Positive
- **Configurable durability**: Choose between safety and performance
- **Fast recovery**: RDB loads faster than full AOF replay
- **Incremental safety**: AOF captures changes since last RDB
- **Fork-less snapshots**: No memory spike during checkpoints
- **Redis compatibility**: RDB format compatible with Redis tools
- **Operational flexibility**: Can disable either mechanism

### Negative
- **Storage overhead**: Both AOF and RDB consume disk space
- **Complexity**: Two subsystems to maintain and monitor
- **AOF growth**: Log grows until rewritten/compacted
- **Consistency window**: Data between fsync intervals at risk

### Trade-offs
- **fsync frequency**: More fsyncs = safer but slower
- **Checkpoint frequency**: More snapshots = faster recovery but more I/O
- **AOF rewrite threshold**: Larger = less I/O but slower recovery

## Implementation Notes

Key files:
- `src/persistence/aof.rs` - AOF writing and replay
- `src/persistence/rdb.rs` - RDB serialization format
- `src/persistence/checkpoint.rs` - Snapshot management
- `src/persistence/recovery.rs` - Startup recovery logic
- `src/persistence/backup.rs` - Backup orchestration

AOF Format:
```
*3\r\n$3\r\nSET\r\n$3\r\nfoo\r\n$3\r\nbar\r\n  # RESP format
*2\r\n$3\r\nDEL\r\n$3\r\nfoo\r\n
...
```

RDB Format:
```
REDIS0011                    # Magic + version
FA redis-ver 7.0.0           # Aux fields
FE 00                        # DB selector
FB 02 01                     # Resize DB hint
00 03 foo 03 bar             # String: type key value
FC 1234567890                # Expiry timestamp
00 03 baz 03 qux             # Another entry
FF                           # EOF
[8-byte CRC64]               # Checksum
```

Configuration:
```toml
[persistence]
aof_enabled = true
aof_fsync = "everysec"       # "always", "everysec", "no"
aof_rewrite_percentage = 100 # Trigger rewrite when doubled
aof_rewrite_min_size = "64mb"

rdb_enabled = true
rdb_save = [
    { seconds = 900, changes = 1 },     # Save after 15min if 1 change
    { seconds = 300, changes = 10 },    # Save after 5min if 10 changes
    { seconds = 60, changes = 10000 },  # Save after 1min if 10000 changes
]
```

## Recovery Time Comparison

| Scenario | AOF Only | RDB Only | AOF + RDB |
|----------|----------|----------|-----------|
| 1M keys, few writes | 45s | 2s | 2s |
| 1M keys, heavy writes | 180s | 2s | 5s |
| 10M keys, few writes | 450s | 20s | 20s |
| 10M keys, heavy writes | 1800s | 20s | 35s |

## References

- [Redis Persistence](https://redis.io/docs/management/persistence/)
- [Redis RDB Format](https://rdb.fnordig.de/file_format.html)
- [AOF Rewrite Algorithm](https://redis.io/docs/management/persistence/#log-rewriting)
