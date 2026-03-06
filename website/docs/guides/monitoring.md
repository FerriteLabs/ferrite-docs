# Monitoring Ferrite

This guide covers setting up Prometheus + Grafana monitoring for Ferrite, available metrics, alerting, and troubleshooting.

## Quick Start

The `ferrite-ops` repository includes a ready-to-use monitoring stack:

```bash
cd ferrite-ops/monitoring
docker compose up -d
```

This starts:

| Service | URL | Default Port |
|---------|-----|-------------|
| **Prometheus** | `http://localhost:9091` | `9091` |
| **Grafana** | `http://localhost:3000` | `3000` |

Prometheus scrapes Ferrite's metrics endpoint (`http://localhost:9090/metrics`) every **5 seconds**. Grafana ships with pre-built dashboards.

## Available Prometheus Metrics

Ferrite exposes the following metrics at the `/metrics` endpoint:

### Memory & Storage

| Metric | Type | Description |
|--------|------|-------------|
| `ferrite_memory_used_bytes` | Gauge | Current memory usage |
| `ferrite_memory_max_bytes` | Gauge | Configured memory limit |
| `ferrite_hybridlog_disk_bytes` | Gauge | Disk usage of the HybridLog on-disk region |

### Operations & Latency

| Metric | Type | Description |
|--------|------|-------------|
| `ferrite_command_duration_seconds_bucket` | Histogram | Command latency distribution (use for P99/P999) |
| `ferrite_keyspace_hits_total` | Counter | Successful key lookups |
| `ferrite_keyspace_misses_total` | Counter | Failed key lookups (cache miss) |
| `ferrite_evicted_keys_total` | Counter | Keys evicted due to memory pressure |
| `ferrite_slowlog_entries_total` | Counter | Commands exceeding the slowlog threshold |

### Connections

| Metric | Type | Description |
|--------|------|-------------|
| `ferrite_connected_clients` | Gauge | Current client connections |
| `ferrite_rejected_connections_total` | Counter | Connections rejected (max clients reached) |

### Replication

| Metric | Type | Description |
|--------|------|-------------|
| `ferrite_replication_lag_seconds` | Gauge | Replica lag behind primary |
| `ferrite_connected_replicas` | Gauge | Number of connected replicas |
| `ferrite_expected_replicas` | Gauge | Expected replica count |

### Persistence

| Metric | Type | Description |
|--------|------|-------------|
| `ferrite_aof_rewrite_in_progress` | Gauge | `1` if AOF rewrite is running |
| `ferrite_rdb_save_in_progress` | Gauge | `1` if RDB snapshot is in progress |

### Cluster

| Metric | Type | Description |
|--------|------|-------------|
| `ferrite_cluster_state` | Gauge | Cluster health (`1` = ok, `0` = fail) |
| `ferrite_cluster_slots_ok` | Gauge | Number of covered hash slots (should be 16384) |
| `ferrite_cluster_known_nodes` | Gauge | Total known cluster nodes |
| `ferrite_cluster_nodes_ok` | Gauge | Healthy cluster nodes |

## Grafana Dashboards

Two pre-built dashboards are included in `ferrite-ops/monitoring/grafana/`:

- **Ferrite Overview** (`ferrite-overview.json`) — High-level health: memory, connections, hit rate, throughput.
- **Ferrite Operations** (`ferrite-dashboard.json`) — Detailed latency histograms, per-command breakdowns, replication status.

Import them via Grafana UI (`Dashboards → Import → Upload JSON`) or let Docker Compose provision them automatically.

### Dashboard Panels

**Ferrite Overview Dashboard** includes:
- **Memory Usage** — Real-time `ferrite_memory_used_bytes` vs `ferrite_memory_max_bytes` with threshold lines
- **Operations/sec** — Stacked graph of `ferrite_commands_processed_total` by command type
- **Connected Clients** — Gauge showing `ferrite_connected_clients` with max-client threshold
- **Cache Hit Rate** — Percentage calculated from `ferrite_keyspace_hits_total / (hits + misses)`
- **P99 Latency** — Histogram quantile from `ferrite_command_duration_seconds`

**Ferrite Operations Dashboard** includes:
- **Command Latency Heatmap** — Per-command P50/P95/P99/P99.9 breakdown
- **Replication Lag** — `ferrite_replication_lag_seconds` per replica
- **HybridLog Tier Distribution** — Mutable/ReadOnly/Disk bytes stacked area
- **Eviction Rate** — `ferrite_evicted_keys_total` rate over time
- **AOF/RDB Status** — Last save timestamps and rewrite progress

> 💡 **Tip:** To capture your own dashboard screenshots, start the monitoring stack with
> `docker compose -f docker-compose.monitoring.yml up -d`, navigate to `http://localhost:3001`,
> and use Grafana's built-in screenshot feature (`Share → Direct link rendered image`).

## Alerting Rules

The monitoring stack ships with 23 pre-configured alert rules in `prometheus-alerts.yml`. Key alerts:

| Alert | Condition | Severity |
|-------|-----------|----------|
| `FerriteDown` | Instance unreachable for > 1m | 🔴 Critical |
| `FerriteCriticalMemoryUsage` | Memory > 95% for 2m | 🔴 Critical |
| `FerriteHighMemoryUsage` | Memory > 85% for 5m | 🟡 Warning |
| `FerriteHighLatencyP99` | P99 latency > 5ms | 🟡 Warning |
| `FerriteRejectedConnections` | Any rejected connections | 🟡 Warning |
| `FerriteLowHitRate` | Hit rate < 80% for 10m | 🟡 Warning |
| `FerriteReplicationBroken` | Replica count mismatch for 5m | 🔴 Critical |
| `FerriteClusterStateNotOk` | Cluster in error state | 🔴 Critical |
| `FerriteClusterNodeDown` | Node unreachable for 2m | 🔴 Critical |

See [`ferrite-ops/monitoring/prometheus-alerts.yml`](https://github.com/FerriteLabs/ferrite-ops/blob/main/monitoring/prometheus-alerts.yml) for the full list and thresholds.

## Troubleshooting

### Prometheus shows "target is down"

1. Verify Ferrite is running and the metrics endpoint is reachable:
   ```bash
   curl http://localhost:9090/metrics
   ```
2. Check that `host.docker.internal` resolves correctly (Docker Desktop) or update the target in `prometheus.yml`.

### Grafana dashboards show "No data"

1. Confirm Prometheus is scraping successfully at `http://localhost:9091/targets`.
2. Check the datasource is configured — Grafana should auto-detect the Prometheus datasource from Docker Compose.
3. Verify the time range selector in Grafana covers recent data.

### High memory alerts firing unexpectedly

Ferrite's `ferrite_memory_max_bytes` defaults to system RAM. Set an explicit limit via `maxmemory` in your config to get accurate percentage-based alerts.

### Metrics endpoint not available

Ensure the metrics feature is enabled. Start Ferrite with the `--metrics-port 9090` flag or set `metrics-port: 9090` in your configuration file.
