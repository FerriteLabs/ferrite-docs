---
sidebar_position: 10
maturity: experimental
---

# Build a Recommendation Engine

Learn how to build a real-time recommendation system using Ferrite's vector search and collaborative filtering capabilities.

## What You'll Build

A complete recommendation engine with:
- Content-based recommendations (vector similarity)
- Collaborative filtering (user behavior)
- Hybrid recommendations
- Real-time personalization
- A/B testing support

## Prerequisites

- Ferrite server running
- OpenAI API key (for embeddings)
- Understanding of recommendation systems

## Architecture

```
┌───────────────┐     ┌────────────────┐     ┌─────────────────────┐
│  User Events  │────▶│  Event Handler │────▶│      Ferrite        │
└───────────────┘     └────────────────┘     │                     │
                                             │  ┌───────────────┐  │
┌───────────────┐     ┌────────────────┐     │  │ Item Vectors  │  │
│ Product Data  │────▶│  Item Indexer  │────▶│  └───────────────┘  │
└───────────────┘     └────────────────┘     │  ┌───────────────┐  │
                                             │  │ User Profiles │  │
┌───────────────┐     ┌────────────────┐     │  └───────────────┘  │
│   User Query  │────▶│  Recommender   │◀───▶│  ┌───────────────┐  │
└───────────────┘     └────────────────┘     │  │  Interactions │  │
                             │               │  └───────────────┘  │
                             ▼               └─────────────────────┘
                    ┌────────────────┐
                    │ Recommendations│
                    └────────────────┘
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
reqwest = { version = "0.11", features = ["json"] }
```

## Step 2: Define Models

```rust
// src/models.rs
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Item {
    pub id: String,
    pub name: String,
    pub description: String,
    pub category: String,
    pub tags: Vec<String>,
    pub price: f64,
    pub metadata: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserProfile {
    pub user_id: String,
    pub preferences: Vec<String>,
    pub viewed_categories: std::collections::HashMap<String, u32>,
    pub price_range: (f64, f64),
    pub embedding: Option<Vec<f32>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Interaction {
    pub user_id: String,
    pub item_id: String,
    pub interaction_type: InteractionType,
    pub timestamp: DateTime<Utc>,
    pub metadata: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum InteractionType {
    View,
    Click,
    AddToCart,
    Purchase,
    Rating(f32),
    Like,
    Dislike,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Recommendation {
    pub item_id: String,
    pub item: Item,
    pub score: f32,
    pub reason: RecommendationReason,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum RecommendationReason {
    SimilarToViewed(String),
    PopularInCategory(String),
    FrequentlyBoughtTogether(String),
    PersonalizedForYou,
    Trending,
}
```

## Step 3: Item Indexing Service

```rust
// src/item_indexer.rs
use crate::models::*;
use crate::embeddings::EmbeddingService;
use ferrite_client::Client;

pub struct ItemIndexer {
    client: Client,
    embedding_service: EmbeddingService,
}

impl ItemIndexer {
    pub async fn new(addr: &str, openai_key: &str) -> Result<Self, Box<dyn std::error::Error>> {
        let client = Client::connect(addr).await?;
        let embedding_service = EmbeddingService::new(openai_key);

        // Create vector index for items
        client.vector_create_index(
            "items",
            1536,
            "hnsw",
            "cosine",
            json!({
                "m": 16,
                "ef_construction": 200
            }),
        ).await.ok();

        Ok(Self { client, embedding_service })
    }

    pub async fn index_item(&self, item: &Item) -> Result<(), Box<dyn std::error::Error>> {
        // Generate embedding from item description
        let text_for_embedding = format!(
            "{} {} {} {}",
            item.name,
            item.description,
            item.category,
            item.tags.join(" ")
        );
        let embedding = self.embedding_service.embed_one(&text_for_embedding).await?;

        // Store item data
        self.client.set(
            &format!("item:{}", item.id),
            &serde_json::to_string(item)?,
        ).await?;

        // Add to vector index
        self.client.vector_add(
            "items",
            &item.id,
            &embedding,
            json!({
                "name": item.name,
                "category": item.category,
                "tags": item.tags,
                "price": item.price
            }),
        ).await?;

        // Add to category index
        self.client.sadd(&format!("category:{}", item.category), &[&item.id]).await?;

        // Add to tag indexes
        for tag in &item.tags {
            self.client.sadd(&format!("tag:{}", tag), &[&item.id]).await?;
        }

        Ok(())
    }

    pub async fn get_item(&self, item_id: &str) -> Result<Option<Item>, Box<dyn std::error::Error>> {
        let data: Option<String> = self.client.get(&format!("item:{}", item_id)).await?;
        Ok(data.and_then(|d| serde_json::from_str(&d).ok()))
    }
}
```

## Step 4: Interaction Tracker

```rust
// src/interactions.rs
use crate::models::*;
use ferrite_client::Client;
use chrono::Utc;

pub struct InteractionTracker {
    client: Client,
}

impl InteractionTracker {
    pub async fn new(addr: &str) -> Result<Self, Box<dyn std::error::Error>> {
        let client = Client::connect(addr).await?;
        Ok(Self { client })
    }

    pub async fn track(&self, interaction: &Interaction) -> Result<(), Box<dyn std::error::Error>> {
        let weight = self.interaction_weight(&interaction.interaction_type);

        // Use Lua script for atomic updates
        let script = r#"
            local user_id = ARGV[1]
            local item_id = ARGV[2]
            local interaction_type = ARGV[3]
            local weight = tonumber(ARGV[4])
            local timestamp = ARGV[5]

            -- User's interaction history
            redis.call('ZADD', 'user:' .. user_id .. ':history', timestamp, item_id)
            redis.call('ZREMRANGEBYRANK', 'user:' .. user_id .. ':history', 0, -101) -- Keep last 100

            -- User's weighted item preferences
            redis.call('ZINCRBY', 'user:' .. user_id .. ':preferences', weight, item_id)

            -- Item's popularity
            redis.call('ZINCRBY', 'popularity:global', weight, item_id)
            redis.call('ZINCRBY', 'popularity:daily:' .. ARGV[6], weight, item_id)
            redis.call('EXPIRE', 'popularity:daily:' .. ARGV[6], 86400 * 2)

            -- Co-occurrence for "frequently bought together"
            if interaction_type == 'Purchase' or interaction_type == 'AddToCart' then
                local recent = redis.call('ZREVRANGE', 'user:' .. user_id .. ':cart', 0, 9)
                for _, other_item in ipairs(recent) do
                    if other_item ~= item_id then
                        redis.call('ZINCRBY', 'cooccur:' .. item_id, 1, other_item)
                        redis.call('ZINCRBY', 'cooccur:' .. other_item, 1, item_id)
                    end
                end
                redis.call('ZADD', 'user:' .. user_id .. ':cart', timestamp, item_id)
            end

            return 'OK'
        "#;

        let date = Utc::now().format("%Y-%m-%d").to_string();

        self.client.eval(
            script,
            &[],
            &[
                &interaction.user_id,
                &interaction.item_id,
                &format!("{:?}", interaction.interaction_type),
                &weight.to_string(),
                &interaction.timestamp.timestamp().to_string(),
                &date,
            ],
        ).await?;

        Ok(())
    }

    fn interaction_weight(&self, interaction_type: &InteractionType) -> f64 {
        match interaction_type {
            InteractionType::View => 1.0,
            InteractionType::Click => 2.0,
            InteractionType::AddToCart => 5.0,
            InteractionType::Purchase => 10.0,
            InteractionType::Rating(r) => *r as f64 * 2.0,
            InteractionType::Like => 3.0,
            InteractionType::Dislike => -3.0,
        }
    }

    pub async fn get_user_history(
        &self,
        user_id: &str,
        limit: usize,
    ) -> Result<Vec<String>, Box<dyn std::error::Error>> {
        let items: Vec<String> = self.client
            .zrevrange(&format!("user:{}:history", user_id), 0, limit as i64 - 1)
            .await?;
        Ok(items)
    }
}
```

## Step 5: Recommendation Engine

```rust
// src/recommender.rs
use crate::embeddings::EmbeddingService;
use crate::interactions::InteractionTracker;
use crate::item_indexer::ItemIndexer;
use crate::models::*;
use ferrite_client::Client;

pub struct RecommendationEngine {
    client: Client,
    item_indexer: ItemIndexer,
    interaction_tracker: InteractionTracker,
    embedding_service: EmbeddingService,
}

impl RecommendationEngine {
    pub async fn new(addr: &str, openai_key: &str) -> Result<Self, Box<dyn std::error::Error>> {
        let client = Client::connect(addr).await?;
        let item_indexer = ItemIndexer::new(addr, openai_key).await?;
        let interaction_tracker = InteractionTracker::new(addr).await?;
        let embedding_service = EmbeddingService::new(openai_key);

        Ok(Self {
            client,
            item_indexer,
            interaction_tracker,
            embedding_service,
        })
    }

    /// Get personalized recommendations for a user
    pub async fn recommend(
        &self,
        user_id: &str,
        limit: usize,
    ) -> Result<Vec<Recommendation>, Box<dyn std::error::Error>> {
        // Get multiple recommendation sources
        let (content_recs, collab_recs, popular_recs) = tokio::join!(
            self.content_based_recommendations(user_id, limit),
            self.collaborative_recommendations(user_id, limit),
            self.popular_recommendations(limit)
        );

        // Merge and rank
        let mut scored_items: std::collections::HashMap<String, (f32, RecommendationReason)> =
            std::collections::HashMap::new();

        // Content-based: 40% weight
        for rec in content_recs.unwrap_or_default() {
            scored_items
                .entry(rec.item_id.clone())
                .and_modify(|(s, _)| *s += rec.score * 0.4)
                .or_insert((rec.score * 0.4, rec.reason));
        }

        // Collaborative: 40% weight
        for rec in collab_recs.unwrap_or_default() {
            scored_items
                .entry(rec.item_id.clone())
                .and_modify(|(s, _)| *s += rec.score * 0.4)
                .or_insert((rec.score * 0.4, rec.reason));
        }

        // Popular: 20% weight
        for rec in popular_recs.unwrap_or_default() {
            scored_items
                .entry(rec.item_id.clone())
                .and_modify(|(s, _)| *s += rec.score * 0.2)
                .or_insert((rec.score * 0.2, rec.reason));
        }

        // Filter already interacted items
        let history = self.interaction_tracker.get_user_history(user_id, 100).await?;
        let history_set: std::collections::HashSet<_> = history.into_iter().collect();

        // Sort and build recommendations
        let mut items: Vec<_> = scored_items
            .into_iter()
            .filter(|(id, _)| !history_set.contains(id))
            .collect();

        items.sort_by(|a, b| b.1.0.partial_cmp(&a.1.0).unwrap());

        let mut recommendations = Vec::new();
        for (item_id, (score, reason)) in items.into_iter().take(limit) {
            if let Some(item) = self.item_indexer.get_item(&item_id).await? {
                recommendations.push(Recommendation {
                    item_id,
                    item,
                    score,
                    reason,
                });
            }
        }

        Ok(recommendations)
    }

    /// Content-based: Similar to items user has interacted with
    async fn content_based_recommendations(
        &self,
        user_id: &str,
        limit: usize,
    ) -> Result<Vec<Recommendation>, Box<dyn std::error::Error>> {
        let history = self.interaction_tracker.get_user_history(user_id, 10).await?;

        if history.is_empty() {
            return Ok(Vec::new());
        }

        let mut recommendations = Vec::new();

        // Find similar items for each recently viewed item
        for source_item_id in history.iter().take(5) {
            let similar = self.client.vector_search_by_id(
                "items",
                source_item_id,
                limit / 5 + 1,
            ).await?;

            for (item_id, score, _) in similar {
                if item_id != *source_item_id {
                    if let Some(item) = self.item_indexer.get_item(&item_id).await? {
                        recommendations.push(Recommendation {
                            item_id,
                            item,
                            score,
                            reason: RecommendationReason::SimilarToViewed(source_item_id.clone()),
                        });
                    }
                }
            }
        }

        Ok(recommendations)
    }

    /// Collaborative: Based on similar users' behavior
    async fn collaborative_recommendations(
        &self,
        user_id: &str,
        limit: usize,
    ) -> Result<Vec<Recommendation>, Box<dyn std::error::Error>> {
        // Get co-occurrence based recommendations
        let user_prefs: Vec<(String, f64)> = self.client
            .zrevrange_withscores(&format!("user:{}:preferences", user_id), 0, 9)
            .await?;

        let mut recommendations = Vec::new();

        for (item_id, _) in user_prefs {
            let cooccur: Vec<(String, f64)> = self.client
                .zrevrange_withscores(&format!("cooccur:{}", item_id), 0, 4)
                .await?;

            for (related_id, score) in cooccur {
                if let Some(item) = self.item_indexer.get_item(&related_id).await? {
                    recommendations.push(Recommendation {
                        item_id: related_id,
                        item,
                        score: score as f32 / 100.0,
                        reason: RecommendationReason::FrequentlyBoughtTogether(item_id.clone()),
                    });
                }
            }
        }

        Ok(recommendations)
    }

    /// Popular items
    async fn popular_recommendations(
        &self,
        limit: usize,
    ) -> Result<Vec<Recommendation>, Box<dyn std::error::Error>> {
        let popular: Vec<(String, f64)> = self.client
            .zrevrange_withscores("popularity:global", 0, limit as i64 - 1)
            .await?;

        let mut recommendations = Vec::new();
        let max_score = popular.first().map(|(_, s)| *s).unwrap_or(1.0);

        for (item_id, score) in popular {
            if let Some(item) = self.item_indexer.get_item(&item_id).await? {
                recommendations.push(Recommendation {
                    item_id,
                    item,
                    score: (score / max_score) as f32,
                    reason: RecommendationReason::Trending,
                });
            }
        }

        Ok(recommendations)
    }

    /// Get similar items
    pub async fn get_similar_items(
        &self,
        item_id: &str,
        limit: usize,
    ) -> Result<Vec<Recommendation>, Box<dyn std::error::Error>> {
        let similar = self.client.vector_search_by_id(
            "items",
            item_id,
            limit + 1,
        ).await?;

        let mut recommendations = Vec::new();
        for (id, score, _) in similar {
            if id != item_id {
                if let Some(item) = self.item_indexer.get_item(&id).await? {
                    recommendations.push(Recommendation {
                        item_id: id,
                        item,
                        score,
                        reason: RecommendationReason::SimilarToViewed(item_id.to_string()),
                    });
                }
            }
        }

        Ok(recommendations)
    }

    /// Semantic search for items
    pub async fn search(
        &self,
        query: &str,
        limit: usize,
        filters: Option<SearchFilters>,
    ) -> Result<Vec<Recommendation>, Box<dyn std::error::Error>> {
        let query_embedding = self.embedding_service.embed_one(query).await?;

        let filter = filters.map(|f| {
            let mut conditions = Vec::new();
            if let Some(category) = f.category {
                conditions.push(format!("category = '{}'", category));
            }
            if let Some(min_price) = f.min_price {
                conditions.push(format!("price >= {}", min_price));
            }
            if let Some(max_price) = f.max_price {
                conditions.push(format!("price <= {}", max_price));
            }
            conditions.join(" AND ")
        });

        let results = self.client.vector_search(
            "items",
            &query_embedding,
            limit,
            filter,
        ).await?;

        let mut recommendations = Vec::new();
        for (item_id, score, _) in results {
            if let Some(item) = self.item_indexer.get_item(&item_id).await? {
                recommendations.push(Recommendation {
                    item_id,
                    item,
                    score,
                    reason: RecommendationReason::PersonalizedForYou,
                });
            }
        }

        Ok(recommendations)
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchFilters {
    pub category: Option<String>,
    pub min_price: Option<f64>,
    pub max_price: Option<f64>,
    pub tags: Option<Vec<String>>,
}
```

## Step 6: API Server

```rust
// src/main.rs
use axum::{
    extract::{Extension, Path, Query},
    routing::{get, post},
    Json, Router,
};
use std::sync::Arc;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let openai_key = std::env::var("OPENAI_API_KEY")?;

    let engine = Arc::new(
        RecommendationEngine::new("localhost:6379", &openai_key).await?
    );

    let app = Router::new()
        .route("/items", post(index_item))
        .route("/track", post(track_interaction))
        .route("/recommend/:user_id", get(get_recommendations))
        .route("/similar/:item_id", get(get_similar))
        .route("/search", get(search_items))
        .layer(Extension(engine));

    println!("Recommendation engine starting on http://localhost:3000");
    axum::Server::bind(&"0.0.0.0:3000".parse()?)
        .serve(app.into_make_service())
        .await?;

    Ok(())
}

async fn index_item(
    Extension(engine): Extension<Arc<RecommendationEngine>>,
    Json(item): Json<Item>,
) -> Json<serde_json::Value> {
    match engine.item_indexer.index_item(&item).await {
        Ok(_) => Json(json!({"status": "indexed", "id": item.id})),
        Err(e) => Json(json!({"error": e.to_string()})),
    }
}

async fn track_interaction(
    Extension(engine): Extension<Arc<RecommendationEngine>>,
    Json(interaction): Json<Interaction>,
) -> Json<serde_json::Value> {
    match engine.interaction_tracker.track(&interaction).await {
        Ok(_) => Json(json!({"status": "tracked"})),
        Err(e) => Json(json!({"error": e.to_string()})),
    }
}

async fn get_recommendations(
    Extension(engine): Extension<Arc<RecommendationEngine>>,
    Path(user_id): Path<String>,
    Query(params): Query<RecommendParams>,
) -> Json<Vec<Recommendation>> {
    let limit = params.limit.unwrap_or(10);
    match engine.recommend(&user_id, limit).await {
        Ok(recs) => Json(recs),
        Err(_) => Json(vec![]),
    }
}

#[derive(Deserialize)]
struct RecommendParams {
    limit: Option<usize>,
}
```

## Usage

### Index Items

```bash
curl -X POST http://localhost:3000/items \
  -H "Content-Type: application/json" \
  -d '{
    "id": "prod-123",
    "name": "Wireless Headphones",
    "description": "Premium noise-canceling headphones with 30-hour battery",
    "category": "electronics",
    "tags": ["audio", "wireless", "headphones"],
    "price": 299.99,
    "metadata": {}
  }'
```

### Track Interaction

```bash
curl -X POST http://localhost:3000/track \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "user-456",
    "item_id": "prod-123",
    "interaction_type": "View",
    "timestamp": "2024-01-15T10:30:00Z"
  }'
```

### Get Recommendations

```bash
curl "http://localhost:3000/recommend/user-456?limit=10"
```

## Related Resources

- [Vector Commands](/docs/reference/commands/vector) - Vector operations
- [Sorted Sets Commands](/docs/reference/commands/sorted-sets) - Scoring and ranking
- [AI/ML Guide](/docs/ai-ml/overview) - AI capabilities
