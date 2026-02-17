---
sidebar_position: 2
maturity: experimental
---

# Plugin System

Extend Ferrite with custom commands, data types, and event handlers using WebAssembly plugins.

## Overview

The plugin system allows extending Ferrite without modifying core code. Plugins are WebAssembly modules that run in a sandboxed environment with controlled access to Ferrite APIs.

```
┌─────────────────────────────────────────────────────────┐
│                    Plugin Manager                        │
├─────────────────────────────────────────────────────────┤
│  ┌──────────┐  ┌──────────┐  ┌──────────┐              │
│  │  Plugin  │  │  Plugin  │  │  Plugin  │   ...        │
│  │  (WASM)  │  │  (WASM)  │  │  (WASM)  │              │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘              │
│       │             │             │                     │
│  ┌────┴─────────────┴─────────────┴────┐               │
│  │            Sandbox Runtime           │               │
│  └──────────────────────────────────────┘               │
└─────────────────────────────────────────────────────────┘
```

## Plugin Capabilities

| Capability | Description |
|------------|-------------|
| Custom Commands | Add new Redis-like commands |
| Data Types | Create custom data structures |
| Event Hooks | React to key operations |
| Storage Backends | Integrate external storage |
| Transformers | Modify data in-flight |

## Quick Start

### Load a Plugin

```bash
# Load from file
PLUGIN.LOAD json-module /path/to/json.wasm

# Load from URL
PLUGIN.LOAD json-module https://plugins.example.com/json.wasm

# List plugins
PLUGIN.LIST
```

### Use Plugin Commands

```bash
# Use custom command from plugin
JSON.SET mykey $ '{"name": "Alice", "age": 30}'
JSON.GET mykey $.name
# Returns: "Alice"
```

## Plugin Manifest

Every plugin requires a manifest file (`plugin.toml`):

```toml
[package]
name = "redis-json"
version = "1.0.0"
description = "JSON data type support for Ferrite"
author = "Ferrite Team"
license = "Apache-2.0"
homepage = "https://github.com/ferrite/plugin-json"

[package.ferrite]
min_version = "0.1.0"

# Custom commands
[[commands]]
name = "JSON.SET"
description = "Set JSON value at path"
min_args = 3
max_args = 4
flags = ["write"]
acl_categories = ["write", "json"]

[[commands]]
name = "JSON.GET"
description = "Get JSON value at path"
min_args = 2
max_args = 3
flags = ["read"]
acl_categories = ["read", "json"]

# Custom data types
[[data_types]]
name = "JSON"
description = "JSON document structure"
encoding = "json"

# Event hooks
[[hooks]]
event = "OnKeyWrite"
priority = 0

# Required permissions
[[permissions]]
resource = "storage"
action = "read"

[[permissions]]
resource = "storage"
action = "write"

# Dependencies
[[dependencies]]
name = "serde-json"
version = "1.0"
optional = false
```

## Writing Plugins

### Rust Plugin

```rust
// src/lib.rs
use ferrite_plugin_sdk::{
    command, export_plugin, PluginContext, CommandResult, Value
};

#[command(name = "HELLO.WORLD", flags = ["read"])]
fn hello_world(ctx: &PluginContext, args: &[Value]) -> CommandResult {
    let name = args.get(0)
        .and_then(|v| v.as_str())
        .unwrap_or("World");

    Ok(Value::String(format!("Hello, {}!", name)))
}

#[command(name = "HELLO.COUNT", flags = ["read", "write"])]
fn hello_count(ctx: &PluginContext, args: &[Value]) -> CommandResult {
    let key = args.get(0)
        .ok_or("Missing key argument")?
        .as_str()
        .ok_or("Key must be a string")?;

    // Read current value
    let current = ctx.storage().get(key)?
        .and_then(|v| v.as_i64())
        .unwrap_or(0);

    // Increment and store
    let new_value = current + 1;
    ctx.storage().set(key, Value::Integer(new_value))?;

    Ok(Value::Integer(new_value))
}

export_plugin!(hello_world, hello_count);
```

Build for WebAssembly:

```bash
cargo build --target wasm32-wasi --release
```

### Go Plugin

```go
package main

import (
    "github.com/ferrite/plugin-sdk-go"
)

//export hello_world
func helloWorld(ctx *plugin.Context, args []plugin.Value) plugin.Result {
    name := "World"
    if len(args) > 0 {
        name = args[0].AsString()
    }
    return plugin.Ok(plugin.String("Hello, " + name + "!"))
}

func main() {}
```

Build with TinyGo:

```bash
tinygo build -o hello.wasm -target wasi main.go
```

### TypeScript Plugin

```typescript
// src/index.ts
import { command, PluginContext, Value, Result } from '@ferrite/plugin-sdk';

@command({ name: 'HELLO.WORLD', flags: ['read'] })
export function helloWorld(ctx: PluginContext, args: Value[]): Result {
    const name = args[0]?.asString() ?? 'World';
    return Result.ok(Value.string(`Hello, ${name}!`));
}
```

Build with AssemblyScript:

```bash
npm run asbuild
```

## Plugin API

### Storage Access

```rust
// Read key
let value = ctx.storage().get("mykey")?;

// Write key
ctx.storage().set("mykey", Value::String("value".to_string()))?;

// Delete key
ctx.storage().delete("mykey")?;

// Check existence
let exists = ctx.storage().exists("mykey")?;

// Set with TTL
ctx.storage().set_ex("mykey", value, 3600)?;  // 1 hour TTL
```

### Event Hooks

```rust
use ferrite_plugin_sdk::{hook, HookContext, HookResult};

#[hook(event = "OnKeyWrite")]
fn on_key_write(ctx: &HookContext) -> HookResult {
    let key = ctx.key();
    let value = ctx.value();

    // Log or validate
    if key.starts_with("protected:") {
        return HookResult::Abort("Cannot write to protected keys".to_string());
    }

    HookResult::Continue
}

#[hook(event = "OnKeyExpiry")]
fn on_key_expiry(ctx: &HookContext) -> HookResult {
    // Cleanup logic
    println!("Key expired: {}", ctx.key());
    HookResult::Continue
}
```

### Available Events

| Event | Trigger |
|-------|---------|
| `BeforeCommand` | Before any command executes |
| `AfterCommand` | After command completes |
| `OnKeyWrite` | When key is written |
| `OnKeyRead` | When key is read |
| `OnKeyExpiry` | When key expires |
| `OnKeyDelete` | When key is deleted |
| `OnClientConnect` | New client connection |
| `OnClientDisconnect` | Client disconnects |
| `OnServerStartup` | Server starts |
| `OnServerShutdown` | Server stops |

## Plugin Management

### Loading Plugins

```bash
# Load from file
PLUGIN.LOAD myplugin /plugins/myplugin.wasm

# Load with manifest
PLUGIN.LOAD myplugin /plugins/myplugin.wasm MANIFEST /plugins/myplugin.toml

# Load from base64
PLUGIN.LOAD myplugin BASE64 <base64-encoded-wasm>
```

### Plugin Info

```bash
PLUGIN.INFO myplugin
# Returns:
# name: myplugin
# version: 1.0.0
# state: active
# commands: [HELLO.WORLD, HELLO.COUNT]
# hooks: [OnKeyWrite]
# loaded_at: 2024-01-15T10:00:00Z
# executions: 5000
# errors: 2
```

### Enable/Disable

```bash
# Disable plugin
PLUGIN.DISABLE myplugin

# Enable plugin
PLUGIN.ENABLE myplugin
```

### Hot Reload

```bash
# Reload plugin with new version
PLUGIN.RELOAD myplugin /plugins/myplugin-v2.wasm
```

### Unload

```bash
PLUGIN.UNLOAD myplugin
```

## Permissions

Plugins run in a sandbox with explicit permissions:

```toml
# Minimal permissions
[[permissions]]
resource = "storage"
action = "read"

# Full storage access
[[permissions]]
resource = "storage"
action = "read"

[[permissions]]
resource = "storage"
action = "write"

[[permissions]]
resource = "storage"
action = "delete"

# Network access (restricted)
[[permissions]]
resource = "network"
action = "http_get"
hosts = ["api.example.com"]

# File system (restricted)
[[permissions]]
resource = "filesystem"
action = "read"
paths = ["/data/plugins/myplugin"]
```

### Permission Types

| Resource | Actions |
|----------|---------|
| `storage` | `read`, `write`, `delete` |
| `network` | `http_get`, `http_post`, `tcp_connect` |
| `filesystem` | `read`, `write` |
| `system` | `time`, `random`, `env` |

## Sandbox Configuration

```toml
[plugins.sandbox]
max_memory_mb = 128          # Memory limit per plugin
max_cpu_ms = 1000            # CPU time per call
max_file_handles = 10
restricted_syscalls = ["exec", "fork"]
```

### Resource Limits

```bash
# Set plugin limits
PLUGIN.LIMITS myplugin MEMORY 64MB CPU 500ms

# Get limits
PLUGIN.LIMITS myplugin
```

## Configuration

```toml
[plugins]
enabled = true
plugin_dir = "/var/lib/ferrite/plugins"
auto_load = true              # Load plugins on startup
max_plugins = 100
hot_reload = true
timeout_ms = 5000

[plugins.sandbox]
max_memory_mb = 128
max_cpu_ms = 1000
verify_signatures = true
```

## Rust API

```rust
use ferrite::plugin::{PluginManager, PluginConfig, PluginSource};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let manager = PluginManager::new(PluginConfig {
        enabled: true,
        plugin_dir: "/plugins".to_string(),
        auto_load: true,
        ..Default::default()
    });

    // Load plugin
    manager.load(
        "myplugin",
        PluginSource::File { path: "/plugins/myplugin.wasm".to_string() },
        None  // Auto-detect manifest
    ).await?;

    // Execute plugin command
    let result = manager.execute_command(
        "HELLO.WORLD",
        vec!["Alice".to_string()]
    ).await?;
    println!("Result: {:?}", result);

    // Get plugin stats
    let stats = manager.stats();
    println!("Loaded: {}, Active: {}", stats.total_plugins, stats.active_plugins);

    Ok(())
}
```

## Testing Plugins

### Unit Testing

```rust
#[cfg(test)]
mod tests {
    use ferrite_plugin_sdk::testing::*;

    #[test]
    fn test_hello_world() {
        let ctx = MockContext::new();
        let args = vec![Value::String("Alice".to_string())];

        let result = hello_world(&ctx, &args);

        assert!(result.is_ok());
        assert_eq!(result.unwrap(), Value::String("Hello, Alice!".to_string()));
    }
}
```

### Integration Testing

```bash
# Start Ferrite with plugin
ferrite --plugin /path/to/plugin.wasm

# Test commands
ferrite-cli HELLO.WORLD Alice
# "Hello, Alice!"
```

## Best Practices

1. **Minimize permissions** - Request only what you need
2. **Handle errors gracefully** - Don't crash the server
3. **Set timeouts** - Prevent infinite loops
4. **Version your plugins** - Use semantic versioning
5. **Document commands** - Include help text in manifest
6. **Test thoroughly** - Unit and integration tests
7. **Sign plugins** - Enable signature verification in production

## Plugin Directory Structure

```
plugins/
├── myplugin/
│   ├── plugin.toml          # Manifest
│   ├── myplugin.wasm        # Compiled plugin
│   ├── README.md            # Documentation
│   └── config/
│       └── default.toml     # Default configuration
```

## Next Steps

- [Custom Commands](/docs/extensibility/custom-commands) - Detailed command creation
- [Custom Data Types](/docs/extensibility/custom-data-types) - Creating data types
- [WASM Functions](/docs/extensibility/wasm-functions) - UDF functions
