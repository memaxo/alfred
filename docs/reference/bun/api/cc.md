---
title: C Compiler – API | Bun Docs
url:
description: Build & run native C from JavaScript with Bun's native C compiler API
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

[HTTP server](https://bun.com/docs/api/http) [HTTP client](https://bun.com/docs/api/fetch) [WebSockets](https://bun.com/docs/api/websockets) [Workers](https://bun.com/docs/api/workers) [Binary data](https://bun.com/docs/api/binary-data) [Streams](https://bun.com/docs/api/streams) [SQL](https://bun.com/docs/api/sql) [S3 Object Storage](https://bun.com/docs/api/s3) [File I/O](https://bun.com/docs/api/file-io) [Redis client](https://bun.com/docs/api/redis) [import.meta](https://bun.com/docs/api/import-meta) [SQLite](https://bun.com/docs/api/sqlite) [FileSystemRouter](https://bun.com/docs/api/file-system-router) [TCP sockets](https://bun.com/docs/api/tcp) [UDP sockets](https://bun.com/docs/api/udp) [Globals](https://bun.com/docs/api/globals) [$ Shell](https://bun.com/docs/runtime/shell) [Child processes](https://bun.com/docs/api/spawn) [YAML](https://bun.com/docs/api/yaml) [HTMLRewriter](https://bun.com/docs/api/html-rewriter) [Hashing](https://bun.com/docs/api/hashing) [Console](https://bun.com/docs/api/console) [Cookie](https://bun.com/docs/api/cookie) [FFI](https://bun.com/docs/api/ffi) [C Compiler](https://bun.com/docs/api/cc)

[Usage (cc in `bun:ffi`)](https://bun.com/docs/api/cc#usage-cc-in-bun-ffi) [Primitive types](https://bun.com/docs/api/cc#primitive-types) [Strings, objects, and non-primitive types](https://bun.com/docs/api/cc#strings-objects-and-non-primitive-types) [`cc` Reference](https://bun.com/docs/api/cc#cc-reference)

[Secrets](https://bun.com/docs/api/secrets) [Testing](https://bun.com/docs/cli/test) [Utils](https://bun.com/docs/api/utils) [Node-API](https://bun.com/docs/api/node-api) [Glob](https://bun.com/docs/api/glob) [DNS](https://bun.com/docs/api/dns) [Semver](https://bun.com/docs/api/semver) [Color](https://bun.com/docs/api/color) [Transpiler](https://bun.com/docs/api/transpiler)

Project

[Roadmap](https://bun.com/docs/project/roadmap) [Benchmarking](https://bun.com/docs/project/benchmarking) [Contributing](https://bun.com/docs/project/contributing) [Building Windows](https://bun.com/docs/project/building-windows) [Bindgen](https://bun.com/docs/project/bindgen) [License](https://bun.com/docs/project/licensing)

`bun:ffi` has experimental support for compiling and running C from JavaScript with low overhead.

## [Usage (cc in `bun:ffi`)](https://bun.com/docs/api/cc#usage-cc-in-bun-ffi)

See the [introduction blog post](https://bun.com/blog/compile-and-run-c-in-js) for more information.

JavaScript:

hello.js

```
import { cc } from "bun:ffi";
import source from "./hello.c" with { type: "file" };

const {
  symbols: { hello },
} = cc({
  source,
  symbols: {
    hello: {
      args: [],
      returns: "int",
    },
  },
});

console.log("What is the answer to the universe?", hello());

```

C source:

hello.c

```
int hello() {
  return 42;
}

```

When you run `hello.js`, it will print:

```
bun hello.js
```

```
What is the answer to the universe? 42
```

Under the hood, `cc` uses [TinyCC](https://bellard.org/tcc/) to compile the C code and then link it with the JavaScript runtime, efficiently converting types in-place.

### [Primitive types](https://bun.com/docs/api/cc#primitive-types)

The same `FFIType` values in [`dlopen`](https://bun.com/docs/api/ffi) are supported in `cc`.

| `FFIType`  | C Type         | Aliases                     |
| ---------- | -------------- | --------------------------- |
| cstring    | `char*`        |                             |
| function   | `(void*)(*)()` | `fn`, `callback`            |
| ptr        | `void*`        | `pointer`, `void*`, `char*` |
| i8         | `int8_t`       | `int8_t`                    |
| i16        | `int16_t`      | `int16_t`                   |
| i32        | `int32_t`      | `int32_t`, `int`            |
| i64        | `int64_t`      | `int64_t`                   |
| i64_fast   | `int64_t`      |                             |
| u8         | `uint8_t`      | `uint8_t`                   |
| u16        | `uint16_t`     | `uint16_t`                  |
| u32        | `uint32_t`     | `uint32_t`                  |
| u64        | `uint64_t`     | `uint64_t`                  |
| u64_fast   | `uint64_t`     |                             |
| f32        | `float`        | `float`                     |
| f64        | `double`       | `double`                    |
| bool       | `bool`         |                             |
| char       | `char`         |                             |
| napi_env   | `napi_env`     |                             |
| napi_value | `napi_value`   |                             |

### [Strings, objects, and non-primitive types](https://bun.com/docs/api/cc#strings-objects-and-non-primitive-types)

To make it easier to work with strings, objects, and other non-primitive types that don't map 1:1 to C types, `cc` supports N-API.

To pass or receive a JavaScript values without any type conversions from a C function, you can use `napi_value`.

You can also pass a `napi_env` to receive the N-API environment used to call the JavaScript function.

#### Returning a C string to JavaScript

For example, if you have a string in C, you can return it to JavaScript like this:

hello.js

```
import { cc } from "bun:ffi";
import source from "./hello.c" with { type: "file" };

const {
  symbols: { hello },
} = cc({
  source,
  symbols: {
    hello: {
      args: ["napi_env"],
      returns: "napi_value",
    },
  },
});

const result = hello();

```

And in C:

hello.c

```
#include <node/node_api.h>

napi_value hello(napi_env env) {
  napi_value result;
  napi_create_string_utf8(env, "Hello, Napi!", NAPI_AUTO_LENGTH, &result);
  return result;
}

```

You can also use this to return other types like objects and arrays:

hello.c

```
#include <node/node_api.h>

napi_value hello(napi_env env) {
  napi_value result;
  napi_create_object(env, &result);
  return result;
}

```

### [`cc` Reference](https://bun.com/docs/api/cc#cc-reference)

#### `library: string[]`

The `library` array is used to specify the libraries that should be linked with the C code.

```
type Library = string[];

cc({
  source: "hello.c",
  library: ["sqlite3"],
});

```

#### `symbols`

The `symbols` object is used to specify the functions and variables that should be exposed to JavaScript.

```
type Symbols = {
  [key: string]: {
    args: FFIType[];
    returns: FFIType;
  };
};

```

#### `source`

The `source` is a file path to the C code that should be compiled and linked with the JavaScript runtime.

```
type Source = string | URL | BunFile;

cc({
  source: "hello.c",
  symbols: {
    hello: {
      args: [],
      returns: "int",
    },
  },
});

```

#### `flags: string | string[]`

The `flags` is an optional array of strings that should be passed to the TinyCC compiler.

```
type Flags = string | string[];

```

These are flags like `-I` for include directories and `-D` for preprocessor definitions.

#### `define: Record<string, string>`

The `define` is an optional object that should be passed to the TinyCC compiler.

```
type Defines = Record<string, string>;

cc({
  source: "hello.c",
  define: {
    "NDEBUG": "1",
  },
});

```

These are preprocessor definitions passed to the TinyCC compiler.

[Previous\\
\\
FFI](https://bun.com/docs/api/ffi) [Next\\
\\
Secrets](https://bun.com/docs/api/secrets)

[![GitHub logo](Base64-Image-Removed)![GitHub logo](Base64-Image-Removed)\\
\\
Edit on GitHub](https://github.com/oven-sh/bun/edit/main/docs/api/cc.md)

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
