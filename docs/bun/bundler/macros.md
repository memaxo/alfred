---
title: Macros – Bundler | Bun Docs
url: 
description: Run JavaScript functions at bundle-time and inline the results into your bundle
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

[`Bun.build`](https://bun.com/docs/bundler) [HTML & static sites](https://bun.com/docs/bundler/html) [CSS](https://bun.com/docs/bundler/css) [Fullstack Dev Server](https://bun.com/docs/bundler/fullstack) [Hot reloading](https://bun.com/docs/bundler/hmr) [Loaders](https://bun.com/docs/bundler/loaders) [Plugins](https://bun.com/docs/bundler/plugins) [Macros](https://bun.com/docs/bundler/macros)

[When to use macros](https://bun.com/docs/bundler/macros#when-to-use-macros) [Import attributes](https://bun.com/docs/bundler/macros#import-attributes) [Security considerations](https://bun.com/docs/bundler/macros#security-considerations) [Export condition `"macro"`](https://bun.com/docs/bundler/macros#export-condition-macro) [Execution](https://bun.com/docs/bundler/macros#execution) [Dead code elimination](https://bun.com/docs/bundler/macros#dead-code-elimination) [Serializability](https://bun.com/docs/bundler/macros#serializability) [Arguments](https://bun.com/docs/bundler/macros#arguments) [Examples](https://bun.com/docs/bundler/macros#examples) [Embed latest git commit hash](https://bun.com/docs/bundler/macros#embed-latest-git-commit-hash) [Make `fetch()` requests at bundle-time](https://bun.com/docs/bundler/macros#make-fetch-requests-at-bundle-time)

[vs esbuild](https://bun.com/docs/bundler/vs-esbuild)

Test runner

[`bun test`](https://bun.com/docs/cli/test) [Writing tests](https://bun.com/docs/test/writing) [Watch mode](https://bun.com/docs/test/hot) [Lifecycle hooks](https://bun.com/docs/test/lifecycle) [Mocks](https://bun.com/docs/test/mocks) [Snapshots](https://bun.com/docs/test/snapshots) [Dates and times](https://bun.com/docs/test/time) [Code coverage](https://bun.com/docs/test/coverage) [Test reporters](https://bun.com/docs/test/reporters) [Test configuration](https://bun.com/docs/test/configuration) [Runtime behavior](https://bun.com/docs/test/runtime-behavior) [Finding tests](https://bun.com/docs/test/discovery) [DOM testing](https://bun.com/docs/test/dom)

Package runner

[`bunx`](https://bun.com/docs/cli/bunx)

API

[HTTP server](https://bun.com/docs/api/http) [HTTP client](https://bun.com/docs/api/fetch) [WebSockets](https://bun.com/docs/api/websockets) [Workers](https://bun.com/docs/api/workers) [Binary data](https://bun.com/docs/api/binary-data) [Streams](https://bun.com/docs/api/streams) [SQL](https://bun.com/docs/api/sql) [S3 Object Storage](https://bun.com/docs/api/s3) [File I/O](https://bun.com/docs/api/file-io) [Redis client](https://bun.com/docs/api/redis) [import.meta](https://bun.com/docs/api/import-meta) [SQLite](https://bun.com/docs/api/sqlite) [FileSystemRouter](https://bun.com/docs/api/file-system-router) [TCP sockets](https://bun.com/docs/api/tcp) [UDP sockets](https://bun.com/docs/api/udp) [Globals](https://bun.com/docs/api/globals) [$ Shell](https://bun.com/docs/runtime/shell) [Child processes](https://bun.com/docs/api/spawn) [YAML](https://bun.com/docs/api/yaml) [HTMLRewriter](https://bun.com/docs/api/html-rewriter) [Hashing](https://bun.com/docs/api/hashing) [Console](https://bun.com/docs/api/console) [Cookie](https://bun.com/docs/api/cookie) [FFI](https://bun.com/docs/api/ffi) [C Compiler](https://bun.com/docs/api/cc) [Secrets](https://bun.com/docs/api/secrets) [Testing](https://bun.com/docs/cli/test) [Utils](https://bun.com/docs/api/utils) [Node-API](https://bun.com/docs/api/node-api) [Glob](https://bun.com/docs/api/glob) [DNS](https://bun.com/docs/api/dns) [Semver](https://bun.com/docs/api/semver) [Color](https://bun.com/docs/api/color) [Transpiler](https://bun.com/docs/api/transpiler)

Project

[Roadmap](https://bun.com/docs/project/roadmap) [Benchmarking](https://bun.com/docs/project/benchmarking) [Contributing](https://bun.com/docs/project/contributing) [Building Windows](https://bun.com/docs/project/building-windows) [Bindgen](https://bun.com/docs/project/bindgen) [License](https://bun.com/docs/project/licensing)

Macros are a mechanism for running JavaScript functions _at bundle-time_. The value returned from these functions are directly inlined into your bundle.

As a toy example, consider this simple function that returns a random number.

```
export function random() {
  return Math.random();
}

```

This is just a regular function in a regular file, but we can use it as a macro like so:

cli.tsx

```
import { random } from './random.ts' with { type: 'macro' };

console.log(`Your random number is ${random()}`);

```

**Note** — Macros are indicated using [_import attribute_](https://github.com/tc39/proposal-import-attributes) syntax. If you haven't seen this syntax before, it's a Stage 3 TC39 proposal that lets you attach additional metadata to `import` statements.

Now we'll bundle this file with `bun build`. The bundled file will be printed to stdout.

```
bun build ./cli.tsx
```

```
console.log(`Your random number is ${0.6805550949689833}`);
```

As you can see, the source code of the `random` function occurs nowhere in the bundle. Instead, it is executed _during bundling_ and function call ( `random()`) is replaced with the result of the function. Since the source code will never be included in the bundle, macros can safely perform privileged operations like reading from a database.

## [When to use macros](https://bun.com/docs/bundler/macros\#when-to-use-macros)

If you have several build scripts for small things where you would otherwise have a one-off build script, bundle-time code execution can be easier to maintain. It lives with the rest of your code, it runs with the rest of the build, it is automatically parallelized, and if it fails, the build fails too.

If you find yourself running a lot of code at bundle-time though, consider running a server instead.

## [Import attributes](https://bun.com/docs/bundler/macros\#import-attributes)

Bun Macros are import statements annotated using either:

- `with { type: 'macro' }` — an [import attribute](https://github.com/tc39/proposal-import-attributes), a Stage 3 ECMA Scrd
- `assert { type: 'macro' }` — an import assertion, an earlier incarnation of import attributes that has now been abandoned (but is [already supported](https://caniuse.com/mdn-javascript_statements_import_import_assertions) by a number of browsers and runtimes)

## [Security considerations](https://bun.com/docs/bundler/macros\#security-considerations)

Macros must explicitly be imported with `{ type: "macro" }` in order to be executed at bundle-time. These imports have no effect if they are not called, unlike regular JavaScript imports which may have side effects.

You can disable macros entirely by passing the `--no-macros` flag to Bun. It produces a build error like this:

```
error: Macros are disabled

foo();
^
./hello.js:3:1 53

```

To reduce the potential attack surface for malicious packages, macros cannot be _invoked_ from inside `node_modules/**/*`. If a package attempts to invoke a macro, you'll see an error like this:

```
error: For security reasons, macros cannot be run from node_modules.

beEvil();
^
node_modules/evil/index.js:3:1 50

```

Your application code can still import macros from `node_modules` and invoke them.

```
import { macro } from "some-package" with { type: "macro" };

macro();

```

## [Export condition `"macro"`](https://bun.com/docs/bundler/macros\#export-condition-macro)

When shipping a library containing a macro to `npm` or another package registry, use the `"macro"` [export condition](https://nodejs.org/api/packages.html#conditional-exports) to provide a special version of your package exclusively for the macro environment.

package.json

```
{
  "name": "my-package",
  "exports": {
    "import": "./index.js",
    "require": "./index.js",
    "default": "./index.js",
    "macro": "./index.macro.js"
  }
}

```

With this configuration, users can consume your package at runtime or at bundle-time using the same import specifier:

```
import pkg from "my-package"; // runtime import
import { macro } from "my-package" with { type: "macro" }; // macro import

```

The first import will resolve to `./node_modules/my-package/index.js`, while the second will be resolved by Bun's bundler to `./node_modules/my-package/index.macro.js`.

## [Execution](https://bun.com/docs/bundler/macros\#execution)

When Bun's transpiler sees a macro import, it calls the function inside the transpiler using Bun's JavaScript runtime and converts the return value from JavaScript into an AST node. These JavaScript functions are called at bundle-time, not runtime.

Macros are executed synchronously in the transpiler during the visiting phase—before plugins and before the transpiler generates the AST. They are executed in the order they are imported. The transpiler will wait for the macro to finish executing before continuing. The transpiler will also `await` any `Promise` returned by a macro.

Bun's bundler is multi-threaded. As such, macros execute in parallel inside of multiple spawned JavaScript "workers".

## [Dead code elimination](https://bun.com/docs/bundler/macros\#dead-code-elimination)

The bundler performs dead code elimination _after_ running and inlining macros. So given the following macro:

returnFalse.ts

```
export function returnFalse() {
  return false;
}

```

...then bundling the following file will produce an empty bundle, provided that the minify syntax option is enabled.

```
import { returnFalse } from "./returnFalse.ts" with { type: "macro" };

if (returnFalse()) {
  console.log("This code is eliminated");
}

```

## [Serializability](https://bun.com/docs/bundler/macros\#serializability)

Bun's transpiler needs to be able to serialize the result of the macro so it can be inlined into the AST. All JSON-compatible data structures are supported:

macro.ts

```
export function getObject() {
  return {
    foo: "bar",
    baz: 123,
    array: [ 1, 2, { nested: "value" }],
  };
}

```

Macros can be async, or return `Promise` instances. Bun's transpiler will automatically `await` the `Promise` and inline the result.

macro.ts

```
export async function getText() {
  return "async value";
}

```

The transpiler implements special logic for serializing common data formats like `Response`, `Blob`, `TypedArray`.

- `TypedArray`: Resolves to a base64-encoded string.
- `Response`: Bun will read the `Content-Type` and serialize accordingly; for instance, a `Response` with type `application/json` will be automatically parsed into an object and `text/plain` will be inlined as a string. Responses with an unrecognized or `undefined` `type` will be base-64 encoded.
- `Blob`: As with `Response`, the serialization depends on the `type` property.

The result of `fetch` is `Promise<Response>`, so it can be directly returned.

macro.ts

```
export function getObject() {
  return fetch("https://bun.com")
}

```

Functions and instances of most classes (except those mentioned above) are not serializable.

```
export function getText(url: string) {
  // this doesn't work!
  return () => {};
}

```

## [Arguments](https://bun.com/docs/bundler/macros\#arguments)

Macros can accept inputs, but only in limited cases. The value must be statically known. For example, the following is not allowed:

```
import { getText } from "./getText.ts" with { type: "macro" };

export function howLong() {
  // the value of `foo` cannot be statically known
  const foo = Math.random() ? "foo" : "bar";

  const text = getText(`https://example.com/${foo}`);
  console.log("The page is ", text.length, " characters long");
}

```

However, if the value of `foo` is known at bundle-time (say, if it's a constant or the result of another macro) then it's allowed:

```
import { getText } from "./getText.ts" with { type: "macro" };
import { getFoo } from "./getFoo.ts" with { type: "macro" };

export function howLong() {
  // this works because getFoo() is statically known
  const foo = getFoo();
  const text = getText(`https://example.com/${foo}`);
  console.log("The page is", text.length, "characters long");
}

```

This outputs:

```
function howLong() {
  console.log("The page is", 1322, "characters long");
}
export { howLong };

```

## [Examples](https://bun.com/docs/bundler/macros\#examples)

### [Embed latest git commit hash](https://bun.com/docs/bundler/macros\#embed-latest-git-commit-hash)

getGitCommitHash.ts

getGitCommitHash.ts

```
export function getGitCommitHash() {
  const {stdout} = Bun.spawnSync({
    cmd: ["git", "rev-parse", "HEAD"],
    stdout: "pipe",
  });

  return stdout.toString();
}

```

When we build it, the `getGitCommitHash` is replaced with the result of calling the function:

input

output

input

```
import { getGitCommitHash } from './getGitCommitHash.ts' with { type: 'macro' };

console.log(`The current Git commit hash is ${getGitCommitHash()}`);

```

output

```
console.log(`The current Git commit hash is 3ee3259104f`);

```

You're probably thinking "Why not just use `process.env.GIT_COMMIT_HASH`?" Well, you can do that too. But can you do this with an environment variable?

### [Make `fetch()` requests at bundle-time](https://bun.com/docs/bundler/macros\#make-fetch-requests-at-bundle-time)

In this example, we make an outgoing HTTP request using `fetch()`, parse the HTML response using `HTMLRewriter`, and return an object containing the title and meta tags–all at bundle-time.

```
export async function extractMetaTags(url: string) {
  const response = await fetch(url);
  const meta = {
    title: "",
  };
  new HTMLRewriter()
    .on("title", {
      text(element) {
        meta.title += element.text;
      },
    })
    .on("meta", {
      element(element) {
        const name =
          element.getAttribute("name") ||
          element.getAttribute("property") ||
          element.getAttribute("itemprop");

        if (name) meta[name] = element.getAttribute("content");
      },
    })
    .transform(response);

  return meta;
}

```

The `extractMetaTags` function is erased at bundle-time and replaced with the result of the function call. This means that the `fetch` request happens at bundle-time, and the result is embedded in the bundle. Also, the branch throwing the error is eliminated since it's unreachable.

input

output

input

```
import { extractMetaTags } from './meta.ts' with { type: 'macro' };

export const Head = () => {
  const headTags = extractMetaTags("https://example.com");

  if (headTags.title !== "Example Domain") {
    throw new Error("Expected title to be 'Example Domain'");
  }

  return <head>
    <title>{headTags.title}</title>
    <meta name="viewport" content={headTags.viewport} />
  </head>;
};

```

output

```
import { jsx, jsxs } from "react/jsx-runtime";
export const Head = () => {
  jsxs("head", {
    children: [\
      jsx("title", {\
        children: "Example Domain",\
      }),\
      jsx("meta", {\
        name: "viewport",\
        content: "width=device-width, initial-scale=1",\
      }),\
    ],
  });
};

export { Head };

```

[Previous\\
\\
Plugins](https://bun.com/docs/bundler/plugins) [Next\\
\\
vs esbuild](https://bun.com/docs/bundler/vs-esbuild)

[![GitHub logo](<Base64-Image-Removed>)![GitHub logo](<Base64-Image-Removed>)\\
\\
Edit on GitHub](https://github.com/oven-sh/bun/edit/main/docs/bundler/macros.md)

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