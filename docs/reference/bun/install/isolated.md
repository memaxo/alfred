---
title: Isolated installs – Package manager | Bun Docs
url:
description: Create strict dependency isolation, preventing phantom dependencies.
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

[`bun install`](https://bun.com/docs/cli/install) [`bun add`](https://bun.com/docs/cli/add) [`bun remove`](https://bun.com/docs/cli/remove) [`bun update`](https://bun.com/docs/cli/update) [`bun publish`](https://bun.com/docs/cli/publish) [`bun outdated`](https://bun.com/docs/cli/outdated) [`bun link`](https://bun.com/docs/cli/link) [`bun pm`](https://bun.com/docs/cli/pm) [`bun why`](https://bun.com/docs/cli/why) [Global cache](https://bun.com/docs/install/cache) [Isolated installs](https://bun.com/docs/install/isolated)

[What are isolated installs?](https://bun.com/docs/install/isolated#what-are-isolated-installs) [Key benefits](https://bun.com/docs/install/isolated#key-benefits) [Using isolated installs](https://bun.com/docs/install/isolated#using-isolated-installs) [Command line](https://bun.com/docs/install/isolated#command-line) [Configuration file](https://bun.com/docs/install/isolated#configuration-file) [Default behavior](https://bun.com/docs/install/isolated#default-behavior) [How isolated installs work](https://bun.com/docs/install/isolated#how-isolated-installs-work) [Directory structure](https://bun.com/docs/install/isolated#directory-structure) [Resolution algorithm](https://bun.com/docs/install/isolated#resolution-algorithm) [Workspace handling](https://bun.com/docs/install/isolated#workspace-handling) [Comparison with hoisted installs](https://bun.com/docs/install/isolated#comparison-with-hoisted-installs) [Advanced features](https://bun.com/docs/install/isolated#advanced-features) [Peer dependency handling](https://bun.com/docs/install/isolated#peer-dependency-handling) [Backend strategies](https://bun.com/docs/install/isolated#backend-strategies) [Debugging isolated installs](https://bun.com/docs/install/isolated#debugging-isolated-installs) [Troubleshooting](https://bun.com/docs/install/isolated#troubleshooting) [Compatibility issues](https://bun.com/docs/install/isolated#compatibility-issues) [Performance considerations](https://bun.com/docs/install/isolated#performance-considerations) [Migration guide](https://bun.com/docs/install/isolated#migration-guide) [From npm/Yarn](https://bun.com/docs/install/isolated#from-npm-yarn) [From pnpm](https://bun.com/docs/install/isolated#from-pnpm) [When to use isolated installs](https://bun.com/docs/install/isolated#when-to-use-isolated-installs) [Related documentation](https://bun.com/docs/install/isolated#related-documentation)

[Workspaces](https://bun.com/docs/install/workspaces) [Catalogs](https://bun.com/docs/install/catalogs) [Lifecycle scripts](https://bun.com/docs/install/lifecycle) [Filter](https://bun.com/docs/cli/filter) [Lockfile](https://bun.com/docs/install/lockfile) [Scopes and registries](https://bun.com/docs/install/registries) [Overrides and resolutions](https://bun.com/docs/install/overrides) [Patch dependencies](https://bun.com/docs/install/patch) [Audit dependencies](https://bun.com/docs/install/audit) [.npmrc support](https://bun.com/docs/install/npmrc) [Security Scanner API](https://bun.com/docs/install/security-scanner-api)

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

Bun provides an alternative package installation strategy called **isolated installs** that creates strict dependency isolation similar to pnpm's approach. This mode prevents phantom dependencies and ensures reproducible, deterministic builds.

## [What are isolated installs?](https://bun.com/docs/install/isolated#what-are-isolated-installs)

Isolated installs create a non-hoisted dependency structure where packages can only access their explicitly declared dependencies. This differs from the traditional "hoisted" installation strategy used by npm and Yarn, where dependencies are flattened into a shared `node_modules` directory.

### [Key benefits](https://bun.com/docs/install/isolated#key-benefits)

- **Prevents phantom dependencies** — Packages cannot accidentally import dependencies they haven't declared
- **Deterministic resolution** — Same dependency tree regardless of what else is installed
- **Better for monorepos** — Workspace isolation prevents cross-contamination between packages
- **Reproducible builds** — More predictable resolution behavior across environments

## [Using isolated installs](https://bun.com/docs/install/isolated#using-isolated-installs)

### [Command line](https://bun.com/docs/install/isolated#command-line)

Use the `--linker` flag to specify the installation strategy:

```
# Use isolated installs
```

```
bun install --linker isolated
```

```

# Use traditional hoisted installs
```

```
bun install --linker hoisted
```

### [Configuration file](https://bun.com/docs/install/isolated#configuration-file)

Set the default linker strategy in your `bunfig.toml`:

```
[install]
linker = "isolated"

```

### [Default behavior](https://bun.com/docs/install/isolated#default-behavior)

By default, Bun uses the **hoisted** installation strategy for all projects. To use isolated installs, you must explicitly specify the `--linker isolated` flag or set it in your configuration file.

## [How isolated installs work](https://bun.com/docs/install/isolated#how-isolated-installs-work)

### [Directory structure](https://bun.com/docs/install/isolated#directory-structure)

Instead of hoisting dependencies, isolated installs create a two-tier structure:

```
node_modules/
├── .bun/                          # Central package store
│   ├── package@1.0.0/             # Versioned package installations
│   │   └── node_modules/
│   │       └── package/           # Actual package files
│   ├── @scope+package@2.1.0/      # Scoped packages (+ replaces /)
│   │   └── node_modules/
│   │       └── @scope/
│   │           └── package/
│   └── ...
└── package-name -> .bun/package@1.0.0/node_modules/package  # Symlinks

```

### [Resolution algorithm](https://bun.com/docs/install/isolated#resolution-algorithm)

1. **Central store** — All packages are installed in `node_modules/.bun/package@version/` directories
2. **Symlinks** — Top-level `node_modules` contains symlinks pointing to the central store
3. **Peer resolution** — Complex peer dependencies create specialized directory names
4. **Deduplication** — Packages with identical package IDs and peer dependency sets are shared

### [Workspace handling](https://bun.com/docs/install/isolated#workspace-handling)

In monorepos, workspace dependencies are handled specially:

- **Workspace packages** — Symlinked directly to their source directories, not the store
- **Workspace dependencies** — Can access other workspace packages in the monorepo
- **External dependencies** — Installed in the isolated store with proper isolation

## [Comparison with hoisted installs](https://bun.com/docs/install/isolated#comparison-with-hoisted-installs)

| Aspect                    | Hoisted (npm/Yarn)                         | Isolated (pnpm-like)                    |
| ------------------------- | ------------------------------------------ | --------------------------------------- |
| **Dependency access**     | Packages can access any hoisted dependency | Packages only see declared dependencies |
| **Phantom dependencies**  | ❌ Possible                                | ✅ Prevented                            |
| **Disk usage**            | ✅ Lower (shared installs)                 | ✅ Similar (uses symlinks)              |
| **Determinism**           | ❌ Less deterministic                      | ✅ More deterministic                   |
| **Node.js compatibility** | ✅ Standard behavior                       | ✅ Compatible via symlinks              |
| **Best for**              | Single projects, legacy code               | Monorepos, strict dependency management |

## [Advanced features](https://bun.com/docs/install/isolated#advanced-features)

### [Peer dependency handling](https://bun.com/docs/install/isolated#peer-dependency-handling)

Isolated installs handle peer dependencies through sophisticated resolution:

```
# Package with peer dependencies creates specialized paths
node_modules/.bun/package@1.0.0_react@18.2.0/

```

The directory name encodes both the package version and its peer dependency versions, ensuring each unique combination gets its own installation.

### [Backend strategies](https://bun.com/docs/install/isolated#backend-strategies)

Bun uses different file operation strategies for performance:

- **Clonefile** (macOS) — Copy-on-write filesystem clones for maximum efficiency
- **Hardlink** (Linux/Windows) — Hardlinks to save disk space
- **Copyfile** (fallback) — Full file copies when other methods aren't available

### [Debugging isolated installs](https://bun.com/docs/install/isolated#debugging-isolated-installs)

Enable verbose logging to understand the installation process:

```
bun install --linker isolated --verbose
```

This shows:

- Store entry creation
- Symlink operations
- Peer dependency resolution
- Deduplication decisions

## [Troubleshooting](https://bun.com/docs/install/isolated#troubleshooting)

### [Compatibility issues](https://bun.com/docs/install/isolated#compatibility-issues)

Some packages may not work correctly with isolated installs due to:

- **Hardcoded paths** — Packages that assume a flat `node_modules` structure
- **Dynamic imports** — Runtime imports that don't follow Node.js resolution
- **Build tools** — Tools that scan `node_modules` directly

If you encounter issues, you can:

1. **Switch to hoisted mode** for specific projects:

```
bun install --linker hoisted
```

2. **Report compatibility issues** to help improve isolated install support

### [Performance considerations](https://bun.com/docs/install/isolated#performance-considerations)

- **Install time** — May be slightly slower due to symlink operations
- **Disk usage** — Similar to hoisted (uses symlinks, not file copies)
- **Memory usage** — Higher during install due to complex peer resolution

## [Migration guide](https://bun.com/docs/install/isolated#migration-guide)

### [From npm/Yarn](https://bun.com/docs/install/isolated#from-npm-yarn)

```
# Remove existing node_modules and lockfiles
```

```
rm -rf node_modules package-lock.json yarn.lock
```

```

# Install with isolated linker
```

```
bun install --linker isolated
```

### [From pnpm](https://bun.com/docs/install/isolated#from-pnpm)

Isolated installs are conceptually similar to pnpm, so migration should be straightforward:

```
# Remove pnpm files
```

```
rm -rf node_modules pnpm-lock.yaml
```

```

# Install with Bun's isolated linker
```

```
bun install --linker isolated
```

The main difference is that Bun uses symlinks in `node_modules` while pnpm uses a global store with symlinks.

## [When to use isolated installs](https://bun.com/docs/install/isolated#when-to-use-isolated-installs)

**Use isolated installs when:**

- Working in monorepos with multiple packages
- Strict dependency management is required
- Preventing phantom dependencies is important
- Building libraries that need deterministic dependencies

**Use hoisted installs when:**

- Working with legacy code that assumes flat `node_modules`
- Compatibility with existing build tools is required
- Working in environments where symlinks aren't well supported
- You prefer the simpler traditional npm behavior

## [Related documentation](https://bun.com/docs/install/isolated#related-documentation)

- [Package manager > Workspaces](https://bun.com/docs/install/workspaces) — Monorepo workspace management
- [Package manager > Lockfile](https://bun.com/docs/install/lockfile) — Understanding Bun's lockfile format
- [CLI > install](https://bun.com/docs/cli/install) — Complete `bun install` command reference

[Previous\\
\\
Global cache](https://bun.com/docs/install/cache) [Next\\
\\
Workspaces](https://bun.com/docs/install/workspaces)

[![GitHub logo](Base64-Image-Removed)![GitHub logo](Base64-Image-Removed)\\
\\
Edit on GitHub](https://github.com/oven-sh/bun/edit/main/docs/install/isolated.md)

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
