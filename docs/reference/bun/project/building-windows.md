---
title: Building Windows – Project | Bun Docs
url:
description: Learn how to setup a development environment for contributing to the Windows build of Bun.
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

[Roadmap](https://bun.com/docs/project/roadmap) [Benchmarking](https://bun.com/docs/project/benchmarking) [Contributing](https://bun.com/docs/project/contributing) [Building Windows](https://bun.com/docs/project/building-windows)

[Prerequisites](https://bun.com/docs/project/building-windows#prerequisites) [Enable Scripts](https://bun.com/docs/project/building-windows#enable-scripts) [System Dependencies](https://bun.com/docs/project/building-windows#system-dependencies) [Building](https://bun.com/docs/project/building-windows#building) [Extra paths](https://bun.com/docs/project/building-windows#extra-paths) [Tests](https://bun.com/docs/project/building-windows#tests) [Troubleshooting](https://bun.com/docs/project/building-windows#troubleshooting) [.rc file fails to build](https://bun.com/docs/project/building-windows#rc-file-fails-to-build) [failed to write output 'bun-debug.exe': permission denied](https://bun.com/docs/project/building-windows#failed-to-write-output-bun-debug-exe-permission-denied)

[Bindgen](https://bun.com/docs/project/bindgen) [License](https://bun.com/docs/project/licensing)

This document describes the build process for Windows. If you run into problems, please join the [#contributing channel on our Discord](http://bun.com/discord) for help.

It is strongly recommended to use [PowerShell 7 ( `pwsh.exe`)](https://learn.microsoft.com/en-us/powershell/scripting/install/installing-powershell-on-windows?view=powershell-7.4) instead of the default `powershell.exe`.

## [Prerequisites](https://bun.com/docs/project/building-windows#prerequisites)

### [Enable Scripts](https://bun.com/docs/project/building-windows#enable-scripts)

By default, running unverified scripts are blocked.

```
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy Unrestricted
```

### [System Dependencies](https://bun.com/docs/project/building-windows#system-dependencies)

Bun v1.1 or later. We use Bun to run it's own code generators.

```
irm bun.com/install.ps1 | iex
```

[Visual Studio](https://visualstudio.microsoft.com/) with the "Desktop Development with C++" workload. While installing, make sure to install Git as well, if Git for Windows is not already installed.

Visual Studio can be installed graphically using the wizard or through WinGet:

```
winget install "Visual Studio Community 2022" --override "--add Microsoft.VisualStudio.Workload.NativeDesktop Microsoft.VisualStudio.Component.Git " -s msstore
```

After Visual Studio, you need the following:

- LLVM 19.1.7
- Go
- Rust
- NASM
- Perl
- Ruby
- Node.js
- Ccache

**Note** – The Zig compiler is automatically downloaded, installed, and updated by the building process.

[Scoop](https://scoop.sh/) can be used to install these remaining tools easily.

Scoop

Scoop

```
irm https://get.scoop.sh | iex
```

```
scoop install nodejs-lts go rust nasm ruby perl ccache
```

```
# scoop seems to be buggy if you install llvm and the rest at the same time
```

```
scoop install llvm@19.1.7
```

Please do not use WinGet/other package manager for these, as you will likely install Strawberry Perl instead of a more minimal installation of Perl. Strawberry Perl includes many other utilities that get installed into `$Env:PATH` that will conflict with MSVC and break the build.

If you intend on building WebKit locally (optional), you should install these packages:

Scoop

```
scoop install make cygwin python
```

From here on out, it is **expected you use a PowerShell Terminal with `.\scripts\vs-shell.ps1` sourced**. This script is available in the Bun repository and can be loaded by executing it:

```
.\scripts\vs-shell.ps1
```

To verify, you can check for an MSVC-only command line such as `mt.exe`

```
Get-Command mt
```

It is not recommended to install `ninja` / `cmake` into your global path, because you may run into a situation where you try to build bun without .\\scripts\\vs-shell.ps1 sourced.

## [Building](https://bun.com/docs/project/building-windows#building)

```
bun run build
```

```

# after the initial `bun run build` you can use the following to build
```

```
ninja -Cbuild/debug
```

If this was successful, you should have a `bun-debug.exe` in the `build/debug` folder.

```
.\build\debug\bun-debug.exe --revision
```

You should add this to `$Env:PATH`. The simplest way to do so is to open the start menu, type "Path", and then navigate the environment variables menu to add `C:\.....\bun\build\debug` to the user environment variable `PATH`. You should then restart your editor (if it does not update still, log out and log back in).

## [Extra paths](https://bun.com/docs/project/building-windows#extra-paths)

- WebKit is extracted to `build/debug/cache/webkit/`
- Zig is extracted to `build/debug/cache/zig/bin/zig.exe`

## [Tests](https://bun.com/docs/project/building-windows#tests)

You can run the test suite either using `bun test <path>` or by using the wrapper script `bun node:test <path>`. The `bun node:test` command runs every test file in a separate instance of bun.exe, to prevent a crash in the test runner from stopping the entire suite.

```
# Setup
```

```
bun i --cwd packages\bun-internal-test
```

```

# Run the entire test suite with reporter
# the package.json script "test" uses "build/debug/bun-debug.exe" by default
```

```
bun run test
```

```

# Run an individual test file:
```

```
bun-debug test node\fs
```

```
bun-debug test "C:\bun\test\js\bun\resolve\import-meta.test.js"
```

## [Troubleshooting](https://bun.com/docs/project/building-windows#troubleshooting)

### [.rc file fails to build](https://bun.com/docs/project/building-windows#rc-file-fails-to-build)

`llvm-rc.exe` is odd. don't use it. use `rc.exe`, to do this make sure you are in a visual studio dev terminal, check `rc /?` to ensure it is `Microsoft Resource Compiler`

### [failed to write output 'bun-debug.exe': permission denied](https://bun.com/docs/project/building-windows#failed-to-write-output-bun-debug-exe-permission-denied)

you cannot overwrite `bun-debug.exe` if it is already open. you likely have a running instance, maybe in the vscode debugger?

[Previous\\
\\
Contributing](https://bun.com/docs/project/contributing) [Next\\
\\
Bindgen](https://bun.com/docs/project/bindgen)

[![GitHub logo](Base64-Image-Removed)![GitHub logo](Base64-Image-Removed)\\
\\
Edit on GitHub](https://github.com/oven-sh/bun/edit/main/docs/project/building-windows.md)

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
