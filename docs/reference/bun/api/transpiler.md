---
title: Transpiler – API | Bun Docs
url: 
description: Bun exposes its internal transpiler as a pluggable API.
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

[`.transformSync()`](https://bun.com/docs/api/transpiler#transformsync) [`.transform()`](https://bun.com/docs/api/transpiler#transform) [`.scan()`](https://bun.com/docs/api/transpiler#scan) [`.scanImports()`](https://bun.com/docs/api/transpiler#scanimports) [Reference](https://bun.com/docs/api/transpiler#reference)

Project

[Roadmap](https://bun.com/docs/project/roadmap) [Benchmarking](https://bun.com/docs/project/benchmarking) [Contributing](https://bun.com/docs/project/contributing) [Building Windows](https://bun.com/docs/project/building-windows) [Bindgen](https://bun.com/docs/project/bindgen) [License](https://bun.com/docs/project/licensing)

Bun exposes its internal transpiler via the `Bun.Transpiler` class. To create an instance of Bun's transpiler:

```
const transpiler = new Bun.Transpiler({
  loader: "tsx", // "js | "jsx" | "ts" | "tsx"
});

```

## [`.transformSync()`](https://bun.com/docs/api/transpiler\#transformsync)

Transpile code synchronously with the `.transformSync()` method. Modules are not resolved and the code is not executed. The result is a string of vanilla JavaScript code.

Example

Result

Example

```
const transpiler = new Bun.Transpiler({
  loader: 'tsx',
});

const code = `
import * as whatever from "./whatever.ts"
export function Home(props: {title: string}){
  return <p>{props.title}</p>;
}`;

const result = transpiler.transformSync(code);

```

Result

```
import { __require as require } from "bun:wrap";
import * as JSX from "react/jsx-dev-runtime";
var jsx = require(JSX).jsxDEV;

export default jsx(
  "div",
  {
    children: "hi!",
  },
  undefined,
  false,
  undefined,
  this,
);

```

To override the default loader specified in the `new Bun.Transpiler()` constructor, pass a second argument to `.transformSync()`.

```
transpiler.transformSync("<div>hi!</div>", "tsx");

```

Nitty gritty

When `.transformSync` is called, the transpiler is run in the same thread as the currently executed code.

If a macro is used, it will be run in the same thread as the transpiler, but in a separate event loop from the rest of your application. Currently, globals between macros and regular code are shared, which means it is possible (but not recommended) to share states between macros and regular code. Attempting to use AST nodes outside of a macro is undefined behavior.

## [`.transform()`](https://bun.com/docs/api/transpiler\#transform)

The `transform()` method is an async version of `.transformSync()` that returns a `Promise<string>`.

```
const transpiler = new Bun.Transpiler({ loader: "jsx" });
const result = await transpiler.transform("<div>hi!</div>");
console.log(result);

```

Unless you're transpiling _many_ large files, you should probably use `Bun.Transpiler.transformSync`. The cost of the threadpool will often take longer than actually transpiling code.

```
await transpiler.transform("<div>hi!</div>", "tsx");

```

Nitty gritty

The `.transform()` method runs the transpiler in Bun's worker threadpool, so if you run it 100 times, it will run it across `Math.floor($cpu_count * 0.8)` threads, without blocking the main JavaScript thread.

If your code uses a macro, it will potentially spawn a new copy of Bun's JavaScript runtime environment in that new thread.

## [`.scan()`](https://bun.com/docs/api/transpiler\#scan)

The `Transpiler` instance can also scan some source code and return a list of its imports and exports, plus additional metadata about each one. [Type-only](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-3-8.html#type-only-imports-and-export) imports and exports are ignored.

Example

Output

Example

```
const transpiler = new Bun.Transpiler({
  loader: 'tsx',
});

const code = `
import React from 'react';
import type {ReactNode} from 'react';
const val = require('./cjs.js')
import('./loader');

export const name = "hello";
`;

const result = transpiler.scan(code);

```

Output

```
{
  "exports": [\
    "name"\
  ],
  "imports": [\
    {\
      "kind": "import-statement",\
      "path": "react"\
    },\
    {\
      "kind": "import-statement",\
      "path": "remix"\
    },\
    {\
      "kind": "dynamic-import",\
      "path": "./loader"\
    }\
  ]
}

```

Each import in the `imports` array has a `path` and `kind`. Bun categories imports into the following kinds:

- `import-statement`: `import React from 'react'`
- `require-call`: `const val = require('./cjs.js')`
- `require-resolve`: `require.resolve('./cjs.js')`
- `dynamic-import`: `import('./loader')`
- `import-rule`: `@import 'foo.css'`
- `url-token`: `url('./foo.png')`

## [`.scanImports()`](https://bun.com/docs/api/transpiler\#scanimports)

For performance-sensitive code, you can use the `.scanImports()` method to get a list of imports. It's faster than `.scan()` (especially for large files) but marginally less accurate due to some performance optimizations.

Example

Results

Example

```
const transpiler = new Bun.Transpiler({
  loader: 'tsx',
});

const code = `
import React from 'react';
import type {ReactNode} from 'react';
const val = require('./cjs.js')
import('./loader');

export const name = "hello";
`;

const result = transpiler.scanImports(code);

```

Results

```
[\
  {\
    kind: "import-statement",\
    path: "react"\
  }, {\
    kind: "require-call",\
    path: "./cjs.js"\
  }, {\
    kind: "dynamic-import",\
    path: "./loader"\
  }\
]

```

## [Reference](https://bun.com/docs/api/transpiler\#reference)

```
type Loader = "jsx" | "js" | "ts" | "tsx";

interface TranspilerOptions {
  // Replace key with value. Value must be a JSON string.
  // { "process.env.NODE_ENV": "\"production\"" }
  define?: Record<string, string>,

  // Default loader for this transpiler
  loader?: Loader,

  // Default platform to target
  // This affects how import and/or require is used
  target?: "browser" | "bun" | "node",

  // Specify a tsconfig.json file as stringified JSON or an object
  // Use this to set a custom JSX factory, fragment, or import source
  // For example, if you want to use Preact instead of React. Or if you want to use Emotion.
  tsconfig?: string | TSConfig,

  // Replace imports with macros
  macro?: MacroMap,

  // Specify a set of exports to eliminate
  // Or rename certain exports
  exports?: {
      eliminate?: string[];
      replace?: Record<string, string>;
  },

  // Whether to remove unused imports from transpiled file
  // Default: false
  trimUnusedImports?: boolean,

  // Whether to enable a set of JSX optimizations
  // jsxOptimizationInline ...,

  // Experimental whitespace minification
  minifyWhitespace?: boolean,

  // Whether to inline constant values
  // Typically improves performance and decreases bundle size
  // Default: true
  inline?: boolean,
}

// Map import paths to macros
interface MacroMap {
  // {
  //   "react-relay": {
  //     "graphql": "bun-macro-relay/bun-macro-relay.tsx"
  //   }
  // }
  [packagePath: string]: {
    [importItemName: string]: string,
  },
}

class Bun.Transpiler {
  constructor(options: TranspilerOptions)

  transform(code: string, loader?: Loader): Promise<string>
  transformSync(code: string, loader?: Loader): string

  scan(code: string): {exports: string[], imports: Import}
  scanImports(code: string): Import[]
}

type Import = {
  path: string,
  kind:
  // import foo from 'bar'; in JavaScript
  | "import-statement"
  // require("foo") in JavaScript
  | "require-call"
  // require.resolve("foo") in JavaScript
  | "require-resolve"
  // Dynamic import() in JavaScript
  | "dynamic-import"
  // @import() in CSS
  | "import-rule"
  // url() in CSS
  | "url-token"
  // The import was injected by Bun
  | "internal"
  // Entry point (not common)
  | "entry-point-build"
  | "entry-point-run"
}

const transpiler = new Bun.Transpiler({ loader: "jsx" });

```

[Previous\\
\\
Color](https://bun.com/docs/api/color) [Next\\
\\
Roadmap](https://bun.com/docs/project/roadmap)

[![GitHub logo](<Base64-Image-Removed>)![GitHub logo](<Base64-Image-Removed>)\\
\\
Edit on GitHub](https://github.com/oven-sh/bun/edit/main/docs/api/transpiler.md)

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