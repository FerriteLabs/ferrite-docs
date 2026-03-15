---
sidebar_position: 4
maturity: beta
---

:::info Beta Feature
This feature is in **beta**. It is feature-complete but still undergoing testing. APIs may change in minor ways before stabilization.
:::

# Full-Text Search

Ferrite includes a powerful full-text search engine with inverted indexes, BM25 scoring, faceted search, and fuzzy matching.

## Overview

The search engine provides:
- **Inverted indexes** - Fast term lookups
- **BM25 scoring** - Industry-standard relevance ranking
- **Multiple query types** - Term, phrase, boolean, fuzzy, wildcard, range
- **Text analysis** - Tokenization, stemming, stop words
- **Faceted search** - Category aggregations
- **Highlighting** - Match highlighting in results

## Quick Start

### Creating a Search Index

```bash
# Create a basic index
SEARCH.INDEX.CREATE products

# Create with custom analyzer
SEARCH.INDEX.CREATE articles ANALYZER standard
```

### Indexing Documents

```bash
# Add document to index
SEARCH.ADD products doc1 '{
  "title": "Wireless Bluetooth Headphones",
  "description": "High-quality wireless headphones with noise cancellation",
  "category": "electronics",
  "price": 99.99,
  "in_stock": true
}'

# Bulk indexing
SEARCH.ADDBULK products '[
  {"id": "doc2", "title": "USB-C Cable", "category": "electronics", "price": 12.99},
  {"id": "doc3", "title": "Laptop Stand", "category": "accessories", "price": 49.99}
]'
```

### Searching

```bash
# Simple search
SEARCH.QUERY products "wireless headphones"

# Field-specific search
SEARCH.QUERY products "title:wireless"

# With options
SEARCH.QUERY products "headphones" LIMIT 10 OFFSET 0 HIGHLIGHT
```

## Query Syntax

### Basic Queries

```bash
# Single term
SEARCH.QUERY products "wireless"

# Multiple terms (OR by default)
SEARCH.QUERY products "wireless bluetooth"

# Phrase search (exact)
SEARCH.QUERY products '"wireless headphones"'

# Field-specific
SEARCH.QUERY products "title:headphones"
```

### Boolean Operators

```bash
# AND - both terms required
SEARCH.QUERY products "wireless AND bluetooth"

# OR - either term
SEARCH.QUERY products "wireless OR wired"

# NOT - exclude term
SEARCH.QUERY products "headphones NOT wireless"

# Required (+) and excluded (-)
SEARCH.QUERY products "+wireless -cheap headphones"
```

### Fuzzy Search

```bash
# Fuzzy matching (handles typos)
SEARCH.QUERY products "wireles~"    # Matches "wireless"
SEARCH.QUERY products "headphons~"  # Matches "headphones"

# With edit distance
SEARCH.QUERY products "wireles~2"   # Up to 2 edits
```

### Wildcard Search

```bash
# Prefix wildcard
SEARCH.QUERY products "wire*"       # Matches "wireless", "wired"

# Single character wildcard
SEARCH.QUERY products "h?adphones"  # Matches "headphones"
```

### Range Queries

```bash
# Numeric range
SEARCH.QUERY products "price:[10 TO 100]"

# Inclusive and exclusive
SEARCH.QUERY products "price:[10 TO 100}"  # 10 inclusive, 100 exclusive

# Open-ended
SEARCH.QUERY products "price:[50 TO *]"    # >= 50
```

## Query Types (Programmatic)

### Term Query

```rust
use ferrite::search::{Query, TermQuery};

let query = Query::Term(TermQuery {
    field: "title".to_string(),
    term: "headphones".to_string(),
});
```

### Boolean Query

```rust
use ferrite::search::{Query, BooleanQuery, Occur};

let query = Query::Boolean(BooleanQuery {
    must: vec![
        Query::term("category", "electronics"),
    ],
    should: vec![
        Query::term("title", "wireless"),
        Query::term("title", "bluetooth"),
    ],
    must_not: vec![
        Query::term("discontinued", "true"),
    ],
});
```

### Phrase Query

```rust
use ferrite::search::{Query, PhraseQuery};

// Exact phrase
let query = Query::Phrase(PhraseQuery {
    field: "title".to_string(),
    terms: vec!["wireless".to_string(), "headphones".to_string()],
    slop: 0,
});

// With slop (allows words between)
let query = Query::Phrase(PhraseQuery {
    field: "description".to_string(),
    terms: vec!["noise".to_string(), "cancellation".to_string()],
    slop: 2,  // Up to 2 words between
});
```

### Fuzzy Query

```rust
use ferrite::search::{Query, FuzzyQuery};

let query = Query::Fuzzy(FuzzyQuery {
    field: "title".to_string(),
    term: "wireles".to_string(),
    max_distance: 2,
});
```

### Prefix Query

```rust
use ferrite::search::{Query, PrefixQuery};

let query = Query::Prefix(PrefixQuery {
    field: "title".to_string(),
    prefix: "wire".to_string(),
});
```

### Wildcard Query

```rust
use ferrite::search::{Query, WildcardQuery};

let query = Query::Wildcard(WildcardQuery {
    field: "title".to_string(),
    pattern: "h*phones".to_string(),
});
```

### Range Query

```rust
use ferrite::search::{Query, RangeQuery};

let query = Query::Range(RangeQuery {
    field: "price".to_string(),
    lower: Some(10.0),
    upper: Some(100.0),
    lower_inclusive: true,
    upper_inclusive: true,
});
```

## Query Builder

```rust
use ferrite::search::QueryBuilder;

let query = QueryBuilder::new()
    .must_match("wireless")
    .must_match_field("category", "electronics")
    .should_match("bluetooth")
    .must_not_match("discontinued")
    .fuzzy("headphons", 2)
    .build();
```

## Text Analysis

### Standard Analyzer (Default)

The standard analyzer:
1. Tokenizes on whitespace and punctuation
2. Lowercases all tokens
3. Removes English stop words
4. Applies Porter stemming

```
"High-Quality WIRELESS Headphones!"
→ ["high", "qualiti", "wireless", "headphon"]
```

### Available Tokenizers

| Tokenizer | Description |
|-----------|-------------|
| `standard` | Splits on whitespace/punctuation, length limits |
| `whitespace` | Simple whitespace splitting |
| `keyword` | No tokenization (treat as single token) |
| `ngram` | Generate n-grams for partial matching |

### Token Filters

| Filter | Description |
|--------|-------------|
| `lowercase` | Normalize to lowercase |
| `stopwords` | Remove common words |
| `stemmer` | Porter stemming |
| `length` | Filter by token length |
| `trim` | Remove whitespace |
| `ascii_folding` | Remove accents |
| `synonym` | Expand synonyms |

### Custom Analyzer

```rust
use ferrite::search::{Analyzer, Tokenizer, TokenFilter};

let analyzer = Analyzer::builder()
    .tokenizer(Tokenizer::Standard)
    .filter(TokenFilter::Lowercase)
    .filter(TokenFilter::StopWords(vec!["the", "a", "an"]))
    .filter(TokenFilter::Stemmer)
    .build();
```

## Scoring

### BM25 (Default)

BM25 balances term frequency and document length:

```rust
use ferrite::search::{Scorer, BM25Scorer};

let scorer = BM25Scorer::new()
    .k1(1.2)   // Term frequency saturation
    .b(0.75);  // Length normalization
```

### TF-IDF

```rust
use ferrite::search::TfIdfScorer;

let scorer = TfIdfScorer::new()
    .sublinear_tf(true)  // Use 1 + log(tf)
    .smooth_idf(true);   // Prevent division by zero
```

### Score Explanation

```rust
let results = index.search_with_explain(&query)?;

for hit in results.hits {
    println!("Score: {}", hit.score);
    println!("Explanation: {:?}", hit.explanation);
}
```

## Faceted Search

### Define Facets

```rust
use ferrite::search::FacetBuilder;

let facets = FacetBuilder::new()
    .terms("category")
    .range("price", vec![
        Range::lt(25.0),
        Range::between(25.0, 100.0),
        Range::gt(100.0),
    ])
    .histogram("rating", 1.0)
    .build();

let results = index.search_with_facets(&query, &facets)?;
```

### Facet Types

| Type | Description |
|------|-------------|
| `terms` | Count by unique values |
| `range` | Count in value ranges |
| `histogram` | Fixed-interval buckets |
| `date_histogram` | Time-based buckets |
| `stats` | Statistics (min, max, avg, sum) |
| `cardinality` | Unique value count |

### Using Facet Results

```rust
let facet_results = results.facets;

// Terms facet
if let Some(categories) = facet_results.get("category") {
    for (value, count) in categories.buckets() {
        println!("{}: {} items", value, count);
    }
}

// Range facet
if let Some(prices) = facet_results.get("price") {
    println!("Under $25: {}", prices.bucket("lt_25.0"));
    println!("$25-$100: {}", prices.bucket("25.0_100.0"));
    println!("Over $100: {}", prices.bucket("gt_100.0"));
}
```

## Highlighting

```rust
use ferrite::search::HighlightConfig;

let config = HighlightConfig {
    pre_tag: "<mark>".to_string(),
    post_tag: "</mark>".to_string(),
    fragment_size: 150,
    max_fragments: 3,
};

let results = index.search_with_highlight(&query, &config)?;

for hit in results.hits {
    if let Some(highlights) = hit.highlights.get("description") {
        for fragment in highlights {
            println!("{}", fragment);
            // "High-quality <mark>wireless</mark> <mark>headphones</mark> with..."
        }
    }
}
```

## Suggestions

### Autocomplete

```rust
use ferrite::search::SuggestionConfig;

let config = SuggestionConfig {
    max_suggestions: 10,
    fuzzy: true,
    max_edits: 2,
};

let suggestions = index.suggest("wire", &config)?;
// ["wireless", "wired", "wire"]
```

### Did You Mean

```rust
let suggestions = index.did_you_mean("wireles headphons")?;
// "wireless headphones"
```

## Document Model

### Field Types

| Type | Description | Indexed | Stored |
|------|-------------|---------|--------|
| `Text` | Analyzed text | Yes | Optional |
| `Keyword` | Exact value | Yes | Yes |
| `Number` | Numeric value | Yes | Yes |
| `Boolean` | True/false | Yes | Yes |
| `Date` | Timestamp | Yes | Yes |
| `Binary` | Raw bytes | No | Yes |
| `GeoPoint` | Coordinates | Yes | Yes |

### Document Builder

```rust
use ferrite::search::{Document, FieldType};

let doc = Document::builder()
    .id("doc1")
    .field("title", "Wireless Headphones", FieldType::Text)
    .field("category", "electronics", FieldType::Keyword)
    .field("price", 99.99, FieldType::Number)
    .field("in_stock", true, FieldType::Boolean)
    .field("created_at", SystemTime::now(), FieldType::Date)
    .boost(1.5)  // Document-level boost
    .build();
```

## Search Options

```rust
use ferrite::search::SearchOptions;

let options = SearchOptions {
    limit: 20,
    offset: 0,
    min_score: 0.5,
    include_scores: true,
    highlight: Some(HighlightConfig::default()),
    facets: Some(facets),
    sort: Some(vec![
        Sort::field("price", SortOrder::Asc),
        Sort::score(),  // Then by relevance
    ]),
};

let results = index.search(&query, &options)?;
```

## Embedded Mode (Rust)

```rust
use ferrite::search::{SearchEngine, SearchConfig, Document};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Create search engine
    let config = SearchConfig::default();
    let engine = SearchEngine::new(config);

    // Create index
    engine.create_index("products")?;

    // Index documents
    let doc = Document::builder()
        .id("1")
        .field("title", "Wireless Headphones", FieldType::Text)
        .field("description", "High-quality audio with noise cancellation", FieldType::Text)
        .field("price", 99.99, FieldType::Number)
        .build();

    engine.index("products", doc)?;

    // Search
    let query = QueryBuilder::new()
        .must_match("wireless")
        .build();

    let results = engine.search("products", &query, &SearchOptions::default())?;

    for hit in results.hits {
        println!("ID: {}, Score: {}", hit.id, hit.score);
    }

    Ok(())
}
```

## Performance

| Operation | Latency |
|-----------|---------|
| Index document | &lt;1ms |
| Simple query | &lt;10ms |
| Complex boolean query | &lt;50ms |
| Faceted search | &lt;100ms |
| Autocomplete | &lt;5ms |

## Best Practices

1. **Choose field types carefully** - Use `Keyword` for exact matching, `Text` for full-text
2. **Use compound queries** - Combine must/should/must_not for precision
3. **Leverage facets** - Pre-compute aggregations during search
4. **Tune BM25 parameters** - Adjust k1 and b for your content
5. **Index selectively** - Only index fields you'll search
6. **Use highlighting sparingly** - It adds overhead
7. **Implement pagination** - Use limit/offset for large result sets

## Next Steps

- [Document Store](/docs/data-models/document-store) - JSON document queries
- [FerriteQL](/docs/query/ferriteql) - SQL-like queries
- [Semantic Search](/docs/ai-ml/semantic-search) - Vector-based search
