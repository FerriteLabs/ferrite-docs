---
sidebar_position: 1
maturity: stable
---

# Commands Reference

Ferrite supports all major Redis commands plus additional commands for vector search, semantic caching, and time-travel queries.

## String Commands

| Command | Description |
|---------|-------------|
| `GET key` | Get the value of a key |
| `SET key value [EX seconds] [PX milliseconds] [NX\|XX]` | Set a key's value |
| `MGET key [key ...]` | Get multiple keys |
| `MSET key value [key value ...]` | Set multiple keys |
| `INCR key` | Increment integer value |
| `INCRBY key increment` | Increment by specific amount |
| `INCRBYFLOAT key increment` | Increment by float |
| `DECR key` | Decrement integer value |
| `DECRBY key decrement` | Decrement by specific amount |
| `APPEND key value` | Append to string |
| `STRLEN key` | Get string length |
| `GETRANGE key start end` | Get substring |
| `SETRANGE key offset value` | Overwrite part of string |
| `GETSET key value` | Set and return old value |
| `SETNX key value` | Set if not exists |
| `SETEX key seconds value` | Set with expiration |
| `PSETEX key milliseconds value` | Set with ms expiration |

## List Commands

| Command | Description |
|---------|-------------|
| `LPUSH key value [value ...]` | Prepend values |
| `RPUSH key value [value ...]` | Append values |
| `LPOP key [count]` | Remove and get first element(s) |
| `RPOP key [count]` | Remove and get last element(s) |
| `LRANGE key start stop` | Get range of elements |
| `LLEN key` | Get list length |
| `LINDEX key index` | Get element by index |
| `LSET key index value` | Set element by index |
| `LREM key count value` | Remove elements |
| `LINSERT key BEFORE\|AFTER pivot value` | Insert element |
| `LTRIM key start stop` | Trim list |
| `BLPOP key [key ...] timeout` | Blocking left pop |
| `BRPOP key [key ...] timeout` | Blocking right pop |
| `LMOVE source destination LEFT\|RIGHT LEFT\|RIGHT` | Move element between lists |

## Hash Commands

| Command | Description |
|---------|-------------|
| `HSET key field value [field value ...]` | Set field(s) |
| `HGET key field` | Get field value |
| `HMSET key field value [field value ...]` | Set multiple fields |
| `HMGET key field [field ...]` | Get multiple fields |
| `HDEL key field [field ...]` | Delete fields |
| `HEXISTS key field` | Check field existence |
| `HGETALL key` | Get all fields and values |
| `HKEYS key` | Get all field names |
| `HVALS key` | Get all values |
| `HLEN key` | Get number of fields |
| `HINCRBY key field increment` | Increment field |
| `HINCRBYFLOAT key field increment` | Increment field by float |
| `HSETNX key field value` | Set field if not exists |
| `HSCAN key cursor [MATCH pattern] [COUNT count]` | Incrementally iterate |

## Set Commands

| Command | Description |
|---------|-------------|
| `SADD key member [member ...]` | Add members |
| `SREM key member [member ...]` | Remove members |
| `SMEMBERS key` | Get all members |
| `SISMEMBER key member` | Check membership |
| `SMISMEMBER key member [member ...]` | Check multiple memberships |
| `SCARD key` | Get set size |
| `SUNION key [key ...]` | Union of sets |
| `SINTER key [key ...]` | Intersection of sets |
| `SDIFF key [key ...]` | Difference of sets |
| `SUNIONSTORE destination key [key ...]` | Store union |
| `SINTERSTORE destination key [key ...]` | Store intersection |
| `SDIFFSTORE destination key [key ...]` | Store difference |
| `SPOP key [count]` | Remove and return random member(s) |
| `SRANDMEMBER key [count]` | Get random member(s) |
| `SMOVE source destination member` | Move member |
| `SSCAN key cursor [MATCH pattern] [COUNT count]` | Incrementally iterate |

## Sorted Set Commands

| Command | Description |
|---------|-------------|
| `ZADD key [NX\|XX] [GT\|LT] [CH] score member [score member ...]` | Add members |
| `ZREM key member [member ...]` | Remove members |
| `ZSCORE key member` | Get member score |
| `ZCARD key` | Get set size |
| `ZCOUNT key min max` | Count members in score range |
| `ZRANK key member` | Get member rank (ascending) |
| `ZREVRANK key member` | Get member rank (descending) |
| `ZRANGE key start stop [WITHSCORES]` | Get range by rank |
| `ZREVRANGE key start stop [WITHSCORES]` | Get range by rank (descending) |
| `ZRANGEBYSCORE key min max [WITHSCORES] [LIMIT offset count]` | Get range by score |
| `ZINCRBY key increment member` | Increment member score |
| `ZUNIONSTORE destination numkeys key [key ...]` | Store union |
| `ZINTERSTORE destination numkeys key [key ...]` | Store intersection |
| `ZSCAN key cursor [MATCH pattern] [COUNT count]` | Incrementally iterate |

## Key Commands

| Command | Description |
|---------|-------------|
| `DEL key [key ...]` | Delete keys |
| `EXISTS key [key ...]` | Check key existence |
| `EXPIRE key seconds` | Set expiration in seconds |
| `PEXPIRE key milliseconds` | Set expiration in milliseconds |
| `EXPIREAT key timestamp` | Set expiration at Unix time |
| `TTL key` | Get TTL in seconds |
| `PTTL key` | Get TTL in milliseconds |
| `PERSIST key` | Remove expiration |
| `KEYS pattern` | Find keys matching pattern |
| `SCAN cursor [MATCH pattern] [COUNT count] [TYPE type]` | Incrementally iterate keys |
| `TYPE key` | Get key type |
| `RENAME key newkey` | Rename key |
| `RENAMENX key newkey` | Rename if new key doesn't exist |
| `DUMP key` | Serialize key |
| `RESTORE key ttl serialized-value` | Deserialize key |

## Server Commands

| Command | Description |
|---------|-------------|
| `PING [message]` | Test connection |
| `ECHO message` | Echo message |
| `INFO [section]` | Get server info |
| `DBSIZE` | Get key count |
| `SELECT index` | Select database |
| `FLUSHDB [ASYNC]` | Delete all keys in current DB |
| `FLUSHALL [ASYNC]` | Delete all keys in all DBs |
| `TIME` | Get server time |
| `CONFIG GET parameter` | Get config value |
| `CONFIG SET parameter value` | Set config value |
| `SHUTDOWN [NOSAVE\|SAVE]` | Shutdown server |
| `CLIENT LIST` | List clients |
| `CLIENT KILL [ip:port\|ID id]` | Kill client |
| `SLOWLOG GET [count]` | Get slow log entries |

## Transaction Commands

| Command | Description |
|---------|-------------|
| `MULTI` | Start transaction |
| `EXEC` | Execute transaction |
| `DISCARD` | Cancel transaction |
| `WATCH key [key ...]` | Watch keys for changes |
| `UNWATCH` | Cancel all watches |

## Pub/Sub Commands

| Command | Description |
|---------|-------------|
| `SUBSCRIBE channel [channel ...]` | Subscribe to channels |
| `UNSUBSCRIBE [channel ...]` | Unsubscribe from channels |
| `PSUBSCRIBE pattern [pattern ...]` | Subscribe to patterns |
| `PUNSUBSCRIBE [pattern ...]` | Unsubscribe from patterns |
| `PUBLISH channel message` | Publish message |
| `PUBSUB CHANNELS [pattern]` | List active channels |
| `PUBSUB NUMSUB [channel ...]` | Get subscriber counts |

## Vector Commands (Ferrite-specific)

| Command | Description |
|---------|-------------|
| `VECTOR.CREATE index DIM n DISTANCE metric [TYPE type] [params]` | Create vector index |
| `VECTOR.ADD index id vector [metadata]` | Add vector |
| `VECTOR.SEARCH index vector TOP k [FILTER expr] [params]` | Search similar vectors |
| `VECTOR.DEL index id [id ...]` | Delete vectors |
| `VECTOR.INFO index` | Get index info |
| `VECTOR.DROP index` | Delete index |

## Semantic Commands (Ferrite-specific)

| Command | Description |
|---------|-------------|
| `SEMANTIC.SET query response [TTL seconds]` | Cache semantic response |
| `SEMANTIC.GET query threshold` | Get cached response if similar |
| `SEMANTIC.DEL query` | Delete cached response |
| `SEMANTIC.INFO` | Get semantic cache stats |

## Time-Travel Commands (Ferrite-specific)

| Command | Description |
|---------|-------------|
| `GET key AS OF timestamp` | Get value at point in time |
| `HISTORY key [SINCE timestamp] [UNTIL timestamp] [LIMIT n]` | Get change history |
| `RESTORE key TO timestamp` | Restore to previous state |

## CDC Commands (Ferrite-specific)

| Command | Description |
|---------|-------------|
| `CDC.SUBSCRIBE pattern [--format json\|protobuf]` | Subscribe to changes |
| `CDC.UNSUBSCRIBE` | Unsubscribe from CDC |
| `CDC.STATUS` | Get CDC status |

## Script Commands

| Command | Description |
|---------|-------------|
| `EVAL script numkeys key [key ...] arg [arg ...]` | Execute Lua script |
| `EVALSHA sha1 numkeys key [key ...] arg [arg ...]` | Execute cached script |
| `SCRIPT LOAD script` | Load script to cache |
| `SCRIPT EXISTS sha1 [sha1 ...]` | Check script existence |
| `SCRIPT FLUSH` | Clear script cache |

## Next Steps

- [Configuration Reference](/docs/reference/configuration) - All config options
- [API Reference](/docs/reference/api) - Rust API documentation
