# ADR-0018: Production Observability Stack

## Status

Accepted

## Context

Operating Ferrite in production requires visibility into:

- **Performance**: Latency distributions, throughput, resource usage
- **Health**: Connection counts, memory pressure, replication lag
- **Debugging**: Request tracing, slow queries, error rates
- **Capacity**: Storage utilization, growth trends, hot keys

Without built-in observability, operators must:
- Add external monitoring agents
- Parse logs manually for metrics
- Guess at performance bottlenecks
- Lack visibility into distributed request flows

Redis provides `INFO`, `SLOWLOG`, and `MONITOR` commands, but these have limitations:
- `INFO` is text-based, hard to parse
- `SLOWLOG` loses data on restart
- `MONITOR` impacts performance significantly
- No standard metrics format for Prometheus/Grafana

Modern infrastructure expects:
- Prometheus-format metrics endpoint
- Structured JSON logging
- Distributed tracing (OpenTelemetry)
- Rich introspection commands

## Decision

Ferrite includes a **comprehensive observability stack** built on industry-standard tools:

### 1. Structured Logging (tracing)

```rust
// src/server/handler.rs
use tracing::{info, warn, error, instrument, Span};

#[instrument(skip(ctx, args), fields(key = %args.get(0).map(|b| String::from_utf8_lossy(b)).unwrap_or_default()))]
pub async fn handle_get(ctx: &Context, args: &[Bytes]) -> Frame {
    let key = args.first().ok_or(Error::WrongArity)?;

    match ctx.storage.get(key).await {
        Ok(Some(value)) => {
            info!(size = value.len(), "key found");
            Frame::Bulk(Some(value))
        }
        Ok(None) => {
            info!("key not found");
            Frame::Null
        }
        Err(e) => {
            error!(error = %e, "storage error");
            Frame::error(e.to_string())
        }
    }
}
```

Log output (JSON format):
```json
{
  "timestamp": "2024-01-15T10:30:45.123Z",
  "level": "INFO",
  "target": "ferrite::server::handler",
  "span": { "name": "handle_get", "key": "user:123" },
  "fields": { "size": 256 },
  "message": "key found"
}
```

### 2. Prometheus Metrics

```rust
// src/metrics/mod.rs
use metrics::{counter, gauge, histogram};

pub fn init_metrics() {
    // Counters
    describe_counter!("ferrite_commands_total", "Total commands processed");
    describe_counter!("ferrite_connections_total", "Total connections accepted");
    describe_counter!("ferrite_bytes_received_total", "Total bytes received");
    describe_counter!("ferrite_bytes_sent_total", "Total bytes sent");

    // Gauges
    describe_gauge!("ferrite_connected_clients", "Current connected clients");
    describe_gauge!("ferrite_memory_used_bytes", "Memory used by data");
    describe_gauge!("ferrite_keys_total", "Total keys in database");

    // Histograms
    describe_histogram!("ferrite_command_duration_seconds", "Command execution time");
    describe_histogram!("ferrite_request_size_bytes", "Request size distribution");
    describe_histogram!("ferrite_response_size_bytes", "Response size distribution");
}

// Usage in handlers
pub async fn handle_command(ctx: &Context, cmd: Command) -> Frame {
    let start = Instant::now();

    counter!("ferrite_commands_total", "command" => cmd.name()).increment(1);

    let result = dispatch_command(ctx, cmd).await;

    histogram!("ferrite_command_duration_seconds", "command" => cmd.name())
        .record(start.elapsed().as_secs_f64());

    result
}
```

Metrics endpoint (`/metrics`):
```prometheus
# HELP ferrite_commands_total Total commands processed
# TYPE ferrite_commands_total counter
ferrite_commands_total{command="GET"} 1234567
ferrite_commands_total{command="SET"} 456789

# HELP ferrite_command_duration_seconds Command execution time
# TYPE ferrite_command_duration_seconds histogram
ferrite_command_duration_seconds_bucket{command="GET",le="0.0001"} 1000000
ferrite_command_duration_seconds_bucket{command="GET",le="0.0005"} 1200000
ferrite_command_duration_seconds_bucket{command="GET",le="0.001"} 1230000
ferrite_command_duration_seconds_bucket{command="GET",le="+Inf"} 1234567
ferrite_command_duration_seconds_sum{command="GET"} 123.456
ferrite_command_duration_seconds_count{command="GET"} 1234567

# HELP ferrite_connected_clients Current connected clients
# TYPE ferrite_connected_clients gauge
ferrite_connected_clients 42

# HELP ferrite_memory_used_bytes Memory used by data
# TYPE ferrite_memory_used_bytes gauge
ferrite_memory_used_bytes 1073741824
```

### 3. OpenTelemetry Integration (Optional)

```rust
// src/observability/otel.rs
#[cfg(feature = "otel")]
use opentelemetry::{trace::Tracer, global};
use tracing_opentelemetry::OpenTelemetryLayer;

#[cfg(feature = "otel")]
pub fn init_opentelemetry(config: &OtelConfig) -> Result<()> {
    let tracer = opentelemetry_otlp::new_pipeline()
        .tracing()
        .with_exporter(
            opentelemetry_otlp::new_exporter()
                .tonic()
                .with_endpoint(&config.endpoint),
        )
        .with_trace_config(
            opentelemetry::sdk::trace::config()
                .with_sampler(Sampler::TraceIdRatioBased(config.sample_rate))
                .with_resource(Resource::new(vec![
                    KeyValue::new("service.name", "ferrite"),
                    KeyValue::new("service.version", env!("CARGO_PKG_VERSION")),
                ])),
        )
        .install_batch(opentelemetry::runtime::Tokio)?;

    // Connect tracing to OpenTelemetry
    let otel_layer = OpenTelemetryLayer::new(tracer);

    tracing_subscriber::registry()
        .with(otel_layer)
        .with(EnvFilter::from_default_env())
        .init();

    Ok(())
}
```

Distributed trace example:
```
Trace ID: abc123def456

├─ ferrite::server::handle_connection (2.5ms)
│  ├─ ferrite::protocol::parse_frame (0.1ms)
│  ├─ ferrite::commands::dispatch (2.0ms)
│  │  ├─ ferrite::commands::strings::get (0.8ms)
│  │  │  └─ ferrite::storage::hybridlog::get (0.5ms)
│  │  └─ ferrite::commands::strings::set (1.0ms)
│  │     └─ ferrite::storage::hybridlog::set (0.7ms)
│  └─ ferrite::protocol::encode_frame (0.2ms)
```

### 4. Slow Query Log

```rust
// src/server/slowlog.rs

pub struct SlowLog {
    entries: VecDeque<SlowLogEntry>,
    max_entries: usize,
    threshold: Duration,
}

pub struct SlowLogEntry {
    pub id: u64,
    pub timestamp: SystemTime,
    pub duration: Duration,
    pub command: String,
    pub args: Vec<String>,
    pub client_addr: SocketAddr,
    pub client_name: Option<String>,
}

impl SlowLog {
    pub fn record(&mut self, entry: SlowLogEntry) {
        if entry.duration >= self.threshold {
            if self.entries.len() >= self.max_entries {
                self.entries.pop_front();
            }
            self.entries.push_back(entry);

            // Also emit as structured log
            warn!(
                duration_ms = entry.duration.as_millis(),
                command = %entry.command,
                client = %entry.client_addr,
                "slow query"
            );
        }
    }
}
```

SLOWLOG command output:
```
> SLOWLOG GET 2
1) 1) (integer) 14
   2) (integer) 1705312245
   3) (integer) 15234
   4) 1) "KEYS"
      2) "*"
   5) "127.0.0.1:54321"
   6) "web-app"
2) 1) (integer) 13
   2) (integer) 1705312200
   3) (integer) 10125
   4) 1) "HGETALL"
      2) "user:large-hash"
   5) "127.0.0.1:54322"
   6) ""
```

### 5. Enhanced INFO Command

```rust
// src/commands/handlers/server.rs

pub async fn info(ctx: &Context, section: Option<&str>) -> Frame {
    let mut output = String::new();

    match section {
        None | Some("server") => {
            writeln!(output, "# Server");
            writeln!(output, "ferrite_version:{}", env!("CARGO_PKG_VERSION"));
            writeln!(output, "rust_version:{}", rustc_version());
            writeln!(output, "os:{}", std::env::consts::OS);
            writeln!(output, "arch:{}", std::env::consts::ARCH);
            writeln!(output, "process_id:{}", std::process::id());
            writeln!(output, "uptime_seconds:{}", ctx.uptime().as_secs());
        }
        Some("memory") => {
            writeln!(output, "# Memory");
            writeln!(output, "used_memory:{}", ctx.storage.memory_used());
            writeln!(output, "used_memory_human:{}", humanize(ctx.storage.memory_used()));
            writeln!(output, "used_memory_peak:{}", ctx.storage.memory_peak());
            writeln!(output, "mem_fragmentation_ratio:{:.2}", ctx.storage.fragmentation_ratio());
        }
        Some("stats") => {
            writeln!(output, "# Stats");
            writeln!(output, "total_connections_received:{}", ctx.metrics.connections_total());
            writeln!(output, "total_commands_processed:{}", ctx.metrics.commands_total());
            writeln!(output, "instantaneous_ops_per_sec:{}", ctx.metrics.ops_per_sec());
            writeln!(output, "total_net_input_bytes:{}", ctx.metrics.bytes_received());
            writeln!(output, "total_net_output_bytes:{}", ctx.metrics.bytes_sent());
        }
        Some("clients") => {
            writeln!(output, "# Clients");
            writeln!(output, "connected_clients:{}", ctx.clients.count());
            writeln!(output, "blocked_clients:{}", ctx.clients.blocked_count());
            writeln!(output, "tracking_clients:{}", ctx.clients.tracking_count());
        }
        Some("features") => {
            writeln!(output, "# Features");
            for feature in list_enabled_features() {
                writeln!(output, "{}:enabled", feature);
            }
        }
        // ... more sections
    }

    Frame::Bulk(Some(output.into()))
}
```

### 6. Client Tracking

```rust
// src/server/clients.rs

pub struct ClientRegistry {
    clients: DashMap<u64, ClientInfo>,
}

pub struct ClientInfo {
    pub id: u64,
    pub addr: SocketAddr,
    pub name: Option<String>,
    pub connected_at: Instant,
    pub last_command_at: Instant,
    pub commands_processed: u64,
    pub database: u8,
    pub flags: ClientFlags,
    pub subscriptions: HashSet<Bytes>,
}
```

CLIENT LIST output:
```
> CLIENT LIST
id=1 addr=127.0.0.1:54321 fd=8 name=web-app age=120 idle=5 flags=N db=0 cmd=get
id=2 addr=127.0.0.1:54322 fd=9 name= age=60 idle=0 flags=S db=0 cmd=subscribe
```

## Consequences

### Positive

- **Production-ready**: Standard observability from day one
- **Prometheus integration**: Native metrics for Grafana dashboards
- **Distributed tracing**: Debug cross-service issues with OTel
- **Operational visibility**: Know what's happening inside Ferrite
- **Alerting support**: Metrics enable threshold-based alerts
- **Performance debugging**: Identify slow queries and bottlenecks

### Negative

- **Overhead**: Metrics collection has CPU/memory cost (~1-2%)
- **Complexity**: More code to maintain
- **Dependencies**: OTel adds significant dependency tree
- **Storage**: Metrics/traces require external storage (Prometheus, Jaeger)
- **Learning curve**: Operators need to understand tooling

### Trade-offs

- **Sampling**: Higher sampling = more visibility but more overhead
- **Cardinality**: More labels = richer data but larger storage
- **Retention**: Longer retention = more historical data but more storage

## Implementation Notes

Key files:
- `src/metrics/mod.rs` - Metrics definitions and exposition
- `src/observability/otel.rs` - OpenTelemetry setup
- `src/server/slowlog.rs` - Slow query logging
- `src/server/clients.rs` - Client registry
- `src/commands/handlers/server.rs` - INFO, CLIENT commands

Configuration:
```toml
[metrics]
enabled = true
bind = "0.0.0.0:9090"      # Prometheus endpoint

[logging]
level = "info"              # trace, debug, info, warn, error
format = "json"             # json, pretty

[slowlog]
threshold_ms = 10
max_entries = 128

[opentelemetry]
enabled = false
endpoint = "http://localhost:4317"
sample_rate = 0.1           # 10% of requests
```

Grafana dashboard queries:
```promql
# Request rate
rate(ferrite_commands_total[5m])

# P99 latency
histogram_quantile(0.99, rate(ferrite_command_duration_seconds_bucket[5m]))

# Memory usage
ferrite_memory_used_bytes / ferrite_memory_max_bytes

# Error rate
rate(ferrite_commands_total{status="error"}[5m]) / rate(ferrite_commands_total[5m])
```

## References

- [tracing crate](https://docs.rs/tracing/)
- [metrics crate](https://docs.rs/metrics/)
- [OpenTelemetry Rust](https://opentelemetry.io/docs/instrumentation/rust/)
- [Prometheus Best Practices](https://prometheus.io/docs/practices/naming/)
- [Redis INFO Command](https://redis.io/commands/info/)
- [Observability Engineering (O'Reilly)](https://www.oreilly.com/library/view/observability-engineering/9781492076438/)
