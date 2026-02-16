---
maturity: experimental
---

# SDK Generator

The Ferrite SDK Generator creates type-safe, idiomatic client libraries for any programming language from your Ferrite schema and configuration.

## Overview

The SDK Generator produces production-ready client libraries with:

- **Type-safe APIs** - Generated from your schema definitions
- **Idiomatic code** - Follows language-specific conventions
- **Full feature coverage** - All Ferrite capabilities included
- **Documentation** - Inline docs and examples generated
- **Testing scaffolds** - Unit test templates included

## Installation

### CLI Tool

```bash
# Install globally
cargo install ferrite-sdk-gen

# Or use npx
npx @ferrite/sdk-gen

# Or Docker
docker run --rm -v $(pwd):/app ferrite/sdk-gen
```

### As Library

```rust
// Cargo.toml
[dependencies]
ferrite-sdk-gen = "1.0"
```

## Quick Start

### Generate from Server

```bash
# Connect to running Ferrite server and generate SDK
ferrite-sdk-gen \
  --server localhost:6380 \
  --language typescript \
  --output ./generated/ferrite-client

# Generate for multiple languages
ferrite-sdk-gen \
  --server localhost:6380 \
  --languages typescript,python,go \
  --output ./generated
```

### Generate from Schema

```bash
# Generate from schema file
ferrite-sdk-gen \
  --schema schema.yaml \
  --language typescript \
  --output ./generated/ferrite-client
```

## Schema Definition

### Basic Schema

```yaml
# schema.yaml
name: my-ferrite-sdk
version: "1.0.0"
description: "My Application's Ferrite SDK"

# Connection configuration
connection:
  default_host: localhost
  default_port: 6380
  supports_cluster: true
  supports_tls: true

# Data models
models:
  User:
    fields:
      id:
        type: string
        description: "Unique user identifier"
      name:
        type: string
        description: "User's display name"
      email:
        type: string
        format: email
      age:
        type: integer
        minimum: 0
        maximum: 150
      created_at:
        type: timestamp
      tags:
        type: array
        items:
          type: string

    # Redis storage configuration
    storage:
      type: hash
      key_pattern: "user:{id}"
      ttl: null  # No expiration

  Session:
    fields:
      token:
        type: string
      user_id:
        type: string
        ref: User.id
      data:
        type: object
      expires_at:
        type: timestamp

    storage:
      type: hash
      key_pattern: "session:{token}"
      ttl: 3600  # 1 hour

  Product:
    fields:
      id:
        type: string
      name:
        type: string
      description:
        type: string
      price:
        type: number
        minimum: 0
      embedding:
        type: vector
        dimensions: 384
      category:
        type: string
        enum: [electronics, clothing, food, other]

    storage:
      type: document
      collection: products
      indexes:
        - field: category
        - field: price
        - field: embedding
          type: vector
          algorithm: hnsw
          distance: cosine
```

### Advanced Schema Features

```yaml
# Custom commands
commands:
  get_user_with_sessions:
    description: "Get user with all active sessions"
    parameters:
      - name: user_id
        type: string
        required: true
    returns:
      type: object
      properties:
        user: { $ref: "#/models/User" }
        sessions:
          type: array
          items: { $ref: "#/models/Session" }
    implementation: |
      local user = redis.call('HGETALL', 'user:' .. ARGV[1])
      local sessions = redis.call('SMEMBERS', 'user:' .. ARGV[1] .. ':sessions')
      -- ... rest of Lua script

  rate_limit:
    description: "Check and apply rate limit"
    parameters:
      - name: key
        type: string
      - name: limit
        type: integer
      - name: window_seconds
        type: integer
    returns:
      type: object
      properties:
        allowed: { type: boolean }
        remaining: { type: integer }
        reset_at: { type: timestamp }

# Event subscriptions
events:
  user_created:
    channel: "events:user:created"
    payload: { $ref: "#/models/User" }

  user_updated:
    channel: "events:user:updated"
    payload:
      type: object
      properties:
        user: { $ref: "#/models/User" }
        changed_fields:
          type: array
          items: { type: string }

# Indexes and queries
indexes:
  users_by_email:
    model: User
    type: unique
    fields: [email]

  products_by_category:
    model: Product
    type: sorted_set
    fields: [category]
    score_field: price

# Query templates
queries:
  search_products:
    description: "Search products with filters"
    parameters:
      - name: query
        type: string
        description: "Search query"
      - name: category
        type: string
        optional: true
      - name: min_price
        type: number
        optional: true
      - name: max_price
        type: number
        optional: true
      - name: limit
        type: integer
        default: 10
    returns:
      type: array
      items: { $ref: "#/models/Product" }
```

## Language Targets

### TypeScript

```bash
ferrite-sdk-gen --language typescript --output ./sdk

# Options
ferrite-sdk-gen --language typescript \
  --option runtime=node \
  --option module=esm \
  --option include-tests=true \
  --option doc-format=tsdoc
```

**Generated Structure:**
```
sdk/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts
│   ├── client.ts
│   ├── models/
│   │   ├── User.ts
│   │   ├── Session.ts
│   │   └── Product.ts
│   ├── commands/
│   │   ├── getUserWithSessions.ts
│   │   └── rateLimit.ts
│   ├── events/
│   │   └── index.ts
│   └── queries/
│       └── searchProducts.ts
└── tests/
    └── client.test.ts
```

**Generated Code Example:**
```typescript
// src/models/User.ts
export interface User {
  /** Unique user identifier */
  id: string;
  /** User's display name */
  name: string;
  /** User's email address */
  email: string;
  /** User's age (0-150) */
  age: number;
  /** Account creation timestamp */
  createdAt: Date;
  /** User tags */
  tags: string[];
}

// src/client.ts
export class FerriteClient {
  constructor(options: ClientOptions);

  // Model operations
  readonly users: UserRepository;
  readonly sessions: SessionRepository;
  readonly products: ProductRepository;

  // Custom commands
  async getUserWithSessions(userId: string): Promise<{
    user: User;
    sessions: Session[];
  }>;

  async rateLimit(key: string, limit: number, windowSeconds: number): Promise<{
    allowed: boolean;
    remaining: number;
    resetAt: Date;
  }>;

  // Events
  readonly events: EventEmitter<{
    userCreated: User;
    userUpdated: { user: User; changedFields: string[] };
  }>;

  // Queries
  async searchProducts(params: SearchProductsParams): Promise<Product[]>;
}
```

### Python

```bash
ferrite-sdk-gen --language python --output ./sdk

# Options
ferrite-sdk-gen --language python \
  --option async=true \
  --option pydantic=true \
  --option type-hints=true \
  --option doc-format=google
```

**Generated Code Example:**
```python
# models/user.py
from pydantic import BaseModel, Field
from datetime import datetime
from typing import List, Optional

class User(BaseModel):
    """User model stored in Ferrite."""

    id: str = Field(..., description="Unique user identifier")
    name: str = Field(..., description="User's display name")
    email: str = Field(..., description="User's email address")
    age: int = Field(..., ge=0, le=150, description="User's age")
    created_at: datetime = Field(..., description="Account creation timestamp")
    tags: List[str] = Field(default_factory=list, description="User tags")

# client.py
class FerriteClient:
    """Type-safe Ferrite client."""

    def __init__(self, host: str = "localhost", port: int = 6380):
        ...

    @property
    def users(self) -> UserRepository:
        """Access user operations."""
        ...

    async def get_user_with_sessions(self, user_id: str) -> UserWithSessions:
        """Get user with all active sessions."""
        ...

    async def search_products(
        self,
        query: str,
        category: Optional[str] = None,
        min_price: Optional[float] = None,
        max_price: Optional[float] = None,
        limit: int = 10,
    ) -> List[Product]:
        """Search products with filters."""
        ...
```

### Go

```bash
ferrite-sdk-gen --language go --output ./sdk

# Options
ferrite-sdk-gen --language go \
  --option package=ferritesdk \
  --option generics=true \
  --option context=true
```

**Generated Code Example:**
```go
// models.go
package ferritesdk

import "time"

// User represents a user stored in Ferrite.
type User struct {
    // ID is the unique user identifier.
    ID string `redis:"id" json:"id"`
    // Name is the user's display name.
    Name string `redis:"name" json:"name"`
    // Email is the user's email address.
    Email string `redis:"email" json:"email"`
    // Age is the user's age (0-150).
    Age int `redis:"age" json:"age"`
    // CreatedAt is the account creation timestamp.
    CreatedAt time.Time `redis:"created_at" json:"created_at"`
    // Tags are the user tags.
    Tags []string `redis:"tags" json:"tags"`
}

// client.go
type Client struct {
    // ...
}

// Users returns the user repository.
func (c *Client) Users() *UserRepository { ... }

// GetUserWithSessions gets a user with all active sessions.
func (c *Client) GetUserWithSessions(ctx context.Context, userID string) (*UserWithSessions, error) { ... }

// SearchProducts searches products with filters.
func (c *Client) SearchProducts(ctx context.Context, params SearchProductsParams) ([]Product, error) { ... }
```

### Rust

```bash
ferrite-sdk-gen --language rust --output ./sdk

# Options
ferrite-sdk-gen --language rust \
  --option async-runtime=tokio \
  --option serde=true \
  --option derive-debug=true
```

**Generated Code Example:**
```rust
// models.rs
use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};

/// User stored in Ferrite.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct User {
    /// Unique user identifier.
    pub id: String,
    /// User's display name.
    pub name: String,
    /// User's email address.
    pub email: String,
    /// User's age (0-150).
    pub age: u8,
    /// Account creation timestamp.
    pub created_at: DateTime<Utc>,
    /// User tags.
    pub tags: Vec<String>,
}

// client.rs
pub struct FerriteClient {
    // ...
}

impl FerriteClient {
    /// Get user with all active sessions.
    pub async fn get_user_with_sessions(&self, user_id: &str) -> Result<UserWithSessions> { ... }

    /// Search products with filters.
    pub async fn search_products(&self, params: SearchProductsParams) -> Result<Vec<Product>> { ... }
}
```

### Java

```bash
ferrite-sdk-gen --language java --output ./sdk

# Options
ferrite-sdk-gen --language java \
  --option package=io.ferrite.generated \
  --option lombok=true \
  --option reactive=true
```

## Repository Pattern

Generated SDKs include repository classes for each model:

### TypeScript Example

```typescript
// Generated UserRepository
export class UserRepository {
  constructor(private client: FerriteClient);

  // CRUD operations
  async create(user: Omit<User, 'id' | 'createdAt'>): Promise<User>;
  async get(id: string): Promise<User | null>;
  async update(id: string, updates: Partial<User>): Promise<User>;
  async delete(id: string): Promise<boolean>;

  // Batch operations
  async getMany(ids: string[]): Promise<Map<string, User>>;
  async createMany(users: Omit<User, 'id' | 'createdAt'>[]): Promise<User[]>;
  async deleteMany(ids: string[]): Promise<number>;

  // Query operations
  async findByEmail(email: string): Promise<User | null>;
  async findByTags(tags: string[]): Promise<User[]>;

  // Iteration
  async *scan(pattern?: string): AsyncGenerator<User>;

  // Count
  async count(): Promise<number>;
}

// Usage
const client = new FerriteClient({ host: 'localhost', port: 6380 });

// Create user
const user = await client.users.create({
  name: 'Alice',
  email: 'alice@example.com',
  age: 30,
  tags: ['premium'],
});

// Get user
const found = await client.users.get(user.id);

// Update user
const updated = await client.users.update(user.id, { age: 31 });

// Find by email
const byEmail = await client.users.findByEmail('alice@example.com');

// Scan all users
for await (const user of client.users.scan()) {
  console.log(user.name);
}
```

## Validation

Generated SDKs include validation based on schema constraints:

```typescript
// Schema defines: age: { type: integer, minimum: 0, maximum: 150 }

// Generated validation
const user = await client.users.create({
  name: 'Alice',
  email: 'invalid-email',  // ValidationError: Invalid email format
  age: 200,                // ValidationError: age must be <= 150
  tags: ['premium'],
});
```

## Custom Templates

Override default code generation templates:

```bash
# Create custom templates directory
mkdir templates

# Copy default templates
ferrite-sdk-gen --export-templates typescript --output templates/

# Customize templates/typescript/model.ts.hbs
# Edit as needed...

# Generate with custom templates
ferrite-sdk-gen \
  --schema schema.yaml \
  --language typescript \
  --templates ./templates/typescript \
  --output ./sdk
```

### Template Variables

```handlebars
{{! model.ts.hbs }}
/**
 * {{model.description}}
 * @generated by ferrite-sdk-gen
 */
export interface {{model.name}} {
{{#each model.fields}}
  /**
   * {{this.description}}
   {{#if this.minimum}}* @minimum {{this.minimum}}{{/if}}
   {{#if this.maximum}}* @maximum {{this.maximum}}{{/if}}
   */
  {{this.name}}: {{this.typescript_type}};
{{/each}}
}
```

## Plugins

Extend the generator with plugins:

```javascript
// plugins/add-timestamps.js
module.exports = {
  name: 'add-timestamps',

  // Hook into model processing
  processModel(model, context) {
    // Add created_at and updated_at to all models
    return {
      ...model,
      fields: {
        ...model.fields,
        created_at: { type: 'timestamp', auto: 'create' },
        updated_at: { type: 'timestamp', auto: 'update' },
      },
    };
  },

  // Hook into code generation
  generateCode(code, context) {
    // Add imports
    if (context.language === 'typescript') {
      return `import { Timestamp } from './types';\n\n${code}`;
    }
    return code;
  },
};
```

```bash
ferrite-sdk-gen \
  --schema schema.yaml \
  --language typescript \
  --plugin ./plugins/add-timestamps.js \
  --output ./sdk
```

## CI/CD Integration

### GitHub Actions

```yaml
# .github/workflows/generate-sdk.yml
name: Generate SDK

on:
  push:
    paths:
      - 'schema.yaml'

jobs:
  generate:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        language: [typescript, python, go, java]

    steps:
      - uses: actions/checkout@v3

      - name: Generate SDK
        uses: ferrite/sdk-gen-action@v1
        with:
          schema: schema.yaml
          language: ${{ matrix.language }}
          output: sdk/${{ matrix.language }}

      - name: Publish SDK
        run: |
          cd sdk/${{ matrix.language }}
          # Language-specific publish steps
```

### Programmatic Usage

```rust
use ferrite_sdk_gen::{Generator, Schema, LanguageTarget};

fn main() -> Result<()> {
    // Load schema
    let schema = Schema::from_file("schema.yaml")?;

    // Create generator
    let generator = Generator::new()
        .with_schema(schema)
        .with_target(LanguageTarget::TypeScript {
            runtime: "node".into(),
            module_format: "esm".into(),
        })
        .with_output("./generated/typescript");

    // Generate SDK
    generator.generate()?;

    Ok(())
}
```

## Configuration File

```yaml
# ferrite-sdk-gen.yaml
schema: schema.yaml

targets:
  - language: typescript
    output: ./sdk/typescript
    options:
      runtime: node
      module: esm
      include-tests: true

  - language: python
    output: ./sdk/python
    options:
      async: true
      pydantic: true

  - language: go
    output: ./sdk/go
    options:
      package: ferritesdk
      generics: true

plugins:
  - ./plugins/add-timestamps.js
  - ./plugins/custom-validation.js

templates:
  typescript: ./templates/typescript
```

```bash
# Run with config file
ferrite-sdk-gen --config ferrite-sdk-gen.yaml
```

## Best Practices

### Schema Design

1. **Use descriptive names** - Models and fields should be self-documenting
2. **Add descriptions** - Include descriptions for all models and fields
3. **Define constraints** - Use minimum, maximum, enum, format for validation
4. **Use references** - Link related models with `$ref`
5. **Version your schema** - Track schema versions for compatibility

### Generated Code

1. **Don't modify generated code** - Use extensions/inheritance instead
2. **Regenerate regularly** - Keep SDK in sync with schema
3. **Test generated code** - Run included tests after generation
4. **Document customizations** - If using plugins/templates, document them

## Next Steps

- [Rust SDK](/docs/sdk/rust) - Official Rust SDK
- [Python SDK](/docs/sdk/python) - Official Python SDK
- [TypeScript SDK](/docs/sdk/typescript) - Official TypeScript SDK
- [Go SDK](/docs/sdk/go) - Official Go SDK
- [Java SDK](/docs/sdk/java) - Official Java SDK
