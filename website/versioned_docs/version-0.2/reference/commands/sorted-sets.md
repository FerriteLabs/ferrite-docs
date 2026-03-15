---
sidebar_position: 5
maturity: stable
---

# Sorted Set Commands

Commands for managing ordered collections with scores.

## Overview

Sorted sets combine set uniqueness with ordering. Each member has a score used for ranking.

## Commands

### ZADD

Add members with scores.

```bash
ZADD key [NX|XX] [GT|LT] [CH] [INCR] score member [score member ...]
```

**Options:**
- `NX` - Only add new members
- `XX` - Only update existing members
- `GT` - Only update if new score > current score
- `LT` - Only update if new score < current score
- `CH` - Return number of changed elements
- `INCR` - Increment score instead of set

**Time Complexity:** O(log(N)) per element

**Examples:**
```bash
ZADD leaderboard 100 "player1" 200 "player2" 150 "player3"
# 3

ZADD leaderboard GT 180 "player1"
# 0 (not updated, 180 < 200 not greater than 100? Wait, 180 > 100)

ZRANGE leaderboard 0 -1 WITHSCORES
# 1) "player1"
# 2) "180"
# 3) "player3"
# 4) "150"
# 5) "player2"
# 6) "200"
```

---

### ZREM

Remove members.

```bash
ZREM key member [member ...]
```

**Time Complexity:** O(M*log(N)) where M is members removed

**Examples:**
```bash
ZADD myset 1 "one" 2 "two" 3 "three"
# 3

ZREM myset "two"
# 1

ZRANGE myset 0 -1
# 1) "one"
# 2) "three"
```

---

### ZRANGE

Get members by rank range.

```bash
ZRANGE key start stop [BYSCORE | BYLEX] [REV] [LIMIT offset count] [WITHSCORES]
```

**Time Complexity:** O(log(N)+M) where M is the number of elements returned

**Examples:**
```bash
ZADD myset 1 "one" 2 "two" 3 "three"
# 3

ZRANGE myset 0 -1
# 1) "one"
# 2) "two"
# 3) "three"

ZRANGE myset 0 -1 WITHSCORES
# 1) "one"
# 2) "1"
# 3) "two"
# 4) "2"
# 5) "three"
# 6) "3"

ZRANGE myset 0 -1 REV
# 1) "three"
# 2) "two"
# 3) "one"
```

---

### ZRANGESTORE

Store range result.

```bash
ZRANGESTORE dst src start stop [BYSCORE | BYLEX] [REV] [LIMIT offset count]
```

**Time Complexity:** O(log(N)+M)

---

### ZRANGEBYSCORE

Get members by score range (deprecated, use ZRANGE BYSCORE).

```bash
ZRANGEBYSCORE key min max [WITHSCORES] [LIMIT offset count]
```

**Examples:**
```bash
ZADD myset 1 "one" 2 "two" 3 "three"

ZRANGEBYSCORE myset 1 2
# 1) "one"
# 2) "two"

ZRANGEBYSCORE myset (1 3
# 1) "two"
# 2) "three"

ZRANGEBYSCORE myset -inf +inf
# 1) "one"
# 2) "two"
# 3) "three"
```

---

### ZRANGEBYLEX

Get members by lexicographical range (deprecated, use ZRANGE BYLEX).

```bash
ZRANGEBYLEX key min max [LIMIT offset count]
```

**Examples:**
```bash
ZADD myset 0 "a" 0 "b" 0 "c" 0 "d" 0 "e" 0 "f"

ZRANGEBYLEX myset [b [e
# 1) "b"
# 2) "c"
# 3) "d"
# 4) "e"
```

---

### ZCARD

Get sorted set cardinality.

```bash
ZCARD key
```

**Time Complexity:** O(1)

---

### ZCOUNT

Count members in score range.

```bash
ZCOUNT key min max
```

**Time Complexity:** O(log(N))

**Examples:**
```bash
ZADD myset 1 "one" 2 "two" 3 "three"

ZCOUNT myset 1 2
# 2

ZCOUNT myset (1 3
# 2
```

---

### ZLEXCOUNT

Count members in lex range.

```bash
ZLEXCOUNT key min max
```

**Time Complexity:** O(log(N))

---

### ZSCORE

Get member score.

```bash
ZSCORE key member
```

**Time Complexity:** O(1)

**Examples:**
```bash
ZADD myset 1 "one"

ZSCORE myset "one"
# "1"
```

---

### ZMSCORE

Get multiple member scores.

```bash
ZMSCORE key member [member ...]
```

**Time Complexity:** O(N)

**Examples:**
```bash
ZADD myset 1 "one" 2 "two"

ZMSCORE myset "one" "two" "three"
# 1) "1"
# 2) "2"
# 3) (nil)
```

---

### ZRANK

Get member rank (ascending).

```bash
ZRANK key member
```

**Time Complexity:** O(log(N))

**Examples:**
```bash
ZADD myset 1 "one" 2 "two" 3 "three"

ZRANK myset "two"
# 1
```

---

### ZREVRANK

Get member rank (descending).

```bash
ZREVRANK key member
```

**Time Complexity:** O(log(N))

**Examples:**
```bash
ZADD myset 1 "one" 2 "two" 3 "three"

ZREVRANK myset "two"
# 1
```

---

### ZINCRBY

Increment member score.

```bash
ZINCRBY key increment member
```

**Time Complexity:** O(log(N))

**Examples:**
```bash
ZADD myset 1 "one"

ZINCRBY myset 2 "one"
# "3"

ZINCRBY myset -1 "one"
# "2"
```

---

### ZPOPMIN

Remove and return lowest scoring members.

```bash
ZPOPMIN key [count]
```

**Time Complexity:** O(log(N)*M)

---

### ZPOPMAX

Remove and return highest scoring members.

```bash
ZPOPMAX key [count]
```

**Time Complexity:** O(log(N)*M)

---

### BZPOPMIN

Blocking pop minimum.

```bash
BZPOPMIN key [key ...] timeout
```

**Time Complexity:** O(log(N))

---

### BZPOPMAX

Blocking pop maximum.

```bash
BZPOPMAX key [key ...] timeout
```

**Time Complexity:** O(log(N))

---

### ZMPOP

Pop from multiple sorted sets.

```bash
ZMPOP numkeys key [key ...] MIN | MAX [COUNT count]
```

---

### BZMPOP

Blocking pop from multiple sorted sets.

```bash
BZMPOP timeout numkeys key [key ...] MIN | MAX [COUNT count]
```

---

### ZREMRANGEBYRANK

Remove by rank range.

```bash
ZREMRANGEBYRANK key start stop
```

**Time Complexity:** O(log(N)+M)

---

### ZREMRANGEBYSCORE

Remove by score range.

```bash
ZREMRANGEBYSCORE key min max
```

**Time Complexity:** O(log(N)+M)

---

### ZREMRANGEBYLEX

Remove by lex range.

```bash
ZREMRANGEBYLEX key min max
```

**Time Complexity:** O(log(N)+M)

---

### ZUNION

Union of sorted sets.

```bash
ZUNION numkeys key [key ...] [WEIGHTS weight ...] [AGGREGATE SUM | MIN | MAX] [WITHSCORES]
```

**Time Complexity:** O(N)+O(M*log(M))

---

### ZUNIONSTORE

Store union result.

```bash
ZUNIONSTORE destination numkeys key [key ...] [WEIGHTS weight ...] [AGGREGATE SUM | MIN | MAX]
```

---

### ZINTER

Intersection of sorted sets.

```bash
ZINTER numkeys key [key ...] [WEIGHTS weight ...] [AGGREGATE SUM | MIN | MAX] [WITHSCORES]
```

---

### ZINTERSTORE

Store intersection result.

```bash
ZINTERSTORE destination numkeys key [key ...] [WEIGHTS weight ...] [AGGREGATE SUM | MIN | MAX]
```

---

### ZINTERCARD

Get intersection cardinality.

```bash
ZINTERCARD numkeys key [key ...] [LIMIT limit]
```

---

### ZDIFF

Difference between sorted sets.

```bash
ZDIFF numkeys key [key ...] [WITHSCORES]
```

---

### ZDIFFSTORE

Store difference result.

```bash
ZDIFFSTORE destination numkeys key [key ...]
```

---

### ZRANDMEMBER

Get random members.

```bash
ZRANDMEMBER key [count [WITHSCORES]]
```

---

### ZSCAN

Incrementally iterate sorted set.

```bash
ZSCAN key cursor [MATCH pattern] [COUNT count]
```

## Use Cases

### Leaderboard

```bash
# Add scores
ZADD leaderboard 1000 "player1" 850 "player2" 920 "player3"

# Get top 10
ZREVRANGE leaderboard 0 9 WITHSCORES

# Get player rank
ZREVRANK leaderboard "player2"

# Increment score
ZINCRBY leaderboard 50 "player2"

# Get players above score
ZRANGEBYSCORE leaderboard 900 +inf WITHSCORES
```

### Time-Based Events

```bash
# Schedule events (score = timestamp)
ZADD scheduled_tasks 1705320000 "task1" 1705323600 "task2"

# Get due tasks
ZRANGEBYSCORE scheduled_tasks 0 <current_timestamp>

# Remove processed tasks
ZREMRANGEBYSCORE scheduled_tasks 0 <current_timestamp>
```

### Rate Limiting

```bash
# Sliding window rate limiter
ZADD user:1:requests <current_timestamp> <request_id>

# Remove old entries (window = 60 seconds)
ZREMRANGEBYSCORE user:1:requests 0 <current_timestamp - 60>

# Count requests in window
ZCARD user:1:requests
```

### Priority Queue

```bash
# Add tasks with priority (lower = higher priority)
ZADD priority_queue 1 "urgent_task" 5 "normal_task" 10 "low_task"

# Get highest priority task
ZPOPMIN priority_queue

# Blocking wait for task
BZPOPMIN priority_queue 0
```

### Trending Topics

```bash
# Increment topic score on mention
ZINCRBY trending:hourly 1 "topic1"
ZINCRBY trending:hourly 1 "topic2"

# Get top 10 trending
ZREVRANGE trending:hourly 0 9 WITHSCORES

# Combine multiple time windows with weights
ZUNIONSTORE trending:combined 2 trending:hourly trending:daily WEIGHTS 0.7 0.3
```

## Rust API

```rust
use ferrite::Client;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let client = Client::connect("localhost:6379").await?;

    // Add members
    let added: i64 = client.zadd("leaderboard", &[
        (100.0, "player1"),
        (200.0, "player2"),
        (150.0, "player3"),
    ]).await?;

    // Get range
    let top: Vec<(String, f64)> = client
        .zrevrange_withscores("leaderboard", 0, 9)
        .await?;

    // Get rank
    let rank: Option<i64> = client.zrevrank("leaderboard", "player1").await?;

    // Get score
    let score: Option<f64> = client.zscore("leaderboard", "player1").await?;

    // Increment score
    let new_score: f64 = client.zincrby("leaderboard", 10.0, "player1").await?;

    // Count in range
    let count: i64 = client.zcount("leaderboard", 100.0, 200.0).await?;

    // Pop minimum
    let min: Option<(String, f64)> = client.zpopmin("leaderboard").await?;

    Ok(())
}
```

## Related Commands

- [Set Commands](/docs/reference/commands/sets) - Unordered unique collections
- [List Commands](/docs/reference/commands/lists) - Ordered by insertion
- [Time-Series Commands](/docs/reference/commands/timeseries) - Time-based data
