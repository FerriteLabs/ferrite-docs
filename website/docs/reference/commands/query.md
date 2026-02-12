---
sidebar_position: 26
maturity: experimental
---

:::caution Experimental Feature
This feature is **experimental** and subject to change. APIs, behavior, and performance characteristics may evolve significantly between releases. Use with caution in production environments.
:::

# Query Commands (FerriteQL)

Commands for FerriteQL - Ferrite's SQL-like query language.

## Overview

FerriteQL provides a SQL-like query language for complex data operations across multiple keys, enabling joins, aggregations, and analytics without client-side processing.

## Commands

### QUERY.EXECUTE

Execute a FerriteQL query.

```bash
QUERY.EXECUTE query [PARAMS param1 param2 ...]
```

**Time complexity:** O(N) where N is the data scanned

**Examples:**
```bash
# Simple SELECT
QUERY.EXECUTE "SELECT * FROM users:* WHERE age > 21"

# With parameters
QUERY.EXECUTE "SELECT * FROM orders:* WHERE status = $1 AND total > $2" PARAMS "completed" 100

# Aggregation
QUERY.EXECUTE "SELECT category, COUNT(*), AVG(price) FROM products:* GROUP BY category"

# Join
QUERY.EXECUTE "
  SELECT u.name, o.total
  FROM users:* u
  JOIN orders:* o ON o.user_id = u.id
  WHERE o.status = 'completed'
"
```

---

### QUERY.PREPARE

Prepare a query for repeated execution.

```bash
QUERY.PREPARE statement_name query
```

**Time complexity:** O(1)

**Examples:**
```bash
QUERY.PREPARE get_user_orders "
  SELECT * FROM orders:*
  WHERE user_id = $1
  ORDER BY created_at DESC
  LIMIT $2
"
# OK

QUERY.PREPARE active_products "
  SELECT * FROM products:*
  WHERE active = true AND category = $1
"
# OK
```

---

### QUERY.EXEC_PREPARED

Execute a prepared statement.

```bash
QUERY.EXEC_PREPARED statement_name [PARAMS param1 param2 ...]
```

**Time complexity:** O(N) where N is the data scanned

**Examples:**
```bash
QUERY.EXEC_PREPARED get_user_orders PARAMS "user:123" 10
# Returns user's last 10 orders

QUERY.EXEC_PREPARED active_products PARAMS "electronics"
# Returns active electronics products
```

---

### QUERY.EXPLAIN

Explain query execution plan.

```bash
QUERY.EXPLAIN query
```

**Time complexity:** O(1)

**Examples:**
```bash
QUERY.EXPLAIN "SELECT * FROM orders:* WHERE total > 100"
# {
#   "plan": {
#     "type": "scan",
#     "pattern": "orders:*",
#     "filter": "total > 100",
#     "estimated_keys": 10000,
#     "index_used": "orders_total_idx"
#   }
# }

QUERY.EXPLAIN "
  SELECT u.name, COUNT(o.id)
  FROM users:* u
  JOIN orders:* o ON o.user_id = u.id
  GROUP BY u.id
"
# Shows join strategy and aggregation plan
```

---

### QUERY.STATEMENTS

List prepared statements.

```bash
QUERY.STATEMENTS [PATTERN pattern]
```

**Time complexity:** O(N) where N is the number of statements

**Examples:**
```bash
QUERY.STATEMENTS
# 1) "get_user_orders"
# 2) "active_products"
# 3) "daily_sales"

QUERY.STATEMENTS PATTERN "user*"
# 1) "get_user_orders"
```

---

### QUERY.DROP

Drop a prepared statement.

```bash
QUERY.DROP statement_name
```

**Time complexity:** O(1)

---

### QUERY.INDEX.CREATE

Create an index for query optimization.

```bash
QUERY.INDEX.CREATE index_name
  ON pattern
  FIELDS field1 [ASC|DESC] [field2 ...]
  [TYPE BTREE|HASH]
```

**Time complexity:** O(N) where N is the number of matching keys

**Examples:**
```bash
# Single field index
QUERY.INDEX.CREATE orders_total_idx
  ON "orders:*"
  FIELDS total DESC

# Compound index
QUERY.INDEX.CREATE orders_user_date_idx
  ON "orders:*"
  FIELDS user_id ASC, created_at DESC

# Hash index for equality lookups
QUERY.INDEX.CREATE users_email_idx
  ON "users:*"
  FIELDS email
  TYPE HASH
```

---

### QUERY.INDEX.LIST

List query indexes.

```bash
QUERY.INDEX.LIST [PATTERN pattern]
```

**Examples:**
```bash
QUERY.INDEX.LIST
# 1) "orders_total_idx"
# 2) "orders_user_date_idx"
# 3) "users_email_idx"
```

---

### QUERY.INDEX.INFO

Get index information.

```bash
QUERY.INDEX.INFO index_name
```

**Examples:**
```bash
QUERY.INDEX.INFO orders_total_idx
# {
#   "name": "orders_total_idx",
#   "pattern": "orders:*",
#   "fields": [{"name": "total", "order": "DESC"}],
#   "type": "BTREE",
#   "keys_indexed": 50000,
#   "size": "2.5 MB",
#   "last_updated": "2024-01-15T10:00:00Z"
# }
```

---

### QUERY.INDEX.DROP

Drop an index.

```bash
QUERY.INDEX.DROP index_name
```

---

### QUERY.INDEX.REBUILD

Rebuild an index.

```bash
QUERY.INDEX.REBUILD index_name
```

---

### VIEW.CREATE

Create a materialized view.

```bash
VIEW.CREATE view_name AS query
  [REFRESH INTERVAL seconds | ON WRITE]
  [TTL seconds]
```

**Time complexity:** O(N) for initial materialization

**Examples:**
```bash
# Auto-refreshing view
VIEW.CREATE daily_sales AS "
  SELECT DATE(created_at) as date, SUM(total) as revenue
  FROM orders:*
  WHERE created_at > NOW() - INTERVAL '30 days'
  GROUP BY DATE(created_at)
" REFRESH INTERVAL 300

# Refresh on write
VIEW.CREATE user_stats AS "
  SELECT user_id, COUNT(*) as order_count, SUM(total) as total_spent
  FROM orders:*
  GROUP BY user_id
" REFRESH ON WRITE
```

---

### VIEW.GET

Get materialized view data.

```bash
VIEW.GET view_name [WHERE condition]
```

**Time complexity:** O(1) for cached view

**Examples:**
```bash
VIEW.GET daily_sales
# Returns cached aggregated data

VIEW.GET user_stats WHERE total_spent > 1000
# Returns filtered view data
```

---

### VIEW.REFRESH

Manually refresh a view.

```bash
VIEW.REFRESH view_name
```

---

### VIEW.LIST

List materialized views.

```bash
VIEW.LIST
```

---

### VIEW.DROP

Drop a materialized view.

```bash
VIEW.DROP view_name
```

## FerriteQL Syntax

### SELECT Statement

```sql
SELECT [DISTINCT] columns
FROM pattern [alias]
[JOIN pattern [alias] ON condition]
[WHERE condition]
[GROUP BY columns]
[HAVING condition]
[ORDER BY columns [ASC|DESC]]
[LIMIT count [OFFSET offset]]
```

### Supported Data Types

| Type | Description | Example |
|------|-------------|---------|
| STRING | Text values | `'hello'` |
| INTEGER | Whole numbers | `42` |
| FLOAT | Decimal numbers | `3.14` |
| BOOLEAN | True/false | `true`, `false` |
| NULL | Null value | `NULL` |
| ARRAY | JSON arrays | `[1, 2, 3]` |
| OBJECT | JSON objects | `{"key": "value"}` |

### Operators

```sql
-- Comparison
=, !=, <>, <, >, <=, >=
BETWEEN ... AND ...
IN (...)
LIKE, ILIKE
IS NULL, IS NOT NULL

-- Logical
AND, OR, NOT

-- Arithmetic
+, -, *, /, %

-- JSON
-> (get field)
->> (get field as text)
@> (contains)
? (has key)
```

### Aggregate Functions

```sql
COUNT(*), COUNT(DISTINCT field)
SUM(field)
AVG(field)
MIN(field)
MAX(field)
ARRAY_AGG(field)
STRING_AGG(field, separator)
```

### Scalar Functions

```sql
-- String
UPPER(s), LOWER(s), LENGTH(s)
SUBSTRING(s, start, length)
CONCAT(s1, s2, ...)
TRIM(s), LTRIM(s), RTRIM(s)
REPLACE(s, from, to)

-- Numeric
ABS(n), CEIL(n), FLOOR(n), ROUND(n, decimals)
POWER(n, exp), SQRT(n), LOG(n)

-- Date/Time
NOW(), CURRENT_DATE, CURRENT_TIME
DATE(ts), TIME(ts)
YEAR(ts), MONTH(ts), DAY(ts)
HOUR(ts), MINUTE(ts), SECOND(ts)
DATE_ADD(ts, interval)
DATE_SUB(ts, interval)
DATE_DIFF(ts1, ts2)

-- JSON
JSON_EXTRACT(json, path)
JSON_ARRAY_LENGTH(json)
JSON_KEYS(json)
JSON_TYPE(json)

-- Conditional
COALESCE(v1, v2, ...)
NULLIF(v1, v2)
CASE WHEN ... THEN ... ELSE ... END
IF(condition, true_val, false_val)
```

## Use Cases

### Analytics Dashboard

```bash
# Total revenue by category
QUERY.EXECUTE "
  SELECT
    p.category,
    COUNT(*) as order_count,
    SUM(oi.quantity) as units_sold,
    SUM(oi.price * oi.quantity) as revenue
  FROM order_items:* oi
  JOIN products:* p ON p.id = oi.product_id
  GROUP BY p.category
  ORDER BY revenue DESC
"

# Daily active users
QUERY.EXECUTE "
  SELECT
    DATE(last_active) as date,
    COUNT(DISTINCT id) as dau
  FROM users:*
  WHERE last_active > NOW() - INTERVAL '30 days'
  GROUP BY DATE(last_active)
  ORDER BY date
"
```

### Reporting

```bash
# Monthly sales report
VIEW.CREATE monthly_sales AS "
  SELECT
    YEAR(created_at) as year,
    MONTH(created_at) as month,
    COUNT(*) as orders,
    SUM(total) as revenue,
    AVG(total) as avg_order_value
  FROM orders:*
  GROUP BY YEAR(created_at), MONTH(created_at)
  ORDER BY year DESC, month DESC
" REFRESH INTERVAL 3600

# Get report
VIEW.GET monthly_sales
```

### Complex Filtering

```bash
# Find high-value customers
QUERY.EXECUTE "
  SELECT
    u.id,
    u.name,
    u.email,
    COUNT(o.id) as order_count,
    SUM(o.total) as lifetime_value
  FROM users:* u
  JOIN orders:* o ON o.user_id = u.id
  WHERE o.status = 'completed'
  GROUP BY u.id
  HAVING SUM(o.total) > 1000
  ORDER BY lifetime_value DESC
  LIMIT 100
"
```

### Real-Time Leaderboard

```bash
# Create leaderboard view
VIEW.CREATE game_leaderboard AS "
  SELECT
    user_id,
    username,
    SUM(score) as total_score,
    COUNT(*) as games_played,
    MAX(score) as best_score
  FROM game_scores:*
  GROUP BY user_id
  ORDER BY total_score DESC
  LIMIT 100
" REFRESH ON WRITE

# Get leaderboard
VIEW.GET game_leaderboard
```

## Rust API

```rust
use ferrite::Client;
use ferrite::query::{QueryResult, PreparedStatement};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let client = Client::connect("localhost:6379").await?;

    // Execute query
    let results: Vec<QueryResult> = client.query_execute(
        "SELECT * FROM users:* WHERE age > $1",
        &[&21],
    ).await?;

    for row in results {
        println!("{}: {}", row.get::<String>("name")?, row.get::<i32>("age")?);
    }

    // Prepare statement
    client.query_prepare(
        "get_orders",
        "SELECT * FROM orders:* WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2",
    ).await?;

    // Execute prepared statement
    let orders: Vec<QueryResult> = client.query_exec_prepared(
        "get_orders",
        &[&"user:123", &10],
    ).await?;

    // Create index
    client.query_index_create(
        "orders_user_idx",
        "orders:*",
        &[("user_id", "ASC")],
    ).await?;

    // Create materialized view
    client.view_create(
        "daily_revenue",
        "SELECT DATE(created_at) as date, SUM(total) as revenue FROM orders:* GROUP BY DATE(created_at)",
        ViewOptions::default().refresh_interval(300),
    ).await?;

    // Get view data
    let revenue: Vec<QueryResult> = client.view_get("daily_revenue", None).await?;

    // Explain query
    let plan = client.query_explain(
        "SELECT * FROM orders:* WHERE total > 100",
    ).await?;
    println!("Query plan: {:?}", plan);

    Ok(())
}
```

## Configuration

```toml
[query]
enabled = true
max_rows = 100000
timeout_ms = 30000
parallel_workers = 4

[query.cache]
enabled = true
max_size = "100MB"
ttl = 300

[query.indexes]
auto_create = true
max_indexes = 100
background_rebuild = true
```

## Performance Tips

1. **Use indexes**: Create indexes on frequently filtered/sorted columns
2. **Limit results**: Always use LIMIT for large datasets
3. **Use prepared statements**: For repeated queries
4. **Materialized views**: For expensive aggregations
5. **Selective patterns**: Use specific key patterns instead of `*`

## Related Commands

- [Document Commands](/docs/reference/commands/document) - JSON documents
- [Search Commands](/docs/reference/commands/search) - Full-text search
- [Time-Series Commands](/docs/reference/commands/timeseries) - Time-series queries
- [FerriteQL Guide](/docs/query/ferriteql) - Detailed query guide
