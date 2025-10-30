---
title: DNS – API | Bun Docs
url: 
description: Resolve domain names to IP addresses.
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

[HTTP server](https://bun.com/docs/api/http) [HTTP client](https://bun.com/docs/api/fetch) [WebSockets](https://bun.com/docs/api/websockets) [Workers](https://bun.com/docs/api/workers) [Binary data](https://bun.com/docs/api/binary-data) [Streams](https://bun.com/docs/api/streams) [SQL](https://bun.com/docs/api/sql) [S3 Object Storage](https://bun.com/docs/api/s3) [File I/O](https://bun.com/docs/api/file-io) [Redis client](https://bun.com/docs/api/redis) [import.meta](https://bun.com/docs/api/import-meta) [SQLite](https://bun.com/docs/api/sqlite) [FileSystemRouter](https://bun.com/docs/api/file-system-router) [TCP sockets](https://bun.com/docs/api/tcp) [UDP sockets](https://bun.com/docs/api/udp) [Globals](https://bun.com/docs/api/globals) [$ Shell](https://bun.com/docs/runtime/shell) [Child processes](https://bun.com/docs/api/spawn) [YAML](https://bun.com/docs/api/yaml) [HTMLRewriter](https://bun.com/docs/api/html-rewriter) [Hashing](https://bun.com/docs/api/hashing) [Console](https://bun.com/docs/api/console) [Cookie](https://bun.com/docs/api/cookie) [FFI](https://bun.com/docs/api/ffi) [C Compiler](https://bun.com/docs/api/cc) [Secrets](https://bun.com/docs/api/secrets) [Testing](https://bun.com/docs/cli/test) [Utils](https://bun.com/docs/api/utils) [Node-API](https://bun.com/docs/api/node-api) [Glob](https://bun.com/docs/api/glob) [DNS](https://bun.com/docs/api/dns)

[DNS caching in Bun](https://bun.com/docs/api/dns#dns-caching-in-bun) [When should I prefetch a DNS entry?](https://bun.com/docs/api/dns#when-should-i-prefetch-a-dns-entry) [`dns.prefetch`](https://bun.com/docs/api/dns#dns-prefetch) [`dns.getCacheStats()`](https://bun.com/docs/api/dns#dns-getcachestats) [Configuring DNS cache TTL](https://bun.com/docs/api/dns#configuring-dns-cache-ttl)

[Semver](https://bun.com/docs/api/semver) [Color](https://bun.com/docs/api/color) [Transpiler](https://bun.com/docs/api/transpiler)

Project

[Roadmap](https://bun.com/docs/project/roadmap) [Benchmarking](https://bun.com/docs/project/benchmarking) [Contributing](https://bun.com/docs/project/contributing) [Building Windows](https://bun.com/docs/project/building-windows) [Bindgen](https://bun.com/docs/project/bindgen) [License](https://bun.com/docs/project/licensing)

Bun implements the `node:dns` module.

```
import * as dns from "node:dns";

const addrs = await dns.promises.resolve4("bun.com", { ttl: true });
console.log(addrs);
// => [{ address: "172.67.161.226", family: 4, ttl: 0 }, ...]

```

## [DNS caching in Bun](https://bun.com/docs/api/dns\#dns-caching-in-bun)

In Bun v1.1.9, we added support for DNS caching. This cache makes repeated connections to the same hosts faster.

At the time of writing, we cache up to 255 entries for a maximum of 30 seconds (each). If any connections to a host fail, we remove the entry from the cache. When multiple connections are made to the same host simultaneously, DNS lookups are deduplicated to avoid making multiple requests for the same host.

This cache is automatically used by:

- `bun install`
- `fetch()`
- `node:http` (client)
- `Bun.connect`
- `node:net`
- `node:tls`

### [When should I prefetch a DNS entry?](https://bun.com/docs/api/dns\#when-should-i-prefetch-a-dns-entry)

Web browsers expose [`<link rel="dns-prefetch">`](https://developer.mozilla.org/en-US/docs/Web/Performance/dns-prefetch) to allow developers to prefetch DNS entries. This is useful when you know you'll need to connect to a host in the near future and want to avoid the initial DNS lookup.

In Bun, you can use the `dns.prefetch` API to achieve the same effect.

```
import { dns } from "bun";

dns.prefetch("my.database-host.com", 5432);

```

An example where you might want to use this is a database driver. When your application first starts up, you can prefetch the DNS entry for the database host so that by the time it finishes loading everything, the DNS query to resolve the database host may already be completed.

### [`dns.prefetch`](https://bun.com/docs/api/dns\#dns-prefetch)

**🚧** — This API is experimental and may change in the future.

To prefetch a DNS entry, you can use the `dns.prefetch` API. This API is useful when you know you'll need to connect to a host soon and want to avoid the initial DNS lookup.

```
dns.prefetch(hostname: string, port: number): void;

```

Here's an example:

```
import { dns } from "bun";

dns.prefetch("bun.com", 443);
//
// ... sometime later ...
await fetch("https://bun.com");

```

### [`dns.getCacheStats()`](https://bun.com/docs/api/dns\#dns-getcachestats)

**🚧** — This API is experimental and may change in the future.

To get the current cache stats, you can use the `dns.getCacheStats` API.

This API returns an object with the following properties:

```
{
  // Cache hits
  cacheHitsCompleted: number;
  cacheHitsInflight: number;
  cacheMisses: number;
  // Number of items in the DNS cache
  size: number;

  // Number of times a connection failed
  errors: number;

  // Number of times a connection was requested at all (including cache hits and misses)
  totalCount: number;
}

```

Example:

```
import { dns } from "bun";

const stats = dns.getCacheStats();
console.log(stats);
// => { cacheHitsCompleted: 0, cacheHitsInflight: 0, cacheMisses: 0, size: 0, errors: 0, totalCount: 0 }

```

### [Configuring DNS cache TTL](https://bun.com/docs/api/dns\#configuring-dns-cache-ttl)

Bun defaults to 30 seconds for the TTL of DNS cache entries. To change this, you can set the environment variable `$BUN_CONFIG_DNS_TIME_TO_LIVE_SECONDS`. For example, to set the TTL to 5 seconds:

```
BUN_CONFIG_DNS_TIME_TO_LIVE_SECONDS=5 bun run my-script.ts

```

#### Why is 30 seconds the default?

Unfortunately, the system API underneath ( `getaddrinfo`) does not provide a way to get the TTL of a DNS entry. This means we have to pick a number arbitrarily. We chose 30 seconds because it's long enough to see the benefits of caching, and short enough to be unlikely to cause issues if a DNS entry changes. [Amazon Web Services recommends 5 seconds](https://docs.aws.amazon.com/sdk-for-java/v1/developer-guide/jvm-ttl-dns.html) for the Java Virtual Machine, however the JVM defaults to cache indefinitely.

[Previous\\
\\
Glob](https://bun.com/docs/api/glob) [Next\\
\\
Semver](https://bun.com/docs/api/semver)

[![GitHub logo](<Base64-Image-Removed>)![GitHub logo](<Base64-Image-Removed>)\\
\\
Edit on GitHub](https://github.com/oven-sh/bun/edit/main/docs/api/dns.md)

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