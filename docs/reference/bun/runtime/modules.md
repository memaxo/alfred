---
title: Module resolution – Runtime | Bun Docs
url: 
description: Bun uses ESM and implements an extended version of the Node.js module resolution algorithm.
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

[`bun run`](https://bun.com/docs/cli/run) [File types](https://bun.com/docs/runtime/loaders) [TypeScript](https://bun.com/docs/runtime/typescript) [JSX](https://bun.com/docs/runtime/jsx) [Environment variables](https://bun.com/docs/runtime/env) [Bun APIs](https://bun.com/docs/runtime/bun-apis) [Web APIs](https://bun.com/docs/runtime/web-apis) [Node.js compatibility](https://bun.com/docs/runtime/nodejs-apis) [Single-file executable](https://bun.com/docs/bundler/executables) [Plugins](https://bun.com/docs/runtime/plugins) [Watch mode](https://bun.com/docs/runtime/hot) [Module resolution](https://bun.com/docs/runtime/modules)

[Syntax](https://bun.com/docs/runtime/modules#syntax) [Module systems](https://bun.com/docs/runtime/modules#module-systems) [Using `require()`](https://bun.com/docs/runtime/modules#using-require) [Using `import`](https://bun.com/docs/runtime/modules#using-import) [Using `import` and `require()` together](https://bun.com/docs/runtime/modules#using-import-and-require-together) [Top level await](https://bun.com/docs/runtime/modules#top-level-await) [Importing packages](https://bun.com/docs/runtime/modules#importing-packages) [Custom conditions](https://bun.com/docs/runtime/modules#custom-conditions) [Path re-mapping](https://bun.com/docs/runtime/modules#path-re-mapping)

[Auto-install](https://bun.com/docs/runtime/autoimport) [bunfig.toml](https://bun.com/docs/runtime/bunfig) [Debugger](https://bun.com/docs/runtime/debugger)

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

Module resolution in JavaScript is a complex topic.

The ecosystem is currently in the midst of a years-long transition from CommonJS modules to native ES modules. TypeScript enforces its own set of rules around import extensions that aren't compatible with ESM. Different build tools support path re-mapping via disparate non-compatible mechanisms.

Bun aims to provide a consistent and predictable module resolution system that just works. Unfortunately it's still quite complex.

## [Syntax](https://bun.com/docs/runtime/modules\#syntax)

Consider the following files.

index.ts

hello.ts

index.ts

```
import { hello } from "./hello";

hello();

```

hello.ts

```
export function hello() {
  console.log("Hello world!");
}

```

When we run `index.ts`, it prints "Hello world!".

```
bun index.ts
```

```
Hello world!
```

In this case, we are importing from `./hello`, a relative path with no extension. **Extensioned imports are optional but supported.** To resolve this import, Bun will check for the following files in order:

- `./hello.tsx`
- `./hello.jsx`
- `./hello.ts`
- `./hello.mjs`
- `./hello.js`
- `./hello.cjs`
- `./hello.json`
- `./hello/index.tsx`
- `./hello/index.jsx`
- `./hello/index.ts`
- `./hello/index.mjs`
- `./hello/index.js`
- `./hello/index.cjs`
- `./hello/index.json`

Import paths can optionally include extensions. If an extension is present, Bun will only check for a file with that exact extension.

index.ts

```
import { hello } from "./hello";
import { hello } from "./hello.ts"; // this works

```

If you import `from "*.js{x}"`, Bun will additionally check for a matching `*.ts{x}` file, to be compatible with TypeScript's [ES module support](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-4-7.html#new-file-extensions).

index.ts

```
import { hello } from "./hello";
import { hello } from "./hello.ts"; // this works
import { hello } from "./hello.js"; // this also works

```

Bun supports both ES modules ( `import`/ `export` syntax) and CommonJS modules ( `require()`/ `module.exports`). The following CommonJS version would also work in Bun.

index.js

hello.js

index.js

```
const { hello } = require("./hello");

hello();

```

hello.js

```
function hello() {
  console.log("Hello world!");
}

exports.hello = hello;

```

That said, using CommonJS is discouraged in new projects.

## [Module systems](https://bun.com/docs/runtime/modules\#module-systems)

Bun has native support for CommonJS and ES modules. ES Modules are the recommended module format for new projects, but CommonJS modules are still widely used in the Node.js ecosystem.

In Bun's JavaScript runtime, `require` can be used by both ES Modules and CommonJS modules. If the target module is an ES Module, `require` returns the module namespace object (equivalent to `import * as`). If the target module is a CommonJS module, `require` returns the `module.exports` object (as in Node.js).

| Module Type | `require()` | `import * as` |
| --- | --- | --- |
| ES Module | Module Namespace | Module Namespace |
| CommonJS | module.exports | `default` is `module.exports`, keys of module.exports are named exports |

### [Using `require()`](https://bun.com/docs/runtime/modules\#using-require)

You can `require()` any file or package, even `.ts` or `.mjs` files.

```
const { foo } = require("./foo"); // extensions are optional
const { bar } = require("./bar.mjs");
const { baz } = require("./baz.tsx");

```

What is a CommonJS module?

In 2016, ECMAScript added support for [ES Modules](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules). ES Modules are the standard for JavaScript modules. However, millions of npm packages still use CommonJS modules.

CommonJS modules are modules that use `module.exports` to export values. Typically, `require` is used to import CommonJS modules.

```
// my-commonjs.cjs
const stuff = require("./stuff");
module.exports = { stuff };

```

The biggest difference between CommonJS and ES Modules is that CommonJS modules are synchronous, while ES Modules are asynchronous. There are other differences too.

- ES Modules support top-level `await` and CommonJS modules don't.
- ES Modules are always in [strict mode](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Strict_mode), while CommonJS modules are not.
- Browsers do not have native support for CommonJS modules, but they do have native support for ES Modules via `<script type="module">`.
- CommonJS modules are not statically analyzable, while ES Modules only allow static imports and exports.

**CommonJS Modules:** These are a type of module system used in JavaScript. One key feature of CommonJS modules is that they load and execute synchronously. This means that when you import a CommonJS module, the code in that module runs immediately, and your program waits for it to finish before moving on to the next task. It's similar to reading a book from start to finish without skipping pages.

**ES Modules (ESM):** These are another type of module system introduced in JavaScript. They have a slightly different behavior compared to CommonJS. In ESM, static imports (imports made using `import` statements) are synchronous, just like CommonJS. This means that when you import an ESM using a regular `import` statement, the code in that module runs immediately, and your program proceeds in a step-by-step manner. Think of it like reading a book page by page.

**Dynamic imports:** Now, here comes the part that might be confusing. ES Modules also support importing modules on the fly via the `import()` function. This is called a "dynamic import" and it's asynchronous, so it doesn't block the main program execution. Instead, it fetches and loads the module in the background while your program continues to run. Once the module is ready, you can use it. This is like getting additional information from a book while you're still reading it, without having to pause your reading.

**In summary:**

- CommonJS modules and static ES Modules ( `import` statements) work in a similar synchronous way, like reading a book from start to finish.
- ES Modules also offer the option to import modules asynchronously using the `import()` function. This is like looking up additional information in the middle of reading the book without stopping.

### [Using `import`](https://bun.com/docs/runtime/modules\#using-import)

You can `import` any file or package, even `.cjs` files.

```
import { foo } from "./foo"; // extensions are optional
import bar from "./bar.ts";
import { stuff } from "./my-commonjs.cjs";

```

### [Using `import` and `require()` together](https://bun.com/docs/runtime/modules\#using-import-and-require-together)

In Bun, you can use `import` or `require` in the same file—they both work, all the time.

```
import { stuff } from "./my-commonjs.cjs";
import Stuff from "./my-commonjs.cjs";
const myStuff = require("./my-commonjs.cjs");

```

### [Top level await](https://bun.com/docs/runtime/modules\#top-level-await)

The only exception to this rule is top-level await. You can't `require()` a file that uses top-level await, since the `require()` function is inherently synchronous.

Fortunately, very few libraries use top-level await, so this is rarely a problem. But if you're using top-level await in your application code, make sure that file isn't being `require()` from elsewhere in your application. Instead, you should use `import` or [dynamic `import()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/import).

## [Importing packages](https://bun.com/docs/runtime/modules\#importing-packages)

Bun implements the Node.js module resolution algorithm, so you can import packages from `node_modules` with a bare specifier.

```
import { stuff } from "foo";

```

The full specification of this algorithm are officially documented in the [Node.js documentation](https://nodejs.org/api/modules.html); we won't rehash it here. Briefly: if you import `from "foo"`, Bun scans up the file system for a `node_modules` directory containing the package `foo`.

Once it finds the `foo` package, Bun reads the `package.json` to determine how the package should be imported. To determine the package's entrypoint, Bun first reads the `exports` field and checks for the following conditions.

package.json

```
{
  "name": "foo",
  "exports": {
    "bun": "./index.js",
    "node": "./index.js",
    "require": "./index.js", // if importer is CommonJS
    "import": "./index.mjs", // if importer is ES module
    "default": "./index.js",
  }
}

```

Whichever one of these conditions occurs _first_ in the `package.json` is used to determine the package's entrypoint.

Bun respects subpath [`"exports"`](https://nodejs.org/api/packages.html#subpath-exports) and [`"imports"`](https://nodejs.org/api/packages.html#imports).

package.json

```
{
  "name": "foo",
  "exports": {
    ".": "./index.js"
  }
}

```

Subpath imports and conditional imports work in conjunction with each other.

```
{
  "name": "foo",
  "exports": {
    ".": {
      "import": "./index.mjs",
      "require": "./index.js"
    }
  }
}

```

As in Node.js, Specifying any subpath in the `"exports"` map will prevent other subpaths from being importable; you can only import files that are explicitly exported. Given the `package.json` above:

```
import stuff from "foo"; // this works
import stuff from "foo/index.mjs"; // this doesn't

```

**Shipping TypeScript** — Note that Bun supports the special `"bun"` export condition. If your library is written in TypeScript, you can publish your (un-transpiled!) TypeScript files to `npm` directly. If you specify your package's `*.ts` entrypoint in the `"bun"` condition, Bun will directly import and execute your TypeScript source files.

If `exports` is not defined, Bun falls back to `"module"` (ESM imports only) then [`"main"`](https://nodejs.org/api/packages.html#main).

package.json

```
{
  "name": "foo",
  "module": "./index.js",
  "main": "./index.js"
}

```

### [Custom conditions](https://bun.com/docs/runtime/modules\#custom-conditions)

The `--conditions` flag allows you to specify a list of conditions to use when resolving packages from package.json `"exports"`.

This flag is supported in both `bun build` and Bun's runtime.

```
# Use it with bun build:
```

```
bun build --conditions="react-server" --target=bun ./app/foo/route.js
```

```

# Use it with bun's runtime:
```

```
bun --conditions="react-server" ./app/foo/route.js
```

You can also use `conditions` programmatically with `Bun.build`:

```
await Bun.build({
  conditions: ["react-server"],
  target: "bun",
  entryPoints: ["./app/foo/route.js"],
});

```

## [Path re-mapping](https://bun.com/docs/runtime/modules\#path-re-mapping)

In the spirit of treating TypeScript as a first-class citizen, the Bun runtime will re-map import paths according to the [`compilerOptions.paths`](https://www.typescriptlang.org/tsconfig#paths) field in `tsconfig.json`. This is a major divergence from Node.js, which doesn't support any form of import path re-mapping.

tsconfig.json

```
{
  "compilerOptions": {
    "paths": {
      "config": ["./config.ts"],         // map specifier to file
      "components/*": ["components/*"],  // wildcard matching
    }
  }
}

```

If you aren't a TypeScript user, you can create a [`jsconfig.json`](https://code.visualstudio.com/docs/languages/jsconfig) in your project root to achieve the same behavior.

Low-level details of CommonJS interop in Bun

Bun's JavaScript runtime has native support for CommonJS. When Bun's JavaScript transpiler detects usages of `module.exports`, it treats the file as CommonJS. The module loader will then wrap the transpiled module in a function shaped like this:

```
(function (module, exports, require) {
  // transpiled module
})(module, exports, require);

```

`module`, `exports`, and `require` are very much like the `module`, `exports`, and `require` in Node.js. These are assigned via a [`with scope`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/with) in C++. An internal `Map` stores the `exports` object to handle cyclical `require` calls before the module is fully loaded.

Once the CommonJS module is successfully evaluated, a Synthetic Module Record is created with the `default` ES Module [export set to `module.exports`](https://github.com/oven-sh/bun/blob/9b6913e1a674ceb7f670f917fc355bb8758c6c72/src/bun.js/bindings/CommonJSModuleRecord.cpp#L212-L213) and keys of the `module.exports` object are re-exported as named exports (if the `module.exports` object is an object).

When using Bun's bundler, this works differently. The bundler will wrap the CommonJS module in a `require_${moduleName}` function which returns the `module.exports` object.

[Previous\\
\\
Watch mode](https://bun.com/docs/runtime/hot) [Next\\
\\
Auto-install](https://bun.com/docs/runtime/autoimport)

[![GitHub logo](<Base64-Image-Removed>)![GitHub logo](<Base64-Image-Removed>)\\
\\
Edit on GitHub](https://github.com/oven-sh/bun/edit/main/docs/runtime/modules.md)

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