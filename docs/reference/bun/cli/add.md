---
title: bun add – Package manager | Bun Docs
url:
description: Add dependencies to your project.
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

[`bun install`](https://bun.com/docs/cli/install) [`bun add`](https://bun.com/docs/cli/add)

[`--dev`](https://bun.com/docs/cli/add#dev) [`--optional`](https://bun.com/docs/cli/add#optional) [`--peer`](https://bun.com/docs/cli/add#peer) [`--exact`](https://bun.com/docs/cli/add#exact) [`--global`](https://bun.com/docs/cli/add#global) [Trusted dependencies](https://bun.com/docs/cli/add#trusted-dependencies) [Git dependencies](https://bun.com/docs/cli/add#git-dependencies) [Tarball dependencies](https://bun.com/docs/cli/add#tarball-dependencies)

[`bun remove`](https://bun.com/docs/cli/remove) [`bun update`](https://bun.com/docs/cli/update) [`bun publish`](https://bun.com/docs/cli/publish) [`bun outdated`](https://bun.com/docs/cli/outdated) [`bun link`](https://bun.com/docs/cli/link) [`bun pm`](https://bun.com/docs/cli/pm) [`bun why`](https://bun.com/docs/cli/why) [Global cache](https://bun.com/docs/install/cache) [Isolated installs](https://bun.com/docs/install/isolated) [Workspaces](https://bun.com/docs/install/workspaces) [Catalogs](https://bun.com/docs/install/catalogs) [Lifecycle scripts](https://bun.com/docs/install/lifecycle) [Filter](https://bun.com/docs/cli/filter) [Lockfile](https://bun.com/docs/install/lockfile) [Scopes and registries](https://bun.com/docs/install/registries) [Overrides and resolutions](https://bun.com/docs/install/overrides) [Patch dependencies](https://bun.com/docs/install/patch) [Audit dependencies](https://bun.com/docs/install/audit) [.npmrc support](https://bun.com/docs/install/npmrc) [Security Scanner API](https://bun.com/docs/install/security-scanner-api)

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

To add a particular package:

```
bun add preact
```

To specify a version, version range, or tag:

```
bun add zod@3.20.0
```

```
bun add zod@^3.0.0
```

```
bun add zod@latest
```

## [`--dev`](https://bun.com/docs/cli/add#dev)

**Alias** — `--development`, `-d`, `-D`

To add a package as a dev dependency ( `"devDependencies"`):

```
bun add --dev @types/react
```

```
bun add -d @types/react
```

## [`--optional`](https://bun.com/docs/cli/add#optional)

To add a package as an optional dependency ( `"optionalDependencies"`):

```
bun add --optional lodash
```

## [`--peer`](https://bun.com/docs/cli/add#peer)

To add a package as a peer dependency ( `"peerDependencies"`):

```
bun add --peer @types/bun
```

## [`--exact`](https://bun.com/docs/cli/add#exact)

**Alias** — `-E`

To add a package and pin to the resolved version, use `--exact`. This will resolve the version of the package and add it to your `package.json` with an exact version number instead of a version range.

```
bun add react --exact
```

```
bun add react -E
```

This will add the following to your `package.json`:

```
{
  "dependencies": {
    // without --exact
    "react": "^18.2.0", // this matches >= 18.2.0 < 19.0.0

    // with --exact
    "react": "18.2.0", // this matches only 18.2.0 exactly
  },
}

```

To view a complete list of options for this command:

```
bun add --help
```

## [`--global`](https://bun.com/docs/cli/add#global)

**Note** — This would not modify package.json of your current project folder. **Alias** \- `bun add --global`, `bun add -g`, `bun install --global` and `bun install -g`

To install a package globally, use the `-g`/ `--global` flag. This will not modify the `package.json` of your current project. Typically this is used for installing command-line tools.

```
bun add --global cowsay # or `bun add -g cowsay`
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

Configuring global installation behavior

```
[install]
# where `bun add --global` installs packages
globalDir = "~/.bun/install/global"

# where globally-installed package bins are linked
globalBinDir = "~/.bun/bin"

```

## [Trusted dependencies](https://bun.com/docs/cli/add#trusted-dependencies)

Unlike other npm clients, Bun does not execute arbitrary lifecycle scripts for installed dependencies, such as `postinstall`. These scripts represent a potential security risk, as they can execute arbitrary code on your machine.

To tell Bun to allow lifecycle scripts for a particular package, add the package to `trustedDependencies` in your package.json.

```
{
  "name": "my-app",
  "version": "1.0.0",
  "trustedDependencies": ["my-trusted-package"]
}
```

Bun reads this field and will run lifecycle scripts for `my-trusted-package`.

## [Git dependencies](https://bun.com/docs/cli/add#git-dependencies)

To add a dependency from a public or private git repository:

```
bun add git@github.com:moment/moment.git
```

**Note** — To install private repositories, your system needs the appropriate SSH credentials to access the repository.

Bun supports a variety of protocols, including [`github`](https://docs.npmjs.com/cli/v9/configuring-npm/package-json#github-urls), [`git`](https://docs.npmjs.com/cli/v9/configuring-npm/package-json#git-urls-as-dependencies), `git+ssh`, `git+https`, and many more.

```
{
  "dependencies": {
    "dayjs": "git+https://github.com/iamkun/dayjs.git",
    "lodash": "git+ssh://github.com/lodash/lodash.git#4.17.21",
    "moment": "git@github.com:moment/moment.git",
    "zod": "github:colinhacks/zod"
  }
}

```

## [Tarball dependencies](https://bun.com/docs/cli/add#tarball-dependencies)

A package name can correspond to a publicly hosted `.tgz` file. During installation, Bun will download and install the package from the specified tarball URL, rather than from the package registry.

```
bun add zod@https://registry.npmjs.org/zod/-/zod-3.21.4.tgz
```

This will add the following line to your `package.json`:

package.json

```
{
  "dependencies": {
    "zod": "https://registry.npmjs.org/zod/-/zod-3.21.4.tgz"
  }
}

```

## CLI Usage

$bunadd<package> <@version>

### Flags

#### Dependency Management

-p,--production

Don't install devDependencies

--omit=<val>

Exclude 'dev', 'optional', or 'peer' dependencies from install

-g,--global

Install globally

-d,--dev

Add dependency to "devDependencies"

--optional

Add dependency to "optionalDependencies"

--peer

Add dependency to "peerDependencies"

-E,--exact

Add the exact version instead of the ^range

--only-missing

Only add dependencies to package.json if they are not already present

#### Project Files & Lockfiles

-y,--yarn

Write a yarn.lock file (yarn v1)

--no-save

Don't update package.json or save a lockfile

--save

Save to package.json (true by default)

--frozen-lockfile

Disallow changes to lockfile

--trust

Add to trustedDependencies in the project's package.json and install the package(s)

--save-text-lockfile

Save a text-based lockfile

--lockfile-only

Generate a lockfile without installing dependencies

#### Installation Control

--dry-run

Don't install anything

-f,--force

Always request the latest versions from the registry & reinstall all dependencies

--no-verify

Skip verifying integrity of newly downloaded packages

--ignore-scripts

Skip lifecycle scripts in the project's package.json (dependency scripts are never run)

-a,--analyze

Recursively analyze & install dependencies of files passed as arguments (using Bun's bundler)

#### Network & Registry

--ca=<val>

Provide a Certificate Authority signing certificate

--cafile=<val>

The same as \`--ca\`, but is a file path to the certificate

--registry=<val>

Use a specific registry by default, overriding .npmrc, bunfig.toml and environment variables

--network-concurrency=<val>

Maximum number of concurrent network requests (default 48)

#### Performance & Resource

--backend=<val>

Platform-specific optimizations for installing dependencies. Possible values: "clonefile" (default), "hardlink", "symlink", "copyfile"

--concurrent-scripts=<val>

Maximum number of concurrent jobs for lifecycle scripts (default 5)

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

#### Global Configuration & Context

-c,--config=<val>

Specify path to config file (bunfig.toml)

--cwd=<val>

Set a specific cwd

#### Help

-h,--help

Print this help menu

### Examples

Add a dependency from the npm registry

bun add zod

bun add zod@next

Add a dev, optional, or peer dependency

bun add -d typescript

bun add --optional lodash

Full documentation is available at https://bun.sh/docs/cli/add.

[Previous\\
\\
`bun install`](https://bun.com/docs/cli/install) [Next\\
\\
`bun remove`](https://bun.com/docs/cli/remove)

[![GitHub logo](Base64-Image-Removed)![GitHub logo](Base64-Image-Removed)\\
\\
Edit on GitHub](https://github.com/oven-sh/bun/edit/main/docs/cli/add.md)

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
