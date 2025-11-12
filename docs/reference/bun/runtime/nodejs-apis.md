---
title: Node.js compatibility – Runtime | Bun Docs
url: 
description: Bun aims for full Node.js compatibility. This page tracks the current compatibility status.
language: en
---
Search`` `K`

Intro

[What is Bun?](https://bun.com/docs/index) [Installation](https://bun.com/docs/installation) [Quickstart](https://bun.com/docs/quickstart) [TypeScript](https://bun.com/docs/typescript)

Templating

[`bun init`](https://bun.com/docs/cli/init) [`bun create`](https://bun.com/docs/cli/bun-create)

Runtime

[`bun run`](https://bun.com/docs/cli/run) [File types](https://bun.com/docs/runtime/loaders) [TypeScript](https://bun.com/docs/runtime/typescript) [JSX](https://bun.com/docs/runtime/jsx) [Environment variables](https://bun.com/docs/runtime/env) [Bun APIs](https://bun.com/docs/runtime/bun-apis) [Web APIs](https://bun.com/docs/runtime/web-apis) [Node.js compatibility](https://bun.com/docs/runtime/nodejs-apis)

[Built-in Node.js modules](https://bun.com/docs/runtime/nodejs-apis#built-in-node-js-modules) [`node:assert`](https://bun.com/docs/runtime/nodejs-apis#node-assert) [`node:buffer`](https://bun.com/docs/runtime/nodejs-apis#node-buffer) [`node:console`](https://bun.com/docs/runtime/nodejs-apis#node-console) [`node:dgram`](https://bun.com/docs/runtime/nodejs-apis#node-dgram) [`node:diagnostics_channel`](https://bun.com/docs/runtime/nodejs-apis#node-diagnostics-channel) [`node:dns`](https://bun.com/docs/runtime/nodejs-apis#node-dns) [`node:events`](https://bun.com/docs/runtime/nodejs-apis#node-events) [`node:fs`](https://bun.com/docs/runtime/nodejs-apis#node-fs) [`node:http`](https://bun.com/docs/runtime/nodejs-apis#node-http) [`node:https`](https://bun.com/docs/runtime/nodejs-apis#node-https) [`node:os`](https://bun.com/docs/runtime/nodejs-apis#node-os) [`node:path`](https://bun.com/docs/runtime/nodejs-apis#node-path) [`node:punycode`](https://bun.com/docs/runtime/nodejs-apis#node-punycode) [`node:querystring`](https://bun.com/docs/runtime/nodejs-apis#node-querystring) [`node:readline`](https://bun.com/docs/runtime/nodejs-apis#node-readline) [`node:stream`](https://bun.com/docs/runtime/nodejs-apis#node-stream) [`node:string_decoder`](https://bun.com/docs/runtime/nodejs-apis#node-string-decoder) [`node:timers`](https://bun.com/docs/runtime/nodejs-apis#node-timers) [`node:tty`](https://bun.com/docs/runtime/nodejs-apis#node-tty) [`node:url`](https://bun.com/docs/runtime/nodejs-apis#node-url) [`node:zlib`](https://bun.com/docs/runtime/nodejs-apis#node-zlib) [`node:async_hooks`](https://bun.com/docs/runtime/nodejs-apis#node-async-hooks) [`node:child_process`](https://bun.com/docs/runtime/nodejs-apis#node-child-process) [`node:cluster`](https://bun.com/docs/runtime/nodejs-apis#node-cluster) [`node:crypto`](https://bun.com/docs/runtime/nodejs-apis#node-crypto) [`node:domain`](https://bun.com/docs/runtime/nodejs-apis#node-domain) [`node:http2`](https://bun.com/docs/runtime/nodejs-apis#node-http2) [`node:module`](https://bun.com/docs/runtime/nodejs-apis#node-module) [`node:net`](https://bun.com/docs/runtime/nodejs-apis#node-net) [`node:perf_hooks`](https://bun.com/docs/runtime/nodejs-apis#node-perf-hooks) [`node:process`](https://bun.com/docs/runtime/nodejs-apis#node-process) [`node:sys`](https://bun.com/docs/runtime/nodejs-apis#node-sys) [`node:tls`](https://bun.com/docs/runtime/nodejs-apis#node-tls) [`node:util`](https://bun.com/docs/runtime/nodejs-apis#node-util) [`node:v8`](https://bun.com/docs/runtime/nodejs-apis#node-v8) [`node:vm`](https://bun.com/docs/runtime/nodejs-apis#node-vm) [`node:wasi`](https://bun.com/docs/runtime/nodejs-apis#node-wasi) [`node:worker_threads`](https://bun.com/docs/runtime/nodejs-apis#node-worker-threads) [`node:inspector`](https://bun.com/docs/runtime/nodejs-apis#node-inspector) [`node:repl`](https://bun.com/docs/runtime/nodejs-apis#node-repl) [`node:sqlite`](https://bun.com/docs/runtime/nodejs-apis#node-sqlite) [`node:test`](https://bun.com/docs/runtime/nodejs-apis#node-test) [`node:trace_events`](https://bun.com/docs/runtime/nodejs-apis#node-trace-events) [Node.js globals](https://bun.com/docs/runtime/nodejs-apis#node-js-globals) [`AbortController`](https://bun.com/docs/runtime/nodejs-apis#abortcontroller) [`AbortSignal`](https://bun.com/docs/runtime/nodejs-apis#abortsignal) [`Blob`](https://bun.com/docs/runtime/nodejs-apis#blob) [`Buffer`](https://bun.com/docs/runtime/nodejs-apis#buffer) [`ByteLengthQueuingStrategy`](https://bun.com/docs/runtime/nodejs-apis#bytelengthqueuingstrategy) [`__dirname`](https://bun.com/docs/runtime/nodejs-apis#dirname) [`__filename`](https://bun.com/docs/runtime/nodejs-apis#filename) [`atob()`](https://bun.com/docs/runtime/nodejs-apis#atob) [`Atomics`](https://bun.com/docs/runtime/nodejs-apis#atomics) [`BroadcastChannel`](https://bun.com/docs/runtime/nodejs-apis#broadcastchannel) [`btoa()`](https://bun.com/docs/runtime/nodejs-apis#btoa) [`clearImmediate()`](https://bun.com/docs/runtime/nodejs-apis#clearimmediate) [`clearInterval()`](https://bun.com/docs/runtime/nodejs-apis#clearinterval) [`clearTimeout()`](https://bun.com/docs/runtime/nodejs-apis#cleartimeout) [`CompressionStream`](https://bun.com/docs/runtime/nodejs-apis#compressionstream) [`console`](https://bun.com/docs/runtime/nodejs-apis#console) [`CountQueuingStrategy`](https://bun.com/docs/runtime/nodejs-apis#countqueuingstrategy) [`Crypto`](https://bun.com/docs/runtime/nodejs-apis#crypto) [`SubtleCrypto (crypto)`](https://bun.com/docs/runtime/nodejs-apis#subtlecrypto-crypto) [`CryptoKey`](https://bun.com/docs/runtime/nodejs-apis#cryptokey) [`CustomEvent`](https://bun.com/docs/runtime/nodejs-apis#customevent) [`DecompressionStream`](https://bun.com/docs/runtime/nodejs-apis#decompressionstream) [`Event`](https://bun.com/docs/runtime/nodejs-apis#event) [`EventTarget`](https://bun.com/docs/runtime/nodejs-apis#eventtarget) [`exports`](https://bun.com/docs/runtime/nodejs-apis#exports_) [`fetch`](https://bun.com/docs/runtime/nodejs-apis#fetch) [`FormData`](https://bun.com/docs/runtime/nodejs-apis#formdata) [`global`](https://bun.com/docs/runtime/nodejs-apis#global) [`globalThis`](https://bun.com/docs/runtime/nodejs-apis#globalthis) [`Headers`](https://bun.com/docs/runtime/nodejs-apis#headers) [`MessageChannel`](https://bun.com/docs/runtime/nodejs-apis#messagechannel) [`MessageEvent`](https://bun.com/docs/runtime/nodejs-apis#messageevent) [`MessagePort`](https://bun.com/docs/runtime/nodejs-apis#messageport) [`module`](https://bun.com/docs/runtime/nodejs-apis#module_) [`PerformanceEntry`](https://bun.com/docs/runtime/nodejs-apis#performanceentry) [`PerformanceMark`](https://bun.com/docs/runtime/nodejs-apis#performancemark) [`PerformanceMeasure`](https://bun.com/docs/runtime/nodejs-apis#performancemeasure) [`PerformanceObserver`](https://bun.com/docs/runtime/nodejs-apis#performanceobserver) [`PerformanceObserverEntryList`](https://bun.com/docs/runtime/nodejs-apis#performanceobserverentrylist) [`PerformanceResourceTiming`](https://bun.com/docs/runtime/nodejs-apis#performanceresourcetiming) [`performance`](https://bun.com/docs/runtime/nodejs-apis#performance) [`process`](https://bun.com/docs/runtime/nodejs-apis#process) [`queueMicrotask()`](https://bun.com/docs/runtime/nodejs-apis#queuemicrotask) [`ReadableByteStreamController`](https://bun.com/docs/runtime/nodejs-apis#readablebytestreamcontroller) [`ReadableStream`](https://bun.com/docs/runtime/nodejs-apis#readablestream) [`ReadableStreamBYOBReader`](https://bun.com/docs/runtime/nodejs-apis#readablestreambyobreader) [`ReadableStreamBYOBRequest`](https://bun.com/docs/runtime/nodejs-apis#readablestreambyobrequest) [`ReadableStreamDefaultController`](https://bun.com/docs/runtime/nodejs-apis#readablestreamdefaultcontroller) [`ReadableStreamDefaultReader`](https://bun.com/docs/runtime/nodejs-apis#readablestreamdefaultreader) [`require()`](https://bun.com/docs/runtime/nodejs-apis#require) [`Response`](https://bun.com/docs/runtime/nodejs-apis#response) [`Request`](https://bun.com/docs/runtime/nodejs-apis#request) [`setImmediate()`](https://bun.com/docs/runtime/nodejs-apis#setimmediate) [`setInterval()`](https://bun.com/docs/runtime/nodejs-apis#setinterval) [`setTimeout()`](https://bun.com/docs/runtime/nodejs-apis#settimeout) [`structuredClone()`](https://bun.com/docs/runtime/nodejs-apis#structuredclone) [`SubtleCrypto`](https://bun.com/docs/runtime/nodejs-apis#subtlecrypto) [`DOMException`](https://bun.com/docs/runtime/nodejs-apis#domexception) [`TextDecoder`](https://bun.com/docs/runtime/nodejs-apis#textdecoder) [`TextDecoderStream`](https://bun.com/docs/runtime/nodejs-apis#textdecoderstream) [`TextEncoder`](https://bun.com/docs/runtime/nodejs-apis#textencoder) [`TextEncoderStream`](https://bun.com/docs/runtime/nodejs-apis#textencoderstream) [`TransformStream`](https://bun.com/docs/runtime/nodejs-apis#transformstream) [`TransformStreamDefaultController`](https://bun.com/docs/runtime/nodejs-apis#transformstreamdefaultcontroller) [`URL`](https://bun.com/docs/runtime/nodejs-apis#url) [`URLSearchParams`](https://bun.com/docs/runtime/nodejs-apis#urlsearchparams) [`WebAssembly`](https://bun.com/docs/runtime/nodejs-apis#webassembly) [`WritableStream`](https://bun.com/docs/runtime/nodejs-apis#writablestream) [`WritableStreamDefaultController`](https://bun.com/docs/runtime/nodejs-apis#writablestreamdefaultcontroller) [`WritableStreamDefaultWriter`](https://bun.com/docs/runtime/nodejs-apis#writablestreamdefaultwriter)

[Single-file executable](https://bun.com/docs/bundler/executables) [Plugins](https://bun.com/docs/runtime/plugins) [Watch mode](https://bun.com/docs/runtime/hot) [Module resolution](https://bun.com/docs/runtime/modules) [Auto-install](https://bun.com/docs/runtime/autoimport) [bunfig.toml](https://bun.com/docs/runtime/bunfig) [Debugger](https://bun.com/docs/runtime/debugger)

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

[HTTP server](https://bun.com/docs/api/http) [HTTP client](https://bun.com/docs/api/fetch) [WebSockets](https://bun.com/docs/api/websockets) [Workers](https://bun.com/docs/api/workers) [Binary data](https://bun.com/docs/api/binary-data) [Streams](https://bun.com/docs/api/streams) [SQL](https://bun.com/docs/api/sql) [S3 Object Storage](https://bun.com/docs/api/s3) [File I/O](https://bun.com/docs/api/file-io) [Redis client](https://bun.com/docs/api/redis) [import.meta](https://bun.com/docs/api/import-meta) [SQLite](https://bun.com/docs/api/sqlite) [FileSystemRouter](https://bun.com/docs/api/file-system-router) [TCP sockets](https://bun.com/docs/api/tcp) [UDP sockets](https://bun.com/docs/api/udp) [Globals](https://bun.com/docs/api/globals) [$ Shell](https://bun.com/docs/runtime/shell) [Child processes](https://bun.com/docs/api/spawn) [YAML](https://bun.com/docs/api/yaml) [HTMLRewriter](https://bun.com/docs/api/html-rewriter) [Hashing](https://bun.com/docs/api/hashing) [Console](https://bun.com/docs/api/console) [Cookie](https://bun.com/docs/api/cookie) [FFI](https://bun.com/docs/api/ffi) [C Compiler](https://bun.com/docs/api/cc) [Secrets](https://bun.com/docs/api/secrets) [Testing](https://bun.com/docs/cli/test) [Utils](https://bun.com/docs/api/utils) [Node-API](https://bun.com/docs/api/node-api) [Glob](https://bun.com/docs/api/glob) [DNS](https://bun.com/docs/api/dns) [Semver](https://bun.com/docs/api/semver) [Color](https://bun.com/docs/api/color) [Transpiler](https://bun.com/docs/api/transpiler)

Project

[Roadmap](https://bun.com/docs/project/roadmap) [Benchmarking](https://bun.com/docs/project/benchmarking) [Contributing](https://bun.com/docs/project/contributing) [Building Windows](https://bun.com/docs/project/building-windows) [Bindgen](https://bun.com/docs/project/bindgen) [License](https://bun.com/docs/project/licensing)

Every day, Bun gets closer to 100% Node.js API compatibility. Today, popular frameworks like Next.js, Express, and millions of `npm` packages intended for Node just work with Bun. To ensure compatibility, we run thousands of tests from Node.js' test suite before every release of Bun.

**If a package works in Node.js but doesn't work in Bun, we consider it a bug in Bun.** Please [open an issue](https://bun.com/issues) and we'll fix it.

This page is updated regularly to reflect compatibility status of the latest version of Bun. The information below reflects Bun's compatibility with _Node.js v23_.

## [Built-in Node.js modules](https://bun.com/docs/runtime/nodejs-apis\#built-in-node-js-modules)

### [`node:assert`](https://nodejs.org/api/assert.html)

🟢 Fully implemented.

### [`node:buffer`](https://nodejs.org/api/buffer.html)

🟢 Fully implemented.

### [`node:console`](https://nodejs.org/api/console.html)

🟢 Fully implemented.

### [`node:dgram`](https://nodejs.org/api/dgram.html)

🟢 Fully implemented. > 90% of Node.js's test suite passes.

### [`node:diagnostics_channel`](https://nodejs.org/api/diagnostics_channel.html)

🟢 Fully implemented.

### [`node:dns`](https://nodejs.org/api/dns.html)

🟢 Fully implemented. > 90% of Node.js's test suite passes.

### [`node:events`](https://nodejs.org/api/events.html)

🟢 Fully implemented. 100% of Node.js's test suite passes. `EventEmitterAsyncResource` uses `AsyncResource` underneath.

### [`node:fs`](https://nodejs.org/api/fs.html)

🟢 Fully implemented. 92% of Node.js's test suite passes.

### [`node:http`](https://nodejs.org/api/http.html)

🟢 Fully implemented. Outgoing client request body is currently buffered instead of streamed.

### [`node:https`](https://nodejs.org/api/https.html)

🟢 APIs are implemented, but `Agent` is not always used yet.

### [`node:os`](https://nodejs.org/api/os.html)

🟢 Fully implemented. 100% of Node.js's test suite passes.

### [`node:path`](https://nodejs.org/api/path.html)

🟢 Fully implemented. 100% of Node.js's test suite passes.

### [`node:punycode`](https://nodejs.org/api/punycode.html)

🟢 Fully implemented. 100% of Node.js's test suite passes, _deprecated by Node.js_.

### [`node:querystring`](https://nodejs.org/api/querystring.html)

🟢 Fully implemented. 100% of Node.js's test suite passes.

### [`node:readline`](https://nodejs.org/api/readline.html)

🟢 Fully implemented.

### [`node:stream`](https://nodejs.org/api/stream.html)

🟢 Fully implemented.

### [`node:string_decoder`](https://nodejs.org/api/string_decoder.html)

🟢 Fully implemented. 100% of Node.js's test suite passes.

### [`node:timers`](https://nodejs.org/api/timers.html)

🟢 Recommended to use global `setTimeout`, et. al. instead.

### [`node:tty`](https://nodejs.org/api/tty.html)

🟢 Fully implemented.

### [`node:url`](https://nodejs.org/api/url.html)

🟢 Fully implemented.

### [`node:zlib`](https://nodejs.org/api/zlib.html)

🟢 Fully implemented. 98% of Node.js's test suite passes.

### [`node:async_hooks`](https://nodejs.org/api/async_hooks.html)

🟡 `AsyncLocalStorage`, and `AsyncResource` are implemented. v8 promise hooks are not called, and its usage is [strongly discouraged](https://nodejs.org/docs/latest/api/async_hooks.html#async-hooks).

### [`node:child_process`](https://nodejs.org/api/child_process.html)

🟡 Missing `proc.gid` `proc.uid`. `Stream` class not exported. IPC cannot send socket handles. Node.js <> Bun IPC can be used with JSON serialization.

### [`node:cluster`](https://nodejs.org/api/cluster.html)

🟡 Handles and file descriptors cannot be passed between workers, which means load-balancing HTTP requests across processes is only supported on Linux at this time (via `SO_REUSEPORT`). Otherwise, implemented but not battle-tested.

### [`node:crypto`](https://nodejs.org/api/crypto.html)

🟡 Missing `secureHeapUsed` `setEngine` `setFips`

### [`node:domain`](https://nodejs.org/api/domain.html)

🟡 Missing `Domain` `active`

### [`node:http2`](https://nodejs.org/api/http2.html)

🟡 Client & server are implemented (95.25% of gRPC's test suite passes). Missing `options.allowHTTP1`, `options.enableConnectProtocol`, ALTSVC extension, and `http2stream.pushStream`.

### [`node:module`](https://nodejs.org/api/module.html)

🟡 Missing `syncBuiltinESMExports`, `Module#load()`. Overriding `require.cache` is supported for ESM & CJS modules. `module._extensions`, `module._pathCache`, `module._cache` are no-ops. `module.register` is not implemented and we recommend using a [`Bun.plugin`](https://bun.com/docs/runtime/plugins) in the meantime.

### [`node:net`](https://nodejs.org/api/net.html)

🟢 Fully implemented.

### [`node:perf_hooks`](https://nodejs.org/api/perf_hooks.html)

🟡 Missing `createHistogram` `monitorEventLoopDelay`. It's recommended to use `performance` global instead of `perf_hooks.performance`.

### [`node:process`](https://nodejs.org/api/process.html)

🟡 See [`process`](https://bun.com/docs/runtime/nodejs-apis#process) Global.

### [`node:sys`](https://nodejs.org/api/util.html)

🟡 See [`node:util`](https://bun.com/docs/runtime/nodejs-apis#node-util).

### [`node:tls`](https://nodejs.org/api/tls.html)

🟡 Missing `tls.createSecurePair`.

### [`node:util`](https://nodejs.org/api/util.html)

🟡 Missing `getCallSite` `getCallSites` `getSystemErrorMap` `getSystemErrorMessage` `transferableAbortSignal` `transferableAbortController`

### [`node:v8`](https://nodejs.org/api/v8.html)

🟡 `writeHeapSnapshot` and `getHeapSnapshot` are implemented. `serialize` and `deserialize` use JavaScriptCore's wire format instead of V8's. Other methods are not implemented. For profiling, use [`bun:jsc`](https://bun.com/docs/project/benchmarking#bunjsc) instead.

### [`node:vm`](https://nodejs.org/api/vm.html)

🟡 Core functionality and ES modules are implemented, including `vm.Script`, `vm.createContext`, `vm.runInContext`, `vm.runInNewContext`, `vm.runInThisContext`, `vm.compileFunction`, `vm.isContext`, `vm.Module`, `vm.SourceTextModule`, `vm.SyntheticModule`, and `importModuleDynamically` support. Options like `timeout` and `breakOnSigint` are fully supported. Missing `vm.measureMemory` and some `cachedData` functionality.

### [`node:wasi`](https://nodejs.org/api/wasi.html)

🟡 Partially implemented.

### [`node:worker_threads`](https://nodejs.org/api/worker_threads.html)

🟡 `Worker` doesn't support the following options: `stdin` `stdout` `stderr` `trackedUnmanagedFds` `resourceLimits`. Missing `markAsUntransferable` `moveMessagePortToContext` `getHeapSnapshot`.

### [`node:inspector`](https://nodejs.org/api/inspector.html)

🔴 Not implemented.

### [`node:repl`](https://nodejs.org/api/repl.html)

🔴 Not implemented.

### [`node:sqlite`](https://nodejs.org/api/sqlite.html)

🔴 Not implemented.

### [`node:test`](https://nodejs.org/api/test.html)

🟡 Partly implemented. Missing mocks, snapshots, timers. Use [`bun:test`](https://bun.com/docs/cli/test) instead.

### [`node:trace_events`](https://nodejs.org/api/tracing.html)

🔴 Not implemented.

## [Node.js globals](https://bun.com/docs/runtime/nodejs-apis\#node-js-globals)

The table below lists all globals implemented by Node.js and Bun's current compatibility status.

### [`AbortController`](https://developer.mozilla.org/en-US/docs/Web/API/AbortController)

🟢 Fully implemented.

### [`AbortSignal`](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal)

🟢 Fully implemented.

### [`Blob`](https://developer.mozilla.org/en-US/docs/Web/API/Blob)

🟢 Fully implemented.

### [`Buffer`](https://nodejs.org/api/buffer.html\#class-buffer)

🟢 Fully implemented.

### [`ByteLengthQueuingStrategy`](https://developer.mozilla.org/en-US/docs/Web/API/ByteLengthQueuingStrategy)

🟢 Fully implemented.

### [`__dirname`](https://nodejs.org/api/globals.html\#__dirname)

🟢 Fully implemented.

### [`__filename`](https://nodejs.org/api/globals.html\#__filename)

🟢 Fully implemented.

### [`atob()`](https://developer.mozilla.org/en-US/docs/Web/API/atob)

🟢 Fully implemented.

### [`Atomics`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Atomics)

🟢 Fully implemented.

### [`BroadcastChannel`](https://developer.mozilla.org/en-US/docs/Web/API/BroadcastChannel)

🟢 Fully implemented.

### [`btoa()`](https://developer.mozilla.org/en-US/docs/Web/API/btoa)

🟢 Fully implemented.

### [`clearImmediate()`](https://developer.mozilla.org/en-US/docs/Web/API/Window/clearImmediate)

🟢 Fully implemented.

### [`clearInterval()`](https://developer.mozilla.org/en-US/docs/Web/API/Window/clearInterval)

🟢 Fully implemented.

### [`clearTimeout()`](https://developer.mozilla.org/en-US/docs/Web/API/Window/clearTimeout)

🟢 Fully implemented.

### [`CompressionStream`](https://developer.mozilla.org/en-US/docs/Web/API/CompressionStream)

🔴 Not implemented.

### [`console`](https://developer.mozilla.org/en-US/docs/Web/API/console)

🟢 Fully implemented.

### [`CountQueuingStrategy`](https://developer.mozilla.org/en-US/docs/Web/API/CountQueuingStrategy)

🟢 Fully implemented.

### [`Crypto`](https://developer.mozilla.org/en-US/docs/Web/API/Crypto)

🟢 Fully implemented.

### [`SubtleCrypto (crypto)`](https://developer.mozilla.org/en-US/docs/Web/API/crypto)

🟢 Fully implemented.

### [`CryptoKey`](https://developer.mozilla.org/en-US/docs/Web/API/CryptoKey)

🟢 Fully implemented.

### [`CustomEvent`](https://developer.mozilla.org/en-US/docs/Web/API/CustomEvent)

🟢 Fully implemented.

### [`DecompressionStream`](https://developer.mozilla.org/en-US/docs/Web/API/DecompressionStream)

🔴 Not implemented.

### [`Event`](https://developer.mozilla.org/en-US/docs/Web/API/Event)

🟢 Fully implemented.

### [`EventTarget`](https://developer.mozilla.org/en-US/docs/Web/API/EventTarget)

🟢 Fully implemented.

### [`exports`](https://nodejs.org/api/globals.html\#exports)

🟢 Fully implemented.

### [`fetch`](https://developer.mozilla.org/en-US/docs/Web/API/fetch)

🟢 Fully implemented.

### [`FormData`](https://developer.mozilla.org/en-US/docs/Web/API/FormData)

🟢 Fully implemented.

### [`global`](https://nodejs.org/api/globals.html\#global)

🟢 Implemented. This is an object containing all objects in the global namespace. It's rarely referenced directly, as its contents are available without an additional prefix, e.g. `__dirname` instead of `global.__dirname`.

### [`globalThis`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/globalThis)

🟢 Aliases to `global`.

### [`Headers`](https://developer.mozilla.org/en-US/docs/Web/API/Headers)

🟢 Fully implemented.

### [`MessageChannel`](https://developer.mozilla.org/en-US/docs/Web/API/MessageChannel)

🟢 Fully implemented.

### [`MessageEvent`](https://developer.mozilla.org/en-US/docs/Web/API/MessageEvent)

🟢 Fully implemented.

### [`MessagePort`](https://developer.mozilla.org/en-US/docs/Web/API/MessagePort)

🟢 Fully implemented.

### [`module`](https://nodejs.org/api/globals.html\#module)

🟢 Fully implemented.

### [`PerformanceEntry`](https://developer.mozilla.org/en-US/docs/Web/API/PerformanceEntry)

🟢 Fully implemented.

### [`PerformanceMark`](https://developer.mozilla.org/en-US/docs/Web/API/PerformanceMark)

🟢 Fully implemented.

### [`PerformanceMeasure`](https://developer.mozilla.org/en-US/docs/Web/API/PerformanceMeasure)

🟢 Fully implemented.

### [`PerformanceObserver`](https://developer.mozilla.org/en-US/docs/Web/API/PerformanceObserver)

🟢 Fully implemented.

### [`PerformanceObserverEntryList`](https://developer.mozilla.org/en-US/docs/Web/API/PerformanceObserverEntryList)

🟢 Fully implemented.

### [`PerformanceResourceTiming`](https://developer.mozilla.org/en-US/docs/Web/API/PerformanceResourceTiming)

🟢 Fully implemented.

### [`performance`](https://developer.mozilla.org/en-US/docs/Web/API/performance)

🟢 Fully implemented.

### [`process`](https://nodejs.org/api/process.html)

🟡 Mostly implemented. `process.binding` (internal Node.js bindings some packages rely on) is partially implemented. `process.title` is currently a no-op on macOS & Linux. `getActiveResourcesInfo` `setActiveResourcesInfo`, `getActiveResources` and `setSourceMapsEnabled` are stubs. Newer APIs like `process.loadEnvFile` and `process.getBuiltinModule` are not implemented yet.

### [`queueMicrotask()`](https://developer.mozilla.org/en-US/docs/Web/API/queueMicrotask)

🟢 Fully implemented.

### [`ReadableByteStreamController`](https://developer.mozilla.org/en-US/docs/Web/API/ReadableByteStreamController)

🟢 Fully implemented.

### [`ReadableStream`](https://developer.mozilla.org/en-US/docs/Web/API/ReadableStream)

🟢 Fully implemented.

### [`ReadableStreamBYOBReader`](https://developer.mozilla.org/en-US/docs/Web/API/ReadableStreamBYOBReader)

🟢 Fully implemented.

### [`ReadableStreamBYOBRequest`](https://developer.mozilla.org/en-US/docs/Web/API/ReadableStreamBYOBRequest)

🟢 Fully implemented.

### [`ReadableStreamDefaultController`](https://developer.mozilla.org/en-US/docs/Web/API/ReadableStreamDefaultController)

🟢 Fully implemented.

### [`ReadableStreamDefaultReader`](https://developer.mozilla.org/en-US/docs/Web/API/ReadableStreamDefaultReader)

🟢 Fully implemented.

### [`require()`](https://nodejs.org/api/globals.html\#require)

🟢 Fully implemented, including [`require.main`](https://nodejs.org/api/modules.html#requiremain), [`require.cache`](https://nodejs.org/api/modules.html#requirecache), [`require.resolve`](https://nodejs.org/api/modules.html#requireresolverequest-options).

### [`Response`](https://developer.mozilla.org/en-US/docs/Web/API/Response)

🟢 Fully implemented.

### [`Request`](https://developer.mozilla.org/en-US/docs/Web/API/Request)

🟢 Fully implemented.

### [`setImmediate()`](https://developer.mozilla.org/en-US/docs/Web/API/Window/setImmediate)

🟢 Fully implemented.

### [`setInterval()`](https://developer.mozilla.org/en-US/docs/Web/API/Window/setInterval)

🟢 Fully implemented.

### [`setTimeout()`](https://developer.mozilla.org/en-US/docs/Web/API/Window/setTimeout)

🟢 Fully implemented.

### [`structuredClone()`](https://developer.mozilla.org/en-US/docs/Web/API/structuredClone)

🟢 Fully implemented.

### [`SubtleCrypto`](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto)

🟢 Fully implemented.

### [`DOMException`](https://developer.mozilla.org/en-US/docs/Web/API/DOMException)

🟢 Fully implemented.

### [`TextDecoder`](https://developer.mozilla.org/en-US/docs/Web/API/TextDecoder)

🟢 Fully implemented.

### [`TextDecoderStream`](https://developer.mozilla.org/en-US/docs/Web/API/TextDecoderStream)

🟢 Fully implemented.

### [`TextEncoder`](https://developer.mozilla.org/en-US/docs/Web/API/TextEncoder)

🟢 Fully implemented.

### [`TextEncoderStream`](https://developer.mozilla.org/en-US/docs/Web/API/TextEncoderStream)

🟢 Fully implemented.

### [`TransformStream`](https://developer.mozilla.org/en-US/docs/Web/API/TransformStream)

🟢 Fully implemented.

### [`TransformStreamDefaultController`](https://developer.mozilla.org/en-US/docs/Web/API/TransformStreamDefaultController)

🟢 Fully implemented.

### [`URL`](https://developer.mozilla.org/en-US/docs/Web/API/URL)

🟢 Fully implemented.

### [`URLSearchParams`](https://developer.mozilla.org/en-US/docs/Web/API/URLSearchParams)

🟢 Fully implemented.

### [`WebAssembly`](https://nodejs.org/api/globals.html\#webassembly)

🟢 Fully implemented.

### [`WritableStream`](https://developer.mozilla.org/en-US/docs/Web/API/WritableStream)

🟢 Fully implemented.

### [`WritableStreamDefaultController`](https://developer.mozilla.org/en-US/docs/Web/API/WritableStreamDefaultController)

🟢 Fully implemented.

### [`WritableStreamDefaultWriter`](https://developer.mozilla.org/en-US/docs/Web/API/WritableStreamDefaultWriter)

🟢 Fully implemented.

[Previous\\
\\
Web APIs](https://bun.com/docs/runtime/web-apis) [Next\\
\\
Single-file executable](https://bun.com/docs/bundler/executables)

[![GitHub logo](<Base64-Image-Removed>)![GitHub logo](<Base64-Image-Removed>)\\
\\
Edit on GitHub](https://github.com/oven-sh/bun/edit/main/docs/runtime/nodejs-apis.md)