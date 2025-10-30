---
title: vs esbuild – Bundler | Bun Docs
url: 
description: Guides for migrating from other bundlers to Bun.
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

[Performance](https://bun.com/docs/bundler/vs-esbuild#performance) [CLI API](https://bun.com/docs/bundler/vs-esbuild#cli-api) [JavaScript API](https://bun.com/docs/bundler/vs-esbuild#javascript-api) [Plugin API](https://bun.com/docs/bundler/vs-esbuild#plugin-api) [`onResolve`](https://bun.com/docs/bundler/vs-esbuild#onresolve) [`onLoad`](https://bun.com/docs/bundler/vs-esbuild#onload)

Test runner

[`bun test`](https://bun.com/docs/cli/test) [Writing tests](https://bun.com/docs/test/writing) [Watch mode](https://bun.com/docs/test/hot) [Lifecycle hooks](https://bun.com/docs/test/lifecycle) [Mocks](https://bun.com/docs/test/mocks) [Snapshots](https://bun.com/docs/test/snapshots) [Dates and times](https://bun.com/docs/test/time) [Code coverage](https://bun.com/docs/test/coverage) [Test reporters](https://bun.com/docs/test/reporters) [Test configuration](https://bun.com/docs/test/configuration) [Runtime behavior](https://bun.com/docs/test/runtime-behavior) [Finding tests](https://bun.com/docs/test/discovery) [DOM testing](https://bun.com/docs/test/dom)

Package runner

[`bunx`](https://bun.com/docs/cli/bunx)

API

[HTTP server](https://bun.com/docs/api/http) [HTTP client](https://bun.com/docs/api/fetch) [WebSockets](https://bun.com/docs/api/websockets) [Workers](https://bun.com/docs/api/workers) [Binary data](https://bun.com/docs/api/binary-data) [Streams](https://bun.com/docs/api/streams) [SQL](https://bun.com/docs/api/sql) [S3 Object Storage](https://bun.com/docs/api/s3) [File I/O](https://bun.com/docs/api/file-io) [Redis client](https://bun.com/docs/api/redis) [import.meta](https://bun.com/docs/api/import-meta) [SQLite](https://bun.com/docs/api/sqlite) [FileSystemRouter](https://bun.com/docs/api/file-system-router) [TCP sockets](https://bun.com/docs/api/tcp) [UDP sockets](https://bun.com/docs/api/udp) [Globals](https://bun.com/docs/api/globals) [$ Shell](https://bun.com/docs/runtime/shell) [Child processes](https://bun.com/docs/api/spawn) [YAML](https://bun.com/docs/api/yaml) [HTMLRewriter](https://bun.com/docs/api/html-rewriter) [Hashing](https://bun.com/docs/api/hashing) [Console](https://bun.com/docs/api/console) [Cookie](https://bun.com/docs/api/cookie) [FFI](https://bun.com/docs/api/ffi) [C Compiler](https://bun.com/docs/api/cc) [Secrets](https://bun.com/docs/api/secrets) [Testing](https://bun.com/docs/cli/test) [Utils](https://bun.com/docs/api/utils) [Node-API](https://bun.com/docs/api/node-api) [Glob](https://bun.com/docs/api/glob) [DNS](https://bun.com/docs/api/dns) [Semver](https://bun.com/docs/api/semver) [Color](https://bun.com/docs/api/color) [Transpiler](https://bun.com/docs/api/transpiler)

Project

[Roadmap](https://bun.com/docs/project/roadmap) [Benchmarking](https://bun.com/docs/project/benchmarking) [Contributing](https://bun.com/docs/project/contributing) [Building Windows](https://bun.com/docs/project/building-windows) [Bindgen](https://bun.com/docs/project/bindgen) [License](https://bun.com/docs/project/licensing)

Bun's bundler API is inspired heavily by [esbuild](https://esbuild.github.io/). Migrating to Bun's bundler from esbuild should be relatively painless. This guide will briefly explain why you might consider migrating to Bun's bundler and provide a side-by-side API comparison reference for those who are already familiar with esbuild's API.

There are a few behavioral differences to note.

- **Bundling by default**. Unlike esbuild, Bun _always bundles by default_. This is why the `--bundle` flag isn't necessary in the Bun example. To transpile each file individually, use [`Bun.Transpiler`](https://bun.com/docs/api/transpiler).
- **It's just a bundler**. Unlike esbuild, Bun's bundler does not include a built-in development server or file watcher. It's just a bundler. The bundler is intended for use in conjunction with `Bun.serve` and other runtime APIs to achieve the same effect. As such, all options relating to HTTP/file watching are not applicable.

## [Performance](https://bun.com/docs/bundler/vs-esbuild\#performance)

With a performance-minded API coupled with the extensively optimized Zig-based JS/TS parser, Bun's bundler is 1.75x faster than esbuild on esbuild's [three.js benchmark](https://github.com/oven-sh/bun/tree/main/bench/bundle).

[![](https://bun.com/images/bundler-speed.png)](https://bun.com/images/bundler-speed.png) Bundling 10 copies of three.js from scratch, with sourcemaps and minification

## [CLI API](https://bun.com/docs/bundler/vs-esbuild\#cli-api)

Bun and esbuild both provide a command-line interface.

```
esbuild <entrypoint> --outdir=out --bundle
```

```
bun build <entrypoint> --outdir=out
```

In Bun's CLI, simple boolean flags like `--minify` do not accept an argument. Other flags like `--outdir <path>` do accept an argument; these flags can be written as `--outdir out` or `--outdir=out`. Some flags like `--define` can be specified several times: `--define foo=bar --define bar=baz`.

| `esbuild` | `bun build` |
| --- | --- |
| `--bundle` | n/a | Bun always bundles, use `--no-bundle` to disable this behavior. |
| `--define:K=V` | `--define K=V` | Small syntax difference; no colon.<br>```<br>esbuild --define:foo=bar<br>```<br>```<br>bun build --define foo=bar<br>``` |
| `--external:<pkg>` | `--external <pkg>` | Small syntax difference; no colon.<br>```<br>esbuild --external:react<br>```<br>```<br>bun build --external react<br>``` |
| `--format` | `--format` | Bun supports `"esm"` and `"cjs"` currently, but more module formats are planned. esbuild defaults to `"iife"`. |
| `--loader:.ext=loader` | `--loader .ext:loader` | Bun supports a different set of built-in loaders than esbuild; see [Bundler > Loaders](https://bun.com/docs/bundler/loaders) for a complete reference. The esbuild loaders `dataurl`, `binary`, `base64`, `copy`, and `empty` are not yet implemented.<br>The syntax for `--loader` is slightly different.<br>```<br>esbuild app.ts --bundle --loader:.svg=text<br>```<br>```<br>bun build app.ts --loader .svg:text<br>``` |
| `--minify` | `--minify` | No differences |
| `--outdir` | `--outdir` | No differences |
| `--outfile` | `--outfile` |
| `--packages` | `--packages` | No differences |
| `--platform` | `--target` | Renamed to `--target` for consistency with tsconfig. Does not support `neutral`. |
| `--serve` | n/a | Not applicable |
| `--sourcemap` | `--sourcemap` | No differences |
| `--splitting` | `--splitting` | No differences |
| `--target` | n/a | Not supported. Bun's bundler performs no syntactic down-leveling at this time. |
| `--watch` | `--watch` | No differences |
| `--allow-overwrite` | n/a | Overwriting is never allowed |
| `--analyze` | n/a | Not supported |
| `--asset-names` | `--asset-naming` | Renamed for consistency with `naming` in JS API |
| `--banner` | `--banner` | Only applies to js bundles |
| `--footer` | `--footer` | Only applies to js bundles |
| `--certfile` | n/a | Not applicable |
| `--charset=utf8` | n/a | Not supported |
| `--chunk-names` | `--chunk-naming` | Renamed for consistency with `naming` in JS API |
| `--color` | n/a | Always enabled |
| `--drop` | `--drop` |
| `--entry-names` | `--entry-naming` | Renamed for consistency with `naming` in JS API |
| `--global-name` | n/a | Not applicable, Bun does not support `iife` output at this time |
| `--ignore-annotations` | `--ignore-dce-annotations` |
| `--inject` | n/a | Not supported |
| `--jsx` | `--jsx-runtime <runtime>` | Supports `"automatic"` (uses `jsx` transform) and `"classic"` (uses `React.createElement`) |
| `--jsx-dev` | n/a | Bun reads `compilerOptions.jsx` from `tsconfig.json` to determine a default. If `compilerOptions.jsx` is `"react-jsx"`, or if `NODE_ENV=production`, Bun will use the `jsx` transform. Otherwise, it uses `jsxDEV`. For any to Bun uses `jsxDEV`. The bundler does not support `preserve`. |
| `--jsx-factory` | `--jsx-factory` |
| `--jsx-fragment` | `--jsx-fragment` |
| `--jsx-import-source` | `--jsx-import-source` |
| `--jsx-side-effects` | `--jsx-side-effects` | Controls whether JSX expressions are marked as `/* @__PURE__ */` for dead code elimination. Default is `false` (JSX marked as pure). |
| `--keep-names` | n/a | Not supported |
| `--keyfile` | n/a | Not applicable |
| `--legal-comments` | n/a | Not supported |
| `--log-level` | n/a | Not supported. This can be set in `bunfig.toml` as `logLevel`. |
| `--log-limit` | n/a | Not supported |
| `--log-override:X=Y` | n/a | Not supported |
| `--main-fields` | n/a | Not supported |
| `--mangle-cache` | n/a | Not supported |
| `--mangle-props` | n/a | Not supported |
| `--mangle-quoted` | n/a | Not supported |
| `--metafile` | n/a | Not supported |
| `--minify-whitespace` | `--minify-whitespace` |
| `--minify-identifiers` | `--minify-identifiers` |
| `--minify-syntax` | `--minify-syntax` |
| `--out-extension` | n/a | Not supported |
| `--outbase` | `--root` |
| `--preserve-symlinks` | n/a | Not supported |
| `--public-path` | `--public-path` |
| `--pure` | n/a | Not supported |
| `--reserve-props` | n/a | Not supported |
| `--resolve-extensions` | n/a | Not supported |
| `--servedir` | n/a | Not applicable |
| `--source-root` | n/a | Not supported |
| `--sourcefile` | n/a | Not supported. Bun does not support `stdin` input yet. |
| `--sourcemap` | `--sourcemap` | No differences |
| `--sources-content` | n/a | Not supported |
| `--supported` | n/a | Not supported |
| `--tree-shaking` | n/a | Always `true` |
| `--tsconfig` | `--tsconfig-override` |
| `--version` | n/a | Run `bun --version` to see the version of Bun. |

## [JavaScript API](https://bun.com/docs/bundler/vs-esbuild\#javascript-api)

| `esbuild.build()` | `Bun.build()` |
| --- | --- |
| `absWorkingDir` | n/a | Always set to `process.cwd()` |
| `alias` | n/a | Not supported |
| `allowOverwrite` | n/a | Always `false` |
| `assetNames` | `naming.asset` | Uses same templating syntax as esbuild, but `[ext]` must be included explicitly.<br>```<br>Bun.build({<br>  entrypoints: ["./index.tsx"],<br>  naming: {<br>    asset: "[name].[ext]",<br>  },<br>});<br>``` |
| `banner` | n/a | Not supported |
| `bundle` | n/a | Always `true`. Use [`Bun.Transpiler`](https://bun.com/docs/api/transpiler) to transpile without bundling. |
| `charset` | n/a | Not supported |
| `chunkNames` | `naming.chunk` | Uses same templating syntax as esbuild, but `[ext]` must be included explicitly.<br>```<br>Bun.build({<br>  entrypoints: ["./index.tsx"],<br>  naming: {<br>    chunk: "[name].[ext]",<br>  },<br>});<br>``` |
| `color` | n/a | Bun returns logs in the `logs` property of the build result. |
| `conditions` | n/a | Not supported. Export conditions priority is determined by `target`. |
| `define` | `define` |
| `drop` | n/a | Not supported |
| `entryNames` | `naming` or `naming.entry` | Bun supports a `naming` key that can either be a string or an object. Uses same templating syntax as esbuild, but `[ext]` must be included explicitly.<br>```<br>Bun.build({<br>  entrypoints: ["./index.tsx"],<br>  // when string, this is equivalent to entryNames<br>  naming: "[name].[ext]",<br>  // granular naming options<br>  naming: {<br>    entry: "[name].[ext]",<br>    asset: "[name].[ext]",<br>    chunk: "[name].[ext]",<br>  },<br>});<br>``` |
| `entryPoints` | `entrypoints` | Capitalization difference |
| `external` | `external` | No differences |
| `footer` | n/a | Not supported |
| `format` | `format` | Only supports `"esm"` currently. Support for `"cjs"` and `"iife"` is planned. |
| `globalName` | n/a | Not supported |
| `ignoreAnnotations` | n/a | Not supported |
| `inject` | n/a | Not supported |
| `jsx` | `jsx` | Not supported in JS API, configure in `tsconfig.json` |
| `jsxDev` | `jsxDev` | Not supported in JS API, configure in `tsconfig.json` |
| `jsxFactory` | `jsxFactory` | Not supported in JS API, configure in `tsconfig.json` |
| `jsxFragment` | `jsxFragment` | Not supported in JS API, configure in `tsconfig.json` |
| `jsxImportSource` | `jsxImportSource` | Not supported in JS API, configure in `tsconfig.json` |
| `jsxSideEffects` | `jsxSideEffects` | Controls whether JSX expressions are marked as pure for dead code elimination |
| `keepNames` | n/a | Not supported |
| `legalComments` | n/a | Not supported |
| `loader` | `loader` | Bun supports a different set of built-in loaders than esbuild; see [Bundler > Loaders](https://bun.com/docs/bundler/loaders) for a complete reference. The esbuild loaders `dataurl`, `binary`, `base64`, `copy`, and `empty` are not yet implemented. |
| `logLevel` | n/a | Not supported |
| `logLimit` | n/a | Not supported |
| `logOverride` | n/a | Not supported |
| `mainFields` | n/a | Not supported |
| `mangleCache` | n/a | Not supported |
| `mangleProps` | n/a | Not supported |
| `mangleQuoted` | n/a | Not supported |
| `metafile` | n/a | Not supported |
| `minify` | `minify` | In Bun, `minify` can be a boolean or an object.<br>```<br>await Bun.build({<br>  entrypoints: ['./index.tsx'],<br>  // enable all minification<br>  minify: true<br>  // granular options<br>  minify: {<br>    identifiers: true,<br>    syntax: true,<br>    whitespace: true<br>  }<br>})<br>``` |
| `minifyIdentifiers` | `minify.identifiers` | See `minify` |
| `minifySyntax` | `minify.syntax` | See `minify` |
| `minifyWhitespace` | `minify.whitespace` | See `minify` |
| `nodePaths` | n/a | Not supported |
| `outExtension` | n/a | Not supported |
| `outbase` | `root` | Different name |
| `outdir` | `outdir` | No differences |
| `outfile` | `outfile` | No differences |
| `packages` | n/a | Not supported, use `external` |
| `platform` | `target` | Supports `"bun"`, `"node"` and `"browser"` (the default). Does not support `"neutral"`. |
| `plugins` | `plugins` | Bun's plugin API is a subset of esbuild's. Some esbuild plugins will work out of the box with Bun. |
| `preserveSymlinks` | n/a | Not supported |
| `publicPath` | `publicPath` | No differences |
| `pure` | n/a | Not supported |
| `reserveProps` | n/a | Not supported |
| `resolveExtensions` | n/a | Not supported |
| `sourceRoot` | n/a | Not supported |
| `sourcemap` | `sourcemap` | Supports `"inline"`, `"external"`, and `"none"` |
| `sourcesContent` | n/a | Not supported |
| `splitting` | `splitting` | No differences |
| `stdin` | n/a | Not supported |
| `supported` | n/a | Not supported |
| `target` | n/a | No support for syntax downleveling |
| `treeShaking` | n/a | Always `true` |
| `tsconfig` | n/a | Not supported |
| `write` | n/a | Set to `true` if `outdir`/ `outfile` is set, otherwise `false` |

## [Plugin API](https://bun.com/docs/bundler/vs-esbuild\#plugin-api)

Bun's plugin API is designed to be esbuild compatible. Bun doesn't support esbuild's entire plugin API surface, but the core functionality is implemented. Many third-party `esbuild` plugins will work out of the box with Bun.

Long term, we aim for feature parity with esbuild's API, so if something doesn't work please file an issue to help us prioritize.

Plugins in Bun and esbuild are defined with a `builder` object.

```
import type { BunPlugin } from "bun";

const myPlugin: BunPlugin = {
  name: "my-plugin",
  setup(builder) {
    // define plugin
  },
};

```

The `builder` object provides some methods for hooking into parts of the bundling process. Bun implements `onResolve` and `onLoad`; it does not yet implement the esbuild hooks `onStart`, `onEnd`, and `onDispose`, and `resolve` utilities. `initialOptions` is partially implemented, being read-only and only having a subset of esbuild's options; use [`config`](https://bun.com/docs/bundler/plugins) (same thing but with Bun's `BuildConfig` format) instead.

```
import type { BunPlugin } from "bun";
const myPlugin: BunPlugin = {
  name: "my-plugin",
  setup(builder) {
    builder.onResolve(
      {
        /* onResolve.options */
      },
      args => {
        return {
          /* onResolve.results */
        };
      },
    );
    builder.onLoad(
      {
        /* onLoad.options */
      },
      args => {
        return {
          /* onLoad.results */
        };
      },
    );
  },
};

```

### [`onResolve`](https://bun.com/docs/bundler/vs-esbuild\#onresolve)

#### `options`

| 🟢 | `filter` |
| --- | --- |
| 🟢 | `namespace` |

#### `arguments`

| 🟢 | `path` |
| --- | --- |
| 🟢 | `importer` |
| 🔴 | `namespace` |
| 🔴 | `resolveDir` |
| 🔴 | `kind` |
| 🔴 | `pluginData` |

#### `results`

| 🟢 | `namespace` |
| --- | --- |
| 🟢 | `path` |
| 🔴 | `errors` |
| 🔴 | `external` |
| 🔴 | `pluginData` |
| 🔴 | `pluginName` |
| 🔴 | `sideEffects` |
| 🔴 | `suffix` |
| 🔴 | `warnings` |
| 🔴 | `watchDirs` |
| 🔴 | `watchFiles` |

### [`onLoad`](https://bun.com/docs/bundler/vs-esbuild\#onload)

#### `options`

| 🟢 | `filter` |
| 🟢 | `namespace` |

#### `arguments`

| 🟢 | `path` |
| 🔴 | `namespace` |
| 🔴 | `suffix` |
| 🔴 | `pluginData` |

#### `results`

| 🟢 | `contents` |
| 🟢 | `loader` |
| 🔴 | `errors` |
| 🔴 | `pluginData` |
| 🔴 | `pluginName` |
| 🔴 | `resolveDir` |
| 🔴 | `warnings` |
| 🔴 | `watchDirs` |
| 🔴 | `watchFiles` |

[Previous\\
\\
Macros](https://bun.com/docs/bundler/macros) [Next\\
\\
`bun test`](https://bun.com/docs/cli/test)

[![GitHub logo](<Base64-Image-Removed>)![GitHub logo](<Base64-Image-Removed>)\\
\\
Edit on GitHub](https://github.com/oven-sh/bun/edit/main/docs/bundler/vs-esbuild.md)

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