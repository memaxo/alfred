---
title: HTTP client – API | Bun Docs
url: 
description: Bun implements Web-standard fetch with some Bun-native extensions.
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

[HTTP server](https://bun.com/docs/api/http) [HTTP client](https://bun.com/docs/api/fetch)

[Sending an HTTP request](https://bun.com/docs/api/fetch#sending-an-http-request) [Sending a POST request](https://bun.com/docs/api/fetch#sending-a-post-request) [Proxying requests](https://bun.com/docs/api/fetch#proxying-requests) [Custom headers](https://bun.com/docs/api/fetch#custom-headers) [Response bodies](https://bun.com/docs/api/fetch#response-bodies) [Streaming request bodies](https://bun.com/docs/api/fetch#streaming-request-bodies) [Fetching a URL with a timeout](https://bun.com/docs/api/fetch#fetching-a-url-with-a-timeout) [Unix domain sockets](https://bun.com/docs/api/fetch#unix-domain-sockets) [TLS](https://bun.com/docs/api/fetch#tls) [Request options](https://bun.com/docs/api/fetch#request-options) [Protocol support](https://bun.com/docs/api/fetch#protocol-support) [Error handling](https://bun.com/docs/api/fetch#error-handling) [Content-Type handling](https://bun.com/docs/api/fetch#content-type-handling) [Debugging](https://bun.com/docs/api/fetch#debugging) [Performance](https://bun.com/docs/api/fetch#performance) [DNS prefetching](https://bun.com/docs/api/fetch#dns-prefetching) [Preconnect to a host](https://bun.com/docs/api/fetch#preconnect-to-a-host) [Connection pooling & HTTP keep-alive](https://bun.com/docs/api/fetch#connection-pooling-http-keep-alive) [Response buffering](https://bun.com/docs/api/fetch#response-buffering) [Implementation details](https://bun.com/docs/api/fetch#implementation-details)

[WebSockets](https://bun.com/docs/api/websockets) [Workers](https://bun.com/docs/api/workers) [Binary data](https://bun.com/docs/api/binary-data) [Streams](https://bun.com/docs/api/streams) [SQL](https://bun.com/docs/api/sql) [S3 Object Storage](https://bun.com/docs/api/s3) [File I/O](https://bun.com/docs/api/file-io) [Redis client](https://bun.com/docs/api/redis) [import.meta](https://bun.com/docs/api/import-meta) [SQLite](https://bun.com/docs/api/sqlite) [FileSystemRouter](https://bun.com/docs/api/file-system-router) [TCP sockets](https://bun.com/docs/api/tcp) [UDP sockets](https://bun.com/docs/api/udp) [Globals](https://bun.com/docs/api/globals) [$ Shell](https://bun.com/docs/runtime/shell) [Child processes](https://bun.com/docs/api/spawn) [YAML](https://bun.com/docs/api/yaml) [HTMLRewriter](https://bun.com/docs/api/html-rewriter) [Hashing](https://bun.com/docs/api/hashing) [Console](https://bun.com/docs/api/console) [Cookie](https://bun.com/docs/api/cookie) [FFI](https://bun.com/docs/api/ffi) [C Compiler](https://bun.com/docs/api/cc) [Secrets](https://bun.com/docs/api/secrets) [Testing](https://bun.com/docs/cli/test) [Utils](https://bun.com/docs/api/utils) [Node-API](https://bun.com/docs/api/node-api) [Glob](https://bun.com/docs/api/glob) [DNS](https://bun.com/docs/api/dns) [Semver](https://bun.com/docs/api/semver) [Color](https://bun.com/docs/api/color) [Transpiler](https://bun.com/docs/api/transpiler)

Project

[Roadmap](https://bun.com/docs/project/roadmap) [Benchmarking](https://bun.com/docs/project/benchmarking) [Contributing](https://bun.com/docs/project/contributing) [Building Windows](https://bun.com/docs/project/building-windows) [Bindgen](https://bun.com/docs/project/bindgen) [License](https://bun.com/docs/project/licensing)

Bun implements the WHATWG `fetch` standard, with some extensions to meet the needs of server-side JavaScript.

Bun also implements `node:http`, but `fetch` is generally recommended instead.

## [Sending an HTTP request](https://bun.com/docs/api/fetch\#sending-an-http-request)

To send an HTTP request, use `fetch`

```
const response = await fetch("http://example.com");

console.log(response.status); // => 200

const text = await response.text(); // or response.json(), response.formData(), etc.

```

`fetch` also works with HTTPS URLs.

```
const response = await fetch("https://example.com");

```

You can also pass `fetch` a [`Request`](https://developer.mozilla.org/en-US/docs/Web/API/Request) object.

```
const request = new Request("http://example.com", {
  method: "POST",
  body: "Hello, world!",
});

const response = await fetch(request);

```

### [Sending a POST request](https://bun.com/docs/api/fetch\#sending-a-post-request)

To send a POST request, pass an object with the `method` property set to `"POST"`.

```
const response = await fetch("http://example.com", {
  method: "POST",
  body: "Hello, world!",
});

```

`body` can be a string, a `FormData` object, an `ArrayBuffer`, a `Blob`, and more. See the [MDN documentation](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch#setting_a_body) for more information.

### [Proxying requests](https://bun.com/docs/api/fetch\#proxying-requests)

To proxy a request, pass an object with the `proxy` property set to a URL.

```
const response = await fetch("http://example.com", {
  proxy: "http://proxy.com",
});

```

### [Custom headers](https://bun.com/docs/api/fetch\#custom-headers)

To set custom headers, pass an object with the `headers` property set to an object.

```
const response = await fetch("http://example.com", {
  headers: {
    "X-Custom-Header": "value",
  },
});

```

You can also set headers using the [Headers](https://developer.mozilla.org/en-US/docs/Web/API/Headers) object.

```
const headers = new Headers();
headers.append("X-Custom-Header", "value");

const response = await fetch("http://example.com", {
  headers,
});

```

### [Response bodies](https://bun.com/docs/api/fetch\#response-bodies)

To read the response body, use one of the following methods:

- `response.text(): Promise<string>`: Returns a promise that resolves with the response body as a string.
- `response.json(): Promise<any>`: Returns a promise that resolves with the response body as a JSON object.
- `response.formData(): Promise<FormData>`: Returns a promise that resolves with the response body as a `FormData` object.
- `response.bytes(): Promise<Uint8Array>`: Returns a promise that resolves with the response body as a `Uint8Array`.
- `response.arrayBuffer(): Promise<ArrayBuffer>`: Returns a promise that resolves with the response body as an `ArrayBuffer`.
- `response.blob(): Promise<Blob>`: Returns a promise that resolves with the response body as a `Blob`.

#### Streaming response bodies

You can use async iterators to stream the response body.

```
const response = await fetch("http://example.com");

for await (const chunk of response.body) {
  console.log(chunk);
}

```

You can also more directly access the `ReadableStream` object.

```
const response = await fetch("http://example.com");

const stream = response.body;

const reader = stream.getReader();
const { value, done } = await reader.read();

```

### [Streaming request bodies](https://bun.com/docs/api/fetch\#streaming-request-bodies)

You can also stream data in request bodies using a `ReadableStream`:

```
const stream = new ReadableStream({
  start(controller) {
    controller.enqueue("Hello");
    controller.enqueue(" ");
    controller.enqueue("World");
    controller.close();
  },
});

const response = await fetch("http://example.com", {
  method: "POST",
  body: stream,
});

```

When using streams with HTTP(S):

- The data is streamed directly to the network without buffering the entire body in memory
- If the connection is lost, the stream will be canceled
- The `Content-Length` header is not automatically set unless the stream has a known size

When using streams with S3:

- For PUT/POST requests, Bun automatically uses multipart upload
- The stream is consumed in chunks and uploaded in parallel
- Progress can be monitored through the S3 options

### [Fetching a URL with a timeout](https://bun.com/docs/api/fetch\#fetching-a-url-with-a-timeout)

To fetch a URL with a timeout, use `AbortSignal.timeout`:

```
const response = await fetch("http://example.com", {
  signal: AbortSignal.timeout(1000),
});

```

#### Canceling a request

To cancel a request, use an `AbortController`:

```
const controller = new AbortController();

const response = await fetch("http://example.com", {
  signal: controller.signal,
});

controller.abort();

```

### [Unix domain sockets](https://bun.com/docs/api/fetch\#unix-domain-sockets)

To fetch a URL using a Unix domain socket, use the `unix: string` option:

```
const response = await fetch("https://hostname/a/path", {
  unix: "/var/run/path/to/unix.sock",
  method: "POST",
  body: JSON.stringify({ message: "Hello from Bun!" }),
  headers: {
    "Content-Type": "application/json",
  },
});

```

### [TLS](https://bun.com/docs/api/fetch\#tls)

To use a client certificate, use the `tls` option:

```
await fetch("https://example.com", {
  tls: {
    key: Bun.file("/path/to/key.pem"),
    cert: Bun.file("/path/to/cert.pem"),
    // ca: [Bun.file("/path/to/ca.pem")],
  },
});

```

#### Custom TLS Validation

To customize the TLS validation, use the `checkServerIdentity` option in `tls`

```
await fetch("https://example.com", {
  tls: {
    checkServerIdentity: (hostname, peerCertificate) => {
      // Return an Error if the certificate is invalid
    },
  },
});

```

This is similar to how it works in Node's `net` module.

#### Disable TLS validation

To disable TLS validation, set `rejectUnauthorized` to `false`:

```
await fetch("https://example.com", {
  tls: {
    rejectUnauthorized: false,
  },
});

```

This is especially useful to avoid SSL errors when using self-signed certificates, but this disables TLS validation and should be used with caution.

### [Request options](https://bun.com/docs/api/fetch\#request-options)

In addition to the standard fetch options, Bun provides several extensions:

```
const response = await fetch("http://example.com", {
  // Control automatic response decompression (default: true)
  decompress: true,

  // Disable connection reuse for this request
  keepalive: false,

  // Debug logging level
  verbose: true, // or "curl" for more detailed output
});

```

### [Protocol support](https://bun.com/docs/api/fetch\#protocol-support)

Beyond HTTP(S), Bun's fetch supports several additional protocols:

#### S3 URLs - `s3://`

Bun supports fetching from S3 buckets directly.

```
// Using environment variables for credentials
const response = await fetch("s3://my-bucket/path/to/object");

// Or passing credentials explicitly
const response = await fetch("s3://my-bucket/path/to/object", {
  s3: {
    accessKeyId: "YOUR_ACCESS_KEY",
    secretAccessKey: "YOUR_SECRET_KEY",
    region: "us-east-1",
  },
});

```

Note: Only PUT and POST methods support request bodies when using S3. For uploads, Bun automatically uses multipart upload for streaming bodies.

You can read more about Bun's S3 support in the [S3](https://bun.com/docs/api/s3) documentation.

#### File URLs - `file://`

You can fetch local files using the `file:` protocol:

```
const response = await fetch("file:///path/to/file.txt");
const text = await response.text();

```

On Windows, paths are automatically normalized:

```
// Both work on Windows
const response = await fetch("file:///C:/path/to/file.txt");
const response2 = await fetch("file:///c:/path\\to/file.txt");

```

#### Data URLs - `data:`

Bun supports the `data:` URL scheme:

```
const response = await fetch("data:text/plain;base64,SGVsbG8sIFdvcmxkIQ==");
const text = await response.text(); // "Hello, World!"

```

#### Blob URLs - `blob:`

You can fetch blobs using URLs created by `URL.createObjectURL()`:

```
const blob = new Blob(["Hello, World!"], { type: "text/plain" });
const url = URL.createObjectURL(blob);
const response = await fetch(url);

```

### [Error handling](https://bun.com/docs/api/fetch\#error-handling)

Bun's fetch implementation includes several specific error cases:

- Using a request body with GET/HEAD methods will throw an error (which is expected for the fetch API)
- Attempting to use both `proxy` and `unix` options together will throw an error
- TLS certificate validation failures when `rejectUnauthorized` is true (or undefined)
- S3 operations may throw specific errors related to authentication or permissions

### [Content-Type handling](https://bun.com/docs/api/fetch\#content-type-handling)

Bun automatically sets the `Content-Type` header for request bodies when not explicitly provided:

- For `Blob` objects, uses the blob's `type`
- For `FormData`, sets appropriate multipart boundary

## [Debugging](https://bun.com/docs/api/fetch\#debugging)

To help with debugging, you can pass `verbose: true` to `fetch`:

```
const response = await fetch("http://example.com", {
  verbose: true,
});

```

This will print the request and response headers to your terminal:

```
[fetch] > HTTP/1.1 GET http://example.com/
[fetch] > Connection: keep-alive
[fetch] > User-Agent: Bun/1.2.22
[fetch] > Accept: */*
[fetch] > Host: example.com
[fetch] > Accept-Encoding: gzip, deflate, br

[fetch] < 200 OK
[fetch] < Content-Encoding: gzip
[fetch] < Age: 201555
[fetch] < Cache-Control: max-age=604800
[fetch] < Content-Type: text/html; charset=UTF-8
[fetch] < Date: Sun, 21 Jul 2024 02:41:14 GMT
[fetch] < Etag: "3147526947+gzip"
[fetch] < Expires: Sun, 28 Jul 2024 02:41:14 GMT
[fetch] < Last-Modified: Thu, 17 Oct 2019 07:18:26 GMT
[fetch] < Server: ECAcc (sac/254F)
[fetch] < Vary: Accept-Encoding
[fetch] < X-Cache: HIT
[fetch] < Content-Length: 648

```

Note: `verbose: boolean` is not part of the Web standard `fetch` API and is specific to Bun.

## [Performance](https://bun.com/docs/api/fetch\#performance)

Before an HTTP request can be sent, the DNS lookup must be performed. This can take a significant amount of time, especially if the DNS server is slow or the network connection is poor.

After the DNS lookup, the TCP socket must be connected and the TLS handshake might need to be performed. This can also take a significant amount of time.

After the request completes, consuming the response body can also take a significant amount of time and memory.

At every step of the way, Bun provides APIs to help you optimize the performance of your application.

### [DNS prefetching](https://bun.com/docs/api/fetch\#dns-prefetching)

To prefetch a DNS entry, you can use the `dns.prefetch` API. This API is useful when you know you'll need to connect to a host soon and want to avoid the initial DNS lookup.

```
import { dns } from "bun";

dns.prefetch("bun.com");

```

#### DNS caching

By default, Bun caches and deduplicates DNS queries in-memory for up to 30 seconds. You can see the cache stats by calling `dns.getCacheStats()`:

To learn more about DNS caching in Bun, see the [DNS caching](https://bun.com/docs/api/dns) documentation.

### [Preconnect to a host](https://bun.com/docs/api/fetch\#preconnect-to-a-host)

To preconnect to a host, you can use the `fetch.preconnect` API. This API is useful when you know you'll need to connect to a host soon and want to start the initial DNS lookup, TCP socket connection, and TLS handshake early.

```
import { fetch } from "bun";

fetch.preconnect("https://bun.com");

```

Note: calling `fetch` immediately after `fetch.preconnect` will not make your request faster. Preconnecting only helps if you know you'll need to connect to a host soon, but you're not ready to make the request yet.

#### Preconnect at startup

To preconnect to a host at startup, you can pass `--fetch-preconnect`:

```
bun --fetch-preconnect https://bun.com ./my-script.ts
```

This is sort of like `<link rel="preconnect">` in HTML.

This feature is not implemented on Windows yet. If you're interested in using this feature on Windows, please file an issue and we can implement support for it on Windows.

### [Connection pooling & HTTP keep-alive](https://bun.com/docs/api/fetch\#connection-pooling-http-keep-alive)

Bun automatically reuses connections to the same host. This is known as connection pooling. This can significantly reduce the time it takes to establish a connection. You don't need to do anything to enable this; it's automatic.

#### Simultaneous connection limit

By default, Bun limits the maximum number of simultaneous `fetch` requests to 256. We do this for several reasons:

- It improves overall system stability. Operating systems have an upper limit on the number of simultaneous open TCP sockets, usually in the low thousands. Nearing this limit causes your entire computer to behave strangely. Applications hang and crash.
- It encourages HTTP Keep-Alive connection reuse. For short-lived HTTP requests, the slowest step is often the initial connection setup. Reusing connections can save a lot of time.

When the limit is exceeded, the requests are queued and sent as soon as the next request ends.

You can increase the maximum number of simultaneous connections via the `BUN_CONFIG_MAX_HTTP_REQUESTS` environment variable:

```
BUN_CONFIG_MAX_HTTP_REQUESTS=512 bun ./my-script.ts
```

The max value for this limit is currently set to 65,336. The maximum port number is 65,535, so it's quite difficult for any one computer to exceed this limit.

### [Response buffering](https://bun.com/docs/api/fetch\#response-buffering)

Bun goes to great lengths to optimize the performance of reading the response body. The fastest way to read the response body is to use one of these methods:

- `response.text(): Promise<string>`
- `response.json(): Promise<any>`
- `response.formData(): Promise<FormData>`
- `response.bytes(): Promise<Uint8Array>`
- `response.arrayBuffer(): Promise<ArrayBuffer>`
- `response.blob(): Promise<Blob>`

You can also use `Bun.write` to write the response body to a file on disk:

```
import { write } from "bun";

await write("output.txt", response);

```

### [Implementation details](https://bun.com/docs/api/fetch\#implementation-details)

- Connection pooling is enabled by default but can be disabled per-request with `keepalive: false`. The `"Connection: close"` header can also be used to disable keep-alive.
- Large file uploads are optimized using the operating system's `sendfile` syscall under specific conditions:
  - The file must be larger than 32KB
  - The request must not be using a proxy
  - On macOS, only regular files (not pipes, sockets, or devices) can use `sendfile`
  - When these conditions aren't met, or when using S3/streaming uploads, Bun falls back to reading the file into memory
  - This optimization is particularly effective for HTTP (not HTTPS) requests where the file can be sent directly from the kernel to the network stack
- S3 operations automatically handle signing requests and merging authentication headers

Note: Many of these features are Bun-specific extensions to the standard fetch API.

[Previous\\
\\
HTTP server](https://bun.com/docs/api/http) [Next\\
\\
WebSockets](https://bun.com/docs/api/websockets)

[![GitHub logo](<Base64-Image-Removed>)![GitHub logo](<Base64-Image-Removed>)\\
\\
Edit on GitHub](https://github.com/oven-sh/bun/edit/main/docs/api/fetch.md)

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