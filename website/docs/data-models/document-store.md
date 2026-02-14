---
sidebar_position: 1
maturity: experimental
---

:::caution Experimental Feature
This feature is **experimental** and subject to change. APIs, behavior, and performance characteristics may evolve significantly between releases. Use with caution in production environments.
:::

# Document Store

Ferrite includes a MongoDB-compatible document store that lets you store, query, and aggregate JSON documents with full secondary indexing support.

## Overview

The document store provides:
- **Schemaless JSON storage** - Store any JSON document without predefined schemas
- **MongoDB-compatible queries** - Use familiar query operators like `$eq`, `$gt`, `$in`, `$regex`
- **Aggregation pipelines** - Process data with `$match`, `$group`, `$sort`, `$lookup`, and more
- **Secondary indexes** - Create single-field, compound, and text indexes
- **JSON Schema validation** - Optionally enforce document structure
- **Change streams** - Subscribe to real-time document changes

## Quick Start

### Creating a Collection

```bash
# Create a simple collection
DOC.CREATE users

# Create a collection with JSON Schema validation
DOC.CREATE products SCHEMA '{"required": ["name", "price"], "properties": {"name": {"type": "string"}, "price": {"type": "number", "minimum": 0}}}'

# Create a capped collection (max 1000 documents)
DOC.CREATE logs CAPPED 1000
```

### Inserting Documents

```bash
# Insert a single document
DOC.INSERT users '{"name": "Alice", "email": "alice@example.com", "age": 30}'
# Returns: "507f1f77bcf86cd799439011"

# Insert multiple documents
DOC.INSERTMANY users '[{"name": "Bob", "age": 25}, {"name": "Carol", "age": 35}]'
# Returns: ["507f1f77bcf86cd799439012", "507f1f77bcf86cd799439013"]
```

### Querying Documents

```bash
# Find all documents matching a query
DOC.FIND users '{"age": {"$gte": 25}}'

# Find with sorting and limit
DOC.FIND users '{"age": {"$gte": 25}}' LIMIT 10 SORT age asc

# Find one document
DOC.FINDONE users '{"email": "alice@example.com"}'

# Count matching documents
DOC.COUNT users '{"age": {"$lt": 30}}'

# Get distinct values
DOC.DISTINCT users "age"
```

## Query Operators

### Comparison Operators

| Operator | Description | Example |
|----------|-------------|---------|
| `$eq` | Equals | `{"status": {"$eq": "active"}}` |
| `$ne` | Not equals | `{"status": {"$ne": "deleted"}}` |
| `$gt` | Greater than | `{"age": {"$gt": 21}}` |
| `$gte` | Greater than or equal | `{"age": {"$gte": 18}}` |
| `$lt` | Less than | `{"price": {"$lt": 100}}` |
| `$lte` | Less than or equal | `{"price": {"$lte": 99.99}}` |
| `$in` | In array | `{"status": {"$in": ["active", "pending"]}}` |
| `$nin` | Not in array | `{"category": {"$nin": ["archived"]}}` |

### Logical Operators

```json
// AND - all conditions must match
{"$and": [{"age": {"$gte": 18}}, {"status": "active"}]}

// OR - at least one condition must match
{"$or": [{"role": "admin"}, {"permissions": {"$in": ["write"]}}]}

// NOR - no conditions must match
{"$nor": [{"status": "deleted"}, {"banned": true}]}

// NOT - negate a condition
{"age": {"$not": {"$lt": 18}}}
```

### Element Operators

```json
// Check if field exists
{"email": {"$exists": true}}

// Check field type
{"age": {"$type": "int"}}
```

### Evaluation Operators

```json
// Regular expression matching
{"name": {"$regex": "^Al", "$options": "i"}}

// Modulo operation
{"quantity": {"$mod": [10, 0]}}  // divisible by 10
```

### Array Operators

```json
// All elements must match
{"tags": {"$all": ["redis", "database"]}}

// Array element must match conditions
{"scores": {"$elemMatch": {"$gte": 80, "$lt": 90}}}

// Array size
{"tags": {"$size": 3}}
```

### Geospatial Operators

```json
// Near a point (with max distance in meters)
{"location": {"$near": {"coordinates": [40.7128, -74.0060], "max_distance": 1000}}}

// Within a box
{"location": {"$geoWithin": {"$box": [[0, 0], [100, 100]]}}}

// Within a circle
{"location": {"$geoWithin": {"$circle": {"center": [40.7128, -74.0060], "radius": 5000}}}}

// Within a polygon
{"location": {"$geoWithin": {"$polygon": [[0, 0], [0, 10], [10, 10], [10, 0], [0, 0]]}}}
```

### Text Search

```json
// Full-text search
{"$text": {"$search": "coffee shop"}}

// With language and case sensitivity
{"$text": {"$search": "café", "$language": "french", "$caseSensitive": false}}
```

## Update Operations

### Update Operators

```bash
# Set field values
DOC.UPDATE users '{"email": "alice@example.com"}' '{"$set": {"age": 31, "updated": true}}'

# Unset (remove) fields
DOC.UPDATE users '{"email": "alice@example.com"}' '{"$unset": {"temporary_field": ""}}'

# Increment numeric values
DOC.UPDATE users '{"email": "alice@example.com"}' '{"$inc": {"login_count": 1}}'

# Multiply numeric values
DOC.UPDATE users '{"email": "alice@example.com"}' '{"$mul": {"balance": 1.1}}'

# Set minimum value
DOC.UPDATE products '{"sku": "ABC123"}' '{"$min": {"price": 9.99}}'

# Set maximum value
DOC.UPDATE products '{"sku": "ABC123"}' '{"$max": {"stock": 100}}'

# Rename a field
DOC.UPDATE users '{}' '{"$rename": {"old_name": "new_name"}}'

# Set current date
DOC.UPDATE users '{"email": "alice@example.com"}' '{"$currentDate": {"last_modified": true}}'
```

### Array Update Operators

```bash
# Push to array
DOC.UPDATE users '{"email": "alice@example.com"}' '{"$push": {"tags": "premium"}}'

# Pull from array
DOC.UPDATE users '{"email": "alice@example.com"}' '{"$pull": {"tags": "expired"}}'

# Add to set (no duplicates)
DOC.UPDATE users '{"email": "alice@example.com"}' '{"$addToSet": {"roles": "editor"}}'
```

### Upsert

```bash
# Insert if not exists, update if exists
DOC.UPDATE users '{"email": "newuser@example.com"}' '{"$set": {"name": "New User"}}' UPSERT
```

## Aggregation Pipeline

The aggregation pipeline processes documents through a series of stages.

### Pipeline Stages

```bash
# Complex aggregation pipeline
DOC.AGGREGATE orders '[
  {"$match": {"status": "completed"}},
  {"$group": {
    "_id": "$customer_id",
    "total_spent": {"$sum": "$amount"},
    "order_count": {"$count": {}},
    "avg_order": {"$avg": "$amount"}
  }},
  {"$sort": {"total_spent": -1}},
  {"$limit": 10}
]'
```

### Available Stages

| Stage | Description |
|-------|-------------|
| `$match` | Filter documents |
| `$project` | Include/exclude/compute fields |
| `$group` | Group by field with accumulators |
| `$sort` | Sort results |
| `$limit` | Limit results |
| `$skip` | Skip documents |
| `$unwind` | Flatten array fields |
| `$lookup` | Join with another collection |
| `$addFields` | Add computed fields |
| `$count` | Count documents |
| `$sample` | Random sample |
| `$facet` | Multiple pipelines |
| `$bucket` | Group into buckets |
| `$bucketAuto` | Automatic bucketing |
| `$replaceRoot` | Replace document root |
| `$out` | Write to collection |
| `$merge` | Merge into collection |

### Accumulators

Used in `$group` stage:

| Accumulator | Description |
|-------------|-------------|
| `$sum` | Sum values |
| `$avg` | Average values |
| `$min` | Minimum value |
| `$max` | Maximum value |
| `$first` | First value |
| `$last` | Last value |
| `$push` | Collect into array |
| `$addToSet` | Collect unique values |
| `$count` | Count documents |
| `$stdDevPop` | Population standard deviation |
| `$stdDevSamp` | Sample standard deviation |

### Expressions

```json
// Arithmetic
{"$add": ["$price", "$tax"]}
{"$subtract": ["$total", "$discount"]}
{"$multiply": ["$price", "$quantity"]}
{"$divide": ["$total", "$count"]}

// String
{"$concat": ["$firstName", " ", "$lastName"]}
{"$toUpper": "$name"}
{"$toLower": "$email"}
{"$substr": ["$description", 0, 100]}

// Conditional
{"$cond": {"if": {"$gte": ["$age", 18]}, "then": "adult", "else": "minor"}}
{"$ifNull": ["$nickname", "$name"]}

// Date
{"$year": "$created_at"}
{"$month": "$created_at"}
{"$dayOfMonth": "$created_at"}

// Array
{"$arrayElemAt": ["$tags", 0]}
{"$size": "$items"}
```

### Lookup (Join)

```bash
# Join orders with customers
DOC.AGGREGATE orders '[
  {"$lookup": {
    "from": "customers",
    "localField": "customer_id",
    "foreignField": "_id",
    "as": "customer"
  }},
  {"$unwind": "$customer"},
  {"$project": {
    "order_id": 1,
    "amount": 1,
    "customer_name": "$customer.name"
  }}
]'
```

## Indexing

### Creating Indexes

```bash
# Single field index
DOC.CREATEINDEX users '{"email": 1}'
# Returns: "email_1"

# Compound index
DOC.CREATEINDEX users '{"status": 1, "created_at": -1}'
# Returns: "status_1_created_at_-1"

# Unique index
DOC.CREATEINDEX users '{"email": 1}' UNIQUE

# Sparse index (skip documents without field)
DOC.CREATEINDEX users '{"nickname": 1}' SPARSE

# Named index
DOC.CREATEINDEX users '{"age": 1}' NAME "age_index"

# Text index for full-text search
DOC.CREATEINDEX products '{"description": "text"}'

# Hashed index for equality queries
DOC.CREATEINDEX users '{"user_id": "hashed"}'
```

### Index Types

| Type | Use Case |
|------|----------|
| Ascending (1) | Range queries, sorting |
| Descending (-1) | Reverse sorting |
| Text | Full-text search |
| Hashed | Equality lookups |
| 2d | Legacy geospatial |
| 2dsphere | GeoJSON geospatial |

### Managing Indexes

```bash
# Drop an index
DOC.DROPINDEX users "email_1"

# Collection stats (includes index info)
DOC.STATS users
```

## Schema Validation

```bash
# Create collection with validation
DOC.CREATE products SCHEMA '{
  "required": ["name", "price", "category"],
  "properties": {
    "name": {
      "type": "string",
      "minLength": 1,
      "maxLength": 200
    },
    "price": {
      "type": "number",
      "minimum": 0
    },
    "category": {
      "type": "string",
      "enum": ["electronics", "clothing", "books", "food"]
    },
    "email": {
      "type": "string",
      "format": "email"
    },
    "tags": {
      "type": "array",
      "items": {"type": "string"},
      "uniqueItems": true
    }
  }
}'
```

### Supported Formats

- `email` - Email address
- `uri` - URI
- `uuid` - UUID
- `date` - ISO date
- `time` - ISO time
- `datetime` - ISO datetime
- `ipv4` - IPv4 address
- `ipv6` - IPv6 address
- `hostname` - Hostname
- `phone` - Phone number
- `regex` - Regular expression

## Embedded Mode (Rust)

```rust
use ferrite::document::{DocumentStore, DocumentStoreConfig};
use serde_json::json;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Create document store
    let config = DocumentStoreConfig::default();
    let store = DocumentStore::new(config);

    // Create collection
    store.create_collection("users", None)?;

    // Insert document
    let doc_id = store.insert_one(
        "users",
        json!({"name": "Alice", "email": "alice@example.com", "age": 30}),
        None
    )?;
    println!("Inserted: {}", doc_id);

    // Query documents
    let query = json!({"age": {"$gte": 25}});
    let results = store.find("users", query, None)?;
    for doc in results {
        println!("{}", serde_json::to_string_pretty(&doc.data)?);
    }

    // Aggregation
    let pipeline = vec![
        json!({"$match": {"age": {"$gte": 18}}}),
        json!({"$group": {"_id": null, "avg_age": {"$avg": "$age"}}})
    ];
    let agg_results = store.aggregate("users", pipeline)?;

    Ok(())
}
```

## Change Streams

Subscribe to real-time document changes:

```rust
use ferrite::document::DocumentStore;

// Watch all collections
let mut stream = store.watch(None)?;

// Watch specific collection
let mut stream = store.watch(Some("users"))?;

// Process events
while let Some(event) = stream.next().await {
    match event {
        ChangeEvent::Insert { collection, document } => {
            println!("New document in {}: {:?}", collection, document.id);
        }
        ChangeEvent::Update { collection, document_id, update_description } => {
            println!("Updated {} in {}", document_id, collection);
        }
        ChangeEvent::Delete { collection, document_id } => {
            println!("Deleted {} from {}", document_id, collection);
        }
        ChangeEvent::Replace { collection, document } => {
            println!("Replaced document in {}", collection);
        }
    }
}
```

## Configuration

```toml
[document_store]
enabled = true
max_document_size = "16MB"
max_nesting_depth = 100
default_write_concern = "acknowledged"
```

### Write Concern Levels

| Level | Description |
|-------|-------------|
| `unacknowledged` | Fire and forget |
| `acknowledged` | Confirmed by primary (default) |
| `majority` | Confirmed by majority of replicas |
| `nodes(n)` | Confirmed by n nodes |

## Best Practices

1. **Index frequently queried fields** - Create indexes on fields used in queries and sorts
2. **Use compound indexes wisely** - Order fields by selectivity (most selective first)
3. **Avoid unbounded arrays** - Use references instead of embedding large arrays
4. **Project only needed fields** - Reduce network transfer with projection
5. **Use aggregation pipelines** - More efficient than client-side processing
6. **Enable schema validation** - Catch data issues early
7. **Monitor slow queries** - Use `DOC.STATS` to identify performance issues

## Next Steps

- [Full-Text Search](/docs/data-models/full-text-search) - Deep dive into text search
- [Aggregations](/docs/query/aggregations) - Advanced aggregation patterns
- [Graph Database](/docs/data-models/graph-database) - Relationship queries
