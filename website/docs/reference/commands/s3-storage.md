---
sidebar_position: 40
maturity: experimental
---

:::caution Experimental Feature
This feature is **experimental** and subject to change. APIs, behavior, and performance characteristics may evolve significantly between releases. Use with caution in production environments.
:::

# S3 Storage Commands

Commands for S3-compatible object storage.

## Overview

S3 commands provide an S3-compatible API for object storage directly within Ferrite. Create buckets, store objects, and manage data using familiar S3 semantics. These commands integrate with Ferrite's tiered storage engine to offer cloud-native object storage alongside key-value operations.

## Commands

### S3.BUCKET.CREATE

Create a new S3 bucket.

```bash
S3.BUCKET.CREATE bucket_name [REGION region] [ACL private|public-read]
```

**Time Complexity:** O(1)

**Parameters:**
- `bucket_name` - Unique bucket name
- `REGION` - Storage region (optional)
- `ACL` - Access control (default: private)

**Examples:**
```bash
S3.BUCKET.CREATE my-data
# OK

S3.BUCKET.CREATE backups REGION us-east-1 ACL private
# OK
```

**Returns:** OK

---

### S3.BUCKET.DELETE

Delete an empty bucket.

```bash
S3.BUCKET.DELETE bucket_name [FORCE]
```

**Time Complexity:** O(1) for empty buckets, O(N) with FORCE where N is the number of objects

**Parameters:**
- `FORCE` - Delete bucket and all contents (optional)

**Examples:**
```bash
S3.BUCKET.DELETE my-data
# OK

S3.BUCKET.DELETE old-backups FORCE
# OK
```

**Returns:** OK

---

### S3.BUCKET.LIST

List all buckets.

```bash
S3.BUCKET.LIST
```

**Time Complexity:** O(N) where N is the number of buckets

**Examples:**
```bash
S3.BUCKET.LIST
# 1) 1) "name"
#    2) "my-data"
#    3) "region"
#    4) "us-east-1"
#    5) "created_at"
#    6) "2026-01-15T10:00:00Z"
#    7) "objects"
#    8) (integer) 1500
# 2) 1) "name"
#    2) "backups"
#    3) "region"
#    4) "us-east-1"
#    5) "created_at"
#    6) "2026-01-10T08:00:00Z"
#    7) "objects"
#    8) (integer) 42
```

**Returns:** Array of bucket details

---

### S3.PUT

Store an object in a bucket.

```bash
S3.PUT bucket_name key value [CONTENT_TYPE type] [METADATA json]
```

**Time Complexity:** O(1)

**Parameters:**
- `bucket_name` - Target bucket
- `key` - Object key (path)
- `value` - Object content
- `CONTENT_TYPE` - MIME type (optional)
- `METADATA` - Custom metadata JSON (optional)

**Examples:**
```bash
S3.PUT my-data "reports/2026/q1.json" '{"revenue":1000000}' CONTENT_TYPE "application/json"
# OK

S3.PUT backups "db/snapshot-001.rdb" <binary_data>
# OK
```

**Returns:** OK

---

### S3.GET

Retrieve an object from a bucket.

```bash
S3.GET bucket_name key
```

**Time Complexity:** O(1)

**Examples:**
```bash
S3.GET my-data "reports/2026/q1.json"
# '{"revenue":1000000}'
```

**Returns:** Bulk string of object content, or nil if not found

---

### S3.DELETE

Delete an object from a bucket.

```bash
S3.DELETE bucket_name key
```

**Time Complexity:** O(1)

**Examples:**
```bash
S3.DELETE my-data "reports/2026/q1.json"
# (integer) 1
```

**Returns:** Integer — 1 if deleted, 0 if not found

---

### S3.LIST

List objects in a bucket.

```bash
S3.LIST bucket_name [PREFIX prefix] [DELIMITER delimiter] [MAX_KEYS n]
```

**Time Complexity:** O(N) where N is the number of objects returned

**Parameters:**
- `PREFIX` - Filter objects by key prefix (optional)
- `DELIMITER` - Group keys by delimiter (optional)
- `MAX_KEYS` - Maximum number of keys to return (default: 1000)

**Examples:**
```bash
S3.LIST my-data
# 1) "reports/2026/q1.json"
# 2) "reports/2026/q2.json"
# 3) "images/logo.png"

S3.LIST my-data PREFIX "reports/2026/" DELIMITER "/"
# 1) "reports/2026/q1.json"
# 2) "reports/2026/q2.json"

S3.LIST my-data PREFIX "reports/" MAX_KEYS 10
# 1) "reports/2026/q1.json"
# 2) "reports/2026/q2.json"
```

**Returns:** Array of object keys

---

### S3.STATS

Get bucket or overall S3 storage statistics.

```bash
S3.STATS [bucket_name]
```

**Time Complexity:** O(1)

**Examples:**
```bash
S3.STATS
# {
#   "total_buckets": 3,
#   "total_objects": 15000,
#   "total_size_bytes": 536870912,
#   "storage_class": "standard"
# }

S3.STATS my-data
# {
#   "bucket": "my-data",
#   "objects": 1500,
#   "size_bytes": 134217728,
#   "avg_object_size": 89478
# }
```

**Returns:** Map of storage statistics

---

### S3.SAVE

Persist S3 metadata to store (survives restart).

```bash
S3.SAVE
```

**Time Complexity:** O(N) where N is the total number of buckets and objects

**Examples:**
```bash
S3.SAVE
# OK
```

**Returns:** OK

## Use Cases

### Data Lake Integration

```bash
# Create a data lake bucket
S3.BUCKET.CREATE data-lake REGION us-east-1

# Store analytics data
S3.PUT data-lake "events/2026/01/20/batch-001.json" '<events_json>'
S3.PUT data-lake "events/2026/01/20/batch-002.json" '<events_json>'

# List events for a day
S3.LIST data-lake PREFIX "events/2026/01/20/"
```

### Backup & Restore

```bash
# Create backup bucket
S3.BUCKET.CREATE backups

# Store checkpoint
S3.PUT backups "snapshots/2026-01-20.rdb" <snapshot_data>

# List available backups
S3.LIST backups PREFIX "snapshots/"
```

## Related Commands

- [Configuration Reference](/docs/reference/configuration) - Cloud tiering config
- [Multicloud Commands](/docs/reference/commands/multicloud) - Multi-cloud management
- [Keys Commands](/docs/reference/commands/keys) - Key management
