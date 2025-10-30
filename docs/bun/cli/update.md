---
title: bun update – Package manager | Bun Docs
url: 
description: Update your project's dependencies.
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

[`bun install`](https://bun.com/docs/cli/install) [`bun add`](https://bun.com/docs/cli/add) [`bun remove`](https://bun.com/docs/cli/remove) [`bun update`](https://bun.com/docs/cli/update)

[`--interactive`](https://bun.com/docs/cli/update#interactive) [Interactive Interface](https://bun.com/docs/cli/update#interactive-interface) [Keyboard Controls](https://bun.com/docs/cli/update#keyboard-controls) [Visual Indicators](https://bun.com/docs/cli/update#visual-indicators) [Package Grouping](https://bun.com/docs/cli/update#package-grouping) [`--latest`](https://bun.com/docs/cli/update#latest)

[`bun publish`](https://bun.com/docs/cli/publish) [`bun outdated`](https://bun.com/docs/cli/outdated) [`bun link`](https://bun.com/docs/cli/link) [`bun pm`](https://bun.com/docs/cli/pm) [`bun why`](https://bun.com/docs/cli/why) [Global cache](https://bun.com/docs/install/cache) [Isolated installs](https://bun.com/docs/install/isolated) [Workspaces](https://bun.com/docs/install/workspaces) [Catalogs](https://bun.com/docs/install/catalogs) [Lifecycle scripts](https://bun.com/docs/install/lifecycle) [Filter](https://bun.com/docs/cli/filter) [Lockfile](https://bun.com/docs/install/lockfile) [Scopes and registries](https://bun.com/docs/install/registries) [Overrides and resolutions](https://bun.com/docs/install/overrides) [Patch dependencies](https://bun.com/docs/install/patch) [Audit dependencies](https://bun.com/docs/install/audit) [.npmrc support](https://bun.com/docs/install/npmrc) [Security Scanner API](https://bun.com/docs/install/security-scanner-api)

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

To update all dependencies to the latest version:

```
bun update
```

To update a specific dependency to the latest version:

```
bun update [package]
```

## [`--interactive`](https://bun.com/docs/cli/update\#interactive)

For a more controlled update experience, use the `--interactive` flag to select which packages to update:

```
bun update --interactive
```

```
bun update -i
```

This launches an interactive terminal interface that shows all outdated packages with their current and target versions. You can then select which packages to update.

### [Interactive Interface](https://bun.com/docs/cli/update\#interactive-interface)

The interface displays packages grouped by dependency type:

```
? Select packages to update - Space to toggle, Enter to confirm, a to select all, n to select none, i to invert, l to toggle latest

  dependencies                Current  Target   Latest
    □ react                   17.0.2   18.2.0   18.3.1
    □ lodash                  4.17.20  4.17.21  4.17.21

  devDependencies             Current  Target   Latest
    □ typescript              4.8.0    5.0.0    5.3.3
    □ @types/node             16.11.7  18.0.0   20.11.5

  optionalDependencies        Current  Target   Latest
    □ some-optional-package   1.0.0    1.1.0    1.2.0

```

**Sections:**

- Packages are grouped under section headers: `dependencies`, `devDependencies`, `peerDependencies`, `optionalDependencies`
- Each section shows column headers aligned with the package data

**Columns:**

- **Package**: Package name (may have suffix like ` dev`, ` peer`, ` optional` for clarity)
- **Current**: Currently installed version
- **Target**: Version that would be installed (respects semver constraints)
- **Latest**: Latest available version

### [Keyboard Controls](https://bun.com/docs/cli/update\#keyboard-controls)

**Selection:**

- **Space**: Toggle package selection
- **Enter**: Confirm selections and update
- **a/A**: Select all packages
- **n/N**: Select none
- **i/I**: Invert selection

**Navigation:**

- **↑/↓ Arrow keys** or **j/k**: Move cursor
- **l/L**: Toggle between target and latest version for current package

**Exit:**

- **Ctrl+C** or **Ctrl+D**: Cancel without updating

### [Visual Indicators](https://bun.com/docs/cli/update\#visual-indicators)

- **☑** Selected packages (will be updated)
- **□** Unselected packages
- **>** Current cursor position
- **Colors**: Red (major), yellow (minor), green (patch) version changes
- **Underlined**: Currently selected update target

### [Package Grouping](https://bun.com/docs/cli/update\#package-grouping)

Packages are organized in sections by dependency type:

- **dependencies** \- Regular runtime dependencies
- **devDependencies** \- Development dependencies
- **peerDependencies** \- Peer dependencies
- **optionalDependencies** \- Optional dependencies

Within each section, individual packages may have additional suffixes ( ` dev`, ` peer`, ` optional`) for extra clarity.

## [`--latest`](https://bun.com/docs/cli/update\#latest)

By default, `bun update` will update to the latest version of a dependency that satisfies the version range specified in your `package.json`.

To update to the latest version, regardless of if it's compatible with the current version range, use the `--latest` flag:

```
bun update --latest
```

In interactive mode, you can toggle individual packages between their target version (respecting semver) and latest version using the **l** key.

For example, with the following `package.json`:

```
{
  "dependencies": {
    "react": "^17.0.2"
  }
}

```

- `bun update` would update to a version that matches `17.x`.
- `bun update --latest` would update to a version that matches `18.x` or later.

## CLI Usage

$bunupdate<name>@<version>

### Flags

#### Update Strategy

-f,--force

Always request the latest versions from the registry & reinstall all dependencies

--latest

Update packages to their latest versions

#### Dependency Scope

-p,--production

Don't install devDependencies

-g,--global

Install globally

--omit=<val>

Exclude 'dev', 'optional', or 'peer' dependencies from install

#### Project File Management

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

#### Output & Logging

--silent

Don't log anything

--verbose

Excessively verbose logging

--no-progress

Disable the progress bar

--no-summary

Don't print a summary

#### Script Execution

--ignore-scripts

Skip lifecycle scripts in the project's package.json (dependency scripts are never run)

--concurrent-scripts=<val>

Maximum number of concurrent jobs for lifecycle scripts (default 5)

#### Installation Controls

--no-verify

Skip verifying integrity of newly downloaded packages

--trust

Add to trustedDependencies in the project's package.json and install the package(s)

--backend=<val>

Platform-specific optimizations for installing dependencies. Possible values: "clonefile" (default), "hardlink", "symlink", "copyfile"

#### General & Environment

-c,--config=<val>

Specify path to config file (bunfig.toml)

--dry-run

Don't install anything

--cwd=<val>

Set a specific cwd

-h,--help

Print this help menu

### Examples

Update all dependencies:

bun update

Update all dependencies to latest:

bun update --latest

Update specific packages:

bun update zod jquery@3

Full documentation is available at https://bun.sh/docs/cli/update.

[Previous\\
\\
`bun remove`](https://bun.com/docs/cli/remove) [Next\\
\\
`bun publish`](https://bun.com/docs/cli/publish)

[![GitHub logo](<Base64-Image-Removed>)![GitHub logo](<Base64-Image-Removed>)\\
\\
Edit on GitHub](https://github.com/oven-sh/bun/edit/main/docs/cli/update.md)

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