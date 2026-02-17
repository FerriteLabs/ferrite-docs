---
maturity: beta
---

# Message Queues

Ferrite provides robust message queue capabilities through Lists and Streams, enabling reliable async communication between services without requiring additional infrastructure.

## Why Ferrite for Message Queues?

| Feature | Benefit |
|---------|---------|
| **Streams** | Persistent, ordered message logs |
| **Consumer groups** | Distributed processing with acknowledgment |
| **Lists** | Simple FIFO/LIFO queues |
| **Blocking operations** | Efficient polling without busy-wait |
| **Persistence** | Messages survive restarts |
| **Built-in TTL** | Automatic message expiration |

## Queue Patterns

### 1. Simple Work Queue (Lists)

```rust
use ferrite::FerriteClient;

pub struct WorkQueue {
    client: FerriteClient,
    name: String,
}

impl WorkQueue {
    pub fn new(client: FerriteClient, name: &str) -> Self {
        Self {
            client,
            name: name.to_string(),
        }
    }

    /// Add job to queue (producer)
    pub async fn enqueue<T: Serialize>(&self, job: &T) -> Result<()> {
        let json = serde_json::to_string(job)?;
        self.client.rpush(&self.name, &json).await?;
        Ok(())
    }

    /// Get job from queue (consumer) - blocking
    pub async fn dequeue<T: DeserializeOwned>(&self, timeout: u64) -> Result<Option<T>> {
        let result = self.client.blpop(&[&self.name], timeout).await?;

        match result {
            Some((_, json)) => Ok(Some(serde_json::from_str(&json)?)),
            None => Ok(None),
        }
    }

    /// Get queue length
    pub async fn len(&self) -> Result<u64> {
        self.client.llen(&self.name).await
    }

    /// Clear queue
    pub async fn clear(&self) -> Result<()> {
        self.client.del(&self.name).await?;
        Ok(())
    }
}

// Usage
#[derive(Serialize, Deserialize)]
struct EmailJob {
    to: String,
    subject: String,
    body: String,
}

async fn producer_example(queue: &WorkQueue) -> Result<()> {
    let job = EmailJob {
        to: "user@example.com".to_string(),
        subject: "Welcome!".to_string(),
        body: "Thanks for signing up.".to_string(),
    };

    queue.enqueue(&job).await?;
    Ok(())
}

async fn consumer_example(queue: &WorkQueue) -> Result<()> {
    loop {
        if let Some(job) = queue.dequeue::<EmailJob>(30).await? {
            // Process email job
            send_email(&job).await?;
        }
    }
}
```

### 2. Reliable Queue with Acknowledgment

```rust
pub struct ReliableQueue {
    client: FerriteClient,
    queue_name: String,
    processing_name: String,
    timeout: u64,
}

impl ReliableQueue {
    pub fn new(client: FerriteClient, name: &str, timeout_secs: u64) -> Self {
        Self {
            client,
            queue_name: format!("queue:{}", name),
            processing_name: format!("queue:{}:processing", name),
            timeout: timeout_secs,
        }
    }

    /// Add job to queue
    pub async fn enqueue<T: Serialize>(&self, job: &T) -> Result<String> {
        let job_id = uuid::Uuid::new_v4().to_string();
        let wrapper = JobWrapper {
            id: job_id.clone(),
            payload: serde_json::to_value(job)?,
            enqueued_at: chrono::Utc::now().timestamp_millis(),
        };

        let json = serde_json::to_string(&wrapper)?;
        self.client.rpush(&self.queue_name, &json).await?;

        Ok(job_id)
    }

    /// Get job from queue (moves to processing list)
    pub async fn dequeue(&self) -> Result<Option<JobWrapper>> {
        // Atomically move from queue to processing
        let result = self.client.brpoplpush(
            &self.queue_name,
            &self.processing_name,
            self.timeout,
        ).await?;

        match result {
            Some(json) => {
                let job: JobWrapper = serde_json::from_str(&json)?;
                Ok(Some(job))
            }
            None => Ok(None),
        }
    }

    /// Acknowledge job completion (remove from processing)
    pub async fn ack(&self, job_id: &str) -> Result<bool> {
        // Find and remove the job from processing list
        let jobs: Vec<String> = self.client.lrange(&self.processing_name, 0, -1).await?;

        for job_json in jobs {
            let job: JobWrapper = serde_json::from_str(&job_json)?;
            if job.id == job_id {
                self.client.lrem(&self.processing_name, 1, &job_json).await?;
                return Ok(true);
            }
        }

        Ok(false)
    }

    /// Reject job (move back to queue for retry)
    pub async fn nack(&self, job_id: &str) -> Result<bool> {
        let jobs: Vec<String> = self.client.lrange(&self.processing_name, 0, -1).await?;

        for job_json in jobs {
            let job: JobWrapper = serde_json::from_str(&job_json)?;
            if job.id == job_id {
                // Remove from processing and add back to queue
                self.client.lrem(&self.processing_name, 1, &job_json).await?;
                self.client.lpush(&self.queue_name, &job_json).await?;
                return Ok(true);
            }
        }

        Ok(false)
    }

    /// Recover stale jobs (jobs that timed out in processing)
    pub async fn recover_stale(&self, max_age_ms: i64) -> Result<u64> {
        let now = chrono::Utc::now().timestamp_millis();
        let jobs: Vec<String> = self.client.lrange(&self.processing_name, 0, -1).await?;
        let mut recovered = 0;

        for job_json in jobs {
            let job: JobWrapper = serde_json::from_str(&job_json)?;
            if now - job.enqueued_at > max_age_ms {
                self.client.lrem(&self.processing_name, 1, &job_json).await?;
                self.client.lpush(&self.queue_name, &job_json).await?;
                recovered += 1;
            }
        }

        Ok(recovered)
    }
}

#[derive(Serialize, Deserialize)]
struct JobWrapper {
    id: String,
    payload: serde_json::Value,
    enqueued_at: i64,
}
```

### 3. Stream-Based Message Queue

```rust
pub struct StreamQueue {
    client: FerriteClient,
    stream: String,
    group: String,
}

impl StreamQueue {
    pub async fn new(
        client: FerriteClient,
        stream: &str,
        group: &str,
    ) -> Result<Self> {
        let queue = Self {
            client,
            stream: stream.to_string(),
            group: group.to_string(),
        };

        // Create consumer group if not exists
        let _ = queue.client.xgroup_create(&queue.stream, &queue.group, "0").await;

        Ok(queue)
    }

    /// Publish message to stream
    pub async fn publish<T: Serialize>(&self, message: &T) -> Result<String> {
        let json = serde_json::to_string(message)?;
        let id = self.client.xadd(
            &self.stream,
            "*",
            &[("data", &json)],
        ).await?;

        Ok(id)
    }

    /// Consume messages from stream
    pub async fn consume(
        &self,
        consumer: &str,
        count: usize,
        block_ms: u64,
    ) -> Result<Vec<StreamMessage>> {
        let entries = self.client.xreadgroup(
            &self.group,
            consumer,
            &[(&self.stream, ">")],
            Some(count),
            Some(block_ms),
        ).await?;

        let mut messages = Vec::new();
        for entry in entries {
            if let Some(data) = entry.fields.get("data") {
                messages.push(StreamMessage {
                    id: entry.id,
                    data: data.clone(),
                });
            }
        }

        Ok(messages)
    }

    /// Acknowledge message processing
    pub async fn ack(&self, message_id: &str) -> Result<()> {
        self.client.xack(&self.stream, &self.group, &[message_id]).await?;
        Ok(())
    }

    /// Claim pending messages from dead consumers
    pub async fn claim_pending(
        &self,
        consumer: &str,
        min_idle_ms: u64,
        count: usize,
    ) -> Result<Vec<StreamMessage>> {
        // Get pending messages
        let pending = self.client.xpending_range(
            &self.stream,
            &self.group,
            "-",
            "+",
            count,
        ).await?;

        let mut claimed = Vec::new();
        for entry in pending {
            if entry.idle_time_ms >= min_idle_ms {
                // Claim the message
                let messages = self.client.xclaim(
                    &self.stream,
                    &self.group,
                    consumer,
                    min_idle_ms,
                    &[&entry.id],
                ).await?;

                for msg in messages {
                    if let Some(data) = msg.fields.get("data") {
                        claimed.push(StreamMessage {
                            id: msg.id,
                            data: data.clone(),
                        });
                    }
                }
            }
        }

        Ok(claimed)
    }

    /// Get consumer group info
    pub async fn info(&self) -> Result<GroupInfo> {
        let info = self.client.xinfo_groups(&self.stream).await?;

        for group in info {
            if group.name == self.group {
                return Ok(GroupInfo {
                    name: group.name,
                    consumers: group.consumers,
                    pending: group.pending,
                    last_delivered_id: group.last_delivered_id,
                });
            }
        }

        Err(anyhow::anyhow!("Group not found"))
    }
}

pub struct StreamMessage {
    pub id: String,
    pub data: String,
}

pub struct GroupInfo {
    pub name: String,
    pub consumers: u64,
    pub pending: u64,
    pub last_delivered_id: String,
}
```

### 4. Priority Queue

```rust
pub struct PriorityQueue {
    client: FerriteClient,
    name: String,
}

impl PriorityQueue {
    /// Add job with priority (higher score = higher priority)
    pub async fn enqueue<T: Serialize>(
        &self,
        job: &T,
        priority: f64,
    ) -> Result<String> {
        let job_id = uuid::Uuid::new_v4().to_string();
        let wrapper = serde_json::json!({
            "id": job_id,
            "payload": job,
            "enqueued_at": chrono::Utc::now().timestamp_millis(),
        });

        let json = serde_json::to_string(&wrapper)?;
        self.client.zadd(&self.name, priority, &json).await?;

        Ok(job_id)
    }

    /// Get highest priority job
    pub async fn dequeue<T: DeserializeOwned>(&self) -> Result<Option<(T, f64)>> {
        // Get and remove highest priority item atomically
        let script = r#"
            local result = redis.call('ZREVRANGE', KEYS[1], 0, 0, 'WITHSCORES')
            if #result == 0 then
                return nil
            end
            redis.call('ZREM', KEYS[1], result[1])
            return result
        "#;

        let result: Option<Vec<String>> = self.client.eval(
            script,
            &[&self.name],
            &[],
        ).await?;

        match result {
            Some(r) if r.len() >= 2 => {
                let wrapper: serde_json::Value = serde_json::from_str(&r[0])?;
                let job: T = serde_json::from_value(wrapper["payload"].clone())?;
                let priority: f64 = r[1].parse()?;
                Ok(Some((job, priority)))
            }
            _ => Ok(None),
        }
    }

    /// Get jobs by priority range
    pub async fn get_by_priority<T: DeserializeOwned>(
        &self,
        min: f64,
        max: f64,
    ) -> Result<Vec<(T, f64)>> {
        let results = self.client.zrangebyscore_with_scores(
            &self.name,
            min,
            max,
        ).await?;

        let mut jobs = Vec::new();
        for (json, score) in results {
            let wrapper: serde_json::Value = serde_json::from_str(&json)?;
            let job: T = serde_json::from_value(wrapper["payload"].clone())?;
            jobs.push((job, score));
        }

        Ok(jobs)
    }
}

// Usage
#[derive(Serialize, Deserialize)]
struct TaskJob {
    task_type: String,
    data: serde_json::Value,
}

async fn priority_example(queue: &PriorityQueue) -> Result<()> {
    // High priority task
    queue.enqueue(&TaskJob {
        task_type: "critical_alert".to_string(),
        data: serde_json::json!({"message": "Server down!"}),
    }, 100.0).await?;

    // Normal priority task
    queue.enqueue(&TaskJob {
        task_type: "send_email".to_string(),
        data: serde_json::json!({"to": "user@example.com"}),
    }, 50.0).await?;

    // Low priority task
    queue.enqueue(&TaskJob {
        task_type: "cleanup".to_string(),
        data: serde_json::json!({}),
    }, 10.0).await?;

    Ok(())
}
```

### 5. Delayed/Scheduled Queue

```rust
pub struct DelayedQueue {
    client: FerriteClient,
    scheduled_name: String,
    ready_name: String,
}

impl DelayedQueue {
    pub fn new(client: FerriteClient, name: &str) -> Self {
        Self {
            client,
            scheduled_name: format!("queue:{}:scheduled", name),
            ready_name: format!("queue:{}:ready", name),
        }
    }

    /// Schedule job for future execution
    pub async fn schedule<T: Serialize>(
        &self,
        job: &T,
        execute_at: DateTime<Utc>,
    ) -> Result<String> {
        let job_id = uuid::Uuid::new_v4().to_string();
        let wrapper = serde_json::json!({
            "id": job_id,
            "payload": job,
            "scheduled_at": execute_at.timestamp_millis(),
        });

        let json = serde_json::to_string(&wrapper)?;
        let score = execute_at.timestamp_millis() as f64;

        self.client.zadd(&self.scheduled_name, score, &json).await?;

        Ok(job_id)
    }

    /// Schedule job with delay from now
    pub async fn delay<T: Serialize>(
        &self,
        job: &T,
        delay: Duration,
    ) -> Result<String> {
        let execute_at = Utc::now() + chrono::Duration::from_std(delay)?;
        self.schedule(job, execute_at).await
    }

    /// Move due jobs to ready queue (call periodically)
    pub async fn process_scheduled(&self) -> Result<u64> {
        let now = Utc::now().timestamp_millis() as f64;

        // Get jobs that are due
        let script = r#"
            local jobs = redis.call('ZRANGEBYSCORE', KEYS[1], '-inf', ARGV[1])
            local count = 0
            for _, job in ipairs(jobs) do
                redis.call('ZREM', KEYS[1], job)
                redis.call('RPUSH', KEYS[2], job)
                count = count + 1
            end
            return count
        "#;

        let count: u64 = self.client.eval(
            script,
            &[&self.scheduled_name, &self.ready_name],
            &[&now.to_string()],
        ).await?;

        Ok(count)
    }

    /// Get ready job (blocking)
    pub async fn dequeue<T: DeserializeOwned>(&self, timeout: u64) -> Result<Option<T>> {
        let result = self.client.blpop(&[&self.ready_name], timeout).await?;

        match result {
            Some((_, json)) => {
                let wrapper: serde_json::Value = serde_json::from_str(&json)?;
                let job: T = serde_json::from_value(wrapper["payload"].clone())?;
                Ok(Some(job))
            }
            None => Ok(None),
        }
    }

    /// Cancel scheduled job
    pub async fn cancel(&self, job_id: &str) -> Result<bool> {
        let jobs: Vec<(String, f64)> = self.client
            .zrangebyscore_with_scores(&self.scheduled_name, f64::NEG_INFINITY, f64::INFINITY)
            .await?;

        for (json, _) in jobs {
            let wrapper: serde_json::Value = serde_json::from_str(&json)?;
            if wrapper["id"].as_str() == Some(job_id) {
                self.client.zrem(&self.scheduled_name, &json).await?;
                return Ok(true);
            }
        }

        Ok(false)
    }
}

// Background processor
async fn scheduler_loop(queue: DelayedQueue) {
    let mut interval = tokio::time::interval(Duration::from_secs(1));

    loop {
        interval.tick().await;
        let moved = queue.process_scheduled().await.unwrap_or(0);
        if moved > 0 {
            tracing::debug!("Moved {} scheduled jobs to ready queue", moved);
        }
    }
}
```

### 6. Dead Letter Queue

```rust
pub struct QueueWithDLQ {
    client: FerriteClient,
    main_queue: String,
    dlq: String,
    max_retries: u32,
}

impl QueueWithDLQ {
    /// Process job with automatic DLQ on failure
    pub async fn process<T, F, Fut>(
        &self,
        handler: F,
    ) -> Result<()>
    where
        T: DeserializeOwned + Serialize,
        F: Fn(T) -> Fut,
        Fut: Future<Output = Result<()>>,
    {
        let result = self.client.blpop(&[&self.main_queue], 30).await?;

        if let Some((_, json)) = result {
            let wrapper: RetryWrapper<T> = serde_json::from_str(&json)?;

            match handler(wrapper.payload.clone()).await {
                Ok(()) => {
                    // Success - job completed
                    tracing::info!("Job {} completed successfully", wrapper.id);
                }
                Err(e) => {
                    // Failure - check retry count
                    if wrapper.retry_count < self.max_retries {
                        // Retry
                        let retry = RetryWrapper {
                            id: wrapper.id,
                            payload: wrapper.payload,
                            retry_count: wrapper.retry_count + 1,
                            last_error: Some(e.to_string()),
                            first_attempt: wrapper.first_attempt,
                        };

                        let json = serde_json::to_string(&retry)?;
                        self.client.rpush(&self.main_queue, &json).await?;

                        tracing::warn!(
                            "Job {} failed, retry {}/{}",
                            retry.id, retry.retry_count, self.max_retries
                        );
                    } else {
                        // Move to DLQ
                        let dead = DeadLetter {
                            job: wrapper,
                            dead_at: Utc::now().timestamp_millis(),
                            reason: e.to_string(),
                        };

                        let json = serde_json::to_string(&dead)?;
                        self.client.rpush(&self.dlq, &json).await?;

                        tracing::error!(
                            "Job {} moved to DLQ after {} retries",
                            dead.job.id, self.max_retries
                        );
                    }
                }
            }
        }

        Ok(())
    }

    /// Get DLQ contents
    pub async fn get_dead_letters<T: DeserializeOwned>(&self) -> Result<Vec<DeadLetter<T>>> {
        let items: Vec<String> = self.client.lrange(&self.dlq, 0, -1).await?;

        let mut dead_letters = Vec::new();
        for json in items {
            dead_letters.push(serde_json::from_str(&json)?);
        }

        Ok(dead_letters)
    }

    /// Retry dead letter
    pub async fn retry_dead_letter(&self, index: i64) -> Result<bool> {
        let json: Option<String> = self.client.lindex(&self.dlq, index).await?;

        if let Some(json) = json {
            let dead: DeadLetter<serde_json::Value> = serde_json::from_str(&json)?;

            // Reset retry count and re-queue
            let retry = RetryWrapper {
                id: dead.job.id,
                payload: dead.job.payload,
                retry_count: 0,
                last_error: None,
                first_attempt: Utc::now().timestamp_millis(),
            };

            let new_json = serde_json::to_string(&retry)?;
            self.client.rpush(&self.main_queue, &new_json).await?;

            // Remove from DLQ
            self.client.lrem(&self.dlq, 1, &json).await?;

            return Ok(true);
        }

        Ok(false)
    }
}

#[derive(Serialize, Deserialize, Clone)]
struct RetryWrapper<T> {
    id: String,
    payload: T,
    retry_count: u32,
    last_error: Option<String>,
    first_attempt: i64,
}

#[derive(Serialize, Deserialize)]
struct DeadLetter<T> {
    job: RetryWrapper<T>,
    dead_at: i64,
    reason: String,
}
```

## Pub/Sub for Event Broadcasting

```rust
pub struct EventBus {
    client: FerriteClient,
}

impl EventBus {
    /// Publish event to channel
    pub async fn publish<T: Serialize>(&self, channel: &str, event: &T) -> Result<u64> {
        let json = serde_json::to_string(event)?;
        self.client.publish(channel, &json).await
    }

    /// Subscribe to channel pattern
    pub async fn subscribe<F, Fut>(
        &self,
        pattern: &str,
        handler: F,
    ) -> Result<()>
    where
        F: Fn(String, String) -> Fut + Send + 'static,
        Fut: Future<Output = ()> + Send,
    {
        let mut subscriber = self.client.psubscribe(pattern).await?;

        tokio::spawn(async move {
            while let Some((channel, message)) = subscriber.next().await {
                handler(channel, message).await;
            }
        });

        Ok(())
    }
}

// Usage
async fn event_bus_example(bus: &EventBus) -> Result<()> {
    // Subscribe to order events
    bus.subscribe("orders.*", |channel, message| async move {
        println!("Received on {}: {}", channel, message);
    }).await?;

    // Publish order created event
    bus.publish("orders.created", &serde_json::json!({
        "order_id": "12345",
        "user_id": "user_1",
        "total": 99.99,
    })).await?;

    Ok(())
}
```

## Best Practices

### 1. Choose the Right Pattern

| Use Case | Pattern |
|----------|---------|
| Simple task processing | List-based queue |
| Need acknowledgment | Reliable queue or Streams |
| Multiple consumers | Stream consumer groups |
| Priority processing | Sorted set queue |
| Scheduled tasks | Delayed queue |
| Broadcast events | Pub/Sub |

### 2. Handle Failures Gracefully

```rust
async fn robust_consumer<T, F>(queue: &StreamQueue, handler: F) -> Result<()>
where
    T: DeserializeOwned,
    F: Fn(T) -> Result<()>,
{
    loop {
        // Process new messages
        let messages = queue.consume("worker-1", 10, 5000).await?;

        for msg in messages {
            match serde_json::from_str::<T>(&msg.data) {
                Ok(data) => {
                    if let Err(e) = handler(data) {
                        tracing::error!("Handler error: {}", e);
                        // Don't ack - message will be retried
                        continue;
                    }
                }
                Err(e) => {
                    tracing::error!("Parse error: {}", e);
                    // Ack to prevent poison message
                }
            }

            queue.ack(&msg.id).await?;
        }

        // Claim stale messages periodically
        let claimed = queue.claim_pending("worker-1", 60000, 5).await?;
        for msg in claimed {
            // Process claimed messages...
        }
    }
}
```

### 3. Monitor Queue Health

```rust
async fn monitor_queues(client: &FerriteClient) -> Result<QueueMetrics> {
    let main_len: u64 = client.llen("queue:main").await?;
    let dlq_len: u64 = client.llen("queue:main:dlq").await?;
    let stream_info = client.xinfo_stream("events:main").await?;

    Ok(QueueMetrics {
        main_queue_length: main_len,
        dlq_length: dlq_len,
        stream_length: stream_info.length,
        consumer_lag: stream_info.last_generated_id,
    })
}
```

## Related Resources

- [Streams Guide](/docs/event-driven/streams)
- [Pub/Sub Guide](/docs/guides/pub-sub)
- [Build Event Sourcing Tutorial](/docs/tutorials/build-event-sourcing)
- [Real-Time Analytics Use Case](/docs/use-cases/real-time-analytics)
