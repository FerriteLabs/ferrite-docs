---
title: Observability Overview
description: Overview of Ferrite's built-in observability features including Prometheus metrics, OpenTelemetry tracing, and structured logging.
sidebar_position: 1
maturity: stable
---

# Observability Overview

Ferrite ships with first-class observability support so you can monitor, trace, and debug your deployments from day one.

## Pillars of Observability

Ferrite covers the three pillars of observability out of the box:

| Pillar | Technology | Status |
|--------|-----------|--------|
| **Metrics** | Prometheus exposition format on `/metrics` | ✅ Stable |
| **Tracing** | OpenTelemetry (OTLP gRPC/HTTP) | ✅ Stable |
| **Logging** | Structured JSON logging via `tracing` crate | ✅ Stable |

## Prometheus Metrics

Ferrite exposes a Prometheus-compatible `/metrics` endpoint. Enable it in `ferrite.toml`:

```toml
[metrics]
enabled = true
bind = "0.0.0.0"
port = 9090
```

Scrape the endpoint to collect key operational metrics:

```bash
curl http://localhost:9090/metrics
```

### Key Metric Families

| Metric | Type | Description |
|--------|------|-------------|
| `ferrite_commands_total` | Counter | Total commands processed, labeled by command name |
| `ferrite_command_duration_seconds` | Histogram | Command latency distribution |
| `ferrite_connections_active` | Gauge | Current active client connections |
| `ferrite_memory_used_bytes` | Gauge | Current memory consumption |
| `ferrite_keys_total` | Gauge | Total keys stored per database |
| `ferrite_bytes_received_total` | Counter | Network bytes received |
| `ferrite_bytes_sent_total` | Counter | Network bytes sent |
| `ferrite_expired_keys_total` | Counter | Keys removed by TTL expiration |
| `ferrite_evicted_keys_total` | Counter | Keys evicted due to memory pressure |

## OpenTelemetry Integration

Ferrite can export traces and metrics via the OpenTelemetry Protocol (OTLP). This enables integration with any OTLP-compatible backend — Jaeger, Grafana Tempo, Datadog, New Relic, and more.

```toml
[otel]
enabled = true
endpoint = "http://localhost:4317"
service_name = "ferrite"
traces_enabled = true
metrics_enabled = true
```

:::tip
Use the OpenTelemetry Collector as an intermediary between Ferrite and your backend. This lets you fan-out to multiple destinations and apply processing rules without changing Ferrite's configuration.
:::

### Trace Propagation

Ferrite supports W3C Trace Context propagation. Clients that send a `traceparent` header will have their traces correlated with Ferrite operations:

```
traceparent: 00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01
```

## Structured Logging

Ferrite uses the Rust `tracing` crate for structured, leveled logging. Logs are emitted as JSON when running in production mode:

```bash
# Start with debug logging
RUST_LOG=ferrite=debug cargo run --release

# JSON output for production
RUST_LOG=ferrite=info,ferrite_core=warn cargo run --release
```

Example log output:

```json
{
  "timestamp": "2025-01-15T10:30:00.123Z",
  "level": "INFO",
  "target": "ferrite::server",
  "message": "Client connected",
  "fields": {
    "client_addr": "192.168.1.10:54321",
    "connection_id": 42
  }
}
```

:::tip
Pipe Ferrite's JSON logs into your log aggregation platform (ELK, Loki, Splunk) for centralized searching and alerting.
:::

## Integration Guides

Choose your observability platform to get started:

| Platform | Guide |
|----------|-------|
| OpenTelemetry (any OTLP backend) | [OpenTelemetry Integration](./opentelemetry) |
| Distributed Tracing | [Distributed Tracing Deep Dive](./distributed-tracing) |
| Grafana + Prometheus | [Grafana Integration](./grafana) |
| Datadog | [Datadog Integration](./datadog) |
| New Relic | [New Relic Integration](./newrelic) |

## Next Steps

- [OpenTelemetry Integration](./opentelemetry) — Full OTel setup with Collector, traces, metrics, and logs
- [Distributed Tracing Deep Dive](./distributed-tracing) — Sampling strategies, baggage, and APM integrations
- [Grafana Integration](./grafana) — Set up dashboards and alerts with Grafana
- [Datadog Integration](./datadog) — Export metrics and traces to Datadog
- [New Relic Integration](./newrelic) — Connect Ferrite to New Relic
- [Monitoring](/docs/operations/monitoring) — Built-in monitoring commands
- [Performance Tuning](/docs/operations/performance-tuning) — Optimize Ferrite performance
