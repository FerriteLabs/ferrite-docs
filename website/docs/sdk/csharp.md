---
maturity: experimental
---

# C# / .NET SDK

The official Ferrite C# SDK provides type-safe access to all Ferrite features with full async/await support for .NET 6+ applications.

## Installation

```bash
# .NET CLI
dotnet add package Ferrite.Client

# Package Manager Console
Install-Package Ferrite.Client

# PackageReference (in .csproj)
<PackageReference Include="Ferrite.Client" Version="1.0.0" />
```

## Quick Start

```csharp
using Ferrite.Client;

// Connect to Ferrite
var client = new FerriteClient(new FerriteOptions
{
    Host = "localhost",
    Port = 6380
});

await client.ConnectAsync();

// Basic operations
await client.SetAsync("key", "value");
var value = await client.GetAsync("key");
Console.WriteLine($"Value: {value}");

// Close connection
await client.DisconnectAsync();
```

## Connection Configuration

### Single Connection

```csharp
using Ferrite.Client;

var options = new FerriteOptions
{
    Host = "localhost",
    Port = 6380,
    Password = "secret",
    Username = "default",
    Database = 0,
    ConnectTimeout = TimeSpan.FromSeconds(5),
    ReadTimeout = TimeSpan.FromSeconds(30),
    WriteTimeout = TimeSpan.FromSeconds(30),
    Tls = new TlsOptions
    {
        Enabled = true,
        CertificatePath = "/path/to/client.pfx",
        CertificatePassword = "password"
    }
};

var client = new FerriteClient(options);
await client.ConnectAsync();
```

### Connection Pool

```csharp
using Ferrite.Client;

var poolOptions = new FerritePoolOptions
{
    Host = "localhost",
    Port = 6380,
    MinConnections = 5,
    MaxConnections = 20,
    IdleTimeout = TimeSpan.FromMinutes(5),
    ConnectionTimeout = TimeSpan.FromSeconds(5)
};

var pool = new FerritePool(poolOptions);

// Get connection from pool
await using (var conn = await pool.GetConnectionAsync())
{
    await conn.SetAsync("key", "value");
}

// Or use Execute helper
await pool.ExecuteAsync(async conn =>
{
    await conn.SetAsync("key", "value");
});
```

### Cluster Connection

```csharp
using Ferrite.Client;

var cluster = new FerriteCluster(new FerriteClusterOptions
{
    Nodes = new[]
    {
        new ClusterNode("node1", 6380),
        new ClusterNode("node2", 6380),
        new ClusterNode("node3", 6380)
    },
    ReadPreference = ReadPreference.Replica
});

await cluster.ConnectAsync();

// Automatic routing to correct node
await cluster.SetAsync("key", "value");
```

## Data Types

### Strings

```csharp
// Basic operations
await client.SetAsync("name", "Ferrite");
await client.SetAsync("session", "token123", expiry: TimeSpan.FromHours(1));
await client.SetNxAsync("unique", "first"); // Set if not exists

var name = await client.GetAsync("name");
var length = await client.StrLenAsync("name");

// Numeric operations
await client.SetAsync("counter", "0");
await client.IncrAsync("counter");
await client.IncrByAsync("counter", 10);
await client.IncrByFloatAsync("counter", 0.5);

// Batch operations
await client.MSetAsync(new Dictionary<string, string>
{
    ["k1"] = "v1",
    ["k2"] = "v2",
    ["k3"] = "v3"
});
var values = await client.MGetAsync("k1", "k2", "k3");
```

### Lists

```csharp
// Push operations
await client.LPushAsync("queue", "a", "b", "c");
await client.RPushAsync("queue", "d", "e", "f");

// Pop operations
var item = await client.LPopAsync("queue");
var items = await client.LPopAsync("queue", 3);

// Blocking pop (for queues)
var result = await client.BLPopAsync(new[] { "queue1", "queue2" }, TimeSpan.FromSeconds(5));
if (result != null)
{
    Console.WriteLine($"Got {result.Value} from {result.Queue}");
}

// Range operations
var range = await client.LRangeAsync("queue", 0, -1);
await client.LTrimAsync("queue", 0, 99); // Keep first 100
```

### Hashes

```csharp
// Single field operations
await client.HSetAsync("user:1", "name", "Alice");
var name = await client.HGetAsync("user:1", "name");

// Multiple fields
await client.HMSetAsync("user:1", new Dictionary<string, string>
{
    ["name"] = "Alice",
    ["email"] = "alice@example.com",
    ["age"] = "30"
});

// Get all fields
var user = await client.HGetAllAsync("user:1");

// Type-safe with records
public record User(string Name, string Email, int Age);

var user = await client.HGetAllAsync<User>("user:1");
Console.WriteLine(user.Name); // Type-safe access
```

### Sets

```csharp
// Add members
await client.SAddAsync("tags", "csharp", "database", "redis");

// Check membership
var isMember = await client.SIsMemberAsync("tags", "csharp");

// Set operations
var common = await client.SInterAsync("tags1", "tags2");
var all = await client.SUnionAsync("tags1", "tags2");
var diff = await client.SDiffAsync("tags1", "tags2");

// Random members
var random = await client.SRandMemberAsync("tags");
var randoms = await client.SRandMemberAsync("tags", 3);
```

### Sorted Sets

```csharp
// Add with scores
await client.ZAddAsync("leaderboard",
    (100, "alice"),
    (95, "bob"),
    (110, "carol")
);

// Get rankings
var rank = await client.ZRankAsync("leaderboard", "alice");
var score = await client.ZScoreAsync("leaderboard", "alice");

// Range queries
var top10 = await client.ZRevRangeWithScoresAsync("leaderboard", 0, 9);

// Score range
var highScorers = await client.ZRangeByScoreAsync("leaderboard", 100, double.PositiveInfinity);
```

### Streams

```csharp
using Ferrite.Client.Streams;

// Add entries
var id = await client.XAddAsync("events", new Dictionary<string, string>
{
    ["type"] = "click",
    ["page"] = "/home"
});

// Read entries
var entries = await client.XRangeAsync("events", "-", "+", count: 100);

// Consumer groups
await client.XGroupCreateAsync("events", "processors", "$", mkstream: true);

var streams = await client.XReadGroupAsync(
    "processors",
    "worker-1",
    new[] { ("events", ">") },
    count: 10,
    block: TimeSpan.FromSeconds(5)
);

// Acknowledge processing
foreach (var (stream, messages) in streams)
{
    foreach (var msg in messages)
    {
        // Process message
        await client.XAckAsync("events", "processors", msg.Id);
    }
}
```

## Extended Features

### Vector Search

```csharp
using Ferrite.Client.Vector;

// Create index
await client.ExecuteCommandAsync(
    "VECTOR.INDEX.CREATE", "embeddings",
    "DIM", "384",
    "DISTANCE", "COSINE",
    "TYPE", "HNSW"
);

// Add vectors
float[] embedding = await model.EncodeAsync("Hello world");
await client.VectorAddAsync("embeddings", "doc:1", embedding, new Dictionary<string, string>
{
    ["text"] = "Hello world",
    ["category"] = "greeting"
});

// Search
float[] queryEmbedding = await model.EncodeAsync("Hi there");
var results = await client.VectorSearchAsync("embeddings", queryEmbedding, new SearchOptions
{
    TopK = 10,
    Filter = "category == 'greeting'"
});

foreach (var result in results)
{
    Console.WriteLine($"ID: {result.Id}, Score: {result.Score}");
}
```

### Document Store

```csharp
using Ferrite.Client.Document;

public record Article(string Title, string Author, string[] Tags, int Views);

// Insert document
var doc = new Article("Getting Started", "Alice", new[] { "tutorial", "beginner" }, 100);
await client.DocInsertAsync("articles", "article:1", doc);

// Query documents
var query = new Query<Article>()
    .Where(a => a.Author == "Alice")
    .OrderByDescending(a => a.Views)
    .Take(10);

var docs = await client.DocFindAsync("articles", query);

// Aggregation pipeline
var results = await client.DocAggregateAsync("articles",
    Aggregate.Match(a => a.Author == "Alice")
        .GroupBy(a => a.Tags, g => new { Count = g.Count() })
        .OrderByDescending(r => r.Count)
);
```

### Time Series

```csharp
using Ferrite.Client.TimeSeries;

// Add samples
await client.TsAddAsync("temperature:room1", DateTime.UtcNow, 23.5);
await client.TsAddAsync("temperature:room1", DateTime.UtcNow, 24.0, new Dictionary<string, string>
{
    ["location"] = "office",
    ["sensor"] = "temp-01"
});

// Query range
var samples = await client.TsRangeAsync("temperature:room1", "-", "+");

// Aggregated query
var hourlyAvg = await client.TsRangeAsync("temperature:room1",
    DateTime.UtcNow.AddHours(-24),
    DateTime.UtcNow,
    new TsRangeOptions
    {
        Aggregation = AggregationType.Avg,
        BucketSize = TimeSpan.FromHours(1)
    }
);
```

## Transactions

### Basic Transaction

```csharp
var result = await client.TransactionAsync(async tx =>
{
    var balance = int.Parse(await tx.GetAsync("account:1:balance") ?? "0");

    if (balance >= 100)
    {
        await tx.DecrByAsync("account:1:balance", 100);
        await tx.IncrByAsync("account:2:balance", 100);
        return true;
    }
    return false;
});
```

### WATCH-based Transaction

```csharp
var result = await client.WatchTransactionAsync(
    new[] { "account:1:balance" },
    async tx =>
    {
        var balance = int.Parse(await tx.GetAsync("account:1:balance") ?? "0");

        if (balance < 100)
        {
            return null; // Abort transaction
        }

        return tx.Multi()
            .DecrBy("account:1:balance", 100)
            .IncrBy("account:2:balance", 100)
            .Exec();
    }
);

if (result == null)
{
    Console.WriteLine("Transaction aborted or key changed");
}
else
{
    Console.WriteLine("Transaction committed");
}
```

## Pub/Sub

### Publishing

```csharp
await client.PublishAsync("events", "Hello, subscribers!");
```

### Subscribing

```csharp
using Ferrite.Client.PubSub;

var pubsub = client.GetSubscriber();

// Subscribe to channels
await pubsub.SubscribeAsync("events", "notifications");

// Pattern subscribe
await pubsub.PSubscribeAsync("events:*");

// Handle messages with events
pubsub.OnMessage += (sender, e) =>
{
    Console.WriteLine($"Channel {e.Channel}: {e.Message}");
};

pubsub.OnPatternMessage += (sender, e) =>
{
    Console.WriteLine($"Pattern {e.Pattern} matched {e.Channel}: {e.Message}");
};

// Or use async enumerable
await foreach (var message in pubsub.GetMessagesAsync())
{
    Console.WriteLine($"{message.Channel}: {message.Data}");
}
```

## Pipelining

```csharp
// Execute multiple commands in a single round-trip
var pipeline = client.CreatePipeline();

pipeline.Set("key1", "value1");
pipeline.Set("key2", "value2");
pipeline.Get("key1");
pipeline.Get("key2");

var results = await pipeline.ExecuteAsync();

// Results are returned in order
var (setResult1, setResult2, value1, value2) = results;
```

## Lua Scripting

```csharp
// Load script
const string script = @"
    local current = redis.call('GET', KEYS[1])
    if current then
        return redis.call('SET', KEYS[1], ARGV[1])
    else
        return nil
    end
";

// Register script
var updateIfExists = await client.CreateScriptAsync(script);

// Execute
var result = await updateIfExists.RunAsync(
    keys: new[] { "mykey" },
    args: new[] { "newvalue" }
);

// Or one-shot execution
var result = await client.EvalAsync(script,
    keys: new[] { "mykey" },
    args: new[] { "newvalue" }
);
```

## Error Handling

```csharp
using Ferrite.Client.Exceptions;

try
{
    var value = await client.GetAsync("key");
}
catch (FerriteConnectionException ex)
{
    Console.Error.WriteLine($"Connection failed: {ex.Message}");
    // Retry logic
}
catch (FerriteTimeoutException ex)
{
    Console.Error.WriteLine($"Operation timed out: {ex.Message}");
}
catch (FerriteResponseException ex)
{
    Console.Error.WriteLine($"Server error: {ex.Message}");
}
catch (FerriteException ex)
{
    Console.Error.WriteLine($"General error: {ex.Message}");
}
```

## Dependency Injection

### ASP.NET Core Integration

```csharp
// Program.cs
using Ferrite.Client;
using Ferrite.Client.DependencyInjection;

var builder = WebApplication.CreateBuilder(args);

// Add Ferrite services
builder.Services.AddFerrite(options =>
{
    options.Host = builder.Configuration["Ferrite:Host"] ?? "localhost";
    options.Port = int.Parse(builder.Configuration["Ferrite:Port"] ?? "6380");
    options.Password = builder.Configuration["Ferrite:Password"];
});

// Or with connection pool
builder.Services.AddFerritePool(options =>
{
    options.Host = "localhost";
    options.Port = 6380;
    options.MinConnections = 5;
    options.MaxConnections = 20;
});

var app = builder.Build();
```

### Using in Controllers

```csharp
[ApiController]
[Route("api/[controller]")]
public class UsersController : ControllerBase
{
    private readonly IFerriteClient _ferrite;

    public UsersController(IFerriteClient ferrite)
    {
        _ferrite = ferrite;
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<User>> GetUser(string id)
    {
        var user = await _ferrite.HGetAllAsync<User>($"user:{id}");
        if (user == null)
            return NotFound();
        return Ok(user);
    }

    [HttpPost("{id}")]
    public async Task<ActionResult> CreateUser(string id, User user)
    {
        await _ferrite.HMSetAsync($"user:{id}", user);
        return CreatedAtAction(nameof(GetUser), new { id }, user);
    }
}
```

### Using with IHostedService

```csharp
public class BackgroundWorker : BackgroundService
{
    private readonly IFerritePool _pool;
    private readonly ILogger<BackgroundWorker> _logger;

    public BackgroundWorker(IFerritePool pool, ILogger<BackgroundWorker> logger)
    {
        _pool = pool;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            await using var conn = await _pool.GetConnectionAsync();

            var result = await conn.BLPopAsync(
                new[] { "job:queue" },
                TimeSpan.FromSeconds(5)
            );

            if (result != null)
            {
                _logger.LogInformation("Processing job: {Value}", result.Value);
                // Process job
            }
        }
    }
}
```

## Configuration Reference

```csharp
var options = new FerriteOptions
{
    // Connection
    Host = "localhost",
    Port = 6380,
    Password = null,
    Username = "default",
    Database = 0,

    // URL alternative (overrides above)
    ConnectionString = "ferrite://user:password@localhost:6380/0",

    // Timeouts
    ConnectTimeout = TimeSpan.FromSeconds(5),
    ReadTimeout = TimeSpan.FromSeconds(30),
    WriteTimeout = TimeSpan.FromSeconds(30),

    // Socket options
    KeepAlive = true,
    KeepAliveInterval = TimeSpan.FromSeconds(30),
    NoDelay = true,

    // TLS/SSL
    Tls = new TlsOptions
    {
        Enabled = false,
        CertificatePath = null,
        CertificatePassword = null,
        ValidateCertificate = true,
        ServerName = null
    },

    // Retry
    RetryCount = 3,
    RetryBaseDelay = TimeSpan.FromMilliseconds(50),

    // Serialization
    Serializer = new JsonSerializer()
};
```

## Best Practices

### Connection Management

```csharp
// Use connection pools in production
var pool = new FerritePool(new FerritePoolOptions
{
    Host = "localhost",
    Port = 6380,
    MaxConnections = 20,
    HealthCheckInterval = TimeSpan.FromSeconds(30)
});

// Graceful shutdown
var lifetime = app.Services.GetRequiredService<IHostApplicationLifetime>();
lifetime.ApplicationStopping.Register(async () =>
{
    await pool.DisposeAsync();
});
```

### Using IAsyncDisposable

```csharp
await using var client = new FerriteClient(options);
await client.ConnectAsync();

// Client will be disposed automatically
await client.SetAsync("key", "value");
```

### Memory Efficiency with SCAN

```csharp
// Use scan for large key spaces
await foreach (var key in client.ScanAsync("user:*", pageSize: 100))
{
    await ProcessAsync(key);
}
```

## Next Steps

- [TypeScript SDK](/docs/sdk/typescript) - For Node.js applications
- [Python SDK](/docs/sdk/python) - For Python applications
- [SDK Generator](/docs/sdk/generator) - Generate custom SDKs
