---
maturity: experimental
---

# PHP SDK

The official Ferrite PHP SDK provides easy access to all Ferrite features with support for Laravel, Symfony, and standalone PHP applications.

## Installation

```bash
# Composer
composer require ferrite/ferrite-php
```

**Requirements:**
- PHP 8.1 or later
- ext-json (usually bundled)

## Quick Start

```php
<?php

use Ferrite\Client;

// Connect to Ferrite
$client = new Client([
    'host' => 'localhost',
    'port' => 6380,
]);

// Basic operations
$client->set('key', 'value');
$value = $client->get('key');
echo "Value: {$value}\n";

// Close connection (optional - automatic on script end)
$client->disconnect();
```

## Connection Configuration

### Single Connection

```php
<?php

use Ferrite\Client;
use Ferrite\ClientOptions;

$options = new ClientOptions([
    'host' => 'localhost',
    'port' => 6380,
    'password' => 'secret',
    'username' => 'default',
    'database' => 0,
    'connect_timeout' => 5.0,
    'read_timeout' => 30.0,
    'write_timeout' => 30.0,
    'tls' => [
        'enabled' => true,
        'ca_file' => '/path/to/ca.crt',
        'cert_file' => '/path/to/client.crt',
        'key_file' => '/path/to/client.key',
    ],
]);

$client = new Client($options);
```

### Connection Pool

```php
<?php

use Ferrite\Pool;
use Ferrite\PoolOptions;

$poolOptions = new PoolOptions([
    'host' => 'localhost',
    'port' => 6380,
    'min_connections' => 5,
    'max_connections' => 20,
    'idle_timeout' => 300,
    'connection_timeout' => 5,
]);

$pool = new Pool($poolOptions);

// Get connection from pool
$conn = $pool->get();
try {
    $conn->set('key', 'value');
} finally {
    $pool->release($conn);
}

// Or use callback helper
$pool->execute(function ($conn) {
    $conn->set('key', 'value');
});
```

### Cluster Connection

```php
<?php

use Ferrite\Cluster;

$cluster = new Cluster([
    'nodes' => [
        ['host' => 'node1', 'port' => 6380],
        ['host' => 'node2', 'port' => 6380],
        ['host' => 'node3', 'port' => 6380],
    ],
    'read_preference' => 'replica', // 'primary', 'replica', 'any'
]);

// Automatic routing to correct node
$cluster->set('key', 'value');
```

## Data Types

### Strings

```php
<?php

// Basic operations
$client->set('name', 'Ferrite');
$client->set('session', 'token123', ['ex' => 3600]); // With TTL
$client->setNx('unique', 'first'); // Set if not exists

$name = $client->get('name');
$length = $client->strlen('name');

// Numeric operations
$client->set('counter', 0);
$client->incr('counter');
$client->incrBy('counter', 10);
$client->incrByFloat('counter', 0.5);

// Batch operations
$client->mSet([
    'k1' => 'v1',
    'k2' => 'v2',
    'k3' => 'v3',
]);
$values = $client->mGet(['k1', 'k2', 'k3']);
```

### Lists

```php
<?php

// Push operations
$client->lPush('queue', 'a', 'b', 'c');
$client->rPush('queue', 'd', 'e', 'f');

// Pop operations
$item = $client->lPop('queue');
$items = $client->lPop('queue', 3);

// Blocking pop (for queues)
$result = $client->blPop(['queue1', 'queue2'], 5);
if ($result) {
    [$queue, $item] = $result;
    echo "Got {$item} from {$queue}\n";
}

// Range operations
$range = $client->lRange('queue', 0, -1);
$client->lTrim('queue', 0, 99); // Keep first 100
```

### Hashes

```php
<?php

// Single field operations
$client->hSet('user:1', 'name', 'Alice');
$name = $client->hGet('user:1', 'name');

// Multiple fields
$client->hMSet('user:1', [
    'name' => 'Alice',
    'email' => 'alice@example.com',
    'age' => '30',
]);

// Get all fields
$user = $client->hGetAll('user:1');
// Returns: ['name' => 'Alice', 'email' => 'alice@example.com', 'age' => '30']
```

### Sets

```php
<?php

// Add members
$client->sAdd('tags', 'php', 'database', 'redis');

// Check membership
$isMember = $client->sIsMember('tags', 'php');

// Set operations
$common = $client->sInter('tags1', 'tags2');
$all = $client->sUnion('tags1', 'tags2');
$diff = $client->sDiff('tags1', 'tags2');

// Random members
$random = $client->sRandMember('tags');
$randoms = $client->sRandMember('tags', 3);
```

### Sorted Sets

```php
<?php

// Add with scores
$client->zAdd('leaderboard', [
    'alice' => 100,
    'bob' => 95,
    'carol' => 110,
]);

// Get rankings
$rank = $client->zRank('leaderboard', 'alice');
$score = $client->zScore('leaderboard', 'alice');

// Range queries
$top10 = $client->zRevRange('leaderboard', 0, 9, ['withscores' => true]);

// Score range
$highScorers = $client->zRangeByScore('leaderboard', 100, '+inf');
```

### Streams

```php
<?php

// Add entries
$id = $client->xAdd('events', '*', [
    'type' => 'click',
    'page' => '/home',
]);

// Read entries
$entries = $client->xRange('events', '-', '+', 100);

// Consumer groups
$client->xGroupCreate('events', 'processors', '$', ['mkstream' => true]);

$streams = $client->xReadGroup('processors', 'worker-1', [
    'events' => '>',
], [
    'count' => 10,
    'block' => 5000,
]);

// Acknowledge processing
foreach ($streams as $stream => $messages) {
    foreach ($messages as $id => $fields) {
        // Process message
        $client->xAck('events', 'processors', $id);
    }
}
```

## Extended Features

### Vector Search

```php
<?php

use Ferrite\Vector\SearchOptions;

// Create index
$client->executeCommand([
    'VECTOR.INDEX.CREATE', 'embeddings',
    'DIM', '384',
    'DISTANCE', 'COSINE',
    'TYPE', 'HNSW',
]);

// Add vectors
$embedding = $model->encode('Hello world'); // array of floats
$client->vectorAdd('embeddings', 'doc:1', $embedding, [
    'text' => 'Hello world',
    'category' => 'greeting',
]);

// Search
$queryEmbedding = $model->encode('Hi there');
$options = new SearchOptions([
    'topK' => 10,
    'filter' => "category == 'greeting'",
]);

$results = $client->vectorSearch('embeddings', $queryEmbedding, $options);

foreach ($results as $result) {
    echo "ID: {$result['id']}, Score: {$result['score']}\n";
}
```

### Document Store

```php
<?php

use Ferrite\Document\Query;
use Ferrite\Document\Aggregation;

// Insert document
$doc = [
    'title' => 'Getting Started',
    'author' => 'Alice',
    'tags' => ['tutorial', 'beginner'],
    'views' => 100,
];

$client->docInsert('articles', 'article:1', $doc);

// Query documents
$query = (new Query())
    ->filter(['author' => 'Alice'])
    ->sort('views', 'desc')
    ->limit(10);

$docs = $client->docFind('articles', $query);

// Aggregation pipeline
$pipeline = (new Aggregation())
    ->match(['author' => 'Alice'])
    ->group(['_id' => '$category', 'count' => ['$sum' => 1]])
    ->sort(['count' => -1]);

$results = $client->docAggregate('articles', $pipeline);
```

### Time Series

```php
<?php

// Add samples
$client->tsAdd('temperature:room1', '*', 23.5);
$client->tsAdd('temperature:room1', '*', 24.0, [
    'labels' => [
        'location' => 'office',
        'sensor' => 'temp-01',
    ],
]);

// Add with specific timestamp
$client->tsAdd('temperature:room1', time() * 1000, 23.8);

// Query range
$samples = $client->tsRange('temperature:room1', '-', '+');

// Aggregated query
$hourlyAvg = $client->tsRange('temperature:room1', '-24h', 'now', [
    'aggregation' => 'avg',
    'bucket_size' => 3600000, // 1 hour in ms
]);
```

## Transactions

### Basic Transaction

```php
<?php

$result = $client->transaction(function ($tx) {
    $balance = (int) ($tx->get('account:1:balance') ?? 0);

    if ($balance >= 100) {
        $tx->decrBy('account:1:balance', 100);
        $tx->incrBy('account:2:balance', 100);
        return true;
    }
    return false;
});
```

### WATCH-based Transaction

```php
<?php

$result = $client->watchTransaction(['account:1:balance'], function ($tx) {
    $balance = (int) ($tx->get('account:1:balance') ?? 0);

    if ($balance < 100) {
        return null; // Abort transaction
    }

    return $tx->multi()
        ->decrBy('account:1:balance', 100)
        ->incrBy('account:2:balance', 100)
        ->exec();
});

if ($result === null) {
    echo "Transaction aborted or key changed\n";
} else {
    echo "Transaction committed\n";
}
```

## Pub/Sub

### Publishing

```php
<?php

$client->publish('events', 'Hello, subscribers!');
```

### Subscribing

```php
<?php

use Ferrite\PubSub;

$pubsub = $client->pubsub();

// Subscribe to channels
$pubsub->subscribe('events', 'notifications');

// Pattern subscribe
$pubsub->pSubscribe('events:*');

// Handle messages
foreach ($pubsub->listen() as $message) {
    switch ($message['type']) {
        case 'message':
            echo "Channel {$message['channel']}: {$message['data']}\n";
            break;
        case 'pmessage':
            echo "Pattern {$message['pattern']} matched {$message['channel']}: {$message['data']}\n";
            break;
    }

    // Break on specific condition
    if ($message['data'] === 'quit') {
        break;
    }
}
```

## Pipelining

```php
<?php

// Execute multiple commands in a single round-trip
$pipeline = $client->pipeline();

$pipeline->set('key1', 'value1');
$pipeline->set('key2', 'value2');
$pipeline->get('key1');
$pipeline->get('key2');

$results = $pipeline->exec();

// Results are returned in order
[$setResult1, $setResult2, $value1, $value2] = $results;
```

## Lua Scripting

```php
<?php

// Load script
$script = <<<'LUA'
local current = redis.call('GET', KEYS[1])
if current then
    return redis.call('SET', KEYS[1], ARGV[1])
else
    return nil
end
LUA;

// Register script
$updateIfExists = $client->createScript($script);

// Execute
$result = $updateIfExists->run(
    keys: ['mykey'],
    args: ['newvalue']
);

// Or one-shot execution
$result = $client->eval($script, ['mykey'], ['newvalue']);
```

## Error Handling

```php
<?php

use Ferrite\Exceptions\FerriteException;
use Ferrite\Exceptions\ConnectionException;
use Ferrite\Exceptions\TimeoutException;
use Ferrite\Exceptions\ResponseException;

try {
    $value = $client->get('key');
} catch (ConnectionException $e) {
    error_log("Connection failed: {$e->getMessage()}");
    // Retry logic
} catch (TimeoutException $e) {
    error_log("Operation timed out: {$e->getMessage()}");
} catch (ResponseException $e) {
    error_log("Server error: {$e->getMessage()}");
} catch (FerriteException $e) {
    error_log("General error: {$e->getMessage()}");
}
```

## Laravel Integration

### Service Provider Configuration

```php
// config/database.php
return [
    // ... other connections

    'ferrite' => [
        'driver' => 'ferrite',
        'host' => env('FERRITE_HOST', 'localhost'),
        'port' => env('FERRITE_PORT', 6380),
        'password' => env('FERRITE_PASSWORD'),
        'database' => env('FERRITE_DATABASE', 0),
    ],
];
```

### Publishing Config

```bash
php artisan vendor:publish --tag=ferrite-config
```

### Using the Facade

```php
<?php

use Ferrite\Facades\Ferrite;

// Basic operations
Ferrite::set('key', 'value');
$value = Ferrite::get('key');

// With connection name
Ferrite::connection('cache')->set('key', 'value');
```

### Using with Cache

```php
// config/cache.php
return [
    'stores' => [
        'ferrite' => [
            'driver' => 'ferrite',
            'connection' => 'ferrite',
            'prefix' => 'cache:',
        ],
    ],
];
```

```php
<?php

use Illuminate\Support\Facades\Cache;

Cache::store('ferrite')->put('key', 'value', now()->addHours(1));
$value = Cache::store('ferrite')->get('key');
```

### Using with Sessions

```php
// config/session.php
return [
    'driver' => 'ferrite',
    'connection' => 'ferrite',
];
```

### Using with Queues

```php
// config/queue.php
return [
    'connections' => [
        'ferrite' => [
            'driver' => 'ferrite',
            'connection' => 'ferrite',
            'queue' => 'default',
            'retry_after' => 90,
            'block_for' => null,
        ],
    ],
];
```

## Symfony Integration

### Bundle Configuration

```yaml
# config/packages/ferrite.yaml
ferrite:
    connections:
        default:
            host: '%env(FERRITE_HOST)%'
            port: '%env(int:FERRITE_PORT)%'
            password: '%env(FERRITE_PASSWORD)%'
            database: 0
        cache:
            host: '%env(FERRITE_CACHE_HOST)%'
            port: '%env(int:FERRITE_CACHE_PORT)%'
```

### Using with Dependency Injection

```php
<?php

namespace App\Service;

use Ferrite\Client;

class UserService
{
    public function __construct(
        private Client $ferrite
    ) {}

    public function getUser(string $id): ?array
    {
        $user = $this->ferrite->hGetAll("user:{$id}");
        return empty($user) ? null : $user;
    }

    public function setUser(string $id, array $user): void
    {
        $this->ferrite->hMSet("user:{$id}", $user);
    }
}
```

### Cache Adapter

```yaml
# config/packages/cache.yaml
framework:
    cache:
        pools:
            ferrite.cache:
                adapter: ferrite
                provider: ferrite.client
```

## Configuration Reference

```php
<?php

$options = [
    // Connection
    'host' => 'localhost',
    'port' => 6380,
    'password' => null,
    'username' => 'default',
    'database' => 0,

    // URL alternative (overrides above)
    'url' => 'ferrite://user:password@localhost:6380/0',

    // Timeouts (seconds)
    'connect_timeout' => 5.0,
    'read_timeout' => 30.0,
    'write_timeout' => 30.0,

    // Socket options
    'persistent' => false,
    'tcp_keepalive' => true,

    // TLS/SSL
    'tls' => [
        'enabled' => false,
        'ca_file' => null,
        'cert_file' => null,
        'key_file' => null,
        'verify_peer' => true,
        'verify_peer_name' => true,
    ],

    // Retry
    'retry_count' => 3,
    'retry_delay' => 100, // milliseconds

    // Serialization
    'serializer' => 'php', // 'php', 'json', 'igbinary', 'msgpack'

    // Prefix
    'prefix' => '',
];

$client = new Client($options);
```

## Best Practices

### Connection Management

```php
<?php

// Use connection pools in production
$pool = new Pool([
    'host' => 'localhost',
    'port' => 6380,
    'max_connections' => 20,
    'health_check_interval' => 30,
]);

// Register shutdown handler
register_shutdown_function(function () use ($pool) {
    $pool->close();
});
```

### Error Handling with Retries

```php
<?php

use Ferrite\Utils\Retry;

$result = Retry::execute(
    fn() => $client->get('key'),
    maxAttempts: 3,
    delay: 100,
    backoff: 'exponential',
    onRetry: function ($error, $attempt) {
        error_log("Retry {$attempt}: {$error->getMessage()}");
    }
);
```

### Memory Efficiency with SCAN

```php
<?php

// Use scan for large key spaces
foreach ($client->scan('user:*', 100) as $key) {
    process($key);
}
```

### Type-safe with PHP 8 Attributes

```php
<?php

use Ferrite\Mapping\Entity;
use Ferrite\Mapping\Field;

#[Entity(prefix: 'user:')]
class User
{
    #[Field]
    public string $name;

    #[Field]
    public string $email;

    #[Field(type: 'int')]
    public int $age;
}

// Use repository
$repo = $client->getRepository(User::class);
$user = $repo->find('1');
$repo->save('2', new User(name: 'Bob', email: 'bob@example.com', age: 25));
```

## Next Steps

- [TypeScript SDK](/docs/sdk/typescript) - For Node.js applications
- [Python SDK](/docs/sdk/python) - For Python applications
- [SDK Generator](/docs/sdk/generator) - Generate custom SDKs
