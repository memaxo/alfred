---
title: bun pm – Package manager | Bun Docs
url: 
description: Utilities relating to package management with Bun.
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

[`bun install`](https://bun.com/docs/cli/install) [`bun add`](https://bun.com/docs/cli/add) [`bun remove`](https://bun.com/docs/cli/remove) [`bun update`](https://bun.com/docs/cli/update) [`bun publish`](https://bun.com/docs/cli/publish) [`bun outdated`](https://bun.com/docs/cli/outdated) [`bun link`](https://bun.com/docs/cli/link) [`bun pm`](https://bun.com/docs/cli/pm)

[pack](https://bun.com/docs/cli/pm#pack) [Examples](https://bun.com/docs/cli/pm#examples) [Options](https://bun.com/docs/cli/pm#options) [Output Modes](https://bun.com/docs/cli/pm#output-modes) [bin](https://bun.com/docs/cli/pm#bin) [ls](https://bun.com/docs/cli/pm#ls) [whoami](https://bun.com/docs/cli/pm#whoami) [hash](https://bun.com/docs/cli/pm#hash) [cache](https://bun.com/docs/cli/pm#cache) [migrate](https://bun.com/docs/cli/pm#migrate) [untrusted](https://bun.com/docs/cli/pm#untrusted) [trust](https://bun.com/docs/cli/pm#trust) [default-trusted](https://bun.com/docs/cli/pm#default-trusted) [version](https://bun.com/docs/cli/pm#version) [pkg](https://bun.com/docs/cli/pm#pkg)

[`bun why`](https://bun.com/docs/cli/why) [Global cache](https://bun.com/docs/install/cache) [Isolated installs](https://bun.com/docs/install/isolated) [Workspaces](https://bun.com/docs/install/workspaces) [Catalogs](https://bun.com/docs/install/catalogs) [Lifecycle scripts](https://bun.com/docs/install/lifecycle) [Filter](https://bun.com/docs/cli/filter) [Lockfile](https://bun.com/docs/install/lockfile) [Scopes and registries](https://bun.com/docs/install/registries) [Overrides and resolutions](https://bun.com/docs/install/overrides) [Patch dependencies](https://bun.com/docs/install/patch) [Audit dependencies](https://bun.com/docs/install/audit) [.npmrc support](https://bun.com/docs/install/npmrc) [Security Scanner API](https://bun.com/docs/install/security-scanner-api)

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

The `bun pm` command group provides a set of utilities for working with Bun's package manager.

## [pack](https://bun.com/docs/cli/pm\#pack)

To create a tarball of the current workspace:

```
bun pm pack
```

This command creates a `.tgz` file containing all files that would be published to npm, following the same rules as `npm pack`.

## [Examples](https://bun.com/docs/cli/pm\#examples)

Basic usage:

```
bun pm pack
```

```
# Creates my-package-1.0.0.tgz in current directory
```

Quiet mode for scripting:

```
TARBALL=$(bun pm pack --quiet)
```

```
echo "Created: $TARBALL"
```

```
# Output: Created: my-package-1.0.0.tgz
```

Custom destination:

```
bun pm pack --destination ./dist
```

```
# Saves tarball in ./dist/ directory
```

## [Options](https://bun.com/docs/cli/pm\#options)

- `--dry-run`: Perform all tasks except writing the tarball to disk. Shows what would be included.
- `--destination <dir>`: Specify the directory where the tarball will be saved.
- `--filename <name>`: Specify an exact file name for the tarball to be saved at.
- `--ignore-scripts`: Skip running pre/postpack and prepare scripts.
- `--gzip-level <0-9>`: Set a custom compression level for gzip, ranging from 0 to 9 (default is 9).
- `--quiet`: Only output the tarball filename, suppressing verbose output. Ideal for scripts and automation.

**Note:** `--filename` and `--destination` cannot be used at the same time.

## [Output Modes](https://bun.com/docs/cli/pm\#output-modes)

**Default output:**

```
bun pm pack
```

```
bun pack v1.2.19

packed 131B package.json
packed 40B index.js

my-package-1.0.0.tgz

Total files: 2
Shasum: f2451d6eb1e818f500a791d9aace80b394258a90
Unpacked size: 171B
Packed size: 249B
```

**Quiet output:**

```
bun pm pack --quiet
```

```
my-package-1.0.0.tgz
```

The `--quiet` flag is particularly useful for automation workflows where you need to capture the generated tarball filename for further processing.

## [bin](https://bun.com/docs/cli/pm\#bin)

To print the path to the `bin` directory for the local project:

```
bun pm bin
```

```
/path/to/current/project/node_modules/.bin
```

To print the path to the global `bin` directory:

```
bun pm bin -g
```

```
<$HOME>/.bun/bin
```

## [ls](https://bun.com/docs/cli/pm\#ls)

To print a list of installed dependencies in the current project and their resolved versions, excluding their dependencies.

```
bun pm ls
```

```
/path/to/project node_modules (135)
├── eslint@8.38.0
├── react@18.2.0
├── react-dom@18.2.0
├── typescript@5.0.4
└── zod@3.21.4
```

To print all installed dependencies, including nth-order dependencies.

```
bun pm ls --all
```

```
/path/to/project node_modules (135)
├── @eslint-community/eslint-utils@4.4.0
├── @eslint-community/regexpp@4.5.0
├── @eslint/eslintrc@2.0.2
├── @eslint/js@8.38.0
├── @nodelib/fs.scandir@2.1.5
├── @nodelib/fs.stat@2.0.5
├── @nodelib/fs.walk@1.2.8
├── acorn@8.8.2
├── acorn-jsx@5.3.2
├── ajv@6.12.6
├── ansi-regex@5.0.1
├── ...
```

## [whoami](https://bun.com/docs/cli/pm\#whoami)

Print your npm username. Requires you to be logged in ( `bunx npm login`) with credentials in either `bunfig.toml` or `.npmrc`:

```
bun pm whoami
```

## [hash](https://bun.com/docs/cli/pm\#hash)

To generate and print the hash of the current lockfile:

```
bun pm hash
```

To print the string used to hash the lockfile:

```
bun pm hash-string
```

To print the hash stored in the current lockfile:

```
bun pm hash-print
```

## [cache](https://bun.com/docs/cli/pm\#cache)

To print the path to Bun's global module cache:

```
bun pm cache
```

To clear Bun's global module cache:

```
bun pm cache rm
```

## [migrate](https://bun.com/docs/cli/pm\#migrate)

To migrate another package manager's lockfile without installing anything:

```
bun pm migrate
```

## [untrusted](https://bun.com/docs/cli/pm\#untrusted)

To print current untrusted dependencies with scripts:

```
bun pm untrusted
```

```

./node_modules/@biomejs/biome @1.8.3
 » [postinstall]: node scripts/postinstall.js

These dependencies had their lifecycle scripts blocked during install.
```

## [trust](https://bun.com/docs/cli/pm\#trust)

To run scripts for untrusted dependencies and add to `trustedDependencies`:

```
bun pm trust <names>
```

Options for the `trust` command:

- `--all`: Trust all untrusted dependencies.

## [default-trusted](https://bun.com/docs/cli/pm\#default-trusted)

To print the default trusted dependencies list:

```
bun pm default-trusted
```

see the current list on GitHub [here](https://github.com/oven-sh/bun/blob/main/src/install/default-trusted-dependencies.txt)

## [version](https://bun.com/docs/cli/pm\#version)

To display current package version and help:

```
bun pm version
```

```
bun pm version v1.2.22 (ca7428e9)
Current package version: v1.0.0

Increment:
  patch      1.0.0 → 1.0.1
  minor      1.0.0 → 1.1.0
  major      1.0.0 → 2.0.0
  prerelease 1.0.0 → 1.0.1-0
  prepatch   1.0.0 → 1.0.1-0
  preminor   1.0.0 → 1.1.0-0
  premajor   1.0.0 → 2.0.0-0
  from-git   Use version from latest git tag
  1.2.3      Set specific version

Options:
  --no-git-tag-version Skip git operations
  --allow-same-version Prevents throwing error if version is the same
  --message=<val>, -m  Custom commit message, use %s for version substitution
  --preid=<val>        Prerelease identifier (i.e beta → 1.0.1-beta.0)
  --force, -f          Bypass dirty git history check

Examples:
  $ bun pm version patch
  $ bun pm version 1.2.3 --no-git-tag-version
  $ bun pm version prerelease --preid beta --message "Release beta: %s"
```

To bump the version in `package.json`:

```
bun pm version patch
```

```
v1.0.1
```

Supports `patch`, `minor`, `major`, `premajor`, `preminor`, `prepatch`, `prerelease`, `from-git`, or specific versions like `1.2.3`. By default creates git commit and tag unless `--no-git-tag-version` was used to skip.

## [pkg](https://bun.com/docs/cli/pm\#pkg)

Manage `package.json` data with get, set, delete, and fix operations.

All commands support dot and bracket notation:

```
scripts.build              # dot notation
contributors[0]            # array access
workspaces.0               # dot with numeric index
scripts[test:watch]        # bracket for special chars

```

Examples:

```
# set
```

```
bun pm pkg get name                               # single property
```

```
bun pm pkg get name version                       # multiple properties
```

```
bun pm pkg get                                    # entire package.json
```

```
bun pm pkg get scripts.build                      # nested property
```

```

# set
```

```
bun pm pkg set name="my-package"                  # simple property
```

```
bun pm pkg set scripts.test="jest" version=2.0.0  # multiple properties
```

```
bun pm pkg set {"private":"true"} --json          # JSON values with --json flag
```

```

# delete
```

```
bun pm pkg delete description                     # single property
```

```
bun pm pkg delete scripts.test contributors[0]    # multiple/nested
```

```

# fix
```

```
bun pm pkg fix                                    # auto-fix common issues
```

[Previous\\
\\
`bun link`](https://bun.com/docs/cli/link) [Next\\
\\
`bun why`](https://bun.com/docs/cli/why)

[![GitHub logo](<Base64-Image-Removed>)![GitHub logo](<Base64-Image-Removed>)\\
\\
Edit on GitHub](https://github.com/oven-sh/bun/edit/main/docs/cli/pm.md)

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