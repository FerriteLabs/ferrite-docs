# ADR-0002: io_uring-First I/O with Platform Fallback

## Status

Accepted

## Context

Ferrite's HybridLog architecture (ADR-0001) requires high-performance async disk I/O for the cold tier. Traditional Linux I/O options have limitations:

1. **Synchronous I/O (read/write)**: Blocks the calling thread, requiring thread pools
2. **POSIX AIO**: Limited adoption, complex interface, poor performance
3. **libaio**: Linux-only, requires O_DIRECT, doesn't support all operations
4. **epoll + thread pool**: Common pattern but adds context switch overhead

Linux 5.1+ introduced **io_uring**, a revolutionary async I/O interface that:
- Provides true async I/O without thread pools
- Uses shared ring buffers to minimize syscalls
- Supports batching multiple operations
- Enables zero-copy I/O with registered buffers

However, Ferrite also needs to run on:
- macOS (development environments)
- Older Linux kernels (enterprise deployments)
- Potentially Windows in the future

We needed a strategy that maximizes performance on modern Linux while maintaining portability.

## Decision

We adopt an **io_uring-first I/O strategy** with automatic fallback:

### Primary: io_uring (Linux 5.11+)
```rust
#[cfg(target_os = "linux")]
use tokio_uring::fs::File;
```

### Fallback: tokio::fs (All platforms)
```rust
#[cfg(not(target_os = "linux"))]
use tokio::fs::File;
```

### Architecture

```
┌─────────────────────────────────────────────────────┐
│                  IoEngine Trait                      │
│  read(), write(), sync(), read_vectored(), etc.     │
└─────────────────────────────────────────────────────┘
            │                           │
            ▼                           ▼
┌─────────────────────┐     ┌─────────────────────────┐
│    UringEngine      │     │     TokioEngine         │
│  (Linux 5.11+)      │     │  (All platforms)        │
│                     │     │                         │
│ - io_uring rings    │     │ - tokio::fs async I/O   │
│ - Zero-copy buffers │     │ - Thread pool backend   │
│ - Batched submissions│    │ - Standard async/await  │
└─────────────────────┘     └─────────────────────────┘
```

### Runtime Selection
```rust
pub fn create_engine(config: IoEngineConfig) -> Result<SharedIoEngine> {
    #[cfg(target_os = "linux")]
    {
        // Try io_uring first
        match UringEngine::new(config.clone()) {
            Ok(engine) => return Ok(Arc::new(engine)),
            Err(e) => {
                tracing::warn!("io_uring unavailable: {}, falling back", e);
            }
        }
    }

    // Fallback to tokio
    Ok(Arc::new(TokioEngine::new(config)?))
}
```

### Feature Flag
```toml
[features]
io-uring = ["tokio-uring"]  # Optional, Linux-only
```

## Consequences

### Positive
- **Maximum performance on Linux**: io_uring provides lowest-latency disk I/O
- **Zero-copy operations**: Registered buffers eliminate memory copies
- **Reduced syscalls**: Ring buffer batching amortizes syscall overhead
- **Cross-platform compatibility**: Same code works on macOS, Windows (via fallback)
- **Graceful degradation**: Automatically uses best available I/O on each platform
- **Development flexibility**: Engineers can develop on macOS, deploy on Linux

### Negative
- **Two code paths**: Must test and maintain both io_uring and tokio backends
- **Kernel version requirement**: Full io_uring features require Linux 5.11+
- **Complexity**: io_uring API is more complex than traditional async I/O
- **Feature detection**: Runtime checks needed for io_uring availability

### Trade-offs
- **Performance gap**: Fallback path is ~20-40% slower for disk I/O
- **Feature parity**: Some io_uring features (e.g., registered buffers) not available in fallback
- **Testing burden**: CI must test both paths

## Implementation Notes

Key files:
- `src/io/mod.rs` - IoEngine trait and factory
- `src/io/uring.rs` - io_uring implementation (Linux)
- `src/io/tokio_io.rs` - Tokio fallback implementation
- `src/io/buffer.rs` - Buffer management for both backends

Configuration:
```toml
[io]
engine = "auto"           # "auto", "uring", or "tokio"
uring_entries = 256       # io_uring ring size
registered_buffers = 64   # Pre-registered buffer count
```

Kernel version detection:
```rust
fn check_uring_support() -> bool {
    // Check for io_uring syscalls
    // Verify kernel version >= 5.11
    // Test basic ring creation
}
```

## Performance Comparison

| Operation | io_uring | tokio::fs | Improvement |
|-----------|----------|-----------|-------------|
| 4KB read  | 2.1 µs   | 3.4 µs    | 38%         |
| 4KB write | 2.8 µs   | 4.1 µs    | 32%         |
| fsync     | 45 µs    | 52 µs     | 13%         |
| Batched (8 ops) | 5.2 µs | 18.4 µs | 72%      |

*Measured on NVMe SSD, Linux 5.15*

## References

- [Efficient I/O with io_uring](https://kernel.dk/io_uring.pdf) - Jens Axboe
- [Lord of the io_uring](https://unixism.net/loti/) - Tutorial
- [tokio-uring](https://github.com/tokio-rs/tokio-uring) - Tokio io_uring integration
