# ADR-0013: Rust as Implementation Language

## Status

Accepted

## Context

Ferrite aims to be a high-performance Redis replacement with specific requirements:

- **Sub-millisecond latency**: P99.9 latency targets under 2ms
- **Predictable performance**: No garbage collection pauses
- **Memory efficiency**: Minimal overhead beyond actual data size
- **Safety**: Memory safety without runtime overhead
- **Concurrency**: Lock-free data structures and async I/O
- **Cross-platform**: Support Linux, macOS, and potentially Windows

Language options considered:

1. **C/C++**
   - Maximum performance potential
   - Manual memory management (error-prone)
   - No built-in concurrency safety
   - Mature ecosystem but fragmented (build systems, package managers)

2. **Go**
   - Excellent concurrency primitives (goroutines)
   - Garbage collection causes latency spikes
   - Runtime overhead (~10-20MB baseline)
   - Limited low-level control

3. **Java/Kotlin (JVM)**
   - Mature ecosystem, great tooling
   - GC pauses problematic for latency targets
   - JIT warmup time
   - High memory overhead

4. **Zig**
   - Modern C alternative, no hidden allocations
   - Small ecosystem, limited async story
   - Not yet stable (pre-1.0)

5. **Rust**
   - Zero-cost abstractions
   - Memory safety at compile time (no GC)
   - Fearless concurrency
   - Excellent async ecosystem (Tokio)
   - Growing but substantial ecosystem

## Decision

We implement Ferrite in **Rust**, leveraging its unique combination of safety, performance, and modern tooling.

### Core Language Benefits

**Memory Safety Without GC**
```rust
// Ownership prevents use-after-free at compile time
fn process_data(data: Vec<u8>) {
    // `data` is moved here, original owner can't use it
    do_something(data);
    // data is automatically dropped when function ends
}

// Borrowing prevents data races
fn read_data(data: &[u8]) {
    // Immutable borrow: safe to read, can't modify
}
```

**Zero-Cost Abstractions**
```rust
// Iterator chains compile to efficient loops
let sum: i64 = values
    .iter()
    .filter(|v| v.is_valid())
    .map(|v| v.as_i64())
    .sum();

// Generics are monomorphized (no runtime dispatch)
fn get<T: FromBytes>(storage: &Storage, key: &[u8]) -> Option<T> {
    storage.get(key).and_then(|bytes| T::from_bytes(&bytes))
}
```

**Fearless Concurrency**
```rust
// Compiler enforces thread safety
use std::sync::Arc;
use dashmap::DashMap;

// This compiles: DashMap is Send + Sync
let shared_map: Arc<DashMap<K, V>> = Arc::new(DashMap::new());

// This won't compile: Rc is not Send
// let shared_bad: Arc<Rc<Data>> = Arc::new(Rc::new(data));
// error: `Rc<Data>` cannot be sent between threads safely
```

**Modern Async Support**
```rust
// Async/await syntax with Tokio runtime
async fn handle_connection(stream: TcpStream) -> Result<()> {
    let mut buf = BytesMut::with_capacity(4096);

    loop {
        let frame = read_frame(&mut stream, &mut buf).await?;
        let response = process_command(frame).await?;
        write_response(&mut stream, response).await?;
    }
}
```

### Ecosystem Leverage

| Need | Rust Crate | Benefit |
|------|------------|---------|
| Async runtime | `tokio` | Battle-tested, full-featured |
| Concurrent map | `dashmap` | Lock-free reads, sharded writes |
| Epoch reclamation | `crossbeam-epoch` | Safe memory reclamation |
| Memory mapping | `memmap2` | Zero-copy file access |
| io_uring | `tokio-uring` | Linux kernel I/O batching |
| Serialization | `serde` | Zero-copy deserialization |
| HTTP server | `hyper` | Metrics endpoint |
| CLI parsing | `clap` | Derive-based argument parsing |
| Error handling | `thiserror` | Ergonomic error definitions |

### Type System Benefits

**Compile-Time Protocol Correctness**
```rust
// RESP frame types are enumerated
pub enum Frame {
    Simple(String),
    Error(String),
    Integer(i64),
    Bulk(Option<Bytes>),
    Array(Vec<Frame>),
}

// Commands are typed, not stringly-typed
pub enum Command {
    Get { key: Bytes },
    Set { key: Bytes, value: Bytes, options: SetOptions },
    MGet { keys: Vec<Bytes> },
    // ... exhaustive matching ensures all commands handled
}
```

**Newtype Patterns for Safety**
```rust
// Can't accidentally mix up key and value
pub struct Key(Bytes);
pub struct Value(Bytes);

fn set(key: Key, value: Value) { /* ... */ }

// This won't compile:
// set(value, key);  // error: expected Key, found Value
```

## Consequences

### Positive

- **Predictable latency**: No GC pauses; P99.9 targets achievable
- **Memory efficiency**: ~5-10% overhead vs raw data (no object headers)
- **Safety guarantees**: Memory bugs caught at compile time
- **Concurrency safety**: Data races impossible by construction
- **Single binary**: No runtime dependencies to deploy
- **Cross-compilation**: Build for Linux from macOS/Windows
- **Performance parity with C**: Within 5% on benchmarks
- **Growing talent pool**: Rust adoption accelerating

### Negative

- **Learning curve**: Ownership/borrowing concepts take time
- **Compile times**: Large projects can be slow to build
- **Ecosystem gaps**: Some libraries less mature than Go/Java equivalents
- **Unsafe escape hatch**: Can still write unsafe code when needed
- **Async complexity**: Pin, lifetimes in async contexts challenging

### Trade-offs

- **Development velocity**: Slower initial development, fewer runtime bugs
- **Talent availability**: Smaller pool than Go/Java, but growing rapidly
- **Library maturity**: Some areas (e.g., ONNX) less developed

## Implementation Notes

Rust version requirements:
- Minimum Supported Rust Version (MSRV): 1.88.0
- Edition: 2021
- Key features: async traits, let-else, generic associated types

Cargo configuration:
```toml
[profile.release]
lto = "thin"           # Link-time optimization
codegen-units = 1      # Better optimization
panic = "abort"        # Smaller binary
strip = true           # Remove debug symbols

[profile.release-debug]
inherits = "release"
debug = true           # For profiling
```

Key dependencies in Cargo.toml:
```toml
[dependencies]
tokio = { version = "1", features = ["full"] }
bytes = "1"
dashmap = "5"
crossbeam-epoch = "0.9"
serde = { version = "1", features = ["derive"] }
thiserror = "1"
tracing = "0.1"
```

## Performance Characteristics

Baseline measurements (8-core AMD Ryzen, 32GB RAM):

| Metric | Ferrite (Rust) | Redis (C) | Dragonfly (C++) |
|--------|----------------|-----------|-----------------|
| GET ops/sec | 580K/core | 550K/core | 600K/core |
| SET ops/sec | 420K/core | 400K/core | 450K/core |
| P99 latency | 0.8ms | 0.9ms | 0.7ms |
| Memory per 1M keys | 85MB | 90MB | 82MB |
| Binary size | 12MB | 3MB | 45MB |

## References

- [Rust Performance Book](https://nnethercote.github.io/perf-book/)
- [Rust Async Book](https://rust-lang.github.io/async-book/)
- [Why Discord Switched from Go to Rust](https://discord.com/blog/why-discord-is-switching-from-go-to-rust)
- [Rust in Production at AWS](https://aws.amazon.com/blogs/opensource/why-aws-loves-rust-and-how-wed-like-to-help/)
- [Microsoft and Rust](https://msrc-blog.microsoft.com/2019/07/22/why-rust-for-safe-systems-programming/)
