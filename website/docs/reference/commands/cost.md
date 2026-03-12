---
sidebar_position: 37
maturity: experimental
---

:::caution Experimental Feature
This feature is **experimental** and subject to change. APIs, behavior, and performance characteristics may evolve significantly between releases. Use with caution in production environments.
:::

# Cost Commands

Commands for infrastructure cost estimation and optimization.

## Overview

Cost commands provide visibility into storage, compute, and cloud infrastructure costs associated with your Ferrite deployment. Use them to estimate costs, receive optimization hints, set budgets, and track spend over time.

## Commands

### COST.ESTIMATE

Estimate infrastructure cost for a given configuration or workload.

```bash
COST.ESTIMATE [KEYS pattern] [PERIOD days]
```

**Parameters:**
- `KEYS` - Key pattern to scope the estimate (default: all keys)
- `PERIOD` - Estimation period in days (default: 30)

**Examples:**
```bash
COST.ESTIMATE
# {
#   "period_days": 30,
#   "storage_cost_usd": 12.50,
#   "compute_cost_usd": 45.00,
#   "cloud_tiering_cost_usd": 3.20,
#   "total_cost_usd": 60.70
# }

COST.ESTIMATE KEYS "user:*" PERIOD 7
# {
#   "period_days": 7,
#   "storage_cost_usd": 1.80,
#   "compute_cost_usd": 5.00,
#   "cloud_tiering_cost_usd": 0.00,
#   "total_cost_usd": 6.80
# }
```

**Returns:** Map of cost breakdown

---

### COST.OPTIMIZE

Get cost optimization recommendations.

```bash
COST.OPTIMIZE [TARGET_SAVINGS pct]
```

**Parameters:**
- `TARGET_SAVINGS` - Target savings percentage (optional)

**Examples:**
```bash
COST.OPTIMIZE
# 1) "Move 2.3 GB of cold data to S3 tier — estimated savings: $8.50/mo"
# 2) "Enable compression for keys matching 'logs:*' — estimated savings: $3.20/mo"
# 3) "Reduce replica count from 3 to 2 for non-critical data — estimated savings: $15.00/mo"

COST.OPTIMIZE TARGET_SAVINGS 20
# 1) "Reduce replica count from 3 to 2 — saves $15.00/mo (24.7%)"
```

**Returns:** Array of optimization recommendations

---

### COST.HINTS

Get actionable cost-saving hints for current workload.

```bash
COST.HINTS
```

**Examples:**
```bash
COST.HINTS
# 1) "45% of keys have not been accessed in 30 days — consider TTL or tiering"
# 2) "Vector index 'embeddings' uses 2.1 GB — consider IVF for lower memory"
# 3) "AOF sync set to 'always' — 'everysec' would reduce I/O cost by ~40%"
```

**Returns:** Array of cost hints

---

### COST.STATS

Get historical cost statistics.

```bash
COST.STATS [PERIOD days]
```

**Examples:**
```bash
COST.STATS
# {
#   "current_month_usd": 48.30,
#   "previous_month_usd": 52.10,
#   "trend": "decreasing",
#   "savings_applied_usd": 8.50,
#   "breakdown": {
#     "storage": 12.50,
#     "compute": 32.00,
#     "network": 3.80
#   }
# }
```

**Returns:** Map of cost statistics

---

### COST.BUDGET

Set or query a cost budget.

```bash
COST.BUDGET [SET amount_usd PERIOD monthly|daily]
COST.BUDGET [GET]
```

**Examples:**
```bash
COST.BUDGET SET 100.00 PERIOD monthly
# OK

COST.BUDGET GET
# {
#   "budget_usd": 100.00,
#   "period": "monthly",
#   "spent_usd": 48.30,
#   "remaining_usd": 51.70,
#   "projected_usd": 62.50,
#   "on_track": true
# }
```

**Returns:** OK for SET; map of budget info for GET

---

### COST.SAVE

Persist cost tracking state to store (survives restart).

```bash
COST.SAVE
```

**Examples:**
```bash
COST.SAVE
# OK
```

**Returns:** OK

## Use Cases

### Monthly Cost Review

```bash
# Check current spend
COST.STATS PERIOD 30

# Get optimization suggestions
COST.OPTIMIZE

# Apply hints
COST.HINTS

# Set a budget alert
COST.BUDGET SET 100.00 PERIOD monthly
```

### Capacity Planning

```bash
# Estimate cost for expanded workload
COST.ESTIMATE KEYS "*" PERIOD 90

# Identify savings opportunities
COST.OPTIMIZE TARGET_SAVINGS 15
```

## Related Commands

- [Server Commands](/docs/reference/commands/server) - Server management
- [Configuration Reference](/docs/reference/configuration) - Config options
- [S3 Storage Commands](/docs/reference/commands/s3-storage) - Cloud storage
