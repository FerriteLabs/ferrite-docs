---
sidebar_position: 2
maturity: beta
---

# Build a Gaming Leaderboard

Learn how to build a real-time gaming leaderboard using Ferrite's sorted sets with sub-millisecond ranking queries.

## What You'll Build

A high-performance leaderboard system with:
- Real-time score updates
- Instant rank lookups
- Time-based leaderboards (daily, weekly, all-time)
- Player statistics
- Achievement tracking

## Prerequisites

- Ferrite server running locally
- Rust installed
- Basic understanding of sorted sets

## Architecture Overview

```text
┌──────────────┐     ┌──────────────────┐     ┌──────────────┐
│  Game Server │────▶│     Ferrite      │◀────│   API Server │
└──────────────┘     │                  │     └──────────────┘
       │             │  Sorted Sets:    │            │
       │             │  - Global scores │            │
       ▼             │  - Daily scores  │            ▼
   Score Updates     │  - Weekly scores │      Rank Queries
                     └──────────────────┘
```

## Data Model

### Key Patterns

```text
# Leaderboard scores (sorted sets)
leaderboard:global                    → ZSET (player_id -> score)
leaderboard:daily:{date}              → ZSET (player_id -> score)
leaderboard:weekly:{week}             → ZSET (player_id -> score)
leaderboard:game:{game_id}            → ZSET (player_id -> score)

# Player data
player:{player_id}                    → Hash (name, avatar, stats)
player:{player_id}:history            → List of recent scores
player:{player_id}:achievements       → Set of achievement IDs

# Game data
game:{game_id}:players                → Set of player IDs
game:{game_id}:high_score             → String (best score)
```

## Step 1: Project Setup

```bash
cargo new ferrite-leaderboard
cd ferrite-leaderboard
```

```toml
# Cargo.toml
[dependencies]
ferrite-client = "0.1"
tokio = { version = "1", features = ["full"] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
chrono = { version = "0.4", features = ["serde"] }
```

## Step 2: Define Models

```rust
// src/models.rs
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Player {
    pub id: String,
    pub name: String,
    pub avatar: Option<String>,
    pub stats: PlayerStats,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct PlayerStats {
    pub games_played: u64,
    pub total_score: u64,
    pub high_score: u64,
    pub wins: u64,
    pub losses: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LeaderboardEntry {
    pub rank: u64,
    pub player_id: String,
    pub player_name: String,
    pub score: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScoreSubmission {
    pub player_id: String,
    pub game_id: String,
    pub score: f64,
    pub timestamp: DateTime<Utc>,
}

#[derive(Debug, Clone, Copy)]
pub enum LeaderboardPeriod {
    Daily,
    Weekly,
    Monthly,
    AllTime,
}
```

## Step 3: Implement the Leaderboard Service

```rust
// src/leaderboard.rs
use crate::models::*;
use ferrite_client::Client;
use chrono::{Datelike, Utc};

pub struct LeaderboardService {
    client: Client,
}

impl LeaderboardService {
    pub async fn new(addr: &str) -> Result<Self, Box<dyn std::error::Error>> {
        let client = Client::connect(addr).await?;
        Ok(Self { client })
    }

    // Get leaderboard key for period
    fn get_leaderboard_key(&self, period: LeaderboardPeriod) -> String {
        let now = Utc::now();
        match period {
            LeaderboardPeriod::Daily => {
                format!("leaderboard:daily:{}", now.format("%Y-%m-%d"))
            }
            LeaderboardPeriod::Weekly => {
                format!("leaderboard:weekly:{}:{}", now.year(), now.iso_week().week())
            }
            LeaderboardPeriod::Monthly => {
                format!("leaderboard:monthly:{}", now.format("%Y-%m"))
            }
            LeaderboardPeriod::AllTime => {
                "leaderboard:global".to_string()
            }
        }
    }

    /// Submit a new score
    pub async fn submit_score(
        &self,
        submission: &ScoreSubmission,
    ) -> Result<u64, Box<dyn std::error::Error>> {
        // Use Lua script for atomic update
        let script = r#"
            local player_id = ARGV[1]
            local score = tonumber(ARGV[2])
            local game_id = ARGV[3]

            -- Update global leaderboard (keep max score)
            local current = redis.call('ZSCORE', 'leaderboard:global', player_id)
            if not current or score > tonumber(current) then
                redis.call('ZADD', 'leaderboard:global', score, player_id)
            end

            -- Update daily leaderboard
            local daily_key = KEYS[1]
            local daily_current = redis.call('ZSCORE', daily_key, player_id)
            if not daily_current or score > tonumber(daily_current) then
                redis.call('ZADD', daily_key, score, player_id)
            end
            redis.call('EXPIRE', daily_key, 86400 * 2)  -- 2 days TTL

            -- Update weekly leaderboard
            local weekly_key = KEYS[2]
            local weekly_current = redis.call('ZSCORE', weekly_key, player_id)
            if not weekly_current or score > tonumber(weekly_current) then
                redis.call('ZADD', weekly_key, score, player_id)
            end
            redis.call('EXPIRE', weekly_key, 86400 * 14)  -- 2 weeks TTL

            -- Update player stats
            local stats_key = 'player:' .. player_id
            redis.call('HINCRBY', stats_key, 'games_played', 1)
            redis.call('HINCRBY', stats_key, 'total_score', score)

            local high_score = tonumber(redis.call('HGET', stats_key, 'high_score') or 0)
            if score > high_score then
                redis.call('HSET', stats_key, 'high_score', score)
            end

            -- Add to score history
            local history_key = 'player:' .. player_id .. ':history'
            redis.call('LPUSH', history_key, cjson.encode({
                score = score,
                game_id = game_id,
                timestamp = ARGV[4]
            }))
            redis.call('LTRIM', history_key, 0, 99)  -- Keep last 100

            -- Get new rank
            local rank = redis.call('ZREVRANK', 'leaderboard:global', player_id)
            return rank + 1
        "#;

        let daily_key = self.get_leaderboard_key(LeaderboardPeriod::Daily);
        let weekly_key = self.get_leaderboard_key(LeaderboardPeriod::Weekly);

        let rank: u64 = self.client.eval(
            script,
            &[&daily_key, &weekly_key],
            &[
                &submission.player_id,
                &submission.score.to_string(),
                &submission.game_id,
                &submission.timestamp.to_rfc3339(),
            ],
        ).await?;

        Ok(rank)
    }

    /// Get player's current rank
    pub async fn get_rank(
        &self,
        player_id: &str,
        period: LeaderboardPeriod,
    ) -> Result<Option<u64>, Box<dyn std::error::Error>> {
        let key = self.get_leaderboard_key(period);
        let rank: Option<u64> = self.client.zrevrank(&key, player_id).await?;
        Ok(rank.map(|r| r + 1))  // 1-indexed
    }

    /// Get player's score
    pub async fn get_score(
        &self,
        player_id: &str,
        period: LeaderboardPeriod,
    ) -> Result<Option<f64>, Box<dyn std::error::Error>> {
        let key = self.get_leaderboard_key(period);
        let score: Option<f64> = self.client.zscore(&key, player_id).await?;
        Ok(score)
    }

    /// Get top N players
    pub async fn get_top(
        &self,
        period: LeaderboardPeriod,
        count: usize,
    ) -> Result<Vec<LeaderboardEntry>, Box<dyn std::error::Error>> {
        let key = self.get_leaderboard_key(period);

        let results: Vec<(String, f64)> = self.client
            .zrevrange_withscores(&key, 0, (count - 1) as i64)
            .await?;

        let mut entries = Vec::new();
        for (rank, (player_id, score)) in results.into_iter().enumerate() {
            let name = self.get_player_name(&player_id).await?;
            entries.push(LeaderboardEntry {
                rank: (rank + 1) as u64,
                player_id,
                player_name: name,
                score,
            });
        }

        Ok(entries)
    }

    /// Get players around a specific rank
    pub async fn get_around_rank(
        &self,
        player_id: &str,
        period: LeaderboardPeriod,
        range: usize,
    ) -> Result<Vec<LeaderboardEntry>, Box<dyn std::error::Error>> {
        let key = self.get_leaderboard_key(period);

        let rank: Option<i64> = self.client.zrevrank(&key, player_id).await?;

        if let Some(rank) = rank {
            let start = (rank - range as i64).max(0);
            let end = rank + range as i64;

            let results: Vec<(String, f64)> = self.client
                .zrevrange_withscores(&key, start, end)
                .await?;

            let mut entries = Vec::new();
            for (i, (pid, score)) in results.into_iter().enumerate() {
                let name = self.get_player_name(&pid).await?;
                entries.push(LeaderboardEntry {
                    rank: (start as u64 + i as u64 + 1),
                    player_id: pid,
                    player_name: name,
                    score,
                });
            }

            Ok(entries)
        } else {
            Ok(Vec::new())
        }
    }

    /// Get rank for a specific score (without submitting)
    pub async fn get_rank_for_score(
        &self,
        score: f64,
        period: LeaderboardPeriod,
    ) -> Result<u64, Box<dyn std::error::Error>> {
        let key = self.get_leaderboard_key(period);
        let count: u64 = self.client.zcount(&key, score, "+inf").await?;
        Ok(count + 1)
    }

    /// Get total player count
    pub async fn get_player_count(
        &self,
        period: LeaderboardPeriod,
    ) -> Result<u64, Box<dyn std::error::Error>> {
        let key = self.get_leaderboard_key(period);
        let count: u64 = self.client.zcard(&key).await?;
        Ok(count)
    }

    /// Get player percentile
    pub async fn get_percentile(
        &self,
        player_id: &str,
        period: LeaderboardPeriod,
    ) -> Result<Option<f64>, Box<dyn std::error::Error>> {
        let key = self.get_leaderboard_key(period);

        let rank: Option<u64> = self.client.zrevrank(&key, player_id).await?;
        let total: u64 = self.client.zcard(&key).await?;

        Ok(rank.map(|r| {
            let percentile = ((total - r) as f64 / total as f64) * 100.0;
            (percentile * 100.0).round() / 100.0
        }))
    }

    // Helper to get player name
    async fn get_player_name(&self, player_id: &str) -> Result<String, Box<dyn std::error::Error>> {
        let name: Option<String> = self.client
            .hget(&format!("player:{}", player_id), "name")
            .await?;
        Ok(name.unwrap_or_else(|| format!("Player {}", &player_id[..8.min(player_id.len())])))
    }

    /// Register a new player
    pub async fn register_player(
        &self,
        player_id: &str,
        name: &str,
    ) -> Result<(), Box<dyn std::error::Error>> {
        self.client.hset(
            &format!("player:{}", player_id),
            &[
                ("name", name),
                ("games_played", "0"),
                ("total_score", "0"),
                ("high_score", "0"),
                ("wins", "0"),
                ("losses", "0"),
            ],
        ).await?;
        Ok(())
    }

    /// Get player statistics
    pub async fn get_player_stats(
        &self,
        player_id: &str,
    ) -> Result<PlayerStats, Box<dyn std::error::Error>> {
        let data: std::collections::HashMap<String, String> = self.client
            .hgetall(&format!("player:{}", player_id))
            .await?
            .unwrap_or_default();

        Ok(PlayerStats {
            games_played: data.get("games_played")
                .and_then(|s| s.parse().ok())
                .unwrap_or(0),
            total_score: data.get("total_score")
                .and_then(|s| s.parse().ok())
                .unwrap_or(0),
            high_score: data.get("high_score")
                .and_then(|s| s.parse().ok())
                .unwrap_or(0),
            wins: data.get("wins")
                .and_then(|s| s.parse().ok())
                .unwrap_or(0),
            losses: data.get("losses")
                .and_then(|s| s.parse().ok())
                .unwrap_or(0),
        })
    }
}
```

## Step 4: Achievement System

```rust
// src/achievements.rs
use ferrite_client::Client;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Achievement {
    pub id: String,
    pub name: String,
    pub description: String,
    pub points: u32,
}

pub struct AchievementService {
    client: Client,
}

impl AchievementService {
    pub async fn new(addr: &str) -> Result<Self, Box<dyn std::error::Error>> {
        let client = Client::connect(addr).await?;
        Ok(Self { client })
    }

    /// Check and award achievements after a score submission
    pub async fn check_achievements(
        &self,
        player_id: &str,
        score: f64,
        rank: u64,
    ) -> Result<Vec<Achievement>, Box<dyn std::error::Error>> {
        let mut awarded = Vec::new();

        // Define achievement criteria
        let achievements = vec![
            ("first_game", "First Steps", "Play your first game", 10, |_: f64, _: u64, games: u64| games == 1),
            ("score_100", "Century", "Score 100 points", 20, |s: f64, _: u64, _: u64| s >= 100.0),
            ("score_1000", "Thousandaire", "Score 1000 points", 50, |s: f64, _: u64, _: u64| s >= 1000.0),
            ("top_100", "Rising Star", "Reach top 100", 100, |_: f64, r: u64, _: u64| r <= 100),
            ("top_10", "Elite", "Reach top 10", 500, |_: f64, r: u64, _: u64| r <= 10),
            ("top_1", "Champion", "Reach #1", 1000, |_: f64, r: u64, _: u64| r == 1),
            ("games_10", "Regular", "Play 10 games", 30, |_: f64, _: u64, g: u64| g >= 10),
            ("games_100", "Dedicated", "Play 100 games", 100, |_: f64, _: u64, g: u64| g >= 100),
        ];

        // Get player's current achievements and game count
        let player_achievements: Vec<String> = self.client
            .smembers(&format!("player:{}:achievements", player_id))
            .await?;

        let games_played: u64 = self.client
            .hget(&format!("player:{}", player_id), "games_played")
            .await?
            .unwrap_or("0".to_string())
            .parse()
            .unwrap_or(0);

        for (id, name, desc, points, check) in achievements {
            if !player_achievements.contains(&id.to_string()) {
                if check(score, rank, games_played) {
                    // Award achievement
                    self.client.sadd(
                        &format!("player:{}:achievements", player_id),
                        &[id],
                    ).await?;

                    awarded.push(Achievement {
                        id: id.to_string(),
                        name: name.to_string(),
                        description: desc.to_string(),
                        points,
                    });
                }
            }
        }

        Ok(awarded)
    }

    /// Get player's achievements
    pub async fn get_achievements(
        &self,
        player_id: &str,
    ) -> Result<Vec<String>, Box<dyn std::error::Error>> {
        let achievements: Vec<String> = self.client
            .smembers(&format!("player:{}:achievements", player_id))
            .await?;
        Ok(achievements)
    }
}
```

## Step 5: Real-Time Updates

```rust
// src/realtime.rs
use ferrite_client::Client;
use tokio::sync::mpsc;

pub struct LeaderboardSubscriber {
    client: Client,
}

#[derive(Debug, Clone)]
pub enum LeaderboardEvent {
    ScoreUpdated {
        player_id: String,
        new_score: f64,
        new_rank: u64,
    },
    NewTopPlayer {
        player_id: String,
        score: f64,
    },
}

impl LeaderboardSubscriber {
    pub async fn new(addr: &str) -> Result<Self, Box<dyn std::error::Error>> {
        let client = Client::connect(addr).await?;
        Ok(Self { client })
    }

    pub async fn subscribe(
        &self,
        tx: mpsc::Sender<LeaderboardEvent>,
    ) -> Result<(), Box<dyn std::error::Error>> {
        let mut pubsub = self.client
            .subscribe(&["leaderboard:updates"])
            .await?;

        tokio::spawn(async move {
            while let Some(msg) = pubsub.next().await {
                if let Ok(event) = serde_json::from_str::<LeaderboardEvent>(&msg.payload) {
                    if tx.send(event).await.is_err() {
                        break;
                    }
                }
            }
        });

        Ok(())
    }
}
```

## Step 6: Main Application

```rust
// src/main.rs
mod models;
mod leaderboard;
mod achievements;
mod realtime;

use leaderboard::LeaderboardService;
use achievements::AchievementService;
use models::*;
use chrono::Utc;
use uuid::Uuid;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let leaderboard = LeaderboardService::new("localhost:6379").await?;
    let achievements = AchievementService::new("localhost:6379").await?;

    // Register some players
    let players = ["Alice", "Bob", "Charlie", "Diana", "Eve"];
    for name in &players {
        let player_id = Uuid::new_v4().to_string();
        leaderboard.register_player(&player_id, name).await?;
        println!("Registered player: {} ({})", name, player_id);
    }

    // Simulate some games
    println!("\n--- Simulating Games ---");
    for _ in 0..10 {
        let player_id = Uuid::new_v4().to_string();
        let score = (rand::random::<f64>() * 10000.0).round();

        let submission = ScoreSubmission {
            player_id: player_id.clone(),
            game_id: Uuid::new_v4().to_string(),
            score,
            timestamp: Utc::now(),
        };

        let rank = leaderboard.submit_score(&submission).await?;
        println!("Player {} scored {} points, now ranked #{}", &player_id[..8], score, rank);

        // Check achievements
        let earned = achievements.check_achievements(&player_id, score, rank).await?;
        for achievement in earned {
            println!("  Achievement unlocked: {} (+{} pts)", achievement.name, achievement.points);
        }
    }

    // Display leaderboard
    println!("\n--- Global Leaderboard ---");
    let top10 = leaderboard.get_top(LeaderboardPeriod::AllTime, 10).await?;
    for entry in top10 {
        println!("#{}: {} - {} pts", entry.rank, entry.player_name, entry.score);
    }

    // Player count
    let total = leaderboard.get_player_count(LeaderboardPeriod::AllTime).await?;
    println!("\nTotal players: {}", total);

    Ok(())
}
```

## Performance Optimizations

### 1. Batch Score Updates

```rust
pub async fn submit_scores_batch(
    &self,
    submissions: &[ScoreSubmission],
) -> Result<(), Box<dyn std::error::Error>> {
    let mut pipe = self.client.pipeline();

    for submission in submissions {
        pipe.zadd(
            "leaderboard:global",
            &[(submission.score, &submission.player_id)],
            ZAddOptions::GT,  // Only update if new score is greater
        );
    }

    pipe.execute().await?;
    Ok(())
}
```

### 2. Caching Top Players

```rust
pub async fn get_cached_top(
    &self,
    count: usize,
) -> Result<Vec<LeaderboardEntry>, Box<dyn std::error::Error>> {
    let cache_key = format!("cache:leaderboard:top:{}", count);

    // Try cache first
    if let Some(cached) = self.client.get::<String>(&cache_key).await? {
        if let Ok(entries) = serde_json::from_str(&cached) {
            return Ok(entries);
        }
    }

    // Fetch from sorted set
    let entries = self.get_top(LeaderboardPeriod::AllTime, count).await?;

    // Cache for 5 seconds
    self.client.setex(
        &cache_key,
        5,
        &serde_json::to_string(&entries)?,
    ).await?;

    Ok(entries)
}
```

## Testing

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_score_submission() {
        let leaderboard = LeaderboardService::new("localhost:6379").await.unwrap();

        let submission = ScoreSubmission {
            player_id: "test-player-1".to_string(),
            game_id: "test-game".to_string(),
            score: 500.0,
            timestamp: Utc::now(),
        };

        let rank = leaderboard.submit_score(&submission).await.unwrap();
        assert!(rank > 0);

        let score = leaderboard.get_score("test-player-1", LeaderboardPeriod::AllTime).await.unwrap();
        assert_eq!(score, Some(500.0));
    }

    #[tokio::test]
    async fn test_ranking() {
        let leaderboard = LeaderboardService::new("localhost:6379").await.unwrap();

        // Submit scores in order
        for (i, score) in [100.0, 200.0, 300.0].iter().enumerate() {
            let submission = ScoreSubmission {
                player_id: format!("rank-test-{}", i),
                game_id: "test".to_string(),
                score: *score,
                timestamp: Utc::now(),
            };
            leaderboard.submit_score(&submission).await.unwrap();
        }

        // Highest score should be rank 1
        let rank = leaderboard.get_rank("rank-test-2", LeaderboardPeriod::AllTime).await.unwrap();
        assert!(rank.is_some());
    }
}
```

## Next Steps

- Add friend leaderboards
- Implement seasonal resets
- Add tournament brackets
- Create spectator mode for top games
- Integrate with game replay system

## Related Resources

- [Sorted Sets Commands](/docs/reference/commands/sorted-sets) - Full sorted set reference
- [Scripting Commands](/docs/reference/commands/scripting) - Lua scripting
- [Pub/Sub Commands](/docs/reference/commands/pubsub) - Real-time updates
