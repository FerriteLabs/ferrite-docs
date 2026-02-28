---
sidebar_position: 22
maturity: beta
---

# Monitoring with Grafana

This tutorial covers setting up Prometheus metrics collection and Grafana dashboards for monitoring Ferrite in production.

## Prerequisites

- Ferrite deployed on Kubernetes (see [Kubernetes Deployment](./kubernetes-deployment.md))
- Prometheus installed (standalone or via [kube-prometheus-stack](https://github.com/prometheus-community/helm-charts/tree/main/charts/kube-prometheus-stack))
- Grafana installed (standalone or bundled with kube-prometheus-stack)
- `ferrite-ops` repository cloned locally

## Step 1: Enable Ferrite Metrics

Ensure metrics are enabled in your Helm values:

```yaml
# values-production.yaml
ferrite:
  metrics:
    enabled: true
    path: "/metrics"

service:
  metricsPort: 9090
```

Verify metrics are exposed:

```bash
# Port-forward to the metrics endpoint
kubectl port-forward svc/ferrite 9090:9090

# Fetch metrics
curl http://localhost:9090/metrics
```

You should see Prometheus-formatted metrics like:

```text
# HELP ferrite_commands_total Total number of commands processed
# TYPE ferrite_commands_total counter
ferrite_commands_total{cmd="GET"} 1542
ferrite_commands_total{cmd="SET"} 893
# HELP ferrite_memory_used_bytes Current memory usage in bytes
# TYPE ferrite_memory_used_bytes gauge
ferrite_memory_used_bytes 52428800
```

## Step 2: Configure Prometheus Scraping

### Option A: ServiceMonitor (Prometheus Operator)

If you're using the Prometheus Operator (e.g., kube-prometheus-stack), enable the ServiceMonitor in the Helm chart:

```yaml
# values-production.yaml
serviceMonitor:
  enabled: true
  interval: 15s
  scrapeTimeout: 10s
  additionalLabels:
    release: prometheus  # Match your Prometheus Operator's label selector
```

Verify the ServiceMonitor is created and Prometheus discovers it:

```bash
kubectl get servicemonitor -l app.kubernetes.io/name=ferrite

# Check Prometheus targets UI
kubectl port-forward svc/prometheus-kube-prometheus-prometheus 9091:9090
# Visit http://localhost:9091/targets
```

### Option B: Static Prometheus Configuration

If using standalone Prometheus, add a scrape config:

```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'ferrite'
    kubernetes_sd_configs:
      - role: endpoints
        namespaces:
          names:
            - default  # Adjust to your namespace
    relabel_configs:
      - source_labels: [__meta_kubernetes_service_name]
        regex: ferrite
        action: keep
      - source_labels: [__meta_kubernetes_endpoint_port_name]
        regex: metrics
        action: keep
```

## Step 3: Import the Grafana Dashboard

The `ferrite-ops` repository includes a pre-built dashboard at `grafana/ferrite-dashboard.json`.

### Import via Grafana UI

1. Open Grafana (typically at `http://localhost:3000`)
2. Navigate to **Dashboards** → **Import**
3. Click **Upload JSON file**
4. Select `ferrite-ops/grafana/ferrite-dashboard.json`
5. Select your Prometheus datasource
6. Click **Import**

### Import via Grafana API

```bash
curl -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_GRAFANA_API_KEY" \
  -d @ferrite-ops/grafana/ferrite-dashboard.json \
  http://localhost:3000/api/dashboards/import
```

### Import via ConfigMap (Kubernetes)

For automated provisioning, create a ConfigMap with the dashboard JSON:

```bash
kubectl create configmap ferrite-dashboard \
  --from-file=ferrite-dashboard.json=ferrite-ops/grafana/ferrite-dashboard.json \
  -n monitoring

# Label it for Grafana sidecar auto-discovery (if using kube-prometheus-stack)
kubectl label configmap ferrite-dashboard \
  grafana_dashboard=1 \
  -n monitoring
```

## Step 4: Dashboard Panels Overview

The Ferrite Grafana dashboard is organized into five rows:

### Overview Row

| Panel | Metric | Description |
|-------|--------|-------------|
| Memory Usage | `ferrite_memory_used_bytes` | Current memory vs. max limit |
| Operations/sec | `rate(ferrite_commands_total[5m])` | Command throughput |
| Connected Clients | `ferrite_connected_clients` | Active client connections |
| Total Keys | `ferrite_db_keys` | Keys stored across all databases |
| Cache Hit Rate | `hits / (hits + misses)` | Percentage of successful key lookups |
| P99 Latency | `histogram_quantile(0.99, ...)` | 99th percentile command latency |

### Performance Row

| Panel | Description |
|-------|-------------|
| Operations by Command | Breakdown of throughput per command type (GET, SET, etc.) |
| Latency Percentiles | P50, P95, P99, P99.9 latency over time |

### Memory & Storage Row

| Panel | Description |
|-------|-------------|
| Memory Usage Trend | Historical memory usage with max limit line |
| HybridLog Tiers | Size distribution across mutable, read-only, and disk tiers |

### Connections & Network Row

| Panel | Description |
|-------|-------------|
| Client Connections | Connected and blocked clients over time |
| Network I/O | Bytes in/out per second |
| Cache Hit/Miss Rate | Hit rate trend with miss overlay |

### Persistence & Replication Row

| Panel | Description |
|-------|-------------|
| AOF Size | Current append-only file size |
| Connected Replicas | Number of connected replica instances |
| Replication Lag | Offset lag between primary and replicas |

## Key Metrics to Monitor

### Critical Metrics

These metrics require immediate attention when they breach thresholds:

| Metric | Warning Threshold | Critical Threshold | Action |
|--------|------------------|-------------------|--------|
| Memory usage ratio | > 80% | > 90% | Scale up or enable eviction |
| P99 latency | > 5ms | > 20ms | Check slow commands, memory pressure |
| Connected clients | > 80% of max | > 95% of max | Increase `maxConnections` |
| Replication lag | > 1MB | > 10MB | Check network, replica load |

### Capacity Planning Metrics

Monitor these for trend-based capacity planning:

| Metric | What to Watch |
|--------|---------------|
| `ferrite_memory_used_bytes` | Linear growth indicates need for more memory |
| `ferrite_db_keys` | Key count growth rate |
| `rate(ferrite_commands_total[1h])` | Traffic pattern changes |
| `ferrite_aof_current_size_bytes` | Disk usage growth |

## Step 5: Configure Alerting Rules

### Prometheus Alerting Rules

Create a `PrometheusRule` resource or add to your Prometheus rules file:

```yaml
# values-production.yaml (Helm chart)
prometheusRule:
  enabled: true
  rules:
    - alert: FerriteDown
      expr: up{job="ferrite"} == 0
      for: 1m
      labels:
        severity: critical
      annotations:
        summary: "Ferrite instance {{ $labels.instance }} is down"
        description: "Ferrite has been unreachable for more than 1 minute."

    - alert: FerriteHighMemory
      expr: (ferrite_memory_used_bytes / ferrite_memory_max_bytes) > 0.9
      for: 5m
      labels:
        severity: warning
      annotations:
        summary: "Ferrite memory usage above 90%"
        description: "Memory usage is {{ $value | humanizePercentage }} on {{ $labels.instance }}."

    - alert: FerriteHighLatency
      expr: histogram_quantile(0.99, rate(ferrite_command_duration_seconds_bucket[5m])) > 0.005
      for: 5m
      labels:
        severity: warning
      annotations:
        summary: "Ferrite P99 latency above 5ms"
        description: "P99 latency is {{ $value | humanizeDuration }} on {{ $labels.instance }}."

    - alert: FerriteLowCacheHitRate
      expr: |
        (rate(ferrite_keyspace_hits_total[5m]) /
        (rate(ferrite_keyspace_hits_total[5m]) + rate(ferrite_keyspace_misses_total[5m]))) < 0.8
      for: 10m
      labels:
        severity: info
      annotations:
        summary: "Cache hit rate below 80%"
        description: "Hit rate is {{ $value | humanizePercentage }} on {{ $labels.instance }}."

    - alert: FerriteReplicationLag
      expr: ferrite_replication_lag > 10000000
      for: 5m
      labels:
        severity: warning
      annotations:
        summary: "Replication lag exceeds 10MB"
        description: "Replication lag is {{ $value | humanize1024 }}B on {{ $labels.instance }}."

    - alert: FerriteTooManyConnections
      expr: ferrite_connected_clients > 9000
      for: 5m
      labels:
        severity: warning
      annotations:
        summary: "Client connections approaching limit"
        description: "{{ $value }} clients connected on {{ $labels.instance }} (limit: 10000)."
```

### Grafana Alert Notifications

Configure alert notification channels in Grafana for:

- **Slack/Teams** — Warning and critical alerts
- **PagerDuty/Opsgenie** — Critical alerts requiring immediate response
- **Email** — Daily digest of warning-level alerts

## Docker Compose Quick Start

For local development and testing, use the Docker Compose monitoring stack from `ferrite-ops`:

```bash
cd ferrite-ops
docker compose --profile monitoring up -d
```

This starts Ferrite, Prometheus, and Grafana with dashboards auto-provisioned:

- **Ferrite**: `localhost:6379`
- **Prometheus**: `localhost:9090`
- **Grafana**: `localhost:3000` (credentials: `admin`/`admin`)

## Troubleshooting

### No Data in Dashboard

1. Verify metrics endpoint: `curl http://ferrite-host:9090/metrics`
2. Check Prometheus targets: navigate to Prometheus UI → Status → Targets
3. Verify the datasource in Grafana points to the correct Prometheus URL
4. Check that ServiceMonitor labels match Prometheus Operator's `serviceMonitorSelector`

### Partial Metrics Missing

Some metrics are only available with specific features enabled:
- `ferrite_hybridlog_*` — requires `backend: "hybridlog"`
- `ferrite_replication_lag` — requires replication to be enabled
- `ferrite_aof_current_size_bytes` — requires AOF persistence

### High Cardinality Warnings

If Prometheus reports high cardinality, use metric relabeling to drop unused labels:

```yaml
serviceMonitor:
  metricRelabelings:
    - sourceLabels: [__name__]
      regex: 'ferrite_command_duration_seconds_bucket'
      action: keep
```

## Next Steps

- [Production Checklist](./production-checklist.md) — Verify your deployment is production-ready
- [Cloud-Native Overview](./cloud-native-overview.md) — Return to the series overview
