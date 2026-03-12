---
sidebar_position: 38
maturity: experimental
---

:::caution Experimental Feature
This feature is **experimental** and subject to change. APIs, behavior, and performance characteristics may evolve significantly between releases. Use with caution in production environments.
:::

# Multicloud Commands

Commands for multi-cloud provider management.

## Overview

Multicloud commands enable managing data replication and synchronization across multiple cloud providers and regions. Configure providers, add regions, initiate syncs, and monitor health across your multi-cloud deployment.

## Commands

### MULTICLOUD.PROVIDER.ADD

Add a cloud provider.

```bash
MULTICLOUD.PROVIDER.ADD provider_name
  TYPE aws|gcp|azure|local
  [ENDPOINT url]
  [CREDENTIALS json]
```

**Parameters:**
- `provider_name` - Unique provider identifier
- `TYPE` - Cloud provider type
- `ENDPOINT` - Custom endpoint URL (optional)
- `CREDENTIALS` - Provider credentials as JSON (optional)

**Examples:**
```bash
MULTICLOUD.PROVIDER.ADD primary-aws TYPE aws ENDPOINT "https://s3.us-east-1.amazonaws.com"
# OK

MULTICLOUD.PROVIDER.ADD backup-gcs TYPE gcp
# OK
```

**Returns:** OK

---

### MULTICLOUD.PROVIDER.LIST

List configured cloud providers.

```bash
MULTICLOUD.PROVIDER.LIST
```

**Examples:**
```bash
MULTICLOUD.PROVIDER.LIST
# 1) 1) "name"
#    2) "primary-aws"
#    3) "type"
#    4) "aws"
#    5) "status"
#    6) "active"
# 2) 1) "name"
#    2) "backup-gcs"
#    3) "type"
#    4) "gcp"
#    5) "status"
#    6) "active"
```

**Returns:** Array of provider details

---

### MULTICLOUD.REGION.ADD

Add a region to a provider.

```bash
MULTICLOUD.REGION.ADD provider_name region_name [PRIMARY]
```

**Parameters:**
- `provider_name` - Provider to add the region to
- `region_name` - Cloud region identifier
- `PRIMARY` - Mark as primary region (optional)

**Examples:**
```bash
MULTICLOUD.REGION.ADD primary-aws us-east-1 PRIMARY
# OK

MULTICLOUD.REGION.ADD primary-aws eu-west-1
# OK
```

**Returns:** OK

---

### MULTICLOUD.REGION.LIST

List regions for a provider.

```bash
MULTICLOUD.REGION.LIST provider_name
```

**Examples:**
```bash
MULTICLOUD.REGION.LIST primary-aws
# 1) 1) "region"
#    2) "us-east-1"
#    3) "primary"
#    4) "true"
#    5) "status"
#    6) "synced"
# 2) 1) "region"
#    2) "eu-west-1"
#    3) "primary"
#    4) "false"
#    5) "status"
#    6) "syncing"
```

**Returns:** Array of region details

---

### MULTICLOUD.SYNC

Initiate a sync operation across providers or regions.

```bash
MULTICLOUD.SYNC [PROVIDER provider_name] [REGION region_name] [FULL|INCREMENTAL]
```

**Parameters:**
- `PROVIDER` - Specific provider to sync (optional, default: all)
- `REGION` - Specific region to sync (optional)
- `FULL|INCREMENTAL` - Sync mode (default: INCREMENTAL)

**Examples:**
```bash
MULTICLOUD.SYNC
# OK (incremental sync across all providers)

MULTICLOUD.SYNC PROVIDER primary-aws REGION eu-west-1 FULL
# OK (full sync to specific region)
```

**Returns:** OK

---

### MULTICLOUD.STATUS

Get synchronization status.

```bash
MULTICLOUD.STATUS [PROVIDER provider_name]
```

**Examples:**
```bash
MULTICLOUD.STATUS
# {
#   "providers": 2,
#   "regions": 3,
#   "last_sync": "2026-01-20T12:00:00Z",
#   "pending_ops": 42,
#   "sync_lag_ms": 1500,
#   "status": "syncing"
# }

MULTICLOUD.STATUS PROVIDER primary-aws
# {
#   "provider": "primary-aws",
#   "regions": ["us-east-1", "eu-west-1"],
#   "status": "synced",
#   "last_sync": "2026-01-20T12:00:00Z"
# }
```

**Returns:** Map of sync status

---

### MULTICLOUD.HEALTH

Get health status of all providers and regions.

```bash
MULTICLOUD.HEALTH
```

**Examples:**
```bash
MULTICLOUD.HEALTH
# 1) 1) "provider"
#    2) "primary-aws"
#    3) "healthy"
#    4) "true"
#    5) "latency_ms"
#    6) "12"
# 2) 1) "provider"
#    2) "backup-gcs"
#    3) "healthy"
#    4) "true"
#    5) "latency_ms"
#    6) "25"
```

**Returns:** Array of health status per provider

---

### MULTICLOUD.SAVE

Persist multicloud configuration to store (survives restart).

```bash
MULTICLOUD.SAVE
```

**Examples:**
```bash
MULTICLOUD.SAVE
# OK
```

**Returns:** OK

## Use Cases

### Disaster Recovery Setup

```bash
# Set up primary provider
MULTICLOUD.PROVIDER.ADD primary TYPE aws
MULTICLOUD.REGION.ADD primary us-east-1 PRIMARY

# Set up DR provider on a different cloud
MULTICLOUD.PROVIDER.ADD dr TYPE gcp
MULTICLOUD.REGION.ADD dr us-central1

# Start sync
MULTICLOUD.SYNC FULL

# Persist config
MULTICLOUD.SAVE
```

### Multi-Region Active-Active

```bash
# Add regions
MULTICLOUD.REGION.ADD primary us-east-1 PRIMARY
MULTICLOUD.REGION.ADD primary eu-west-1
MULTICLOUD.REGION.ADD primary ap-southeast-1

# Monitor status
MULTICLOUD.STATUS
MULTICLOUD.HEALTH
```

## Related Commands

- [Cluster Commands](/docs/reference/commands/cluster) - Cluster management
- [S3 Storage Commands](/docs/reference/commands/s3-storage) - S3 object storage
- [Configuration Reference](/docs/reference/configuration) - Cloud tiering config
