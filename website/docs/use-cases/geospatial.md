---
maturity: beta
---

# Geospatial Applications

Ferrite's geospatial capabilities enable building location-aware applications with efficient spatial queries, radius searches, and distance calculations.

## Why Ferrite for Geospatial?

| Feature | Benefit |
|---------|---------|
| **Geohash indexing** | Efficient spatial partitioning |
| **Radius queries** | Find items within distance |
| **Distance calculation** | Haversine formula built-in |
| **Sorted by distance** | Results ordered by proximity |
| **Geo + attributes** | Combine with hash data |
| **Real-time updates** | Track moving objects |

## Geospatial Patterns

### 1. Location Store

```rust
use ferrite::FerriteClient;

#[derive(Clone)]
pub struct Location {
    pub id: String,
    pub latitude: f64,
    pub longitude: f64,
    pub name: String,
    pub category: String,
}

pub struct LocationStore {
    client: FerriteClient,
    key: String,
}

impl LocationStore {
    pub fn new(client: FerriteClient, name: &str) -> Self {
        Self {
            client,
            key: format!("geo:{}", name),
        }
    }

    /// Add location
    pub async fn add(&self, location: &Location) -> Result<()> {
        // Add to geo index
        self.client.geoadd(
            &self.key,
            location.longitude,
            location.latitude,
            &location.id,
        ).await?;

        // Store metadata in hash
        let meta_key = format!("location:{}", location.id);
        self.client.hset_multiple(&meta_key, &[
            ("name", &location.name),
            ("category", &location.category),
            ("lat", &location.latitude.to_string()),
            ("lon", &location.longitude.to_string()),
        ]).await?;

        Ok(())
    }

    /// Update location (for moving objects)
    pub async fn update_position(
        &self,
        id: &str,
        latitude: f64,
        longitude: f64,
    ) -> Result<()> {
        self.client.geoadd(&self.key, longitude, latitude, id).await?;

        let meta_key = format!("location:{}", id);
        self.client.hset_multiple(&meta_key, &[
            ("lat", &latitude.to_string()),
            ("lon", &longitude.to_string()),
            ("updated_at", &chrono::Utc::now().timestamp().to_string()),
        ]).await?;

        Ok(())
    }

    /// Find locations within radius
    pub async fn search_radius(
        &self,
        latitude: f64,
        longitude: f64,
        radius_km: f64,
        limit: usize,
    ) -> Result<Vec<LocationResult>> {
        let results = self.client.georadius(
            &self.key,
            longitude,
            latitude,
            radius_km,
            GeoUnit::Kilometers,
            GeoOptions {
                with_dist: true,
                with_coord: true,
                count: Some(limit),
                sort: Some(GeoSort::Asc),
            },
        ).await?;

        let mut locations = Vec::new();
        for result in results {
            let meta_key = format!("location:{}", result.member);
            let meta: HashMap<String, String> = self.client.hgetall(&meta_key).await?;

            locations.push(LocationResult {
                id: result.member,
                distance_km: result.distance.unwrap_or(0.0),
                latitude: result.coordinates.map(|c| c.1).unwrap_or(0.0),
                longitude: result.coordinates.map(|c| c.0).unwrap_or(0.0),
                name: meta.get("name").cloned().unwrap_or_default(),
                category: meta.get("category").cloned().unwrap_or_default(),
            });
        }

        Ok(locations)
    }

    /// Get position of location
    pub async fn get_position(&self, id: &str) -> Result<Option<(f64, f64)>> {
        let positions = self.client.geopos(&self.key, &[id]).await?;
        Ok(positions.get(0).and_then(|p| *p))
    }

    /// Calculate distance between two locations
    pub async fn distance(&self, id1: &str, id2: &str) -> Result<Option<f64>> {
        self.client.geodist(&self.key, id1, id2, GeoUnit::Kilometers).await
    }

    /// Remove location
    pub async fn remove(&self, id: &str) -> Result<()> {
        self.client.zrem(&self.key, id).await?;
        let meta_key = format!("location:{}", id);
        self.client.del(&meta_key).await?;
        Ok(())
    }
}

pub struct LocationResult {
    pub id: String,
    pub distance_km: f64,
    pub latitude: f64,
    pub longitude: f64,
    pub name: String,
    pub category: String,
}
```

### 2. Nearby Search with Filters

```rust
pub struct FilteredGeoSearch {
    client: FerriteClient,
}

impl FilteredGeoSearch {
    /// Find nearby locations with category filter
    pub async fn search_by_category(
        &self,
        latitude: f64,
        longitude: f64,
        radius_km: f64,
        category: &str,
        limit: usize,
    ) -> Result<Vec<LocationResult>> {
        // Use Lua script for atomic filter + geo search
        let script = r#"
            local results = redis.call('GEORADIUS', KEYS[1], ARGV[1], ARGV[2], ARGV[3], 'km',
                'WITHDIST', 'WITHCOORD', 'ASC', 'COUNT', ARGV[4] * 10)

            local filtered = {}
            local count = 0

            for i = 1, #results, 1 do
                local id = results[i][1]
                local meta_key = 'location:' .. id
                local cat = redis.call('HGET', meta_key, 'category')

                if cat == ARGV[5] then
                    table.insert(filtered, results[i])
                    count = count + 1
                    if count >= tonumber(ARGV[4]) then
                        break
                    end
                end
            end

            return filtered
        "#;

        let results: Vec<Vec<serde_json::Value>> = self.client.eval(
            script,
            &["geo:places"],
            &[
                &longitude.to_string(),
                &latitude.to_string(),
                &radius_km.to_string(),
                &limit.to_string(),
                category,
            ],
        ).await?;

        // Parse results
        let mut locations = Vec::new();
        for result in results {
            if result.len() >= 3 {
                let id = result[0].as_str().unwrap_or_default();
                let dist = result[1].as_f64().unwrap_or(0.0);
                let coords = result[2].as_array();

                let meta_key = format!("location:{}", id);
                let name: String = self.client.hget(&meta_key, "name").await?
                    .unwrap_or_default();

                locations.push(LocationResult {
                    id: id.to_string(),
                    distance_km: dist,
                    longitude: coords.and_then(|c| c[0].as_f64()).unwrap_or(0.0),
                    latitude: coords.and_then(|c| c[1].as_f64()).unwrap_or(0.0),
                    name,
                    category: category.to_string(),
                });
            }
        }

        Ok(locations)
    }

    /// Search with multiple filters
    pub async fn search_with_filters(
        &self,
        latitude: f64,
        longitude: f64,
        radius_km: f64,
        filters: &SearchFilters,
        limit: usize,
    ) -> Result<Vec<LocationResult>> {
        // Get all within radius first
        let candidates = self.client.georadius(
            "geo:places",
            longitude,
            latitude,
            radius_km,
            GeoUnit::Kilometers,
            GeoOptions {
                with_dist: true,
                with_coord: true,
                count: Some(limit * 10), // Overfetch for filtering
                sort: Some(GeoSort::Asc),
            },
        ).await?;

        let mut results = Vec::new();

        for candidate in candidates {
            if results.len() >= limit {
                break;
            }

            let meta_key = format!("location:{}", candidate.member);
            let meta: HashMap<String, String> = self.client.hgetall(&meta_key).await?;

            // Apply filters
            if let Some(ref cat) = filters.category {
                if meta.get("category") != Some(cat) {
                    continue;
                }
            }

            if let Some(ref tags) = filters.tags {
                let loc_tags: Vec<&str> = meta.get("tags")
                    .map(|t| t.split(',').collect())
                    .unwrap_or_default();

                if !tags.iter().any(|t| loc_tags.contains(&t.as_str())) {
                    continue;
                }
            }

            if let Some(min_rating) = filters.min_rating {
                let rating: f64 = meta.get("rating")
                    .and_then(|r| r.parse().ok())
                    .unwrap_or(0.0);

                if rating < min_rating {
                    continue;
                }
            }

            if filters.open_now {
                let is_open: bool = meta.get("is_open")
                    .map(|v| v == "true")
                    .unwrap_or(false);

                if !is_open {
                    continue;
                }
            }

            results.push(LocationResult {
                id: candidate.member,
                distance_km: candidate.distance.unwrap_or(0.0),
                latitude: candidate.coordinates.map(|c| c.1).unwrap_or(0.0),
                longitude: candidate.coordinates.map(|c| c.0).unwrap_or(0.0),
                name: meta.get("name").cloned().unwrap_or_default(),
                category: meta.get("category").cloned().unwrap_or_default(),
            });
        }

        Ok(results)
    }
}

pub struct SearchFilters {
    pub category: Option<String>,
    pub tags: Option<Vec<String>>,
    pub min_rating: Option<f64>,
    pub open_now: bool,
}
```

### 3. Real-Time Vehicle Tracking

```rust
pub struct VehicleTracker {
    client: FerriteClient,
    fleet_key: String,
}

impl VehicleTracker {
    pub fn new(client: FerriteClient, fleet: &str) -> Self {
        Self {
            client,
            fleet_key: format!("fleet:{}", fleet),
        }
    }

    /// Update vehicle position
    pub async fn update_position(
        &self,
        vehicle_id: &str,
        latitude: f64,
        longitude: f64,
        heading: f64,
        speed_kmh: f64,
    ) -> Result<()> {
        let now = chrono::Utc::now();

        // Update geo index
        self.client.geoadd(&self.fleet_key, longitude, latitude, vehicle_id).await?;

        // Store current state
        let state_key = format!("vehicle:{}:state", vehicle_id);
        self.client.hset_multiple(&state_key, &[
            ("lat", &latitude.to_string()),
            ("lon", &longitude.to_string()),
            ("heading", &heading.to_string()),
            ("speed", &speed_kmh.to_string()),
            ("updated_at", &now.timestamp_millis().to_string()),
        ]).await?;

        // Append to history (time-series)
        let history_key = format!("vehicle:{}:history", vehicle_id);
        self.client.timeseries_add_multi(
            &history_key,
            now.timestamp_millis(),
            &[
                ("lat", latitude),
                ("lon", longitude),
                ("heading", heading),
                ("speed", speed_kmh),
            ],
        ).await?;

        // Publish real-time update
        let update = serde_json::json!({
            "vehicle_id": vehicle_id,
            "latitude": latitude,
            "longitude": longitude,
            "heading": heading,
            "speed": speed_kmh,
            "timestamp": now.timestamp_millis(),
        });

        self.client.publish(
            &format!("fleet:{}:updates", self.fleet_key),
            &update.to_string(),
        ).await?;

        Ok(())
    }

    /// Find vehicles near location
    pub async fn find_nearby(
        &self,
        latitude: f64,
        longitude: f64,
        radius_km: f64,
    ) -> Result<Vec<VehiclePosition>> {
        let results = self.client.georadius(
            &self.fleet_key,
            longitude,
            latitude,
            radius_km,
            GeoUnit::Kilometers,
            GeoOptions {
                with_dist: true,
                with_coord: true,
                sort: Some(GeoSort::Asc),
                ..Default::default()
            },
        ).await?;

        let mut vehicles = Vec::new();
        for result in results {
            let state_key = format!("vehicle:{}:state", result.member);
            let state: HashMap<String, String> = self.client.hgetall(&state_key).await?;

            vehicles.push(VehiclePosition {
                vehicle_id: result.member,
                distance_km: result.distance.unwrap_or(0.0),
                latitude: state.get("lat").and_then(|v| v.parse().ok()).unwrap_or(0.0),
                longitude: state.get("lon").and_then(|v| v.parse().ok()).unwrap_or(0.0),
                heading: state.get("heading").and_then(|v| v.parse().ok()).unwrap_or(0.0),
                speed_kmh: state.get("speed").and_then(|v| v.parse().ok()).unwrap_or(0.0),
                last_update: state.get("updated_at").and_then(|v| v.parse().ok()).unwrap_or(0),
            });
        }

        Ok(vehicles)
    }

    /// Find nearest available vehicle
    pub async fn find_nearest_available(
        &self,
        latitude: f64,
        longitude: f64,
        radius_km: f64,
    ) -> Result<Option<VehiclePosition>> {
        let script = r#"
            local results = redis.call('GEORADIUS', KEYS[1], ARGV[1], ARGV[2], ARGV[3], 'km',
                'WITHDIST', 'WITHCOORD', 'ASC')

            for i = 1, #results do
                local vehicle_id = results[i][1]
                local state_key = 'vehicle:' .. vehicle_id .. ':state'
                local status = redis.call('HGET', state_key, 'status')

                if status == 'available' then
                    return results[i]
                end
            end

            return nil
        "#;

        let result: Option<Vec<serde_json::Value>> = self.client.eval(
            script,
            &[&self.fleet_key],
            &[
                &longitude.to_string(),
                &latitude.to_string(),
                &radius_km.to_string(),
            ],
        ).await?;

        // Parse result if found
        if let Some(data) = result {
            if data.len() >= 3 {
                let vehicle_id = data[0].as_str().unwrap_or_default();
                let state_key = format!("vehicle:{}:state", vehicle_id);
                let state: HashMap<String, String> = self.client.hgetall(&state_key).await?;

                return Ok(Some(VehiclePosition {
                    vehicle_id: vehicle_id.to_string(),
                    distance_km: data[1].as_f64().unwrap_or(0.0),
                    latitude: state.get("lat").and_then(|v| v.parse().ok()).unwrap_or(0.0),
                    longitude: state.get("lon").and_then(|v| v.parse().ok()).unwrap_or(0.0),
                    heading: state.get("heading").and_then(|v| v.parse().ok()).unwrap_or(0.0),
                    speed_kmh: state.get("speed").and_then(|v| v.parse().ok()).unwrap_or(0.0),
                    last_update: state.get("updated_at").and_then(|v| v.parse().ok()).unwrap_or(0),
                }));
            }
        }

        Ok(None)
    }

    /// Get vehicle history for time range
    pub async fn get_history(
        &self,
        vehicle_id: &str,
        start: i64,
        end: i64,
    ) -> Result<Vec<HistoryPoint>> {
        let history_key = format!("vehicle:{}:history", vehicle_id);
        let points = self.client.timeseries_range(&history_key, start, end).await?;

        Ok(points.into_iter().map(|p| HistoryPoint {
            timestamp: p.timestamp,
            latitude: p.values.get("lat").copied().unwrap_or(0.0),
            longitude: p.values.get("lon").copied().unwrap_or(0.0),
            heading: p.values.get("heading").copied().unwrap_or(0.0),
            speed_kmh: p.values.get("speed").copied().unwrap_or(0.0),
        }).collect())
    }
}

pub struct VehiclePosition {
    pub vehicle_id: String,
    pub distance_km: f64,
    pub latitude: f64,
    pub longitude: f64,
    pub heading: f64,
    pub speed_kmh: f64,
    pub last_update: i64,
}

pub struct HistoryPoint {
    pub timestamp: i64,
    pub latitude: f64,
    pub longitude: f64,
    pub heading: f64,
    pub speed_kmh: f64,
}
```

### 4. Geofencing

```rust
pub struct Geofence {
    pub id: String,
    pub name: String,
    pub center_lat: f64,
    pub center_lon: f64,
    pub radius_meters: f64,
    pub on_enter: Option<String>,  // Webhook URL
    pub on_exit: Option<String>,
}

pub struct GeofenceManager {
    client: FerriteClient,
}

impl GeofenceManager {
    /// Create geofence
    pub async fn create_geofence(&self, fence: &Geofence) -> Result<()> {
        // Store geofence definition
        let fence_key = format!("geofence:{}", fence.id);
        let json = serde_json::to_string(fence)?;
        self.client.set(&fence_key, &json).await?;

        // Add to geo index for efficient querying
        self.client.geoadd(
            "geofences",
            fence.center_lon,
            fence.center_lat,
            &fence.id,
        ).await?;

        Ok(())
    }

    /// Check which geofences a point is inside
    pub async fn check_geofences(
        &self,
        latitude: f64,
        longitude: f64,
    ) -> Result<Vec<Geofence>> {
        // Get all geofences within max possible radius
        let candidates = self.client.georadius(
            "geofences",
            longitude,
            latitude,
            10.0, // Search 10km radius
            GeoUnit::Kilometers,
            GeoOptions {
                with_dist: true,
                ..Default::default()
            },
        ).await?;

        let mut inside = Vec::new();

        for candidate in candidates {
            let fence_key = format!("geofence:{}", candidate.member);
            if let Some(json) = self.client.get(&fence_key).await? {
                let fence: Geofence = serde_json::from_str(&json)?;
                let distance_m = candidate.distance.unwrap_or(f64::MAX) * 1000.0;

                if distance_m <= fence.radius_meters {
                    inside.push(fence);
                }
            }
        }

        Ok(inside)
    }

    /// Monitor entity for geofence events
    pub async fn update_entity_position(
        &self,
        entity_id: &str,
        latitude: f64,
        longitude: f64,
    ) -> Result<Vec<GeofenceEvent>> {
        // Get previous geofences
        let prev_key = format!("entity:{}:geofences", entity_id);
        let previous: Vec<String> = self.client.smembers(&prev_key).await?;

        // Check current geofences
        let current_fences = self.check_geofences(latitude, longitude).await?;
        let current: Vec<String> = current_fences.iter().map(|f| f.id.clone()).collect();

        let mut events = Vec::new();

        // Detect exits (was in, now not)
        for fence_id in &previous {
            if !current.contains(fence_id) {
                self.client.srem(&prev_key, fence_id).await?;

                let fence_key = format!("geofence:{}", fence_id);
                if let Some(json) = self.client.get(&fence_key).await? {
                    let fence: Geofence = serde_json::from_str(&json)?;
                    events.push(GeofenceEvent {
                        event_type: GeofenceEventType::Exit,
                        entity_id: entity_id.to_string(),
                        fence,
                        timestamp: chrono::Utc::now().timestamp_millis(),
                    });
                }
            }
        }

        // Detect enters (not in before, now is)
        for fence in current_fences {
            if !previous.contains(&fence.id) {
                self.client.sadd(&prev_key, &fence.id).await?;

                events.push(GeofenceEvent {
                    event_type: GeofenceEventType::Enter,
                    entity_id: entity_id.to_string(),
                    fence,
                    timestamp: chrono::Utc::now().timestamp_millis(),
                });
            }
        }

        // Trigger webhooks for events
        for event in &events {
            self.trigger_webhook(event).await?;
        }

        Ok(events)
    }

    async fn trigger_webhook(&self, event: &GeofenceEvent) -> Result<()> {
        let url = match event.event_type {
            GeofenceEventType::Enter => &event.fence.on_enter,
            GeofenceEventType::Exit => &event.fence.on_exit,
        };

        if let Some(url) = url {
            // Queue webhook for delivery
            let webhook = serde_json::json!({
                "url": url,
                "payload": event,
            });

            self.client.rpush("webhooks:queue", &webhook.to_string()).await?;
        }

        Ok(())
    }
}

pub struct GeofenceEvent {
    pub event_type: GeofenceEventType,
    pub entity_id: String,
    pub fence: Geofence,
    pub timestamp: i64,
}

pub enum GeofenceEventType {
    Enter,
    Exit,
}
```

### 5. Location-Based Notifications

```rust
pub struct LocationNotifier {
    client: FerriteClient,
}

impl LocationNotifier {
    /// Register user for location-based notifications
    pub async fn register(
        &self,
        user_id: &str,
        latitude: f64,
        longitude: f64,
        radius_km: f64,
        categories: &[&str],
    ) -> Result<()> {
        let key = format!("notify:user:{}", user_id);

        // Store preferences
        self.client.hset_multiple(&key, &[
            ("lat", &latitude.to_string()),
            ("lon", &longitude.to_string()),
            ("radius", &radius_km.to_string()),
            ("categories", &categories.join(",")),
        ]).await?;

        // Add to geo index for efficient lookup
        self.client.geoadd("notify:locations", longitude, latitude, user_id).await?;

        Ok(())
    }

    /// Find users to notify about a new place/event
    pub async fn find_users_to_notify(
        &self,
        latitude: f64,
        longitude: f64,
        category: &str,
        max_radius_km: f64,
    ) -> Result<Vec<String>> {
        // Find users near this location
        let nearby = self.client.georadius(
            "notify:locations",
            longitude,
            latitude,
            max_radius_km,
            GeoUnit::Kilometers,
            GeoOptions {
                with_dist: true,
                ..Default::default()
            },
        ).await?;

        let mut users_to_notify = Vec::new();

        for entry in nearby {
            let user_id = &entry.member;
            let distance = entry.distance.unwrap_or(f64::MAX);

            // Check user's preferences
            let pref_key = format!("notify:user:{}", user_id);
            let prefs: HashMap<String, String> = self.client.hgetall(&pref_key).await?;

            // Check if within user's preferred radius
            let user_radius: f64 = prefs.get("radius")
                .and_then(|r| r.parse().ok())
                .unwrap_or(0.0);

            if distance > user_radius {
                continue;
            }

            // Check if user wants this category
            let categories: Vec<&str> = prefs.get("categories")
                .map(|c| c.split(',').collect())
                .unwrap_or_default();

            if categories.is_empty() || categories.contains(&category) {
                users_to_notify.push(user_id.clone());
            }
        }

        Ok(users_to_notify)
    }
}
```

## API Example

```rust
use axum::{Router, routing::{get, post}, extract::{State, Query, Json}};

pub fn geo_routes(store: Arc<LocationStore>) -> Router {
    Router::new()
        .route("/locations", post(add_location))
        .route("/locations/nearby", get(search_nearby))
        .route("/locations/:id/position", put(update_position))
        .with_state(store)
}

async fn search_nearby(
    State(store): State<Arc<LocationStore>>,
    Query(params): Query<NearbyParams>,
) -> Result<Json<Vec<LocationResult>>, StatusCode> {
    let results = store.search_radius(
        params.latitude,
        params.longitude,
        params.radius_km.unwrap_or(5.0),
        params.limit.unwrap_or(20),
    ).await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(results))
}

#[derive(Deserialize)]
struct NearbyParams {
    latitude: f64,
    longitude: f64,
    radius_km: Option<f64>,
    limit: Option<usize>,
}
```

## Best Practices

### 1. Use Appropriate Precision

```rust
// Store coordinates with appropriate precision
// 6 decimal places ≈ 0.1m precision
let lat = (latitude * 1_000_000.0).round() / 1_000_000.0;
let lon = (longitude * 1_000_000.0).round() / 1_000_000.0;
```

### 2. Optimize for Common Queries

```rust
// Pre-compute geohashes for fast lookup
impl LocationStore {
    pub async fn add_with_geohash(&self, location: &Location) -> Result<()> {
        self.add(location).await?;

        // Store by geohash for grid-based queries
        let geohash = geohash::encode(
            geohash::Coordinate { x: location.longitude, y: location.latitude },
            5, // precision
        )?;

        let geohash_key = format!("geo:hash:{}", geohash);
        self.client.sadd(&geohash_key, &location.id).await?;

        Ok(())
    }
}
```

### 3. Handle Edge Cases

```rust
// Validate coordinates
fn validate_coordinates(lat: f64, lon: f64) -> Result<()> {
    if lat < -90.0 || lat > 90.0 {
        return Err(anyhow::anyhow!("Invalid latitude: must be between -90 and 90"));
    }
    if lon < -180.0 || lon > 180.0 {
        return Err(anyhow::anyhow!("Invalid longitude: must be between -180 and 180"));
    }
    Ok(())
}
```

## Related Resources

- [Geo Commands Reference](/docs/reference/commands/geo)
- [Time-Series for Tracking History](/docs/data-models/time-series)
- [Real-Time Analytics](/docs/use-cases/real-time-analytics)
- [Build Analytics Dashboard](/docs/tutorials/build-analytics-dashboard)
