---
sidebar_position: 41
maturity: experimental
---

:::caution Experimental Feature
This feature is **experimental** and subject to change. APIs, behavior, and performance characteristics may evolve significantly between releases. Use with caution in production environments.
:::

# Slot Commands

Commands for slot management.

## Overview

Slot commands provide control over hash slot allocation and lifecycle in a Ferrite cluster. Create, drop, start, stop, and monitor individual slots for fine-grained cluster management and rebalancing operations.

## Commands

### SLOT.CREATE

Create a new slot or slot range.

```bash
SLOT.CREATE slot_id [TO end_slot_id] [NODE node_addr]
```

**Parameters:**
- `slot_id` - Starting slot number (0–16383)
- `TO` - End of slot range (optional)
- `NODE` - Assign to specific node (optional)

**Examples:**
```bash
SLOT.CREATE 0 TO 5460 NODE 10.0.0.1:6379
# OK

SLOT.CREATE 5461
# OK
```

**Returns:** OK

---

### SLOT.DROP

Drop a slot or slot range.

```bash
SLOT.DROP slot_id [TO end_slot_id] [MIGRATE node_addr]
```

**Parameters:**
- `slot_id` - Starting slot number
- `TO` - End of slot range (optional)
- `MIGRATE` - Migrate keys before dropping (optional)

**Examples:**
```bash
SLOT.DROP 5461 TO 10922 MIGRATE 10.0.0.2:6379
# OK

SLOT.DROP 100
# OK
```

**Returns:** OK

---

### SLOT.LIST

List all slots and their assignments.

```bash
SLOT.LIST [NODE node_addr]
```

**Examples:**
```bash
SLOT.LIST
# 1) 1) "range"
#    2) "0-5460"
#    3) "node"
#    4) "10.0.0.1:6379"
#    5) "status"
#    6) "active"
#    7) "keys"
#    8) (integer) 15000
# 2) 1) "range"
#    2) "5461-10922"
#    3) "node"
#    4) "10.0.0.2:6379"
#    5) "status"
#    6) "active"
#    7) "keys"
#    8) (integer) 14500

SLOT.LIST NODE 10.0.0.1:6379
# 1) 1) "range"
#    2) "0-5460"
#    3) "status"
#    4) "active"
#    5) "keys"
#    6) (integer) 15000
```

**Returns:** Array of slot details

---

### SLOT.START

Start serving a slot (resume after stop).

```bash
SLOT.START slot_id [TO end_slot_id]
```

**Examples:**
```bash
SLOT.START 5461 TO 10922
# OK
```

**Returns:** OK

---

### SLOT.STOP

Stop serving a slot (maintenance or migration).

```bash
SLOT.STOP slot_id [TO end_slot_id] [TIMEOUT seconds]
```

**Parameters:**
- `TIMEOUT` - Grace period for in-flight requests (default: 5)

**Examples:**
```bash
SLOT.STOP 5461 TO 10922 TIMEOUT 10
# OK
```

**Returns:** OK

---

### SLOT.STATS

Get slot statistics.

```bash
SLOT.STATS [slot_id]
```

**Examples:**
```bash
SLOT.STATS
# {
#   "total_slots": 16384,
#   "assigned_slots": 16384,
#   "active_slots": 16384,
#   "stopped_slots": 0,
#   "migrating_slots": 0,
#   "nodes": 3
# }

SLOT.STATS 100
# {
#   "slot": 100,
#   "node": "10.0.0.1:6379",
#   "status": "active",
#   "keys": 45,
#   "ops_per_sec": 120,
#   "memory_bytes": 65536
# }
```

**Returns:** Map of slot statistics

---

### SLOT.SAVE

Persist slot configuration to store (survives restart).

```bash
SLOT.SAVE
```

**Examples:**
```bash
SLOT.SAVE
# OK
```

**Returns:** OK

## Use Cases

### Cluster Rebalancing

```bash
# Check current distribution
SLOT.LIST

# Stop slots on overloaded node
SLOT.STOP 10923 TO 16383 TIMEOUT 10

# Migrate to new node
SLOT.DROP 10923 TO 16383 MIGRATE 10.0.0.4:6379
SLOT.CREATE 10923 TO 16383 NODE 10.0.0.4:6379

# Start slots on new node
SLOT.START 10923 TO 16383

# Persist
SLOT.SAVE
```

### Maintenance Window

```bash
# Gracefully stop slots
SLOT.STOP 0 TO 5460 TIMEOUT 30

# Perform maintenance...

# Resume
SLOT.START 0 TO 5460
```

## Related Commands

- [Cluster Commands](/docs/reference/commands/cluster) - Cluster management
- [Server Commands](/docs/reference/commands/server) - Server management
- [Keys Commands](/docs/reference/commands/keys) - Key management
