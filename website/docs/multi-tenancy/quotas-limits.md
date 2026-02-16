---
sidebar_position: 3
maturity: experimental
---

# Quotas & Limits

Manage resource allocation and usage limits per tenant.

## Overview

Quotas ensure fair resource distribution and prevent any single tenant from monopolizing resources.

## Resource Types

| Resource | Unit | Description |
|----------|------|-------------|
| Memory | Bytes | Total memory usage |
| Keys | Count | Number of keys |
| Operations | ops/sec | Commands per second |
| Connections | Count | Concurrent connections |
| Databases | Count | Number of databases |
| Storage | Bytes | Disk storage (if tiered) |

## Setting Limits

### At Tenant Creation

```bash
TENANT.CREATE acme-corp \
  MEMORY 1073741824 \
  KEYS 1000000 \
  OPS 5000 \
  CONNECTIONS 100
```

### Update Existing Tenant

```bash
# Set individual limits
TENANT.LIMITS.SET acme-corp MEMORY 2147483648  # 2GB
TENANT.LIMITS.SET acme-corp KEYS 2000000
TENANT.LIMITS.SET acme-corp OPS 10000
TENANT.LIMITS.SET acme-corp CONNECTIONS 200

# Multiple limits at once
TENANT.UPDATE acme-corp \
  MEMORY 2147483648 \
  KEYS 2000000 \
  OPS 10000
```

### Using Tiers

```bash
# Create with predefined tier
TENANT.CREATE startup-xyz TIER basic

# Upgrade tier
TENANT.UPDATE startup-xyz TIER pro
```

## Tier Definitions

### Default Tiers

| Tier | Memory | Keys | Ops/sec | Connections |
|------|--------|------|---------|-------------|
| free | 64 MB | 10K | 100 | 10 |
| basic | 512 MB | 100K | 1K | 50 |
| pro | 4 GB | 10M | 50K | 500 |
| enterprise | 64 GB | 1B | 1M | 10K |

### Configure Custom Tiers

```toml
[tenancy.tiers.startup]
memory_bytes = 1073741824      # 1 GB
max_keys = 500000
ops_per_second = 2500
max_connections = 100
max_databases = 4
price_monthly = 49.99

[tenancy.tiers.growth]
memory_bytes = 4294967296      # 4 GB
max_keys = 5000000
ops_per_second = 25000
max_connections = 500
max_databases = 16
price_monthly = 199.99
```

## Monitoring Usage

### Current Usage

```bash
TENANT.INFO acme-corp
# Returns:
# id: acme-corp
# tier: pro
# memory_used: 1073741824
# memory_limit: 4294967296
# memory_percent: 25.0
# keys: 500000
# keys_limit: 10000000
# ops_current: 2500
# ops_limit: 50000
# connections_active: 50
# connections_limit: 500
```

### Usage Over Time

```bash
TENANT.USAGE acme-corp RANGE 24h
# Returns hourly usage data:
# [
#   {time: "2024-01-15T00:00:00Z", memory: 1.0GB, ops: 2000},
#   {time: "2024-01-15T01:00:00Z", memory: 1.1GB, ops: 2500},
#   ...
# ]
```

### All Tenants Summary

```bash
TENANT.LIST USAGE
# Returns summary for all tenants
```

## Quota Enforcement

### Soft Limits (Warning)

```toml
[tenancy.quotas]
warning_threshold = 0.8  # 80%
```

```bash
# When 80% of quota reached
# Logged: WARN tenant acme-corp at 80% of memory quota
```

### Hard Limits (Reject)

```bash
# When 100% of memory quota reached
SET large_key "data..."
# Error: OOM tenant memory quota exceeded

# When 100% of ops quota reached
GET key
# Error: Rate limit exceeded, retry after 100ms
```

### Graceful Degradation

```toml
[tenancy.quotas]
# Allow burst above limit temporarily
burst_allowance = 1.1  # 10% burst
burst_duration_secs = 60

# Throttle instead of reject
throttle_on_quota = true
```

## Billing Integration

### Usage Tracking

```bash
TENANT.BILLING acme-corp PERIOD 2024-01
# Returns:
# period: 2024-01
# tier: pro
# base_price: 199.99
# overage: {
#   memory_gb_hours: 100,
#   memory_overage_cost: 10.00,
#   ops_millions: 500,
#   ops_overage_cost: 5.00
# }
# total: 214.99
```

### Overage Pricing

```toml
[tenancy.billing]
# Price per GB-hour over quota
memory_overage_per_gb_hour = 0.10

# Price per million ops over quota
ops_overage_per_million = 0.01

# Maximum overage allowed (as multiplier)
max_overage = 2.0  # Can use up to 2x quota
```

### Usage Alerts

```bash
# Set custom alert thresholds
TENANT.ALERT acme-corp \
  MEMORY 0.9 \
  OPS 0.8 \
  WEBHOOK https://billing.example.com/alerts
```

## Dynamic Scaling

### Auto-Upgrade

```toml
[tenancy.scaling]
auto_upgrade = true
upgrade_threshold = 0.95
upgrade_to_next_tier = true
notify_on_upgrade = true
```

### Manual Scaling

```bash
# Scale up temporarily
TENANT.LIMITS.SET acme-corp MEMORY 8589934592 TEMPORARY 3600  # 8GB for 1 hour
```

## Commands Reference

### TENANT.LIMITS.SET

```bash
TENANT.LIMITS.SET <tenant_id> <resource> <value> [TEMPORARY <seconds>]

# Resources: MEMORY, KEYS, OPS, CONNECTIONS, DATABASES, STORAGE

# Examples
TENANT.LIMITS.SET acme-corp MEMORY 4294967296
TENANT.LIMITS.SET acme-corp OPS 10000 TEMPORARY 3600
```

### TENANT.LIMITS.GET

```bash
TENANT.LIMITS.GET <tenant_id>
# Returns all limits

TENANT.LIMITS.GET <tenant_id> MEMORY
# Returns specific limit
```

### TENANT.QUOTA

```bash
TENANT.QUOTA <tenant_id>
# Returns current usage vs limits with percentages
```

### TENANT.USAGE

```bash
TENANT.USAGE <tenant_id> [RANGE <duration>] [RESOLUTION <interval>]

# Examples
TENANT.USAGE acme-corp
TENANT.USAGE acme-corp RANGE 7d
TENANT.USAGE acme-corp RANGE 24h RESOLUTION 1h
```

## Rust API

```rust
use ferrite::tenancy::{QuotaManager, ResourceType, QuotaStatus};

let quota_manager = QuotaManager::new(config);

// Set limits
quota_manager.set_limit("acme-corp", ResourceType::Memory, 4 * GB)?;
quota_manager.set_limit("acme-corp", ResourceType::OpsPerSecond, 50000)?;

// Check quota before operation
match quota_manager.check_quota("acme-corp", ResourceType::Memory, 1024) {
    QuotaStatus::Allowed => {
        // Proceed
    }
    QuotaStatus::Warning(percent) => {
        log::warn!("Tenant at {}% of quota", percent);
        // Proceed but alert
    }
    QuotaStatus::Exceeded => {
        return Err("Quota exceeded");
    }
}

// Record usage
quota_manager.record_usage("acme-corp", ResourceType::Memory, 1024)?;
quota_manager.record_usage("acme-corp", ResourceType::Operations, 1)?;

// Get usage report
let report = quota_manager.usage_report("acme-corp", TimeRange::last_24h())?;
println!("Memory: {:.1}%", report.memory_percent);
println!("Ops: {} / {}", report.ops_current, report.ops_limit);
```

## Monitoring

### Prometheus Metrics

```
# Current usage
ferrite_tenant_memory_used_bytes{tenant="acme-corp"} 1073741824
ferrite_tenant_keys_total{tenant="acme-corp"} 500000
ferrite_tenant_ops_current{tenant="acme-corp"} 2500
ferrite_tenant_connections_active{tenant="acme-corp"} 50

# Limits
ferrite_tenant_memory_limit_bytes{tenant="acme-corp"} 4294967296
ferrite_tenant_keys_limit{tenant="acme-corp"} 10000000
ferrite_tenant_ops_limit{tenant="acme-corp"} 50000
ferrite_tenant_connections_limit{tenant="acme-corp"} 500

# Usage percentage
ferrite_tenant_quota_usage_ratio{tenant="acme-corp", resource="memory"} 0.25
```

### Alerts

```yaml
groups:
  - name: tenant-quotas
    rules:
      - alert: TenantMemoryHigh
        expr: ferrite_tenant_quota_usage_ratio{resource="memory"} > 0.9
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Tenant {{ $labels.tenant }} memory above 90%"

      - alert: TenantRateLimited
        expr: rate(ferrite_tenant_rate_limited_total[5m]) > 0
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Tenant {{ $labels.tenant }} being rate limited"
```

## Best Practices

1. **Set appropriate defaults** - Match typical workload
2. **Monitor usage trends** - Proactive capacity planning
3. **Alert before limits** - 80% warning threshold
4. **Allow controlled burst** - Handle traffic spikes
5. **Review periodically** - Adjust based on actual usage
6. **Document pricing** - Clear overage costs
7. **Automate scaling** - Self-service upgrades

## Next Steps

- [Tenant Isolation](/docs/multi-tenancy/tenant-isolation) - Security guarantees
- [Tenant Migration](/docs/multi-tenancy/tenant-migration) - Moving tenants
- [Monitoring](/docs/operations/monitoring) - Usage monitoring
