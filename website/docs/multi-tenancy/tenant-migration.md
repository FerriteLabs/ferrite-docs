---
sidebar_position: 4
maturity: experimental
---

# Tenant Migration

Move tenants between clusters with zero downtime.

## Overview

Tenant migration allows moving a tenant's data from one Ferrite cluster to another without service interruption.

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Source    │────▶│  Migration  │────▶│   Target    │
│   Cluster   │     │   Manager   │     │   Cluster   │
└─────────────┘     └─────────────┘     └─────────────┘
                           │
                    ┌──────┴──────┐
                    │  Live Sync  │
                    │  + Cutover  │
                    └─────────────┘
```

## Migration Scenarios

| Scenario | Method | Downtime |
|----------|--------|----------|
| Scale out | Live migration | Zero |
| Region move | Live migration | Zero |
| Cluster upgrade | Rolling migration | Zero |
| Emergency move | Fast migration | Minimal |

## Live Migration

### Start Migration

```bash
# Initiate migration
TENANT.MIGRATE acme-corp \
  TARGET target-cluster:6379 \
  MODE live

# Returns:
# migration_id: mig_abc123
# status: syncing
# progress: 0%
```

### Migration Phases

1. **Initial Sync**: Copy all existing data
2. **Live Sync**: Stream changes in real-time
3. **Cutover**: Switch traffic to target
4. **Cleanup**: Remove data from source

### Monitor Progress

```bash
TENANT.MIGRATE.STATUS mig_abc123
# Returns:
# migration_id: mig_abc123
# tenant: acme-corp
# source: source-cluster:6379
# target: target-cluster:6379
# phase: live_sync
# progress: 95%
# keys_synced: 950000
# keys_total: 1000000
# lag_keys: 50
# lag_bytes: 10240
# estimated_completion: 2024-01-15T10:35:00Z
```

### Complete Migration

```bash
# Trigger cutover when lag is low
TENANT.MIGRATE.CUTOVER mig_abc123

# Returns:
# status: completed
# downtime_ms: 150
# keys_migrated: 1000000
```

## Migration Commands

### TENANT.MIGRATE

```bash
TENANT.MIGRATE <tenant_id> TARGET <host:port> [OPTIONS]

# Options:
# MODE live|fast|incremental
# PARALLEL <num_threads>
# BATCH_SIZE <size>
# TIMEOUT <seconds>

# Examples
TENANT.MIGRATE acme-corp TARGET new-cluster:6379 MODE live
TENANT.MIGRATE acme-corp TARGET new-cluster:6379 PARALLEL 4 BATCH_SIZE 1000
```

### TENANT.MIGRATE.STATUS

```bash
TENANT.MIGRATE.STATUS <migration_id>
TENANT.MIGRATE.STATUS ALL  # All active migrations
```

### TENANT.MIGRATE.PAUSE

```bash
TENANT.MIGRATE.PAUSE <migration_id>
# Pauses migration, maintains sync state
```

### TENANT.MIGRATE.RESUME

```bash
TENANT.MIGRATE.RESUME <migration_id>
# Resumes paused migration
```

### TENANT.MIGRATE.CANCEL

```bash
TENANT.MIGRATE.CANCEL <migration_id>
# Cancels migration, cleans up partial data
```

### TENANT.MIGRATE.CUTOVER

```bash
TENANT.MIGRATE.CUTOVER <migration_id> [FORCE]
# Triggers final cutover
# FORCE: Proceed even with lag
```

## Configuration

```toml
[tenancy.migration]
enabled = true
max_concurrent = 5
default_mode = "live"
sync_timeout_secs = 3600
cutover_max_lag = 1000  # Max lag in keys for cutover
parallel_sync = 4
batch_size = 1000

[tenancy.migration.target_validation]
verify_connectivity = true
verify_capacity = true
verify_version = true
```

## Migration Modes

### Live Migration

Zero-downtime migration with continuous sync:

```bash
TENANT.MIGRATE acme-corp TARGET cluster2:6379 MODE live
```

**Phases:**
1. Initial bulk copy
2. Continuous replication of changes
3. Brief pause for cutover (~100ms)
4. Traffic switch

### Fast Migration

Minimal sync, accepts brief downtime:

```bash
TENANT.MIGRATE acme-corp TARGET cluster2:6379 MODE fast
```

**Phases:**
1. Suspend tenant writes
2. Bulk copy all data
3. Resume on target

### Incremental Migration

Gradual migration over time:

```bash
TENANT.MIGRATE acme-corp TARGET cluster2:6379 MODE incremental
```

**Phases:**
1. Sync based on key patterns
2. Move traffic pattern by pattern
3. Complete migration

## Client Handling

### Automatic Redirect

```toml
[tenancy.migration.client_handling]
redirect_mode = "automatic"
redirect_timeout_ms = 5000
```

Clients receive `-MOVED` response during cutover:

```
-MOVED tenant:acme-corp new-cluster:6379
```

### DNS Update

```bash
# Update DNS before cutover
TENANT.MIGRATE.CUTOVER mig_abc123 DNS acme-corp.ferrite.example.com
```

### Application-Level

```python
# Client-side handling
def get_tenant_connection(tenant_id):
    try:
        return connections[tenant_id]
    except MovedException as e:
        # Update connection to new cluster
        connections[tenant_id] = connect(e.new_host, e.new_port)
        return connections[tenant_id]
```

## Validation

### Pre-Migration Checks

```bash
TENANT.MIGRATE.VALIDATE acme-corp TARGET cluster2:6379
# Returns:
# connectivity: ok
# authentication: ok
# capacity: ok (2GB free, need 1GB)
# version_compatible: ok
# network_latency: 5ms
# estimated_duration: 10 minutes
```

### Post-Migration Verification

```bash
TENANT.MIGRATE.VERIFY mig_abc123
# Returns:
# keys_source: 1000000
# keys_target: 1000000
# checksum_match: true
# sample_verified: 1000/1000
# status: verified
```

## Rollback

### Before Cutover

```bash
# Cancel migration
TENANT.MIGRATE.CANCEL mig_abc123

# Source remains primary, no changes
```

### After Cutover

```bash
# Reverse migration
TENANT.MIGRATE acme-corp \
  TARGET original-cluster:6379 \
  MODE live

# Or restore from backup
TENANT.RESTORE acme-corp BACKUP backup_20240115
```

## Rust API

```rust
use ferrite::tenancy::{MigrationManager, MigrationConfig, MigrationMode};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let manager = MigrationManager::new(config);

    // Start migration
    let migration = manager.migrate(
        "acme-corp",
        "target-cluster:6379",
        MigrationConfig {
            mode: MigrationMode::Live,
            parallel: 4,
            batch_size: 1000,
            ..Default::default()
        }
    ).await?;

    // Monitor progress
    loop {
        let status = manager.status(&migration.id).await?;
        println!("Progress: {}%", status.progress);

        if status.phase == MigrationPhase::LiveSync && status.lag_keys < 100 {
            break;
        }
        tokio::time::sleep(Duration::from_secs(1)).await;
    }

    // Cutover
    let result = manager.cutover(&migration.id).await?;
    println!("Migration completed, downtime: {}ms", result.downtime_ms);

    // Verify
    let verification = manager.verify(&migration.id).await?;
    assert!(verification.checksum_match);

    Ok(())
}
```

## Monitoring

### Metrics

```
ferrite_tenant_migration_progress{tenant="acme-corp"} 0.95
ferrite_tenant_migration_lag_keys{tenant="acme-corp"} 50
ferrite_tenant_migration_phase{tenant="acme-corp", phase="live_sync"} 1
ferrite_tenant_migration_duration_seconds{tenant="acme-corp"} 600
```

### Alerts

```yaml
groups:
  - name: tenant-migration
    rules:
      - alert: MigrationStalled
        expr: rate(ferrite_tenant_migration_progress[5m]) == 0
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "Tenant migration {{ $labels.tenant }} stalled"

      - alert: MigrationHighLag
        expr: ferrite_tenant_migration_lag_keys > 10000
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High migration lag for {{ $labels.tenant }}"
```

## Best Practices

1. **Test first** - Practice migration in staging
2. **Monitor lag** - Only cutover when lag is low
3. **Plan timing** - Migrate during low-traffic periods
4. **Have rollback plan** - Know how to reverse if needed
5. **Communicate** - Notify stakeholders of maintenance window
6. **Verify after** - Always verify data integrity post-migration

## Troubleshooting

### Migration Stalled

```bash
# Check status
TENANT.MIGRATE.STATUS mig_abc123

# Check target cluster
ferrite-cli -h target-cluster INFO replication

# Increase parallelism
TENANT.MIGRATE.UPDATE mig_abc123 PARALLEL 8
```

### High Lag

```bash
# Pause non-critical traffic
TENANT.THROTTLE acme-corp OPS 1000

# Or schedule cutover during low traffic
TENANT.MIGRATE.CUTOVER mig_abc123 SCHEDULED "2024-01-16T02:00:00Z"
```

### Cutover Failed

```bash
# Check error
TENANT.MIGRATE.STATUS mig_abc123
# error: "Target cluster unreachable"

# Fix and retry
TENANT.MIGRATE.CUTOVER mig_abc123 RETRY
```

## Next Steps

- [Tenant Isolation](/docs/multi-tenancy/tenant-isolation) - Security guarantees
- [Quotas & Limits](/docs/multi-tenancy/quotas-limits) - Resource management
- [High Availability](/docs/deployment/high-availability) - HA setup
