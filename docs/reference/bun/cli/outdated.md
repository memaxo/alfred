---
title: bun outdated – Package manager | Bun Docs
url:
description: Check for outdated dependencies.
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

[`bun install`](https://bun.com/docs/cli/install) [`bun add`](https://bun.com/docs/cli/add) [`bun remove`](https://bun.com/docs/cli/remove) [`bun update`](https://bun.com/docs/cli/update) [`bun publish`](https://bun.com/docs/cli/publish) [`bun outdated`](https://bun.com/docs/cli/outdated)

[Version Information](https://bun.com/docs/cli/outdated#version-information) [Dependency Filters](https://bun.com/docs/cli/outdated#dependency-filters) [Workspace Filters](https://bun.com/docs/cli/outdated#workspace-filters)

[`bun link`](https://bun.com/docs/cli/link) [`bun pm`](https://bun.com/docs/cli/pm) [`bun why`](https://bun.com/docs/cli/why) [Global cache](https://bun.com/docs/install/cache) [Isolated installs](https://bun.com/docs/install/isolated) [Workspaces](https://bun.com/docs/install/workspaces) [Catalogs](https://bun.com/docs/install/catalogs) [Lifecycle scripts](https://bun.com/docs/install/lifecycle) [Filter](https://bun.com/docs/cli/filter) [Lockfile](https://bun.com/docs/install/lockfile) [Scopes and registries](https://bun.com/docs/install/registries) [Overrides and resolutions](https://bun.com/docs/install/overrides) [Patch dependencies](https://bun.com/docs/install/patch) [Audit dependencies](https://bun.com/docs/install/audit) [.npmrc support](https://bun.com/docs/install/npmrc) [Security Scanner API](https://bun.com/docs/install/security-scanner-api)

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

Use `bun outdated` to check for outdated dependencies in your project. This command displays a table of dependencies that have newer versions available.

$bun outdated

bun outdatedv1.2.22

Package

Current

Update

Latest

@sinclair/typebox

0.34.15

0.34.16

0.34.16

@types/bun(dev)

1.2.0

1.2.22

1.2.22

eslint(dev)

8.57.1

8.57.1

9.20.0

eslint-plugin-security(dev)

2.1.1

2.1.1

3.0.1

eslint-plugin-sonarjs(dev)

0.23.0

0.23.0

3.0.1

expect-type(dev)

0.16.0

0.16.0

1.1.0

prettier(dev)

3.4.2

3.5.0

3.5.0

tsup(dev)

8.3.5

8.3.6

8.3.6

typescript(dev)

5.7.2

5.7.3

5.7.3

## [Version Information](https://bun.com/docs/cli/outdated#version-information)

The output table shows three version columns:

- **Current**: The version currently installed
- **Update**: The latest version that satisfies your package.json version range
- **Latest**: The latest version published to the registry

### [Dependency Filters](https://bun.com/docs/cli/outdated#dependency-filters)

`bun outdated` supports searching for outdated dependencies by package names and glob patterns.

To check if specific dependencies are outdated, pass the package names as positional arguments:

$bun outdated eslint-plugin-security eslint-plugin-sonarjs

bun outdatedv1.2.22

Package

Current

Update

Latest

eslint-plugin-security(dev)

2.1.1

2.1.1

3.0.1

eslint-plugin-sonarjs(dev)

0.23.0

0.23.0

3.0.1

You can also pass glob patterns to check for outdated packages:

$bun outdated 'eslint\*'

bun outdatedv1.2.22

Package

Current

Update

Latest

eslint(dev)

8.57.1

8.57.1

9.20.0

eslint-plugin-security(dev)

2.1.1

2.1.1

3.0.1

eslint-plugin-sonarjs(dev)

0.23.0

0.23.0

3.0.1

For example, to check for outdated `@types/*` packages:

$bun outdated '@types/\*'

bun outdatedv1.2.22

Package

Current

Update

Latest

@types/bun(dev)

1.2.0

1.2.22

1.2.22

Or to exclude all `@types/*` packages:

$bun outdated '!@types/\*'

bun outdatedv1.2.22

Package

Current

Update

Latest

@sinclair/typebox

0.34.15

0.34.16

0.34.16

eslint(dev)

8.57.1

8.57.1

9.20.0

eslint-plugin-security(dev)

2.1.1

2.1.1

3.0.1

eslint-plugin-sonarjs(dev)

0.23.0

0.23.0

3.0.1

expect-type(dev)

0.16.0

0.16.0

1.1.0

prettier(dev)

3.4.2

3.5.0

3.5.0

tsup(dev)

8.3.5

8.3.6

8.3.6

typescript(dev)

5.7.2

5.7.3

5.7.3

### [Workspace Filters](https://bun.com/docs/cli/outdated#workspace-filters)

Use the `--filter` flag to check for outdated dependencies in a different workspace package:

$bun outdated --filter='@monorepo/types'

bun outdatedv1.2.22

Package

Current

Update

Latest

tsup(dev)

8.3.5

8.3.6

8.3.6

typescript(dev)

5.7.2

5.7.3

5.7.3

You can pass multiple `--filter` flags to check multiple workspaces:

$bun outdated --filter @monorepo/types --filter @monorepo/cli

bun outdatedv1.2.22

Package

Current

Update

Latest

eslint(dev)

8.57.1

8.57.1

9.20.0

eslint-plugin-security(dev)

2.1.1

2.1.1

3.0.1

eslint-plugin-sonarjs(dev)

0.23.0

0.23.0

3.0.1

expect-type(dev)

0.16.0

0.16.0

1.1.0

tsup(dev)

8.3.5

8.3.6

8.3.6

typescript(dev)

5.7.2

5.7.3

5.7.3

You can also pass glob patterns to filter by workspace names:

$bun outdated --filter='@monorepo/{types,cli}'

bun outdatedv1.2.22

Package

Current

Update

Latest

eslint(dev)

8.57.1

8.57.1

9.20.0

eslint-plugin-security(dev)

2.1.1

2.1.1

3.0.1

eslint-plugin-sonarjs(dev)

0.23.0

0.23.0

3.0.1

expect-type(dev)

0.16.0

0.16.0

1.1.0

tsup(dev)

8.3.5

8.3.6

8.3.6

typescript(dev)

5.7.2

5.7.3

5.7.3

## CLI Usage

$bunoutdatedfilter

### Flags

#### General Options

-c,--config=<val>

Specify path to config file (bunfig.toml)

--cwd=<val>

Set a specific cwd

-h,--help

Print this help menu

-F,--filter=<val>

Display outdated dependencies for each matching workspace

#### Output & Logging

--silent

Don't log anything

--verbose

Excessively verbose logging

--no-progress

Disable the progress bar

--no-summary

Don't print a summary

#### Dependency Scope & Target

-p,--production

Don't install devDependencies

--omit=<val>

Exclude 'dev', 'optional', or 'peer' dependencies from install

-g,--global

Install globally

#### Lockfile & Package.json

-y,--yarn

Write a yarn.lock file (yarn v1)

--no-save

Don't update package.json or save a lockfile

--save

Save to package.json (true by default)

--frozen-lockfile

Disallow changes to lockfile

--save-text-lockfile

Save a text-based lockfile

--lockfile-only

Generate a lockfile without installing dependencies

--trust

Add to trustedDependencies in the project's package.json and install the package(s)

#### Network & Registry

--ca=<val>

Provide a Certificate Authority signing certificate

--cafile=<val>

The same as \`--ca\`, but is a file path to the certificate

--registry=<val>

Use a specific registry by default, overriding .npmrc, bunfig.toml and environment variables

--network-concurrency=<val>

Maximum number of concurrent network requests (default 48)

#### Caching

--cache-dir=<val>

Store & load cached data from a specific directory path

--no-cache

Ignore manifest cache entirely

#### Execution Behavior

--dry-run

Don't install anything

-f,--force

Always request the latest versions from the registry & reinstall all dependencies

--no-verify

Skip verifying integrity of newly downloaded packages

--ignore-scripts

Skip lifecycle scripts in the project's package.json (dependency scripts are never run)

--backend=<val>

Platform-specific optimizations for installing dependencies. Possible values: "clonefile" (default), "hardlink", "symlink", "copyfile"

--concurrent-scripts=<val>

Maximum number of concurrent jobs for lifecycle scripts (default 5)

### Examples

Display outdated dependencies in the current workspace.

bun outdated

Use --filter to include more than one workspace.

bun outdated --filter="\*"

bun outdated --filter="./app/\*"

Filter dependencies with name patterns.

bun outdated jquery

bun outdated "is-\*"

Full documentation is available at https://bun.sh/docs/cli/outdated.

[Previous\\
\\
`bun publish`](https://bun.com/docs/cli/publish) [Next\\
\\
`bun link`](https://bun.com/docs/cli/link)

[![GitHub logo](Base64-Image-Removed)![GitHub logo](Base64-Image-Removed)\\
\\
Edit on GitHub](https://github.com/oven-sh/bun/edit/main/docs/cli/outdated.md)

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
