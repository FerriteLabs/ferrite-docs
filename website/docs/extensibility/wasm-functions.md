---
sidebar_position: 1
maturity: experimental
---

:::caution Experimental Feature
This feature is **experimental** and subject to change. APIs, behavior, and performance characteristics may evolve significantly between releases. Use with caution in production environments.
:::

# WebAssembly Functions

Extend Ferrite with custom functions written in any language that compiles to WebAssembly.

## Overview

WASM functions let you run custom logic inside Ferrite:

- **Polyglot** - Write in Rust, Go, TypeScript, C++, or any WASM-targeting language
- **Sandboxed** - Secure execution with memory isolation
- **Fast** - Near-native performance with warm instance pooling
- **Safe** - Fine-grained permission controls

```
┌─────────────────────────────────────────────────────────────┐
│                    WASM Execution                            │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐   │
│  │   Client    │ ──▶ │   Ferrite   │ ──▶ │    WASM     │   │
│  │   WASM.CALL │     │   Runtime   │     │   Function  │   │
│  └─────────────┘     └─────────────┘     └─────────────┘   │
│                                                 │            │
│                                                 ▼            │
│                                          ┌──────────────┐   │
│                                          │ Host Functions│   │
│                                          │ (GET, SET,..) │   │
│                                          └──────────────┘   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Quick Start

### Load a Function

```bash
# Load WASM module from bytes
WASM.LOAD my_function <wasm_bytes>

# Load with permissions
WASM.LOAD my_function <wasm_bytes> PERMISSIONS "user:*" "GET" "SET"

# Replace existing function
WASM.LOAD my_function <wasm_bytes> REPLACE
```

### Call a Function

```bash
# Call with keys and arguments
WASM.CALL my_function KEYS key1 key2 ARGS arg1 arg2
```

### Unload

```bash
WASM.UNLOAD my_function
```

## Writing WASM Functions

### Rust

```rust
// lib.rs
use ferrite_wasm_sdk::*;

#[ferrite_function]
pub fn rate_limit(key: &str, limit: i64, window: i64) -> i64 {
    // Get current count
    let count: i64 = ferrite_get(key).unwrap_or(0);

    if count >= limit {
        return 0; // Rate limited
    }

    // Increment counter
    let new_count = ferrite_incr(key);

    // Set TTL if this is the first request in window
    if new_count == 1 {
        ferrite_expire(key, window);
    }

    1 // Allowed
}
```

Build with:
```bash
cargo build --target wasm32-unknown-unknown --release
```

### Go

```go
// main.go
package main

import (
    "github.com/ferrite/wasm-sdk-go"
)

//export rate_limit
func rate_limit(keyPtr, keyLen, limit, window int32) int32 {
    key := ferrite.ReadString(keyPtr, keyLen)

    count, _ := ferrite.Get(key)
    if count >= int(limit) {
        return 0
    }

    newCount := ferrite.Incr(key)
    if newCount == 1 {
        ferrite.Expire(key, int(window))
    }

    return 1
}

func main() {}
```

Build with:
```bash
tinygo build -o rate_limit.wasm -target wasi main.go
```

### TypeScript

```typescript
// rate_limit.ts
import { get, incr, expire } from "@ferrite/wasm-sdk";

export function rate_limit(key: string, limit: i64, window: i64): i64 {
    const count = get<i64>(key) || 0;

    if (count >= limit) {
        return 0;
    }

    const newCount = incr(key);
    if (newCount === 1) {
        expire(key, window);
    }

    return 1;
}
```

Build with AssemblyScript:
```bash
asc rate_limit.ts -o rate_limit.wasm --optimize
```

## Host Functions

WASM functions can call these Ferrite operations:

| Function | Description | Returns |
|----------|-------------|---------|
| `ferrite_get(key)` | Get string value | bytes or -1 |
| `ferrite_set(key, value, ttl)` | Set string value | 0 or -1 |
| `ferrite_del(key)` | Delete key | 1/0/-1 |
| `ferrite_exists(key)` | Check existence | 1/0/-1 |
| `ferrite_incr(key)` | Increment counter | new value |
| `ferrite_hget(key, field)` | Get hash field | bytes or -1 |
| `ferrite_hset(key, field, value)` | Set hash field | 1/0/-1 |
| `ferrite_expire(key, seconds)` | Set TTL | 1/0/-1 |
| `ferrite_ttl(key)` | Get TTL | seconds or -1/-2 |
| `ferrite_log(level, message)` | Write log | 0 |
| `ferrite_time_millis()` | Current time | timestamp |
| `ferrite_random(buf, len)` | Random bytes | bytes written |

## Permissions

Control what WASM functions can access:

### Key Patterns

```bash
# Allow access to user keys only
WASM.LOAD my_func <bytes> PERMISSIONS "user:*"

# Multiple patterns
WASM.LOAD my_func <bytes> PERMISSIONS "user:*" "session:*"

# Deny specific keys
WASM.LOAD my_func <bytes> PERMISSIONS "!admin:*"
```

### Command Restrictions

```bash
# Read-only access
WASM.LOAD my_func <bytes> PERMISSIONS READ_ONLY

# Specific commands
WASM.LOAD my_func <bytes> COMMANDS "GET" "SET" "INCR"

# No admin commands
WASM.LOAD my_func <bytes> DENY_COMMANDS "FLUSHALL" "CONFIG"
```

### Resource Limits

```bash
# Memory limit
WASM.LOAD my_func <bytes> MAX_MEMORY 16MB

# Execution time limit
WASM.LOAD my_func <bytes> TIMEOUT 100ms

# Instruction limit (fuel)
WASM.LOAD my_func <bytes> MAX_FUEL 10000000
```

## Configuration

> Note: WASM runtime configuration is not yet loaded from `ferrite.toml`; this
> schema documents the intended settings.

```toml
[wasm]
enabled = true
module_dir = "/opt/ferrite/wasm"

[wasm.limits]
max_memory = 16777216 # bytes (16MB)
max_time = 5          # seconds
max_fuel = 10000000
max_stack = 128

[wasm.pool]
min_instances = 2
max_instances = 16
idle_timeout_secs = 300

[wasm.security]
allow_network = false
allow_filesystem = false
default_permissions = "restrictive"  # or "permissive"
```

## Resource Limits

### Preset Configurations

```rust
// Quick operations (100ms timeout)
let limits = ResourceLimits::quick();

// Batch processing (30s timeout)
let limits = ResourceLimits::batch();

// Default (5s timeout)
let limits = ResourceLimits::default();
```

### Custom Limits

```rust
let limits = ResourceLimits {
    max_memory: 16 * 1024 * 1024,  // 16 MB
    max_time: Duration::from_secs(5),
    max_fuel: 10_000_000,
    max_stack: 128,
};
```

## Instance Pooling

WASM instances are pooled for performance:

```
┌─────────────────────────────────────────┐
│           Instance Pool                  │
├─────────────────────────────────────────┤
│                                          │
│  ┌────────┐ ┌────────┐ ┌────────┐      │
│  │ Warm 1 │ │ Warm 2 │ │ Warm 3 │ ...  │
│  └────────┘ └────────┘ └────────┘      │
│                                          │
│  Cold Start: 1-5ms                       │
│  Warm Start: &lt;10μs                       │
│                                          │
└─────────────────────────────────────────┘
```

## Rust API

```rust
use ferrite::wasm::{WasmExecutor, WasmConfig, ResourceLimits, FunctionPermissions};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Create executor
    let executor = WasmExecutor::builder()
        .limits(ResourceLimits::default())
        .pool_size(2, 16)
        .build()?;

    // Load function
    let wasm_bytes = std::fs::read("rate_limit.wasm")?;
    let permissions = FunctionPermissions::read_write()
        .with_allowed_keys(vec!["rate:*".to_string()]);

    executor.load("rate_limit", wasm_bytes, Some(permissions))?;

    // Call function
    let result = executor.call(
        "rate_limit",
        "rate_limit",  // entry point
        vec![
            WasmValue::Bytes(b"rate:user:123".to_vec()),
            WasmValue::I64(100),
            WasmValue::I64(60),
        ],
        None,  // context
    )?;

    match result {
        WasmValue::I64(1) => println!("Allowed"),
        WasmValue::I64(0) => println!("Rate limited"),
        _ => println!("Unexpected result"),
    }

    Ok(())
}
```

## Error Handling

```rust
use ferrite::wasm::WasmError;

match executor.call("my_func", "entry", args, None) {
    Ok(result) => handle_result(result),
    Err(WasmError::FunctionNotFound(name)) => {
        eprintln!("Function {} not found", name);
    }
    Err(WasmError::PermissionDenied(msg)) => {
        eprintln!("Permission denied: {}", msg);
    }
    Err(WasmError::FuelExhausted) => {
        eprintln!("Function exceeded instruction limit");
    }
    Err(WasmError::Timeout(ms)) => {
        eprintln!("Function timed out after {}ms", ms);
    }
    Err(WasmError::MemoryLimitExceeded { limit }) => {
        eprintln!("Function exceeded {}MB memory limit", limit / 1024 / 1024);
    }
    Err(e) => eprintln!("Error: {}", e),
}
```

## Use Cases

### Rate Limiting

```rust
#[ferrite_function]
pub fn sliding_window_rate_limit(key: &str, limit: i64, window_ms: i64) -> i64 {
    let now = ferrite_time_millis();
    let window_start = now - window_ms;

    // Remove old entries
    ferrite_zremrangebyscore(key, "-inf", window_start.to_string());

    // Count current window
    let count = ferrite_zcard(key);

    if count >= limit {
        return 0;
    }

    // Add current request
    ferrite_zadd(key, now, format!("{}:{}", now, ferrite_random_id()));
    ferrite_expire(key, (window_ms / 1000) + 1);

    1
}
```

### Data Transformation

```rust
#[ferrite_function]
pub fn transform_user(key: &str) -> String {
    let user_json = ferrite_get(key).unwrap_or_default();
    let mut user: User = serde_json::from_str(&user_json)?;

    // Transform
    user.full_name = format!("{} {}", user.first_name, user.last_name);
    user.age = calculate_age(user.birth_date);

    serde_json::to_string(&user)?
}
```

### Validation

```rust
#[ferrite_function]
pub fn validate_email(email: &str) -> i64 {
    let re = Regex::new(r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$").unwrap();
    if re.is_match(email) { 1 } else { 0 }
}
```

### Aggregation

```rust
#[ferrite_function]
pub fn aggregate_stats(pattern: &str) -> String {
    let keys = ferrite_keys(pattern);
    let mut sum = 0.0;
    let mut count = 0;

    for key in keys {
        if let Some(value) = ferrite_get(&key) {
            if let Ok(num) = value.parse::<f64>() {
                sum += num;
                count += 1;
            }
        }
    }

    let avg = if count > 0 { sum / count as f64 } else { 0.0 };
    format!(r#"{{"sum": {}, "count": {}, "avg": {}}}"#, sum, count, avg)
}
```

## Performance

| Operation | Cold Start | Warm Start |
|-----------|------------|------------|
| Instantiation | 1-5ms | &lt;10μs |
| Simple function | 10-50μs | 5-20μs |
| Complex function | 100μs-10ms | Based on work |

## Best Practices

1. **Keep functions focused** - Do one thing well
2. **Use fuel limits** - Prevent infinite loops
3. **Batch operations** - Minimize host calls
4. **Pool instances** - Configure appropriate pool size
5. **Test thoroughly** - WASM has different behavior than native
6. **Monitor memory** - Watch for memory leaks
7. **Version modules** - Track which version is deployed

## Security Considerations

1. **Minimize permissions** - Only grant what's needed
2. **Disable network/filesystem** - Unless absolutely required
3. **Set resource limits** - Prevent DoS
4. **Audit functions** - Review WASM code before deployment
5. **Use separate modules** - Isolate different functions

## Next Steps

- [Plugin System](/docs/extensibility/plugin-system) - Full plugin architecture
- [Triggers](/docs/event-driven/triggers) - Use WASM in triggers
- [Custom Commands](/docs/extensibility/custom-commands) - Add new commands
