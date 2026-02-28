---
sidebar_position: 9
maturity: experimental
---

# Build a Multi-Tenant SaaS Platform

Learn how to build a multi-tenant SaaS application using Ferrite's tenant isolation features.

## What You'll Build

A complete multi-tenant platform with:
- Tenant isolation and data separation
- Per-tenant resource quotas
- Tenant-specific configuration
- Usage metering and billing
- Zero-downtime tenant migration

## Prerequisites

- Ferrite server running
- Understanding of multi-tenancy concepts

## Architecture

```text
┌─────────────────────────────────────────────────────────────┐
│                      API Gateway                             │
│                  (Tenant Identification)                     │
└─────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
        ▼                     ▼                     ▼
┌───────────────┐     ┌───────────────┐     ┌───────────────┐
│   Tenant A    │     │   Tenant B    │     │   Tenant C    │
│   Namespace   │     │   Namespace   │     │   Namespace   │
│ ─────────────-│     │ ──────────────│     │ ──────────────│
│ tenant:a:*    │     │ tenant:b:*    │     │ tenant:c:*    │
└───────────────┘     └───────────────┘     └───────────────┘
        │                     │                     │
        └─────────────────────┼─────────────────────┘
                              │
                    ┌─────────────────┐
                    │     Ferrite     │
                    │  (Shared Infra) │
                    └─────────────────┘
```

## Step 1: Project Setup

```toml
# Cargo.toml
[dependencies]
ferrite-client = "0.1"
tokio = { version = "1", features = ["full"] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
uuid = { version = "1", features = ["v4"] }
chrono = { version = "0.4", features = ["serde"] }
axum = "0.6"
```

## Step 2: Define Tenant Models

```rust
// src/models.rs
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Tenant {
    pub id: String,
    pub name: String,
    pub plan: TenantPlan,
    pub config: TenantConfig,
    pub status: TenantStatus,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum TenantPlan {
    Free,
    Starter,
    Professional,
    Enterprise,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum TenantStatus {
    Active,
    Suspended,
    PendingDeletion,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TenantConfig {
    pub max_users: u32,
    pub max_storage_mb: u64,
    pub max_requests_per_day: u64,
    pub features: Vec<String>,
    pub custom_domain: Option<String>,
}

impl Default for TenantConfig {
    fn default() -> Self {
        Self {
            max_users: 5,
            max_storage_mb: 100,
            max_requests_per_day: 10000,
            features: vec!["basic".to_string()],
            custom_domain: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TenantUsage {
    pub tenant_id: String,
    pub period: String, // YYYY-MM
    pub requests: u64,
    pub storage_bytes: u64,
    pub users: u32,
    pub api_calls: std::collections::HashMap<String, u64>,
}
```

## Step 3: Tenant Management Service

```rust
// src/tenant_service.rs
use crate::models::*;
use ferrite_client::Client;
use chrono::Utc;
use uuid::Uuid;

pub struct TenantService {
    client: Client,
}

impl TenantService {
    pub async fn new(addr: &str) -> Result<Self, Box<dyn std::error::Error>> {
        let client = Client::connect(addr).await?;
        Ok(Self { client })
    }

    /// Create a new tenant
    pub async fn create_tenant(
        &self,
        name: &str,
        plan: TenantPlan,
    ) -> Result<Tenant, Box<dyn std::error::Error>> {
        let tenant_id = Uuid::new_v4().to_string();

        let config = match plan {
            TenantPlan::Free => TenantConfig {
                max_users: 3,
                max_storage_mb: 50,
                max_requests_per_day: 1000,
                features: vec!["basic".to_string()],
                custom_domain: None,
            },
            TenantPlan::Starter => TenantConfig {
                max_users: 10,
                max_storage_mb: 500,
                max_requests_per_day: 10000,
                features: vec!["basic".to_string(), "analytics".to_string()],
                custom_domain: None,
            },
            TenantPlan::Professional => TenantConfig {
                max_users: 50,
                max_storage_mb: 5000,
                max_requests_per_day: 100000,
                features: vec!["basic".to_string(), "analytics".to_string(), "api".to_string()],
                custom_domain: None,
            },
            TenantPlan::Enterprise => TenantConfig {
                max_users: u32::MAX,
                max_storage_mb: u64::MAX,
                max_requests_per_day: u64::MAX,
                features: vec!["all".to_string()],
                custom_domain: None,
            },
        };

        let tenant = Tenant {
            id: tenant_id.clone(),
            name: name.to_string(),
            plan,
            config,
            status: TenantStatus::Active,
            created_at: Utc::now(),
        };

        // Store tenant metadata
        self.client.set(
            &format!("tenant:{}", tenant_id),
            &serde_json::to_string(&tenant)?,
        ).await?;

        // Add to tenant index
        self.client.sadd("tenants:all", &[&tenant_id]).await?;

        // Initialize tenant namespace in Ferrite
        self.client.raw_command(&[
            "TENANT.CREATE",
            &tenant_id,
            "NAME",
            name,
            "CONFIG",
            &serde_json::to_string(&tenant.config)?,
        ]).await?;

        Ok(tenant)
    }

    /// Get tenant by ID
    pub async fn get_tenant(&self, tenant_id: &str) -> Result<Option<Tenant>, Box<dyn std::error::Error>> {
        let data: Option<String> = self.client.get(&format!("tenant:{}", tenant_id)).await?;
        Ok(data.and_then(|d| serde_json::from_str(&d).ok()))
    }

    /// Update tenant configuration
    pub async fn update_tenant(
        &self,
        tenant_id: &str,
        config: TenantConfig,
    ) -> Result<(), Box<dyn std::error::Error>> {
        if let Some(mut tenant) = self.get_tenant(tenant_id).await? {
            tenant.config = config.clone();

            self.client.set(
                &format!("tenant:{}", tenant_id),
                &serde_json::to_string(&tenant)?,
            ).await?;

            // Update Ferrite tenant limits
            self.client.raw_command(&[
                "TENANT.LIMITS.SET",
                tenant_id,
                "MEMORY",
                &format!("{}MB", config.max_storage_mb),
                "RATE",
                &format!("{}/day", config.max_requests_per_day),
            ]).await?;
        }

        Ok(())
    }

    /// Suspend a tenant
    pub async fn suspend_tenant(&self, tenant_id: &str) -> Result<(), Box<dyn std::error::Error>> {
        if let Some(mut tenant) = self.get_tenant(tenant_id).await? {
            tenant.status = TenantStatus::Suspended;

            self.client.set(
                &format!("tenant:{}", tenant_id),
                &serde_json::to_string(&tenant)?,
            ).await?;

            // Suspend in Ferrite
            self.client.raw_command(&[
                "TENANT.UPDATE",
                tenant_id,
                "STATUS",
                "suspended",
            ]).await?;
        }

        Ok(())
    }

    /// List all tenants
    pub async fn list_tenants(&self) -> Result<Vec<Tenant>, Box<dyn std::error::Error>> {
        let tenant_ids: Vec<String> = self.client.smembers("tenants:all").await?;

        let mut tenants = Vec::new();
        for id in tenant_ids {
            if let Some(tenant) = self.get_tenant(&id).await? {
                tenants.push(tenant);
            }
        }

        Ok(tenants)
    }
}
```

## Step 4: Tenant Context and Data Access

```rust
// src/tenant_context.rs
use ferrite_client::Client;

/// Wrapper that enforces tenant isolation
pub struct TenantClient {
    client: Client,
    tenant_id: String,
}

impl TenantClient {
    pub async fn new(addr: &str, tenant_id: &str) -> Result<Self, Box<dyn std::error::Error>> {
        let client = Client::connect(addr).await?;

        // Switch to tenant context
        client.raw_command(&["TENANT.USE", tenant_id]).await?;

        Ok(Self {
            client,
            tenant_id: tenant_id.to_string(),
        })
    }

    // All operations are now scoped to the tenant

    pub async fn set(&self, key: &str, value: &str) -> Result<(), Box<dyn std::error::Error>> {
        self.client.set(key, value).await?;
        Ok(())
    }

    pub async fn get(&self, key: &str) -> Result<Option<String>, Box<dyn std::error::Error>> {
        self.client.get(key).await
    }

    pub async fn hset(
        &self,
        key: &str,
        fields: &[(&str, &str)],
    ) -> Result<(), Box<dyn std::error::Error>> {
        self.client.hset(key, fields).await?;
        Ok(())
    }

    pub async fn hgetall(
        &self,
        key: &str,
    ) -> Result<std::collections::HashMap<String, String>, Box<dyn std::error::Error>> {
        self.client.hgetall(key).await
    }

    // Add more methods as needed...
}

/// Alternative: Prefix-based isolation (no Ferrite tenant commands needed)
pub struct PrefixedTenantClient {
    client: Client,
    prefix: String,
}

impl PrefixedTenantClient {
    pub async fn new(addr: &str, tenant_id: &str) -> Result<Self, Box<dyn std::error::Error>> {
        let client = Client::connect(addr).await?;

        Ok(Self {
            client,
            prefix: format!("tenant:{}:", tenant_id),
        })
    }

    fn prefixed_key(&self, key: &str) -> String {
        format!("{}{}", self.prefix, key)
    }

    pub async fn set(&self, key: &str, value: &str) -> Result<(), Box<dyn std::error::Error>> {
        self.client.set(&self.prefixed_key(key), value).await?;
        Ok(())
    }

    pub async fn get(&self, key: &str) -> Result<Option<String>, Box<dyn std::error::Error>> {
        self.client.get(&self.prefixed_key(key)).await
    }
}
```

## Step 5: Usage Metering Service

```rust
// src/metering.rs
use crate::models::*;
use ferrite_client::Client;
use chrono::Utc;

pub struct MeteringService {
    client: Client,
}

impl MeteringService {
    pub async fn new(addr: &str) -> Result<Self, Box<dyn std::error::Error>> {
        let client = Client::connect(addr).await?;
        Ok(Self { client })
    }

    /// Track API request for a tenant
    pub async fn track_request(
        &self,
        tenant_id: &str,
        endpoint: &str,
    ) -> Result<bool, Box<dyn std::error::Error>> {
        let period = Utc::now().format("%Y-%m").to_string();
        let date = Utc::now().format("%Y-%m-%d").to_string();

        // Use Lua script for atomic check and increment
        let script = r#"
            local tenant_id = ARGV[1]
            local endpoint = ARGV[2]
            local period = ARGV[3]
            local date = ARGV[4]
            local daily_limit = tonumber(ARGV[5])

            -- Get current daily count
            local daily_key = 'usage:' .. tenant_id .. ':requests:' .. date
            local current = tonumber(redis.call('GET', daily_key) or 0)

            -- Check limit
            if current >= daily_limit then
                return 0
            end

            -- Increment counters
            redis.call('INCR', daily_key)
            redis.call('EXPIRE', daily_key, 86400 * 2)

            -- Track by endpoint
            redis.call('HINCRBY', 'usage:' .. tenant_id .. ':endpoints:' .. period, endpoint, 1)

            -- Monthly total
            redis.call('HINCRBY', 'usage:' .. tenant_id .. ':' .. period, 'requests', 1)

            return 1
        "#;

        // Get tenant's limit
        let tenant_json: Option<String> = self.client.get(&format!("tenant:{}", tenant_id)).await?;
        let limit = tenant_json
            .and_then(|j| serde_json::from_str::<Tenant>(&j).ok())
            .map(|t| t.config.max_requests_per_day)
            .unwrap_or(1000);

        let allowed: i64 = self.client.eval(
            script,
            &[],
            &[tenant_id, endpoint, &period, &date, &limit.to_string()],
        ).await?;

        Ok(allowed == 1)
    }

    /// Track storage usage
    pub async fn update_storage(
        &self,
        tenant_id: &str,
        bytes_delta: i64,
    ) -> Result<u64, Box<dyn std::error::Error>> {
        let period = Utc::now().format("%Y-%m").to_string();
        let key = format!("usage:{}:{}", tenant_id, period);

        let new_total: i64 = self.client.hincrby(&key, "storage_bytes", bytes_delta).await?;

        Ok(new_total.max(0) as u64)
    }

    /// Get usage for a tenant
    pub async fn get_usage(
        &self,
        tenant_id: &str,
        period: &str,
    ) -> Result<TenantUsage, Box<dyn std::error::Error>> {
        let usage_key = format!("usage:{}:{}", tenant_id, period);
        let endpoints_key = format!("usage:{}:endpoints:{}", tenant_id, period);

        let data: std::collections::HashMap<String, String> = self.client
            .hgetall(&usage_key)
            .await?;

        let api_calls: std::collections::HashMap<String, u64> = self.client
            .hgetall::<std::collections::HashMap<String, String>>(&endpoints_key)
            .await?
            .into_iter()
            .filter_map(|(k, v)| v.parse().ok().map(|n| (k, n)))
            .collect();

        Ok(TenantUsage {
            tenant_id: tenant_id.to_string(),
            period: period.to_string(),
            requests: data.get("requests").and_then(|v| v.parse().ok()).unwrap_or(0),
            storage_bytes: data.get("storage_bytes").and_then(|v| v.parse().ok()).unwrap_or(0),
            users: data.get("users").and_then(|v| v.parse().ok()).unwrap_or(0),
            api_calls,
        })
    }

    /// Generate billing report
    pub async fn generate_billing_report(
        &self,
        tenant_id: &str,
        period: &str,
    ) -> Result<BillingReport, Box<dyn std::error::Error>> {
        let usage = self.get_usage(tenant_id, period).await?;
        let tenant = self.get_tenant(tenant_id).await?;

        let base_price = match tenant.as_ref().map(|t| &t.plan) {
            Some(TenantPlan::Free) => 0.0,
            Some(TenantPlan::Starter) => 29.0,
            Some(TenantPlan::Professional) => 99.0,
            Some(TenantPlan::Enterprise) => 499.0,
            None => 0.0,
        };

        // Calculate overage charges
        let config = tenant.as_ref().map(|t| &t.config);
        let storage_overage = if let Some(c) = config {
            let used_mb = usage.storage_bytes / (1024 * 1024);
            if used_mb > c.max_storage_mb {
                ((used_mb - c.max_storage_mb) as f64) * 0.10 // $0.10 per MB overage
            } else {
                0.0
            }
        } else {
            0.0
        };

        Ok(BillingReport {
            tenant_id: tenant_id.to_string(),
            period: period.to_string(),
            base_price,
            usage_charges: storage_overage,
            total: base_price + storage_overage,
            usage,
        })
    }

    async fn get_tenant(&self, tenant_id: &str) -> Result<Option<Tenant>, Box<dyn std::error::Error>> {
        let data: Option<String> = self.client.get(&format!("tenant:{}", tenant_id)).await?;
        Ok(data.and_then(|d| serde_json::from_str(&d).ok()))
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct BillingReport {
    pub tenant_id: String,
    pub period: String,
    pub base_price: f64,
    pub usage_charges: f64,
    pub total: f64,
    pub usage: TenantUsage,
}
```

## Step 6: API with Tenant Resolution

```rust
// src/api.rs
use axum::{
    extract::{Extension, Path},
    http::{Request, StatusCode, header},
    middleware::{self, Next},
    response::{Json, Response},
    routing::{get, post},
    Router,
};
use std::sync::Arc;

// Middleware to extract and validate tenant
pub async fn tenant_middleware<B>(
    mut request: Request<B>,
    next: Next<B>,
) -> Result<Response, StatusCode> {
    // Extract tenant from header, subdomain, or JWT
    let tenant_id = request.headers()
        .get("X-Tenant-ID")
        .and_then(|v| v.to_str().ok())
        .map(|s| s.to_string());

    // Or from subdomain
    let tenant_id = tenant_id.or_else(|| {
        request.headers()
            .get(header::HOST)
            .and_then(|v| v.to_str().ok())
            .and_then(|host| {
                let parts: Vec<&str> = host.split('.').collect();
                if parts.len() >= 3 {
                    Some(parts[0].to_string())
                } else {
                    None
                }
            })
    });

    match tenant_id {
        Some(id) => {
            request.extensions_mut().insert(TenantContext { tenant_id: id });
            Ok(next.run(request).await)
        }
        None => Err(StatusCode::BAD_REQUEST),
    }
}

#[derive(Clone)]
pub struct TenantContext {
    pub tenant_id: String,
}

pub fn create_router(
    tenant_service: Arc<TenantService>,
    metering: Arc<MeteringService>,
) -> Router {
    let tenant_routes = Router::new()
        .route("/data/:key", get(get_data).post(set_data))
        .route("/usage", get(get_usage))
        .layer(middleware::from_fn(tenant_middleware));

    let admin_routes = Router::new()
        .route("/tenants", get(list_tenants).post(create_tenant))
        .route("/tenants/:id", get(get_tenant))
        .route("/tenants/:id/suspend", post(suspend_tenant))
        .route("/tenants/:id/billing", get(get_billing));

    Router::new()
        .nest("/api", tenant_routes)
        .nest("/admin", admin_routes)
        .layer(Extension(tenant_service))
        .layer(Extension(metering))
}

async fn get_data(
    Extension(ctx): Extension<TenantContext>,
    Extension(metering): Extension<Arc<MeteringService>>,
    Path(key): Path<String>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    // Track usage
    if !metering.track_request(&ctx.tenant_id, "get").await.unwrap_or(false) {
        return Err(StatusCode::TOO_MANY_REQUESTS);
    }

    // Use tenant-scoped client
    let client = TenantClient::new("localhost:6379", &ctx.tenant_id)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let value = client.get(&key)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(json!({ "key": key, "value": value })))
}

async fn set_data(
    Extension(ctx): Extension<TenantContext>,
    Extension(metering): Extension<Arc<MeteringService>>,
    Path(key): Path<String>,
    Json(body): Json<serde_json::Value>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    // Track usage
    if !metering.track_request(&ctx.tenant_id, "set").await.unwrap_or(false) {
        return Err(StatusCode::TOO_MANY_REQUESTS);
    }

    let client = TenantClient::new("localhost:6379", &ctx.tenant_id)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let value = body.get("value")
        .and_then(|v| v.as_str())
        .ok_or(StatusCode::BAD_REQUEST)?;

    client.set(&key, value)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    // Update storage metrics
    metering.update_storage(&ctx.tenant_id, value.len() as i64)
        .await
        .ok();

    Ok(Json(json!({ "status": "ok" })))
}

// Admin endpoints
async fn create_tenant(
    Extension(service): Extension<Arc<TenantService>>,
    Json(body): Json<CreateTenantRequest>,
) -> Result<Json<Tenant>, StatusCode> {
    let tenant = service.create_tenant(&body.name, body.plan)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(tenant))
}

#[derive(Deserialize)]
struct CreateTenantRequest {
    name: String,
    plan: TenantPlan,
}
```

## Step 7: Main Application

```rust
// src/main.rs
use std::sync::Arc;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let tenant_service = Arc::new(TenantService::new("localhost:6379").await?);
    let metering = Arc::new(MeteringService::new("localhost:6379").await?);

    let app = create_router(tenant_service, metering);

    println!("Multi-tenant SaaS starting on http://localhost:3000");
    axum::Server::bind(&"0.0.0.0:3000".parse()?)
        .serve(app.into_make_service())
        .await?;

    Ok(())
}
```

## Usage Examples

### Create Tenant

```bash
curl -X POST http://localhost:3000/admin/tenants \
  -H "Content-Type: application/json" \
  -d '{"name": "Acme Corp", "plan": "Professional"}'
```

### Access Tenant Data

```bash
# Set data
curl -X POST http://localhost:3000/api/data/mykey \
  -H "X-Tenant-ID: acme-corp-uuid" \
  -H "Content-Type: application/json" \
  -d '{"value": "my data"}'

# Get data
curl http://localhost:3000/api/data/mykey \
  -H "X-Tenant-ID: acme-corp-uuid"
```

### Get Usage

```bash
curl http://localhost:3000/api/usage \
  -H "X-Tenant-ID: acme-corp-uuid"
```

## Related Resources

- [Tenant Commands](/docs/reference/commands/tenant) - Multi-tenancy commands
- [Multi-Tenancy Guide](/docs/multi-tenancy/overview) - Detailed guide
- [Security Guide](/docs/advanced/security) - Security best practices
