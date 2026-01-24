---
title: Test configuration – Test runner | Bun Docs
url:
description: Configure the test runner with bunfig.toml
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

[`bun test`](https://bun.com/docs/cli/test) [Writing tests](https://bun.com/docs/test/writing) [Watch mode](https://bun.com/docs/test/hot) [Lifecycle hooks](https://bun.com/docs/test/lifecycle) [Mocks](https://bun.com/docs/test/mocks) [Snapshots](https://bun.com/docs/test/snapshots) [Dates and times](https://bun.com/docs/test/time) [Code coverage](https://bun.com/docs/test/coverage) [Test reporters](https://bun.com/docs/test/reporters) [Test configuration](https://bun.com/docs/test/configuration)

[bunfig.toml options](https://bun.com/docs/test/configuration#bunfig-toml-options) [Test discovery](https://bun.com/docs/test/configuration#test-discovery) [Reporters](https://bun.com/docs/test/configuration#reporters) [Memory usage](https://bun.com/docs/test/configuration#memory-usage) [Coverage options](https://bun.com/docs/test/configuration#coverage-options) [Install settings inheritance](https://bun.com/docs/test/configuration#install-settings-inheritance)

[Runtime behavior](https://bun.com/docs/test/runtime-behavior) [Finding tests](https://bun.com/docs/test/discovery) [DOM testing](https://bun.com/docs/test/dom)

Package runner

[`bunx`](https://bun.com/docs/cli/bunx)

API

[HTTP server](https://bun.com/docs/api/http) [HTTP client](https://bun.com/docs/api/fetch) [WebSockets](https://bun.com/docs/api/websockets) [Workers](https://bun.com/docs/api/workers) [Binary data](https://bun.com/docs/api/binary-data) [Streams](https://bun.com/docs/api/streams) [SQL](https://bun.com/docs/api/sql) [S3 Object Storage](https://bun.com/docs/api/s3) [File I/O](https://bun.com/docs/api/file-io) [Redis client](https://bun.com/docs/api/redis) [import.meta](https://bun.com/docs/api/import-meta) [SQLite](https://bun.com/docs/api/sqlite) [FileSystemRouter](https://bun.com/docs/api/file-system-router) [TCP sockets](https://bun.com/docs/api/tcp) [UDP sockets](https://bun.com/docs/api/udp) [Globals](https://bun.com/docs/api/globals) [$ Shell](https://bun.com/docs/runtime/shell) [Child processes](https://bun.com/docs/api/spawn) [YAML](https://bun.com/docs/api/yaml) [HTMLRewriter](https://bun.com/docs/api/html-rewriter) [Hashing](https://bun.com/docs/api/hashing) [Console](https://bun.com/docs/api/console) [Cookie](https://bun.com/docs/api/cookie) [FFI](https://bun.com/docs/api/ffi) [C Compiler](https://bun.com/docs/api/cc) [Secrets](https://bun.com/docs/api/secrets) [Testing](https://bun.com/docs/cli/test) [Utils](https://bun.com/docs/api/utils) [Node-API](https://bun.com/docs/api/node-api) [Glob](https://bun.com/docs/api/glob) [DNS](https://bun.com/docs/api/dns) [Semver](https://bun.com/docs/api/semver) [Color](https://bun.com/docs/api/color) [Transpiler](https://bun.com/docs/api/transpiler)

Project

[Roadmap](https://bun.com/docs/project/roadmap) [Benchmarking](https://bun.com/docs/project/benchmarking) [Contributing](https://bun.com/docs/project/contributing) [Building Windows](https://bun.com/docs/project/building-windows) [Bindgen](https://bun.com/docs/project/bindgen) [License](https://bun.com/docs/project/licensing)

Configure `bun test` via `bunfig.toml` file and command-line options. This page documents the available configuration options for `bun test`.

## [bunfig.toml options](https://bun.com/docs/test/configuration#bunfig-toml-options)

You can configure `bun test` behavior by adding a `[test]` section to your `bunfig.toml` file:

```
[test]
# Options go here

```

### [Test discovery](https://bun.com/docs/test/configuration#test-discovery)

#### root

The `root` option specifies a root directory for test discovery, overriding the default behavior of scanning from the project root.

```
[test]
root = "src"  # Only scan for tests in the src directory

```

### [Reporters](https://bun.com/docs/test/configuration#reporters)

#### reporter.junit

Configure the JUnit reporter output file path directly in the config file:

```
[test.reporter]
junit = "path/to/junit.xml"  # Output path for JUnit XML report

```

This complements the `--reporter=junit` and `--reporter-outfile` CLI flags.

### [Memory usage](https://bun.com/docs/test/configuration#memory-usage)

#### smol

Enable the `--smol` memory-saving mode specifically for the test runner:

```
[test]
smol = true  # Reduce memory usage during test runs

```

This is equivalent to using the `--smol` flag on the command line.

### [Coverage options](https://bun.com/docs/test/configuration#coverage-options)

In addition to the options documented in the [coverage documentation](https://bun.com/docs/test/coverage.md), the following options are available:

#### coverageSkipTestFiles

Exclude files matching test patterns (e.g., \*.test.ts) from the coverage report:

```
[test]
coverageSkipTestFiles = true  # Exclude test files from coverage reports

```

#### coverageThreshold (Object form)

The coverage threshold can be specified either as a number (as shown in the coverage documentation) or as an object with specific thresholds:

```
[test]
# Set specific thresholds for different coverage metrics
coverageThreshold = { lines = 0.9, functions = 0.8, statements = 0.85 }

```

Setting any of these enables `fail_on_low_coverage`, causing the test run to fail if coverage is below the threshold.

#### coveragePathIgnorePatterns

Exclude specific files or file patterns from coverage reports using glob patterns:

```
[test]
# Single pattern
coveragePathIgnorePatterns = "**/*.spec.ts"

# Multiple patterns
coveragePathIgnorePatterns = [\
  "**/*.spec.ts",\
  "**/*.test.ts",\
  "src/utils/**",\
  "*.config.js"\
]

```

Files matching any of these patterns will be excluded from coverage calculation and reporting. See the [coverage documentation](https://bun.com/docs/test/coverage.md) for more details and examples.

#### coverageIgnoreSourcemaps

Internally, Bun transpiles every file. That means code coverage must also go through sourcemaps before they can be reported. We expose this as a flag to allow you to opt out of this behavior, but it will be confusing because during the transpilation process, Bun may move code around and change variable names. This option is mostly useful for debugging coverage issues.

```
[test]
coverageIgnoreSourcemaps = true  # Don't use sourcemaps for coverage analysis

```

When using this option, you probably want to stick a `// @bun` comment at the top of the source file to opt out of the transpilation process.

### [Install settings inheritance](https://bun.com/docs/test/configuration#install-settings-inheritance)

The `bun test` command inherits relevant network and installation configuration (registry, cafile, prefer, exact, etc.) from the `[install]` section of bunfig.toml. This is important if tests need to interact with private registries or require specific install behaviors triggered during the test run.

[Previous\\
\\
Test reporters](https://bun.com/docs/test/reporters) [Next\\
\\
Runtime behavior](https://bun.com/docs/test/runtime-behavior)

[![GitHub logo](Base64-Image-Removed)![GitHub logo](Base64-Image-Removed)\\
\\
Edit on GitHub](https://github.com/oven-sh/bun/edit/main/docs/test/configuration.md)

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
