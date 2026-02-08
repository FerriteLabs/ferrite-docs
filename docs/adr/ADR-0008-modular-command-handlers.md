# ADR-0008: Modular Command Handler Architecture

## Status

Accepted

## Context

Redis has 200+ commands spanning multiple data types and operational categories. Ferrite needs to:
- Implement most Redis commands for compatibility
- Add Ferrite-specific commands (vector search, WASM, etc.)
- Allow easy addition of new commands
- Maintain clean separation of concerns
- Support command routing, ACL checks, and metrics

Code organization approaches:

1. **Single giant match statement**
   - Simple but unmaintainable at scale
   - Hard to add commands without conflicts

2. **Command registry with function pointers**
   - Dynamic dispatch overhead
   - Hard to type-check at compile time

3. **Trait-based command objects**
   - Type-safe but heavy boilerplate
   - Each command needs struct + impl

4. **Module-per-category with handler functions**
   - Logical grouping by data type
   - Easy to navigate and extend
   - Clear ownership and testing boundaries

## Decision

We adopt a **modular handler architecture** organized by command category:

### Module Structure
```
src/commands/
├── mod.rs              # Command dispatcher
├── dispatcher.rs       # Routing logic
├── registry.rs         # Command metadata
└── handlers/
    ├── mod.rs          # Handler exports
    ├── strings.rs      # GET, SET, INCR, APPEND, etc.
    ├── keys.rs         # DEL, EXISTS, EXPIRE, TTL, etc.
    ├── lists.rs        # LPUSH, RPOP, LRANGE, etc.
    ├── hashes.rs       # HSET, HGET, HGETALL, etc.
    ├── sets.rs         # SADD, SMEMBERS, SINTER, etc.
    ├── sorted_sets.rs  # ZADD, ZRANGE, ZSCORE, etc.
    ├── streams.rs      # XADD, XREAD, XGROUP, etc.
    ├── pubsub.rs       # PUBLISH, SUBSCRIBE, etc.
    ├── transactions.rs # MULTI, EXEC, WATCH, etc.
    ├── scripting.rs    # EVAL, EVALSHA, SCRIPT, etc.
    ├── cluster.rs      # CLUSTER *, etc.
    ├── server.rs       # PING, INFO, CONFIG, etc.
    ├── vector.rs       # FT.CREATE, FT.SEARCH, etc.
    ├── wasm.rs         # WASM.LOAD, WASM.CALL, etc.
    └── rag.rs          # RAG.*, SEMANTIC.*, etc.
```

### Command Dispatch Flow
```
┌─────────────────┐
│  RESP Parser    │
│  (Frame in)     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Command Parse  │──── Extract command name + args
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   ACL Check     │──── Verify permissions
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   Dispatcher    │──── Route to handler module
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│    Handler      │──── Execute business logic
│  (e.g., SET)    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  RESP Encoder   │
│  (Frame out)    │
└─────────────────┘
```

### Handler Pattern
```rust
// src/commands/handlers/strings.rs

use crate::protocol::Frame;
use crate::storage::Storage;
use bytes::Bytes;

/// Handle GET command
pub async fn get(storage: &Storage, key: &Bytes) -> Frame {
    match storage.get(key).await {
        Some(value) => Frame::Bulk(Some(value)),
        None => Frame::Null,
    }
}

/// Handle SET command with options
pub async fn set(
    storage: &Storage,
    key: Bytes,
    value: Bytes,
    options: SetOptions,
) -> Frame {
    // Handle NX/XX conditions
    if options.nx && storage.exists(&key).await {
        return Frame::Null;
    }
    if options.xx && !storage.exists(&key).await {
        return Frame::Null;
    }

    // Set value with optional expiry
    storage.set(key, value, options.expiry).await;

    if options.get {
        // GET option: return previous value
        Frame::Bulk(previous_value)
    } else {
        Frame::simple("OK")
    }
}

pub struct SetOptions {
    pub expiry: Option<Duration>,
    pub nx: bool,  // Only set if not exists
    pub xx: bool,  // Only set if exists
    pub get: bool, // Return previous value
}
```

### Command Metadata
```rust
pub struct CommandInfo {
    pub name: &'static str,
    pub arity: i32,           // -N means N or more
    pub flags: CommandFlags,
    pub first_key: i32,
    pub last_key: i32,
    pub step: i32,
    pub acl_categories: &'static [&'static str],
}

bitflags! {
    pub struct CommandFlags: u32 {
        const WRITE = 0x01;
        const READONLY = 0x02;
        const ADMIN = 0x04;
        const PUBSUB = 0x08;
        const FAST = 0x10;
        const BLOCKING = 0x20;
    }
}
```

## Consequences

### Positive
- **Discoverability**: Find commands by navigating to relevant module
- **Encapsulation**: Each module owns its data type logic
- **Testability**: Unit test handlers in isolation
- **Extensibility**: Add new command categories without touching others
- **Code review**: Changes scoped to specific modules
- **Documentation**: Module docs describe command group

### Negative
- **Dispatcher complexity**: Central router must know all modules
- **Cross-cutting concerns**: Metrics, logging, ACL in every handler
- **Potential duplication**: Similar patterns repeated across modules
- **Import management**: Many re-exports needed

### Trade-offs
- **Grouping granularity**: One file per command vs grouped by type
- **Handler parameters**: Pass context struct vs individual args
- **Async everywhere**: Consistency vs overhead for sync operations

## Implementation Notes

Key files:
- `src/commands/mod.rs` - Public interface
- `src/commands/dispatcher.rs` - Command routing
- `src/commands/registry.rs` - Command metadata for INFO

Dispatcher implementation:
```rust
pub async fn dispatch(
    ctx: &CommandContext,
    cmd: &str,
    args: &[Bytes],
) -> Frame {
    // Normalize command name
    let cmd = cmd.to_uppercase();

    // Route to appropriate handler
    match cmd.as_str() {
        // Strings
        "GET" => handlers::strings::get(&ctx.storage, &args[0]).await,
        "SET" => handlers::strings::set(&ctx.storage, /* ... */).await,
        "INCR" => handlers::strings::incr(&ctx.storage, &args[0]).await,

        // Keys
        "DEL" => handlers::keys::del(&ctx.storage, args).await,
        "EXISTS" => handlers::keys::exists(&ctx.storage, args).await,

        // Lists
        "LPUSH" => handlers::lists::lpush(&ctx.storage, /* ... */).await,

        // Ferrite extensions
        "FT.SEARCH" => handlers::vector::search(/* ... */).await,
        "WASM.CALL" => handlers::wasm::call(/* ... */).await,

        _ => Frame::error(format!("ERR unknown command '{}'", cmd)),
    }
}
```

Command categories:
| Category | Commands | Handler Module |
|----------|----------|----------------|
| Strings | 25+ | `strings.rs` |
| Keys | 20+ | `keys.rs` |
| Lists | 15+ | `lists.rs` |
| Hashes | 15+ | `hashes.rs` |
| Sets | 15+ | `sets.rs` |
| Sorted Sets | 25+ | `sorted_sets.rs` |
| Streams | 15+ | `streams.rs` |
| Pub/Sub | 10+ | `pubsub.rs` |
| Transactions | 5 | `transactions.rs` |
| Scripting | 10+ | `scripting.rs` |
| Cluster | 20+ | `cluster.rs` |
| Server | 30+ | `server.rs` |
| Vector (Ferrite) | 10+ | `vector.rs` |
| WASM (Ferrite) | 10+ | `wasm.rs` |

## References

- [Redis Commands Reference](https://redis.io/commands/)
- [Redis Command Tips](https://redis.io/docs/reference/command-tips/)
- [Modular Architecture Patterns](https://doc.rust-lang.org/book/ch07-00-managing-growing-projects-with-packages-crates-and-modules.html)
