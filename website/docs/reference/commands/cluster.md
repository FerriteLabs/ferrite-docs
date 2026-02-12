---
sidebar_position: 14
maturity: experimental
---

# Cluster Commands

Commands for managing Ferrite cluster deployments.

## Overview

Cluster commands enable horizontal scaling by distributing data across multiple nodes using hash slots (16384 slots total).

## Commands

### CLUSTER INFO

Get cluster state information.

```bash
CLUSTER INFO
```

**Examples:**
```bash
CLUSTER INFO
# cluster_state:ok
# cluster_slots_assigned:16384
# cluster_slots_ok:16384
# cluster_slots_pfail:0
# cluster_slots_fail:0
# cluster_known_nodes:6
# cluster_size:3
# cluster_current_epoch:6
# cluster_my_epoch:2
```

---

### CLUSTER NODES

Get cluster node information.

```bash
CLUSTER NODES
```

**Examples:**
```bash
CLUSTER NODES
# 07c37dfeb235213a872192d90877d0cd55635b91 127.0.0.1:30001@40001 master - 0 0 1 connected 0-5460
# 67ed2db8d677e59ec4a4ccc0e89e3e0a4f9c4e2e 127.0.0.1:30002@40002 master - 0 0 2 connected 5461-10922
# 292f8b365bb7edb5e285caf0b7e6ddc7a4b8eb95 127.0.0.1:30003@40003 master - 0 0 3 connected 10923-16383
```

---

### CLUSTER SLOTS

Get slot to node mapping.

```bash
CLUSTER SLOTS
```

**Examples:**
```bash
CLUSTER SLOTS
# 1) 1) (integer) 0
#    2) (integer) 5460
#    3) 1) "127.0.0.1"
#       2) (integer) 30001
#       3) "07c37dfeb235213a872192d90877d0cd55635b91"
```

---

### CLUSTER SHARDS

Get shard information.

```bash
CLUSTER SHARDS
```

**Examples:**
```bash
CLUSTER SHARDS
# 1) 1) "slots"
#    2) 1) (integer) 0
#       2) (integer) 5460
#    3) "nodes"
#    4) 1) 1) "id"
#          2) "07c37dfeb..."
```

---

### CLUSTER KEYSLOT

Get slot for a key.

```bash
CLUSTER KEYSLOT key
```

**Time Complexity:** O(N) where N is key length

**Examples:**
```bash
CLUSTER KEYSLOT mykey
# (integer) 14687

CLUSTER KEYSLOT user:1000
# (integer) 5474

# Hash tags for co-location
CLUSTER KEYSLOT {user}:1000:profile
# (integer) 5474

CLUSTER KEYSLOT {user}:1000:settings
# (integer) 5474
```

---

### CLUSTER MEET

Connect to another node.

```bash
CLUSTER MEET ip port
```

**Time Complexity:** O(1)

**Examples:**
```bash
CLUSTER MEET 192.168.1.2 6379
# OK
```

---

### CLUSTER FORGET

Remove node from cluster.

```bash
CLUSTER FORGET node-id
```

**Time Complexity:** O(1)

---

### CLUSTER REPLICATE

Make node a replica of another.

```bash
CLUSTER REPLICATE node-id
```

**Time Complexity:** O(1)

**Examples:**
```bash
CLUSTER REPLICATE 07c37dfeb235213a872192d90877d0cd55635b91
# OK
```

---

### CLUSTER FAILOVER

Trigger manual failover.

```bash
CLUSTER FAILOVER [FORCE | TAKEOVER]
```

**Options:**
- No option: Coordinated failover
- `FORCE`: Force failover even if master unreachable
- `TAKEOVER`: Take over without master agreement

**Examples:**
```bash
# On a replica
CLUSTER FAILOVER
# OK
```

---

### CLUSTER RESET

Reset cluster configuration.

```bash
CLUSTER RESET [HARD | SOFT]
```

**Time Complexity:** O(N)

---

### CLUSTER ADDSLOTS

Assign slots to node.

```bash
CLUSTER ADDSLOTS slot [slot ...]
```

**Time Complexity:** O(N)

**Examples:**
```bash
CLUSTER ADDSLOTS 0 1 2 3 4 5
# OK
```

---

### CLUSTER DELSLOTS

Remove slots from node.

```bash
CLUSTER DELSLOTS slot [slot ...]
```

**Time Complexity:** O(N)

---

### CLUSTER SETSLOT

Configure slot state.

```bash
CLUSTER SETSLOT slot IMPORTING node-id
CLUSTER SETSLOT slot MIGRATING node-id
CLUSTER SETSLOT slot NODE node-id
CLUSTER SETSLOT slot STABLE
```

**Examples:**
```bash
# Start migration
CLUSTER SETSLOT 8000 MIGRATING target-node-id

# Complete migration
CLUSTER SETSLOT 8000 NODE target-node-id
```

---

### CLUSTER GETKEYSINSLOT

Get keys in a slot.

```bash
CLUSTER GETKEYSINSLOT slot count
```

**Time Complexity:** O(N)

**Examples:**
```bash
CLUSTER GETKEYSINSLOT 8000 10
# 1) "key1"
# 2) "key2"
```

---

### CLUSTER COUNTKEYSINSLOT

Count keys in a slot.

```bash
CLUSTER COUNTKEYSINSLOT slot
```

**Time Complexity:** O(1)

---

### CLUSTER SAVECONFIG

Save cluster configuration.

```bash
CLUSTER SAVECONFIG
```

**Time Complexity:** O(1)

---

### CLUSTER BUMPEPOCH

Increment cluster epoch.

```bash
CLUSTER BUMPEPOCH
```

**Time Complexity:** O(1)

## Hash Tags

Use hash tags `{}` to ensure related keys are on the same node:

```bash
# These keys will be on the same node
SET {user:1000}:profile "..."
SET {user:1000}:settings "..."
SET {user:1000}:session "..."

# Verify same slot
CLUSTER KEYSLOT {user:1000}:profile
# (integer) 5474

CLUSTER KEYSLOT {user:1000}:settings
# (integer) 5474
```

## Cluster Setup

### Create Cluster

```bash
# Start 6 nodes (3 masters, 3 replicas)
ferrite --config ferrite-7000.toml &
ferrite --config ferrite-7001.toml &
ferrite --config ferrite-7002.toml &
ferrite --config ferrite-7003.toml &
ferrite --config ferrite-7004.toml &
ferrite --config ferrite-7005.toml &

# Create cluster
redis-cli --cluster create 127.0.0.1:7000 127.0.0.1:7001 127.0.0.1:7002 \
  127.0.0.1:7003 127.0.0.1:7004 127.0.0.1:7005 \
  --cluster-replicas 1
```

### Add Node

```bash
# Add new node to cluster
CLUSTER MEET 192.168.1.4 7000

# Make it a replica
CLUSTER REPLICATE master-node-id

# Or assign slots for new master
CLUSTER ADDSLOTS 0 1 2 3 4 5 ...
```

### Remove Node

```bash
# Migrate slots first if master
# Then remove
CLUSTER FORGET node-id
```

### Resharding

```bash
# Using ferrite-cli
redis-cli --cluster reshard 127.0.0.1:7000

# Manual slot migration
# On source node:
CLUSTER SETSLOT 8000 MIGRATING target-node-id

# On target node:
CLUSTER SETSLOT 8000 IMPORTING source-node-id

# Migrate keys
MIGRATE target-host target-port "" 0 5000 KEYS key1 key2 key3

# Complete migration on all nodes:
CLUSTER SETSLOT 8000 NODE target-node-id
```

## Rust API

```rust
use ferrite::Client;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let client = Client::connect_cluster(&[
        "127.0.0.1:7000",
        "127.0.0.1:7001",
        "127.0.0.1:7002",
    ]).await?;

    // Operations are automatically routed
    client.set("key1", "value1").await?;
    let value: String = client.get("key1").await?;

    // Use hash tags for related keys
    client.set("{user:1}:profile", "...").await?;
    client.set("{user:1}:settings", "...").await?;

    // Multi-key operations work with hash tags
    let values = client.mget(&[
        "{user:1}:profile",
        "{user:1}:settings",
    ]).await?;

    // Get cluster info
    let info = client.cluster_info().await?;
    let nodes = client.cluster_nodes().await?;
    let slots = client.cluster_slots().await?;

    // Key slot calculation
    let slot = client.cluster_keyslot("mykey").await?;

    Ok(())
}
```

## Best Practices

1. **Use hash tags** - For multi-key operations
2. **Monitor slot distribution** - Keep slots balanced
3. **Plan resharding** - During low-traffic periods
4. **Use replicas** - At least 1 replica per master
5. **Geographic distribution** - For disaster recovery
6. **Regular backups** - Despite replication

## Troubleshooting

### Cluster State Issues

```bash
# Check cluster health
CLUSTER INFO

# Fix stuck slots
CLUSTER SETSLOT <slot> STABLE

# Check for failures
CLUSTER NODES | grep fail
```

### Slot Migration Issues

```bash
# Check migrating slots
CLUSTER NODES | grep -E "migrating|importing"

# Cancel migration
CLUSTER SETSLOT <slot> STABLE
```

## Related Commands

- [Server Commands](/docs/reference/commands/server) - Server management
- [Replication Commands](/docs/advanced/replication) - Master-replica setup
- [High Availability](/docs/deployment/high-availability) - HA patterns
