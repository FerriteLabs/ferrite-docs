---
sidebar_position: 11
maturity: stable
---

# Transaction Commands

Commands for atomic multi-command execution.

## Overview

Transactions allow executing multiple commands atomically. Commands are queued and executed as a single unit, ensuring no other client commands are interleaved.

## Commands

### MULTI

Start a transaction.

```bash
MULTI
```

**Time Complexity:** O(1)

**Examples:**
```bash
MULTI
# OK

SET key1 "value1"
# QUEUED

SET key2 "value2"
# QUEUED

INCR counter
# QUEUED

EXEC
# 1) OK
# 2) OK
# 3) (integer) 1
```

---

### EXEC

Execute queued commands.

```bash
EXEC
```

**Time Complexity:** O(N) where N is the number of queued commands

**Returns:** Array of command results.

**Examples:**
```bash
MULTI
SET foo "bar"
GET foo
EXEC
# 1) OK
# 2) "bar"
```

---

### DISCARD

Discard queued commands.

```bash
DISCARD
```

**Time Complexity:** O(N)

**Examples:**
```bash
MULTI
SET key1 "value1"
SET key2 "value2"
DISCARD
# OK

GET key1
# (nil)
```

---

### WATCH

Watch keys for changes (optimistic locking).

```bash
WATCH key [key ...]
```

**Time Complexity:** O(1) per key

**Examples:**
```bash
WATCH mykey

# If mykey is modified by another client before EXEC,
# the transaction will abort

MULTI
SET mykey "new value"
EXEC
# (nil) if mykey was modified, or results if not
```

---

### UNWATCH

Unwatch all watched keys.

```bash
UNWATCH
```

**Time Complexity:** O(1)

**Examples:**
```bash
WATCH mykey
# Decide not to proceed
UNWATCH
```

## Transaction Patterns

### Basic Transaction

```bash
MULTI
SET account:1:balance "1000"
SET account:2:balance "500"
EXEC
```

### Optimistic Locking with WATCH

```bash
WATCH account:1:balance
balance = GET account:1:balance

MULTI
SET account:1:balance (balance - 100)
EXEC
# Returns nil if balance was modified by another client
```

### Retry Pattern

```python
def transfer_with_retry(from_account, to_account, amount, max_retries=3):
    for attempt in range(max_retries):
        # Watch accounts
        redis.watch(from_account, to_account)

        # Get balances
        from_balance = int(redis.get(from_account) or 0)
        to_balance = int(redis.get(to_account) or 0)

        if from_balance < amount:
            redis.unwatch()
            raise InsufficientFunds()

        try:
            # Start transaction
            pipe = redis.pipeline()
            pipe.set(from_account, from_balance - amount)
            pipe.set(to_account, to_balance + amount)
            pipe.execute()
            return True  # Success
        except WatchError:
            continue  # Retry

    raise TransactionFailed("Max retries exceeded")
```

### Check-and-Set (CAS)

```bash
# Increment only if value matches expected
WATCH counter
current = GET counter
expected = 10

if current == expected:
    MULTI
    SET counter (current + 1)
    EXEC
else:
    UNWATCH
```

## Use Cases

### Bank Transfer

```python
def bank_transfer(from_acc, to_acc, amount):
    with redis.pipeline() as pipe:
        while True:
            try:
                # Watch both accounts
                pipe.watch(from_acc, to_acc)

                # Get current balances
                from_bal = int(pipe.get(from_acc) or 0)
                to_bal = int(pipe.get(to_acc) or 0)

                if from_bal < amount:
                    pipe.unwatch()
                    return False, "Insufficient funds"

                # Execute transfer atomically
                pipe.multi()
                pipe.set(from_acc, from_bal - amount)
                pipe.set(to_acc, to_bal + amount)
                pipe.execute()

                return True, "Transfer complete"
            except WatchError:
                continue  # Retry on conflict
```

### Inventory Management

```python
def purchase_item(user_id, item_id, quantity):
    stock_key = f"inventory:{item_id}"
    cart_key = f"cart:{user_id}"

    with redis.pipeline() as pipe:
        while True:
            try:
                pipe.watch(stock_key)
                stock = int(pipe.get(stock_key) or 0)

                if stock < quantity:
                    pipe.unwatch()
                    return False, "Out of stock"

                pipe.multi()
                pipe.decrby(stock_key, quantity)
                pipe.hset(cart_key, item_id, quantity)
                pipe.execute()

                return True, "Added to cart"
            except WatchError:
                continue
```

### Atomic Counter with Limit

```bash
WATCH rate_limit:user:1

current = GET rate_limit:user:1
limit = 100

if current < limit:
    MULTI
    INCR rate_limit:user:1
    EXPIRE rate_limit:user:1 60
    EXEC
else:
    UNWATCH
    # Rate limit exceeded
```

### Session Management

```python
def create_session(user_id, session_data, ttl=3600):
    session_id = generate_session_id()
    session_key = f"session:{session_id}"
    user_sessions_key = f"user:{user_id}:sessions"

    pipe = redis.pipeline()
    pipe.multi()
    pipe.hset(session_key, mapping=session_data)
    pipe.expire(session_key, ttl)
    pipe.sadd(user_sessions_key, session_id)
    pipe.execute()

    return session_id
```

## Error Handling

### Syntax Errors

```bash
MULTI
SET foo "bar"
INCR foo bar bar  # Syntax error
EXEC
# (error) EXECABORT Transaction discarded because of previous errors
```

### Runtime Errors

```bash
SET foo "hello"

MULTI
INCR foo  # Will fail (not a number)
SET bar "world"
EXEC
# 1) (error) ERR value is not an integer
# 2) OK
# Note: Other commands still execute
```

## Rust API

```rust
use ferrite::Client;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let client = Client::connect("localhost:6379").await?;

    // Basic transaction
    let results = client.transaction()
        .set("key1", "value1")
        .set("key2", "value2")
        .incr("counter")
        .exec()
        .await?;

    // Optimistic locking with WATCH
    loop {
        let mut tx = client.watch(&["balance"]).await?;
        let balance: i64 = tx.get("balance").await?.unwrap_or(0);

        if balance < 100 {
            tx.unwatch().await?;
            return Err("Insufficient funds".into());
        }

        match tx.transaction()
            .set("balance", balance - 100)
            .exec()
            .await
        {
            Ok(_) => break,
            Err(WatchError) => continue,  // Retry
            Err(e) => return Err(e.into()),
        }
    }

    Ok(())
}
```

## Pipeline vs Transaction

| Feature | Pipeline | Transaction |
|---------|----------|-------------|
| Atomic | No | Yes |
| Interleaved | Possible | No |
| WATCH support | No | Yes |
| Performance | Batched RTT | Batched RTT |
| Use case | Bulk operations | Consistency |

## Best Practices

1. **Keep transactions short** - Long transactions block other clients
2. **Minimize WATCH keys** - More keys = more contention
3. **Handle WatchError** - Implement retry logic
4. **Avoid nested transactions** - Not supported
5. **Use Lua scripts** - For complex atomic logic
6. **Check errors** - Runtime errors don't abort transaction

## Related Commands

- [Scripting Commands](/docs/reference/commands/scripting) - Lua for complex atomicity
- [Key Commands](/docs/reference/commands/keys) - Basic key operations
- [String Commands](/docs/reference/commands/strings) - Common transaction targets
