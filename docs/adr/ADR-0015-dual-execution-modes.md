# ADR-0015: Dual Execution Modes (Server + Embedded)

## Status

Accepted

## Context

Traditional key-value stores like Redis operate exclusively as network servers. Clients connect over TCP, send commands via the RESP protocol, and receive responses. This model works well for:

- Shared caching across multiple application instances
- Centralized session storage
- Pub/sub message brokering
- Distributed systems coordination

However, many use cases don't require network overhead:

- **CLI tools**: Single-process applications that need persistent storage
- **Edge computing**: IoT devices with local storage requirements
- **Testing**: Unit/integration tests that need isolated, fast storage
- **Desktop applications**: Electron/Tauri apps with local data needs
- **Batch processing**: Jobs that process data locally before uploading

SQLite popularized the "embedded database" model where the database is a library linked directly into the application, not a separate process. This eliminates:
- Network serialization overhead
- TCP connection management
- Cross-process context switches
- Deployment complexity (no separate daemon)

## Decision

Ferrite supports **two first-class execution modes**:

### Mode 1: Server Mode (Redis-Compatible)

Traditional network server with full Redis protocol compatibility:

```rust
// main.rs - Server binary
use ferrite::{Server, Config};

#[tokio::main]
async fn main() -> Result<()> {
    let config = Config::from_file("ferrite.toml")?;
    let server = Server::new(config);

    // Listen on TCP port (default 6379)
    server.run().await
}
```

Usage:
```bash
# Start server
ferrite-server --config ferrite.toml

# Connect with any Redis client
redis-cli -p 6379 SET foo bar
```

### Mode 2: Embedded Mode (Library)

Direct library usage without network overhead:

```rust
// application code
use ferrite::{Database, Options};

fn main() -> Result<()> {
    // Open database (creates if not exists)
    let db = Database::open_with_options(
        "./data",
        Options::default()
            .max_memory(1024 * 1024 * 1024)  // 1GB
            .persistence(true),
    )?;

    // Direct API calls - no network
    db.set("user:1", b"Alice")?;

    let name = db.get("user:1")?;
    assert_eq!(name, Some(b"Alice".to_vec()));

    // Typed operations
    db.hset("user:1:profile", "email", "alice@example.com")?;
    db.hset("user:1:profile", "age", "30")?;

    let profile = db.hgetall("user:1:profile")?;
    // HashMap { "email" => "alice@example.com", "age" => "30" }

    Ok(())
}
```

### Shared Core Architecture

Both modes share the same storage engine, commands, and persistence:

```
┌─────────────────────────────────────────────────────────────┐
│                     Application Code                         │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│   ┌─────────────────┐         ┌─────────────────┐           │
│   │   Server Mode   │         │  Embedded Mode  │           │
│   │                 │         │                 │           │
│   │ ┌─────────────┐ │         │ ┌─────────────┐ │           │
│   │ │TCP Listener │ │         │ │ Direct API  │ │           │
│   │ └──────┬──────┘ │         │ └──────┬──────┘ │           │
│   │        │        │         │        │        │           │
│   │ ┌──────▼──────┐ │         │        │        │           │
│   │ │RESP Parser  │ │         │        │        │           │
│   │ └──────┬──────┘ │         │        │        │           │
│   │        │        │         │        │        │           │
│   └────────┼────────┘         └────────┼────────┘           │
│            │                           │                    │
│            └───────────┬───────────────┘                    │
│                        │                                    │
│                        ▼                                    │
│   ┌─────────────────────────────────────────────────────┐  │
│   │              Command Dispatcher                       │  │
│   │  (same implementation for both modes)                 │  │
│   └─────────────────────────┬───────────────────────────┘  │
│                             │                               │
│                             ▼                               │
│   ┌─────────────────────────────────────────────────────┐  │
│   │              Storage Engine                          │  │
│   │  HybridLog / Memory Store / Persistence              │  │
│   └─────────────────────────────────────────────────────┘  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### API Design

**Embedded API follows Rust conventions, not Redis naming:**

```rust
impl Database {
    // Lifecycle
    pub fn open(path: impl AsRef<Path>) -> Result<Self>;
    pub fn open_with_options(path: impl AsRef<Path>, opts: Options) -> Result<Self>;
    pub fn close(self) -> Result<()>;

    // String operations
    pub fn get(&self, key: &str) -> Result<Option<Vec<u8>>>;
    pub fn set(&self, key: &str, value: &[u8]) -> Result<()>;
    pub fn set_ex(&self, key: &str, value: &[u8], ttl: Duration) -> Result<()>;
    pub fn del(&self, key: &str) -> Result<bool>;

    // Hash operations
    pub fn hget(&self, key: &str, field: &str) -> Result<Option<Vec<u8>>>;
    pub fn hset(&self, key: &str, field: &str, value: &[u8]) -> Result<()>;
    pub fn hgetall(&self, key: &str) -> Result<HashMap<String, Vec<u8>>>;

    // List operations
    pub fn lpush(&self, key: &str, values: &[&[u8]]) -> Result<usize>;
    pub fn rpop(&self, key: &str) -> Result<Option<Vec<u8>>>;
    pub fn lrange(&self, key: &str, start: i64, stop: i64) -> Result<Vec<Vec<u8>>>;

    // Transactions
    pub fn transaction<F, T>(&self, f: F) -> Result<T>
    where
        F: FnOnce(&Transaction) -> Result<T>;

    // Persistence
    pub fn checkpoint(&self) -> Result<PathBuf>;
    pub fn compact(&self) -> Result<()>;
}
```

**Async variant for tokio integration:**

```rust
impl AsyncDatabase {
    pub async fn open(path: impl AsRef<Path>) -> Result<Self>;
    pub async fn get(&self, key: &str) -> Result<Option<Vec<u8>>>;
    pub async fn set(&self, key: &str, value: &[u8]) -> Result<()>;
    // ... async versions of all operations
}
```

### Binary Targets

```toml
# Cargo.toml

[[bin]]
name = "ferrite"
path = "src/main.rs"          # Server mode

[[bin]]
name = "ferrite-cli"
path = "src/bin/cli.rs"       # CLI client (connects to server)

[lib]
name = "ferrite"
path = "src/lib.rs"           # Embedded mode library
```

## Consequences

### Positive

- **Flexibility**: Same storage engine for different deployment models
- **Testing**: Embedded mode enables fast, isolated unit tests
- **Performance**: Embedded mode eliminates network overhead (~10x faster for small ops)
- **Deployment simplicity**: No separate daemon for single-process apps
- **Feature parity**: Both modes support same data types and operations
- **Migration path**: Start embedded, scale to server when needed

### Negative

- **API surface**: Two APIs to maintain and document
- **Concurrency model**: Embedded mode within single process vs multi-client server
- **Resource management**: Embedded mode shares process resources
- **Complexity**: Some features (pub/sub, cluster) only make sense in server mode
- **Testing burden**: Need to test both modes

### Trade-offs

- **Embedded isolation**: Crashes affect host application
- **Server overhead**: Network layer adds latency (~50-100us per operation)
- **Feature availability**: Some features are server-only (replication, cluster)

## Implementation Notes

Key files:
- `src/lib.rs` - Library root, exports `Database` for embedded use
- `src/main.rs` - Server binary entry point
- `src/embedded/mod.rs` - Embedded mode abstractions
- `src/embedded/database.rs` - `Database` API implementation
- `src/embedded/async_database.rs` - `AsyncDatabase` for tokio

Feature flags for mode-specific dependencies:
```toml
[features]
default = ["server", "embedded"]
server = ["tokio/net", "tower"]
embedded = []  # No extra deps needed
```

Example: Testing with embedded mode
```rust
#[cfg(test)]
mod tests {
    use ferrite::Database;
    use tempfile::tempdir;

    #[test]
    fn test_set_get() {
        let dir = tempdir().unwrap();
        let db = Database::open(dir.path()).unwrap();

        db.set("key", b"value").unwrap();
        assert_eq!(db.get("key").unwrap(), Some(b"value".to_vec()));
    }
}
```

Example: CLI tool using embedded mode
```rust
use ferrite::Database;
use clap::Parser;

#[derive(Parser)]
struct Args {
    #[arg(long, default_value = "./data")]
    db_path: PathBuf,
    #[command(subcommand)]
    command: Command,
}

fn main() -> Result<()> {
    let args = Args::parse();
    let db = Database::open(&args.db_path)?;

    match args.command {
        Command::Get { key } => {
            if let Some(value) = db.get(&key)? {
                println!("{}", String::from_utf8_lossy(&value));
            }
        }
        Command::Set { key, value } => {
            db.set(&key, value.as_bytes())?;
        }
    }

    Ok(())
}
```

## Performance Comparison

| Operation | Server Mode | Embedded Mode | Speedup |
|-----------|-------------|---------------|---------|
| GET (small) | 65us | 5us | 13x |
| SET (small) | 80us | 8us | 10x |
| GET (1KB) | 85us | 12us | 7x |
| SET (1KB) | 120us | 25us | 5x |
| MGET (100 keys) | 250us | 45us | 5.5x |
| Pipeline (100 ops) | 180us | 50us | 3.6x |

*Server mode includes: TCP read/write, RESP parse/encode, connection handling*
*Embedded mode: direct function calls, no serialization*

## References

- [SQLite: Single-file Database](https://www.sqlite.org/about.html)
- [RocksDB Embedded Usage](https://github.com/facebook/rocksdb/wiki/Basic-Operations)
- [sled: Embedded Database for Rust](https://sled.rs/)
- [libsql: SQLite fork with server mode](https://turso.tech/libsql)
