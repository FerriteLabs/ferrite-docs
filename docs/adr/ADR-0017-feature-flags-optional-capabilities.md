# ADR-0017: Feature Flags for Optional Capabilities

## Status

Accepted

## Context

Ferrite includes advanced capabilities beyond core Redis functionality:

- **Vector search**: HNSW/IVF indexes for similarity search
- **WASM runtime**: User-defined functions in WebAssembly
- **ONNX inference**: ML model serving
- **io_uring**: Linux kernel I/O optimization
- **OpenTelemetry**: Distributed tracing
- **TUI dashboard**: Terminal-based monitoring

Including all capabilities in every build has downsides:

1. **Binary size**: Full build is 45MB+ vs 12MB core
2. **Compile time**: All dependencies built even if unused
3. **Attack surface**: More code = more potential vulnerabilities
4. **Dependencies**: Some features require system libraries (ONNX needs libc++, WASM needs wasmtime)
5. **Platform support**: io_uring is Linux-only, some features need specific OS versions

Different deployment scenarios have different needs:

| Deployment | Needs | Doesn't Need |
|------------|-------|--------------|
| Cache server | Core KV, persistence | Vector, WASM, ONNX |
| ML serving | Core KV, Vector, ONNX | WASM, cluster |
| Edge device | Core KV, embedded | Cluster, TUI, OTel |
| Enterprise | Everything | (full features) |

## Decision

We use **Cargo feature flags** to enable optional capabilities at compile time:

### Feature Definition

```toml
# Cargo.toml

[features]
default = ["server"]

# Execution modes
server = ["tokio/net", "tokio/signal"]
embedded = []

# I/O optimizations
io-uring = ["tokio-uring"]

# Advanced data features
vector = ["hnsw", "quantization"]
wasm = ["wasmtime"]
onnx = ["ort"]

# Observability
otel = ["opentelemetry", "opentelemetry-otlp", "tracing-opentelemetry"]
tui = ["ratatui", "crossterm"]

# Convenience bundles
full = ["server", "embedded", "io-uring", "vector", "wasm", "onnx", "otel", "tui"]
minimal = []  # Just core library

[dependencies]
# Always included
tokio = { version = "1", features = ["rt-multi-thread", "macros", "time", "sync"] }
bytes = "1"
dashmap = "5"
serde = { version = "1", features = ["derive"] }
tracing = "0.1"

# Optional: io_uring (Linux only)
[target.'cfg(target_os = "linux")'.dependencies]
tokio-uring = { version = "0.5", optional = true }

# Optional: Vector search
hnsw = { version = "0.11", optional = true }
quantization = { version = "0.2", optional = true }

# Optional: WASM runtime
wasmtime = { version = "18", optional = true }

# Optional: ONNX inference
ort = { version = "2", optional = true }

# Optional: OpenTelemetry
opentelemetry = { version = "0.22", optional = true }
opentelemetry-otlp = { version = "0.15", optional = true }
tracing-opentelemetry = { version = "0.23", optional = true }

# Optional: TUI
ratatui = { version = "0.26", optional = true }
crossterm = { version = "0.27", optional = true }
```

### Conditional Compilation

**Module-level gating:**
```rust
// src/lib.rs

pub mod storage;
pub mod protocol;
pub mod commands;
pub mod server;
pub mod persistence;

#[cfg(feature = "vector")]
pub mod vector;

#[cfg(feature = "wasm")]
pub mod wasm;

#[cfg(feature = "onnx")]
pub mod onnx;

#[cfg(feature = "otel")]
pub mod observability;
```

**Command handler gating:**
```rust
// src/commands/dispatcher.rs

pub async fn dispatch(ctx: &Context, cmd: &str, args: &[Bytes]) -> Frame {
    match cmd {
        // Core commands always available
        "GET" => handlers::strings::get(ctx, args).await,
        "SET" => handlers::strings::set(ctx, args).await,

        // Vector commands only if feature enabled
        #[cfg(feature = "vector")]
        "FT.CREATE" => handlers::vector::create_index(ctx, args).await,
        #[cfg(feature = "vector")]
        "FT.SEARCH" => handlers::vector::search(ctx, args).await,

        // WASM commands only if feature enabled
        #[cfg(feature = "wasm")]
        "WASM.LOAD" => handlers::wasm::load(ctx, args).await,
        #[cfg(feature = "wasm")]
        "WASM.CALL" => handlers::wasm::call(ctx, args).await,

        // Unknown or disabled command
        _ => Frame::error(format!("ERR unknown command '{}'", cmd)),
    }
}
```

**Platform-specific code:**
```rust
// src/io/mod.rs

#[cfg(all(target_os = "linux", feature = "io-uring"))]
mod uring;

#[cfg(not(all(target_os = "linux", feature = "io-uring")))]
mod fallback;

pub fn create_io_engine() -> Box<dyn IoEngine> {
    #[cfg(all(target_os = "linux", feature = "io-uring"))]
    {
        match uring::UringEngine::new() {
            Ok(engine) => return Box::new(engine),
            Err(e) => tracing::warn!("io_uring unavailable: {}, using fallback", e),
        }
    }

    Box::new(fallback::TokioEngine::new())
}
```

### Build Profiles

```toml
# Cargo.toml

[profile.release]
lto = "thin"
codegen-units = 1
panic = "abort"

[profile.release-small]
inherits = "release"
opt-level = "z"      # Optimize for size
strip = true

[profile.release-fast]
inherits = "release"
opt-level = 3        # Maximum optimization
```

### Build Commands

```bash
# Minimal build (core only)
cargo build --release --no-default-features

# Standard server build
cargo build --release

# Full-featured build
cargo build --release --features full

# ML-optimized build
cargo build --release --features "server,vector,onnx"

# Edge/embedded build
cargo build --release --no-default-features --features embedded

# Linux with io_uring
cargo build --release --features io-uring
```

### Binary Size Impact

| Configuration | Binary Size | Features |
|---------------|-------------|----------|
| `--no-default-features` | 8MB | Core library only |
| `default` | 12MB | Server mode |
| `default + io-uring` | 13MB | + Linux I/O optimization |
| `default + vector` | 18MB | + Vector search |
| `default + wasm` | 25MB | + WASM runtime |
| `default + onnx` | 32MB | + ML inference |
| `full` | 48MB | Everything |

## Consequences

### Positive

- **Smaller binaries**: Only include what you need
- **Faster builds**: Skip unused dependencies
- **Reduced attack surface**: Less code = fewer vulnerabilities
- **Platform flexibility**: io_uring on Linux, fallback elsewhere
- **Clear capability boundaries**: Features are explicit, not implicit
- **Easier auditing**: Know exactly what's in your build

### Negative

- **Build complexity**: Multiple build configurations to test
- **Documentation burden**: Must document feature combinations
- **CI matrix expansion**: Test each feature combination
- **User confusion**: "Why doesn't FT.SEARCH work?" (feature not enabled)
- **Dependency management**: Features can have conflicting deps

### Trade-offs

- **Granularity vs simplicity**: More flags = more control but more complexity
- **Default features**: What's included by default affects most users
- **Feature interactions**: Some features may conflict or require others

## Implementation Notes

Key patterns:

**Feature detection at runtime:**
```rust
pub fn list_enabled_features() -> Vec<&'static str> {
    let mut features = vec!["core"];

    #[cfg(feature = "vector")]
    features.push("vector");

    #[cfg(feature = "wasm")]
    features.push("wasm");

    #[cfg(feature = "onnx")]
    features.push("onnx");

    #[cfg(feature = "otel")]
    features.push("otel");

    features
}

// Exposed via INFO command
// INFO features
// # Features
// enabled:core,vector,wasm
```

**Graceful degradation:**
```rust
impl Server {
    pub fn new(config: Config) -> Self {
        let otel_tracer = {
            #[cfg(feature = "otel")]
            {
                Some(init_opentelemetry(&config.otel))
            }
            #[cfg(not(feature = "otel"))]
            {
                None
            }
        };

        Self {
            storage: create_storage(&config.storage),
            otel_tracer,
            // ...
        }
    }
}
```

**Compile-time feature validation:**
```rust
// Ensure incompatible features aren't both enabled
#[cfg(all(feature = "embedded-only", feature = "server"))]
compile_error!("Cannot enable both 'embedded-only' and 'server' features");

// Ensure required feature combinations
#[cfg(all(feature = "cluster", not(feature = "server")))]
compile_error!("Feature 'cluster' requires 'server' feature");
```

CI testing matrix:
```yaml
# .github/workflows/ci.yml
jobs:
  test:
    strategy:
      matrix:
        features:
          - ""  # default
          - "--no-default-features"
          - "--features full"
          - "--features 'server,vector'"
          - "--features 'server,wasm'"
    steps:
      - run: cargo test ${{ matrix.features }}
```

## References

- [Cargo Features Documentation](https://doc.rust-lang.org/cargo/reference/features.html)
- [Rust Conditional Compilation](https://doc.rust-lang.org/reference/conditional-compilation.html)
- [Feature Flags Best Practices](https://www.lurklurk.org/effective-rust/features.html)
- [Tokio Feature Flags](https://docs.rs/tokio/latest/tokio/#feature-flags)
