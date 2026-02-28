---
sidebar_position: 7
maturity: experimental
---

# Build an Event Sourcing System

Learn how to implement event sourcing and CQRS patterns using Ferrite's streams and CDC capabilities.

## What You'll Build

A complete event sourcing system with:
- Event store with streams
- Command handling and validation
- Event projections
- Snapshots for performance
- CDC for external consumers

## Prerequisites

- Ferrite server running
- Understanding of event sourcing concepts

## Architecture

```text
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Command   │────▶│   Handler   │────▶│ Event Store │
└─────────────┘     └─────────────┘     │  (Stream)   │
                                        └─────────────┘
                                               │
       ┌───────────────────────────────────────┼───────────────────┐
       │                                       │                   │
       ▼                                       ▼                   ▼
┌─────────────┐                        ┌─────────────┐     ┌─────────────┐
│  Read Model │                        │  Snapshot   │     │  CDC Sink   │
│ (Projector) │                        │   Store     │     │   (Kafka)   │
└─────────────┘                        └─────────────┘     └─────────────┘
```

## Step 1: Project Setup

```toml
# Cargo.toml
[dependencies]
ferrite-client = "0.1"
tokio = { version = "1", features = ["full"] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
uuid = { version = "1", features = ["v4"] }
chrono = { version = "0.4", features = ["serde"] }
async-trait = "0.1"
```

## Step 2: Define Core Types

```rust
// src/types.rs
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

pub type AggregateId = String;
pub type EventId = String;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Event<T: Serialize> {
    pub id: EventId,
    pub aggregate_id: AggregateId,
    pub aggregate_type: String,
    pub event_type: String,
    pub data: T,
    pub metadata: EventMetadata,
    pub version: u64,
    pub timestamp: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct EventMetadata {
    pub correlation_id: Option<String>,
    pub causation_id: Option<String>,
    pub user_id: Option<String>,
    pub trace_id: Option<String>,
}

#[derive(Debug, Clone)]
pub struct Command<T> {
    pub aggregate_id: AggregateId,
    pub payload: T,
    pub metadata: EventMetadata,
}

#[derive(Debug)]
pub enum CommandError {
    ValidationError(String),
    ConcurrencyError(String),
    NotFound(String),
    InternalError(String),
}
```

## Step 3: Aggregate Trait

```rust
// src/aggregate.rs
use crate::types::*;
use async_trait::async_trait;

#[async_trait]
pub trait Aggregate: Default + Send + Sync + Clone {
    type Command: Send + Sync;
    type Event: Serialize + for<'de> Deserialize<'de> + Send + Sync + Clone;

    fn aggregate_type() -> &'static str;

    fn apply(&mut self, event: &Self::Event);

    fn handle(&self, command: &Self::Command) -> Result<Vec<Self::Event>, CommandError>;

    fn version(&self) -> u64;
    fn set_version(&mut self, version: u64);
}
```

## Step 4: Event Store Implementation

```rust
// src/event_store.rs
use crate::aggregate::Aggregate;
use crate::types::*;
use ferrite_client::Client;
use chrono::Utc;
use uuid::Uuid;

pub struct EventStore {
    client: Client,
    snapshot_threshold: u64,
}

impl EventStore {
    pub async fn new(addr: &str) -> Result<Self, Box<dyn std::error::Error>> {
        let client = Client::connect(addr).await?;
        Ok(Self {
            client,
            snapshot_threshold: 100,
        })
    }

    /// Append events to a stream
    pub async fn append<A: Aggregate>(
        &self,
        aggregate_id: &str,
        events: Vec<A::Event>,
        expected_version: u64,
        metadata: EventMetadata,
    ) -> Result<u64, Box<dyn std::error::Error>> {
        let stream_key = format!("events:{}:{}", A::aggregate_type(), aggregate_id);

        // Use Lua script for optimistic concurrency
        let script = r#"
            local stream_key = KEYS[1]
            local expected_version = tonumber(ARGV[1])
            local events_json = ARGV[2]

            -- Get current stream length
            local current_length = redis.call('XLEN', stream_key)

            -- Check expected version
            if expected_version ~= current_length then
                return {err = 'CONCURRENCY_ERROR', current = current_length}
            end

            -- Parse events
            local events = cjson.decode(events_json)
            local new_version = current_length

            for _, event in ipairs(events) do
                new_version = new_version + 1
                event.version = new_version

                redis.call('XADD', stream_key, '*',
                    'id', event.id,
                    'type', event.event_type,
                    'data', cjson.encode(event.data),
                    'metadata', cjson.encode(event.metadata),
                    'version', new_version,
                    'timestamp', event.timestamp
                )
            end

            return {ok = new_version}
        "#;

        let events_with_ids: Vec<serde_json::Value> = events.iter().enumerate()
            .map(|(i, event)| {
                json!({
                    "id": Uuid::new_v4().to_string(),
                    "event_type": std::any::type_name::<A::Event>(),
                    "data": event,
                    "metadata": metadata,
                    "timestamp": Utc::now().to_rfc3339()
                })
            })
            .collect();

        let result: serde_json::Value = self.client.eval(
            script,
            &[&stream_key],
            &[
                &expected_version.to_string(),
                &serde_json::to_string(&events_with_ids)?,
            ],
        ).await?;

        if let Some(err) = result.get("err") {
            return Err(format!("Concurrency error: {}", err).into());
        }

        let new_version = result.get("ok")
            .and_then(|v| v.as_u64())
            .unwrap_or(expected_version);

        // Check if snapshot is needed
        if new_version % self.snapshot_threshold == 0 {
            self.create_snapshot::<A>(aggregate_id).await?;
        }

        Ok(new_version)
    }

    /// Load aggregate from events
    pub async fn load<A: Aggregate>(
        &self,
        aggregate_id: &str,
    ) -> Result<Option<A>, Box<dyn std::error::Error>> {
        let stream_key = format!("events:{}:{}", A::aggregate_type(), aggregate_id);
        let snapshot_key = format!("snapshot:{}:{}", A::aggregate_type(), aggregate_id);

        // Try to load from snapshot first
        let (mut aggregate, start_version) = if let Some(snapshot_json) = self.client.get::<String>(&snapshot_key).await? {
            let snapshot: Snapshot<A> = serde_json::from_str(&snapshot_json)?;
            (snapshot.aggregate, snapshot.version)
        } else {
            (A::default(), 0)
        };

        // Load events after snapshot
        let events = self.read_events::<A>(aggregate_id, start_version).await?;

        if events.is_empty() && start_version == 0 {
            return Ok(None);
        }

        // Apply events to aggregate
        for event in events {
            aggregate.apply(&event.data);
            aggregate.set_version(event.version);
        }

        Ok(Some(aggregate))
    }

    /// Read events from a stream
    pub async fn read_events<A: Aggregate>(
        &self,
        aggregate_id: &str,
        from_version: u64,
    ) -> Result<Vec<Event<A::Event>>, Box<dyn std::error::Error>> {
        let stream_key = format!("events:{}:{}", A::aggregate_type(), aggregate_id);

        // Read from stream
        let entries: Vec<(String, Vec<(String, String)>)> = self.client
            .xrange(&stream_key, "-", "+")
            .await?;

        let mut events = Vec::new();
        for (entry_id, fields) in entries {
            let fields: std::collections::HashMap<_, _> = fields.into_iter().collect();

            let version: u64 = fields.get("version")
                .and_then(|v| v.parse().ok())
                .unwrap_or(0);

            if version <= from_version {
                continue;
            }

            let event_data: A::Event = fields.get("data")
                .and_then(|d| serde_json::from_str(d).ok())
                .unwrap_or_else(|| panic!("Invalid event data"));

            let metadata: EventMetadata = fields.get("metadata")
                .and_then(|m| serde_json::from_str(m).ok())
                .unwrap_or_default();

            events.push(Event {
                id: fields.get("id").cloned().unwrap_or_default(),
                aggregate_id: aggregate_id.to_string(),
                aggregate_type: A::aggregate_type().to_string(),
                event_type: fields.get("type").cloned().unwrap_or_default(),
                data: event_data,
                metadata,
                version,
                timestamp: fields.get("timestamp")
                    .and_then(|t| DateTime::parse_from_rfc3339(t).ok())
                    .map(|t| t.with_timezone(&Utc))
                    .unwrap_or_else(Utc::now),
            });
        }

        Ok(events)
    }

    async fn create_snapshot<A: Aggregate>(
        &self,
        aggregate_id: &str,
    ) -> Result<(), Box<dyn std::error::Error>> {
        if let Some(aggregate) = self.load::<A>(aggregate_id).await? {
            let snapshot = Snapshot {
                aggregate_id: aggregate_id.to_string(),
                aggregate: aggregate.clone(),
                version: aggregate.version(),
                created_at: Utc::now(),
            };

            let snapshot_key = format!("snapshot:{}:{}", A::aggregate_type(), aggregate_id);
            self.client.set(&snapshot_key, &serde_json::to_string(&snapshot)?).await?;
        }
        Ok(())
    }
}

#[derive(Serialize, Deserialize)]
struct Snapshot<A: Aggregate> {
    aggregate_id: String,
    aggregate: A,
    version: u64,
    created_at: DateTime<Utc>,
}
```

## Step 5: Example: Bank Account Aggregate

```rust
// src/bank_account.rs
use crate::aggregate::Aggregate;
use crate::types::*;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct BankAccount {
    pub id: String,
    pub balance: i64,
    pub status: AccountStatus,
    version: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
pub enum AccountStatus {
    #[default]
    Pending,
    Active,
    Frozen,
    Closed,
}

// Commands
#[derive(Debug)]
pub enum BankAccountCommand {
    Open { initial_balance: i64 },
    Deposit { amount: i64 },
    Withdraw { amount: i64 },
    Freeze,
    Close,
}

// Events
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum BankAccountEvent {
    Opened { initial_balance: i64 },
    Deposited { amount: i64, new_balance: i64 },
    Withdrawn { amount: i64, new_balance: i64 },
    Frozen,
    Closed,
}

impl Aggregate for BankAccount {
    type Command = BankAccountCommand;
    type Event = BankAccountEvent;

    fn aggregate_type() -> &'static str {
        "BankAccount"
    }

    fn apply(&mut self, event: &Self::Event) {
        match event {
            BankAccountEvent::Opened { initial_balance } => {
                self.balance = *initial_balance;
                self.status = AccountStatus::Active;
            }
            BankAccountEvent::Deposited { new_balance, .. } => {
                self.balance = *new_balance;
            }
            BankAccountEvent::Withdrawn { new_balance, .. } => {
                self.balance = *new_balance;
            }
            BankAccountEvent::Frozen => {
                self.status = AccountStatus::Frozen;
            }
            BankAccountEvent::Closed => {
                self.status = AccountStatus::Closed;
            }
        }
    }

    fn handle(&self, command: &Self::Command) -> Result<Vec<Self::Event>, CommandError> {
        match command {
            BankAccountCommand::Open { initial_balance } => {
                if self.status != AccountStatus::Pending {
                    return Err(CommandError::ValidationError("Account already exists".to_string()));
                }
                if *initial_balance < 0 {
                    return Err(CommandError::ValidationError("Initial balance cannot be negative".to_string()));
                }
                Ok(vec![BankAccountEvent::Opened {
                    initial_balance: *initial_balance,
                }])
            }
            BankAccountCommand::Deposit { amount } => {
                if self.status != AccountStatus::Active {
                    return Err(CommandError::ValidationError("Account is not active".to_string()));
                }
                if *amount <= 0 {
                    return Err(CommandError::ValidationError("Amount must be positive".to_string()));
                }
                Ok(vec![BankAccountEvent::Deposited {
                    amount: *amount,
                    new_balance: self.balance + amount,
                }])
            }
            BankAccountCommand::Withdraw { amount } => {
                if self.status != AccountStatus::Active {
                    return Err(CommandError::ValidationError("Account is not active".to_string()));
                }
                if *amount <= 0 {
                    return Err(CommandError::ValidationError("Amount must be positive".to_string()));
                }
                if self.balance < *amount {
                    return Err(CommandError::ValidationError("Insufficient funds".to_string()));
                }
                Ok(vec![BankAccountEvent::Withdrawn {
                    amount: *amount,
                    new_balance: self.balance - amount,
                }])
            }
            BankAccountCommand::Freeze => {
                if self.status != AccountStatus::Active {
                    return Err(CommandError::ValidationError("Can only freeze active accounts".to_string()));
                }
                Ok(vec![BankAccountEvent::Frozen])
            }
            BankAccountCommand::Close => {
                if self.balance != 0 {
                    return Err(CommandError::ValidationError("Balance must be zero to close".to_string()));
                }
                Ok(vec![BankAccountEvent::Closed])
            }
        }
    }

    fn version(&self) -> u64 {
        self.version
    }

    fn set_version(&mut self, version: u64) {
        self.version = version;
    }
}
```

## Step 6: Command Handler

```rust
// src/command_handler.rs
use crate::aggregate::Aggregate;
use crate::event_store::EventStore;
use crate::types::*;

pub struct CommandHandler {
    event_store: EventStore,
}

impl CommandHandler {
    pub fn new(event_store: EventStore) -> Self {
        Self { event_store }
    }

    pub async fn handle<A: Aggregate>(
        &self,
        aggregate_id: &str,
        command: A::Command,
        metadata: EventMetadata,
    ) -> Result<u64, CommandError> {
        // Load current state
        let aggregate = self.event_store
            .load::<A>(aggregate_id)
            .await
            .map_err(|e| CommandError::InternalError(e.to_string()))?
            .unwrap_or_default();

        let expected_version = aggregate.version();

        // Handle command to produce events
        let events = aggregate.handle(&command)?;

        if events.is_empty() {
            return Ok(expected_version);
        }

        // Append events
        let new_version = self.event_store
            .append::<A>(aggregate_id, events, expected_version, metadata)
            .await
            .map_err(|e| {
                if e.to_string().contains("CONCURRENCY_ERROR") {
                    CommandError::ConcurrencyError(e.to_string())
                } else {
                    CommandError::InternalError(e.to_string())
                }
            })?;

        Ok(new_version)
    }
}
```

## Step 7: Projections

```rust
// src/projections.rs
use crate::bank_account::*;
use crate::types::*;
use ferrite_client::Client;
use async_trait::async_trait;

#[async_trait]
pub trait Projection: Send + Sync {
    type Event;

    async fn apply(&self, event: &Event<Self::Event>) -> Result<(), Box<dyn std::error::Error>>;
}

pub struct AccountBalanceProjection {
    client: Client,
}

impl AccountBalanceProjection {
    pub async fn new(addr: &str) -> Result<Self, Box<dyn std::error::Error>> {
        let client = Client::connect(addr).await?;
        Ok(Self { client })
    }
}

#[async_trait]
impl Projection for AccountBalanceProjection {
    type Event = BankAccountEvent;

    async fn apply(&self, event: &Event<Self::Event>) -> Result<(), Box<dyn std::error::Error>> {
        let key = format!("read:balance:{}", event.aggregate_id);

        match &event.data {
            BankAccountEvent::Opened { initial_balance } => {
                self.client.hset(&key, &[
                    ("balance", &initial_balance.to_string()),
                    ("status", "active"),
                    ("updated_at", &event.timestamp.to_rfc3339()),
                ]).await?;
            }
            BankAccountEvent::Deposited { new_balance, .. } |
            BankAccountEvent::Withdrawn { new_balance, .. } => {
                self.client.hset(&key, &[
                    ("balance", &new_balance.to_string()),
                    ("updated_at", &event.timestamp.to_rfc3339()),
                ]).await?;
            }
            BankAccountEvent::Frozen => {
                self.client.hset(&key, &[
                    ("status", "frozen"),
                    ("updated_at", &event.timestamp.to_rfc3339()),
                ]).await?;
            }
            BankAccountEvent::Closed => {
                self.client.hset(&key, &[
                    ("status", "closed"),
                    ("updated_at", &event.timestamp.to_rfc3339()),
                ]).await?;
            }
        }

        Ok(())
    }
}

// Transaction history projection
pub struct TransactionHistoryProjection {
    client: Client,
}

#[async_trait]
impl Projection for TransactionHistoryProjection {
    type Event = BankAccountEvent;

    async fn apply(&self, event: &Event<Self::Event>) -> Result<(), Box<dyn std::error::Error>> {
        let list_key = format!("read:transactions:{}", event.aggregate_id);

        let transaction = match &event.data {
            BankAccountEvent::Deposited { amount, new_balance } => {
                Some(json!({
                    "type": "deposit",
                    "amount": amount,
                    "balance_after": new_balance,
                    "timestamp": event.timestamp
                }))
            }
            BankAccountEvent::Withdrawn { amount, new_balance } => {
                Some(json!({
                    "type": "withdrawal",
                    "amount": amount,
                    "balance_after": new_balance,
                    "timestamp": event.timestamp
                }))
            }
            _ => None
        };

        if let Some(tx) = transaction {
            self.client.lpush(&list_key, &[&serde_json::to_string(&tx)?]).await?;
            self.client.ltrim(&list_key, 0, 999).await?; // Keep last 1000
        }

        Ok(())
    }
}
```

## Step 8: Main Application

```rust
// src/main.rs
use uuid::Uuid;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let event_store = EventStore::new("localhost:6379").await?;
    let handler = CommandHandler::new(event_store);

    let account_id = Uuid::new_v4().to_string();
    let metadata = EventMetadata {
        user_id: Some("user-123".to_string()),
        correlation_id: Some(Uuid::new_v4().to_string()),
        ..Default::default()
    };

    // Open account
    handler.handle::<BankAccount>(
        &account_id,
        BankAccountCommand::Open { initial_balance: 1000 },
        metadata.clone(),
    ).await?;

    // Deposit
    handler.handle::<BankAccount>(
        &account_id,
        BankAccountCommand::Deposit { amount: 500 },
        metadata.clone(),
    ).await?;

    // Withdraw
    handler.handle::<BankAccount>(
        &account_id,
        BankAccountCommand::Withdraw { amount: 200 },
        metadata.clone(),
    ).await?;

    // Load and check state
    let account = event_store.load::<BankAccount>(&account_id).await?.unwrap();
    println!("Account balance: {}", account.balance); // 1300
    println!("Account version: {}", account.version()); // 3

    Ok(())
}
```

## CDC Integration

Set up CDC to stream events to external systems:

```bash
# Create Kafka sink for all events
CDC.SINK.CREATE bank_events TYPE kafka
  PATTERN "events:BankAccount:*"
  CONFIG
    bootstrap_servers "kafka:9092"
    topic "bank-account-events"
```

## Related Resources

- [Streams Commands](/docs/reference/commands/streams) - Redis Streams
- [CDC Commands](/docs/reference/commands/cdc) - Change Data Capture
- [Transactions Commands](/docs/reference/commands/transactions) - Atomic operations
