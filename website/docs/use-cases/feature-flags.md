---
maturity: beta
---

# Feature Flags

Ferrite provides an excellent foundation for feature flag systems with its low latency, atomic operations, and support for complex targeting rules through hashes and sets.

## Why Ferrite for Feature Flags?

| Feature | Benefit |
|---------|---------|
| **Sub-millisecond reads** | No performance impact on flag checks |
| **Atomic updates** | Instant flag rollouts |
| **Pub/Sub** | Real-time flag change propagation |
| **Hashes** | Store flag configurations |
| **Sets** | User segment targeting |
| **Lua scripting** | Complex targeting logic |

## Feature Flag Patterns

### 1. Simple Boolean Flags

```rust
use ferrite::FerriteClient;

pub struct FeatureFlags {
    client: FerriteClient,
    prefix: String,
}

impl FeatureFlags {
    pub fn new(client: FerriteClient) -> Self {
        Self {
            client,
            prefix: "feature".to_string(),
        }
    }

    /// Check if feature is enabled globally
    pub async fn is_enabled(&self, feature: &str) -> Result<bool> {
        let key = format!("{}:{}", self.prefix, feature);
        let value = self.client.get(&key).await?;
        Ok(value.map(|v| v == "1" || v == "true").unwrap_or(false))
    }

    /// Enable feature globally
    pub async fn enable(&self, feature: &str) -> Result<()> {
        let key = format!("{}:{}", self.prefix, feature);
        self.client.set(&key, "1").await
    }

    /// Disable feature globally
    pub async fn disable(&self, feature: &str) -> Result<()> {
        let key = format!("{}:{}", self.prefix, feature);
        self.client.set(&key, "0").await
    }

    /// Toggle feature
    pub async fn toggle(&self, feature: &str) -> Result<bool> {
        let enabled = self.is_enabled(feature).await?;
        if enabled {
            self.disable(feature).await?;
        } else {
            self.enable(feature).await?;
        }
        Ok(!enabled)
    }
}
```

### 2. Percentage Rollouts

```rust
use std::hash::{Hash, Hasher};
use std::collections::hash_map::DefaultHasher;

pub struct GradualRollout {
    client: FerriteClient,
}

impl GradualRollout {
    /// Check if feature is enabled for a specific user
    pub async fn is_enabled_for_user(
        &self,
        feature: &str,
        user_id: &str,
    ) -> Result<bool> {
        let key = format!("feature:{}:rollout", feature);
        let percentage: u8 = self.client.get(&key).await?
            .and_then(|v| v.parse().ok())
            .unwrap_or(0);

        if percentage == 0 {
            return Ok(false);
        }
        if percentage >= 100 {
            return Ok(true);
        }

        // Deterministic hash for consistent user experience
        let bucket = self.user_bucket(feature, user_id);
        Ok(bucket < percentage)
    }

    /// Calculate user's bucket (0-99) for a feature
    fn user_bucket(&self, feature: &str, user_id: &str) -> u8 {
        let mut hasher = DefaultHasher::new();
        format!("{}:{}", feature, user_id).hash(&mut hasher);
        (hasher.finish() % 100) as u8
    }

    /// Set rollout percentage (0-100)
    pub async fn set_percentage(&self, feature: &str, percentage: u8) -> Result<()> {
        let key = format!("feature:{}:rollout", feature);
        self.client.set(&key, &percentage.min(100).to_string()).await
    }

    /// Gradually increase rollout
    pub async fn increment_rollout(
        &self,
        feature: &str,
        increment: u8,
    ) -> Result<u8> {
        let key = format!("feature:{}:rollout", feature);
        let new_value = self.client.incrby(&key, increment as i64).await?;

        // Cap at 100
        if new_value > 100 {
            self.client.set(&key, "100").await?;
            return Ok(100);
        }

        Ok(new_value as u8)
    }
}
```

### 3. User Segment Targeting

```rust
pub struct SegmentedFlags {
    client: FerriteClient,
}

impl SegmentedFlags {
    /// Add user to a segment
    pub async fn add_to_segment(&self, segment: &str, user_id: &str) -> Result<()> {
        let key = format!("segment:{}", segment);
        self.client.sadd(&key, user_id).await?;
        Ok(())
    }

    /// Remove user from segment
    pub async fn remove_from_segment(&self, segment: &str, user_id: &str) -> Result<()> {
        let key = format!("segment:{}", segment);
        self.client.srem(&key, user_id).await?;
        Ok(())
    }

    /// Check if user is in segment
    pub async fn is_in_segment(&self, segment: &str, user_id: &str) -> Result<bool> {
        let key = format!("segment:{}", segment);
        self.client.sismember(&key, user_id).await
    }

    /// Enable feature for specific segments
    pub async fn enable_for_segments(
        &self,
        feature: &str,
        segments: &[&str],
    ) -> Result<()> {
        let key = format!("feature:{}:segments", feature);
        for segment in segments {
            self.client.sadd(&key, *segment).await?;
        }
        Ok(())
    }

    /// Check if feature is enabled for user based on segments
    pub async fn is_enabled_for_user(
        &self,
        feature: &str,
        user_id: &str,
    ) -> Result<bool> {
        // Get enabled segments for feature
        let segments_key = format!("feature:{}:segments", feature);
        let enabled_segments: Vec<String> = self.client.smembers(&segments_key).await?;

        if enabled_segments.is_empty() {
            return Ok(false);
        }

        // Check if user is in any enabled segment
        for segment in enabled_segments {
            if self.is_in_segment(&segment, user_id).await? {
                return Ok(true);
            }
        }

        Ok(false)
    }
}
```

### 4. Rich Feature Configuration

```rust
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone)]
pub struct FeatureConfig {
    pub enabled: bool,
    pub rollout_percentage: u8,
    pub allowed_segments: Vec<String>,
    pub blocked_segments: Vec<String>,
    pub allowed_users: Vec<String>,
    pub blocked_users: Vec<String>,
    pub variants: Option<Vec<Variant>>,
    pub metadata: serde_json::Value,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct Variant {
    pub name: String,
    pub weight: u8,
    pub payload: serde_json::Value,
}

pub struct ConfigurableFlags {
    client: FerriteClient,
}

impl ConfigurableFlags {
    /// Get full feature configuration
    pub async fn get_config(&self, feature: &str) -> Result<Option<FeatureConfig>> {
        let key = format!("feature:{}", feature);
        let json = match self.client.get(&key).await? {
            Some(j) => j,
            None => return Ok(None),
        };
        Ok(Some(serde_json::from_str(&json)?))
    }

    /// Set feature configuration
    pub async fn set_config(&self, feature: &str, config: &FeatureConfig) -> Result<()> {
        let key = format!("feature:{}", feature);
        let json = serde_json::to_string(config)?;
        self.client.set(&key, &json).await?;

        // Publish change notification
        let channel = "feature_changes";
        let notification = serde_json::json!({
            "feature": feature,
            "timestamp": chrono::Utc::now().timestamp_millis(),
        });
        self.client.publish(channel, &notification.to_string()).await?;

        Ok(())
    }

    /// Evaluate feature for a user context
    pub async fn evaluate(
        &self,
        feature: &str,
        context: &EvaluationContext,
    ) -> Result<EvaluationResult> {
        let config = match self.get_config(feature).await? {
            Some(c) => c,
            None => return Ok(EvaluationResult::disabled()),
        };

        // 1. Check if globally disabled
        if !config.enabled {
            return Ok(EvaluationResult::disabled());
        }

        // 2. Check blocked users
        if config.blocked_users.contains(&context.user_id) {
            return Ok(EvaluationResult::disabled());
        }

        // 3. Check allowed users (override)
        if config.allowed_users.contains(&context.user_id) {
            return Ok(self.resolve_variant(&config, context));
        }

        // 4. Check blocked segments
        for segment in &config.blocked_segments {
            if context.segments.contains(segment) {
                return Ok(EvaluationResult::disabled());
            }
        }

        // 5. Check allowed segments
        if !config.allowed_segments.is_empty() {
            let in_allowed = config.allowed_segments.iter()
                .any(|s| context.segments.contains(s));
            if !in_allowed {
                return Ok(EvaluationResult::disabled());
            }
        }

        // 6. Check rollout percentage
        if config.rollout_percentage < 100 {
            let bucket = self.user_bucket(feature, &context.user_id);
            if bucket >= config.rollout_percentage {
                return Ok(EvaluationResult::disabled());
            }
        }

        // 7. Resolve variant
        Ok(self.resolve_variant(&config, context))
    }

    fn user_bucket(&self, feature: &str, user_id: &str) -> u8 {
        let mut hasher = DefaultHasher::new();
        format!("{}:{}", feature, user_id).hash(&mut hasher);
        (hasher.finish() % 100) as u8
    }

    fn resolve_variant(
        &self,
        config: &FeatureConfig,
        context: &EvaluationContext,
    ) -> EvaluationResult {
        match &config.variants {
            None => EvaluationResult::enabled(None),
            Some(variants) if variants.is_empty() => EvaluationResult::enabled(None),
            Some(variants) => {
                // Deterministic variant selection
                let mut hasher = DefaultHasher::new();
                format!("variant:{}:{}", context.user_id, "feature").hash(&mut hasher);
                let bucket = (hasher.finish() % 100) as u8;

                let mut cumulative = 0u8;
                for variant in variants {
                    cumulative += variant.weight;
                    if bucket < cumulative {
                        return EvaluationResult::enabled(Some(variant.clone()));
                    }
                }

                // Fallback to last variant
                EvaluationResult::enabled(variants.last().cloned())
            }
        }
    }
}

#[derive(Clone)]
pub struct EvaluationContext {
    pub user_id: String,
    pub segments: Vec<String>,
    pub attributes: HashMap<String, String>,
}

pub struct EvaluationResult {
    pub enabled: bool,
    pub variant: Option<Variant>,
}

impl EvaluationResult {
    pub fn disabled() -> Self {
        Self { enabled: false, variant: None }
    }

    pub fn enabled(variant: Option<Variant>) -> Self {
        Self { enabled: true, variant }
    }
}
```

### 5. A/B Testing with Variants

```rust
pub struct ABTesting {
    client: FerriteClient,
}

impl ABTesting {
    /// Create A/B test
    pub async fn create_test(
        &self,
        test_id: &str,
        variants: Vec<TestVariant>,
    ) -> Result<()> {
        let key = format!("abtest:{}", test_id);

        let config = serde_json::json!({
            "id": test_id,
            "variants": variants,
            "created_at": chrono::Utc::now().timestamp(),
            "status": "running",
        });

        self.client.set(&key, &config.to_string()).await?;
        Ok(())
    }

    /// Assign user to variant
    pub async fn get_assignment(
        &self,
        test_id: &str,
        user_id: &str,
    ) -> Result<Option<String>> {
        // Check for existing assignment
        let assignment_key = format!("abtest:{}:assignment:{}", test_id, user_id);
        if let Some(variant) = self.client.get(&assignment_key).await? {
            return Ok(Some(variant));
        }

        // Get test config
        let test_key = format!("abtest:{}", test_id);
        let config_json = match self.client.get(&test_key).await? {
            Some(c) => c,
            None => return Ok(None),
        };

        let config: serde_json::Value = serde_json::from_str(&config_json)?;
        let variants = config["variants"].as_array().unwrap();

        // Calculate assignment
        let mut hasher = DefaultHasher::new();
        format!("{}:{}", test_id, user_id).hash(&mut hasher);
        let bucket = (hasher.finish() % 100) as u8;

        let mut cumulative = 0u8;
        let mut assigned_variant = None;

        for variant in variants {
            let weight = variant["weight"].as_u64().unwrap() as u8;
            cumulative += weight;
            if bucket < cumulative && assigned_variant.is_none() {
                assigned_variant = variant["name"].as_str().map(String::from);
            }
        }

        // Store assignment
        if let Some(ref variant) = assigned_variant {
            self.client.set(&assignment_key, variant).await?;

            // Track assignment for analytics
            let count_key = format!("abtest:{}:count:{}", test_id, variant);
            self.client.incr(&count_key).await?;
        }

        Ok(assigned_variant)
    }

    /// Record conversion event
    pub async fn record_conversion(
        &self,
        test_id: &str,
        user_id: &str,
        event: &str,
        value: Option<f64>,
    ) -> Result<()> {
        // Get user's variant
        let variant = match self.get_assignment(test_id, user_id).await? {
            Some(v) => v,
            None => return Ok(()),
        };

        // Record conversion
        let conversion_key = format!(
            "abtest:{}:conversion:{}:{}",
            test_id, variant, event
        );
        self.client.incr(&conversion_key).await?;

        // Record value if provided
        if let Some(v) = value {
            let value_key = format!(
                "abtest:{}:value:{}:{}",
                test_id, variant, event
            );
            self.client.incrbyfloat(&value_key, v).await?;
        }

        Ok(())
    }

    /// Get test results
    pub async fn get_results(&self, test_id: &str) -> Result<TestResults> {
        let test_key = format!("abtest:{}", test_id);
        let config_json = self.client.get(&test_key).await?
            .ok_or_else(|| anyhow::anyhow!("Test not found"))?;

        let config: serde_json::Value = serde_json::from_str(&config_json)?;
        let variants = config["variants"].as_array().unwrap();

        let mut results = Vec::new();

        for variant in variants {
            let name = variant["name"].as_str().unwrap();

            let count_key = format!("abtest:{}:count:{}", test_id, name);
            let conversion_key = format!("abtest:{}:conversion:{}:purchase", test_id, name);

            let participants: u64 = self.client.get(&count_key).await?
                .and_then(|v| v.parse().ok())
                .unwrap_or(0);

            let conversions: u64 = self.client.get(&conversion_key).await?
                .and_then(|v| v.parse().ok())
                .unwrap_or(0);

            let conversion_rate = if participants > 0 {
                conversions as f64 / participants as f64 * 100.0
            } else {
                0.0
            };

            results.push(VariantResult {
                name: name.to_string(),
                participants,
                conversions,
                conversion_rate,
            });
        }

        Ok(TestResults {
            test_id: test_id.to_string(),
            variants: results,
        })
    }
}

#[derive(Serialize)]
pub struct TestVariant {
    pub name: String,
    pub weight: u8,
    pub payload: serde_json::Value,
}

#[derive(Serialize)]
pub struct TestResults {
    pub test_id: String,
    pub variants: Vec<VariantResult>,
}

#[derive(Serialize)]
pub struct VariantResult {
    pub name: String,
    pub participants: u64,
    pub conversions: u64,
    pub conversion_rate: f64,
}
```

## Real-Time Flag Updates

```rust
pub struct RealtimeFlags {
    client: FerriteClient,
    local_cache: DashMap<String, FeatureConfig>,
}

impl RealtimeFlags {
    pub async fn new(client: FerriteClient) -> Self {
        let flags = Self {
            client: client.clone(),
            local_cache: DashMap::new(),
        };

        // Subscribe to flag changes
        let cache = flags.local_cache.clone();
        let client_clone = client.clone();

        tokio::spawn(async move {
            let mut subscriber = client_clone.subscribe("feature_changes").await.unwrap();

            while let Some(msg) = subscriber.next().await {
                if let Ok(notification) = serde_json::from_str::<serde_json::Value>(&msg) {
                    if let Some(feature) = notification["feature"].as_str() {
                        // Invalidate cache
                        cache.remove(feature);
                        tracing::info!("Invalidated feature flag: {}", feature);
                    }
                }
            }
        });

        flags
    }

    pub async fn is_enabled(
        &self,
        feature: &str,
        context: &EvaluationContext,
    ) -> Result<bool> {
        // Check local cache first
        if let Some(config) = self.local_cache.get(feature) {
            return self.evaluate_config(&config, context);
        }

        // Fetch from Ferrite
        let key = format!("feature:{}", feature);
        let config: FeatureConfig = match self.client.get(&key).await? {
            Some(json) => serde_json::from_str(&json)?,
            None => return Ok(false),
        };

        // Cache locally
        self.local_cache.insert(feature.to_string(), config.clone());

        self.evaluate_config(&config, context)
    }

    fn evaluate_config(
        &self,
        config: &FeatureConfig,
        context: &EvaluationContext,
    ) -> Result<bool> {
        // Evaluation logic...
        Ok(config.enabled)
    }
}
```

## SDK Integration

```rust
// Feature flag SDK for application use
pub struct FeatureFlagSDK {
    flags: Arc<RealtimeFlags>,
    default_context: EvaluationContext,
}

impl FeatureFlagSDK {
    pub async fn init(ferrite_url: &str) -> Result<Self> {
        let client = FerriteClient::connect(ferrite_url).await?;
        let flags = RealtimeFlags::new(client).await;

        Ok(Self {
            flags: Arc::new(flags),
            default_context: EvaluationContext::default(),
        })
    }

    pub fn with_context(mut self, context: EvaluationContext) -> Self {
        self.default_context = context;
        self
    }

    /// Check if feature is enabled
    pub async fn is_enabled(&self, feature: &str) -> bool {
        self.flags.is_enabled(feature, &self.default_context)
            .await
            .unwrap_or(false)
    }

    /// Check with override context
    pub async fn is_enabled_for(&self, feature: &str, context: &EvaluationContext) -> bool {
        self.flags.is_enabled(feature, context)
            .await
            .unwrap_or(false)
    }

    /// Get variant for user
    pub async fn get_variant(&self, feature: &str) -> Option<Variant> {
        // Implementation...
        None
    }
}

// Usage example
async fn example_usage() {
    let sdk = FeatureFlagSDK::init("ferrite://localhost:6379").await.unwrap();

    if sdk.is_enabled("new_checkout_flow").await {
        // Show new checkout
    } else {
        // Show old checkout
    }
}
```

## Best Practices

### 1. Use Meaningful Flag Names

```rust
// Good
"enable_dark_mode"
"new_checkout_v2"
"premium_analytics_dashboard"

// Bad
"flag1"
"test"
"feature_x"
```

### 2. Set Kill Switches

```rust
impl FeatureFlags {
    /// Emergency disable all features matching pattern
    pub async fn kill_switch(&self, pattern: &str) -> Result<u64> {
        let keys: Vec<String> = self.client.keys(&format!("feature:{}*", pattern)).await?;
        let mut disabled = 0;

        for key in keys {
            self.client.set(&key, "0").await?;
            disabled += 1;
        }

        // Notify all services
        self.client.publish("feature_kill_switch", pattern).await?;

        Ok(disabled)
    }
}
```

### 3. Clean Up Old Flags

```rust
impl FeatureFlags {
    /// Archive old flags
    pub async fn archive(&self, feature: &str) -> Result<()> {
        let key = format!("feature:{}", feature);
        let archive_key = format!("feature_archive:{}", feature);

        // Move to archive
        if let Some(config) = self.client.get(&key).await? {
            self.client.set(&archive_key, &config).await?;
            self.client.del(&key).await?;
        }

        Ok(())
    }
}
```

## Related Resources

- [Session Management Use Case](/docs/use-cases/session-management)
- [A/B Testing with Variants](#5-ab-testing-with-variants)
- [Pub/Sub Guide](/docs/guides/pub-sub)
- [Lua Scripting Guide](/docs/guides/lua-scripting)
