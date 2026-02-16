---
sidebar_position: 5
title: Java SDK
description: Official Ferrite Java SDK with type-safe access, reactive streams support, connection pooling, and Spring Boot integration.
keywords: [java sdk, spring boot, reactive, jedis alternative, lettuce alternative]
maturity: beta
---

# Java SDK

The official Ferrite Java SDK provides type-safe access to all Ferrite features with reactive streams support, connection pooling, and Spring Boot integration.

## Installation

### Maven

```xml
<dependency>
    <groupId>io.ferrite</groupId>
    <artifactId>ferrite-client</artifactId>
    <version>1.0.0</version>
</dependency>
```

### Gradle

```kotlin
implementation("io.ferrite:ferrite-client:1.0.0")
```

## Quick Start

```java
import io.ferrite.FerriteClient;
import io.ferrite.FerriteConfig;

public class QuickStart {
    public static void main(String[] args) {
        // Connect to Ferrite
        FerriteConfig config = FerriteConfig.builder()
            .host("localhost")
            .port(6380)
            .build();

        try (FerriteClient client = FerriteClient.create(config)) {
            // Basic operations
            client.sync().set("key", "value");
            String value = client.sync().get("key");
            System.out.println("Value: " + value);
        }
    }
}
```

## Connection Configuration

### Single Connection

```java
import io.ferrite.FerriteClient;
import io.ferrite.FerriteConfig;
import io.ferrite.ssl.SslOptions;

import java.time.Duration;

FerriteConfig config = FerriteConfig.builder()
    .host("localhost")
    .port(6380)
    .password("secret")
    .username("default")
    .database(0)
    .connectTimeout(Duration.ofSeconds(5))
    .readTimeout(Duration.ofSeconds(30))
    .writeTimeout(Duration.ofSeconds(30))
    .ssl(SslOptions.builder()
        .trustStorePath("/path/to/truststore.jks")
        .trustStorePassword("password")
        .keyStorePath("/path/to/keystore.jks")
        .keyStorePassword("password")
        .build())
    .build();

FerriteClient client = FerriteClient.create(config);
```

### Connection Pool

```java
import io.ferrite.FerriteClient;
import io.ferrite.pool.PoolConfig;

PoolConfig poolConfig = PoolConfig.builder()
    .minConnections(5)
    .maxConnections(20)
    .maxIdleTime(Duration.ofMinutes(5))
    .connectionTimeout(Duration.ofSeconds(5))
    .validationInterval(Duration.ofSeconds(30))
    .build();

FerriteConfig config = FerriteConfig.builder()
    .host("localhost")
    .port(6380)
    .pool(poolConfig)
    .build();

FerriteClient client = FerriteClient.create(config);

// Get pool statistics
PoolStats stats = client.getPoolStats();
System.out.println("Active: " + stats.getActiveConnections());
System.out.println("Idle: " + stats.getIdleConnections());
```

### Cluster Connection

```java
import io.ferrite.cluster.ClusterClient;
import io.ferrite.cluster.ClusterConfig;

ClusterConfig clusterConfig = ClusterConfig.builder()
    .addNode("node1", 6380)
    .addNode("node2", 6380)
    .addNode("node3", 6380)
    .readPreference(ReadPreference.REPLICA)
    .build();

ClusterClient cluster = ClusterClient.create(clusterConfig);

// Automatic routing to correct node
cluster.sync().set("key", "value");
```

## Sync vs Async API

### Synchronous API

```java
// Blocking operations
SyncCommands sync = client.sync();

sync.set("key", "value");
String value = sync.get("key");
```

### Asynchronous API

```java
import java.util.concurrent.CompletableFuture;

// Non-blocking operations
AsyncCommands async = client.async();

CompletableFuture<String> future = async.set("key", "value")
    .thenCompose(ok -> async.get("key"));

future.thenAccept(value -> System.out.println("Value: " + value));

// Or block when needed
String value = future.get();
```

### Reactive API

```java
import reactor.core.publisher.Mono;
import reactor.core.publisher.Flux;

// Reactive streams
ReactiveCommands reactive = client.reactive();

Mono<String> mono = reactive.set("key", "value")
    .then(reactive.get("key"));

mono.subscribe(value -> System.out.println("Value: " + value));

// Flux for multiple values
Flux<String> values = reactive.mget("k1", "k2", "k3");
values.subscribe(System.out::println);
```

## Data Types

### Strings

```java
SyncCommands cmd = client.sync();

// Basic operations
cmd.set("name", "Ferrite");
cmd.setex("session", 3600, "token123"); // With TTL
boolean wasSet = cmd.setnx("unique", "first"); // Set if not exists

String name = cmd.get("name");
long length = cmd.strlen("name");

// Numeric operations
cmd.set("counter", "0");
cmd.incr("counter");
cmd.incrby("counter", 10);
double newVal = cmd.incrbyfloat("counter", 0.5);

// Batch operations
cmd.mset(Map.of("k1", "v1", "k2", "v2", "k3", "v3"));
List<String> values = cmd.mget("k1", "k2", "k3");
```

### Lists

```java
// Push operations
cmd.lpush("queue", "a", "b", "c");
cmd.rpush("queue", "d", "e", "f");

// Pop operations
String item = cmd.lpop("queue");
List<String> items = cmd.lpop("queue", 3);

// Blocking pop (for queues)
KeyValue<String, String> result = cmd.blpop(5, "queue1", "queue2");
if (result != null) {
    System.out.println("Got " + result.getValue() + " from " + result.getKey());
}

// Range operations
List<String> range = cmd.lrange("queue", 0, -1);
cmd.ltrim("queue", 0, 99); // Keep first 100
```

### Hashes

```java
// Single field operations
cmd.hset("user:1", "name", "Alice");
String name = cmd.hget("user:1", "name");

// Multiple fields
cmd.hset("user:1", Map.of(
    "name", "Alice",
    "email", "alice@example.com",
    "age", "30"
));

// Get all fields
Map<String, String> user = cmd.hgetall("user:1");

// Object mapping with annotations
@RedisHash
public class User {
    @RedisField("name")
    private String name;

    @RedisField("email")
    private String email;

    @RedisField("age")
    private int age;

    // Getters and setters
}

User user = cmd.hgetallAs("user:1", User.class);
System.out.println("Name: " + user.getName());
```

### Sets

```java
// Add members
cmd.sadd("tags", "java", "database", "redis");

// Check membership
boolean isMember = cmd.sismember("tags", "java");

// Set operations
Set<String> common = cmd.sinter("tags1", "tags2");
Set<String> all = cmd.sunion("tags1", "tags2");
Set<String> diff = cmd.sdiff("tags1", "tags2");

// Random members
String random = cmd.srandmember("tags");
List<String> randoms = cmd.srandmember("tags", 3);
```

### Sorted Sets

```java
// Add with scores
cmd.zadd("leaderboard",
    Score.of(100, "alice"),
    Score.of(95, "bob"),
    Score.of(110, "carol")
);

// Get rankings
Long rank = cmd.zrank("leaderboard", "alice");
Double score = cmd.zscore("leaderboard", "alice");

// Range queries
List<ScoredValue<String>> top10 = cmd.zrevrangeWithScores("leaderboard", 0, 9);
for (ScoredValue<String> sv : top10) {
    System.out.println(sv.getValue() + ": " + sv.getScore());
}

// Score range
List<String> highScorers = cmd.zrangebyscore("leaderboard",
    Range.create(100, Double.POSITIVE_INFINITY));
```

### Streams

```java
import io.ferrite.stream.*;

// Add entries
String id = cmd.xadd("events", Map.of(
    "type", "click",
    "page", "/home"
));

// Read entries
List<StreamMessage> entries = cmd.xrange("events", "-", "+", 100);

// Consumer groups
cmd.xgroupCreate("events", "processors", "$", true);

XReadGroupArgs args = XReadGroupArgs.builder()
    .count(10)
    .block(Duration.ofSeconds(5))
    .build();

List<StreamMessage> messages = cmd.xreadgroup(
    "processors", "worker-1",
    args,
    StreamOffset.latest("events")
);

// Acknowledge processing
for (StreamMessage msg : messages) {
    // Process message
    cmd.xack("events", "processors", msg.getId());
}
```

## Extended Features

### Vector Search

```java
import io.ferrite.vector.*;

// Create index
cmd.executeCommand("VECTOR.INDEX.CREATE",
    "embeddings", "DIM", "384", "DISTANCE", "COSINE", "TYPE", "HNSW");

// Add vectors
float[] embedding = model.encode("Hello world");
VectorCommands vectors = client.vectors();
vectors.add("embeddings", "doc:1", embedding, Map.of(
    "text", "Hello world",
    "category", "greeting"
));

// Search
float[] queryEmbedding = model.encode("Hi there");
SearchOptions options = SearchOptions.builder()
    .topK(10)
    .filter("category == 'greeting'")
    .build();

List<SearchResult> results = vectors.search("embeddings", queryEmbedding, options);
for (SearchResult r : results) {
    System.out.println("ID: " + r.getId() + ", Score: " + r.getScore());
}
```

### Document Store

```java
import io.ferrite.document.*;

// Insert document
JsonObject doc = JsonObject.of(
    "title", "Getting Started",
    "author", "Alice",
    "tags", JsonArray.of("tutorial", "beginner"),
    "views", 100
);

DocumentCommands docs = client.documents();
docs.insert("articles", "article:1", doc);

// Query documents
Query query = Query.builder()
    .filter(Filter.eq("author", "Alice"))
    .sort("views", SortOrder.DESC)
    .limit(10)
    .build();

List<JsonObject> articles = docs.find("articles", query);

// Aggregation pipeline
Pipeline pipeline = Pipeline.builder()
    .match(Filter.eq("author", "Alice"))
    .group("$category", Aggregation.count("count"))
    .sort("count", SortOrder.DESC)
    .build();

List<JsonObject> results = docs.aggregate("articles", pipeline);
```

### Graph Database

```java
import io.ferrite.graph.*;

// Create vertices
GraphCommands graph = client.graph();

graph.addVertex("social", "user:alice", "User", Map.of(
    "name", "Alice",
    "age", "30"
));

graph.addVertex("social", "user:bob", "User", Map.of(
    "name", "Bob",
    "age", "28"
));

// Create edge
graph.addEdge("social", "user:alice", "user:bob", "FOLLOWS",
    Map.of("since", "2024-01-01"));

// Traverse graph
TraversalOptions options = TraversalOptions.builder()
    .direction(Direction.OUT)
    .edgeType("FOLLOWS")
    .maxDepth(2)
    .build();

List<Vertex> friends = graph.traverse("social", "user:alice", options);

// Query with Cypher-like syntax
List<Map<String, Object>> results = graph.query("social",
    "MATCH (a:User)-[:FOLLOWS]->(b:User) WHERE a.name = 'Alice' RETURN b");
```

### Time Series

```java
import io.ferrite.timeseries.*;
import java.time.Instant;

// Add samples
TimeSeriesCommands ts = client.timeSeries();
ts.add("temperature:room1", Instant.now(), 23.5);
ts.add("temperature:room1", Instant.now(), 24.0, Map.of(
    "location", "office",
    "sensor", "temp-01"
));

// Query range
List<Sample> samples = ts.range("temperature:room1",
    Instant.now().minus(Duration.ofHours(24)),
    Instant.now()
);

// Aggregated query
RangeOptions options = RangeOptions.builder()
    .aggregation(Aggregation.AVG)
    .bucketSize(Duration.ofHours(1))
    .build();

List<Sample> hourlyAvg = ts.range("temperature:room1",
    Instant.now().minus(Duration.ofHours(24)),
    Instant.now(),
    options
);
```

### Semantic Search

```java
import io.ferrite.semantic.*;

// Configure embedding provider
SemanticCommands semantic = client.semantic();
semantic.configure(ProviderConfig.openai(
    System.getenv("OPENAI_API_KEY"),
    "text-embedding-3-small"
));

// Create semantic index
semantic.createIndex("knowledge", 1536);

// Add text (auto-embeds)
semantic.add("knowledge", "doc:1", "Ferrite is a Redis replacement");

// Semantic search
SearchOptions options = SearchOptions.builder()
    .topK(5)
    .build();

List<SearchResult> results = semantic.search("knowledge", "What is Ferrite?", options);
```

## Transactions

### Basic Pipeline

```java
// Pipeline (without transaction guarantee)
List<Object> results = client.sync().pipeline(pipe -> {
    pipe.set("key1", "value1");
    pipe.set("key2", "value2");
    pipe.get("key1");
    pipe.get("key2");
});
```

### MULTI/EXEC Transaction

```java
// Transaction with MULTI/EXEC
TransactionResult result = client.sync().multi(tx -> {
    String balance = tx.get("account:1:balance");
    if (Integer.parseInt(balance) >= 100) {
        tx.decrby("account:1:balance", 100);
        tx.incrby("account:2:balance", 100);
    }
});

if (result.wasExecuted()) {
    System.out.println("Transaction committed");
} else {
    System.out.println("Transaction aborted");
}
```

### Watch-based Transaction

```java
// Optimistic locking
boolean success = client.sync().watch(transaction -> {
    String balance = transaction.get("account:1:balance");

    if (Integer.parseInt(balance) < 100) {
        return TransactionAction.abort();
    }

    return TransactionAction.execute(tx -> {
        tx.decrby("account:1:balance", 100);
        tx.incrby("account:2:balance", 100);
    });
}, "account:1:balance");

if (!success) {
    // Key was modified, retry
}
```

## Pub/Sub

### Publishing

```java
client.sync().publish("events", "Hello, subscribers!");
```

### Subscribing

```java
import io.ferrite.pubsub.*;

PubSubConnection pubsub = client.pubsub();

// Subscribe to channels
pubsub.subscribe("events", "notifications");

// Pattern subscribe
pubsub.psubscribe("events:*");

// Add listener
pubsub.addListener(new PubSubListener() {
    @Override
    public void onMessage(String channel, String message) {
        System.out.println("Channel " + channel + ": " + message);
    }

    @Override
    public void onPatternMessage(String pattern, String channel, String message) {
        System.out.println("Pattern " + pattern + " matched " + channel);
    }
});

// Or use reactive streams
pubsub.reactive().subscribe("events")
    .doOnNext(msg -> System.out.println(msg.getMessage()))
    .subscribe();
```

## Lua Scripting

```java
// Load script
String script = """
    local current = redis.call('GET', KEYS[1])
    if current then
        return redis.call('SET', KEYS[1], ARGV[1])
    else
        return nil
    end
    """;

// Create reusable script
Script<String> updateIfExists = client.createScript(script, String.class);

// Execute
String result = updateIfExists.execute(
    List.of("mykey"),      // KEYS
    List.of("newvalue")    // ARGV
);
```

## Error Handling

```java
import io.ferrite.exception.*;

try {
    String value = client.sync().get("key");
} catch (ConnectionException e) {
    System.err.println("Connection failed: " + e.getMessage());
    // Retry logic
} catch (TimeoutException e) {
    System.err.println("Operation timed out: " + e.getMessage());
} catch (ResponseException e) {
    System.err.println("Server error: " + e.getMessage());
} catch (FerriteException e) {
    System.err.println("General error: " + e.getMessage());
}
```

## Spring Boot Integration

### Configuration

```yaml
# application.yml
ferrite:
  host: localhost
  port: 6380
  password: secret
  pool:
    min-connections: 5
    max-connections: 20
  ssl:
    enabled: true
    trust-store: classpath:truststore.jks
    trust-store-password: password
```

### Auto-Configuration

```java
import io.ferrite.spring.EnableFerrite;

@SpringBootApplication
@EnableFerrite
public class Application {
    public static void main(String[] args) {
        SpringApplication.run(Application.class, args);
    }
}
```

### Using the Client

```java
import org.springframework.stereotype.Service;
import io.ferrite.FerriteClient;

@Service
public class UserService {
    private final FerriteClient ferrite;

    public UserService(FerriteClient ferrite) {
        this.ferrite = ferrite;
    }

    public User getUser(String id) {
        return ferrite.sync().hgetallAs("user:" + id, User.class);
    }

    public void saveUser(String id, User user) {
        ferrite.sync().hset("user:" + id, user);
    }
}
```

### Caching with Spring Cache

```java
import org.springframework.cache.annotation.*;
import io.ferrite.spring.cache.EnableFerriteCaching;

@Configuration
@EnableFerriteCaching
public class CacheConfig {
    // Configuration is auto-detected
}

@Service
public class ProductService {
    @Cacheable(value = "products", key = "#id")
    public Product getProduct(String id) {
        // This will be cached
        return productRepository.findById(id);
    }

    @CacheEvict(value = "products", key = "#id")
    public void updateProduct(String id, Product product) {
        productRepository.save(product);
    }
}
```

### Reactive Spring WebFlux

```java
import org.springframework.web.bind.annotation.*;
import reactor.core.publisher.Mono;
import io.ferrite.FerriteClient;

@RestController
@RequestMapping("/users")
public class UserController {
    private final FerriteClient ferrite;

    public UserController(FerriteClient ferrite) {
        this.ferrite = ferrite;
    }

    @GetMapping("/{id}")
    public Mono<User> getUser(@PathVariable String id) {
        return ferrite.reactive()
            .hgetall("user:" + id)
            .map(this::mapToUser);
    }

    @PostMapping("/{id}")
    public Mono<Void> createUser(@PathVariable String id, @RequestBody User user) {
        return ferrite.reactive()
            .hset("user:" + id, userToMap(user))
            .then();
    }
}
```

## Configuration Reference

```java
import io.ferrite.FerriteConfig;
import io.ferrite.pool.PoolConfig;
import io.ferrite.ssl.SslOptions;

FerriteConfig config = FerriteConfig.builder()
    // Connection
    .host("localhost")
    .port(6380)
    .password(null)
    .username("default")
    .database(0)

    // Timeouts
    .connectTimeout(Duration.ofSeconds(5))
    .readTimeout(Duration.ofSeconds(30))
    .writeTimeout(Duration.ofSeconds(30))

    // Connection pool
    .pool(PoolConfig.builder()
        .minConnections(5)
        .maxConnections(20)
        .maxIdleTime(Duration.ofMinutes(5))
        .connectionTimeout(Duration.ofSeconds(5))
        .validationInterval(Duration.ofSeconds(30))
        .build())

    // SSL/TLS
    .ssl(SslOptions.builder()
        .enabled(true)
        .trustStorePath("/path/to/truststore.jks")
        .trustStorePassword("password")
        .keyStorePath("/path/to/keystore.jks")
        .keyStorePassword("password")
        .build())

    // Retry
    .retryAttempts(3)
    .retryDelay(Duration.ofMillis(100))
    .retryBackoffMultiplier(2.0)

    // Metrics
    .metricsEnabled(true)
    .metricsRegistry(meterRegistry)

    .build();

FerriteClient client = FerriteClient.create(config);
```

## Best Practices

### Connection Management

```java
// Use try-with-resources
try (FerriteClient client = FerriteClient.create(config)) {
    client.sync().set("key", "value");
}

// Or register shutdown hook
Runtime.getRuntime().addShutdownHook(new Thread(() -> {
    client.close();
}));
```

### Thread Safety

```java
// FerriteClient is thread-safe - use a single instance
public class FerriteHolder {
    private static final FerriteClient CLIENT = FerriteClient.create(
        FerriteConfig.builder()
            .host("localhost")
            .port(6380)
            .build()
    );

    public static FerriteClient getClient() {
        return CLIENT;
    }
}
```

### Efficient Scanning

```java
// Use scan for large key spaces
ScanIterator<String> iterator = client.sync().scan(
    ScanArgs.builder()
        .match("user:*")
        .count(100)
        .build()
);

while (iterator.hasNext()) {
    String key = iterator.next();
    // Process key
}
```

## Next Steps

- [Rust SDK](/docs/sdk/rust) - For Rust applications
- [Python SDK](/docs/sdk/python) - For Python applications
- [SDK Generator](/docs/sdk/generator) - Generate custom SDKs
