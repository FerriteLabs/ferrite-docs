---
sidebar_position: 8
maturity: experimental
---

# Build a Real-Time Analytics Dashboard

Learn how to build a real-time analytics system using Ferrite's time-series capabilities and HyperLogLog for cardinality estimation.

## What You'll Build

A complete analytics system with:
- Real-time event ingestion
- Time-series aggregations
- Unique visitor counting (HyperLogLog)
- Live dashboards via Pub/Sub
- Retention policies

## Prerequisites

- Ferrite server running
- Basic understanding of analytics concepts

## Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────────────────┐
│   Events    │────▶│  Ingestion  │────▶│        Ferrite          │
│   (HTTP)    │     │   Service   │     │  ┌─────────────────┐    │
└─────────────┘     └─────────────┘     │  │  Time-Series    │    │
                                        │  └─────────────────┘    │
┌─────────────┐     ┌─────────────┐     │  ┌─────────────────┐    │
│  Dashboard  │◀────│    Query    │◀────│  │  HyperLogLog    │    │
│   (React)   │     │   Service   │     │  └─────────────────┘    │
└─────────────┘     └─────────────┘     │  ┌─────────────────┐    │
                                        │  │   Pub/Sub       │    │
                                        │  └─────────────────┘    │
                                        └─────────────────────────┘
```

## Step 1: Project Setup

```toml
# Cargo.toml
[dependencies]
ferrite-client = "0.1"
tokio = { version = "1", features = ["full"] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
chrono = { version = "0.4", features = ["serde"] }
axum = "0.6"
```

## Step 2: Define Event Models

```rust
// src/models.rs
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PageViewEvent {
    pub page_url: String,
    pub user_id: Option<String>,
    pub session_id: String,
    pub referrer: Option<String>,
    pub user_agent: String,
    pub country: Option<String>,
    pub device_type: String,
    pub timestamp: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CustomEvent {
    pub event_name: String,
    pub user_id: Option<String>,
    pub session_id: String,
    pub properties: serde_json::Value,
    pub timestamp: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DashboardMetrics {
    pub page_views: u64,
    pub unique_visitors: u64,
    pub unique_sessions: u64,
    pub top_pages: Vec<(String, u64)>,
    pub top_referrers: Vec<(String, u64)>,
    pub devices: DeviceBreakdown,
    pub countries: Vec<(String, u64)>,
    pub real_time_users: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeviceBreakdown {
    pub desktop: u64,
    pub mobile: u64,
    pub tablet: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TimeSeriesPoint {
    pub timestamp: DateTime<Utc>,
    pub value: f64,
}
```

## Step 3: Analytics Ingestion Service

```rust
// src/ingestion.rs
use crate::models::*;
use ferrite_client::Client;
use chrono::{Datelike, Timelike, Utc};

pub struct IngestionService {
    client: Client,
}

impl IngestionService {
    pub async fn new(addr: &str) -> Result<Self, Box<dyn std::error::Error>> {
        let client = Client::connect(addr).await?;
        Ok(Self { client })
    }

    pub async fn track_page_view(&self, event: &PageViewEvent) -> Result<(), Box<dyn std::error::Error>> {
        let now = Utc::now();
        let date_key = now.format("%Y-%m-%d").to_string();
        let hour_key = format!("{}:{:02}", date_key, now.hour());
        let minute_key = format!("{}:{:02}", hour_key, now.minute());

        // Pipeline for efficiency
        let mut pipe = self.client.pipeline();

        // 1. Time-series: Page views per minute
        pipe.timeseries_add(
            &format!("ts:pageviews:{}", date_key),
            event.timestamp.timestamp_millis(),
            1.0,
            json!({"page": &event.page_url}),
        );

        // 2. Increment counters
        pipe.incr(&format!("count:pageviews:{}", date_key));
        pipe.incr(&format!("count:pageviews:{}", hour_key));
        pipe.incr(&format!("count:pageviews:{}", minute_key));

        // 3. Page-specific counters
        let page_key = self.sanitize_key(&event.page_url);
        pipe.zincrby(&format!("pages:{}", date_key), 1.0, &page_key);

        // 4. HyperLogLog for unique visitors
        if let Some(ref user_id) = event.user_id {
            pipe.pfadd(&format!("hll:visitors:{}", date_key), &[user_id]);
        }
        pipe.pfadd(&format!("hll:sessions:{}", date_key), &[&event.session_id]);

        // 5. Real-time active users (5-minute window)
        let real_time_key = format!("active:{}:{}", date_key, now.minute() / 5);
        pipe.sadd(&real_time_key, &[&event.session_id]);
        pipe.expire(&real_time_key, 300); // 5 minute TTL

        // 6. Device breakdown
        pipe.hincrby(&format!("devices:{}", date_key), &event.device_type, 1);

        // 7. Referrer tracking
        if let Some(ref referrer) = event.referrer {
            let referrer_domain = self.extract_domain(referrer);
            pipe.zincrby(&format!("referrers:{}", date_key), 1.0, &referrer_domain);
        }

        // 8. Country tracking
        if let Some(ref country) = event.country {
            pipe.zincrby(&format!("countries:{}", date_key), 1.0, country);
        }

        // Execute pipeline
        pipe.execute().await?;

        // Publish for real-time dashboard updates
        self.client.publish(
            "analytics:realtime",
            &serde_json::to_string(&json!({
                "type": "pageview",
                "page": event.page_url,
                "timestamp": event.timestamp
            }))?,
        ).await?;

        Ok(())
    }

    pub async fn track_custom_event(&self, event: &CustomEvent) -> Result<(), Box<dyn std::error::Error>> {
        let date_key = event.timestamp.format("%Y-%m-%d").to_string();

        // Store in time-series
        self.client.timeseries_add(
            &format!("ts:events:{}:{}", event.event_name, date_key),
            event.timestamp.timestamp_millis(),
            1.0,
            event.properties.clone(),
        ).await?;

        // Increment event counter
        self.client.hincrby(
            &format!("events:{}", date_key),
            &event.event_name,
            1,
        ).await?;

        // User funnel tracking
        if let Some(ref user_id) = event.user_id {
            self.client.zadd(
                &format!("funnel:{}:{}", event.event_name, date_key),
                &[(event.timestamp.timestamp_millis() as f64, user_id.as_str())],
            ).await?;
        }

        Ok(())
    }

    fn sanitize_key(&self, url: &str) -> String {
        url.replace(":", "_")
           .replace("/", "_")
           .chars()
           .take(100)
           .collect()
    }

    fn extract_domain(&self, url: &str) -> String {
        url.split("//")
           .nth(1)
           .and_then(|s| s.split('/').next())
           .unwrap_or("direct")
           .to_string()
    }
}
```

## Step 4: Analytics Query Service

```rust
// src/query.rs
use crate::models::*;
use ferrite_client::Client;
use chrono::{Duration, Utc};

pub struct QueryService {
    client: Client,
}

impl QueryService {
    pub async fn new(addr: &str) -> Result<Self, Box<dyn std::error::Error>> {
        let client = Client::connect(addr).await?;
        Ok(Self { client })
    }

    pub async fn get_dashboard_metrics(&self, date: &str) -> Result<DashboardMetrics, Box<dyn std::error::Error>> {
        // Use pipeline for parallel queries
        let mut pipe = self.client.pipeline();

        pipe.get(&format!("count:pageviews:{}", date));
        pipe.pfcount(&[&format!("hll:visitors:{}", date)]);
        pipe.pfcount(&[&format!("hll:sessions:{}", date)]);
        pipe.zrevrange_withscores(&format!("pages:{}", date), 0, 9);
        pipe.zrevrange_withscores(&format!("referrers:{}", date), 0, 9);
        pipe.hgetall(&format!("devices:{}", date));
        pipe.zrevrange_withscores(&format!("countries:{}", date), 0, 9);

        let results = pipe.execute().await?;

        // Parse results
        let page_views: u64 = results.get(0)
            .and_then(|v| v.as_str())
            .and_then(|s| s.parse().ok())
            .unwrap_or(0);

        let unique_visitors: u64 = results.get(1)
            .and_then(|v| v.as_u64())
            .unwrap_or(0);

        let unique_sessions: u64 = results.get(2)
            .and_then(|v| v.as_u64())
            .unwrap_or(0);

        let top_pages: Vec<(String, u64)> = self.parse_zset_result(&results.get(3));
        let top_referrers: Vec<(String, u64)> = self.parse_zset_result(&results.get(4));
        let devices = self.parse_device_breakdown(&results.get(5));
        let countries: Vec<(String, u64)> = self.parse_zset_result(&results.get(6));

        // Get real-time users
        let real_time_users = self.get_real_time_users().await?;

        Ok(DashboardMetrics {
            page_views,
            unique_visitors,
            unique_sessions,
            top_pages,
            top_referrers,
            devices,
            countries,
            real_time_users,
        })
    }

    pub async fn get_time_series(
        &self,
        metric: &str,
        from: i64,
        to: i64,
        aggregation: &str,
        bucket_size_ms: i64,
    ) -> Result<Vec<TimeSeriesPoint>, Box<dyn std::error::Error>> {
        let results = self.client.timeseries_range(
            metric,
            from,
            to,
            json!({
                "aggregation": aggregation,
                "bucket_size_ms": bucket_size_ms
            }),
        ).await?;

        let points: Vec<TimeSeriesPoint> = results
            .iter()
            .map(|(ts, value)| TimeSeriesPoint {
                timestamp: chrono::DateTime::from_timestamp_millis(*ts).unwrap(),
                value: *value,
            })
            .collect();

        Ok(points)
    }

    pub async fn get_page_views_over_time(
        &self,
        date: &str,
        interval_minutes: u64,
    ) -> Result<Vec<TimeSeriesPoint>, Box<dyn std::error::Error>> {
        let key = format!("ts:pageviews:{}", date);

        let from = chrono::NaiveDate::parse_from_str(date, "%Y-%m-%d")?
            .and_hms_opt(0, 0, 0)
            .unwrap()
            .and_utc()
            .timestamp_millis();

        let to = from + 86400000; // +1 day

        self.get_time_series(
            &key,
            from,
            to,
            "sum",
            interval_minutes as i64 * 60 * 1000,
        ).await
    }

    async fn get_real_time_users(&self) -> Result<u64, Box<dyn std::error::Error>> {
        let now = Utc::now();
        let date_key = now.format("%Y-%m-%d").to_string();
        let current_bucket = now.minute() / 5;

        // Get users from current and previous bucket
        let mut total = 0u64;
        for offset in 0..=1 {
            let bucket = if current_bucket >= offset {
                current_bucket - offset
            } else {
                11 // Wrap around
            };
            let key = format!("active:{}:{}", date_key, bucket);
            let count: u64 = self.client.scard(&key).await.unwrap_or(0);
            total += count;
        }

        Ok(total)
    }

    pub async fn get_funnel_analysis(
        &self,
        steps: &[&str],
        date: &str,
    ) -> Result<Vec<(String, u64)>, Box<dyn std::error::Error>> {
        let mut results = Vec::new();

        for step in steps {
            let key = format!("funnel:{}:{}", step, date);
            let count: u64 = self.client.zcard(&key).await.unwrap_or(0);
            results.push((step.to_string(), count));
        }

        Ok(results)
    }

    fn parse_zset_result(&self, value: &Option<&serde_json::Value>) -> Vec<(String, u64)> {
        value
            .and_then(|v| v.as_array())
            .map(|arr| {
                arr.chunks(2)
                    .filter_map(|chunk| {
                        let member = chunk.get(0)?.as_str()?;
                        let score = chunk.get(1)?.as_f64()? as u64;
                        Some((member.to_string(), score))
                    })
                    .collect()
            })
            .unwrap_or_default()
    }

    fn parse_device_breakdown(&self, value: &Option<&serde_json::Value>) -> DeviceBreakdown {
        let map: std::collections::HashMap<String, u64> = value
            .and_then(|v| serde_json::from_value(v.clone()).ok())
            .unwrap_or_default();

        DeviceBreakdown {
            desktop: *map.get("desktop").unwrap_or(&0),
            mobile: *map.get("mobile").unwrap_or(&0),
            tablet: *map.get("tablet").unwrap_or(&0),
        }
    }
}
```

## Step 5: Real-Time Dashboard Updates

```rust
// src/realtime.rs
use ferrite_client::Client;
use tokio::sync::mpsc;

pub struct RealtimeService {
    client: Client,
}

impl RealtimeService {
    pub async fn new(addr: &str) -> Result<Self, Box<dyn std::error::Error>> {
        let client = Client::connect(addr).await?;
        Ok(Self { client })
    }

    pub async fn subscribe_to_updates(
        &self,
        tx: mpsc::Sender<serde_json::Value>,
    ) -> Result<(), Box<dyn std::error::Error>> {
        let mut pubsub = self.client
            .subscribe(&["analytics:realtime"])
            .await?;

        tokio::spawn(async move {
            while let Some(msg) = pubsub.next().await {
                if let Ok(event) = serde_json::from_str::<serde_json::Value>(&msg.payload) {
                    if tx.send(event).await.is_err() {
                        break;
                    }
                }
            }
        });

        Ok(())
    }
}
```

## Step 6: API Server

```rust
// src/api.rs
use axum::{
    extract::{Extension, Path, Query, ws::{WebSocket, WebSocketUpgrade}},
    response::{Json, IntoResponse},
    routing::{get, post},
    Router,
};
use std::sync::Arc;

pub fn create_router(
    ingestion: Arc<IngestionService>,
    query: Arc<QueryService>,
    realtime: Arc<RealtimeService>,
) -> Router {
    Router::new()
        .route("/track/pageview", post(track_pageview))
        .route("/track/event", post(track_event))
        .route("/dashboard/:date", get(get_dashboard))
        .route("/timeseries/:metric", get(get_timeseries))
        .route("/funnel", get(get_funnel))
        .route("/ws", get(websocket_handler))
        .layer(Extension(ingestion))
        .layer(Extension(query))
        .layer(Extension(realtime))
}

async fn track_pageview(
    Extension(ingestion): Extension<Arc<IngestionService>>,
    Json(event): Json<PageViewEvent>,
) -> impl IntoResponse {
    match ingestion.track_page_view(&event).await {
        Ok(_) => Json(json!({"status": "ok"})),
        Err(e) => Json(json!({"error": e.to_string()})),
    }
}

async fn track_event(
    Extension(ingestion): Extension<Arc<IngestionService>>,
    Json(event): Json<CustomEvent>,
) -> impl IntoResponse {
    match ingestion.track_custom_event(&event).await {
        Ok(_) => Json(json!({"status": "ok"})),
        Err(e) => Json(json!({"error": e.to_string()})),
    }
}

async fn get_dashboard(
    Extension(query): Extension<Arc<QueryService>>,
    Path(date): Path<String>,
) -> impl IntoResponse {
    match query.get_dashboard_metrics(&date).await {
        Ok(metrics) => Json(serde_json::to_value(metrics).unwrap()),
        Err(e) => Json(json!({"error": e.to_string()})),
    }
}

#[derive(Deserialize)]
struct TimeseriesQuery {
    from: i64,
    to: i64,
    aggregation: Option<String>,
    bucket_size: Option<i64>,
}

async fn get_timeseries(
    Extension(query): Extension<Arc<QueryService>>,
    Path(metric): Path<String>,
    Query(params): Query<TimeseriesQuery>,
) -> impl IntoResponse {
    match query.get_time_series(
        &metric,
        params.from,
        params.to,
        params.aggregation.as_deref().unwrap_or("sum"),
        params.bucket_size.unwrap_or(60000),
    ).await {
        Ok(points) => Json(serde_json::to_value(points).unwrap()),
        Err(e) => Json(json!({"error": e.to_string()})),
    }
}

async fn websocket_handler(
    Extension(realtime): Extension<Arc<RealtimeService>>,
    ws: WebSocketUpgrade,
) -> impl IntoResponse {
    ws.on_upgrade(|socket| handle_socket(socket, realtime))
}

async fn handle_socket(mut socket: WebSocket, realtime: Arc<RealtimeService>) {
    let (tx, mut rx) = tokio::sync::mpsc::channel(100);

    if let Ok(_) = realtime.subscribe_to_updates(tx).await {
        while let Some(event) = rx.recv().await {
            if socket.send(axum::extract::ws::Message::Text(
                serde_json::to_string(&event).unwrap()
            )).await.is_err() {
                break;
            }
        }
    }
}
```

## Step 7: Retention and Aggregation

```rust
// src/retention.rs
use ferrite_client::Client;
use chrono::{Duration, Utc};

pub struct RetentionService {
    client: Client,
}

impl RetentionService {
    pub async fn run_daily_aggregation(&self) -> Result<(), Box<dyn std::error::Error>> {
        let yesterday = (Utc::now() - Duration::days(1)).format("%Y-%m-%d").to_string();
        let week = Utc::now().format("%Y-W%W").to_string();
        let month = Utc::now().format("%Y-%m").to_string();

        // Aggregate daily to weekly
        let daily_views: u64 = self.client
            .get(&format!("count:pageviews:{}", yesterday))
            .await?
            .unwrap_or(0);

        self.client.incrby(&format!("count:pageviews:weekly:{}", week), daily_views as i64).await?;

        // Merge HyperLogLogs
        self.client.pfmerge(
            &format!("hll:visitors:weekly:{}", week),
            &[&format!("hll:visitors:{}", yesterday)],
        ).await?;

        // Aggregate to monthly
        self.client.incrby(&format!("count:pageviews:monthly:{}", month), daily_views as i64).await?;

        Ok(())
    }

    pub async fn cleanup_old_data(&self, retention_days: i64) -> Result<(), Box<dyn std::error::Error>> {
        let cutoff = (Utc::now() - Duration::days(retention_days)).format("%Y-%m-%d").to_string();

        // Find and delete old keys
        let keys: Vec<String> = self.client
            .scan_match("count:pageviews:202*")
            .await?;

        for key in keys {
            if key < format!("count:pageviews:{}", cutoff) {
                self.client.del(&[&key]).await?;
            }
        }

        Ok(())
    }
}
```

## Usage

### Track Page View

```bash
curl -X POST http://localhost:3000/track/pageview \
  -H "Content-Type: application/json" \
  -d '{
    "page_url": "/products/123",
    "user_id": "user-456",
    "session_id": "sess-789",
    "referrer": "https://google.com",
    "user_agent": "Mozilla/5.0...",
    "device_type": "desktop",
    "country": "US",
    "timestamp": "2024-01-15T10:30:00Z"
  }'
```

### Get Dashboard

```bash
curl http://localhost:3000/dashboard/2024-01-15
```

### Real-Time Updates

Connect via WebSocket to `/ws` for live updates.

## Related Resources

- [Time-Series Commands](/docs/reference/commands/timeseries) - Time-series operations
- [HyperLogLog Commands](/docs/reference/commands/hyperloglog) - Cardinality estimation
- [Pub/Sub Commands](/docs/reference/commands/pubsub) - Real-time updates
