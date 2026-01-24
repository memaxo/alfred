---
title: Patch dependencies – Package manager | Bun Docs
url:
description: Patch dependencies in your project to fix bugs or add features without vendoring the entire package.
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

Project

[Roadmap](https://bun.com/docs/project/roadmap) [Benchmarking](https://bun.com/docs/project/benchmarking) [Contributing](https://bun.com/docs/project/contributing) [Building Windows](https://bun.com/docs/project/building-windows) [Bindgen](https://bun.com/docs/project/bindgen) [License](https://bun.com/docs/project/licensing)

`bun patch` lets you persistently patch node_modules in a maintainable, git-friendly way.

Sometimes, you need to make a small change to a package in `node_modules/` to fix a bug or add a feature. `bun patch` makes it easy to do this without vendoring the entire package and reuse the patch across multiple installs, multiple projects, and multiple machines.

Features:

- Generates `.patch` files applied to dependencies in `node_modules` on install
- `.patch` files can be committed to your repository, reused across multiple installs, projects, and machines
- `"patchedDependencies"` in `package.json` keeps track of patched packages
- `bun patch` lets you patch packages in `node_modules/` while preserving the integrity of Bun's [Global Cache](https://bun.com/docs/install/cache)
- Test your changes locally before committing them with `bun patch --commit <pkg>`
- To preserve disk space and keep `bun install` fast, patched packages are committed to the Global Cache and shared across projects where possible

#### Step 1. Prepare the package for patching

To get started, use `bun patch <pkg>` to prepare the package for patching:

```
# you can supply the package name
```

```
bun patch react
```

```

# ...and a precise version in case multiple versions are installed
```

```
bun patch react@17.0.2
```

```

# or the path to the package
```

```
bun patch node_modules/react
```

**Note** — Don't forget to call `bun patch <pkg>`! This ensures the package folder in `node_modules/` contains a fresh copy of the package with no symlinks/hardlinks to Bun's cache.

If you forget to do this, you might end up editing the package globally in the cache!

#### Step 2. Test your changes locally

`bun patch <pkg>` makes it safe to edit the `<pkg>` in `node_modules/` directly, while preserving the integrity of Bun's [Global Cache](https://bun.com/docs/install/cache). This works by re-creating an unlinked clone of the package in `node_modules/` and diffing it against the original package in the Global Cache.

#### Step 3. Commit your changes

Once you're happy with your changes, run `bun patch --commit <path or pkg>`.

Bun will generate a patch file in `patches/`, update your `package.json` and lockfile, and Bun will start using the patched package:

```
# you can supply the path to the patched package
```

```
bun patch --commit node_modules/react
```

```

# ... or the package name and optionally the version
```

```
bun patch --commit react@17.0.2
```

```

# choose the directory to store the patch files
```

```
bun patch --commit react --patches-dir=mypatches
```

```

# `patch-commit` is available for compatibility with pnpm
```

```
bun patch-commit react
```

## CLI Usage

$bunpatch<package>@<version> flags or options

### Flags

#### Patching Operations

--commit

Install a package containing modifications in \`dir\`

--patches-dir=<val>

The directory to put the patch file in (only if --commit is used)

#### Installation Behavior

-p,--production

Don't install devDependencies

--dry-run

Don't install anything

-f,--force

Always request the latest versions from the registry & reinstall all dependencies

--no-verify

Skip verifying integrity of newly downloaded packages

--trust

Add to trustedDependencies in the project's package.json and install the package(s)

-g,--global

Install globally

--backend=<val>

Platform-specific optimizations for installing dependencies. Possible values: "clonefile" (default), "hardlink", "symlink", "copyfile"

--omit=<val>

Exclude 'dev', 'optional', or 'peer' dependencies from install

#### Lockfile & Saving

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

#### Script & Concurrency Control

--ignore-scripts

Skip lifecycle scripts in the project's package.json (dependency scripts are never run)

--concurrent-scripts=<val>

Maximum number of concurrent jobs for lifecycle scripts (default 5)

#### General Options

-c,--config=<val>

Specify path to config file (bunfig.toml)

--cwd=<val>

Set a specific cwd

-h,--help

Print this help menu

### Examples

Prepare jquery for patching

bun patch jquery

Generate a patch file for changes made to jquery

bun patch --commit 'node_modules/jquery'

Generate a patch file in a custom directory for changes made to jquery

bun patch --patches-dir 'my-patches' 'node_modules/jquery'

Full documentation is available at https://bun.sh/docs/install/patch.

[Previous\\
\\
Overrides and resolutions](https://bun.com/docs/install/overrides) [Next\\
\\
Audit dependencies](https://bun.com/docs/install/audit)

[![GitHub logo](Base64-Image-Removed)![GitHub logo](Base64-Image-Removed)\\
\\
Edit on GitHub](https://github.com/oven-sh/bun/edit/main/docs/install/patch.md)

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
