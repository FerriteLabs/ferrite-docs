---
maturity: experimental
---

# Swift SDK

The official Ferrite Swift SDK provides native Swift access to all Ferrite features with async/await support, iOS/macOS integration, and Vapor compatibility for server-side Swift.

## Installation

### Swift Package Manager

```swift
// Package.swift
dependencies: [
    .package(url: "https://github.com/ferrite-rs/ferrite-swift.git", from: "1.0.0")
]
```

```swift
// In your target
.target(
    name: "MyApp",
    dependencies: ["Ferrite"]
)
```

### CocoaPods

```ruby
# Podfile
pod 'Ferrite', '~> 1.0'
```

### Carthage

```
github "ferrite-rs/ferrite-swift" ~> 1.0
```

**Requirements:**
- Swift 5.9 or later
- iOS 15.0+ / macOS 12.0+ / tvOS 15.0+ / watchOS 8.0+

## Quick Start

```swift
import Ferrite

// Connect to Ferrite
let client = try await FerriteClient.connect(host: "localhost", port: 6380)

// Basic operations
try await client.set("key", value: "Hello, Ferrite!")
let value = try await client.get("key")
print("Value: \(value ?? "nil")")

// Close connection
try await client.close()
```

## Connection Configuration

### Single Connection

```swift
import Ferrite

let config = FerriteConfiguration(
    host: "localhost",
    port: 6380,
    password: "secret",
    database: 0,
    connectionTimeout: .seconds(5),
    readTimeout: .seconds(30),
    tls: .init(
        certificatePath: "/path/to/cert.pem",
        keyPath: "/path/to/key.pem",
        caPath: "/path/to/ca.pem"
    )
)

let client = try await FerriteClient.connect(configuration: config)
```

### Connection Pool

```swift
import Ferrite

let pool = try await FerritePool(
    host: "localhost",
    port: 6380,
    poolSize: 10,
    maxIdleTime: .seconds(300)
)

// Use connection from pool
try await pool.withConnection { client in
    try await client.set("key", value: "value")
}

// Or get a connection manually
let client = try await pool.acquire()
defer { pool.release(client) }
try await client.set("key", value: "value")
```

### Cluster Connection

```swift
import Ferrite

let cluster = try await FerriteCluster(
    nodes: [
        .init(host: "node1", port: 6380),
        .init(host: "node2", port: 6380),
        .init(host: "node3", port: 6380)
    ],
    readPreference: .replica
)

// Automatic routing to correct node
try await cluster.set("key", value: "value")
```

## Data Types

### Strings

```swift
// Basic operations
try await client.set("name", value: "Ferrite")
try await client.set("session", value: "token123", expiration: .seconds(3600))
let wasSet = try await client.setNX("unique", value: "first")

let name: String? = try await client.get("name")
let length = try await client.strlen("name")

// Numeric operations
try await client.set("counter", value: "0")
let newValue = try await client.incr("counter")
let incremented = try await client.incrBy("counter", amount: 10)
let floatValue = try await client.incrByFloat("counter", amount: 0.5)

// Batch operations
try await client.mset([
    "k1": "v1",
    "k2": "v2",
    "k3": "v3"
])
let values = try await client.mget(["k1", "k2", "k3"])
```

### Lists

```swift
// Push operations
let length = try await client.lpush("queue", values: ["a", "b", "c"])
try await client.rpush("queue", values: ["d", "e", "f"])

// Pop operations
let item: String? = try await client.lpop("queue")
let items: [String] = try await client.lpop("queue", count: 3)

// Blocking pop (for queues)
if let (queue, item) = try await client.blpop(["queue1", "queue2"], timeout: .seconds(5)) {
    print("Got \(item) from \(queue)")
}

// Range operations
let range = try await client.lrange("queue", start: 0, stop: -1)
try await client.ltrim("queue", start: 0, stop: 99)
```

### Hashes

```swift
// Single field operations
try await client.hset("user:1", field: "name", value: "Alice")
let name: String? = try await client.hget("user:1", field: "name")

// Multiple fields
try await client.hset("user:1", fields: [
    "name": "Alice",
    "email": "alice@example.com",
    "age": "30"
])

// Get all fields
let user: [String: String] = try await client.hgetall("user:1")

// Using Codable
struct User: Codable {
    let name: String
    let email: String
    let age: Int
}

let user = try await client.hgetallCodable("user:1", as: User.self)
```

### Sets

```swift
// Add members
try await client.sadd("tags", members: ["swift", "database", "redis"])

// Check membership
let isMember = try await client.sismember("tags", member: "swift")

// Set operations
let common = try await client.sinter(["tags1", "tags2"])
let all = try await client.sunion(["tags1", "tags2"])
let diff = try await client.sdiff(["tags1", "tags2"])

// Random members
let random: String? = try await client.srandmember("tags")
let randoms: [String] = try await client.srandmember("tags", count: 3)
```

### Sorted Sets

```swift
// Add with scores
try await client.zadd("leaderboard", members: [
    .init(score: 100, member: "alice"),
    .init(score: 95, member: "bob"),
    .init(score: 110, member: "carol")
])

// Get rankings
let rank = try await client.zrank("leaderboard", member: "alice")
let score = try await client.zscore("leaderboard", member: "alice")

// Range queries
let top10 = try await client.zrevrange("leaderboard", start: 0, stop: 9, withScores: true)

// Score range
let highScorers = try await client.zrangeByScore("leaderboard", min: 100, max: .infinity)
```

### Streams

```swift
// Add entries
let id = try await client.xadd("events", fields: [
    "type": "click",
    "page": "/home"
])

// Read entries
let entries = try await client.xrange("events", start: "-", end: "+", count: 100)

// Consumer groups
try await client.xgroupCreate("events", group: "processors", id: "$", mkstream: true)

let streams = try await client.xreadgroup(
    group: "processors",
    consumer: "worker-1",
    streams: ["events": ">"],
    count: 10,
    block: .milliseconds(5000)
)

// Acknowledge processing
for (stream, messages) in streams {
    for message in messages {
        // Process message
        try await client.xack("events", group: "processors", ids: [message.id])
    }
}
```

## Extended Features

### Vector Search

```swift
import Ferrite

// Create index
try await client.vectorIndexCreate(
    "embeddings",
    dimensions: 384,
    distance: .cosine,
    type: .hnsw
)

// Add vectors
let embedding = try await model.encode("Hello world")
try await client.vectorAdd(
    "embeddings",
    id: "doc:1",
    vector: embedding,
    metadata: [
        "text": "Hello world",
        "category": "greeting"
    ]
)

// Search
let queryEmbedding = try await model.encode("Hi there")
let results = try await client.vectorSearch(
    "embeddings",
    vector: queryEmbedding,
    topK: 10,
    filter: "category == 'greeting'"
)

for result in results {
    print("ID: \(result.id), Score: \(result.score)")
}
```

### Time Series

```swift
import Ferrite

// Add samples
try await client.tsAdd("temperature:room1", value: 23.5)
try await client.tsAdd("temperature:room1", value: 24.0, labels: [
    "location": "office",
    "sensor": "temp-01"
])

// Add with specific timestamp
try await client.tsAdd(
    "temperature:room1",
    timestamp: Date(),
    value: 23.8
)

// Query range
let samples = try await client.tsRange("temperature:room1", from: .distantPast, to: .now)

// Aggregated query
let hourlyAvg = try await client.tsRange(
    "temperature:room1",
    from: Date().addingTimeInterval(-86400),
    to: .now,
    aggregation: .avg,
    bucketSize: .hours(1)
)
```

### Document Store

```swift
import Ferrite

// Define document structure
struct Article: Codable {
    let title: String
    let author: String
    let tags: [String]
    let views: Int
}

// Insert document
let article = Article(
    title: "Getting Started",
    author: "Alice",
    tags: ["tutorial", "beginner"],
    views: 100
)
try await client.docInsert("articles", id: "article:1", document: article)

// Query documents
let query = DocumentQuery()
    .filter(\.author, equals: "Alice")
    .sort(\.views, .descending)
    .limit(10)

let articles: [Article] = try await client.docFind("articles", query: query)
```

## Transactions

### Basic Transaction

```swift
let results = try await client.multi { tx in
    try await tx.set("key1", value: "value1")
    try await tx.set("key2", value: "value2")
    try await tx.get("key1")
}
```

### WATCH-based Transaction

```swift
let result = try await client.watch(["account:1:balance"]) { client in
    guard let balanceStr: String = try await client.get("account:1:balance"),
          let balance = Int(balanceStr),
          balance >= 100 else {
        try await client.unwatch()
        return nil
    }

    return try await client.multi { tx in
        try await tx.decrBy("account:1:balance", amount: 100)
        try await tx.incrBy("account:2:balance", amount: 100)
    }
}

switch result {
case .success:
    print("Transaction committed")
case .watchFailed:
    print("Key changed, retry")
case .aborted:
    print("Transaction aborted")
}
```

## Pub/Sub

### Publishing

```swift
let subscribers = try await client.publish("events", message: "Hello, subscribers!")
```

### Subscribing

```swift
// Subscribe with async stream
let subscription = try await client.subscribe(["events", "notifications"])

for await message in subscription.messages {
    print("Channel \(message.channel): \(message.payload)")
}

// Pattern subscribe
let patternSub = try await client.psubscribe(["events:*"])

for await message in patternSub.messages {
    print("Pattern \(message.pattern ?? "") -> \(message.channel): \(message.payload)")
}
```

### Using Combine (iOS/macOS)

```swift
import Combine

let subscription = try await client.subscribe(["events"])

subscription.messagePublisher
    .sink { message in
        print("Received: \(message.payload)")
    }
    .store(in: &cancellables)
```

## Pipelining

```swift
// Execute multiple commands in a single round-trip
let results = try await client.pipeline { pipe in
    pipe.set("key1", value: "value1")
    pipe.set("key2", value: "value2")
    pipe.get("key1")
    pipe.get("key2")
}
```

## Lua Scripting

```swift
// Define script
let script = """
local current = redis.call('GET', KEYS[1])
if current then
    return redis.call('SET', KEYS[1], ARGV[1])
else
    return nil
end
"""

// Load script
let sha = try await client.scriptLoad(script)

// Execute by SHA
let result = try await client.evalsha(sha, keys: ["mykey"], args: ["newvalue"])

// Or one-shot execution
let result = try await client.eval(script, keys: ["mykey"], args: ["newvalue"])
```

## Error Handling

```swift
import Ferrite

do {
    let value = try await client.get("key")
} catch FerriteError.connectionFailed(let reason) {
    print("Connection failed: \(reason)")
} catch FerriteError.timeout {
    print("Operation timed out")
} catch FerriteError.serverError(let message) {
    print("Server error: \(message)")
} catch {
    print("Unexpected error: \(error)")
}

// With Result type
let result: Result<String?, FerriteError> = await client.getResult("key")

switch result {
case .success(let value):
    print("Value: \(value ?? "nil")")
case .failure(let error):
    print("Error: \(error)")
}
```

## iOS/macOS Integration

### SwiftUI App

```swift
import SwiftUI
import Ferrite

@main
struct MyApp: App {
    @StateObject private var ferriteManager = FerriteManager()

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(ferriteManager)
        }
    }
}

@MainActor
class FerriteManager: ObservableObject {
    private var client: FerriteClient?

    init() {
        Task {
            await connect()
        }
    }

    func connect() async {
        do {
            client = try await FerriteClient.connect(
                host: "localhost",
                port: 6380
            )
        } catch {
            print("Failed to connect: \(error)")
        }
    }

    func get(_ key: String) async -> String? {
        try? await client?.get(key)
    }

    func set(_ key: String, value: String) async {
        try? await client?.set(key, value: value)
    }
}
```

### SwiftUI View with Caching

```swift
import SwiftUI
import Ferrite

struct UserProfileView: View {
    let userId: String
    @EnvironmentObject var ferrite: FerriteManager
    @State private var user: User?
    @State private var isLoading = true

    var body: some View {
        Group {
            if isLoading {
                ProgressView()
            } else if let user = user {
                VStack {
                    Text(user.name)
                        .font(.title)
                    Text(user.email)
                        .foregroundColor(.secondary)
                }
            } else {
                Text("User not found")
            }
        }
        .task {
            await loadUser()
        }
    }

    private func loadUser() async {
        isLoading = true
        defer { isLoading = false }

        // Try cache first
        if let cached: User = try? await ferrite.getCodable("user:\(userId)") {
            user = cached
            return
        }

        // Fetch from API
        guard let fetched = try? await api.fetchUser(userId) else { return }

        // Cache for 5 minutes
        try? await ferrite.setCodable("user:\(userId)", value: fetched, expiration: .seconds(300))
        user = fetched
    }
}
```

### Background Refresh

```swift
import BackgroundTasks
import Ferrite

class AppDelegate: NSObject, UIApplicationDelegate {
    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        BGTaskScheduler.shared.register(
            forTaskWithIdentifier: "com.myapp.refresh",
            using: nil
        ) { task in
            self.handleBackgroundRefresh(task: task as! BGAppRefreshTask)
        }
        return true
    }

    func handleBackgroundRefresh(task: BGAppRefreshTask) {
        Task {
            do {
                let client = try await FerriteClient.connect(host: "localhost", port: 6380)

                // Sync data
                let updates = try await fetchUpdates()
                for update in updates {
                    try await client.set("cache:\(update.id)", value: update.data)
                }

                try await client.close()
                task.setTaskCompleted(success: true)
            } catch {
                task.setTaskCompleted(success: false)
            }
        }
    }
}
```

## Vapor Integration

### Configuration

```swift
// Sources/App/configure.swift
import Vapor
import Ferrite

public func configure(_ app: Application) async throws {
    // Configure Ferrite
    app.ferrite.configuration = .init(
        host: Environment.get("FERRITE_HOST") ?? "localhost",
        port: Int(Environment.get("FERRITE_PORT") ?? "6380") ?? 6380,
        password: Environment.get("FERRITE_PASSWORD"),
        poolSize: 10
    )

    // Register routes
    try routes(app)
}
```

### Vapor Extension

```swift
// Sources/App/Ferrite+Vapor.swift
import Vapor
import Ferrite

extension Application {
    var ferrite: FerriteVapor {
        .init(application: self)
    }

    struct FerriteVapor {
        let application: Application

        struct ConfigurationKey: StorageKey {
            typealias Value = FerriteConfiguration
        }

        struct PoolKey: StorageKey {
            typealias Value = FerritePool
        }

        var configuration: FerriteConfiguration {
            get { application.storage[ConfigurationKey.self] ?? .init() }
            nonmutating set { application.storage[ConfigurationKey.self] = newValue }
        }

        var pool: FerritePool {
            get {
                if let existing = application.storage[PoolKey.self] {
                    return existing
                }
                let pool = FerritePool(configuration: configuration)
                application.storage[PoolKey.self] = pool
                return pool
            }
        }
    }
}

extension Request {
    var ferrite: FerriteClient {
        get async throws {
            try await application.ferrite.pool.acquire()
        }
    }
}
```

### Route Handlers

```swift
// Sources/App/routes.swift
import Vapor
import Ferrite

func routes(_ app: Application) throws {
    app.get("user", ":id") { req async throws -> User in
        let id = req.parameters.get("id")!
        let cacheKey = "user:\(id)"

        // Try cache first
        if let cached: String = try await req.ferrite.get(cacheKey),
           let user = try? JSONDecoder().decode(User.self, from: Data(cached.utf8)) {
            return user
        }

        // Fetch from database
        guard let user = try await User.find(id, on: req.db) else {
            throw Abort(.notFound)
        }

        // Cache for 5 minutes
        let json = String(data: try JSONEncoder().encode(user), encoding: .utf8)!
        try await req.ferrite.set(cacheKey, value: json, expiration: .seconds(300))

        return user
    }

    // Rate limiting example
    app.grouped(RateLimitMiddleware()).get("api", "data") { req async throws -> Response in
        // Handle request
    }
}

struct RateLimitMiddleware: AsyncMiddleware {
    func respond(to request: Request, chainingTo next: AsyncResponder) async throws -> Response {
        let clientIP = request.peerAddress?.ipAddress ?? "unknown"
        let key = "ratelimit:\(clientIP)"
        let limit = 100
        let window = 60

        let count: Int = try await request.ferrite.incr(key)
        if count == 1 {
            try await request.ferrite.expire(key, seconds: window)
        }

        if count > limit {
            throw Abort(.tooManyRequests)
        }

        var response = try await next.respond(to: request)
        response.headers.add(name: "X-RateLimit-Remaining", value: "\(limit - count)")
        return response
    }
}
```

### Session Storage

```swift
import Vapor
import Ferrite

struct FerriteSessionDriver: SessionDriver {
    let pool: FerritePool

    func createSession(_ data: SessionData, for request: Request) async throws -> SessionID {
        let id = SessionID(string: UUID().uuidString)
        let json = try JSONEncoder().encode(data)
        try await pool.withConnection { client in
            try await client.set(
                "session:\(id.string)",
                value: String(data: json, encoding: .utf8)!,
                expiration: .hours(24)
            )
        }
        return id
    }

    func readSession(_ sessionID: SessionID, for request: Request) async throws -> SessionData? {
        guard let json: String = try await pool.withConnection({ client in
            try await client.get("session:\(sessionID.string)")
        }) else { return nil }

        return try JSONDecoder().decode(SessionData.self, from: Data(json.utf8))
    }

    func updateSession(_ sessionID: SessionID, to data: SessionData, for request: Request) async throws -> SessionID {
        let json = try JSONEncoder().encode(data)
        try await pool.withConnection { client in
            try await client.set(
                "session:\(sessionID.string)",
                value: String(data: json, encoding: .utf8)!,
                expiration: .hours(24)
            )
        }
        return sessionID
    }

    func deleteSession(_ sessionID: SessionID, for request: Request) async throws {
        try await pool.withConnection { client in
            try await client.del("session:\(sessionID.string)")
        }
    }
}
```

## Configuration Reference

```swift
let config = FerriteConfiguration(
    // Connection
    host: "localhost",
    port: 6380,
    password: nil,
    username: "default",
    database: 0,

    // URL alternative (overrides above)
    url: URL(string: "ferrite://user:password@localhost:6380/0"),

    // Timeouts
    connectionTimeout: .seconds(5),
    readTimeout: .seconds(30),
    writeTimeout: .seconds(30),

    // TLS/SSL
    tls: TLSConfiguration(
        certificatePath: "/path/to/cert.pem",
        keyPath: "/path/to/key.pem",
        caPath: "/path/to/ca.pem",
        verifyPeer: true
    ),

    // Reconnection
    reconnectStrategy: .exponentialBackoff(
        initialDelay: .milliseconds(100),
        maxDelay: .seconds(30),
        maxAttempts: 10
    ),

    // Pool settings (for FerritePool)
    poolSize: 10,
    maxIdleTime: .seconds(300),

    // Logging
    logLevel: .info
)
```

## Best Practices

### Use Connection Pools

```swift
// Create pool at app startup
let pool = try await FerritePool(
    host: "localhost",
    port: 6380,
    poolSize: 10
)

// Use throughout app lifecycle
try await pool.withConnection { client in
    try await client.set("key", value: "value")
}
```

### Handle Errors Gracefully

```swift
func fetchWithRetry<T>(_ operation: @escaping () async throws -> T, maxAttempts: Int = 3) async throws -> T {
    var lastError: Error?

    for attempt in 1...maxAttempts {
        do {
            return try await operation()
        } catch FerriteError.connectionFailed {
            lastError = error
            try await Task.sleep(for: .milliseconds(100 * attempt))
        }
    }

    throw lastError ?? FerriteError.timeout
}
```

### Use Codable for Complex Types

```swift
extension FerriteClient {
    func setCodable<T: Encodable>(_ key: String, value: T, expiration: Duration? = nil) async throws {
        let json = try JSONEncoder().encode(value)
        let string = String(data: json, encoding: .utf8)!
        try await set(key, value: string, expiration: expiration)
    }

    func getCodable<T: Decodable>(_ key: String, as type: T.Type = T.self) async throws -> T? {
        guard let string: String = try await get(key) else { return nil }
        return try JSONDecoder().decode(T.self, from: Data(string.utf8))
    }
}
```

### Actor-Based State Management

```swift
actor CacheManager {
    private let client: FerriteClient

    init(client: FerriteClient) {
        self.client = client
    }

    func get<T: Decodable>(_ key: String) async throws -> T? {
        guard let json: String = try await client.get(key) else { return nil }
        return try JSONDecoder().decode(T.self, from: Data(json.utf8))
    }

    func set<T: Encodable>(_ key: String, value: T, ttl: Duration) async throws {
        let json = try JSONEncoder().encode(value)
        try await client.set(key, value: String(data: json, encoding: .utf8)!, expiration: ttl)
    }

    func getOrSet<T: Codable>(_ key: String, ttl: Duration, factory: () async throws -> T) async throws -> T {
        if let cached: T = try await get(key) {
            return cached
        }
        let value = try await factory()
        try await set(key, value: value, ttl: ttl)
        return value
    }
}
```

## Testing

### XCTest Setup

```swift
import XCTest
@testable import Ferrite

final class FerriteTests: XCTestCase {
    var client: FerriteClient!

    override func setUp() async throws {
        client = try await FerriteClient.connect(host: "localhost", port: 6380, database: 15)
        try await client.flushdb()
    }

    override func tearDown() async throws {
        try await client.close()
    }

    func testSetAndGet() async throws {
        try await client.set("test-key", value: "test-value")
        let value: String? = try await client.get("test-key")
        XCTAssertEqual(value, "test-value")
    }
}
```

### Mock Client

```swift
import Ferrite

class MockFerriteClient: FerriteClientProtocol {
    var storage: [String: String] = [:]

    func get(_ key: String) async throws -> String? {
        storage[key]
    }

    func set(_ key: String, value: String, expiration: Duration?) async throws {
        storage[key] = value
    }

    func del(_ keys: String...) async throws -> Int {
        var deleted = 0
        for key in keys {
            if storage.removeValue(forKey: key) != nil {
                deleted += 1
            }
        }
        return deleted
    }
}

// In tests
let mock = MockFerriteClient()
mock.storage["user:1"] = "{\"name\": \"Alice\"}"

let service = UserService(ferrite: mock)
let user = try await service.getUser("1")
XCTAssertEqual(user.name, "Alice")
```

## Next Steps

- [Elixir SDK](/docs/sdk/elixir) - For Elixir/Phoenix applications
- [TypeScript SDK](/docs/sdk/typescript) - For Node.js applications
- [SDK Generator](/docs/sdk/generator) - Generate custom SDKs
