---
title: bun install – Package manager | Bun Docs
url: 
description: Install all dependencies with `bun install`, or manage dependencies with `bun add` and `bun remove`.
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

[`bun install`](https://bun.com/docs/cli/install)

[Logging](https://bun.com/docs/cli/install#logging) [Lifecycle scripts](https://bun.com/docs/cli/install#lifecycle-scripts) [Workspaces](https://bun.com/docs/cli/install#workspaces) [Installing dependencies for specific packages](https://bun.com/docs/cli/install#installing-dependencies-for-specific-packages) [Overrides and resolutions](https://bun.com/docs/cli/install#overrides-and-resolutions) [Global packages](https://bun.com/docs/cli/install#global-packages) [Production mode](https://bun.com/docs/cli/install#production-mode) [Omitting dependencies](https://bun.com/docs/cli/install#omitting-dependencies) [Dry run](https://bun.com/docs/cli/install#dry-run) [Non-npm dependencies](https://bun.com/docs/cli/install#non-npm-dependencies) [Installation strategies](https://bun.com/docs/cli/install#installation-strategies) [Hoisted installs (default for single projects)](https://bun.com/docs/cli/install#hoisted-installs-default-for-single-projects) [Isolated installs](https://bun.com/docs/cli/install#isolated-installs) [Disk efficiency](https://bun.com/docs/cli/install#disk-efficiency) [Configuration](https://bun.com/docs/cli/install#configuration) [CI/CD](https://bun.com/docs/cli/install#ci-cd)

[`bun add`](https://bun.com/docs/cli/add) [`bun remove`](https://bun.com/docs/cli/remove) [`bun update`](https://bun.com/docs/cli/update) [`bun publish`](https://bun.com/docs/cli/publish) [`bun outdated`](https://bun.com/docs/cli/outdated) [`bun link`](https://bun.com/docs/cli/link) [`bun pm`](https://bun.com/docs/cli/pm) [`bun why`](https://bun.com/docs/cli/why) [Global cache](https://bun.com/docs/install/cache) [Isolated installs](https://bun.com/docs/install/isolated) [Workspaces](https://bun.com/docs/install/workspaces) [Catalogs](https://bun.com/docs/install/catalogs) [Lifecycle scripts](https://bun.com/docs/install/lifecycle) [Filter](https://bun.com/docs/cli/filter) [Lockfile](https://bun.com/docs/install/lockfile) [Scopes and registries](https://bun.com/docs/install/registries) [Overrides and resolutions](https://bun.com/docs/install/overrides) [Patch dependencies](https://bun.com/docs/install/patch) [Audit dependencies](https://bun.com/docs/install/audit) [.npmrc support](https://bun.com/docs/install/npmrc) [Security Scanner API](https://bun.com/docs/install/security-scanner-api)

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

The `bun` CLI contains a Node.js-compatible package manager designed to be a dramatically faster replacement for `npm`, `yarn`, and `pnpm`. It's a standalone tool that will work in pre-existing Node.js projects; if your project has a `package.json`, `bun install` can help you speed up your workflow.

**⚡️ 25x faster** — Switch from `npm install` to `bun install` in any Node.js project to make your installations up to 25x faster.

[![](https://user-images.githubusercontent.com/709451/147004342-571b6123-17a9-49a2-8bfd-dcfc5204047e.png)](https://user-images.githubusercontent.com/709451/147004342-571b6123-17a9-49a2-8bfd-dcfc5204047e.png)

**💾 Disk efficient** — Bun install stores all packages in a global cache ( `~/.bun/install/cache/`) and creates hardlinks (Linux) or copy-on-write clones (macOS) to `node_modules`. This means duplicate packages across projects point to the same underlying data, taking up virtually no extra disk space.

For more details, see [Package manager > Global cache](https://bun.com/docs/install/cache).

For Linux users

The recommended minimum Linux Kernel version is 5.6. If you're on Linux kernel 5.1 - 5.5, `bun install` will work, but HTTP requests will be slow due to a lack of support for io\_uring's `connect()` operation.

If you're using Ubuntu 20.04, here's how to install a [newer kernel](https://wiki.ubuntu.com/Kernel/LTSEnablementStack):

```
# If this returns a version >= 5.6, you don't need to do anything
```

```
uname -r
```

```

# Install the official Ubuntu hardware enablement kernel
```

```
sudo apt install --install-recommends linux-generic-hwe-20.04
```

To install all dependencies of a project:

```
bun install
```

Running `bun install` will:

- **Install** all `dependencies`, `devDependencies`, and `optionalDependencies`. Bun will install `peerDependencies` by default.
- **Run** your project's `{pre|post}install` and `{pre|post}prepare` scripts at the appropriate time. For security reasons Bun _does not execute_ lifecycle scripts of installed dependencies.
- **Write** a `bun.lock` lockfile to the project root.

## [Logging](https://bun.com/docs/cli/install\#logging)

To modify logging verbosity:

```
bun install --verbose # debug logging
```

```
bun install --silent  # no logging
```

## [Lifecycle scripts](https://bun.com/docs/cli/install\#lifecycle-scripts)

Unlike other npm clients, Bun does not execute arbitrary lifecycle scripts like `postinstall` for installed dependencies. Executing arbitrary scripts represents a potential security risk.

To tell Bun to allow lifecycle scripts for a particular package, add the package to `trustedDependencies` in your package.json.

```
{
  "name": "my-app",
  "version": "1.0.0",
  "trustedDependencies": ["my-trusted-package"]
}
```

Then re-install the package. Bun will read this field and run lifecycle scripts for `my-trusted-package`.

Lifecycle scripts will run in parallel during installation. To adjust the maximum number of concurrent scripts, use the `--concurrent-scripts` flag. The default is two times the reported cpu count or GOMAXPROCS.

```
bun install --concurrent-scripts 5
```

## [Workspaces](https://bun.com/docs/cli/install\#workspaces)

Bun supports `"workspaces"` in package.json. For complete documentation refer to [Package manager > Workspaces](https://bun.com/docs/install/workspaces).

package.json

```
{
  "name": "my-app",
  "version": "1.0.0",
  "workspaces": ["packages/*"],
  "dependencies": {
    "preact": "^10.5.13"
  }
}

```

## [Installing dependencies for specific packages](https://bun.com/docs/cli/install\#installing-dependencies-for-specific-packages)

In a monorepo, you can install the dependencies for a subset of packages using the `--filter` flag.

```
# Install dependencies for all workspaces except `pkg-c`
```

```
bun install --filter '!pkg-c'
```

```

# Install dependencies for only `pkg-a` in `./packages/pkg-a`
```

```
bun install --filter './packages/pkg-a'
```

For more information on filtering with `bun install`, refer to [Package Manager > Filtering](https://bun.com/docs/cli/filter#bun-install-and-bun-outdated)

## [Overrides and resolutions](https://bun.com/docs/cli/install\#overrides-and-resolutions)

Bun supports npm's `"overrides"` and Yarn's `"resolutions"` in `package.json`. These are mechanisms for specifying a version range for _metadependencies_—the dependencies of your dependencies. Refer to [Package manager > Overrides and resolutions](https://bun.com/docs/install/overrides) for complete documentation.

package.json

```
{
  "name": "my-app",
  "dependencies": {
    "foo": "^2.0.0"
  },
  "overrides": {
    "bar": "~4.4.0"
  }
}
```

## [Global packages](https://bun.com/docs/cli/install\#global-packages)

To install a package globally, use the `-g`/ `--global` flag. Typically this is used for installing command-line tools.

```
bun install --global cowsay # or `bun install -g cowsay`
```

```
cowsay "Bun!"
```

```
 ______
< Bun! >
 ------
        \   ^__^
         \  (oo)\_______
            (__)\       )\/\
                ||----w |
                ||     ||
```

## [Production mode](https://bun.com/docs/cli/install\#production-mode)

To install in production mode (i.e. without `devDependencies` or `optionalDependencies`):

```
bun install --production
```

For reproducible installs, use `--frozen-lockfile`. This will install the exact versions of each package specified in the lockfile. If your `package.json` disagrees with `bun.lock`, Bun will exit with an error. The lockfile will not be updated.

```
bun install --frozen-lockfile
```

For more information on Bun's lockfile `bun.lock`, refer to [Package manager > Lockfile](https://bun.com/docs/install/lockfile).

## [Omitting dependencies](https://bun.com/docs/cli/install\#omitting-dependencies)

To omit dev, peer, or optional dependencies use the `--omit` flag.

```
# Exclude "devDependencies" from the installation. This will apply to the
# root package and workspaces if they exist. Transitive dependencies will
# not have "devDependencies".
```

```
bun install --omit dev
```

```

# Install only dependencies from "dependencies"
```

```
bun install --omit=dev --omit=peer --omit=optional
```

## [Dry run](https://bun.com/docs/cli/install\#dry-run)

To perform a dry run (i.e. don't actually install anything):

```
bun install --dry-run
```

## [Non-npm dependencies](https://bun.com/docs/cli/install\#non-npm-dependencies)

Bun supports installing dependencies from Git, GitHub, and local or remotely-hosted tarballs. For complete documentation refer to [Package manager > Git, GitHub, and tarball dependencies](https://bun.com/docs/cli/add).

package.json

```
{
  "dependencies": {
    "dayjs": "git+https://github.com/iamkun/dayjs.git",
    "lodash": "git+ssh://github.com/lodash/lodash.git#4.17.21",
    "moment": "git@github.com:moment/moment.git",
    "zod": "github:colinhacks/zod",
    "react": "https://registry.npmjs.org/react/-/react-18.2.0.tgz",
    "bun-types": "npm:@types/bun"
  }
}

```

## [Installation strategies](https://bun.com/docs/cli/install\#installation-strategies)

Bun supports two package installation strategies that determine how dependencies are organized in `node_modules`:

### [Hoisted installs (default for single projects)](https://bun.com/docs/cli/install\#hoisted-installs-default-for-single-projects)

The traditional npm/Yarn approach that flattens dependencies into a shared `node_modules` directory:

```
bun install --linker hoisted
```

### [Isolated installs](https://bun.com/docs/cli/install\#isolated-installs)

A pnpm-like approach that creates strict dependency isolation to prevent phantom dependencies:

```
bun install --linker isolated
```

Isolated installs create a central package store in `node_modules/.bun/` with symlinks in the top-level `node_modules`. This ensures packages can only access their declared dependencies.

For complete documentation on isolated installs, refer to [Package manager > Isolated installs](https://bun.com/docs/install/isolated).

## [Disk efficiency](https://bun.com/docs/cli/install\#disk-efficiency)

Bun uses a global cache at `~/.bun/install/cache/` to minimize disk usage. Packages are stored once and linked to `node_modules` using hardlinks (Linux/Windows) or copy-on-write (macOS), so duplicate packages across projects don't consume additional disk space.

For complete documentation refer to [Package manager > Global cache](https://bun.com/docs/install/cache).

## [Configuration](https://bun.com/docs/cli/install\#configuration)

The default behavior of `bun install` can be configured in `bunfig.toml`. The default values are shown below.

```
[install]

# whether to install optionalDependencies
optional = true

# whether to install devDependencies
dev = true

# whether to install peerDependencies
peer = true

# equivalent to `--production` flag
production = false

# equivalent to `--save-text-lockfile` flag
saveTextLockfile = false

# equivalent to `--frozen-lockfile` flag
frozenLockfile = false

# equivalent to `--dry-run` flag
dryRun = false

# equivalent to `--concurrent-scripts` flag
concurrentScripts = 16 # (cpu count or GOMAXPROCS) x2

# installation strategy: "hoisted" or "isolated"
# default: "hoisted"
linker = "hoisted"

```

## [CI/CD](https://bun.com/docs/cli/install\#ci-cd)

Use the official [`oven-sh/setup-bun`](https://github.com/oven-sh/setup-bun) action to install `bun` in a GitHub Actions pipeline:

.github/workflows/release.yml

```
name: bun-types
jobs:
  build:
    name: build-app
    runs-on: ubuntu-latest
    steps:
      - name: Checkout repo
        uses: actions/checkout@v4
      - name: Install bun
        uses: oven-sh/setup-bun@v2
      - name: Install dependencies
        run: bun install
      - name: Build app
        run: bun run build

```

For CI/CD environments that want to enforce reproducible builds, use `bun ci` to fail the build if the package.json is out of sync with the lockfile:

```
bun ci
```

This is equivalent to `bun install --frozen-lockfile`. It installs exact versions from `bun.lock` and fails if `package.json` doesn't match the lockfile. To use `bun ci` or `bun install --frozen-lockfile`, you must commit `bun.lock` to version control.

And instead of running `bun install`, run `bun ci`.

.github/workflows/release.yml

```
name: bun-types
jobs:
  build:
    name: build-app
    runs-on: ubuntu-latest
    steps:
      - name: Checkout repo
        uses: actions/checkout@v4
      - name: Install bun
        uses: oven-sh/setup-bun@v2
      - name: Install dependencies
        run: bun ci
      - name: Build app
        run: bun run build

```

## CLI Usage

$buninstall<name>@<version>

### Flags

#### General Configuration

-c,--config=<val>

Specify path to config file (bunfig.toml)

--cwd=<val>

Set a specific cwd

#### Dependency Scope & Management

-p,--production

Don't install devDependencies

--no-save

Don't update package.json or save a lockfile

--save

Save to package.json (true by default)

--omit=<val>

Exclude 'dev', 'optional', or 'peer' dependencies from install

--only-missing

Only add dependencies to package.json if they are not already present

#### Dependency Type & Versioning

-d,--dev

Add dependency to "devDependencies"

--optional

Add dependency to "optionalDependencies"

--peer

Add dependency to "peerDependencies"

-E,--exact

Add the exact version instead of the ^range

#### Lockfile Control

-y,--yarn

Write a yarn.lock file (yarn v1)

--frozen-lockfile

Disallow changes to lockfile

--save-text-lockfile

Save a text-based lockfile

--lockfile-only

Generate a lockfile without installing dependencies

#### Network & Registry Settings

--ca=<val>

Provide a Certificate Authority signing certificate

--cafile=<val>

The same as \`--ca\`, but is a file path to the certificate

--registry=<val>

Use a specific registry by default, overriding .npmrc, bunfig.toml and environment variables

#### Installation Process Control

--dry-run

Don't install anything

-f,--force

Always request the latest versions from the registry & reinstall all dependencies

-g,--global

Install globally

--backend=<val>

Platform-specific optimizations for installing dependencies. Possible values: "clonefile" (default), "hardlink", "symlink", "copyfile"

--filter=<val>

Install packages for the matching workspaces

-a,--analyze

Analyze & install all dependencies of files passed as arguments recursively (using Bun's bundler)

#### Caching Options

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

#### Security & Integrity

--no-verify

Skip verifying integrity of newly downloaded packages

--trust

Add to trustedDependencies in the project's package.json and install the package(s)

#### Concurrency & Performance

--concurrent-scripts=<val>

Maximum number of concurrent jobs for lifecycle scripts (default 5)

--network-concurrency=<val>

Maximum number of concurrent network requests (default 48)

#### Lifecycle Script Management

--ignore-scripts

Skip lifecycle scripts in the project's package.json (dependency scripts are never run)

#### Help Information

-h,--help

Print this help menu

### Examples

Install the dependencies for the current project

bun install

Skip devDependencies

bun install --production

Full documentation is available at https://bun.sh/docs/cli/install.

[Previous\\
\\
Debugger](https://bun.com/docs/runtime/debugger) [Next\\
\\
`bun add`](https://bun.com/docs/cli/add)

[![GitHub logo](<Base64-Image-Removed>)![GitHub logo](<Base64-Image-Removed>)\\
\\
Edit on GitHub](https://github.com/oven-sh/bun/edit/main/docs/cli/install.md)

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