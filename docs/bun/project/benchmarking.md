---
title: Benchmarking – Project | Bun Docs
url: 
description: Bun is designed for performance. Learn how to benchmark Bun yourself.
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

[Roadmap](https://bun.com/docs/project/roadmap) [Benchmarking](https://bun.com/docs/project/benchmarking)

[Measuring time](https://bun.com/docs/project/benchmarking#measuring-time) [Benchmarking tools](https://bun.com/docs/project/benchmarking#benchmarking-tools) [Measuring memory usage](https://bun.com/docs/project/benchmarking#measuring-memory-usage) [JavaScript heap stats](https://bun.com/docs/project/benchmarking#javascript-heap-stats) [Native heap stats](https://bun.com/docs/project/benchmarking#native-heap-stats)

[Contributing](https://bun.com/docs/project/contributing) [Building Windows](https://bun.com/docs/project/building-windows) [Bindgen](https://bun.com/docs/project/bindgen) [License](https://bun.com/docs/project/licensing)

Bun is designed for speed. Hot paths are extensively profiled and benchmarked. The source code for all of Bun's public benchmarks can be found in the [`/bench`](https://github.com/oven-sh/bun/tree/main/bench) directory of the Bun repo.

## [Measuring time](https://bun.com/docs/project/benchmarking\#measuring-time)

To precisely measure time, Bun offers two runtime APIs functions:

1. The Web-standard [`performance.now()`](https://developer.mozilla.org/en-US/docs/Web/API/Performance/now) function
2. `Bun.nanoseconds()` which is similar to `performance.now()` except it returns the current time since the application started in nanoseconds. You can use `performance.timeOrigin` to convert this to a Unix timestamp.

## [Benchmarking tools](https://bun.com/docs/project/benchmarking\#benchmarking-tools)

When writing your own benchmarks, it's important to choose the right tool.

- For microbenchmarks, a great general-purpose tool is [`mitata`](https://github.com/evanwashere/mitata).
- For load testing, you _must use_ an HTTP benchmarking tool that is at least as fast as `Bun.serve()`, or your results will be skewed. Some popular Node.js-based benchmarking tools like [`autocannon`](https://github.com/mcollina/autocannon) are not fast enough. We recommend one of the following:
  - [`bombardier`](https://github.com/codesenberg/bombardier)
  - [`oha`](https://github.com/hatoo/oha)
  - [`http_load_test`](https://github.com/uNetworking/uSockets/blob/master/examples/http_load_test.c)
- For benchmarking scripts or CLI commands, we recommend [`hyperfine`](https://github.com/sharkdp/hyperfine).

## [Measuring memory usage](https://bun.com/docs/project/benchmarking\#measuring-memory-usage)

Bun has two heaps. One heap is for the JavaScript runtime and the other heap is for everything else.

[#](https://bun.com/docs/project/benchmarking#bunjsc)

### [JavaScript heap stats](https://bun.com/docs/project/benchmarking\#javascript-heap-stats)

The `bun:jsc` module exposes a few functions for measuring memory usage:

```
import { heapStats } from "bun:jsc";
console.log(heapStats());

```

View example statistics

```
{
  heapSize: 1657575,
  heapCapacity: 2872775,
  extraMemorySize: 598199,
  objectCount: 13790,
  protectedObjectCount: 62,
  globalObjectCount: 1,
  protectedGlobalObjectCount: 1,
  // A count of every object type in the heap
  objectTypeCounts: {
    CallbackObject: 25,
    FunctionExecutable: 2078,
    AsyncGeneratorFunction: 2,
    'RegExp String Iterator': 1,
    FunctionCodeBlock: 188,
    ModuleProgramExecutable: 13,
    String: 1,
    UnlinkedModuleProgramCodeBlock: 13,
    JSON: 1,
    AsyncGenerator: 1,
    Symbol: 1,
    GetterSetter: 68,
    ImportMeta: 10,
    DOMAttributeGetterSetter: 1,
    UnlinkedFunctionCodeBlock: 174,
    RegExp: 52,
    ModuleLoader: 1,
    Intl: 1,
    WeakMap: 4,
    Generator: 2,
    PropertyTable: 95,
    'Array Iterator': 1,
    JSLexicalEnvironment: 75,
    UnlinkedFunctionExecutable: 2067,
    WeakSet: 1,
    console: 1,
    Map: 23,
    SparseArrayValueMap: 14,
    StructureChain: 19,
    Set: 18,
    'String Iterator': 1,
    FunctionRareData: 3,
    JSGlobalLexicalEnvironment: 1,
    Object: 481,
    BigInt: 2,
    StructureRareData: 55,
    Array: 179,
    AbortController: 2,
    ModuleNamespaceObject: 11,
    ShadowRealm: 1,
    'Immutable Butterfly': 103,
    Primordials: 1,
    'Set Iterator': 1,
    JSGlobalProxy: 1,
    AsyncFromSyncIterator: 1,
    ModuleRecord: 13,
    FinalizationRegistry: 1,
    AsyncIterator: 1,
    InternalPromise: 22,
    Iterator: 1,
    CustomGetterSetter: 65,
    Promise: 19,
    WeakRef: 1,
    InternalPromisePrototype: 1,
    Function: 2381,
    AsyncFunction: 2,
    GlobalObject: 1,
    ArrayBuffer: 2,
    Boolean: 1,
    Math: 1,
    CallbackConstructor: 1,
    Error: 2,
    JSModuleEnvironment: 13,
    WebAssembly: 1,
    HashMapBucket: 300,
    Callee: 3,
    symbol: 37,
    string: 2484,
    Performance: 1,
    ModuleProgramCodeBlock: 12,
    JSSourceCode: 13,
    JSPropertyNameEnumerator: 3,
    NativeExecutable: 290,
    Number: 1,
    Structure: 1550,
    SymbolTable: 108,
    GeneratorFunction: 2,
    'Map Iterator': 1
  },
  protectedObjectTypeCounts: {
    CallbackConstructor: 1,
    BigInt: 1,
    RegExp: 2,
    GlobalObject: 1,
    UnlinkedModuleProgramCodeBlock: 13,
    HashMapBucket: 2,
    Structure: 41,
    JSPropertyNameEnumerator: 1
  }
}

```

JavaScript is a garbage-collected language, not reference counted. It's normal and correct for objects to not be freed immediately in all cases, though it's not normal for objects to never be freed.

To force garbage collection to run manually:

```
Bun.gc(true); // synchronous
Bun.gc(false); // asynchronous

```

Heap snapshots let you inspect what objects are not being freed. You can use the `bun:jsc` module to take a heap snapshot and then view it with Safari or WebKit GTK developer tools. To generate a heap snapshot:

```
import { generateHeapSnapshot } from "bun";

const snapshot = generateHeapSnapshot();
await Bun.write("heap.json", JSON.stringify(snapshot, null, 2));

```

To view the snapshot, open the `heap.json` file in Safari's Developer Tools (or WebKit GTK)

1. Open the Developer Tools
2. Click "Timeline"
3. Click "JavaScript Allocations" in the menu on the left. It might not be visible until you click the pencil icon to show all the timelines
4. Click "Import" and select your heap snapshot JSON

[![Import heap json](https://user-images.githubusercontent.com/709451/204428943-ba999e8f-8984-4f23-97cb-b4e3e280363e.png)](https://user-images.githubusercontent.com/709451/204428943-ba999e8f-8984-4f23-97cb-b4e3e280363e.png) Importing a heap snapshot

Once imported, you should see something like this:

[![Viewing heap snapshot in Safari](https://user-images.githubusercontent.com/709451/204429337-b0d8935f-3509-4071-b991-217794d1fb27.png)](https://user-images.githubusercontent.com/709451/204429337-b0d8935f-3509-4071-b991-217794d1fb27.png) Viewing heap snapshot in Safari Dev Tools

The [web debugger](https://bun.com/docs/runtime/debugger#inspect) also offers the timeline feature which allows you to track and examine the memory usage of the running debug session.

### [Native heap stats](https://bun.com/docs/project/benchmarking\#native-heap-stats)

Bun uses mimalloc for the other heap. To report a summary of non-JavaScript memory usage, set the `MIMALLOC_SHOW_STATS=1` environment variable. and stats will print on exit.

```
MIMALLOC_SHOW_STATS=1 bun script.js

# will show something like this:
heap stats:    peak      total      freed    current       unit      count
  reserved:   64.0 MiB   64.0 MiB      0       64.0 MiB                        not all freed!
 committed:   64.0 MiB   64.0 MiB      0       64.0 MiB                        not all freed!
     reset:      0          0          0          0                            ok
   touched:  128.5 KiB  128.5 KiB    5.4 MiB   -5.3 MiB                        ok
  segments:      1          1          0          1                            not all freed!
-abandoned:      0          0          0          0                            ok
   -cached:      0          0          0          0                            ok
     pages:      0          0         53        -53                            ok
-abandoned:      0          0          0          0                            ok
 -extended:      0
 -noretire:      0
     mmaps:      0
   commits:      0
   threads:      0          0          0          0                            ok
  searches:     0.0 avg
numa nodes:       1
   elapsed:       0.068 s
   process: user: 0.061 s, system: 0.014 s, faults: 0, rss: 57.4 MiB, commit: 64.0 MiB

```

[Previous\\
\\
Roadmap](https://bun.com/docs/project/roadmap) [Next\\
\\
Contributing](https://bun.com/docs/project/contributing)

[![GitHub logo](<Base64-Image-Removed>)![GitHub logo](<Base64-Image-Removed>)\\
\\
Edit on GitHub](https://github.com/oven-sh/bun/edit/main/docs/project/benchmarking.md)

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