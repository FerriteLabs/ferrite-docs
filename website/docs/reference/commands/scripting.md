---
sidebar_position: 12
maturity: stable
---

# Scripting Commands

Commands for Lua scripting and server-side functions.

## Overview

Lua scripts execute atomically on the server, enabling complex operations without network round-trips. Redis 7.0+ also supports Functions for persistent server-side code.

## Commands

### EVAL

Execute Lua script.

```bash
EVAL script numkeys [key ...] [arg ...]
```

**Time Complexity:** Depends on script

**Examples:**
```bash
# Simple script
EVAL "return 'Hello'" 0
# "Hello"

# With keys and arguments
EVAL "return redis.call('GET', KEYS[1])" 1 mykey
# Returns value of mykey

# Complex script
EVAL "
local val = redis.call('GET', KEYS[1])
if val then
  return redis.call('INCR', KEYS[1])
else
  redis.call('SET', KEYS[1], ARGV[1])
  return ARGV[1]
end
" 1 counter 0
```

---

### EVALSHA

Execute cached script by SHA1 hash.

```bash
EVALSHA sha1 numkeys [key ...] [arg ...]
```

**Time Complexity:** Depends on script

**Examples:**
```bash
# First, load the script
SCRIPT LOAD "return redis.call('GET', KEYS[1])"
# "a42059b356c875f0717db19a51f6aaa9161e77a2"

# Execute by SHA
EVALSHA a42059b356c875f0717db19a51f6aaa9161e77a2 1 mykey
```

---

### EVALSHA_RO

Execute cached script (read-only mode).

```bash
EVALSHA_RO sha1 numkeys [key ...] [arg ...]
```

---

### EVAL_RO

Execute script (read-only mode).

```bash
EVAL_RO script numkeys [key ...] [arg ...]
```

---

### SCRIPT LOAD

Load script into cache.

```bash
SCRIPT LOAD script
```

**Returns:** SHA1 hash of the script.

**Examples:**
```bash
SCRIPT LOAD "return 1"
# "e0e1f9fabfc9d4800c877a703b823ac0578ff8db"
```

---

### SCRIPT EXISTS

Check if scripts exist in cache.

```bash
SCRIPT EXISTS sha1 [sha1 ...]
```

**Examples:**
```bash
SCRIPT EXISTS a42059b356c875f0717db19a51f6aaa9161e77a2
# 1) (integer) 1
```

---

### SCRIPT FLUSH

Clear script cache.

```bash
SCRIPT FLUSH [ASYNC | SYNC]
```

---

### SCRIPT KILL

Kill running script.

```bash
SCRIPT KILL
```

---

### SCRIPT DEBUG

Set script debug mode.

```bash
SCRIPT DEBUG YES | SYNC | NO
```

---

### FUNCTION

Manage functions.

```bash
FUNCTION LOAD [REPLACE] function-code
FUNCTION DELETE library-name
FUNCTION DUMP
FUNCTION FLUSH [ASYNC | SYNC]
FUNCTION KILL
FUNCTION LIST [LIBRARYNAME library-name] [WITHCODE]
FUNCTION RESTORE serialized-value [FLUSH | APPEND | REPLACE]
FUNCTION STATS
```

**Examples:**
```bash
# Load a function library
FUNCTION LOAD "#!lua name=mylib
redis.register_function('myfunc', function(keys, args)
  return redis.call('GET', keys[1])
end)
"

# Call the function
FCALL myfunc 1 mykey
```

---

### FCALL

Call a function.

```bash
FCALL function numkeys [key ...] [arg ...]
```

---

### FCALL_RO

Call a function (read-only mode).

```bash
FCALL_RO function numkeys [key ...] [arg ...]
```

## Lua API

### redis.call()

Execute Redis command, raise error on failure.

```lua
local value = redis.call('GET', 'mykey')
redis.call('SET', 'mykey', 'value')
```

### redis.pcall()

Execute Redis command, return error on failure.

```lua
local result = redis.pcall('GET', 'mykey')
if result.err then
  -- Handle error
end
```

### redis.log()

Write to Redis log.

```lua
redis.log(redis.LOG_WARNING, "Something happened")
```

### redis.sha1hex()

Calculate SHA1 hash.

```lua
local hash = redis.sha1hex("hello")
```

### KEYS and ARGV

```lua
-- KEYS: Array of key arguments (1-indexed)
-- ARGV: Array of other arguments (1-indexed)

EVAL "return {KEYS[1], ARGV[1]}" 1 mykey myarg
-- Returns: ["mykey", "myarg"]
```

## Script Patterns

### Atomic Get-and-Set

```lua
-- Get current value and set new one atomically
local current = redis.call('GET', KEYS[1])
redis.call('SET', KEYS[1], ARGV[1])
return current
```

### Rate Limiter

```lua
-- Sliding window rate limiter
local key = KEYS[1]
local limit = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local now = tonumber(ARGV[3])

-- Remove old entries
redis.call('ZREMRANGEBYSCORE', key, 0, now - window)

-- Count current requests
local count = redis.call('ZCARD', key)

if count < limit then
  -- Allow request
  redis.call('ZADD', key, now, now .. ':' .. math.random())
  redis.call('EXPIRE', key, window)
  return 1
else
  return 0
end
```

### Distributed Lock

```lua
-- Acquire lock with expiry
local key = KEYS[1]
local token = ARGV[1]
local ttl = ARGV[2]

if redis.call('SET', key, token, 'NX', 'EX', ttl) then
  return 1
else
  return 0
end
```

```lua
-- Release lock (only if we own it)
local key = KEYS[1]
local token = ARGV[1]

if redis.call('GET', key) == token then
  return redis.call('DEL', key)
else
  return 0
end
```

### Conditional Update

```lua
-- Update only if version matches
local key = KEYS[1]
local expected_version = ARGV[1]
local new_value = ARGV[2]
local new_version = ARGV[3]

local current = redis.call('HGET', key, 'version')
if current == expected_version then
  redis.call('HMSET', key, 'value', new_value, 'version', new_version)
  return 1
else
  return 0
end
```

### Leaderboard Update

```lua
-- Update score and get new rank
local leaderboard = KEYS[1]
local player = ARGV[1]
local score = tonumber(ARGV[2])

redis.call('ZADD', leaderboard, score, player)
local rank = redis.call('ZREVRANK', leaderboard, player)
return rank + 1  -- 1-indexed rank
```

### Inventory Check and Reserve

```lua
-- Check stock and reserve atomically
local product_key = KEYS[1]
local reservation_key = KEYS[2]
local quantity = tonumber(ARGV[1])
local reservation_id = ARGV[2]
local ttl = tonumber(ARGV[3])

local stock = tonumber(redis.call('GET', product_key) or 0)

if stock >= quantity then
  redis.call('DECRBY', product_key, quantity)
  redis.call('HSET', reservation_key, reservation_id, quantity)
  redis.call('EXPIRE', reservation_key, ttl)
  return 1
else
  return 0
end
```

## Functions (Redis 7.0+)

### Define a Library

```lua
#!lua name=mylib

-- Helper function (private)
local function helper(x)
  return x * 2
end

-- Public function
redis.register_function('double', function(keys, args)
  local val = tonumber(redis.call('GET', keys[1]) or 0)
  return helper(val)
end)

-- Another public function
redis.register_function('increment_by', function(keys, args)
  return redis.call('INCRBY', keys[1], args[1])
end)
```

### Load and Use

```bash
# Load the library
FUNCTION LOAD "#!lua name=mylib
redis.register_function('double', function(keys, args)
  local val = tonumber(redis.call('GET', keys[1]) or 0)
  return val * 2
end)
"

# Set a value
SET counter 21

# Call the function
FCALL double 1 counter
# 42
```

## Rust API

```rust
use ferrite::Client;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let client = Client::connect("localhost:6379").await?;

    // Execute inline script
    let result: i64 = client.eval(
        "return redis.call('INCR', KEYS[1])",
        &["counter"],
        &[],
    ).await?;

    // Load and cache script
    let sha = client.script_load(
        "return redis.call('GET', KEYS[1])"
    ).await?;

    // Execute by SHA
    let value: Option<String> = client.evalsha(
        &sha,
        &["mykey"],
        &[],
    ).await?;

    // Rate limiter script
    let rate_limit_script = r#"
        local key = KEYS[1]
        local limit = tonumber(ARGV[1])
        local current = tonumber(redis.call('GET', key) or 0)
        if current < limit then
            redis.call('INCR', key)
            return 1
        else
            return 0
        end
    "#;

    let allowed: i64 = client.eval(
        rate_limit_script,
        &["rate:user:1"],
        &["100"],
    ).await?;

    Ok(())
}
```

## Best Practices

1. **Use KEYS properly** - All keys must be passed through KEYS
2. **Keep scripts short** - Long scripts block the server
3. **Cache with EVALSHA** - Avoid sending script text repeatedly
4. **Use read-only variants** - For replicas and better routing
5. **Handle errors** - Use pcall for error handling
6. **Avoid global variables** - Can cause issues
7. **Test thoroughly** - Scripts run atomically, bugs can be costly

## Related Commands

- [Transaction Commands](/docs/reference/commands/transactions) - MULTI/EXEC atomicity
- [WASM Commands](/docs/reference/commands/wasm) - WebAssembly functions
- [Trigger Commands](/docs/reference/commands/trigger) - Event-driven execution
