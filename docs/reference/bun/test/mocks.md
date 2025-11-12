---
title: Mocks – Test runner | Bun Docs
url: 
description: Mocks functions and track method calls
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

[`bun test`](https://bun.com/docs/cli/test) [Writing tests](https://bun.com/docs/test/writing) [Watch mode](https://bun.com/docs/test/hot) [Lifecycle hooks](https://bun.com/docs/test/lifecycle) [Mocks](https://bun.com/docs/test/mocks)

[`.spyOn()`](https://bun.com/docs/test/mocks#spyon) [Module mocks with `mock.module()`](https://bun.com/docs/test/mocks#module-mocks-with-mock-module) [Overriding already imported modules](https://bun.com/docs/test/mocks#overriding-already-imported-modules) [Hoisting & preloading](https://bun.com/docs/test/mocks#hoisting-preloading) [`__mocks__` directory and auto-mocking](https://bun.com/docs/test/mocks#mocks-directory-and-auto-mocking) [Implementation details](https://bun.com/docs/test/mocks#implementation-details) [Module Mock Implementation Details](https://bun.com/docs/test/mocks#module-mock-implementation-details) [Global Mock Functions](https://bun.com/docs/test/mocks#global-mock-functions) [Clear all mocks with `mock.clearAllMocks()`](https://bun.com/docs/test/mocks#clear-all-mocks-with-mock-clearallmocks) [Restore all function mocks with `mock.restore()`](https://bun.com/docs/test/mocks#restore-all-function-mocks-with-mock-restore) [Vitest Compatibility](https://bun.com/docs/test/mocks#vitest-compatibility)

[Snapshots](https://bun.com/docs/test/snapshots) [Dates and times](https://bun.com/docs/test/time) [Code coverage](https://bun.com/docs/test/coverage) [Test reporters](https://bun.com/docs/test/reporters) [Test configuration](https://bun.com/docs/test/configuration) [Runtime behavior](https://bun.com/docs/test/runtime-behavior) [Finding tests](https://bun.com/docs/test/discovery) [DOM testing](https://bun.com/docs/test/dom)

Package runner

[`bunx`](https://bun.com/docs/cli/bunx)

API

[HTTP server](https://bun.com/docs/api/http) [HTTP client](https://bun.com/docs/api/fetch) [WebSockets](https://bun.com/docs/api/websockets) [Workers](https://bun.com/docs/api/workers) [Binary data](https://bun.com/docs/api/binary-data) [Streams](https://bun.com/docs/api/streams) [SQL](https://bun.com/docs/api/sql) [S3 Object Storage](https://bun.com/docs/api/s3) [File I/O](https://bun.com/docs/api/file-io) [Redis client](https://bun.com/docs/api/redis) [import.meta](https://bun.com/docs/api/import-meta) [SQLite](https://bun.com/docs/api/sqlite) [FileSystemRouter](https://bun.com/docs/api/file-system-router) [TCP sockets](https://bun.com/docs/api/tcp) [UDP sockets](https://bun.com/docs/api/udp) [Globals](https://bun.com/docs/api/globals) [$ Shell](https://bun.com/docs/runtime/shell) [Child processes](https://bun.com/docs/api/spawn) [YAML](https://bun.com/docs/api/yaml) [HTMLRewriter](https://bun.com/docs/api/html-rewriter) [Hashing](https://bun.com/docs/api/hashing) [Console](https://bun.com/docs/api/console) [Cookie](https://bun.com/docs/api/cookie) [FFI](https://bun.com/docs/api/ffi) [C Compiler](https://bun.com/docs/api/cc) [Secrets](https://bun.com/docs/api/secrets) [Testing](https://bun.com/docs/cli/test) [Utils](https://bun.com/docs/api/utils) [Node-API](https://bun.com/docs/api/node-api) [Glob](https://bun.com/docs/api/glob) [DNS](https://bun.com/docs/api/dns) [Semver](https://bun.com/docs/api/semver) [Color](https://bun.com/docs/api/color) [Transpiler](https://bun.com/docs/api/transpiler)

Project

[Roadmap](https://bun.com/docs/project/roadmap) [Benchmarking](https://bun.com/docs/project/benchmarking) [Contributing](https://bun.com/docs/project/contributing) [Building Windows](https://bun.com/docs/project/building-windows) [Bindgen](https://bun.com/docs/project/bindgen) [License](https://bun.com/docs/project/licensing)

Create mocks with the `mock` function.

```
import { test, expect, mock } from "bun:test";
const random = mock(() => Math.random());

test("random", async () => {
  const val = random();
  expect(val).toBeGreaterThan(0);
  expect(random).toHaveBeenCalled();
  expect(random).toHaveBeenCalledTimes(1);
});

```

Alternatively, you can use the `jest.fn()` function, as in Jest. It behaves identically.

```
import { test, expect, jest } from "bun:test";
const random = jest.fn(() => Math.random());

test("random", async () => {
  const val = random();
  expect(val).toBeGreaterThan(0);
  expect(random).toHaveBeenCalled();
  expect(random).toHaveBeenCalledTimes(1);
});

```

The result of `mock()` is a new function that's been decorated with some additional properties.

```
import { mock } from "bun:test";
const random = mock((multiplier: number) => multiplier * Math.random());

random(2);
random(10);

random.mock.calls;
// [[ 2 ], [ 10 ]]

random.mock.results;
//  [\
//    { type: "return", value: 0.6533907460954099 },\
//    { type: "return", value: 0.6452713933037312 }\
//  ]

```

The following properties and methods are implemented on mock functions.

[mockFn.getMockName()](https://jestjs.io/docs/mock-function-api#mockfngetmockname)

[mockFn.mock.calls](https://jestjs.io/docs/mock-function-api#mockfnmockcalls)

[mockFn.mock.results](https://jestjs.io/docs/mock-function-api#mockfnmockresults)

[mockFn.mock.instances](https://jestjs.io/docs/mock-function-api#mockfnmockinstances)

[mockFn.mock.contexts](https://jestjs.io/docs/mock-function-api#mockfnmockcontexts)

[mockFn.mock.lastCall](https://jestjs.io/docs/mock-function-api#mockfnmocklastcall)

[mockFn.mockClear()](https://jestjs.io/docs/mock-function-api#mockfnmockclear) \- Clears call history

[mockFn.mockReset()](https://jestjs.io/docs/mock-function-api#mockfnmockreset) \- Clears call history and removes implementation

[mockFn.mockRestore()](https://jestjs.io/docs/mock-function-api#mockfnmockrestore) \- Restores original implementation

[mockFn.mockImplementation(fn)](https://jestjs.io/docs/mock-function-api#mockfnmockimplementationfn)

[mockFn.mockImplementationOnce(fn)](https://jestjs.io/docs/mock-function-api#mockfnmockimplementationoncefn)

[mockFn.mockName(name)](https://jestjs.io/docs/mock-function-api#mockfnmocknamename)

[mockFn.mockReturnThis()](https://jestjs.io/docs/mock-function-api#mockfnmockreturnthis)

[mockFn.mockReturnValue(value)](https://jestjs.io/docs/mock-function-api#mockfnmockreturnvaluevalue)

[mockFn.mockReturnValueOnce(value)](https://jestjs.io/docs/mock-function-api#mockfnmockreturnvalueoncevalue)

[mockFn.mockResolvedValue(value)](https://jestjs.io/docs/mock-function-api#mockfnmockresolvedvaluevalue)

[mockFn.mockResolvedValueOnce(value)](https://jestjs.io/docs/mock-function-api#mockfnmockresolvedvalueoncevalue)

[mockFn.mockRejectedValue(value)](https://jestjs.io/docs/mock-function-api#mockfnmockrejectedvaluevalue)

[mockFn.mockRejectedValueOnce(value)](https://jestjs.io/docs/mock-function-api#mockfnmockrejectedvalueoncevalue)

[mockFn.withImplementation(fn, callback)](https://jestjs.io/docs/mock-function-api#mockfnwithimplementationfn-callback)

## [`.spyOn()`](https://bun.com/docs/test/mocks\#spyon)

It's possible to track calls to a function without replacing it with a mock. Use `spyOn()` to create a spy; these spies can be passed to `.toHaveBeenCalled()` and `.toHaveBeenCalledTimes()`.

```
import { test, expect, spyOn } from "bun:test";

const ringo = {
  name: "Ringo",
  sayHi() {
    console.log(`Hello I'm ${this.name}`);
  },
};

const spy = spyOn(ringo, "sayHi");

test("spyon", () => {
  expect(spy).toHaveBeenCalledTimes(0);
  ringo.sayHi();
  expect(spy).toHaveBeenCalledTimes(1);
});

```

## [Module mocks with `mock.module()`](https://bun.com/docs/test/mocks\#module-mocks-with-mock-module)

Module mocking lets you override the behavior of a module. Use `mock.module(path: string, callback: () => Object)` to mock a module.

```
import { test, expect, mock } from "bun:test";

mock.module("./module", () => {
  return {
    foo: "bar",
  };
});

test("mock.module", async () => {
  const esm = await import("./module");
  expect(esm.foo).toBe("bar");

  const cjs = require("./module");
  expect(cjs.foo).toBe("bar");
});

```

Like the rest of Bun, module mocks support both `import` and `require`.

### [Overriding already imported modules](https://bun.com/docs/test/mocks\#overriding-already-imported-modules)

If you need to override a module that's already been imported, there's nothing special you need to do. Just call `mock.module()` and the module will be overridden.

```
import { test, expect, mock } from "bun:test";

// The module we're going to mock is here:
import { foo } from "./module";

test("mock.module", async () => {
  const cjs = require("./module");
  expect(foo).toBe("bar");
  expect(cjs.foo).toBe("bar");

  // We update it here:
  mock.module("./module", () => {
    return {
      foo: "baz",
    };
  });

  // And the live bindings are updated.
  expect(foo).toBe("baz");

  // The module is also updated for CJS.
  expect(cjs.foo).toBe("baz");
});

```

### [Hoisting & preloading](https://bun.com/docs/test/mocks\#hoisting-preloading)

If you need to ensure a module is mocked before it's imported, you should use `--preload` to load your mocks before your tests run.

```
// my-preload.ts
import { mock } from "bun:test";

mock.module("./module", () => {
  return {
    foo: "bar",
  };
});

```

```
bun test --preload ./my-preload

```

To make your life easier, you can put `preload` in your `bunfig.toml`:

```

[test]
# Load these modules before running tests.
preload = ["./my-preload"]

```

#### What happens if I mock a module that's already been imported?

If you mock a module that's already been imported, the module will be updated in the module cache. This means that any modules that import the module will get the mocked version, BUT the original module will still have been evaluated. That means that any side effects from the original module will still have happened.

If you want to prevent the original module from being evaluated, you should use `--preload` to load your mocks before your tests run.

### [`__mocks__` directory and auto-mocking](https://bun.com/docs/test/mocks\#mocks-directory-and-auto-mocking)

Auto-mocking is not supported yet. If this is blocking you from switching to Bun, please file an issue.

### [Implementation details](https://bun.com/docs/test/mocks\#implementation-details)

Module mocks have different implementations for ESM and CommonJS modules. For ES Modules, we've added patches to JavaScriptCore that allow Bun to override export values at runtime and update live bindings recursively.

As of Bun v1.0.19, Bun automatically resolves the `specifier` argument to `mock.module()` as though you did an `import`. If it successfully resolves, then the resolved specifier string is used as the key in the module cache. This means that you can use relative paths, absolute paths, and even module names. If the `specifier` doesn't resolve, then the original `specifier` is used as the key in the module cache.

After resolution, the mocked module is stored in the ES Module registry **and** the CommonJS require cache. This means that you can use `import` and `require` interchangeably for mocked modules.

The callback function is called lazily, only if the module is imported or required. This means that you can use `mock.module()` to mock modules that don't exist yet, and it means that you can use `mock.module()` to mock modules that are imported by other modules.

### [Module Mock Implementation Details](https://bun.com/docs/test/mocks\#module-mock-implementation-details)

Understanding how `mock.module()` works helps you use it more effectively:

1. **Cache Interaction**: Module mocks interacts with both ESM and CommonJS module caches.

2. **Lazy Evaluation**: The mock factory callback is only evaluated when the module is actually imported or required.

3. **Path Resolution**: Bun automatically resolves the module specifier as though you were doing an import, supporting:

   - Relative paths ( `'./module'`)
   - Absolute paths ( `'/path/to/module'`)
   - Package names ( `'lodash'`)
4. **Import Timing Effects**:

   - When mocking before first import: No side effects from the original module occur
   - When mocking after import: The original module's side effects have already happened
   - For this reason, using `--preload` is recommended for mocks that need to prevent side effects
5. **Live Bindings**: Mocked ESM modules maintain live bindings, so changing the mock will update all existing imports


## [Global Mock Functions](https://bun.com/docs/test/mocks\#global-mock-functions)

### [Clear all mocks with `mock.clearAllMocks()`](https://bun.com/docs/test/mocks\#clear-all-mocks-with-mock-clearallmocks)

Reset all mock function state (calls, results, etc.) without restoring their original implementation:

```
import { expect, mock, test } from "bun:test";

const random1 = mock(() => Math.random());
const random2 = mock(() => Math.random());

test("clearing all mocks", () => {
  random1();
  random2();

  expect(random1).toHaveBeenCalledTimes(1);
  expect(random2).toHaveBeenCalledTimes(1);

  mock.clearAllMocks();

  expect(random1).toHaveBeenCalledTimes(0);
  expect(random2).toHaveBeenCalledTimes(0);

  // Note: implementations are preserved
  expect(typeof random1()).toBe("number");
  expect(typeof random2()).toBe("number");
});

```

This resets the `.mock.calls`, `.mock.instances`, `.mock.contexts`, and `.mock.results` properties of all mocks, but unlike `mock.restore()`, it does not restore the original implementation.

### [Restore all function mocks with `mock.restore()`](https://bun.com/docs/test/mocks\#restore-all-function-mocks-with-mock-restore)

Instead of manually restoring each mock individually with `mockFn.mockRestore()`, restore all mocks with one command by calling `mock.restore()`. Doing so does not reset the value of modules overridden with `mock.module()`.

Using `mock.restore()` can reduce the amount of code in your tests by adding it to `afterEach` blocks in each test file or even in your [test preload code](https://bun.sh/docs/runtime/bunfig#test-preload).

```
import { expect, mock, spyOn, test } from "bun:test";

import * as fooModule from "./foo.ts";
import * as barModule from "./bar.ts";
import * as bazModule from "./baz.ts";

test("foo, bar, baz", () => {
  const fooSpy = spyOn(fooModule, "foo");
  const barSpy = spyOn(barModule, "bar");
  const bazSpy = spyOn(bazModule, "baz");

  expect(fooSpy).toBe("foo");
  expect(barSpy).toBe("bar");
  expect(bazSpy).toBe("baz");

  fooSpy.mockImplementation(() => 42);
  barSpy.mockImplementation(() => 43);
  bazSpy.mockImplementation(() => 44);

  expect(fooSpy).toBe(42);
  expect(barSpy).toBe(43);
  expect(bazSpy).toBe(44);

  mock.restore();

  expect(fooSpy).toBe("foo");
  expect(barSpy).toBe("bar");
  expect(bazSpy).toBe("baz");
});

```

## [Vitest Compatibility](https://bun.com/docs/test/mocks\#vitest-compatibility)

For added compatibility with tests written for [Vitest](https://vitest.dev/), Bun provides the `vi` global object as an alias for parts of the Jest mocking API:

```
import { test, expect } from "bun:test";

// Using the 'vi' alias similar to Vitest
test("vitest compatibility", () => {
  const mockFn = vi.fn(() => 42);

  mockFn();
  expect(mockFn).toHaveBeenCalled();

  // The following functions are available on the vi object:
  // vi.fn
  // vi.spyOn
  // vi.mock
  // vi.restoreAllMocks
  // vi.clearAllMocks
});

```

This makes it easier to port tests from Vitest to Bun without having to rewrite all your mocks.

[Previous\\
\\
Lifecycle hooks](https://bun.com/docs/test/lifecycle) [Next\\
\\
Snapshots](https://bun.com/docs/test/snapshots)

[![GitHub logo](<Base64-Image-Removed>)![GitHub logo](<Base64-Image-Removed>)\\
\\
Edit on GitHub](https://github.com/oven-sh/bun/edit/main/docs/test/mocks.md)

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