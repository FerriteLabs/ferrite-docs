---
sidebar_position: 35
maturity: experimental
---

:::caution Experimental Feature
This feature is **experimental** and subject to change. APIs, behavior, and performance characteristics may evolve significantly between releases. Use with caution in production environments.
:::

# AUTOINDEX Commands

Commands for automatic index management.

## Overview

AUTOINDEX commands enable ML-driven automatic index creation and management based on query access patterns. Ferrite records key access events, analyzes workload patterns, and recommends or applies optimal indexes.

## Commands

### AUTOINDEX.RECORD

Record a key access pattern for index analysis.

```bash
AUTOINDEX.RECORD key
```

**Examples:**
```bash
AUTOINDEX.RECORD user:1001
# OK

AUTOINDEX.RECORD product:electronics:42
# OK
```

**Returns:** OK

---

### AUTOINDEX.ANALYZE

Analyze recorded access patterns and generate index recommendations.

```bash
AUTOINDEX.ANALYZE
```

**Examples:**
```bash
AUTOINDEX.ANALYZE
# 1) "pattern: user:* -> hash index on 'name', 'email'"
# 2) "pattern: product:*:* -> sorted set index on 'price'"
```

**Returns:** Array of recommendations

---

### AUTOINDEX.RECOMMEND

Get top N index recommendations.

```bash
AUTOINDEX.RECOMMEND [COUNT n]
```

**Examples:**
```bash
AUTOINDEX.RECOMMEND COUNT 5
# 1) 1) "pattern"
#    2) "user:*"
#    3) "type"
#    4) "hash"
#    5) "fields"
#    6) 1) "name"
#       2) "email"
#    7) "score"
#    8) "0.95"
# 2) 1) "pattern"
#    2) "product:*"
#    3) "type"
#    4) "sorted_set"
#    5) "fields"
#    6) 1) "price"
#    7) "score"
#    8) "0.82"
```

**Returns:** Array of recommendations with scores

---

### AUTOINDEX.APPLY

Apply a recommended index.

```bash
AUTOINDEX.APPLY pattern type [FIELDS field1 field2 ...]
```

**Examples:**
```bash
AUTOINDEX.APPLY "user:*" hash FIELDS name email
# OK

AUTOINDEX.APPLY "product:*" sorted_set FIELDS price
# OK
```

**Returns:** OK

---

### AUTOINDEX.LIST

List active auto-indexes.

```bash
AUTOINDEX.LIST
```

**Examples:**
```bash
AUTOINDEX.LIST
# 1) 1) "pattern"
#    2) "user:*"
#    3) "type"
#    4) "hash"
#    5) "fields"
#    6) 1) "name"
#       2) "email"
#    7) "created_at"
#    8) "2026-01-20T10:30:00Z"
# 2) 1) "pattern"
#    2) "product:*"
#    3) "type"
#    4) "sorted_set"
#    5) "fields"
#    6) 1) "price"
#    7) "created_at"
#    8) "2026-01-20T11:00:00Z"
```

**Returns:** Array of active indexes

---

### AUTOINDEX.REMOVE

Remove an auto-index.

```bash
AUTOINDEX.REMOVE pattern type
```

**Examples:**
```bash
AUTOINDEX.REMOVE "user:*" hash
# OK
```

**Returns:** OK

---

### AUTOINDEX.STATS

Get auto-indexing statistics.

```bash
AUTOINDEX.STATS
```

**Examples:**
```bash
AUTOINDEX.STATS
# {
#   "total_recorded": 150000,
#   "patterns_detected": 12,
#   "indexes_applied": 3,
#   "recommendations_pending": 5,
#   "last_analysis": "2026-01-20T12:00:00Z"
# }
```

**Returns:** Map of statistics

---

### AUTOINDEX.SAVE

Persist auto-index state to store (survives restart).

```bash
AUTOINDEX.SAVE
```

**Examples:**
```bash
AUTOINDEX.SAVE
# OK
```

**Returns:** OK

## Use Cases

### Adaptive Query Optimization

```bash
# Record access patterns during normal operation
AUTOINDEX.RECORD user:1001
AUTOINDEX.RECORD user:1002
AUTOINDEX.RECORD product:electronics:42

# Periodically analyze and apply recommendations
AUTOINDEX.ANALYZE
AUTOINDEX.RECOMMEND COUNT 3
AUTOINDEX.APPLY "user:*" hash FIELDS name email

# Persist state
AUTOINDEX.SAVE
```

### Monitoring Index Health

```bash
# Check current indexes
AUTOINDEX.LIST

# Review statistics
AUTOINDEX.STATS

# Remove underperforming indexes
AUTOINDEX.REMOVE "old_pattern:*" hash
```

## Related Commands

- [Search Commands](/docs/reference/commands/search) - Full-text search
- [Vector Commands](/docs/reference/commands/vector) - Vector indexes
- [Keys Commands](/docs/reference/commands/keys) - Key management
