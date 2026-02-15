---
title: Grafana Integration
description: Set up Grafana dashboards for monitoring Ferrite with Prometheus metrics, pre-built dashboards, and alerting rules.
sidebar_position: 4
maturity: stable
---

# Grafana Integration

This guide walks you through setting up Grafana dashboards to monitor your Ferrite deployment using Prometheus as the data source.

## Prerequisites

Before you begin, ensure you have:

- **Ferrite** running with metrics enabled (`[metrics]` section in `ferrite.toml`)
- **Prometheus** scraping Ferrite's `/metrics` endpoint
- **Grafana** (v9.0+) with a Prometheus data source configured

:::warning
Ferrite's metrics endpoint must be reachable from Prometheus. If running in Docker or Kubernetes, ensure the network configuration allows Prometheus to reach Ferrite's metrics port (default `9090`).
:::

## Step 1: Enable Ferrite Metrics

Configure Ferrite to expose Prometheus metrics:

```toml title="ferrite.toml"
[metrics]
enabled = true
bind = "0.0.0.0"
port = 9090
```

Verify the endpoint is working:

```bash
curl -s http://localhost:9090/metrics | head -20
```

## Step 2: Configure Prometheus Scraping

Add Ferrite as a scrape target in your Prometheus configuration:

```yaml title="prometheus.yml"
scrape_configs:
  - job_name: "ferrite"
    scrape_interval: 15s
    static_configs:
      - targets: ["ferrite-host:9090"]
        labels:
          environment: "production"
          cluster: "primary"
```

For Kubernetes deployments with service discovery:

```yaml title="prometheus.yml"
scrape_configs:
  - job_name: "ferrite"
    kubernetes_sd_configs:
      - role: pod
    relabel_configs:
      - source_labels: [__meta_kubernetes_pod_label_app]
        regex: ferrite
        action: keep
      - source_labels: [__meta_kubernetes_pod_annotation_prometheus_io_port]
        action: replace
        target_label: __address__
        regex: (.+)
        replacement: ${1}:9090
```

## Step 3: Import the Ferrite Dashboard

### Using the ferrite-ops Pre-built Dashboard

The [`ferrite-ops`](https://github.com/ferrite-rs/ferrite-ops) repository includes a production-ready Grafana dashboard:

```bash
# Clone ferrite-ops if you haven't already
git clone https://github.com/ferrite-rs/ferrite-ops.git

# The dashboard JSON is at:
# ferrite-ops/grafana/dashboards/ferrite-overview.json
```

Import in Grafana:

1. Navigate to **Dashboards → Import**
2. Click **Upload JSON file** and select `ferrite-overview.json`
3. Select your Prometheus data source
4. Click **Import**

### Manual Dashboard JSON

If you prefer to create a dashboard from scratch, use this starter template:

```json
{
  "dashboard": {
    "title": "Ferrite Overview",
    "tags": ["ferrite", "database"],
    "timezone": "browser",
    "panels": [
      {
        "title": "Commands per Second",
        "type": "timeseries",
        "gridPos": { "h": 8, "w": 12, "x": 0, "y": 0 },
        "targets": [
          {
            "expr": "sum(rate(ferrite_commands_total[1m])) by (command)",
            "legendFormat": "{{command}}"
          }
        ]
      },
      {
        "title": "P99 Command Latency",
        "type": "timeseries",
        "gridPos": { "h": 8, "w": 12, "x": 12, "y": 0 },
        "targets": [
          {
            "expr": "histogram_quantile(0.99, sum(rate(ferrite_command_duration_seconds_bucket[5m])) by (le, command))",
            "legendFormat": "{{command}} p99"
          }
        ]
      },
      {
        "title": "Active Connections",
        "type": "stat",
        "gridPos": { "h": 4, "w": 6, "x": 0, "y": 8 },
        "targets": [
          {
            "expr": "ferrite_connections_active",
            "legendFormat": "Connections"
          }
        ]
      },
      {
        "title": "Memory Usage",
        "type": "gauge",
        "gridPos": { "h": 4, "w": 6, "x": 6, "y": 8 },
        "targets": [
          {
            "expr": "ferrite_memory_used_bytes / ferrite_memory_max_bytes",
            "legendFormat": "Memory %"
          }
        ],
        "fieldConfig": {
          "defaults": {
            "max": 1,
            "thresholds": {
              "steps": [
                { "color": "green", "value": 0 },
                { "color": "yellow", "value": 0.7 },
                { "color": "red", "value": 0.9 }
              ]
            },
            "unit": "percentunit"
          }
        }
      },
      {
        "title": "Network Throughput",
        "type": "timeseries",
        "gridPos": { "h": 8, "w": 12, "x": 0, "y": 12 },
        "targets": [
          {
            "expr": "rate(ferrite_bytes_received_total[1m])",
            "legendFormat": "Received"
          },
          {
            "expr": "rate(ferrite_bytes_sent_total[1m])",
            "legendFormat": "Sent"
          }
        ],
        "fieldConfig": {
          "defaults": { "unit": "Bps" }
        }
      },
      {
        "title": "Key Operations",
        "type": "timeseries",
        "gridPos": { "h": 8, "w": 12, "x": 12, "y": 12 },
        "targets": [
          {
            "expr": "rate(ferrite_expired_keys_total[5m])",
            "legendFormat": "Expired"
          },
          {
            "expr": "rate(ferrite_evicted_keys_total[5m])",
            "legendFormat": "Evicted"
          }
        ]
      }
    ]
  }
}
```

## Key Metrics to Monitor

### Throughput

| PromQL | Description |
|--------|-------------|
| `sum(rate(ferrite_commands_total[1m]))` | Overall commands per second |
| `rate(ferrite_commands_total{command="GET"}[1m])` | GET commands per second |
| `rate(ferrite_bytes_received_total[1m])` | Inbound network throughput |
| `rate(ferrite_bytes_sent_total[1m])` | Outbound network throughput |

### Latency

| PromQL | Description |
|--------|-------------|
| `histogram_quantile(0.50, sum(rate(ferrite_command_duration_seconds_bucket[5m])) by (le))` | Median latency |
| `histogram_quantile(0.99, sum(rate(ferrite_command_duration_seconds_bucket[5m])) by (le))` | P99 latency |
| `histogram_quantile(0.999, sum(rate(ferrite_command_duration_seconds_bucket[5m])) by (le))` | P99.9 latency |

### Resource Usage

| PromQL | Description |
|--------|-------------|
| `ferrite_memory_used_bytes` | Current memory usage |
| `ferrite_memory_used_bytes / ferrite_memory_max_bytes` | Memory utilization ratio |
| `ferrite_connections_active` | Active client connections |
| `ferrite_keys_total` | Total keys stored |

### Evictions & Expirations

| PromQL | Description |
|--------|-------------|
| `rate(ferrite_expired_keys_total[5m])` | Key expiration rate |
| `rate(ferrite_evicted_keys_total[5m])` | Key eviction rate |

## Alert Configuration

### Prometheus Alerting Rules

Create a Prometheus alerting rules file for Ferrite:

```yaml title="ferrite-alerts.yml"
groups:
  - name: ferrite-alerts
    rules:
      - alert: FerriteHighLatency
        expr: histogram_quantile(0.99, sum(rate(ferrite_command_duration_seconds_bucket[5m])) by (le)) > 0.01
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Ferrite P99 latency above 10ms"
          description: "P99 command latency has been above 10ms for 5 minutes. Current value: {{ $value }}s"

      - alert: FerriteHighMemory
        expr: ferrite_memory_used_bytes / ferrite_memory_max_bytes > 0.9
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "Ferrite memory usage above 90%"
          description: "Memory usage is at {{ $value | humanizePercentage }}. Consider scaling or increasing max memory."

      - alert: FerriteConnectionSaturation
        expr: ferrite_connections_active > 1000
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Ferrite active connections above 1000"
          description: "{{ $value }} active connections. Investigate for connection leaks or increase limits."

      - alert: FerriteHighEvictionRate
        expr: rate(ferrite_evicted_keys_total[5m]) > 100
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "Ferrite key eviction rate is high"
          description: "Evicting {{ $value }} keys/sec. This may indicate memory pressure."

      - alert: FerriteDown
        expr: up{job="ferrite"} == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Ferrite instance is down"
          description: "Ferrite instance {{ $labels.instance }} has been unreachable for 1 minute."
```

### Grafana Alert Rules

You can also configure alerts directly in Grafana:

1. Open a panel → **Alert** tab
2. Set conditions (e.g., "When avg() of query(A) is above 0.01")
3. Configure notification channels (Slack, PagerDuty, email)

:::tip
Use Prometheus alerting rules for production-critical alerts and Grafana alerts for dashboard-level visibility. Prometheus rules are more reliable because they don't depend on Grafana's availability.
:::

## Best Practices

1. **Set meaningful scrape intervals** — 15s is a good default; lower intervals increase Prometheus storage
2. **Use recording rules** for expensive queries that appear on multiple dashboards
3. **Label your instances** with `environment`, `cluster`, and `role` for filtering
4. **Create separate dashboards** for overview (NOC screen) and deep-dive (debugging)
5. **Set alert thresholds** based on your SLOs, not arbitrary values

## Next Steps

- [Datadog Integration](./datadog) — Export metrics to Datadog
- [New Relic Integration](./newrelic) — Connect to New Relic
- [Observability Overview](./overview) — Full observability feature set
- [Performance Tuning](/docs/operations/performance-tuning) — Optimize based on metrics
