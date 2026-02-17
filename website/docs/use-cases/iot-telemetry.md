---
maturity: beta
---

# IoT Telemetry

Ferrite's time-series capabilities, high write throughput, and stream processing make it ideal for collecting, storing, and analyzing IoT sensor data at scale.

## Why Ferrite for IoT?

| Feature | Benefit |
|---------|---------|
| **High write throughput** | Handle millions of sensor readings |
| **Time-series engine** | Native temporal storage and queries |
| **Automatic downsampling** | Reduce storage for historical data |
| **Streams** | Real-time event processing |
| **Pub/Sub** | Device-to-cloud messaging |
| **TTL** | Automatic data retention |

## IoT Telemetry Patterns

### 1. Telemetry Ingestion

```rust
use ferrite::FerriteClient;
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize)]
pub struct TelemetryPoint {
    pub device_id: String,
    pub timestamp: i64,
    pub metrics: HashMap<String, f64>,
    pub tags: HashMap<String, String>,
}

pub struct TelemetryIngester {
    client: FerriteClient,
}

impl TelemetryIngester {
    /// Ingest single telemetry point
    pub async fn ingest(&self, point: &TelemetryPoint) -> Result<()> {
        // Store in time-series for each metric
        for (metric_name, value) in &point.metrics {
            let key = format!(
                "ts:{}:{}",
                point.device_id,
                metric_name
            );

            self.client.timeseries_add(&key, point.timestamp, *value).await?;
        }

        // Update device state
        self.update_device_state(&point.device_id, point).await?;

        // Publish for real-time processing
        self.publish_telemetry(point).await?;

        Ok(())
    }

    /// Batch ingest for efficiency
    pub async fn ingest_batch(&self, points: &[TelemetryPoint]) -> Result<usize> {
        let mut pipeline = self.client.pipeline();

        for point in points {
            for (metric_name, value) in &point.metrics {
                let key = format!("ts:{}:{}", point.device_id, metric_name);
                pipeline.timeseries_add(&key, point.timestamp, *value);
            }
        }

        pipeline.execute().await?;

        // Update device states
        for point in points {
            self.update_device_state(&point.device_id, point).await?;
        }

        Ok(points.len())
    }

    async fn update_device_state(&self, device_id: &str, point: &TelemetryPoint) -> Result<()> {
        let state_key = format!("device:{}:state", device_id);

        // Store latest values
        let mut fields: Vec<(&str, String)> = point.metrics.iter()
            .map(|(k, v)| (k.as_str(), v.to_string()))
            .collect();

        fields.push(("last_seen", point.timestamp.to_string()));

        self.client.hset_multiple(&state_key, &fields).await?;

        // Update device index
        self.client.zadd("devices:active", point.timestamp as f64, device_id).await?;

        Ok(())
    }

    async fn publish_telemetry(&self, point: &TelemetryPoint) -> Result<()> {
        let channel = format!("telemetry:{}", point.device_id);
        let json = serde_json::to_string(point)?;

        self.client.publish(&channel, &json).await?;

        // Also publish to wildcard channel for monitoring
        self.client.publish("telemetry:*", &json).await?;

        Ok(())
    }
}
```

### 2. Device Registry

```rust
#[derive(Serialize, Deserialize)]
pub struct Device {
    pub id: String,
    pub name: String,
    pub device_type: String,
    pub location: Option<Location>,
    pub tags: HashMap<String, String>,
    pub metadata: serde_json::Value,
    pub registered_at: i64,
}

#[derive(Serialize, Deserialize)]
pub struct Location {
    pub latitude: f64,
    pub longitude: f64,
    pub altitude: Option<f64>,
}

pub struct DeviceRegistry {
    client: FerriteClient,
}

impl DeviceRegistry {
    /// Register new device
    pub async fn register(&self, device: &Device) -> Result<()> {
        let key = format!("device:{}", device.id);
        let json = serde_json::to_string(device)?;

        self.client.set(&key, &json).await?;

        // Index by type
        let type_key = format!("devices:type:{}", device.device_type);
        self.client.sadd(&type_key, &device.id).await?;

        // Index by location if provided
        if let Some(ref loc) = device.location {
            self.client.geoadd(
                "devices:geo",
                loc.longitude,
                loc.latitude,
                &device.id,
            ).await?;
        }

        // Index by tags
        for (tag_key, tag_value) in &device.tags {
            let index_key = format!("devices:tag:{}:{}", tag_key, tag_value);
            self.client.sadd(&index_key, &device.id).await?;
        }

        Ok(())
    }

    /// Get device by ID
    pub async fn get(&self, device_id: &str) -> Result<Option<Device>> {
        let key = format!("device:{}", device_id);

        match self.client.get(&key).await? {
            Some(json) => Ok(Some(serde_json::from_str(&json)?)),
            None => Ok(None),
        }
    }

    /// Find devices by type
    pub async fn find_by_type(&self, device_type: &str) -> Result<Vec<Device>> {
        let type_key = format!("devices:type:{}", device_type);
        let device_ids: Vec<String> = self.client.smembers(&type_key).await?;

        self.get_devices(&device_ids).await
    }

    /// Find devices near location
    pub async fn find_near(
        &self,
        latitude: f64,
        longitude: f64,
        radius_km: f64,
    ) -> Result<Vec<(Device, f64)>> {
        let results = self.client.georadius(
            "devices:geo",
            longitude,
            latitude,
            radius_km,
            GeoUnit::Kilometers,
            GeoOptions {
                with_dist: true,
                sort: Some(GeoSort::Asc),
                ..Default::default()
            },
        ).await?;

        let mut devices = Vec::new();
        for result in results {
            if let Some(device) = self.get(&result.member).await? {
                devices.push((device, result.distance.unwrap_or(0.0)));
            }
        }

        Ok(devices)
    }

    /// Get active devices (reported in last N minutes)
    pub async fn get_active(&self, minutes: u64) -> Result<Vec<Device>> {
        let cutoff = chrono::Utc::now().timestamp() - (minutes * 60) as i64;

        let device_ids: Vec<String> = self.client.zrangebyscore(
            "devices:active",
            cutoff as f64,
            f64::INFINITY,
        ).await?;

        self.get_devices(&device_ids).await
    }

    async fn get_devices(&self, device_ids: &[String]) -> Result<Vec<Device>> {
        let mut devices = Vec::new();

        for device_id in device_ids {
            if let Some(device) = self.get(device_id).await? {
                devices.push(device);
            }
        }

        Ok(devices)
    }
}
```

### 3. Real-Time Alerting

```rust
#[derive(Clone)]
pub struct AlertRule {
    pub id: String,
    pub device_pattern: String,  // Glob pattern for device IDs
    pub metric: String,
    pub condition: AlertCondition,
    pub threshold: f64,
    pub duration_seconds: u64,   // Must be true for this duration
    pub severity: AlertSeverity,
    pub notification_channels: Vec<String>,
}

#[derive(Clone)]
pub enum AlertCondition {
    GreaterThan,
    LessThan,
    Equals,
    NotEquals,
    OutOfRange { min: f64, max: f64 },
}

#[derive(Clone)]
pub enum AlertSeverity {
    Info,
    Warning,
    Critical,
}

pub struct AlertEngine {
    client: FerriteClient,
    rules: Vec<AlertRule>,
}

impl AlertEngine {
    /// Process incoming telemetry for alerts
    pub async fn process(&self, point: &TelemetryPoint) -> Result<Vec<Alert>> {
        let mut alerts = Vec::new();

        for rule in &self.rules {
            // Check if device matches pattern
            if !glob_match(&rule.device_pattern, &point.device_id) {
                continue;
            }

            // Check if metric exists
            let value = match point.metrics.get(&rule.metric) {
                Some(v) => *v,
                None => continue,
            };

            // Evaluate condition
            let triggered = match &rule.condition {
                AlertCondition::GreaterThan => value > rule.threshold,
                AlertCondition::LessThan => value < rule.threshold,
                AlertCondition::Equals => (value - rule.threshold).abs() < f64::EPSILON,
                AlertCondition::NotEquals => (value - rule.threshold).abs() >= f64::EPSILON,
                AlertCondition::OutOfRange { min, max } => value < *min || value > *max,
            };

            if triggered {
                // Track in time window
                let state_key = format!("alert:state:{}:{}", rule.id, point.device_id);
                self.client.lpush(&state_key, &point.timestamp.to_string()).await?;
                self.client.ltrim(&state_key, 0, 99).await?;
                self.client.expire(&state_key, rule.duration_seconds * 2).await?;

                // Check if duration threshold met
                if self.check_duration(&state_key, rule.duration_seconds, point.timestamp).await? {
                    // Check if not already alerted
                    let alert_key = format!("alert:active:{}:{}", rule.id, point.device_id);
                    let already_alerted = self.client.exists(&alert_key).await? > 0;

                    if !already_alerted {
                        let alert = Alert {
                            id: uuid::Uuid::new_v4().to_string(),
                            rule_id: rule.id.clone(),
                            device_id: point.device_id.clone(),
                            metric: rule.metric.clone(),
                            value,
                            threshold: rule.threshold,
                            severity: rule.severity.clone(),
                            timestamp: point.timestamp,
                        };

                        // Mark as active
                        self.client.set_ex(&alert_key, &alert.id, rule.duration_seconds * 2).await?;

                        // Store alert
                        self.store_alert(&alert).await?;

                        // Send notifications
                        self.notify(&alert, &rule.notification_channels).await?;

                        alerts.push(alert);
                    }
                }
            } else {
                // Clear alert state if condition no longer true
                let alert_key = format!("alert:active:{}:{}", rule.id, point.device_id);
                self.client.del(&alert_key).await?;
            }
        }

        Ok(alerts)
    }

    async fn check_duration(&self, key: &str, duration_secs: u64, current: i64) -> Result<bool> {
        let timestamps: Vec<String> = self.client.lrange(key, 0, -1).await?;

        if timestamps.is_empty() {
            return Ok(false);
        }

        // Check if all timestamps within duration window
        let oldest: i64 = timestamps.last()
            .and_then(|t| t.parse().ok())
            .unwrap_or(current);

        let duration_ms = duration_secs * 1000;
        Ok((current - oldest) >= duration_ms as i64)
    }

    async fn store_alert(&self, alert: &Alert) -> Result<()> {
        let json = serde_json::to_string(alert)?;

        // Store in stream
        self.client.xadd(
            "alerts:stream",
            "*",
            &[("data", &json)],
        ).await?;

        // Store in device alert history
        let device_key = format!("alerts:device:{}", alert.device_id);
        self.client.lpush(&device_key, &json).await?;
        self.client.ltrim(&device_key, 0, 999).await?;  // Keep last 1000

        Ok(())
    }

    async fn notify(&self, alert: &Alert, channels: &[String]) -> Result<()> {
        let json = serde_json::to_string(alert)?;

        for channel in channels {
            self.client.publish(channel, &json).await?;
        }

        Ok(())
    }
}

pub struct Alert {
    pub id: String,
    pub rule_id: String,
    pub device_id: String,
    pub metric: String,
    pub value: f64,
    pub threshold: f64,
    pub severity: AlertSeverity,
    pub timestamp: i64,
}
```

### 4. Aggregation and Downsampling

```rust
pub struct TelemetryAggregator {
    client: FerriteClient,
}

impl TelemetryAggregator {
    /// Aggregate raw telemetry into coarser time buckets
    pub async fn aggregate(
        &self,
        device_id: &str,
        metric: &str,
        from: i64,
        to: i64,
        bucket_ms: u64,
    ) -> Result<Vec<AggregatedPoint>> {
        let key = format!("ts:{}:{}", device_id, metric);

        let aggregations = self.client.timeseries_aggregate(
            &key,
            from,
            to,
            &[
                ("avg", Aggregation::Avg),
                ("min", Aggregation::Min),
                ("max", Aggregation::Max),
                ("count", Aggregation::Count),
            ],
            bucket_ms,
        ).await?;

        Ok(aggregations)
    }

    /// Run periodic downsampling job
    pub async fn downsample(&self, device_id: &str, metric: &str) -> Result<()> {
        let raw_key = format!("ts:{}:{}", device_id, metric);
        let hourly_key = format!("ts:{}:{}:hourly", device_id, metric);
        let daily_key = format!("ts:{}:{}:daily", device_id, metric);

        // Downsample to hourly (data older than 24 hours)
        let yesterday = chrono::Utc::now().timestamp_millis() - 86400000;
        let week_ago = chrono::Utc::now().timestamp_millis() - 604800000;

        // Aggregate last 24h to hourly
        let hourly = self.client.timeseries_aggregate(
            &raw_key,
            week_ago,
            yesterday,
            &[
                ("avg", Aggregation::Avg),
                ("min", Aggregation::Min),
                ("max", Aggregation::Max),
            ],
            3600000, // 1 hour
        ).await?;

        // Store hourly aggregates
        for point in hourly {
            self.client.timeseries_add(
                &hourly_key,
                point.timestamp,
                point.values["avg"],
            ).await?;
        }

        // Aggregate hourly to daily (data older than 7 days)
        let daily = self.client.timeseries_aggregate(
            &hourly_key,
            0,
            week_ago,
            &[
                ("avg", Aggregation::Avg),
                ("min", Aggregation::Min),
                ("max", Aggregation::Max),
            ],
            86400000, // 1 day
        ).await?;

        // Store daily aggregates
        for point in daily {
            self.client.timeseries_add(
                &daily_key,
                point.timestamp,
                point.values["avg"],
            ).await?;
        }

        // Delete old raw data
        self.client.timeseries_trim(&raw_key, yesterday).await?;

        // Delete old hourly data
        self.client.timeseries_trim(&hourly_key, week_ago).await?;

        Ok(())
    }

    /// Query at appropriate resolution
    pub async fn query_auto_resolution(
        &self,
        device_id: &str,
        metric: &str,
        from: i64,
        to: i64,
    ) -> Result<Vec<DataPoint>> {
        let duration = to - from;

        let key = if duration > 604800000 {
            // > 7 days: use daily
            format!("ts:{}:{}:daily", device_id, metric)
        } else if duration > 86400000 {
            // > 1 day: use hourly
            format!("ts:{}:{}:hourly", device_id, metric)
        } else {
            // Use raw
            format!("ts:{}:{}", device_id, metric)
        };

        self.client.timeseries_range(&key, from, to).await
    }
}

pub struct AggregatedPoint {
    pub timestamp: i64,
    pub values: HashMap<String, f64>,
}
```

### 5. Device Commands

```rust
pub struct DeviceCommands {
    client: FerriteClient,
}

impl DeviceCommands {
    /// Send command to device
    pub async fn send(
        &self,
        device_id: &str,
        command: &DeviceCommand,
    ) -> Result<String> {
        let command_id = uuid::Uuid::new_v4().to_string();

        let wrapper = CommandWrapper {
            id: command_id.clone(),
            device_id: device_id.to_string(),
            command: command.clone(),
            created_at: chrono::Utc::now().timestamp_millis(),
            status: CommandStatus::Pending,
        };

        let json = serde_json::to_string(&wrapper)?;

        // Store command
        let key = format!("command:{}", command_id);
        self.client.set_ex(&key, &json, 3600).await?;  // 1 hour TTL

        // Queue for device
        let queue_key = format!("commands:device:{}", device_id);
        self.client.rpush(&queue_key, &command_id).await?;

        // Publish notification
        let channel = format!("device:{}:commands", device_id);
        self.client.publish(&channel, &command_id).await?;

        Ok(command_id)
    }

    /// Device polls for commands
    pub async fn poll(&self, device_id: &str) -> Result<Option<CommandWrapper>> {
        let queue_key = format!("commands:device:{}", device_id);

        // Get next command (non-blocking)
        let command_id: Option<String> = self.client.lpop(&queue_key).await?;

        if let Some(id) = command_id {
            let key = format!("command:{}", id);
            if let Some(json) = self.client.get(&key).await? {
                return Ok(Some(serde_json::from_str(&json)?));
            }
        }

        Ok(None)
    }

    /// Device long-polls for commands
    pub async fn long_poll(
        &self,
        device_id: &str,
        timeout_secs: u64,
    ) -> Result<Option<CommandWrapper>> {
        let queue_key = format!("commands:device:{}", device_id);

        let result = self.client.blpop(&[&queue_key], timeout_secs).await?;

        if let Some((_, command_id)) = result {
            let key = format!("command:{}", command_id);
            if let Some(json) = self.client.get(&key).await? {
                return Ok(Some(serde_json::from_str(&json)?));
            }
        }

        Ok(None)
    }

    /// Update command status (device acknowledgment)
    pub async fn acknowledge(
        &self,
        command_id: &str,
        status: CommandStatus,
        result: Option<serde_json::Value>,
    ) -> Result<()> {
        let key = format!("command:{}", command_id);

        if let Some(json) = self.client.get(&key).await? {
            let mut wrapper: CommandWrapper = serde_json::from_str(&json)?;
            wrapper.status = status;
            wrapper.result = result;
            wrapper.completed_at = Some(chrono::Utc::now().timestamp_millis());

            let updated = serde_json::to_string(&wrapper)?;
            self.client.set(&key, &updated).await?;

            // Publish completion notification
            let channel = format!("command:{}:status", command_id);
            self.client.publish(&channel, &wrapper.status.to_string()).await?;
        }

        Ok(())
    }

    /// Wait for command completion
    pub async fn wait_completion(
        &self,
        command_id: &str,
        timeout_secs: u64,
    ) -> Result<CommandWrapper> {
        let channel = format!("command:{}:status", command_id);
        let mut subscriber = self.client.subscribe(&channel).await?;

        // Check if already completed
        let key = format!("command:{}", command_id);
        if let Some(json) = self.client.get(&key).await? {
            let wrapper: CommandWrapper = serde_json::from_str(&json)?;
            if wrapper.status != CommandStatus::Pending {
                return Ok(wrapper);
            }
        }

        // Wait for status update
        let timeout = tokio::time::timeout(
            Duration::from_secs(timeout_secs),
            subscriber.next(),
        ).await;

        // Get final state
        if let Some(json) = self.client.get(&key).await? {
            return Ok(serde_json::from_str(&json)?);
        }

        Err(anyhow::anyhow!("Command not found"))
    }
}

#[derive(Serialize, Deserialize, Clone)]
pub struct DeviceCommand {
    pub action: String,
    pub parameters: serde_json::Value,
}

#[derive(Serialize, Deserialize)]
pub struct CommandWrapper {
    pub id: String,
    pub device_id: String,
    pub command: DeviceCommand,
    pub created_at: i64,
    pub completed_at: Option<i64>,
    pub status: CommandStatus,
    pub result: Option<serde_json::Value>,
}

#[derive(Serialize, Deserialize, PartialEq)]
pub enum CommandStatus {
    Pending,
    Delivered,
    Executing,
    Completed,
    Failed,
}
```

### 6. Fleet Analytics

```rust
pub struct FleetAnalytics {
    client: FerriteClient,
}

impl FleetAnalytics {
    /// Get fleet overview statistics
    pub async fn get_overview(&self) -> Result<FleetOverview> {
        let now = chrono::Utc::now().timestamp_millis();
        let hour_ago = now - 3600000;
        let day_ago = now - 86400000;

        // Count devices by status
        let total: u64 = self.client.zcard("devices:active").await?;
        let active_1h: u64 = self.client.zcount("devices:active", hour_ago as f64, now as f64).await?;
        let active_24h: u64 = self.client.zcount("devices:active", day_ago as f64, now as f64).await?;

        // Count active alerts
        let alerts: u64 = self.client.xlen("alerts:stream").await?;

        Ok(FleetOverview {
            total_devices: total,
            active_last_hour: active_1h,
            active_last_day: active_24h,
            inactive: total - active_24h,
            active_alerts: alerts,
        })
    }

    /// Get aggregated metrics across fleet
    pub async fn get_fleet_metrics(
        &self,
        metric: &str,
        from: i64,
        to: i64,
    ) -> Result<FleetMetrics> {
        // Get all device IDs
        let device_ids: Vec<String> = self.client.zrange("devices:active", 0, -1).await?;

        let mut values = Vec::new();

        for device_id in &device_ids {
            let key = format!("ts:{}:{}", device_id, metric);

            // Get latest value
            if let Some(point) = self.client.timeseries_get(&key).await? {
                values.push(point.value);
            }
        }

        if values.is_empty() {
            return Ok(FleetMetrics::default());
        }

        values.sort_by(|a, b| a.partial_cmp(b).unwrap());

        Ok(FleetMetrics {
            device_count: values.len(),
            avg: values.iter().sum::<f64>() / values.len() as f64,
            min: *values.first().unwrap(),
            max: *values.last().unwrap(),
            p50: values[values.len() / 2],
            p90: values[(values.len() as f64 * 0.9) as usize],
            p99: values[(values.len() as f64 * 0.99) as usize],
        })
    }

    /// Find devices with anomalous readings
    pub async fn find_anomalies(
        &self,
        metric: &str,
        threshold_stddev: f64,
    ) -> Result<Vec<Anomaly>> {
        let fleet_metrics = self.get_fleet_metrics(metric, 0, i64::MAX).await?;

        // Calculate standard deviation
        let device_ids: Vec<String> = self.client.zrange("devices:active", 0, -1).await?;
        let mut values = Vec::new();

        for device_id in &device_ids {
            let key = format!("ts:{}:{}", device_id, metric);
            if let Some(point) = self.client.timeseries_get(&key).await? {
                values.push((device_id.clone(), point.value));
            }
        }

        let mean = fleet_metrics.avg;
        let variance: f64 = values.iter()
            .map(|(_, v)| (v - mean).powi(2))
            .sum::<f64>() / values.len() as f64;
        let stddev = variance.sqrt();

        // Find anomalies
        let mut anomalies = Vec::new();
        for (device_id, value) in values {
            let z_score = (value - mean) / stddev;
            if z_score.abs() > threshold_stddev {
                anomalies.push(Anomaly {
                    device_id,
                    metric: metric.to_string(),
                    value,
                    z_score,
                    expected_range: (mean - stddev * threshold_stddev, mean + stddev * threshold_stddev),
                });
            }
        }

        Ok(anomalies)
    }
}

pub struct FleetOverview {
    pub total_devices: u64,
    pub active_last_hour: u64,
    pub active_last_day: u64,
    pub inactive: u64,
    pub active_alerts: u64,
}

pub struct FleetMetrics {
    pub device_count: usize,
    pub avg: f64,
    pub min: f64,
    pub max: f64,
    pub p50: f64,
    pub p90: f64,
    pub p99: f64,
}

pub struct Anomaly {
    pub device_id: String,
    pub metric: String,
    pub value: f64,
    pub z_score: f64,
    pub expected_range: (f64, f64),
}
```

## API Example

```rust
use axum::{Router, routing::{get, post}};

pub fn iot_routes(state: AppState) -> Router {
    Router::new()
        .route("/telemetry", post(ingest_telemetry))
        .route("/telemetry/:device_id/:metric", get(query_telemetry))
        .route("/devices", get(list_devices))
        .route("/devices/:id", get(get_device))
        .route("/devices/:id/commands", post(send_command))
        .route("/devices/:id/commands/poll", get(poll_commands))
        .route("/alerts", get(list_alerts))
        .route("/fleet/overview", get(fleet_overview))
        .with_state(state)
}
```

## Best Practices

### 1. Optimize Ingestion

```rust
// Batch writes for efficiency
async fn batch_ingest(points: Vec<TelemetryPoint>) -> Result<()> {
    const BATCH_SIZE: usize = 1000;

    for chunk in points.chunks(BATCH_SIZE) {
        ingester.ingest_batch(chunk).await?;
    }

    Ok(())
}
```

### 2. Set Appropriate Retention

```rust
// Configure retention per metric type
let retention_policies = HashMap::from([
    ("temperature", 86400 * 30),      // 30 days raw
    ("error_count", 86400 * 90),      // 90 days
    ("heartbeat", 86400 * 7),         // 7 days
]);
```

### 3. Use Compression

```rust
// Enable compression for time-series
client.timeseries_create(
    &key,
    TimeSeriesOptions {
        retention_ms: 86400000 * 30,
        chunk_size: 4096,
        duplicate_policy: DuplicatePolicy::Last,
        encoding: Encoding::Compressed,
        ..Default::default()
    }
).await?;
```

## Related Resources

- [Time-Series Guide](/docs/data-models/time-series)
- [Streams for Event Processing](/docs/event-driven/streams)
- [Real-Time Analytics Use Case](/docs/use-cases/real-time-analytics)
- [Geospatial for Device Location](/docs/use-cases/geospatial)
