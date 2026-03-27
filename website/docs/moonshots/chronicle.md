---
sidebar_position: 4
title: "Chronicle — Branchable State"
description: "Git-like branching for your database — isolate tenants, test changes, and roll back state."
---

# Chronicle — Branchable State

## What It Is

Chronicle adds git-style branching to Ferrite's key-value store. You can create isolated branches of your data, make changes within a branch without affecting others, take snapshots, and roll back to a previous state. This is useful for multi-tenant isolation, staging environments, A/B testing, and safe schema migrations — all without spinning up separate database instances.

## When to Use It

- You need lightweight tenant isolation where each tenant sees its own keyspace.
- You want to test data migrations on a branch before applying them to the main state.
- Your application requires point-in-time snapshots for rollback or disaster recovery.
- You are running A/B tests and need isolated copies of a dataset.
- You want to implement undo/redo semantics at the database level.

## Quick Start

```redis
# Connect to Ferrite
redis-cli -p 6379

# Create a new branch for a tenant
CHR.BRANCH mytenant

# Switch to the branch (use the returned branch ID)
CHR.USE br-a1b2c3d4

# Set and get data within the branch
CHR.SET greeting "hello from tenant branch"
CHR.GET greeting

# Take a snapshot for safe rollback
CHR.SNAPSHOT

# Roll back to the last snapshot
CHR.ROLLBACK
```

## Command Reference

### CHR.BRANCH

Create a new named branch. The branch starts as a copy-on-write fork of the current state.

**Synopsis**

```
CHR.BRANCH <name>
```

**Arguments**

| Argument | Type | Description |
|----------|------|-------------|
| `name` | string | Human-readable name for the branch. |

**Return**

Bulk string — the generated branch ID (e.g., `br-a1b2c3d4`).

**Example**

```redis
CHR.BRANCH mytenant
# "br-a1b2c3d4"
```

---

### CHR.USE

Switch the current connection to operate within a specific branch.

**Synopsis**

```
CHR.USE <branch-id>
```

**Arguments**

| Argument | Type | Description |
|----------|------|-------------|
| `branch-id` | string | Branch ID returned by `CHR.BRANCH`. |

**Return**

`OK` on success.

**Example**

```redis
CHR.USE br-a1b2c3d4
# OK
```

---

### CHR.SET

Set a key-value pair within the currently active branch.

**Synopsis**

```
CHR.SET <key> <value>
```

**Arguments**

| Argument | Type | Description |
|----------|------|-------------|
| `key` | string | The key to set. |
| `value` | string | The value to associate with the key. |

**Return**

`OK` on success.

**Example**

```redis
CHR.SET greeting "hello from tenant branch"
# OK
```

---

### CHR.GET

Get the value of a key within the currently active branch.

**Synopsis**

```
CHR.GET <key>
```

**Arguments**

| Argument | Type | Description |
|----------|------|-------------|
| `key` | string | The key to retrieve. |

**Return**

Bulk string — the value, or `(nil)` if the key does not exist in this branch.

**Example**

```redis
CHR.GET greeting
# "hello from tenant branch"
```

---

### CHR.DEL

Delete a key within the currently active branch.

**Synopsis**

```
CHR.DEL <key>
```

**Arguments**

| Argument | Type | Description |
|----------|------|-------------|
| `key` | string | The key to delete. |

**Return**

Integer — `1` if the key was deleted, `0` if it did not exist.

**Example**

```redis
CHR.DEL greeting
# (integer) 1
```

---

### CHR.STATS

Return statistics about branches.

**Synopsis**

```
CHR.STATS
```

**Return**

Key-value pairs with branch counts, snapshot counts, and memory usage.

**Example**

```redis
CHR.STATS
# 1) "total_branches"
# 2) (integer) 5
# 3) "total_snapshots"
# 4) (integer) 12
# 5) "active_branch"
# 6) "br-a1b2c3d4"
```

---

### CHR.SNAPSHOT

Create a point-in-time snapshot of the current branch.

**Synopsis**

```
CHR.SNAPSHOT
```

**Return**

Bulk string — the snapshot ID.

**Example**

```redis
CHR.SNAPSHOT
# "snap-e5f6a7b8"
```

---

### CHR.ROLLBACK

Roll back the current branch to the most recent snapshot.

**Synopsis**

```
CHR.ROLLBACK [snapshot-id]
```

**Arguments**

| Argument | Type | Description |
|----------|------|-------------|
| `snapshot-id` | string | *(Optional)* Specific snapshot to roll back to. Defaults to the most recent. |

**Return**

`OK` on success.

**Example**

```redis
CHR.ROLLBACK
# OK
```

---

### CHR.SAVE

Persist branch and snapshot state to disk.

**Synopsis**

```
CHR.SAVE
```

**Return**

`OK` on success.

**Example**

```redis
CHR.SAVE
# OK
```

---

### CHR.LOAD

Load previously persisted branch state from disk.

**Synopsis**

```
CHR.LOAD
```

**Return**

`OK` on success.

**Example**

```redis
CHR.LOAD
# OK
```

---

### CHR.HELP

Display usage information for Chronicle commands.

**Synopsis**

```
CHR.HELP
```

**Return**

Array of help strings describing available commands.

**Example**

```redis
CHR.HELP
# 1) "CHR.BRANCH <name>"
# 2) "CHR.USE <branch-id>"
# ...
```

## Concepts

### Data Model

Chronicle uses a layered copy-on-write model:

- **Main state** — the base keyspace shared across all connections by default.
- **Branch** — a named, isolated fork of the main state. Reads fall through to the parent if a key is not overridden.
- **Snapshot** — a frozen point-in-time capture of a branch's state.

### Copy-on-Write Semantics

When a branch is created, it does not duplicate the entire dataset. Instead, it shares the parent state and only stores keys that are modified (`CHR.SET`) or deleted (`CHR.DEL`) within the branch. This makes branch creation nearly instantaneous regardless of dataset size.

### Branch Lifecycle

1. **Create** — `CHR.BRANCH` forks from the current state.
2. **Activate** — `CHR.USE` switches the connection to the branch.
3. **Modify** — `CHR.SET` and `CHR.DEL` operate within the branch.
4. **Snapshot** — `CHR.SNAPSHOT` captures the current branch state for safe rollback.
5. **Rollback** — `CHR.ROLLBACK` reverts to a prior snapshot.
6. **Persist** — `CHR.SAVE` writes branches and snapshots to disk.

### Read Path

When reading a key in a branch:

1. Check the branch overlay for the key.
2. If not found, check the parent branch (recursively up to the main state).
3. If not found in any layer, return `(nil)`.

## Operational Guidance

### Telemetry

When OpenTelemetry is enabled (`--features otel`), Chronicle emits:

| Metric | Type | Description |
|--------|------|-------------|
| `ferrite.chronicle.branches_total` | Gauge | Number of active branches. |
| `ferrite.chronicle.snapshots_total` | Counter | Total snapshots created. |
| `ferrite.chronicle.rollbacks_total` | Counter | Total rollback operations. |
| `ferrite.chronicle.overlay_keys` | Gauge | Keys stored in branch overlays. |

### Limits

- Maximum branches: **1,024** (configurable).
- Maximum snapshots per branch: **64**.
- Branch overlay memory is proportional to the number of modified keys, not the total dataset.
- Deeply nested branch reads (branch → parent → grandparent) add latency per layer.

### Failure Modes

| Scenario | Behavior |
|----------|----------|
| Branch not found on `CHR.USE` | Returns `ERR unknown branch`. |
| No snapshot available for rollback | Returns `ERR no snapshot available`. |
| Branch limit exceeded | `CHR.BRANCH` returns `ERR max branches reached`. |
| Server restart without `CHR.SAVE` | Branch and snapshot data is lost. |

## Migration / Interop

Chronicle has no direct Redis equivalent. Comparable patterns include:

- **Redis `COPY` + `RENAME`** — Chronicle branches are more efficient (copy-on-write vs. full copy).
- **Redis `MULTI`/`EXEC`** — Chronicle branches provide longer-lived isolation than transactions.
- **Separate Redis instances per tenant** — Chronicle branches achieve tenant isolation within a single instance.

To adopt Chronicle in an existing application, create a branch per tenant and prefix your connection setup with `CHR.USE`.

## Status

:::caution Pre-alpha
Chronicle is in **pre-alpha**. APIs may change without notice. Do not use in production workloads. Feedback is welcome via [GitHub Issues](https://github.com/FerriteLabs/ferrite/issues).
:::
