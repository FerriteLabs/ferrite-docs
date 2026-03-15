---
sidebar_position: 24
maturity: experimental
---

:::caution Experimental Feature
This feature is **experimental** and subject to change. APIs, behavior, and performance characteristics may evolve significantly between releases. Use with caution in production environments.
:::

# WASM Commands

Commands for WebAssembly function execution.

## Overview

WASM commands enable loading and executing WebAssembly modules for custom server-side logic with sandboxed execution.

## Commands

### WASM.LOAD

Load a WebAssembly module.

```bash
WASM.LOAD function_name path
  [CAPABILITIES cap1 cap2 ...]
  [MEMORY limit]
  [TIMEOUT ms]
```

**Capabilities:**
- `read` - Read keys
- `write` - Write keys
- `delete` - Delete keys
- `http` - Make HTTP requests
- `time` - Access current time
- `random` - Generate random numbers
- `log` - Write to logs
- `all` - All capabilities

**Examples:**
```bash
WASM.LOAD validate /plugins/validate.wasm
  CAPABILITIES read write log
  MEMORY 10MB
  TIMEOUT 1000

WASM.LOAD transform /plugins/transform.wasm
  CAPABILITIES read
  MEMORY 5MB
```

---

### WASM.LOADB

Load WebAssembly from binary data.

```bash
WASM.LOADB function_name binary_data
  [CAPABILITIES cap1 cap2 ...]
  [MEMORY limit]
  [TIMEOUT ms]
```

---

### WASM.CALL

Execute a WebAssembly function.

```bash
WASM.CALL function_name [arg1 arg2 ...]
```

**Examples:**
```bash
WASM.CALL validate '{"email": "test@example.com"}'
# {"valid": true}

WASM.CALL transform key1 key2 key3
# Returns transformed result
```

---

### WASM.CALLREAD

Execute function with read-only access (safe for replicas).

```bash
WASM.CALLREAD function_name [arg1 arg2 ...]
```

---

### WASM.UNLOAD

Unload a function.

```bash
WASM.UNLOAD function_name
```

---

### WASM.LIST

List loaded functions.

```bash
WASM.LIST
```

**Examples:**
```bash
WASM.LIST
# 1) "validate"
# 2) "transform"
# 3) "aggregate"
```

---

### WASM.INFO

Get function details.

```bash
WASM.INFO function_name
```

**Examples:**
```bash
WASM.INFO validate
# {
#   "name": "validate",
#   "path": "/plugins/validate.wasm",
#   "capabilities": ["read", "write", "log"],
#   "memory_limit": "10MB",
#   "timeout_ms": 1000,
#   "loaded_at": "2024-01-15T10:00:00Z",
#   "invocations": 5000,
#   "avg_duration_ms": 2.5,
#   "errors": 12
# }
```

---

### WASM.STATS

Get function statistics.

```bash
WASM.STATS [function_name]
```

**Examples:**
```bash
WASM.STATS validate
# {
#   "invocations": 5000,
#   "successful": 4988,
#   "failed": 12,
#   "avg_duration_ms": 2.5,
#   "p99_duration_ms": 15,
#   "memory_used": "2.5MB",
#   "last_invocation": "2024-01-15T15:30:00Z"
# }
```

---

### WASM.UPDATE

Update function configuration.

```bash
WASM.UPDATE function_name
  [CAPABILITIES cap1 cap2 ...]
  [MEMORY limit]
  [TIMEOUT ms]
```

---

### WASM.RELOAD

Reload function from file.

```bash
WASM.RELOAD function_name
```

## Host Functions API

WebAssembly modules can call these host functions:

### Key Operations

```rust
// In WASM module (Rust)
extern "C" {
    fn ferrite_get(key: *const u8, key_len: usize) -> *const u8;
    fn ferrite_set(key: *const u8, key_len: usize, val: *const u8, val_len: usize) -> i32;
    fn ferrite_del(key: *const u8, key_len: usize) -> i32;
    fn ferrite_exists(key: *const u8, key_len: usize) -> i32;
}
```

### Response Functions

```rust
extern "C" {
    fn ferrite_return(val: *const u8, val_len: usize);
    fn ferrite_error(msg: *const u8, msg_len: usize);
    fn ferrite_log(level: i32, msg: *const u8, msg_len: usize);
}
```

### Utility Functions

```rust
extern "C" {
    fn ferrite_now() -> i64;  // Current timestamp
    fn ferrite_random() -> f64;  // Random 0.0-1.0
}
```

## Writing WASM Functions

### Rust Example

```rust
// Cargo.toml
// [lib]
// crate-type = ["cdylib"]

use ferrite_wasm::*;

#[no_mangle]
pub extern "C" fn validate(input_ptr: *const u8, input_len: usize) -> i32 {
    // Parse input
    let input = unsafe {
        std::str::from_utf8(std::slice::from_raw_parts(input_ptr, input_len))
            .unwrap()
    };

    let data: serde_json::Value = serde_json::from_str(input).unwrap();

    // Validate email
    let email = data["email"].as_str().unwrap_or("");
    let valid = email.contains('@') && email.contains('.');

    // Return result
    let result = format!(r#"{{"valid": {}}}"#, valid);
    ferrite_return(result.as_ptr(), result.len());

    0 // Success
}
```

### Go Example

```go
//go:build wasm

package main

import (
    "encoding/json"
    "github.com/ferrite/ferrite-go-sdk"
)

//export validate
func validate(inputPtr, inputLen uint32) int32 {
    input := ferrite.GetInput(inputPtr, inputLen)

    var data map[string]interface{}
    json.Unmarshal(input, &data)

    email, _ := data["email"].(string)
    valid := strings.Contains(email, "@")

    result, _ := json.Marshal(map[string]bool{"valid": valid})
    ferrite.Return(result)

    return 0
}

func main() {}
```

### AssemblyScript Example

```typescript
// assembly/index.ts
import { JSON } from "assemblyscript-json";
import { ferrite } from "@ferrite/as-sdk";

export function validate(inputPtr: usize, inputLen: usize): i32 {
  const input = String.UTF8.decodeUnsafe(inputPtr, inputLen);
  const data = <JSON.Obj>JSON.parse(input);

  const email = data.getString("email")!.valueOf();
  const valid = email.includes("@");

  const result = `{"valid": ${valid}}`;
  ferrite.return(result);

  return 0;
}
```

## Use Cases

### Data Validation

```bash
# Load validator
WASM.LOAD validate /plugins/validate.wasm CAPABILITIES read log

# Use in trigger
TRIGGER.CREATE validate_users
  ON "user:*"
  EVENTS SET
  ACTION CALL "validate"
```

### Custom Aggregation

```rust
#[no_mangle]
pub extern "C" fn aggregate_stats(keys_ptr: *const u8, keys_len: usize) -> i32 {
    let keys: Vec<String> = parse_keys(keys_ptr, keys_len);

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

    let result = json!({
        "sum": sum,
        "count": count,
        "avg": if count > 0 { sum / count as f64 } else { 0.0 }
    });

    ferrite_return(&result.to_string());
    0
}
```

### Data Transformation

```rust
#[no_mangle]
pub extern "C" fn transform_user(input_ptr: *const u8, input_len: usize) -> i32 {
    let input: Value = parse_input(input_ptr, input_len);

    // Transform data
    let output = json!({
        "id": input["id"],
        "full_name": format!("{} {}", input["first_name"], input["last_name"]),
        "email": input["email"].as_str().map(|s| s.to_lowercase()),
        "created_at": ferrite_now()
    });

    ferrite_return(&output.to_string());
    0
}
```

### Complex Business Logic

```rust
#[no_mangle]
pub extern "C" fn process_order(order_id_ptr: *const u8, order_id_len: usize) -> i32 {
    let order_key = parse_string(order_id_ptr, order_id_len);

    // Get order
    let order: Order = ferrite_get(&order_key)?;

    // Calculate discount
    let user_key = format!("user:{}", order.user_id);
    let user: User = ferrite_get(&user_key)?;

    let discount = if user.membership == "premium" { 0.15 }
                   else if order.total > 100.0 { 0.10 }
                   else { 0.0 };

    // Apply discount
    let final_total = order.total * (1.0 - discount);

    // Update order
    let updated = Order { total: final_total, discount, ..order };
    ferrite_set(&order_key, &serde_json::to_string(&updated)?);

    ferrite_return(&format!(r#"{{"total": {}, "discount": {}}}"#, final_total, discount));
    0
}
```

## Rust API

```rust
use ferrite::Client;
use ferrite::wasm::{WasmConfig, Capability};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let client = Client::connect("localhost:6379").await?;

    // Load function from file
    client.wasm_load(
        "validate",
        "/plugins/validate.wasm",
        WasmConfig::default()
            .capabilities(&[Capability::Read, Capability::Write, Capability::Log])
            .memory_limit("10MB")
            .timeout(1000),
    ).await?;

    // Call function
    let result: String = client.wasm_call("validate", &[
        r#"{"email": "test@example.com"}"#,
    ]).await?;

    // List functions
    let functions = client.wasm_list().await?;

    // Get stats
    let stats = client.wasm_stats("validate").await?;

    // Unload
    client.wasm_unload("validate").await?;

    Ok(())
}
```

## Configuration

```toml
[wasm]
enabled = true
plugins_dir = "/var/lib/ferrite/plugins"
max_functions = 100
default_memory_limit = "10MB"
default_timeout_ms = 1000
sandbox = true

[wasm.capabilities]
# Default capabilities for new functions
default = ["read", "log"]
# Maximum allowed capabilities
allowed = ["read", "write", "delete", "http", "time", "random", "log"]
```

## Related Commands

- [Scripting Commands](/docs/reference/commands/scripting) - Lua scripting
- [Trigger Commands](/docs/reference/commands/trigger) - Event triggers
- [WASM Functions Guide](/docs/extensibility/wasm-functions) - Detailed guide
