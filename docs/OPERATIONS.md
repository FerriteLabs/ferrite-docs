# Ferrite Operations Guide

This guide covers deploying, configuring, monitoring, and maintaining Ferrite in production environments.

## Table of Contents

1. [Deployment](#deployment)
2. [Configuration](#configuration)
3. [Monitoring](#monitoring)
4. [Backup & Recovery](#backup--recovery)
5. [Security](#security)
6. [High Availability](#high-availability)
7. [Troubleshooting](#troubleshooting)

## Deployment

### System Requirements

**Minimum:**
- 2 CPU cores
- 4GB RAM
- 10GB disk space
- Linux kernel 5.11+ (for io_uring) or macOS 12+

**Recommended for Production:**
- 8+ CPU cores
- 32GB+ RAM
- NVMe SSD storage
- 10Gbps network

### Installation

**From Source:**
```bash
# Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Clone and build
git clone https://github.com/ferritelabs/ferrite.git
cd ferrite
cargo build --release

# Install binary
sudo cp target/release/ferrite /usr/local/bin/
```

**Create System User:**
```bash
sudo useradd -r -s /bin/false ferrite
sudo mkdir -p /var/lib/ferrite /var/log/ferrite /etc/ferrite
sudo chown ferrite:ferrite /var/lib/ferrite /var/log/ferrite
```

**Systemd Service:**
```ini
# /etc/systemd/system/ferrite.service
[Unit]
Description=Ferrite Key-Value Store
After=network.target

[Service]
Type=simple
User=ferrite
Group=ferrite
ExecStart=/usr/local/bin/ferrite --config /etc/ferrite/ferrite.toml
Restart=always
RestartSec=5
LimitNOFILE=65535

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable ferrite
sudo systemctl start ferrite
```

## Configuration

### Complete Configuration Reference

```toml
# /etc/ferrite/ferrite.toml

[server]
# Network binding
bind = "0.0.0.0"
port = 6379

# Connection limits
max_connections = 10000
timeout = 0  # Client timeout in seconds (0 = no timeout)
tcp_keepalive = 300
acl_file = "/var/lib/ferrite/users.acl"  # Optional ACL file

[storage]
# Database configuration
backend = "hybridlog"
data_dir = "/var/lib/ferrite"
databases = 16
max_memory = 8589934592  # 8GB
max_key_size = 536870912
max_value_size = 536870912
hybridlog_mutable_size = 1073741824
hybridlog_readonly_size = 4294967296
hybridlog_auto_tiering = true
hybridlog_migration_threshold = 0.8

[persistence]
# AOF configuration
aof_enabled = true
aof_path = "/var/lib/ferrite/appendonly.aof"
aof_sync = "everysec"  # always, everysec, no

# Checkpointing
checkpoint_enabled = true
checkpoint_interval = 300  # seconds
checkpoint_dir = "/var/lib/ferrite/checkpoints"

[replication]
# Replica configuration
replicaof = ""  # "primary_host primary_port" for replicas
replica_read_only = true
backlog_size = 104857600
repl_timeout = 60
reconnect_delay = 5

[tls]
enabled = false
port = 6380  # TLS port (separate from non-TLS)
cert_file = "/etc/ferrite/tls/server.crt"
key_file = "/etc/ferrite/tls/server.key"
ca_file = "/etc/ferrite/tls/ca.crt"
require_client_cert = false
min_version = "1.2"

[acl]
enabled = false
acl_file = "/etc/ferrite/users.acl"
default_user_password = ""  # Empty = no password required

[cluster]
enabled = false
bus_port_offset = 10000
node_timeout = 15000
replica_count = 1
failover_enabled = true
min_primaries = 1
require_full_coverage = true

[metrics]
enabled = true
bind = "0.0.0.0"
port = 9090
port = 9090
path = "/metrics"

[logging]
level = "info"  # trace, debug, info, warn, error
format = "json"  # json, text
file = "/var/log/ferrite/ferrite.log"
max_size = "100MB"
max_backups = 5
```

### Memory Tuning

```bash
# Increase file descriptors
echo "* soft nofile 65535" >> /etc/security/limits.conf
echo "* hard nofile 65535" >> /etc/security/limits.conf

# Kernel parameters
echo "net.core.somaxconn = 65535" >> /etc/sysctl.conf
echo "vm.overcommit_memory = 1" >> /etc/sysctl.conf
echo "net.ipv4.tcp_max_syn_backlog = 65535" >> /etc/sysctl.conf
sysctl -p
```

## Monitoring

### Prometheus Metrics

Ferrite exposes metrics at `http://localhost:9090/metrics`:

```bash
curl http://localhost:9090/metrics
```

**Key Metrics:**

| Metric | Type | Description |
|--------|------|-------------|
| `ferrite_commands_total` | Counter | Total commands by type |
| `ferrite_commands_duration_seconds` | Histogram | Command latency |
| `ferrite_connections_current` | Gauge | Active connections |
| `ferrite_connections_total` | Counter | Total connections |
| `ferrite_memory_used_bytes` | Gauge | Memory usage |
| `ferrite_memory_peak_bytes` | Gauge | Peak memory usage |
| `ferrite_keyspace_keys` | Gauge | Keys per database |
| `ferrite_keyspace_expires` | Gauge | Keys with TTL |
| `ferrite_aof_size_bytes` | Gauge | AOF file size |
| `ferrite_replication_offset` | Gauge | Replication offset |
| `ferrite_cluster_slots_assigned` | Gauge | Assigned slots |

### Grafana Dashboard

Example dashboard JSON available at `docs/grafana-dashboard.json`.

**Key Panels:**
- Commands per second (by type)
- Latency percentiles (P50, P99, P99.9)
- Memory usage trend
- Connection count
- Replication lag
- Cache hit rate

### Health Checks

**TCP Health Check:**
```bash
redis-cli -p 6379 PING
# Expected: PONG
```

**HTTP Health Check:**
```bash
curl http://localhost:9090/health
# Expected: {"status":"healthy"}
```

**Kubernetes Probes:**
```yaml
livenessProbe:
  tcpSocket:
    port: 6379
  initialDelaySeconds: 5
  periodSeconds: 10

readinessProbe:
  exec:
    command:
      - redis-cli
      - ping
  initialDelaySeconds: 5
  periodSeconds: 5
```

### Alerting Rules

Example Prometheus alerting rules:

```yaml
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

      - alert: FerriteHighLatency
        expr: histogram_quantile(0.99, ferrite_commands_duration_seconds_bucket) > 0.01
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Ferrite P99 latency above 10ms"

      - alert: FerriteReplicationLag
        expr: ferrite_replication_lag_seconds > 10
        for: 1m
        labels:
          severity: warning
        annotations:
          summary: "Ferrite replication lag above 10s"
```

## Backup & Recovery

### Manual Backup

```bash
# Create backup via CLI
redis-cli BGSAVE

# Check backup status
redis-cli LASTSAVE
```

### Automated Backups

Configure in `ferrite.toml`:
```toml
[persistence]
backup_enabled = true
backup_schedule = "0 */6 * * *"  # Every 6 hours
backup_retention = 7  # Keep 7 days
backup_dir = "/var/lib/ferrite/backups"
```

### Cloud Backup

```toml
[persistence.cloud_backup]
enabled = true
provider = "s3"  # s3, gcs, azure
bucket = "ferrite-backups"
prefix = "prod/"
region = "us-east-1"
```

### Point-in-Time Recovery

1. Stop Ferrite
2. Restore checkpoint file
3. Replay AOF from desired timestamp

```bash
# Stop service
sudo systemctl stop ferrite

# Restore checkpoint
cp /backups/checkpoint-20240101T120000.ckpt /var/lib/ferrite/data/

# Truncate AOF to specific timestamp (use ferrite-tools)
ferrite-tools aof-truncate --file appendonly.aof --until "2024-01-01T12:30:00"

# Start service
sudo systemctl start ferrite
```

### Disaster Recovery

**Full Recovery Process:**

1. Provision new infrastructure
2. Install Ferrite
3. Restore latest backup
4. Verify data integrity
5. Update DNS/load balancer
6. Monitor for issues

```bash
# Restore from backup
ferrite --restore /backups/latest.ferrite.backup

# Verify
redis-cli INFO keyspace
redis-cli DBSIZE
```

## Security

### TLS Configuration

**Generate Certificates:**
```bash
# Create CA
openssl genrsa -out ca.key 4096
openssl req -new -x509 -days 3650 -key ca.key -out ca.crt

# Create server cert
openssl genrsa -out server.key 2048
openssl req -new -key server.key -out server.csr
openssl x509 -req -days 365 -in server.csr -CA ca.crt -CAkey ca.key -out server.crt
```

**Enable TLS:**
```toml
[tls]
enabled = true
cert_file = "/etc/ferrite/tls/server.crt"
key_file = "/etc/ferrite/tls/server.key"
```

**Connect with TLS:**
```bash
redis-cli --tls --cacert ca.crt -p 6380
```

### ACL Configuration

**Default User:**
```bash
# Set password for default user
ACL SETUSER default on >secretpassword ~* &* +@all
```

**Create Application User:**
```bash
# Read-only user for analytics
ACL SETUSER analytics on >analyticspass ~analytics:* +@read +@connection

# Application user with limited commands
ACL SETUSER myapp on >myapppass ~myapp:* +@string +@list +@connection -DEBUG
```

**Load ACL File:**
```bash
# /etc/ferrite/users.acl
user default on nopass ~* &* +@all
user admin on >adminpass ~* &* +@all
user readonly on >readpass ~* &* +@read
```

### Network Security

**Firewall Rules:**
```bash
# Allow only specific IPs
iptables -A INPUT -p tcp --dport 6379 -s 10.0.0.0/8 -j ACCEPT
iptables -A INPUT -p tcp --dport 6379 -j DROP
```

**Bind to Specific Interface:**
```toml
[server]
bind = "10.0.1.100"  # Internal IP only
```

## High Availability

### Primary-Replica Setup

**Primary Configuration:**
```toml
# No special config needed
```

**Replica Configuration:**
```toml
[replication]
replicaof = "primary.example.com 6379"
replica_read_only = true
```

**Verify Replication:**
```bash
# On primary
redis-cli INFO replication
# connected_slaves:2

# On replica
redis-cli INFO replication
# role:slave
# master_link_status:up
```

### Sentinel-Style Failover

Deploy multiple replicas with monitoring:

```yaml
# docker-compose.yml
services:
  primary:
    image: ferrite:latest
    ports:
      - "6379:6379"

  replica1:
    image: ferrite:latest
    command: --replicaof primary 6379
    depends_on:
      - primary

  replica2:
    image: ferrite:latest
    command: --replicaof primary 6379
    depends_on:
      - primary
```

### Cluster Deployment

**Initialize Cluster:**
```bash
# Start 6 nodes (3 primary + 3 replica)
for port in 7000 7001 7002 7003 7004 7005; do
  ferrite --port $port --cluster-enabled yes &
done

# Create cluster
redis-cli --cluster create \
  127.0.0.1:7000 127.0.0.1:7001 127.0.0.1:7002 \
  127.0.0.1:7003 127.0.0.1:7004 127.0.0.1:7005 \
  --cluster-replicas 1
```

**Cluster Operations:**
```bash
# Check cluster status
redis-cli -c -p 7000 CLUSTER INFO

# Add node
redis-cli --cluster add-node new_node:7006 existing_node:7000

# Reshard
redis-cli --cluster reshard existing_node:7000

# Remove node
redis-cli --cluster del-node existing_node:7000 node_id
```

## Troubleshooting

### Common Issues

**Connection Refused:**
```bash
# Check if service is running
sudo systemctl status ferrite

# Check listening port
netstat -tlnp | grep 6379

# Check firewall
sudo iptables -L -n
```

**Out of Memory:**
```bash
# Check memory usage
redis-cli INFO memory

# Set memory limit
redis-cli CONFIG SET maxmemory 4gb
redis-cli CONFIG SET maxmemory-policy allkeys-lru
```

**High Latency:**
```bash
# Check slow log
redis-cli SLOWLOG GET 10

# Check connected clients
redis-cli CLIENT LIST

# Check command stats
redis-cli INFO commandstats
```

**Replication Issues:**
```bash
# Check replication status
redis-cli INFO replication

# Force full sync
redis-cli DEBUG RELOAD

# Check replica offset
redis-cli ROLE
```

### Debug Commands

```bash
# Memory usage per key
redis-cli MEMORY USAGE mykey

# Memory stats
redis-cli MEMORY STATS

# Debug sleep (for testing)
redis-cli DEBUG SLEEP 0.5

# Client connections
redis-cli CLIENT LIST

# Slow queries
redis-cli SLOWLOG GET 25
redis-cli SLOWLOG RESET
```

### Log Analysis

```bash
# View recent logs
journalctl -u ferrite -f

# Search for errors
journalctl -u ferrite | grep -i error

# Export logs
journalctl -u ferrite --since "1 hour ago" > ferrite_logs.txt
```

### Performance Tuning

**High Throughput:**
```toml
[server]
tcp_keepalive = 60

[storage]
backend = "memory"
max_memory = 8589934592  # 8GB
```

**Low Latency:**
```toml
[persistence]
aof_sync = "no"  # Trade durability for speed

[storage]
backend = "memory"
```

**Memory Optimization:**
```toml
[storage]
max_memory = 30000000000  # Leave headroom for OS
hybridlog_mutable_size = 4294967296
hybridlog_readonly_size = 17179869184
```
