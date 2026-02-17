---
title: "FerriteQL: SQL for Key-Value Data"
sidebar_label: FerriteQL
sidebar_position: 3
description: FerriteQL brings SQL-like querying power to Ferrite's key-value store – SELECT, JOIN, GROUP BY, materialized views, and 40+ built-in functions.
keywords: [FerriteQL, SQL, query language, key-value, aggregation, joins, materialized views, prepared statements]
maturity: experimental
---

:::caution Experimental Feature
This feature is **experimental** and subject to change. APIs, behavior, and performance characteristics may evolve significantly between releases. Use with caution in production environments.
:::

# FerriteQL: SQL for Key-Value Data

FerriteQL is Ferrite's built-in query language that brings the expressiveness of SQL to key-value data. Write familiar `SELECT … FROM … WHERE` queries across keys, join data from different key patterns, aggregate results, and create materialized views — all without moving data to an external database.

## Why FerriteQL?

Key-value stores are fast, but answering questions like *"what are my top 10 customers by revenue?"* typically requires pulling data into application code. FerriteQL eliminates that round-trip:

| Approach | "Top 10 customers by revenue" | Latency | Code |
|---|---|---|---|
| Application-side | Scan all keys → deserialize → sort → aggregate in app | 100–500 ms | 30+ lines |
| External DB sync | ETL to Postgres → SQL query | seconds–minutes | Pipeline + SQL |
| **FerriteQL** | `SELECT … GROUP BY … ORDER BY … LIMIT 10` | **10–50 ms** | **1 query** |

```
Application                           Ferrite
┌─────────────┐    QUERY.EXECUTE     ┌──────────────────────────┐
│             │ ──────────────────▶  │  Lexer → Parser → AST    │
│  Any Redis  │                      │        ↓                  │
│  Client     │                      │  Planner → Optimizer      │
│             │ ◀──────────────────  │        ↓                  │
│             │    Result Set        │  Executor → ResultSet     │
└─────────────┘                      └──────────────────────────┘
```

### Key Capabilities

- **Familiar SQL syntax** — `SELECT`, `WHERE`, `JOIN`, `GROUP BY`, `ORDER BY`, `HAVING`, `LIMIT`/`OFFSET`
- **Cross-key joins** — correlate data across different key patterns (e.g., users ↔ orders)
- **40+ built-in functions** — string, numeric, date/time, JSON, and aggregate functions
- **Materialized views** — pre-computed query results with automatic refresh
- **Prepared statements** — parse once, execute many times with different parameters
- **Query optimizer** — constant folding, predicate pushdown, projection pruning, join reordering
- **EXPLAIN plans** — inspect how queries execute for performance tuning
- **Write operations** — `INSERT`, `UPDATE`, `DELETE` with full WHERE support

---

## Syntax Reference

### SELECT

Retrieve data from one or more key patterns:

```sql
-- All fields from all user hashes
SELECT * FROM hash:user:*

-- Specific fields with aliases
SELECT name AS username, email, age FROM hash:user:* AS u

-- Distinct values
SELECT DISTINCT state FROM hash:user:*

-- Computed columns
SELECT name, price * quantity AS total FROM hash:order_item:*
```

### WHERE

Filter rows with comparison, logical, and pattern operators:

```sql
-- Comparison operators: =, !=, <>, <, >, <=, >=
SELECT * FROM hash:user:* WHERE age >= 18 AND age < 65

-- IN clause
SELECT * FROM hash:user:* WHERE state IN ('CA', 'NY', 'TX')

-- BETWEEN range
SELECT * FROM hash:order:* WHERE total BETWEEN 100 AND 500

-- LIKE pattern matching (% = any chars, _ = single char)
SELECT * FROM hash:user:* WHERE email LIKE '%@gmail.com'

-- NULL checks
SELECT * FROM hash:user:* WHERE phone IS NOT NULL

-- Combined conditions
SELECT * FROM hash:user:*
WHERE status = 'active'
  AND (state = 'CA' OR state = 'NY')
  AND created_at > '2024-01-01'
```

### JOIN

Correlate data across different key patterns. Ferrite supports `INNER`, `LEFT`, `RIGHT`, `FULL`, and `CROSS` joins:

```sql
-- Inner join: users with their orders
SELECT u.name, o.id AS order_id, o.total
FROM hash:user:* AS u
INNER JOIN hash:order:* AS o ON o.user_id = u.id
WHERE o.status = 'completed'

-- Left join: all users, with order count (including users with 0 orders)
SELECT u.name, COUNT(o.id) AS order_count
FROM hash:user:* AS u
LEFT JOIN hash:order:* AS o ON o.user_id = u.id
GROUP BY u.id, u.name

-- Self join: employees and their managers
SELECT e.name AS employee, m.name AS manager
FROM hash:employee:* AS e
LEFT JOIN hash:employee:* AS m ON e.manager_id = m.id

-- Cross join: all product-category combinations
SELECT p.name, c.name AS category
FROM hash:product:* AS p
CROSS JOIN hash:category:* AS c
```

### GROUP BY and HAVING

Aggregate rows into groups:

```sql
-- Count users per state
SELECT state, COUNT(*) AS user_count
FROM hash:user:*
GROUP BY state
ORDER BY user_count DESC

-- Revenue per category, only categories over $10k
SELECT category, SUM(total) AS revenue, AVG(total) AS avg_order
FROM hash:order:*
WHERE status = 'completed'
GROUP BY category
HAVING revenue > 10000
ORDER BY revenue DESC
```

### ORDER BY

Sort results by one or more columns:

```sql
-- Single column, descending
SELECT * FROM hash:user:* ORDER BY score DESC

-- Multiple columns with mixed direction
SELECT * FROM hash:user:* ORDER BY state ASC, name DESC

-- Null ordering control
SELECT * FROM hash:user:* ORDER BY last_login DESC NULLS LAST
```

### LIMIT and OFFSET

Paginate results:

```sql
-- First 10 results
SELECT * FROM hash:user:* LIMIT 10

-- Page 3 (items 21–30)
SELECT * FROM hash:user:* ORDER BY created_at DESC LIMIT 10 OFFSET 20
```

### Subqueries

Nest queries for complex filtering:

```sql
-- IN subquery: users who placed high-value orders
SELECT * FROM hash:user:*
WHERE id IN (
    SELECT user_id FROM hash:order:*
    WHERE total > 500
)

-- EXISTS subquery: products with 4+ star reviews
SELECT * FROM hash:product:*
WHERE EXISTS (
    SELECT 1 FROM hash:review:*
    WHERE review.product_id = product.id AND rating >= 4
)

-- Scalar subquery: each user's average order value
SELECT name,
    (SELECT AVG(total) FROM hash:order:* WHERE user_id = u.id) AS avg_order
FROM hash:user:* AS u
```

### CASE Expressions

Conditional logic inside queries:

```sql
SELECT name, score,
    CASE
        WHEN score >= 90 THEN 'A'
        WHEN score >= 80 THEN 'B'
        WHEN score >= 70 THEN 'C'
        ELSE 'F'
    END AS grade
FROM hash:student:*
ORDER BY score DESC
```

### Write Operations

FerriteQL supports `INSERT`, `UPDATE`, and `DELETE`:

```sql
-- Insert a new hash
INSERT INTO hash:user:456 (name, email, age)
VALUES ('Bob', 'bob@example.com', 30)

-- Update with condition
UPDATE hash:user:*
SET tier = 'gold'
WHERE total_purchases > 5000

-- Delete expired sessions
DELETE FROM hash:session:*
WHERE expires_at < NOW()
```

---

## Data Type Handling

FerriteQL operates over Ferrite's key-value data with automatic type detection:

| Source Data | FerriteQL Type | Example |
|---|---|---|
| String values | `String` | `"hello"`, `"active"` |
| Numeric strings | `Integer` or `Float` | `"42"` → 42, `"3.14"` → 3.14 |
| Boolean strings | `Boolean` | `"true"` → true |
| JSON values | Expanded to fields | `{"name":"Alice","age":30}` → name, age columns |
| NULL / missing | `Null` | IS NULL / IS NOT NULL |
| Binary data | `Bytes` | Raw byte access |
| Arrays | `Array` | JSON arrays |
| Maps/Hashes | `Map` | Hash fields become columns |

### JSON Path Access

For JSON-encoded values, access nested fields with dot notation or JSON functions:

```sql
-- Dot notation for nested fields
SELECT name, address.city, address.zip
FROM hash:user:*

-- JSON functions for complex extraction
SELECT
    JSON_EXTRACT(metadata, '$.tags[0]') AS first_tag,
    JSON_TYPE(metadata) AS meta_type,
    JSON_ARRAY_LENGTH(JSON_EXTRACT(metadata, '$.tags')) AS tag_count
FROM hash:product:*
```

---

## Built-in Functions

### String Functions

| Function | Description | Example |
|---|---|---|
| `UPPER(s)` | Uppercase | `UPPER('hello')` → `'HELLO'` |
| `LOWER(s)` | Lowercase | `LOWER('HELLO')` → `'hello'` |
| `LENGTH(s)` | String length | `LENGTH('hello')` → `5` |
| `SUBSTRING(s, start, len)` | Extract substring | `SUBSTRING('hello', 1, 3)` → `'hel'` |
| `CONCAT(a, b, …)` | Concatenate strings | `CONCAT('a', 'b')` → `'ab'` |
| `TRIM(s)` | Remove whitespace | `TRIM(' hi ')` → `'hi'` |
| `LTRIM(s)` / `RTRIM(s)` | Trim left/right | `LTRIM(' hi')` → `'hi'` |
| `REPLACE(s, from, to)` | Replace occurrences | `REPLACE('aab', 'a', 'x')` → `'xxb'` |
| `INSTR(s, sub)` | Find position | `INSTR('hello', 'llo')` → `3` |

### Numeric Functions

| Function | Description | Example |
|---|---|---|
| `ABS(n)` | Absolute value | `ABS(-5)` → `5` |
| `ROUND(n, decimals)` | Round | `ROUND(3.456, 2)` → `3.46` |
| `CEIL(n)` | Round up | `CEIL(3.2)` → `4` |
| `FLOOR(n)` | Round down | `FLOOR(3.8)` → `3` |
| `MOD(a, b)` | Modulo | `MOD(10, 3)` → `1` |
| `POWER(base, exp)` | Exponentiation | `POWER(2, 10)` → `1024` |
| `SQRT(n)` | Square root | `SQRT(16)` → `4` |
| `SIGN(n)` | Sign (-1, 0, 1) | `SIGN(-42)` → `-1` |

### Date/Time Functions

| Function | Description | Example |
|---|---|---|
| `NOW()` | Current timestamp | `NOW()` |
| `DATE(ts)` | Extract date | `DATE('2024-03-15 10:30:00')` → `'2024-03-15'` |
| `YEAR(ts)` | Extract year | `YEAR('2024-03-15')` → `2024` |
| `MONTH(ts)` | Extract month | `MONTH('2024-03-15')` → `3` |
| `DAY(ts)` | Extract day | `DAY('2024-03-15')` → `15` |
| `HOUR(ts)` | Extract hour | `HOUR('10:30:00')` → `10` |
| `MINUTE(ts)` | Extract minute | `MINUTE('10:30:00')` → `30` |
| `SECOND(ts)` | Extract second | `SECOND('10:30:45')` → `45` |

### JSON Functions

| Function | Description | Example |
|---|---|---|
| `JSON_EXTRACT(doc, path)` | Extract value | `JSON_EXTRACT(data, '$.name')` |
| `JSON_TYPE(doc)` | Get value type | `JSON_TYPE('{"a":1}')` → `'object'` |
| `JSON_ARRAY_LENGTH(arr)` | Array length | `JSON_ARRAY_LENGTH('[1,2,3]')` → `3` |
| `JSON_KEYS(doc)` | Object keys | `JSON_KEYS('{"a":1,"b":2}')` → `['a','b']` |

### Aggregate Functions

| Function | Description | Example |
|---|---|---|
| `COUNT(*)` | Count rows | `COUNT(*)` |
| `COUNT(col)` | Count non-null | `COUNT(email)` |
| `COUNT(DISTINCT col)` | Count distinct | `COUNT(DISTINCT state)` |
| `SUM(col)` | Sum values | `SUM(total)` |
| `AVG(col)` | Average | `AVG(score)` |
| `MIN(col)` | Minimum | `MIN(price)` |
| `MAX(col)` | Maximum | `MAX(created_at)` |
| `ARRAY_AGG(col)` | Collect into array | `ARRAY_AGG(tag)` |
| `STRING_AGG(col, sep)` | Join strings | `STRING_AGG(name, ', ')` |

### Null-Handling Functions

| Function | Description | Example |
|---|---|---|
| `COALESCE(a, b, …)` | First non-null | `COALESCE(nickname, name)` |
| `NULLIF(a, b)` | NULL if equal | `NULLIF(status, 'unknown')` |
| `IFNULL(val, default)` | Default for null | `IFNULL(phone, 'N/A')` |

---

## Materialized Views

Materialized views pre-compute query results and cache them for fast retrieval. They're ideal for dashboards, reports, and frequently accessed aggregations.

### Creating Views

```sql
-- Basic materialized view
CREATE VIEW active_user_stats AS
SELECT state, COUNT(*) AS user_count, AVG(age) AS avg_age
FROM hash:user:*
WHERE status = 'active'
GROUP BY state

-- With automatic refresh interval
CREATE VIEW order_summary AS
SELECT
    DATE(created_at) AS order_date,
    COUNT(*) AS order_count,
    SUM(total) AS revenue,
    AVG(total) AS avg_order
FROM hash:order:*
WHERE status = 'completed'
GROUP BY DATE(created_at)
MATERIALIZE EVERY 5m
```

### Querying Views

```sql
-- Query a materialized view just like a regular source
SELECT * FROM VIEW active_user_stats
WHERE user_count > 100
ORDER BY user_count DESC
```

### Managing Views

```bash
# List all views
QUERY.VIEWS

# Manually refresh a view
QUERY.REFRESH active_user_stats

# Drop a view
QUERY.DROP_VIEW active_user_stats
```

### Refresh Strategies

| Strategy | Command | Use Case |
|---|---|---|
| **On-demand** | `QUERY.REFRESH view_name` | Ad-hoc reports |
| **Time-based** | `MATERIALIZE EVERY 5m` | Dashboards (eventual freshness) |

:::tip When to Use Materialized Views
Use materialized views when the same aggregation is read far more often than the underlying data changes. A dashboard that refreshes every 30 seconds but queries data updated every 5 minutes is a perfect fit.
:::

---

## Performance Characteristics

### Query Execution Pipeline

```
Query String
    │
    ▼
┌─────────┐   ┌─────────┐   ┌───────────┐   ┌───────────┐   ┌──────────┐
│  Lexer  │──▶│ Parser  │──▶│  Planner  │──▶│ Optimizer │──▶│ Executor │
│ (tokens)│   │  (AST)  │   │  (plan)   │   │(optimized)│   │(results) │
└─────────┘   └─────────┘   └───────────┘   └───────────┘   └──────────┘
```

### Optimizer Techniques

The query optimizer applies several transformations automatically:

- **Constant folding** — evaluates `1 + 2` at plan time, not per-row
- **Predicate pushdown** — moves filters as close to the scan as possible
- **Projection pushdown** — only reads fields that are actually needed
- **Join reordering** — chooses the most efficient join order
- **Dead code elimination** — removes always-true/always-false conditions

### Performance Tips

| Technique | Impact | Example |
|---|---|---|
| Narrow key patterns | ⬇️ Keys scanned | `hash:user:CA:*` vs `hash:user:*` |
| Add `LIMIT` | ⬇️ Memory usage | Always limit unbounded queries |
| Use prepared statements | ⬇️ Parse overhead | `QUERY.PREPARE` + `QUERY.RUN` |
| Materialized views | ⬇️ Repeated computation | Pre-compute aggregations |
| `EXPLAIN` your queries | 🔍 Find bottlenecks | `QUERY.EXPLAIN "SELECT …"` |
| Select specific columns | ⬇️ Data transfer | `SELECT name, email` vs `SELECT *` |

### Query Limits

Configure resource limits in `ferrite.toml`:

```toml
[query]
enabled = true
max_results = 10000          # Max rows returned
timeout_ms = 30000           # Query timeout (30s default)
cache_prepared = true        # Cache prepared statements
max_prepared = 1000          # Max prepared statements

[query.limits]
max_scan_rows = 1000000      # Max keys to scan (1M default)
max_memory_bytes = 268435456 # Memory limit per query (256 MB default)
max_concurrent = 16          # Concurrent query limit
```

### EXPLAIN Plans

Inspect how a query will execute before running it:

```bash
QUERY.EXPLAIN "SELECT state, COUNT(*) FROM hash:user:* WHERE age > 21 GROUP BY state"
```

```
Plan:
  Scan: hash:user:*
  → Filter: age > 21
  → Aggregate: GROUP BY state, COUNT(*)
  → Project: state, COUNT(*)
Estimated keys: 50000
```

---

## Real-World Examples

### User Analytics

```sql
-- Top 10 states by active user count
SELECT state, COUNT(*) AS users, AVG(age) AS avg_age
FROM hash:user:*
WHERE status = 'active' AND last_login > '2024-01-01'
GROUP BY state
ORDER BY users DESC
LIMIT 10
```

### Shopping Cart Aggregation

```sql
-- Cart totals with item details
SELECT
    c.user_id,
    u.name,
    COUNT(c.product_id) AS item_count,
    SUM(c.price * c.quantity) AS cart_total
FROM hash:cart_item:* AS c
INNER JOIN hash:user:* AS u ON c.user_id = u.id
GROUP BY c.user_id, u.name
HAVING cart_total > 50
ORDER BY cart_total DESC
```

### Session Data Analysis

```sql
-- Average session duration by page, last 7 days
SELECT
    page_url,
    COUNT(*) AS visits,
    AVG(duration_sec) AS avg_duration,
    MAX(duration_sec) AS max_duration
FROM hash:session:*
WHERE created_at > '2024-06-01'
GROUP BY page_url
ORDER BY visits DESC
LIMIT 20
```

### IoT Sensor Data

```sql
-- Hourly temperature averages per sensor location
SELECT
    location,
    HOUR(timestamp) AS hour,
    AVG(temperature) AS avg_temp,
    MIN(temperature) AS min_temp,
    MAX(temperature) AS max_temp,
    COUNT(*) AS readings
FROM hash:sensor:*
WHERE type = 'temperature'
  AND DATE(timestamp) = DATE(NOW())
GROUP BY location, HOUR(timestamp)
ORDER BY location, hour
```

### Revenue Dashboard View

```sql
CREATE VIEW daily_revenue AS
SELECT
    DATE(created_at) AS day,
    category,
    COUNT(*) AS orders,
    SUM(total) AS revenue,
    AVG(total) AS avg_order,
    COUNT(DISTINCT user_id) AS unique_customers
FROM hash:order:*
WHERE status = 'completed'
GROUP BY DATE(created_at), category
MATERIALIZE EVERY 1m
```

---

## Architecture

FerriteQL is implemented as a pipeline of composable stages inside the `ferrite-core` crate:

| Stage | Source | Purpose |
|---|---|---|
| **Lexer** | `query/lexer.rs` | Tokenizes query strings (80+ token types) |
| **Parser** | `query/parser.rs` | Builds Abstract Syntax Tree from tokens |
| **AST** | `query/ast.rs` | Type-safe query representation |
| **Planner** | `query/planner.rs` | Converts AST to executable query plan |
| **Optimizer** | `query/optimizer.rs` | Applies optimization passes to the plan |
| **Executor** | `query/executor.rs` | Executes plans against storage, produces results |
| **Functions** | `query/functions.rs` | 40+ built-in scalar and aggregate functions |
| **Views** | `query/views.rs` | Materialized view management and refresh |
| **Types** | `query/types.rs` | Type system with coercion rules |

---

## Next Steps

- **[FerriteQL Quickstart Tutorial](/docs/tutorials/ferriteql-quickstart)** — hands-on in 5 minutes
- **[Materialized Views](/docs/query/materialized-views)** — pre-computed query results
- **[Aggregations](/docs/query/aggregations)** — advanced aggregation functions
- **[Prepared Statements](/docs/query/prepared-statements)** — query optimization
