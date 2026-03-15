---
sidebar_position: 6
title: "Redis to Ferrite Migration Playbook"
description: "Step-by-step operational playbook for migrating from Redis to Ferrite with zero-downtime and offline options."
---

# Redis to Ferrite Migration Playbook

A practical, copy-paste-ready playbook for migrating your data and workloads from Redis to Ferrite. Covers both **offline** (maintenance window) and **zero-downtime** (live) migration strategies.

---

## Phase 1: Pre-Migration Analysis

### 1.1 Install the Migration CLI

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

<Tabs>
<TabItem value="cargo" label="Cargo" default>

```bash
cargo install ferrite --features cli
```

</TabItem>
<TabItem value="docker" label="Docker">

```bash
docker pull ghcr.io/ferritelabs/ferrite:latest
# All ferrite-migrate commands work via Docker:
docker run --rm --network host ghcr.io/ferritelabs/ferrite:latest \
  ferrite-migrate <command> [options]
```

</TabItem>
<TabItem value="homebrew" label="Homebrew">

```bash
brew tap ferritelabs/tap
brew install ferrite
```

</TabItem>
</Tabs>

### 1.2 Run Compatibility Analysis

```bash
ferrite-migrate analyze --source redis://source-host:6379
```

This scans your Redis instance and produces a compatibility report covering:

| Check | Description |
|-------|-------------|
| **Data types** | Keys using types not yet supported (e.g., Redis Streams with XAUTOCLAIM) |
| **Commands** | Commands your application uses that differ in behavior |
| **Modules** | RedisJSON, RediSearch, RedisGraph — and Ferrite equivalents |
| **Memory** | Current memory footprint and estimated Ferrite disk/memory requirements |
| **Lua scripts** | Script compatibility analysis |

### 1.3 Review the Report

```bash
# Save the report for team review
ferrite-migrate analyze --source redis://source-host:6379 --output report.json

# Pretty-print summary
ferrite-migrate analyze --source redis://source-host:6379 --format table
```

:::warning Unsupported Commands
If the report flags unsupported commands, check whether they are critical to your application. Some Redis module commands have native Ferrite equivalents (e.g., RedisJSON → Ferrite's built-in JSON support). Update your application code before proceeding.
:::

### 1.4 Choose Your Migration Strategy

| Strategy | Downtime | Complexity | Best For |
|----------|----------|------------|----------|
| **Offline** | Minutes to hours | Low | Small datasets, scheduled maintenance windows |
| **Live (dual-write)** | Zero | Medium | Production workloads that cannot tolerate downtime |

---

## Phase 2: Environment Setup

### 2.1 Start Ferrite

```bash
# Minimal configuration for migration
ferrite-server \
  --port 6380 \
  --data-dir /var/lib/ferrite \
  --persistence aof \
  --aof-fsync everysec
```

:::tip Persistence During Migration
Use **AOF persistence** during migration for durability. You can switch to tiered storage or adjust persistence settings after migration is validated.
:::

### 2.2 Match Your Redis Configuration

If your Redis instance uses specific settings, mirror them in Ferrite:

```bash
# Check your current Redis configuration
redis-cli -h source-host -p 6379 CONFIG GET maxmemory
redis-cli -h source-host -p 6379 CONFIG GET maxmemory-policy

# Apply matching settings to Ferrite
redis-cli -h localhost -p 6380 CONFIG SET maxmemory 4gb
redis-cli -h localhost -p 6380 CONFIG SET maxmemory-policy allkeys-lru
```

### 2.3 Verify Connectivity

```bash
# Verify Ferrite is running
redis-cli -h localhost -p 6380 PING
# → PONG

# Verify source Redis is reachable from the Ferrite host
redis-cli -h source-host -p 6379 PING
# → PONG

# If Redis requires authentication
ferrite-migrate analyze --source redis://:password@source-host:6379
```

---

## Phase 3: Dry Run

Always perform a dry run before the actual migration.

```bash
ferrite-migrate execute \
  --source redis://source-host:6379 \
  --target ferrite://localhost:6380 \
  --dry-run
```

Expected output:

```text
Dry Run Summary
===============
Keys to migrate:    1,234,567
Estimated size:     2.3 GB
Estimated duration: ~4 min (based on network throughput)
Data types:         string (68%), hash (20%), list (7%), set (3%), zset (2%)
Unsupported keys:   0

No data was written to the target.
```

### 3.1 Verify Sample Keys

```bash
# Migrate a small subset to verify correctness
ferrite-migrate execute \
  --source redis://source-host:6379 \
  --target ferrite://localhost:6380 \
  --sample 1000 \
  --dry-run=false

# Spot-check a few keys
redis-cli -p 6379 GET myapp:config:version
redis-cli -p 6380 GET myapp:config:version

redis-cli -p 6379 HGETALL myapp:user:42
redis-cli -p 6380 HGETALL myapp:user:42
```

:::caution
The `--sample` flag migrates a random subset. Use this only for verification — do **not** rely on it for the actual migration.
:::

---

## Phase 4: Execute Migration

### Option A: Offline Migration

Best for: scheduled maintenance windows, smaller datasets, or when brief downtime is acceptable.

**Step 1 — Stop writes to Redis:**

```bash
# Option: Set Redis to read-only
redis-cli -h source-host -p 6379 CONFIG SET min-replicas-to-write 999

# Or: Stop your application's write path
# (application-specific)
```

**Step 2 — Run the migration:**

```bash
ferrite-migrate execute \
  --source redis://source-host:6379 \
  --target ferrite://localhost:6380 \
  --workers 4 \
  --batch-size 1000
```

```text
Migration Progress
==================
[████████████████████████████████] 100%  1,234,567 / 1,234,567 keys
Duration: 3m 42s
Throughput: 5,562 keys/sec
Errors: 0
```

**Step 3 — Validate:**

```bash
ferrite-migrate validate \
  --source redis://source-host:6379 \
  --target ferrite://localhost:6380
```

```text
Validation Report
=================
Keys compared:  1,234,567
Matching:       1,234,567 (100.0%)
Mismatched:     0
Missing:        0
Result:         ✅ PASS
```

**Step 4 — Re-enable writes on Ferrite and update your application (see [Phase 6](#phase-6-cutover)).**

---

### Option B: Live Migration (Zero-Downtime)

Best for: production systems where downtime is unacceptable.

**Step 1 — Start the dual-write proxy:**

```bash
ferrite-migrate live \
  --source redis://source-host:6379 \
  --target ferrite://localhost:6380 \
  --listen 0.0.0.0:6400
```

This starts a proxy on port `6400` that:
1. Forwards all commands to **both** Redis and Ferrite
2. Returns responses from Redis (source of truth during migration)
3. Performs background key synchronization

**Step 2 — Point your application at the proxy:**

```bash
# Update connection string to the proxy
REDIS_URL=redis://proxy-host:6400
```

**Step 3 — Monitor replication progress:**

```bash
# Watch replication lag approach zero
ferrite-migrate status --live

# Example output:
# Session:        a1b2c3d4
# Phase:          catching-up
# Keys synced:    1,100,000 / 1,234,567 (89.1%)
# Replication lag: 1,204 keys
# Lag trend:       ↓ decreasing
```

**Step 4 — Cutover when lag reaches zero:**

```bash
# Finalize: switch proxy to return Ferrite responses
ferrite-migrate cutover --session a1b2c3d4
```

```text
Cutover Complete
================
Session:     a1b2c3d4
New primary:  ferrite://localhost:6380
All traffic now served by Ferrite.
Proxy remains active for monitoring (stop with Ctrl+C).
```

:::danger Point of No Return
After cutover, new writes go to Ferrite only. Ensure your validation is complete before executing this step. You can still roll back (see [Phase 7](#phase-7-rollback)), but any writes after cutover will need to be replayed to Redis.
:::

---

## Phase 5: Validation

Run thorough validation regardless of which migration option you chose.

### 5.1 Consistency Check

```bash
# Full validation (compares every key)
ferrite-migrate validate \
  --source redis://source-host:6379 \
  --target ferrite://localhost:6380

# Sampled validation (faster, for very large datasets)
ferrite-migrate validate \
  --source redis://source-host:6379 \
  --target ferrite://localhost:6380 \
  --sample-rate 5
```

### 5.2 Key Count Comparison

```bash
# Quick sanity check
echo "Redis:   $(redis-cli -h source-host -p 6379 DBSIZE)"
echo "Ferrite: $(redis-cli -h localhost -p 6380 DBSIZE)"
```

### 5.3 Application-Level Testing

```bash
# Run your application's test suite against Ferrite
REDIS_URL=redis://localhost:6380 npm test        # Node.js
REDIS_URL=redis://localhost:6380 pytest           # Python
REDIS_URL=redis://localhost:6380 cargo test       # Rust
```

:::tip
If your application has integration tests or smoke tests, run them against the Ferrite endpoint before updating production connection strings.
:::

---

## Phase 6: Cutover

### 6.1 Update Application Connection Strings

```bash
# Example: update environment variable
export REDIS_URL=redis://ferrite-host:6380

# Example: Kubernetes ConfigMap
kubectl patch configmap app-config \
  -p '{"data":{"REDIS_URL":"redis://ferrite-host:6380"}}'

# Example: rolling restart to pick up new config
kubectl rollout restart deployment/my-app
```

### 6.2 Monitor the First Hour

Watch these metrics closely after cutover:

| Metric | Where to Check | Alert Threshold |
|--------|---------------|-----------------|
| Error rate | Application logs, APM | Any increase over baseline |
| P99 latency | Ferrite metrics / Grafana | >2× baseline |
| Command failures | `redis-cli -p 6380 INFO commandstats` | Any unexpected errors |
| Memory usage | `redis-cli -p 6380 INFO memory` | >80% of maxmemory |
| Connected clients | `redis-cli -p 6380 INFO clients` | Matches expected count |

```bash
# Quick health check
redis-cli -h ferrite-host -p 6380 INFO server | grep -E "uptime|connected_clients"
redis-cli -h ferrite-host -p 6380 INFO memory | grep used_memory_human
redis-cli -h ferrite-host -p 6380 INFO stats  | grep total_commands_processed
```

### 6.3 Keep Redis as Fallback

:::warning Do Not Decommission Redis Yet
Keep your Redis instance running and accessible for at least 7 days after cutover. This is your safety net.
:::

---

## Phase 7: Rollback

If issues are detected after cutover, roll back immediately.

### 7.1 Quick Rollback (Connection String Revert)

```bash
# Revert to Redis
export REDIS_URL=redis://source-host:6379

# Kubernetes
kubectl patch configmap app-config \
  -p '{"data":{"REDIS_URL":"redis://source-host:6379"}}'
kubectl rollout restart deployment/my-app
```

### 7.2 Rollback from Live Migration

```bash
# If using the dual-write proxy and cutover was executed
ferrite-migrate rollback --session a1b2c3d4
```

```text
Rollback Complete
=================
Session:     a1b2c3d4
Primary:     redis://source-host:6379
Ferrite writes since cutover: 4,231 (replayed to Redis)
```

### 7.3 Document and Investigate

After rolling back:

1. Capture Ferrite logs: `journalctl -u ferrite > ferrite-migration-debug.log`
2. Capture the validation report: `ferrite-migrate validate ... --output validation-failure.json`
3. File an issue with the diagnostics if the problem is Ferrite-related

---

## Phase 8: Post-Migration

Once you're confident the migration is stable (typically 7–30 days):

### 8.1 Enable Tiered Storage

Take advantage of Ferrite's HybridLog tiered storage to reduce memory costs:

```bash
redis-cli -p 6380 CONFIG SET tiered-storage.enabled true
redis-cli -p 6380 CONFIG SET tiered-storage.mutable-fraction 0.3
redis-cli -p 6380 CONFIG SET tiered-storage.disk-path /var/lib/ferrite/tier2
```

See the [Tiered Storage guide](/docs/advanced/tiered-storage) for detailed configuration.

### 8.2 Set Up Monitoring

Deploy the Grafana dashboards from `ferrite-ops`:

```bash
cd ferrite-ops/monitoring
docker compose up -d    # Starts Prometheus + Grafana

# Dashboards available at http://localhost:3000
# Default credentials: admin / admin
```

See the [Monitoring guide](/docs/guides/monitoring) for alerting rules and dashboard details.

### 8.3 Optimize Configuration

Now that migration is complete, tune Ferrite for your workload:

```bash
# Switch from AOF to hybrid persistence for better performance
redis-cli -p 6380 CONFIG SET persistence hybrid

# Enable io_uring for Linux (significant I/O performance boost)
# Set in ferrite.toml:
# [storage]
# io-engine = "io-uring"

# Adjust worker threads to match your CPU cores
redis-cli -p 6380 CONFIG SET server.workers auto
```

### 8.4 Decommission Redis

After your confidence period:

```bash
# Final validation before decommission
ferrite-migrate validate \
  --source redis://source-host:6379 \
  --target ferrite://localhost:6380

# Stop Redis
redis-cli -h source-host -p 6379 SHUTDOWN NOSAVE

# Or if managed (e.g., AWS ElastiCache): delete via console/CLI
```

:::danger
Only decommission Redis after:
- ✅ All application tests pass against Ferrite
- ✅ No rollbacks needed for at least 7 days
- ✅ Team consensus that migration is complete
- ✅ Final backup of Redis data taken (just in case)
:::

---

## Quick Reference

### All Migration Commands

```bash
# Analyze source Redis for compatibility
ferrite-migrate analyze --source redis://host:6379

# Offline migration
ferrite-migrate execute --source redis://host:6379 --target ferrite://host:6380

# Live migration (zero-downtime)
ferrite-migrate live --source redis://host:6379 --target ferrite://host:6380

# Validate data consistency
ferrite-migrate validate --source redis://host:6379 --target ferrite://host:6380

# Cutover (live migration only)
ferrite-migrate cutover --session <session-id>

# Rollback (live migration only)
ferrite-migrate rollback --session <session-id>
```

### Common Flags

| Flag | Description | Default |
|------|-------------|---------|
| `--workers` | Parallel migration workers | `4` |
| `--batch-size` | Keys per batch | `1000` |
| `--dry-run` | Simulate without writing | `false` |
| `--sample-rate` | Percentage of keys to validate | `100` |
| `--sample` | Number of keys for sample migration | — |
| `--output` | Save report to file (JSON) | stdout |
| `--format` | Output format: `table`, `json`, `yaml` | `table` |
| `--timeout` | Connection timeout in seconds | `30` |
| `--tls` | Enable TLS for connections | `false` |
| `--auth` | Authentication password | — |

### Estimated Migration Times

| Dataset Size | Offline (LAN) | Live (Sync Phase) |
|-------------|---------------|-------------------|
| < 1 GB | < 1 min | < 2 min |
| 1–10 GB | 1–10 min | 5–15 min |
| 10–100 GB | 10–60 min | 30–90 min |
| 100 GB+ | 1–6 hours | 2–8 hours |

*Times vary based on network bandwidth, key complexity, and hardware.*
