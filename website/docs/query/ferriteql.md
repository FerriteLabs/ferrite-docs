---
sidebar_position: 1
maturity: experimental
---

:::caution Experimental Feature
This feature is **experimental** and subject to change. APIs, behavior, and performance characteristics may evolve significantly between releases. Use with caution in production environments.
:::

# FerriteQL

SQL-like query language for complex data operations across keys.

## Overview

FerriteQL provides a familiar SQL syntax for querying data stored in Ferrite. It enables cross-key queries, aggregations, and joins that aren't possible with standard Redis commands.

```sql
-- Find all users in California with orders over $100
SELECT u.name, u.email, SUM(o.total) as order_total
FROM hash:user:* AS u
JOIN hash:order:* AS o ON o.user_id = u.id
WHERE u.state = 'CA'
GROUP BY u.id
HAVING order_total > 100
ORDER BY order_total DESC
LIMIT 10
```

## Quick Start

```bash
# Execute a query
QUERY.EXECUTE "SELECT * FROM hash:user:* WHERE age > 21"

# Prepare a query for reuse
QUERY.PREPARE get_users "SELECT * FROM hash:user:* WHERE state = ?"

# Execute prepared query
QUERY.RUN get_users "CA"
```

## Basic Queries

### SELECT

```sql
-- Select all fields
SELECT * FROM hash:user:*

-- Select specific fields
SELECT name, email, age FROM hash:user:*

-- With alias
SELECT name AS username, email FROM hash:user:* AS u
```

### WHERE Clause

```sql
-- Equality
SELECT * FROM hash:user:* WHERE status = 'active'

-- Comparison
SELECT * FROM hash:user:* WHERE age >= 18 AND age < 65

-- IN clause
SELECT * FROM hash:user:* WHERE state IN ('CA', 'NY', 'TX')

-- LIKE pattern
SELECT * FROM hash:user:* WHERE email LIKE '%@gmail.com'

-- NULL check
SELECT * FROM hash:user:* WHERE phone IS NOT NULL

-- Boolean
SELECT * FROM hash:user:* WHERE verified = true
```

### ORDER BY

```sql
-- Ascending (default)
SELECT * FROM hash:user:* ORDER BY created_at

-- Descending
SELECT * FROM hash:user:* ORDER BY score DESC

-- Multiple columns
SELECT * FROM hash:user:* ORDER BY state ASC, name DESC
```

### LIMIT and OFFSET

```sql
-- First 10 results
SELECT * FROM hash:user:* LIMIT 10

-- Pagination
SELECT * FROM hash:user:* LIMIT 10 OFFSET 20

-- Shorthand
SELECT * FROM hash:user:* LIMIT 20, 10  -- OFFSET 20, LIMIT 10
```

## Data Sources

### Hash Keys

```sql
-- Pattern matching
SELECT * FROM hash:user:*
SELECT * FROM hash:order:2024:*
SELECT * FROM hash:product:electronics:*

-- Specific key
SELECT * FROM hash:user:123
```

### JSON Documents

```sql
-- Document collections
SELECT * FROM doc:users WHERE $.profile.age > 21

-- Nested access
SELECT $.name, $.address.city FROM doc:users
```

### Sorted Sets

```sql
-- With scores
SELECT member, score FROM zset:leaderboard WHERE score > 1000

-- Range
SELECT * FROM zset:rankings RANGE 0 100
```

### Streams

```sql
-- Recent entries
SELECT * FROM stream:events LIMIT 100

-- Time range
SELECT * FROM stream:events WHERE timestamp > '2024-01-01'
```

## Aggregations

### COUNT

```sql
SELECT COUNT(*) FROM hash:user:*
SELECT COUNT(email) FROM hash:user:*
SELECT COUNT(DISTINCT state) FROM hash:user:*
```

### SUM, AVG, MIN, MAX

```sql
SELECT
    SUM(total) AS revenue,
    AVG(total) AS avg_order,
    MIN(total) AS min_order,
    MAX(total) AS max_order
FROM hash:order:*
WHERE status = 'completed'
```

### GROUP BY

```sql
SELECT state, COUNT(*) AS user_count
FROM hash:user:*
GROUP BY state
ORDER BY user_count DESC
```

### HAVING

```sql
SELECT category, SUM(quantity) AS total_sold
FROM hash:order_item:*
GROUP BY category
HAVING total_sold > 100
```

## Joins

### INNER JOIN

```sql
SELECT u.name, o.id, o.total
FROM hash:user:* AS u
INNER JOIN hash:order:* AS o ON o.user_id = u.id
WHERE o.status = 'pending'
```

### LEFT JOIN

```sql
SELECT u.name, COUNT(o.id) AS order_count
FROM hash:user:* AS u
LEFT JOIN hash:order:* AS o ON o.user_id = u.id
GROUP BY u.id
```

### Self Join

```sql
SELECT e.name AS employee, m.name AS manager
FROM hash:employee:* AS e
LEFT JOIN hash:employee:* AS m ON e.manager_id = m.id
```

## Subqueries

### IN Subquery

```sql
SELECT * FROM hash:user:*
WHERE id IN (
    SELECT user_id FROM hash:order:*
    WHERE total > 500
)
```

### EXISTS Subquery

```sql
SELECT * FROM hash:product:*
WHERE EXISTS (
    SELECT 1 FROM hash:review:*
    WHERE review.product_id = product.id
    AND rating >= 4
)
```

### Scalar Subquery

```sql
SELECT
    name,
    (SELECT AVG(total) FROM hash:order:* WHERE user_id = u.id) AS avg_order
FROM hash:user:* AS u
```

## Functions

### String Functions

```sql
SELECT
    UPPER(name) AS NAME,
    LOWER(email) AS email,
    LENGTH(description) AS desc_len,
    SUBSTRING(phone, 1, 3) AS area_code,
    CONCAT(first_name, ' ', last_name) AS full_name,
    TRIM(address) AS address
FROM hash:user:*
```

### Numeric Functions

```sql
SELECT
    ABS(balance) AS abs_balance,
    ROUND(price, 2) AS rounded_price,
    FLOOR(rating) AS min_rating,
    CEIL(rating) AS max_rating,
    price * 1.1 AS with_tax
FROM hash:product:*
```

### Date Functions

```sql
SELECT
    DATE(created_at) AS date,
    YEAR(created_at) AS year,
    MONTH(created_at) AS month,
    DAY(created_at) AS day,
    NOW() AS current_time,
    DATEDIFF(NOW(), created_at) AS age_days
FROM hash:order:*
```

### Conditional Functions

```sql
SELECT
    name,
    CASE
        WHEN score >= 90 THEN 'A'
        WHEN score >= 80 THEN 'B'
        WHEN score >= 70 THEN 'C'
        ELSE 'F'
    END AS grade,
    COALESCE(nickname, name) AS display_name,
    IF(verified, 'Yes', 'No') AS is_verified
FROM hash:student:*
```

## Write Operations

### INSERT

```sql
-- Insert into hash
INSERT INTO hash:user:456 (name, email, age)
VALUES ('Bob', 'bob@example.com', 30)

-- Insert from select
INSERT INTO hash:vip_user:*
SELECT * FROM hash:user:*
WHERE total_purchases > 10000
```

### UPDATE

```sql
-- Update single key
UPDATE hash:user:123
SET status = 'inactive', updated_at = NOW()

-- Update with condition
UPDATE hash:user:*
SET tier = 'gold'
WHERE total_purchases > 5000
```

### DELETE

```sql
-- Delete single key
DELETE FROM hash:user:123

-- Delete with condition
DELETE FROM hash:session:*
WHERE expires_at < NOW()
```

## Prepared Statements

### Create Prepared Statement

```bash
QUERY.PREPARE find_users "SELECT * FROM hash:user:* WHERE state = ? AND age > ?"
```

### Execute Prepared Statement

```bash
QUERY.RUN find_users "CA" 21
# Returns matching users
```

### List Prepared Statements

```bash
QUERY.LIST
# Returns all prepared statements
```

### Drop Prepared Statement

```bash
QUERY.DROP find_users
```

## Transactions

```sql
BEGIN TRANSACTION;

UPDATE hash:account:123 SET balance = balance - 100;
UPDATE hash:account:456 SET balance = balance + 100;
INSERT INTO hash:transfer:789 (from_id, to_id, amount) VALUES ('123', '456', 100);

COMMIT;
```

## Performance

### EXPLAIN

```bash
QUERY.EXPLAIN "SELECT * FROM hash:user:* WHERE state = 'CA'"
# Returns:
# Scan: hash:user:*
# Filter: state = 'CA'
# Estimated rows: 1000
# Index used: none
```

### Query Optimization

```sql
-- Use specific patterns instead of broad wildcards
SELECT * FROM hash:user:CA:*  -- Better
SELECT * FROM hash:user:* WHERE state = 'CA'  -- Slower

-- Limit results early
SELECT * FROM hash:order:* ORDER BY created_at DESC LIMIT 10

-- Use indexes for frequent queries
CREATE INDEX idx_user_state ON hash:user:* (state)
```

## Configuration

```toml
[query]
enabled = true
max_results = 10000
timeout_ms = 30000
cache_prepared = true
max_prepared = 1000

[query.optimizer]
enabled = true
use_indexes = true
parallel_scan = true
```

## Rust API

```rust
use ferrite::query::{QueryEngine, Query, PreparedStatement};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let engine = QueryEngine::new(config)?;

    // Execute query
    let results = engine.execute(
        "SELECT * FROM hash:user:* WHERE age > 21"
    ).await?;

    for row in results {
        println!("{}: {}", row.get("id")?, row.get("name")?);
    }

    // Prepared statement
    let stmt = engine.prepare(
        "SELECT * FROM hash:user:* WHERE state = ?"
    ).await?;

    let results = stmt.execute(&["CA"]).await?;

    // Transaction
    engine.transaction(|tx| async {
        tx.execute("UPDATE hash:account:123 SET balance = balance - 100").await?;
        tx.execute("UPDATE hash:account:456 SET balance = balance + 100").await?;
        Ok(())
    }).await?;

    Ok(())
}
```

## Limitations

- **No nested transactions** - Only single-level transactions supported
- **Pattern-based scanning** - Broad patterns may be slow
- **Memory limits** - Large result sets are limited by configuration
- **Join complexity** - Complex joins may timeout

## Best Practices

1. **Use specific patterns** - Narrow key patterns for better performance
2. **Add indexes** - Index frequently filtered fields
3. **Limit results** - Always use LIMIT for unbounded queries
4. **Use prepared statements** - Reuse queries for better performance
5. **Monitor query times** - Use EXPLAIN and slow query logs
6. **Batch writes** - Use transactions for multiple updates

## Next Steps

- [Materialized Views](/docs/query/materialized-views) - Pre-computed query results
- [Aggregations](/docs/query/aggregations) - Advanced aggregation functions
- [Prepared Statements](/docs/query/prepared-statements) - Query optimization
