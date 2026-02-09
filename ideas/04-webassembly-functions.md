# WebAssembly User Functions

## Executive Summary

Enable users to run custom WebAssembly modules at the data layer, providing a portable, secure, and polyglot alternative to Lua scripting. Execute complex logic where the data lives without round-trip latency.

**Status**: Proposal
**Priority**: Medium
**Estimated Effort**: 2-3 months
**Target Release**: v0.5.0

---

## Problem Statement

### Current State: Lua Scripting

Redis supports Lua scripting for server-side execution:
```lua
redis.call('SET', KEYS[1], ARGV[1])
local val = redis.call('GET', KEYS[1])
return val
```

### Limitations of Lua

| Issue | Impact |
|-------|--------|
| **Language lock-in** | Must learn/use Lua, can't reuse existing code |
| **Limited ecosystem** | Lua has fewer libraries than mainstream languages |
| **No sandboxing** | Scripts can access all Redis commands |
| **Hard to test** | Testing Lua in Redis is awkward |
| **Performance** | Interpreted, no JIT in Redis's embedded Lua |
| **Portability** | Scripts tied to Redis, can't run elsewhere |

### Why WebAssembly?

1. **Polyglot**: Write in Rust, Go, Python, TypeScript, C++ → compile to WASM
2. **Secure**: Memory-safe sandbox with explicit capability grants
3. **Fast**: Near-native performance with AOT/JIT compilation
4. **Portable**: Same module runs on Ferrite, CDN edges, browsers
5. **Testable**: Test locally before deploying
6. **Ecosystem**: Use any library that compiles to WASM

---

## Technical Design

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    WASM Function Runtime                        │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                   Function Registry                         │ │
│  │  name -> { wasm_module, permissions, metadata }             │ │
│  └─────────────────────────────┬───────────────────────────────┘ │
│                                ▼                                 │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                    WASM Runtime (wasmtime)                  │ │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │ │
│  │  │   Module    │  │   Module    │  │      Module         │  │ │
│  │  │   Pool      │  │   Instance  │  │      Executor       │  │ │
│  │  │  (cached)   │  │    Pool     │  │   (per-request)     │  │ │
│  │  └─────────────┘  └─────────────┘  └─────────────────────┘  │ │
│  └─────────────────────────────┬───────────────────────────────┘ │
│                                ▼                                 │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                    Host Functions (API)                     │ │
│  │  ferrite_get, ferrite_set, ferrite_del, ferrite_hget, ...  │ │
│  │  ferrite_log, ferrite_time, ferrite_random, ...            │ │
│  └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### Core Components

#### Function Registry

```rust
/// Registry for WASM functions
pub struct FunctionRegistry {
    /// Compiled modules (cached)
    modules: DashMap<String, Arc<WasmModule>>,
    /// Function metadata
    metadata: DashMap<String, FunctionMetadata>,
    /// WASM runtime engine
    engine: wasmtime::Engine,
}

pub struct WasmModule {
    /// Compiled module
    module: wasmtime::Module,
    /// Pre-instantiation snapshot (for fast startup)
    snapshot: Option<InstancePre>,
}

#[derive(Clone, Serialize, Deserialize)]
pub struct FunctionMetadata {
    /// Function name
    name: String,
    /// Description
    description: Option<String>,
    /// Permissions granted to this function
    permissions: FunctionPermissions,
    /// Resource limits
    limits: ResourceLimits,
    /// Creation timestamp
    created_at: SystemTime,
    /// Source hash for versioning
    source_hash: String,
}

#[derive(Clone, Serialize, Deserialize)]
pub struct FunctionPermissions {
    /// Allowed key patterns (glob)
    allowed_keys: Vec<GlobPattern>,
    /// Denied key patterns
    denied_keys: Vec<GlobPattern>,
    /// Allowed commands
    allowed_commands: HashSet<String>,
    /// Can call external URLs?
    allow_network: bool,
    /// Can write data?
    allow_write: bool,
}

#[derive(Clone, Serialize, Deserialize)]
pub struct ResourceLimits {
    /// Max memory (bytes)
    max_memory: usize,
    /// Max execution time
    max_time: Duration,
    /// Max fuel (instruction count)
    max_fuel: u64,
    /// Max stack depth
    max_stack: u32,
}
```

#### WASM Runtime Integration

```rust
use wasmtime::*;

/// WASM execution engine
pub struct WasmExecutor {
    engine: Engine,
    linker: Linker<HostState>,
}

/// Host state passed to WASM functions
pub struct HostState {
    /// Reference to Ferrite store
    store: Arc<Store>,
    /// Current database
    db: u8,
    /// Permissions for this execution
    permissions: FunctionPermissions,
    /// Resource usage tracking
    usage: ResourceUsage,
    /// Error state
    error: Option<String>,
}

impl WasmExecutor {
    pub fn new() -> Result<Self> {
        let mut config = Config::new();
        config.async_support(true);
        config.consume_fuel(true);
        config.epoch_interruption(true);
        config.wasm_memory64(false);  // 32-bit for safety

        let engine = Engine::new(&config)?;
        let mut linker = Linker::new(&engine);

        // Register host functions
        Self::register_host_functions(&mut linker)?;

        Ok(Self { engine, linker })
    }

    fn register_host_functions(linker: &mut Linker<HostState>) -> Result<()> {
        // Key-value operations
        linker.func_wrap("ferrite", "get", |caller: Caller<'_, HostState>, key_ptr: i32, key_len: i32| -> i32 {
            // Implementation
        })?;

        linker.func_wrap("ferrite", "set", |caller: Caller<'_, HostState>, key_ptr: i32, key_len: i32, val_ptr: i32, val_len: i32| -> i32 {
            // Implementation
        })?;

        linker.func_wrap("ferrite", "del", |caller: Caller<'_, HostState>, key_ptr: i32, key_len: i32| -> i32 {
            // Implementation
        })?;

        // Logging
        linker.func_wrap("ferrite", "log", |caller: Caller<'_, HostState>, level: i32, msg_ptr: i32, msg_len: i32| {
            // Implementation
        })?;

        // Time
        linker.func_wrap("ferrite", "time_millis", |_caller: Caller<'_, HostState>| -> i64 {
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_millis() as i64
        })?;

        Ok(())
    }

    /// Execute a WASM function
    pub async fn execute(
        &self,
        module: &WasmModule,
        function: &str,
        args: Vec<Value>,
        state: HostState,
    ) -> Result<Vec<Value>> {
        let mut store = wasmtime::Store::new(&self.engine, state);

        // Set resource limits
        store.set_fuel(state.limits.max_fuel)?;
        store.epoch_deadline_trap();

        // Instantiate module
        let instance = self.linker.instantiate_async(&mut store, &module.module).await?;

        // Get function
        let func = instance.get_func(&mut store, function)
            .ok_or_else(|| anyhow!("Function not found: {}", function))?;

        // Call function
        let mut results = vec![Val::I32(0); func.ty(&store).results().len()];
        func.call_async(&mut store, &args, &mut results).await?;

        Ok(results)
    }
}
```

### Host Function ABI

```rust
/// WASM-compatible ABI for Ferrite operations
/// Uses i32 for pointers and lengths (WASM32)

// Memory allocation (provided by WASM module)
// extern "C" fn alloc(size: i32) -> i32;
// extern "C" fn dealloc(ptr: i32, size: i32);

/// Get a key's value
/// Returns: length of value, or negative error code
/// Value is written to provided buffer
extern "C" fn ferrite_get(
    key_ptr: i32,
    key_len: i32,
    value_buf_ptr: i32,
    value_buf_len: i32,
) -> i32;

/// Set a key's value
/// Returns: 0 on success, negative error code on failure
extern "C" fn ferrite_set(
    key_ptr: i32,
    key_len: i32,
    value_ptr: i32,
    value_len: i32,
    options: i32,  // Bitflags: NX, XX, EX, PX, etc.
    ttl_ms: i64,
) -> i32;

/// Delete key(s)
/// Returns: number of keys deleted, or negative error code
extern "C" fn ferrite_del(
    keys_ptr: i32,   // Array of (ptr, len) pairs
    keys_count: i32,
) -> i32;

/// Execute arbitrary Redis command
/// Returns: serialized RESP response length
extern "C" fn ferrite_call(
    cmd_ptr: i32,
    cmd_len: i32,
    args_ptr: i32,   // Serialized array of args
    args_len: i32,
    result_ptr: i32,
    result_len: i32,
) -> i32;

/// Log a message
extern "C" fn ferrite_log(
    level: i32,      // 0=trace, 1=debug, 2=info, 3=warn, 4=error
    msg_ptr: i32,
    msg_len: i32,
);

/// Get current time in milliseconds
extern "C" fn ferrite_time_millis() -> i64;

/// Generate random bytes
extern "C" fn ferrite_random(buf_ptr: i32, buf_len: i32);
```

---

## API Design

### Function Management

```redis
# Load a WASM module
WASM.LOAD <name> <path_or_base64>
    [DESCRIPTION <text>]
    [PERMISSIONS <json>]
    [LIMITS <json>]
    [REPLACE]

# Examples
WASM.LOAD myfilter /path/to/filter.wasm
WASM.LOAD myfunc $(cat function.wasm | base64)
WASM.LOAD secure_func ./secure.wasm PERMISSIONS '{"allowed_keys": ["user:*"], "allow_write": false}'

# Unload a function
WASM.UNLOAD <name>

# List loaded functions
WASM.LIST

# Get function info
WASM.INFO <name>
# Returns: permissions, limits, memory usage, call count, etc.

# Reload function (for updates)
WASM.RELOAD <name> <path_or_base64>
```

### Function Execution

```redis
# Call a function
WASM.CALL <name> [KEYS <key> ...] [ARGS <arg> ...]

# Examples
WASM.CALL validate_user KEYS user:123 ARGS '{"action": "login"}'
WASM.CALL aggregate_stats KEYS stats:* ARGS start_date end_date
WASM.CALL rate_limit KEYS ratelimit:api:123 ARGS 100 60

# Call with timeout override
WASM.CALL <name> TIMEOUT <ms> [KEYS ...] [ARGS ...]

# Async call (returns immediately, get result later)
WASM.CALLASYNC <name> [KEYS ...] [ARGS ...]
# → Returns: call_id

WASM.RESULT <call_id> [BLOCK <ms>]
```

### Inline WASM (for simple functions)

```redis
# Define function inline (WAT format for debugging)
WASM.DEFINE <name> <wat_source>

# Example
WASM.DEFINE add1 '
  (module
    (func (export "run") (param i32) (result i32)
      local.get 0
      i32.const 1
      i32.add
    )
  )
'
```

### Debugging

```redis
# Get function's WASM exports
WASM.EXPORTS <name>

# Get memory usage
WASM.MEMORY <name>

# View recent errors
WASM.ERRORS <name> [LIMIT <count>]

# Profile function execution
WASM.PROFILE <name> [KEYS ...] [ARGS ...]
# Returns: execution time, memory peak, fuel consumed, calls to host functions
```

---

## SDK / Guest Libraries

### Rust SDK

```rust
// ferrite-wasm-sdk crate

use ferrite_wasm_sdk::*;

#[ferrite_function]
pub fn rate_limit(key: &str, limit: i64, window_secs: i64) -> Result<bool, Error> {
    let current: i64 = ferrite::get(key)?.unwrap_or(0);

    if current >= limit {
        return Ok(false);
    }

    ferrite::incr(key)?;

    // Set expiry if this is the first request in window
    if current == 0 {
        ferrite::expire(key, window_secs)?;
    }

    Ok(true)
}
```

### TypeScript/AssemblyScript SDK

```typescript
// @ferrite/wasm-sdk

import { ferrite } from "@ferrite/wasm-sdk";

export function validateUser(userId: string): boolean {
    const user = ferrite.hgetall(`user:${userId}`);

    if (!user) {
        return false;
    }

    if (user.get("status") !== "active") {
        return false;
    }

    // Update last access
    ferrite.hset(`user:${userId}`, "last_access", Date.now().toString());

    return true;
}
```

### Go SDK

```go
package main

import (
    "github.com/ferrite/wasm-sdk-go"
)

//export processOrder
func processOrder(orderID string) int32 {
    order, err := ferrite.HGetAll("order:" + orderID)
    if err != nil {
        return -1
    }

    // Business logic
    total := calculateTotal(order)

    // Update order
    ferrite.HSet("order:" + orderID, "total", fmt.Sprintf("%.2f", total))
    ferrite.HSet("order:" + orderID, "status", "processed")

    return 0
}

func main() {}
```

### Python SDK (via pyo3-wasm or similar)

```python
from ferrite_wasm import ferrite

def aggregate_daily_stats(date: str) -> dict:
    """Aggregate all stats for a given date."""
    pattern = f"stats:{date}:*"
    keys = ferrite.keys(pattern)

    totals = {}
    for key in keys:
        data = ferrite.hgetall(key)
        for field, value in data.items():
            totals[field] = totals.get(field, 0) + int(value)

    # Store aggregated result
    ferrite.hset(f"stats:{date}:total", totals)

    return totals
```

---

## Implementation Plan

### Phase 1: Runtime Foundation (3 weeks)

#### Week 1-2: WASM Runtime Integration

- [ ] Add `wasmtime` dependency
- [ ] Implement `WasmExecutor` with basic configuration
- [ ] Create host function stubs
- [ ] Basic module loading and execution

#### Week 3: Host Function Implementation

- [ ] Implement `ferrite_get`, `ferrite_set`, `ferrite_del`
- [ ] Implement `ferrite_call` for arbitrary commands
- [ ] Add `ferrite_log`, `ferrite_time_millis`
- [ ] Memory management (alloc/dealloc protocol)

### Phase 2: Function Management (2 weeks)

#### Week 4: Registry and Commands

- [ ] Implement `FunctionRegistry`
- [ ] Add `WASM.LOAD`, `WASM.UNLOAD`, `WASM.LIST`
- [ ] Implement `WASM.CALL` command
- [ ] Persistence of loaded functions

#### Week 5: Permissions and Limits

- [ ] Implement permission checking
- [ ] Add fuel-based execution limits
- [ ] Epoch-based timeout interruption
- [ ] Memory limit enforcement

### Phase 3: SDK Development (3 weeks)

#### Week 6-7: Rust SDK

- [ ] Create `ferrite-wasm-sdk` crate
- [ ] Implement procedural macros for function export
- [ ] High-level API wrappers
- [ ] Examples and documentation

#### Week 8: Other SDKs

- [ ] AssemblyScript SDK skeleton
- [ ] Go SDK skeleton
- [ ] Build and test tooling

### Phase 4: Production Hardening (2 weeks)

#### Week 9: Performance

- [ ] Module caching and pre-instantiation
- [ ] Instance pooling for concurrent calls
- [ ] Benchmark suite
- [ ] Memory optimization

#### Week 10: Operations

- [ ] Metrics and observability
- [ ] Error handling and logging
- [ ] Documentation
- [ ] Security review

---

## Security Considerations

### Sandboxing

```rust
// Memory isolation - each instance has own linear memory
// No access to host filesystem, network, or other instances

// Capability-based permissions
let permissions = FunctionPermissions {
    allowed_keys: vec!["user:*".parse()?],  // Only user: keys
    denied_keys: vec!["user:*:password".parse()?],  // But not passwords
    allowed_commands: hashset!["GET", "SET", "HGET", "HSET"],
    allow_network: false,
    allow_write: true,
};
```

### Resource Limits

```rust
// Fuel-based CPU limiting
store.set_fuel(1_000_000)?;  // ~1M instructions

// Epoch-based timeouts
std::thread::spawn(move || {
    std::thread::sleep(Duration::from_secs(5));
    engine.increment_epoch();
});

// Memory limits
let mut limits = StoreLimits::new();
limits.memory_size(16 * 1024 * 1024);  // 16MB max
store.limiter(|_| limits);
```

### Audit Trail

```rust
// Log all function calls for audit
tracing::info!(
    function = %name,
    keys = ?keys,
    duration_ms = elapsed.as_millis(),
    fuel_consumed = fuel_used,
    "WASM function executed"
);
```

---

## Performance Considerations

### Optimization Strategies

1. **Module Caching**
   - Compile once, instantiate many times
   - Use `InstancePre` for faster instantiation

2. **Instance Pooling**
   - Pool of pre-warmed instances
   - Reset state between calls

3. **AOT Compilation**
   - Compile to native code on load
   - Store compiled artifacts

4. **Zero-Copy Data Transfer**
   - Share memory between host and guest where safe
   - Avoid unnecessary serialization

### Benchmark Targets

| Metric | Target | Notes |
|--------|--------|-------|
| Cold start | < 10ms | First call after load |
| Warm call | < 0.1ms | Subsequent calls |
| Memory overhead | < 1MB | Per function instance |
| Throughput | > 50K calls/sec | Simple functions |

---

## Configuration

### ferrite.toml

```toml
[wasm]
# Enable WASM function support
enabled = true

# Directory for WASM modules
module_dir = "./wasm"

# Default resource limits
[wasm.limits]
max_memory = "16MB"
max_time = "5s"
max_fuel = 10000000
max_stack_depth = 128

# Instance pooling
[wasm.pool]
min_instances = 2
max_instances = 16
idle_timeout = "5m"

# Security defaults
[wasm.security]
allow_network = false
allow_filesystem = false
default_permissions = "read-only"

# Caching
[wasm.cache]
enabled = true
compiled_cache_dir = "./cache/wasm"
max_cache_size = "1GB"
```

---

## Testing Strategy

### Unit Tests

```rust
#[tokio::test]
async fn test_simple_function() {
    let executor = WasmExecutor::new().unwrap();
    let module = compile_wat(r#"
        (module
            (func (export "add") (param i32 i32) (result i32)
                local.get 0
                local.get 1
                i32.add
            )
        )
    "#);

    let result = executor.execute(&module, "add", vec![Val::I32(2), Val::I32(3)]).await;
    assert_eq!(result[0], Val::I32(5));
}

#[tokio::test]
async fn test_host_function_get() {
    // Test that WASM can call ferrite_get
}

#[tokio::test]
async fn test_permission_denied() {
    // Test that permission checks work
}

#[tokio::test]
async fn test_fuel_exhaustion() {
    // Test that infinite loops are terminated
}
```

### Integration Tests

- [ ] Load function via redis-cli
- [ ] Call function with various arguments
- [ ] Test permission enforcement
- [ ] Test resource limit enforcement
- [ ] Persistence and reload

### Compatibility Tests

- [ ] Rust SDK end-to-end
- [ ] AssemblyScript SDK end-to-end
- [ ] Complex real-world functions

---

## Risks and Mitigations

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Security vulnerabilities | Critical | Medium | Extensive sandboxing, security audit |
| Performance overhead | High | Medium | Caching, pooling, optimization |
| SDK maintenance burden | Medium | High | Start with Rust only, community SDKs |
| WASM ecosystem maturity | Medium | Low | Use established wasmtime runtime |
| Complex debugging | Medium | Medium | Good error messages, profiling tools |

---

## Success Metrics

### Technical Metrics

- Cold start < 10ms
- Warm call < 0.5ms
- Zero security incidents
- 95%+ of Lua use cases supportable

### Business Metrics

- 20% of active users try WASM functions
- 3+ production case studies
- Community SDK contributions

---

## Future Enhancements

1. **WASI Support** - File/network access for trusted functions
2. **Component Model** - WASM component composition
3. **Hot Reload** - Update functions without restart
4. **Distributed Functions** - Run on cluster, aggregate results
5. **Function Marketplace** - Share/discover community functions

---

## References

- [Wasmtime Documentation](https://docs.wasmtime.dev/)
- [WebAssembly Specification](https://webassembly.github.io/spec/)
- [WASI](https://wasi.dev/)
- [AssemblyScript](https://www.assemblyscript.org/)
- [Cloudflare Workers](https://workers.cloudflare.com/) (inspiration)
- [Fastly Compute](https://www.fastly.com/products/edge-compute) (inspiration)
