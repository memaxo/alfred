---
title: bun run – Runtime | Bun Docs
url: 
description: Use `bun run` to execute JavaScript/TypeScript files and package.json scripts.
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

[`bun run`](https://bun.com/docs/cli/run)

[Performance](https://bun.com/docs/cli/run#performance) [Run a file](https://bun.com/docs/cli/run#run-a-file) [`--watch`](https://bun.com/docs/cli/run#watch) [Run a `package.json` script](https://bun.com/docs/cli/run#run-a-package-json-script) [`--bun`](https://bun.com/docs/cli/run#bun) [Filtering](https://bun.com/docs/cli/run#filtering) [`bun run -` to pipe code from stdin](https://bun.com/docs/cli/run#bun-run-to-pipe-code-from-stdin) [`bun run --console-depth`](https://bun.com/docs/cli/run#bun-run-console-depth) [`bun run --smol`](https://bun.com/docs/cli/run#bun-run-smol) [Resolution order](https://bun.com/docs/cli/run#resolution-order)

[File types](https://bun.com/docs/runtime/loaders) [TypeScript](https://bun.com/docs/runtime/typescript) [JSX](https://bun.com/docs/runtime/jsx) [Environment variables](https://bun.com/docs/runtime/env) [Bun APIs](https://bun.com/docs/runtime/bun-apis) [Web APIs](https://bun.com/docs/runtime/web-apis) [Node.js compatibility](https://bun.com/docs/runtime/nodejs-apis) [Single-file executable](https://bun.com/docs/bundler/executables) [Plugins](https://bun.com/docs/runtime/plugins) [Watch mode](https://bun.com/docs/runtime/hot) [Module resolution](https://bun.com/docs/runtime/modules) [Auto-install](https://bun.com/docs/runtime/autoimport) [bunfig.toml](https://bun.com/docs/runtime/bunfig) [Debugger](https://bun.com/docs/runtime/debugger)

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

The `bun` CLI can be used to execute JavaScript/TypeScript files, `package.json` scripts, and [executable packages](https://docs.npmjs.com/cli/v9/configuring-npm/package-json#bin).

## [Performance](https://bun.com/docs/cli/run\#performance)

Bun is designed to start fast and run fast.

Under the hood Bun uses the [JavaScriptCore engine](https://developer.apple.com/documentation/javascriptcore), which is developed by Apple for Safari. In most cases, the startup and running performance is faster than V8, the engine used by Node.js and Chromium-based browsers. Its transpiler and runtime are written in Zig, a modern, high-performance language. On Linux, this translates into startup times [4x faster](https://twitter.com/jarredsumner/status/1499225725492076544) than Node.js.

| `bun hello.js` | `5.2ms` |
| `node hello.js` | `25.1ms` |

Running a simple Hello World script on Linux

## [Run a file](https://bun.com/docs/cli/run\#run-a-file)

Compare to `node <file>`

Use `bun run` to execute a source file.

```
bun run index.js
```

Bun supports TypeScript and JSX out of the box. Every file is transpiled on the fly by Bun's fast native transpiler before being executed.

```
bun run index.js
```

```
bun run index.jsx
```

```
bun run index.ts
```

```
bun run index.tsx
```

Alternatively, you can omit the `run` keyword and use the "naked" command; it behaves identically.

```
bun index.tsx
```

```
bun index.js
```

### [`--watch`](https://bun.com/docs/cli/run\#watch)

To run a file in watch mode, use the `--watch` flag.

```
bun --watch run index.tsx
```

**Note** — When using `bun run`, put Bun flags like `--watch` immediately after `bun`.

```
bun --watch run dev # ✔️ do this
```

```
bun run dev --watch # ❌ don't do this
```

Flags that occur at the end of the command will be ignored and passed through to the `"dev"` script itself.

## [Run a `package.json` script](https://bun.com/docs/cli/run\#run-a-package-json-script)

Compare to `npm run <script>` or `yarn <script>`

```
bun [bun flags] run <script> [script flags]
```

Your `package.json` can define a number of named `"scripts"` that correspond to shell commands.

```
{
  // ... other fields
  "scripts": {
    "clean": "rm -rf dist && echo 'Done.'",
    "dev": "bun server.ts"
  }
}

```

Use `bun run <script>` to execute these scripts.

```
bun run clean
```

```
 $ rm -rf dist && echo 'Done.'
 Cleaning...
 Done.
```

Bun executes the script command in a subshell. On Linux & macOS, it checks for the following shells in order, using the first one it finds: `bash`, `sh`, `zsh`. On windows, it uses [bun shell](https://bun.com/docs/runtime/shell) to support bash-like syntax and many common commands.

⚡️ The startup time for `npm run` on Linux is roughly 170ms; with Bun it is `6ms`.

Scripts can also be run with the shorter command `bun <script>`, however if there is a built-in bun command with the same name, the built-in command takes precedence. In this case, use the more explicit `bun run <script>` command to execute your package script.

```
bun run dev
```

To see a list of available scripts, run `bun run` without any arguments.

```
bun run
```

```
quickstart scripts:

 bun run clean
   rm -rf dist && echo 'Done.'

 bun run dev
   bun server.ts

2 scripts
```

Bun respects lifecycle hooks. For instance, `bun run clean` will execute `preclean` and `postclean`, if defined. If the `pre<script>` fails, Bun will not execute the script itself.

### [`--bun`](https://bun.com/docs/cli/run\#bun)

It's common for `package.json` scripts to reference locally-installed CLIs like `vite` or `next`. These CLIs are often JavaScript files marked with a [shebang](https://en.wikipedia.org/wiki/Shebang_(Unix)) to indicate that they should be executed with `node`.

```
#!/usr/bin/env node

// do stuff

```

By default, Bun respects this shebang and executes the script with `node`. However, you can override this behavior with the `--bun` flag. For Node.js-based CLIs, this will run the CLI with Bun instead of Node.js.

```
bun run --bun vite
```

### [Filtering](https://bun.com/docs/cli/run\#filtering)

In monorepos containing multiple packages, you can use the `--filter` argument to execute scripts in many packages at once.

Use `bun run --filter <name_pattern> <script>` to execute `<script>` in all packages whose name matches `<name_pattern>`.For example, if you have subdirectories containing packages named `foo`, `bar` and `baz`, running

```
bun run --filter 'ba*' <script>

```

will execute `<script>` in both `bar` and `baz`, but not in `foo`.

Find more details in the docs page for [filter](https://bun.com/docs/cli/filter#running-scripts-with-filter).

## [`bun run -` to pipe code from stdin](https://bun.com/docs/cli/run\#bun-run-to-pipe-code-from-stdin)

`bun run -` lets you read JavaScript, TypeScript, TSX, or JSX from stdin and execute it without writing to a temporary file first.

```
echo "console.log('Hello')" | bun run -
```

```
Hello
```

You can also use `bun run -` to redirect files into Bun. For example, to run a `.js` file as if it were a `.ts` file:

```
echo "console.log!('This is TypeScript!' as any)" > secretly-typescript.js
```

```
bun run - < secretly-typescript.js
```

```
This is TypeScript!
```

For convenience, all code is treated as TypeScript with JSX support when using `bun run -`.

## [`bun run --console-depth`](https://bun.com/docs/cli/run\#bun-run-console-depth)

Control the depth of object inspection in console output with the `--console-depth` flag.

```
bun --console-depth 5 run index.tsx
```

This sets how deeply nested objects are displayed in `console.log()` output. The default depth is `2`. Higher values show more nested properties but may produce verbose output for complex objects.

```
const nested = { a: { b: { c: { d: "deep" } } } };
console.log(nested);
// With --console-depth 2 (default): { a: { b: [Object] } }
// With --console-depth 4: { a: { b: { c: { d: 'deep' } } } }

```

## [`bun run --smol`](https://bun.com/docs/cli/run\#bun-run-smol)

In memory-constrained environments, use the `--smol` flag to reduce memory usage at a cost to performance.

```
bun --smol run index.tsx
```

This causes the garbage collector to run more frequently, which can slow down execution. However, it can be useful in environments with limited memory. Bun automatically adjusts the garbage collector's heap size based on the available memory (accounting for cgroups and other memory limits) with and without the `--smol` flag, so this is mostly useful for cases where you want to make the heap size grow more slowly.

## [Resolution order](https://bun.com/docs/cli/run\#resolution-order)

Absolute paths and paths starting with `./` or `.\\` are always executed as source files. Unless using `bun run`, running a file with an allowed extension will prefer the file over a package.json script.

When there is a package.json script and a file with the same name, `bun run` prioritizes the package.json script. The full resolution order is:

1. package.json scripts, eg `bun run build`
2. Source files, eg `bun run src/main.js`
3. Binaries from project packages, eg `bun add eslint && bun run eslint`
4. ( `bun run` only) System commands, eg `bun run ls`

## CLI Usage

$bunrun<file or script>

### Flags

#### General Execution

--silent

Don't print the script command

--shell=<val>

Control the shell used for package.json scripts. Supports either 'bun' or 'system'

--if-present

Exit without an error if the entrypoint does not exist

-e,--eval=<val>

Evaluate argument as a script

-p,--print=<val>

Evaluate argument as a script and print the result

--title=<val>

Set the process title

#### Workspace & Monorepo

--elide-lines=<val>

Number of lines of script output shown when using --filter (default: 10). Set to 0 to show all lines.

-F,--filter=<val>

Run a script in all workspace packages matching the pattern

#### Development & Watching

--watch

Automatically restart the process on file change

--hot

Enable auto reload in the Bun runtime, test runner, or bundler

--no-clear-screen

Disable clearing the terminal screen on reload when --hot or --watch is enabled

#### Debugging

--inspect=<val>

Activate Bun's debugger

--inspect-wait=<val>

Activate Bun's debugger, wait for a connection before executing

--inspect-brk=<val>

Activate Bun's debugger, set breakpoint on first line of code and wait

--expose-gc

Expose gc() on the global object. Has no effect on Bun.gc().

#### Package Management

--no-install

Disable auto install in the Bun runtime

--install=<val>

Configure auto-install behavior. One of "auto" (default, auto-installs when no node\_modules), "fallback" (missing packages only), "force" (always).

-i

Auto-install dependencies during execution. Equivalent to --install=fallback.

--prefer-offline

Skip staleness checks for packages in the Bun runtime and resolve from disk

--prefer-latest

Use the latest matching versions of packages in the Bun runtime, always checking npm

#### Module Resolution

-r,--preload=<val>

Import a module before other modules are loaded

--require=<val>

Alias of --preload, for Node.js compatibility

--import=<val>

Alias of --preload, for Node.js compatibility

--conditions=<val>

Pass custom conditions to resolve

--main-fields=<val>

Main fields to lookup in package.json. Defaults to --target dependent

--preserve-symlinks

Preserve symlinks when resolving files

--preserve-symlinks-main

Preserve symlinks when resolving the main entry point

--extension-order=<val>

Defaults to: .tsx,.ts,.jsx,.js,.json

#### Transpilation & Build

--tsconfig-override=<val>

Specify custom tsconfig.json. Default <d>$cwd<r>/tsconfig.json

-d,--define=<val>

Substitute K:V while parsing, e.g. --define process.env.NODE\_ENV:"development". Values are parsed as JSON.

--drop=<val>

Remove function calls, e.g. --drop=console removes all console.\* calls.

-l,--loader=<val>

Parse files with .ext:loader, e.g. --loader .js:jsx. Valid loaders: js, jsx, ts, tsx, json, toml, text, file, wasm, napi

--no-macros

Disable macros from being executed in the bundler, transpiler and runtime

--jsx-factory=<val>

Changes the function called when compiling JSX elements using the classic JSX runtime

--jsx-fragment=<val>

Changes the function called when compiling JSX fragments

--jsx-import-source=<val>

Declares the module specifier to be used for importing the jsx and jsxs factory functions. Default: "react"

--jsx-runtime=<val>

"automatic" (default) or "classic"

--ignore-dce-annotations

Ignore tree-shaking annotations such as @\_\_PURE\_\_

#### Runtime Configuration

-b,--bun

Force a script or package to use Bun's runtime instead of Node.js (via symlinking node)

--smol

Use less memory, but run garbage collection more often

--no-deprecation

Suppress all reporting of the custom deprecation.

--throw-deprecation

Determine whether or not deprecation warnings result in errors.

--zero-fill-buffers

Boolean to force Buffer.allocUnsafe(size) to be zero-filled.

--no-addons

Throw an error if process.dlopen is called, and disable export condition "node-addons"

--unhandled-rejections=<val>

One of "strict", "throw", "warn", "none", or "warn-with-error-code"

#### Networking

--port=<val>

Set the default port for Bun.serve

--fetch-preconnect=<val>

Preconnect to a URL while code is loading

--max-http-header-size=<val>

Set the maximum size of HTTP headers in bytes. Default is 16KiB

--dns-result-order=<val>

Set the default order of DNS lookup results. Valid orders: verbatim (default), ipv4first, ipv6first

--redis-preconnect

Preconnect to $REDIS\_URL at startup

#### Global Configuration

--env-file=<val>

Load environment variables from the specified file(s)

--cwd=<val>

Absolute path to resolve files & entry points from. This just changes the process' cwd.

-c,--config=<val>

Specify path to Bun config file. Default <d>$cwd<r>/bunfig.toml

#### Help

-h,--help

Display this menu and exit

### Examples

Run a JavaScript or TypeScript file

bun run ./index.js

bun run ./index.tsx

Run a package.json script

bun run dev

bun run lint

Full documentation is available at https://bun.sh/docs/cli/run

[Previous\\
\\
`bun create`](https://bun.com/docs/cli/bun-create) [Next\\
\\
File types](https://bun.com/docs/runtime/loaders)

[![GitHub logo](<Base64-Image-Removed>)![GitHub logo](<Base64-Image-Removed>)\\
\\
Edit on GitHub](https://github.com/oven-sh/bun/edit/main/docs/cli/run.md)

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