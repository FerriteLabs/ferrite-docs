---
sidebar_position: 4
maturity: beta
---

# Build a Rate Limiter

Learn how to implement various rate limiting algorithms using Ferrite's atomic operations.

## What You'll Build

Multiple rate limiting strategies:
- Fixed window counter
- Sliding window log
- Sliding window counter
- Token bucket
- Leaky bucket

## Prerequisites

- Ferrite server running
- Understanding of rate limiting concepts

## Rate Limiting Algorithms Overview

| Algorithm | Pros | Cons | Best For |
|-----------|------|------|----------|
| Fixed Window | Simple, low memory | Burst at window edges | Basic API limits |
| Sliding Log | Accurate | High memory | Strict rate limiting |
| Sliding Window | Good accuracy, low memory | More complex | Most use cases |
| Token Bucket | Allows bursts | Token calculation | Variable rate limits |
| Leaky Bucket | Smooth output | No burst support | Consistent processing |

## Step 1: Project Setup

```rust
// Cargo.toml
[dependencies]
ferrite-client = "0.1"
tokio = { version = "1", features = ["full"] }
chrono = "0.4"
```

## Step 2: Fixed Window Rate Limiter

The simplest approach - count requests per time window.

```rust
// src/fixed_window.rs
use ferrite_client::Client;
use chrono::Utc;

pub struct FixedWindowLimiter {
    client: Client,
    limit: u64,
    window_seconds: u64,
}

impl FixedWindowLimiter {
    pub async fn new(addr: &str, limit: u64, window_seconds: u64) -> Result<Self, Box<dyn std::error::Error>> {
        let client = Client::connect(addr).await?;
        Ok(Self { client, limit, window_seconds })
    }

    /// Check and increment counter, returns (allowed, remaining, reset_at)
    pub async fn check(&self, key: &str) -> Result<(bool, u64, u64), Box<dyn std::error::Error>> {
        // Calculate window key
        let now = Utc::now().timestamp() as u64;
        let window = now / self.window_seconds;
        let window_key = format!("ratelimit:fixed:{}:{}", key, window);

        // Atomic increment with expiration
        let script = r#"
            local key = KEYS[1]
            local limit = tonumber(ARGV[1])
            local ttl = tonumber(ARGV[2])

            local current = redis.call('INCR', key)

            if current == 1 then
                redis.call('EXPIRE', key, ttl)
            end

            local remaining = limit - current
            if remaining < 0 then
                remaining = 0
            end

            return {current, remaining}
        "#;

        let result: Vec<i64> = self.client.eval(
            script,
            &[&window_key],
            &[&self.limit.to_string(), &self.window_seconds.to_string()],
        ).await?;

        let count = result[0] as u64;
        let remaining = result[1] as u64;
        let reset_at = (window + 1) * self.window_seconds;

        Ok((count <= self.limit, remaining, reset_at))
    }
}
```

## Step 3: Sliding Window Log Rate Limiter

More accurate but uses more memory - stores timestamps of each request.

```rust
// src/sliding_log.rs
use ferrite_client::Client;
use chrono::Utc;

pub struct SlidingLogLimiter {
    client: Client,
    limit: u64,
    window_seconds: u64,
}

impl SlidingLogLimiter {
    pub async fn new(addr: &str, limit: u64, window_seconds: u64) -> Result<Self, Box<dyn std::error::Error>> {
        let client = Client::connect(addr).await?;
        Ok(Self { client, limit, window_seconds })
    }

    pub async fn check(&self, key: &str) -> Result<(bool, u64, u64), Box<dyn std::error::Error>> {
        let now = Utc::now().timestamp_millis();
        let window_start = now - (self.window_seconds as i64 * 1000);
        let log_key = format!("ratelimit:log:{}", key);

        let script = r#"
            local key = KEYS[1]
            local now = tonumber(ARGV[1])
            local window_start = tonumber(ARGV[2])
            local limit = tonumber(ARGV[3])
            local window_ms = tonumber(ARGV[4])

            -- Remove old entries
            redis.call('ZREMRANGEBYSCORE', key, '-inf', window_start)

            -- Count current entries
            local count = redis.call('ZCARD', key)

            if count < limit then
                -- Add new entry
                redis.call('ZADD', key, now, now .. ':' .. math.random())
                redis.call('EXPIRE', key, math.ceil(window_ms / 1000) + 1)
                count = count + 1
                return {1, limit - count, 0}
            else
                -- Get oldest entry to calculate retry time
                local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
                local retry_after = 0
                if #oldest >= 2 then
                    retry_after = math.ceil((tonumber(oldest[2]) + window_ms - now) / 1000)
                end
                return {0, 0, retry_after}
            end
        "#;

        let result: Vec<i64> = self.client.eval(
            script,
            &[&log_key],
            &[
                &now.to_string(),
                &window_start.to_string(),
                &self.limit.to_string(),
                &(self.window_seconds * 1000).to_string(),
            ],
        ).await?;

        let allowed = result[0] == 1;
        let remaining = result[1] as u64;
        let retry_after = result[2] as u64;

        Ok((allowed, remaining, retry_after))
    }
}
```

## Step 4: Sliding Window Counter

Best balance of accuracy and memory efficiency.

```rust
// src/sliding_window.rs
use ferrite_client::Client;
use chrono::Utc;

pub struct SlidingWindowLimiter {
    client: Client,
    limit: u64,
    window_seconds: u64,
}

impl SlidingWindowLimiter {
    pub async fn new(addr: &str, limit: u64, window_seconds: u64) -> Result<Self, Box<dyn std::error::Error>> {
        let client = Client::connect(addr).await?;
        Ok(Self { client, limit, window_seconds })
    }

    pub async fn check(&self, key: &str) -> Result<(bool, u64, u64), Box<dyn std::error::Error>> {
        let now = Utc::now().timestamp() as u64;
        let current_window = now / self.window_seconds;
        let previous_window = current_window - 1;

        let current_key = format!("ratelimit:sw:{}:{}", key, current_window);
        let previous_key = format!("ratelimit:sw:{}:{}", key, previous_window);

        let script = r#"
            local current_key = KEYS[1]
            local previous_key = KEYS[2]
            local limit = tonumber(ARGV[1])
            local window_seconds = tonumber(ARGV[2])
            local now = tonumber(ARGV[3])
            local window_size = tonumber(ARGV[4])

            -- Get counts
            local current_count = tonumber(redis.call('GET', current_key) or 0)
            local previous_count = tonumber(redis.call('GET', previous_key) or 0)

            -- Calculate position in current window (0.0 to 1.0)
            local window_position = (now % window_size) / window_size

            -- Weighted count: previous window * remaining weight + current window
            local weighted_count = (previous_count * (1 - window_position)) + current_count

            if weighted_count < limit then
                -- Increment current window
                redis.call('INCR', current_key)
                redis.call('EXPIRE', current_key, window_seconds * 2)

                local remaining = limit - weighted_count - 1
                if remaining < 0 then remaining = 0 end

                return {1, remaining}
            else
                return {0, 0}
            end
        "#;

        let result: Vec<i64> = self.client.eval(
            script,
            &[&current_key, &previous_key],
            &[
                &self.limit.to_string(),
                &self.window_seconds.to_string(),
                &now.to_string(),
                &self.window_seconds.to_string(),
            ],
        ).await?;

        let allowed = result[0] == 1;
        let remaining = result[1] as u64;
        let reset_at = (current_window + 1) * self.window_seconds;

        Ok((allowed, remaining, reset_at))
    }
}
```

## Step 5: Token Bucket Rate Limiter

Allows bursts while maintaining average rate.

```rust
// src/token_bucket.rs
use ferrite_client::Client;
use chrono::Utc;

pub struct TokenBucketLimiter {
    client: Client,
    capacity: u64,          // Max tokens in bucket
    refill_rate: f64,       // Tokens per second
    tokens_per_request: u64, // Tokens consumed per request
}

impl TokenBucketLimiter {
    pub async fn new(
        addr: &str,
        capacity: u64,
        refill_rate: f64,
        tokens_per_request: u64,
    ) -> Result<Self, Box<dyn std::error::Error>> {
        let client = Client::connect(addr).await?;
        Ok(Self { client, capacity, refill_rate, tokens_per_request })
    }

    pub async fn check(&self, key: &str) -> Result<(bool, u64, f64), Box<dyn std::error::Error>> {
        let bucket_key = format!("ratelimit:bucket:{}", key);
        let now = Utc::now().timestamp_millis() as f64 / 1000.0;

        let script = r#"
            local key = KEYS[1]
            local capacity = tonumber(ARGV[1])
            local refill_rate = tonumber(ARGV[2])
            local tokens_needed = tonumber(ARGV[3])
            local now = tonumber(ARGV[4])

            -- Get current state
            local data = redis.call('HMGET', key, 'tokens', 'last_update')
            local tokens = tonumber(data[1]) or capacity
            local last_update = tonumber(data[2]) or now

            -- Calculate tokens to add based on time elapsed
            local elapsed = now - last_update
            local new_tokens = elapsed * refill_rate
            tokens = math.min(capacity, tokens + new_tokens)

            local allowed = 0
            local remaining = tokens

            if tokens >= tokens_needed then
                -- Consume tokens
                tokens = tokens - tokens_needed
                allowed = 1
                remaining = tokens
            end

            -- Save state
            redis.call('HMSET', key, 'tokens', tokens, 'last_update', now)
            redis.call('EXPIRE', key, math.ceil(capacity / refill_rate) + 1)

            -- Calculate time until next token
            local wait_time = 0
            if allowed == 0 then
                wait_time = (tokens_needed - tokens) / refill_rate
            end

            return {allowed, math.floor(remaining), tostring(wait_time)}
        "#;

        let result: Vec<String> = self.client.eval(
            script,
            &[&bucket_key],
            &[
                &self.capacity.to_string(),
                &self.refill_rate.to_string(),
                &self.tokens_per_request.to_string(),
                &now.to_string(),
            ],
        ).await?;

        let allowed = result[0] == "1";
        let remaining: u64 = result[1].parse().unwrap_or(0);
        let retry_after: f64 = result[2].parse().unwrap_or(0.0);

        Ok((allowed, remaining, retry_after))
    }
}
```

## Step 6: Leaky Bucket Rate Limiter

Processes requests at a constant rate.

```rust
// src/leaky_bucket.rs
use ferrite_client::Client;
use chrono::Utc;

pub struct LeakyBucketLimiter {
    client: Client,
    capacity: u64,      // Queue size
    leak_rate: f64,     // Requests processed per second
}

impl LeakyBucketLimiter {
    pub async fn new(
        addr: &str,
        capacity: u64,
        leak_rate: f64,
    ) -> Result<Self, Box<dyn std::error::Error>> {
        let client = Client::connect(addr).await?;
        Ok(Self { client, capacity, leak_rate })
    }

    pub async fn check(&self, key: &str) -> Result<(bool, u64, f64), Box<dyn std::error::Error>> {
        let bucket_key = format!("ratelimit:leaky:{}", key);
        let now = Utc::now().timestamp_millis() as f64 / 1000.0;

        let script = r#"
            local key = KEYS[1]
            local capacity = tonumber(ARGV[1])
            local leak_rate = tonumber(ARGV[2])
            local now = tonumber(ARGV[3])

            -- Get current state
            local data = redis.call('HMGET', key, 'water_level', 'last_update')
            local water = tonumber(data[1]) or 0
            local last_update = tonumber(data[2]) or now

            -- Leak water based on time elapsed
            local elapsed = now - last_update
            local leaked = elapsed * leak_rate
            water = math.max(0, water - leaked)

            local allowed = 0
            local queue_position = math.floor(water)

            if water < capacity then
                -- Add to bucket
                water = water + 1
                allowed = 1
                queue_position = math.floor(water)
            end

            -- Save state
            redis.call('HMSET', key, 'water_level', water, 'last_update', now)
            redis.call('EXPIRE', key, math.ceil(capacity / leak_rate) + 1)

            -- Calculate wait time
            local wait_time = 0
            if allowed == 0 then
                -- Time for one unit to leak
                wait_time = (water - capacity + 1) / leak_rate
            else
                -- Time until this request is processed
                wait_time = water / leak_rate
            end

            return {allowed, capacity - math.floor(water), tostring(wait_time)}
        "#;

        let result: Vec<String> = self.client.eval(
            script,
            &[&bucket_key],
            &[
                &self.capacity.to_string(),
                &self.leak_rate.to_string(),
                &now.to_string(),
            ],
        ).await?;

        let allowed = result[0] == "1";
        let remaining: u64 = result[1].parse().unwrap_or(0);
        let wait_time: f64 = result[2].parse().unwrap_or(0.0);

        Ok((allowed, remaining, wait_time))
    }
}
```

## Step 7: Unified Rate Limiter Interface

```rust
// src/lib.rs
use async_trait::async_trait;

#[derive(Debug, Clone)]
pub struct RateLimitResult {
    pub allowed: bool,
    pub remaining: u64,
    pub reset_at: Option<u64>,
    pub retry_after: Option<f64>,
}

#[async_trait]
pub trait RateLimiter: Send + Sync {
    async fn check(&self, key: &str) -> Result<RateLimitResult, Box<dyn std::error::Error>>;

    async fn check_with_cost(&self, key: &str, cost: u64) -> Result<RateLimitResult, Box<dyn std::error::Error>> {
        // Default implementation: call check() `cost` times
        let mut result = self.check(key).await?;
        for _ in 1..cost {
            if !result.allowed {
                break;
            }
            result = self.check(key).await?;
        }
        Ok(result)
    }
}
```

## Step 8: HTTP Middleware

```rust
// src/middleware.rs
use axum::{
    body::Body,
    http::{Request, Response, StatusCode, header},
    middleware::Next,
};
use std::sync::Arc;

pub async fn rate_limit_middleware(
    Extension(limiter): Extension<Arc<dyn RateLimiter>>,
    request: Request<Body>,
    next: Next<Body>,
) -> Response<Body> {
    // Extract key (IP address or API key)
    let key = request
        .headers()
        .get("X-API-Key")
        .and_then(|v| v.to_str().ok())
        .map(|k| format!("api:{}", k))
        .unwrap_or_else(|| {
            request
                .headers()
                .get("X-Forwarded-For")
                .and_then(|v| v.to_str().ok())
                .map(|ip| format!("ip:{}", ip.split(',').next().unwrap_or("unknown")))
                .unwrap_or_else(|| "ip:unknown".to_string())
        });

    match limiter.check(&key).await {
        Ok(result) => {
            if result.allowed {
                let mut response = next.run(request).await;

                // Add rate limit headers
                let headers = response.headers_mut();
                headers.insert(
                    "X-RateLimit-Remaining",
                    result.remaining.to_string().parse().unwrap(),
                );
                if let Some(reset) = result.reset_at {
                    headers.insert(
                        "X-RateLimit-Reset",
                        reset.to_string().parse().unwrap(),
                    );
                }

                response
            } else {
                let mut response = Response::builder()
                    .status(StatusCode::TOO_MANY_REQUESTS)
                    .body(Body::from("Rate limit exceeded"))
                    .unwrap();

                let headers = response.headers_mut();
                headers.insert(
                    "X-RateLimit-Remaining",
                    "0".parse().unwrap(),
                );
                if let Some(retry_after) = result.retry_after {
                    headers.insert(
                        header::RETRY_AFTER,
                        (retry_after.ceil() as u64).to_string().parse().unwrap(),
                    );
                }

                response
            }
        }
        Err(_) => {
            // Allow request on error (fail open)
            next.run(request).await
        }
    }
}
```

## Step 9: Main Application

```rust
// src/main.rs
use axum::{routing::get, Router};
use std::sync::Arc;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Choose your rate limiter
    let limiter: Arc<dyn RateLimiter> = Arc::new(
        SlidingWindowLimiter::new("localhost:6379", 100, 60).await?
    );

    let app = Router::new()
        .route("/api/resource", get(handler))
        .layer(axum::middleware::from_fn(rate_limit_middleware))
        .layer(Extension(limiter));

    println!("Server starting on http://localhost:3000");
    axum::Server::bind(&"0.0.0.0:3000".parse()?)
        .serve(app.into_make_service())
        .await?;

    Ok(())
}

async fn handler() -> &'static str {
    "Hello, World!"
}
```

## Advanced: Distributed Rate Limiting

For multi-node deployments:

```rust
// src/distributed.rs
use ferrite_client::Client;

pub struct DistributedRateLimiter {
    clients: Vec<Client>,
    limit: u64,
    window_seconds: u64,
}

impl DistributedRateLimiter {
    pub async fn new(
        addrs: &[&str],
        limit: u64,
        window_seconds: u64,
    ) -> Result<Self, Box<dyn std::error::Error>> {
        let mut clients = Vec::new();
        for addr in addrs {
            clients.push(Client::connect(addr).await?);
        }
        Ok(Self { clients, limit, window_seconds })
    }

    pub async fn check(&self, key: &str) -> Result<(bool, u64), Box<dyn std::error::Error>> {
        // Per-node limit
        let per_node_limit = self.limit / self.clients.len() as u64;

        // Check local node first
        let local_idx = self.hash_key(key) % self.clients.len();
        let local_client = &self.clients[local_idx];

        let now = chrono::Utc::now().timestamp() as u64;
        let window = now / self.window_seconds;
        let window_key = format!("ratelimit:dist:{}:{}", key, window);

        let count: u64 = local_client.incr(&window_key).await?;
        if count == 1 {
            local_client.expire(&window_key, self.window_seconds as usize).await?;
        }

        let remaining = per_node_limit.saturating_sub(count);
        Ok((count <= per_node_limit, remaining))
    }

    fn hash_key(&self, key: &str) -> usize {
        use std::collections::hash_map::DefaultHasher;
        use std::hash::{Hash, Hasher};

        let mut hasher = DefaultHasher::new();
        key.hash(&mut hasher);
        hasher.finish() as usize
    }
}
```

## Testing

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_fixed_window_limiter() {
        let limiter = FixedWindowLimiter::new("localhost:6379", 5, 60).await.unwrap();

        // Should allow first 5 requests
        for i in 0..5 {
            let (allowed, remaining, _) = limiter.check("test-fixed").await.unwrap();
            assert!(allowed, "Request {} should be allowed", i);
            assert_eq!(remaining, 4 - i as u64);
        }

        // 6th request should be denied
        let (allowed, remaining, _) = limiter.check("test-fixed").await.unwrap();
        assert!(!allowed);
        assert_eq!(remaining, 0);
    }

    #[tokio::test]
    async fn test_token_bucket_burst() {
        let limiter = TokenBucketLimiter::new(
            "localhost:6379",
            10,     // capacity
            1.0,    // 1 token per second
            1,      // 1 token per request
        ).await.unwrap();

        // Should allow burst up to capacity
        for _ in 0..10 {
            let (allowed, _, _) = limiter.check("test-bucket").await.unwrap();
            assert!(allowed);
        }

        // 11th should be denied
        let (allowed, _, retry_after) = limiter.check("test-bucket").await.unwrap();
        assert!(!allowed);
        assert!(retry_after > 0.0);
    }
}
```

## Choosing the Right Algorithm

| Use Case | Recommended Algorithm |
|----------|----------------------|
| Simple API rate limiting | Fixed Window |
| Strict per-user limits | Sliding Window Counter |
| Precise rate control | Sliding Log |
| Allow occasional bursts | Token Bucket |
| Consistent throughput | Leaky Bucket |
| High-traffic APIs | Sliding Window Counter |
| Per-endpoint limits | Token Bucket with different rates |

## Related Resources

- [Strings Commands](/docs/reference/commands/strings) - INCR operations
- [Sorted Sets Commands](/docs/reference/commands/sorted-sets) - For sliding log
- [Scripting Commands](/docs/reference/commands/scripting) - Lua scripts
