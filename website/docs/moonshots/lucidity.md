---
sidebar_position: 3
title: "Lucidity — Verifiable Audit Plane"
description: "Tamper-evident append-only log with cryptographic proofs for audit and compliance."
---

# Lucidity — Verifiable Audit Plane

## What It Is

Lucidity provides a tamper-evident, append-only log inside Ferrite. Every entry is chained with a cryptographic hash, forming a verifiable sequence similar to a blockchain but without consensus overhead. You can append records, retrieve the chain head, and generate inclusion proofs — all through Redis-compatible commands — making it straightforward to add audit trails and compliance logging to any application.

## When to Use It

- You need a tamper-evident audit log for regulatory compliance (SOC 2, HIPAA, PCI-DSS).
- Your application requires cryptographic proof that a record existed at a specific point in time.
- You want append-only semantics where historical entries cannot be modified or deleted.
- You need to detect if any log entries have been altered after the fact.
- You want an embedded audit trail without running a separate blockchain or ledger service.

## Quick Start

```redis
# Connect to Ferrite
redis-cli -p 6379

# Append entries to the audit log
LUC.APPEND user:100:login "login from 192.168.1.42 at 2025-01-15T10:30:00Z"
LUC.APPEND user:100:login "login from 10.0.0.5 at 2025-01-15T14:22:00Z"

# Get the current chain head (latest hash)
LUC.HEAD

# Get the chain length
LUC.LEN

# Generate an inclusion proof for entry at index 0
LUC.PROOF 0
```

## Command Reference

### LUC.APPEND

Append a new entry to the audit log.

**Synopsis**

```
LUC.APPEND <key> <value>
```

**Arguments**

| Argument | Type | Description |
|----------|------|-------------|
| `key` | string | Log stream identifier. |
| `value` | string | The audit record to append. |

**Return**

Integer — the index of the newly appended entry.

**Example**

```redis
LUC.APPEND user:100:login "login from 192.168.1.42 at 2025-01-15T10:30:00Z"
# (integer) 0

LUC.APPEND user:100:login "login from 10.0.0.5 at 2025-01-15T14:22:00Z"
# (integer) 1
```

---

### LUC.DEL

Delete an entire audit log stream. Individual entries cannot be deleted to preserve tamper-evidence within a stream.

**Synopsis**

```
LUC.DEL <key>
```

**Arguments**

| Argument | Type | Description |
|----------|------|-------------|
| `key` | string | Log stream identifier to delete. |

**Return**

Integer — `1` if the stream was deleted, `0` if it did not exist.

**Example**

```redis
LUC.DEL user:100:login
# (integer) 1
```

---

### LUC.LEN

Return the number of entries in an audit log stream.

**Synopsis**

```
LUC.LEN <key>
```

**Arguments**

| Argument | Type | Description |
|----------|------|-------------|
| `key` | string | Log stream identifier. |

**Return**

Integer — the number of entries.

**Example**

```redis
LUC.LEN user:100:login
# (integer) 2
```

---

### LUC.HEAD

Return the hash of the most recent entry in the chain (the chain head).

**Synopsis**

```
LUC.HEAD [key]
```

**Arguments**

| Argument | Type | Description |
|----------|------|-------------|
| `key` | string | *(Optional)* Log stream identifier. Defaults to the global chain. |

**Return**

Bulk string — the hex-encoded hash of the chain head.

**Example**

```redis
LUC.HEAD user:100:login
# "a3f2b8c1d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1"
```

---

### LUC.PROOF

Generate a cryptographic inclusion proof for an entry at a given index.

**Synopsis**

```
LUC.PROOF <index> [key]
```

**Arguments**

| Argument | Type | Description |
|----------|------|-------------|
| `index` | integer | Zero-based index of the entry to prove. |
| `key` | string | *(Optional)* Log stream identifier. Defaults to the global chain. |

**Return**

Array containing the entry value, its hash, and the chain of hashes forming the proof.

**Example**

```redis
LUC.PROOF 0 user:100:login
# 1) "login from 192.168.1.42 at 2025-01-15T10:30:00Z"
# 2) "b7e2a1c3d4f5..."
# 3) 1) "a3f2b8c1d4e5..."
#    2) "c9d0e1f2a3b4..."
```

---

### LUC.SAVE

Persist the audit log state to disk.

**Synopsis**

```
LUC.SAVE
```

**Return**

`OK` on success.

**Example**

```redis
LUC.SAVE
# OK
```

---

### LUC.LOAD

Load previously persisted audit log state from disk.

**Synopsis**

```
LUC.LOAD
```

**Return**

`OK` on success.

**Example**

```redis
LUC.LOAD
# OK
```

---

### LUC.HELP

Display usage information for Lucidity commands.

**Synopsis**

```
LUC.HELP
```

**Return**

Array of help strings describing available commands.

**Example**

```redis
LUC.HELP
# 1) "LUC.APPEND <key> <value>"
# 2) "LUC.HEAD [key]"
# ...
```

## Concepts

### Data Model

Lucidity maintains **log streams**, each identified by a key. A log stream is an ordered sequence of entries where each entry contains:

- **Index** — zero-based position in the stream.
- **Value** — the audit record (arbitrary string).
- **Hash** — SHA-256 of `(previous_hash || index || value)`.

The first entry hashes against a genesis value, and each subsequent entry chains from the prior hash, forming a hash chain.

### Tamper Evidence

If any entry in the chain is modified, all subsequent hashes become invalid. Verifying the chain head against a previously stored head hash detects any tampering.

### Inclusion Proofs

`LUC.PROOF` returns the minimal set of hashes needed to verify that a specific entry is part of the chain without retrieving the entire log. This is useful for external auditors who need to verify individual records.

### Lifecycle

1. **Append** — `LUC.APPEND` adds an entry and updates the chain head.
2. **Verify** — `LUC.HEAD` and `LUC.PROOF` allow external verification.
3. **Persist** — `LUC.SAVE` writes the chain to disk for durability.
4. **Restore** — `LUC.LOAD` reconstructs the chain from disk.

## Operational Guidance

### Telemetry

When OpenTelemetry is enabled (`--features otel`), Lucidity emits:

| Metric | Type | Description |
|--------|------|-------------|
| `ferrite.lucidity.entries_total` | Counter | Total entries across all streams. |
| `ferrite.lucidity.append_latency_ms` | Histogram | Append operation latency. |
| `ferrite.lucidity.proof_latency_ms` | Histogram | Proof generation latency. |
| `ferrite.lucidity.streams_active` | Gauge | Number of active log streams. |

### Limits

- Maximum entry value size: **1 MB**.
- No hard limit on entries per stream, but proof generation time grows logarithmically with stream length.
- `LUC.SAVE` serializes the entire log state — schedule during low-traffic windows for large deployments.

### Failure Modes

| Scenario | Behavior |
|----------|----------|
| Server restart without `LUC.SAVE` | Unsaved entries are lost. |
| Index out of range on `LUC.PROOF` | Returns `ERR index out of range`. |
| Hash chain corruption detected | Returns `ERR chain integrity violation`. |
| Stream not found | Returns an empty result or `(integer) 0` for `LUC.LEN`. |

## Migration / Interop

Lucidity has no direct Redis equivalent. If you are migrating from an external audit log:

1. Export records in chronological order.
2. Replay them with `LUC.APPEND` to rebuild the hash chain in Ferrite.
3. Store the final `LUC.HEAD` value externally as your chain anchor for future verification.

The hash chain is self-contained — records can be exported and verified independently using the SHA-256 chaining algorithm.

## Status

:::caution Pre-alpha
Lucidity is in **pre-alpha**. APIs may change without notice. Do not use in production workloads. Feedback is welcome via [GitHub Issues](https://github.com/FerriteLabs/ferrite/issues).
:::
