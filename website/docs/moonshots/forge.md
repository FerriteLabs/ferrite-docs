---
sidebar_position: 2
title: "Forge — WASM In-DB Functions"
description: "Run WebAssembly functions inside Ferrite for server-side data processing without external services."
---

# Forge — WASM In-DB Functions

## What It Is

Forge lets you load and execute WebAssembly (WASM) modules directly inside Ferrite. Instead of pulling data out to an application server for processing, you push your logic into the database as a compiled WASM binary. Functions run in a sandboxed environment with controlled access to keys, making server-side transformations, validations, and aggregations fast and safe.

## When to Use It

- You need server-side data transformations without round-tripping data to your application.
- You want deterministic, sandboxed execution of user-defined logic inside the database.
- Your workload involves per-key validation or enrichment that benefits from co-located compute.
- You are building a multi-tenant platform and need tenant-isolated custom logic.
- You want to reduce network latency by moving compute closer to data.

## Quick Start

```bash
# Compile a WASM module (Rust example)
cargo build --target wasm32-wasip1 --release
# Output: target/wasm32-wasip1/release/my_transform.wasm

# Load the module into Ferrite
redis-cli -p 6379 -x FN.LOAD my_transform < target/wasm32-wasip1/release/my_transform.wasm

# Set some data
redis-cli -p 6379 SET user:100:score 42

# Call the function with a key and input argument
redis-cli -p 6379 FN.CALL my_transform user:100:score "multiply_by_2"

# List loaded functions
redis-cli -p 6379 FN.LIST
```

## Command Reference

### FN.LOAD

Load a WASM module into Ferrite.

**Synopsis**

```
FN.LOAD <module-name> <wasm-bytes>
```

**Arguments**

| Argument | Type | Description |
|----------|------|-------------|
| `module-name` | string | Unique name to register the module under. |
| `wasm-bytes` | bytes | Raw WASM binary content. |

**Return**

`OK` on success.

**Example**

```bash
redis-cli -p 6379 -x FN.LOAD my_transform < my_transform.wasm
# OK
```

---

### FN.CALL

Execute a function from a loaded WASM module with read-write access to keys.

**Synopsis**

```
FN.CALL <module-name> <key> [arg ...]
```

**Arguments**

| Argument | Type | Description |
|----------|------|-------------|
| `module-name` | string | Name of the loaded module. |
| `key` | string | Primary key the function operates on. |
| `arg` | string | *(Optional)* Additional arguments passed to the function. |

**Return**

The return value produced by the WASM function (string or integer).

**Example**

```redis
SET counter 10
FN.CALL my_transform counter "multiply_by_2"
# (integer) 20
```

---

### FN.CALL_RO

Execute a function in read-only mode. The function cannot modify any keys.

**Synopsis**

```
FN.CALL_RO <module-name> <key> [arg ...]
```

**Arguments**

Same as `FN.CALL`.

**Return**

The return value produced by the WASM function.

**Example**

```redis
FN.CALL_RO my_transform counter "get_doubled"
# (integer) 20
```

---

### FN.DROP

Unload a WASM module from Ferrite.

**Synopsis**

```
FN.DROP <module-name>
```

**Arguments**

| Argument | Type | Description |
|----------|------|-------------|
| `module-name` | string | Name of the module to remove. |

**Return**

`OK` on success.

**Example**

```redis
FN.DROP my_transform
# OK
```

---

### FN.LIST

List all loaded WASM modules.

**Synopsis**

```
FN.LIST
```

**Return**

Array of module names.

**Example**

```redis
FN.LIST
# 1) "my_transform"
# 2) "validator"
```

---

### FN.STATS

Return statistics about the WASM runtime.

**Synopsis**

```
FN.STATS
```

**Return**

Key-value pairs with module counts, invocation counts, and memory usage.

**Example**

```redis
FN.STATS
# 1) "loaded_modules"
# 2) (integer) 2
# 3) "total_invocations"
# 4) (integer) 1537
# 5) "memory_bytes"
# 6) (integer) 4194304
```

---

### FN.SHOW

Display metadata for a loaded module.

**Synopsis**

```
FN.SHOW <module-name>
```

**Arguments**

| Argument | Type | Description |
|----------|------|-------------|
| `module-name` | string | Name of the module to inspect. |

**Return**

Key-value pairs with module size, exported functions, and load timestamp.

**Example**

```redis
FN.SHOW my_transform
# 1) "size_bytes"
# 2) (integer) 28672
# 3) "exports"
# 4) 1) "multiply_by_2"
#    2) "get_doubled"
# 5) "loaded_at"
# 6) "2025-01-15T10:30:00Z"
```

---

### FN.HELP

Display usage information for Forge commands.

**Synopsis**

```
FN.HELP
```

**Return**

Array of help strings describing available commands.

**Example**

```redis
FN.HELP
# 1) "FN.LOAD <module-name> <wasm-bytes>"
# 2) "FN.CALL <module-name> <key> [arg ...]"
# ...
```

## Concepts

### Data Model

Forge manages a registry of named WASM modules. Each module:

- Is identified by a unique string name.
- Contains one or more exported functions.
- Runs in a sandboxed WASM runtime (Wasmtime) with memory limits.

### Execution Model

1. **Load** — `FN.LOAD` compiles and validates the WASM binary, then registers it.
2. **Invoke** — `FN.CALL` instantiates the module, passes the key and arguments, and runs the function.
3. **Sandbox** — Functions can only access keys explicitly passed to them. No filesystem, network, or system calls.
4. **Drop** — `FN.DROP` removes the module and frees its memory.

### Read-Only vs Read-Write

- `FN.CALL` grants the function read-write access to the specified key.
- `FN.CALL_RO` restricts the function to read-only access — any write attempt returns an error.

Use `FN.CALL_RO` for queries, aggregations, and validations. Use `FN.CALL` only when the function must mutate data.

## Operational Guidance

### Telemetry

When OpenTelemetry is enabled (`--features otel`), Forge emits:

| Metric | Type | Description |
|--------|------|-------------|
| `ferrite.forge.invocations_total` | Counter | Total function invocations. |
| `ferrite.forge.execution_time_ms` | Histogram | Per-invocation execution time. |
| `ferrite.forge.modules_loaded` | Gauge | Number of loaded modules. |
| `ferrite.forge.memory_bytes` | Gauge | Total WASM memory usage. |

### Limits

- Maximum WASM binary size: **10 MB**.
- Per-invocation execution timeout: **100 ms** (configurable).
- Per-module memory limit: **16 MB**.
- Maximum loaded modules: **256**.

### Failure Modes

| Scenario | Behavior |
|----------|----------|
| Invalid WASM binary | `FN.LOAD` returns `ERR invalid wasm module`. |
| Function exceeds timeout | Invocation is killed; returns `ERR execution timeout`. |
| Module not found | `FN.CALL` returns `ERR module not found`. |
| Write in read-only mode | `FN.CALL_RO` returns `ERR write denied in read-only mode`. |

## Migration / Interop

Forge is a Ferrite-native feature. If you are migrating from Redis with Lua scripting (`EVAL`/`EVALSHA`):

1. Rewrite Lua scripts as WASM modules in Rust, Go, or any language targeting `wasm32-wasip1`.
2. Replace `EVAL` calls with `FN.LOAD` + `FN.CALL`.
3. Note that WASM functions use explicit key arguments rather than `KEYS`/`ARGV` arrays.

Redis Functions (`FUNCTION LOAD`) users can follow the same pattern — the key difference is that Forge uses compiled WASM instead of interpreted Lua.

## Status

:::caution Pre-alpha
Forge is in **pre-alpha**. APIs may change without notice. Do not use in production workloads. Feedback is welcome via [GitHub Issues](https://github.com/FerriteLabs/ferrite/issues).
:::
