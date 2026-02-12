---
sidebar_position: 20
maturity: beta
---

# Search Commands

Commands for full-text search and indexing.

## Overview

Search commands enable creating full-text indexes with support for tokenization, stemming, scoring, and complex queries.

## Commands

### SEARCH.INDEX.CREATE

Create a search index.

```bash
SEARCH.INDEX.CREATE index_name ON collection
  SCHEMA field1 type [OPTIONS] [field2 type [OPTIONS] ...]
```

**Field Types:**
- `TEXT` - Full-text searchable
- `TAG` - Exact match tags
- `NUMERIC` - Numeric range queries
- `GEO` - Geographic queries

**Field Options:**
- `WEIGHT weight` - Boost factor for TEXT
- `SORTABLE` - Enable sorting
- `NOINDEX` - Store but don't index
- `NOSTEM` - Disable stemming for TEXT

**Examples:**
```bash
SEARCH.INDEX.CREATE products ON products:*
  SCHEMA
    name TEXT WEIGHT 2.0
    description TEXT
    category TAG
    price NUMERIC SORTABLE
    location GEO

SEARCH.INDEX.CREATE articles ON articles:*
  SCHEMA
    title TEXT WEIGHT 3.0
    body TEXT
    author TAG
    published NUMERIC SORTABLE
    tags TAG
```

---

### SEARCH.ADD

Add document to index.

```bash
SEARCH.ADD index_name doc_id score FIELDS field value [field value ...]
```

**Examples:**
```bash
SEARCH.ADD products prod:1 1.0 FIELDS
  name "Pro Laptop 15"
  description "High-performance laptop for professionals"
  category "electronics"
  price 999.99
  location "-122.4194,37.7749"
```

---

### SEARCH.QUERY

Execute search query.

```bash
SEARCH.QUERY index_name query
  [NOCONTENT]
  [LIMIT offset count]
  [SORTBY field ASC|DESC]
  [RETURN count field ...]
  [HIGHLIGHT [FIELDS count field ...] [TAGS open close]]
  [SUMMARIZE [FIELDS count field ...] [LEN len] [SEPARATOR sep]]
  [FILTER field min max]
  [GEOFILTER field lon lat radius unit]
  [INFIELDS count field ...]
  [LANGUAGE lang]
  [SCORER scorer]
  [EXPANDER expander]
  [WITHSCORES]
  [WITHPAYLOADS]
```

**Examples:**
```bash
# Simple text search
SEARCH.QUERY products "laptop"

# With filters
SEARCH.QUERY products "laptop" FILTER price 500 1500

# Phrase search
SEARCH.QUERY products '"pro laptop"'

# Boolean operators
SEARCH.QUERY products "laptop | notebook"
SEARCH.QUERY products "laptop -gaming"
SEARCH.QUERY products "(laptop | notebook) professional"

# Field-specific search
SEARCH.QUERY products "@name:laptop @category:{electronics}"

# With sorting and pagination
SEARCH.QUERY products "laptop"
  SORTBY price ASC
  LIMIT 0 10
  WITHSCORES

# Geographic filter
SEARCH.QUERY products "*"
  GEOFILTER location -122.4 37.8 50 km

# Highlighting
SEARCH.QUERY products "laptop"
  HIGHLIGHT FIELDS 1 description TAGS "<b>" "</b>"
```

---

### SEARCH.AGGREGATE

Aggregate search results.

```bash
SEARCH.AGGREGATE index_name query
  [GROUPBY count field ... [REDUCE reducer count arg ...]]
  [SORTBY count field ASC|DESC ...]
  [APPLY expression AS alias]
  [LIMIT offset count]
  [FILTER expression]
```

**Reducers:**
- `COUNT` - Count documents
- `COUNT_DISTINCT field` - Count unique values
- `SUM field` - Sum numeric field
- `AVG field` - Average
- `MIN field` - Minimum
- `MAX field` - Maximum
- `FIRST_VALUE field` - First value
- `TOLIST field` - Collect values to list
- `QUANTILE field quantile` - Quantile value
- `STDDEV field` - Standard deviation

**Examples:**
```bash
# Count by category
SEARCH.AGGREGATE products "*"
  GROUPBY 1 @category
  REDUCE COUNT 0 AS count

# Average price by category
SEARCH.AGGREGATE products "*"
  GROUPBY 1 @category
  REDUCE AVG 1 @price AS avg_price
  SORTBY 2 @avg_price DESC

# Price ranges
SEARCH.AGGREGATE products "*"
  APPLY "floor(@price/100)*100" AS price_range
  GROUPBY 1 @price_range
  REDUCE COUNT 0 AS count
```

---

### SEARCH.EXPLAIN

Explain query execution.

```bash
SEARCH.EXPLAIN index_name query
```

---

### SEARCH.SUGADD

Add auto-complete suggestion.

```bash
SEARCH.SUGADD key string score [INCR] [PAYLOAD payload]
```

**Examples:**
```bash
SEARCH.SUGADD suggestions "laptop pro" 100
SEARCH.SUGADD suggestions "laptop air" 80
SEARCH.SUGADD suggestions "laptop gaming" 60
```

---

### SEARCH.SUGGET

Get auto-complete suggestions.

```bash
SEARCH.SUGGET key prefix [FUZZY] [WITHSCORES] [WITHPAYLOADS] [MAX count]
```

**Examples:**
```bash
SEARCH.SUGGET suggestions "lap" FUZZY MAX 5
# 1) "laptop pro"
# 2) "laptop air"
# 3) "laptop gaming"
```

---

### SEARCH.SUGDEL

Delete suggestion.

```bash
SEARCH.SUGDEL key string
```

---

### SEARCH.SUGLEN

Get suggestion count.

```bash
SEARCH.SUGLEN key
```

---

### SEARCH.INDEX.INFO

Get index information.

```bash
SEARCH.INDEX.INFO index_name
```

---

### SEARCH.INDEX.DROP

Delete an index.

```bash
SEARCH.INDEX.DROP index_name [DD]
```

`DD` - Delete associated documents too.

---

### SEARCH.INDEX.LIST

List all indexes.

```bash
SEARCH.INDEX.LIST
```

---

### SEARCH.DICTADD

Add terms to dictionary.

```bash
SEARCH.DICTADD dict_name term [term ...]
```

---

### SEARCH.DICTDEL

Delete terms from dictionary.

```bash
SEARCH.DICTDEL dict_name term [term ...]
```

---

### SEARCH.DICTDUMP

Dump dictionary terms.

```bash
SEARCH.DICTDUMP dict_name
```

---

### SEARCH.SPELLCHECK

Spell check query.

```bash
SEARCH.SPELLCHECK index_name query [DISTANCE dist] [TERMS INCLUDE|EXCLUDE dict [dict ...]]
```

**Examples:**
```bash
SEARCH.SPELLCHECK products "labtop computr"
# Suggestions: laptop, computer
```

---

### SEARCH.SYNONYM.UPDATE

Update synonym group.

```bash
SEARCH.SYNONYM.UPDATE index_name group_id term [term ...]
```

**Examples:**
```bash
SEARCH.SYNONYM.UPDATE products laptop_synonyms laptop notebook portable
```

---

### SEARCH.SYNONYM.DUMP

Dump synonyms.

```bash
SEARCH.SYNONYM.DUMP index_name
```

## Query Syntax

### Text Queries

```bash
# Single term
"laptop"

# Multiple terms (OR)
"laptop notebook"

# Phrase
'"gaming laptop"'

# Prefix
"lap*"

# Fuzzy (1 edit distance)
"%%laptop%%"

# Optional
"~laptop"
```

### Boolean Operators

```bash
# OR
"laptop | notebook"

# AND
"laptop professional"

# NOT
"laptop -gaming"

# Grouping
"(laptop | notebook) (professional | business)"
```

### Field Queries

```bash
# Specific field
"@name:laptop"

# Tag field (exact match)
"@category:{electronics}"

# Multiple tags
"@category:{electronics|computers}"

# Numeric range
"@price:[500 1500]"

# Exclusive range
"@price:[(500 (1500]"

# Combined
"@name:laptop @category:{electronics} @price:[0 2000]"
```

## Use Cases

### E-Commerce Search

```bash
# Create product index
SEARCH.INDEX.CREATE products ON products:*
  SCHEMA
    name TEXT WEIGHT 3.0
    description TEXT
    brand TAG SORTABLE
    category TAG
    price NUMERIC SORTABLE
    rating NUMERIC SORTABLE
    stock NUMERIC

# Search with filters
SEARCH.QUERY products "gaming laptop"
  FILTER price 500 2000
  FILTER rating 4 5
  SORTBY price ASC
  LIMIT 0 20
  RETURN 4 name brand price rating

# Faceted search
SEARCH.AGGREGATE products "@category:{laptops}"
  GROUPBY 1 @brand
  REDUCE COUNT 0 AS count
  REDUCE AVG 1 @price AS avg_price
  SORTBY 2 @count DESC
```

### Article Search

```bash
# Create article index
SEARCH.INDEX.CREATE articles ON articles:*
  SCHEMA
    title TEXT WEIGHT 2.0
    body TEXT
    author TAG
    published NUMERIC SORTABLE
    tags TAG

# Search with highlighting
SEARCH.QUERY articles "machine learning"
  HIGHLIGHT FIELDS 2 title body TAGS "<mark>" "</mark>"
  SUMMARIZE FIELDS 1 body LEN 100
  SORTBY published DESC
  LIMIT 0 10
```

### Log Search

```bash
# Create log index
SEARCH.INDEX.CREATE logs ON logs:*
  SCHEMA
    message TEXT
    level TAG
    service TAG
    timestamp NUMERIC SORTABLE

# Search error logs
SEARCH.QUERY logs "@level:{error} connection timeout"
  FILTER timestamp 1705320000 1705406400
  SORTBY timestamp DESC
  LIMIT 0 100
```

## Rust API

```rust
use ferrite::Client;
use ferrite::search::{Schema, FieldType, QueryOptions};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let client = Client::connect("localhost:6379").await?;

    // Create index
    client.search_index_create(
        "products",
        "products:*",
        Schema::new()
            .field("name", FieldType::Text { weight: 2.0 })
            .field("description", FieldType::Text { weight: 1.0 })
            .field("category", FieldType::Tag)
            .field("price", FieldType::Numeric { sortable: true }),
    ).await?;

    // Add documents
    client.search_add("products", "prod:1", 1.0, &[
        ("name", "Pro Laptop 15"),
        ("description", "High-performance laptop"),
        ("category", "electronics"),
        ("price", "999.99"),
    ]).await?;

    // Query
    let results = client.search_query(
        "products",
        "laptop",
        QueryOptions::default()
            .filter("price", 500.0, 1500.0)
            .sort_by("price", true)
            .limit(0, 10)
            .with_scores(),
    ).await?;

    for doc in results.documents {
        println!("{}: {} (score: {})", doc.id, doc.fields["name"], doc.score);
    }

    Ok(())
}
```

## Related Commands

- [Vector Commands](/docs/reference/commands/vector) - Semantic search
- [Document Commands](/docs/reference/commands/document) - JSON queries
- [Full-Text Search Guide](/docs/data-models/full-text-search) - Detailed guide
