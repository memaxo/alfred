---
title: Globals – API | Bun Docs
url:
description: Bun implements a range of Web APIs, Node.js APIs, and Bun-native APIs that are available in the global scope.
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

[HTTP server](https://bun.com/docs/api/http) [HTTP client](https://bun.com/docs/api/fetch) [WebSockets](https://bun.com/docs/api/websockets) [Workers](https://bun.com/docs/api/workers) [Binary data](https://bun.com/docs/api/binary-data) [Streams](https://bun.com/docs/api/streams) [SQL](https://bun.com/docs/api/sql) [S3 Object Storage](https://bun.com/docs/api/s3) [File I/O](https://bun.com/docs/api/file-io) [Redis client](https://bun.com/docs/api/redis) [import.meta](https://bun.com/docs/api/import-meta) [SQLite](https://bun.com/docs/api/sqlite) [FileSystemRouter](https://bun.com/docs/api/file-system-router) [TCP sockets](https://bun.com/docs/api/tcp) [UDP sockets](https://bun.com/docs/api/udp) [Globals](https://bun.com/docs/api/globals) [$ Shell](https://bun.com/docs/runtime/shell) [Child processes](https://bun.com/docs/api/spawn) [YAML](https://bun.com/docs/api/yaml) [HTMLRewriter](https://bun.com/docs/api/html-rewriter) [Hashing](https://bun.com/docs/api/hashing) [Console](https://bun.com/docs/api/console) [Cookie](https://bun.com/docs/api/cookie) [FFI](https://bun.com/docs/api/ffi) [C Compiler](https://bun.com/docs/api/cc) [Secrets](https://bun.com/docs/api/secrets) [Testing](https://bun.com/docs/cli/test) [Utils](https://bun.com/docs/api/utils) [Node-API](https://bun.com/docs/api/node-api) [Glob](https://bun.com/docs/api/glob) [DNS](https://bun.com/docs/api/dns) [Semver](https://bun.com/docs/api/semver) [Color](https://bun.com/docs/api/color) [Transpiler](https://bun.com/docs/api/transpiler)

Project

[Roadmap](https://bun.com/docs/project/roadmap) [Benchmarking](https://bun.com/docs/project/benchmarking) [Contributing](https://bun.com/docs/project/contributing) [Building Windows](https://bun.com/docs/project/building-windows) [Bindgen](https://bun.com/docs/project/bindgen) [License](https://bun.com/docs/project/licensing)

Bun implements the following globals.

| Global                                                                                                                  | Source         | Notes                                                                                                                                                                                                                                         |
| ----------------------------------------------------------------------------------------------------------------------- | -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`AbortController`](https://developer.mozilla.org/en-US/docs/Web/API/AbortController)                                   | Web            |                                                                                                                                                                                                                                               |
| [`AbortSignal`](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal)                                           | Web            |                                                                                                                                                                                                                                               |
| [`alert`](https://developer.mozilla.org/en-US/docs/Web/API/Window/alert)                                                | Web            | Intended for command-line tools                                                                                                                                                                                                               |
| [`Blob`](https://developer.mozilla.org/en-US/docs/Web/API/Blob)                                                         | Web            |                                                                                                                                                                                                                                               |
| [`Buffer`](https://nodejs.org/api/buffer.html#class-buffer)                                                             | Node.js        | See [Node.js > `Buffer`](https://bun.com/docs/runtime/nodejs-apis#node-buffer)                                                                                                                                                                |
| `Bun`                                                                                                                   | Bun            | Subject to change as additional APIs are added                                                                                                                                                                                                |
| [`ByteLengthQueuingStrategy`](https://developer.mozilla.org/en-US/docs/Web/API/ByteLengthQueuingStrategy)               | Web            |                                                                                                                                                                                                                                               |
| [`confirm`](https://developer.mozilla.org/en-US/docs/Web/API/Window/confirm)                                            | Web            | Intended for command-line tools                                                                                                                                                                                                               |
| [`__dirname`](https://nodejs.org/api/globals.html#__dirname)                                                            | Node.js        |                                                                                                                                                                                                                                               |
| [`__filename`](https://nodejs.org/api/globals.html#__filename)                                                          | Node.js        |                                                                                                                                                                                                                                               |
| [`atob()`](https://developer.mozilla.org/en-US/docs/Web/API/atob)                                                       | Web            |                                                                                                                                                                                                                                               |
| [`btoa()`](https://developer.mozilla.org/en-US/docs/Web/API/btoa)                                                       | Web            |                                                                                                                                                                                                                                               |
| `BuildMessage`                                                                                                          | Bun            |                                                                                                                                                                                                                                               |
| [`clearImmediate()`](https://developer.mozilla.org/en-US/docs/Web/API/Window/clearImmediate)                            | Web            |                                                                                                                                                                                                                                               |
| [`clearInterval()`](https://developer.mozilla.org/en-US/docs/Web/API/Window/clearInterval)                              | Web            |                                                                                                                                                                                                                                               |
| [`clearTimeout()`](https://developer.mozilla.org/en-US/docs/Web/API/Window/clearTimeout)                                | Web            |                                                                                                                                                                                                                                               |
| [`console`](https://developer.mozilla.org/en-US/docs/Web/API/console)                                                   | Web            |                                                                                                                                                                                                                                               |
| [`CountQueuingStrategy`](https://developer.mozilla.org/en-US/docs/Web/API/CountQueuingStrategy)                         | Web            |                                                                                                                                                                                                                                               |
| [`Crypto`](https://developer.mozilla.org/en-US/docs/Web/API/Crypto)                                                     | Web            |                                                                                                                                                                                                                                               |
| [`crypto`](https://developer.mozilla.org/en-US/docs/Web/API/crypto)                                                     | Web            |                                                                                                                                                                                                                                               |
| [`CryptoKey`](https://developer.mozilla.org/en-US/docs/Web/API/CryptoKey)                                               | Web            |                                                                                                                                                                                                                                               |
| [`CustomEvent`](https://developer.mozilla.org/en-US/docs/Web/API/CustomEvent)                                           | Web            |                                                                                                                                                                                                                                               |
| [`Event`](https://developer.mozilla.org/en-US/docs/Web/API/Event)                                                       | Web            | Also [`ErrorEvent`](https://developer.mozilla.org/en-US/docs/Web/API/ErrorEvent) [`CloseEvent`](https://developer.mozilla.org/en-US/docs/Web/API/CloseEvent) [`MessageEvent`](https://developer.mozilla.org/en-US/docs/Web/API/MessageEvent). |
| [`EventTarget`](https://developer.mozilla.org/en-US/docs/Web/API/EventTarget)                                           | Web            |                                                                                                                                                                                                                                               |
| [`exports`](https://nodejs.org/api/globals.html#exports)                                                                | Node.js        |                                                                                                                                                                                                                                               |
| [`fetch`](https://developer.mozilla.org/en-US/docs/Web/API/fetch)                                                       | Web            |                                                                                                                                                                                                                                               |
| [`FormData`](https://developer.mozilla.org/en-US/docs/Web/API/FormData)                                                 | Web            |                                                                                                                                                                                                                                               |
| [`global`](https://nodejs.org/api/globals.html#global)                                                                  | Node.js        | See [Node.js > `global`](https://bun.com/docs/runtime/nodejs-apis#global).                                                                                                                                                                    |
| [`globalThis`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/globalThis)             | Cross-platform | Aliases to `global`                                                                                                                                                                                                                           |
| [`Headers`](https://developer.mozilla.org/en-US/docs/Web/API/Headers)                                                   | Web            |                                                                                                                                                                                                                                               |
| [`HTMLRewriter`](https://bun.com/docs/api/html-rewriter)                                                                | Cloudflare     |                                                                                                                                                                                                                                               |
| [`JSON`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON)                         | Web            |                                                                                                                                                                                                                                               |
| [`MessageEvent`](https://developer.mozilla.org/en-US/docs/Web/API/MessageEvent)                                         | Web            |                                                                                                                                                                                                                                               |
| [`module`](https://nodejs.org/api/globals.html#module)                                                                  | Node.js        |                                                                                                                                                                                                                                               |
| [`performance`](https://developer.mozilla.org/en-US/docs/Web/API/performance)                                           | Web            |                                                                                                                                                                                                                                               |
| [`process`](https://nodejs.org/api/process.html)                                                                        | Node.js        | See [Node.js > `process`](https://bun.com/docs/runtime/nodejs-apis#node-process)                                                                                                                                                              |
| [`prompt`](https://developer.mozilla.org/en-US/docs/Web/API/Window/prompt)                                              | Web            | Intended for command-line tools                                                                                                                                                                                                               |
| [`queueMicrotask()`](https://developer.mozilla.org/en-US/docs/Web/API/queueMicrotask)                                   | Web            |                                                                                                                                                                                                                                               |
| [`ReadableByteStreamController`](https://developer.mozilla.org/en-US/docs/Web/API/ReadableByteStreamController)         | Web            |                                                                                                                                                                                                                                               |
| [`ReadableStream`](https://developer.mozilla.org/en-US/docs/Web/API/ReadableStream)                                     | Web            |                                                                                                                                                                                                                                               |
| [`ReadableStreamDefaultController`](https://developer.mozilla.org/en-US/docs/Web/API/ReadableStreamDefaultController)   | Web            |                                                                                                                                                                                                                                               |
| [`ReadableStreamDefaultReader`](https://developer.mozilla.org/en-US/docs/Web/API/ReadableStreamDefaultReader)           | Web            |                                                                                                                                                                                                                                               |
| [`reportError`](https://developer.mozilla.org/en-US/docs/Web/API/reportError)                                           | Web            |                                                                                                                                                                                                                                               |
| [`require()`](https://nodejs.org/api/globals.html#require)                                                              | Node.js        |                                                                                                                                                                                                                                               |
| `ResolveMessage`                                                                                                        | Bun            |                                                                                                                                                                                                                                               |
| [`Response`](https://developer.mozilla.org/en-US/docs/Web/API/Response)                                                 | Web            |                                                                                                                                                                                                                                               |
| [`Request`](https://developer.mozilla.org/en-US/docs/Web/API/Request)                                                   | Web            |                                                                                                                                                                                                                                               |
| [`setImmediate()`](https://developer.mozilla.org/en-US/docs/Web/API/Window/setImmediate)                                | Web            |                                                                                                                                                                                                                                               |
| [`setInterval()`](https://developer.mozilla.org/en-US/docs/Web/API/Window/setInterval)                                  | Web            |                                                                                                                                                                                                                                               |
| [`setTimeout()`](https://developer.mozilla.org/en-US/docs/Web/API/Window/setTimeout)                                    | Web            |                                                                                                                                                                                                                                               |
| [`ShadowRealm`](https://github.com/tc39/proposal-shadowrealm)                                                           | Web            | Stage 3 proposal                                                                                                                                                                                                                              |
| [`SubtleCrypto`](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto)                                         | Web            |                                                                                                                                                                                                                                               |
| [`DOMException`](https://developer.mozilla.org/en-US/docs/Web/API/DOMException)                                         | Web            |                                                                                                                                                                                                                                               |
| [`TextDecoder`](https://developer.mozilla.org/en-US/docs/Web/API/TextDecoder)                                           | Web            |                                                                                                                                                                                                                                               |
| [`TextEncoder`](https://developer.mozilla.org/en-US/docs/Web/API/TextEncoder)                                           | Web            |                                                                                                                                                                                                                                               |
| [`TransformStream`](https://developer.mozilla.org/en-US/docs/Web/API/TransformStream)                                   | Web            |                                                                                                                                                                                                                                               |
| [`TransformStreamDefaultController`](https://developer.mozilla.org/en-US/docs/Web/API/TransformStreamDefaultController) | Web            |                                                                                                                                                                                                                                               |
| [`URL`](https://developer.mozilla.org/en-US/docs/Web/API/URL)                                                           | Web            |                                                                                                                                                                                                                                               |
| [`URLSearchParams`](https://developer.mozilla.org/en-US/docs/Web/API/URLSearchParams)                                   | Web            |                                                                                                                                                                                                                                               |
| [`WebAssembly`](https://nodejs.org/api/globals.html#webassembly)                                                        | Web            |                                                                                                                                                                                                                                               |
| [`WritableStream`](https://developer.mozilla.org/en-US/docs/Web/API/WritableStream)                                     | Web            |                                                                                                                                                                                                                                               |
| [`WritableStreamDefaultController`](https://developer.mozilla.org/en-US/docs/Web/API/WritableStreamDefaultController)   | Web            |                                                                                                                                                                                                                                               |
| [`WritableStreamDefaultWriter`](https://developer.mozilla.org/en-US/docs/Web/API/WritableStreamDefaultWriter)           | Web            |                                                                                                                                                                                                                                               |

[Previous\\
\\
UDP sockets](https://bun.com/docs/api/udp) [Next\\
\\
$ Shell](https://bun.com/docs/runtime/shell)

[![GitHub logo](Base64-Image-Removed)![GitHub logo](Base64-Image-Removed)\\
\\
Edit on GitHub](https://github.com/oven-sh/bun/edit/main/docs/api/globals.md)

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
