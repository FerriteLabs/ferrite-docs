---
maturity: beta
---

# Session Management

Ferrite provides an ideal foundation for session management with its low latency, automatic expiration, and atomic operations. This guide covers patterns for building secure, scalable session stores.

## Why Ferrite for Sessions?

| Feature | Benefit |
|---------|---------|
| **Sub-millisecond access** | No auth latency overhead |
| **Automatic TTL** | Sessions expire automatically |
| **Atomic operations** | Safe concurrent updates |
| **Persistence** | Survive restarts without logout |
| **Replication** | High availability for sessions |
| **Pub/Sub** | Real-time session invalidation |

## Session Storage Patterns

### 1. Simple Session Store

```rust
use ferrite::FerriteClient;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Serialize, Deserialize, Clone)]
pub struct Session {
    pub id: String,
    pub user_id: u64,
    pub created_at: i64,
    pub last_accessed: i64,
    pub ip_address: String,
    pub user_agent: String,
    pub data: serde_json::Value,
}

pub struct SessionStore {
    client: FerriteClient,
    ttl: u64,  // Session TTL in seconds
}

impl SessionStore {
    pub fn new(client: FerriteClient, ttl_hours: u64) -> Self {
        Self {
            client,
            ttl: ttl_hours * 3600,
        }
    }

    /// Create a new session
    pub async fn create(
        &self,
        user_id: u64,
        ip: &str,
        user_agent: &str,
    ) -> Result<Session> {
        let now = chrono::Utc::now().timestamp();
        let session = Session {
            id: Uuid::new_v4().to_string(),
            user_id,
            created_at: now,
            last_accessed: now,
            ip_address: ip.to_string(),
            user_agent: user_agent.to_string(),
            data: serde_json::json!({}),
        };

        let key = format!("session:{}", session.id);
        let json = serde_json::to_string(&session)?;

        // Store session with TTL
        self.client.set_ex(&key, &json, self.ttl).await?;

        // Add to user's active sessions
        let user_sessions_key = format!("user:{}:sessions", user_id);
        self.client.sadd(&user_sessions_key, &session.id).await?;

        Ok(session)
    }

    /// Get and refresh session (sliding window)
    pub async fn get(&self, session_id: &str) -> Result<Option<Session>> {
        let key = format!("session:{}", session_id);

        let json = match self.client.get(&key).await? {
            Some(j) => j,
            None => return Ok(None),
        };

        let mut session: Session = serde_json::from_str(&json)?;
        session.last_accessed = chrono::Utc::now().timestamp();

        // Update and refresh TTL (sliding window)
        let updated_json = serde_json::to_string(&session)?;
        self.client.set_ex(&key, &updated_json, self.ttl).await?;

        Ok(Some(session))
    }

    /// Validate session exists without refreshing
    pub async fn validate(&self, session_id: &str) -> Result<bool> {
        let key = format!("session:{}", session_id);
        Ok(self.client.exists(&key).await? > 0)
    }

    /// Update session data
    pub async fn update_data(
        &self,
        session_id: &str,
        data: serde_json::Value,
    ) -> Result<bool> {
        let key = format!("session:{}", session_id);

        let json = match self.client.get(&key).await? {
            Some(j) => j,
            None => return Ok(false),
        };

        let mut session: Session = serde_json::from_str(&json)?;
        session.data = data;
        session.last_accessed = chrono::Utc::now().timestamp();

        let updated_json = serde_json::to_string(&session)?;
        self.client.set_ex(&key, &updated_json, self.ttl).await?;

        Ok(true)
    }

    /// Delete session (logout)
    pub async fn delete(&self, session_id: &str) -> Result<bool> {
        let key = format!("session:{}", session_id);

        // Get session to find user_id
        if let Some(json) = self.client.get(&key).await? {
            let session: Session = serde_json::from_str(&json)?;

            // Remove from user's sessions
            let user_sessions_key = format!("user:{}:sessions", session.user_id);
            self.client.srem(&user_sessions_key, session_id).await?;
        }

        // Delete session
        Ok(self.client.del(&key).await? > 0)
    }

    /// Delete all sessions for a user (logout everywhere)
    pub async fn delete_user_sessions(&self, user_id: u64) -> Result<u64> {
        let user_sessions_key = format!("user:{}:sessions", user_id);
        let session_ids: Vec<String> = self.client.smembers(&user_sessions_key).await?;

        let mut deleted = 0;
        for session_id in &session_ids {
            let key = format!("session:{}", session_id);
            deleted += self.client.del(&key).await?;
        }

        // Clear the user sessions set
        self.client.del(&user_sessions_key).await?;

        Ok(deleted)
    }

    /// Get all active sessions for a user
    pub async fn get_user_sessions(&self, user_id: u64) -> Result<Vec<Session>> {
        let user_sessions_key = format!("user:{}:sessions", user_id);
        let session_ids: Vec<String> = self.client.smembers(&user_sessions_key).await?;

        let mut sessions = Vec::new();
        let mut expired = Vec::new();

        for session_id in session_ids {
            let key = format!("session:{}", session_id);
            if let Some(json) = self.client.get(&key).await? {
                sessions.push(serde_json::from_str(&json)?);
            } else {
                expired.push(session_id);
            }
        }

        // Clean up expired session references
        for session_id in expired {
            self.client.srem(&user_sessions_key, &session_id).await?;
        }

        Ok(sessions)
    }
}
```

### 2. Hash-Based Session Store

Store session fields as hash entries for efficient partial updates.

```rust
pub struct HashSessionStore {
    client: FerriteClient,
    ttl: u64,
}

impl HashSessionStore {
    pub async fn create(
        &self,
        user_id: u64,
        ip: &str,
        user_agent: &str,
    ) -> Result<String> {
        let session_id = Uuid::new_v4().to_string();
        let key = format!("session:{}", session_id);
        let now = chrono::Utc::now().timestamp().to_string();

        // Store as hash for efficient field access
        self.client.hset_multiple(&key, &[
            ("user_id", &user_id.to_string()),
            ("created_at", &now),
            ("last_accessed", &now),
            ("ip_address", ip),
            ("user_agent", user_agent),
        ]).await?;

        // Set expiration
        self.client.expire(&key, self.ttl).await?;

        Ok(session_id)
    }

    /// Get specific field from session
    pub async fn get_field(&self, session_id: &str, field: &str) -> Result<Option<String>> {
        let key = format!("session:{}", session_id);
        self.client.hget(&key, field).await
    }

    /// Update specific field
    pub async fn set_field(
        &self,
        session_id: &str,
        field: &str,
        value: &str,
    ) -> Result<()> {
        let key = format!("session:{}", session_id);

        // Update field and last_accessed atomically
        let now = chrono::Utc::now().timestamp().to_string();
        self.client.hset_multiple(&key, &[
            (field, value),
            ("last_accessed", &now),
        ]).await?;

        // Refresh TTL
        self.client.expire(&key, self.ttl).await?;

        Ok(())
    }

    /// Increment a numeric field (e.g., request count)
    pub async fn increment_field(
        &self,
        session_id: &str,
        field: &str,
    ) -> Result<i64> {
        let key = format!("session:{}", session_id);
        self.client.hincrby(&key, field, 1).await
    }
}
```

### 3. Secure Token-Based Sessions

```rust
use ring::rand::{SecureRandom, SystemRandom};
use ring::hmac;

pub struct SecureSessionStore {
    client: FerriteClient,
    secret_key: hmac::Key,
    ttl: u64,
}

impl SecureSessionStore {
    pub fn new(client: FerriteClient, secret: &[u8], ttl: u64) -> Self {
        Self {
            client,
            secret_key: hmac::Key::new(hmac::HMAC_SHA256, secret),
            ttl,
        }
    }

    /// Generate cryptographically secure session token
    fn generate_token() -> Result<String> {
        let rng = SystemRandom::new();
        let mut token_bytes = [0u8; 32];
        rng.fill(&mut token_bytes)
            .map_err(|_| anyhow::anyhow!("Failed to generate random bytes"))?;
        Ok(base64::encode_config(token_bytes, base64::URL_SAFE_NO_PAD))
    }

    /// Create signed session token
    pub async fn create(&self, user_id: u64) -> Result<String> {
        let token = Self::generate_token()?;
        let session_id = Uuid::new_v4().to_string();

        // Create signature
        let data = format!("{}:{}", session_id, user_id);
        let signature = hmac::sign(&self.secret_key, data.as_bytes());
        let sig_b64 = base64::encode_config(signature.as_ref(), base64::URL_SAFE_NO_PAD);

        // Full token: token.session_id.signature
        let full_token = format!("{}.{}.{}", token, session_id, sig_b64);

        // Store session
        let key = format!("session:{}", session_id);
        let session_data = serde_json::json!({
            "user_id": user_id,
            "token_hash": sha256_hash(&token),
            "created_at": chrono::Utc::now().timestamp(),
        });

        self.client.set_ex(&key, &session_data.to_string(), self.ttl).await?;

        Ok(full_token)
    }

    /// Validate and parse token
    pub async fn validate(&self, full_token: &str) -> Result<Option<u64>> {
        let parts: Vec<&str> = full_token.split('.').collect();
        if parts.len() != 3 {
            return Ok(None);
        }

        let (token, session_id, signature) = (parts[0], parts[1], parts[2]);

        // Verify signature
        let data = format!("{}:{}", session_id, ""); // We'll verify user_id from storage
        let sig_bytes = base64::decode_config(signature, base64::URL_SAFE_NO_PAD)?;

        // Get session from storage
        let key = format!("session:{}", session_id);
        let session_json = match self.client.get(&key).await? {
            Some(j) => j,
            None => return Ok(None),
        };

        let session: serde_json::Value = serde_json::from_str(&session_json)?;
        let user_id = session["user_id"].as_u64().unwrap();
        let stored_token_hash = session["token_hash"].as_str().unwrap();

        // Verify token hash
        if sha256_hash(token) != stored_token_hash {
            return Ok(None);
        }

        // Verify signature
        let full_data = format!("{}:{}", session_id, user_id);
        if hmac::verify(&self.secret_key, full_data.as_bytes(), &sig_bytes).is_err() {
            return Ok(None);
        }

        // Refresh TTL
        self.client.expire(&key, self.ttl).await?;

        Ok(Some(user_id))
    }

    /// Revoke session
    pub async fn revoke(&self, full_token: &str) -> Result<bool> {
        let parts: Vec<&str> = full_token.split('.').collect();
        if parts.len() != 3 {
            return Ok(false);
        }

        let session_id = parts[1];
        let key = format!("session:{}", session_id);

        Ok(self.client.del(&key).await? > 0)
    }
}

fn sha256_hash(input: &str) -> String {
    use sha2::{Sha256, Digest};
    let mut hasher = Sha256::new();
    hasher.update(input.as_bytes());
    format!("{:x}", hasher.finalize())
}
```

## Multi-Device Session Management

```rust
pub struct MultiDeviceSessionStore {
    client: FerriteClient,
    max_sessions_per_user: usize,
    ttl: u64,
}

impl MultiDeviceSessionStore {
    pub async fn create(
        &self,
        user_id: u64,
        device: DeviceInfo,
    ) -> Result<Session> {
        // Check existing sessions
        let sessions = self.get_user_sessions(user_id).await?;

        // Enforce session limit (remove oldest if exceeded)
        if sessions.len() >= self.max_sessions_per_user {
            // Sort by last_accessed and remove oldest
            let mut sessions = sessions;
            sessions.sort_by_key(|s| s.last_accessed);

            for session in sessions.iter().take(sessions.len() - self.max_sessions_per_user + 1) {
                self.delete(&session.id).await?;
            }
        }

        // Create new session with device info
        let session = Session {
            id: Uuid::new_v4().to_string(),
            user_id,
            device_id: device.id,
            device_name: device.name,
            device_type: device.device_type,
            os: device.os,
            browser: device.browser,
            ip_address: device.ip,
            location: device.location,
            created_at: chrono::Utc::now().timestamp(),
            last_accessed: chrono::Utc::now().timestamp(),
            data: serde_json::json!({}),
        };

        let key = format!("session:{}", session.id);
        let json = serde_json::to_string(&session)?;
        self.client.set_ex(&key, &json, self.ttl).await?;

        // Track device -> session mapping
        let device_key = format!("device:{}:session", device.id);
        self.client.set(&device_key, &session.id).await?;

        // Add to user's sessions
        let user_key = format!("user:{}:sessions", user_id);
        self.client.sadd(&user_key, &session.id).await?;

        Ok(session)
    }

    /// Get session for specific device (login existing device)
    pub async fn get_device_session(&self, device_id: &str) -> Result<Option<Session>> {
        let device_key = format!("device:{}:session", device_id);

        if let Some(session_id) = self.client.get(&device_key).await? {
            return self.get(&session_id).await;
        }

        Ok(None)
    }

    /// Revoke specific device
    pub async fn revoke_device(&self, user_id: u64, device_id: &str) -> Result<bool> {
        let device_key = format!("device:{}:session", device_id);

        if let Some(session_id) = self.client.get(&device_key).await? {
            // Verify session belongs to user
            if let Some(session) = self.get(&session_id).await? {
                if session.user_id == user_id {
                    self.delete(&session_id).await?;
                    self.client.del(&device_key).await?;
                    return Ok(true);
                }
            }
        }

        Ok(false)
    }
}

#[derive(Clone)]
pub struct DeviceInfo {
    pub id: String,
    pub name: String,
    pub device_type: DeviceType,
    pub os: String,
    pub browser: String,
    pub ip: String,
    pub location: Option<String>,
}

#[derive(Clone, Serialize, Deserialize)]
pub enum DeviceType {
    Desktop,
    Mobile,
    Tablet,
    Unknown,
}
```

## Real-Time Session Invalidation

Use Pub/Sub for instant session invalidation across servers.

```rust
pub struct RealtimeSessionStore {
    client: FerriteClient,
    invalidation_channel: String,
}

impl RealtimeSessionStore {
    /// Publish invalidation event
    pub async fn invalidate_with_notify(&self, session_id: &str) -> Result<()> {
        // Delete session
        let key = format!("session:{}", session_id);
        self.client.del(&key).await?;

        // Notify all servers
        let event = serde_json::json!({
            "type": "invalidate",
            "session_id": session_id,
            "timestamp": chrono::Utc::now().timestamp_millis(),
        });

        self.client.publish(
            &self.invalidation_channel,
            &event.to_string(),
        ).await?;

        Ok(())
    }

    /// Subscribe to invalidation events
    pub async fn subscribe_invalidations<F>(
        &self,
        handler: F,
    ) -> Result<()>
    where
        F: Fn(String) + Send + 'static,
    {
        let mut subscriber = self.client.subscribe(&self.invalidation_channel).await?;

        tokio::spawn(async move {
            while let Some(msg) = subscriber.next().await {
                if let Ok(event) = serde_json::from_str::<serde_json::Value>(&msg) {
                    if let Some(session_id) = event["session_id"].as_str() {
                        handler(session_id.to_string());
                    }
                }
            }
        });

        Ok(())
    }
}

// In-memory session cache with invalidation
pub struct LocalSessionCache {
    sessions: DashMap<String, Session>,
    store: RealtimeSessionStore,
}

impl LocalSessionCache {
    pub async fn new(store: RealtimeSessionStore) -> Self {
        let cache = Self {
            sessions: DashMap::new(),
            store,
        };

        // Subscribe to invalidations
        let sessions = cache.sessions.clone();
        cache.store.subscribe_invalidations(move |session_id| {
            sessions.remove(&session_id);
        }).await.unwrap();

        cache
    }

    pub async fn get(&self, session_id: &str) -> Result<Option<Session>> {
        // Check local cache
        if let Some(session) = self.sessions.get(session_id) {
            return Ok(Some(session.clone()));
        }

        // Fetch from Ferrite
        if let Some(session) = self.store.get(session_id).await? {
            self.sessions.insert(session_id.to_string(), session.clone());
            return Ok(Some(session));
        }

        Ok(None)
    }
}
```

## Framework Integration

### Axum Middleware

```rust
use axum::{
    extract::{Request, State},
    middleware::Next,
    response::Response,
};

pub async fn session_middleware(
    State(store): State<Arc<SessionStore>>,
    mut request: Request,
    next: Next,
) -> Result<Response, StatusCode> {
    // Extract session token from cookie or header
    let token = extract_token(&request);

    if let Some(token) = token {
        if let Some(session) = store.get(&token).await
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        {
            // Add session to request extensions
            request.extensions_mut().insert(session);
        }
    }

    Ok(next.run(request).await)
}

fn extract_token(request: &Request) -> Option<String> {
    // Try Authorization header first
    if let Some(auth) = request.headers().get("Authorization") {
        if let Ok(value) = auth.to_str() {
            if value.starts_with("Bearer ") {
                return Some(value[7..].to_string());
            }
        }
    }

    // Try cookie
    if let Some(cookie) = request.headers().get("Cookie") {
        if let Ok(value) = cookie.to_str() {
            for part in value.split(';') {
                let part = part.trim();
                if part.starts_with("session=") {
                    return Some(part[8..].to_string());
                }
            }
        }
    }

    None
}

// Route handler with session
pub async fn protected_route(
    Extension(session): Extension<Session>,
) -> impl IntoResponse {
    Json(json!({
        "user_id": session.user_id,
        "message": "Welcome!"
    }))
}
```

### Actix-Web Middleware

```rust
use actix_web::{dev, Error, HttpMessage};

pub struct SessionMiddleware {
    store: Arc<SessionStore>,
}

impl<S, B> dev::Transform<S, ServiceRequest> for SessionMiddleware
where
    S: dev::Service<ServiceRequest, Response = ServiceResponse<B>, Error = Error>,
{
    // ... middleware implementation
}
```

## Security Best Practices

### 1. Session Fixation Prevention

```rust
impl SessionStore {
    /// Regenerate session ID after authentication
    pub async fn regenerate(&self, old_session_id: &str) -> Result<Option<String>> {
        // Get existing session
        let old_key = format!("session:{}", old_session_id);
        let session_json = match self.client.get(&old_key).await? {
            Some(j) => j,
            None => return Ok(None),
        };

        let mut session: Session = serde_json::from_str(&session_json)?;

        // Generate new session ID
        let new_session_id = Uuid::new_v4().to_string();
        session.id = new_session_id.clone();

        // Store with new ID
        let new_key = format!("session:{}", new_session_id);
        let new_json = serde_json::to_string(&session)?;
        self.client.set_ex(&new_key, &new_json, self.ttl).await?;

        // Delete old session
        self.client.del(&old_key).await?;

        // Update user sessions set
        let user_key = format!("user:{}:sessions", session.user_id);
        self.client.srem(&user_key, old_session_id).await?;
        self.client.sadd(&user_key, &new_session_id).await?;

        Ok(Some(new_session_id))
    }
}
```

### 2. Concurrent Session Limiting

```rust
impl SessionStore {
    pub async fn create_with_limit(
        &self,
        user_id: u64,
        max_sessions: usize,
    ) -> Result<Session> {
        let user_key = format!("user:{}:sessions", user_id);

        // Use WATCH for optimistic locking
        loop {
            self.client.watch(&user_key).await?;

            let sessions: Vec<String> = self.client.smembers(&user_key).await?;

            if sessions.len() >= max_sessions {
                // Abort and return error
                self.client.unwatch().await?;
                return Err(anyhow::anyhow!(
                    "Maximum sessions ({}) reached for user",
                    max_sessions
                ));
            }

            // Create session in transaction
            let result = self.client.multi()
                .set_ex(&format!("session:{}", session_id), &json, self.ttl)
                .sadd(&user_key, &session_id)
                .exec()
                .await;

            match result {
                Ok(_) => break,
                Err(e) if e.is_watch_error() => continue, // Retry
                Err(e) => return Err(e.into()),
            }
        }

        Ok(session)
    }
}
```

### 3. Audit Logging

```rust
impl SessionStore {
    pub async fn create_with_audit(
        &self,
        user_id: u64,
        ip: &str,
        user_agent: &str,
    ) -> Result<Session> {
        let session = self.create(user_id, ip, user_agent).await?;

        // Log session creation
        let audit = AuditLog {
            event: "session_created".to_string(),
            user_id,
            session_id: session.id.clone(),
            ip_address: ip.to_string(),
            user_agent: user_agent.to_string(),
            timestamp: chrono::Utc::now(),
        };

        // Store in audit log (time-series or stream)
        let audit_key = format!("audit:sessions:{}", user_id);
        self.client.xadd(
            &audit_key,
            "*",
            &[("data", &serde_json::to_string(&audit)?)],
        ).await?;

        Ok(session)
    }
}
```

## Related Resources

- [Build Session Store Tutorial](/docs/tutorials/build-session-store)
- [Security Guide](/docs/advanced/security)
- [Caching Use Case](/docs/use-cases/caching)
- [Build Rate Limiter Tutorial](/docs/tutorials/build-rate-limiter)
