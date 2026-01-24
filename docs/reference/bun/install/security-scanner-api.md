---
title: Security Scanner API – Package manager | Bun Docs
url:
description: Scan your project for vulnerabilities with Bun's security scanner API.
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

[Quick Start](https://bun.com/docs/install/security-scanner-api#quick-start) [How It Works](https://bun.com/docs/install/security-scanner-api#how-it-works) [Security Levels](https://bun.com/docs/install/security-scanner-api#security-levels) [Using Pre-built Scanners](https://bun.com/docs/install/security-scanner-api#using-pre-built-scanners) [Installing a Scanner](https://bun.com/docs/install/security-scanner-api#installing-a-scanner) [Configuring the Scanner](https://bun.com/docs/install/security-scanner-api#configuring-the-scanner) [Enterprise Configuration](https://bun.com/docs/install/security-scanner-api#enterprise-configuration) [Authoring your own scanner](https://bun.com/docs/install/security-scanner-api#authoring-your-own-scanner) [Related](https://bun.com/docs/install/security-scanner-api#related)

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

Bun's package manager can scan packages for security vulnerabilities before installation, helping protect your applications from supply chain attacks and known vulnerabilities.

## [Quick Start](https://bun.com/docs/install/security-scanner-api#quick-start)

Configure a security scanner in your `bunfig.toml`:

```
[install.security]
scanner = "@acme/bun-security-scanner"

```

When configured, Bun will:

- Scan all packages before installation
- Display security warnings and advisories
- Cancel installation if critical vulnerabilities are found
- Automatically disable auto-install for security

## [How It Works](https://bun.com/docs/install/security-scanner-api#how-it-works)

Security scanners analyze packages during `bun install`, `bun add`, and other package operations. They can detect:

- Known security vulnerabilities (CVEs)
- Malicious packages
- License compliance issues
- ...and more!

### [Security Levels](https://bun.com/docs/install/security-scanner-api#security-levels)

Scanners report issues at two severity levels:

- **`fatal`** \- Installation stops immediately, exits with non-zero code
- **`warn`** \- In interactive terminals, prompts to continue; in CI, exits immediately

## [Using Pre-built Scanners](https://bun.com/docs/install/security-scanner-api#using-pre-built-scanners)

Many security companies publish Bun security scanners as npm packages that you can install and use immediately.

### [Installing a Scanner](https://bun.com/docs/install/security-scanner-api#installing-a-scanner)

Install a security scanner from npm:

```
bun add -d @acme/bun-security-scanner
```

**Note:** Consult your security scanner's documentation for their specific package name and installation instructions. Most scanners will be installed with `bun add`.

### [Configuring the Scanner](https://bun.com/docs/install/security-scanner-api#configuring-the-scanner)

After installation, configure it in your `bunfig.toml`:

```
[install.security]
scanner = "@acme/bun-security-scanner"

```

### [Enterprise Configuration](https://bun.com/docs/install/security-scanner-api#enterprise-configuration)

Some enterprise scanners might support authentication and/or configuration through environment variables:

```
# This might go in ~/.bashrc, for example
export SECURITY_API_KEY="your-api-key"

# The scanner will now use these credentials automatically
bun install

```

Consult your security scanner's documentation to learn which environment variables to set and if any additional configuration is required.

### [Authoring your own scanner](https://bun.com/docs/install/security-scanner-api#authoring-your-own-scanner)

For a complete example with tests and CI setup, see the official template: [github.com/oven-sh/security-scanner-template](https://github.com/oven-sh/security-scanner-template)

## [Related](https://bun.com/docs/install/security-scanner-api#related)

- [Configuration (bunfig.toml)](https://bun.com/docs/runtime/bunfig#install-security-scanner)
- [Package Manager](https://bun.com/docs/install)
- [Security Scanner Template](https://github.com/oven-sh/security-scanner-template)

[Previous\\
\\
.npmrc support](https://bun.com/docs/install/npmrc) [Next\\
\\
`Bun.build`](https://bun.com/docs/bundler)

[![GitHub logo](Base64-Image-Removed)![GitHub logo](Base64-Image-Removed)\\
\\
Edit on GitHub](https://github.com/oven-sh/bun/edit/main/docs/install/security-scanner-api.md)

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
