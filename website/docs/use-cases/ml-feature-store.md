---
maturity: beta
---

# ML Feature Store

Ferrite's low latency and flexible data structures make it ideal for serving machine learning features in production, enabling real-time inference with consistent, up-to-date feature values.

## Why Ferrite for Feature Stores?

| Feature | Benefit |
|---------|---------|
| **Sub-millisecond latency** | No bottleneck for real-time inference |
| **Hashes** | Store feature vectors efficiently |
| **TTL** | Automatic feature expiration |
| **Batch operations** | Retrieve multiple entities at once |
| **Persistence** | Features survive restarts |
| **Vector support** | Store embeddings natively |

## Feature Store Patterns

### 1. Basic Feature Store

```rust
use ferrite::FerriteClient;
use std::collections::HashMap;

pub struct FeatureStore {
    client: FerriteClient,
    namespace: String,
}

impl FeatureStore {
    pub fn new(client: FerriteClient, namespace: &str) -> Self {
        Self {
            client,
            namespace: namespace.to_string(),
        }
    }

    /// Store features for an entity
    pub async fn set_features(
        &self,
        entity_type: &str,
        entity_id: &str,
        features: &HashMap<String, f64>,
    ) -> Result<()> {
        let key = format!("features:{}:{}:{}", self.namespace, entity_type, entity_id);

        let fields: Vec<(&str, String)> = features.iter()
            .map(|(k, v)| (k.as_str(), v.to_string()))
            .collect();

        self.client.hset_multiple(&key, &fields).await?;

        Ok(())
    }

    /// Get all features for an entity
    pub async fn get_features(
        &self,
        entity_type: &str,
        entity_id: &str,
    ) -> Result<HashMap<String, f64>> {
        let key = format!("features:{}:{}:{}", self.namespace, entity_type, entity_id);
        let raw: HashMap<String, String> = self.client.hgetall(&key).await?;

        let mut features = HashMap::new();
        for (k, v) in raw {
            if let Ok(value) = v.parse::<f64>() {
                features.insert(k, value);
            }
        }

        Ok(features)
    }

    /// Get specific features for an entity
    pub async fn get_feature_subset(
        &self,
        entity_type: &str,
        entity_id: &str,
        feature_names: &[&str],
    ) -> Result<HashMap<String, f64>> {
        let key = format!("features:{}:{}:{}", self.namespace, entity_type, entity_id);

        let mut features = HashMap::new();
        for name in feature_names {
            if let Some(value) = self.client.hget(&key, name).await? {
                if let Ok(v) = value.parse::<f64>() {
                    features.insert(name.to_string(), v);
                }
            }
        }

        Ok(features)
    }

    /// Batch get features for multiple entities
    pub async fn get_features_batch(
        &self,
        entity_type: &str,
        entity_ids: &[&str],
    ) -> Result<HashMap<String, HashMap<String, f64>>> {
        let mut results = HashMap::new();

        // Use pipeline for efficiency
        let mut pipeline = self.client.pipeline();

        for entity_id in entity_ids {
            let key = format!("features:{}:{}:{}", self.namespace, entity_type, entity_id);
            pipeline.hgetall(&key);
        }

        let responses: Vec<HashMap<String, String>> = pipeline.execute().await?;

        for (i, response) in responses.into_iter().enumerate() {
            let entity_id = entity_ids[i];
            let mut features = HashMap::new();

            for (k, v) in response {
                if let Ok(value) = v.parse::<f64>() {
                    features.insert(k, value);
                }
            }

            results.insert(entity_id.to_string(), features);
        }

        Ok(results)
    }

    /// Update single feature
    pub async fn update_feature(
        &self,
        entity_type: &str,
        entity_id: &str,
        feature_name: &str,
        value: f64,
    ) -> Result<()> {
        let key = format!("features:{}:{}:{}", self.namespace, entity_type, entity_id);
        self.client.hset(&key, feature_name, &value.to_string()).await?;
        Ok(())
    }

    /// Increment feature value (for counters)
    pub async fn increment_feature(
        &self,
        entity_type: &str,
        entity_id: &str,
        feature_name: &str,
        delta: f64,
    ) -> Result<f64> {
        let key = format!("features:{}:{}:{}", self.namespace, entity_type, entity_id);
        self.client.hincrbyfloat(&key, feature_name, delta).await
    }
}
```

### 2. Time-Windowed Features

```rust
pub struct WindowedFeatureStore {
    client: FerriteClient,
    namespace: String,
}

impl WindowedFeatureStore {
    /// Record event for aggregation
    pub async fn record_event(
        &self,
        entity_type: &str,
        entity_id: &str,
        event_type: &str,
        value: f64,
    ) -> Result<()> {
        let timestamp = chrono::Utc::now().timestamp_millis();

        // Add to time-series for window calculations
        let ts_key = format!(
            "ts:{}:{}:{}:{}",
            self.namespace, entity_type, entity_id, event_type
        );

        self.client.timeseries_add(&ts_key, timestamp, value).await?;

        // Update rolling window aggregates
        self.update_window_aggregates(entity_type, entity_id, event_type, value).await?;

        Ok(())
    }

    /// Update window aggregates
    async fn update_window_aggregates(
        &self,
        entity_type: &str,
        entity_id: &str,
        event_type: &str,
        value: f64,
    ) -> Result<()> {
        let windows = [
            ("1h", 3600),
            ("24h", 86400),
            ("7d", 604800),
        ];

        for (suffix, seconds) in windows {
            let key = format!(
                "features:{}:{}:{}:{}:{}",
                self.namespace, entity_type, entity_id, event_type, suffix
            );

            // Increment count
            self.client.hincrby(&key, "count", 1).await?;

            // Update sum
            self.client.hincrbyfloat(&key, "sum", value).await?;

            // Update max
            let current_max: f64 = self.client.hget(&key, "max").await?
                .and_then(|v| v.parse().ok())
                .unwrap_or(f64::MIN);
            if value > current_max {
                self.client.hset(&key, "max", &value.to_string()).await?;
            }

            // Update min
            let current_min: f64 = self.client.hget(&key, "min").await?
                .and_then(|v| v.parse().ok())
                .unwrap_or(f64::MAX);
            if value < current_min {
                self.client.hset(&key, "min", &value.to_string()).await?;
            }

            // Set TTL
            self.client.expire(&key, seconds * 2).await?;
        }

        Ok(())
    }

    /// Get windowed aggregate features
    pub async fn get_window_features(
        &self,
        entity_type: &str,
        entity_id: &str,
        event_type: &str,
        window: &str,
    ) -> Result<WindowFeatures> {
        let key = format!(
            "features:{}:{}:{}:{}:{}",
            self.namespace, entity_type, entity_id, event_type, window
        );

        let data: HashMap<String, String> = self.client.hgetall(&key).await?;

        let count: u64 = data.get("count")
            .and_then(|v| v.parse().ok())
            .unwrap_or(0);

        let sum: f64 = data.get("sum")
            .and_then(|v| v.parse().ok())
            .unwrap_or(0.0);

        Ok(WindowFeatures {
            count,
            sum,
            avg: if count > 0 { sum / count as f64 } else { 0.0 },
            min: data.get("min").and_then(|v| v.parse().ok()).unwrap_or(0.0),
            max: data.get("max").and_then(|v| v.parse().ok()).unwrap_or(0.0),
        })
    }

    /// Get all window features for inference
    pub async fn get_all_window_features(
        &self,
        entity_type: &str,
        entity_id: &str,
        event_types: &[&str],
    ) -> Result<HashMap<String, f64>> {
        let mut features = HashMap::new();
        let windows = ["1h", "24h", "7d"];

        for event_type in event_types {
            for window in &windows {
                let window_features = self.get_window_features(
                    entity_type,
                    entity_id,
                    event_type,
                    window,
                ).await?;

                // Flatten into feature map
                let prefix = format!("{}_{}", event_type, window);
                features.insert(format!("{}_count", prefix), window_features.count as f64);
                features.insert(format!("{}_sum", prefix), window_features.sum);
                features.insert(format!("{}_avg", prefix), window_features.avg);
                features.insert(format!("{}_min", prefix), window_features.min);
                features.insert(format!("{}_max", prefix), window_features.max);
            }
        }

        Ok(features)
    }
}

pub struct WindowFeatures {
    pub count: u64,
    pub sum: f64,
    pub avg: f64,
    pub min: f64,
    pub max: f64,
}
```

### 3. Embedding Store

```rust
pub struct EmbeddingStore {
    client: FerriteClient,
    namespace: String,
    dimension: usize,
}

impl EmbeddingStore {
    pub fn new(client: FerriteClient, namespace: &str, dimension: usize) -> Self {
        Self {
            client,
            namespace: namespace.to_string(),
            dimension,
        }
    }

    /// Store embedding vector
    pub async fn set_embedding(
        &self,
        entity_type: &str,
        entity_id: &str,
        embedding: &[f32],
    ) -> Result<()> {
        if embedding.len() != self.dimension {
            return Err(anyhow::anyhow!(
                "Embedding dimension mismatch: expected {}, got {}",
                self.dimension,
                embedding.len()
            ));
        }

        let key = format!("embed:{}:{}:{}", self.namespace, entity_type, entity_id);

        // Store as binary for efficiency
        let bytes: Vec<u8> = embedding.iter()
            .flat_map(|f| f.to_le_bytes())
            .collect();

        self.client.set_binary(&key, &bytes).await?;

        Ok(())
    }

    /// Get embedding vector
    pub async fn get_embedding(
        &self,
        entity_type: &str,
        entity_id: &str,
    ) -> Result<Option<Vec<f32>>> {
        let key = format!("embed:{}:{}:{}", self.namespace, entity_type, entity_id);

        let bytes = match self.client.get_binary(&key).await? {
            Some(b) => b,
            None => return Ok(None),
        };

        let embedding: Vec<f32> = bytes.chunks(4)
            .map(|chunk| {
                let arr: [u8; 4] = chunk.try_into().unwrap();
                f32::from_le_bytes(arr)
            })
            .collect();

        Ok(Some(embedding))
    }

    /// Batch get embeddings
    pub async fn get_embeddings_batch(
        &self,
        entity_type: &str,
        entity_ids: &[&str],
    ) -> Result<HashMap<String, Vec<f32>>> {
        let mut results = HashMap::new();

        let mut pipeline = self.client.pipeline();
        for entity_id in entity_ids {
            let key = format!("embed:{}:{}:{}", self.namespace, entity_type, entity_id);
            pipeline.get_binary(&key);
        }

        let responses: Vec<Option<Vec<u8>>> = pipeline.execute().await?;

        for (i, response) in responses.into_iter().enumerate() {
            if let Some(bytes) = response {
                let embedding: Vec<f32> = bytes.chunks(4)
                    .map(|chunk| {
                        let arr: [u8; 4] = chunk.try_into().unwrap();
                        f32::from_le_bytes(arr)
                    })
                    .collect();

                results.insert(entity_ids[i].to_string(), embedding);
            }
        }

        Ok(results)
    }

    /// Find similar embeddings using vector search
    pub async fn find_similar(
        &self,
        entity_type: &str,
        query_embedding: &[f32],
        k: usize,
    ) -> Result<Vec<SimilarResult>> {
        let index_name = format!("{}_{}_embeddings", self.namespace, entity_type);

        let results = self.client.vector_search(
            &index_name,
            query_embedding,
            k,
            VectorSearchOptions::default(),
        ).await?;

        Ok(results.into_iter().map(|r| SimilarResult {
            entity_id: r.id,
            score: r.score,
        }).collect())
    }
}

pub struct SimilarResult {
    pub entity_id: String,
    pub score: f32,
}
```

### 4. Feature Freshness Tracking

```rust
pub struct FreshnessTracker {
    client: FerriteClient,
}

impl FreshnessTracker {
    /// Record feature update timestamp
    pub async fn record_update(
        &self,
        entity_type: &str,
        entity_id: &str,
        feature_group: &str,
    ) -> Result<()> {
        let key = format!("freshness:{}:{}", entity_type, entity_id);
        let timestamp = chrono::Utc::now().timestamp_millis();

        self.client.hset(&key, feature_group, &timestamp.to_string()).await?;

        Ok(())
    }

    /// Get feature staleness
    pub async fn get_staleness(
        &self,
        entity_type: &str,
        entity_id: &str,
        feature_group: &str,
    ) -> Result<Option<i64>> {
        let key = format!("freshness:{}:{}", entity_type, entity_id);
        let now = chrono::Utc::now().timestamp_millis();

        if let Some(timestamp_str) = self.client.hget(&key, feature_group).await? {
            let timestamp: i64 = timestamp_str.parse()?;
            return Ok(Some(now - timestamp));
        }

        Ok(None)
    }

    /// Check if features are fresh enough
    pub async fn is_fresh(
        &self,
        entity_type: &str,
        entity_id: &str,
        feature_group: &str,
        max_age_ms: i64,
    ) -> Result<bool> {
        match self.get_staleness(entity_type, entity_id, feature_group).await? {
            Some(staleness) => Ok(staleness <= max_age_ms),
            None => Ok(false), // No timestamp = not fresh
        }
    }

    /// Get all stale entities
    pub async fn find_stale_entities(
        &self,
        entity_type: &str,
        feature_group: &str,
        max_age_ms: i64,
    ) -> Result<Vec<String>> {
        let pattern = format!("freshness:{}:*", entity_type);
        let keys: Vec<String> = self.client.keys(&pattern).await?;
        let now = chrono::Utc::now().timestamp_millis();

        let mut stale = Vec::new();

        for key in keys {
            if let Some(timestamp_str) = self.client.hget(&key, feature_group).await? {
                let timestamp: i64 = timestamp_str.parse()?;
                if now - timestamp > max_age_ms {
                    // Extract entity_id from key
                    let entity_id = key.split(':').last().unwrap_or_default();
                    stale.push(entity_id.to_string());
                }
            }
        }

        Ok(stale)
    }
}
```

### 5. Online-Offline Feature Sync

```rust
pub struct FeatureSync {
    online_store: FeatureStore,
    freshness: FreshnessTracker,
}

impl FeatureSync {
    /// Sync batch features from offline to online store
    pub async fn sync_batch(
        &self,
        entity_type: &str,
        batch: Vec<FeatureBatch>,
    ) -> Result<SyncResult> {
        let mut success = 0;
        let mut failed = 0;

        for item in batch {
            match self.sync_entity(entity_type, &item).await {
                Ok(()) => success += 1,
                Err(e) => {
                    tracing::error!(
                        "Failed to sync features for {}: {}",
                        item.entity_id, e
                    );
                    failed += 1;
                }
            }
        }

        Ok(SyncResult { success, failed })
    }

    async fn sync_entity(
        &self,
        entity_type: &str,
        batch: &FeatureBatch,
    ) -> Result<()> {
        // Update features
        self.online_store.set_features(
            entity_type,
            &batch.entity_id,
            &batch.features,
        ).await?;

        // Record freshness
        self.freshness.record_update(
            entity_type,
            &batch.entity_id,
            "offline_sync",
        ).await?;

        Ok(())
    }

    /// Get features with freshness metadata
    pub async fn get_features_with_metadata(
        &self,
        entity_type: &str,
        entity_id: &str,
    ) -> Result<FeatureResponse> {
        let features = self.online_store.get_features(entity_type, entity_id).await?;
        let staleness = self.freshness.get_staleness(
            entity_type,
            entity_id,
            "offline_sync",
        ).await?;

        Ok(FeatureResponse {
            entity_id: entity_id.to_string(),
            features,
            staleness_ms: staleness,
            is_stale: staleness.map(|s| s > 3600000).unwrap_or(true), // 1 hour
        })
    }
}

pub struct FeatureBatch {
    pub entity_id: String,
    pub features: HashMap<String, f64>,
}

pub struct SyncResult {
    pub success: usize,
    pub failed: usize,
}

pub struct FeatureResponse {
    pub entity_id: String,
    pub features: HashMap<String, f64>,
    pub staleness_ms: Option<i64>,
    pub is_stale: bool,
}
```

### 6. Feature Serving API

```rust
use axum::{Router, routing::{get, post}, extract::{State, Path, Json}};

pub struct FeatureServer {
    store: FeatureStore,
    windowed: WindowedFeatureStore,
    embeddings: EmbeddingStore,
}

impl FeatureServer {
    pub fn routes(self: Arc<Self>) -> Router {
        Router::new()
            .route("/features/:entity_type/:entity_id", get(get_features))
            .route("/features/:entity_type/batch", post(get_features_batch))
            .route("/features/:entity_type/:entity_id/window", get(get_window_features))
            .route("/embeddings/:entity_type/:entity_id", get(get_embedding))
            .route("/embeddings/:entity_type/similar", post(find_similar))
            .with_state(self)
    }
}

async fn get_features(
    State(server): State<Arc<FeatureServer>>,
    Path((entity_type, entity_id)): Path<(String, String)>,
) -> Result<Json<HashMap<String, f64>>, StatusCode> {
    let features = server.store
        .get_features(&entity_type, &entity_id)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(features))
}

async fn get_features_batch(
    State(server): State<Arc<FeatureServer>>,
    Path(entity_type): Path<String>,
    Json(request): Json<BatchRequest>,
) -> Result<Json<HashMap<String, HashMap<String, f64>>>, StatusCode> {
    let entity_ids: Vec<&str> = request.entity_ids.iter().map(|s| s.as_str()).collect();

    let features = server.store
        .get_features_batch(&entity_type, &entity_ids)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(features))
}

async fn find_similar(
    State(server): State<Arc<FeatureServer>>,
    Path(entity_type): Path<String>,
    Json(request): Json<SimilarRequest>,
) -> Result<Json<Vec<SimilarResult>>, StatusCode> {
    let results = server.embeddings
        .find_similar(&entity_type, &request.embedding, request.k)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(results))
}

#[derive(Deserialize)]
struct BatchRequest {
    entity_ids: Vec<String>,
}

#[derive(Deserialize)]
struct SimilarRequest {
    embedding: Vec<f32>,
    k: usize,
}
```

## Integration with ML Frameworks

### Inference Pipeline

```rust
pub struct InferencePipeline {
    feature_store: Arc<FeatureStore>,
    embedding_store: Arc<EmbeddingStore>,
    model: Arc<dyn Model>,
}

impl InferencePipeline {
    pub async fn predict(&self, user_id: &str, item_id: &str) -> Result<f64> {
        // Fetch features in parallel
        let (user_features, item_features, user_embedding, item_embedding) = tokio::try_join!(
            self.feature_store.get_features("user", user_id),
            self.feature_store.get_features("item", item_id),
            self.embedding_store.get_embedding("user", user_id),
            self.embedding_store.get_embedding("item", item_id),
        )?;

        // Prepare model input
        let mut input = ModelInput::new();

        for (name, value) in user_features {
            input.add_feature(&format!("user_{}", name), value);
        }

        for (name, value) in item_features {
            input.add_feature(&format!("item_{}", name), value);
        }

        if let (Some(u_emb), Some(i_emb)) = (user_embedding, item_embedding) {
            // Compute embedding similarity
            let similarity = cosine_similarity(&u_emb, &i_emb);
            input.add_feature("embedding_similarity", similarity as f64);
        }

        // Run inference
        let prediction = self.model.predict(&input)?;

        Ok(prediction)
    }
}

fn cosine_similarity(a: &[f32], b: &[f32]) -> f32 {
    let dot: f32 = a.iter().zip(b.iter()).map(|(x, y)| x * y).sum();
    let norm_a: f32 = a.iter().map(|x| x * x).sum::<f32>().sqrt();
    let norm_b: f32 = b.iter().map(|x| x * x).sum::<f32>().sqrt();
    dot / (norm_a * norm_b)
}
```

## Best Practices

### 1. Feature Naming Convention

```rust
// Use consistent naming: <entity>_<feature_group>_<feature_name>
// Examples:
// user_profile_age
// user_activity_7d_purchase_count
// item_embedding_256d

fn feature_key(entity: &str, group: &str, name: &str) -> String {
    format!("{}_{}_{}", entity, group, name)
}
```

### 2. Versioning Features

```rust
pub struct VersionedFeatureStore {
    store: FeatureStore,
    version: String,
}

impl VersionedFeatureStore {
    pub async fn set_features(
        &self,
        entity_type: &str,
        entity_id: &str,
        features: &HashMap<String, f64>,
    ) -> Result<()> {
        // Store with version prefix
        let versioned_type = format!("{}:v{}", entity_type, self.version);
        self.store.set_features(&versioned_type, entity_id, features).await
    }
}
```

### 3. Monitoring Feature Quality

```rust
pub async fn check_feature_quality(
    store: &FeatureStore,
    entity_type: &str,
    sample_size: usize,
) -> Result<QualityReport> {
    // Sample entities
    let entity_ids = store.sample_entities(entity_type, sample_size).await?;

    let mut missing_count = HashMap::new();
    let mut null_count = HashMap::new();

    for entity_id in &entity_ids {
        let features = store.get_features(entity_type, entity_id).await?;

        // Track missing/null features
        for (name, value) in &features {
            if value.is_nan() {
                *null_count.entry(name.clone()).or_insert(0) += 1;
            }
        }
    }

    Ok(QualityReport {
        sample_size,
        missing_features: missing_count,
        null_features: null_count,
    })
}
```

## Related Resources

- [Vector Search Guide](/docs/ai-ml/vector-indexes)
- [Build Recommendation Engine Tutorial](/docs/tutorials/build-recommendation-engine)
- [Embeddings Guide](/docs/ai-ml/embeddings)
- [Time-Series for Windowed Features](/docs/data-models/time-series)
