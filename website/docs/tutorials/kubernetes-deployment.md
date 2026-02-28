---
sidebar_position: 21
maturity: beta
---

# Kubernetes Deployment

This tutorial walks through deploying Ferrite to Kubernetes using the official Helm chart from the `ferrite-ops` repository.

## Prerequisites

- Kubernetes cluster v1.24+
- Helm v3.10+
- `kubectl` configured for your cluster
- `ferrite-ops` repository cloned locally

```bash
git clone https://github.com/ferritelabs/ferrite-ops.git
```

## Step 1: Install with Helm

### Basic Installation

```bash
# Install with default values
helm install ferrite ./ferrite-ops/charts/ferrite

# Verify the deployment
kubectl get pods -l app.kubernetes.io/name=ferrite
kubectl get svc -l app.kubernetes.io/name=ferrite
```

### Custom Values

Create a `values-production.yaml` file to override defaults:

```yaml
# values-production.yaml
replicaCount: 1

resources:
  limits:
    cpu: 2000m
    memory: 4Gi
  requests:
    cpu: 500m
    memory: 1Gi

ferrite:
  server:
    bind: "0.0.0.0"
    maxConnections: 10000
    tcpKeepalive: 300

  storage:
    maxMemory: "2147483648"  # 2GB
    backend: "hybridlog"

  persistence:
    aofEnabled: true
    aofSync: "everysec"
    checkpointEnabled: true
    checkpointInterval: "5m"

  logging:
    level: "info"
    format: "json"

  metrics:
    enabled: true

persistence:
  enabled: true
  storageClassName: "gp3"  # Adjust for your cloud provider
  size: 50Gi

serviceMonitor:
  enabled: true
  interval: 15s
```

```bash
helm install ferrite ./ferrite-ops/charts/ferrite -f values-production.yaml
```

## Step 2: Verify the Deployment

```bash
# Check pod status
kubectl get pods -l app.kubernetes.io/name=ferrite -w

# Check logs
kubectl logs ferrite-0

# Test connectivity
kubectl exec -it ferrite-0 -- ferrite-cli PING
# Expected: PONG

# Run preflight diagnostics inside the pod
kubectl exec -it ferrite-0 -- ferrite doctor

# Check server info
kubectl exec -it ferrite-0 -- ferrite-cli INFO server
```

## Step 3: Configure Persistent Storage

The Helm chart uses a `StatefulSet` with `volumeClaimTemplates` for stable persistent storage. Each pod gets its own PersistentVolumeClaim.

### Storage Classes by Provider

| Cloud Provider | Recommended Storage Class | Notes |
|---------------|--------------------------|-------|
| AWS EKS | `gp3` | General purpose SSD, good balance |
| GCP GKE | `premium-rwo` | SSD persistent disk |
| Azure AKS | `managed-premium` | Premium SSD |
| Local/Bare Metal | `local-path` | For development only |

```yaml
# values-production.yaml
persistence:
  enabled: true
  storageClassName: "gp3"
  accessModes:
    - ReadWriteOnce
  size: 50Gi
```

### Data Layout

Inside the pod, Ferrite stores data at `/var/lib/ferrite/data`, mounted from the PVC:

```text
/var/lib/ferrite/data/
├── appendonly.aof        # Append-only file for durability
├── checkpoint/           # Periodic checkpoint files
└── hybridlog/            # HybridLog tier data (if using hybridlog backend)
```

## Step 4: Expose the Service

### Internal Access (ClusterIP — Default)

The default `ClusterIP` service is accessible within the cluster:

```bash
# From another pod in the same namespace
redis-cli -h ferrite -p 6379 PING

# From another namespace
redis-cli -h ferrite.default.svc.cluster.local -p 6379 PING
```

### External Access (LoadBalancer)

```yaml
# values-production.yaml
service:
  type: LoadBalancer
  port: 6379
  annotations:
    # AWS NLB example
    service.beta.kubernetes.io/aws-load-balancer-type: "nlb"
    service.beta.kubernetes.io/aws-load-balancer-scheme: "internal"
```

### External Access (NodePort)

```yaml
service:
  type: NodePort
  port: 6379
  nodePort: 30379
```

## Step 5: Health Checks and Probes

The Helm chart configures three probes that use `ferrite-cli PING`:

### Startup Probe

Gives Ferrite time to load data from disk on initial boot. With default settings, allows up to 5 minutes for startup (30 retries × 10s period).

```yaml
startupProbe:
  enabled: true
  initialDelaySeconds: 10
  periodSeconds: 10
  failureThreshold: 30
```

### Readiness Probe

Controls when the pod receives traffic. Ferrite is marked ready once it responds to `PING`.

```yaml
readinessProbe:
  enabled: true
  initialDelaySeconds: 5
  periodSeconds: 5
  failureThreshold: 3
```

### Liveness Probe

Restarts the pod if Ferrite becomes unresponsive.

```yaml
livenessProbe:
  enabled: true
  initialDelaySeconds: 30
  periodSeconds: 10
  failureThreshold: 3
```

## Scaling Considerations

### Vertical Scaling

Increase resources for a single instance to handle more data and connections:

```yaml
resources:
  limits:
    cpu: 4000m
    memory: 16Gi
  requests:
    cpu: 2000m
    memory: 8Gi

ferrite:
  storage:
    maxMemory: "8589934592"  # 8GB
  server:
    maxConnections: 50000
```

### Horizontal Scaling with Cluster Mode

For datasets that exceed a single node's capacity, enable cluster mode:

```yaml
replicaCount: 3

cluster:
  enabled: true
  port: 16379
```

With cluster mode, data is automatically sharded across nodes using hash slots.

### Replication for High Availability

For read scaling and failover, deploy primary-replica sets:

```yaml
replication:
  enabled: true
  role: "primary"
```

Deploy replicas pointing to the primary:

```yaml
# values-replica.yaml
replication:
  enabled: true
  role: "replica"
  primaryHost: "ferrite-primary"
  primaryPort: 6379
```

## Upgrading

### Rolling Updates

Helm handles rolling updates for StatefulSets. Update your values and run:

```bash
helm upgrade ferrite ./ferrite-ops/charts/ferrite -f values-production.yaml
```

### Version Upgrades

When upgrading Ferrite versions, update the image tag:

```yaml
image:
  tag: "0.2.0"
```

```bash
helm upgrade ferrite ./ferrite-ops/charts/ferrite -f values-production.yaml
```

Monitor the rollout:

```bash
kubectl rollout status statefulset/ferrite
```

## Pod Disruption Budget

For production, enable a PodDisruptionBudget to prevent all pods from being evicted simultaneously:

```yaml
podDisruptionBudget:
  enabled: true
  minAvailable: 1
```

## Namespace and RBAC

Deploy Ferrite in a dedicated namespace:

```bash
kubectl create namespace ferrite
helm install ferrite ./ferrite-ops/charts/ferrite \
  --namespace ferrite \
  -f values-production.yaml
```

The chart creates a ServiceAccount automatically. Restrict access with Kubernetes RBAC as needed.

## Uninstalling

```bash
helm uninstall ferrite

# PVCs are not deleted automatically — clean up manually if needed
kubectl delete pvc -l app.kubernetes.io/name=ferrite
```

## Next Steps

- [Monitoring with Grafana](./monitoring-grafana.md) — Set up Prometheus and Grafana
- [Production Checklist](./production-checklist.md) — Verify production readiness
