---
sidebar_position: 20
maturity: stable
---

# Cloud-Native Deployment Overview

This guide covers deploying and operating Ferrite in cloud-native environments using Kubernetes, Helm, Prometheus, and Grafana. By the end, you'll have a production-grade deployment with full observability.

## Why Cloud-Native Ferrite?

Ferrite is designed from the ground up to run as a high-performance, stateful service in modern cloud infrastructure. Its cloud-native features include:

- **Prometheus metrics** — Built-in `/metrics` endpoint with 60+ metrics covering latency, throughput, memory tiers, and replication
- **Health check endpoints** — Liveness, readiness, and startup probes via `PING` command
- **Graceful shutdown** — Clean connection draining on `SIGTERM` with configurable drain timeout
- **Configuration via files and environment** — 12-factor app compatible with TOML config and env var overrides
- **Stateful storage** — Persistent volumes for AOF and checkpoint data with configurable sync policies
- **Horizontal scaling** — Cluster mode for distributing data across nodes with automatic slot migration
- **Resource limits** — Memory backpressure system that rejects writes before OOM kills

## Architecture Overview

A typical cloud-native Ferrite deployment consists of a StatefulSet for data persistence, headless Service for peer discovery, and a monitoring stack:

```text
┌─────────────────────────────────────────────────────────────────┐
│                      Kubernetes Cluster                        │
│                                                                 │
│  ┌────────────────────────────────┐  ┌───────────────────────┐  │
│  │  Ferrite StatefulSet (HA)     │  │  Monitoring Stack     │  │
│  │                                │  │                       │  │
│  │  ┌─────────┐  ┌─────────┐     │  │  ┌────────────┐       │  │
│  │  │ Pod 0   │  │ Pod 1   │     │  │  │ Prometheus │       │  │
│  │  │ Primary │  │ Replica │     │  │  │ scrape /   │       │  │
│  │  │ :6379   │──│ :6379   │     │  │  │ metrics    │       │  │
│  │  │ :9090   │  │ :9090   │─────│──│──│ :9090      │       │  │
│  │  └────┬────┘  └────┬────┘     │  │  └─────┬──────┘       │  │
│  │  ┌────▼────┐  ┌────▼────┐     │  │  ┌─────▼──────┐       │  │
│  │  │ PVC 0   │  │ PVC 1   │     │  │  │  Grafana   │       │  │
│  │  │ 10Gi    │  │ 10Gi    │     │  │  │  6 dashbds │       │  │
│  │  └─────────┘  └─────────┘     │  │  └────────────┘       │  │
│  └────────────────────────────────┘  └───────────────────────┘  │
│                                                                 │
│  ┌────────────────────┐  ┌─────────────────────────────┐        │
│  │  Services          │  │  Security                   │        │
│  │  ferrite (TCP)     │  │  NetworkPolicy              │        │
│  │  ferrite-headless  │  │  PodDisruptionBudget        │        │
│  │  ferrite-metrics   │  │  ServiceAccount + RBAC      │        │
│  └────────────────────┘  └─────────────────────────────┘        │
└─────────────────────────────────────────────────────────────────┘
```

## Quick Start with Helm

The fastest way to deploy Ferrite on Kubernetes is with the official Helm chart from `ferrite-ops`:

```bash
# Add the Ferrite Helm repository
helm repo add ferrite https://ferritelabs.github.io/ferrite-ops
helm repo update

# Deploy with defaults (single node, suitable for development)
helm install ferrite ferrite/ferrite

# Verify the deployment
kubectl get pods -l app.kubernetes.io/name=ferrite
kubectl exec -it ferrite-0 -- ferrite-cli PING
# => PONG
```

### High Availability Deployment

For production, deploy with the HA values that configure primary/replica replication:

```bash
helm install ferrite ferrite/ferrite \
  --values ferrite-ops/charts/ferrite/values-ha.yaml \
  --set persistence.size=50Gi \
  --set resources.requests.memory=4Gi \
  --set resources.limits.memory=8Gi
```

This creates:
- **3 pods**: 1 primary + 2 replicas
- **Pod anti-affinity**: Spread across failure domains
- **PodDisruptionBudget**: Minimum 2 available during maintenance
- **Automatic failover**: Replicas promote on primary failure

### Custom Configuration

Override specific values for your environment:

```bash
helm install ferrite ferrite/ferrite \
  --set ferrite.maxMemory="4GB" \
  --set ferrite.evictionPolicy="allkeys-lru" \
  --set ferrite.persistence.aof.enabled=true \
  --set ferrite.persistence.aof.fsync="everysec" \
  --set tls.enabled=true \
  --set tls.certManager.enabled=true \
  --set metrics.serviceMonitor.enabled=true
```

## Monitoring & Observability

### Prometheus Integration

Ferrite exposes Prometheus-compatible metrics on port 9090. The Helm chart includes a `ServiceMonitor` for automatic scrape configuration:

```bash
# Enable ServiceMonitor (requires Prometheus Operator)
helm upgrade ferrite ferrite/ferrite \
  --set metrics.serviceMonitor.enabled=true

# Verify metrics are being scraped
kubectl port-forward svc/ferrite-metrics 9090:9090
curl http://localhost:9090/metrics | head -20
```

**Key metrics to monitor:**

| Metric | Type | Description |
|--------|------|-------------|
| `ferrite_commands_total` | Counter | Total commands processed |
| `ferrite_command_latency_seconds` | Histogram | Per-command latency (p50/p99/p99.9) |
| `ferrite_connected_clients` | Gauge | Active client connections |
| `ferrite_memory_used_bytes` | Gauge | Memory usage by tier (hot/warm/cold) |
| `ferrite_keyspace_hits_total` | Counter | Cache hit count |
| `ferrite_keyspace_misses_total` | Counter | Cache miss count |
| `ferrite_replication_lag_seconds` | Gauge | Replica sync lag |

### Grafana Dashboards

Import the pre-built dashboards from `ferrite-ops/grafana/`:

```bash
# Port-forward Grafana
kubectl port-forward svc/grafana 3000:3000

# Import dashboards via Grafana UI or provisioning
# Available dashboards:
# - ferrite-dashboard.json      (27 panels, general overview)
# - ferrite-cluster.json        (8 panels, cluster topology)
# - ferrite-memory-tiers.json   (6 panels, HybridLog tiers)
# - ferrite-query-performance.json (10 panels, latency breakdown)
# - ferrite-streaming.json      (6 panels, CDC/streaming)
# - ferrite-vector.json         (6 panels, vector search)
```

### Alerting

The Helm chart includes PrometheusRule resources with 25+ alert rules:

```bash
# Enable alert rules
helm upgrade ferrite ferrite/ferrite \
  --set metrics.prometheusRule.enabled=true
```

Critical alerts include:
- **FerriteDown** — Instance unreachable for >1 minute
- **FerriteHighMemoryUsage** — Memory >85% (warning), >95% (critical)
- **FerriteHighLatencyP99** — p99 latency >5ms
- **FerriteReplicationLag** — Replica lag >10 seconds
- **FerriteClusterStateNotOk** — Cluster health degraded

Each alert links to operational runbooks in `ferrite-ops/monitoring/runbooks/`.

## Service Mesh Integration

Ferrite works with popular service meshes. For Istio:

```yaml
# Exclude the Redis port from Istio sidecar proxying
# (TCP protocol, latency-sensitive)
apiVersion: v1
kind: Pod
metadata:
  annotations:
    traffic.sidecar.istio.io/excludeInboundPorts: "6379"
    traffic.sidecar.istio.io/excludeOutboundPorts: "6379"
```

For Linkerd, use the `config.linkerd.io/skip-inbound-ports` annotation similarly.

## Auto-Scaling

The Helm chart supports Horizontal Pod Autoscaler with custom metrics:

```bash
helm upgrade ferrite ferrite/ferrite \
  --set autoscaling.enabled=true \
  --set autoscaling.minReplicas=2 \
  --set autoscaling.maxReplicas=10 \
  --set autoscaling.targetCPUUtilization=70 \
  --set autoscaling.targetMemoryUtilization=80
```

For scaling based on Ferrite-specific metrics (e.g., connections, ops/sec), configure the Prometheus Adapter:

```yaml
# Custom metrics rule for HPA
rules:
  - seriesQuery: 'ferrite_connected_clients'
    resources:
      overrides:
        namespace: {resource: "namespace"}
        pod: {resource: "pod"}
    metricsQuery: 'avg(ferrite_connected_clients{<<.LabelMatchers>>})'
```

## GitOps Deployment

The `ferrite-ops/gitops/` directory provides ready-to-use configurations for three GitOps workflows:

### ArgoCD

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: ferrite
spec:
  source:
    repoURL: https://github.com/ferritelabs/ferrite-ops
    path: charts/ferrite
    helm:
      valueFiles:
        - values.yaml
        - values-ha.yaml  # For HA deployments
  destination:
    namespace: ferrite
```

### Flux

```yaml
apiVersion: helm.toolkit.fluxcd.io/v2beta1
kind: HelmRelease
metadata:
  name: ferrite
spec:
  chart:
    spec:
      chart: ferrite
      sourceRef:
        kind: HelmRepository
        name: ferrite
  values:
    replicaCount: 3
```

### Kustomize

```bash
# Use the production overlay
kubectl apply -k ferrite-ops/gitops/kustomize/overlays/production/
```

## Backup & Disaster Recovery

Schedule automated backups using the built-in CronJob:

```bash
helm upgrade ferrite ferrite/ferrite \
  --set backup.enabled=true \
  --set backup.schedule="0 2 * * *" \
  --set backup.s3.bucket=ferrite-backups \
  --set backup.s3.region=us-east-1 \
  --set backup.retention.days=30
```

For manual backup and restore, use the scripts in `ferrite-ops/scripts/`:

```bash
# Manual backup
./ferrite-ops/scripts/backup.sh --compress --s3-bucket ferrite-backups

# Restore from backup
./ferrite-ops/scripts/restore.sh --source s3://ferrite-backups/latest.tar.gz
```

## Tutorial Series

For step-by-step instructions, follow these tutorials:

1. **[Kubernetes Deployment](./kubernetes-deployment.md)** — Deploy Ferrite with Helm, configure persistence and scaling
2. **[Monitoring with Grafana](./monitoring-grafana.md)** — Set up Prometheus + Grafana with pre-built dashboards
3. **[Production Checklist](./production-checklist.md)** — Security hardening, persistence, HA, and monitoring verification

## Prerequisites

Before starting, ensure you have:

- **Kubernetes cluster** (v1.24+) — local (minikube, kind) or cloud (EKS, GKE, AKS)
- **Helm** (v3.10+) — Kubernetes package manager
- **kubectl** — configured to access your cluster
- **ferrite-ops repository** — cloned locally for Helm charts and Grafana dashboards

```bash
# Verify prerequisites
kubectl version --client
helm version
kubectl cluster-info

# Clone ferrite-ops
git clone https://github.com/ferritelabs/ferrite-ops.git
```

## Next Steps

- Start with [Kubernetes Deployment](./kubernetes-deployment.md) for your first Ferrite cluster
- Review the [Production Checklist](./production-checklist.md) before going live
- Explore [High Availability](/docs/advanced/clustering) for multi-node deployments
