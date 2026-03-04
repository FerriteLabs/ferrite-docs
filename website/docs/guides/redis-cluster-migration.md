---
sidebar_position: 7
title: "Redis Cluster Migration Guide"
description: "Migrate from a Redis Cluster deployment to Ferrite with cluster-mode support, covering client compatibility, slot distribution, and data transfer."
---

# Redis Cluster Migration Guide

:::warning[Experimental]
Ferrite's Redis Cluster wire compatibility is **in active development**. The cluster protocol surface (slot routing, `CLUSTER` subcommands, and gossip-layer emulation) is not yet fully complete. Test thoroughly in a staging environment before migrating production traffic.
:::

## Overview

Ferrite supports the Redis Cluster protocol, allowing you to migrate existing Redis Cluster deployments with minimal client-side changes. Clients that speak the Redis Cluster discovery and redirection protocol (`MOVED` / `ASK`) can connect to a Ferrite cluster and route keys to the correct shard automatically.

This guide walks through the end-to-end process of replacing a Redis Cluster with Ferrite while preserving your slot layout and client compatibility.

---

## Prerequisites

| Requirement | Details |
|---|---|
| **Ferrite build** | v0.1+ compiled with `--features cluster` (included in the `default` feature set) |
| **Cluster mode enabled** | `cluster.enabled = true` in `ferrite.toml` or `--cluster-enabled` CLI flag |
| **Matching shard count** | The Ferrite cluster should have the **same number of primary shards** as the source Redis Cluster |
| **Network access** | The migration host needs connectivity to both the source Redis Cluster and the target Ferrite cluster |
| **ferrite-migrate CLI** | `cargo install ferrite --features cli` or use the Docker image |

---

## Client Compatibility

Ferrite's cluster mode is tested against the most popular Redis Cluster client libraries:

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

<Tabs>
<TabItem value="python" label="Python" default>

```python
from redis.cluster import RedisCluster

rc = RedisCluster(
    host="ferrite-node-1",
    port=6379,
    decode_responses=True,
)
rc.set("key", "value")
```

</TabItem>
<TabItem value="node" label="Node.js (ioredis)">

```javascript
const Redis = require("ioredis");

const cluster = new Redis.Cluster([
  { host: "ferrite-node-1", port: 6379 },
  { host: "ferrite-node-2", port: 6379 },
  { host: "ferrite-node-3", port: 6379 },
]);

await cluster.set("key", "value");
```

</TabItem>
<TabItem value="java-lettuce" label="Java (Lettuce)">

```java
RedisClusterClient client = RedisClusterClient.create(
    "redis://ferrite-node-1:6379"
);
StatefulRedisClusterConnection<String, String> conn = client.connect();
conn.sync().set("key", "value");
```

</TabItem>
<TabItem value="java-jedis" label="Java (Jedis)">

```java
Set<HostAndPort> nodes = Set.of(
    new HostAndPort("ferrite-node-1", 6379),
    new HostAndPort("ferrite-node-2", 6379),
    new HostAndPort("ferrite-node-3", 6379)
);
JedisCluster jc = new JedisCluster(nodes);
jc.set("key", "value");
```

</TabItem>
<TabItem value="go" label="Go (go-redis)">

```go
rdb := redis.NewClusterClient(&redis.ClusterOptions{
    Addrs: []string{
        "ferrite-node-1:6379",
        "ferrite-node-2:6379",
        "ferrite-node-3:6379",
    },
})
err := rdb.Set(ctx, "key", "value", 0).Err()
```

</TabItem>
</Tabs>

All clients that implement the standard Redis Cluster discovery flow (`CLUSTER SLOTS` / `CLUSTER SHARDS`) and handle `MOVED`/`ASK` redirections should work without modification.

---

## Migration Steps

### Step 1 — Provision the Ferrite Cluster

Start a Ferrite cluster with the **same number of primary shards** as your source Redis Cluster. For example, for a 3-primary setup:

```bash
# Node 1
ferrite-server --cluster-enabled --cluster-node-id node-1 \
  --cluster-announce-ip 10.0.0.1 --port 6379

# Node 2
ferrite-server --cluster-enabled --cluster-node-id node-2 \
  --cluster-announce-ip 10.0.0.2 --port 6379

# Node 3
ferrite-server --cluster-enabled --cluster-node-id node-3 \
  --cluster-announce-ip 10.0.0.3 --port 6379
```

### Step 2 — Configure Slot Distribution

Match the slot distribution of your source Redis Cluster so clients experience identical hash-slot routing:

```bash
# Export the slot map from the source Redis Cluster
redis-cli -h redis-node-1 -p 6379 CLUSTER SLOTS > source-slots.txt

# Apply the same mapping to Ferrite
ferrite-cli cluster assign-slots \
  --node node-1 --slots 0-5460 \
  --node node-2 --slots 5461-10922 \
  --node node-3 --slots 10923-16383
```

:::tip
If you're using the default even distribution (three primaries each owning a contiguous third of the 16 384 slots), Ferrite assigns this layout automatically when you join the nodes.
:::

### Step 3 — Migrate Data with `ferrite-migrate`

Use the built-in migration tool to transfer data from the Redis Cluster:

```bash
ferrite-migrate cluster-to-cluster \
  --source redis-node-1:6379 \
  --target ferrite-node-1:6379 \
  --parallel 4 \
  --batch-size 1000 \
  --progress
```

`ferrite-migrate` iterates every slot range, performs `SCAN`-based reads from the source, and writes to the matching Ferrite shard. It preserves TTLs and data types.

### Step 4 — Validate

Run a consistency check before cutting over:

```bash
ferrite-migrate verify \
  --source redis-node-1:6379 \
  --target ferrite-node-1:6379 \
  --sample-rate 0.1   # verify 10% of keys
```

### Step 5 — Update Client Connection Strings

Point your application clients to the Ferrite cluster discovery endpoint. Most clients only need one seed node — they discover the full topology via `CLUSTER SLOTS`:

```diff
- REDIS_CLUSTER_NODES=redis-node-1:6379,redis-node-2:6379,redis-node-3:6379
+ REDIS_CLUSTER_NODES=ferrite-node-1:6379,ferrite-node-2:6379,ferrite-node-3:6379
```

---

## Known Differences

While Ferrite aims for full Redis Cluster protocol compatibility, there are differences to be aware of:

| Area | Redis Cluster | Ferrite Cluster |
|---|---|---|
| **Internal protocol** | Gossip-based protocol on cluster bus port (port + 10000) | Raft-based consensus; no gossip bus |
| **`CLUSTER NODES` output** | Standard Redis format with gossip metadata | Compatible format, but some fields (e.g., `ping-sent`, `pong-recv`) are synthetic |
| **`CLUSTER INFO`** | Full gossip stats | Subset of fields; `cluster_stats_messages_*` counters are not populated |
| **Resharding** | `redis-cli --cluster reshard` | `ferrite-cli cluster reshard` (different workflow) |
| **Replica migration** | Automatic replica failover via gossip elections | Raft-based leader election; no `cluster-migration-barrier` equivalent |
| **Pub/Sub in cluster** | Broadcast to all nodes via gossip | Routed through Raft log; slight latency difference |

:::note
Commands like `CLUSTER MEET`, `CLUSTER SLOTS`, `CLUSTER SHARDS`, `CLUSTER KEYSLOT`, and `CLUSTER MYID` are fully supported. Gossip-specific commands (`CLUSTER SET-CONFIG-EPOCH`, `CLUSTER RESET`) may behave differently or return compatibility stubs.
:::

---

## Monitoring During Migration

Track these metrics during and after the migration to ensure a healthy cutover:

### Key Metrics

| Metric | Source | What to Watch |
|---|---|---|
| **`ferrite_cluster_slots_assigned`** | Prometheus | Should equal `16384` once all slots are assigned |
| **`ferrite_cluster_slots_ok`** | Prometheus | Must match `slots_assigned`; any gap means unreachable slots |
| **`ferrite_migrate_keys_transferred`** | `ferrite-migrate` output | Progress counter for data transfer |
| **`ferrite_migrate_errors_total`** | `ferrite-migrate` output | Should stay at `0` |
| **`ferrite_connected_clients`** | Prometheus | Watch for client reconnections after cutover |
| **`ferrite_cluster_redirections_total`** | Prometheus | Spike is normal during cutover; should stabilise quickly |

### Grafana Dashboard

If you're using the `ferrite-ops` monitoring stack, import the cluster migration dashboard:

```bash
cd ferrite-ops/grafana
cp dashboards/cluster-migration.json /var/lib/grafana/dashboards/
```

### Health Check

After cutover, verify cluster health:

```bash
ferrite-cli cluster info
# cluster_state:ok
# cluster_slots_assigned:16384
# cluster_slots_ok:16384
# cluster_known_nodes:3
```

---

## Rollback

If issues are found after cutover, rolling back is straightforward since the source Redis Cluster was not modified:

1. Re-point client connection strings back to the Redis Cluster nodes.
2. Investigate the issue with `ferrite-cli cluster info` and Ferrite logs.
3. File an issue at [github.com/FerriteLabs/ferrite](https://github.com/FerriteLabs/ferrite) with the cluster topology and error details.
