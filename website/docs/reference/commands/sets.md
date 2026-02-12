---
sidebar_position: 4
maturity: stable
---

# Set Commands

Commands for managing unordered collections of unique strings.

## Overview

Sets are unordered collections of unique strings. They support operations like membership testing, intersection, union, and difference.

## Commands

### SADD

Add members to a set.

```bash
SADD key member [member ...]
```

**Time Complexity:** O(N) where N is the number of members

**Returns:** Number of members added (not already in set).

**Examples:**
```bash
SADD myset "Hello"
# 1

SADD myset "World"
# 1

SADD myset "World"
# 0 (already exists)

SMEMBERS myset
# 1) "Hello"
# 2) "World"
```

---

### SREM

Remove members from a set.

```bash
SREM key member [member ...]
```

**Time Complexity:** O(N) where N is the number of members

**Returns:** Number of members removed.

**Examples:**
```bash
SADD myset "one" "two" "three"
# 3

SREM myset "one" "four"
# 1

SMEMBERS myset
# 1) "two"
# 2) "three"
```

---

### SMEMBERS

Get all members.

```bash
SMEMBERS key
```

**Time Complexity:** O(N) where N is the set cardinality

**Examples:**
```bash
SADD myset "Hello" "World"
# 2

SMEMBERS myset
# 1) "Hello"
# 2) "World"
```

---

### SISMEMBER

Check if member exists.

```bash
SISMEMBER key member
```

**Time Complexity:** O(1)

**Returns:** 1 if member exists, 0 otherwise.

**Examples:**
```bash
SADD myset "one"
# 1

SISMEMBER myset "one"
# 1

SISMEMBER myset "two"
# 0
```

---

### SMISMEMBER

Check if multiple members exist.

```bash
SMISMEMBER key member [member ...]
```

**Time Complexity:** O(N) where N is the number of members

**Examples:**
```bash
SADD myset "one" "two"
# 2

SMISMEMBER myset "one" "three"
# 1) 1
# 2) 0
```

---

### SCARD

Get set cardinality (size).

```bash
SCARD key
```

**Time Complexity:** O(1)

**Examples:**
```bash
SADD myset "Hello" "World"
# 2

SCARD myset
# 2
```

---

### SPOP

Remove and return random members.

```bash
SPOP key [count]
```

**Time Complexity:** O(N) where N is the count

**Examples:**
```bash
SADD myset "one" "two" "three"
# 3

SPOP myset
# "one" (random)

SPOP myset 2
# 1) "two"
# 2) "three"
```

---

### SRANDMEMBER

Get random members without removing.

```bash
SRANDMEMBER key [count]
```

**Time Complexity:** O(N) where N is the count

**Examples:**
```bash
SADD myset "one" "two" "three"
# 3

SRANDMEMBER myset
# "two" (random)

SRANDMEMBER myset 2
# 1) "one"
# 2) "three"

# Negative count allows duplicates
SRANDMEMBER myset -5
# 1) "one"
# 2) "one"
# 3) "two"
# 4) "three"
# 5) "one"
```

---

### SMOVE

Move member between sets.

```bash
SMOVE source destination member
```

**Time Complexity:** O(1)

**Returns:** 1 if moved, 0 if not in source.

**Examples:**
```bash
SADD myset "one" "two"
# 2

SADD myotherset "three"
# 1

SMOVE myset myotherset "two"
# 1

SMEMBERS myset
# 1) "one"

SMEMBERS myotherset
# 1) "three"
# 2) "two"
```

---

### SINTER

Intersection of multiple sets.

```bash
SINTER key [key ...]
```

**Time Complexity:** O(N*M) where N is the cardinality of the smallest set

**Examples:**
```bash
SADD set1 "a" "b" "c"
# 3

SADD set2 "c" "d" "e"
# 3

SINTER set1 set2
# 1) "c"
```

---

### SINTERSTORE

Store intersection in a new set.

```bash
SINTERSTORE destination key [key ...]
```

**Time Complexity:** O(N*M)

**Returns:** Cardinality of resulting set.

**Examples:**
```bash
SADD set1 "a" "b" "c"
SADD set2 "c" "d" "e"

SINTERSTORE result set1 set2
# 1

SMEMBERS result
# 1) "c"
```

---

### SINTERCARD

Get cardinality of intersection without computing it.

```bash
SINTERCARD numkeys key [key ...] [LIMIT limit]
```

**Time Complexity:** O(N*M)

**Examples:**
```bash
SADD set1 "a" "b" "c" "d"
SADD set2 "c" "d" "e"

SINTERCARD 2 set1 set2
# 2

SINTERCARD 2 set1 set2 LIMIT 1
# 1
```

---

### SUNION

Union of multiple sets.

```bash
SUNION key [key ...]
```

**Time Complexity:** O(N) where N is total number of elements

**Examples:**
```bash
SADD set1 "a" "b" "c"
SADD set2 "c" "d" "e"

SUNION set1 set2
# 1) "a"
# 2) "b"
# 3) "c"
# 4) "d"
# 5) "e"
```

---

### SUNIONSTORE

Store union in a new set.

```bash
SUNIONSTORE destination key [key ...]
```

**Time Complexity:** O(N)

**Returns:** Cardinality of resulting set.

---

### SDIFF

Difference between sets.

```bash
SDIFF key [key ...]
```

**Time Complexity:** O(N) where N is total number of elements

**Examples:**
```bash
SADD set1 "a" "b" "c"
SADD set2 "c" "d" "e"

SDIFF set1 set2
# 1) "a"
# 2) "b"
```

---

### SDIFFSTORE

Store difference in a new set.

```bash
SDIFFSTORE destination key [key ...]
```

**Time Complexity:** O(N)

**Returns:** Cardinality of resulting set.

---

### SSCAN

Incrementally iterate set members.

```bash
SSCAN key cursor [MATCH pattern] [COUNT count]
```

**Time Complexity:** O(1) per call, O(N) total

**Examples:**
```bash
SADD myset "a1" "a2" "b1" "b2"

SSCAN myset 0 MATCH a*
# 1) "0"
# 2) 1) "a1"
#    2) "a2"
```

## Use Cases

### Tag System

```bash
# Add tags to an article
SADD article:1:tags "redis" "database" "nosql"

# Add tags to another article
SADD article:2:tags "redis" "caching" "performance"

# Find articles with common tags
SINTER article:1:tags article:2:tags
# 1) "redis"

# Get all unique tags
SUNION article:1:tags article:2:tags
```

### User Permissions

```bash
# Define role permissions
SADD role:admin "read" "write" "delete" "admin"
SADD role:editor "read" "write"
SADD role:viewer "read"

# Check permission
SISMEMBER role:editor "write"
# 1

# User with multiple roles
SADD user:1:roles "editor" "viewer"

# Check if user can write
# (application logic to check role permissions)
```

### Online Users

```bash
# Track online users
SADD online:users "user:1" "user:2" "user:3"

# User goes offline
SREM online:users "user:1"

# Count online users
SCARD online:users
# 2

# Check if user is online
SISMEMBER online:users "user:2"
# 1
```

### Unique Visitors

```bash
# Track unique page visitors
SADD page:home:visitors "user:1" "user:2"
SADD page:home:visitors "user:1"  # duplicate ignored

# Count unique visitors
SCARD page:home:visitors
# 2
```

### Friend Relationships

```bash
# User friends
SADD user:1:friends "user:2" "user:3" "user:4"
SADD user:2:friends "user:1" "user:3" "user:5"

# Mutual friends
SINTER user:1:friends user:2:friends
# 1) "user:3"

# Friend suggestions (friends of friends not already friends)
SDIFF user:2:friends user:1:friends
# 1) "user:5"
```

## Rust API

```rust
use ferrite::Client;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let client = Client::connect("localhost:6379").await?;

    // Add members
    let added: i64 = client.sadd("myset", &["a", "b", "c"]).await?;

    // Check membership
    let is_member: bool = client.sismember("myset", "a").await?;

    // Get all members
    let members: Vec<String> = client.smembers("myset").await?;

    // Get cardinality
    let count: i64 = client.scard("myset").await?;

    // Pop random member
    let popped: Option<String> = client.spop("myset").await?;

    // Set operations
    client.sadd("set1", &["a", "b", "c"]).await?;
    client.sadd("set2", &["b", "c", "d"]).await?;

    let intersection: Vec<String> = client.sinter(&["set1", "set2"]).await?;
    let union: Vec<String> = client.sunion(&["set1", "set2"]).await?;
    let diff: Vec<String> = client.sdiff(&["set1", "set2"]).await?;

    // Store result
    let count: i64 = client.sinterstore("result", &["set1", "set2"]).await?;

    Ok(())
}
```

## Related Commands

- [Sorted Set Commands](/docs/reference/commands/sorted-sets) - For ordered sets with scores
- [HyperLogLog Commands](/docs/reference/commands/hyperloglog) - For cardinality estimation
- [CRDT Commands](/docs/reference/commands/crdt) - For distributed sets
