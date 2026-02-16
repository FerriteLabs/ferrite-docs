---
sidebar_position: 2
maturity: experimental
---

# Tenant Isolation

Security guarantees and isolation mechanisms for multi-tenant deployments.

## Overview

Ferrite provides multiple layers of isolation to ensure tenants cannot access each other's data:

```
┌─────────────────────────────────────────────────────────┐
│                    Isolation Layers                      │
├─────────────────────────────────────────────────────────┤
│  1. Key Namespace Isolation (logical)                   │
│  2. Memory Isolation (quotas)                           │
│  3. CPU Isolation (rate limiting)                       │
│  4. Network Isolation (connection limits)               │
│  5. Authentication Isolation (per-tenant credentials)   │
└─────────────────────────────────────────────────────────┘
```

## Key Namespace Isolation

### Automatic Key Prefixing

All keys are automatically prefixed with tenant identifier:

```bash
# Tenant context
TENANT.USE acme-corp

# User writes
SET user:123 "Alice"

# Internal storage
# Key stored as: __tenant:acme-corp:user:123

# User reads
GET user:123
# Returns: "Alice"
# Internally reads: __tenant:acme-corp:user:123
```

### Cross-Tenant Access Prevention

```bash
# Tenant A context
TENANT.USE tenant-a
SET secret "tenant-a-data"

# Tenant B context
TENANT.USE tenant-b
GET secret
# Returns: (nil) - Cannot access tenant-a's data

# Even with key manipulation
GET __tenant:tenant-a:secret
# Returns: (nil) - Prefix is added to this too!
# Actually queries: __tenant:tenant-b:__tenant:tenant-a:secret
```

### Pattern Isolation

```bash
# KEYS command is scoped
TENANT.USE acme-corp
KEYS *
# Only returns keys within acme-corp namespace

# SCAN is also scoped
SCAN 0 MATCH user:*
# Only scans acme-corp keys
```

## Memory Isolation

### Per-Tenant Memory Limits

```bash
# Set memory limit
TENANT.LIMITS.SET acme-corp MEMORY 1073741824  # 1GB

# Check usage
TENANT.INFO acme-corp
# memory_used: 536870912
# memory_limit: 1073741824
```

### Memory Enforcement

When limit is reached:

```bash
SET key "value"
# Error: OOM tenant memory limit exceeded

# Or with eviction policy
# Keys are evicted according to tenant's policy
```

### Eviction Policies

```bash
# Set per-tenant eviction policy
TENANT.UPDATE acme-corp EVICTION volatile-lru

# Options:
# - noeviction: Return error when full
# - volatile-lru: LRU among keys with TTL
# - allkeys-lru: LRU among all keys
# - volatile-lfu: LFU among keys with TTL
# - allkeys-lfu: LFU among all keys
# - volatile-random: Random among keys with TTL
# - allkeys-random: Random among all keys
# - volatile-ttl: Shortest TTL first
```

## CPU Isolation

### Rate Limiting

```bash
# Set operations per second limit
TENANT.LIMITS.SET acme-corp OPS 1000

# Check rate limit status
TENANT.QUOTA acme-corp
# ops_used: 500
# ops_limit: 1000
# ops_remaining: 500
```

### Rate Limit Enforcement

```bash
# When limit exceeded
GET key
# Error: Rate limit exceeded for tenant

# With 429 retry-after header in HTTP API
```

### Burst Allowance

```toml
[tenancy.rate_limiting]
burst_multiplier = 1.5  # Allow 50% burst
burst_duration_secs = 10
```

## Connection Isolation

### Connection Limits

```bash
# Set connection limit
TENANT.LIMITS.SET acme-corp CONNECTIONS 100

# Check connections
TENANT.INFO acme-corp
# connections_active: 50
# connections_limit: 100
```

### Connection Enforcement

```
# New connection when at limit
# Error: Maximum connections reached for tenant
```

## Authentication Isolation

### Per-Tenant Credentials

```bash
# Create tenant with password
TENANT.CREATE acme-corp PASSWORD "tenant-secret"

# Authenticate as tenant
AUTH acme-corp tenant-secret
# Automatically sets tenant context
```

### ACL Integration

```bash
# Create tenant user
ACL SETUSER acme-user on >password ~__tenant:acme-corp:* +@all

# User can only access their tenant's keys
```

## Database Isolation

### Per-Tenant Databases

```bash
# Set max databases per tenant
TENANT.LIMITS.SET acme-corp DATABASES 16

# Switch database within tenant
SELECT 1
# Isolated to tenant's database 1
```

## Pub/Sub Isolation

### Channel Namespacing

```bash
TENANT.USE acme-corp

# Subscribe to channel
SUBSCRIBE notifications
# Actually subscribes to: __tenant:acme-corp:notifications

# Publish
PUBLISH notifications "message"
# Only tenant's subscribers receive
```

## Stream Isolation

```bash
TENANT.USE acme-corp

# Create stream
XADD events * type order
# Creates: __tenant:acme-corp:events

# Consumer groups are also isolated
XGROUP CREATE events mygroup $ MKSTREAM
```

## Monitoring Isolation

### Per-Tenant Metrics

```bash
TENANT.METRICS acme-corp
# commands_total: 1000000
# memory_used: 536870912
# connections: 50
# keys: 100000
```

### Prometheus Labels

```
ferrite_commands_total{tenant="acme-corp"} 1000000
ferrite_memory_used_bytes{tenant="acme-corp"} 536870912
```

## Configuration

```toml
[tenancy]
enabled = true
isolation_enabled = true

[tenancy.isolation]
# Key prefix format
key_prefix_format = "__tenant:{tenant_id}:"

# Strict mode - fail on any isolation breach
strict_mode = true

# Log isolation violations
log_violations = true

[tenancy.defaults]
# Default limits for new tenants
memory_bytes = 268435456      # 256 MB
max_keys = 100000
ops_per_second = 1000
max_connections = 50
max_databases = 16
```

## Rust API

```rust
use ferrite::tenancy::{TenantManager, IsolationConfig};

let manager = TenantManager::new(TenantConfig {
    isolation: IsolationConfig {
        enabled: true,
        strict_mode: true,
        key_prefix_format: "__tenant:{tenant_id}:".to_string(),
    },
    ..Default::default()
});

// All operations through tenant context
let ctx = manager.get_tenant("acme-corp")?;

// Keys are automatically namespaced
ctx.set("user:123", "Alice")?;
// Stored as: __tenant:acme-corp:user:123

// Quota checks
ctx.check_operation(OperationType::Write)?;  // May fail if quota exceeded

// Resource tracking
ctx.record_memory(1024);
ctx.record_keys(1);
```

## Security Considerations

### Defense in Depth

1. **Key prefixing** - Logical isolation
2. **ACL enforcement** - Permission-based isolation
3. **Memory limits** - Resource isolation
4. **Rate limiting** - Denial-of-service protection
5. **Audit logging** - Accountability

### Audit Trail

```bash
# Enable tenant audit logging
TENANT.AUDIT acme-corp ENABLE

# View audit log
TENANT.AUDIT.GET acme-corp LAST 100
```

### Compliance

- **Data residency**: Per-tenant storage location
- **Encryption**: Per-tenant encryption keys
- **Retention**: Per-tenant data retention policies

## Testing Isolation

```bash
# Verify isolation
ferrite-test-isolation

# Output:
# ✓ Key namespace isolation
# ✓ Memory isolation
# ✓ Connection isolation
# ✓ Rate limit isolation
# ✓ Pub/Sub isolation
# ✓ Stream isolation
# All isolation tests passed!
```

## Best Practices

1. **Enable strict mode** - Fail fast on violations
2. **Monitor quotas** - Alert before limits hit
3. **Audit access** - Log all operations
4. **Test isolation** - Regular security testing
5. **Defense in depth** - Multiple isolation layers
6. **Encrypt sensitive data** - Per-tenant encryption

## Next Steps

- [Quotas & Limits](/docs/multi-tenancy/quotas-limits) - Resource management
- [Tenant Migration](/docs/multi-tenancy/tenant-migration) - Moving tenants
- [Security](/docs/advanced/security) - Security configuration
