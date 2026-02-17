---
sidebar_position: 4
maturity: experimental
---

# Prepared Statements

Optimize and reuse queries with prepared statements.

## Overview

Prepared statements allow you to compile queries once and execute them multiple times with different parameters. This improves performance and prevents query injection.

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Query     │────▶│   Parse &   │────▶│   Cached    │
│   String    │     │   Compile   │     │   Plan      │
└─────────────┘     └─────────────┘     └─────────────┘
                                               │
                    ┌─────────────┐     ┌──────┴──────┐
                    │   Results   │◀────│   Execute   │
                    └─────────────┘     │   (params)  │
                                        └─────────────┘
```

## Benefits

| Aspect | Ad-hoc Query | Prepared Statement |
|--------|--------------|-------------------|
| Parse time | Every execution | Once |
| Plan optimization | Every execution | Once |
| Parameter binding | String concatenation | Safe binding |
| Cache efficiency | Low | High |

## Creating Prepared Statements

### Basic Syntax

```bash
QUERY.PREPARE <name> <query_with_placeholders>

# Single parameter
QUERY.PREPARE get_user "SELECT * FROM hash:user:* WHERE id = ?"

# Multiple parameters
QUERY.PREPARE find_users "SELECT * FROM hash:user:* WHERE state = ? AND age > ?"

# Named parameters
QUERY.PREPARE search_products "SELECT * FROM hash:product:* WHERE category = :category AND price < :max_price"
```

### Parameter Types

```bash
# Positional parameters (?)
QUERY.PREPARE stmt1 "SELECT * FROM hash:user:* WHERE id = ? AND status = ?"

# Named parameters (:name)
QUERY.PREPARE stmt2 "SELECT * FROM hash:user:* WHERE id = :user_id AND status = :status"

# Indexed parameters ($1, $2)
QUERY.PREPARE stmt3 "SELECT * FROM hash:user:* WHERE id = $1 AND status = $2"
```

## Executing Prepared Statements

### With Positional Parameters

```bash
QUERY.RUN get_user "123"
# Equivalent to: SELECT * FROM hash:user:* WHERE id = '123'

QUERY.RUN find_users "CA" 21
# Equivalent to: SELECT * FROM hash:user:* WHERE state = 'CA' AND age > 21
```

### With Named Parameters

```bash
QUERY.RUN search_products category="electronics" max_price=500
# Equivalent to: SELECT * FROM hash:product:* WHERE category = 'electronics' AND price < 500
```

### Execute Options

```bash
# With timeout
QUERY.RUN get_user "123" TIMEOUT 5000

# With limit override
QUERY.RUN list_users LIMIT 100

# Explain execution
QUERY.RUN get_user "123" EXPLAIN
```

## Managing Statements

### List Statements

```bash
QUERY.LIST
# Returns:
# 1) name: get_user
#    query: SELECT * FROM hash:user:* WHERE id = ?
#    params: 1
#    executions: 5000
#    avg_time_ms: 1.2
# 2) name: find_users
#    query: SELECT * FROM hash:user:* WHERE state = ? AND age > ?
#    params: 2
#    executions: 1200
#    avg_time_ms: 3.5
```

### Statement Info

```bash
QUERY.INFO get_user
# Returns:
# name: get_user
# query: SELECT * FROM hash:user:* WHERE id = ?
# parameters:
#   - position: 1
#     type: string
# created_at: 2024-01-15T10:00:00Z
# executions: 5000
# total_time_ms: 6000
# avg_time_ms: 1.2
# cache_hits: 4500
# plan: Scan(hash:user:*) -> Filter(id = $1)
```

### Drop Statement

```bash
QUERY.DROP get_user

# Drop all statements
QUERY.DROP ALL
```

## Query Plan Caching

### Automatic Plan Caching

Prepared statements automatically cache query plans:

```bash
# First execution: parse + plan + execute
QUERY.RUN get_user "123"
# plan_time: 5ms, exec_time: 2ms

# Subsequent executions: execute only
QUERY.RUN get_user "456"
# plan_time: 0ms, exec_time: 2ms
```

### View Cached Plan

```bash
QUERY.EXPLAIN get_user
# Returns:
# Plan:
#   Scan: hash:user:*
#   Filter: id = $1
#   Estimated rows: 1
#   Index: idx_user_id (if available)
```

### Force Replan

```bash
# Recompile statement (e.g., after schema changes)
QUERY.REPLAN get_user
```

## Type Handling

### Automatic Type Inference

```bash
# String parameter
QUERY.RUN get_user "alice"

# Integer parameter
QUERY.RUN find_users "CA" 21

# Float parameter
QUERY.RUN search_products "electronics" 99.99

# Boolean parameter
QUERY.RUN active_users true

# Null parameter
QUERY.RUN optional_field NULL
```

### Explicit Type Casting

```bash
# Force integer type
QUERY.RUN find_by_age INT:21

# Force string type
QUERY.RUN find_by_id STR:123

# Array parameter
QUERY.RUN find_in_states ARRAY:["CA", "NY", "TX"]
```

## Batch Execution

### Execute with Multiple Parameter Sets

```bash
# Batch execute
QUERY.BATCH get_user [
  ["123"],
  ["456"],
  ["789"]
]
# Returns results for all three executions
```

### Pipelined Execution

```bash
# Pipeline multiple different statements
QUERY.PIPELINE [
  ["get_user", "123"],
  ["get_orders", "123"],
  ["get_preferences", "123"]
]
```

## Rust API

```rust
use ferrite::query::{QueryEngine, PreparedStatement};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let engine = QueryEngine::new(config)?;

    // Create prepared statement
    let get_user = engine.prepare(
        "get_user",
        "SELECT * FROM hash:user:* WHERE id = ?"
    ).await?;

    // Execute with parameters
    let results = get_user.execute(&["123"]).await?;
    for row in results {
        println!("User: {}", row.get("name")?);
    }

    // Execute multiple times efficiently
    for user_id in &["123", "456", "789"] {
        let results = get_user.execute(&[user_id]).await?;
        // Process results
    }

    // Named parameters
    let search = engine.prepare(
        "search",
        "SELECT * FROM hash:product:* WHERE category = :cat AND price < :max"
    ).await?;

    let results = search.execute_named(&[
        ("cat", "electronics"),
        ("max", "500"),
    ]).await?;

    // Batch execution
    let params_batch = vec![
        vec!["123"],
        vec!["456"],
        vec!["789"],
    ];
    let all_results = get_user.execute_batch(&params_batch).await?;

    // Statement info
    let info = engine.statement_info("get_user")?;
    println!("Executions: {}, Avg time: {}ms",
        info.executions, info.avg_time_ms);

    Ok(())
}
```

## Configuration

```toml
[query.prepared]
enabled = true
max_statements = 10000
statement_timeout_ms = 30000
plan_cache_size = 1000

[query.prepared.auto_prepare]
enabled = true
threshold = 3  # Auto-prepare after 3 identical queries
```

## Security

### Parameter Injection Prevention

Prepared statements prevent SQL injection:

```bash
# UNSAFE - string concatenation
"SELECT * FROM hash:user:* WHERE name = '" + userInput + "'"
# userInput = "'; DROP TABLE users; --" -> INJECTION!

# SAFE - prepared statement
QUERY.PREPARE safe_search "SELECT * FROM hash:user:* WHERE name = ?"
QUERY.RUN safe_search "'; DROP TABLE users; --"
# Treated as literal string, no injection possible
```

### Parameter Validation

```bash
# Define parameter constraints
QUERY.PREPARE validated_search
  "SELECT * FROM hash:user:* WHERE age = ?"
  PARAMS (INT RANGE 0 150)

# Execution fails if parameter invalid
QUERY.RUN validated_search 200
# Error: Parameter out of range
```

## Performance Tips

### When to Use Prepared Statements

**Good candidates:**
- Queries executed > 10 times
- Complex queries with joins
- Queries with variable parameters
- Security-sensitive queries

**Skip for:**
- One-time queries
- Simple key lookups
- Highly dynamic queries

### Monitoring

```bash
QUERY.STATS
# Returns:
# total_statements: 50
# total_executions: 500000
# avg_plan_time_ms: 2.5
# avg_exec_time_ms: 1.8
# cache_hit_rate: 0.95
# slowest_statements:
#   - complex_join: 15.2ms avg
#   - full_scan: 8.5ms avg
```

## Best Practices

1. **Prepare frequently-used queries** - Amortize parse cost
2. **Use named parameters** - More readable, self-documenting
3. **Validate parameters** - Add constraints where appropriate
4. **Monitor execution stats** - Identify optimization opportunities
5. **Batch when possible** - Reduce round-trips
6. **Set appropriate timeouts** - Prevent runaway queries
7. **Replan after schema changes** - Ensure optimal plans

## Next Steps

- [FerriteQL](/docs/query/ferriteql) - Query language reference
- [Materialized Views](/docs/query/materialized-views) - Pre-computed results
- [Aggregations](/docs/query/aggregations) - Aggregation functions
