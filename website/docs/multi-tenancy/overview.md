---
sidebar_position: 1
maturity: experimental
---

:::caution Experimental Feature
This feature is **experimental** and subject to change. APIs, behavior, and performance characteristics may evolve significantly between releases. Use with caution in production environments.
:::

# Multi-Tenancy Overview

Ferrite provides first-class multi-tenancy support for building SaaS applications.

## Overview

Multi-tenancy allows multiple tenants (customers/organizations) to share a single Ferrite deployment while maintaining complete isolation:

```
┌─────────────────────────────────────────────────────────────┐
│                    Multi-Tenant Ferrite                      │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │  Tenant A   │  │  Tenant B   │  │  Tenant C   │         │
│  │  user:*     │  │  user:*     │  │  user:*     │         │
│  │  order:*    │  │  order:*    │  │  order:*    │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
│         │                │                │                 │
│         └────────────────┼────────────────┘                 │
│                          │                                   │
│                   ┌──────┴──────┐                           │
│                   │   Ferrite   │                           │
│                   │   Storage   │                           │
│                   └─────────────┘                           │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Features

- **Complete isolation** - Tenants cannot access each other's data
- **Resource quotas** - Limit memory, keys, connections per tenant
- **Rate limiting** - Control operations per second
- **Per-tenant metrics** - Monitor usage and billing
- **Zero-downtime migration** - Move tenants between clusters
- **Flexible tiers** - Free, Basic, Pro, Enterprise

## Quick Start

### Create a Tenant

```bash
# Create tenant with defaults
TENANT.CREATE acme-corp

# Create with custom limits
TENANT.CREATE startup-xyz MEMORY 512MB KEYS 100000 OPS 1000

# Create with tier
TENANT.CREATE enterprise-client TIER enterprise
```

### Switch Tenant Context

```bash
# Use tenant context
TENANT.USE acme-corp

# All subsequent commands use tenant namespace
SET user:123 "Alice"  # Actually stores __tenant:acme-corp:user:123
GET user:123          # Reads from tenant namespace
```

### Check Tenant Info

```bash
TENANT.INFO acme-corp
# Returns:
# id: acme-corp
# name: Acme Corporation
# tier: pro
# state: active
# memory_used: 128MB
# memory_limit: 512MB
# keys: 50000
# key_limit: 100000
```

## Tenant Tiers

| Tier | Memory | Keys | Ops/sec | Connections |
|------|--------|------|---------|-------------|
| Free | 64 MB | 10K | 100 | 10 |
| Basic | 512 MB | 100K | 1K | 50 |
| Pro | 4 GB | 10M | 50K | 500 |
| Enterprise | 64 GB | 1B | 1M | 10K |

```bash
# Create tenant with tier
TENANT.CREATE my-tenant TIER pro

# Upgrade tier
TENANT.UPDATE my-tenant TIER enterprise
```

## Key Isolation

Keys are automatically namespaced per tenant:

```
Tenant: acme-corp
SET user:123 "Alice"

Internal key: __tenant:acme-corp:user:123
```

This happens transparently - clients don't need to change their code.

## Configuration

```toml
[tenancy]
enabled = true
max_tenants = 10000
isolation_enabled = true
metrics_enabled = true
billing_enabled = true

[tenancy.default_limits]
memory_bytes = 268435456      # 256 MB
max_keys = 100000
ops_per_second = 1000
max_connections = 50
max_databases = 16
```

## Commands

### Tenant Management

```bash
# Create tenant
TENANT.CREATE <id> [NAME <name>] [TIER <tier>] [MEMORY <bytes>] [KEYS <count>] [OPS <rate>]

# Update tenant
TENANT.UPDATE <id> [NAME <name>] [TIER <tier>] [MEMORY <bytes>]

# Delete tenant
TENANT.DELETE <id>

# List tenants
TENANT.LIST [FILTER <state|tier|name>]

# Get tenant info
TENANT.INFO <id>
```

### Context Management

```bash
# Switch to tenant context
TENANT.USE <id>

# Get current tenant
TENANT.CURRENT

# Exit tenant context (admin only)
TENANT.EXIT
```

### Quota Management

```bash
# Set limits
TENANT.LIMITS.SET <id> MEMORY <bytes>
TENANT.LIMITS.SET <id> KEYS <count>
TENANT.LIMITS.SET <id> OPS <rate>

# Get limits
TENANT.LIMITS.GET <id>

# Check quota status
TENANT.QUOTA <id>
```

## Rust API

```rust
use ferrite::tenancy::{TenantManager, TenantConfig, TenantTier};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let manager = TenantManager::new(TenantConfig::default());

    // Create tenant
    let tenant = manager.create_tenant(
        "acme-corp",
        Some("Acme Corporation"),
        Some(TenantTier::Pro),
    )?;

    // Get tenant context for operations
    let ctx = manager.get_tenant("acme-corp")?;

    // Check operation is allowed
    ctx.check_operation(OperationType::Write)?;

    // Record resource usage
    ctx.record_memory(1024);
    ctx.record_keys(1);

    // Get usage stats
    let usage = ctx.get_usage();
    println!("Memory: {:.2}%", usage.memory_percent());

    Ok(())
}
```

## Tenant States

| State | Description |
|-------|-------------|
| `active` | Normal operation |
| `suspended` | No operations allowed |
| `migrating` | In-progress migration |
| `deleting` | Cleanup in progress |
| `archived` | Read-only historical |

```bash
# Suspend tenant
TENANT.SUSPEND acme-corp

# Reactivate tenant
TENANT.ACTIVATE acme-corp
```

## Eviction Policies

Configure per-tenant eviction when memory limit is reached:

| Policy | Description |
|--------|-------------|
| `lru` | Evict least recently used |
| `lfu` | Evict least frequently used |
| `ttl` | Evict based on expiration |
| `noeviction` | Return error when full |
| `random` | Random eviction |
| `volatile-lru` | LRU only for keys with TTL |

```bash
TENANT.UPDATE acme-corp EVICTION lru
```

## Use Cases

### SaaS Platform

```bash
# Each customer gets their own tenant
TENANT.CREATE customer-123 TIER basic
TENANT.CREATE customer-456 TIER pro
TENANT.CREATE customer-789 TIER enterprise
```

### Development Environments

```bash
# Separate environments
TENANT.CREATE dev TIER basic
TENANT.CREATE staging TIER pro
TENANT.CREATE production TIER enterprise
```

### Team Isolation

```bash
# Separate teams within organization
TENANT.CREATE team-frontend
TENANT.CREATE team-backend
TENANT.CREATE team-data
```

## Best Practices

1. **Set appropriate limits** - Match tier to expected usage
2. **Monitor quotas** - Alert before limits are reached
3. **Use meaningful IDs** - Include customer/org identifier
4. **Plan for growth** - Leave headroom in quotas
5. **Test isolation** - Verify tenants can't access each other
6. **Enable billing** - Track usage for cost allocation

## Next Steps

- [Tenant Isolation](/docs/multi-tenancy/tenant-isolation) - Security guarantees
- [Quotas & Limits](/docs/multi-tenancy/quotas-limits) - Resource management
- [Tenant Migration](/docs/multi-tenancy/tenant-migration) - Zero-downtime moves
