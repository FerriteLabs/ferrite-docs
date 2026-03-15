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

Pre-built Grafana dashboards are available in `ferrite-ops/grafana/`. Import the JSON files into your Grafana instance via **Dashboards → Import → Upload JSON file**, or use the provisioning configuration in `ferrite-ops/grafana/provisioning/`.

### ferrite-dashboard.json — Overview (32 panels)

The main operational dashboard with six panel rows covering all key metrics at a glance:

- **Overview** — Memory usage gauge, operations/sec, connected clients, total keys, cache hit rate, and P99 latency stat panels for instant health assessment.
- **Performance** — Operations rate broken down by command type (GET, SET, DEL, etc.) and latency percentile time series (P50/P95/P99).
- **Memory & Storage** — Memory usage over time and HybridLog tier distribution (mutable, read-only, disk regions).
- **Connections & Network** — Client connection counts, network I/O bytes (sent/received), and cache hit/miss rate trends.
- **Observability & Slow Queries** — Slow query counts, P99 latency heatmap, memory tier distribution, active connection gauge, and operations per second.
- **Persistence & Replication** — AOF size growth, connected replica count, replication lag (offset-based), connection open rate, key eviction/expiration rates, AOF write performance, and replication event counts.

### ferrite-memory-tiers.json — Memory Tier Distribution (9 panels)

Focused on Ferrite's three-tier HybridLog storage engine:

- **Tier Overview** — Time series showing data distribution across mutable (memory), read-only (mmap), and disk (io_uring) tiers, plus a pie chart of current tier ratios.
- **Memory & Pressure** — Memory savings stat (bytes saved by tiering), memory pressure gauge, and tier promotion rate over time.
- **Eviction & Tiering Activity** — Eviction vs. tiering activity comparison to identify when data is being moved between tiers or evicted under pressure.

### ferrite-query-performance.json — Query Performance (9 panels)

Deep-dive into command execution performance:

- **Command Throughput** — Top 10 commands by volume (bar chart) and QPS breakdown split by read vs. write operations.
- **Latency** — Per-command P99 latency and combined P50/P95/P99/P99.9 latency percentile time series.
- **Errors & Slow Queries** — Error rate by type (timeout, OOM, auth failure) and a slow query count stat panel.

### ferrite-cluster.json — Cluster & Replication (11 panels)

Cluster topology and replication health:

- **Cluster Overview** — Cluster state indicator (ok/fail), known node count, slot coverage gauge, and connected replica count.
- **Replication** — Per-replica replication lag (bytes) and replication delay (seconds) time series.
- **Failover & Resync** — Failover event timeline and full resync event counts for diagnosing cluster instability.

### ferrite-streaming.json — CDC & Streaming (9 panels)

Change Data Capture and streaming pipeline metrics:

- **CDC & Streaming Overview** — CDC events per second and consumer group lag time series.
- **Pipeline & Streams** — Pipeline processing latency and stream length over time.
- **Backpressure & Pending** — Pending message count stat and backpressure indicator gauge for identifying pipeline bottlenecks.

### ferrite-vector.json — Vector Search & AI (9 panels)

Vector search and AI workload monitoring:

- **Vector Search Overview** — Vector search QPS and search latency (P50/P99) time series.
- **Embedding & Index** — Embedding ingestion rate and current index size stat.
- **Semantic Cache** — Semantic cache hit rate gauge and semantic cache latency time series.

## Alerting

### Prometheus Alert Rules

Production-ready alert rules are available in `ferrite-ops/monitoring/prometheus-alerts.yml`. Add them to your Prometheus configuration:

```yaml
# prometheus.yml
rule_files:
  - "prometheus-alerts.yml"
```

The alert rules cover the following categories:

| Category | Alerts | Severity |
|----------|--------|----------|
| **Memory** | `FerriteHighMemoryUsage` (>85%), `FerriteCriticalMemoryUsage` (>95%) | warning / critical |
| **Latency** | `FerriteHighLatencyP99` (>5ms), `FerriteHighLatencyP999` (>10ms) | warning |
| **Connections** | `FerriteNoConnections`, `FerriteHighConnectionCount` (>1000), `FerriteRejectedConnections` | warning |
| **Cache** | `FerriteLowHitRate` (below 80%) | warning |
| **Eviction** | `FerriteEvictions` (>100 keys/sec) | warning |
| **Replication** | `FerriteReplicationLag` (>10s) | warning |

### Runbooks

Each alert has a corresponding runbook in `ferrite-ops/monitoring/runbooks/` with diagnosis steps and remediation procedures:

| Runbook | Triggered By |
|---------|-------------|
| `high-memory.md` | `HighMemoryUsage` (>80%), `CriticalMemoryUsage` (>95%) |
| `high-latency.md` | `HighLatencyP99` (>10ms), `HighLatencyP999` (>50ms) |
| `replication-lag.md` | `ReplicationLag` (>1s), `ReplicationBroken` (link down >30s) |
| `cluster-failure.md` | `ClusterStateNotOk`, `ClusterNodeDown`, `ClusterSplitBrain` |
| `disk-full.md` | `DiskHighUsage` (>80%), `DiskCriticalUsage` (>95%) |
| `backup-failure.md` | `BackupOverdue` (no successful backup in >24h) |

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
