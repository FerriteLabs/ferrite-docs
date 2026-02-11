---
sidebar_position: 2
maturity: stable
---

# Data Types

Ferrite supports all Redis data types plus additional types for modern applications.

## Core Data Types

### Strings

The most basic data type - binary-safe strings up to 512 MB.

```bash
# Set and get
SET user:name "Alice"
GET user:name

# Set with expiration
SET session:123 "data" EX 3600  # Expires in 1 hour
SET session:456 "data" PX 60000 # Expires in 60 seconds

# Conditional set
SET lock:resource "owner" NX    # Only if not exists
SET counter "10" XX             # Only if exists

# Numeric operations
INCR counter                    # 11
INCRBY counter 5                # 16
INCRBYFLOAT price 0.99          # Float increment
DECR counter                    # 15

# String operations
APPEND greeting " World"
STRLEN greeting
GETRANGE greeting 0 4           # "Hello"
SETRANGE greeting 6 "Redis"
```

**Use cases**: Caching, counters, locks, rate limiting, session tokens

### Lists

Ordered collections of strings, implemented as linked lists.

```bash
# Push elements
LPUSH tasks "task1"            # Add to head
RPUSH tasks "task2"            # Add to tail
LPUSH tasks "task0" "task-1"   # Multiple elements

# Pop elements
LPOP tasks                     # Remove from head
RPOP tasks                     # Remove from tail
BLPOP tasks 0                  # Blocking pop

# Access elements
LRANGE tasks 0 -1              # All elements
LINDEX tasks 0                 # Element at index
LLEN tasks                     # List length

# Modify
LSET tasks 0 "updated"
LINSERT tasks BEFORE "task1" "new-task"
LTRIM tasks 0 99               # Keep first 100
```

**Use cases**: Message queues, activity feeds, task lists, recent items

### Hashes

Maps of field-value pairs, perfect for objects.

```bash
# Set fields
HSET user:123 name "Alice" email "alice@example.com" age 30
HSETNX user:123 created_at "2024-01-15"

# Get fields
HGET user:123 name
HMGET user:123 name email
HGETALL user:123

# Modify
HINCRBY user:123 age 1
HINCRBYFLOAT user:123 balance 10.50
HDEL user:123 temporary_field

# Inspect
HEXISTS user:123 email
HLEN user:123
HKEYS user:123
HVALS user:123
```

**Use cases**: User profiles, product data, configuration, sessions

### Sets

Unordered collections of unique strings.

```bash
# Add members
SADD tags:article:123 "redis" "database" "nosql"

# Remove members
SREM tags:article:123 "nosql"

# Check membership
SISMEMBER tags:article:123 "redis"    # 1 (true)
SMEMBERS tags:article:123             # All members
SCARD tags:article:123                # Count

# Set operations
SINTER tags:article:123 tags:article:456    # Intersection
SUNION tags:article:123 tags:article:456    # Union
SDIFF tags:article:123 tags:article:456     # Difference

# Random
SRANDMEMBER tags:article:123
SPOP tags:article:123                       # Remove random
```

**Use cases**: Tags, unique visitors, friends lists, permissions

### Sorted Sets

Sets with a score for each member, sorted by score.

```bash
# Add members with scores
ZADD leaderboard 100 "player1" 150 "player2" 80 "player3"

# Update scores
ZINCRBY leaderboard 10 "player1"      # 110

# Range queries
ZRANGE leaderboard 0 9                # Top 10 (lowest scores)
ZREVRANGE leaderboard 0 9             # Top 10 (highest scores)
ZRANGEBYSCORE leaderboard 100 200     # Score range
ZRANGEBYLEX leaderboard [a [z         # Lexicographic range

# Rank queries
ZRANK leaderboard "player1"           # Position (0-indexed)
ZREVRANK leaderboard "player1"        # Reverse position
ZSCORE leaderboard "player1"          # Get score

# Remove
ZREM leaderboard "player3"
ZREMRANGEBYRANK leaderboard 0 -11     # Keep top 10
ZREMRANGEBYSCORE leaderboard -inf 50  # Remove low scores

# Set operations
ZINTER 2 set1 set2 WEIGHTS 1 2        # Weighted intersection
ZUNION 2 set1 set2                    # Union
```

**Use cases**: Leaderboards, priority queues, time-based data, rate limiting

### Streams

Append-only log data structure for event streaming.

```bash
# Add entries
XADD events * user_id 123 action "login"
XADD events * user_id 456 action "purchase" amount 99.99

# Read entries
XRANGE events - +                     # All entries
XRANGE events 1705312800000-0 +       # From timestamp
XREAD COUNT 10 STREAMS events 0       # Read from beginning

# Consumer groups
XGROUP CREATE events mygroup $ MKSTREAM
XREADGROUP GROUP mygroup consumer1 COUNT 10 STREAMS events >
XACK events mygroup 1705312800000-0

# Info
XLEN events
XINFO STREAM events
XINFO GROUPS events
```

**Use cases**: Event sourcing, audit logs, real-time feeds, CDC

### HyperLogLog

Probabilistic data structure for cardinality estimation.

```bash
# Add elements
PFADD visitors "user1" "user2" "user3"

# Get cardinality (approximate)
PFCOUNT visitors                      # ~3

# Merge
PFMERGE all_visitors visitors:jan visitors:feb
```

**Use cases**: Unique visitor counts, cardinality estimation

### Bitmaps

String operations treating the value as a bit array.

```bash
# Set bits
SETBIT active_users 123 1             # User 123 is active
SETBIT active_users 456 1

# Get bits
GETBIT active_users 123               # 1

# Count set bits
BITCOUNT active_users                 # 2

# Bit operations
BITOP AND result active_users premium_users
BITOP OR result active_users premium_users

# Position
BITPOS active_users 1                 # First set bit
BITPOS active_users 0                 # First unset bit
```

**Use cases**: Feature flags, user activity tracking, bloom filters

### Geospatial

Store and query geographic coordinates.

```bash
# Add locations
GEOADD stores -122.4194 37.7749 "store1" -73.9857 40.7484 "store2"

# Query
GEOPOS stores "store1"                # Get coordinates
GEODIST stores "store1" "store2" km   # Distance
GEOSEARCH stores FROMMEMBER "store1" BYRADIUS 100 km

# Radius search
GEORADIUS stores -122.4 37.7 50 km WITHDIST WITHCOORD COUNT 10
```

**Use cases**: Store locator, delivery tracking, location-based features

## Extended Data Types

### Vectors

High-dimensional vectors for similarity search.

```bash
# Create index
VECTOR.CREATE products DIMS 384 METRIC cosine INDEX hnsw

# Add vectors
VECTOR.ADD products item1 [0.1, 0.2, 0.3, ...]

# Search
VECTOR.SEARCH products [0.1, 0.2, 0.3, ...] K 10
```

See [Vector Search](/docs/guides/vector-search) for details.

### Documents

MongoDB-compatible JSON documents.

```bash
# Insert document
DOC.INSERT users '{"name": "Alice", "age": 30}'

# Query
DOC.FIND users '{"age": {"$gte": 25}}'

# Aggregate
DOC.AGGREGATE users '[{"$group": {"_id": "$city", "count": {"$sum": 1}}}]'
```

See [Document Store](/docs/data-models/document-store) for details.

### Time Series

Timestamped data points.

```bash
# Create series
TS.CREATE temperature LABELS sensor outdoor

# Add samples
TS.ADD temperature * 23.5

# Query
TS.RANGE temperature - + AGGREGATION avg 60000
```

See [Time Series](/docs/data-models/time-series) for details.

### Graphs

Property graphs with vertices and edges.

```bash
# Add vertex
GRAPH.ADDNODE social Person '{"name": "Alice"}'

# Add edge
GRAPH.ADDEDGE social 1 2 KNOWS '{"since": 2020}'

# Query
GRAPH.QUERY social "MATCH (a:Person)-[:KNOWS]->(b) RETURN b.name"
```

See [Graph Database](/docs/data-models/graph-database) for details.

### CRDTs

Conflict-free replicated data types.

```bash
# Counter
CRDT.PNCOUNTER INCR inventory 10
CRDT.PNCOUNTER DECR inventory 3

# Set
CRDT.ORSET ADD tags "important"
```

See [CRDTs](/docs/data-models/crdt) for details.

## Type-Specific Memory

Each data type has different memory characteristics:

| Type | Memory per Item | Notes |
|------|-----------------|-------|
| String | value + ~50 bytes | Overhead for metadata |
| List | ~24 bytes/element | Linked list nodes |
| Hash | ~56 bytes/field | Hash table entries |
| Set | ~40 bytes/member | Hash set implementation |
| Sorted Set | ~48 bytes/member | Skip list + hash |
| Stream | ~100 bytes/entry | Entry metadata |
| Vector | dims × 4 bytes | Float32 per dimension |

## Type Checking

```bash
TYPE mykey                            # Returns type name
OBJECT ENCODING mykey                 # Returns encoding
DEBUG OBJECT mykey                    # Detailed info
```

## Best Practices

1. **Choose the right type** - Lists for order, Sets for uniqueness, Hashes for objects
2. **Use pipelining** - Batch operations for better performance
3. **Set expiration** - Use TTL to manage memory
4. **Consider encoding** - Small collections use memory-efficient encodings
5. **Avoid large keys** - Split data across multiple keys if needed

## Next Steps

- [Persistence Model](/docs/core-concepts/persistence-model) - Durability options
- [Configuration](/docs/reference/configuration) - Memory settings
- [Commands Reference](/docs/reference/commands/strings) - Full command list
