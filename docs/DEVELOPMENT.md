# Ferrite Development Guide

This guide covers setting up a development environment, understanding the codebase, and contributing to Ferrite.

## Table of Contents

1. [Development Setup](#development-setup)
2. [Project Structure](#project-structure)
3. [Building and Testing](#building-and-testing)
4. [Code Architecture](#code-architecture)
5. [Adding a New Command](#adding-a-new-command)
6. [Adding a New Feature](#adding-a-new-feature)
7. [Testing Guidelines](#testing-guidelines)
8. [Performance Guidelines](#performance-guidelines)
9. [Documentation Guidelines](#documentation-guidelines)
10. [Pull Request Process](#pull-request-process)

---

## Development Setup

### Prerequisites

- **Rust**: 1.88+ (MSRV enforced in CI; install via [rustup](https://rustup.rs/); rust-toolchain.toml pins it)
- **Git**: For version control
- **Redis CLI**: For testing (optional but recommended)
- **LLVM tools**: For coverage reports (optional, CI uses `cargo llvm-cov`)

### Linux-Specific (for io_uring)

```bash
# Ubuntu/Debian
sudo apt-get update
sudo apt-get install -y build-essential pkg-config libssl-dev

# Check kernel version (need 5.11+ for io_uring)
uname -r

# Build with io_uring enabled
cargo build --features io-uring
```

### macOS

```bash
# Install Xcode command line tools
xcode-select --install

# Optional: Install Redis for testing
brew install redis
```

### Clone and Build

```bash
# Clone the repository
git clone https://github.com/ferritelabs/ferrite.git
cd ferrite

# Build debug version
cargo build

# Build release version (optimized)
cargo build --release

# Run tests
cargo test

# Run the full local check (fmt, clippy, tests)
make check

# Run with debug logging
RUST_LOG=ferrite=debug cargo run
```

### Handy Shortcuts

```bash
# One-command local run (builds, initializes config, starts server)
make quickstart

# Windows (PowerShell)
.\scripts\quickstart.ps1

# Common developer tasks
make run
make test
make check

# Preflight checks
ferrite doctor --config ferrite.toml
```

### IDE Setup

**VS Code** (recommended):
```json
// .vscode/settings.json
{
  "rust-analyzer.cargo.features": "all",
  "rust-analyzer.checkOnSave.command": "clippy",
  "rust-analyzer.procMacro.enable": true
}
```

Recommended extensions:
- rust-analyzer
- Better TOML
- Error Lens
- CodeLLDB (for debugging)

**IntelliJ/RustRover**:
- Install Rust plugin
- Enable "Use clippy for check command"

---

## Project Structure

```
ferrite/
├── src/
│   ├── main.rs              # Server entry point, CLI parsing
│   ├── lib.rs               # Library root, module exports, documentation
│   ├── error.rs             # Error types (FerriteError enum)
│   ├── config.rs            # Configuration parsing (TOML)
│   │
│   ├── server/              # Network layer
│   │   ├── mod.rs           # Server struct and main loop
│   │   ├── listener.rs      # TCP/TLS listener
│   │   ├── connection.rs    # Per-client connection state
│   │   ├── handler.rs       # Request routing
│   │   └── tls.rs           # TLS configuration
│   │
│   ├── protocol/            # RESP protocol
│   │   ├── mod.rs           # Protocol types
│   │   ├── parser.rs        # Streaming RESP parser
│   │   ├── encoder.rs       # Response encoding
│   │   └── frame.rs         # Frame types
│   │
│   ├── storage/             # Storage engine
│   │   ├── mod.rs           # Storage traits and backends
│   │   ├── memory.rs        # In-memory store (DashMap)
│   │   ├── backend.rs       # Backend trait
│   │   ├── epoch.rs         # Epoch-based reclamation
│   │   └── hybridlog/       # Tiered storage
│   │       ├── mod.rs       # HybridLog implementation
│   │       ├── mutable.rs   # Hot tier (memory)
│   │       ├── readonly.rs  # Warm tier (mmap)
│   │       └── disk.rs      # Cold tier (io_uring)
│   │
│   ├── commands/            # Command implementations
│   │   ├── mod.rs           # Command dispatch
│   │   ├── strings.rs       # String commands
│   │   ├── lists.rs         # List commands
│   │   ├── hashes.rs        # Hash commands
│   │   ├── sets.rs          # Set commands
│   │   ├── sorted_sets.rs   # Sorted set commands
│   │   ├── keys.rs          # Key commands
│   │   ├── server.rs        # Server commands
│   │   └── handlers/        # Advanced handlers
│   │       ├── mod.rs
│   │       ├── vector.rs    # Vector search
│   │       ├── semantic.rs  # Semantic caching
│   │       └── ...
│   │
│   ├── persistence/         # Durability
│   │   ├── mod.rs
│   │   ├── aof.rs           # Append-only file
│   │   ├── checkpoint.rs    # Snapshots
│   │   └── backup/          # Backup system
│   │
│   ├── replication/         # Replication
│   │   ├── mod.rs
│   │   ├── primary.rs       # Primary logic
│   │   ├── replica.rs       # Replica logic
│   │   └── stream.rs        # Replication stream
│   │
│   ├── cluster/             # Cluster mode
│   │   ├── mod.rs
│   │   ├── slots.rs         # Hash slots
│   │   ├── gossip.rs        # Cluster protocol
│   │   └── failover.rs      # Automatic failover
│   │
│   └── [feature modules]    # vector/, semantic/, etc.
│
├── tests/                   # Integration tests
│   ├── redis_compat.rs      # Redis compatibility
│   ├── persistence.rs       # Persistence tests
│   └── stress.rs            # Stress tests
│
├── benches/                 # Benchmarks
│   ├── throughput.rs
│   ├── latency.rs
│   └── storage.rs
│
├── docs/                    # Documentation
│   ├── ARCHITECTURE.md
│   ├── API_REFERENCE.md
│   └── adr/                 # Architecture Decision Records
│
└── Cargo.toml               # Dependencies and features
```

---

## Building and Testing

### Build Commands

```bash
# Debug build (fast compile, slow runtime)
cargo build

# Release build (slow compile, fast runtime)
cargo build --release

# Build with specific features
cargo build --features "io-uring,wasm"

# Build all features
cargo build --all-features

# Check compilation without building
cargo check
```

### Test Commands

```bash
# Run all tests
cargo test

# Run with release optimizations
cargo test --release

# Run specific test
cargo test test_name

# Run tests in a specific module
cargo test storage::

# Run integration suites
cargo test --test redis_compat
cargo test --test persistence
cargo test --test stress

# Run with output
cargo test -- --nocapture

# Run ignored tests
cargo test -- --ignored
```

### Fast Feedback Loop

```bash
# Match most CI checks quickly
cargo fmt --all -- --check
cargo clippy --all-targets --all-features -- -D warnings
cargo test --lib
cargo test --test redis_compat
```

### CI Parity

CI runs format, clippy, debug/release tests, docs, and coverage (see
`.github/workflows/ci.yml`).

```bash
cargo fmt --all -- --check
cargo clippy --all-targets --all-features -- -D warnings
cargo test --all-features --verbose
cargo test --release --all-features
cargo build --release --all-features
cargo doc --no-deps --all-features
cargo llvm-cov --all-features --lcov --output-path lcov.info
```

### Linting and Formatting

```bash
# Format code
cargo fmt

# Check formatting
cargo fmt --check

# Run clippy
cargo clippy -- -D warnings

# Run clippy with all features
cargo clippy --all-features -- -D warnings
```

### Dependency Management

CI runs security and license checks (see `.github/workflows/security.yml`).

```bash
# Install tools
cargo install cargo-deny cargo-audit cargo-outdated cargo-license

# Audit dependencies and licenses
cargo deny check --all-features
cargo audit
cargo outdated --exit-code 0
cargo license
```

### Benchmarks

```bash
# Run all benchmarks
cargo bench

# Run specific benchmark
cargo bench throughput

# Generate flamegraph (requires cargo-flamegraph)
cargo flamegraph --bench throughput
```

### Documentation

```bash
# Generate and open documentation
cargo doc --open

# Generate docs with all features
cargo doc --all-features --open

# Include private items
cargo doc --document-private-items --open
```

---

## Code Architecture

### Core Traits

**Storage Backend**:
```rust
// src/storage/backend.rs
pub trait StorageBackend: Send + Sync {
    fn get(&self, db: u8, key: &[u8]) -> Result<Option<Value>>;
    fn set(&self, db: u8, key: &[u8], value: Value, ttl: Option<Duration>) -> Result<()>;
    fn del(&self, db: u8, keys: &[&[u8]]) -> Result<u64>;
    fn exists(&self, db: u8, key: &[u8]) -> Result<bool>;
    // ...
}
```

**Command Handler**:
```rust
// src/commands/mod.rs
pub trait CommandHandler: Send + Sync {
    fn execute(
        &self,
        ctx: &CommandContext,
        args: &[Frame],
    ) -> Result<Frame>;

    fn name(&self) -> &'static str;
    fn arity(&self) -> i32;  // Negative = at least N args
    fn flags(&self) -> CommandFlags;
}
```

### Request Flow

```
1. TCP Connection accepted (server/listener.rs)
         │
         ▼
2. Bytes read into buffer (server/connection.rs)
         │
         ▼
3. RESP Frame parsed (protocol/parser.rs)
         │
         ▼
4. Command identified (commands/mod.rs)
         │
         ▼
5. ACL check (auth/acl.rs)
         │
         ▼
6. Handler executed (commands/*.rs)
         │
         ▼
7. Storage operation (storage/mod.rs)
         │
         ▼
8. Response encoded (protocol/encoder.rs)
         │
         ▼
9. Bytes written to socket
```

### Value Types

```rust
// src/storage/mod.rs
pub enum Value {
    String(Bytes),
    List(VecDeque<Bytes>),
    Hash(HashMap<Bytes, Bytes>),
    Set(HashSet<Bytes>),
    SortedSet {
        by_score: BTreeMap<(OrderedFloat<f64>, Bytes), ()>,
        by_member: HashMap<Bytes, f64>,
    },
    Stream(Stream),
    // Feature-specific types
    Vector(VectorData),
    Document(JsonValue),
}
```

---

## Adding a New Command

### Step 1: Add Command to Parser

```rust
// src/commands/parser.rs
#[derive(Debug, Clone)]
pub enum Command {
    // Existing commands...

    // Your new command
    MyCommand { key: Bytes, value: Bytes },
}
```

### Step 2: Implement Parser Logic

```rust
// src/commands/parser.rs
impl Command {
    pub fn from_frame(frame: Frame) -> Result<Self> {
        let (cmd, args) = extract_command_args(frame)?;

        match cmd.to_uppercase().as_str() {
            // Existing commands...

            "MYCOMMAND" => {
                if args.len() < 2 {
                    return Err(FerriteError::WrongArity("MYCOMMAND".into()));
                }
                Ok(Command::MyCommand {
                    key: args[0].clone(),
                    value: args[1].clone(),
                })
            }

            _ => Err(FerriteError::UnknownCommand(cmd)),
        }
    }
}
```

### Step 3: Implement Handler

```rust
// src/commands/mycommand.rs
use crate::commands::{CommandContext, CommandHandler, CommandFlags};
use crate::protocol::Frame;
use crate::Result;

pub struct MyCommandHandler;

impl CommandHandler for MyCommandHandler {
    fn name(&self) -> &'static str {
        "MYCOMMAND"
    }

    fn arity(&self) -> i32 {
        3  // Command + 2 args
    }

    fn flags(&self) -> CommandFlags {
        CommandFlags::WRITE | CommandFlags::FAST
    }

    fn execute(&self, ctx: &CommandContext, args: &[Frame]) -> Result<Frame> {
        let key = args[0].as_bulk_str()?;
        let value = args[1].as_bulk_str()?;

        // Your implementation
        ctx.storage.set(ctx.db, key, Value::String(value.into()), None)?;

        Ok(Frame::simple_string("OK"))
    }
}
```

### Step 4: Register Handler

```rust
// src/commands/mod.rs
pub fn register_commands(registry: &mut CommandRegistry) {
    // Existing registrations...

    registry.register(Box::new(MyCommandHandler));
}
```

### Step 5: Add Tests

```rust
// tests/commands/mycommand.rs
#[tokio::test]
async fn test_mycommand_basic() {
    let server = TestServer::new().await;
    let mut client = server.client().await;

    let result = client.execute("MYCOMMAND", &["key", "value"]).await?;
    assert_eq!(result, "OK");

    let value = client.get("key").await?;
    assert_eq!(value, Some("value".to_string()));
}

#[tokio::test]
async fn test_mycommand_wrong_arity() {
    let server = TestServer::new().await;
    let mut client = server.client().await;

    let result = client.execute("MYCOMMAND", &["key"]).await;
    assert!(result.is_err());
}
```

---

## Adding a New Feature

### Step 1: Create Module

```bash
mkdir -p src/myfeature
touch src/myfeature/mod.rs
```

### Step 2: Define Module Structure

```rust
// src/myfeature/mod.rs
//! My Feature Module
//!
//! Description of what this feature does.
//!
//! # Example
//! ```no_run
//! use ferrite::myfeature::MyFeature;
//!
//! let feature = MyFeature::new();
//! feature.do_something()?;
//! ```

mod core;
mod config;

pub use core::MyFeature;
pub use config::MyFeatureConfig;
```

### Step 3: Add to lib.rs

```rust
// src/lib.rs

/// My Feature description.
pub mod myfeature;
```

### Step 4: Add Feature Flag (if optional)

```toml
# Cargo.toml
[features]
default = []
myfeature = ["some-dependency"]

[dependencies]
some-dependency = { version = "1.0", optional = true }
```

```rust
// src/lib.rs
#[cfg(feature = "myfeature")]
pub mod myfeature;
```

### Step 5: Add Command Handlers (if needed)

```rust
// src/commands/handlers/myfeature.rs
```

### Step 6: Add Tests

```rust
// tests/myfeature.rs
// Unit tests in src/myfeature/*.rs with #[cfg(test)]
```

### Step 7: Add Documentation

- Add module-level doc comments
- Update README.md if user-facing
- Create ADR if architectural decision

---

## Testing Guidelines

### Unit Tests

```rust
// In the same file as the code
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_basic_functionality() {
        // Arrange
        let input = "test";

        // Act
        let result = my_function(input);

        // Assert
        assert_eq!(result, expected);
    }

    #[test]
    fn test_error_case() {
        let result = my_function("");
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_async_functionality() {
        // For async code
    }
}
```

### Integration Tests

```rust
// tests/integration_test.rs
use ferrite::test_utils::TestServer;

#[tokio::test]
async fn test_full_flow() {
    let server = TestServer::new().await;
    let client = server.client().await;

    // Test complete user scenarios
    client.set("key", "value").await?;
    let result = client.get("key").await?;
    assert_eq!(result, Some("value"));
}
```

### Property-Based Testing

```rust
use proptest::prelude::*;

proptest! {
    #[test]
    fn test_roundtrip(value: String) {
        let encoded = encode(&value);
        let decoded = decode(&encoded)?;
        prop_assert_eq!(value, decoded);
    }
}
```

### Test Coverage

```bash
# Install cargo-llvm-cov
cargo install cargo-llvm-cov

# Generate coverage report
cargo llvm-cov --all-features --html
```

---

## Performance Guidelines

### Hot Path Optimization

```rust
// DO: Use inline for small, hot functions
#[inline]
fn hash_key(key: &[u8]) -> u64 {
    // ...
}

// DO: Use cold for error paths
#[cold]
fn handle_error(e: Error) -> Frame {
    // ...
}

// DO: Avoid allocations in hot paths
fn process(input: &[u8]) -> &[u8] {
    // Return slice, don't allocate
}

// DON'T: Allocate in hot paths
fn process_bad(input: &[u8]) -> Vec<u8> {
    input.to_vec()  // Allocation!
}
```

### Memory Efficiency

```rust
// DO: Use Bytes for zero-copy
use bytes::Bytes;

fn store(value: Bytes) {
    // Bytes is reference-counted, no copy
}

// DO: Use SmallVec for small collections
use smallvec::SmallVec;

fn process_args(args: &[Frame]) {
    let parsed: SmallVec<[&str; 4]> = args.iter()
        .filter_map(|f| f.as_str())
        .collect();
}

// DO: Preallocate when size is known
fn build_response(count: usize) -> Vec<Frame> {
    let mut result = Vec::with_capacity(count);
    // ...
    result
}
```

### Concurrency

```rust
// DO: Use DashMap for concurrent access
use dashmap::DashMap;

let map: DashMap<String, Value> = DashMap::new();

// DO: Use crossbeam-epoch for lock-free reads
use crossbeam_epoch::{self as epoch, Atomic, Owned};

// DO: Minimize lock scope
{
    let guard = lock.read();
    let value = guard.get(&key).cloned();
}  // Lock released here
process(value);

// DON'T: Hold locks during I/O
{
    let guard = lock.write();
    network_call().await;  // BAD: Holding lock during await!
}
```

### Benchmarking

```rust
// benches/my_benchmark.rs
use criterion::{criterion_group, criterion_main, Criterion, BenchmarkId};

fn benchmark_my_feature(c: &mut Criterion) {
    let mut group = c.benchmark_group("my_feature");

    for size in [100, 1000, 10000] {
        group.bench_with_input(
            BenchmarkId::from_parameter(size),
            &size,
            |b, &size| {
                b.iter(|| {
                    // Code to benchmark
                });
            },
        );
    }

    group.finish();
}

criterion_group!(benches, benchmark_my_feature);
criterion_main!(benches);
```

---

## Documentation Guidelines

### Module Documentation

```rust
//! # Module Name
//!
//! Brief description of what this module does.
//!
//! ## Overview
//!
//! More detailed explanation of the module's purpose and design.
//!
//! ## Example
//!
//! ```rust
//! use ferrite::mymodule::MyType;
//!
//! let instance = MyType::new();
//! instance.do_something()?;
//! ```
//!
//! ## Features
//!
//! - Feature 1
//! - Feature 2
```

### Function Documentation

```rust
/// Brief one-line description.
///
/// More detailed explanation if needed. Explain what the function does,
/// not how it does it (that's what the code is for).
///
/// # Arguments
///
/// * `key` - The key to look up
/// * `default` - Value to return if key not found
///
/// # Returns
///
/// The value associated with the key, or the default.
///
/// # Errors
///
/// Returns `FerriteError::InvalidKey` if the key is empty.
///
/// # Panics
///
/// Panics if the internal lock is poisoned.
///
/// # Example
///
/// ```rust
/// let value = get_or_default("mykey", "default")?;
/// ```
pub fn get_or_default(key: &str, default: &str) -> Result<String> {
    // ...
}
```

### Unsafe Documentation

```rust
/// # Safety
///
/// This function is unsafe because:
/// - Caller must ensure `ptr` is valid and aligned
/// - The pointed-to memory must be initialized
/// - No other reference to this memory may exist
///
/// The caller must uphold these invariants to avoid undefined behavior.
pub unsafe fn read_raw(ptr: *const u8, len: usize) -> &[u8] {
    // SAFETY: Caller guarantees ptr is valid and aligned,
    // memory is initialized, and no aliasing occurs.
    std::slice::from_raw_parts(ptr, len)
}
```

---

## Pull Request Process

### Before Submitting

1. **Create an issue first** for significant changes
2. **Fork and branch** from `main`
3. **Write tests** for new functionality
4. **Run all checks**:
   ```bash
   cargo fmt --check
   cargo clippy -- -D warnings
   cargo test
   ```
5. **Update documentation** if needed
6. **Add ADR** for architectural changes

### Commit Messages

Follow conventional commits:

```
feat(vector): add HNSW index support

Add Hierarchical Navigable Small World index for vector similarity search.
This provides O(log n) search time with ~98% recall.

- Implement HNSW construction algorithm
- Add distance metrics (cosine, euclidean, dot)
- Add VECTOR.CREATE and VECTOR.SEARCH commands

Closes #123
```

Prefixes:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation
- `refactor`: Code restructuring
- `perf`: Performance improvement
- `test`: Test changes
- `chore`: Build/tooling changes

### PR Description Template

```markdown
## Summary
Brief description of the changes.

## Motivation
Why is this change needed?

## Changes
- Change 1
- Change 2
- Change 3

## Testing
How was this tested?

## Checklist
- [ ] Tests added/updated
- [ ] Documentation updated
- [ ] Changelog entry added
- [ ] No breaking changes (or documented)
```

### Review Process

1. CI checks must pass
2. At least one approval required
3. Address all review comments
4. Squash commits if requested
5. Maintainer merges after approval

---

## Getting Help

- **GitHub Issues**: Bug reports and feature requests
- **GitHub Discussions**: Questions and design discussions
- **Discord**: Real-time chat (link in README)

---

## Further Reading

- [ARCHITECTURE.md](ARCHITECTURE.md) - Technical deep-dive
- [docs/adr/](adr/) - Architecture Decision Records
- [CONTRIBUTING.md](../CONTRIBUTING.md) - Contribution guidelines
- [Rust API Guidelines](https://rust-lang.github.io/api-guidelines/)
