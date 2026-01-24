---
title: Environment variables – Runtime | Bun Docs
url:
description: How to read and set environment variables, plus how to use them to configure Bun
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

[`bun run`](https://bun.com/docs/cli/run) [File types](https://bun.com/docs/runtime/loaders) [TypeScript](https://bun.com/docs/runtime/typescript) [JSX](https://bun.com/docs/runtime/jsx) [Environment variables](https://bun.com/docs/runtime/env)

[Setting environment variables](https://bun.com/docs/runtime/env#setting-environment-variables) [Manually specifying `.env` files](https://bun.com/docs/runtime/env#manually-specifying-env-files) [Quotation marks](https://bun.com/docs/runtime/env#quotation-marks) [Expansion](https://bun.com/docs/runtime/env#expansion) [`dotenv`](https://bun.com/docs/runtime/env#dotenv) [Reading environment variables](https://bun.com/docs/runtime/env#reading-environment-variables) [TypeScript](https://bun.com/docs/runtime/env#typescript) [Configuring Bun](https://bun.com/docs/runtime/env#configuring-bun) [Runtime transpiler caching](https://bun.com/docs/runtime/env#runtime-transpiler-caching) [Disable the runtime transpiler cache](https://bun.com/docs/runtime/env#disable-the-runtime-transpiler-cache) [What does it cache?](https://bun.com/docs/runtime/env#what-does-it-cache)

[Bun APIs](https://bun.com/docs/runtime/bun-apis) [Web APIs](https://bun.com/docs/runtime/web-apis) [Node.js compatibility](https://bun.com/docs/runtime/nodejs-apis) [Single-file executable](https://bun.com/docs/bundler/executables) [Plugins](https://bun.com/docs/runtime/plugins) [Watch mode](https://bun.com/docs/runtime/hot) [Module resolution](https://bun.com/docs/runtime/modules) [Auto-install](https://bun.com/docs/runtime/autoimport) [bunfig.toml](https://bun.com/docs/runtime/bunfig) [Debugger](https://bun.com/docs/runtime/debugger)

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

Bun reads your `.env` files automatically and provides idiomatic ways to read and write your environment variables programmatically. Plus, some aspects of Bun's runtime behavior can be configured with Bun-specific environment variables.

## [Setting environment variables](https://bun.com/docs/runtime/env#setting-environment-variables)

Bun reads the following files automatically (listed in order of increasing precedence).

- `.env`
- `.env.production`, `.env.development`, `.env.test` (depending on value of `NODE_ENV`)
- `.env.local`

**Note:** When `NODE_ENV=test`, `.env.local` is **not** loaded. This ensures consistent test environments across different executions by preventing local overrides during testing. This behavior matches popular frameworks like [Next.js](https://nextjs.org/docs/pages/guides/environment-variables#test-environment-variables) and [Create React App](https://create-react-app.dev/docs/adding-custom-environment-variables/#what-other-env-files-can-be-used).

.env

```
FOO=hello
BAR=world

```

Variables can also be set via the command line.

Linux/macOS

Windows

Linux/macOS

```
FOO=helloworld bun run dev
```

Windows

```
# Using CMD
```

```
set FOO=helloworld && bun run dev
```

```

# Using PowerShell
```

```
$env:FOO="helloworld"; bun run dev
```

Cross-platform solution with Windows

For a cross-platform solution, you can use [bun shell](https://bun.com/docs/runtime/shell). For example, the `bun exec` command.

```
bun exec 'FOO=helloworld bun run dev'
```

On Windows, `package.json` scripts called with `bun run` will automatically use the **bun shell**, making the following also cross-platform.

package.json

```
"scripts": {
  "dev": "NODE_ENV=development bun --watch app.ts",
},

```

Or programmatically by assigning a property to `process.env`.

```
process.env.FOO = "hello";

```

### [Manually specifying `.env` files](https://bun.com/docs/runtime/env#manually-specifying-env-files)

Bun supports `--env-file` to override which specific `.env` file to load. You can use `--env-file` when running scripts in bun's runtime, or when running package.json scripts.

```
bun --env-file=.env.1 src/index.ts
```

```

```

```
bun --env-file=.env.abc --env-file=.env.def run build
```

### [Quotation marks](https://bun.com/docs/runtime/env#quotation-marks)

Bun supports double quotes, single quotes, and template literal backticks:

.env

```
FOO='hello'
FOO="hello"
FOO=`hello`

```

### [Expansion](https://bun.com/docs/runtime/env#expansion)

Environment variables are automatically _expanded_. This means you can reference previously-defined variables in your environment variables.

.env

```
FOO=world
BAR=hello$FOO

```

```
process.env.BAR; // => "helloworld"

```

This is useful for constructing connection strings or other compound values.

.env

```
DB_USER=postgres
DB_PASSWORD=secret
DB_HOST=localhost
DB_PORT=5432
DB_URL=postgres://$DB_USER:$DB_PASSWORD@$DB_HOST:$DB_PORT/$DB_NAME

```

This can be disabled by escaping the `$` with a backslash.

.env

```
FOO=world
BAR=hello\$FOO

```

```
process.env.BAR; // => "hello$FOO"

```

### [`dotenv`](https://bun.com/docs/runtime/env#dotenv)

Generally speaking, you won't need `dotenv` or `dotenv-expand` anymore, because Bun reads `.env` files automatically.

## [Reading environment variables](https://bun.com/docs/runtime/env#reading-environment-variables)

The current environment variables can be accessed via `process.env`.

```
process.env.API_TOKEN; // => "secret"

```

Bun also exposes these variables via `Bun.env` and `import.meta.env`, which is a simple alias of `process.env`.

```
Bun.env.API_TOKEN; // => "secret"
import.meta.env.API_TOKEN; // => "secret"

```

To print all currently-set environment variables to the command line, run `bun --print process.env`. This is useful for debugging.

```
bun --print process.env
```

```
BAZ=stuff
FOOBAR=aaaaaa
<lots more lines>
```

## [TypeScript](https://bun.com/docs/runtime/env#typescript)

In TypeScript, all properties of `process.env` are typed as `string | undefined`.

```
Bun.env.whatever;
// string | undefined

```

To get autocompletion and tell TypeScript to treat a variable as a non-optional string, we'll use [interface merging](https://www.typescriptlang.org/docs/handbook/declaration-merging.html#merging-interfaces).

```
declare module "bun" {
  interface Env {
    AWESOME: string;
  }
}

```

Add this line to any file in your project. It will globally add the `AWESOME` property to `process.env` and `Bun.env`.

```
process.env.AWESOME; // => string

```

## [Configuring Bun](https://bun.com/docs/runtime/env#configuring-bun)

These environment variables are read by Bun and configure aspects of its behavior.

| Name                                     | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NODE_TLS_REJECT_UNAUTHORIZED`           | `NODE_TLS_REJECT_UNAUTHORIZED=0` disables SSL certificate validation. This is useful for testing and debugging, but you should be very hesitant to use this in production. Note: This environment variable was originally introduced by Node.js and we kept the name for compatibility.                                                                                                                                                                                                                                                                                   |
| `BUN_CONFIG_VERBOSE_FETCH`               | If `BUN_CONFIG_VERBOSE_FETCH=curl`, then fetch requests will log the url, method, request headers and response headers to the console. This is useful for debugging network requests. This also works with `node:http`. `BUN_CONFIG_VERBOSE_FETCH=1` is equivalent to `BUN_CONFIG_VERBOSE_FETCH=curl` except without the `curl` output.                                                                                                                                                                                                                                   |
| `BUN_RUNTIME_TRANSPILER_CACHE_PATH`      | The runtime transpiler caches the transpiled output of source files larger than 50 kb. This makes CLIs using Bun load faster. If `BUN_RUNTIME_TRANSPILER_CACHE_PATH` is set, then the runtime transpiler will cache transpiled output to the specified directory. If `BUN_RUNTIME_TRANSPILER_CACHE_PATH` is set to an empty string or the string `"0"`, then the runtime transpiler will not cache transpiled output. If `BUN_RUNTIME_TRANSPILER_CACHE_PATH` is unset, then the runtime transpiler will cache transpiled output to the platform-specific cache directory. |
| `TMPDIR`                                 | Bun occasionally requires a directory to store intermediate assets during bundling or other operations. If unset, defaults to the platform-specific temporary directory: `/tmp` on Linux, `/private/tmp` on macOS.                                                                                                                                                                                                                                                                                                                                                        |
| `NO_COLOR`                               | If `NO_COLOR=1`, then ANSI color output is [disabled](https://no-color.org/).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `FORCE_COLOR`                            | If `FORCE_COLOR=1`, then ANSI color output is force enabled, even if `NO_COLOR` is set.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `BUN_CONFIG_MAX_HTTP_REQUESTS`           | Control the maximum number of concurrent HTTP requests sent by fetch and `bun install`. Defaults to `256`. If you are running into rate limits or connection issues, you can reduce this number.                                                                                                                                                                                                                                                                                                                                                                          |
| `BUN_CONFIG_NO_CLEAR_TERMINAL_ON_RELOAD` | If `BUN_CONFIG_NO_CLEAR_TERMINAL_ON_RELOAD=true`, then `bun --watch` will not clear the console on reload                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `DO_NOT_TRACK`                           | Disable uploading crash reports to `bun.report` on crash. On macOS & Windows, crash report uploads are enabled by default. Otherwise, telemetry is not sent yet as of May 21st, 2024, but we are planning to add telemetry in the coming weeks. If `DO_NOT_TRACK=1`, then auto-uploading crash reports and telemetry are both [disabled](https://do-not-track.dev/).                                                                                                                                                                                                      |

## [Runtime transpiler caching](https://bun.com/docs/runtime/env#runtime-transpiler-caching)

For files larger than 50 KB, Bun caches transpiled output into `$BUN_RUNTIME_TRANSPILER_CACHE_PATH` or the platform-specific cache directory. This makes CLIs using Bun load faster.

This transpiler cache is global and shared across all projects. It is safe to delete the cache at any time. It is a content-addressable cache, so it will never contain duplicate entries. It is also safe to delete the cache while a Bun process is running.

It is recommended to disable this cache when using ephemeral filesystems like Docker. Bun's Docker images automatically disable this cache.

### [Disable the runtime transpiler cache](https://bun.com/docs/runtime/env#disable-the-runtime-transpiler-cache)

To disable the runtime transpiler cache, set `BUN_RUNTIME_TRANSPILER_CACHE_PATH` to an empty string or the string `"0"`.

```
BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 bun run dev

```

### [What does it cache?](https://bun.com/docs/runtime/env#what-does-it-cache)

It caches:

- The transpiled output of source files larger than 50 KB.
- The sourcemap for the transpiled output of the file

The file extension `.pile` is used for these cached files.

[Previous\\
\\
JSX](https://bun.com/docs/runtime/jsx) [Next\\
\\
Bun APIs](https://bun.com/docs/runtime/bun-apis)

[![GitHub logo](Base64-Image-Removed)![GitHub logo](Base64-Image-Removed)\\
\\
Edit on GitHub](https://github.com/oven-sh/bun/edit/main/docs/runtime/env.md)

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
