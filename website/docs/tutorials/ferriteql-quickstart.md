---
title: "FerriteQL Quickstart"
sidebar_label: FerriteQL Quickstart
sidebar_position: 13
description: Learn FerriteQL in 5 minutes – query, filter, join, aggregate, and create materialized views over key-value data.
keywords: [FerriteQL, quickstart, tutorial, SQL, query, joins, aggregation, materialized views]
maturity: experimental
---

# FerriteQL Quickstart

Get productive with FerriteQL in **5 minutes**. By the end, you'll be able to query, filter, join, aggregate, and create materialized views over your Ferrite data.

## Prerequisites

- **Ferrite server** running locally ([installation guide](/docs/getting-started/installation))
- A Redis-compatible client (`redis-cli`, `ioredis`, `redis-py`, etc.)

## Step 1: Seed Sample Data

Let's create some users and orders to query against. Using `redis-cli` or any Redis client:

```bash
# Users (stored as hashes)
redis-cli HSET hash:user:1 id 1 name "Alice" email "alice@example.com" state "CA" age 32 status "active"
redis-cli HSET hash:user:2 id 2 name "Bob" email "bob@example.com" state "NY" age 28 status "active"
redis-cli HSET hash:user:3 id 3 name "Charlie" email "charlie@example.com" state "CA" age 45 status "inactive"
redis-cli HSET hash:user:4 id 4 name "Diana" email "diana@example.com" state "TX" age 35 status "active"
redis-cli HSET hash:user:5 id 5 name "Eve" email "eve@example.com" state "NY" age 22 status "active"

# Orders
redis-cli HSET hash:order:101 id 101 user_id 1 total 250.00 status "completed" category "electronics"
redis-cli HSET hash:order:102 id 102 user_id 1 total 75.50 status "completed" category "books"
redis-cli HSET hash:order:103 id 103 user_id 2 total 150.00 status "pending" category "electronics"
redis-cli HSET hash:order:104 id 104 user_id 2 total 320.00 status "completed" category "clothing"
redis-cli HSET hash:order:105 id 105 user_id 4 total 89.99 status "completed" category "books"
redis-cli HSET hash:order:106 id 106 user_id 5 total 445.00 status "completed" category "electronics"
```

## Step 2: Your First Query

Retrieve all users:

```bash
QUERY.EXECUTE "SELECT * FROM hash:user:*"
```

```text
+----+----------+-----------------------+-------+-----+----------+
| id | name     | email                 | state | age | status   |
+----+----------+-----------------------+-------+-----+----------+
| 1  | Alice    | alice@example.com     | CA    | 32  | active   |
| 2  | Bob      | bob@example.com       | NY    | 28  | active   |
| 3  | Charlie  | charlie@example.com   | CA    | 45  | inactive |
| 4  | Diana    | diana@example.com     | TX    | 35  | active   |
| 5  | Eve      | eve@example.com       | NY    | 22  | active   |
+----+----------+-----------------------+-------+-----+----------+
```

Select specific columns:

```bash
QUERY.EXECUTE "SELECT name, email, state FROM hash:user:*"
```

## Step 3: Filtering with WHERE

Find active users in California:

```sql
SELECT name, age FROM hash:user:*
WHERE status = 'active' AND state = 'CA'
```

```text
+-------+-----+
| name  | age |
+-------+-----+
| Alice | 32  |
+-------+-----+
```

Use `IN` for multiple values:

```sql
SELECT name, state FROM hash:user:*
WHERE state IN ('CA', 'NY')
  AND age > 25
```

Pattern matching with `LIKE`:

```sql
SELECT name, email FROM hash:user:*
WHERE email LIKE '%@example.com'
```

## Step 4: Sorting and Pagination

Sort users by age, descending:

```sql
SELECT name, age, state FROM hash:user:*
WHERE status = 'active'
ORDER BY age DESC
```

```text
+-------+-----+-------+
| name  | age | state |
+-------+-----+-------+
| Diana | 35  | TX    |
| Alice | 32  | CA    |
| Bob   | 28  | NY    |
| Eve   | 22  | NY    |
+-------+-----+-------+
```

Paginate with `LIMIT` and `OFFSET`:

```sql
SELECT name, age FROM hash:user:*
ORDER BY age DESC
LIMIT 2 OFFSET 1
```

## Step 5: Joins

Join users with their orders:

```sql
SELECT u.name, o.id AS order_id, o.total, o.category
FROM hash:user:* AS u
INNER JOIN hash:order:* AS o ON o.user_id = u.id
WHERE o.status = 'completed'
ORDER BY o.total DESC
```

```text
+-------+----------+--------+-------------+
| name  | order_id | total  | category    |
+-------+----------+--------+-------------+
| Eve   | 106      | 445.00 | electronics |
| Bob   | 104      | 320.00 | clothing    |
| Alice | 101      | 250.00 | electronics |
| Diana | 105      | 89.99  | books       |
| Alice | 102      | 75.50  | books       |
+-------+----------+--------+-------------+
```

Left join to include users with no orders:

```sql
SELECT u.name, COUNT(o.id) AS order_count
FROM hash:user:* AS u
LEFT JOIN hash:order:* AS o ON o.user_id = u.id
GROUP BY u.id, u.name
ORDER BY order_count DESC
```

```text
+---------+-------------+
| name    | order_count |
+---------+-------------+
| Alice   | 2           |
| Bob     | 2           |
| Diana   | 1           |
| Eve     | 1           |
| Charlie | 0           |
+---------+-------------+
```

## Step 6: Aggregations

Count users per state:

```sql
SELECT state, COUNT(*) AS user_count
FROM hash:user:*
WHERE status = 'active'
GROUP BY state
ORDER BY user_count DESC
```

```text
+-------+------------+
| state | user_count |
+-------+------------+
| NY    | 2          |
| CA    | 1          |
| TX    | 1          |
+-------+------------+
```

Revenue summary by category:

```sql
SELECT
    category,
    COUNT(*) AS orders,
    SUM(total) AS revenue,
    AVG(total) AS avg_order,
    MIN(total) AS min_order,
    MAX(total) AS max_order
FROM hash:order:*
WHERE status = 'completed'
GROUP BY category
HAVING revenue > 100
ORDER BY revenue DESC
```

```text
+-------------+--------+---------+-----------+-----------+-----------+
| category    | orders | revenue | avg_order | min_order | max_order |
+-------------+--------+---------+-----------+-----------+-----------+
| electronics | 2      | 695.00  | 347.50    | 250.00    | 445.00    |
| clothing    | 1      | 320.00  | 320.00    | 320.00    | 320.00    |
| books       | 2      | 165.49  | 82.75     | 75.50     | 89.99     |
+-------------+--------+---------+-----------+-----------+-----------+
```

## Step 7: Materialized Views

Create a view for a revenue dashboard that refreshes every 5 minutes:

```sql
CREATE VIEW revenue_by_category AS
SELECT
    category,
    COUNT(*) AS order_count,
    SUM(total) AS revenue,
    AVG(total) AS avg_order
FROM hash:order:*
WHERE status = 'completed'
GROUP BY category
MATERIALIZE EVERY 5m
```

Query the view instantly (reads cached data):

```bash
QUERY.EXECUTE "SELECT * FROM VIEW revenue_by_category ORDER BY revenue DESC"
```

Manually refresh when needed:

```bash
QUERY.REFRESH revenue_by_category
```

List and drop views:

```bash
# List all views
QUERY.VIEWS

# Drop a view
QUERY.DROP_VIEW revenue_by_category
```

## Step 8: Using Built-in Functions

FerriteQL includes 40+ built-in functions:

```sql
-- String functions
SELECT
    UPPER(name) AS name_upper,
    LENGTH(email) AS email_len,
    CONCAT(name, ' (', state, ')') AS display
FROM hash:user:*

-- Conditional expressions
SELECT name,
    CASE
        WHEN age >= 35 THEN 'senior'
        WHEN age >= 25 THEN 'mid'
        ELSE 'junior'
    END AS tier,
    COALESCE(phone, 'N/A') AS phone
FROM hash:user:*
```

## Step 9: Prepared Statements

For queries you run repeatedly, prepare them once:

```bash
# Prepare a parameterized query
QUERY.PREPARE users_by_state "SELECT name, age FROM hash:user:* WHERE state = ? AND age > ?"

# Execute with different parameters
QUERY.RUN users_by_state "CA" 25
QUERY.RUN users_by_state "NY" 21

# Clean up
QUERY.DROP users_by_state
```

## Performance Tips

1. **Narrow your key patterns** — `hash:user:CA:*` is faster than `hash:user:*` + `WHERE state = 'CA'`
2. **Always add LIMIT** — unbounded queries can scan millions of keys
3. **Use prepared statements** — avoids re-parsing the same query
4. **Materialize expensive aggregations** — if the same GROUP BY runs repeatedly, make it a view
5. **Check with EXPLAIN** — see how your query executes:

```bash
QUERY.EXPLAIN "SELECT state, COUNT(*) FROM hash:user:* WHERE age > 21 GROUP BY state"
```

```text
Plan:
  Scan: hash:user:*
  → Filter: age > 21
  → Aggregate: GROUP BY state, COUNT(*)
  → Project: state, COUNT(*)
```

## What's Next?

- **[FerriteQL Reference](/docs/features/ferriteql)** — complete syntax, functions, and architecture
- **[Materialized Views](/docs/query/materialized-views)** — advanced view strategies
- **[Prepared Statements](/docs/query/prepared-statements)** — query optimization patterns
- **[FerriteQL Query Reference](/docs/query/ferriteql)** — all operators and data sources
