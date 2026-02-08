# ADR-0004: Tokio Async Runtime with Connection-Per-Task Model

## Status

Accepted

## Context

Ferrite must handle thousands of concurrent client connections efficiently. The connection handling model significantly impacts:
- Maximum concurrent connections
- Latency under load
- Resource utilization (CPU, memory)
- Code complexity

Traditional approaches:

1. **Thread-per-connection**: Simple but doesn't scale (10K connections = 10K threads)
2. **Thread pool with blocking I/O**: Better scaling but still limited
3. **Event loop (epoll/kqueue)**: Efficient but complex callback-based code
4. **Async/await**: Modern, efficient, readable code

For Rust async runtimes:
- **Tokio**: Most mature, largest ecosystem, production-proven
- **async-std**: Simpler API, smaller ecosystem
- **smol**: Minimal, good for embedded
- **glommio**: Thread-per-core, io_uring native (Linux only)

## Decision

We adopt **Tokio as the async runtime** with a **connection-per-task model**:

### Runtime Configuration
```rust
#[tokio::main]
async fn main() {
    // Multi-threaded runtime, work-stealing scheduler
    let runtime = tokio::runtime::Builder::new_multi_thread()
        .worker_threads(num_cpus::get())
        .enable_all()
        .build()?;
}
```

### Connection Handling Model
```rust
async fn accept_connections(listener: TcpListener) {
    loop {
        let (socket, addr) = listener.accept().await?;

        // Spawn a new task for each connection
        tokio::spawn(async move {
            handle_connection(socket, addr).await
        });
    }
}

async fn handle_connection(socket: TcpStream, addr: SocketAddr) {
    let mut parser = RespParser::new();
    let mut writer = BufWriter::new(socket);

    loop {
        // Read command
        let frame = parser.read_frame(&mut reader).await?;

        // Execute command
        let response = execute_command(frame).await?;

        // Write response
        response.write_to(&mut writer).await?;
    }
}
```

### Task Model
```
┌─────────────────────────────────────────────────────────┐
│                    Tokio Runtime                         │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐        │
│  │  Worker 1   │ │  Worker 2   │ │  Worker N   │        │
│  │             │ │             │ │             │        │
│  │ ┌─────────┐ │ │ ┌─────────┐ │ │ ┌─────────┐ │        │
│  │ │ Task A  │ │ │ │ Task D  │ │ │ │ Task G  │ │        │
│  │ │ (conn1) │ │ │ │ (conn4) │ │ │ │ (conn7) │ │        │
│  │ └─────────┘ │ │ └─────────┘ │ │ └─────────┘ │        │
│  │ ┌─────────┐ │ │ ┌─────────┐ │ │ ┌─────────┐ │        │
│  │ │ Task B  │ │ │ │ Task E  │ │ │ │ Task H  │ │        │
│  │ │ (conn2) │ │ │ │ (conn5) │ │ │ │ (conn8) │ │        │
│  │ └─────────┘ │ │ └─────────┘ │ │ └─────────┘ │        │
│  │     ...     │ │     ...     │ │     ...     │        │
│  └─────────────┘ └─────────────┘ └─────────────┘        │
│                                                          │
│  Work-stealing scheduler balances tasks across workers   │
└─────────────────────────────────────────────────────────┘
```

### Key Tokio Features Used
- `tokio::net` - Async TCP/TLS networking
- `tokio::sync` - Channels, mutexes, semaphores
- `tokio::time` - Timers, timeouts, intervals
- `tokio::fs` - Async file I/O (fallback when io_uring unavailable)
- `tokio::signal` - Graceful shutdown handling

## Consequences

### Positive
- **High concurrency**: Millions of tasks on a single machine
- **Efficient resources**: Tasks are lightweight (~1KB vs ~8MB for threads)
- **Work stealing**: Automatic load balancing across CPU cores
- **Ecosystem**: Vast library ecosystem (hyper, tonic, tower, etc.)
- **Readable code**: async/await syntax is cleaner than callbacks
- **Mature**: Battle-tested in production at Discord, Cloudflare, AWS

### Negative
- **Learning curve**: Async Rust has complexity (Pin, lifetimes, Send/Sync)
- **Debugging**: Stack traces less clear than synchronous code
- **Blocking danger**: Blocking in async context starves other tasks
- **Colored functions**: Async functions can't be called from sync context easily

### Trade-offs
- **Per-connection tasks vs batching**: Simpler code, slightly more overhead
- **Multi-threaded vs thread-per-core**: More flexible, slightly less cache-local
- **Work-stealing overhead**: Small cost for better load distribution

## Implementation Notes

Key files:
- `src/server/listener.rs` - TCP listener and accept loop
- `src/server/connection.rs` - Connection state management
- `src/server/handler.rs` - Request/response handling

Cargo dependencies:
```toml
[dependencies]
tokio = { version = "1", features = ["full"] }
```

Graceful shutdown:
```rust
async fn run_server() {
    let listener = TcpListener::bind(addr).await?;

    loop {
        tokio::select! {
            result = listener.accept() => {
                let (socket, addr) = result?;
                tokio::spawn(handle_connection(socket, addr));
            }
            _ = shutdown_signal() => {
                info!("Shutting down gracefully");
                break;
            }
        }
    }
}
```

Connection limits:
```rust
// Limit concurrent connections
let semaphore = Arc::new(Semaphore::new(config.max_connections));

loop {
    let permit = semaphore.clone().acquire_owned().await?;
    let (socket, addr) = listener.accept().await?;

    tokio::spawn(async move {
        handle_connection(socket, addr).await;
        drop(permit); // Release on disconnect
    });
}
```

## Performance Characteristics

| Metric | Value | Notes |
|--------|-------|-------|
| Task spawn | ~300ns | Very lightweight |
| Context switch | ~50ns | Cooperative, not preemptive |
| Memory per task | ~1-2KB | Depends on future size |
| Max connections | 100K+ | Limited by file descriptors |

## References

- [Tokio Tutorial](https://tokio.rs/tokio/tutorial)
- [Async Rust Book](https://rust-lang.github.io/async-book/)
- [Tokio Internals](https://tokio.rs/blog/2019-10-scheduler)
