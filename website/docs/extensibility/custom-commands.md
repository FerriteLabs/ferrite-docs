---
sidebar_position: 3
maturity: experimental
---

# Custom Commands

Create custom Redis-like commands for Ferrite using WebAssembly plugins.

## Overview

Custom commands extend Ferrite's command set without modifying core code. Commands are implemented in WebAssembly and can access storage, perform computations, and integrate with external services.

## Command Structure

### Command Definition

```rust
use ferrite_plugin_sdk::{command, PluginContext, CommandResult, Value};

#[command(
    name = "MYPREFIX.MYCOMMAND",
    flags = ["read", "write"],
    arity = -2,  // At least 1 argument
    first_key = 1,
    last_key = 1,
    step = 1
)]
fn my_command(ctx: &PluginContext, args: &[Value]) -> CommandResult {
    // Implementation
    Ok(Value::Ok)
}
```

### Command Attributes

| Attribute | Description | Example |
|-----------|-------------|---------|
| `name` | Command name (uppercase) | `"JSON.SET"` |
| `flags` | Command flags | `["read", "write"]` |
| `arity` | Argument count (-N = at least N-1) | `-3` |
| `first_key` | Position of first key argument | `1` |
| `last_key` | Position of last key argument | `1` |
| `step` | Step between key arguments | `1` |

### Command Flags

| Flag | Description |
|------|-------------|
| `read` | Command reads data |
| `write` | Command writes data |
| `admin` | Requires admin privileges |
| `readonly` | Can run on replica |
| `denyoom` | Deny when OOM |
| `loading` | Allow during loading |
| `stale` | Allow on stale data |
| `fast` | O(1) or O(log N) complexity |
| `slow` | May be slow |

## Examples

### Simple Read Command

```rust
#[command(name = "HELLO", flags = ["read", "fast"])]
fn hello(ctx: &PluginContext, args: &[Value]) -> CommandResult {
    let name = args.get(0)
        .and_then(|v| v.as_str())
        .unwrap_or("World");

    Ok(Value::BulkString(format!("Hello, {}!", name).into_bytes()))
}
```

Usage:
```bash
HELLO Alice
# "Hello, Alice!"

HELLO
# "Hello, World!"
```

### Key-Value Command

```rust
#[command(name = "COUNTER.INCR", flags = ["write"], first_key = 1, last_key = 1)]
fn counter_incr(ctx: &PluginContext, args: &[Value]) -> CommandResult {
    let key = args.get(0)
        .ok_or("Missing key argument")?
        .as_str()
        .ok_or("Key must be a string")?;

    let increment = args.get(1)
        .and_then(|v| v.as_i64())
        .unwrap_or(1);

    // Read current value
    let current = ctx.storage().get(key)?
        .and_then(|v| v.as_i64())
        .unwrap_or(0);

    // Update value
    let new_value = current + increment;
    ctx.storage().set(key, Value::Integer(new_value))?;

    Ok(Value::Integer(new_value))
}
```

Usage:
```bash
COUNTER.INCR mycounter
# 1

COUNTER.INCR mycounter 5
# 6

COUNTER.INCR mycounter -2
# 4
```

### Multi-Key Command

```rust
#[command(name = "MYMGET", flags = ["read"], first_key = 1, last_key = -1, step = 1)]
fn my_mget(ctx: &PluginContext, args: &[Value]) -> CommandResult {
    if args.is_empty() {
        return Err("At least one key required".into());
    }

    let results: Vec<Value> = args.iter()
        .filter_map(|arg| arg.as_str())
        .map(|key| {
            ctx.storage().get(key)
                .ok()
                .flatten()
                .unwrap_or(Value::Null)
        })
        .collect();

    Ok(Value::Array(results))
}
```

### Complex Data Structure

```rust
#[command(name = "STATS.ADD", flags = ["write"])]
fn stats_add(ctx: &PluginContext, args: &[Value]) -> CommandResult {
    let key = args.get(0).ok_or("Missing key")?.as_str().ok_or("Invalid key")?;
    let value = args.get(1).ok_or("Missing value")?.as_f64().ok_or("Invalid value")?;

    // Get or create stats structure
    let mut stats: Stats = ctx.storage().get(key)?
        .map(|v| serde_json::from_slice(&v.as_bytes().unwrap()).unwrap())
        .unwrap_or_default();

    // Update statistics
    stats.count += 1;
    stats.sum += value;
    stats.min = stats.min.min(value);
    stats.max = stats.max.max(value);
    stats.mean = stats.sum / stats.count as f64;

    // Store updated stats
    let json = serde_json::to_vec(&stats)?;
    ctx.storage().set(key, Value::BulkString(json))?;

    Ok(Value::Ok)
}

#[command(name = "STATS.GET", flags = ["read"])]
fn stats_get(ctx: &PluginContext, args: &[Value]) -> CommandResult {
    let key = args.get(0).ok_or("Missing key")?.as_str().ok_or("Invalid key")?;

    let stats: Stats = ctx.storage().get(key)?
        .map(|v| serde_json::from_slice(&v.as_bytes().unwrap()).unwrap())
        .ok_or("Key not found")?;

    Ok(Value::Array(vec![
        Value::BulkString(b"count".to_vec()),
        Value::Integer(stats.count),
        Value::BulkString(b"sum".to_vec()),
        Value::BulkString(stats.sum.to_string().into_bytes()),
        Value::BulkString(b"min".to_vec()),
        Value::BulkString(stats.min.to_string().into_bytes()),
        Value::BulkString(b"max".to_vec()),
        Value::BulkString(stats.max.to_string().into_bytes()),
        Value::BulkString(b"mean".to_vec()),
        Value::BulkString(stats.mean.to_string().into_bytes()),
    ]))
}
```

### Async Command with Timeout

```rust
#[command(name = "FETCH.URL", flags = ["slow"], timeout_ms = 5000)]
fn fetch_url(ctx: &PluginContext, args: &[Value]) -> CommandResult {
    let url = args.get(0)
        .ok_or("Missing URL")?
        .as_str()
        .ok_or("URL must be a string")?;

    // HTTP fetch (requires network permission)
    let response = ctx.http().get(url)?;

    if response.status != 200 {
        return Err(format!("HTTP error: {}", response.status).into());
    }

    Ok(Value::BulkString(response.body))
}
```

## Manifest Configuration

### Command Specification

```toml
[[commands]]
name = "MYPREFIX.COMMAND"
description = "Description of what the command does"
min_args = 1
max_args = 3
flags = ["read", "write"]
acl_categories = ["read", "write", "custom"]

# Key specification
first_key = 1
last_key = 1
step = 1

# Complexity info
complexity = "O(1)"

# Documentation
since = "1.0.0"
tips = ["Tip 1", "Tip 2"]
```

### ACL Categories

```toml
[[commands]]
name = "ADMIN.COMMAND"
acl_categories = ["admin", "dangerous"]
```

Built-in categories:
- `read` - Read operations
- `write` - Write operations
- `admin` - Administrative operations
- `dangerous` - Potentially dangerous
- `slow` - Potentially slow
- `fast` - Always fast
- `blocking` - May block
- `scripting` - Lua scripting related

## Error Handling

### Return Errors

```rust
#[command(name = "SAFE.DIVIDE", flags = ["read"])]
fn safe_divide(ctx: &PluginContext, args: &[Value]) -> CommandResult {
    let a = args.get(0)
        .and_then(|v| v.as_f64())
        .ok_or("First argument must be a number")?;

    let b = args.get(1)
        .and_then(|v| v.as_f64())
        .ok_or("Second argument must be a number")?;

    if b == 0.0 {
        return Err("Division by zero".into());
    }

    Ok(Value::BulkString(format!("{}", a / b).into_bytes()))
}
```

### Error Types

```rust
use ferrite_plugin_sdk::error::CommandError;

// Simple string error
return Err("Something went wrong".into());

// Typed error
return Err(CommandError::WrongType);
return Err(CommandError::OutOfRange);
return Err(CommandError::Syntax);
return Err(CommandError::NoAuth);
return Err(CommandError::Custom("Custom error message".to_string()));
```

## Response Types

### Simple String

```rust
Ok(Value::SimpleString("OK".to_string()))
// +OK\r\n
```

### Bulk String

```rust
Ok(Value::BulkString(b"Hello, World!".to_vec()))
// $13\r\nHello, World!\r\n
```

### Integer

```rust
Ok(Value::Integer(42))
// :42\r\n
```

### Array

```rust
Ok(Value::Array(vec![
    Value::BulkString(b"item1".to_vec()),
    Value::BulkString(b"item2".to_vec()),
    Value::Integer(3),
]))
// *3\r\n$5\r\nitem1\r\n$5\r\nitem2\r\n:3\r\n
```

### Null

```rust
Ok(Value::Null)
// $-1\r\n
```

### Map (RESP3)

```rust
Ok(Value::Map(vec![
    (Value::BulkString(b"key1".to_vec()), Value::BulkString(b"value1".to_vec())),
    (Value::BulkString(b"key2".to_vec()), Value::Integer(42)),
]))
```

## Testing Commands

### Unit Tests

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use ferrite_plugin_sdk::testing::*;

    #[test]
    fn test_counter_incr() {
        let ctx = MockContext::new();

        // First increment
        let result = counter_incr(&ctx, &[Value::BulkString(b"test".to_vec())]);
        assert_eq!(result.unwrap(), Value::Integer(1));

        // Second increment
        let result = counter_incr(&ctx, &[Value::BulkString(b"test".to_vec())]);
        assert_eq!(result.unwrap(), Value::Integer(2));

        // Increment by 5
        let result = counter_incr(&ctx, &[
            Value::BulkString(b"test".to_vec()),
            Value::Integer(5)
        ]);
        assert_eq!(result.unwrap(), Value::Integer(7));
    }

    #[test]
    fn test_counter_incr_errors() {
        let ctx = MockContext::new();

        // Missing key
        let result = counter_incr(&ctx, &[]);
        assert!(result.is_err());
    }
}
```

### Integration Tests

```bash
# Load plugin
PLUGIN.LOAD mycommands /path/to/mycommands.wasm

# Test commands
COUNTER.INCR test
# 1

COUNTER.INCR test 10
# 11
```

## Best Practices

1. **Validate all arguments** - Check types and ranges
2. **Use appropriate flags** - Mark read/write correctly for replication
3. **Handle missing keys** - Return NULL or appropriate default
4. **Document thoroughly** - Include complexity, examples in manifest
5. **Follow naming conventions** - Use PREFIX.COMMAND format
6. **Keep commands focused** - One command, one purpose
7. **Test edge cases** - Empty strings, large values, missing args

## Next Steps

- [Plugin System](/docs/extensibility/plugin-system) - Plugin architecture
- [Custom Data Types](/docs/extensibility/custom-data-types) - Creating data types
- [WASM Functions](/docs/extensibility/wasm-functions) - UDF functions
