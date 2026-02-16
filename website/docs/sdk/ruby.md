---
maturity: experimental
---

# Ruby SDK

The official Ferrite Ruby SDK provides idiomatic Ruby access to all Ferrite features with support for Rails, Sidekiq, and standalone Ruby applications.

## Installation

```ruby
# Gemfile
gem 'ferrite-rb'

# Or install directly
gem install ferrite-rb
```

**Requirements:**
- Ruby 3.0 or later

## Quick Start

```ruby
require 'ferrite'

# Connect to Ferrite
client = Ferrite::Client.new(
  host: 'localhost',
  port: 6380
)

# Basic operations
client.set('key', 'value')
value = client.get('key')
puts "Value: #{value}"

# Close connection (optional - automatic on GC)
client.close
```

## Connection Configuration

### Single Connection

```ruby
require 'ferrite'

client = Ferrite::Client.new(
  host: 'localhost',
  port: 6380,
  password: 'secret',
  username: 'default',
  db: 0,
  connect_timeout: 5,
  read_timeout: 30,
  write_timeout: 30,
  ssl: {
    ca_file: '/path/to/ca.crt',
    cert_file: '/path/to/client.crt',
    key_file: '/path/to/client.key'
  }
)
```

### Connection Pool

```ruby
require 'ferrite'

pool = Ferrite::Pool.new(
  host: 'localhost',
  port: 6380,
  size: 10,         # Pool size
  timeout: 5        # Checkout timeout
)

# Get connection from pool
pool.with do |conn|
  conn.set('key', 'value')
end

# Or use block form
result = pool.with { |conn| conn.get('key') }
```

### Cluster Connection

```ruby
require 'ferrite'

cluster = Ferrite::Cluster.new(
  nodes: [
    { host: 'node1', port: 6380 },
    { host: 'node2', port: 6380 },
    { host: 'node3', port: 6380 }
  ],
  read_preference: :replica  # :primary, :replica, :any
)

# Automatic routing to correct node
cluster.set('key', 'value')
```

## Data Types

### Strings

```ruby
# Basic operations
client.set('name', 'Ferrite')
client.set('session', 'token123', ex: 3600)  # With TTL
client.setnx('unique', 'first')  # Set if not exists

name = client.get('name')
length = client.strlen('name')

# Numeric operations
client.set('counter', 0)
client.incr('counter')
client.incrby('counter', 10)
client.incrbyfloat('counter', 0.5)

# Batch operations
client.mset(k1: 'v1', k2: 'v2', k3: 'v3')
values = client.mget('k1', 'k2', 'k3')
```

### Lists

```ruby
# Push operations
client.lpush('queue', 'a', 'b', 'c')
client.rpush('queue', 'd', 'e', 'f')

# Pop operations
item = client.lpop('queue')
items = client.lpop('queue', 3)

# Blocking pop (for queues)
result = client.blpop('queue1', 'queue2', timeout: 5)
if result
  queue, item = result
  puts "Got #{item} from #{queue}"
end

# Range operations
range = client.lrange('queue', 0, -1)
client.ltrim('queue', 0, 99)  # Keep first 100
```

### Hashes

```ruby
# Single field operations
client.hset('user:1', 'name', 'Alice')
name = client.hget('user:1', 'name')

# Multiple fields
client.hset('user:1',
  name: 'Alice',
  email: 'alice@example.com',
  age: '30'
)

# Get all fields
user = client.hgetall('user:1')
# Returns: { "name" => "Alice", "email" => "alice@example.com", "age" => "30" }

# With symbolized keys
user = client.hgetall('user:1').transform_keys(&:to_sym)
```

### Sets

```ruby
# Add members
client.sadd('tags', 'ruby', 'database', 'redis')

# Check membership
is_member = client.sismember('tags', 'ruby')

# Set operations
common = client.sinter('tags1', 'tags2')
all = client.sunion('tags1', 'tags2')
diff = client.sdiff('tags1', 'tags2')

# Random members
random = client.srandmember('tags')
randoms = client.srandmember('tags', 3)
```

### Sorted Sets

```ruby
# Add with scores
client.zadd('leaderboard',
  100, 'alice',
  95, 'bob',
  110, 'carol'
)

# Or with hash syntax
client.zadd('leaderboard', alice: 100, bob: 95, carol: 110)

# Get rankings
rank = client.zrank('leaderboard', 'alice')
score = client.zscore('leaderboard', 'alice')

# Range queries
top10 = client.zrevrange('leaderboard', 0, 9, with_scores: true)

# Score range
high_scorers = client.zrangebyscore('leaderboard', 100, '+inf')
```

### Streams

```ruby
# Add entries
id = client.xadd('events', '*',
  type: 'click',
  page: '/home'
)

# Read entries
entries = client.xrange('events', '-', '+', count: 100)

# Consumer groups
client.xgroup(:create, 'events', 'processors', '$', mkstream: true)

streams = client.xreadgroup('processors', 'worker-1',
  ['events'],
  ['>'],
  count: 10,
  block: 5000
)

# Acknowledge processing
streams.each do |stream, messages|
  messages.each do |id, fields|
    # Process message
    client.xack('events', 'processors', id)
  end
end
```

## Extended Features

### Vector Search

```ruby
require 'ferrite/vector'

# Create index
client.call('VECTOR.INDEX.CREATE', 'embeddings',
  'DIM', '384',
  'DISTANCE', 'COSINE',
  'TYPE', 'HNSW'
)

# Add vectors
embedding = model.encode('Hello world')  # Array of floats
client.vector_add('embeddings', 'doc:1', embedding,
  text: 'Hello world',
  category: 'greeting'
)

# Search
query_embedding = model.encode('Hi there')
results = client.vector_search('embeddings', query_embedding,
  top_k: 10,
  filter: "category == 'greeting'"
)

results.each do |result|
  puts "ID: #{result[:id]}, Score: #{result[:score]}"
end
```

### Document Store

```ruby
require 'ferrite/document'

# Insert document
doc = {
  title: 'Getting Started',
  author: 'Alice',
  tags: ['tutorial', 'beginner'],
  views: 100
}

client.doc_insert('articles', 'article:1', doc)

# Query documents
query = Ferrite::Document::Query.new
  .filter(author: 'Alice')
  .sort(:views, :desc)
  .limit(10)

docs = client.doc_find('articles', query)

# Aggregation pipeline
pipeline = Ferrite::Document::Aggregation.new
  .match(author: 'Alice')
  .group(_id: '$category', count: { '$sum' => 1 })
  .sort(count: -1)

results = client.doc_aggregate('articles', pipeline)
```

### Time Series

```ruby
require 'ferrite/timeseries'

# Add samples
client.ts_add('temperature:room1', '*', 23.5)
client.ts_add('temperature:room1', '*', 24.0,
  labels: {
    location: 'office',
    sensor: 'temp-01'
  }
)

# Add with specific timestamp
client.ts_add('temperature:room1', Time.now.to_i * 1000, 23.8)

# Query range
samples = client.ts_range('temperature:room1', '-', '+')

# Aggregated query
hourly_avg = client.ts_range('temperature:room1', '-24h', 'now',
  aggregation: :avg,
  bucket_size: 3_600_000  # 1 hour in ms
)
```

## Transactions

### Basic Transaction

```ruby
result = client.multi do |tx|
  balance = tx.get('account:1:balance').to_i

  if balance >= 100
    tx.decrby('account:1:balance', 100)
    tx.incrby('account:2:balance', 100)
    true
  else
    false
  end
end
```

### WATCH-based Transaction

```ruby
result = client.watch('account:1:balance') do
  balance = client.get('account:1:balance').to_i

  if balance < 100
    client.unwatch
    nil  # Abort transaction
  else
    client.multi do |tx|
      tx.decrby('account:1:balance', 100)
      tx.incrby('account:2:balance', 100)
    end
  end
end

if result.nil?
  puts 'Transaction aborted or key changed'
else
  puts 'Transaction committed'
end
```

## Pub/Sub

### Publishing

```ruby
client.publish('events', 'Hello, subscribers!')
```

### Subscribing

```ruby
# Subscribe to channels
client.subscribe('events', 'notifications') do |on|
  on.message do |channel, message|
    puts "Channel #{channel}: #{message}"
  end

  on.subscribe do |channel, subscriptions|
    puts "Subscribed to #{channel} (#{subscriptions} subscriptions)"
  end
end

# Pattern subscribe
client.psubscribe('events:*') do |on|
  on.pmessage do |pattern, channel, message|
    puts "Pattern #{pattern} matched #{channel}: #{message}"
  end
end
```

## Pipelining

```ruby
# Execute multiple commands in a single round-trip
results = client.pipelined do |pipeline|
  pipeline.set('key1', 'value1')
  pipeline.set('key2', 'value2')
  pipeline.get('key1')
  pipeline.get('key2')
end

# Results are returned in order
set_result1, set_result2, value1, value2 = results
```

## Lua Scripting

```ruby
# Load script
script = <<~LUA
  local current = redis.call('GET', KEYS[1])
  if current then
    return redis.call('SET', KEYS[1], ARGV[1])
  else
    return nil
  end
LUA

# Register script
update_if_exists = client.script(:load, script)

# Execute by SHA
result = client.evalsha(update_if_exists, keys: ['mykey'], argv: ['newvalue'])

# Or one-shot execution
result = client.eval(script, keys: ['mykey'], argv: ['newvalue'])
```

## Error Handling

```ruby
require 'ferrite'

begin
  value = client.get('key')
rescue Ferrite::ConnectionError => e
  puts "Connection failed: #{e.message}"
  # Retry logic
rescue Ferrite::TimeoutError => e
  puts "Operation timed out: #{e.message}"
rescue Ferrite::ResponseError => e
  puts "Server error: #{e.message}"
rescue Ferrite::Error => e
  puts "General error: #{e.message}"
end
```

## Rails Integration

### Configuration

```ruby
# config/initializers/ferrite.rb
Ferrite.configure do |config|
  config.url = ENV.fetch('FERRITE_URL', 'ferrite://localhost:6380/0')

  # Or explicit options
  config.host = ENV.fetch('FERRITE_HOST', 'localhost')
  config.port = ENV.fetch('FERRITE_PORT', 6380).to_i
  config.password = ENV['FERRITE_PASSWORD']
  config.db = 0

  # Pool settings
  config.pool_size = ENV.fetch('FERRITE_POOL_SIZE', 10).to_i
  config.pool_timeout = 5
end
```

### Cache Store

```ruby
# config/environments/production.rb
Rails.application.configure do
  config.cache_store = :ferrite_store,
    url: ENV['FERRITE_URL'],
    namespace: 'cache',
    expires_in: 1.hour,
    pool_size: 10
end
```

```ruby
# Usage
Rails.cache.fetch('expensive_query', expires_in: 5.minutes) do
  User.expensive_query
end
```

### Session Store

```ruby
# config/initializers/session_store.rb
Rails.application.config.session_store :ferrite_store,
  servers: [ENV['FERRITE_URL']],
  key: '_app_session',
  expire_after: 24.hours,
  threadsafe: true
```

### Action Cable Adapter

```ruby
# config/cable.yml
production:
  adapter: ferrite
  url: <%= ENV['FERRITE_URL'] %>
  channel_prefix: app_production
```

### Active Job Adapter

```ruby
# config/application.rb
config.active_job.queue_adapter = :ferrite

# config/initializers/ferrite.rb
Ferrite::ActiveJob.configure do |config|
  config.url = ENV['FERRITE_URL']
  config.queue_prefix = 'jobs'
end
```

## Sidekiq Integration

```ruby
# config/initializers/sidekiq.rb
Sidekiq.configure_server do |config|
  config.ferrite = {
    url: ENV['FERRITE_URL']
  }
end

Sidekiq.configure_client do |config|
  config.ferrite = {
    url: ENV['FERRITE_URL'],
    size: 5
  }
end
```

## Configuration Reference

```ruby
client = Ferrite::Client.new(
  # Connection
  host: 'localhost',
  port: 6380,
  password: nil,
  username: 'default',
  db: 0,

  # URL alternative (overrides above)
  url: 'ferrite://user:password@localhost:6380/0',

  # Timeouts (seconds)
  connect_timeout: 5,
  read_timeout: 30,
  write_timeout: 30,

  # Socket options
  tcp_keepalive: 30,

  # TLS/SSL
  ssl: false,  # or hash with options
  ssl_params: {
    ca_file: '/path/to/ca.crt',
    cert: '/path/to/client.crt',
    key: '/path/to/client.key',
    verify_mode: OpenSSL::SSL::VERIFY_PEER
  },

  # Reconnection
  reconnect_attempts: 3,
  reconnect_delay: 0.5,
  reconnect_delay_max: 5,

  # Driver
  driver: :ruby,  # :ruby, :hiredis

  # Logging
  logger: Rails.logger,
  log_level: :info
)
```

## Best Practices

### Connection Management

```ruby
# Use connection pools in production
$ferrite = Ferrite::Pool.new(
  host: 'localhost',
  port: 6380,
  size: 20,
  timeout: 5
)

# Use at_exit for cleanup
at_exit { $ferrite.shutdown }
```

### Error Handling with Retries

```ruby
require 'ferrite/utils'

result = Ferrite::Utils.with_retry(
  max_attempts: 3,
  delay: 0.1,
  backoff: :exponential
) do
  client.get('key')
end
```

### Memory Efficiency with SCAN

```ruby
# Use scan for large key spaces
client.scan_each(match: 'user:*', count: 100) do |key|
  process(key)
end
```

### Object Mapping

```ruby
require 'ferrite/model'

class User
  include Ferrite::Model

  attribute :name, String
  attribute :email, String
  attribute :age, Integer
  attribute :created_at, Time

  index :email, unique: true
end

# Create
user = User.create(name: 'Alice', email: 'alice@example.com', age: 30)

# Find
user = User.find('user:1')
user = User.find_by(email: 'alice@example.com')

# Update
user.update(age: 31)

# Delete
user.destroy
```

### Thread Safety

```ruby
# Each thread should have its own connection or use a pool
Thread.new do
  $ferrite.with do |conn|
    conn.set('thread_key', Thread.current.object_id)
  end
end
```

## Testing

### RSpec Integration

```ruby
# spec/spec_helper.rb
require 'ferrite/testing'

RSpec.configure do |config|
  config.before(:each) do
    Ferrite::Testing.flush_all
  end
end
```

### Mock Client

```ruby
# In tests
let(:ferrite) { Ferrite::Testing::MockClient.new }

before do
  allow(Ferrite).to receive(:current).and_return(ferrite)
end

it 'stores data' do
  ferrite.set('key', 'value')
  expect(ferrite.get('key')).to eq('value')
end
```

## Next Steps

- [TypeScript SDK](/docs/sdk/typescript) - For Node.js applications
- [Python SDK](/docs/sdk/python) - For Python applications
- [SDK Generator](/docs/sdk/generator) - Generate custom SDKs
