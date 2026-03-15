---
sidebar_position: 8
title: Production Hardening Guide
description: Comprehensive checklist for deploying Ferrite securely in production environments
---

# Production Hardening Guide

This guide covers everything you need to secure and harden a Ferrite deployment for production use. It goes beyond basic configuration to address security, reliability, performance, and operational concerns.

## Pre-Deployment Checklist

Use this checklist before going live. Each section links to detailed guidance below.

| Category | Item | Priority |
|----------|------|----------|
| **Network** | Bind to private interface | 🔴 Critical |
| **Network** | Configure firewall rules | 🔴 Critical |
| **Network** | Enable TLS encryption | 🔴 Critical |
| **Auth** | Set strong passwords | 🔴 Critical |
| **Auth** | Enable ACLs with least privilege | 🔴 Critical |
| **Auth** | Disable dangerous commands | 🟡 High |
| **Persistence** | Configure AOF with everysec sync | 🟡 High |
| **Persistence** | Set up automated backups | 🟡 High |
| **Memory** | Set max_memory limit | 🔴 Critical |
| **Memory** | Configure eviction policy | 🟡 High |
| **Monitoring** | Enable Prometheus metrics | 🟡 High |
| **Monitoring** | Set up alerting rules | 🟡 High |
| **Monitoring** | Configure audit logging | 🟢 Recommended |
| **OS** | Tune kernel parameters | 🟢 Recommended |
| **OS** | Set resource limits (ulimits) | 🟡 High |
| **OS** | Disable transparent huge pages | 🟢 Recommended |

## Network Hardening

### Bind Address

Never bind to `0.0.0.0` in production. Bind to the specific private network interface:

```toml
[server]
bind = "10.0.1.50"       # Private interface only
port = 6379
```

For servers that need to listen on multiple specific interfaces:

```toml
[server]
bind = "10.0.1.50 172.16.0.50"  # Multiple interfaces
```

### Firewall Rules

Restrict access to the Ferrite port to known application servers only:

```bash
# Linux (iptables)
iptables -A INPUT -p tcp --dport 6379 -s 10.0.1.0/24 -j ACCEPT
iptables -A INPUT -p tcp --dport 6379 -j DROP

# Linux (nftables)
nft add rule inet filter input tcp dport 6379 ip saddr 10.0.1.0/24 accept
nft add rule inet filter input tcp dport 6379 drop

# macOS (pf)
echo "block in proto tcp from any to any port 6379" >> /etc/pf.conf
echo "pass in proto tcp from 10.0.1.0/24 to any port 6379" >> /etc/pf.conf
```

If running in Kubernetes, use a NetworkPolicy:

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: ferrite-access
spec:
  podSelector:
    matchLabels:
      app: ferrite
  ingress:
    - from:
        - podSelector:
            matchLabels:
              access: ferrite
      ports:
        - port: 6379
```

### TLS Encryption

Always enable TLS in production. Use TLS 1.3 minimum for best security:

```toml
[tls]
enabled = true
cert_file = "/etc/ferrite/tls/server.crt"
key_file = "/etc/ferrite/tls/server.key"
min_protocol_version = "1.3"
```

For service-to-service communication, enable mutual TLS (mTLS):

```toml
[tls]
enabled = true
cert_file = "/etc/ferrite/tls/server.crt"
key_file = "/etc/ferrite/tls/server.key"
ca_file = "/etc/ferrite/tls/ca.crt"
require_client_cert = true
min_protocol_version = "1.3"
```

See the [Security guide](/docs/advanced/security) for certificate generation instructions.

### Metrics Port

If exposing Prometheus metrics, bind the metrics endpoint to a separate internal interface:

```toml
[metrics]
enabled = true
bind = "10.0.1.50"  # Not 0.0.0.0
port = 9090
```

## Authentication & Authorization

### Strong Passwords

Use randomly generated passwords of at least 32 characters:

```bash
# Generate a secure password
openssl rand -base64 32

# Set in Ferrite
ACL SETUSER default on >$(openssl rand -base64 32)
```

### Least-Privilege ACLs

Create specific users for each application with minimal permissions:

```bash
# Web application: read/write on app keys only
ACL SETUSER webapp on >$WEBAPP_PASSWORD ~app:* &* +@read +@write -@admin -@dangerous

# Analytics service: read-only access
ACL SETUSER analytics on >$ANALYTICS_PASSWORD ~* &* +@read -@write -@admin -@dangerous

# Cache layer: write to cache keys, no admin
ACL SETUSER cache on >$CACHE_PASSWORD ~cache:* &* +get +set +del +expire +ttl -@admin -@dangerous

# Monitoring: INFO and PING only
ACL SETUSER monitor on >$MONITOR_PASSWORD ~* &* +info +ping +dbsize +slowlog -@write -@admin
```

### Disable Dangerous Commands

Remove access to commands that can damage data or expose sensitive info:

```bash
# For all non-admin users
ACL SETUSER webapp -keys -flushall -flushdb -debug -config -shutdown -slaveof -replicaof
```

### Persist ACLs

Store ACL definitions in a file so they survive restarts:

```toml
[acl]
enabled = true
users_file = "/etc/ferrite/users.acl"
log_enabled = true
```

## Memory Management

### Set Memory Limits

Always set a memory ceiling to prevent OOM kills:

```toml
[storage]
max_memory = 8589934592  # 8 GB — leave headroom for OS and overhead
```

:::warning
Set `max_memory` to no more than 80% of available RAM. The remaining 20% is needed for OS caches, copy-on-write during persistence, and Ferrite's internal overhead.
:::

### Eviction Policy

Choose an eviction policy appropriate for your workload:

```toml
[storage]
eviction_policy = "allkeys-lru"  # Good default for caching workloads
```

| Policy | Best For |
|--------|----------|
| `allkeys-lru` | General caching (most common) |
| `volatile-lru` | Cache with mix of persistent and expiring keys |
| `allkeys-lfu` | Frequency-based access patterns |
| `volatile-ttl` | Prefer evicting keys closest to expiry |
| `noeviction` | Data that must never be evicted (returns errors when full) |

## Persistence Configuration

### AOF Settings

For durability, enable AOF with `everysec` sync (balances safety and performance):

```toml
[persistence]
aof_enabled = true
aof_sync = "everysec"   # Sync every second (max 1s data loss)
aof_file = "/var/lib/ferrite/appendonly.aof"
```

| Sync Mode | Durability | Performance |
|-----------|-----------|-------------|
| `always` | No data loss | Slowest (fsync every write) |
| `everysec` | ≤1 second loss | Good balance (recommended) |
| `no` | OS-dependent | Fastest (OS decides when to flush) |

### Backup Strategy

Set up automated backups with the backup script:

```bash
# Daily backup with 7-day retention
0 2 * * * /opt/ferrite/scripts/backup.sh /var/lib/ferrite /backups/ferrite 7
```

Test restores regularly. A backup you haven't tested is not a backup.

## Operating System Tuning

### File Descriptor Limits

Ferrite needs one file descriptor per client connection plus internal overhead:

```bash
# /etc/security/limits.conf
ferrite soft nofile 65536
ferrite hard nofile 65536

# Or set in systemd unit
[Service]
LimitNOFILE=65536
```

### TCP Backlog

Increase the TCP backlog for high-connection environments:

```bash
# /etc/sysctl.conf
net.core.somaxconn = 65535
net.ipv4.tcp_max_syn_backlog = 65535
```

### Disable Transparent Huge Pages

THP can cause latency spikes with memory-intensive workloads:

```bash
# Disable at runtime
echo never > /sys/kernel/mm/transparent_hugepage/enabled
echo never > /sys/kernel/mm/transparent_hugepage/defrag

# Persist across reboots (add to /etc/rc.local or systemd unit)
```

### Memory Overcommit

Configure the kernel to handle memory allocation predictably:

```bash
# /etc/sysctl.conf
vm.overcommit_memory = 1
```

### Swappiness

Minimize swapping for latency-sensitive workloads:

```bash
# /etc/sysctl.conf
vm.swappiness = 1
```

## Monitoring & Alerting

### Enable Prometheus Metrics

```toml
[metrics]
enabled = true
port = 9090
```

### Critical Alerts

At minimum, set up alerts for these conditions:

| Alert | Threshold | Severity |
|-------|-----------|----------|
| Memory usage | > 80% of max_memory | Warning |
| Memory usage | > 95% of max_memory | Critical |
| Connected clients | > 80% of maxclients | Warning |
| Replication lag | > 10 seconds | Critical |
| Command latency P99 | > 10ms | Warning |
| Rejected connections | > 0 in 5 minutes | Warning |
| AOF rewrite failure | any | Critical |

See the [Monitoring guide](/docs/operations/monitoring) for Grafana dashboard setup and the pre-built alert rules in [`ferrite-ops/monitoring/`](https://github.com/ferritelabs/ferrite-ops/tree/main/monitoring).

### Audit Logging

Enable audit logging to track authentication events and denied commands:

```toml
[acl]
log_enabled = true
log_max_len = 128
```

## Kubernetes-Specific Hardening

When running in Kubernetes, apply these additional measures:

### Security Context

```yaml
securityContext:
  runAsNonRoot: true
  runAsUser: 1000
  readOnlyRootFilesystem: true
  allowPrivilegeEscalation: false
  capabilities:
    drop:
      - ALL
```

### Resource Limits

Always set CPU and memory limits to prevent noisy-neighbor issues:

```yaml
resources:
  requests:
    memory: "8Gi"
    cpu: "2"
  limits:
    memory: "10Gi"  # 25% headroom over max_memory
    cpu: "4"
```

### Pod Disruption Budget

Ensure availability during cluster maintenance:

```yaml
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: ferrite-pdb
spec:
  minAvailable: 2
  selector:
    matchLabels:
      app: ferrite
```

## Docker-Specific Hardening

```yaml
services:
  ferrite:
    image: ferritelabs/ferrite:latest
    read_only: true
    security_opt:
      - no-new-privileges:true
    tmpfs:
      - /tmp
    cap_drop:
      - ALL
    ulimits:
      nofile:
        soft: 65536
        hard: 65536
    deploy:
      resources:
        limits:
          memory: 10G
```

## Verification

After hardening, verify your configuration:

```bash
# Test TLS connection
redis-cli --tls --cacert ca.crt -p 6379 PING

# Verify ACLs are active
redis-cli --tls --cacert ca.crt -a $PASSWORD ACL LIST

# Check that dangerous commands are blocked
redis-cli --tls --cacert ca.crt -a $WEBAPP_PASSWORD KEYS "*"
# Should return: (error) NOPERM

# Verify metrics endpoint is accessible
curl -s http://10.0.1.50:9090/metrics | head -5

# Check file descriptor limits
cat /proc/$(pgrep ferrite)/limits | grep "Max open files"
```

## Next Steps

- [Backup & Restore](/docs/operations/backup-restore) — Automated backup procedures
- [Monitoring](/docs/operations/monitoring) — Grafana dashboards and Prometheus setup
- [Performance Tuning](/docs/operations/performance-tuning) — Optimize for your workload
- [Clustering](/docs/advanced/clustering) — Multi-node deployment
- [Troubleshooting](/docs/operations/troubleshooting) — Common issues and solutions
