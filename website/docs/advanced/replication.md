---
sidebar_position: 2
title: Replication Runbook
description: Complete replication guide covering primary-replica setup, PSYNC2 protocol, monitoring, troubleshooting, and failover procedures.
keywords: [replication, primary, replica, psync2, failover, runbook, high availability]
maturity: beta
---

# Replication Runbook

Ferrite implements Redis-compatible asynchronous primary-replica replication using the PSYNC2 protocol. All write operations are processed on the primary and asynchronously streamed to one or more replicas.

## Overview

### Architecture

Ferrite follows a single-primary, multi-replica model. The primary accepts all writes and propagates them to connected replicas through a replication stream. Replicas serve read-only traffic and can be promoted to primary during failover.

```
                ┌─────────────┐
                │   Primary   │
                │   (Write)   │
                └──────┬──────┘
                       │  PSYNC2 stream
      ┌────────────────┼────────────────┐
      │                │                │
┌─────▼─────┐    ┌─────▼─────┐    ┌─────▼─────┐
│  Replica  │    │  Replica  │    │  Replica  │
│  (Read)   │    │  (Read)   │    │  (Read)   │
└───────────┘    └───────────┘    └───────────┘
```

### Replication Model

- **Asynchronous**: Writes are acknowledged to clients before replicas confirm receipt. Use the `WAIT` command for synchronous semantics when needed.
- **Stream-based**: The primary maintains a `ReplicationStream` backed by a circular `ReplicationBacklog`. Every mutating command (SET, DEL, LPUSH, ZADD, etc.) is RESP-encoded and broadcast to replicas.
- **PSYNC2 protocol**: Supports both full resynchronization (RDB snapshot + stream) and partial resynchronization (backlog catch-up) with dual replication ID tracking for seamless failover.

### Replication Lifecycle

1. Replica connects to the primary and sends `REPLCONF` with capabilities
2. Replica sends `PSYNC <replid> <offset>` (or `PSYNC ? -1` for first sync)
3. Primary responds with `+FULLRESYNC` or `+CONTINUE`
4. On full resync: primary generates an RDB snapshot and streams it, followed by the live command stream
5. On partial resync: primary streams missed commands from the backlog
6. Heartbeats (`REPLCONF GETACK *`) every 10 seconds maintain the connection and track replica lag

## Setup Guide

### Single Primary, Single Replica

The simplest HA setup — one primary accepting writes, one replica for reads and failover.

**Primary configuration (`ferrite-primary.toml`):**

```toml
[server]
bind = "0.0.0.0"
port = 6379

[replication]
role = "primary"
repl_backlog_size = "1MB"
```

**Replica configuration (`ferrite-replica.toml`):**

```toml
[server]
bind = "0.0.0.0"
port = 6380

[replication]
role = "replica"
primary_host = "127.0.0.1"
primary_port = 6379
replica_read_only = true
```

**Start both nodes:**

```bash
# Terminal 1 — Primary
./ferrite --config ferrite-primary.toml

# Terminal 2 — Replica
./ferrite --config ferrite-replica.toml
```

**Verify replication is working:**

```bash
# Write on primary
redis-cli -p 6379 SET hello world

# Read from replica
redis-cli -p 6380 GET hello
# "world"

# Check replication status on primary
redis-cli -p 6379 INFO replication
```

### Primary with Multiple Replicas

Scale read capacity and improve redundancy by adding replicas. Each replica independently connects to the primary.

```toml
# ferrite-replica-2.toml
[server]
bind = "0.0.0.0"
port = 6381

[replication]
role = "replica"
primary_host = "10.0.0.1"
primary_port = 6379
replica_read_only = true
```

```toml
# ferrite-replica-3.toml
[server]
bind = "0.0.0.0"
port = 6382

[replication]
role = "replica"
primary_host = "10.0.0.1"
primary_port = 6379
replica_read_only = true
```

You can also configure replication at runtime:

```bash
# On any running Ferrite instance, make it a replica
redis-cli -p 6381 REPLICAOF 10.0.0.1 6379
redis-cli -p 6382 REPLICAOF 10.0.0.1 6379
```

### Cascading Replication (Replica of Replica)

:::caution Planned Feature
Cascading replication (chaining replicas) is **not yet implemented**. Currently all replicas must connect directly to the primary. This section documents the planned behavior.
:::

In large deployments, cascading replication reduces load on the primary by allowing replicas to replicate from other replicas:

```
Primary ──▶ Replica-A ──▶ Replica-B
                     └──▶ Replica-C
```

When available, configure by pointing a replica's `primary_host` at another replica instead of the primary.

## Configuration Reference

```toml
[replication]
role = "primary"                    # "primary" or "replica"
primary_host = ""                   # Primary host (replicas only)
primary_port = 6379                 # Primary port (replicas only)
primary_auth = ""                   # Primary password (if auth enabled)
replica_read_only = true            # Reject writes on replica
replica_serve_stale_data = true     # Serve data during sync
replica_priority = 100              # Failover priority (lower = preferred)
repl_backlog_size = "1MB"           # Replication backlog size (default: 1 MB)
repl_backlog_ttl = 3600             # Backlog TTL when no replicas (seconds)
repl_diskless_sync = false          # Diskless RDB transfer
repl_diskless_sync_delay = 5        # Delay before diskless sync (seconds)
repl_timeout = 60                   # Replica timeout (seconds)
min_replicas_to_write = 0           # Minimum replicas for writes (0 = disabled)
min_replicas_max_lag = 10           # Maximum acceptable lag (seconds)
crdt_enabled = false                # Enable CRDT replication (experimental)
```

### Key Parameters Explained

| Parameter | Default | Description |
|-----------|---------|-------------|
| `repl_backlog_size` | `1MB` | Circular buffer for partial resync. Size this based on write throughput × expected disconnect duration. |
| `repl_timeout` | `60` | Seconds of inactivity before a replica is considered stale (heartbeats are sent every 10s). |
| `min_replicas_to_write` | `0` | When > 0, writes fail with `NOREPLICAS` if fewer replicas are connected and within lag threshold. |
| `min_replicas_max_lag` | `10` | Maximum ACK lag in seconds for a replica to count toward `min_replicas_to_write`. |
| `replica_serve_stale_data` | `true` | If `false`, replicas return errors for reads during initial sync. |

### Environment Variable Overrides

Configuration can also be set via environment variables (useful for Docker/Kubernetes):

```bash
FERRITE_REPLICATION_ROLE=primary
FERRITE_REPLICATION_PRIMARY_HOST=10.0.0.1
FERRITE_REPLICATION_PRIMARY_PORT=6379
FERRITE_REPLICATION_REPL_BACKLOG_SIZE=1048576
FERRITE_REPLICATION_MIN_REPLICAS_TO_WRITE=1
FERRITE_REPLICATION_MIN_REPLICAS_MAX_LAG=10
```

## Docker Compose Example

A complete primary + 2 replicas setup with monitoring. See also `ferrite-ops/docker/docker-compose.ha.yml` for the standalone HA compose file.

```yaml
services:
  ferrite-primary:
    image: ferrite:latest
    ports:
      - "6379:6379"
      - "9090:9090"
    volumes:
      - primary-data:/var/lib/ferrite/data
    environment:
      - FERRITE_REPLICATION_ROLE=primary
      - FERRITE_REPLICATION_MIN_REPLICAS_TO_WRITE=1
      - FERRITE_REPLICATION_MIN_REPLICAS_MAX_LAG=10
      - RUST_LOG=ferrite=info
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

## Replication Commands

```bash
# Configure replication at runtime
REPLICAOF host port          # Make this node a replica of host:port
REPLICAOF NO ONE             # Promote this replica to primary

# Check replication status
INFO replication

# Synchronous write acknowledgment
WAIT numreplicas timeout_ms  # Block until N replicas ACK or timeout
```

## Monitoring Replication

### INFO replication Output

**On the primary:**

```bash
127.0.0.1:6379> INFO replication
# Replication
role:master
connected_slaves:2
slave0:ip=10.0.0.2,port=6379,state=online,offset=284650,lag=0
slave1:ip=10.0.0.3,port=6379,state=online,offset=284650,lag=0
master_replid:a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8
master_repl_offset:284650
repl_backlog_active:1
repl_backlog_size:1048576
repl_backlog_first_byte_offset:0
repl_backlog_histlen:284650
```

| Field | Description |
|-------|-------------|
| `role` | `master` on primary, `slave` on replica |
| `connected_slaves` | Number of online replicas |
| `slaveN` | Per-replica details: IP, port, state (`online`/`wait_bgsave`/`send_bulk`), offset, lag in seconds |
| `master_replid` | Current PSYNC2 replication ID |
| `master_repl_offset` | Total bytes written to the replication stream |
| `repl_backlog_size` | Configured backlog size (bytes) |
| `repl_backlog_histlen` | Actual data in the backlog (bytes) |

**On a replica:**

```bash
127.0.0.1:6380> INFO replication
# Replication
role:slave
master_host:10.0.0.1
master_port:6379
master_link_status:up
master_last_io_seconds_ago:0
master_sync_in_progress:0
slave_read_only:1
slave_repl_offset:284650
```

### Prometheus Metrics

Ferrite exposes replication metrics on the `/metrics` endpoint:

```promql
# Replication lag in bytes (per replica)
ferrite_replica_lag_bytes

# Number of connected replicas
ferrite_connected_replicas

# Replication offset (primary)
ferrite_repl_offset

# Full resyncs triggered
ferrite_full_resyncs_total

# Partial resyncs triggered
ferrite_partial_resyncs_total
```

### Grafana Alerts

Add these alert rules to your Grafana or Prometheus alert configuration:

```yaml
groups:
  - name: ferrite-replication
    rules:
      - alert: ReplicationLagHigh
        expr: ferrite_replica_lag_bytes > 1048576
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Replica {{ $labels.instance }} lag exceeds 1 MB"
          description: "Replication lag is {{ $value }} bytes. Check network and replica health."

      - alert: ReplicationLagCritical
        expr: ferrite_replica_lag_bytes > 10485760
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "Replica {{ $labels.instance }} lag exceeds 10 MB"
          description: "Replica may need a full resync. Investigate immediately."

      - alert: NoConnectedReplicas
        expr: ferrite_connected_replicas == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Primary has no connected replicas"
          description: "All replicas are disconnected. HA is degraded."

      - alert: ReplicaLinkDown
        expr: ferrite_replica_link_status == 0
        for: 30s
        labels:
          severity: warning
        annotations:
          summary: "Replica lost connection to primary"
```

## WAIT Command

The `WAIT` command provides synchronous replication semantics for critical writes:

```bash
# Write a value
127.0.0.1:6379> SET order:12345 '{"status":"confirmed"}'
OK

# Wait for at least 1 replica to acknowledge, timeout 1000ms
127.0.0.1:6379> WAIT 1 1000
(integer) 1    # 1 replica confirmed
```

If the timeout expires before enough replicas acknowledge, `WAIT` returns the number of replicas that did acknowledge. The write is **not rolled back** — it simply may not yet be durable on replicas.

## Write Quorum

Ensure writes only succeed when replicas are healthy:

```toml
[replication]
min_replicas_to_write = 1
min_replicas_max_lag = 10
```

With this configuration, the primary rejects writes if fewer than 1 replica has sent an ACK within the last 10 seconds:

```bash
127.0.0.1:6379> SET key value
(error) NOREPLICAS Not enough replicas
```

This prevents a partitioned primary from silently accepting writes that would be lost on failover.

## Replication Backlog and PSYNC2

### How PSYNC2 Works

The PSYNC2 protocol supports seamless partial resynchronization, even across failovers:

1. **Dual replication IDs**: The primary maintains a primary ID (`master_replid`) and a secondary ID (`master_replid2`). On failover, the old primary's ID is preserved as `replid2` so replicas of the old primary can still partial-resync.
2. **Circular backlog**: Recently replicated commands are kept in a circular buffer (`repl_backlog_size`). If a replica reconnects and its offset is within the backlog, only missed commands are streamed.
3. **Offset tracking**: Each replica periodically sends its current offset via `REPLCONF ACK`. The primary uses this to calculate lag and determine partial sync eligibility.

### Full Resync vs Partial Resync

| Scenario | Resync Type | Impact |
|----------|-------------|--------|
| First-time replica connection | Full | RDB snapshot transfer + stream |
| Brief network blip (offset in backlog) | Partial | Only missed commands streamed |
| Long disconnect (offset evicted from backlog) | Full | Full RDB transfer required |
| Failover — replica knows old primary ID | Partial | If offset within backlog, partial sync via `replid2` |
| Replica restarted (no saved state) | Full | Sends `PSYNC ? -1` |

### Sizing the Backlog

```
recommended_backlog = write_throughput_bytes_per_sec × max_expected_disconnect_seconds
```

For example, at 10 MB/s write throughput with up to 30 seconds of disconnect tolerance:

```toml
[replication]
repl_backlog_size = "300MB"
```

## Read Scaling

Distribute read load across replicas:

```python
import redis
from random import choice

replicas = [
    redis.Redis(host='replica1', port=6379),
    redis.Redis(host='replica2', port=6379),
    redis.Redis(host='replica3', port=6379),
]
primary = redis.Redis(host='primary', port=6379)

def read(key):
    return choice(replicas).get(key)

def write(key, value):
    return primary.set(key, value)
```

For production, use HAProxy or a client-side library with built-in read/write splitting. See [High Availability](/docs/deployment/high-availability) for load balancer examples.

## Troubleshooting

### Replica Falling Behind

**Symptoms**: `lag` in `INFO replication` is increasing; `ferrite_replica_lag_bytes` growing.

**Diagnosis:**

```bash
# Check lag on primary
redis-cli -p 6379 INFO replication | grep slave
# slave0:ip=10.0.0.2,port=6379,state=online,offset=100000,lag=5

# Compare offsets
redis-cli -p 6379 INFO replication | grep master_repl_offset
redis-cli -p 6380 INFO replication | grep slave_repl_offset
```

**Common causes and fixes:**

| Cause | Fix |
|-------|-----|
| Replica CPU/memory saturation | Scale replica resources |
| Network bandwidth bottleneck | Check network between primary and replica; consider compression |
| Slow disk I/O on replica | Use faster storage; check if AOF fsync is too aggressive |
| Large keys or bulk operations | Spread large writes over time |

### Split-Brain Scenarios

A split-brain occurs when a partitioned primary continues accepting writes while a replica is promoted. Ferrite mitigates this with `min_replicas_to_write`:

```toml
[replication]
min_replicas_to_write = 1
min_replicas_max_lag = 10
```

With this setting, if the old primary loses connectivity to all replicas, it stops accepting writes within `min_replicas_max_lag` seconds. Data written during the lag window may be lost after failover.

**Recovery from split-brain:**

1. Identify which node has the most recent data
2. Demote the old primary: `REPLICAOF <new-primary-host> <new-primary-port>`
3. The old primary performs a full resync, discarding conflicting writes
4. Verify data integrity on the new primary

### Network Partition Handling

When a replica loses connectivity to the primary:

1. The replica enters `Disconnected` state after `repl_timeout` seconds (default: 60)
2. If `replica_serve_stale_data = true` (default), the replica continues serving reads from its last-known state
3. On reconnection, the replica attempts partial resync via PSYNC2
4. If the backlog has been evicted, a full resync is triggered automatically

The primary detects a stale replica when no ACK is received for `repl_timeout` seconds and marks it offline. The `check_stale_replicas` routine runs periodically.

### Full Resync vs Partial Resync Debugging

If replicas are performing unexpected full resyncs:

```bash
# Check backlog utilization on primary
redis-cli -p 6379 INFO replication | grep repl_backlog

# If repl_backlog_histlen is close to repl_backlog_size, increase the backlog:
# [replication]
# repl_backlog_size = "64MB"
```

Monitor `ferrite_full_resyncs_total` — frequent full resyncs indicate the backlog is too small for your write volume and disconnect frequency.

## Failover Procedures

### Manual Failover Steps

**Step 1: Verify replica state**

```bash
# On the replica you want to promote, check it's caught up
redis-cli -p 6380 INFO replication
# Ensure slave_repl_offset is close to the primary's master_repl_offset
```

**Step 2: (Optional) Stop writes on the primary**

```bash
# Set the primary to reject writes, giving replicas time to catch up
redis-cli -p 6379 CONFIG SET min-replicas-to-write 3
# (set to a number higher than actual replicas)
```

**Step 3: Promote the replica**

```bash
# On the chosen replica
redis-cli -p 6380 REPLICAOF NO ONE
```

The promoted replica:
- Switches role to `Primary`
- Generates a new replication ID (via `rotate_replication_ids`)
- Preserves the old primary's replication ID as `replid2` for partial resync by other replicas

**Step 4: Reconfigure remaining replicas**

```bash
# Point all other replicas to the new primary
redis-cli -p 6381 REPLICAOF <new-primary-host> 6380
redis-cli -p 6382 REPLICAOF <new-primary-host> 6380
```

Because of PSYNC2 dual-ID tracking, replicas that were following the old primary can often partial-resync with the new primary without a full RDB transfer.

**Step 5: Update application configuration**

Update your connection strings, load balancer, or service discovery to point writes at the new primary.

**Step 6: (Optional) Rejoin the old primary as a replica**

```bash
# On the old primary, if it comes back online
redis-cli -p 6379 REPLICAOF <new-primary-host> 6380
```

### Promoting a Replica — Quick Reference

```bash
# 1. Promote
redis-cli -h <replica-host> -p <replica-port> REPLICAOF NO ONE

# 2. Verify
redis-cli -h <replica-host> -p <replica-port> INFO replication
# Should show role:master

# 3. Repoint other replicas
for port in 6381 6382; do
  redis-cli -p $port REPLICAOF <new-primary-host> <new-primary-port>
done

# 4. Test writes
redis-cli -h <new-primary-host> -p <new-primary-port> SET failover-test ok
```

### Estimating Data Loss

Because replication is asynchronous by default, data written to the primary but not yet acknowledged by replicas may be lost during failover. The maximum data loss is bounded by:

```
max_data_loss ≈ write_throughput × replica_lag_seconds
```

To minimize data loss:
- Use `WAIT` for critical writes
- Configure `min_replicas_to_write` ≥ 1
- Monitor and alert on replication lag

## CRDT Replication

:::info Experimental
CRDT-based multi-primary replication is **experimental**. The geo-replication module supports active-active topologies with conflict-free replicated data types.
:::

```toml
[replication]
crdt_enabled = true
```

```bash
# CRDT types resolve conflicts automatically
127.0.0.1:6379> CRDT.GCOUNTER counter INCR 5
127.0.0.1:6379> CRDT.LWWREGISTER key SET value
127.0.0.1:6379> CRDT.ORSET set ADD item
```

The geo-replication engine supports multiple conflict resolution strategies: last-write-wins, vector clocks, and custom resolution handlers. See the `replication::geo` module for details.

## Best Practices

1. **Use at least 1 replica** for high availability
2. **Set `min_replicas_to_write` ≥ 1** in production to prevent isolated primary writes
3. **Monitor replication lag** — alert on `ferrite_replica_lag_bytes > 1MB` sustained for 5+ minutes
4. **Size backlog appropriately** — `write_rate × max_disconnect_time`
5. **Use WAIT for critical writes** — e.g., financial transactions, order confirmations
6. **Test failover regularly** — practice the manual failover procedure in staging
7. **Spread replicas across failure domains** — different racks, zones, or regions

## Next Steps

- [High Availability](/docs/deployment/high-availability) — HA patterns, Kubernetes deployment, failover testing
- [Clustering](/docs/advanced/clustering) — Horizontal scaling with hash slots
- [Security](/docs/advanced/security) — TLS and authentication for replication
