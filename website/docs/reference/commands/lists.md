---
sidebar_position: 2
maturity: stable
---

# List Commands

Commands for managing list data structures in Ferrite.

## Overview

Lists are linked lists of string values, useful for queues, stacks, and ordered collections.

## Commands

### LPUSH

Insert elements at the head of a list.

```bash
LPUSH key element [element ...]
```

**Time Complexity:** O(N) where N is the number of elements

**Returns:** Length of list after push.

**Examples:**
```bash
LPUSH mylist "world"
# 1

LPUSH mylist "hello"
# 2

LRANGE mylist 0 -1
# 1) "hello"
# 2) "world"
```

---

### RPUSH

Insert elements at the tail of a list.

```bash
RPUSH key element [element ...]
```

**Time Complexity:** O(N) where N is the number of elements

**Examples:**
```bash
RPUSH mylist "hello"
# 1

RPUSH mylist "world"
# 2

LRANGE mylist 0 -1
# 1) "hello"
# 2) "world"
```

---

### LPOP

Remove and return elements from the head.

```bash
LPOP key [count]
```

**Time Complexity:** O(N) where N is the count

**Examples:**
```bash
RPUSH mylist "one" "two" "three"
# 3

LPOP mylist
# "one"

LPOP mylist 2
# 1) "two"
# 2) "three"
```

---

### RPOP

Remove and return elements from the tail.

```bash
RPOP key [count]
```

**Time Complexity:** O(N) where N is the count

**Examples:**
```bash
RPUSH mylist "one" "two" "three"
# 3

RPOP mylist
# "three"

RPOP mylist 2
# 1) "two"
# 2) "one"
```

---

### LRANGE

Get a range of elements.

```bash
LRANGE key start stop
```

**Time Complexity:** O(S+N) where S is start offset and N is number of elements

**Examples:**
```bash
RPUSH mylist "one" "two" "three"
# 3

LRANGE mylist 0 -1
# 1) "one"
# 2) "two"
# 3) "three"

LRANGE mylist 0 1
# 1) "one"
# 2) "two"

LRANGE mylist -2 -1
# 1) "two"
# 2) "three"
```

---

### LLEN

Get list length.

```bash
LLEN key
```

**Time Complexity:** O(1)

**Examples:**
```bash
LPUSH mylist "World" "Hello"
# 2

LLEN mylist
# 2
```

---

### LINDEX

Get element by index.

```bash
LINDEX key index
```

**Time Complexity:** O(N) where N is the number of elements to traverse

**Examples:**
```bash
LPUSH mylist "World" "Hello"
# 2

LINDEX mylist 0
# "Hello"

LINDEX mylist -1
# "World"

LINDEX mylist 3
# (nil)
```

---

### LSET

Set element at index.

```bash
LSET key index element
```

**Time Complexity:** O(N) where N is the length of the list

**Examples:**
```bash
RPUSH mylist "one" "two" "three"
# 3

LSET mylist 0 "four"
# OK

LRANGE mylist 0 -1
# 1) "four"
# 2) "two"
# 3) "three"
```

---

### LINSERT

Insert element before or after pivot.

```bash
LINSERT key BEFORE|AFTER pivot element
```

**Time Complexity:** O(N) where N is the number of elements to traverse

**Returns:** List length, -1 if pivot not found.

**Examples:**
```bash
RPUSH mylist "Hello" "World"
# 2

LINSERT mylist BEFORE "World" "There"
# 3

LRANGE mylist 0 -1
# 1) "Hello"
# 2) "There"
# 3) "World"
```

---

### LREM

Remove elements from list.

```bash
LREM key count element
```

**Parameters:**
- `count > 0`: Remove from head to tail
- `count < 0`: Remove from tail to head
- `count = 0`: Remove all occurrences

**Time Complexity:** O(N+M) where N is length and M is number of elements removed

**Examples:**
```bash
RPUSH mylist "hello" "hello" "foo" "hello"
# 4

LREM mylist -2 "hello"
# 2

LRANGE mylist 0 -1
# 1) "hello"
# 2) "foo"
```

---

### LTRIM

Trim list to specified range.

```bash
LTRIM key start stop
```

**Time Complexity:** O(N) where N is the number of elements removed

**Examples:**
```bash
RPUSH mylist "one" "two" "three"
# 3

LTRIM mylist 1 -1
# OK

LRANGE mylist 0 -1
# 1) "two"
# 2) "three"
```

---

### LPOS

Find element position.

```bash
LPOS key element [RANK rank] [COUNT num-matches] [MAXLEN len]
```

**Time Complexity:** O(N) where N is the number of elements

**Examples:**
```bash
RPUSH mylist "a" "b" "c" "d" "c" "b"
# 6

LPOS mylist "c"
# 2

LPOS mylist "c" RANK 2
# 4

LPOS mylist "c" COUNT 2
# 1) 2
# 2) 4
```

---

### LPUSHX

Push only if list exists.

```bash
LPUSHX key element [element ...]
```

**Time Complexity:** O(N) where N is the number of elements

**Examples:**
```bash
LPUSHX nonexistent "value"
# 0

RPUSH mylist "World"
# 1

LPUSHX mylist "Hello"
# 2
```

---

### RPUSHX

Push to tail only if list exists.

```bash
RPUSHX key element [element ...]
```

**Time Complexity:** O(N) where N is the number of elements

---

### LMOVE

Move element between lists.

```bash
LMOVE source destination LEFT|RIGHT LEFT|RIGHT
```

**Time Complexity:** O(1)

**Examples:**
```bash
RPUSH mylist "one" "two" "three"
# 3

LMOVE mylist newlist RIGHT LEFT
# "three"

LRANGE mylist 0 -1
# 1) "one"
# 2) "two"

LRANGE newlist 0 -1
# 1) "three"
```

---

### BLPOP

Blocking pop from head.

```bash
BLPOP key [key ...] timeout
```

**Time Complexity:** O(N) where N is the number of keys

**Examples:**
```bash
# In one client:
BLPOP mylist 30

# In another client:
LPUSH mylist "hello"

# First client returns:
# 1) "mylist"
# 2) "hello"
```

---

### BRPOP

Blocking pop from tail.

```bash
BRPOP key [key ...] timeout
```

**Time Complexity:** O(N) where N is the number of keys

---

### BLMOVE

Blocking move between lists.

```bash
BLMOVE source destination LEFT|RIGHT LEFT|RIGHT timeout
```

**Time Complexity:** O(1)

---

### LMPOP

Pop from multiple lists.

```bash
LMPOP numkeys key [key ...] LEFT|RIGHT [COUNT count]
```

**Time Complexity:** O(N+M) where N is the number of keys and M is the count

**Examples:**
```bash
RPUSH mylist "one" "two" "three"
# 3

LMPOP 1 mylist LEFT COUNT 2
# 1) "mylist"
# 2) 1) "one"
#    2) "two"
```

---

### BLMPOP

Blocking pop from multiple lists.

```bash
BLMPOP timeout numkeys key [key ...] LEFT|RIGHT [COUNT count]
```

**Time Complexity:** O(N+M)

## Use Cases

### Queue (FIFO)

```bash
# Producer
RPUSH queue task1 task2 task3

# Consumer
LPOP queue
# or blocking:
BLPOP queue 0
```

### Stack (LIFO)

```bash
# Push
LPUSH stack item1 item2 item3

# Pop
LPOP stack
```

### Capped List

```bash
# Add and cap to 1000 items
LPUSH recent:pages page_url
LTRIM recent:pages 0 999
```

### Circular Buffer

```bash
# Use LMOVE for rotation
LMOVE mylist mylist RIGHT LEFT
```

## Rust API

```rust
use ferrite::Client;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let client = Client::connect("localhost:6379").await?;

    // Push elements
    client.lpush("mylist", &["a", "b", "c"]).await?;
    client.rpush("mylist", &["x", "y", "z"]).await?;

    // Pop elements
    let value: Option<String> = client.lpop("mylist").await?;
    let values: Vec<String> = client.lpop_count("mylist", 2).await?;

    // Range
    let range: Vec<String> = client.lrange("mylist", 0, -1).await?;

    // Blocking pop
    let (key, value): (String, String) = client.blpop(&["mylist"], 30).await?;

    // Get by index
    let item: Option<String> = client.lindex("mylist", 0).await?;

    // List length
    let len: i64 = client.llen("mylist").await?;

    Ok(())
}
```

## Related Commands

- [Stream Commands](/docs/reference/commands/streams) - For more advanced message queues
- [Sorted Set Commands](/docs/reference/commands/sorted-sets) - For priority queues
- [Pub/Sub Commands](/docs/reference/commands/pubsub) - For publish/subscribe patterns
