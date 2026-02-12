---
sidebar_position: 23
maturity: beta
---

# Production Readiness Checklist

Use this checklist to verify your Ferrite deployment is ready for production traffic. Each section includes the configuration to check and how to verify it.

## Security

### ✅ Enable TLS Encryption

Encrypt all client-server communication with TLS:

```yaml
# values-production.yaml
ferrite:
  tls:
    enabled: true
    port: 6380
    secretName: "ferrite-tls"
```

Create the TLS secret:

```bash
kubectl create secret tls ferrite-tls \
  --cert=server.crt \
  --key=server.key \
  -n ferrite
```

**Verify:**
```bash
# Test TLS connection from within the cluster
kubectl exec -it ferrite-0 -- ferrite-cli --tls -p 6380 PING
```

### ✅ Enable Authentication

Require password authentication for all connections:

```yaml
ferrite:
  auth:
    enabled: true
    existingSecret: "ferrite-auth"  # Preferred: use existing secret
```

Create the auth secret:

```bash
kubectl create secret generic ferrite-auth \
  --from-literal=password="$(openssl rand -base64 32)" \
  -n ferrite
```

**Verify:**
```bash
kubectl exec -it ferrite-0 -- ferrite-cli AUTH "your-password" PING
```

### ✅ Configure Network Policies

Restrict network access to Ferrite pods:

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: ferrite-network-policy
  namespace: ferrite
spec:
  podSelector:
    matchLabels:
      app.kubernetes.io/name: ferrite
  policyTypes:
    - Ingress
    - Egress
  ingress:
    # Allow traffic from application pods
    - from:
        - namespaceSelector:
            matchLabels:
              name: app
        - podSelector:
            matchLabels:
              role: backend
      ports:
        - port: 6379
          protocol: TCP
    # Allow Prometheus scraping
    - from:
        - namespaceSelector:
            matchLabels:
              name: monitoring
      ports:
        - port: 9090
          protocol: TCP
  egress:
    # Allow DNS
    - to: []
      ports:
        - port: 53
          protocol: UDP
    # Allow replication traffic between Ferrite pods
    - to:
        - podSelector:
            matchLabels:
              app.kubernetes.io/name: ferrite
      ports:
        - port: 6379
          protocol: TCP
        - port: 16379
          protocol: TCP
```

### ✅ Pod Security Context

The Helm chart defaults to a secure context. Verify these are set:

```yaml
podSecurityContext:
  fsGroup: 1000

securityContext:
  runAsNonRoot: true
  runAsUser: 1000
  runAsGroup: 1000
  capabilities:
    drop:
      - ALL
  readOnlyRootFilesystem: true
```

### ✅ Disable Dangerous Commands (If Needed)

In production, consider restricting or renaming dangerous commands via ACL configuration:

```toml
# ferrite.toml
[security]
rename_commands = { FLUSHALL = "", FLUSHDB = "", DEBUG = "", CONFIG = "FERRITE_CONFIG" }
```

## Persistence

### ✅ Enable Persistent Volumes

Never run production Ferrite on ephemeral storage:

```yaml
persistence:
  enabled: true
  storageClassName: "gp3"  # Use SSD-backed storage
  accessModes:
    - ReadWriteOnce
  size: 50Gi  # Size appropriately for your dataset + AOF overhead
```

**Verify:**
```bash
kubectl get pvc -l app.kubernetes.io/name=ferrite
# STATUS should be "Bound"
```

### ✅ Enable AOF Persistence

Ensure data survives pod restarts:

```yaml
ferrite:
  persistence:
    aofEnabled: true
    aofSync: "everysec"  # Balance between safety and performance
    checkpointEnabled: true
    checkpointInterval: "5m"
```

**Verify:**
```bash
kubectl exec -it ferrite-0 -- ferrite-cli INFO persistence
# Look for: aof_enabled:1, aof_rewrite_in_progress:0
```

### ✅ Configure Backup Strategy

Set up periodic backups of the data volume:

```bash
# Example: Kubernetes CronJob for volume snapshots (AWS EBS)
apiVersion: snapshot.storage.k8s.io/v1
kind: VolumeSnapshot
metadata:
  name: ferrite-backup
spec:
  volumeSnapshotClassName: ebs-snapshot
  source:
    persistentVolumeClaimName: data-ferrite-0
```

Schedule snapshots with a CronJob or use your cloud provider's backup tooling:

```bash
# AWS: Automated EBS snapshots via AWS Backup
# GCP: Scheduled disk snapshots via GCP Console
# Azure: Azure Backup for managed disks
```

**Verify:** Restore a backup to a test environment and confirm data integrity.

## Resource Limits

### ✅ Set CPU and Memory Limits

Prevent Ferrite from consuming unbounded resources:

```yaml
resources:
  limits:
    cpu: 2000m
    memory: 4Gi
  requests:
    cpu: 500m
    memory: 1Gi
```

**Guidelines:**
- Set `memory.limit` to at least 2× `ferrite.storage.maxMemory` to account for overhead
- Set `cpu.request` based on expected operations/sec (benchmark with your workload)
- Never set `memory.request` equal to `memory.limit` on shared nodes (causes OOMKill)

### ✅ Configure Ferrite Memory Limit

Set `maxMemory` to prevent Ferrite from using more memory than the container limit allows:

```yaml
ferrite:
  storage:
    maxMemory: "2147483648"  # 2GB — must be less than resources.limits.memory
```

**Verify:**
```bash
kubectl exec -it ferrite-0 -- ferrite-cli INFO memory
# Check: used_memory < maxmemory
```

### ✅ Enable Pod Disruption Budget

Prevent all Ferrite pods from being evicted during node maintenance:

```yaml
podDisruptionBudget:
  enabled: true
  minAvailable: 1
```

### ✅ Set Topology Spread Constraints

Spread Ferrite pods across failure domains (multi-replica deployments):

```yaml
topologySpreadConstraints:
  - maxSkew: 1
    topologyKey: topology.kubernetes.io/zone
    whenUnsatisfiable: DoNotSchedule
    labelSelector:
      matchLabels:
        app.kubernetes.io/name: ferrite
```

## Monitoring and Alerting

### ✅ Enable Prometheus Metrics

```yaml
ferrite:
  metrics:
    enabled: true

serviceMonitor:
  enabled: true
  interval: 15s
```

**Verify:**
```bash
kubectl port-forward svc/ferrite 9090:9090
curl -s http://localhost:9090/metrics | head -20
```

### ✅ Import Grafana Dashboard

Import the dashboard from `ferrite-ops/grafana/ferrite-dashboard.json`. See [Monitoring with Grafana](./monitoring-grafana.md) for details.

### ✅ Configure Critical Alerts

At minimum, configure these alerts:

| Alert | Condition | Severity |
|-------|-----------|----------|
| FerriteDown | `up{job="ferrite"} == 0` for 1m | Critical |
| FerriteHighMemory | Memory > 90% of max for 5m | Warning |
| FerriteHighLatency | P99 > 5ms for 5m | Warning |
| FerriteReplicationLag | Lag > 10MB for 5m | Warning |
| FerriteTooManyConnections | Clients > 90% of max for 5m | Warning |

See [Monitoring with Grafana — Alerting Rules](./monitoring-grafana.md#step-5-configure-alerting-rules) for full Prometheus rule definitions.

### ✅ Enable Structured Logging

Use JSON logging for log aggregation tools (Loki, Elasticsearch, CloudWatch):

```yaml
ferrite:
  logging:
    level: "info"
    format: "json"
```

## High Availability

### ✅ Configure Replication

For read scaling and automatic failover:

```yaml
# Primary
replication:
  enabled: true
  role: "primary"

# Replica (separate Helm release)
replication:
  enabled: true
  role: "replica"
  primaryHost: "ferrite-primary"
  primaryPort: 6379
```

### ✅ Configure Sentinel (Optional)

For automatic failover without cluster mode:

```yaml
sentinel:
  enabled: true
  replicas: 3
  quorum: 2
```

### ✅ Configure Cluster Mode (Optional)

For horizontal scaling with automatic sharding:

```yaml
replicaCount: 3

cluster:
  enabled: true
  port: 16379
```

## Pre-Launch Verification

Run these commands as a final check before routing production traffic:

```bash
# 1. Run ferrite doctor inside the pod
kubectl exec -it ferrite-0 -- ferrite doctor

# 2. Verify health probes are passing
kubectl describe pod ferrite-0 | grep -A5 "Conditions"

# 3. Confirm PVC is bound
kubectl get pvc -l app.kubernetes.io/name=ferrite

# 4. Test basic operations
kubectl exec -it ferrite-0 -- ferrite-cli SET test-key "hello"
kubectl exec -it ferrite-0 -- ferrite-cli GET test-key

# 5. Verify metrics are being scraped
kubectl port-forward svc/prometheus 9091:9090
# Check http://localhost:9091/targets for ferrite target status

# 6. Verify Grafana dashboard shows data
kubectl port-forward svc/grafana 3000:3000
# Check the Ferrite dashboard for live metrics

# 7. Test persistence by restarting the pod
kubectl delete pod ferrite-0
kubectl wait --for=condition=ready pod/ferrite-0 --timeout=120s
kubectl exec -it ferrite-0 -- ferrite-cli GET test-key
# Should return: "hello"

# 8. Clean up test data
kubectl exec -it ferrite-0 -- ferrite-cli DEL test-key
```

## Summary Checklist

| Category | Item | Status |
|----------|------|--------|
| **Security** | TLS enabled | ☐ |
| **Security** | Authentication enabled | ☐ |
| **Security** | Network policies applied | ☐ |
| **Security** | Pod security context set | ☐ |
| **Security** | Dangerous commands restricted | ☐ |
| **Persistence** | PVCs bound and using SSD storage | ☐ |
| **Persistence** | AOF persistence enabled | ☐ |
| **Persistence** | Backup strategy configured | ☐ |
| **Resources** | CPU/memory limits set | ☐ |
| **Resources** | Ferrite maxMemory configured | ☐ |
| **Resources** | PodDisruptionBudget enabled | ☐ |
| **Resources** | Topology spread constraints set | ☐ |
| **Monitoring** | Prometheus metrics enabled | ☐ |
| **Monitoring** | Grafana dashboard imported | ☐ |
| **Monitoring** | Critical alerts configured | ☐ |
| **Monitoring** | Structured logging enabled | ☐ |
| **HA** | Replication or cluster configured | ☐ |
| **Verification** | `ferrite doctor` passes | ☐ |
| **Verification** | Health probes passing | ☐ |
| **Verification** | Data persists across pod restarts | ☐ |

## Next Steps

- [Monitoring with Grafana](./monitoring-grafana.md) — Deep dive into monitoring setup
- [Kubernetes Deployment](./kubernetes-deployment.md) — Revisit deployment configuration
- [Cloud-Native Overview](./cloud-native-overview.md) — Return to the series overview
