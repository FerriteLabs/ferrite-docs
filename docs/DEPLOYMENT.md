# Ferrite Deployment Guide

This guide covers deploying Ferrite in various environments, from single-node to clustered production deployments.

## Table of Contents

1. [Quick Start](#quick-start)
2. [Configuration](#configuration)
3. [Standalone Deployment](#standalone-deployment)
4. [Docker Deployment](#docker-deployment)
5. [Kubernetes Deployment](#kubernetes-deployment)
6. [High Availability Setup](#high-availability-setup)
7. [Cluster Deployment](#cluster-deployment)
8. [Security Hardening](#security-hardening)
9. [Monitoring Setup](#monitoring-setup)
10. [Backup & Recovery](#backup--recovery)
11. [Upgrade Procedures](#upgrade-procedures)

---

## System Requirements

### Minimum Requirements

- **OS**: Linux 4.x+ (5.11+ recommended for io_uring support)
- **CPU**: 2 cores
- **RAM**: 4GB
- **Disk**: 20GB available space
- **Network**: 100Mbps

### Recommended Production Requirements

- **OS**: Linux 5.11+ (Ubuntu 22.04+, RHEL 9+, Debian 12+)
- **CPU**: 8+ cores (16+ for high-traffic deployments)
- **RAM**: 32GB+ ECC RAM
- **Disk**: NVMe SSD with 500GB+ (RAID 10 for redundancy)
- **Network**: 1Gbps+ (10Gbps for high-throughput workloads)

### Software Dependencies

```bash
# Ubuntu/Debian
sudo apt-get update
sudo apt-get install -y build-essential pkg-config libssl-dev

# RHEL/CentOS
sudo yum groupinstall -y "Development Tools"
sudo yum install -y openssl-devel

# Rust (if building from source)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source $HOME/.cargo/env
```

---

## Quick Start

### Binary Installation

```bash
# Download latest release
curl -LO https://github.com/your-org/ferrite/releases/latest/download/ferrite-linux-amd64.tar.gz

# Verify checksum (recommended)
sha256sum -c ferrite-linux-amd64.tar.gz.sha256

# Extract
tar xzf ferrite-linux-amd64.tar.gz

# Install binary
sudo install -m 755 ferrite /usr/local/bin/

# Verify installation
ferrite --version

# Create ferrite user and group
sudo groupadd -r ferrite
sudo useradd -r -g ferrite -s /bin/false -d /var/lib/ferrite ferrite

# Create directories
sudo mkdir -p /etc/ferrite
sudo mkdir -p /var/lib/ferrite
sudo mkdir -p /var/log/ferrite

# Set permissions
sudo chown -R ferrite:ferrite /var/lib/ferrite
sudo chown -R ferrite:ferrite /var/log/ferrite

# Create configuration
sudo cp ferrite.toml.example /etc/ferrite/ferrite.toml
sudo chown root:ferrite /etc/ferrite/ferrite.toml
sudo chmod 640 /etc/ferrite/ferrite.toml

# Start server (test mode)
sudo -u ferrite ferrite --config /etc/ferrite/ferrite.toml
```

### Build from Source

```bash
# Clone repository
git clone https://github.com/your-org/ferrite.git
cd ferrite

# Build release binary
cargo build --release

# Install
sudo cp target/release/ferrite /usr/local/bin/
```

---

## Configuration

### Minimal Configuration

```toml
# /etc/ferrite/ferrite.toml

[server]
bind = "0.0.0.0"
port = 6379

[persistence]
dir = "/var/lib/ferrite"
appendonly = true

[memory]
maxmemory = "4gb"
```

### Production Configuration

```toml
# /etc/ferrite/ferrite.toml

[server]
bind = "0.0.0.0"
port = 6379
tcp_backlog = 511
tcp_keepalive = 300
timeout = 0
maxclients = 10000
io_threads = 8

[persistence]
dir = "/var/lib/ferrite"
appendonly = true
appendfsync = "everysec"
auto_aof_rewrite_percentage = 100
auto_aof_rewrite_min_size = "64mb"

[memory]
maxmemory = "8gb"
maxmemory_policy = "allkeys-lru"

[security]
requirepass = "${FERRITE_PASSWORD}"
# Or use ACL file
# aclfile = "/etc/ferrite/users.acl"

[logging]
loglevel = "info"
logfile = "/var/log/ferrite/ferrite.log"
```

### Environment Variables

Configuration values can reference environment variables:

```toml
[security]
requirepass = "${FERRITE_PASSWORD}"

[tls]
cert_file = "${TLS_CERT_PATH}"
key_file = "${TLS_KEY_PATH}"
```

---

## Standalone Deployment

### Systemd Service

Create `/etc/systemd/system/ferrite.service`:

```ini
[Unit]
Description=Ferrite Key-Value Store
After=network.target

[Service]
Type=simple
User=ferrite
Group=ferrite
ExecStart=/usr/local/bin/ferrite --config /etc/ferrite/ferrite.toml
ExecStop=/bin/kill -SIGTERM $MAINPID
Restart=always
RestartSec=5

# Resource limits
LimitNOFILE=65535
LimitNPROC=65535

# Security hardening
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/var/lib/ferrite /var/log/ferrite

[Install]
WantedBy=multi-user.target
```

Enable and start:

```bash
sudo systemctl daemon-reload
sudo systemctl enable ferrite
sudo systemctl start ferrite
sudo systemctl status ferrite
```

### Log Rotation

Create `/etc/logrotate.d/ferrite`:

```
/var/log/ferrite/*.log {
    daily
    rotate 7
    compress
    delaycompress
    missingok
    notifempty
    create 0640 ferrite ferrite
    postrotate
        /bin/kill -USR1 $(cat /var/run/ferrite.pid 2>/dev/null) 2>/dev/null || true
    endscript
}
```

---

## Docker Deployment

### Basic Docker Run

```bash
docker run -d \
    --name ferrite \
    -p 6379:6379 \
    -v ferrite-data:/data \
    -e FERRITE_PASSWORD=your-secure-password \
    ferrite:latest
```

### Docker Compose

```yaml
# docker-compose.yml
version: '3.8'

services:
  ferrite:
    image: ferrite:latest
    container_name: ferrite
    restart: unless-stopped
    ports:
      - "6379:6379"
    volumes:
      - ferrite-data:/data
      - ./ferrite.toml:/etc/ferrite/ferrite.toml:ro
    environment:
      - FERRITE_PASSWORD=${FERRITE_PASSWORD}
    ulimits:
      nofile:
        soft: 65535
        hard: 65535
    healthcheck:
      test: ["CMD", "redis-cli", "-a", "${FERRITE_PASSWORD}", "ping"]
      interval: 10s
      timeout: 5s
      retries: 3

volumes:
  ferrite-data:
```

### Docker with TLS

```yaml
services:
  ferrite:
    image: ferrite:latest
    ports:
      - "6379:6379"
    volumes:
      - ferrite-data:/data
      - ./certs:/certs:ro
    environment:
      - TLS_CERT_PATH=/certs/server.crt
      - TLS_KEY_PATH=/certs/server.key
      - TLS_CA_PATH=/certs/ca.crt
```

---

## Kubernetes Deployment

### Basic Deployment

```yaml
# ferrite-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ferrite
  labels:
    app: ferrite
spec:
  replicas: 1
  selector:
    matchLabels:
      app: ferrite
  template:
    metadata:
      labels:
        app: ferrite
    spec:
      containers:
      - name: ferrite
        image: ferrite:latest
        ports:
        - containerPort: 6379
          name: ferrite
        resources:
          requests:
            memory: "1Gi"
            cpu: "500m"
          limits:
            memory: "4Gi"
            cpu: "2000m"
        volumeMounts:
        - name: data
          mountPath: /data
        - name: config
          mountPath: /etc/ferrite
        env:
        - name: FERRITE_PASSWORD
          valueFrom:
            secretKeyRef:
              name: ferrite-secret
              key: password
        livenessProbe:
          exec:
            command:
            - redis-cli
            - ping
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          exec:
            command:
            - redis-cli
            - ping
          initialDelaySeconds: 5
          periodSeconds: 5
      volumes:
      - name: data
        persistentVolumeClaim:
          claimName: ferrite-pvc
      - name: config
        configMap:
          name: ferrite-config
---
apiVersion: v1
kind: Service
metadata:
  name: ferrite
spec:
  selector:
    app: ferrite
  ports:
  - port: 6379
    targetPort: 6379
  type: ClusterIP
```

### StatefulSet for Persistence

```yaml
# ferrite-statefulset.yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: ferrite
spec:
  serviceName: ferrite
  replicas: 1
  selector:
    matchLabels:
      app: ferrite
  template:
    metadata:
      labels:
        app: ferrite
    spec:
      containers:
      - name: ferrite
        image: ferrite:latest
        ports:
        - containerPort: 6379
        volumeMounts:
        - name: data
          mountPath: /data
  volumeClaimTemplates:
  - metadata:
      name: data
    spec:
      accessModes: ["ReadWriteOnce"]
      storageClassName: fast-ssd
      resources:
        requests:
          storage: 10Gi
```

### ConfigMap and Secret

```yaml
# ferrite-configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: ferrite-config
data:
  ferrite.toml: |
    [server]
    bind = "0.0.0.0"
    port = 6379

    [persistence]
    dir = "/data"
    appendonly = true

    [memory]
    maxmemory = "3gb"
---
apiVersion: v1
kind: Secret
metadata:
  name: ferrite-secret
type: Opaque
data:
  password: <base64-encoded-password>
```

---

## High Availability Setup

### Primary-Replica Configuration

**Primary node** (`/etc/ferrite/primary.toml`):
```toml
[server]
bind = "0.0.0.0"
port = 6379

[replication]
role = "primary"
repl_backlog_size = "64mb"
```

**Replica node** (`/etc/ferrite/replica.toml`):
```toml
[server]
bind = "0.0.0.0"
port = 6379

[replication]
replicaof = "primary-host 6379"
replica_read_only = true
```

### Sentinel for Automatic Failover

```toml
# sentinel.toml
[sentinel]
port = 26379

[[sentinel.monitor]]
name = "mymaster"
host = "primary-host"
port = 6379
quorum = 2

[sentinel.config]
down_after_milliseconds = 5000
failover_timeout = 60000
parallel_syncs = 1
```

Run multiple sentinels (minimum 3 for quorum):

```bash
ferrite-sentinel --config sentinel.toml
```

---

## Cluster Deployment

### Cluster Configuration

Each node needs cluster mode enabled:

```toml
[cluster]
enabled = true
node_timeout = 15000
replica_validity_factor = 10

[server]
port = 6379
cluster_port = 16379  # port + 10000
```

### Create Cluster

```bash
# Start 6 nodes (3 primaries + 3 replicas)
ferrite --config node1.toml &
ferrite --config node2.toml &
ferrite --config node3.toml &
ferrite --config node4.toml &
ferrite --config node5.toml &
ferrite --config node6.toml &

# Create cluster
redis-cli --cluster create \
    node1:6379 node2:6379 node3:6379 \
    node4:6379 node5:6379 node6:6379 \
    --cluster-replicas 1

# Verify cluster
redis-cli --cluster check node1:6379
```

### Kubernetes Cluster

See `kubernetes/ferrite-cluster.yaml` in the repository for a complete example.

---

## Security Hardening

### Enable TLS

```toml
[tls]
enabled = true
port = 6380
cert_file = "/etc/ferrite/certs/server.crt"
key_file = "/etc/ferrite/certs/server.key"
ca_cert_file = "/etc/ferrite/certs/ca.crt"
client_auth = true  # Require client certificates
```

### ACL Configuration

```toml
[security]
aclfile = "/etc/ferrite/users.acl"
```

Create `/etc/ferrite/users.acl`:

```
user default off
user admin on >admin-password ~* +@all
user reader on >reader-password ~* +@read -@dangerous
user writer on >writer-password ~app:* +@write +@read
```

### Network Security

```toml
[server]
# Bind to specific interface
bind = "10.0.0.1"

# Or use protected mode
protected_mode = true
```

### Firewall Rules

```bash
# Allow only specific IPs
iptables -A INPUT -p tcp --dport 6379 -s 10.0.0.0/8 -j ACCEPT
iptables -A INPUT -p tcp --dport 6379 -j DROP
```

---

## Monitoring Setup

### Prometheus Integration

```toml
[metrics]
enabled = true
port = 9121
```

Prometheus scrape config:

```yaml
scrape_configs:
  - job_name: 'ferrite'
    static_configs:
      - targets: ['ferrite:9121']
```

### Grafana Dashboard

Import the provided dashboard from `grafana/ferrite-dashboard.json`.

Key panels:
- Operations per second
- Memory usage and fragmentation
- Connected clients
- Key hit/miss ratio
- Replication lag
- Command latency percentiles

### Alerting Rules

```yaml
# prometheus-alerts.yaml
groups:
- name: ferrite
  rules:
  - alert: FerriteDown
    expr: up{job="ferrite"} == 0
    for: 1m
    labels:
      severity: critical
    annotations:
      summary: "Ferrite instance down"

  - alert: FerriteHighMemory
    expr: ferrite_memory_used_bytes / ferrite_memory_max_bytes > 0.9
    for: 5m
    labels:
      severity: warning
    annotations:
      summary: "Ferrite memory usage above 90%"

  - alert: FerriteReplicationLag
    expr: ferrite_replication_lag_seconds > 10
    for: 1m
    labels:
      severity: warning
    annotations:
      summary: "Ferrite replication lag detected"
```

---

## Backup & Recovery

### Automated Backups

```toml
[backup]
enabled = true
schedule = "0 */6 * * *"  # Every 6 hours
retention = 7  # Keep 7 days
dir = "/var/backups/ferrite"
compress = true
```

### Manual Backup

```bash
# Trigger RDB snapshot
redis-cli BGSAVE

# Wait for completion
redis-cli LASTSAVE

# Copy snapshot
cp /var/lib/ferrite/dump.rdb /backup/dump-$(date +%Y%m%d).rdb
```

### Recovery

```bash
# Stop Ferrite
sudo systemctl stop ferrite

# Restore from backup
cp /backup/dump-20240101.rdb /var/lib/ferrite/dump.rdb
chown ferrite:ferrite /var/lib/ferrite/dump.rdb

# Start Ferrite
sudo systemctl start ferrite
```

### Point-in-Time Recovery with AOF

```bash
# Stop Ferrite
sudo systemctl stop ferrite

# Restore RDB as base
cp /backup/dump.rdb /var/lib/ferrite/

# Replay AOF for point-in-time
# Edit AOF to remove commands after desired point
ferrite-check-aof --fix /var/lib/ferrite/appendonly.aof

# Start Ferrite
sudo systemctl start ferrite
```

---

## Upgrade Procedures

### Rolling Upgrade (Cluster)

1. Upgrade replicas first:
```bash
# For each replica
redis-cli -h replica CLUSTER FAILOVER
# Wait for failover
# Stop and upgrade replica
# Start replica
# Wait for sync
```

2. Upgrade former primaries (now replicas):
```bash
# Repeat for each node
```

### Standalone Upgrade

```bash
# Create backup
redis-cli BGSAVE
cp /var/lib/ferrite/dump.rdb /backup/

# Stop service
sudo systemctl stop ferrite

# Replace binary
sudo cp ferrite-new /usr/local/bin/ferrite

# Start service
sudo systemctl start ferrite

# Verify
redis-cli INFO server
```

### Rollback Procedure

```bash
# Stop service
sudo systemctl stop ferrite

# Restore previous binary
sudo cp /backup/ferrite-old /usr/local/bin/ferrite

# Restore data if needed
cp /backup/dump.rdb /var/lib/ferrite/

# Start service
sudo systemctl start ferrite
```

---

## Troubleshooting Deployment

### Common Issues

**Port already in use**:
```bash
lsof -i :6379
# Kill conflicting process or use different port
```

**Permission denied**:
```bash
chown -R ferrite:ferrite /var/lib/ferrite
chmod 750 /var/lib/ferrite
```

**Out of memory**:
```bash
# Check memory limits in config
# Reduce maxmemory or add eviction policy
```

**Connection refused**:
```bash
# Check bind address
# Check firewall rules
# Verify service is running
```

### Health Checks

```bash
# Basic connectivity
redis-cli PING

# Detailed status
redis-cli INFO

# Cluster status
redis-cli CLUSTER INFO

# Replication status
redis-cli INFO replication
```

---

## Further Reading

- [PERFORMANCE_TUNING.md](PERFORMANCE_TUNING.md) - Performance optimization
- [TROUBLESHOOTING.md](TROUBLESHOOTING.md) - Problem resolution
- [SECURITY.md](../SECURITY.md) - Security policies
- [CONTRIBUTING.md](../CONTRIBUTING.md) - Development guide
