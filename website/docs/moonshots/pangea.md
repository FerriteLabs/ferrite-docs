---
sidebar_position: 6
title: "Pangea — CXL Tier-0 Memory"
description: "Extend Ferrite's storage hierarchy with CXL-attached memory for ultra-low-latency access."
---

# Pangea — CXL Tier-0 Memory

## What It Is

Pangea adds a Tier-0 memory layer to Ferrite's storage hierarchy using CXL (Compute Express Link) attached memory. CXL memory sits between DRAM and the existing mutable region, providing a larger, byte-addressable memory pool at near-DRAM latencies. Pangea lets you explicitly allocate and read data in this tier for workloads that exceed DRAM capacity but need faster access than disk or even memory-mapped storage.

## When to Use It

- Your dataset is too large for DRAM but needs lower latency than Ferrite's read-only mmap region.
- You have CXL 2.0+ memory expanders or CXL-attached memory pools in your infrastructure.
- You want to extend Ferrite's tiered storage with an additional memory tier without code changes.
- Your workload has a large warm dataset that benefits from byte-addressable access patterns.
- You are evaluating CXL memory for database workloads and want a simple API to experiment with.

## Quick Start

```redis
# Connect to Ferrite
redis-cli -p 6379

# Allocate a key-value pair in CXL Tier-0 memory
PNG.ALLOC session:abc "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c2VyMTAwIn0"

# Read the value from CXL memory
PNG.READ session:abc

# Check CXL memory statistics
PNG.STATS

# Free a key from CXL memory
PNG.FREE session:abc

# Persist CXL tier metadata to disk
PNG.SAVE
```

## Command Reference

### PNG.ALLOC

Allocate a key-value pair in CXL Tier-0 memory.

**Synopsis**

```
PNG.ALLOC <key> <value>
```

**Arguments**

| Argument | Type | Description |
|----------|------|-------------|
| `key` | string | Key to store in CXL memory. |
| `value` | string | Value to associate with the key. |

**Return**

`OK` on success.

**Example**

```redis
PNG.ALLOC session:abc "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c2VyMTAwIn0"
# OK
```

---

### PNG.READ

Read a value from CXL Tier-0 memory.

**Synopsis**

```
PNG.READ <key>
```

**Arguments**

| Argument | Type | Description |
|----------|------|-------------|
| `key` | string | Key to read. |

**Return**

Bulk string — the value, or `(nil)` if the key is not allocated in CXL memory.

**Example**

```redis
PNG.READ session:abc
# "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c2VyMTAwIn0"
```

---

### PNG.FREE

Free a key from CXL Tier-0 memory, releasing the allocated space.

**Synopsis**

```
PNG.FREE <key>
```

**Arguments**

| Argument | Type | Description |
|----------|------|-------------|
| `key` | string | Key to free. |

**Return**

Integer — `1` if the key was freed, `0` if it was not allocated.

**Example**

```redis
PNG.FREE session:abc
# (integer) 1
```

---

### PNG.STATS

Return statistics about the CXL Tier-0 memory pool.

**Synopsis**

```
PNG.STATS
```

**Return**

Key-value pairs with allocation counts, memory usage, and capacity information.

**Example**

```redis
PNG.STATS
# 1) "allocated_keys"
# 2) (integer) 1024
# 3) "used_bytes"
# 4) (integer) 67108864
# 5) "capacity_bytes"
# 6) (integer) 8589934592
# 7) "fragmentation_ratio"
# 8) "0.02"
```

---

### PNG.SAVE

Persist CXL tier metadata and allocation map to disk. The actual data in CXL memory is not persisted — only the mapping of keys to CXL addresses.

**Synopsis**

```
PNG.SAVE
```

**Return**

`OK` on success.

**Example**

```redis
PNG.SAVE
# OK
```

---

### PNG.LOAD

Load previously persisted CXL tier metadata from disk. Requires that the CXL memory pool is still available and data has not been lost.

**Synopsis**

```
PNG.LOAD
```

**Return**

`OK` on success, or an error if CXL memory is unavailable.

**Example**

```redis
PNG.LOAD
# OK
```

---

### PNG.HELP

Display usage information for Pangea commands.

**Synopsis**

```
PNG.HELP
```

**Return**

Array of help strings describing available commands.

**Example**

```redis
PNG.HELP
# 1) "PNG.ALLOC <key> <value>"
# 2) "PNG.READ <key>"
# ...
```

## Concepts

### Storage Hierarchy

Pangea extends Ferrite's existing three-tier HybridLog architecture with a Tier-0 layer:

```
┌──────────────────────────────────────────────┐
│  Tier 0: CXL Memory (Pangea)                │  ← Near-DRAM latency, larger capacity
├──────────────────────────────────────────────┤
│  Mutable Region (DRAM)                       │  ← Hottest data, in-place updates
├──────────────────────────────────────────────┤
│  Read-Only Region (mmap)                     │  ← Warm data, memory-mapped files
├──────────────────────────────────────────────┤
│  Disk Region (io_uring)                      │  ← Cold data, async I/O
└──────────────────────────────────────────────┘
```

### CXL Memory Characteristics

| Property | DRAM | CXL Memory | SSD |
|----------|------|------------|-----|
| Latency | ~80 ns | ~150–300 ns | ~10–100 μs |
| Bandwidth | ~50 GB/s | ~30 GB/s | ~3–7 GB/s |
| Addressability | Byte | Byte | Block (4 KB) |
| Capacity | 100s GB | TBs | TBs |
| Persistence | No | Type 2: optional | Yes |

### Allocation Model

Pangea uses explicit allocation rather than automatic tiering:

- `PNG.ALLOC` places data directly in CXL memory.
- `PNG.READ` reads from CXL memory only — it does not fall through to other tiers.
- `PNG.FREE` releases the CXL allocation.

This gives applications full control over what data benefits from CXL memory placement. Automatic tiering between CXL and DRAM is planned for future releases.

### Hardware Requirements

Pangea requires CXL 2.0+ memory devices exposed to the operating system as a DAX (Direct Access) device or a NUMA node. On Linux, this typically appears as `/dev/dax0.0` or a dedicated NUMA node visible via `numactl --hardware`.

When no CXL hardware is detected, Pangea falls back to a DRAM-based emulation mode for development and testing.

## Operational Guidance

### Telemetry

When OpenTelemetry is enabled (`--features otel`), Pangea emits:

| Metric | Type | Description |
|--------|------|-------------|
| `ferrite.pangea.allocated_keys` | Gauge | Number of keys in CXL memory. |
| `ferrite.pangea.used_bytes` | Gauge | CXL memory in use. |
| `ferrite.pangea.capacity_bytes` | Gauge | Total CXL memory capacity. |
| `ferrite.pangea.read_latency_ns` | Histogram | CXL read latency. |
| `ferrite.pangea.alloc_latency_ns` | Histogram | Allocation latency. |

### Limits

- Maximum value size per key: **2 MB** (CXL allocations are optimized for small-to-medium values).
- CXL memory pool size is determined by hardware — Pangea uses all available CXL capacity by default.
- In emulation mode (no CXL hardware), a configurable DRAM region simulates CXL behavior with a default size of **256 MB**.

### Failure Modes

| Scenario | Behavior |
|----------|----------|
| No CXL hardware detected | Falls back to DRAM emulation mode with a log warning. |
| CXL memory pool exhausted | `PNG.ALLOC` returns `ERR out of cxl memory`. |
| Key not found in CXL tier | `PNG.READ` returns `(nil)`. |
| CXL device error | Returns `ERR cxl device unavailable`. |
| Server restart | CXL memory contents are lost unless using CXL Type 2 persistent memory. |

## Migration / Interop

Pangea is a Ferrite-native feature with no Redis equivalent. It is additive — your existing Ferrite commands (`SET`, `GET`, etc.) continue to work with the standard tiered storage. Pangea provides a separate, explicit path for latency-sensitive data.

To evaluate Pangea without CXL hardware:

1. Start Ferrite normally — Pangea auto-detects the absence of CXL and uses emulation mode.
2. Use `PNG.ALLOC` / `PNG.READ` to test your access patterns.
3. Monitor `PNG.STATS` to estimate your CXL memory requirements before provisioning hardware.

## Status

:::caution Pre-alpha
Pangea is in **pre-alpha**. APIs may change without notice. Do not use in production workloads. CXL hardware support is experimental and requires Linux 6.1+ with CXL-enabled kernel modules. Feedback is welcome via [GitHub Issues](https://github.com/FerriteLabs/ferrite/issues).
:::
