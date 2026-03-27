---
sidebar_position: 5
title: "Concord — Multi-Master CRDTs"
description: "Conflict-free replicated data types for multi-master writes without coordination."
---

# Concord — Multi-Master CRDTs

## What It Is

Concord brings Conflict-free Replicated Data Types (CRDTs) to Ferrite, enabling multiple replicas to accept writes independently and merge them later without conflicts. Starting with a G-Counter (grow-only counter), Concord lets distributed Ferrite nodes increment counters locally and converge to the correct global value automatically — no distributed locks, no consensus rounds, no write conflicts.

## When to Use It

- You run Ferrite in a multi-master topology and need counters that converge without conflicts.
- Your application requires high write throughput across geographically distributed nodes.
- You want to count events (page views, API calls, votes) across replicas without coordination.
- You need eventual consistency guarantees with mathematically proven convergence.
- You are replacing a distributed counter backed by Redis `INCRBY` with cross-datacenter replication.

## Quick Start

```redis
# Connect to Ferrite
redis-cli -p 6379

# Increment a G-Counter on replica-a
CON.GINC page_views replica-a 1

# Increment again
CON.GINC page_views replica-a 4

# Read the current counter value
CON.GVAL page_views

# Simulate merging state from another replica
CON.GMERGE page_views replica-b 10

# Read the merged counter value
CON.GVAL page_views
```

## Command Reference

### CON.GINC

Increment a G-Counter for a specific replica.

**Synopsis**

```
CON.GINC <key> <replica-id> <amount>
```

**Arguments**

| Argument | Type | Description |
|----------|------|-------------|
| `key` | string | Counter identifier. |
| `replica-id` | string | Identifier for the replica performing the increment. |
| `amount` | integer | Amount to increment by (must be positive). |

**Return**

Integer — the new local value for this replica.

**Example**

```redis
CON.GINC page_views replica-a 5
# (integer) 5

CON.GINC page_views replica-a 3
# (integer) 8
```

---

### CON.GVAL

Read the current value of a G-Counter (sum across all replicas).

**Synopsis**

```
CON.GVAL <key>
```

**Arguments**

| Argument | Type | Description |
|----------|------|-------------|
| `key` | string | Counter identifier. |

**Return**

Integer — the total counter value (sum of all replica contributions).

**Example**

```redis
CON.GVAL page_views
# (integer) 18
```

---

### CON.GMERGE

Merge a remote replica's counter state into the local state. Used during replication to synchronize counters.

**Synopsis**

```
CON.GMERGE <key> <replica-id> <value>
```

**Arguments**

| Argument | Type | Description |
|----------|------|-------------|
| `key` | string | Counter identifier. |
| `replica-id` | string | Identifier of the remote replica. |
| `value` | integer | The remote replica's counter value. |

**Return**

`OK` on success.

**Example**

```redis
CON.GMERGE page_views replica-b 10
# OK

CON.GVAL page_views
# (integer) 18
```

---

### CON.SAVE

Persist CRDT state to disk.

**Synopsis**

```
CON.SAVE
```

**Return**

`OK` on success.

**Example**

```redis
CON.SAVE
# OK
```

---

### CON.LOAD

Load previously persisted CRDT state from disk.

**Synopsis**

```
CON.LOAD
```

**Return**

`OK` on success.

**Example**

```redis
CON.LOAD
# OK
```

---

### CON.HELP

Display usage information for Concord commands.

**Synopsis**

```
CON.HELP
```

**Return**

Array of help strings describing available commands.

**Example**

```redis
CON.HELP
# 1) "CON.GINC <key> <replica-id> <amount>"
# 2) "CON.GVAL <key>"
# ...
```

## Concepts

### Data Model

Concord currently implements the **G-Counter** (Grow-only Counter) CRDT:

- A G-Counter is a map of `replica-id → count`.
- Each replica only increments its own entry.
- The total value is the sum of all entries.
- Merging takes the maximum of each replica's entry across two states.

```
Replica A: { "a": 8, "b": 0 }  →  merge  →  { "a": 8, "b": 10 }
Replica B: { "a": 0, "b": 10 }  →  merge  →  { "a": 8, "b": 10 }
Both read: 18
```

### Convergence Guarantee

G-Counters are a **proven** CRDT — given that all updates are eventually propagated to all replicas, all replicas will converge to the same value regardless of the order in which updates are applied. This is a mathematical property of the data structure, not a protocol guarantee.

### Merge Semantics

`CON.GMERGE` applies the **join** (least upper bound) operation:

- For each replica ID, take `max(local_value, remote_value)`.
- This is idempotent — merging the same state twice has no effect.
- This is commutative and associative — order does not matter.

### Planned CRDT Types

Future Concord releases plan to add:

| Type | Description |
|------|-------------|
| PN-Counter | Increment and decrement counter. |
| G-Set | Grow-only set. |
| OR-Set | Observed-Remove set (add and remove). |
| LWW-Register | Last-Writer-Wins register. |

## Operational Guidance

### Telemetry

When OpenTelemetry is enabled (`--features otel`), Concord emits:

| Metric | Type | Description |
|--------|------|-------------|
| `ferrite.concord.increments_total` | Counter | Total increment operations. |
| `ferrite.concord.merges_total` | Counter | Total merge operations. |
| `ferrite.concord.counters_active` | Gauge | Number of active CRDT counters. |
| `ferrite.concord.replicas_seen` | Gauge | Distinct replica IDs observed. |

### Limits

- Maximum replicas per counter: **256**.
- Counter values are 64-bit unsigned integers (max: 18,446,744,073,709,551,615).
- Merge operations are O(n) where n is the number of distinct replica IDs.

### Failure Modes

| Scenario | Behavior |
|----------|----------|
| Negative increment amount | Returns `ERR amount must be positive`. |
| Counter not found on `CON.GVAL` | Returns `(integer) 0`. |
| Merge with lower value | No-op (max semantics preserve the higher value). |
| Server restart without `CON.SAVE` | Counter state is lost. |

## Migration / Interop

If you are migrating from Redis `INCRBY`-based counters:

1. Replace `INCRBY counter 5` with `CON.GINC counter replica-a 5`.
2. Replace `GET counter` with `CON.GVAL counter`.
3. Set up periodic `CON.GMERGE` calls between replicas (or use Ferrite's built-in replication when available).

Unlike `INCRBY`, Concord counters are monotonically increasing (G-Counter). If you need decrements, wait for the PN-Counter type or use two G-Counters (one for additions, one for subtractions).

## Status

:::caution Pre-alpha
Concord is in **pre-alpha**. APIs may change without notice. Do not use in production workloads. Only the G-Counter type is currently implemented. Feedback is welcome via [GitHub Issues](https://github.com/FerriteLabs/ferrite/issues).
:::
