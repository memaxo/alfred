---
title: Auto-install – Runtime | Bun Docs
url:
description: Never use node_modules again. Bun can optionally auto-install your dependencies on the fly.
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

[`bun run`](https://bun.com/docs/cli/run) [File types](https://bun.com/docs/runtime/loaders) [TypeScript](https://bun.com/docs/runtime/typescript) [JSX](https://bun.com/docs/runtime/jsx) [Environment variables](https://bun.com/docs/runtime/env) [Bun APIs](https://bun.com/docs/runtime/bun-apis) [Web APIs](https://bun.com/docs/runtime/web-apis) [Node.js compatibility](https://bun.com/docs/runtime/nodejs-apis) [Single-file executable](https://bun.com/docs/bundler/executables) [Plugins](https://bun.com/docs/runtime/plugins) [Watch mode](https://bun.com/docs/runtime/hot) [Module resolution](https://bun.com/docs/runtime/modules) [Auto-install](https://bun.com/docs/runtime/autoimport)

[Version resolution](https://bun.com/docs/runtime/autoimport#version-resolution) [Cache behavior](https://bun.com/docs/runtime/autoimport#cache-behavior) [Installation](https://bun.com/docs/runtime/autoimport#installation) [Version specifiers](https://bun.com/docs/runtime/autoimport#version-specifiers) [Benefits](https://bun.com/docs/runtime/autoimport#benefits) [Limitations](https://bun.com/docs/runtime/autoimport#limitations) [FAQ](https://bun.com/docs/runtime/autoimport#faq)

[bunfig.toml](https://bun.com/docs/runtime/bunfig) [Debugger](https://bun.com/docs/runtime/debugger)

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

If no `node_modules` directory is found in the working directory or higher, Bun will abandon Node.js-style module resolution in favor of the **Bun module resolution algorithm**.

Under Bun-style module resolution, all imported packages are auto-installed on the fly into a [global module cache](https://bun.com/docs/install/cache) during execution (the same cache used by [`bun install`](https://bun.com/docs/cli/install)).

```
import { foo } from "foo"; // install `latest` version

foo();

```

The first time you run this script, Bun will auto-install `"foo"` and cache it. The next time you run the script, it will use the cached version.

## [Version resolution](https://bun.com/docs/runtime/autoimport#version-resolution)

To determine which version to install, Bun follows the following algorithm:

1. Check for a `bun.lock` file in the project root. If it exists, use the version specified in the lockfile.
2. Otherwise, scan up the tree for a `package.json` that includes `"foo"` as a dependency. If found, use the specified semver version or version range.
3. Otherwise, use `latest`.

## [Cache behavior](https://bun.com/docs/runtime/autoimport#cache-behavior)

Once a version or version range has been determined, Bun will:

1. Check the module cache for a compatible version. If one exists, use it.
2. When resolving `latest`, Bun will check if `package@latest` has been downloaded and cached in the last _24 hours_. If so, use it.
3. Otherwise, download and install the appropriate version from the `npm` registry.

## [Installation](https://bun.com/docs/runtime/autoimport#installation)

Packages are installed and cached into `<cache>/<pkg>@<version>`, so multiple versions of the same package can be cached at once. Additionally, a symlink is created under `<cache>/<pkg>/<version>` to make it faster to look up all versions of a package that exist in the cache.

## [Version specifiers](https://bun.com/docs/runtime/autoimport#version-specifiers)

This entire resolution algorithm can be short-circuited by specifying a version or version range directly in your import statement.

```
import { z } from "zod@3.0.0"; // specific version
import { z } from "zod@next"; // npm tag
import { z } from "zod@^3.20.0"; // semver range

```

## [Benefits](https://bun.com/docs/runtime/autoimport#benefits)

This auto-installation approach is useful for a few reasons:

- **Space efficiency** — Each version of a dependency only exists in one place on disk. This is a huge space and time savings compared to redundant per-project installations.
- **Portability** — To share simple scripts and gists, your source file is _self-contained_. No need to `zip` together a directory containing your code and config files. With version specifiers in `import` statements, even a `package.json` isn't necessary.
- **Convenience** — There's no need to run `npm install` or `bun install` before running a file or script. Just `bun run` it.
- **Backwards compatibility** — Because Bun still respects the versions specified in `package.json` if one exists, you can switch to Bun-style resolution with a single command: `rm -rf node_modules`.

## [Limitations](https://bun.com/docs/runtime/autoimport#limitations)

- No Intellisense. TypeScript auto-completion in IDEs relies on the existence of type declaration files inside `node_modules`. We are investigating various solutions to this.
- No [patch-package](https://github.com/ds300/patch-package) support

## [FAQ](https://bun.com/docs/runtime/autoimport#faq)

How is this different from what bun does?

With bun, you have to run `bun install`, which creates a `node_modules` folder of symlinks for the runtime to resolve. By contrast, Bun resolves dependencies on the fly when you run a file; there's no need to run any `install` command ahead of time. Bun also doesn't create a `node_modules` folder.

How is this different from Yarn Plug'N'Play does?

With Yarn, you must run `yarn install` before you run a script. By contrast, Bun resolves dependencies on the fly when you run a file; there's no need to run any `install` command ahead of time.

Yarn Plug'N'Play also uses zip files to store dependencies. This makes dependency loading [slower at runtime](https://twitter.com/jarredsumner/status/1458207919636287490), as random access reads on zip files tend to be slower than the equivalent disk lookup.

How is this different from what Deno does?

Deno requires an `npm:` specifier before each npm `import`, lacks support for import maps via `compilerOptions.paths` in `tsconfig.json`, and has incomplete support for `package.json` settings. Unlike Deno, Bun does not currently support URL imports.

[Previous\\
\\
Module resolution](https://bun.com/docs/runtime/modules) [Next\\
\\
bunfig.toml](https://bun.com/docs/runtime/bunfig)

[![GitHub logo](Base64-Image-Removed)![GitHub logo](Base64-Image-Removed)\\
\\
Edit on GitHub](https://github.com/oven-sh/bun/edit/main/docs/runtime/autoimport.md)

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
