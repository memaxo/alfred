---
title: Hot reloading – Bundler | Bun Docs
url:
description: Update modules in a running application without reloading the page using import.meta.hot
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

[`Bun.build`](https://bun.com/docs/bundler) [HTML & static sites](https://bun.com/docs/bundler/html) [CSS](https://bun.com/docs/bundler/css) [Fullstack Dev Server](https://bun.com/docs/bundler/fullstack) [Hot reloading](https://bun.com/docs/bundler/hmr)

[`import.meta.hot` API Reference](https://bun.com/docs/bundler/hmr#import-meta-hot-api-reference)

[Loaders](https://bun.com/docs/bundler/loaders) [Plugins](https://bun.com/docs/bundler/plugins) [Macros](https://bun.com/docs/bundler/macros) [vs esbuild](https://bun.com/docs/bundler/vs-esbuild)

Test runner

[`bun test`](https://bun.com/docs/cli/test) [Writing tests](https://bun.com/docs/test/writing) [Watch mode](https://bun.com/docs/test/hot) [Lifecycle hooks](https://bun.com/docs/test/lifecycle) [Mocks](https://bun.com/docs/test/mocks) [Snapshots](https://bun.com/docs/test/snapshots) [Dates and times](https://bun.com/docs/test/time) [Code coverage](https://bun.com/docs/test/coverage) [Test reporters](https://bun.com/docs/test/reporters) [Test configuration](https://bun.com/docs/test/configuration) [Runtime behavior](https://bun.com/docs/test/runtime-behavior) [Finding tests](https://bun.com/docs/test/discovery) [DOM testing](https://bun.com/docs/test/dom)

Package runner

[`bunx`](https://bun.com/docs/cli/bunx)

API

[HTTP server](https://bun.com/docs/api/http) [HTTP client](https://bun.com/docs/api/fetch) [WebSockets](https://bun.com/docs/api/websockets) [Workers](https://bun.com/docs/api/workers) [Binary data](https://bun.com/docs/api/binary-data) [Streams](https://bun.com/docs/api/streams) [SQL](https://bun.com/docs/api/sql) [S3 Object Storage](https://bun.com/docs/api/s3) [File I/O](https://bun.com/docs/api/file-io) [Redis client](https://bun.com/docs/api/redis) [import.meta](https://bun.com/docs/api/import-meta) [SQLite](https://bun.com/docs/api/sqlite) [FileSystemRouter](https://bun.com/docs/api/file-system-router) [TCP sockets](https://bun.com/docs/api/tcp) [UDP sockets](https://bun.com/docs/api/udp) [Globals](https://bun.com/docs/api/globals) [$ Shell](https://bun.com/docs/runtime/shell) [Child processes](https://bun.com/docs/api/spawn) [YAML](https://bun.com/docs/api/yaml) [HTMLRewriter](https://bun.com/docs/api/html-rewriter) [Hashing](https://bun.com/docs/api/hashing) [Console](https://bun.com/docs/api/console) [Cookie](https://bun.com/docs/api/cookie) [FFI](https://bun.com/docs/api/ffi) [C Compiler](https://bun.com/docs/api/cc) [Secrets](https://bun.com/docs/api/secrets) [Testing](https://bun.com/docs/cli/test) [Utils](https://bun.com/docs/api/utils) [Node-API](https://bun.com/docs/api/node-api) [Glob](https://bun.com/docs/api/glob) [DNS](https://bun.com/docs/api/dns) [Semver](https://bun.com/docs/api/semver) [Color](https://bun.com/docs/api/color) [Transpiler](https://bun.com/docs/api/transpiler)

Project

[Roadmap](https://bun.com/docs/project/roadmap) [Benchmarking](https://bun.com/docs/project/benchmarking) [Contributing](https://bun.com/docs/project/contributing) [Building Windows](https://bun.com/docs/project/building-windows) [Bindgen](https://bun.com/docs/project/bindgen) [License](https://bun.com/docs/project/licensing)

Hot Module Replacement (HMR) allows you to update modules in a runningapplication without needing a full page reload. This preserves the applicationstate and improves the development experience.

HMR is enabled by default when using Bun's full-stack development server.

## [`import.meta.hot` API Reference](https://bun.com/docs/bundler/hmr#import-meta-hot-api-reference)

Bun implements a client-side HMR API modeled after [Vite's `import.meta.hot` API](https://vitejs.dev/guide/api-hmr.html). It can be checked for with `if (import.meta.hot)`, tree-shaking it in production

```
if (import.meta.hot) {
  // HMR APIs are available.
}

```

However, **this check is often not needed** as Bun will dead-code-eliminatecalls to all of the HMR APIs in production builds.

```
// This entire function call will be removed in production!
import.meta.hot.dispose(() => {
  console.log("dispose");
});

```

For this to work, Bun forces these APIs to be called without indirection. That means the following do not work:

invalid-hmr-usage.ts

```
// INVALID: Assigning `hot` to a variable
const hot = import.meta.hot;
hot.accept();

// INVALID: Assigning `import.meta` to a variable
const meta = import.meta;
meta.hot.accept();
console.log(meta.hot.data);

// INVALID: Passing to a function
doSomething(import.meta.hot.dispose);

// OK: The full phrase "import.meta.hot.<API>" must be called directly:
import.meta.hot.accept();

// OK: `data` can be passed to functions:
doSomething(import.meta.hot.data);

```

**Note** — The HMR API is still a work in progress. Some features are missing. HMR can be disabled in `Bun.serve` by setting the `development` option to `{ hmr: false }`.

|     | Method             | Notes                                                                 |
| --- | ------------------ | --------------------------------------------------------------------- |
| ✅  | `hot.accept()`     | Indicate that a hot update can be replaced gracefully.                |
| ✅  | `hot.data`         | Persist data between module evaluations.                              |
| ✅  | `hot.dispose()`    | Add a callback function to run when a module is about to be replaced. |
| ❌  | `hot.invalidate()` |                                                                       |
| ✅  | `hot.on()`         | Attach an event listener                                              |
| ✅  | `hot.off()`        | Remove an event listener from `on`.                                   |
| ❌  | `hot.send()`       |                                                                       |
| 🚧  | `hot.prune()`      | **NOTE**: Callback is currently never called.                         |
| ✅  | `hot.decline()`    | No-op to match Vite's `import.meta.hot`                               |

### [`import.meta.hot.accept()`](https://bun.com/docs/bundler/hmr#import-meta-hot-accept)

The `accept()` method indicates that a module can be hot-replaced. When calledwithout arguments, it indicates that this module can be replaced simply byre-evaluating the file. After a hot update, importers of this module will beautomatically patched.

index.ts

```
import { getCount } from "./foo.ts";

console.log("count is ", getCount());

import.meta.hot.accept();

export function getNegativeCount() {
  return -getCount();
}

```

This creates a hot-reloading boundary for all of the files that `index.ts` imports. That means whenever `foo.ts` or any of its dependencies are saved, theupdate will bubble up to `index.ts` will re-evaluate. Files that import `index.ts` will then be patched to import the new version of `getNegativeCount()`. If only `index.ts` is updated, only the one file will bere-evaluated, and the counter in `foo.ts` is reused.

This may be used in combination with `import.meta.hot.data` to transfer statefrom the previous module to the new one.

When no modules call `import.meta.hot.accept()` (and there isn't React FastRefresh or a plugin calling it for you), the page will reload when the fileupdates, and a console warning shows which files were invalidated. This warningis safe to ignore if it makes more sense to rely on full page reloads.

#### With callback

When provided one callback, `import.meta.hot.accept` will function how it doesin Vite. Instead of patching the importers of this module, it will call thecallback with the new module.

```
export const count = 0;

import.meta.hot.accept(newModule => {
  if (newModule) {
    // newModule is undefined when SyntaxError happened
    console.log("updated: count is now ", newModule.count);
  }
});

```

Prefer using `import.meta.hot.accept()` without an argument as it usually makes your code easier to understand.

#### Accepting other modules

```
import { count } from "./foo";

import.meta.hot.accept("./foo", () => {
  if (!newModule) return;

  console.log("updated: count is now ", count);
});

```

Indicates that a dependency's module can be accepted. When the dependency is updated, the callback will be called with the new module.

#### With multiple dependencies

```
import.meta.hot.accept(["./foo", "./bar"], newModules => {
  // newModules is an array where each item corresponds to the updated module
  // or undefined if that module had a syntax error
});

```

Indicates that multiple dependencies' modules can be accepted. This variant accepts an array of dependencies, where the callback will receive the updated modules, and `undefined` for any that had errors.

### [`import.meta.hot.data`](https://bun.com/docs/bundler/hmr#import-meta-hot-data)

`import.meta.hot.data` maintains state between module instances during hotreplacement, enabling data transfer from previous to new versions. When `import.meta.hot.data` is written into, Bun will also mark this module ascapable of self-accepting (equivalent of calling `import.meta.hot.accept()`).

```
import { createRoot } from "react-dom/client";
import { App } from "./app";

const root = import.meta.hot.data.root ??= createRoot(elem);
root.render(<App />); // re-use an existing root

```

In production, `data` is inlined to be `{}`, meaning it cannot be used as a state holder.

The above pattern is recommended for stateful modules because Bun knows it can minify `{}.prop ??= value` into `value` in production.

### [`import.meta.hot.dispose()`](https://bun.com/docs/bundler/hmr#import-meta-hot-dispose)

Attaches an on-dispose callback. This is called:

- Just before the module is replaced with another copy (before the next is loaded)
- After the module is detached (removing all imports to this module, see `import.meta.hot.prune()`)

```
const sideEffect = setupSideEffect();

import.meta.hot.dispose(() => {
  sideEffect.cleanup();
});

```

This callback is not called on route navigation or when the browser tab closes.

Returning a promise will delay module replacement until the module is disposed.All dispose callbacks are called in parallel.

### [`import.meta.hot.prune()`](https://bun.com/docs/bundler/hmr#import-meta-hot-prune)

Attaches an on-prune callback. This is called when all imports to this moduleare removed, but the module was previously loaded.

This can be used to clean up resources that were created when the module wasloaded. Unlike `import.meta.hot.dispose()`, this pairs much better with `accept` and `data` to manage stateful resources. A full example managing a `WebSocket`:

```
import { something } from "./something";

// Initialize or re-use a WebSocket connection
export const ws = (import.meta.hot.data.ws ??= new WebSocket(location.origin));

// If the module's import is removed, clean up the WebSocket connection.
import.meta.hot.prune(() => {
  ws.close();
});

```

If `dispose` was used instead, the WebSocket would close and re-open on everyhot update. Both versions of the code will prevent page reloads when importedfiles are updated.

### [`import.meta.hot.on()` and `off()`](https://bun.com/docs/bundler/hmr#import-meta-hot-on-and-off)

`on()` and `off()` are used to listen for events from the HMR runtime. Event names are prefixed with a prefix so that plugins do not conflict with each other.

```
import.meta.hot.on("bun:beforeUpdate", () => {
  console.log("before a hot update");
});

```

When a file is replaced, all of its event listeners are automatically removed.

A list of all built-in events:

| Event                  | Emitted when                                                                                    |
| ---------------------- | ----------------------------------------------------------------------------------------------- |
| `bun:beforeUpdate`     | before a hot update is applied.                                                                 |
| `bun:afterUpdate`      | after a hot update is applied.                                                                  |
| `bun:beforeFullReload` | before a full page reload happens.                                                              |
| `bun:beforePrune`      | before prune callbacks are called.                                                              |
| `bun:invalidate`       | when a module is invalidated with `import.meta.hot.invalidate()`                                |
| `bun:error`            | when a build or runtime error occurs                                                            |
| `bun:ws:disconnect`    | when the HMR WebSocket connection is lost. This can indicate the development server is offline. |
| `bun:ws:connect`       | when the HMR WebSocket connects or re-connects.                                                 |

For compatibility with Vite, the above events are also available via `vite:*` prefix instead of `bun:*`.

[Previous\\
\\
Fullstack Dev Server](https://bun.com/docs/bundler/fullstack) [Next\\
\\
Loaders](https://bun.com/docs/bundler/loaders)

[![GitHub logo](Base64-Image-Removed)![GitHub logo](Base64-Image-Removed)\\
\\
Edit on GitHub](https://github.com/oven-sh/bun/edit/main/docs/bundler/hmr.md)

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
