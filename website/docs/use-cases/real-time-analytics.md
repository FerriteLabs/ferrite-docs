---
maturity: beta
---

# Real-Time Analytics

Ferrite's combination of in-memory speed, time-series support, and probabilistic data structures makes it ideal for building real-time analytics systems that process millions of events per second.

## Why Ferrite for Analytics?

| Feature | Benefit |
|---------|---------|
| **Sub-millisecond writes** | Ingest events without backpressure |
| **Time-series engine** | Native temporal aggregations |
| **HyperLogLog** | Cardinality estimation with 0.81% error |
| **Sorted sets** | Efficient leaderboards and rankings |
| **Streams** | Event sourcing and replay |
| **Lua scripting** | Complex atomic aggregations |

## Core Analytics Patterns

### 1. Event Counting

```rust
use ferrite::FerriteClient;
use chrono::{DateTime, Utc, Duration};

pub struct EventCounter {
    client: FerriteClient,
}

impl EventCounter {
    /// Increment counter with time-based key
    pub async fn count(&self, event: &str) -> Result<i64> {
        let now = Utc::now();

        // Multiple granularities for different time windows
        let minute_key = format!(
            "count:{}:{}",
            event,
            now.format("%Y%m%d%H%M")
        );
        let hour_key = format!(
            "count:{}:{}",
            event,
            now.format("%Y%m%d%H")
        );
        let day_key = format!(
            "count:{}:{}",
            event,
            now.format("%Y%m%d")
        );

        // Increment all granularities atomically
        let result = self.client.incr(&minute_key).await?;
        self.client.incr(&hour_key).await?;
        self.client.incr(&day_key).await?;

        // Set TTL for automatic cleanup
        self.client.expire(&minute_key, 3600).await?;      // 1 hour
        self.client.expire(&hour_key, 86400 * 7).await?;   // 7 days
        self.client.expire(&day_key, 86400 * 90).await?;   // 90 days

        Ok(result)
    }

    /// Get count for time range
    pub async fn get_range(
        &self,
        event: &str,
        start: DateTime<Utc>,
        end: DateTime<Utc>,
        granularity: Granularity,
    ) -> Result<Vec<(DateTime<Utc>, i64)>> {
        let mut results = Vec::new();
        let mut current = start;

        while current <= end {
            let key = match granularity {
                Granularity::Minute => format!(
                    "count:{}:{}", event, current.format("%Y%m%d%H%M")
                ),
                Granularity::Hour => format!(
                    "count:{}:{}", event, current.format("%Y%m%d%H")
                ),
                Granularity::Day => format!(
                    "count:{}:{}", event, current.format("%Y%m%d")
                ),
            };

            let count: i64 = self.client.get(&key).await?
                .map(|s| s.parse().unwrap_or(0))
                .unwrap_or(0);

            results.push((current, count));

            current = match granularity {
                Granularity::Minute => current + Duration::minutes(1),
                Granularity::Hour => current + Duration::hours(1),
                Granularity::Day => current + Duration::days(1),
            };
        }

        Ok(results)
    }
}

pub enum Granularity {
    Minute,
    Hour,
    Day,
}
```

### 2. Unique Visitor Counting (HyperLogLog)

```rust
pub struct UniqueVisitors {
    client: FerriteClient,
}

impl UniqueVisitors {
    /// Track unique visitor
    pub async fn track(&self, page: &str, visitor_id: &str) -> Result<()> {
        let now = Utc::now();

        // Track at multiple time granularities
        let keys = vec![
            format!("uv:{}:minute:{}", page, now.format("%Y%m%d%H%M")),
            format!("uv:{}:hour:{}", page, now.format("%Y%m%d%H")),
            format!("uv:{}:day:{}", page, now.format("%Y%m%d")),
            format!("uv:{}:month:{}", page, now.format("%Y%m")),
        ];

        for key in keys {
            self.client.pfadd(&key, visitor_id).await?;
        }

        Ok(())
    }

    /// Get unique count for time period
    pub async fn count(&self, page: &str, period: &str) -> Result<u64> {
        let key = format!("uv:{}:{}", page, period);
        self.client.pfcount(&key).await
    }

    /// Get unique count across multiple pages
    pub async fn count_combined(&self, pages: &[&str], period: &str) -> Result<u64> {
        let keys: Vec<String> = pages.iter()
            .map(|p| format!("uv:{}:{}", p, period))
            .collect();

        // Merge HyperLogLogs for combined count
        let temp_key = format!("uv:_temp:{}", Uuid::new_v4());
        self.client.pfmerge(&temp_key, &keys).await?;
        let count = self.client.pfcount(&temp_key).await?;
        self.client.del(&temp_key).await?;

        Ok(count)
    }

    /// Get daily unique visitors for date range
    pub async fn daily_uniques(
        &self,
        page: &str,
        start: DateTime<Utc>,
        days: u32,
    ) -> Result<Vec<DailyStats>> {
        let mut stats = Vec::new();

        for i in 0..days {
            let date = start + Duration::days(i as i64);
            let key = format!("uv:{}:day:{}", page, date.format("%Y%m%d"));
            let count = self.client.pfcount(&key).await.unwrap_or(0);

            stats.push(DailyStats {
                date: date.date_naive(),
                unique_visitors: count,
            });
        }

        Ok(stats)
    }
}
```

### 3. Time-Series Metrics

```rust
pub struct TimeSeriesMetrics {
    client: FerriteClient,
}

impl TimeSeriesMetrics {
    /// Record metric value with timestamp
    pub async fn record(
        &self,
        metric: &str,
        value: f64,
        tags: &[(&str, &str)],
    ) -> Result<()> {
        let timestamp = Utc::now().timestamp_millis();

        // Build key with tags
        let tag_str: String = tags.iter()
            .map(|(k, v)| format!("{}={}", k, v))
            .collect::<Vec<_>>()
            .join(",");
        let key = format!("ts:{}:{}", metric, tag_str);

        // Add to time-series
        self.client.timeseries_add(&key, timestamp, value).await?;

        Ok(())
    }

    /// Query time range
    pub async fn query(
        &self,
        metric: &str,
        tags: &[(&str, &str)],
        start: i64,
        end: i64,
    ) -> Result<Vec<DataPoint>> {
        let tag_str: String = tags.iter()
            .map(|(k, v)| format!("{}={}", k, v))
            .collect::<Vec<_>>()
            .join(",");
        let key = format!("ts:{}:{}", metric, tag_str);

        self.client.timeseries_range(&key, start, end).await
    }

    /// Aggregate over time window
    pub async fn aggregate(
        &self,
        metric: &str,
        tags: &[(&str, &str)],
        start: i64,
        end: i64,
        aggregation: Aggregation,
        bucket_size_ms: u64,
    ) -> Result<Vec<DataPoint>> {
        let tag_str: String = tags.iter()
            .map(|(k, v)| format!("{}={}", k, v))
            .collect::<Vec<_>>()
            .join(",");
        let key = format!("ts:{}:{}", metric, tag_str);

        self.client.timeseries_aggregate(
            &key,
            start,
            end,
            aggregation,
            bucket_size_ms,
        ).await
    }
}

pub enum Aggregation {
    Sum,
    Avg,
    Min,
    Max,
    Count,
    First,
    Last,
    StdDev,
    Variance,
}
```

### 4. Funnel Analysis

```rust
pub struct FunnelAnalytics {
    client: FerriteClient,
}

impl FunnelAnalytics {
    /// Track user entering funnel step
    pub async fn track_step(
        &self,
        funnel: &str,
        step: u32,
        user_id: &str,
    ) -> Result<()> {
        let now = Utc::now();
        let date = now.format("%Y%m%d").to_string();

        // Track user in step's HyperLogLog
        let step_key = format!("funnel:{}:{}:step:{}", funnel, date, step);
        self.client.pfadd(&step_key, user_id).await?;

        // Store timestamp for conversion time analysis
        let user_key = format!("funnel:{}:{}:user:{}:step:{}", funnel, date, user_id, step);
        self.client.set_ex(&user_key, &now.timestamp().to_string(), 86400).await?;

        Ok(())
    }

    /// Get funnel conversion rates
    pub async fn get_funnel(
        &self,
        funnel: &str,
        date: &str,
        steps: u32,
    ) -> Result<FunnelReport> {
        let mut counts = Vec::new();

        for step in 1..=steps {
            let key = format!("funnel:{}:{}:step:{}", funnel, date, step);
            let count = self.client.pfcount(&key).await.unwrap_or(0);
            counts.push(count);
        }

        // Calculate conversion rates
        let mut conversions = Vec::new();
        for i in 1..counts.len() {
            let rate = if counts[i - 1] > 0 {
                counts[i] as f64 / counts[i - 1] as f64 * 100.0
            } else {
                0.0
            };
            conversions.push(rate);
        }

        Ok(FunnelReport {
            funnel: funnel.to_string(),
            date: date.to_string(),
            step_counts: counts,
            conversion_rates: conversions,
            overall_conversion: if counts[0] > 0 {
                counts.last().copied().unwrap_or(0) as f64 / counts[0] as f64 * 100.0
            } else {
                0.0
            },
        })
    }
}
```

### 5. Real-Time Leaderboards

```rust
pub struct Leaderboard {
    client: FerriteClient,
}

impl Leaderboard {
    /// Update score (add to existing)
    pub async fn add_score(
        &self,
        board: &str,
        user_id: &str,
        score: f64,
    ) -> Result<f64> {
        let key = format!("leaderboard:{}", board);
        self.client.zincrby(&key, score, user_id).await
    }

    /// Set absolute score
    pub async fn set_score(
        &self,
        board: &str,
        user_id: &str,
        score: f64,
    ) -> Result<()> {
        let key = format!("leaderboard:{}", board);
        self.client.zadd(&key, score, user_id).await
    }

    /// Get top N users
    pub async fn get_top(
        &self,
        board: &str,
        count: u64,
    ) -> Result<Vec<LeaderboardEntry>> {
        let key = format!("leaderboard:{}", board);
        let results = self.client.zrevrange_with_scores(&key, 0, count - 1).await?;

        Ok(results.into_iter()
            .enumerate()
            .map(|(i, (user_id, score))| LeaderboardEntry {
                rank: i as u64 + 1,
                user_id,
                score,
            })
            .collect())
    }

    /// Get user's rank and score
    pub async fn get_rank(
        &self,
        board: &str,
        user_id: &str,
    ) -> Result<Option<LeaderboardEntry>> {
        let key = format!("leaderboard:{}", board);

        let rank = self.client.zrevrank(&key, user_id).await?;
        let score = self.client.zscore(&key, user_id).await?;

        match (rank, score) {
            (Some(r), Some(s)) => Ok(Some(LeaderboardEntry {
                rank: r + 1,
                user_id: user_id.to_string(),
                score: s,
            })),
            _ => Ok(None),
        }
    }

    /// Get users around a specific user
    pub async fn get_around(
        &self,
        board: &str,
        user_id: &str,
        count: u64,
    ) -> Result<Vec<LeaderboardEntry>> {
        let key = format!("leaderboard:{}", board);

        // Get user's rank
        let rank = match self.client.zrevrank(&key, user_id).await? {
            Some(r) => r,
            None => return Ok(vec![]),
        };

        // Get range around user
        let start = rank.saturating_sub(count / 2);
        let end = rank + count / 2;

        let results = self.client.zrevrange_with_scores(&key, start, end).await?;

        Ok(results.into_iter()
            .enumerate()
            .map(|(i, (uid, score))| LeaderboardEntry {
                rank: start + i as u64 + 1,
                user_id: uid,
                score,
            })
            .collect())
    }

    /// Get daily/weekly/monthly leaderboards
    pub async fn get_periodic_top(
        &self,
        board: &str,
        period: &str,
        count: u64,
    ) -> Result<Vec<LeaderboardEntry>> {
        let now = Utc::now();
        let period_key = match period {
            "daily" => now.format("%Y%m%d").to_string(),
            "weekly" => format!("{}-W{}", now.format("%Y"), now.iso_week().week()),
            "monthly" => now.format("%Y%m").to_string(),
            _ => "all".to_string(),
        };

        let key = format!("leaderboard:{}:{}", board, period_key);
        self.get_top(&key, count).await
    }
}
```

### 6. Click-Stream Analysis

```rust
pub struct ClickStream {
    client: FerriteClient,
}

impl ClickStream {
    /// Record page view in user's session
    pub async fn record_page_view(
        &self,
        session_id: &str,
        page: &str,
        referrer: Option<&str>,
    ) -> Result<()> {
        let timestamp = Utc::now().timestamp_millis();

        let event = serde_json::json!({
            "type": "page_view",
            "page": page,
            "referrer": referrer,
            "timestamp": timestamp,
        });

        // Add to session stream
        let stream_key = format!("clickstream:{}", session_id);
        self.client.xadd(
            &stream_key,
            "*",
            &[("event", &event.to_string())],
        ).await?;

        // Set TTL on stream
        self.client.expire(&stream_key, 86400).await?;

        // Update page view counter
        let count_key = format!("pageviews:{}", page);
        self.client.incr(&count_key).await?;

        Ok(())
    }

    /// Get user's journey (all events in session)
    pub async fn get_session_journey(
        &self,
        session_id: &str,
    ) -> Result<Vec<ClickEvent>> {
        let stream_key = format!("clickstream:{}", session_id);

        let entries = self.client.xrange(&stream_key, "-", "+").await?;

        let mut events = Vec::new();
        for entry in entries {
            if let Some(event_json) = entry.fields.get("event") {
                let event: ClickEvent = serde_json::from_str(event_json)?;
                events.push(event);
            }
        }

        Ok(events)
    }

    /// Analyze common paths
    pub async fn analyze_paths(
        &self,
        start_page: &str,
        depth: usize,
    ) -> Result<Vec<PathAnalysis>> {
        // Use Lua script for efficient path analysis
        let script = r#"
            local paths = {}
            local cursor = '0'

            repeat
                local result = redis.call('SCAN', cursor, 'MATCH', 'clickstream:*', 'COUNT', 100)
                cursor = result[1]

                for _, key in ipairs(result[2]) do
                    local events = redis.call('XRANGE', key, '-', '+')
                    local path = {}

                    for _, entry in ipairs(events) do
                        local event = cjson.decode(entry[2][2])
                        if event.type == 'page_view' then
                            table.insert(path, event.page)
                        end
                    end

                    -- Check if path starts with start_page
                    if path[1] == ARGV[1] then
                        local path_key = table.concat(path, ' -> ', 1, math.min(#path, tonumber(ARGV[2])))
                        paths[path_key] = (paths[path_key] or 0) + 1
                    end
                end
            until cursor == '0'

            return cjson.encode(paths)
        "#;

        let result: String = self.client.eval(
            script,
            &[],
            &[start_page, &depth.to_string()],
        ).await?;

        let paths: HashMap<String, u64> = serde_json::from_str(&result)?;

        let mut analysis: Vec<PathAnalysis> = paths.into_iter()
            .map(|(path, count)| PathAnalysis { path, count })
            .collect();

        analysis.sort_by(|a, b| b.count.cmp(&a.count));

        Ok(analysis)
    }
}
```

## Streaming Analytics Pipeline

```rust
pub struct AnalyticsPipeline {
    client: FerriteClient,
    processors: Vec<Box<dyn EventProcessor>>,
}

#[async_trait]
pub trait EventProcessor: Send + Sync {
    async fn process(&self, event: &AnalyticsEvent) -> Result<()>;
}

impl AnalyticsPipeline {
    /// Ingest event into pipeline
    pub async fn ingest(&self, event: AnalyticsEvent) -> Result<()> {
        // Write to main event stream
        let stream_key = "events:main";
        let event_json = serde_json::to_string(&event)?;

        self.client.xadd(
            stream_key,
            "*",
            &[
                ("type", &event.event_type),
                ("data", &event_json),
            ],
        ).await?;

        // Process through all processors
        for processor in &self.processors {
            processor.process(&event).await?;
        }

        Ok(())
    }

    /// Start consumer group for processing
    pub async fn start_consumer(
        &self,
        group: &str,
        consumer: &str,
        handler: impl Fn(AnalyticsEvent) -> Result<()>,
    ) -> Result<()> {
        let stream_key = "events:main";

        // Create consumer group if not exists
        let _ = self.client.xgroup_create(stream_key, group, "0").await;

        loop {
            let entries = self.client.xreadgroup(
                group,
                consumer,
                &[(stream_key, ">")],
                Some(10),
                Some(5000),
            ).await?;

            for entry in entries {
                if let Some(data) = entry.fields.get("data") {
                    let event: AnalyticsEvent = serde_json::from_str(data)?;
                    handler(event)?;

                    // Acknowledge processing
                    self.client.xack(stream_key, group, &[&entry.id]).await?;
                }
            }
        }
    }
}

// Example processors
pub struct CounterProcessor {
    client: FerriteClient,
}

#[async_trait]
impl EventProcessor for CounterProcessor {
    async fn process(&self, event: &AnalyticsEvent) -> Result<()> {
        let key = format!("count:{}", event.event_type);
        self.client.incr(&key).await?;
        Ok(())
    }
}

pub struct UniqueProcessor {
    client: FerriteClient,
}

#[async_trait]
impl EventProcessor for UniqueProcessor {
    async fn process(&self, event: &AnalyticsEvent) -> Result<()> {
        if let Some(user_id) = &event.user_id {
            let key = format!("unique:{}:{}", event.event_type, Utc::now().format("%Y%m%d"));
            self.client.pfadd(&key, user_id).await?;
        }
        Ok(())
    }
}
```

## Dashboard API

```rust
pub struct DashboardService {
    events: EventCounter,
    visitors: UniqueVisitors,
    leaderboard: Leaderboard,
    timeseries: TimeSeriesMetrics,
}

impl DashboardService {
    pub async fn get_overview(&self) -> Result<DashboardOverview> {
        let now = Utc::now();
        let today = now.format("%Y%m%d").to_string();
        let yesterday = (now - Duration::days(1)).format("%Y%m%d").to_string();

        // Parallel queries for dashboard data
        let (
            page_views_today,
            page_views_yesterday,
            unique_today,
            unique_yesterday,
            top_pages,
            active_users,
        ) = tokio::try_join!(
            self.events.get_count("page_view", &format!("day:{}", today)),
            self.events.get_count("page_view", &format!("day:{}", yesterday)),
            self.visitors.count("*", &format!("day:{}", today)),
            self.visitors.count("*", &format!("day:{}", yesterday)),
            self.get_top_pages(10),
            self.get_active_users_5min(),
        )?;

        Ok(DashboardOverview {
            page_views: Metric {
                current: page_views_today,
                previous: page_views_yesterday,
                change_percent: calculate_change(page_views_today, page_views_yesterday),
            },
            unique_visitors: Metric {
                current: unique_today,
                previous: unique_yesterday,
                change_percent: calculate_change(unique_today, unique_yesterday),
            },
            top_pages,
            active_users,
        })
    }

    pub async fn get_realtime_stats(&self) -> Result<RealtimeStats> {
        let now = Utc::now();
        let minute = now.format("%Y%m%d%H%M").to_string();

        // Last 60 minutes of data
        let mut minutes_data = Vec::new();
        for i in 0..60 {
            let m = (now - Duration::minutes(i)).format("%Y%m%d%H%M").to_string();
            let count = self.events.get_count("page_view", &format!("minute:{}", m)).await?;
            minutes_data.push(count);
        }

        Ok(RealtimeStats {
            current_minute: minutes_data[0],
            last_hour: minutes_data.iter().sum(),
            trend: minutes_data,
        })
    }
}

fn calculate_change(current: u64, previous: u64) -> f64 {
    if previous == 0 {
        if current > 0 { 100.0 } else { 0.0 }
    } else {
        ((current as f64 - previous as f64) / previous as f64) * 100.0
    }
}
```

## Best Practices

### 1. Use Appropriate Data Structures

| Use Case | Data Structure | Why |
|----------|---------------|-----|
| Exact counts | Strings + INCR | Precise, atomic |
| Unique counts | HyperLogLog | Memory efficient |
| Rankings | Sorted Sets | O(log N) updates |
| Time-series | TS commands | Built-in aggregation |
| Event logs | Streams | Ordered, replay |

### 2. Choose Right Time Granularity

```rust
// Store at finest needed granularity
// Aggregate in queries
async fn track_with_rollup(&self, event: &str) -> Result<()> {
    let now = Utc::now();

    // Minute-level for real-time (1 hour retention)
    let minute_key = format!("count:{}:m:{}", event, now.format("%Y%m%d%H%M"));
    self.client.incr(&minute_key).await?;
    self.client.expire(&minute_key, 3600).await?;

    // Hour-level for daily analysis (7 days)
    let hour_key = format!("count:{}:h:{}", event, now.format("%Y%m%d%H"));
    self.client.incr(&hour_key).await?;
    self.client.expire(&hour_key, 86400 * 7).await?;

    // Day-level for trends (1 year)
    let day_key = format!("count:{}:d:{}", event, now.format("%Y%m%d"));
    self.client.incr(&day_key).await?;
    self.client.expire(&day_key, 86400 * 365).await?;

    Ok(())
}
```

### 3. Batch Operations for Efficiency

```rust
async fn batch_ingest(&self, events: Vec<AnalyticsEvent>) -> Result<()> {
    let mut pipeline = self.client.pipeline();

    for event in events {
        let key = format!("count:{}", event.event_type);
        pipeline.incr(&key);

        if let Some(user_id) = &event.user_id {
            let hll_key = format!("unique:{}", event.event_type);
            pipeline.pfadd(&hll_key, user_id);
        }
    }

    pipeline.execute().await?;
    Ok(())
}
```

## Related Resources

- [Build Analytics Dashboard Tutorial](/docs/tutorials/build-analytics-dashboard)
- [Time-Series Guide](/docs/data-models/time-series)
- [Streams Guide](/docs/event-driven/streams)
- [HyperLogLog Commands](/docs/reference/commands/hyperloglog)
