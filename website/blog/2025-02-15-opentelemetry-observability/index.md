---
slug: opentelemetry-observability
title: "Observability in Ferrite: First-Class OpenTelemetry Support"
authors: [ferrite-team]
tags: [observability, opentelemetry, operations, monitoring]
description: How Ferrite integrates with OpenTelemetry to provide production-grade traces, metrics, and logs via OTLP, and how to set up a complete observability stack.
---

Running a database in production without deep observability is flying blind. Today we are announcing first-class OpenTelemetry support in Ferrite, giving operators traces, metrics, and structured logs through a single, vendor-neutral protocol.

<!-- truncate -->

## Why OpenTelemetry?

Redis has historically offered a fragmented observability story. You get `INFO` command output, `SLOWLOG`, Prometheus-scrapeable metrics through an exporter sidecar, and separate tooling for tracing. Each piece requires its own configuration, its own pipeline, and its own mental model.

OpenTelemetry (OTel) unifies all three signals -- traces, metrics, and logs -- under one SDK, one protocol (OTLP), and one ecosystem of backends. Rather than bolting on observability after the fact, we built it into Ferrite from the ground up.

## What Ferrite Exports

When you enable the `otel` feature flag, Ferrite exposes the following telemetry:

### Metrics

All metrics are exported via OTLP and follow the [Semantic Conventions for databases](https://opentelemetry.io/docs/specs/semconv/database/):

| Metric | Type | Description |
|--------|------|-------------|
| `ferrite.commands.total` | Counter | Total commands processed, by command name |
| `ferrite.commands.duration` | Histogram | Latency per command (ns buckets) |
| `ferrite.connections.active` | UpDownCounter | Current client connections |
| `ferrite.memory.used_bytes` | Gauge | Memory consumed by the mutable region |
| `ferrite.storage.tier_hits` | Counter | Reads served per tier (hot/warm/cold) |
| `ferrite.replication.lag_bytes` | Gauge | Replication lag on replicas |

### Traces

Every command execution emits a span with attributes including the key pattern, tier hit, and result status. For multi-key operations like `MGET`, child spans capture per-key tier resolution:

```
Trace: MGET user:1 user:2 user:3
├─ span: mget (3 keys)
│  ├─ span: resolve user:1  [tier=hot, 120ns]
│  ├─ span: resolve user:2  [tier=warm, 1.4μs]
│  └─ span: resolve user:3  [tier=cold, 62μs]
```

### Structured Logs

Ferrite emits structured JSON logs through the `tracing` crate, correlated with trace and span IDs. This means you can jump from a slow-query alert to the exact trace that triggered it.

## Setting Up a Full Observability Stack

Here is a production-ready setup using Docker Compose with the OpenTelemetry Collector, Jaeger for traces, Prometheus for metrics, and Grafana for dashboards.

```yaml
# docker-compose.observability.yml
version: "3.9"
services:
  ferrite:
    image: ghcr.io/ferrite-rs/ferrite:latest
    environment:
      FERRITE_OTEL_ENDPOINT: "http://otel-collector:4317"
      FERRITE_OTEL_SERVICE_NAME: "ferrite-prod"
    ports:
      - "6379:6379"

  otel-collector:
    image: otel/opentelemetry-collector-contrib:0.96.0
    volumes:
      - ./otel-config.yaml:/etc/otelcol/config.yaml
    ports:
      - "4317:4317"   # OTLP gRPC
      - "4318:4318"   # OTLP HTTP

  jaeger:
    image: jaegertracing/all-in-one:1.54
    ports:
      - "16686:16686" # Jaeger UI

  prometheus:
    image: prom/prometheus:v2.51.0
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml

  grafana:
    image: grafana/grafana:10.4.0
    ports:
      - "3000:3000"
    volumes:
      - ./grafana/dashboards:/var/lib/grafana/dashboards
```

The collector configuration routes each signal to the appropriate backend:

```yaml
# otel-config.yaml
receivers:
  otlp:
    protocols:
      grpc:
        endpoint: 0.0.0.0:4317

exporters:
  jaeger:
    endpoint: jaeger:14250
    tls:
      insecure: true
  prometheusremotewrite:
    endpoint: "http://prometheus:9090/api/v1/write"

service:
  pipelines:
    traces:
      receivers: [otlp]
      exporters: [jaeger]
    metrics:
      receivers: [otlp]
      exporters: [prometheusremotewrite]
```

We ship a ready-to-import Grafana dashboard in the `ferrite-ops` repository under `grafana/dashboards/ferrite-overview.json`. It includes panels for command throughput, tier hit ratios, latency percentiles, memory usage, and replication health.

## Comparison with Redis Observability

| Capability | Redis | Ferrite |
|------------|-------|---------|
| Metrics export | External exporter sidecar | Native OTLP, no sidecar needed |
| Distributed tracing | Not supported | Full OTLP traces with span correlation |
| Structured logs | Plain text | JSON with trace/span ID correlation |
| Vendor lock-in | Prometheus-only (exporter) | Any OTLP-compatible backend |
| Per-command tracing | `SLOWLOG` only | Every command, with tier attribution |

The biggest advantage is trace correlation. When a slow API response originates from a cold-tier cache miss, you can follow the trace from your application through the Ferrite span and see exactly which tier served each key.

## Performance Impact

Observability should never be the reason your database slows down. We benchmarked Ferrite with OTel enabled versus disabled on an 8-core AMD EPYC, 32 GB RAM, NVMe SSD:

| Configuration | GET throughput | SET throughput | P99 latency overhead |
|---------------|---------------|---------------|----------------------|
| OTel disabled | 11.8M ops/s | 2.6M ops/s | baseline |
| OTel enabled (metrics only) | 11.6M ops/s | 2.55M ops/s | +8ns |
| OTel enabled (metrics + traces, 10% sampling) | 11.2M ops/s | 2.48M ops/s | +22ns |
| OTel enabled (all signals, 100% sampling) | 10.1M ops/s | 2.30M ops/s | +45ns |

At 10% trace sampling -- the typical production setting -- the overhead is under 2% on throughput and adds roughly 22 ns to P99 latency. For most workloads, this is well within noise.

The key to low overhead is our use of the `tracing` crate's compile-time filtering and lock-free span collection. Metrics use atomic counters with no allocation on the hot path.

## Enabling OTel in Your Deployment

If you are building from source, compile with the `otel` feature:

```bash
cargo build --release --features otel
```

Then configure via environment variables or `ferrite.toml`:

```toml
[telemetry]
enabled = true
otlp_endpoint = "http://localhost:4317"
service_name = "ferrite-prod"
trace_sample_rate = 0.1
metrics_interval_seconds = 15
```

For Kubernetes deployments, the Helm chart in `ferrite-ops` includes a `telemetry` values section that wires everything up, including auto-discovery of an in-cluster OTel Collector.

## What Is Next

We are working on adaptive sampling that automatically increases trace collection for slow or errored commands, and on a built-in diagnostics endpoint that serves a flame graph of recent operations without any external tooling.

If you run into issues or have feature requests for our OTel integration, open an issue on [GitHub](https://github.com/ferrite-rs/ferrite) or reach out on [Discord](https://discord.gg/ferrite).

---

*The speed of memory, the capacity of disk, the economics of cloud.*
