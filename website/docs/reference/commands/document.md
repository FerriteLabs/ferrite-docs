---
sidebar_position: 17
maturity: experimental
---

:::caution Experimental Feature
This feature is **experimental** and subject to change. APIs, behavior, and performance characteristics may evolve significantly between releases. Use with caution in production environments.
:::

# Document Commands

Commands for JSON document storage and queries.

## Overview

Document commands provide MongoDB-compatible JSON document storage with secondary indexes, aggregation pipelines, and rich query capabilities.

## Commands

### DOC.INSERT

Insert documents into a collection.

```bash
DOC.INSERT collection document [document ...]
```

**Examples:**
```bash
DOC.INSERT users '{"name": "Alice", "age": 30, "city": "NYC"}'
# "user_abc123"

DOC.INSERT users '{"name": "Bob", "age": 25, "city": "LA"}' '{"name": "Carol", "age": 35, "city": "NYC"}'
# ["user_def456", "user_ghi789"]
```

---

### DOC.FIND

Query documents.

```bash
DOC.FIND collection query [OPTIONS]
```

**Options:**
- `LIMIT n` - Maximum results
- `SKIP n` - Skip first n results
- `SORT field ASC|DESC` - Sort results
- `PROJECT fields...` - Return specific fields

**Examples:**
```bash
# Find all
DOC.FIND users '{}'

# Find by field
DOC.FIND users '{"city": "NYC"}'

# Find with operators
DOC.FIND users '{"age": {"$gt": 25}}'

# With options
DOC.FIND users '{"city": "NYC"}' SORT age DESC LIMIT 10

# Project fields
DOC.FIND users '{}' PROJECT name city
```

---

### DOC.FINDONE

Find single document.

```bash
DOC.FINDONE collection query [PROJECT fields...]
```

**Examples:**
```bash
DOC.FINDONE users '{"name": "Alice"}'
# {"_id": "user_abc123", "name": "Alice", "age": 30, "city": "NYC"}
```

---

### DOC.UPDATE

Update documents.

```bash
DOC.UPDATE collection query update [UPSERT] [MULTI]
```

**Options:**
- `UPSERT` - Insert if not found
- `MULTI` - Update all matching documents

**Examples:**
```bash
# Update single field
DOC.UPDATE users '{"name": "Alice"}' '{"$set": {"age": 31}}'

# Increment field
DOC.UPDATE users '{"name": "Alice"}' '{"$inc": {"visits": 1}}'

# Update multiple documents
DOC.UPDATE users '{"city": "NYC"}' '{"$set": {"region": "East"}}' MULTI

# Upsert
DOC.UPDATE users '{"email": "new@example.com"}' '{"$set": {"name": "New User"}}' UPSERT
```

---

### DOC.DELETE

Delete documents.

```bash
DOC.DELETE collection query [MULTI]
```

**Examples:**
```bash
# Delete one
DOC.DELETE users '{"name": "Alice"}'
# (integer) 1

# Delete multiple
DOC.DELETE users '{"city": "LA"}' MULTI
# (integer) 5
```

---

### DOC.COUNT

Count matching documents.

```bash
DOC.COUNT collection [query]
```

**Examples:**
```bash
DOC.COUNT users
# (integer) 1000

DOC.COUNT users '{"city": "NYC"}'
# (integer) 250
```

---

### DOC.AGGREGATE

Run aggregation pipeline.

```bash
DOC.AGGREGATE collection pipeline
```

**Pipeline Stages:**
- `$match` - Filter documents
- `$group` - Group and aggregate
- `$sort` - Sort results
- `$limit` - Limit results
- `$skip` - Skip results
- `$project` - Reshape documents
- `$unwind` - Deconstruct arrays
- `$lookup` - Join collections

**Examples:**
```bash
# Group by city with count
DOC.AGGREGATE users '[
  {"$group": {"_id": "$city", "count": {"$sum": 1}}}
]'

# Average age by city
DOC.AGGREGATE users '[
  {"$group": {"_id": "$city", "avgAge": {"$avg": "$age"}}}
]'

# Filter, group, sort
DOC.AGGREGATE users '[
  {"$match": {"active": true}},
  {"$group": {"_id": "$city", "count": {"$sum": 1}}},
  {"$sort": {"count": -1}},
  {"$limit": 10}
]'
```

---

### DOC.INDEX.CREATE

Create an index.

```bash
DOC.INDEX.CREATE collection field [OPTIONS]
```

**Options:**
- `UNIQUE` - Enforce unique values
- `SPARSE` - Only index documents with field
- `COMPOUND field2 field3...` - Multi-field index

**Examples:**
```bash
# Single field index
DOC.INDEX.CREATE users email UNIQUE

# Compound index
DOC.INDEX.CREATE users city COMPOUND age

# Sparse index
DOC.INDEX.CREATE users nickname SPARSE
```

---

### DOC.INDEX.LIST

List indexes.

```bash
DOC.INDEX.LIST collection
```

---

### DOC.INDEX.DROP

Drop an index.

```bash
DOC.INDEX.DROP collection index_name
```

---

### DOC.COLLECTION.CREATE

Create a collection with options.

```bash
DOC.COLLECTION.CREATE name [CAPPED size] [VALIDATOR schema]
```

**Examples:**
```bash
# Capped collection
DOC.COLLECTION.CREATE logs CAPPED 1000000

# With schema validation
DOC.COLLECTION.CREATE users VALIDATOR '{
  "properties": {
    "email": {"type": "string", "format": "email"},
    "age": {"type": "integer", "minimum": 0}
  },
  "required": ["email"]
}'
```

---

### DOC.COLLECTION.LIST

List collections.

```bash
DOC.COLLECTION.LIST
```

---

### DOC.COLLECTION.DROP

Drop a collection.

```bash
DOC.COLLECTION.DROP name
```

## Query Operators

### Comparison

```bash
# Equal
'{"age": 30}'
'{"age": {"$eq": 30}}'

# Not equal
'{"age": {"$ne": 30}}'

# Greater than
'{"age": {"$gt": 25}}'

# Greater than or equal
'{"age": {"$gte": 25}}'

# Less than
'{"age": {"$lt": 35}}'

# Less than or equal
'{"age": {"$lte": 35}}'

# In array
'{"city": {"$in": ["NYC", "LA", "Chicago"]}}'

# Not in array
'{"city": {"$nin": ["NYC", "LA"]}}'
```

### Logical

```bash
# AND (implicit)
'{"city": "NYC", "age": {"$gt": 25}}'

# AND (explicit)
'{"$and": [{"city": "NYC"}, {"age": {"$gt": 25}}]}'

# OR
'{"$or": [{"city": "NYC"}, {"city": "LA"}]}'

# NOT
'{"age": {"$not": {"$gt": 30}}}'

# NOR
'{"$nor": [{"city": "NYC"}, {"age": {"$lt": 18}}]}'
```

### Element

```bash
# Field exists
'{"nickname": {"$exists": true}}'

# Field type
'{"age": {"$type": "number"}}'
```

### Array

```bash
# Contains element
'{"tags": "tech"}'

# All elements
'{"tags": {"$all": ["tech", "ai"]}}'

# Array size
'{"tags": {"$size": 3}}'

# Element match
'{"items": {"$elemMatch": {"qty": {"$gt": 5}}}}'
```

### Text

```bash
# Regex
'{"name": {"$regex": "^Al", "$options": "i"}}'

# Text search (requires text index)
'{"$text": {"$search": "machine learning"}}'
```

## Update Operators

```bash
# Set field
'{"$set": {"name": "Alice"}}'

# Unset field
'{"$unset": {"nickname": ""}}'

# Increment
'{"$inc": {"visits": 1}}'

# Multiply
'{"$mul": {"price": 1.1}}'

# Min/Max
'{"$min": {"lowest": 10}}'
'{"$max": {"highest": 100}}'

# Current date
'{"$currentDate": {"lastModified": true}}'

# Rename field
'{"$rename": {"old_name": "new_name"}}'

# Array push
'{"$push": {"tags": "new_tag"}}'

# Array pull
'{"$pull": {"tags": "old_tag"}}'

# Array add to set
'{"$addToSet": {"tags": "unique_tag"}}'

# Array pop
'{"$pop": {"tags": 1}}'  # Remove last
'{"$pop": {"tags": -1}}' # Remove first
```

## Use Cases

### User Profiles

```bash
# Create collection with validation
DOC.COLLECTION.CREATE users VALIDATOR '{
  "properties": {
    "email": {"type": "string"},
    "name": {"type": "string"}
  },
  "required": ["email"]
}'

# Create indexes
DOC.INDEX.CREATE users email UNIQUE
DOC.INDEX.CREATE users name

# Insert user
DOC.INSERT users '{"email": "alice@example.com", "name": "Alice", "plan": "pro"}'

# Find by email
DOC.FINDONE users '{"email": "alice@example.com"}'

# Update plan
DOC.UPDATE users '{"email": "alice@example.com"}' '{"$set": {"plan": "enterprise"}}'
```

### Product Catalog

```bash
# Insert products
DOC.INSERT products '{"sku": "LAPTOP001", "name": "Pro Laptop", "price": 999, "tags": ["electronics", "computers"]}'

# Find by category
DOC.FIND products '{"tags": "electronics"}' SORT price ASC LIMIT 10

# Aggregate by category
DOC.AGGREGATE products '[
  {"$unwind": "$tags"},
  {"$group": {"_id": "$tags", "avgPrice": {"$avg": "$price"}, "count": {"$sum": 1}}},
  {"$sort": {"count": -1}}
]'
```

## Rust API

```rust
use ferrite::Client;
use serde_json::json;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let client = Client::connect("localhost:6379").await?;

    // Insert document
    let id = client.doc_insert("users", json!({
        "name": "Alice",
        "age": 30,
        "city": "NYC"
    })).await?;

    // Find documents
    let users = client.doc_find(
        "users",
        json!({"city": "NYC"}),
        DocFindOptions::default()
            .sort("age", -1)
            .limit(10),
    ).await?;

    // Update
    client.doc_update(
        "users",
        json!({"name": "Alice"}),
        json!({"$set": {"age": 31}}),
        false, // upsert
        false, // multi
    ).await?;

    // Aggregate
    let results = client.doc_aggregate("users", vec![
        json!({"$match": {"city": "NYC"}}),
        json!({"$group": {"_id": "$city", "count": {"$sum": 1}}}),
    ]).await?;

    // Create index
    client.doc_index_create("users", "email", DocIndexOptions::unique()).await?;

    Ok(())
}
```

## Related Commands

- [Hash Commands](/docs/reference/commands/hashes) - For simpler key-value objects
- [Search Commands](/docs/reference/commands/search) - Full-text search
- [Query Commands](/docs/reference/commands/query) - FerriteQL queries
