---
sidebar_position: 2
maturity: beta
---

# Observability

Ferrite provides built-in observability features for monitoring, tracing, and profiling.

> Status: Metrics and OpenTelemetry export are wired in `ferrite.toml`. The
> tracing, profiling, and analysis commands below describe planned capabilities
> and are not yet implemented in the current server.

## Overview

Ferrite's observability stack includes:

- **Metrics** - Prometheus-compatible metrics
- **Tracing** - Distributed tracing with OpenTelemetry
- **Profiling** - CPU and memory profiling
- **Query Analysis** - Slow query detection and optimization recommendations

## Metrics

### Prometheus Endpoint

Ferrite exposes metrics at `/metrics`:

```bash
# Start with metrics enabled
ferrite --metrics-port 9090
```

```bash
# Scrape metrics
curl http://localhost:9090/metrics
```

### Key Metrics

```
# Commands
ferrite_commands_total{command="GET"} 1000000
ferrite_command_duration_seconds{command="GET",quantile="0.99"} 0.001

# Connections
ferrite_connections_active 50
ferrite_connections_opened_total 10000

# Memory
ferrite_memory_used_bytes 1073741824
ferrite_memory_max_bytes 4294967296

# Keys
ferrite_keys_total{db="0"} 500000
ferrite_expired_keys_total 10000
ferrite_evicted_keys_total 500

# Network
ferrite_bytes_received_total 10737418240
ferrite_bytes_sent_total 21474836480

# Persistence
ferrite_aof_writes_total 5000000
ferrite_rdb_last_save_time 1705312800
```

### Custom Metrics

```rust
use ferrite::metrics::*;

// Record command execution
record_command("GET", Duration::from_micros(150));

// Record bytes transferred
record_bytes_received(1024);
record_bytes_sent(2048);

// Update gauges
record_memory_used(1024 * 1024 * 512);
record_keys(100000, 0);  // 100K keys in db 0
```

### Prometheus Configuration

```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'ferrite'
    static_configs:
      - targets: ['localhost:9090']
    scrape_interval: 15s
```

### Grafana Dashboard

Import the Ferrite dashboard for Grafana:

```json
{
  "dashboard": {
    "title": "Ferrite",
    "panels": [
      {
        "title": "Commands/sec",
        "expr": "rate(ferrite_commands_total[1m])"
      },
      {
        "title": "P99 Latency",
        "expr": "histogram_quantile(0.99, ferrite_command_duration_seconds)"
      },
      {
        "title": "Memory Usage",
        "expr": "ferrite_memory_used_bytes / ferrite_memory_max_bytes"
      }
    ]
  }
}
```

## Distributed Tracing

### OpenTelemetry Integration

Enable OpenTelemetry export:

```toml
[otel]
enabled = true
endpoint = "http://localhost:4317"
service_name = "ferrite"
traces_enabled = true
metrics_enabled = true
```

### Trace Sessions

Create trace sessions to capture query execution:

```bash
# Start tracing session
TRACE.START session1

# Execute commands (traces are captured)
GET user:123
SET user:456 "value"

# Stop and get trace data
TRACE.STOP session1
```

### Trace Events

Each traced operation includes:

```json
{
  "trace_id": "abc123",
  "span_id": "def456",
  "operation": "GET",
  "key": "user:123",
  "duration_us": 150,
  "result": "hit",
  "db": 0,
  "client_id": "conn:789"
}
```

### W3C Trace Context

Ferrite supports W3C Trace Context for distributed tracing:

```bash
# Include traceparent header in request
traceparent: 00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01
```

## Query Analysis

### Slow Query Detection

Ferrite uses Redis-compatible slowlog commands. Configure the threshold in
microseconds:

```bash
CONFIG SET slowlog-log-slower-than 10000
```

```bash
# Get slow queries
SLOWLOG GET 10
# Returns recent slow queries

# Reset slow log
SLOWLOG RESET
```

### Query Patterns

```bash
# Analyze query patterns
ANALYZE.PATTERNS
# Returns:
# - Most frequent commands
# - Hot keys (frequently accessed)
# - N+1 query patterns
# - Large scan operations
```

### Recommendations

Ferrite provides AI-powered optimization recommendations:

```bash
ANALYZE.RECOMMEND
# Returns:
# 1. [HIGH] Add index for frequent pattern 'user:*:profile'
# 2. [MEDIUM] Use MGET instead of individual GETs for user:* keys
# 3. [LOW] Consider caching hot key 'config:app'
```

### Recommendation Types

| Type | Description |
|------|-------------|
| `AddIndex` | Create index for frequent queries |
| `UseBatching` | Combine multiple operations |
| `OptimizeKeyPattern` | Improve key naming |
| `ChangeDataStructure` | Use more appropriate type |
| `AddCaching` | Cache frequently read data |
| `ReduceScans` | Avoid KEYS/SCAN operations |
| `SplitHotKey` | Distribute load for hot keys |

## Profiling

### CPU Profiling

```bash
# Start CPU profiling
PROFILE.START CPU DURATION 30

# Get profiling results
PROFILE.RESULTS
# Returns flame graph data in folded format
```

### Memory Profiling

```bash
# Start memory profiling
PROFILE.START MEMORY DURATION 30

# Get heap snapshot
PROFILE.RESULTS
# Returns memory allocation breakdown
```

### Hot Spots

```bash
# Get top 50 hot spots
PROFILE.HOTSPOTS
# Returns:
# 1. command_executor::execute (15.2%)
# 2. storage::get (12.1%)
# 3. protocol::parse (8.5%)
```

### Flame Graph

Generate flame graphs from profiling data:

Profiling exports are not yet available from the server. Use external profilers
(e.g., `perf`, `tokio-console`, or `cargo flamegraph`) until native exports land.

## Rust API

```rust
use ferrite::observability::{ObservabilityManager, ObservabilityConfig, TraceSession};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Create observability manager
    let config = ObservabilityConfig {
        tracing_enabled: true,
        profiling_enabled: true,
        slow_query_threshold: Duration::from_millis(10),
        ..Default::default()
    };
    let obs = ObservabilityManager::new(config);

    // Start trace session
    let session = obs.start_trace_session("my-session")?;

    // Record events
    session.record_event(TraceEvent {
        operation: "GET".to_string(),
        key: "user:123".to_string(),
        duration: Duration::from_micros(150),
        ..Default::default()
    });

    // Get recommendations
    let recommendations = obs.get_recommendations()?;
    for rec in recommendations {
        println!("[{}] {}", rec.severity, rec.description);
    }

    // Start profiling
    obs.start_profiling(ProfileType::Cpu, Duration::from_secs(30))?;

    Ok(())
}
```

## Configuration

Ferrite exposes configuration for metrics and OpenTelemetry via `metrics` and
`otel` in `ferrite.toml`. Advanced observability workflows are currently
configured in code.

```toml
[metrics]
enabled = true
bind = "127.0.0.1"
port = 9090

[otel]
enabled = false
endpoint = "http://localhost:4317"
service_name = "ferrite"
traces_enabled = true
metrics_enabled = true
```

## Alerts

### Example Prometheus Rules

```yaml
groups:
  - name: ferrite
    rules:
      - alert: HighLatency
        expr: histogram_quantile(0.99, ferrite_command_duration_seconds) > 0.01
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "P99 latency above 10ms"

      - alert: MemoryHigh
        expr: ferrite_memory_used_bytes / ferrite_memory_max_bytes > 0.9
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "Memory usage above 90%"

      - alert: ConnectionsHigh
        expr: ferrite_connections_active > 1000
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Active connections above 1000"
```

## Best Practices

1. **Set appropriate thresholds** - Tune slow query threshold for your workload
2. **Sample in production** - Use sampling rate to reduce overhead
3. **Monitor key metrics** - Latency, throughput, memory, connections
4. **Review recommendations** - Act on high-severity suggestions
5. **Use distributed tracing** - Connect traces across services
6. **Profile periodically** - Identify performance regressions

## Next Steps

- [Monitoring](/docs/operations/monitoring) - Set up monitoring
- [Performance Tuning](/docs/operations/performance-tuning) - Optimize performance
- [Troubleshooting](/docs/operations/troubleshooting) - Debug issues
