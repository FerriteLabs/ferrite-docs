---
sidebar_position: 39
maturity: experimental
---

:::caution Experimental Feature
This feature is **experimental** and subject to change. APIs, behavior, and performance characteristics may evolve significantly between releases. Use with caution in production environments.
:::

# Policy Commands

Commands for data access policy management.

## Overview

Policy commands enable creating and managing fine-grained access control policies for data. Define policies based on key patterns, user roles, time windows, and custom conditions. Policies are evaluated at command execution time and can enforce read/write restrictions, data masking, and audit requirements.

## Commands

### POLICY.CREATE

Create a new data access policy.

```bash
POLICY.CREATE policy_name
  ON pattern
  ACTION allow|deny|mask
  [ROLES role1 role2 ...]
  [COMMANDS cmd1 cmd2 ...]
  [CONDITION expression]
  [PRIORITY priority]
  [ENABLED true|false]
```

**Parameters:**
- `policy_name` - Unique policy identifier
- `ON` - Key pattern to match
- `ACTION` - Policy action: `allow`, `deny`, or `mask`
- `ROLES` - User roles this policy applies to (optional)
- `COMMANDS` - Commands this policy applies to (optional)
- `CONDITION` - Custom condition expression (optional)
- `PRIORITY` - Evaluation priority, higher = first (default: 0)
- `ENABLED` - Whether the policy is active (default: true)

**Examples:**
```bash
# Deny writes to production keys for dev role
POLICY.CREATE deny_dev_writes
  ON "prod:*"
  ACTION deny
  ROLES developer
  COMMANDS SET HSET DEL

# Mask PII data for support role
POLICY.CREATE mask_pii
  ON "user:*"
  ACTION mask
  ROLES support
  COMMANDS GET HGET HGETALL

# Allow read-only access during maintenance
POLICY.CREATE maintenance_readonly
  ON "*"
  ACTION deny
  COMMANDS SET DEL HSET LPUSH RPUSH SADD ZADD
  CONDITION "server.maintenance == true"
  PRIORITY 100
```

**Returns:** OK

---

### POLICY.DELETE

Delete a policy.

```bash
POLICY.DELETE policy_name
```

**Examples:**
```bash
POLICY.DELETE deny_dev_writes
# (integer) 1
```

**Returns:** Integer — 1 if deleted, 0 if not found

---

### POLICY.GET

Get policy details.

```bash
POLICY.GET policy_name
```

**Examples:**
```bash
POLICY.GET deny_dev_writes
# {
#   "name": "deny_dev_writes",
#   "pattern": "prod:*",
#   "action": "deny",
#   "roles": ["developer"],
#   "commands": ["SET", "HSET", "DEL"],
#   "priority": 0,
#   "enabled": true,
#   "evaluations": 1500,
#   "denials": 42
# }
```

**Returns:** Map of policy details

---

### POLICY.LIST

List all policies.

```bash
POLICY.LIST [PATTERN pattern] [ROLE role]
```

**Examples:**
```bash
POLICY.LIST
# 1) "deny_dev_writes"
# 2) "mask_pii"
# 3) "maintenance_readonly"

POLICY.LIST ROLE developer
# 1) "deny_dev_writes"
```

**Returns:** Array of policy names

---

### POLICY.EVALUATE

Test a policy against a simulated command without executing it.

```bash
POLICY.EVALUATE policy_name command key [args...]
```

**Examples:**
```bash
POLICY.EVALUATE deny_dev_writes SET prod:config "new_value"
# {
#   "result": "denied",
#   "policy": "deny_dev_writes",
#   "reason": "role 'developer' denied write to 'prod:*'"
# }

POLICY.EVALUATE mask_pii GET user:1001
# {
#   "result": "masked",
#   "policy": "mask_pii",
#   "masked_fields": ["email", "phone"]
# }
```

**Returns:** Map of evaluation result

---

### POLICY.STATS

Get policy evaluation statistics.

```bash
POLICY.STATS [policy_name]
```

**Examples:**
```bash
POLICY.STATS
# {
#   "total_evaluations": 50000,
#   "total_denials": 120,
#   "total_masks": 350,
#   "total_allows": 49530,
#   "policies_active": 3,
#   "policies_disabled": 1
# }

POLICY.STATS deny_dev_writes
# {
#   "evaluations": 1500,
#   "denials": 42,
#   "last_denial": "2026-01-20T10:30:00Z"
# }
```

**Returns:** Map of statistics

---

### POLICY.SAVE

Persist policy state to store (survives restart).

```bash
POLICY.SAVE
```

**Examples:**
```bash
POLICY.SAVE
# OK
```

**Returns:** OK

## Use Cases

### Role-Based Access Control

```bash
# Restrict production writes
POLICY.CREATE restrict_prod_writes
  ON "prod:*"
  ACTION deny
  ROLES developer intern
  COMMANDS SET DEL HSET

# Allow admin full access
POLICY.CREATE admin_full_access
  ON "*"
  ACTION allow
  ROLES admin
  PRIORITY 100

POLICY.SAVE
```

### PII Data Masking

```bash
# Mask PII for non-admin roles
POLICY.CREATE mask_user_pii
  ON "user:*"
  ACTION mask
  ROLES support analyst
  COMMANDS GET HGET HGETALL

# Test the policy
POLICY.EVALUATE mask_user_pii HGETALL user:1001
```

## Related Commands

- [Server Commands](/docs/reference/commands/server) - Server management
- [Tenant Commands](/docs/reference/commands/tenant) - Multi-tenancy
- [Security Guide](/docs/advanced/security) - Security configuration
