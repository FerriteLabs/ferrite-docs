---
sidebar_position: 3
maturity: beta
---

# Build a Session Store

Learn how to build a secure, scalable session management system using Ferrite.

## What You'll Build

A production-ready session store with:
- Secure session tokens
- Sliding window expiration
- Session data storage
- Multi-device support
- Session revocation

## Prerequisites

- Ferrite server running
- Basic understanding of web authentication

## Architecture

```text
┌─────────────┐     ┌───────────┐     ┌─────────────┐
│   Browser   │────▶│  Web App  │────▶│   Ferrite   │
└─────────────┘     └───────────┘     └─────────────┘
       │                  │                  │
   Session Cookie    Validate Token    Store Session
```

## Data Model

```text
# Session storage
session:{token}                → Hash (user_id, data, created_at, last_access)
user:{user_id}:sessions        → Set of session tokens

# Optional: Session metadata
session:{token}:device         → String (device fingerprint)
session:{token}:ip             → String (last IP)
```

## Step 1: Project Setup

```rust
// Cargo.toml
[dependencies]
ferrite-client = "0.1"
tokio = { version = "1", features = ["full"] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
chrono = { version = "0.4", features = ["serde"] }
rand = "0.8"
base64 = "0.21"
sha2 = "0.10"
```

## Step 2: Session Service Implementation

```rust
// src/session.rs
use chrono::{DateTime, Duration, Utc};
use ferrite_client::Client;
use rand::Rng;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Session {
    pub token: String,
    pub user_id: String,
    pub data: HashMap<String, String>,
    pub created_at: DateTime<Utc>,
    pub last_access: DateTime<Utc>,
    pub expires_at: DateTime<Utc>,
    pub device_info: Option<DeviceInfo>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeviceInfo {
    pub user_agent: String,
    pub ip_address: String,
    pub device_type: String,
}

#[derive(Debug, Clone)]
pub struct SessionConfig {
    pub ttl_seconds: i64,
    pub sliding_window: bool,
    pub max_sessions_per_user: usize,
}

impl Default for SessionConfig {
    fn default() -> Self {
        Self {
            ttl_seconds: 24 * 60 * 60,  // 24 hours
            sliding_window: true,
            max_sessions_per_user: 10,
        }
    }
}

pub struct SessionStore {
    client: Client,
    config: SessionConfig,
}

impl SessionStore {
    pub async fn new(addr: &str, config: SessionConfig) -> Result<Self, Box<dyn std::error::Error>> {
        let client = Client::connect(addr).await?;
        Ok(Self { client, config })
    }

    /// Generate a secure session token
    fn generate_token() -> String {
        let mut rng = rand::thread_rng();
        let random_bytes: [u8; 32] = rng.gen();
        let timestamp = Utc::now().timestamp_nanos();

        let mut hasher = Sha256::new();
        hasher.update(random_bytes);
        hasher.update(timestamp.to_le_bytes());

        base64::encode_config(hasher.finalize(), base64::URL_SAFE_NO_PAD)
    }

    /// Create a new session
    pub async fn create(
        &self,
        user_id: &str,
        data: HashMap<String, String>,
        device_info: Option<DeviceInfo>,
    ) -> Result<Session, Box<dyn std::error::Error>> {
        let token = Self::generate_token();
        let now = Utc::now();
        let expires_at = now + Duration::seconds(self.config.ttl_seconds);

        let session = Session {
            token: token.clone(),
            user_id: user_id.to_string(),
            data,
            created_at: now,
            last_access: now,
            expires_at,
            device_info: device_info.clone(),
        };

        // Use Lua script for atomic creation
        let script = r#"
            local token = ARGV[1]
            local user_id = ARGV[2]
            local data = ARGV[3]
            local created_at = ARGV[4]
            local ttl = tonumber(ARGV[5])
            local max_sessions = tonumber(ARGV[6])

            -- Store session
            local session_key = 'session:' .. token
            redis.call('HSET', session_key,
                'user_id', user_id,
                'data', data,
                'created_at', created_at,
                'last_access', created_at
            )
            redis.call('EXPIRE', session_key, ttl)

            -- Add to user's sessions
            local user_sessions_key = 'user:' .. user_id .. ':sessions'
            redis.call('SADD', user_sessions_key, token)

            -- Enforce max sessions per user
            local sessions = redis.call('SMEMBERS', user_sessions_key)
            local active_count = 0
            local oldest_session = nil
            local oldest_time = nil

            for _, sess_token in ipairs(sessions) do
                local sess_key = 'session:' .. sess_token
                if redis.call('EXISTS', sess_key) == 1 then
                    active_count = active_count + 1
                    local created = redis.call('HGET', sess_key, 'created_at')
                    if oldest_time == nil or created < oldest_time then
                        oldest_time = created
                        oldest_session = sess_token
                    end
                else
                    -- Clean up stale session reference
                    redis.call('SREM', user_sessions_key, sess_token)
                end
            end

            -- Remove oldest session if over limit
            if active_count > max_sessions and oldest_session then
                redis.call('DEL', 'session:' .. oldest_session)
                redis.call('SREM', user_sessions_key, oldest_session)
            end

            return 'OK'
        "#;

        self.client.eval(
            script,
            &[],
            &[
                &token,
                user_id,
                &serde_json::to_string(&session.data)?,
                &now.to_rfc3339(),
                &self.config.ttl_seconds.to_string(),
                &self.config.max_sessions_per_user.to_string(),
            ],
        ).await?;

        // Store device info separately if provided
        if let Some(ref info) = device_info {
            self.client.set(
                &format!("session:{}:device", token),
                &serde_json::to_string(info)?,
            ).await?;
            self.client.expire(&format!("session:{}:device", token), self.config.ttl_seconds as usize).await?;
        }

        Ok(session)
    }

    /// Validate and optionally refresh a session
    pub async fn validate(&self, token: &str) -> Result<Option<Session>, Box<dyn std::error::Error>> {
        let session_key = format!("session:{}", token);

        // Get session data
        let data: Option<HashMap<String, String>> = self.client.hgetall(&session_key).await?;

        if let Some(session_data) = data {
            let user_id = session_data.get("user_id").cloned().unwrap_or_default();
            let stored_data: HashMap<String, String> = session_data.get("data")
                .and_then(|d| serde_json::from_str(d).ok())
                .unwrap_or_default();
            let created_at = session_data.get("created_at")
                .and_then(|t| DateTime::parse_from_rfc3339(t).ok())
                .map(|t| t.with_timezone(&Utc))
                .unwrap_or_else(Utc::now);

            // Update last access time if sliding window is enabled
            if self.config.sliding_window {
                let now = Utc::now();
                self.client.hset(&session_key, &[("last_access", &now.to_rfc3339())]).await?;
                self.client.expire(&session_key, self.config.ttl_seconds as usize).await?;

                // Also refresh device info TTL
                let device_key = format!("session:{}:device", token);
                if self.client.exists(&device_key).await? {
                    self.client.expire(&device_key, self.config.ttl_seconds as usize).await?;
                }
            }

            // Get device info
            let device_info: Option<DeviceInfo> = self.client
                .get::<String>(&format!("session:{}:device", token))
                .await?
                .and_then(|d| serde_json::from_str(&d).ok());

            let ttl: i64 = self.client.ttl(&session_key).await?;

            Ok(Some(Session {
                token: token.to_string(),
                user_id,
                data: stored_data,
                created_at,
                last_access: Utc::now(),
                expires_at: Utc::now() + Duration::seconds(ttl),
                device_info,
            }))
        } else {
            Ok(None)
        }
    }

    /// Update session data
    pub async fn update_data(
        &self,
        token: &str,
        data: HashMap<String, String>,
    ) -> Result<bool, Box<dyn std::error::Error>> {
        let session_key = format!("session:{}", token);

        if self.client.exists(&session_key).await? {
            self.client.hset(
                &session_key,
                &[("data", &serde_json::to_string(&data)?)],
            ).await?;
            Ok(true)
        } else {
            Ok(false)
        }
    }

    /// Destroy a session
    pub async fn destroy(&self, token: &str) -> Result<bool, Box<dyn std::error::Error>> {
        let session_key = format!("session:{}", token);

        // Get user_id first
        let user_id: Option<String> = self.client.hget(&session_key, "user_id").await?;

        if let Some(user_id) = user_id {
            // Remove from user's sessions
            self.client.srem(&format!("user:{}:sessions", user_id), &[token]).await?;
        }

        // Delete session
        let deleted: i64 = self.client.del(&[&session_key]).await?;
        self.client.del(&[&format!("session:{}:device", token)]).await?;

        Ok(deleted > 0)
    }

    /// Destroy all sessions for a user
    pub async fn destroy_all_for_user(&self, user_id: &str) -> Result<usize, Box<dyn std::error::Error>> {
        let sessions_key = format!("user:{}:sessions", user_id);
        let tokens: Vec<String> = self.client.smembers(&sessions_key).await?;

        let mut destroyed = 0;
        for token in &tokens {
            self.client.del(&[&format!("session:{}", token)]).await?;
            self.client.del(&[&format!("session:{}:device", token)]).await?;
            destroyed += 1;
        }

        // Clear the set
        self.client.del(&[&sessions_key]).await?;

        Ok(destroyed)
    }

    /// Get all active sessions for a user
    pub async fn get_user_sessions(&self, user_id: &str) -> Result<Vec<Session>, Box<dyn std::error::Error>> {
        let sessions_key = format!("user:{}:sessions", user_id);
        let tokens: Vec<String> = self.client.smembers(&sessions_key).await?;

        let mut sessions = Vec::new();
        for token in tokens {
            if let Some(session) = self.validate(&token).await? {
                sessions.push(session);
            } else {
                // Clean up stale reference
                self.client.srem(&sessions_key, &[&token]).await?;
            }
        }

        Ok(sessions)
    }

    /// Destroy sessions except the current one
    pub async fn destroy_other_sessions(
        &self,
        user_id: &str,
        current_token: &str,
    ) -> Result<usize, Box<dyn std::error::Error>> {
        let sessions_key = format!("user:{}:sessions", user_id);
        let tokens: Vec<String> = self.client.smembers(&sessions_key).await?;

        let mut destroyed = 0;
        for token in tokens {
            if token != current_token {
                if self.destroy(&token).await? {
                    destroyed += 1;
                }
            }
        }

        Ok(destroyed)
    }
}
```

## Step 3: Web Framework Integration (Axum Example)

```rust
// src/middleware.rs
use axum::{
    extract::{Extension, FromRequestParts},
    http::{request::Parts, StatusCode},
    response::{IntoResponse, Response},
};
use std::sync::Arc;

pub struct CurrentSession(pub Session);

#[async_trait]
impl<S> FromRequestParts<S> for CurrentSession
where
    S: Send + Sync,
{
    type Rejection = Response;

    async fn from_request_parts(parts: &mut Parts, state: &S) -> Result<Self, Self::Rejection> {
        // Get session store from extensions
        let Extension(store) = Extension::<Arc<SessionStore>>::from_request_parts(parts, state)
            .await
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR.into_response())?;

        // Get token from cookie
        let token = parts
            .headers
            .get("cookie")
            .and_then(|v| v.to_str().ok())
            .and_then(|cookies| {
                cookies
                    .split(';')
                    .find(|c| c.trim().starts_with("session="))
                    .map(|c| c.trim().trim_start_matches("session=").to_string())
            });

        match token {
            Some(token) => {
                match store.validate(&token).await {
                    Ok(Some(session)) => Ok(CurrentSession(session)),
                    Ok(None) => Err((StatusCode::UNAUTHORIZED, "Invalid session").into_response()),
                    Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR.into_response()),
                }
            }
            None => Err((StatusCode::UNAUTHORIZED, "No session").into_response()),
        }
    }
}
```

## Step 4: API Routes

```rust
// src/routes.rs
use axum::{
    extract::{Extension, Json},
    http::{header::SET_COOKIE, StatusCode},
    response::{IntoResponse, Response},
    routing::{get, post},
    Router,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;

#[derive(Deserialize)]
pub struct LoginRequest {
    pub username: String,
    pub password: String,
}

#[derive(Serialize)]
pub struct LoginResponse {
    pub user_id: String,
    pub expires_at: String,
}

pub async fn login(
    Extension(store): Extension<Arc<SessionStore>>,
    Json(req): Json<LoginRequest>,
) -> Response {
    // Verify credentials (simplified)
    let user_id = format!("user:{}", req.username);

    // Create session
    let mut data = HashMap::new();
    data.insert("username".to_string(), req.username);

    match store.create(&user_id, data, None).await {
        Ok(session) => {
            let cookie = format!(
                "session={}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age={}",
                session.token,
                store.config.ttl_seconds
            );

            (
                StatusCode::OK,
                [(SET_COOKIE, cookie)],
                Json(LoginResponse {
                    user_id: session.user_id,
                    expires_at: session.expires_at.to_rfc3339(),
                }),
            ).into_response()
        }
        Err(e) => {
            (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response()
        }
    }
}

pub async fn logout(
    Extension(store): Extension<Arc<SessionStore>>,
    CurrentSession(session): CurrentSession,
) -> Response {
    match store.destroy(&session.token).await {
        Ok(_) => {
            let cookie = "session=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0";
            (StatusCode::OK, [(SET_COOKIE, cookie.to_string())]).into_response()
        }
        Err(e) => {
            (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response()
        }
    }
}

pub async fn me(CurrentSession(session): CurrentSession) -> impl IntoResponse {
    Json(serde_json::json!({
        "user_id": session.user_id,
        "data": session.data,
        "created_at": session.created_at,
        "expires_at": session.expires_at,
    }))
}

pub async fn list_sessions(
    Extension(store): Extension<Arc<SessionStore>>,
    CurrentSession(session): CurrentSession,
) -> Response {
    match store.get_user_sessions(&session.user_id).await {
        Ok(sessions) => {
            let sessions: Vec<_> = sessions.iter().map(|s| {
                serde_json::json!({
                    "token_prefix": &s.token[..8],
                    "created_at": s.created_at,
                    "last_access": s.last_access,
                    "device_info": s.device_info,
                    "is_current": s.token == session.token,
                })
            }).collect();
            Json(sessions).into_response()
        }
        Err(e) => {
            (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response()
        }
    }
}

pub async fn logout_all_other(
    Extension(store): Extension<Arc<SessionStore>>,
    CurrentSession(session): CurrentSession,
) -> Response {
    match store.destroy_other_sessions(&session.user_id, &session.token).await {
        Ok(count) => {
            Json(serde_json::json!({
                "destroyed": count
            })).into_response()
        }
        Err(e) => {
            (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response()
        }
    }
}

pub fn create_router(store: Arc<SessionStore>) -> Router {
    Router::new()
        .route("/login", post(login))
        .route("/logout", post(logout))
        .route("/me", get(me))
        .route("/sessions", get(list_sessions))
        .route("/sessions/logout-others", post(logout_all_other))
        .layer(Extension(store))
}
```

## Step 5: Main Application

```rust
// src/main.rs
use axum::Server;
use std::sync::Arc;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let config = SessionConfig {
        ttl_seconds: 7 * 24 * 60 * 60,  // 1 week
        sliding_window: true,
        max_sessions_per_user: 5,
    };

    let store = Arc::new(SessionStore::new("localhost:6379", config).await?);
    let app = create_router(store);

    println!("Starting server on http://localhost:3000");
    Server::bind(&"0.0.0.0:3000".parse()?)
        .serve(app.into_make_service())
        .await?;

    Ok(())
}
```

## Security Best Practices

### 1. Token Security

```rust
// Use cryptographically secure random tokens
fn generate_secure_token() -> String {
    let mut rng = rand::thread_rng();
    let bytes: [u8; 32] = rng.gen();

    // Add server-side secret for additional security
    let secret = std::env::var("SESSION_SECRET").expect("SESSION_SECRET required");

    let mut hasher = Sha256::new();
    hasher.update(bytes);
    hasher.update(secret.as_bytes());
    hasher.update(Utc::now().timestamp_nanos().to_le_bytes());

    base64::encode_config(hasher.finalize(), base64::URL_SAFE_NO_PAD)
}
```

### 2. IP Binding (Optional)

```rust
pub async fn validate_with_ip(&self, token: &str, ip: &str) -> Result<Option<Session>, Error> {
    let session = self.validate(token).await?;

    if let Some(ref s) = session {
        if let Some(ref info) = s.device_info {
            if info.ip_address != ip {
                // Log suspicious activity
                log::warn!("Session {} used from different IP: {} vs {}", token, ip, info.ip_address);
                // Optionally invalidate session
                // self.destroy(token).await?;
                // return Ok(None);
            }
        }
    }

    Ok(session)
}
```

### 3. Rate Limiting

```rust
pub async fn create_with_rate_limit(
    &self,
    user_id: &str,
    data: HashMap<String, String>,
    device_info: Option<DeviceInfo>,
) -> Result<Session, Error> {
    let rate_key = format!("rate:session:create:{}", user_id);

    // Allow max 10 session creations per hour
    let count: i64 = self.client.incr(&rate_key).await?;
    if count == 1 {
        self.client.expire(&rate_key, 3600).await?;
    }

    if count > 10 {
        return Err(Error::RateLimited);
    }

    self.create(user_id, data, device_info).await
}
```

## Testing

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_session_lifecycle() {
        let store = SessionStore::new("localhost:6379", SessionConfig::default())
            .await
            .unwrap();

        // Create session
        let session = store.create("user:1", HashMap::new(), None).await.unwrap();
        assert!(!session.token.is_empty());

        // Validate session
        let validated = store.validate(&session.token).await.unwrap();
        assert!(validated.is_some());

        // Destroy session
        let destroyed = store.destroy(&session.token).await.unwrap();
        assert!(destroyed);

        // Session should no longer be valid
        let validated = store.validate(&session.token).await.unwrap();
        assert!(validated.is_none());
    }

    #[tokio::test]
    async fn test_max_sessions() {
        let config = SessionConfig {
            max_sessions_per_user: 2,
            ..Default::default()
        };
        let store = SessionStore::new("localhost:6379", config).await.unwrap();

        // Create 3 sessions
        store.create("user:max", HashMap::new(), None).await.unwrap();
        store.create("user:max", HashMap::new(), None).await.unwrap();
        store.create("user:max", HashMap::new(), None).await.unwrap();

        // Should only have 2 active sessions
        let sessions = store.get_user_sessions("user:max").await.unwrap();
        assert!(sessions.len() <= 2);
    }
}
```

## Next Steps

- Add refresh tokens for longer sessions
- Implement session fingerprinting
- Add audit logging
- Integrate with OAuth providers
- Add session clustering for high availability

## Related Resources

- [Strings Commands](/docs/reference/commands/strings) - Key-value storage
- [Hashes Commands](/docs/reference/commands/hashes) - Session data storage
- [Security Guide](/docs/advanced/security) - Security best practices
