---
sidebar_position: 6
title: Kubernetes Sidecar Mode
description: Deploy Ferrite as a sidecar cache container alongside your application pods for ultra-low-latency, application-scoped caching on Kubernetes.
keywords: [kubernetes, sidecar, cache, helm, injection, webhook, low-latency]
maturity: experimental
---

# Kubernetes Sidecar Mode

Deploy Ferrite as a sidecar container for per-pod, localhost-only caching with zero network latency.

## Overview

The sidecar pattern runs a dedicated Ferrite instance inside each application pod. Instead of routing cache requests over the network to a centralized cluster, your application connects to `localhost:6379` — eliminating network hops, DNS lookups, and shared-cache contention.

**Key benefits:**

- **Ultra-low latency** — localhost TCP, typically under 0.1ms round-trip
- **Application-scoped data** — each pod has its own isolated cache
- **No single point of failure** — cache failures are scoped to one pod
- **Zero configuration for apps** — always connect to `localhost:6379`
- **Simplified networking** — no Service, no NetworkPolicy for cache traffic

## Architecture

```
┌──────────────────────────────────────────────────┐
│                  Kubernetes Node                  │
│                                                   │
│  ┌─────────────────────────────────────────────┐  │
│  │               Pod (app-abc-1)               │  │
│  │  ┌─────────────────┐  ┌──────────────────┐  │  │
│  │  │   Application   │  │ Ferrite Sidecar  │  │  │
│  │  │   Container     │─▶│ (memory-only)    │  │  │
│  │  │                 │  │ localhost:6379    │  │  │
│  │  └─────────────────┘  └──────────────────┘  │  │
│  └─────────────────────────────────────────────┘  │
│                                                   │
│  ┌─────────────────────────────────────────────┐  │
│  │               Pod (app-abc-2)               │  │
│  │  ┌─────────────────┐  ┌──────────────────┐  │  │
│  │  │   Application   │  │ Ferrite Sidecar  │  │  │
│  │  │   Container     │─▶│ (memory-only)    │  │  │
│  │  │                 │  │ localhost:6379    │  │  │
│  │  └─────────────────┘  └──────────────────┘  │  │
│  └─────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────┘
```

Each pod runs its own Ferrite instance. Data is **not shared** between pods — this is by design for use cases where application-local caching is preferred.

## Installation

### Prerequisites

- Kubernetes 1.24+
- Helm 3.x

### Install the Sidecar Chart

```bash
# Add the Ferrite Helm repository
helm repo add ferrite https://charts.ferrite.io
helm repo update

# Install the sidecar chart (creates the ConfigMap and optional webhook)
helm install ferrite-cache ferrite/ferrite-sidecar \
  --namespace my-app
```

### Manual Sidecar Injection

Add the Ferrite sidecar directly to your Deployment spec:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-app
spec:
  replicas: 3
  template:
    spec:
      containers:
        - name: my-app
          image: my-app:latest
          env:
            - name: REDIS_URL
              value: "redis://localhost:6379"
        - name: ferrite-sidecar
          image: ghcr.io/ferritelabs/ferrite:0.1.0
          ports:
            - containerPort: 6379
              name: ferrite
          resources:
            limits:
              cpu: 250m
              memory: 256Mi
            requests:
              cpu: 50m
              memory: 64Mi
          securityContext:
            runAsNonRoot: true
            runAsUser: 1000
            readOnlyRootFilesystem: true
          volumeMounts:
            - name: ferrite-config
              mountPath: /etc/ferrite
          livenessProbe:
            tcpSocket:
              port: 6379
            initialDelaySeconds: 5
            periodSeconds: 10
          readinessProbe:
            tcpSocket:
              port: 6379
            initialDelaySeconds: 3
            periodSeconds: 5
      volumes:
        - name: ferrite-config
          configMap:
            name: ferrite-cache-ferrite-sidecar
```

### Automatic Injection (Webhook)

Enable the mutating webhook to inject the sidecar automatically into annotated pods:

```bash
helm install ferrite-cache ferrite/ferrite-sidecar \
  --namespace ferrite-system \
  --set injector.enabled=true
```

Label the target namespace:

```bash
kubectl label namespace my-app ferrite-sidecar-injection=enabled
```

Annotate pods that should receive the sidecar:

```yaml
metadata:
  annotations:
    ferrite.dev/inject-sidecar: "true"
```

:::tip
Automatic injection keeps your application manifests clean — no need to modify every Deployment. Just annotate and deploy.
:::

## Configuration Options

### Helm Values

| Parameter | Description | Default |
|-----------|-------------|---------|
| `ferrite.port` | Listen port | `6379` |
| `ferrite.maxMemory` | Maximum memory (bytes) | `134217728` (128 MB) |
| `ferrite.maxConnections` | Max client connections | `128` |
| `ferrite.evictionPolicy` | Eviction policy | `allkeys-lru` |
| `ferrite.databases` | Number of databases | `4` |
| `resources.limits.memory` | Container memory limit | `256Mi` |
| `resources.limits.cpu` | Container CPU limit | `250m` |
| `injector.enabled` | Enable auto-injection webhook | `false` |
| `injector.failurePolicy` | Webhook failure policy | `Ignore` |
| `persistence.enabled` | Enable disk persistence | `false` |

### Sidecar Configuration

The generated ConfigMap uses a minimal configuration optimized for sidecar mode:

```toml
[server]
bind = "127.0.0.1"     # Localhost only — not reachable from other pods
port = 6379
max_connections = 128

[storage]
databases = 4
max_memory = "134217728"  # 128 MB
backend = "memory"        # No disk storage
eviction_policy = "allkeys-lru"

[persistence]
aof_enabled = false       # No AOF — memory-only cache
checkpoint_enabled = false
```

:::note
The sidecar binds to `127.0.0.1` by default. This means only containers within the same pod can access it — providing implicit network isolation without NetworkPolicies.
:::

### Tuning Memory

Set `ferrite.maxMemory` and `resources.limits.memory` together. The container memory limit should be ~2x the Ferrite max memory to allow headroom for connection buffers and internal overhead:

```bash
helm install ferrite-cache ferrite/ferrite-sidecar \
  --set ferrite.maxMemory="268435456" \
  --set resources.limits.memory="512Mi"
```

## Use Cases

### Session Cache

Store user session data locally. Each pod caches sessions for the users it serves — ideal for sticky-session load balancing:

```python
import redis

cache = redis.Redis(host="localhost", port=6379)
cache.setex(f"session:{session_id}", 3600, session_data)
```

### Rate Limiting

Per-pod rate limit counters. Since each pod tracks its own counters, the effective rate limit scales with replica count:

```python
key = f"ratelimit:{client_ip}"
current = cache.incr(key)
if current == 1:
    cache.expire(key, 60)
if current > 100:
    raise RateLimitExceeded()
```

### Feature Flags

Cache feature flag evaluations locally to avoid repeated calls to your feature flag service:

```python
flags = cache.get("feature_flags")
if not flags:
    flags = feature_service.get_all_flags()
    cache.setex("feature_flags", 30, json.dumps(flags))
```

### Request Deduplication

Track recently processed request IDs to prevent duplicate processing:

```python
if cache.set(f"dedup:{request_id}", "1", nx=True, ex=300):
    process_request(request)  # First time seeing this ID
```

## Sidecar vs. Centralized Cluster

| Aspect | Sidecar | Centralized Cluster |
|--------|---------|---------------------|
| **Latency** | Under 0.1ms (localhost) | 0.5–2ms (network) |
| **Data sharing** | Per-pod isolated | Shared across all clients |
| **Failure blast radius** | Single pod | All clients |
| **Memory efficiency** | Duplicated per pod | Shared pool |
| **Consistency** | Eventually consistent (per-pod) | Strong (single source) |
| **Best for** | Local caching, rate limiting | Shared sessions, pub/sub |
| **Scaling** | Scales with app replicas | Independent scaling |
| **Operational overhead** | Low (no separate infra) | Higher (dedicated cluster) |

:::info When to use which
**Use sidecar** when each pod only needs its own cached data — computation results, rate limits, local sessions.

**Use a centralized cluster** when pods need to share state — distributed locks, pub/sub, shared sessions across pods.
:::

## Resource Recommendations

| Workload | Memory Limit | CPU Limit | Max Memory (Ferrite) |
|----------|-------------|-----------|---------------------|
| Light (feature flags, config) | 128Mi | 100m | 64 MB |
| Medium (session cache) | 256Mi | 250m | 128 MB |
| Heavy (rate limiting, dedup) | 512Mi | 500m | 256 MB |

:::warning
Keep sidecar resources small. The goal is a lightweight local cache — if you need more than 512 MB, consider a centralized Ferrite cluster instead.
:::

## Troubleshooting

### Verify the Sidecar is Running

```bash
kubectl get pods -l app=my-app -o jsonpath='{.items[*].spec.containers[*].name}'
# Should list: my-app ferrite-sidecar
```

### Test Connectivity from the App Container

```bash
kubectl exec -it my-app-pod -c my-app -- \
  sh -c 'echo PING | nc localhost 6379'
# Expected: +PONG
```

### Check Sidecar Logs

```bash
kubectl logs my-app-pod -c ferrite-sidecar
```

## Next Steps

- [Kubernetes Deployment](/docs/deployment/kubernetes) — Full cluster deployment
- [High Availability](/docs/deployment/high-availability) — HA patterns
- [Docker](/docs/deployment/docker) — Container basics
