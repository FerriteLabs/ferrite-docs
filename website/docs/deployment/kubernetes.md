---
sidebar_position: 2
title: Kubernetes Deployment
description: Deploy Ferrite on Kubernetes with the official operator. Includes Helm charts, StatefulSets, clustering, and production configurations.
keywords: [kubernetes, k8s, helm, operator, statefulset, cluster, devops]
maturity: beta
---

# Kubernetes Deployment

Deploy Ferrite on Kubernetes with the official operator.

## Operator Installation

### Using Helm

```bash
# Add Helm repo
helm repo add ferrite https://charts.ferrite.io
helm repo update

# Install operator
helm install ferrite-operator ferrite/ferrite-operator \
  --namespace ferrite-system \
  --create-namespace
```

### Using kubectl

```bash
# Install CRDs
kubectl apply -f https://github.com/ferrite/ferrite-operator/releases/latest/download/crds.yaml

# Install operator
kubectl apply -f https://github.com/ferrite/ferrite-operator/releases/latest/download/operator.yaml
```

## Custom Resource Definitions

### FerriteCluster

```yaml
apiVersion: ferrite.io/v1
kind: FerriteCluster
metadata:
  name: my-ferrite
  namespace: default
spec:
  replicas: 3
  version: "1.0.0"

  resources:
    requests:
      cpu: "500m"
      memory: "1Gi"
    limits:
      cpu: "2"
      memory: "4Gi"

  persistence:
    enabled: true
    storageClassName: standard
    size: 10Gi

  config:
    maxmemory: "3gb"
    maxmemory-policy: "allkeys-lru"
```

### Standalone Instance

```yaml
apiVersion: ferrite.io/v1
kind: Ferrite
metadata:
  name: ferrite-standalone
spec:
  version: "1.0.0"

  resources:
    requests:
      cpu: "250m"
      memory: "512Mi"
    limits:
      cpu: "1"
      memory: "2Gi"

  persistence:
    enabled: true
    size: 5Gi

  config:
    appendonly: "yes"
```

## Cluster Modes

### Master-Replica

```yaml
apiVersion: ferrite.io/v1
kind: FerriteCluster
metadata:
  name: ferrite-ha
spec:
  mode: sentinel
  master:
    replicas: 1
  replica:
    replicas: 2
  sentinel:
    replicas: 3
```

### Sharded Cluster

```yaml
apiVersion: ferrite.io/v1
kind: FerriteCluster
metadata:
  name: ferrite-sharded
spec:
  mode: cluster
  shards: 3
  replicasPerShard: 1
```

## Configuration

### ConfigMap

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: ferrite-config
data:
  ferrite.toml: |
    [server]
    port = 6379

    [memory]
    maxmemory = "3gb"
    maxmemory_policy = "allkeys-lru"

    [persistence.aof]
    enabled = true
    fsync = "everysec"
```

### Using ConfigMap

```yaml
apiVersion: ferrite.io/v1
kind: Ferrite
metadata:
  name: ferrite
spec:
  configMap: ferrite-config
```

### Secrets

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: ferrite-auth
type: Opaque
stringData:
  password: "your-secure-password"
```

```yaml
apiVersion: ferrite.io/v1
kind: Ferrite
metadata:
  name: ferrite
spec:
  auth:
    secretRef:
      name: ferrite-auth
      key: password
```

## Persistence

### StorageClass

```yaml
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: ferrite-storage
provisioner: kubernetes.io/aws-ebs
parameters:
  type: gp3
  iopsPerGB: "50"
reclaimPolicy: Retain
volumeBindingMode: WaitForFirstConsumer
```

### PersistentVolumeClaim

```yaml
apiVersion: ferrite.io/v1
kind: Ferrite
metadata:
  name: ferrite
spec:
  persistence:
    enabled: true
    storageClassName: ferrite-storage
    size: 100Gi
    accessModes:
      - ReadWriteOnce
```

## Networking

### Service

```yaml
apiVersion: v1
kind: Service
metadata:
  name: ferrite
spec:
  type: ClusterIP
  ports:
    - port: 6379
      targetPort: 6379
      name: redis
    - port: 9090
      targetPort: 9090
      name: metrics
  selector:
    app: ferrite
```

### LoadBalancer

```yaml
apiVersion: v1
kind: Service
metadata:
  name: ferrite-external
spec:
  type: LoadBalancer
  ports:
    - port: 6379
      targetPort: 6379
  selector:
    app: ferrite
```

### Ingress (for metrics)

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: ferrite-metrics
  annotations:
    nginx.ingress.kubernetes.io/rewrite-target: /
spec:
  rules:
    - host: ferrite-metrics.example.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: ferrite
                port:
                  number: 9090
```

## Monitoring

### ServiceMonitor

```yaml
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: ferrite
  labels:
    release: prometheus
spec:
  selector:
    matchLabels:
      app: ferrite
  endpoints:
    - port: metrics
      interval: 15s
```

### PodMonitor

```yaml
apiVersion: monitoring.coreos.com/v1
kind: PodMonitor
metadata:
  name: ferrite
spec:
  selector:
    matchLabels:
      app: ferrite
  podMetricsEndpoints:
    - port: metrics
```

## Auto-Scaling

### Horizontal Pod Autoscaler

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: ferrite-hpa
spec:
  scaleTargetRef:
    apiVersion: ferrite.io/v1
    kind: FerriteCluster
    name: my-ferrite
  minReplicas: 3
  maxReplicas: 10
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
    - type: Resource
      resource:
        name: memory
        target:
          type: Utilization
          averageUtilization: 80
```

## Backup

### FerriteBackup CRD

```yaml
apiVersion: ferrite.io/v1
kind: FerriteBackup
metadata:
  name: daily-backup
spec:
  clusterRef:
    name: my-ferrite
  schedule: "0 2 * * *"  # Daily at 2am
  retention:
    keepLast: 7
  storage:
    s3:
      bucket: my-backups
      region: us-west-2
      secretRef:
        name: aws-credentials
```

### Manual Backup

```yaml
apiVersion: ferrite.io/v1
kind: FerriteBackup
metadata:
  name: manual-backup-20240115
spec:
  clusterRef:
    name: my-ferrite
  storage:
    s3:
      bucket: my-backups
      path: manual/20240115
```

## Security

### Network Policies

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: ferrite-network-policy
spec:
  podSelector:
    matchLabels:
      app: ferrite
  policyTypes:
    - Ingress
    - Egress
  ingress:
    - from:
        - podSelector:
            matchLabels:
              access: ferrite
      ports:
        - port: 6379
  egress:
    - to:
        - podSelector:
            matchLabels:
              app: ferrite
```

### Pod Security

```yaml
apiVersion: ferrite.io/v1
kind: Ferrite
metadata:
  name: ferrite
spec:
  securityContext:
    runAsNonRoot: true
    runAsUser: 1000
    fsGroup: 1000
  containerSecurityContext:
    readOnlyRootFilesystem: true
    allowPrivilegeEscalation: false
```

## Resource Quotas

```yaml
apiVersion: v1
kind: ResourceQuota
metadata:
  name: ferrite-quota
  namespace: ferrite
spec:
  hard:
    requests.cpu: "10"
    requests.memory: "40Gi"
    limits.cpu: "20"
    limits.memory: "80Gi"
    persistentvolumeclaims: "10"
    requests.storage: "500Gi"
```

## Troubleshooting

### Check Operator Logs

```bash
kubectl logs -n ferrite-system deployment/ferrite-operator
```

### Check Cluster Status

```bash
kubectl get ferritecluster my-ferrite -o yaml
kubectl describe ferritecluster my-ferrite
```

### Pod Issues

```bash
kubectl get pods -l app=ferrite
kubectl describe pod ferrite-0
kubectl logs ferrite-0
```

### Connect to Instance

```bash
kubectl exec -it ferrite-0 -- ferrite-cli PING
```

## Best Practices

1. **Use operator** - Manages lifecycle, upgrades, backups
2. **Set resource limits** - Prevent noisy neighbors
3. **Enable persistence** - Don't lose data on restart
4. **Use network policies** - Restrict access
5. **Monitor with Prometheus** - Use ServiceMonitor
6. **Regular backups** - Use FerriteBackup CRD
7. **Use secrets** - Don't hardcode passwords

## Next Steps

- [Docker](/docs/deployment/docker) - Container basics
- [High Availability](/docs/deployment/high-availability) - HA patterns
- [Cloud Providers](/docs/deployment/cloud-providers) - Cloud-specific guides
