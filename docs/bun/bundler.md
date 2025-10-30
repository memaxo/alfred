---
title: Bun.build – Bundler | Bun Docs
url: 
description: Bundle code for consumption in the browser with Bun's native bundler.
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

[`Bun.build`](https://bun.com/docs/bundler)

[Why bundle?](https://bun.com/docs/bundler#why-bundle) [Basic example](https://bun.com/docs/bundler#basic-example) [Watch mode](https://bun.com/docs/bundler#watch-mode) [Content types](https://bun.com/docs/bundler#content-types) [Assets](https://bun.com/docs/bundler#assets) [Plugins](https://bun.com/docs/bundler#plugins) [API](https://bun.com/docs/bundler#api) [`entrypoints`](https://bun.com/docs/bundler#entrypoints) [`outdir`](https://bun.com/docs/bundler#outdir) [`target`](https://bun.com/docs/bundler#target) [`format`](https://bun.com/docs/bundler#format) [`splitting`](https://bun.com/docs/bundler#splitting) [`plugins`](https://bun.com/docs/bundler#plugins) [`env`](https://bun.com/docs/bundler#env) [`sourcemap`](https://bun.com/docs/bundler#sourcemap) [`minify`](https://bun.com/docs/bundler#minify) [`external`](https://bun.com/docs/bundler#external) [`packages`](https://bun.com/docs/bundler#packages) [`naming`](https://bun.com/docs/bundler#naming) [`root`](https://bun.com/docs/bundler#root) [`publicPath`](https://bun.com/docs/bundler#publicpath) [`define`](https://bun.com/docs/bundler#define) [`loader`](https://bun.com/docs/bundler#loader) [`banner`](https://bun.com/docs/bundler#banner) [`footer`](https://bun.com/docs/bundler#footer) [`drop`](https://bun.com/docs/bundler#drop) [`throw`](https://bun.com/docs/bundler#throw) [Outputs](https://bun.com/docs/bundler#outputs) [Bytecode](https://bun.com/docs/bundler#bytecode) [Executables](https://bun.com/docs/bundler#executables) [Logs and errors](https://bun.com/docs/bundler#logs-and-errors) [Reference](https://bun.com/docs/bundler#reference)

[HTML & static sites](https://bun.com/docs/bundler/html) [CSS](https://bun.com/docs/bundler/css) [Fullstack Dev Server](https://bun.com/docs/bundler/fullstack) [Hot reloading](https://bun.com/docs/bundler/hmr) [Loaders](https://bun.com/docs/bundler/loaders) [Plugins](https://bun.com/docs/bundler/plugins) [Macros](https://bun.com/docs/bundler/macros) [vs esbuild](https://bun.com/docs/bundler/vs-esbuild)

Test runner

[`bun test`](https://bun.com/docs/cli/test) [Writing tests](https://bun.com/docs/test/writing) [Watch mode](https://bun.com/docs/test/hot) [Lifecycle hooks](https://bun.com/docs/test/lifecycle) [Mocks](https://bun.com/docs/test/mocks) [Snapshots](https://bun.com/docs/test/snapshots) [Dates and times](https://bun.com/docs/test/time) [Code coverage](https://bun.com/docs/test/coverage) [Test reporters](https://bun.com/docs/test/reporters) [Test configuration](https://bun.com/docs/test/configuration) [Runtime behavior](https://bun.com/docs/test/runtime-behavior) [Finding tests](https://bun.com/docs/test/discovery) [DOM testing](https://bun.com/docs/test/dom)

Package runner

[`bunx`](https://bun.com/docs/cli/bunx)

API

[HTTP server](https://bun.com/docs/api/http) [HTTP client](https://bun.com/docs/api/fetch) [WebSockets](https://bun.com/docs/api/websockets) [Workers](https://bun.com/docs/api/workers) [Binary data](https://bun.com/docs/api/binary-data) [Streams](https://bun.com/docs/api/streams) [SQL](https://bun.com/docs/api/sql) [S3 Object Storage](https://bun.com/docs/api/s3) [File I/O](https://bun.com/docs/api/file-io) [Redis client](https://bun.com/docs/api/redis) [import.meta](https://bun.com/docs/api/import-meta) [SQLite](https://bun.com/docs/api/sqlite) [FileSystemRouter](https://bun.com/docs/api/file-system-router) [TCP sockets](https://bun.com/docs/api/tcp) [UDP sockets](https://bun.com/docs/api/udp) [Globals](https://bun.com/docs/api/globals) [$ Shell](https://bun.com/docs/runtime/shell) [Child processes](https://bun.com/docs/api/spawn) [YAML](https://bun.com/docs/api/yaml) [HTMLRewriter](https://bun.com/docs/api/html-rewriter) [Hashing](https://bun.com/docs/api/hashing) [Console](https://bun.com/docs/api/console) [Cookie](https://bun.com/docs/api/cookie) [FFI](https://bun.com/docs/api/ffi) [C Compiler](https://bun.com/docs/api/cc) [Secrets](https://bun.com/docs/api/secrets) [Testing](https://bun.com/docs/cli/test) [Utils](https://bun.com/docs/api/utils) [Node-API](https://bun.com/docs/api/node-api) [Glob](https://bun.com/docs/api/glob) [DNS](https://bun.com/docs/api/dns) [Semver](https://bun.com/docs/api/semver) [Color](https://bun.com/docs/api/color) [Transpiler](https://bun.com/docs/api/transpiler)

Project

[Roadmap](https://bun.com/docs/project/roadmap) [Benchmarking](https://bun.com/docs/project/benchmarking) [Contributing](https://bun.com/docs/project/contributing) [Building Windows](https://bun.com/docs/project/building-windows) [Bindgen](https://bun.com/docs/project/bindgen) [License](https://bun.com/docs/project/licensing)

Bun's fast native bundler can be used via the `bun build` CLI command or the `Bun.build()` JavaScript API.

JavaScript

CLI

JavaScript

```
await Bun.build({
  entrypoints: ['./index.tsx'],
  outdir: './build',
});

```

CLI

```
bun build ./index.tsx --outdir ./build
```

It's fast. The numbers below represent performance on esbuild's [three.js benchmark](https://github.com/oven-sh/bun/tree/main/bench/bundle).

[![](https://bun.com/images/bundler-speed.png)](https://bun.com/images/bundler-speed.png) Bundling 10 copies of three.js from scratch, with sourcemaps and minification

## [Why bundle?](https://bun.com/docs/bundler\#why-bundle)

The bundler is a key piece of infrastructure in the JavaScript ecosystem. As a brief overview of why bundling is so important:

- **Reducing HTTP requests.** A single package in `node_modules` may consist of hundreds of files, and large applications may have dozens of such dependencies. Loading each of these files with a separate HTTP request becomes untenable very quickly, so bundlers are used to convert our application source code into a smaller number of self-contained "bundles" that can be loaded with a single request.
- **Code transforms.** Modern apps are commonly built with languages or tools like TypeScript, JSX, and CSS modules, all of which must be converted into plain JavaScript and CSS before they can be consumed by a browser. The bundler is the natural place to configure these transformations.
- **Framework features.** Frameworks rely on bundler plugins & code transformations to implement common patterns like file-system routing, client-server code co-location (think `getServerSideProps` or Remix loaders), and server components.
- **Full-stack Applications.** Bun's bundler can handle both server and client code in a single command, enabling optimized production builds and single-file executables. With build-time HTML imports, you can bundle your entire application — frontend assets and backend server — into a single deployable unit.

Let's jump into the bundler API.

Note that the Bun bundler is not intended to replace `tsc` for typechecking or generating type declarations.

## [Basic example](https://bun.com/docs/bundler\#basic-example)

Let's build our first bundle. You have the following two files, which implement a simple client-side rendered React app.

./index.tsx

./Component.tsx

./index.tsx

```
import * as ReactDOM from 'react-dom/client';
import {Component} from "./Component"

const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(<Component message="Sup!" />)

```

./Component.tsx

```
export function Component(props: {message: string}) {
  return <p>{props.message}</p>
}

```

Here, `index.tsx` is the "entrypoint" to our application. Commonly, this will be a script that performs some _side effect_, like starting a server or—in this case—initializing a React root. Because we're using TypeScript & JSX, we need to bundle our code before it can be sent to the browser.

To create our bundle:

JavaScript

CLI

JavaScript

```
await Bun.build({
  entrypoints: ['./index.tsx'],
  outdir: './out',
})

```

CLI

```
bun build ./index.tsx --outdir ./out
```

For each file specified in `entrypoints`, Bun will generate a new bundle. This bundle will be written to disk in the `./out` directory (as resolved from the current working directory). After running the build, the file system looks like this:

```
.
├── index.tsx
├── Component.tsx
└── out
    └── index.js

```

The contents of `out/index.js` will look something like this:

out/index.js

```
// ...
// ~20k lines of code
// including the contents of `react-dom/client` and all its dependencies
// this is where the $jsxDEV and $createRoot functions are defined

// Component.tsx
function Component(props) {
  return $jsxDEV("p", {
    children: props.message
  }, undefined, false, undefined, this);
}

// index.tsx
var rootNode = document.getElementById("root");
var root = $createRoot(rootNode);
root.render($jsxDEV(Component, {
  message: "Sup!"
}, undefined, false, undefined, this));

```

Tutorial: Run this file in your browser

We can load this file in the browser to see our app in action. Create an `index.html` file in the `out` directory:

```
touch out/index.html
```

Then paste the following contents into it:

```
<html>
  <body>
    <div id="root"></div>
    <script type="module" src="/index.js"></script>
  </body>
</html>

```

Then spin up a static file server serving the `out` directory:

```
bunx serve out
```

Visit `http://localhost:5000` to see your bundled app in action.

## [Watch mode](https://bun.com/docs/bundler\#watch-mode)

Like the runtime and test runner, the bundler supports watch mode natively.

```
bun build ./index.tsx --outdir ./out --watch
```

## [Content types](https://bun.com/docs/bundler\#content-types)

Like the Bun runtime, the bundler supports an array of file types out of the box. The following table breaks down the bundler's set of standard "loaders". Refer to [Bundler > File types](https://bun.com/docs/runtime/loaders) for full documentation.

| Extensions | Details |
| --- | --- |
| `.js` `.jsx`, `.cjs` `.mjs` `.mts` `.cts` `.ts` `.tsx` | Uses Bun's built-in transpiler to parse the file and transpile TypeScript/JSX syntax to vanilla JavaScript. The bundler executes a set of default transforms including dead code elimination and tree shaking. At the moment Bun does not attempt to down-convert syntax; if you use recently ECMAScript syntax, that will be reflected in the bundled code. |
| `.json` | JSON files are parsed and inlined into the bundle as a JavaScript object.<br>```<br>import pkg from "./package.json";<br>pkg.name; // => "my-package"<br>``` |
| `.toml` | TOML files are parsed and inlined into the bundle as a JavaScript object.<br>```<br>import config from "./bunfig.toml";<br>config.logLevel; // => "debug"<br>``` |
| `.txt` | The contents of the text file are read and inlined into the bundle as a string.<br>```<br>import contents from "./file.txt";<br>console.log(contents); // => "Hello, world!"<br>``` |
| `.node` `.wasm` | These files are supported by the Bun runtime, but during bundling they are treated as [assets](https://bun.com/docs/bundler#assets). |

### [Assets](https://bun.com/docs/bundler\#assets)

If the bundler encounters an import with an unrecognized extension, it treats the imported file as an _external file_. The referenced file is copied as-is into `outdir`, and the import is resolved as a _path_ to the file.

Input

Output

Input

```
// bundle entrypoint
import logo from "./logo.svg";
console.log(logo);

```

Output

```
// bundled output
var logo = "./logo-ab237dfe.svg";
console.log(logo);

```

The exact behavior of the file loader is also impacted by [`naming`](https://bun.com/docs/bundler#naming) and [`publicPath`](https://bun.com/docs/bundler#publicpath).

Refer to the [Bundler > Loaders](https://bun.com/docs/bundler/loaders#file) page for more complete documentation on the file loader.

### [Plugins](https://bun.com/docs/bundler\#plugins)

The behavior described in this table can be overridden or extended with [plugins](https://bun.com/docs/bundler/plugins). Refer to the [Bundler > Loaders](https://bun.com/docs/bundler/plugins) page for complete documentation.

## [API](https://bun.com/docs/bundler\#api)

### [`entrypoints`](https://bun.com/docs/bundler\#entrypoints)

**Required.** An array of paths corresponding to the entrypoints of our application. One bundle will be generated for each entrypoint.

JavaScript

CLI

JavaScript

```
const result = await Bun.build({
  entrypoints: ["./index.ts"],
});
// => { success: boolean, outputs: BuildArtifact[], logs: BuildMessage[] }

```

CLI

```
bun build --entrypoints ./index.ts
```

```
# the bundle will be printed to stdout
# <bundled code>
```

### [`outdir`](https://bun.com/docs/bundler\#outdir)

The directory where output files will be written.

JavaScript

CLI

JavaScript

```
const result = await Bun.build({
  entrypoints: ['./index.ts'],
  outdir: './out'
});
// => { success: boolean, outputs: BuildArtifact[], logs: BuildMessage[] }

```

CLI

```
bun build --entrypoints ./index.ts --outdir ./out
```

```
# a summary of bundled files will be printed to stdout
```

If `outdir` is not passed to the JavaScript API, bundled code will not be written to disk. Bundled files are returned in an array of `BuildArtifact` objects. These objects are Blobs with extra properties; see [Outputs](https://bun.com/docs/bundler#outputs) for complete documentation.

```
const result = await Bun.build({
  entrypoints: ["./index.ts"],
});

for (const res of result.outputs) {
  // Can be consumed as blobs
  await res.text();

  // Bun will set Content-Type and Etag headers
  new Response(res);

  // Can be written manually, but you should use `outdir` in this case.
  Bun.write(path.join("out", res.path), res);
}

```

When `outdir` is set, the `path` property on a `BuildArtifact` will be the absolute path to where it was written to.

### [`target`](https://bun.com/docs/bundler\#target)

The intended execution environment for the bundle.

JavaScript

CLI

JavaScript

```
await Bun.build({
  entrypoints: ['./index.ts'],
  outdir: './out',
  target: 'browser', // default
})

```

CLI

```
bun build --entrypoints ./index.ts --outdir ./out --target browser
```

Depending on the target, Bun will apply different module resolution rules and optimizations.

| `browser` | _Default._ For generating bundles that are intended for execution by a browser. Prioritizes the `"browser"` export condition when resolving imports. Importing any built-in modules, like `node:events` or `node:path` will work, but calling some functions, like `fs.readFile` will not work. |
| `bun` | For generating bundles that are intended to be run by the Bun runtime. In many cases, it isn't necessary to bundle server-side code; you can directly execute the source code without modification. However, bundling your server code can reduce startup times and improve running performance. This is the target to use for building full-stack applications with build-time HTML imports, where both server and client code are bundled together.<br>All bundles generated with `target: "bun"` are marked with a special `// @bun` pragma, which indicates to the Bun runtime that there's no need to re-transpile the file before execution.<br>If any entrypoints contains a Bun shebang ( `#!/usr/bin/env bun`) the bundler will default to `target: "bun"` instead of `"browser"`.<br>When using `target: "bun"` and `format: "cjs"` together, the `// @bun @bun-cjs` pragma is added and the CommonJS wrapper function is not compatible with Node.js. |
| `node` | For generating bundles that are intended to be run by Node.js. Prioritizes the `"node"` export condition when resolving imports, and outputs `.mjs`. In the future, this will automatically polyfill the `Bun` global and other built-in `bun:*` modules, though this is not yet implemented. |

### [`format`](https://bun.com/docs/bundler\#format)

Specifies the module format to be used in the generated bundles.

Bun defaults to `"esm"`, and provides experimental support for `"cjs"` and `"iife"`.

#### `format: "esm"` \- ES Module

This is the default format, which supports ES Module syntax including top-level `await`, import.meta, and more.

JavaScript

CLI

JavaScript

```
await Bun.build({
  entrypoints: ['./index.tsx'],
  outdir: './out',
  format: "esm",
})

```

CLI

```
bun build ./index.tsx --outdir ./out --format esm
```

To use ES Module syntax in browsers, set `format` to `"esm"` and make sure your `<script type="module">` tag has `type="module"` set.

#### `format: "cjs"` \- CommonJS

To build a CommonJS module, set `format` to `"cjs"`. When choosing `"cjs"`, the default target changes from `"browser"` (esm) to `"node"` (cjs). CommonJS modules transpiled with `format: "cjs", target: "node"` can be executed in both Bun and Node.js (assuming the APIs in use are supported by both).

JavaScript

CLI

JavaScript

```
await Bun.build({
  entrypoints: ['./index.tsx'],
  outdir: './out',
  format: "cjs",
})

```

CLI

```
bun build ./index.tsx --outdir ./out --format cjs
```

#### `format: "iife"` \- IIFE

TODO: document IIFE once we support globalNames.

### [`splitting`](https://bun.com/docs/bundler\#splitting)

Whether to enable code splitting.

JavaScript

CLI

JavaScript

```
await Bun.build({
  entrypoints: ['./index.tsx'],
  outdir: './out',
  splitting: false, // default
})

```

CLI

```
bun build ./index.tsx --outdir ./out --splitting
```

When `true`, the bundler will enable _code splitting_. When multiple entrypoints both import the same file, module, or set of files/modules, it's often useful to split the shared code into a separate bundle. This shared bundle is known as a _chunk_. Consider the following files:

entry-a.ts

entry-b.ts

shared.ts

entry-a.ts

```
import { shared } from './shared.ts';

```

entry-b.ts

```
import { shared } from './shared.ts';

```

shared.ts

```
export const shared = 'shared';

```

To bundle `entry-a.ts` and `entry-b.ts` with code-splitting enabled:

JavaScript

CLI

JavaScript

```
await Bun.build({
  entrypoints: ['./entry-a.ts', './entry-b.ts'],
  outdir: './out',
  splitting: true,
})

```

CLI

```
bun build ./entry-a.ts ./entry-b.ts --outdir ./out --splitting
```

Running this build will result in the following files:

```
.
├── entry-a.tsx
├── entry-b.tsx
├── shared.tsx
└── out
    ├── entry-a.js
    ├── entry-b.js
    └── chunk-2fce6291bf86559d.js

```

The generated `chunk-2fce6291bf86559d.js` file contains the shared code. To avoid collisions, the file name automatically includes a content hash by default. This can be customized with [`naming`](https://bun.com/docs/bundler#naming).

### [`plugins`](https://bun.com/docs/bundler\#plugins)

A list of plugins to use during bundling.

JavaScript

CLI

JavaScript

```
await Bun.build({
  entrypoints: ['./index.tsx'],
  outdir: './out',
  plugins: [/* ... */],
})

```

CLI

```
n/a

```

Bun implements a universal plugin system for both Bun's runtime and bundler. Refer to the [plugin documentation](https://bun.com/docs/bundler/plugins) for complete documentation.

### [`env`](https://bun.com/docs/bundler\#env)

Controls how environment variables are handled during bundling. Internally, this uses `define` to inject environment variables into the bundle, but makes it easier to specify the environment variables to inject.

#### `env: "inline"`

Injects environment variables into the bundled output by converting `process.env.FOO` references to string literals containing the actual environment variable values.

JavaScript

CLI

JavaScript

```
await Bun.build({
  entrypoints: ['./index.tsx'],
  outdir: './out',
  env: "inline",
})

```

CLI

```
FOO=bar BAZ=123 bun build ./index.tsx --outdir ./out --env inline
```

For the input below:

input.js

```
console.log(process.env.FOO);
console.log(process.env.BAZ);

```

The generated bundle will contain the following code:

output.js

```
console.log("bar");
console.log("123");

```

#### `env: "PUBLIC_*"` (prefix)

Inlines environment variables matching the given prefix (the part before the `*` character), replacing `process.env.FOO` with the actual environment variable value. This is useful for selectively inlining environment variables for things like public-facing URLs or client-side tokens, without worrying about injecting private credentials into output bundles.

JavaScript

CLI

JavaScript

```
await Bun.build({
  entrypoints: ['./index.tsx'],
  outdir: './out',

  // Inline all env vars that start with "ACME_PUBLIC_"
  env: "ACME_PUBLIC_*",
})

```

CLI

```
FOO=bar BAZ=123 ACME_PUBLIC_URL=https://acme.com bun build ./index.tsx --outdir ./out --env 'ACME_PUBLIC_*'
```

For example, given the following environment variables:

```
FOO=bar BAZ=123 ACME_PUBLIC_URL=https://acme.com
```

And source code:

index.tsx

```
console.log(process.env.FOO);
console.log(process.env.ACME_PUBLIC_URL);
console.log(process.env.BAZ);

```

The generated bundle will contain the following code:

```
console.log(process.env.FOO);
console.log("https://acme.com");
console.log(process.env.BAZ);

```

#### `env: "disable"`

Disables environment variable injection entirely.

For example, given the following environment variables:

```
FOO=bar BAZ=123 ACME_PUBLIC_URL=https://acme.com
```

And source code:

index.tsx

```
console.log(process.env.FOO);
console.log(process.env.ACME_PUBLIC_URL);
console.log(process.env.BAZ);

```

The generated bundle will contain the following code:

```
console.log(process.env.FOO);
console.log(process.env.BAZ);

```

### [`sourcemap`](https://bun.com/docs/bundler\#sourcemap)

Specifies the type of sourcemap to generate.

JavaScript

CLI

JavaScript

```
await Bun.build({
  entrypoints: ['./index.tsx'],
  outdir: './out',
  sourcemap: 'linked', // default 'none'
})

```

CLI

```
bun build ./index.tsx --outdir ./out --sourcemap=linked
```

| `"none"` | _Default._ No sourcemap is generated. |
| `"linked"` | A separate `*.js.map` file is created alongside each `*.js` bundle using a `//# sourceMappingURL` comment to link the two. Requires `--outdir` to be set. The base URL of this can be customized with `--public-path`.<br>```<br>// <bundled code here><br>//# sourceMappingURL=bundle.js.map<br>``` |
| `"external"` | A separate `*.js.map` file is created alongside each `*.js` bundle without inserting a `//# sourceMappingURL` comment. |

Generated bundles contain a [debug id](https://sentry.engineering/blog/the-case-for-debug-ids) that can be used to associate a bundle with its corresponding sourcemap. This `debugId` is added as a comment at the bottom of the file.

```
// <generated bundle code>

//# debugId=<DEBUG ID>

```

* * *

- `"inline"`

- A sourcemap is generated and appended to the end of the generated bundle as a base64 payload.







```
// <bundled code here>

//# sourceMappingURL=data:application/json;base64,<encoded sourcemap here>

```











The associated `*.js.map` sourcemap will be a JSON file containing an equivalent `debugId` property.


### [`minify`](https://bun.com/docs/bundler\#minify)

Whether to enable minification. Default `false`.

When targeting `bun`, identifiers will be minified by default.

When `minify.syntax` is enabled, unused function and class expression names are removed unless `minify.keepNames` is set to `true` or `--keep-names` flag is used.

To enable all minification options:

JavaScript

CLI

JavaScript

```
await Bun.build({
  entrypoints: ['./index.tsx'],
  outdir: './out',
  minify: true, // default false
})

```

CLI

```
bun build ./index.tsx --outdir ./out --minify
```

To granularly enable certain minifications:

JavaScript

CLI

JavaScript

```
await Bun.build({
  entrypoints: ['./index.tsx'],
  outdir: './out',
  minify: {
    whitespace: true,
    identifiers: true,
    syntax: true,
    keepNames: false, // default
  },
})

```

CLI

```
bun build ./index.tsx --outdir ./out --minify-whitespace --minify-identifiers --minify-syntax
```

```

# To preserve function and class names during minification:
```

```
bun build ./index.tsx --outdir ./out --minify --keep-names
```

### [`external`](https://bun.com/docs/bundler\#external)

A list of import paths to consider _external_. Defaults to `[]`.

JavaScript

CLI

JavaScript

```
await Bun.build({
  entrypoints: ['./index.tsx'],
  outdir: './out',
  external: ["lodash", "react"], // default: []
})

```

CLI

```
bun build ./index.tsx --outdir ./out --external lodash --external react
```

An external import is one that will not be included in the final bundle. Instead, the `import` statement will be left as-is, to be resolved at runtime.

For instance, consider the following entrypoint file:

index.tsx

```
import _ from "lodash";
import {z} from "zod";

const value = z.string().parse("Hello world!")
console.log(_.upperCase(value));

```

Normally, bundling `index.tsx` would generate a bundle containing the entire source code of the `"zod"` package. If instead, we want to leave the `import` statement as-is, we can mark it as external:

JavaScript

CLI

JavaScript

```
await Bun.build({
  entrypoints: ['./index.tsx'],
  outdir: './out',
  external: ['zod'],
})

```

CLI

```
bun build ./index.tsx --outdir ./out --external zod
```

The generated bundle will look something like this:

out/index.js

```
import {z} from "zod";

// ...
// the contents of the "lodash" package
// including the `_.upperCase` function

var value = z.string().parse("Hello world!")
console.log(_.upperCase(value));

```

To mark all imports as external, use the wildcard `*`:

JavaScript

CLI

JavaScript

```
await Bun.build({
  entrypoints: ['./index.tsx'],
  outdir: './out',
  external: ['*'],
})

```

CLI

```
bun build ./index.tsx --outdir ./out --external '*'
```

### [`packages`](https://bun.com/docs/bundler\#packages)

Control whatever package dependencies are included to bundle or not. Possible values: `bundle` (default), `external`. Bun treats any import which path do not start with `.`, `..` or `/` as package.

JavaScript

CLI

JavaScript

```
await Bun.build({
  entrypoints: ['./index.ts'],
  packages: 'external',
})

```

CLI

```
bun build ./index.ts --packages external
```

### [`naming`](https://bun.com/docs/bundler\#naming)

Customizes the generated file names. Defaults to `./[dir]/[name].[ext]`.

JavaScript

CLI

JavaScript

```
await Bun.build({
  entrypoints: ['./index.tsx'],
  outdir: './out',
  naming: "[dir]/[name].[ext]", // default
})

```

CLI

```
bun build ./index.tsx --outdir ./out --entry-naming [dir]/[name].[ext]
```

By default, the names of the generated bundles are based on the name of the associated entrypoint.

```
.
├── index.tsx
└── out
    └── index.js

```

With multiple entrypoints, the generated file hierarchy will reflect the directory structure of the entrypoints.

```
.
├── index.tsx
└── nested
    └── index.tsx
└── out
    ├── index.js
    └── nested
        └── index.js

```

The names and locations of the generated files can be customized with the `naming` field. This field accepts a template string that is used to generate the filenames for all bundles corresponding to entrypoints. where the following tokens are replaced with their corresponding values:

- `[name]` \- The name of the entrypoint file, without the extension.
- `[ext]` \- The extension of the generated bundle.
- `[hash]` \- A hash of the bundle contents.
- `[dir]` \- The relative path from the project root to the parent directory of the source file.

For example:

| Token | `[name]` | `[ext]` | `[hash]` | `[dir]` |
| --- | --- | --- | --- | --- |
| `./index.tsx` | `index` | `js` | `a1b2c3d4` | `""` (empty string) |
| `./nested/entry.ts` | `entry` | `js` | `c3d4e5f6` | `"nested"` |

We can combine these tokens to create a template string. For instance, to include the hash in the generated bundle names:

JavaScript

CLI

JavaScript

```
await Bun.build({
  entrypoints: ['./index.tsx'],
  outdir: './out',
  naming: 'files/[dir]/[name]-[hash].[ext]',
})

```

CLI

```
bun build ./index.tsx --outdir ./out --entry-naming [name]-[hash].[ext]
```

This build would result in the following file structure:

```
.
├── index.tsx
└── out
    └── files
        └── index-a1b2c3d4.js

```

When a `string` is provided for the `naming` field, it is used only for bundles _that correspond to entrypoints_. The names of [chunks](https://bun.com/docs/bundler#splitting) and copied assets are not affected. Using the JavaScript API, separate template strings can be specified for each type of generated file.

JavaScript

CLI

JavaScript

```
await Bun.build({
  entrypoints: ['./index.tsx'],
  outdir: './out',
  naming: {
    // default values
    entry: '[dir]/[name].[ext]',
    chunk: '[name]-[hash].[ext]',
    asset: '[name]-[hash].[ext]',
  },
})

```

CLI

```
bun build ./index.tsx --outdir ./out --entry-naming "[dir]/[name].[ext]" --chunk-naming "[name]-[hash].[ext]" --asset-naming "[name]-[hash].[ext]"
```

### [`root`](https://bun.com/docs/bundler\#root)

The root directory of the project.

JavaScript

CLI

JavaScript

```
await Bun.build({
  entrypoints: ['./pages/a.tsx', './pages/b.tsx'],
  outdir: './out',
  root: '.',
})

```

CLI

```
n/a

```

If unspecified, it is computed to be the first common ancestor of all entrypoint files. Consider the following file structure:

```
.
└── pages
  └── index.tsx
  └── settings.tsx

```

We can build both entrypoints in the `pages` directory:

JavaScript

CLI

JavaScript

```
await Bun.build({
  entrypoints: ['./pages/index.tsx', './pages/settings.tsx'],
  outdir: './out',
})

```

CLI

```
bun build ./pages/index.tsx ./pages/settings.tsx --outdir ./out
```

This would result in a file structure like this:

```
.
└── pages
  └── index.tsx
  └── settings.tsx
└── out
  └── index.js
  └── settings.js

```

Since the `pages` directory is the first common ancestor of the entrypoint files, it is considered the project root. This means that the generated bundles live at the top level of the `out` directory; there is no `out/pages` directory.

This behavior can be overridden by specifying the `root` option:

JavaScript

CLI

JavaScript

```
await Bun.build({
  entrypoints: ['./pages/index.tsx', './pages/settings.tsx'],
  outdir: './out',
  root: '.',
})

```

CLI

```
bun build ./pages/index.tsx ./pages/settings.tsx --outdir ./out --root .
```

By specifying `.` as `root`, the generated file structure will look like this:

```
.
└── pages
  └── index.tsx
  └── settings.tsx
└── out
  └── pages
    └── index.js
    └── settings.js

```

### [`publicPath`](https://bun.com/docs/bundler\#publicpath)

A prefix to be appended to any import paths in bundled code.

In many cases, generated bundles will contain no `import` statements. After all, the goal of bundling is to combine all of the code into a single file. However there are a number of cases with the generated bundles will contain `import` statements.

- **Asset imports** — When importing an unrecognized file type like `*.svg`, the bundler defers to the [`file` loader](https://bun.com/docs/bundler/loaders#file), which copies the file into `outdir` as is. The import is converted into a variable
- **External modules** — Files and modules can be marked as [`external`](https://bun.com/docs/bundler#external), in which case they will not be included in the bundle. Instead, the `import` statement will be left in the final bundle.
- **Chunking**. When [`splitting`](https://bun.com/docs/bundler#splitting) is enabled, the bundler may generate separate "chunk" files that represent code that is shared among multiple entrypoints.

In any of these cases, the final bundles may contain paths to other files. By default these imports are _relative_. Here is an example of a simple asset import:

Input

Output

Input

```
import logo from './logo.svg';
console.log(logo);

```

Output

```
// logo.svg is copied into <outdir>
// and hash is added to the filename to prevent collisions
var logo = './logo-a7305bdef.svg';
console.log(logo);

```

Setting `publicPath` will prefix all file paths with the specified value.

JavaScript

CLI

JavaScript

```
await Bun.build({
  entrypoints: ['./index.tsx'],
  outdir: './out',
  publicPath: 'https://cdn.example.com/', // default is undefined
})

```

CLI

```
bun build ./index.tsx --outdir ./out --public-path https://cdn.example.com/
```

The output file would now look something like this.

Output

```
var logo = './logo-a7305bdef.svg';
var logo = 'https://cdn.example.com/logo-a7305bdef.svg';
```

### [`define`](https://bun.com/docs/bundler\#define)

A map of global identifiers to be replaced at build time. Keys of this object are identifier names, and values are JSON strings that will be inlined.

JavaScript

CLI

JavaScript

```
await Bun.build({
  entrypoints: ['./index.tsx'],
  outdir: './out',
  define: {
    STRING: JSON.stringify("value"),
    "nested.boolean": "true",
  },
})

```

CLI

```
bun build ./index.tsx --outdir ./out --define 'STRING="value"' --define "nested.boolean=true"
```

### [`loader`](https://bun.com/docs/bundler\#loader)

A map of file extensions to [built-in loader names](https://bun.com/docs/bundler/loaders#built-in-loaders). This can be used to quickly customize how certain files are loaded.

JavaScript

CLI

JavaScript

```
await Bun.build({
  entrypoints: ['./index.tsx'],
  outdir: './out',
  loader: {
    ".png": "dataurl",
    ".txt": "file",
  },
})

```

CLI

```
bun build ./index.tsx --outdir ./out --loader .png:dataurl --loader .txt:file
```

### [`banner`](https://bun.com/docs/bundler\#banner)

A banner to be added to the final bundle, this can be a directive like "use client" for react or a comment block such as a license for the code.

JavaScript

CLI

JavaScript

```
await Bun.build({
  entrypoints: ['./index.tsx'],
  outdir: './out',
  banner: '"use client";'
})

```

CLI

```
bun build ./index.tsx --outdir ./out --banner "\"use client\";"
```

A footer to be added to the final bundle, this can be something like a comment block for a license or just a fun easter egg.

JavaScript

CLI

JavaScript

```
await Bun.build({
  entrypoints: ['./index.tsx'],
  outdir: './out',
  footer: '// built with love in SF'
})

```

CLI

```
bun build ./index.tsx --outdir ./out --footer="// built with love in SF"
```

### [`drop`](https://bun.com/docs/bundler\#drop)

Remove function calls from a bundle. For example, `--drop=console` will remove all calls to `console.log`. Arguments to calls will also be removed, regardless of if those arguments may have side effects. Dropping `debugger` will remove all `debugger` statements.

JavaScript

CLI

JavaScript

```
await Bun.build({
  entrypoints: ['./index.tsx'],
  outdir: './out',
  drop: ["console", "debugger", "anyIdentifier.or.propertyAccess"],
})

```

CLI

```
bun build ./index.tsx --outdir ./out --drop=console --drop=debugger --drop=anyIdentifier.or.propertyAccess
```

### [`throw`](https://bun.com/docs/bundler\#throw)

Controls error handling behavior when the build fails. When set to `true` (default), the returned promise rejects with an `AggregateError`. When set to `false`, the promise resolves with a `BuildOutput` object where `success` is `false`.

JavaScript

```
// Default behavior: throws on error
try {
  await Bun.build({
    entrypoints: ['./index.tsx'],
    throw: true, // default
  });
} catch (error) {
  // Handle AggregateError
  console.error("Build failed:", error);
}

// Alternative: handle errors via success property
const result = await Bun.build({
  entrypoints: ['./index.tsx'],
  throw: false,
});

if (!result.success) {
  console.error("Build failed with errors:", result.logs);
}

```

## [Outputs](https://bun.com/docs/bundler\#outputs)

The `Bun.build` function returns a `Promise<BuildOutput>`, defined as:

```
interface BuildOutput {
  outputs: BuildArtifact[];
  success: boolean;
  logs: Array<object>; // see docs for details
}

interface BuildArtifact extends Blob {
  kind: "entry-point" | "chunk" | "asset" | "sourcemap";
  path: string;
  loader: Loader;
  hash: string | null;
  sourcemap: BuildArtifact | null;
}

```

The `outputs` array contains all the files that were generated by the build. Each artifact implements the `Blob` interface.

```
const build = await Bun.build({
  /* */
});

for (const output of build.outputs) {
  await output.arrayBuffer(); // => ArrayBuffer
  await output.bytes(); // => Uint8Array
  await output.text(); // string
}

```

Each artifact also contains the following properties:

| `kind` | What kind of build output this file is. A build generates bundled entrypoints, code-split "chunks", sourcemaps, bytecode, and copied assets (like images). |
| `path` | Absolute path to the file on disk |
| `loader` | The loader was used to interpret the file. See [Bundler > Loaders](https://bun.com/docs/bundler/loaders) to see how Bun maps file extensions to the appropriate built-in loader. |
| `hash` | The hash of the file contents. Always defined for assets. |
| `sourcemap` | The sourcemap file corresponding to this file, if generated. Only defined for entrypoints and chunks. |

Similar to `BunFile`, `BuildArtifact` objects can be passed directly into `new Response()`.

```
const build = await Bun.build({
  /* */
});

const artifact = build.outputs[0];

// Content-Type header is automatically set
return new Response(artifact);

```

The Bun runtime implements special pretty-printing of `BuildArtifact` object to make debugging easier.

Build script

Shell output

Build script

```
// build.ts
const build = await Bun.build({/* */});

const artifact = build.outputs[0];
console.log(artifact);

```

Shell output

```
bun run build.ts
```

```
BuildArtifact (entry-point) {
  path: "./index.js",
  loader: "tsx",
  kind: "entry-point",
  hash: "824a039620219640",
  Blob (114 bytes) {
    type: "text/javascript;charset=utf-8"
  },
  sourcemap: null
}
```

### [Bytecode](https://bun.com/docs/bundler\#bytecode)

The `bytecode: boolean` option can be used to generate bytecode for any JavaScript/TypeScript entrypoints. This can greatly improve startup times for large applications. Only supported for `"cjs"` format, only supports `"target": "bun"` and dependent on a matching version of Bun. This adds a corresponding `.jsc` file for each entrypoint.

JavaScript

CLI

JavaScript

```
await Bun.build({
  entrypoints: ["./index.tsx"],
  outdir: "./out",
  bytecode: true,
})

```

CLI

```
bun build ./index.tsx --outdir ./out --bytecode
```

### [Executables](https://bun.com/docs/bundler\#executables)

Bun supports "compiling" a JavaScript/TypeScript entrypoint into a standalone executable. This executable contains a copy of the Bun binary.

```
bun build ./cli.tsx --outfile mycli --compile
```

```
./mycli
```

Refer to [Bundler > Executables](https://bun.com/docs/bundler/executables) for complete documentation.

## [Logs and errors](https://bun.com/docs/bundler\#logs-and-errors)

On failure, `Bun.build` returns a rejected promise with an `AggregateError`. This can be logged to the console for pretty printing of the error list, or programmatically read with a `try`/ `catch` block.

```
try {
  const result = await Bun.build({
    entrypoints: ["./index.tsx"],
    outdir: "./out",
  });
} catch (e) {
  // TypeScript does not allow annotations on the catch clause
  const error = e as AggregateError;
  console.error("Build Failed");

  // Example: Using the built-in formatter
  console.error(error);

  // Example: Serializing the failure as a JSON string.
  console.error(JSON.stringify(error, null, 2));
}

```

Most of the time, an explicit `try`/ `catch` is not needed, as Bun will neatly print uncaught exceptions. It is enough to just use a top-level `await` on the `Bun.build` call.

Each item in `error.errors` is an instance of `BuildMessage` or `ResolveMessage` (subclasses of Error), containing detailed information for each error.

```
class BuildMessage {
  name: string;
  position?: Position;
  message: string;
  level: "error" | "warning" | "info" | "debug" | "verbose";
}

class ResolveMessage extends BuildMessage {
  code: string;
  referrer: string;
  specifier: string;
  importKind: ImportKind;
}

```

On build success, the returned object contains a `logs` property, which contains bundler warnings and info messages.

```
const result = await Bun.build({
  entrypoints: ["./index.tsx"],
  outdir: "./out",
});

if (result.logs.length > 0) {
  console.warn("Build succeeded with warnings:");
  for (const message of result.logs) {
    // Bun will pretty print the message object
    console.warn(message);
  }
}

```

## [Reference](https://bun.com/docs/bundler\#reference)

```
interface Bun {
  build(options: BuildOptions): Promise<BuildOutput>;
}

interface BuildConfig {
  entrypoints: string[]; // list of file path
  outdir?: string; // output directory
  target?: Target; // default: "browser"
  /**
   * Output module format. Top-level await is only supported for `"esm"`.
   *
   * Can be:
   * - `"esm"`
   * - `"cjs"` (**experimental**)
   * - `"iife"` (**experimental**)
   *
   * @default "esm"
   */
  format?: "esm" | "cjs" | "iife";
  naming?:
    | string
    | {
        chunk?: string;
        entry?: string;
        asset?: string;
      };
  root?: string; // project root
  splitting?: boolean; // default true, enable code splitting
  plugins?: BunPlugin[];
  external?: string[];
  packages?: "bundle" | "external";
  publicPath?: string;
  define?: Record<string, string>;
  loader?: { [k in string]: Loader };
  sourcemap?: "none" | "linked" | "inline" | "external" | "linked" | boolean; // default: "none", true -> "inline"
  /**
   * package.json `exports` conditions used when resolving imports
   *
   * Equivalent to `--conditions` in `bun build` or `bun run`.
   *
   * https://nodejs.org/api/packages.html#exports
   */
  conditions?: Array<string> | string;

  /**
   * Controls how environment variables are handled during bundling.
   *
   * Can be one of:
   * - `"inline"`: Injects environment variables into the bundled output by converting `process.env.FOO`
   *   references to string literals containing the actual environment variable values
   * - `"disable"`: Disables environment variable injection entirely
   * - A string ending in `*`: Inlines environment variables that match the given prefix.
   *   For example, `"MY_PUBLIC_*"` will only include env vars starting with "MY_PUBLIC_"
   */
  env?: "inline" | "disable" | `${string}*`;
  minify?:
    | boolean
    | {
        whitespace?: boolean;
        syntax?: boolean;
        identifiers?: boolean;
        keepNames?: boolean;
      };
  /**
   * Ignore dead code elimination/tree-shaking annotations such as @__PURE__ and package.json
   * "sideEffects" fields. This should only be used as a temporary workaround for incorrect
   * annotations in libraries.
   */
  ignoreDCEAnnotations?: boolean;
  /**
   * Force emitting @__PURE__ annotations even if minify.whitespace is true.
   */
  emitDCEAnnotations?: boolean;

  /**
   * Generate bytecode for the output. This can dramatically improve cold
   * start times, but will make the final output larger and slightly increase
   * memory usage.
   *
   * Bytecode is currently only supported for CommonJS (`format: "cjs"`).
   *
   * Must be `target: "bun"`
   * @default false
   */
  bytecode?: boolean;
  /**
   * Add a banner to the bundled code such as "use client";
   */
  banner?: string;
  /**
   * Add a footer to the bundled code such as a comment block like
   *
   * `// made with bun!`
   */
  footer?: string;

  /**
   * Drop function calls to matching property accesses.
   */
  drop?: string[];

  /**
   * When set to `true`, the returned promise rejects with an AggregateError when a build failure happens.
   * When set to `false`, the `success` property of the returned object will be `false` when a build failure happens.
   *
   * This defaults to `true`.
   */
  throw?: boolean;
}

interface BuildOutput {
  outputs: BuildArtifact[];
  success: boolean;
  logs: Array<BuildMessage | ResolveMessage>;
}

interface BuildArtifact extends Blob {
  path: string;
  loader: Loader;
  hash: string | null;
  kind: "entry-point" | "chunk" | "asset" | "sourcemap" | "bytecode";
  sourcemap: BuildArtifact | null;
}

type Loader =
  | "js"
  | "jsx"
  | "ts"
  | "tsx"
  | "json"
  | "toml"
  | "file"
  | "napi"
  | "wasm"
  | "text";

interface BuildOutput {
  outputs: BuildArtifact[];
  success: boolean;
  logs: Array<BuildMessage | ResolveMessage>;
}

declare class ResolveMessage {
  readonly name: "ResolveMessage";
  readonly position: Position | null;
  readonly code: string;
  readonly message: string;
  readonly referrer: string;
  readonly specifier: string;
  readonly importKind:
    | "entry_point"
    | "stmt"
    | "require"
    | "import"
    | "dynamic"
    | "require_resolve"
    | "at"
    | "at_conditional"
    | "url"
    | "internal";
  readonly level: "error" | "warning" | "info" | "debug" | "verbose";

  toString(): string;
}

```

## CLI Usage

$bunbuild<entrypoints...>

### Flags

#### General Build Options

--production

Set NODE\_ENV=production and enable minification

--bytecode

Use a bytecode cache

--target=<val>

The intended execution environment for the bundle. "browser", "bun" or "node"

--root=<val>

Root directory used for multiple entry points

--no-bundle

Transpile file only, do not bundle

--env=<val>

Inline environment variables into the bundle as process.env.${name}. Defaults to 'disable'. To inline environment variables matching a prefix, use my prefix like 'FOO\_PUBLIC\_\*'.

#### Output & File Management

--outdir=<val>

Default to "dist" if multiple files

--outfile=<val>

Write to a file

--sourcemap=<val>

Build with sourcemaps - 'linked', 'inline', 'external', or 'none'

--public-path=<val>

A prefix to be appended to any import paths in bundled code

--entry-naming=<val>

Customize entry point filenames. Defaults to "\[dir\]/\[name\].\[ext\]"

--chunk-naming=<val>

Customize chunk filenames. Defaults to "\[name\]-\[hash\].\[ext\]"

--asset-naming=<val>

Customize asset filenames. Defaults to "\[name\]-\[hash\].\[ext\]"

#### Minification & Optimization

--splitting

Enable code splitting

--emit-dce-annotations

Re-emit DCE annotations in bundles. Enabled by default unless --minify-whitespace is passed.

--minify

Enable all minification flags

--minify-syntax

Minify syntax and inline data

--minify-whitespace

Minify whitespace

--minify-identifiers

Minify identifiers

--css-chunking

Chunk CSS files together to reduce duplicated CSS loaded in a browser. Only has an effect when multiple entrypoints import CSS

#### Module & Dependency Handling

--format=<val>

Specifies the module format to build to. "esm", "cjs" and "iife" are supported. Defaults to "esm".

-e,--external=<val>

Exclude module from transpilation (can use \* wildcards). ex: -e react

--packages=<val>

Add dependencies to bundle or keep them external. "external", "bundle" is supported. Defaults to "bundle".

--conditions=<val>

Pass custom conditions to resolve

#### Development Workflow

--watch

Automatically restart the process on file change

--no-clear-screen

Disable clearing the terminal screen on reload when --watch is enabled

--react-fast-refresh

Enable React Fast Refresh transform (does not emit hot-module code, use this for testing)

#### Output Content Customization

--banner=<val>

Add a banner to the bundled output such as "use client"; for a bundle being used with RSCs

--footer=<val>

Add a footer to the bundled output such as // built with bun!

#### Standalone Executable Build

--compile

Generate a standalone Bun executable containing your bundled code. Implies --production

--windows-hide-console

When using --compile targeting Windows, prevent a Command prompt from opening alongside the executable

--windows-icon=<val>

When using --compile targeting Windows, assign an executable icon

#### Experimental Web App Features

--app

(EXPERIMENTAL) Build a web app for production using Bun Bake.

--server-components

(EXPERIMENTAL) Enable server components

--debug-dump-server-files

When --app is set, dump all server files to disk even when building statically

--debug-no-minify

When --app is set, do not minify anything

### Examples

Frontend web apps:

bun build --outfile=bundle.js ./src/index.ts

bun build --minify --splitting --outdir=out ./index.jsx ./lib/worker.ts

Bundle code to be run in Bun (reduces server startup time)

bun build --target=bun --outfile=server.js ./server.ts

Creating a standalone executable (see https://bun.sh/docs/bundler/executables)

bun build --compile --outfile=my-app ./cli.ts

A full list of flags is available at https://bun.sh/docs/bundler

[Previous\\
\\
Security Scanner API](https://bun.com/docs/install/security-scanner-api) [Next\\
\\
HTML & static sites](https://bun.com/docs/bundler/html)

[![GitHub logo](<Base64-Image-Removed>)![GitHub logo](<Base64-Image-Removed>)\\
\\
Edit on GitHub](https://github.com/oven-sh/bun/edit/main/docs/bundler/index.md)

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