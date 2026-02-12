---
sidebar_position: 27
maturity: experimental
---

:::caution Experimental Feature
This feature is **experimental** and subject to change. APIs, behavior, and performance characteristics may evolve significantly between releases. Use with caution in production environments.
:::

# Tenant Commands

Commands for multi-tenancy management.

## Overview

Tenant commands provide comprehensive multi-tenant isolation, allowing multiple customers to share a single Ferrite deployment while maintaining strict data separation, resource quotas, and billing metrics.

> Note: Tenant commands and tenancy configuration are not yet implemented in the
> current server build. This page documents the intended design and may change.

## Commands

### TENANT.CREATE

Create a new tenant.

```bash
TENANT.CREATE tenant_id
  [NAME display_name]
  [CONFIG json]
  [QUOTAS quota_config]
```

**Time complexity:** O(1)

**Examples:**
```bash
# Basic tenant
TENANT.CREATE acme_corp
# OK

# With display name
TENANT.CREATE acme_corp NAME "ACME Corporation"
# OK

# With configuration
TENANT.CREATE acme_corp
  NAME "ACME Corporation"
  CONFIG '{"region": "us-east", "tier": "enterprise"}'
  QUOTAS '{"max_memory": "10GB", "max_keys": 1000000}'
# OK
```

---

### TENANT.DELETE

Delete a tenant and all its data.

```bash
TENANT.DELETE tenant_id [FORCE]
```

**Time complexity:** O(N) where N is the number of tenant keys

**Examples:**
```bash
TENANT.DELETE acme_corp
# Error: Tenant has data. Use FORCE to delete.

TENANT.DELETE acme_corp FORCE
# OK - Tenant and all data deleted
```

---

### TENANT.LIST

List all tenants.

```bash
TENANT.LIST [PATTERN pattern] [WITHINFO]
```

**Time complexity:** O(N) where N is the number of tenants

**Examples:**
```bash
TENANT.LIST
# 1) "acme_corp"
# 2) "globex_inc"
# 3) "initech"

TENANT.LIST PATTERN "acme*"
# 1) "acme_corp"

TENANT.LIST WITHINFO
# 1) 1) "acme_corp"
#    2) "name"
#    3) "ACME Corporation"
#    4) "tier"
#    5) "enterprise"
#    6) "keys"
#    7) "150000"
```

---

### TENANT.INFO

Get tenant information.

```bash
TENANT.INFO tenant_id
```

**Time complexity:** O(1)

**Examples:**
```bash
TENANT.INFO acme_corp
# {
#   "id": "acme_corp",
#   "name": "ACME Corporation",
#   "created_at": "2024-01-01T00:00:00Z",
#   "config": {"region": "us-east", "tier": "enterprise"},
#   "stats": {
#     "keys": 150000,
#     "memory": "2.5GB",
#     "commands_today": 1500000,
#     "bandwidth_today": "15GB"
#   },
#   "quotas": {
#     "max_memory": "10GB",
#     "max_keys": 1000000,
#     "rate_limit": 10000
#   },
#   "status": "active"
# }
```

---

### TENANT.USE

Switch to a tenant context.

```bash
TENANT.USE tenant_id
```

**Time complexity:** O(1)

**Examples:**
```bash
TENANT.USE acme_corp
# OK - Now operating in acme_corp context

# All subsequent commands are scoped to this tenant
SET user:1 "Alice"
GET user:1
# "Alice"

# Switch back to global context
TENANT.USE _global
# OK
```

---

### TENANT.CURRENT

Get current tenant context.

```bash
TENANT.CURRENT
```

**Time complexity:** O(1)

**Examples:**
```bash
TENANT.CURRENT
# "acme_corp"

TENANT.USE _global
TENANT.CURRENT
# "_global"
```

---

### TENANT.UPDATE

Update tenant configuration.

```bash
TENANT.UPDATE tenant_id
  [NAME display_name]
  [CONFIG json]
  [STATUS active|suspended|readonly]
```

**Time complexity:** O(1)

**Examples:**
```bash
# Update name
TENANT.UPDATE acme_corp NAME "ACME Corp International"

# Update configuration
TENANT.UPDATE acme_corp CONFIG '{"tier": "premium"}'

# Suspend tenant
TENANT.UPDATE acme_corp STATUS suspended

# Make read-only (for migration)
TENANT.UPDATE acme_corp STATUS readonly
```

---

### TENANT.STATS

Get tenant statistics.

```bash
TENANT.STATS tenant_id [PERIOD period]
```

**Time complexity:** O(1)

**Examples:**
```bash
TENANT.STATS acme_corp
# {
#   "keys": 150000,
#   "memory_used": "2.5GB",
#   "memory_peak": "3.2GB",
#   "commands": {
#     "total": 15000000,
#     "reads": 12000000,
#     "writes": 3000000
#   },
#   "bandwidth": {
#     "in": "50GB",
#     "out": "120GB"
#   },
#   "connections": {
#     "current": 50,
#     "peak": 200
#   }
# }

TENANT.STATS acme_corp PERIOD day
# Returns stats for the last 24 hours
```

---

### TENANT.LIMITS.SET

Set resource limits for a tenant.

```bash
TENANT.LIMITS.SET tenant_id
  [MEMORY limit]
  [KEYS limit]
  [CONNECTIONS limit]
  [BANDWIDTH limit]
  [RATE limit]
  [CPU limit]
```

**Time complexity:** O(1)

**Examples:**
```bash
# Set memory limit
TENANT.LIMITS.SET acme_corp MEMORY 10GB

# Set multiple limits
TENANT.LIMITS.SET acme_corp
  MEMORY 10GB
  KEYS 1000000
  CONNECTIONS 1000
  BANDWIDTH 100GB/month
  RATE 10000/sec
```

---

### TENANT.LIMITS.GET

Get current limits for a tenant.

```bash
TENANT.LIMITS.GET tenant_id
```

**Time complexity:** O(1)

**Examples:**
```bash
TENANT.LIMITS.GET acme_corp
# {
#   "memory": {"limit": "10GB", "used": "2.5GB", "percent": 25},
#   "keys": {"limit": 1000000, "used": 150000, "percent": 15},
#   "connections": {"limit": 1000, "used": 50, "percent": 5},
#   "bandwidth": {"limit": "100GB/month", "used": "35GB", "percent": 35},
#   "rate": {"limit": "10000/sec", "current": 2500, "percent": 25}
# }
```

---

### TENANT.LIMITS.RESET

Reset usage counters (bandwidth, commands).

```bash
TENANT.LIMITS.RESET tenant_id [COUNTER counter]
```

**Time complexity:** O(1)

**Examples:**
```bash
# Reset all counters
TENANT.LIMITS.RESET acme_corp

# Reset specific counter
TENANT.LIMITS.RESET acme_corp COUNTER bandwidth
```

---

### TENANT.MIGRATE

Migrate tenant to another cluster/node.

```bash
TENANT.MIGRATE tenant_id DESTINATION host:port
  [COPY|MOVE]
  [SLOTS slot_range]
```

**Time complexity:** O(N) where N is the tenant's data size

**Examples:**
```bash
# Copy tenant data to another cluster
TENANT.MIGRATE acme_corp DESTINATION cluster2.example.com:6379 COPY

# Move tenant (delete from source after)
TENANT.MIGRATE acme_corp DESTINATION cluster2.example.com:6379 MOVE
```

---

### TENANT.MIGRATE.STATUS

Check migration status.

```bash
TENANT.MIGRATE.STATUS tenant_id
```

**Examples:**
```bash
TENANT.MIGRATE.STATUS acme_corp
# {
#   "status": "in_progress",
#   "destination": "cluster2.example.com:6379",
#   "progress": {
#     "keys_migrated": 120000,
#     "keys_total": 150000,
#     "percent": 80,
#     "bytes_transferred": "2GB"
#   },
#   "started_at": "2024-01-15T10:00:00Z",
#   "estimated_completion": "2024-01-15T10:15:00Z"
# }
```

---

### TENANT.EXPORT

Export tenant data.

```bash
TENANT.EXPORT tenant_id
  FORMAT rdb|json|csv
  [DESTINATION path]
  [PATTERN pattern]
```

**Time complexity:** O(N) where N is the tenant's data size

**Examples:**
```bash
# Export to RDB
TENANT.EXPORT acme_corp FORMAT rdb DESTINATION /backups/acme_corp.rdb

# Export to JSON
TENANT.EXPORT acme_corp FORMAT json DESTINATION /exports/acme_corp.json

# Export specific keys
TENANT.EXPORT acme_corp FORMAT json PATTERN "user:*" DESTINATION /exports/users.json
```

---

### TENANT.IMPORT

Import data into tenant.

```bash
TENANT.IMPORT tenant_id SOURCE path
  [FORMAT rdb|json]
  [OVERWRITE|MERGE]
```

**Time complexity:** O(N) where N is the import data size

**Examples:**
```bash
# Import RDB
TENANT.IMPORT acme_corp SOURCE /backups/acme_corp.rdb FORMAT rdb

# Import JSON with merge
TENANT.IMPORT acme_corp SOURCE /exports/data.json FORMAT json MERGE
```

---

### TENANT.KEYS

Get tenant key count or list.

```bash
TENANT.KEYS tenant_id [PATTERN pattern] [COUNT]
```

**Time complexity:** O(N) for list, O(1) for COUNT

**Examples:**
```bash
# Get key count
TENANT.KEYS acme_corp COUNT
# (integer) 150000

# List keys matching pattern
TENANT.KEYS acme_corp PATTERN "user:*"
# 1) "user:1"
# 2) "user:2"
# ...
```

---

### TENANT.BILLING

Get billing metrics for a tenant.

```bash
TENANT.BILLING tenant_id [PERIOD period]
```

**Time complexity:** O(1)

**Examples:**
```bash
TENANT.BILLING acme_corp PERIOD month
# {
#   "period": "2024-01",
#   "tenant_id": "acme_corp",
#   "metrics": {
#     "storage_gb_hours": 1800,
#     "bandwidth_gb": 120,
#     "commands_millions": 15,
#     "connections_hours": 50000
#   },
#   "estimated_cost": {
#     "storage": "$18.00",
#     "bandwidth": "$12.00",
#     "operations": "$15.00",
#     "total": "$45.00"
#   }
# }
```

---

### TENANT.AUDIT

Get audit log for tenant operations.

```bash
TENANT.AUDIT tenant_id
  [COUNT count]
  [SINCE timestamp]
  [UNTIL timestamp]
  [TYPE types]
```

**Time complexity:** O(N) where N is the log entries returned

**Examples:**
```bash
TENANT.AUDIT acme_corp COUNT 10
# 1) {"timestamp": 1705320000, "type": "config_change", "user": "admin", "details": {...}}
# 2) {"timestamp": 1705319000, "type": "quota_exceeded", "resource": "memory", ...}

TENANT.AUDIT acme_corp TYPE "quota_exceeded,config_change" SINCE 1705000000
```

## Isolation Modes

### Namespace Isolation (Default)

Keys are automatically prefixed with tenant ID:

```bash
TENANT.USE acme_corp
SET user:1 "Alice"
# Actually stored as: acme_corp:user:1

# Other tenants cannot access
TENANT.USE globex_inc
GET user:1
# (nil)
```

### Database Isolation

Each tenant gets separate logical database:

```bash
# Configure in ferrite.toml
[tenancy]
isolation = "database"

# Usage
TENANT.USE acme_corp  # Switches to DB 1
TENANT.USE globex_inc # Switches to DB 2
```

### Cluster Isolation

Physical separation across cluster nodes:

```bash
# Dedicated nodes for tenant
TENANT.UPDATE acme_corp CONFIG '{"dedicated_nodes": ["node-5", "node-6"]}'
```

## Use Cases

### SaaS Platform

```bash
# Create tenant for new customer
TENANT.CREATE customer_123
  NAME "Customer Inc"
  CONFIG '{"plan": "starter", "region": "us-west"}'
  QUOTAS '{"max_memory": "1GB", "max_keys": 100000, "rate_limit": 1000}'

# Upgrade customer plan
TENANT.LIMITS.SET customer_123
  MEMORY 10GB
  KEYS 1000000
  RATE 10000/sec

TENANT.UPDATE customer_123 CONFIG '{"plan": "enterprise"}'

# Offboard customer
TENANT.EXPORT customer_123 FORMAT json DESTINATION /exports/customer_123.json
TENANT.DELETE customer_123 FORCE
```

### Development/Testing

```bash
# Create isolated environments
TENANT.CREATE dev_team_a NAME "Development Team A"
TENANT.CREATE staging NAME "Staging Environment"
TENANT.CREATE production NAME "Production"

# Copy data from production to staging
TENANT.EXPORT production FORMAT rdb DESTINATION /tmp/prod.rdb
TENANT.IMPORT staging SOURCE /tmp/prod.rdb FORMAT rdb
```

### Resource Management

```bash
# Monitor high-usage tenants
for tenant in $(TENANT.LIST); do
    stats=$(TENANT.STATS $tenant)
    if [ $(echo $stats | jq '.memory_used_percent') -gt 80 ]; then
        echo "Alert: $tenant at $(echo $stats | jq '.memory_used_percent')% memory"
    fi
done

# Rate limit aggressive tenant
TENANT.LIMITS.SET noisy_tenant RATE 100/sec
```

## Rust API

```rust
use ferrite::Client;
use ferrite::tenant::{TenantConfig, TenantLimits, TenantStats};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let client = Client::connect("localhost:6379").await?;

    // Create tenant
    client.tenant_create(
        "acme_corp",
        TenantConfig::default()
            .name("ACME Corporation")
            .config(json!({"tier": "enterprise"})),
    ).await?;

    // Set limits
    client.tenant_limits_set(
        "acme_corp",
        TenantLimits::default()
            .memory("10GB")
            .keys(1_000_000)
            .rate_limit(10_000),
    ).await?;

    // Switch tenant context
    client.tenant_use("acme_corp").await?;

    // Operations are now scoped to acme_corp
    client.set("user:1", "Alice").await?;
    let value: String = client.get("user:1").await?;

    // Get tenant stats
    let stats: TenantStats = client.tenant_stats("acme_corp").await?;
    println!("Keys: {}, Memory: {}", stats.keys, stats.memory_used);

    // Get billing info
    let billing = client.tenant_billing("acme_corp", "month").await?;
    println!("Estimated cost: {}", billing.estimated_cost.total);

    // Migrate tenant
    client.tenant_migrate(
        "acme_corp",
        "cluster2.example.com:6379",
        MigrateMode::Copy,
    ).await?;

    // Monitor migration
    loop {
        let status = client.tenant_migrate_status("acme_corp").await?;
        println!("Migration: {}%", status.progress.percent);
        if status.is_complete() {
            break;
        }
        tokio::time::sleep(Duration::from_secs(5)).await;
    }

    // Delete tenant
    client.tenant_delete("acme_corp", true).await?;

    Ok(())
}
```

## Configuration

```toml
[tenancy]
enabled = true
isolation = "namespace"  # namespace, database, cluster
default_quotas = { max_memory = 1073741824, max_keys = 100000 } # bytes
audit_log = true

[tenancy.billing]
enabled = true
metrics_retention = 7776000 # seconds (90d)
export_interval = 3600      # seconds (1h)

[tenancy.migration]
max_concurrent = 2
chunk_size = 104857600 # bytes (100MB)
```

## Related Commands

- [Cluster Commands](/docs/reference/commands/cluster) - Cluster management
- [Server Commands](/docs/reference/commands/server) - Server administration
- [Multi-Tenancy Guide](/docs/multi-tenancy/overview) - Detailed guide
