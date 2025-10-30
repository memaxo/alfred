---
title: Installation | Bun Docs
url: 
description: Install Bun with npm, Homebrew, Docker, or the official install script.
language: en
---
Search`` `K`

Ask AI

![ai chat avatar](https://bun.com/logo_avatar.svg)

Intro

[What is Bun?](https://bun.com/docs/index) [Installation](https://bun.com/docs/installation)

[Installing](https://bun.com/docs/installation#installing) [macOS and Linux](https://bun.com/docs/installation#macos-and-linux) [Windows](https://bun.com/docs/installation#windows) [Docker](https://bun.com/docs/installation#docker) [Checking installation](https://bun.com/docs/installation#checking-installation) [How to add your `PATH`](https://bun.com/docs/installation#how-to-add-your-path) [Upgrading](https://bun.com/docs/installation#upgrading) [Canary builds](https://bun.com/docs/installation#canary-builds) [Installing older versions of Bun](https://bun.com/docs/installation#installing-older-versions-of-bun) [Installing a specific version of Bun on Linux/Mac](https://bun.com/docs/installation#installing-a-specific-version-of-bun-on-linux-mac) [Installing a specific version of Bun on Windows](https://bun.com/docs/installation#installing-a-specific-version-of-bun-on-windows) [Downloading Bun binaries directly](https://bun.com/docs/installation#downloading-bun-binaries-directly) [CPU requirements and `baseline` builds](https://bun.com/docs/installation#cpu-requirements-and-baseline-builds) [Uninstall](https://bun.com/docs/installation#uninstall)

[Quickstart](https://bun.com/docs/quickstart) [TypeScript](https://bun.com/docs/typescript)

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

Bun ships as a single executable with no dependencies that can be installed a few different ways.

## [Installing](https://bun.com/docs/installation\#installing)

### [macOS and Linux](https://bun.com/docs/installation\#macos-and-linux)

**Linux users** — The `unzip` package is required to install Bun. Use `sudo apt install unzip` to install `unzip` package.Kernel version 5.6 or higher is strongly recommended, but the minimum is 5.1. Use `uname -r` to check Kernel version.

macOS/Linux (curl)

npm

Homebrew

Docker

macOS/Linux (curl)

```
curl -fsSL https://bun.com/install | bash # for macOS, Linux, and WSL
```

```
# to install a specific version
```

```
curl -fsSL https://bun.com/install | bash -s "bun-v1.2.22"
```

npm

```
npm install -g bun # the last `npm` command you'll ever need
```

Homebrew

```
brew install oven-sh/bun/bun # for macOS and Linux
```

Docker

```
docker pull oven/bun
```

```
docker run --rm --init --ulimit memlock=-1:-1 oven/bun
```

### [Windows](https://bun.com/docs/installation\#windows)

To install, paste this into a terminal:

PowerShell/cmd.exe

npm

Scoop

PowerShell/cmd.exe

```
powershell -c "irm bun.sh/install.ps1|iex"
```

npm

```
npm install -g bun # the last `npm` command you'll ever need
```

Scoop

```
scoop install bun
```

Bun requires a minimum of Windows 10 version 1809

For support and discussion, please join the [#windows channel on our Discord](http://bun.com/discord).

## [Docker](https://bun.com/docs/installation\#docker)

Bun provides a [Docker image](https://hub.docker.com/r/oven/bun/tags) that supports both Linux x64 and arm64.

```
docker pull oven/bun
```

```
docker run --rm --init --ulimit memlock=-1:-1 oven/bun
```

There are also image variants for different operating systems.

```
docker pull oven/bun:debian
```

```
docker pull oven/bun:slim
```

```
docker pull oven/bun:distroless
```

```
docker pull oven/bun:alpine
```

## [Checking installation](https://bun.com/docs/installation\#checking-installation)

To check that Bun was installed successfully, open a new terminal window and run `bun --version`.

```
bun --version
```

```
1.x.y
```

To see the precise commit of [oven-sh/bun](https://github.com/oven-sh/bun) that you're using, run `bun --revision`.

```
bun --revision
```

```
1.x.y+b7982ac13189
```

If you've installed Bun but are seeing a `command not found` error, you may have to manually add the installation directory ( `~/.bun/bin`) to your `PATH`.

### [How to add your `PATH`](https://bun.com/docs/installation\#how-to-add-your-path)

Linux / Mac

First, determine what shell you're using:

```
echo $SHELL
```

```
/bin/zsh # or /bin/bash or /bin/fish
```

Then add these lines below to bottom of your shell's configuration file.

~/.zshrc

~/.bashrc

~/.config/fish/config.fish

~/.zshrc

```
# add to ~/.zshrc
export BUN_INSTALL="$HOME/.bun"
export PATH="$BUN_INSTALL/bin:$PATH"

```

~/.bashrc

```
# add to ~/.bashrc
export BUN_INSTALL="$HOME/.bun"
export PATH="$BUN_INSTALL/bin:$PATH"

```

~/.config/fish/config.fish

```
# add to ~/.config/fish/config.fish
export BUN_INSTALL="$HOME/.bun"
export PATH="$BUN_INSTALL/bin:$PATH"

```

Save the file. You'll need to open a new shell/terminal window for the changes to take effect.

Windows

First, determine if the bun binary is properly installed on your system:

```
& "$env:USERPROFILE\.bun\bin\bun" --version

```

If the command runs successfully but `bun --version` is not recognized, it means that bun is not in your system's `PATH`. To fix this, open a Powershell terminal and run the following command:

```
[System.Environment]::SetEnvironmentVariable(
    "Path",
    [System.Environment]::GetEnvironmentVariable("Path", "User") + ";$env:USERPROFILE\.bun\bin",
    [System.EnvironmentVariableTarget]::User
)

```

After running the command, restart your terminal and test with `bun --version`

## [Upgrading](https://bun.com/docs/installation\#upgrading)

Once installed, the binary can upgrade itself.

```
bun upgrade
```

**Homebrew users** — To avoid conflicts with Homebrew, use `brew upgrade bun` instead.

**Scoop users** — To avoid conflicts with Scoop, use `scoop update bun` instead.

## [Canary builds](https://bun.com/docs/installation\#canary-builds)

Bun automatically releases an (untested) canary build on every commit to `main`. To upgrade to the latest canary build:

```
bun upgrade --canary
```

The canary build is useful for testing new features and bug fixes before they're released in a stable build. To help the Bun team fix bugs faster, canary builds automatically upload crash reports to Bun's team.

[View canary build](https://github.com/oven-sh/bun/releases/tag/canary)

**Note** — To switch back to a stable release from canary, run `bun upgrade --stable`.

## [Installing older versions of Bun](https://bun.com/docs/installation\#installing-older-versions-of-bun)

Since Bun is a single binary, you can install older versions of Bun by re-running the installer script with a specific version.

### [Installing a specific version of Bun on Linux/Mac](https://bun.com/docs/installation\#installing-a-specific-version-of-bun-on-linux-mac)

To install a specific version of Bun, you can pass the git tag of the version you want to install to the install script, such as `bun-v1.2.0` or `bun-v1.2.22`.

```
curl -fsSL https://bun.com/install | bash -s "bun-v1.2.22"
```

### [Installing a specific version of Bun on Windows](https://bun.com/docs/installation\#installing-a-specific-version-of-bun-on-windows)

On Windows, you can install a specific version of Bun by passing the version number to the Powershell install script.

```
# PowerShell:
```

```
iex "& {$(irm https://bun.com/install.ps1)} -Version 1.2.22"
```

## [Downloading Bun binaries directly](https://bun.com/docs/installation\#downloading-bun-binaries-directly)

To download Bun binaries directly, you can visit the [releases page](https://github.com/oven-sh/bun/releases) on GitHub.

For convenience, here are download links for the latest version:

- [`bun-linux-x64.zip`](https://github.com/oven-sh/bun/releases/latest/download/bun-linux-x64.zip)
- [`bun-linux-x64-baseline.zip`](https://github.com/oven-sh/bun/releases/latest/download/bun-linux-x64-baseline.zip)
- [`bun-linux-x64-musl.zip`](https://github.com/oven-sh/bun/releases/latest/download/bun-linux-x64-musl.zip)
- [`bun-linux-x64-musl-baseline.zip`](https://github.com/oven-sh/bun/releases/latest/download/bun-linux-x64-musl-baseline.zip)
- [`bun-windows-x64.zip`](https://github.com/oven-sh/bun/releases/latest/download/bun-windows-x64.zip)
- [`bun-windows-x64-baseline.zip`](https://github.com/oven-sh/bun/releases/latest/download/bun-windows-x64-baseline.zip)
- [`bun-darwin-aarch64.zip`](https://github.com/oven-sh/bun/releases/latest/download/bun-darwin-aarch64.zip)
- [`bun-linux-aarch64.zip`](https://github.com/oven-sh/bun/releases/latest/download/bun-linux-aarch64.zip)
- [`bun-linux-aarch64-musl.zip`](https://github.com/oven-sh/bun/releases/latest/download/bun-linux-aarch64-musl.zip)
- [`bun-darwin-x64.zip`](https://github.com/oven-sh/bun/releases/latest/download/bun-darwin-x64.zip)

The `musl` binaries are built for distributions that do not ship with the glibc libraries by default, instead relying on musl. The two most popular distros are Void Linux and Alpine Linux, with the latter is used heavily in Docker containers. If you encounter an error like the following: `bun: /lib/x86_64-linux-gnu/libm.so.6: version GLIBC_2.29' not found (required by bun)`, try using the musl binary. Bun's install script automatically chooses the correct binary for your system.

### [CPU requirements and `baseline` builds](https://bun.com/docs/installation\#cpu-requirements-and-baseline-builds)

Bun's `x64` binaries target the Haswell CPU architecture, which means they require AVX and AVX2 instructions. For Linux and Windows, the `x64-baseline` binaries are also available which target the Nehalem architecture. If you run into an "Illegal Instruction" error when running Bun, try using the `baseline` binaries instead. Bun's install script automatically chooses the correct binary for your system which helps avoid this issue. Baseline builds are slower than regular builds, so use them only if necessary.

| Build | Intel requirement | AMD requirement |
| --- | --- | --- |
| x64 | Haswell (4th generation Core) or newer, except some low-end models | Excavator or newer |
| x64-baseline | Nehalem (1st generation Core) or newer | Bulldozer or newer |

Bun does not currently support any CPUs older than the `baseline` target, which mandates the SSE4.2 extension.

Bun also publishes `darwin-x64-baseline` binaries, but these are just a copy of the `darwin-x64` ones so they still have the same CPU requirement. We only maintain these since some tools expect them to exist. Bun requires macOS 13.0 or later, which does not support any CPUs that don't meet our requirement.

## [Uninstall](https://bun.com/docs/installation\#uninstall)

If you need to remove Bun from your system, use the following commands.

macOS/Linux (curl)

Windows

Scoop

npm

Homebrew

macOS/Linux (curl)

```
rm -rf ~/.bun # for macOS, Linux, and WSL
```

Windows

```
powershell -c ~\.bun\uninstall.ps1
```

Scoop

```
scoop uninstall bun
```

npm

```
npm uninstall -g bun
```

Homebrew

```
brew uninstall bun
```

[Previous\\
\\
What is Bun?](https://bun.com/docs/index) [Next\\
\\
Quickstart](https://bun.com/docs/quickstart)

[![GitHub logo](<Base64-Image-Removed>)![GitHub logo](<Base64-Image-Removed>)\\
\\
Edit on GitHub](https://github.com/oven-sh/bun/edit/main/docs/installation.md)

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