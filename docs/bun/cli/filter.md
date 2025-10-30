---
title: Filter – Package manager | Bun Docs
url: 
description: Run scripts in multiple packages in parallel
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

[`bun install`](https://bun.com/docs/cli/install) [`bun add`](https://bun.com/docs/cli/add) [`bun remove`](https://bun.com/docs/cli/remove) [`bun update`](https://bun.com/docs/cli/update) [`bun publish`](https://bun.com/docs/cli/publish) [`bun outdated`](https://bun.com/docs/cli/outdated) [`bun link`](https://bun.com/docs/cli/link) [`bun pm`](https://bun.com/docs/cli/pm) [`bun why`](https://bun.com/docs/cli/why) [Global cache](https://bun.com/docs/install/cache) [Isolated installs](https://bun.com/docs/install/isolated) [Workspaces](https://bun.com/docs/install/workspaces) [Catalogs](https://bun.com/docs/install/catalogs) [Lifecycle scripts](https://bun.com/docs/install/lifecycle) [Filter](https://bun.com/docs/cli/filter)

[Matching](https://bun.com/docs/cli/filter#matching) [Package Name `--filter <pattern>`](https://bun.com/docs/cli/filter#package-name-filter-pattern) [Package Path `--filter ./<glob>`](https://bun.com/docs/cli/filter#package-path-filter-glob) [`bun install` and `bun outdated`](https://bun.com/docs/cli/filter#bun-install-and-bun-outdated) [Running scripts with `--filter`](https://bun.com/docs/cli/filter#running-scripts-with-filter) [Running scripts in workspaces](https://bun.com/docs/cli/filter#running-scripts-in-workspaces) [Dependency Order](https://bun.com/docs/cli/filter#dependency-order)

[Lockfile](https://bun.com/docs/install/lockfile) [Scopes and registries](https://bun.com/docs/install/registries) [Overrides and resolutions](https://bun.com/docs/install/overrides) [Patch dependencies](https://bun.com/docs/install/patch) [Audit dependencies](https://bun.com/docs/install/audit) [.npmrc support](https://bun.com/docs/install/npmrc) [Security Scanner API](https://bun.com/docs/install/security-scanner-api)

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

The `--filter` (or `-F`) flag is used for selecting packages by pattern in a monorepo. Patterns can be used to match package names or package paths, with full glob syntax support.

Currently `--filter` is supported by `bun install` and `bun outdated`, and can also be used to run scripts for multiple packages at once.

## [Matching](https://bun.com/docs/cli/filter\#matching)

### [Package Name `--filter <pattern>`](https://bun.com/docs/cli/filter\#package-name-filter-pattern)

Name patterns select packages based on the package name, as specified in `package.json`. For example, if you have packages `pkg-a`, `pkg-b` and `other`, you can match all packages with `*`, only `pkg-a` and `pkg-b` with `pkg*`, and a specific package by providing the full name of the package.

### [Package Path `--filter ./<glob>`](https://bun.com/docs/cli/filter\#package-path-filter-glob)

Path patterns are specified by starting the pattern with `./`, and will select all packages in directories that match the pattern. For example, to match all packages in subdirectories of `packages`, you can use `--filter './packages/**'`. To match a package located in `packages/foo`, use `--filter ./packages/foo`.

## [`bun install` and `bun outdated`](https://bun.com/docs/cli/filter\#bun-install-and-bun-outdated)

Both `bun install` and `bun outdated` support the `--filter` flag.

`bun install` by default will install dependencies for all packages in the monorepo. To install dependencies for specific packages, use `--filter`.

Given a monorepo with workspaces `pkg-a`, `pkg-b`, and `pkg-c` under `./packages`:

```
# Install dependencies for all workspaces except `pkg-c`
```

```
bun install --filter '!pkg-c'
```

```

# Install dependencies for packages in `./packages` (`pkg-a`, `pkg-b`, `pkg-c`)
```

```
bun install --filter './packages/*'
```

```

# Save as above, but exclude the root package.json
```

```
bun install --filter '!./' --filter './packages/*'
```

Similarly, `bun outdated` will display outdated dependencies for all packages in the monorepo, and `--filter` can be used to restrict the command to a subset of the packages:

```
# Display outdated dependencies for workspaces starting with `pkg-`
```

```
bun outdated --filter 'pkg-*'
```

```

# Display outdated dependencies for only the root package.json
```

```
bun outdated --filter './'
```

For more information on both these commands, see [`bun install`](https://bun.com/docs/cli/install) and [`bun outdated`](https://bun.com/docs/cli/outdated).

## [Running scripts with `--filter`](https://bun.com/docs/cli/filter\#running-scripts-with-filter)

Use the `--filter` flag to execute scripts in multiple packages at once:

```
bun --filter <pattern> <script>

```

Say you have a monorepo with two packages: `packages/api` and `packages/frontend`, both with a `dev` script that will start a local development server. Normally, you would have to open two separate terminal tabs, cd into each package directory, and run `bun dev`:

```
cd packages/api
bun dev

# in another terminal
cd packages/frontend
bun dev

```

Using `--filter`, you can run the `dev` script in both packages at once:

```
bun --filter '*' dev

```

Both commands will be run in parallel, and you will see a nice terminal UI showing their respective outputs:

[![Terminal Output](https://github.com/oven-sh/bun/assets/48869301/2a103e42-9921-4c33-948f-a1ad6e6bac71)](https://github.com/oven-sh/bun/assets/48869301/2a103e42-9921-4c33-948f-a1ad6e6bac71)

### [Running scripts in workspaces](https://bun.com/docs/cli/filter\#running-scripts-in-workspaces)

Filters respect your [workspace configuration](https://bun.com/docs/install/workspaces): If you have a `package.json` file that specifies which packages are part of the workspace, `--filter` will be restricted to only these packages. Also, in a workspace you can use `--filter` to run scripts in packages that are located anywhere in the workspace:

```
# Packages
# src/foo
# src/bar

# in src/bar: runs myscript in src/foo, no need to cd!
bun run --filter foo myscript

```

### [Dependency Order](https://bun.com/docs/cli/filter\#dependency-order)

Bun will respect package dependency order when running scripts. Say you have a package `foo` that depends on another package `bar` in your workspace, and both packages have a `build` script. When you run `bun --filter '*' build`, you will notice that `foo` will only start running once `bar` is done.

[Previous\\
\\
Lifecycle scripts](https://bun.com/docs/install/lifecycle) [Next\\
\\
Lockfile](https://bun.com/docs/install/lockfile)

[![GitHub logo](<Base64-Image-Removed>)![GitHub logo](<Base64-Image-Removed>)\\
\\
Edit on GitHub](https://github.com/oven-sh/bun/edit/main/docs/cli/filter.md)

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