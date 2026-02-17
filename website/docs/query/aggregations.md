---
sidebar_position: 3
maturity: experimental
---

# Aggregations

Perform calculations across multiple keys and values.

## Overview

Ferrite supports rich aggregation functions for summarizing data across keys. Aggregations can be used in FerriteQL queries, materialized views, and via dedicated commands.

## Aggregation Functions

### COUNT

Count rows or non-null values:

```sql
-- Count all rows
SELECT COUNT(*) FROM hash:user:*

-- Count non-null values
SELECT COUNT(email) FROM hash:user:*

-- Count distinct values
SELECT COUNT(DISTINCT state) FROM hash:user:*
```

### SUM

Sum numeric values:

```sql
SELECT SUM(amount) AS total FROM hash:order:*
SELECT SUM(quantity * price) AS revenue FROM hash:order_item:*
```

### AVG

Calculate average:

```sql
SELECT AVG(age) AS avg_age FROM hash:user:*
SELECT AVG(rating) AS avg_rating FROM hash:review:*
```

### MIN / MAX

Find minimum or maximum:

```sql
SELECT MIN(price) AS cheapest, MAX(price) AS expensive
FROM hash:product:*

SELECT MIN(created_at) AS oldest, MAX(created_at) AS newest
FROM hash:order:*
```

### Standard Deviation

Calculate variance and standard deviation:

```sql
SELECT
    STDDEV(price) AS price_stddev,
    VARIANCE(price) AS price_variance
FROM hash:product:*

-- Population vs sample
SELECT
    STDDEV_POP(score) AS pop_stddev,
    STDDEV_SAMP(score) AS sample_stddev
FROM hash:test_result:*
```

### Percentiles

Calculate percentile values:

```sql
SELECT
    PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY response_time) AS median,
    PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY response_time) AS p95,
    PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY response_time) AS p99
FROM hash:request:*
```

## GROUP BY

Group data for aggregation:

```sql
-- Single column
SELECT state, COUNT(*) AS users
FROM hash:user:*
GROUP BY state

-- Multiple columns
SELECT state, city, COUNT(*) AS users
FROM hash:user:*
GROUP BY state, city

-- With expression
SELECT YEAR(created_at) AS year, COUNT(*) AS orders
FROM hash:order:*
GROUP BY YEAR(created_at)
```

## HAVING

Filter aggregated results:

```sql
-- Filter groups
SELECT category, AVG(rating) AS avg_rating
FROM hash:product:*
GROUP BY category
HAVING AVG(rating) > 4.0

-- Multiple conditions
SELECT user_id, COUNT(*) AS order_count, SUM(total) AS total_spent
FROM hash:order:*
GROUP BY user_id
HAVING order_count >= 5 AND total_spent > 1000
```

## Window Functions

### ROW_NUMBER

Assign sequential numbers:

```sql
SELECT
    name,
    score,
    ROW_NUMBER() OVER (ORDER BY score DESC) AS rank
FROM hash:player:*
```

### RANK / DENSE_RANK

Ranking with ties:

```sql
SELECT
    name,
    score,
    RANK() OVER (ORDER BY score DESC) AS rank,
    DENSE_RANK() OVER (ORDER BY score DESC) AS dense_rank
FROM hash:player:*

-- RANK: 1, 2, 2, 4 (gaps for ties)
-- DENSE_RANK: 1, 2, 2, 3 (no gaps)
```

### PARTITION BY

Rank within groups:

```sql
SELECT
    department,
    name,
    salary,
    RANK() OVER (PARTITION BY department ORDER BY salary DESC) AS dept_rank
FROM hash:employee:*
```

### Running Totals

```sql
SELECT
    date,
    amount,
    SUM(amount) OVER (ORDER BY date) AS running_total
FROM hash:transaction:*
```

### Moving Averages

```sql
SELECT
    date,
    value,
    AVG(value) OVER (
        ORDER BY date
        ROWS BETWEEN 6 PRECEDING AND CURRENT ROW
    ) AS moving_avg_7day
FROM hash:metric:*
```

### LAG / LEAD

Access previous/next rows:

```sql
SELECT
    date,
    price,
    LAG(price, 1) OVER (ORDER BY date) AS prev_price,
    price - LAG(price, 1) OVER (ORDER BY date) AS price_change
FROM hash:stock:*
```

## Aggregate Commands

### AGGREGATE

Direct aggregation command:

```bash
AGGREGATE hash:order:* SUM amount
# Returns: total sum of amount field

AGGREGATE hash:user:* COUNT
# Returns: count of keys

AGGREGATE hash:product:* AVG price WHERE category = 'electronics'
# Returns: average price for electronics
```

### AGGREGATE.GROUP

Group aggregation:

```bash
AGGREGATE.GROUP hash:order:* BY status COUNT
# Returns:
# pending: 50
# completed: 200
# cancelled: 10

AGGREGATE.GROUP hash:product:* BY category SUM inventory
# Returns category inventory totals
```

### AGGREGATE.MULTI

Multiple aggregations at once:

```bash
AGGREGATE.MULTI hash:order:*
  COUNT
  SUM total
  AVG total
  MIN total
  MAX total

# Returns:
# count: 260
# sum: 52000
# avg: 200
# min: 10
# max: 5000
```

## Time-Based Aggregations

### Time Bucketing

```sql
-- Hourly aggregation
SELECT
    DATE_TRUNC('hour', timestamp) AS hour,
    COUNT(*) AS events
FROM stream:events
GROUP BY DATE_TRUNC('hour', timestamp)

-- Daily aggregation
SELECT
    DATE(created_at) AS date,
    SUM(amount) AS daily_total
FROM hash:order:*
GROUP BY DATE(created_at)
```

### Time Series Commands

```bash
# Aggregate time series data
TS.AGGREGATE metrics:cpu
  RANGE now-1h now
  BUCKET 5m
  AGG avg

# Multiple aggregations
TS.AGGREGATE metrics:requests
  RANGE now-24h now
  BUCKET 1h
  AGG count sum avg p95
```

## Conditional Aggregations

### FILTER Clause

```sql
SELECT
    COUNT(*) AS total,
    COUNT(*) FILTER (WHERE status = 'active') AS active,
    COUNT(*) FILTER (WHERE status = 'inactive') AS inactive
FROM hash:user:*
```

### CASE in Aggregations

```sql
SELECT
    SUM(CASE WHEN status = 'completed' THEN amount ELSE 0 END) AS completed_total,
    SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END) AS pending_total
FROM hash:order:*
```

## Nested Aggregations

### Subquery Aggregation

```sql
-- Average of counts
SELECT AVG(user_count) AS avg_users_per_state
FROM (
    SELECT state, COUNT(*) AS user_count
    FROM hash:user:*
    GROUP BY state
) AS state_counts
```

### Top-N Per Group

```sql
SELECT * FROM (
    SELECT
        category,
        name,
        sales,
        ROW_NUMBER() OVER (PARTITION BY category ORDER BY sales DESC) AS rank
    FROM hash:product:*
) ranked
WHERE rank <= 3
```

## Rust API

```rust
use ferrite::aggregate::{Aggregator, AggFunc};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let aggregator = Aggregator::new(storage);

    // Simple aggregation
    let total = aggregator.sum("hash:order:*", "amount").await?;
    println!("Total: {}", total);

    // Multiple aggregations
    let stats = aggregator.compute(
        "hash:order:*",
        vec![
            AggFunc::Count,
            AggFunc::Sum("amount".to_string()),
            AggFunc::Avg("amount".to_string()),
            AggFunc::Min("amount".to_string()),
            AggFunc::Max("amount".to_string()),
        ],
        None,  // No filter
    ).await?;

    // Group by
    let by_status = aggregator.group_by(
        "hash:order:*",
        "status",
        vec![AggFunc::Count, AggFunc::Sum("amount".to_string())],
    ).await?;

    for (status, stats) in by_status {
        println!("{}: {} orders, ${} total", status, stats.count, stats.sum);
    }

    // With filter
    let active_sum = aggregator.compute(
        "hash:user:*",
        vec![AggFunc::Sum("balance".to_string())],
        Some(Filter::eq("status", "active")),
    ).await?;

    Ok(())
}
```

## Performance Considerations

### Indexes for Aggregations

```sql
-- Create index for frequent grouping
CREATE INDEX idx_order_status ON hash:order:* (status);

-- Query uses index for GROUP BY
SELECT status, COUNT(*) FROM hash:order:* GROUP BY status
```

### Approximate Aggregations

For large datasets, use approximate functions:

```sql
-- Approximate count (HyperLogLog)
SELECT APPROX_COUNT_DISTINCT(user_id) FROM stream:events

-- Approximate percentile (t-digest)
SELECT APPROX_PERCENTILE(response_time, 0.95) FROM hash:request:*
```

### Parallel Aggregation

```toml
[query.optimizer]
parallel_aggregation = true
aggregation_threads = 4
```

## Best Practices

1. **Use indexes** - Index columns used in GROUP BY
2. **Limit scope** - Use WHERE to reduce data scanned
3. **Consider materialized views** - For frequently-run aggregations
4. **Use approximate functions** - For very large datasets
5. **Monitor query times** - Optimize slow aggregations
6. **Batch time-based queries** - Use appropriate bucket sizes

## Next Steps

- [FerriteQL](/docs/query/ferriteql) - Query language reference
- [Materialized Views](/docs/query/materialized-views) - Pre-computed results
- [Prepared Statements](/docs/query/prepared-statements) - Query optimization
