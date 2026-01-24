---
title: Workers – API | Bun Docs
url:
description: Run code in a separate thread with Bun's native Worker API.
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

[HTTP server](https://bun.com/docs/api/http) [HTTP client](https://bun.com/docs/api/fetch) [WebSockets](https://bun.com/docs/api/websockets) [Workers](https://bun.com/docs/api/workers)

[Creating a `Worker`](https://bun.com/docs/api/workers#creating-a-worker) [From the main thread](https://bun.com/docs/api/workers#from-the-main-thread) [Worker thread](https://bun.com/docs/api/workers#worker-thread) [`preload` \- load modules before the worker starts](https://bun.com/docs/api/workers#preload-load-modules-before-the-worker-starts) [`blob:` URLs](https://bun.com/docs/api/workers#blob-urls) [`"open"`](https://bun.com/docs/api/workers#open) [Messages with `postMessage`](https://bun.com/docs/api/workers#messages-with-postmessage) [Performance optimizations](https://bun.com/docs/api/workers#performance-optimizations) [Terminating a worker](https://bun.com/docs/api/workers#terminating-a-worker) [`process.exit()`](https://bun.com/docs/api/workers#process-exit) [`"close"`](https://bun.com/docs/api/workers#close) [Managing lifetime](https://bun.com/docs/api/workers#managing-lifetime) [`worker.unref()`](https://bun.com/docs/api/workers#worker-unref) [`worker.ref()`](https://bun.com/docs/api/workers#worker-ref) [Memory usage with `smol`](https://bun.com/docs/api/workers#memory-usage-with-smol) [`Bun.isMainThread`](https://bun.com/docs/api/workers#bun-ismainthread)

[Binary data](https://bun.com/docs/api/binary-data) [Streams](https://bun.com/docs/api/streams) [SQL](https://bun.com/docs/api/sql) [S3 Object Storage](https://bun.com/docs/api/s3) [File I/O](https://bun.com/docs/api/file-io) [Redis client](https://bun.com/docs/api/redis) [import.meta](https://bun.com/docs/api/import-meta) [SQLite](https://bun.com/docs/api/sqlite) [FileSystemRouter](https://bun.com/docs/api/file-system-router) [TCP sockets](https://bun.com/docs/api/tcp) [UDP sockets](https://bun.com/docs/api/udp) [Globals](https://bun.com/docs/api/globals) [$ Shell](https://bun.com/docs/runtime/shell) [Child processes](https://bun.com/docs/api/spawn) [YAML](https://bun.com/docs/api/yaml) [HTMLRewriter](https://bun.com/docs/api/html-rewriter) [Hashing](https://bun.com/docs/api/hashing) [Console](https://bun.com/docs/api/console) [Cookie](https://bun.com/docs/api/cookie) [FFI](https://bun.com/docs/api/ffi) [C Compiler](https://bun.com/docs/api/cc) [Secrets](https://bun.com/docs/api/secrets) [Testing](https://bun.com/docs/cli/test) [Utils](https://bun.com/docs/api/utils) [Node-API](https://bun.com/docs/api/node-api) [Glob](https://bun.com/docs/api/glob) [DNS](https://bun.com/docs/api/dns) [Semver](https://bun.com/docs/api/semver) [Color](https://bun.com/docs/api/color) [Transpiler](https://bun.com/docs/api/transpiler)

Project

[Roadmap](https://bun.com/docs/project/roadmap) [Benchmarking](https://bun.com/docs/project/benchmarking) [Contributing](https://bun.com/docs/project/contributing) [Building Windows](https://bun.com/docs/project/building-windows) [Bindgen](https://bun.com/docs/project/bindgen) [License](https://bun.com/docs/project/licensing)

**🚧** — The `Worker` API is still experimental (particularly for terminating workers). We are actively working on improving this.

[`Worker`](https://developer.mozilla.org/en-US/docs/Web/API/Worker) lets you start and communicate with a new JavaScript instance running on a separate thread while sharing I/O resources with the main thread.

Bun implements a minimal version of the [Web Workers API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API) with extensions that make it work better for server-side use cases. Like the rest of Bun, `Worker` in Bun support CommonJS, ES Modules, TypeScript, JSX, TSX and more out of the box. No extra build steps are necessary.

## [Creating a `Worker`](https://bun.com/docs/api/workers#creating-a-worker)

Like in browsers, [`Worker`](https://developer.mozilla.org/en-US/docs/Web/API/Worker) is a global. Use it to create a new worker thread.

### [From the main thread](https://bun.com/docs/api/workers#from-the-main-thread)

Main thread

```
const worker = new Worker("./worker.ts");

worker.postMessage("hello");
worker.onmessage = event => {
  console.log(event.data);
};

```

### [Worker thread](https://bun.com/docs/api/workers#worker-thread)

worker.ts (Worker thread)

```
// prevents TS errors
declare var self: Worker;

self.onmessage = (event: MessageEvent) => {
  console.log(event.data);
  postMessage("world");
};

```

To prevent TypeScript errors when using `self`, add this line to the top of your worker file.

```
declare var self: Worker;

```

You can use `import` and `export` syntax in your worker code. Unlike in browsers, there's no need to specify `{type: "module"}` to use ES Modules.

To simplify error handling, the initial script to load is resolved at the time `new Worker(url)` is called.

```
const worker = new Worker("/not-found.js");
// throws an error immediately

```

The specifier passed to `Worker` is resolved relative to the project root (like typing `bun ./path/to/file.js`).

### [`preload` \- load modules before the worker starts](https://bun.com/docs/api/workers#preload-load-modules-before-the-worker-starts)

You can pass an array of module specifiers to the `preload` option to load modules before the worker starts. This is useful when you want to ensure some code is always loaded before the application starts, like loading OpenTelemetry, Sentry, DataDog, etc.

```
const worker = new Worker("./worker.ts", {
  preload: ["./load-sentry.js"],
});

```

Like the `--preload` CLI argument, the `preload` option is processed before the worker starts.

You can also pass a single string to the `preload` option:

```
const worker = new Worker("./worker.ts", {
  preload: "./load-sentry.js",
});

```

This feature was added in Bun v1.1.35.

### [`blob:` URLs](https://bun.com/docs/api/workers#blob-urls)

As of Bun v1.1.13, you can also pass a `blob:` URL to `Worker`. This is useful for creating workers from strings or other sources.

```
const blob = new Blob(
  [\
    `\
  self.onmessage = (event: MessageEvent) => postMessage(event.data)`,\
  ],
  {
    type: "application/typescript",
  },
);
const url = URL.createObjectURL(blob);
const worker = new Worker(url);

```

Like the rest of Bun, workers created from `blob:` URLs support TypeScript, JSX, and other file types out of the box. You can communicate it should be loaded via typescript either via `type` or by passing a `filename` to the `File` constructor.

```
const file = new File(
  [\
    `\
  self.onmessage = (event: MessageEvent) => postMessage(event.data)`,\
  ],
  "worker.ts",
);
const url = URL.createObjectURL(file);
const worker = new Worker(url);

```

### [`"open"`](https://bun.com/docs/api/workers#open)

The `"open"` event is emitted when a worker is created and ready to receive messages. This can be used to send an initial message to a worker once it's ready. (This event does not exist in browsers.)

```
const worker = new Worker(new URL("worker.ts", import.meta.url).href);

worker.addEventListener("open", () => {
  console.log("worker is ready");
});

```

Messages are automatically enqueued until the worker is ready, so there is no need to wait for the `"open"` event to send messages.

## [Messages with `postMessage`](https://bun.com/docs/api/workers#messages-with-postmessage)

To send messages, use [`worker.postMessage`](https://developer.mozilla.org/en-US/docs/Web/API/Worker/postMessage) and [`self.postMessage`](https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage). This leverages the [HTML Structured Clone Algorithm](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Structured_clone_algorithm).

### [Performance optimizations](https://bun.com/docs/api/workers#performance-optimizations)

Bun includes optimized fast paths for `postMessage` to dramatically improve performance for common data types:

**String fast path** \- When posting pure string values, Bun bypasses the structured clone algorithm entirely, achieving significant performance gains with no serialization overhead.

**Simple object fast path** \- For plain objects containing only primitive values (strings, numbers, booleans, null, undefined), Bun uses an optimized serialization path that stores properties directly without full structured cloning.

The simple object fast path activates when the object:

- Is a plain object with no prototype chain modifications
- Contains only enumerable, configurable data properties
- Has no indexed properties or getter/setter methods
- All property values are primitives or strings

With these fast paths, Bun's `postMessage` performs **2-241x faster** because the message length no longer has a meaningful impact on performance.

**Bun (with fast paths):**

```
postMessage({ prop: 11 chars string, ...9 more props }) - 648ns
postMessage({ prop: 14 KB string, ...9 more props })    - 719ns
postMessage({ prop: 3 MB string, ...9 more props })     - 1.26µs

```

**Node.js v24.6.0 (for comparison):**

```
postMessage({ prop: 11 chars string, ...9 more props }) - 1.19µs
postMessage({ prop: 14 KB string, ...9 more props })    - 2.69µs
postMessage({ prop: 3 MB string, ...9 more props })     - 304µs

```

```
// String fast path - optimized
postMessage("Hello, worker!");

// Simple object fast path - optimized
postMessage({
  message: "Hello",
  count: 42,
  enabled: true,
  data: null,
});

// Complex objects still work but use standard structured clone
postMessage({
  nested: { deep: { object: true } },
  date: new Date(),
  buffer: new ArrayBuffer(8),
});

```

```
// On the worker thread, `postMessage` is automatically "routed" to the parent thread.
postMessage({ hello: "world" });

// On the main thread
worker.postMessage({ hello: "world" });

```

To receive messages, use the [`message` event handler](https://developer.mozilla.org/en-US/docs/Web/API/Worker/message_event) on the worker and main thread.

```
// Worker thread:
self.addEventListener("message", event => {
  console.log(event.data);
});
// or use the setter:
// self.onmessage = fn

// if on the main thread
worker.addEventListener("message", event => {
  console.log(event.data);
});
// or use the setter:
// worker.onmessage = fn

```

## [Terminating a worker](https://bun.com/docs/api/workers#terminating-a-worker)

A `Worker` instance terminates automatically once it's event loop has no work left to do. Attaching a `"message"` listener on the global or any `MessagePort` s will keep the event loop alive. To forcefully terminate a `Worker`, call `worker.terminate()`.

```
const worker = new Worker(new URL("worker.ts", import.meta.url).href);

// ...some time later
worker.terminate();

```

This will cause the worker's to exit as soon as possible.

### [`process.exit()`](https://bun.com/docs/api/workers#process-exit)

A worker can terminate itself with `process.exit()`. This does not terminate the main process. Like in Node.js, `process.on('beforeExit', callback)` and `process.on('exit', callback)` are emitted on the worker thread (and not on the main thread), and the exit code is passed to the `"close"` event.

### [`"close"`](https://bun.com/docs/api/workers#close)

The `"close"` event is emitted when a worker has been terminated. It can take some time for the worker to actually terminate, so this event is emitted when the worker has been marked as terminated. The `CloseEvent` will contain the exit code passed to `process.exit()`, or 0 if closed for other reasons.

```
const worker = new Worker(new URL("worker.ts", import.meta.url).href);

worker.addEventListener("close", event => {
  console.log("worker is being closed");
});

```

This event does not exist in browsers.

## [Managing lifetime](https://bun.com/docs/api/workers#managing-lifetime)

By default, an active `Worker` will keep the main (spawning) process alive, so async tasks like `setTimeout` and promises will keep the process alive. Attaching `message` listeners will also keep the `Worker` alive.

### [`worker.unref()`](https://bun.com/docs/api/workers#worker-unref)

To stop a running worker from keeping the process alive, call `worker.unref()`. This decouples the lifetime of the worker to the lifetime of the main process, and is equivalent to what Node.js' `worker_threads` does.

```
const worker = new Worker(new URL("worker.ts", import.meta.url).href);
worker.unref();

```

Note: `worker.unref()` is not available in browsers.

### [`worker.ref()`](https://bun.com/docs/api/workers#worker-ref)

To keep the process alive until the `Worker` terminates, call `worker.ref()`. A ref'd worker is the default behavior, and still needs something going on in the event loop (such as a `"message"` listener) for the worker to continue running.

```
const worker = new Worker(new URL("worker.ts", import.meta.url).href);
worker.unref();
// later...
worker.ref();

```

Alternatively, you can also pass an `options` object to `Worker`:

```
const worker = new Worker(new URL("worker.ts", import.meta.url).href, {
  ref: false,
});

```

Note: `worker.ref()` is not available in browsers.

## [Memory usage with `smol`](https://bun.com/docs/api/workers#memory-usage-with-smol)

JavaScript instances can use a lot of memory. Bun's `Worker` supports a `smol` mode that reduces memory usage, at a cost of performance. To enable `smol` mode, pass `smol: true` to the `options` object in the `Worker` constructor.

```
const worker = new Worker("./i-am-smol.ts", {
  smol: true,
});

```

What does `smol` mode actually do?

Setting `smol: true` sets `JSC::HeapSize` to be `Small` instead of the default `Large`.

## [`Bun.isMainThread`](https://bun.com/docs/api/workers#bun-ismainthread)

You can check if you're in the main thread by checking `Bun.isMainThread`.

```
if (Bun.isMainThread) {
  console.log("I'm the main thread");
} else {
  console.log("I'm in a worker");
}

```

This is useful for conditionally running code based on whether you're in the main thread or not.

[Previous\\
\\
WebSockets](https://bun.com/docs/api/websockets) [Next\\
\\
Binary data](https://bun.com/docs/api/binary-data)

[![GitHub logo](Base64-Image-Removed)![GitHub logo](Base64-Image-Removed)\\
\\
Edit on GitHub](https://github.com/oven-sh/bun/edit/main/docs/api/workers.md)

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

---

Powered by

[![inkeep search icon](https://uploads-ssl.webflow.com/63fd919a913cf54ca2d02cda/642ea6563549ced1bb379fea_inkeep-icon-medium-gray.svg)inkeep](https://www.inkeep.com/)

Get help

[Discord](https://bun.com/discord)

[Migration help for organizations](https://t.co/0CA0Neqgts)
