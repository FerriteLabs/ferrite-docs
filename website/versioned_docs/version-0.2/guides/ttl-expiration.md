---
maturity: stable
---

# TTL and Key Expiration

Ferrite provides Redis-compatible key expiration (TTL - Time To Live) for automatic data cleanup. Keys can expire at a specific time or after a duration.

## Overview

Key expiration enables:

- **Automatic cleanup** - Remove stale data without manual intervention
- **Cache management** - Implement cache eviction policies
- **Session handling** - Expire user sessions automatically
- **Rate limiting** - Reset counters after time windows
- **Temporary data** - Store data that should self-destruct

## Setting Expiration

### With SET Command

```bash
# Expire in seconds
SET session:123 "data" EX 3600          # Expires in 1 hour

# Expire in milliseconds
SET session:123 "data" PX 60000         # Expires in 60 seconds

# Expire at Unix timestamp (seconds)
SET session:123 "data" EXAT 1735689600  # Expires at specific time

# Expire at Unix timestamp (milliseconds)
SET session:123 "data" PXAT 1735689600000

# Keep existing TTL when updating
SET session:123 "newdata" KEEPTTL
```

### With EXPIRE Command

```bash
# Set TTL on existing key
SET mykey "value"
EXPIRE mykey 3600        # Expire in 1 hour

# Set TTL in milliseconds
PEXPIRE mykey 60000      # Expire in 60 seconds

# Set expiration at specific time
EXPIREAT mykey 1735689600
PEXPIREAT mykey 1735689600000
```

### Conditional Expiration

```bash
# Only set if key has no TTL
EXPIRE mykey 3600 NX

# Only set if key already has TTL
EXPIRE mykey 3600 XX

# Only set if new TTL > current TTL
EXPIRE mykey 3600 GT

# Only set if new TTL < current TTL
EXPIRE mykey 3600 LT
```

## Checking Expiration

```bash
# Get remaining TTL in seconds
TTL mykey
# Returns: 3599 (seconds remaining)
# Returns: -1 (no expiration)
# Returns: -2 (key doesn't exist)

# Get remaining TTL in milliseconds
PTTL mykey

# Get absolute expiration time (Unix timestamp)
EXPIRETIME mykey
PEXPIRETIME mykey
```

## Removing Expiration

```bash
# Remove TTL (key becomes persistent)
PERSIST mykey
```

## Rust Usage

### Setting TTL

```rust
use ferrite::Client;
use std::time::Duration;

let client = Client::connect("localhost:6380").await?;

// Set with expiration
client.set_ex("session:123", "token", 3600).await?;  // 1 hour
client.set_px("session:123", "token", 60000).await?; // 60 seconds

// Set expiration on existing key
client.expire("mykey", 3600).await?;
client.pexpire("mykey", 60000).await?;

// Using Duration
client.set_with_options(
    "mykey",
    "value",
    SetOptions::new().ex(Duration::from_secs(3600)),
).await?;
```

### Checking TTL

```rust
// Get TTL in seconds
let ttl: i64 = client.ttl("mykey").await?;
match ttl {
    -2 => println!("Key doesn't exist"),
    -1 => println!("No expiration"),
    _ => println!("Expires in {} seconds", ttl),
}

// Get TTL as Duration
if let Some(duration) = client.ttl_duration("mykey").await? {
    println!("Expires in {:?}", duration);
}
```

### Removing TTL

```rust
// Make key persistent
let was_removed: bool = client.persist("mykey").await?;
```

## Python Usage

```python
from ferrite import Ferrite
import time

client = Ferrite(host="localhost", port=6380)

# Set with expiration
client.set("session:123", "token", ex=3600)     # 1 hour
client.set("session:123", "token", px=60000)    # 60 seconds
client.setex("session:123", 3600, "token")      # Alternative

# Set expiration on existing key
client.expire("mykey", 3600)
client.pexpire("mykey", 60000)

# Set expiration at specific time
client.expireat("mykey", int(time.time()) + 3600)

# Check TTL
ttl = client.ttl("mykey")
if ttl == -2:
    print("Key doesn't exist")
elif ttl == -1:
    print("No expiration")
else:
    print(f"Expires in {ttl} seconds")

# Remove expiration
client.persist("mykey")
```

## TypeScript Usage

```typescript
import { Ferrite } from "@ferrite/client";

const client = new Ferrite({ host: "localhost", port: 6380 });

// Set with expiration
await client.set("session:123", "token", { ex: 3600 });     // 1 hour
await client.set("session:123", "token", { px: 60000 });    // 60 seconds
await client.setEx("session:123", 3600, "token");           // Alternative

// Set expiration on existing key
await client.expire("mykey", 3600);
await client.pExpire("mykey", 60000);

// Check TTL
const ttl = await client.ttl("mykey");
if (ttl === -2) {
  console.log("Key doesn't exist");
} else if (ttl === -1) {
  console.log("No expiration");
} else {
  console.log(`Expires in ${ttl} seconds`);
}

// Remove expiration
await client.persist("mykey");
```

## Common Patterns

### Session Management

```rust
struct SessionManager {
    client: Client,
    session_ttl: Duration,
}

impl SessionManager {
    const SESSION_PREFIX: &'static str = "session:";

    // Create session with TTL
    async fn create(&self, user_id: &str) -> Result<String> {
        let token = Uuid::new_v4().to_string();
        let key = format!("{}{}", Self::SESSION_PREFIX, token);

        self.client.set_ex(
            &key,
            serde_json::to_string(&SessionData { user_id: user_id.to_string(), created: Utc::now() })?,
            self.session_ttl.as_secs() as usize,
        ).await?;

        Ok(token)
    }

    // Get session and refresh TTL
    async fn get(&self, token: &str) -> Result<Option<SessionData>> {
        let key = format!("{}{}", Self::SESSION_PREFIX, token);

        if let Some(data) = self.client.get(&key).await? {
            // Refresh TTL on access (sliding expiration)
            self.client.expire(&key, self.session_ttl.as_secs() as usize).await?;
            return Ok(Some(serde_json::from_str(&data)?));
        }

        Ok(None)
    }

    // Logout - delete immediately
    async fn destroy(&self, token: &str) -> Result<()> {
        let key = format!("{}{}", Self::SESSION_PREFIX, token);
        self.client.del(&key).await?;
        Ok(())
    }
}
```

### Cache with TTL

```rust
struct Cache {
    client: Client,
    default_ttl: Duration,
}

impl Cache {
    // Cache with default TTL
    async fn set<T: Serialize>(&self, key: &str, value: &T) -> Result<()> {
        self.client.set_ex(
            key,
            serde_json::to_string(value)?,
            self.default_ttl.as_secs() as usize,
        ).await?;
        Ok(())
    }

    // Cache with custom TTL
    async fn set_with_ttl<T: Serialize>(&self, key: &str, value: &T, ttl: Duration) -> Result<()> {
        self.client.set_ex(
            key,
            serde_json::to_string(value)?,
            ttl.as_secs() as usize,
        ).await?;
        Ok(())
    }

    // Get with TTL refresh
    async fn get_refresh<T: DeserializeOwned>(&self, key: &str) -> Result<Option<T>> {
        if let Some(data) = self.client.get(key).await? {
            self.client.expire(key, self.default_ttl.as_secs() as usize).await?;
            return Ok(Some(serde_json::from_str(&data)?));
        }
        Ok(None)
    }
}
```

### Rate Limiting with TTL

```rust
struct RateLimiter {
    client: Client,
    limit: u64,
    window: Duration,
}

impl RateLimiter {
    async fn is_allowed(&self, key: &str) -> Result<bool> {
        let count: u64 = self.client.incr(key).await?;

        if count == 1 {
            // First request, set window TTL
            self.client.expire(key, self.window.as_secs() as usize).await?;
        }

        Ok(count <= self.limit)
    }

    async fn get_remaining(&self, key: &str) -> Result<RateLimitInfo> {
        let count: u64 = self.client.get(key).await?.unwrap_or(0);
        let ttl: i64 = self.client.ttl(key).await?;

        Ok(RateLimitInfo {
            remaining: self.limit.saturating_sub(count),
            reset_in: if ttl > 0 { Duration::from_secs(ttl as u64) } else { self.window },
        })
    }
}
```

### Temporary Tokens

```rust
impl TokenService {
    // Create one-time token that expires
    async fn create_token(&self, data: &TokenData, ttl: Duration) -> Result<String> {
        let token = generate_secure_token();
        let key = format!("token:{}", token);

        self.client.set_ex(
            &key,
            serde_json::to_string(data)?,
            ttl.as_secs() as usize,
        ).await?;

        Ok(token)
    }

    // Verify and consume token (one-time use)
    async fn verify_and_consume(&self, token: &str) -> Result<Option<TokenData>> {
        let key = format!("token:{}", token);

        // Get and delete atomically
        let data: Option<String> = self.client.getdel(&key).await?;

        Ok(data.map(|d| serde_json::from_str(&d)).transpose()?)
    }
}
```

### Delayed Job Queue

```rust
impl DelayedQueue {
    // Add job to be processed after delay
    async fn enqueue(&self, job: &Job, delay: Duration) -> Result<()> {
        let execute_at = Utc::now() + chrono::Duration::from_std(delay)?;

        // Use sorted set with score = execution time
        self.client.zadd(
            "delayed_jobs",
            execute_at.timestamp_millis() as f64,
            serde_json::to_string(job)?,
        ).await?;

        Ok(())
    }

    // Get jobs ready for processing
    async fn get_ready(&self) -> Result<Vec<Job>> {
        let now = Utc::now().timestamp_millis() as f64;

        // Get and remove jobs with score <= now
        let jobs: Vec<String> = self.client.zrangebyscore_limit(
            "delayed_jobs",
            "-inf",
            &now.to_string(),
            0,
            100,
        ).await?;

        if !jobs.is_empty() {
            self.client.zremrangebyscore(
                "delayed_jobs",
                "-inf",
                &now.to_string(),
            ).await?;
        }

        Ok(jobs.iter()
            .map(|j| serde_json::from_str(j))
            .collect::<Result<Vec<_>, _>>()?)
    }
}
```

## Keyspace Notifications

Subscribe to expiration events:

```bash
# Enable keyspace notifications for expired events
CONFIG SET notify-keyspace-events Ex

# Subscribe to expiration events
PSUBSCRIBE __keyevent@0__:expired
```

```rust
// Listen for expired keys
let mut pubsub = client.psubscribe(&["__keyevent@*__:expired"]).await?;

while let Some(msg) = pubsub.next().await {
    let message = msg?;
    println!("Key expired: {}", message.payload);

    // Handle expiration (e.g., cleanup related data)
    handle_key_expired(&message.payload).await?;
}
```

## Expiration Mechanics

### How Expiration Works

Ferrite uses two strategies for key expiration:

1. **Lazy Expiration** - Keys are checked and deleted when accessed
2. **Active Expiration** - Background process samples and deletes expired keys

```
┌─────────────────────────────────────────────────────────────┐
│                    Expiration Strategies                     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   Lazy Expiration (on access):                              │
│   ┌──────────┐                                              │
│   │  Client  │──GET key──►┌──────────────┐                 │
│   │          │            │  Key expired? │                 │
│   │          │◄──nil──────│  Yes: Delete  │                 │
│   └──────────┘            └──────────────┘                 │
│                                                             │
│   Active Expiration (background):                           │
│   ┌──────────────────────────────────────────┐             │
│   │  Every 100ms:                            │             │
│   │  1. Sample 20 keys with TTL              │             │
│   │  2. Delete expired ones                  │             │
│   │  3. If >25% expired, repeat              │             │
│   └──────────────────────────────────────────┘             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Memory Implications

- Keys with TTL use slightly more memory (8 bytes for timestamp)
- Expired keys may persist briefly until cleaned up
- High expiration rates can cause CPU spikes during cleanup

## Best Practices

### 1. Use Appropriate TTL Values

```rust
// Too short - excessive overhead
client.set_ex("key", "value", 1).await?; // 1 second

// Too long - memory waste
client.set_ex("key", "value", 86400 * 365).await?; // 1 year

// Appropriate for use case
client.set_ex("session", "data", 3600).await?;      // Session: 1 hour
client.set_ex("cache:page", "html", 300).await?;    // Cache: 5 minutes
client.set_ex("rate:user:123", "5", 60).await?;     // Rate limit: 1 minute
```

### 2. Handle TTL in Pipeline Operations

```rust
// Set value and TTL atomically
let results = client.pipeline()
    .set("key", "value")
    .expire("key", 3600)
    .execute()
    .await?;

// Or use SET with EX option (single command)
client.set_ex("key", "value", 3600).await?;
```

### 3. Consider Sliding vs Fixed Expiration

```rust
// Fixed expiration - always expires at same time
client.set_ex("token", "data", 3600).await?;

// Sliding expiration - refresh on each access
async fn get_with_refresh(&self, key: &str, ttl: usize) -> Result<Option<String>> {
    if let Some(value) = self.client.get(key).await? {
        self.client.expire(key, ttl).await?;
        return Ok(Some(value));
    }
    Ok(None)
}
```

### 4. Use KEEPTTL for Updates

```rust
// Preserve TTL when updating value
client.set_with_options(
    "session:123",
    "updated_data",
    SetOptions::new().keep_ttl(),
).await?;
```

## Related Topics

- [Persistence](/docs/guides/persistence) - How TTL interacts with persistence
- [Memory Management](/docs/operations/performance-tuning) - Memory optimization
- [Tiered Storage](/docs/advanced/tiered-storage) - Storage tiers and eviction
- [CDC](/docs/event-driven/cdc) - Change data capture for events
