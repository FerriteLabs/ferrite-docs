---
sidebar_position: 4
title: High Availability
description: Deploy Ferrite for maximum uptime with replication, automatic failover, Kubernetes HA patterns, and production checklists.
keywords: [high availability, HA, failover, sentinel, cluster, kubernetes, replication, production]
maturity: beta
---

# High Availability

Deploy Ferrite for maximum uptime and fault tolerance.

## HA Architecture Patterns

### Overview

| Pattern | Failover | Complexity | Data Loss Risk | Use Case |
|---------|----------|------------|----------------|----------|
| Primary-Replica | Manual | Low | Low–Medium | Read scaling, warm standby |
| Sentinel-style | Automatic | Medium | Low | Auto-failover without sharding |
| Cluster Mode | Automatic | High | Very Low | Horizontal scaling + HA |
| Kubernetes StatefulSet | Automatic | Medium | Low | Cloud-native deployments |

### Active-Passive with Automatic Failover

The most common HA pattern: one primary handles all writes, replicas serve reads and stand by for promotion. Failover is triggered when the primary becomes unreachable.

```
┌──────────────────────────────────────────────────────────┐
│                 Monitoring Layer                          │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐         │
│  │ Sentinel 1 │  │ Sentinel 2 │  │ Sentinel 3 │         │
│  └────────────┘  └────────────┘  └────────────┘         │
└────────────────────────┬─────────────────────────────────┘
                         │ Monitor + Failover
              ┌──────────┴──────────┐
              │                     │
         ┌────┴────┐         ┌──────┴──────┐
         │ Primary │────────▶│  Replica(s) │
         └─────────┘  async  └─────────────┘
                      repl
```

**How failover works:**

1. Sentinels continuously PING the primary (every `down_after_ms`)
2. When a sentinel detects primary is down, it flags it as **Subjectively Down (SDOWN)**
3. When `quorum` sentinels agree, the primary is marked **Objectively Down (ODOWN)**
4. A sentinel is elected leader and initiates failover
5. The replica with the lowest `replica_priority` and most up-to-date offset is promoted
6. Remaining replicas are reconfigured to follow the new primary
7. Clients are notified via Sentinel pub/sub

### Sentinel-Style Monitoring

:::caution Planned Feature
Built-in sentinel mode (`ferrite-sentinel`) is **planned but not yet released**. The configuration below documents the intended behavior. For now, use external monitoring (Kubernetes probes, HAProxy health checks, or custom scripts) to detect failure and trigger manual failover.
:::

**Sentinel configuration (`sentinel.toml`):**

```toml
[sentinel]
port = 26379

[[sentinel.monitors]]
name = "mymaster"
host = "primary-host"
port = 6379
quorum = 2
down_after_ms = 5000
failover_timeout = 60000
parallel_syncs = 1
```

**Start sentinels (odd number for quorum):**

```bash
ferrite-sentinel --config sentinel1.toml
ferrite-sentinel --config sentinel2.toml
ferrite-sentinel --config sentinel3.toml
```

**Sentinel commands:**

```bash
SENTINEL GET-MASTER-ADDR-BY-NAME mymaster    # Get current primary address
SENTINEL REPLICAS mymaster                   # List replicas
SENTINEL FAILOVER mymaster                   # Force failover
SENTINEL MASTER mymaster                     # Check primary status
```

**Client connection with sentinel discovery:**

```python
from redis.sentinel import Sentinel

sentinel = Sentinel([
    ('sentinel1', 26379),
    ('sentinel2', 26379),
    ('sentinel3', 26379)
], socket_timeout=0.1)

# Writes go to primary
master = sentinel.master_for('mymaster', socket_timeout=0.1)
master.set('key', 'value')

# Reads go to replica
replica = sentinel.slave_for('mymaster', socket_timeout=0.1)
value = replica.get('key')
```

### Kubernetes-Based HA with StatefulSet

Ferrite deploys as a StatefulSet in Kubernetes, providing stable network identities and persistent storage. Kubernetes readiness probes and a headless service enable automatic traffic routing away from unhealthy pods.

```
┌─────────────────────────────────────────────────────┐
│                 Kubernetes Cluster                    │
│                                                      │
│  ┌──────────────────────────────────────────────┐   │
│  │           ferrite (StatefulSet)                │   │
│  │                                               │   │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐      │   │
│  │  │ferrite-0│  │ferrite-1│  │ferrite-2│      │   │
│  │  │(primary)│  │(replica)│  │(replica)│      │   │
│  │  │  PVC-0  │  │  PVC-1  │  │  PVC-2  │      │   │
│  │  └─────────┘  └─────────┘  └─────────┘      │   │
│  └──────────────────────────────────────────────┘   │
│                                                      │
│  ┌─────────────────┐  ┌──────────────────────┐      │
│  │ ferrite (svc)   │  │ ferrite-headless     │      │
│  │ ClusterIP       │  │ (headless service)   │      │
│  │ → all pods      │  │ → individual pods    │      │
│  └─────────────────┘  └──────────────────────┘      │
└─────────────────────────────────────────────────────┘
```

See [Deployment Options — Kubernetes HA](#kubernetes-ha-with-readiness-probes) for a complete Helm values example.

## Deployment Options

### Docker Compose HA Setup

A production-ready Docker Compose configuration with primary, two replicas, and monitoring. See the full file at `ferrite-ops/docker/docker-compose.ha.yml`.

```yaml
services:
  ferrite-primary:
    image: ferrite:latest
    ports:
      - "6379:6379"
      - "9090:9090"         # Prometheus metrics
    volumes:
      - primary-data:/var/lib/ferrite/data
    environment:
      - FERRITE_REPLICATION_ROLE=primary
      - FERRITE_REPLICATION_MIN_REPLICAS_TO_WRITE=1
      - FERRITE_REPLICATION_MIN_REPLICAS_MAX_LAG=10
    healthcheck:
      test: ["CMD", "ferrite-cli", "PING"]
      interval: 5s
      timeout: 3s
      retries: 3
      start_period: 10s

  ferrite-replica-1:
    image: ferrite:latest
    ports:
      - "6380:6379"
    volumes:
      - replica1-data:/var/lib/ferrite/data
    environment:
      - FERRITE_REPLICATION_ROLE=replica
      - FERRITE_REPLICATION_PRIMARY_HOST=ferrite-primary
      - FERRITE_REPLICATION_PRIMARY_PORT=6379
    depends_on:
      ferrite-primary:
        condition: service_healthy

  ferrite-replica-2:
    image: ferrite:latest
    ports:
      - "6381:6379"
    volumes:
      - replica2-data:/var/lib/ferrite/data
    environment:
      - FERRITE_REPLICATION_ROLE=replica
      - FERRITE_REPLICATION_PRIMARY_HOST=ferrite-primary
      - FERRITE_REPLICATION_PRIMARY_PORT=6379
    depends_on:
      ferrite-primary:
        condition: service_healthy

volumes:
  primary-data:
  replica1-data:
  replica2-data:
```

### Kubernetes HA with Readiness Probes

Deploy a primary with 2 replicas using the Helm chart. Use the HA values file at `ferrite-ops/charts/ferrite/values-ha.yaml`:

```bash
helm install ferrite ferrite-ops/charts/ferrite \
  -f ferrite-ops/charts/ferrite/values-ha.yaml
```

Key aspects of the Kubernetes HA deployment:

- **StatefulSet** with 3 replicas (1 primary + 2 replicas)
- **Headless service** for stable DNS: `ferrite-0.ferrite-headless.default.svc.cluster.local`
- **Readiness probes** ensure only healthy pods receive traffic
- **PodDisruptionBudget** guarantees at least 2 pods survive voluntary disruptions
- **Anti-affinity** spreads pods across nodes/zones
- **Persistent volumes** per pod for data durability

```yaml
# Health check configuration (from values-ha.yaml)
livenessProbe:
  enabled: true
  initialDelaySeconds: 30
  periodSeconds: 10

readinessProbe:
  enabled: true
  initialDelaySeconds: 5
  periodSeconds: 5
```

### Cloud Provider HA Patterns

#### AWS

- Deploy across **3 Availability Zones** using `topologySpreadConstraints`
- Use **EBS gp3** volumes for persistent storage
- Place an **NLB (Network Load Balancer)** in front for TCP passthrough
- Use **Route 53** health checks for DNS-based failover

#### GCP

- Spread across **3 zones** in a single region
- Use **Regional Persistent Disks** for cross-zone data durability
- Use **Internal TCP Load Balancer** for service routing
- Consider **GKE Autopilot** for simplified operations

#### Azure

- Deploy across **3 Availability Zones**
- Use **Azure Managed Disks** (Premium SSD) for storage
- Use **Azure Internal Load Balancer** for service routing

**Common pattern for all clouds:**

```yaml
# values-ha.yaml excerpt
topologySpreadConstraints:
  - maxSkew: 1
    topologyKey: topology.kubernetes.io/zone
    whenUnsatisfiable: DoNotSchedule
    labelSelector:
      matchLabels:
        app.kubernetes.io/name: ferrite
```

## Load Balancing

### HAProxy Read/Write Splitting

```haproxy
frontend ferrite_write
    bind *:6379
    default_backend ferrite_primary

frontend ferrite_read
    bind *:6380
    default_backend ferrite_replicas

backend ferrite_primary
    mode tcp
    option tcp-check
    tcp-check send PING\r\n
    tcp-check expect string +PONG
    server primary primary-host:6379 check

backend ferrite_replicas
    mode tcp
    balance roundrobin
    option tcp-check
    tcp-check send PING\r\n
    tcp-check expect string +PONG
    server replica1 replica1-host:6379 check
    server replica2 replica2-host:6379 check
```

## Failover Testing

Regularly test failover to validate your HA setup. Run these tests in staging before trusting your production configuration.

### How to Simulate Primary Failure

#### Docker Compose

```bash
# Stop the primary container (simulates crash)
docker compose -f docker-compose.ha.yml stop ferrite-primary

# Verify replicas detect the disconnect
docker compose -f docker-compose.ha.yml exec ferrite-replica-1 \
  ferrite-cli INFO replication
# master_link_status should show "down"

# Promote replica-1
docker compose -f docker-compose.ha.yml exec ferrite-replica-1 \
  ferrite-cli REPLICAOF NO ONE

# Repoint replica-2
docker compose -f docker-compose.ha.yml exec ferrite-replica-2 \
  ferrite-cli REPLICAOF ferrite-replica-1 6379

# Verify writes work on new primary
docker compose -f docker-compose.ha.yml exec ferrite-replica-1 \
  ferrite-cli SET failover-test ok
```

#### Kubernetes

```bash
# Delete the primary pod (Kubernetes will restart it, but you can test failover first)
kubectl delete pod ferrite-0

# Or simulate a network partition
kubectl exec ferrite-0 -- iptables -A OUTPUT -p tcp --dport 6379 -j DROP

# Promote a replica
kubectl exec ferrite-1 -- ferrite-cli REPLICAOF NO ONE

# Repoint remaining replicas
kubectl exec ferrite-2 -- ferrite-cli REPLICAOF ferrite-1.ferrite-headless 6379
```

### Expected Recovery Time

| Scenario | Detection Time | Failover Time | Total |
|----------|---------------|---------------|-------|
| Manual failover | Immediate | 1–5 seconds | < 10 seconds |
| Sentinel auto-failover | `down_after_ms` (default 5s) | 5–15 seconds | 10–20 seconds |
| Kubernetes pod restart | `failureThreshold × periodSeconds` | Pod startup time | 30–90 seconds |
| Network partition recovery | Automatic on reconnect | Partial resync time | Variable |

### Data Loss Expectations

| Configuration | Expected Data Loss |
|---------------|-------------------|
| Async replication (default) | Up to `replica_lag × write_throughput` bytes |
| `WAIT 1 1000` on critical writes | Near-zero for waited writes |
| `min_replicas_to_write = 1` | Bounded by `min_replicas_max_lag` seconds |
| CRDT geo-replication | No loss (eventually consistent) |

## Failure Scenarios

### Primary Failure

1. Replicas detect primary is unreachable (no heartbeat for `repl_timeout` seconds)
2. Replica enters `Disconnected` state, continues serving reads if `replica_serve_stale_data = true`
3. Operator (or sentinel) promotes a replica with `REPLICAOF NO ONE`
4. New primary generates a new replication ID, preserves old ID as `replid2`
5. Other replicas are reconfigured to follow the new primary
6. Old primary rejoins as replica when it recovers

### Network Partition

```toml
# Prevent the isolated primary from accepting writes
[replication]
min_replicas_to_write = 1
min_replicas_max_lag = 10
```

- **Majority partition** (has quorum of sentinels + replicas): promotes a replica
- **Minority partition** (isolated primary): stops accepting writes within `max_lag` seconds
- On partition heal, the old primary resyncs as a replica

### Split Brain Prevention

- Use **odd number of sentinels** (3, 5, 7) for clear quorum
- Set `min_replicas_to_write` ≥ 1 to prevent isolated primary writes
- Configure `min_replicas_max_lag` to limit the window of potential data divergence
- On recovery, the old primary always resyncs from the new primary, discarding divergent writes

## Monitoring HA

### Key Metrics

```promql
# Replication lag in bytes (per replica)
ferrite_replica_lag_bytes

# Cluster state (ok/fail)
ferrite_cluster_state{state="ok"}

# Connected replicas count
ferrite_connected_replicas

# Primary replication offset
ferrite_repl_offset
```

### Recommended Alerts

```yaml
groups:
  - name: ferrite-ha
    rules:
      - alert: ReplicationLagWarning
        expr: ferrite_replica_lag_bytes > 1048576
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Replica lag exceeds 1 MB for 5+ minutes"

      - alert: ReplicationLagCritical
        expr: ferrite_replica_lag_bytes > 10485760
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "Replica lag exceeds 10 MB — full resync may be needed"

      - alert: NoConnectedReplicas
        expr: ferrite_connected_replicas == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Primary has zero connected replicas — HA is degraded"

      - alert: ClusterStateDown
        expr: ferrite_cluster_state{state="fail"} == 1
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Ferrite cluster state is FAIL"
```

## Production Checklist

### Network Configuration

- [ ] Primary and replicas can reach each other on port 6379 (or configured port)
- [ ] Firewall rules allow replication traffic between all nodes
- [ ] If using TLS, certificates are configured on all nodes (`[tls]` config section)
- [ ] DNS resolution works for hostnames used in `primary_host`
- [ ] Network latency between primary and replicas is < 1ms (same region) or < 50ms (cross-region)

### Monitoring and Alerting

- [ ] Prometheus scraping `/metrics` on all Ferrite instances
- [ ] Grafana dashboards installed (see `ferrite-ops/docker/grafana/`)
- [ ] Alerts configured for replication lag, no-replicas, cluster-down
- [ ] On-call runbook references this document for failover steps
- [ ] `INFO replication` checked regularly or via automated health checks

### Backup Integration

- [ ] AOF persistence enabled on primary (`aof_enabled = true`)
- [ ] Checkpoint/RDB snapshots enabled (`checkpoint_enabled = true`)
- [ ] Backups stored off-node (S3, GCS, or separate volume)
- [ ] Backup restoration tested in a non-production environment
- [ ] At least one replica has persistence enabled as a backup safety net

### Capacity Planning for Replicas

- [ ] Each replica has **at least as much memory** as the primary
- [ ] Network bandwidth between primary and replicas can sustain peak write throughput
- [ ] Replication backlog sized for expected disconnect duration: `write_rate × max_disconnect_seconds`
- [ ] Disk I/O on replicas can keep up with replication stream (check for replica lag growth)
- [ ] CPU headroom on replicas for serving reads + applying replication stream simultaneously

### Pre-Go-Live Validation

- [ ] Manual failover tested end-to-end (promote replica, repoint others, verify writes)
- [ ] `min_replicas_to_write` set appropriately for your durability requirements
- [ ] Application handles `NOREPLICAS` errors gracefully (retry or queue)
- [ ] Client libraries configured with connection pooling and retry logic
- [ ] Recovery from full-resync tested (kill replica, restart, verify catch-up)

## Clustering with Replication Examples

### Setting Up a 3-Node Cluster with Replication

Each primary shard can have one or more replicas. The following example
configures a minimal 3-primary / 3-replica cluster where every shard is
replicated once for fault tolerance.

```toml
# Node 1 — primary for slots 0-5460
[cluster]
enabled = true
announce_ip = "10.0.1.1"
announce_port = 6379

[replication]
role = "primary"
```

```toml
# Node 2 — replica of Node 1
[cluster]
enabled = true
announce_ip = "10.0.1.2"
announce_port = 6379

[replication]
role = "replica"
primary_host = "10.0.1.1"
primary_port = 6379
```

After starting all six nodes, form the cluster and assign replicas:

```bash
# Create the cluster (3 primaries, 1 replica each)
ferrite-cli --cluster create \
  10.0.1.1:6379 10.0.1.3:6379 10.0.1.5:6379 \
  10.0.1.2:6379 10.0.1.4:6379 10.0.1.6:6379 \
  --cluster-replicas 1

# Verify cluster health
ferrite-cli --cluster info
ferrite-cli --cluster check 10.0.1.1:6379
```

### Verifying Replication Status

Use the `INFO replication` command on any node to inspect replication state:

```bash
$ ferrite-cli -h 10.0.1.1 -p 6379 INFO replication
role:master
connected_slaves:1
slave0:ip=10.0.1.2,port=6379,state=online,offset=12345,lag=0
master_replid:abc123def456
master_repl_offset:12345
```

A `lag=0` value confirms the replica is fully caught up with the primary.

## Next Steps

- [Replication Runbook](/docs/advanced/replication) — Detailed PSYNC2 protocol, troubleshooting, configuration reference
- [Cluster Mode](/docs/advanced/clustering) — Horizontal scaling with hash slots
- [Monitoring](/docs/operations/monitoring) — Comprehensive monitoring setup
- [Kubernetes Deployment](/docs/deployment/kubernetes) — Full Kubernetes guide
