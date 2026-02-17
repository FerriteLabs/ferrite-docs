---
maturity: beta
---

# Application Caching

Ferrite excels as a high-performance caching layer, offering sub-millisecond latency, flexible eviction policies, and advanced caching patterns that go beyond traditional key-value storage.

## Why Ferrite for Caching?

| Feature | Benefit |
|---------|---------|
| **Sub-millisecond latency** | P99 < 1ms for cache hits |
| **Tiered storage** | Hot/warm/cold data automatically managed |
| **Semantic caching** | Cache by meaning, not just exact match |
| **Built-in TTL** | Automatic expiration with lazy and active cleanup |
| **Memory efficiency** | Compact data structures, compression support |
| **Persistence** | Survive restarts without cold cache |

## Caching Patterns

### 1. Cache-Aside (Lazy Loading)

The most common pattern where the application manages the cache.

```rust
use ferrite::FerriteClient;
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize)]
struct User {
    id: u64,
    name: String,
    email: String,
}

struct CacheAside {
    cache: FerriteClient,
    db: Database,
    ttl: u64,
}

impl CacheAside {
    /// Get user with cache-aside pattern
    async fn get_user(&self, user_id: u64) -> Result<Option<User>> {
        let cache_key = format!("user:{}", user_id);

        // 1. Check cache first
        if let Some(cached) = self.cache.get(&cache_key).await? {
            let user: User = serde_json::from_str(&cached)?;
            return Ok(Some(user));
        }

        // 2. Cache miss - fetch from database
        let user = match self.db.get_user(user_id).await? {
            Some(u) => u,
            None => return Ok(None),
        };

        // 3. Populate cache for future requests
        let json = serde_json::to_string(&user)?;
        self.cache.set_ex(&cache_key, &json, self.ttl).await?;

        Ok(Some(user))
    }

    /// Update user and invalidate cache
    async fn update_user(&self, user: &User) -> Result<()> {
        // 1. Update database
        self.db.update_user(user).await?;

        // 2. Invalidate cache
        let cache_key = format!("user:{}", user.id);
        self.cache.del(&cache_key).await?;

        Ok(())
    }
}
```

### 2. Write-Through Cache

Writes go to both cache and database synchronously.

```rust
struct WriteThrough {
    cache: FerriteClient,
    db: Database,
    ttl: u64,
}

impl WriteThrough {
    async fn set_user(&self, user: &User) -> Result<()> {
        let cache_key = format!("user:{}", user.id);
        let json = serde_json::to_string(user)?;

        // Write to database first (source of truth)
        self.db.update_user(user).await?;

        // Then update cache
        self.cache.set_ex(&cache_key, &json, self.ttl).await?;

        Ok(())
    }

    async fn get_user(&self, user_id: u64) -> Result<Option<User>> {
        let cache_key = format!("user:{}", user_id);

        // Always try cache first
        if let Some(cached) = self.cache.get(&cache_key).await? {
            return Ok(Some(serde_json::from_str(&cached)?));
        }

        // Fallback to database
        self.db.get_user(user_id).await
    }
}
```

### 3. Write-Behind (Write-Back) Cache

Writes go to cache immediately, database is updated asynchronously.

```rust
use tokio::sync::mpsc;

struct WriteBehind {
    cache: FerriteClient,
    write_tx: mpsc::Sender<WriteOperation>,
}

enum WriteOperation {
    Set { key: String, value: String },
    Delete { key: String },
}

impl WriteBehind {
    async fn new(cache: FerriteClient, db: Database) -> Self {
        let (tx, mut rx) = mpsc::channel::<WriteOperation>(10000);

        // Background writer task
        tokio::spawn(async move {
            let mut batch = Vec::new();
            let mut interval = tokio::time::interval(Duration::from_millis(100));

            loop {
                tokio::select! {
                    Some(op) = rx.recv() => {
                        batch.push(op);

                        // Flush if batch is large
                        if batch.len() >= 100 {
                            Self::flush_batch(&db, &mut batch).await;
                        }
                    }
                    _ = interval.tick() => {
                        // Periodic flush
                        if !batch.is_empty() {
                            Self::flush_batch(&db, &mut batch).await;
                        }
                    }
                }
            }
        });

        Self { cache, write_tx: tx }
    }

    async fn set(&self, key: &str, value: &str) -> Result<()> {
        // Write to cache immediately
        self.cache.set(key, value).await?;

        // Queue database write
        self.write_tx.send(WriteOperation::Set {
            key: key.to_string(),
            value: value.to_string(),
        }).await?;

        Ok(())
    }

    async fn flush_batch(db: &Database, batch: &mut Vec<WriteOperation>) {
        for op in batch.drain(..) {
            match op {
                WriteOperation::Set { key, value } => {
                    let _ = db.set(&key, &value).await;
                }
                WriteOperation::Delete { key } => {
                    let _ = db.delete(&key).await;
                }
            }
        }
    }
}
```

### 4. Read-Through Cache

Cache manages loading from database automatically.

```rust
use std::sync::Arc;

trait DataLoader: Send + Sync {
    async fn load(&self, key: &str) -> Result<Option<String>>;
}

struct ReadThrough {
    cache: FerriteClient,
    loader: Arc<dyn DataLoader>,
    ttl: u64,
}

impl ReadThrough {
    async fn get(&self, key: &str) -> Result<Option<String>> {
        // Try cache first
        if let Some(value) = self.cache.get(key).await? {
            return Ok(Some(value));
        }

        // Load from source
        let value = match self.loader.load(key).await? {
            Some(v) => v,
            None => return Ok(None),
        };

        // Populate cache
        self.cache.set_ex(key, &value, self.ttl).await?;

        Ok(Some(value))
    }
}
```

## Advanced Caching Strategies

### Multi-Level Caching (L1/L2)

```rust
struct MultiLevelCache {
    l1: LocalCache,       // In-process cache
    l2: FerriteClient,    // Ferrite distributed cache
    l1_ttl: Duration,
    l2_ttl: u64,
}

impl MultiLevelCache {
    async fn get(&self, key: &str) -> Result<Option<String>> {
        // L1: Check local cache
        if let Some(value) = self.l1.get(key) {
            return Ok(Some(value));
        }

        // L2: Check Ferrite
        if let Some(value) = self.l2.get(key).await? {
            // Promote to L1
            self.l1.set(key, &value, self.l1_ttl);
            return Ok(Some(value));
        }

        Ok(None)
    }

    async fn set(&self, key: &str, value: &str) -> Result<()> {
        // Set in both levels
        self.l1.set(key, value, self.l1_ttl);
        self.l2.set_ex(key, value, self.l2_ttl).await?;
        Ok(())
    }

    async fn invalidate(&self, key: &str) -> Result<()> {
        self.l1.delete(key);
        self.l2.del(key).await?;
        Ok(())
    }
}
```

### Cache Stampede Prevention

Prevent multiple requests from hitting the database simultaneously when cache expires.

```rust
use tokio::sync::Mutex;
use std::collections::HashMap;

struct StampedeProtection {
    cache: FerriteClient,
    locks: Mutex<HashMap<String, Arc<Mutex<()>>>>,
}

impl StampedeProtection {
    async fn get_or_load<F, Fut>(&self, key: &str, loader: F) -> Result<String>
    where
        F: FnOnce() -> Fut,
        Fut: Future<Output = Result<String>>,
    {
        // Try cache first
        if let Some(value) = self.cache.get(key).await? {
            return Ok(value);
        }

        // Get or create lock for this key
        let lock = {
            let mut locks = self.locks.lock().await;
            locks.entry(key.to_string())
                .or_insert_with(|| Arc::new(Mutex::new(())))
                .clone()
        };

        // Only one request loads the data
        let _guard = lock.lock().await;

        // Double-check cache after acquiring lock
        if let Some(value) = self.cache.get(key).await? {
            return Ok(value);
        }

        // Load data
        let value = loader().await?;
        self.cache.set_ex(key, &value, 300).await?;

        // Clean up lock
        {
            let mut locks = self.locks.lock().await;
            locks.remove(key);
        }

        Ok(value)
    }
}
```

### Probabilistic Early Expiration

Refresh cache before TTL expires to avoid thundering herd.

```rust
use rand::Rng;

struct EarlyExpiration {
    cache: FerriteClient,
    beta: f64,  // Typically 1.0
}

impl EarlyExpiration {
    async fn get_with_early_refresh<F, Fut>(
        &self,
        key: &str,
        loader: F,
        ttl: u64,
    ) -> Result<String>
    where
        F: FnOnce() -> Fut,
        Fut: Future<Output = Result<String>>,
    {
        // Get value and TTL
        let value = self.cache.get(key).await?;
        let remaining_ttl = self.cache.ttl(key).await?.unwrap_or(0);

        if let Some(v) = value {
            // Calculate if we should refresh early
            let delta = ttl - remaining_ttl;
            let random: f64 = rand::thread_rng().gen();
            let xfetch = delta as f64 * self.beta * random.ln().abs();

            if remaining_ttl as f64 <= xfetch {
                // Refresh in background
                let cache = self.cache.clone();
                let key = key.to_string();
                tokio::spawn(async move {
                    if let Ok(new_value) = loader().await {
                        let _ = cache.set_ex(&key, &new_value, ttl).await;
                    }
                });
            }

            return Ok(v);
        }

        // Cache miss
        let value = loader().await?;
        self.cache.set_ex(key, &value, ttl).await?;
        Ok(value)
    }
}
```

## Caching Different Data Types

### Caching API Responses

```rust
use sha2::{Sha256, Digest};

struct ApiCache {
    cache: FerriteClient,
}

impl ApiCache {
    /// Cache API response with request-based key
    async fn cache_response(
        &self,
        method: &str,
        path: &str,
        query: &str,
        body: &[u8],
    ) -> String {
        let mut hasher = Sha256::new();
        hasher.update(method.as_bytes());
        hasher.update(path.as_bytes());
        hasher.update(query.as_bytes());
        hasher.update(body);
        format!("api:{:x}", hasher.finalize())
    }

    async fn get_cached(&self, key: &str) -> Result<Option<CachedResponse>> {
        if let Some(data) = self.cache.get(key).await? {
            return Ok(Some(serde_json::from_str(&data)?));
        }
        Ok(None)
    }

    async fn set_cached(
        &self,
        key: &str,
        response: &CachedResponse,
        ttl: u64,
    ) -> Result<()> {
        let json = serde_json::to_string(response)?;
        self.cache.set_ex(key, &json, ttl).await?;
        Ok(())
    }
}
```

### Caching Query Results

```rust
struct QueryCache {
    cache: FerriteClient,
}

impl QueryCache {
    async fn cached_query<T: Serialize + DeserializeOwned>(
        &self,
        query: &str,
        params: &[&str],
        ttl: u64,
        executor: impl FnOnce() -> Result<Vec<T>>,
    ) -> Result<Vec<T>> {
        // Create cache key from query and params
        let key = format!("query:{}:{}",
            query.replace(" ", "_"),
            params.join(",")
        );

        // Check cache
        if let Some(cached) = self.cache.get(&key).await? {
            return Ok(serde_json::from_str(&cached)?);
        }

        // Execute query
        let results = executor()?;

        // Cache results
        let json = serde_json::to_string(&results)?;
        self.cache.set_ex(&key, &json, ttl).await?;

        Ok(results)
    }

    /// Invalidate queries matching a pattern
    async fn invalidate_pattern(&self, pattern: &str) -> Result<u64> {
        let keys: Vec<String> = self.cache.keys(pattern).await?;
        let count = keys.len() as u64;
        for key in keys {
            self.cache.del(&key).await?;
        }
        Ok(count)
    }
}
```

### Caching with Tags

```rust
struct TaggedCache {
    cache: FerriteClient,
}

impl TaggedCache {
    /// Set value with tags for group invalidation
    async fn set_tagged(
        &self,
        key: &str,
        value: &str,
        tags: &[&str],
        ttl: u64,
    ) -> Result<()> {
        // Store the value
        self.cache.set_ex(key, value, ttl).await?;

        // Add key to each tag set
        for tag in tags {
            let tag_key = format!("tag:{}", tag);
            self.cache.sadd(&tag_key, key).await?;
        }

        Ok(())
    }

    /// Invalidate all keys with a specific tag
    async fn invalidate_tag(&self, tag: &str) -> Result<u64> {
        let tag_key = format!("tag:{}", tag);
        let keys: Vec<String> = self.cache.smembers(&tag_key).await?;
        let count = keys.len() as u64;

        for key in &keys {
            self.cache.del(key).await?;
        }

        // Clear the tag set
        self.cache.del(&tag_key).await?;

        Ok(count)
    }
}
```

## Semantic Caching

Cache by meaning rather than exact key match using vector similarity.

```rust
struct SemanticCache {
    cache: FerriteClient,
    similarity_threshold: f32,
}

impl SemanticCache {
    async fn get_similar(&self, query: &str) -> Result<Option<String>> {
        // Search for semantically similar cached queries
        let results: Vec<SearchResult> = self.cache.semantic_search(
            "cache_embeddings",
            query,
            1,
            self.similarity_threshold,
        ).await?;

        if let Some(result) = results.first() {
            // Get cached response
            let key = format!("semantic_cache:{}", result.id);
            return self.cache.get(&key).await;
        }

        Ok(None)
    }

    async fn set_semantic(
        &self,
        query: &str,
        response: &str,
        ttl: u64,
    ) -> Result<()> {
        let id = uuid::Uuid::new_v4().to_string();

        // Store embedding for similarity search
        self.cache.semantic_set(
            "cache_embeddings",
            &id,
            query,
        ).await?;

        // Store actual response
        let key = format!("semantic_cache:{}", id);
        self.cache.set_ex(&key, response, ttl).await?;

        Ok(())
    }
}
```

## Cache Metrics and Monitoring

```rust
use metrics::{counter, gauge, histogram};

struct MonitoredCache {
    cache: FerriteClient,
}

impl MonitoredCache {
    async fn get(&self, key: &str) -> Result<Option<String>> {
        let start = std::time::Instant::now();

        let result = self.cache.get(key).await?;

        // Record metrics
        let duration = start.elapsed().as_secs_f64();
        histogram!("cache_latency_seconds", "operation" => "get").record(duration);

        if result.is_some() {
            counter!("cache_hits_total").increment(1);
        } else {
            counter!("cache_misses_total").increment(1);
        }

        Ok(result)
    }

    async fn report_stats(&self) -> Result<CacheStats> {
        let info = self.cache.info("stats").await?;

        let stats = CacheStats {
            hits: parse_stat(&info, "keyspace_hits"),
            misses: parse_stat(&info, "keyspace_misses"),
            memory_used: parse_stat(&info, "used_memory"),
            keys: parse_stat(&info, "db0_keys"),
        };

        // Update Prometheus gauges
        gauge!("cache_hit_ratio").set(
            stats.hits as f64 / (stats.hits + stats.misses).max(1) as f64
        );
        gauge!("cache_memory_bytes").set(stats.memory_used as f64);
        gauge!("cache_keys_total").set(stats.keys as f64);

        Ok(stats)
    }
}
```

## Best Practices

### 1. Choose Appropriate TTLs

```rust
// Short TTL for frequently changing data
cache.set_ex("stock_price:AAPL", price, 5).await?;      // 5 seconds

// Medium TTL for user data
cache.set_ex(&user_key, &user_json, 300).await?;         // 5 minutes

// Long TTL for static content
cache.set_ex(&config_key, &config_json, 3600).await?;    // 1 hour

// Very long TTL for rarely changing data
cache.set_ex(&country_list, &json, 86400).await?;        // 24 hours
```

### 2. Use Appropriate Data Structures

```rust
// Simple values: Strings
cache.set("user:123:name", "Alice").await?;

// Counters: Use INCR for atomic updates
cache.incr("page_views:home").await?;

// Objects: Hashes for partial updates
cache.hset("user:123", "email", "alice@example.com").await?;
cache.hset("user:123", "last_login", &timestamp).await?;

// Lists: For ordered data
cache.lpush("recent_orders:user:123", &order_id).await?;
cache.ltrim("recent_orders:user:123", 0, 99).await?;  // Keep last 100

// Sets: For unique collections
cache.sadd("user:123:tags", "premium").await?;

// Sorted Sets: For ranked/scored data
cache.zadd("leaderboard", score, &user_id).await?;
```

### 3. Handle Cache Failures Gracefully

```rust
async fn get_with_fallback(&self, key: &str) -> Result<String> {
    // Try cache with timeout
    match tokio::time::timeout(
        Duration::from_millis(100),
        self.cache.get(key)
    ).await {
        Ok(Ok(Some(value))) => return Ok(value),
        Ok(Ok(None)) => { /* Cache miss, fall through */ }
        Ok(Err(e)) => {
            // Log cache error but don't fail
            tracing::warn!("Cache error: {}", e);
        }
        Err(_) => {
            // Timeout, log and continue
            tracing::warn!("Cache timeout for key: {}", key);
        }
    }

    // Fallback to database
    self.db.get(key).await
}
```

## Related Resources

- [Semantic Caching Guide](/docs/guides/semantic-caching)
- [Performance Tuning](/docs/operations/performance-tuning)
- [Configuration Reference](/docs/reference/configuration)
- [Session Management Use Case](/docs/use-cases/session-management)
