---
sidebar_position: 1
title: Monitoring
description: Monitor Ferrite performance, health, and resource usage with Prometheus metrics, built-in commands, and observability platform integration.
keywords: [monitoring, prometheus, metrics, grafana, observability, performance]
maturity: stable
---

# Monitoring

Monitor Ferrite performance, health, and resource usage.

## Overview

Ferrite provides comprehensive monitoring through Prometheus metrics, built-in commands, and integration with observability platforms.

## Metrics Endpoint

### Enable Prometheus Metrics

```bash
# Start with metrics enabled
ferrite --metrics-port 9090
```

```toml
# ferrite.toml
[metrics]
enabled = true
port = 9090
path = "/metrics"
```

### Scrape Metrics

```bash
curl http://localhost:9090/metrics
```

## Key Metrics

### Commands

```
# Total commands executed by type
ferrite_commands_total{command="GET"} 1500000
ferrite_commands_total{command="SET"} 500000

# Command latency histogram
ferrite_command_duration_seconds_bucket{command="GET",le="0.001"} 1400000
ferrite_command_duration_seconds_bucket{command="GET",le="0.01"} 1495000
ferrite_command_duration_seconds_sum{command="GET"} 150.5
ferrite_command_duration_seconds_count{command="GET"} 1500000

# Commands per second
rate(ferrite_commands_total[1m])
```

### Connections

```
# Active connections
ferrite_connections_active 150

# Total connections opened
ferrite_connections_total 50000

# Rejected connections
ferrite_connections_rejected_total 10

# Connection duration histogram
ferrite_connection_duration_seconds_bucket{le="60"} 45000
```

### Memory

```
# Memory usage
ferrite_memory_used_bytes 2147483648
ferrite_memory_max_bytes 8589934592
ferrite_memory_fragmentation_ratio 1.05

# Memory by type
ferrite_memory_data_bytes 1800000000
ferrite_memory_index_bytes 300000000
ferrite_memory_overhead_bytes 47483648

# Peak memory
ferrite_memory_peak_bytes 2500000000
```

### Keys

```
# Total keys
ferrite_keys_total{db="0"} 1000000

# Keys by type
ferrite_keys_by_type{type="string"} 500000
ferrite_keys_by_type{type="hash"} 300000
ferrite_keys_by_type{type="list"} 100000
ferrite_keys_by_type{type="set"} 50000
ferrite_keys_by_type{type="zset"} 50000

# Key operations
ferrite_keys_expired_total 50000
ferrite_keys_evicted_total 1000
```

### Network

```
# Bytes transferred
ferrite_network_bytes_received_total 10737418240
ferrite_network_bytes_sent_total 21474836480

# Network errors
ferrite_network_errors_total{type="timeout"} 10
ferrite_network_errors_total{type="reset"} 5
```

### Persistence

```
# AOF metrics
ferrite_aof_current_size_bytes 1073741824
ferrite_aof_buffer_size_bytes 1048576
ferrite_aof_sync_total 100000
ferrite_aof_sync_duration_seconds_sum 50.5

# Checkpoint metrics
ferrite_checkpoint_last_time_seconds 1705312800
ferrite_checkpoint_last_duration_seconds 5.2
ferrite_checkpoint_size_bytes 536870912
```

### Replication

```
# Replication status
ferrite_replication_role{role="master"} 1
ferrite_replication_connected_replicas 2
ferrite_replication_offset 123456789

# Replica lag
ferrite_replica_lag_bytes{replica="replica1"} 1024
ferrite_replica_lag_bytes{replica="replica2"} 512
```

## INFO Command

### Basic Info

```bash
INFO
# Returns server information

INFO server
# Server section only
```

### All Sections

```bash
INFO all
```

### Specific Sections

| Section | Description |
|---------|-------------|
| `server` | Server version, uptime, OS |
| `clients` | Connection stats |
| `memory` | Memory usage |
| `persistence` | AOF/checkpoint status |
| `stats` | Command statistics |
| `replication` | Replication info |
| `cpu` | CPU usage |
| `cluster` | Cluster information |
| `keyspace` | Database key counts |

## Prometheus Configuration

### Scrape Config

Metrics are always exposed at `/metrics`; configure only the bind/port in
`ferrite.toml`.

```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'ferrite'
    static_configs:
      - targets: ['localhost:9090']
    scrape_interval: 15s
    metrics_path: /metrics
```

### Service Discovery

```yaml
# Kubernetes service discovery
scrape_configs:
  - job_name: 'ferrite'
    kubernetes_sd_configs:
      - role: pod
    relabel_configs:
      - source_labels: [__meta_kubernetes_pod_label_app]
        regex: ferrite
        action: keep
      - source_labels: [__meta_kubernetes_pod_container_port_number]
        regex: "9090"
        action: keep
```

## Grafana Dashboards

### Import Dashboard

```json
{
  "dashboard": {
    "title": "Ferrite Overview",
    "panels": [
      {
        "title": "Commands/sec",
        "type": "graph",
        "targets": [
          {
            "expr": "sum(rate(ferrite_commands_total[1m]))",
            "legendFormat": "Total"
          },
          {
            "expr": "rate(ferrite_commands_total{command=\"GET\"}[1m])",
            "legendFormat": "GET"
          },
          {
            "expr": "rate(ferrite_commands_total{command=\"SET\"}[1m])",
            "legendFormat": "SET"
          }
        ]
      },
      {
        "title": "P99 Latency",
        "type": "graph",
        "targets": [
          {
            "expr": "histogram_quantile(0.99, rate(ferrite_command_duration_seconds_bucket[5m]))",
            "legendFormat": "p99"
          }
        ]
      },
      {
        "title": "Memory Usage",
        "type": "gauge",
        "targets": [
          {
            "expr": "ferrite_memory_used_bytes / ferrite_memory_max_bytes",
            "legendFormat": "Usage"
          }
        ]
      },
      {
        "title": "Connections",
        "type": "stat",
        "targets": [
          {
            "expr": "ferrite_connections_active",
            "legendFormat": "Active"
          }
        ]
      }
    ]
  }
}
```

## Alerting

### Prometheus Alert Rules

```yaml
groups:
  - name: ferrite
    rules:
      # High latency
      - alert: FerriteHighLatency
        expr: histogram_quantile(0.99, rate(ferrite_command_duration_seconds_bucket[5m])) > 0.01
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "P99 latency above 10ms"
          description: "Ferrite P99 latency is {{ $value | humanizeDuration }}"

      # Memory usage
      - alert: FerriteMemoryHigh
        expr: ferrite_memory_used_bytes / ferrite_memory_max_bytes > 0.9
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "Memory usage above 90%"

      # Connection limit
      - alert: FerriteConnectionsHigh
        expr: ferrite_connections_active > 1000
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Active connections above 1000"

      # Replication lag
      - alert: FerriteReplicaLag
        expr: ferrite_replica_lag_bytes > 1048576
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Replica lag above 1MB"

      # Instance down
      - alert: FerriteDown
        expr: up{job="ferrite"} == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Ferrite instance is down"
```

## Health Checks

### Liveness Check

```bash
# Simple ping
PING
# Returns: PONG

# HTTP health endpoint
curl http://localhost:9090/health
# Returns: {"status": "healthy"}
```

### Readiness Check

```bash
# Check if ready to accept connections
curl http://localhost:9090/ready
# Returns: {"status": "ready", "checks": {...}}
```

### Custom Health Commands

```bash
# Detailed health info
HEALTH
# Returns:
# status: healthy
# uptime: 86400
# memory_ok: true
# persistence_ok: true
# replication_ok: true
```

## Logging

### Log Levels

```toml
[logging]
level = "info"  # trace, debug, info, warn, error
format = "json"  # json or text
output = "stdout"  # stdout, stderr, or file path
```

### Structured Logging

```json
{
  "timestamp": "2024-01-15T10:30:00Z",
  "level": "info",
  "message": "Command executed",
  "command": "SET",
  "key": "user:123",
  "duration_ms": 0.5,
  "client_ip": "192.168.1.100"
}
```

### Log Aggregation

```yaml
# Fluentd config
<source>
  @type tail
  path /var/log/ferrite/*.log
  pos_file /var/log/fluentd/ferrite.pos
  tag ferrite
  <parse>
    @type json
  </parse>
</source>

<match ferrite>
  @type elasticsearch
  host elasticsearch
  port 9200
  index_name ferrite
</match>
```

## Rust API

```rust
use ferrite::metrics::{MetricsRegistry, Counter, Histogram};

// Access metrics
let registry = MetricsRegistry::global();

// Record custom metric
registry.counter("custom_operations_total").inc();

// Record with labels
registry.counter("custom_operations_total")
    .with_label("type", "read")
    .inc();

// Record histogram
registry.histogram("custom_duration_seconds")
    .observe(duration.as_secs_f64());

// Get current values
let info = registry.server_info();
println!("Commands processed: {}", info.total_commands);
println!("Memory used: {} bytes", info.used_memory);
```

## Best Practices

1. **Set appropriate scrape intervals** - 15-30s for most metrics
2. **Use recording rules** - Pre-compute frequent queries
3. **Alert on symptoms** - Latency, errors, not just resource usage
4. **Dashboard hierarchy** - Overview → Service → Instance
5. **Retain data appropriately** - High resolution short-term, aggregated long-term
6. **Monitor the monitoring** - Ensure metrics collection is healthy

## Next Steps

- [Observability](/docs/operations/observability) - Tracing and profiling
- [Performance Tuning](/docs/operations/performance-tuning) - Optimization guide
- [Troubleshooting](/docs/operations/troubleshooting) - Debug issues
