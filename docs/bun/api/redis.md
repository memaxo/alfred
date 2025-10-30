---
title: Redis client – API | Bun Docs
url: 
description: Bun provides a fast, native Redis client with automatic command pipelining for better performance.
language: en
---
Search`` `K`

Ask AI

![ai chat avatar](https://bun.com/logo_avatar.svg)

Intro

[What is Bun?](https://bun.com/docs/index) [Installation](https://bun.com/docs/installation) [Quickstart](https://bun.com/docs/quickstart) [TypeScript](https://bun.com/docs/typescript)

Templating

[`bun init`](https://bun.com/docs/cli/init) [`bun create`](https://bun.com/docs/cli/bun-create)

Runtime

[`bun run`](https://bun.com/docs/cli/run) [File types](https://bun.com/docs/runtime/loaders) [TypeScript](https://bun.com/docs/runtime/typescript) [JSX](https://bun.com/docs/runtime/jsx) [Environment variables](https://bun.com/docs/runtime/env) [Bun APIs](https://bun.com/docs/runtime/bun-apis) [Web APIs](https://bun.com/docs/runtime/web-apis) [Node.js compatibility](https://bun.com/docs/runtime/nodejs-apis) [Single-file executable](https://bun.com/docs/bundler/executables) [Plugins](https://bun.com/docs/runtime/plugins) [Watch mode](https://bun.com/docs/runtime/hot) [Module resolution](https://bun.com/docs/runtime/modules) [Auto-install](https://bun.com/docs/runtime/autoimport) [bunfig.toml](https://bun.com/docs/runtime/bunfig) [Debugger](https://bun.com/docs/runtime/debugger)

Framework APISOON

Package manager

[`bun install`](https://bun.com/docs/cli/install) [`bun add`](https://bun.com/docs/cli/add) [`bun remove`](https://bun.com/docs/cli/remove) [`bun update`](https://bun.com/docs/cli/update) [`bun publish`](https://bun.com/docs/cli/publish) [`bun outdated`](https://bun.com/docs/cli/outdated) [`bun link`](https://bun.com/docs/cli/link) [`bun pm`](https://bun.com/docs/cli/pm) [`bun why`](https://bun.com/docs/cli/why) [Global cache](https://bun.com/docs/install/cache) [Isolated installs](https://bun.com/docs/install/isolated) [Workspaces](https://bun.com/docs/install/workspaces) [Catalogs](https://bun.com/docs/install/catalogs) [Lifecycle scripts](https://bun.com/docs/install/lifecycle) [Filter](https://bun.com/docs/cli/filter) [Lockfile](https://bun.com/docs/install/lockfile) [Scopes and registries](https://bun.com/docs/install/registries) [Overrides and resolutions](https://bun.com/docs/install/overrides) [Patch dependencies](https://bun.com/docs/install/patch) [Audit dependencies](https://bun.com/docs/install/audit) [.npmrc support](https://bun.com/docs/install/npmrc) [Security Scanner API](https://bun.com/docs/install/security-scanner-api)

Bundler

[`Bun.build`](https://bun.com/docs/bundler) [HTML & static sites](https://bun.com/docs/bundler/html) [CSS](https://bun.com/docs/bundler/css) [Fullstack Dev Server](https://bun.com/docs/bundler/fullstack) [Hot reloading](https://bun.com/docs/bundler/hmr) [Loaders](https://bun.com/docs/bundler/loaders) [Plugins](https://bun.com/docs/bundler/plugins) [Macros](https://bun.com/docs/bundler/macros) [vs esbuild](https://bun.com/docs/bundler/vs-esbuild)

Test runner

[`bun test`](https://bun.com/docs/cli/test) [Writing tests](https://bun.com/docs/test/writing) [Watch mode](https://bun.com/docs/test/hot) [Lifecycle hooks](https://bun.com/docs/test/lifecycle) [Mocks](https://bun.com/docs/test/mocks) [Snapshots](https://bun.com/docs/test/snapshots) [Dates and times](https://bun.com/docs/test/time) [Code coverage](https://bun.com/docs/test/coverage) [Test reporters](https://bun.com/docs/test/reporters) [Test configuration](https://bun.com/docs/test/configuration) [Runtime behavior](https://bun.com/docs/test/runtime-behavior) [Finding tests](https://bun.com/docs/test/discovery) [DOM testing](https://bun.com/docs/test/dom)

Package runner

[`bunx`](https://bun.com/docs/cli/bunx)

API

[HTTP server](https://bun.com/docs/api/http) [HTTP client](https://bun.com/docs/api/fetch) [WebSockets](https://bun.com/docs/api/websockets) [Workers](https://bun.com/docs/api/workers) [Binary data](https://bun.com/docs/api/binary-data) [Streams](https://bun.com/docs/api/streams) [SQL](https://bun.com/docs/api/sql) [S3 Object Storage](https://bun.com/docs/api/s3) [File I/O](https://bun.com/docs/api/file-io) [Redis client](https://bun.com/docs/api/redis)

[Getting Started](https://bun.com/docs/api/redis#getting-started) [Connection Lifecycle](https://bun.com/docs/api/redis#connection-lifecycle) [Basic Operations](https://bun.com/docs/api/redis#basic-operations) [String Operations](https://bun.com/docs/api/redis#string-operations) [Numeric Operations](https://bun.com/docs/api/redis#numeric-operations) [Hash Operations](https://bun.com/docs/api/redis#hash-operations) [Set Operations](https://bun.com/docs/api/redis#set-operations) [Advanced Usage](https://bun.com/docs/api/redis#advanced-usage) [Command Execution and Pipelining](https://bun.com/docs/api/redis#command-execution-and-pipelining) [Raw Commands](https://bun.com/docs/api/redis#raw-commands) [Connection Events](https://bun.com/docs/api/redis#connection-events) [Connection Status and Monitoring](https://bun.com/docs/api/redis#connection-status-and-monitoring) [Type Conversion](https://bun.com/docs/api/redis#type-conversion) [Connection Options](https://bun.com/docs/api/redis#connection-options) [Reconnection Behavior](https://bun.com/docs/api/redis#reconnection-behavior) [Supported URL Formats](https://bun.com/docs/api/redis#supported-url-formats) [Error Handling](https://bun.com/docs/api/redis#error-handling) [Example Use Cases](https://bun.com/docs/api/redis#example-use-cases) [Caching](https://bun.com/docs/api/redis#caching) [Rate Limiting](https://bun.com/docs/api/redis#rate-limiting) [Session Storage](https://bun.com/docs/api/redis#session-storage) [Implementation Notes](https://bun.com/docs/api/redis#implementation-notes) [RESP3 Protocol Support](https://bun.com/docs/api/redis#resp3-protocol-support) [Limitations and Future Plans](https://bun.com/docs/api/redis#limitations-and-future-plans)

[import.meta](https://bun.com/docs/api/import-meta) [SQLite](https://bun.com/docs/api/sqlite) [FileSystemRouter](https://bun.com/docs/api/file-system-router) [TCP sockets](https://bun.com/docs/api/tcp) [UDP sockets](https://bun.com/docs/api/udp) [Globals](https://bun.com/docs/api/globals) [$ Shell](https://bun.com/docs/runtime/shell) [Child processes](https://bun.com/docs/api/spawn) [YAML](https://bun.com/docs/api/yaml) [HTMLRewriter](https://bun.com/docs/api/html-rewriter) [Hashing](https://bun.com/docs/api/hashing) [Console](https://bun.com/docs/api/console) [Cookie](https://bun.com/docs/api/cookie) [FFI](https://bun.com/docs/api/ffi) [C Compiler](https://bun.com/docs/api/cc) [Secrets](https://bun.com/docs/api/secrets) [Testing](https://bun.com/docs/cli/test) [Utils](https://bun.com/docs/api/utils) [Node-API](https://bun.com/docs/api/node-api) [Glob](https://bun.com/docs/api/glob) [DNS](https://bun.com/docs/api/dns) [Semver](https://bun.com/docs/api/semver) [Color](https://bun.com/docs/api/color) [Transpiler](https://bun.com/docs/api/transpiler)

Project

[Roadmap](https://bun.com/docs/project/roadmap) [Benchmarking](https://bun.com/docs/project/benchmarking) [Contributing](https://bun.com/docs/project/contributing) [Building Windows](https://bun.com/docs/project/building-windows) [Bindgen](https://bun.com/docs/project/bindgen) [License](https://bun.com/docs/project/licensing)

Bun provides native bindings for working with Redis databases with a modern, Promise-based API. The interface is designed to be simple and performant, with built-in connection management, fully typed responses, and TLS support. **New in Bun v1.2.9**

```
import { redis } from "bun";

// Set a key
await redis.set("greeting", "Hello from Bun!");

// Get a key
const greeting = await redis.get("greeting");
console.log(greeting); // "Hello from Bun!"

// Increment a counter
await redis.set("counter", 0);
await redis.incr("counter");

// Check if a key exists
const exists = await redis.exists("greeting");

// Delete a key
await redis.del("greeting");

```

## [Getting Started](https://bun.com/docs/api/redis\#getting-started)

To use the Redis client, you first need to create a connection:

```
import { redis, RedisClient } from "bun";

// Using the default client (reads connection info from environment)
// process.env.REDIS_URL is used by default
await redis.set("hello", "world");
const result = await redis.get("hello");

// Creating a custom client
const client = new RedisClient("redis://username:password@localhost:6379");
await client.set("counter", "0");
await client.incr("counter");

```

By default, the client reads connection information from the following environment variables (in order of precedence):

- `REDIS_URL`
- If not set, defaults to `"redis://localhost:6379"`

### [Connection Lifecycle](https://bun.com/docs/api/redis\#connection-lifecycle)

The Redis client automatically handles connections in the background:

```
// No connection is made until a command is executed
const client = new RedisClient();

// First command initiates the connection
await client.set("key", "value");

// Connection remains open for subsequent commands
await client.get("key");

// Explicitly close the connection when done
client.close();

```

You can also manually control the connection lifecycle:

```
const client = new RedisClient();

// Explicitly connect
await client.connect();

// Run commands
await client.set("key", "value");

// Disconnect when done
client.close();

```

## [Basic Operations](https://bun.com/docs/api/redis\#basic-operations)

### [String Operations](https://bun.com/docs/api/redis\#string-operations)

```
// Set a key
await redis.set("user:1:name", "Alice");

// Get a key
const name = await redis.get("user:1:name");

// Delete a key
await redis.del("user:1:name");

// Check if a key exists
const exists = await redis.exists("user:1:name");

// Set expiration (in seconds)
await redis.set("session:123", "active");
await redis.expire("session:123", 3600); // expires in 1 hour

// Get time to live (in seconds)
const ttl = await redis.ttl("session:123");

```

### [Numeric Operations](https://bun.com/docs/api/redis\#numeric-operations)

```
// Set initial value
await redis.set("counter", "0");

// Increment by 1
await redis.incr("counter");

// Decrement by 1
await redis.decr("counter");

```

### [Hash Operations](https://bun.com/docs/api/redis\#hash-operations)

```
// Set multiple fields in a hash
await redis.hmset("user:123", [\
  "name",\
  "Alice",\
  "email",\
  "alice@example.com",\
  "active",\
  "true",\
]);

// Get multiple fields from a hash
const userFields = await redis.hmget("user:123", ["name", "email"]);
console.log(userFields); // ["Alice", "alice@example.com"]

// Increment a numeric field in a hash
await redis.hincrby("user:123", "visits", 1);

// Increment a float field in a hash
await redis.hincrbyfloat("user:123", "score", 1.5);

```

### [Set Operations](https://bun.com/docs/api/redis\#set-operations)

```
// Add member to set
await redis.sadd("tags", "javascript");

// Remove member from set
await redis.srem("tags", "javascript");

// Check if member exists in set
const isMember = await redis.sismember("tags", "javascript");

// Get all members of a set
const allTags = await redis.smembers("tags");

// Get a random member
const randomTag = await redis.srandmember("tags");

// Pop (remove and return) a random member
const poppedTag = await redis.spop("tags");

```

## [Advanced Usage](https://bun.com/docs/api/redis\#advanced-usage)

### [Command Execution and Pipelining](https://bun.com/docs/api/redis\#command-execution-and-pipelining)

The client automatically pipelines commands, improving performance by sending multiple commands in a batch and processing responses as they arrive.

```
// Commands are automatically pipelined by default
const [infoResult, listResult] = await Promise.all([\
  redis.get("user:1:name"),\
  redis.get("user:2:email"),\
]);

```

To disable automatic pipelining, you can set the `enableAutoPipelining` option to `false`:

```
const client = new RedisClient("redis://localhost:6379", {
  enableAutoPipelining: false,
});

```

### [Raw Commands](https://bun.com/docs/api/redis\#raw-commands)

When you need to use commands that don't have convenience methods, you can use the `send` method:

```
// Run any Redis command
const info = await redis.send("INFO", []);

// LPUSH to a list
await redis.send("LPUSH", ["mylist", "value1", "value2"]);

// Get list range
const list = await redis.send("LRANGE", ["mylist", "0", "-1"]);

```

The `send` method allows you to use any Redis command, even ones that don't have dedicated methods in the client. The first argument is the command name, and the second argument is an array of string arguments.

### [Connection Events](https://bun.com/docs/api/redis\#connection-events)

You can register handlers for connection events:

```
const client = new RedisClient();

// Called when successfully connected to Redis server
client.onconnect = () => {
  console.log("Connected to Redis server");
};

// Called when disconnected from Redis server
client.onclose = error => {
  console.error("Disconnected from Redis server:", error);
};

// Manually connect/disconnect
await client.connect();
client.close();

```

### [Connection Status and Monitoring](https://bun.com/docs/api/redis\#connection-status-and-monitoring)

```
// Check if connected
console.log(client.connected); // boolean indicating connection status

// Check amount of data buffered (in bytes)
console.log(client.bufferedAmount);

```

### [Type Conversion](https://bun.com/docs/api/redis\#type-conversion)

The Redis client handles automatic type conversion for Redis responses:

- Integer responses are returned as JavaScript numbers
- Bulk strings are returned as JavaScript strings
- Simple strings are returned as JavaScript strings
- Null bulk strings are returned as `null`
- Array responses are returned as JavaScript arrays
- Error responses throw JavaScript errors with appropriate error codes
- Boolean responses (RESP3) are returned as JavaScript booleans
- Map responses (RESP3) are returned as JavaScript objects
- Set responses (RESP3) are returned as JavaScript arrays

Special handling for specific commands:

- `EXISTS` returns a boolean instead of a number (1 becomes true, 0 becomes false)
- `SISMEMBER` returns a boolean (1 becomes true, 0 becomes false)

The following commands disable automatic pipelining:

- `AUTH`
- `INFO`
- `QUIT`
- `EXEC`
- `MULTI`
- `WATCH`
- `SCRIPT`
- `SELECT`
- `CLUSTER`
- `DISCARD`
- `UNWATCH`
- `PIPELINE`
- `SUBSCRIBE`
- `UNSUBSCRIBE`
- `UNPSUBSCRIBE`

## [Connection Options](https://bun.com/docs/api/redis\#connection-options)

When creating a client, you can pass various options to configure the connection:

```
const client = new RedisClient("redis://localhost:6379", {
  // Connection timeout in milliseconds (default: 10000)
  connectionTimeout: 5000,

  // Idle timeout in milliseconds (default: 0 = no timeout)
  idleTimeout: 30000,

  // Whether to automatically reconnect on disconnection (default: true)
  autoReconnect: true,

  // Maximum number of reconnection attempts (default: 10)
  maxRetries: 10,

  // Whether to queue commands when disconnected (default: true)
  enableOfflineQueue: true,

  // Whether to automatically pipeline commands (default: true)
  enableAutoPipelining: true,

  // TLS options (default: false)
  tls: true,
  // Alternatively, provide custom TLS config:
  // tls: {
  //   rejectUnauthorized: true,
  //   ca: "path/to/ca.pem",
  //   cert: "path/to/cert.pem",
  //   key: "path/to/key.pem",
  // }
});

```

### [Reconnection Behavior](https://bun.com/docs/api/redis\#reconnection-behavior)

When a connection is lost, the client automatically attempts to reconnect with exponential backoff:

1. The client starts with a small delay (50ms) and doubles it with each attempt
2. Reconnection delay is capped at 2000ms (2 seconds)
3. The client attempts to reconnect up to `maxRetries` times (default: 10)
4. Commands executed during disconnection are:
   - Queued if `enableOfflineQueue` is true (default)
   - Rejected immediately if `enableOfflineQueue` is false

## [Supported URL Formats](https://bun.com/docs/api/redis\#supported-url-formats)

The Redis client supports various URL formats:

```
// Standard Redis URL
new RedisClient("redis://localhost:6379");
new RedisClient("redis://localhost:6379");

// With authentication
new RedisClient("redis://username:password@localhost:6379");

// With database number
new RedisClient("redis://localhost:6379/0");

// TLS connections
new RedisClient("rediss://localhost:6379");
new RedisClient("rediss://localhost:6379");
new RedisClient("redis+tls://localhost:6379");
new RedisClient("redis+tls://localhost:6379");

// Unix socket connections
new RedisClient("redis+unix:///path/to/socket");
new RedisClient("redis+unix:///path/to/socket");

// TLS over Unix socket
new RedisClient("redis+tls+unix:///path/to/socket");
new RedisClient("redis+tls+unix:///path/to/socket");

```

## [Error Handling](https://bun.com/docs/api/redis\#error-handling)

The Redis client throws typed errors for different scenarios:

```
try {
  await redis.get("non-existent-key");
} catch (error) {
  if (error.code === "ERR_REDIS_CONNECTION_CLOSED") {
    console.error("Connection to Redis server was closed");
  } else if (error.code === "ERR_REDIS_AUTHENTICATION_FAILED") {
    console.error("Authentication failed");
  } else {
    console.error("Unexpected error:", error);
  }
}

```

Common error codes:

- `ERR_REDIS_CONNECTION_CLOSED` \- Connection to the server was closed
- `ERR_REDIS_AUTHENTICATION_FAILED` \- Failed to authenticate with the server
- `ERR_REDIS_INVALID_RESPONSE` \- Received an invalid response from the server

## [Example Use Cases](https://bun.com/docs/api/redis\#example-use-cases)

### [Caching](https://bun.com/docs/api/redis\#caching)

```
async function getUserWithCache(userId) {
  const cacheKey = `user:${userId}`;

  // Try to get from cache first
  const cachedUser = await redis.get(cacheKey);
  if (cachedUser) {
    return JSON.parse(cachedUser);
  }

  // Not in cache, fetch from database
  const user = await database.getUser(userId);

  // Store in cache for 1 hour
  await redis.set(cacheKey, JSON.stringify(user));
  await redis.expire(cacheKey, 3600);

  return user;
}

```

### [Rate Limiting](https://bun.com/docs/api/redis\#rate-limiting)

```
async function rateLimit(ip, limit = 100, windowSecs = 3600) {
  const key = `ratelimit:${ip}`;

  // Increment counter
  const count = await redis.incr(key);

  // Set expiry if this is the first request in window
  if (count === 1) {
    await redis.expire(key, windowSecs);
  }

  // Check if limit exceeded
  return {
    limited: count > limit,
    remaining: Math.max(0, limit - count),
  };
}

```

### [Session Storage](https://bun.com/docs/api/redis\#session-storage)

```
async function createSession(userId, data) {
  const sessionId = crypto.randomUUID();
  const key = `session:${sessionId}`;

  // Store session with expiration
  await redis.hmset(key, [\
    "userId",\
    userId.toString(),\
    "created",\
    Date.now().toString(),\
    "data",\
    JSON.stringify(data),\
  ]);
  await redis.expire(key, 86400); // 24 hours

  return sessionId;
}

async function getSession(sessionId) {
  const key = `session:${sessionId}`;

  // Get session data
  const exists = await redis.exists(key);
  if (!exists) return null;

  const [userId, created, data] = await redis.hmget(key, [\
    "userId",\
    "created",\
    "data",\
  ]);

  return {
    userId: Number(userId),
    created: Number(created),
    data: JSON.parse(data),
  };
}

```

## [Implementation Notes](https://bun.com/docs/api/redis\#implementation-notes)

Bun's Redis client is implemented in Zig and uses the Redis Serialization Protocol (RESP3). It manages connections efficiently and provides automatic reconnection with exponential backoff.

The client supports pipelining commands, meaning multiple commands can be sent without waiting for the replies to previous commands. This significantly improves performance when sending multiple commands in succession.

### [RESP3 Protocol Support](https://bun.com/docs/api/redis\#resp3-protocol-support)

Bun's Redis client uses the newer RESP3 protocol by default, which provides more data types and features compared to RESP2:

- Better error handling with typed errors
- Native Boolean responses
- Map/Dictionary responses (key-value objects)
- Set responses
- Double (floating point) values
- BigNumber support for large integer values

When connecting to Redis servers using older versions that don't support RESP3, the client automatically fallbacks to compatible modes.

## [Limitations and Future Plans](https://bun.com/docs/api/redis\#limitations-and-future-plans)

Current limitations of the Redis client we are planning to address in future versions:

No dedicated API for pub/sub functionality (though you can use the raw command API)

Transactions (MULTI/EXEC) must be done through raw commands for now

Streams are supported but without dedicated methods

Unsupported features:

- Redis Sentinel
- Redis Cluster

[Previous\\
\\
File I/O](https://bun.com/docs/api/file-io) [Next\\
\\
import.meta](https://bun.com/docs/api/import-meta)

[![GitHub logo](<Base64-Image-Removed>)![GitHub logo](<Base64-Image-Removed>)\\
\\
Edit on GitHub](https://github.com/oven-sh/bun/edit/main/docs/api/redis.md)

Powered by

[![inkeep search icon](https://uploads-ssl.webflow.com/63fd919a913cf54ca2d02cda/642ea6563549ced1bb379fea_inkeep-icon-medium-gray.svg)inkeep](https://www.inkeep.com/)

![ai chat avatar](https://bun.com/logo_avatar.svg)

Hi!

I'm an AI assistant trained on documentation, GitHub issues, and other content.

Ask me anything about `Bun`.

### Popular Questions

Can I use Bun with my existing Node.js project?

How is Bun faster than Node.js? How can I benchmark it?

Do I still need a bundler or TypeScript compiler?

* * *

Powered by

[![inkeep search icon](https://uploads-ssl.webflow.com/63fd919a913cf54ca2d02cda/642ea6563549ced1bb379fea_inkeep-icon-medium-gray.svg)inkeep](https://www.inkeep.com/)

Get help

[Discord](https://bun.com/discord)

[Migration help for organizations](https://t.co/0CA0Neqgts)