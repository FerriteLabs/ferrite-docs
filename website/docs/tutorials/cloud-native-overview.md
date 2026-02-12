---
sidebar_position: 20
maturity: experimental
---

# Cloud-Native Deployment Overview

This tutorial series covers deploying and operating Ferrite in cloud-native environments using Kubernetes, Prometheus, and Grafana.

## Why Cloud-Native Ferrite?

Ferrite is designed to run as a high-performance, stateful service in modern infrastructure. Its cloud-native features include:

- **Prometheus metrics** — Built-in `/metrics` endpoint for observability
- **Health check endpoints** — Liveness, readiness, and startup probes via `PING`
- **Graceful shutdown** — Clean connection draining on `SIGTERM`
- **Configuration via files and environment** — 12-factor app compatible
- **Stateful storage** — Persistent volumes for AOF and checkpoint data
- **Horizontal scaling** — Cluster mode for distributing data across nodes

## Architecture Overview

A typical cloud-native Ferrite deployment consists of:

```
┌─────────────────────────────────────────────────┐
│                  Kubernetes Cluster              │
│                                                  │
│  ┌──────────────┐  ┌──────────────────────────┐  │
│  │  Ferrite      │  │  Monitoring Stack        │  │
│  │  StatefulSet  │  │                          │  │
│  │  ┌─────────┐  │  │  ┌────────────┐          │  │
│  │  │ Pod 0   │  │  │  │ Prometheus │──scrape──│──┤
│  │  │ :6379   │  │  │  └────────────┘          │  │
│  │  │ :9090   │──│──│──────────┐               │  │
│  │  └─────────┘  │  │  ┌──────▼─────┐          │  │
│  │  ┌─────────┐  │  │  │  Grafana   │          │  │
│  │  │ PVC     │  │  │  │  Dashboard │          │  │
│  │  │ 10Gi    │  │  │  └────────────┘          │  │
│  │  └─────────┘  │  └──────────────────────────┘  │
│  └──────────────┘                                │
│                                                  │
│  ┌──────────────────────┐                        │
│  │  Service             │                        │
│  │  ferrite:6379 (TCP)  │                        │
│  │  metrics:9090 (HTTP) │                        │
│  └──────────────────────┘                        │
└─────────────────────────────────────────────────┘
```

## Tutorial Series

This series guides you through a complete cloud-native deployment:

### 1. [Kubernetes Deployment](./kubernetes-deployment.md)

Deploy Ferrite to Kubernetes using the official Helm chart from `ferrite-ops`. Covers:
- Prerequisites and cluster setup
- Helm chart installation and configuration
- Persistent storage setup
- Scaling and high availability

### 2. [Monitoring with Grafana](./monitoring-grafana.md)

Set up comprehensive monitoring with Prometheus and Grafana. Covers:
- Prometheus metrics collection
- Importing the pre-built Grafana dashboard
- Key metrics to watch
- Alerting rules for production

### 3. [Production Checklist](./production-checklist.md)

Ensure your deployment is production-ready. Covers:
- Security hardening (TLS, ACLs, network policies)
- Persistence and backup strategy
- Resource limits and tuning
- High availability configuration
- Monitoring and alerting verification

## Prerequisites

Before starting the tutorials, ensure you have:

- **Kubernetes cluster** (v1.24+) — local (minikube, kind) or cloud (EKS, GKE, AKS)
- **Helm** (v3.10+) — Kubernetes package manager
- **kubectl** — configured to access your cluster
- **ferrite-ops repository** — cloned locally for Helm charts and Grafana dashboards

```bash
# Verify prerequisites
kubectl version --client
helm version
kubectl cluster-info

# Clone ferrite-ops if you haven't already
git clone https://github.com/ferritelabs/ferrite-ops.git
```

## Quick Start

For those who want to get running quickly:

```bash
# Deploy Ferrite with defaults
helm install ferrite ./ferrite-ops/charts/ferrite

# Verify it's running
kubectl get pods -l app.kubernetes.io/name=ferrite
kubectl exec -it ferrite-0 -- ferrite-cli PING
```

Then follow each tutorial for production-grade configuration.

## Next Steps

Start with [Kubernetes Deployment](./kubernetes-deployment.md) to deploy your first Ferrite instance on Kubernetes.
