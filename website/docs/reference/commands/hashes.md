---
sidebar_position: 3
maturity: stable
---

# Hash Commands

Commands for managing hash (dictionary) data structures in Ferrite.

## Overview

Hashes are maps of field-value pairs, ideal for representing objects.

## Commands

### HSET

Set hash fields.

```bash
HSET key field value [field value ...]
```

**Time Complexity:** O(N) where N is the number of field-value pairs

**Returns:** Number of fields added (not updated).

**Examples:**
```bash
HSET user:1 name "Alice" age "30" city "NYC"
# 3

HSET user:1 age "31"
# 0 (updated, not added)

HGETALL user:1
# 1) "name"
# 2) "Alice"
# 3) "age"
# 4) "31"
# 5) "city"
# 6) "NYC"
```

---

### HGET

Get a field value.

```bash
HGET key field
```

**Time Complexity:** O(1)

**Examples:**
```bash
HSET user:1 name "Alice"
# 1

HGET user:1 name
# "Alice"

HGET user:1 nonexistent
# (nil)
```

---

### HMSET

Set multiple fields (deprecated, use HSET).

```bash
HMSET key field value [field value ...]
```

**Time Complexity:** O(N)

---

### HMGET

Get multiple fields.

```bash
HMGET key field [field ...]
```

**Time Complexity:** O(N) where N is the number of fields

**Examples:**
```bash
HSET user:1 name "Alice" age "30" city "NYC"
# 3

HMGET user:1 name age nonexistent
# 1) "Alice"
# 2) "30"
# 3) (nil)
```

---

### HDEL

Delete hash fields.

```bash
HDEL key field [field ...]
```

**Time Complexity:** O(N) where N is the number of fields

**Returns:** Number of fields deleted.

**Examples:**
```bash
HSET user:1 name "Alice" age "30"
# 2

HDEL user:1 age
# 1

HGETALL user:1
# 1) "name"
# 2) "Alice"
```

---

### HEXISTS

Check if field exists.

```bash
HEXISTS key field
```

**Time Complexity:** O(1)

**Returns:** 1 if exists, 0 otherwise.

**Examples:**
```bash
HSET user:1 name "Alice"
# 1

HEXISTS user:1 name
# 1

HEXISTS user:1 age
# 0
```

---

### HGETALL

Get all fields and values.

```bash
HGETALL key
```

**Time Complexity:** O(N) where N is the size of the hash

**Examples:**
```bash
HSET user:1 name "Alice" age "30"
# 2

HGETALL user:1
# 1) "name"
# 2) "Alice"
# 3) "age"
# 4) "30"
```

---

### HINCRBY

Increment integer field.

```bash
HINCRBY key field increment
```

**Time Complexity:** O(1)

**Examples:**
```bash
HSET user:1 visits 10
# 1

HINCRBY user:1 visits 1
# 11

HINCRBY user:1 visits -5
# 6
```

---

### HINCRBYFLOAT

Increment float field.

```bash
HINCRBYFLOAT key field increment
```

**Time Complexity:** O(1)

**Examples:**
```bash
HSET product:1 price 10.50
# 1

HINCRBYFLOAT product:1 price 0.25
# "10.75"
```

---

### HKEYS

Get all field names.

```bash
HKEYS key
```

**Time Complexity:** O(N) where N is the size of the hash

**Examples:**
```bash
HSET user:1 name "Alice" age "30"
# 2

HKEYS user:1
# 1) "name"
# 2) "age"
```

---

### HVALS

Get all values.

```bash
HVALS key
```

**Time Complexity:** O(N) where N is the size of the hash

**Examples:**
```bash
HSET user:1 name "Alice" age "30"
# 2

HVALS user:1
# 1) "Alice"
# 2) "30"
```

---

### HLEN

Get number of fields.

```bash
HLEN key
```

**Time Complexity:** O(1)

**Examples:**
```bash
HSET user:1 name "Alice" age "30"
# 2

HLEN user:1
# 2
```

---

### HSETNX

Set field only if it doesn't exist.

```bash
HSETNX key field value
```

**Time Complexity:** O(1)

**Returns:** 1 if field was set, 0 if it existed.

**Examples:**
```bash
HSETNX user:1 name "Alice"
# 1

HSETNX user:1 name "Bob"
# 0

HGET user:1 name
# "Alice"
```

---

### HSTRLEN

Get string length of field value.

```bash
HSTRLEN key field
```

**Time Complexity:** O(1)

**Examples:**
```bash
HSET user:1 name "Alice"
# 1

HSTRLEN user:1 name
# 5
```

---

### HSCAN

Incrementally iterate hash fields.

```bash
HSCAN key cursor [MATCH pattern] [COUNT count]
```

**Time Complexity:** O(1) per call, O(N) total

**Examples:**
```bash
HSET myhash f1 "v1" f2 "v2" f3 "v3"
# 3

HSCAN myhash 0 MATCH f*
# 1) "0"
# 2) 1) "f1"
#    2) "v1"
#    3) "f2"
#    4) "v2"
#    5) "f3"
#    6) "v3"
```

---

### HRANDFIELD

Get random fields.

```bash
HRANDFIELD key [count [WITHVALUES]]
```

**Time Complexity:** O(N) where N is the count

**Examples:**
```bash
HSET myhash a 1 b 2 c 3
# 3

HRANDFIELD myhash
# "b"

HRANDFIELD myhash 2
# 1) "a"
# 2) "c"

HRANDFIELD myhash 2 WITHVALUES
# 1) "b"
# 2) "2"
# 3) "a"
# 4) "1"
```

## Use Cases

### User Profile

```bash
HSET user:1000 \
  username "alice" \
  email "alice@example.com" \
  created_at "2024-01-15" \
  login_count "42"

# Get specific fields
HMGET user:1000 username email

# Increment login count
HINCRBY user:1000 login_count 1
```

### Session Data

```bash
HSET session:abc123 \
  user_id "1000" \
  ip "192.168.1.1" \
  user_agent "Mozilla/5.0" \
  last_active "1705320000"

# Update last active
HSET session:abc123 last_active "1705323600"

# Set expiration on the session
EXPIRE session:abc123 3600
```

### Product Catalog

```bash
HSET product:sku123 \
  name "Wireless Mouse" \
  price "29.99" \
  stock "150" \
  category "electronics"

# Update stock
HINCRBY product:sku123 stock -1

# Get price
HGET product:sku123 price
```

### Counters

```bash
# Page view counters
HINCRBY page:stats views 1
HINCRBY page:stats unique_visitors 1

# Get all stats
HGETALL page:stats
```

## Rust API

```rust
use ferrite::Client;
use std::collections::HashMap;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let client = Client::connect("localhost:6379").await?;

    // Set fields
    client.hset("user:1", &[("name", "Alice"), ("age", "30")]).await?;

    // Get single field
    let name: Option<String> = client.hget("user:1", "name").await?;

    // Get multiple fields
    let fields: Vec<Option<String>> = client.hmget("user:1", &["name", "age"]).await?;

    // Get all fields
    let all: HashMap<String, String> = client.hgetall("user:1").await?;

    // Increment
    let new_age: i64 = client.hincrby("user:1", "age", 1).await?;

    // Check existence
    let exists: bool = client.hexists("user:1", "name").await?;

    // Get keys/values
    let keys: Vec<String> = client.hkeys("user:1").await?;
    let values: Vec<String> = client.hvals("user:1").await?;

    // Delete field
    let deleted: i64 = client.hdel("user:1", &["age"]).await?;

    Ok(())
}
```

## Related Commands

- [String Commands](/docs/reference/commands/strings) - For simple key-value
- [Document Commands](/docs/reference/commands/document) - For JSON documents
- [Key Commands](/docs/reference/commands/keys) - DEL, EXISTS, EXPIRE
