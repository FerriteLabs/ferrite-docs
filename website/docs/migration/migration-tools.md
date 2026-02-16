---
sidebar_position: 4
maturity: beta
---

# Migration Tools

Tools and utilities for seamless migration to Ferrite.

## Overview

Ferrite provides a comprehensive toolkit for migrating from Redis, Memcached, and other data stores.

## Migration Wizard

### Interactive Migration

```bash
# Start the migration wizard
ferrite-migrate wizard

# Output:
# Welcome to Ferrite Migration Wizard!
#
# ? Select source database type:
#   > Redis
#     Memcached
#     RDB file
#     AOF file
#     JSON/CSV import
#
# ? Source connection string:
#   redis://source-server:6379
#
# ? Target Ferrite connection:
#   ferrite://localhost:6379
#
# ? Migration mode:
#   > Live (zero-downtime)
#     Snapshot (point-in-time)
#     Incremental (scheduled syncs)
```

### CLI Migration

```bash
# Quick migration from Redis
ferrite-migrate \
  --source redis://source:6379 \
  --target ferrite://target:6379 \
  --mode live

# Migration with options
ferrite-migrate \
  --source redis://source:6379 \
  --target ferrite://target:6379 \
  --mode live \
  --parallel 8 \
  --batch-size 1000 \
  --filter "user:*" \
  --exclude "temp:*"
```

## ferrite-migrate Tool

### Installation

```bash
# From cargo
cargo install ferrite-tools

# From release binary
curl -sSL https://get.ferrite.io/migrate | bash

# Via Docker
docker pull ferrite/migrate:latest
```

### Commands

#### migrate

```bash
ferrite-migrate migrate [OPTIONS] --source <SOURCE> --target <TARGET>

Options:
  -s, --source <SOURCE>       Source connection string
  -t, --target <TARGET>       Target Ferrite connection
  -m, --mode <MODE>           Migration mode [live|snapshot|incremental]
  -p, --parallel <N>          Parallel workers [default: 4]
  -b, --batch-size <SIZE>     Keys per batch [default: 1000]
  -f, --filter <PATTERN>      Include keys matching pattern
  -e, --exclude <PATTERN>     Exclude keys matching pattern
      --dry-run               Analyze without migrating
      --resume <ID>           Resume previous migration
      --verify                Verify after migration
  -v, --verbose               Verbose output
```

#### analyze

```bash
# Analyze source before migration
ferrite-migrate analyze --source redis://source:6379

# Output:
# ═══════════════════════════════════════════════════════
# SOURCE ANALYSIS REPORT
# ═══════════════════════════════════════════════════════
#
# Connection: redis://source:6379
# Redis Version: 7.2.0
#
# DATA SUMMARY
# ─────────────────────────────────────────────────────
# Total Keys: 1,234,567
# Memory Used: 4.2 GB
#
# KEY DISTRIBUTION
# ─────────────────────────────────────────────────────
# Type          Count       Memory     %
# ─────────────────────────────────────────────────────
# string        800,000     2.1 GB     50.0%
# hash          250,000     1.2 GB     28.6%
# list          100,000     500 MB     11.9%
# set           50,000      250 MB     6.0%
# zset          30,000      100 MB     2.4%
# stream        4,567       50 MB      1.2%
#
# KEY PATTERNS (Top 10)
# ─────────────────────────────────────────────────────
# Pattern           Count      Example
# ─────────────────────────────────────────────────────
# user:*            500,000    user:12345
# session:*         300,000    session:abc123
# cache:*           200,000    cache:product:789
# queue:*           100,000    queue:emails
#
# COMPATIBILITY
# ─────────────────────────────────────────────────────
# ✅ All commands compatible
# ✅ No blocking issues found
# ⚠️  3 Lua scripts detected (will be migrated)
#
# RECOMMENDATIONS
# ─────────────────────────────────────────────────────
# • Estimated migration time: 15-20 minutes
# • Recommended parallel workers: 8
# • Consider excluding: temp:*, cache:* (ephemeral data)
```

#### status

```bash
# Check migration status
ferrite-migrate status --id mig_abc123

# Output:
# Migration: mig_abc123
# Status: IN_PROGRESS
# Phase: LIVE_SYNC
#
# Progress:
# ████████████████████░░░░ 85%
#
# Statistics:
# ─────────────────────────────────────────────────────
# Keys migrated:   1,050,000 / 1,234,567
# Bytes synced:    3.6 GB / 4.2 GB
# Current rate:    25,000 keys/sec
# Lag:             234 keys
# Elapsed:         12m 34s
# ETA:             2m 15s
```

#### verify

```bash
# Verify migration integrity
ferrite-migrate verify \
  --source redis://source:6379 \
  --target ferrite://target:6379

# Output:
# ═══════════════════════════════════════════════════════
# VERIFICATION REPORT
# ═══════════════════════════════════════════════════════
#
# SUMMARY
# ─────────────────────────────────────────────────────
# Keys compared:    1,234,567
# Matching:         1,234,567 (100%)
# Mismatched:       0
# Missing source:   0
# Missing target:   0
#
# RESULT: ✅ VERIFIED
```

## Live Migration Mode

Zero-downtime migration with continuous synchronization.

### How It Works

```
┌─────────────────────────────────────────────────────────┐
│                    LIVE MIGRATION                       │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Phase 1: Initial Sync                                  │
│  ┌──────────┐    bulk copy    ┌──────────┐             │
│  │  Source  │ ───────────────►│  Target  │             │
│  └──────────┘                 └──────────┘             │
│                                                         │
│  Phase 2: Live Sync                                     │
│  ┌──────────┐    keyspace     ┌──────────┐             │
│  │  Source  │ ───notifications─►│  Target  │           │
│  └──────────┘                 └──────────┘             │
│       │                            │                    │
│       ▼                            ▼                    │
│   [writes]                   [replicated]              │
│                                                         │
│  Phase 3: Cutover                                       │
│  ┌──────────┐                 ┌──────────┐             │
│  │  Source  │    stopped      │  Target  │ ◄── traffic │
│  └──────────┘                 └──────────┘             │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Configuration

```yaml
# migration.yaml
mode: live
source:
  type: redis
  host: source-redis.example.com
  port: 6379
  password: ${REDIS_PASSWORD}
  tls: true

target:
  type: ferrite
  host: ferrite.example.com
  port: 6379
  password: ${FERRITE_PASSWORD}
  tls: true

options:
  parallel_workers: 8
  batch_size: 1000
  sync_timeout: 3600
  cutover_max_lag: 100

filters:
  include:
    - "user:*"
    - "session:*"
    - "data:*"
  exclude:
    - "temp:*"
    - "cache:*"

notifications:
  slack: ${SLACK_WEBHOOK}
  email: ops@example.com
```

### Running Live Migration

```bash
# Start migration
ferrite-migrate migrate -c migration.yaml

# Monitor progress
watch ferrite-migrate status --id mig_abc123

# Trigger cutover when ready
ferrite-migrate cutover --id mig_abc123

# Or schedule cutover
ferrite-migrate cutover --id mig_abc123 \
  --scheduled "2024-01-20T02:00:00Z"
```

## RDB Import

Import Redis RDB snapshot files directly.

```bash
# Import RDB file
ferrite-migrate import-rdb dump.rdb \
  --target ferrite://localhost:6379

# With filtering
ferrite-migrate import-rdb dump.rdb \
  --target ferrite://localhost:6379 \
  --filter "user:*" \
  --transform-keys "prefix:{key}"

# Analyze RDB without importing
ferrite-migrate analyze-rdb dump.rdb

# Output:
# RDB Version: 10
# Keys: 1,234,567
# Size: 2.1 GB (compressed) / 4.2 GB (uncompressed)
# Types: string (65%), hash (20%), list (10%), other (5%)
```

## AOF Replay

Replay AOF (Append-Only File) to reconstruct data.

```bash
# Replay AOF file
ferrite-migrate import-aof appendonly.aof \
  --target ferrite://localhost:6379

# With timestamp filtering
ferrite-migrate import-aof appendonly.aof \
  --target ferrite://localhost:6379 \
  --after "2024-01-01T00:00:00Z" \
  --before "2024-01-15T00:00:00Z"
```

## Data Transformation

Transform data during migration.

### Key Transformations

```yaml
# transform.yaml
transformations:
  keys:
    # Add prefix to all keys
    - type: prefix
      value: "migrated:"

    # Rename patterns
    - type: rename
      from: "old_user:(.*)"
      to: "user:$1"

    # Remove prefix
    - type: strip_prefix
      value: "legacy:"

  values:
    # Deserialize and re-serialize
    - type: convert
      from: msgpack
      to: json

    # Modify JSON values
    - type: jq
      filter: '.status = "migrated"'
```

```bash
# Apply transformations
ferrite-migrate migrate \
  --source redis://source:6379 \
  --target ferrite://target:6379 \
  --transform transform.yaml
```

### Custom Transformations

```python
# transform.py
def transform_key(key):
    """Transform key during migration"""
    if key.startswith("v1:"):
        return key.replace("v1:", "v2:")
    return key

def transform_value(key, value, type):
    """Transform value during migration"""
    if type == "string" and key.startswith("user:"):
        import json
        data = json.loads(value)
        data["migrated"] = True
        return json.dumps(data)
    return value
```

```bash
ferrite-migrate migrate \
  --source redis://source:6379 \
  --target ferrite://target:6379 \
  --transform-script transform.py
```

## Validation Tools

### Hash Verification

```bash
# Compare data hashes
ferrite-migrate verify-hash \
  --source redis://source:6379 \
  --target ferrite://target:6379 \
  --sample-rate 0.1  # Check 10% of keys

# Full verification
ferrite-migrate verify-hash \
  --source redis://source:6379 \
  --target ferrite://target:6379 \
  --full
```

### Value Comparison

```bash
# Deep value comparison
ferrite-migrate compare \
  --source redis://source:6379 \
  --target ferrite://target:6379 \
  --keys "user:*" \
  --output diff.json
```

### Benchmark Comparison

```bash
# Compare performance before/after
ferrite-migrate benchmark \
  --source redis://source:6379 \
  --target ferrite://target:6379 \
  --operations 100000

# Output:
# ═══════════════════════════════════════════════════════
# PERFORMANCE COMPARISON
# ═══════════════════════════════════════════════════════
#
# GET Operations (100,000)
# ─────────────────────────────────────────────────────
#              Source       Target      Diff
# Throughput   85,000/s     125,000/s   +47%
# P50          0.45ms       0.28ms      -38%
# P99          1.20ms       0.85ms      -29%
#
# SET Operations (100,000)
# ─────────────────────────────────────────────────────
#              Source       Target      Diff
# Throughput   72,000/s     110,000/s   +53%
# P50          0.52ms       0.32ms      -38%
# P99          1.50ms       0.95ms      -37%
```

## Rollback

### Automatic Rollback

```bash
# Enable automatic rollback on failure
ferrite-migrate migrate \
  --source redis://source:6379 \
  --target ferrite://target:6379 \
  --auto-rollback \
  --rollback-on-error-rate 0.01  # Rollback if >1% errors
```

### Manual Rollback

```bash
# Rollback migration
ferrite-migrate rollback --id mig_abc123

# Reverse migration (target → source)
ferrite-migrate migrate \
  --source ferrite://target:6379 \
  --target redis://source:6379 \
  --mode live
```

## Monitoring Integration

Ferrite migration metrics are planned but not yet exposed by `ferrite-migrate`.
Use standard logging or wrap the tool with external monitoring for now.

## Scripting API

### Python SDK

```python
from ferrite_migrate import Migration, MigrationConfig

config = MigrationConfig(
    source="redis://source:6379",
    target="ferrite://target:6379",
    mode="live",
    parallel=8,
    filters={"include": ["user:*"], "exclude": ["temp:*"]}
)

migration = Migration(config)

# Start migration
migration.start()

# Monitor progress
while not migration.is_complete():
    status = migration.status()
    print(f"Progress: {status.progress}%, Lag: {status.lag}")
    time.sleep(5)

# Trigger cutover
if migration.lag < 100:
    migration.cutover()

# Verify
result = migration.verify()
print(f"Verification: {result.status}")
```

### Rust SDK

```rust
use ferrite_migrate::{Migration, Config, Mode};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let config = Config::builder()
        .source("redis://source:6379")
        .target("ferrite://target:6379")
        .mode(Mode::Live)
        .parallel(8)
        .include_pattern("user:*")
        .exclude_pattern("temp:*")
        .build()?;

    let migration = Migration::new(config).await?;

    // Start migration
    migration.start().await?;

    // Wait for sync
    while migration.lag().await? > 100 {
        tokio::time::sleep(Duration::from_secs(5)).await;
    }

    // Cutover
    migration.cutover().await?;

    // Verify
    let result = migration.verify().await?;
    println!("Verified: {}", result.success);

    Ok(())
}
```

## CI/CD Integration

### GitHub Actions

```yaml
name: Database Migration

on:
  workflow_dispatch:
    inputs:
      environment:
        description: 'Target environment'
        required: true
        type: choice
        options:
          - staging
          - production

jobs:
  migrate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Install migration tool
        run: cargo install ferrite-tools

      - name: Run migration
        run: |
          ferrite-migrate migrate \
            --source ${{ secrets.REDIS_URL }} \
            --target ${{ secrets.FERRITE_URL }} \
            --mode live \
            --verify

      - name: Notify on success
        if: success()
        run: |
          curl -X POST ${{ secrets.SLACK_WEBHOOK }} \
            -d '{"text":"Migration completed successfully!"}'
```

## Best Practices

1. **Always analyze first** - Understand source data before migrating
2. **Test in staging** - Run full migration in non-production first
3. **Monitor lag** - Only cutover when lag is minimal
4. **Verify after** - Always verify data integrity post-migration
5. **Keep rollback ready** - Have a tested rollback plan
6. **Communicate** - Notify stakeholders of maintenance window
7. **Document** - Record migration configuration and results

## Troubleshooting

### Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| Connection timeout | Network issues | Check firewall, increase timeout |
| Memory exhausted | Large keys | Increase batch size, use streaming |
| Sync stalled | High write rate | Increase workers, reduce source load |
| Verification failed | Data changed during verify | Use point-in-time verification |

### Debug Mode

```bash
# Enable debug logging
RUST_LOG=debug ferrite-migrate migrate \
  --source redis://source:6379 \
  --target ferrite://target:6379

# Trace network
ferrite-migrate migrate \
  --source redis://source:6379 \
  --target ferrite://target:6379 \
  --trace
```

## Next Steps

- [From Redis](/docs/migration/from-redis) - Detailed Redis migration guide
- [Compatibility](/docs/migration/compatibility) - Command compatibility matrix
- [High Availability](/docs/deployment/high-availability) - Post-migration HA setup
