---
sidebar_position: 2
maturity: experimental
---

# Materialized Views

Pre-compute and cache query results for fast reads.

## Overview

Materialized views store the results of complex queries as regular keys, enabling fast reads of pre-aggregated data. Views are automatically updated when underlying data changes.

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Base Data  │────▶│   View      │────▶│   Cached    │
│  (Changes)  │     │   Engine    │     │   Results   │
└─────────────┘     └─────────────┘     └─────────────┘
                           │
                    ┌──────┴──────┐
                    │  Refresh    │
                    │  Strategy   │
                    └─────────────┘
```

## Quick Start

```bash
# Create a materialized view
VIEW.CREATE sales_by_region AS
  SELECT region, SUM(amount) AS total
  FROM hash:order:*
  WHERE status = 'completed'
  GROUP BY region

# Query the view (fast read)
VIEW.GET sales_by_region

# Manually refresh
VIEW.REFRESH sales_by_region
```

## Creating Views

### Basic View

```bash
VIEW.CREATE <name> AS <query>

# Example: Total users by state
VIEW.CREATE users_by_state AS
  SELECT state, COUNT(*) AS count
  FROM hash:user:*
  GROUP BY state
```

### With Refresh Strategy

```bash
# Refresh every 5 minutes
VIEW.CREATE hourly_stats AS
  SELECT DATE(created_at) AS date, COUNT(*) AS orders
  FROM hash:order:*
  GROUP BY date
REFRESH INTERVAL 300

# Refresh on key changes
VIEW.CREATE user_summary AS
  SELECT status, COUNT(*) AS count
  FROM hash:user:*
  GROUP BY status
REFRESH ON CHANGE 'hash:user:*'

# Manual refresh only
VIEW.CREATE monthly_report AS
  SELECT MONTH(created_at) AS month, SUM(total) AS revenue
  FROM hash:order:*
  GROUP BY month
REFRESH MANUAL
```

### With Options

```bash
VIEW.CREATE product_rankings AS
  SELECT category, name, AVG(rating) AS avg_rating
  FROM hash:review:*
  GROUP BY product_id
  HAVING COUNT(*) > 10
  ORDER BY avg_rating DESC
OPTIONS (
  REFRESH_INTERVAL = 600,
  MAX_ROWS = 1000,
  STORE_AS = 'zset'
)
```

## Refresh Strategies

### Interval-Based

Refresh periodically regardless of data changes:

```bash
VIEW.CREATE daily_metrics AS
  SELECT DATE(timestamp) AS date, COUNT(*) AS events
  FROM stream:events
  GROUP BY date
REFRESH INTERVAL 3600  -- Every hour
```

### Change-Based

Refresh when source data changes:

```bash
VIEW.CREATE inventory_status AS
  SELECT product_id, SUM(quantity) AS total
  FROM hash:inventory:*
  GROUP BY product_id
REFRESH ON CHANGE 'hash:inventory:*'
```

### Incremental

Update only affected rows (for append-only data):

```bash
VIEW.CREATE event_counts AS
  SELECT event_type, COUNT(*) AS count
  FROM stream:events
  GROUP BY event_type
REFRESH INCREMENTAL
```

### Manual

Only refresh on explicit command:

```bash
VIEW.CREATE quarterly_report AS
  SELECT QUARTER(date) AS quarter, SUM(revenue) AS total
  FROM hash:sales:*
  GROUP BY quarter
REFRESH MANUAL
```

## Querying Views

### Direct Read

```bash
# Get all view data
VIEW.GET sales_by_region

# Get specific rows
VIEW.GET sales_by_region WHERE region = 'West'

# With sorting
VIEW.GET user_stats ORDER BY total DESC LIMIT 10
```

### In FerriteQL

```sql
-- Use view in queries
SELECT v.region, v.total, r.name
FROM VIEW:sales_by_region AS v
JOIN hash:region:* AS r ON v.region = r.code
ORDER BY v.total DESC
```

## Managing Views

### List Views

```bash
VIEW.LIST
# Returns:
# 1) name: sales_by_region
#    query: SELECT region, SUM(amount)...
#    refresh: interval:300
#    last_refresh: 2024-01-15T10:25:00Z
#    rows: 5
# 2) name: user_summary
#    ...
```

### View Info

```bash
VIEW.INFO sales_by_region
# Returns:
# name: sales_by_region
# query: SELECT region, SUM(amount) AS total FROM hash:order:* WHERE status = 'completed' GROUP BY region
# refresh_strategy: interval
# refresh_interval: 300
# last_refresh: 2024-01-15T10:25:00Z
# next_refresh: 2024-01-15T10:30:00Z
# rows: 5
# size_bytes: 1024
# source_keys: 15000
```

### Manual Refresh

```bash
# Refresh specific view
VIEW.REFRESH sales_by_region

# Refresh all views
VIEW.REFRESH ALL

# Force full refresh (ignore incremental)
VIEW.REFRESH sales_by_region FULL
```

### Alter View

```bash
# Change refresh interval
VIEW.ALTER sales_by_region REFRESH INTERVAL 600

# Pause refreshes
VIEW.ALTER sales_by_region REFRESH PAUSE

# Resume refreshes
VIEW.ALTER sales_by_region REFRESH RESUME
```

### Drop View

```bash
VIEW.DROP sales_by_region

# Drop with confirmation
VIEW.DROP sales_by_region CONFIRM
```

## Storage Options

### Hash Storage (Default)

```bash
VIEW.CREATE stats AS
  SELECT key, value FROM ...
OPTIONS (STORE_AS = 'hash')

# Access: HGETALL view:stats
```

### Sorted Set Storage

Good for ranked data:

```bash
VIEW.CREATE leaderboard AS
  SELECT user_id, score FROM ...
  ORDER BY score DESC
OPTIONS (STORE_AS = 'zset', SCORE_FIELD = 'score')

# Access: ZREVRANGE view:leaderboard 0 9
```

### JSON Storage

For complex nested results:

```bash
VIEW.CREATE report AS
  SELECT * FROM ...
OPTIONS (STORE_AS = 'json')

# Access: JSON.GET view:report
```

## Dependencies

### View Dependencies

```bash
# View that depends on another view
VIEW.CREATE top_regions AS
  SELECT * FROM VIEW:sales_by_region
  ORDER BY total DESC
  LIMIT 5

# Dependency chain is automatically maintained
```

### Dependency Graph

```bash
VIEW.DEPS sales_by_region
# Returns:
# depends_on: []
# used_by: [top_regions, regional_summary]
```

## Rust API

```rust
use ferrite::views::{ViewManager, ViewConfig, RefreshStrategy};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let manager = ViewManager::new(config)?;

    // Create view
    manager.create(
        "sales_by_region",
        "SELECT region, SUM(amount) AS total FROM hash:order:* GROUP BY region",
        ViewConfig {
            refresh: RefreshStrategy::Interval(Duration::from_secs(300)),
            max_rows: Some(1000),
            store_as: StoreFormat::Hash,
            ..Default::default()
        }
    ).await?;

    // Query view
    let results = manager.get("sales_by_region").await?;
    for row in results {
        println!("{}: ${}", row["region"], row["total"]);
    }

    // Manual refresh
    manager.refresh("sales_by_region").await?;

    // Get view info
    let info = manager.info("sales_by_region")?;
    println!("Last refresh: {:?}", info.last_refresh);

    Ok(())
}
```

## Configuration

```toml
[views]
enabled = true
max_views = 1000
default_refresh_interval = 300
max_rows_per_view = 100000

[views.storage]
prefix = "view:"
default_format = "hash"

[views.refresh]
concurrent_refreshes = 4
timeout_ms = 60000
retry_on_failure = true
max_retries = 3
```

## Performance

### Query vs View

| Operation | Query Time | View Time |
|-----------|------------|-----------|
| Simple aggregation | 50ms | 0.5ms |
| Complex join | 500ms | 1ms |
| Full scan | 5s | 2ms |

### Optimization Tips

1. **Choose appropriate refresh interval** - Balance freshness vs. load
2. **Use incremental refresh** - When possible for append-only data
3. **Limit view size** - Set MAX_ROWS for large result sets
4. **Index source data** - Speed up underlying queries
5. **Monitor refresh times** - Alert on slow refreshes

## Use Cases

### Dashboard Metrics

```bash
VIEW.CREATE dashboard_metrics AS
  SELECT
    COUNT(*) AS total_users,
    COUNT(CASE WHEN status = 'active' THEN 1 END) AS active_users,
    AVG(lifetime_value) AS avg_ltv
  FROM hash:user:*
REFRESH INTERVAL 60
```

### Leaderboards

```bash
VIEW.CREATE game_leaderboard AS
  SELECT user_id, username, score, rank
  FROM (
    SELECT user_id, username, score,
           ROW_NUMBER() OVER (ORDER BY score DESC) AS rank
    FROM hash:player:*
  )
  WHERE rank <= 100
REFRESH ON CHANGE 'hash:player:*'
OPTIONS (STORE_AS = 'zset', SCORE_FIELD = 'score')
```

### Inventory Summary

```bash
VIEW.CREATE inventory_summary AS
  SELECT
    category,
    COUNT(*) AS products,
    SUM(quantity) AS total_stock,
    SUM(quantity * price) AS total_value
  FROM hash:product:*
  GROUP BY category
REFRESH ON CHANGE 'hash:product:*'
```

### Analytics Rollups

```bash
VIEW.CREATE hourly_events AS
  SELECT
    DATE_TRUNC('hour', timestamp) AS hour,
    event_type,
    COUNT(*) AS count
  FROM stream:events
  GROUP BY hour, event_type
REFRESH INCREMENTAL
```

## Best Practices

1. **Don't over-use views** - Only for frequently-read, expensive queries
2. **Set appropriate refresh rates** - Match business requirements
3. **Monitor view freshness** - Track last_refresh times
4. **Plan for failures** - Enable retry and alerting
5. **Document dependencies** - Understand refresh cascades
6. **Test refresh performance** - Ensure refreshes complete in time

## Next Steps

- [FerriteQL](/docs/query/ferriteql) - Query language reference
- [Aggregations](/docs/query/aggregations) - Aggregation functions
- [Prepared Statements](/docs/query/prepared-statements) - Query optimization
