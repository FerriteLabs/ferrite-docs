---
maturity: experimental
---

# Elixir SDK

The official Ferrite Elixir SDK provides idiomatic Elixir access to all Ferrite features with support for Phoenix, Ecto, and OTP applications. Built on GenServer for robust connection management.

## Installation

```elixir
# mix.exs
defp deps do
  [
    {:ferrite, "~> 1.0"}
  ]
end
```

**Requirements:**
- Elixir 1.14 or later
- OTP 25 or later

## Quick Start

```elixir
# Start a connection
{:ok, conn} = Ferrite.start_link(host: "localhost", port: 6380)

# Basic operations
:ok = Ferrite.set(conn, "key", "value")
{:ok, value} = Ferrite.get(conn, "key")
IO.puts("Value: #{value}")
```

## Connection Configuration

### Single Connection

```elixir
{:ok, conn} = Ferrite.start_link(
  host: "localhost",
  port: 6380,
  password: "secret",
  database: 0,
  timeout: 5_000,
  ssl: false,
  name: :ferrite
)

# Using named connection
:ok = Ferrite.set(:ferrite, "key", "value")
```

### Connection Pool with Poolboy

```elixir
# config/config.exs
config :my_app, :ferrite_pool,
  name: {:local, :ferrite_pool},
  worker_module: Ferrite.Worker,
  size: 10,
  max_overflow: 5

# In your application supervisor
children = [
  :poolboy.child_spec(:ferrite_pool, pool_config(), ferrite_opts())
]

# Using the pool
:poolboy.transaction(:ferrite_pool, fn worker ->
  Ferrite.Worker.command(worker, ["SET", "key", "value"])
end)
```

### Using Ferrite.Pool (Built-in)

```elixir
# In your application.ex
children = [
  {Ferrite.Pool,
    name: MyApp.Ferrite,
    pool_size: 10,
    host: "localhost",
    port: 6380
  }
]

# Usage
Ferrite.Pool.command(MyApp.Ferrite, ["SET", "key", "value"])
Ferrite.Pool.pipeline(MyApp.Ferrite, [
  ["SET", "key1", "value1"],
  ["SET", "key2", "value2"],
  ["GET", "key1"]
])
```

### Cluster Connection

```elixir
{:ok, cluster} = Ferrite.Cluster.start_link(
  nodes: [
    [host: "node1", port: 6380],
    [host: "node2", port: 6380],
    [host: "node3", port: 6380]
  ],
  pool_size: 5
)

# Automatic routing to correct node
:ok = Ferrite.Cluster.command(cluster, ["SET", "key", "value"])
```

## Data Types

### Strings

```elixir
# Basic operations
:ok = Ferrite.set(conn, "name", "Ferrite")
:ok = Ferrite.set(conn, "session", "token123", ex: 3600)  # With TTL
{:ok, 1} = Ferrite.setnx(conn, "unique", "first")  # Set if not exists

{:ok, name} = Ferrite.get(conn, "name")
{:ok, length} = Ferrite.strlen(conn, "name")

# Numeric operations
:ok = Ferrite.set(conn, "counter", "0")
{:ok, 1} = Ferrite.incr(conn, "counter")
{:ok, 11} = Ferrite.incrby(conn, "counter", 10)
{:ok, 11.5} = Ferrite.incrbyfloat(conn, "counter", 0.5)

# Batch operations
:ok = Ferrite.mset(conn, [{"k1", "v1"}, {"k2", "v2"}, {"k3", "v3"}])
{:ok, values} = Ferrite.mget(conn, ["k1", "k2", "k3"])
```

### Lists

```elixir
# Push operations
{:ok, length} = Ferrite.lpush(conn, "queue", ["a", "b", "c"])
{:ok, length} = Ferrite.rpush(conn, "queue", ["d", "e", "f"])

# Pop operations
{:ok, item} = Ferrite.lpop(conn, "queue")
{:ok, items} = Ferrite.lpop(conn, "queue", 3)

# Blocking pop (for queues)
case Ferrite.blpop(conn, ["queue1", "queue2"], 5) do
  {:ok, {queue, item}} ->
    IO.puts("Got #{item} from #{queue}")
  {:ok, nil} ->
    IO.puts("Timeout")
end

# Range operations
{:ok, range} = Ferrite.lrange(conn, "queue", 0, -1)
:ok = Ferrite.ltrim(conn, "queue", 0, 99)  # Keep first 100
```

### Hashes

```elixir
# Single field operations
:ok = Ferrite.hset(conn, "user:1", "name", "Alice")
{:ok, name} = Ferrite.hget(conn, "user:1", "name")

# Multiple fields
:ok = Ferrite.hset(conn, "user:1", %{
  name: "Alice",
  email: "alice@example.com",
  age: "30"
})

# Get all fields (returns map)
{:ok, user} = Ferrite.hgetall(conn, "user:1")
# Returns: %{"name" => "Alice", "email" => "alice@example.com", "age" => "30"}

# With atom keys
user_atoms = user |> Map.new(fn {k, v} -> {String.to_atom(k), v} end)
```

### Sets

```elixir
# Add members
{:ok, added} = Ferrite.sadd(conn, "tags", ["elixir", "database", "redis"])

# Check membership
{:ok, true} = Ferrite.sismember(conn, "tags", "elixir")

# Set operations
{:ok, common} = Ferrite.sinter(conn, ["tags1", "tags2"])
{:ok, all} = Ferrite.sunion(conn, ["tags1", "tags2"])
{:ok, diff} = Ferrite.sdiff(conn, ["tags1", "tags2"])

# Random members
{:ok, random} = Ferrite.srandmember(conn, "tags")
{:ok, randoms} = Ferrite.srandmember(conn, "tags", 3)
```

### Sorted Sets

```elixir
# Add with scores
{:ok, added} = Ferrite.zadd(conn, "leaderboard", [
  {100, "alice"},
  {95, "bob"},
  {110, "carol"}
])

# Or with map syntax
{:ok, added} = Ferrite.zadd(conn, "leaderboard", %{
  "alice" => 100,
  "bob" => 95,
  "carol" => 110
})

# Get rankings
{:ok, rank} = Ferrite.zrank(conn, "leaderboard", "alice")
{:ok, score} = Ferrite.zscore(conn, "leaderboard", "alice")

# Range queries
{:ok, top10} = Ferrite.zrevrange(conn, "leaderboard", 0, 9, withscores: true)

# Score range
{:ok, high_scorers} = Ferrite.zrangebyscore(conn, "leaderboard", 100, "+inf")
```

### Streams

```elixir
# Add entries
{:ok, id} = Ferrite.xadd(conn, "events", "*", %{
  type: "click",
  page: "/home"
})

# Read entries
{:ok, entries} = Ferrite.xrange(conn, "events", "-", "+", count: 100)

# Consumer groups
:ok = Ferrite.xgroup(conn, :create, "events", "processors", "$", mkstream: true)

{:ok, streams} = Ferrite.xreadgroup(conn, "processors", "worker-1",
  streams: ["events"],
  ids: [">"],
  count: 10,
  block: 5000
)

# Acknowledge processing
for {stream, messages} <- streams, {id, _fields} <- messages do
  # Process message
  Ferrite.xack(conn, "events", "processors", id)
end
```

## Extended Features

### Vector Search

```elixir
# Create index
:ok = Ferrite.command(conn, [
  "VECTOR.INDEX.CREATE", "embeddings",
  "DIM", "384",
  "DISTANCE", "COSINE",
  "TYPE", "HNSW"
])

# Add vectors
embedding = MyModel.encode("Hello world")  # List of floats
{:ok, id} = Ferrite.Vector.add(conn, "embeddings", "doc:1", embedding,
  text: "Hello world",
  category: "greeting"
)

# Search
query_embedding = MyModel.encode("Hi there")
{:ok, results} = Ferrite.Vector.search(conn, "embeddings", query_embedding,
  top_k: 10,
  filter: "category == 'greeting'"
)

for %{id: id, score: score} <- results do
  IO.puts("ID: #{id}, Score: #{score}")
end
```

### Time Series

```elixir
# Add samples
{:ok, _} = Ferrite.TS.add(conn, "temperature:room1", "*", 23.5)
{:ok, _} = Ferrite.TS.add(conn, "temperature:room1", "*", 24.0,
  labels: %{
    location: "office",
    sensor: "temp-01"
  }
)

# Add with specific timestamp
{:ok, _} = Ferrite.TS.add(conn, "temperature:room1", :os.system_time(:millisecond), 23.8)

# Query range
{:ok, samples} = Ferrite.TS.range(conn, "temperature:room1", "-", "+")

# Aggregated query
{:ok, hourly_avg} = Ferrite.TS.range(conn, "temperature:room1", "-24h", "now",
  aggregation: :avg,
  bucket_size: 3_600_000  # 1 hour in ms
)
```

### CRDT (Conflict-free Replicated Data Types)

Ferrite's CRDT support is especially valuable in Elixir's distributed systems:

```elixir
# G-Counter (grow-only counter)
:ok = Ferrite.CRDT.incr(conn, "page_views", node_id: node())
{:ok, count} = Ferrite.CRDT.get(conn, "page_views")

# PN-Counter (increment/decrement counter)
:ok = Ferrite.CRDT.incr(conn, "active_users", node_id: node())
:ok = Ferrite.CRDT.decr(conn, "active_users", node_id: node())

# LWW-Register (last-write-wins register)
:ok = Ferrite.CRDT.set(conn, "config:feature", "enabled",
  timestamp: :os.system_time(:microsecond),
  node_id: node()
)

# OR-Set (observed-remove set)
:ok = Ferrite.CRDT.sadd(conn, "online_users", "user:123", node_id: node())
:ok = Ferrite.CRDT.srem(conn, "online_users", "user:123", node_id: node())
```

## Transactions

### Basic Transaction

```elixir
{:ok, results} = Ferrite.multi(conn, fn tx ->
  Ferrite.Tx.set(tx, "key1", "value1")
  Ferrite.Tx.set(tx, "key2", "value2")
  Ferrite.Tx.get(tx, "key1")
end)

# Results: [:ok, :ok, "value1"]
```

### WATCH-based Transaction

```elixir
result = Ferrite.watch(conn, ["account:1:balance"], fn ->
  {:ok, balance} = Ferrite.get(conn, "account:1:balance")
  balance = String.to_integer(balance)

  if balance < 100 do
    Ferrite.unwatch(conn)
    {:error, :insufficient_funds}
  else
    Ferrite.multi(conn, fn tx ->
      Ferrite.Tx.decrby(tx, "account:1:balance", 100)
      Ferrite.Tx.incrby(tx, "account:2:balance", 100)
    end)
  end
end)

case result do
  {:ok, _} -> IO.puts("Transaction committed")
  {:error, :watch_failed} -> IO.puts("Key changed, retry")
  {:error, :insufficient_funds} -> IO.puts("Not enough funds")
end
```

## Pub/Sub

### Using GenServer Subscriber

```elixir
defmodule MyApp.EventSubscriber do
  use Ferrite.PubSub

  def start_link(opts) do
    Ferrite.PubSub.start_link(__MODULE__, opts)
  end

  @impl true
  def init(opts) do
    {:ok, opts, subscribe: ["events", "notifications"]}
  end

  @impl true
  def handle_message(channel, message, state) do
    IO.puts("#{channel}: #{message}")
    {:noreply, state}
  end

  @impl true
  def handle_pmessage(pattern, channel, message, state) do
    IO.puts("#{pattern} -> #{channel}: #{message}")
    {:noreply, state}
  end
end

# In your supervisor
children = [
  {MyApp.EventSubscriber, host: "localhost", port: 6380}
]
```

### Publishing

```elixir
{:ok, subscribers} = Ferrite.publish(conn, "events", "Hello, subscribers!")
```

### Simple Subscribe

```elixir
# Subscribe with callback
{:ok, sub} = Ferrite.subscribe(conn, ["events", "notifications"], fn
  {:message, channel, message} ->
    IO.puts("Channel #{channel}: #{message}")
  {:subscribe, channel, count} ->
    IO.puts("Subscribed to #{channel}")
end)

# Unsubscribe
Ferrite.unsubscribe(sub, ["events"])
```

## Pipelining

```elixir
# Execute multiple commands in a single round-trip
{:ok, results} = Ferrite.pipeline(conn, [
  ["SET", "key1", "value1"],
  ["SET", "key2", "value2"],
  ["GET", "key1"],
  ["GET", "key2"]
])

# Results: ["OK", "OK", "value1", "value2"]
```

## Lua Scripting

```elixir
# Define script
script = """
local current = redis.call('GET', KEYS[1])
if current then
  return redis.call('SET', KEYS[1], ARGV[1])
else
  return nil
end
"""

# Load script
{:ok, sha} = Ferrite.script_load(conn, script)

# Execute by SHA
{:ok, result} = Ferrite.evalsha(conn, sha, ["mykey"], ["newvalue"])

# Or one-shot execution
{:ok, result} = Ferrite.eval(conn, script, ["mykey"], ["newvalue"])
```

## Error Handling

```elixir
case Ferrite.get(conn, "key") do
  {:ok, value} ->
    value

  {:error, %Ferrite.ConnectionError{message: msg}} ->
    Logger.error("Connection failed: #{msg}")
    # Retry logic

  {:error, %Ferrite.TimeoutError{}} ->
    Logger.error("Operation timed out")

  {:error, %Ferrite.ResponseError{message: msg}} ->
    Logger.error("Server error: #{msg}")
end

# With pattern matching
with {:ok, balance} <- Ferrite.get(conn, "balance"),
     balance = String.to_integer(balance),
     true <- balance >= 100,
     {:ok, _} <- Ferrite.decrby(conn, "balance", 100) do
  :ok
else
  {:ok, nil} -> {:error, :not_found}
  false -> {:error, :insufficient_funds}
  {:error, reason} -> {:error, reason}
end
```

## Phoenix Integration

### Configuration

```elixir
# config/config.exs
config :my_app, MyApp.Ferrite,
  host: System.get_env("FERRITE_HOST", "localhost"),
  port: String.to_integer(System.get_env("FERRITE_PORT", "6380")),
  password: System.get_env("FERRITE_PASSWORD"),
  pool_size: String.to_integer(System.get_env("FERRITE_POOL_SIZE", "10"))
```

### Application Supervisor

```elixir
# lib/my_app/application.ex
defmodule MyApp.Application do
  use Application

  def start(_type, _args) do
    children = [
      # Ferrite connection pool
      {Ferrite.Pool,
        name: MyApp.Ferrite,
        host: Application.get_env(:my_app, MyApp.Ferrite)[:host],
        port: Application.get_env(:my_app, MyApp.Ferrite)[:port],
        pool_size: Application.get_env(:my_app, MyApp.Ferrite)[:pool_size]
      },
      # Phoenix endpoint
      MyAppWeb.Endpoint
    ]

    opts = [strategy: :one_for_one, name: MyApp.Supervisor]
    Supervisor.start_link(children, opts)
  end
end
```

### Phoenix PubSub Adapter

```elixir
# config/config.exs
config :my_app, MyAppWeb.Endpoint,
  pubsub_server: MyApp.PubSub

config :my_app, MyApp.PubSub,
  adapter: Ferrite.PubSub.Adapter,
  host: "localhost",
  port: 6380
```

### Caching with Plug

```elixir
defmodule MyAppWeb.CachePlug do
  import Plug.Conn

  def init(opts), do: opts

  def call(conn, opts) do
    cache_key = "page:#{conn.request_path}"
    ttl = Keyword.get(opts, :ttl, 300)

    case Ferrite.Pool.command(MyApp.Ferrite, ["GET", cache_key]) do
      {:ok, nil} ->
        conn
        |> register_before_send(fn conn ->
          if conn.status == 200 do
            body = conn.resp_body
            Ferrite.Pool.command(MyApp.Ferrite, ["SETEX", cache_key, ttl, body])
          end
          conn
        end)

      {:ok, cached} ->
        conn
        |> put_resp_content_type("text/html")
        |> send_resp(200, cached)
        |> halt()
    end
  end
end
```

### LiveView State

```elixir
defmodule MyAppWeb.DashboardLive do
  use MyAppWeb, :live_view

  @impl true
  def mount(_params, _session, socket) do
    if connected?(socket) do
      # Subscribe to real-time updates
      Phoenix.PubSub.subscribe(MyApp.PubSub, "dashboard:updates")
    end

    {:ok, assign(socket, stats: load_stats())}
  end

  defp load_stats do
    {:ok, values} = Ferrite.Pool.pipeline(MyApp.Ferrite, [
      ["GET", "stats:users"],
      ["GET", "stats:requests"],
      ["GET", "stats:revenue"]
    ])

    %{
      users: parse_int(Enum.at(values, 0)),
      requests: parse_int(Enum.at(values, 1)),
      revenue: parse_float(Enum.at(values, 2))
    }
  end

  defp parse_int(nil), do: 0
  defp parse_int(val), do: String.to_integer(val)

  defp parse_float(nil), do: 0.0
  defp parse_float(val), do: String.to_float(val)
end
```

## Ecto Integration

### Cache Repo Operations

```elixir
defmodule MyApp.CachedRepo do
  alias MyApp.{Repo, Ferrite}

  def get_user(id, opts \\ []) do
    cache_key = "user:#{id}"
    ttl = Keyword.get(opts, :ttl, 300)

    case Ferrite.Pool.command(MyApp.Ferrite, ["GET", cache_key]) do
      {:ok, nil} ->
        case Repo.get(MyApp.User, id) do
          nil -> nil
          user ->
            json = Jason.encode!(user)
            Ferrite.Pool.command(MyApp.Ferrite, ["SETEX", cache_key, ttl, json])
            user
        end

      {:ok, json} ->
        Jason.decode!(json, keys: :atoms)
        |> then(&struct(MyApp.User, &1))
    end
  end

  def invalidate_user(id) do
    Ferrite.Pool.command(MyApp.Ferrite, ["DEL", "user:#{id}"])
  end
end
```

## Oban Integration

Use Ferrite as an Oban backend:

```elixir
# config/config.exs
config :my_app, Oban,
  engine: Oban.Engines.Ferrite,
  repo: MyApp.Ferrite,
  queues: [default: 10, mailers: 5]
```

## GenServer Patterns

### Connection Wrapper

```elixir
defmodule MyApp.FerriteClient do
  use GenServer

  def start_link(opts) do
    GenServer.start_link(__MODULE__, opts, name: __MODULE__)
  end

  def get(key), do: GenServer.call(__MODULE__, {:get, key})
  def set(key, value), do: GenServer.call(__MODULE__, {:set, key, value})
  def set(key, value, ttl), do: GenServer.call(__MODULE__, {:setex, key, ttl, value})

  @impl true
  def init(opts) do
    {:ok, conn} = Ferrite.start_link(opts)
    {:ok, %{conn: conn}}
  end

  @impl true
  def handle_call({:get, key}, _from, %{conn: conn} = state) do
    result = Ferrite.get(conn, key)
    {:reply, result, state}
  end

  @impl true
  def handle_call({:set, key, value}, _from, %{conn: conn} = state) do
    result = Ferrite.set(conn, key, value)
    {:reply, result, state}
  end

  @impl true
  def handle_call({:setex, key, ttl, value}, _from, %{conn: conn} = state) do
    result = Ferrite.setex(conn, key, ttl, value)
    {:reply, result, state}
  end
end
```

### Rate Limiter

```elixir
defmodule MyApp.RateLimiter do
  @moduledoc """
  Token bucket rate limiter using Ferrite.
  """

  def check_rate(identifier, limit, window_seconds) do
    key = "ratelimit:#{identifier}"
    now = System.system_time(:second)
    window_start = now - window_seconds

    commands = [
      ["ZREMRANGEBYSCORE", key, "-inf", window_start],
      ["ZADD", key, now, "#{now}:#{:rand.uniform()}"],
      ["ZCARD", key],
      ["EXPIRE", key, window_seconds]
    ]

    {:ok, [_, _, count, _]} = Ferrite.Pool.pipeline(MyApp.Ferrite, commands)

    if count <= limit do
      {:ok, limit - count}
    else
      {:error, :rate_limited}
    end
  end
end
```

### Distributed Lock

```elixir
defmodule MyApp.DistributedLock do
  @default_ttl 30_000  # 30 seconds

  def acquire(resource, opts \\ []) do
    lock_key = "lock:#{resource}"
    lock_value = generate_token()
    ttl = Keyword.get(opts, :ttl, @default_ttl)

    case Ferrite.Pool.command(MyApp.Ferrite, ["SET", lock_key, lock_value, "NX", "PX", ttl]) do
      {:ok, "OK"} -> {:ok, lock_value}
      {:ok, nil} -> {:error, :locked}
    end
  end

  def release(resource, token) do
    lock_key = "lock:#{resource}"

    script = """
    if redis.call('get', KEYS[1]) == ARGV[1] then
      return redis.call('del', KEYS[1])
    else
      return 0
    end
    """

    case Ferrite.Pool.command(MyApp.Ferrite, ["EVAL", script, "1", lock_key, token]) do
      {:ok, 1} -> :ok
      {:ok, 0} -> {:error, :not_owner}
    end
  end

  def with_lock(resource, opts \\ [], fun) do
    case acquire(resource, opts) do
      {:ok, token} ->
        try do
          fun.()
        after
          release(resource, token)
        end

      {:error, reason} ->
        {:error, reason}
    end
  end

  defp generate_token, do: :crypto.strong_rand_bytes(16) |> Base.encode64()
end

# Usage
MyApp.DistributedLock.with_lock("critical_section", fn ->
  # Critical section
  do_work()
end)
```

## Configuration Reference

```elixir
Ferrite.start_link(
  # Connection
  host: "localhost",
  port: 6380,
  password: nil,
  database: 0,

  # URL alternative (overrides above)
  url: "ferrite://user:password@localhost:6380/0",

  # Timeouts (milliseconds)
  timeout: 5_000,
  connect_timeout: 5_000,

  # Socket options
  socket_opts: [keepalive: true],

  # TLS/SSL
  ssl: false,
  ssl_opts: [
    cacertfile: "/path/to/ca.crt",
    certfile: "/path/to/client.crt",
    keyfile: "/path/to/client.key",
    verify: :verify_peer
  ],

  # Reconnection
  backoff_initial: 500,
  backoff_max: 30_000,

  # Sync connect (blocks until connected)
  sync_connect: true,

  # Name registration
  name: :my_ferrite
)
```

## Best Practices

### Use Supervisors

```elixir
# Always supervise connections
children = [
  {Ferrite.Pool, name: MyApp.Ferrite, pool_size: 10}
]

Supervisor.start_link(children, strategy: :one_for_one)
```

### Handle Errors Gracefully

```elixir
# Use with statements for clean error handling
def transfer_funds(from, to, amount) do
  with {:ok, balance} <- get_balance(from),
       :ok <- validate_sufficient_funds(balance, amount),
       {:ok, _} <- execute_transfer(from, to, amount) do
    :ok
  end
end
```

### Use Telemetry for Monitoring

```elixir
# Attach telemetry handlers
:telemetry.attach_many(
  "ferrite-metrics",
  [
    [:ferrite, :command, :start],
    [:ferrite, :command, :stop],
    [:ferrite, :command, :exception]
  ],
  &MyApp.Metrics.handle_event/4,
  nil
)
```

## Testing

### ExUnit Setup

```elixir
# test/test_helper.exs
{:ok, _} = Ferrite.start_link(name: :test_ferrite, database: 15)

ExUnit.start()

# Clear test database before each test
ExUnit.configure(
  before_each: fn ->
    Ferrite.flushdb(:test_ferrite)
  end
)
```

### Mock with Mox

```elixir
# Define behaviour
defmodule MyApp.Cache do
  @callback get(String.t()) :: {:ok, String.t() | nil} | {:error, term()}
  @callback set(String.t(), String.t()) :: :ok | {:error, term()}
end

# In test
Mox.defmock(MockCache, for: MyApp.Cache)

test "handles cache miss" do
  expect(MockCache, :get, fn "key" -> {:ok, nil} end)

  result = MyModule.fetch_with_cache("key")
  assert result == :computed_value
end
```

## Next Steps

- [Swift SDK](/docs/sdk/swift) - For iOS/macOS applications
- [TypeScript SDK](/docs/sdk/typescript) - For Node.js applications
- [SDK Generator](/docs/sdk/generator) - Generate custom SDKs
