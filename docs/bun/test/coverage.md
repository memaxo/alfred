---
title: Code coverage – Test runner | Bun Docs
url: 
description: Generate code coverage reports with `bun test --coverage`
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

[`bun test`](https://bun.com/docs/cli/test) [Writing tests](https://bun.com/docs/test/writing) [Watch mode](https://bun.com/docs/test/hot) [Lifecycle hooks](https://bun.com/docs/test/lifecycle) [Mocks](https://bun.com/docs/test/mocks) [Snapshots](https://bun.com/docs/test/snapshots) [Dates and times](https://bun.com/docs/test/time) [Code coverage](https://bun.com/docs/test/coverage)

[Enabling coverage](https://bun.com/docs/test/coverage#enabling-coverage) [Coverage thresholds](https://bun.com/docs/test/coverage#coverage-thresholds) [Sourcemaps](https://bun.com/docs/test/coverage#sourcemaps) [Exclude files from coverage](https://bun.com/docs/test/coverage#exclude-files-from-coverage) [Coverage defaults](https://bun.com/docs/test/coverage#coverage-defaults) [Coverage reporters](https://bun.com/docs/test/coverage#coverage-reporters)

[Test reporters](https://bun.com/docs/test/reporters) [Test configuration](https://bun.com/docs/test/configuration) [Runtime behavior](https://bun.com/docs/test/runtime-behavior) [Finding tests](https://bun.com/docs/test/discovery) [DOM testing](https://bun.com/docs/test/dom)

Package runner

[`bunx`](https://bun.com/docs/cli/bunx)

API

[HTTP server](https://bun.com/docs/api/http) [HTTP client](https://bun.com/docs/api/fetch) [WebSockets](https://bun.com/docs/api/websockets) [Workers](https://bun.com/docs/api/workers) [Binary data](https://bun.com/docs/api/binary-data) [Streams](https://bun.com/docs/api/streams) [SQL](https://bun.com/docs/api/sql) [S3 Object Storage](https://bun.com/docs/api/s3) [File I/O](https://bun.com/docs/api/file-io) [Redis client](https://bun.com/docs/api/redis) [import.meta](https://bun.com/docs/api/import-meta) [SQLite](https://bun.com/docs/api/sqlite) [FileSystemRouter](https://bun.com/docs/api/file-system-router) [TCP sockets](https://bun.com/docs/api/tcp) [UDP sockets](https://bun.com/docs/api/udp) [Globals](https://bun.com/docs/api/globals) [$ Shell](https://bun.com/docs/runtime/shell) [Child processes](https://bun.com/docs/api/spawn) [YAML](https://bun.com/docs/api/yaml) [HTMLRewriter](https://bun.com/docs/api/html-rewriter) [Hashing](https://bun.com/docs/api/hashing) [Console](https://bun.com/docs/api/console) [Cookie](https://bun.com/docs/api/cookie) [FFI](https://bun.com/docs/api/ffi) [C Compiler](https://bun.com/docs/api/cc) [Secrets](https://bun.com/docs/api/secrets) [Testing](https://bun.com/docs/cli/test) [Utils](https://bun.com/docs/api/utils) [Node-API](https://bun.com/docs/api/node-api) [Glob](https://bun.com/docs/api/glob) [DNS](https://bun.com/docs/api/dns) [Semver](https://bun.com/docs/api/semver) [Color](https://bun.com/docs/api/color) [Transpiler](https://bun.com/docs/api/transpiler)

Project

[Roadmap](https://bun.com/docs/project/roadmap) [Benchmarking](https://bun.com/docs/project/benchmarking) [Contributing](https://bun.com/docs/project/contributing) [Building Windows](https://bun.com/docs/project/building-windows) [Bindgen](https://bun.com/docs/project/bindgen) [License](https://bun.com/docs/project/licensing)

Bun's test runner now supports built-in _code coverage reporting_. This makes it easy to see how much of the codebase is covered by tests, and find areas that are not currently well-tested.

## [Enabling coverage](https://bun.com/docs/test/coverage\#enabling-coverage)

`bun:test` supports seeing which lines of code are covered by tests. To use this feature, pass `--coverage` to the CLI. It will print out a coverage report to the console:

```
$ bun test --coverage
-------------|---------|---------|-------------------
File         | % Funcs | % Lines | Uncovered Line #s
-------------|---------|---------|-------------------
All files    |   38.89 |   42.11 |
 index-0.ts  |   33.33 |   36.84 | 10-15,19-24
 index-1.ts  |   33.33 |   36.84 | 10-15,19-24
 index-10.ts |   33.33 |   36.84 | 10-15,19-24
 index-2.ts  |   33.33 |   36.84 | 10-15,19-24
 index-3.ts  |   33.33 |   36.84 | 10-15,19-24
 index-4.ts  |   33.33 |   36.84 | 10-15,19-24
 index-5.ts  |   33.33 |   36.84 | 10-15,19-24
 index-6.ts  |   33.33 |   36.84 | 10-15,19-24
 index-7.ts  |   33.33 |   36.84 | 10-15,19-24
 index-8.ts  |   33.33 |   36.84 | 10-15,19-24
 index-9.ts  |   33.33 |   36.84 | 10-15,19-24
 index.ts    |  100.00 |  100.00 |
-------------|---------|---------|-------------------

```

To always enable coverage reporting by default, add the following line to your `bunfig.toml`:

```
[test]

# always enable coverage
coverage = true

```

By default coverage reports will _include_ test files and _exclude_ sourcemaps. This is usually what you want, but it can be configured otherwise in `bunfig.toml`.

```
[test]
coverageSkipTestFiles = true       # default false

```

### [Coverage thresholds](https://bun.com/docs/test/coverage\#coverage-thresholds)

It is possible to specify a coverage threshold in `bunfig.toml`. If your test suite does not meet or exceed this threshold, `bun test` will exit with a non-zero exit code to indicate the failure.

```
[test]

# to require 90% line-level and function-level coverage
coverageThreshold = 0.9

# to set different thresholds for lines and functions
coverageThreshold = { lines = 0.9, functions = 0.9, statements = 0.9 }

```

Setting any of these thresholds enables `fail_on_low_coverage`, causing the test run to fail if coverage is below the threshold.

### [Sourcemaps](https://bun.com/docs/test/coverage\#sourcemaps)

Internally, Bun transpiles all files by default, so Bun automatically generates an internal [source map](https://web.dev/source-maps/) that maps lines of your original source code onto Bun's internal representation. If for any reason you want to disable this, set `test.coverageIgnoreSourcemaps` to `true`; this will rarely be desirable outside of advanced use cases.

```
[test]
coverageIgnoreSourcemaps = true   # default false

```

### [Exclude files from coverage](https://bun.com/docs/test/coverage\#exclude-files-from-coverage)

#### Skip test files

By default, test files themselves are included in coverage reports. You can exclude them with:

```
[test]
coverageSkipTestFiles = true   # default false

```

This will exclude files matching test patterns (e.g., \_.test.ts, \_\_spec.js) from the coverage report.

#### Ignore specific paths and patterns

You can exclude specific files or file patterns from coverage reports using `coveragePathIgnorePatterns`:

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

This option accepts glob patterns and works similarly to Jest's `collectCoverageFrom` ignore patterns. Files matching any of these patterns will be excluded from coverage calculation and reporting in both text and LCOV outputs.

Common use cases:

- Exclude utility files: `"src/utils/**"`
- Exclude configuration files: `"*.config.js"`
- Exclude specific test patterns: `"**/*.spec.ts"`
- Exclude build artifacts: `"dist/**"`

### [Coverage defaults](https://bun.com/docs/test/coverage\#coverage-defaults)

By default, coverage reports:

1. Exclude `node_modules` directories
2. Exclude files loaded via non-JS/TS loaders (e.g., .css, .txt) unless a custom JS loader is specified
3. Include test files themselves (can be disabled with `coverageSkipTestFiles = true` as shown above)
4. Can exclude additional files with `coveragePathIgnorePatterns` as shown above

### [Coverage reporters](https://bun.com/docs/test/coverage\#coverage-reporters)

By default, coverage reports will be printed to the console.

For persistent code coverage reports in CI environments and for other tools, you can pass a `--coverage-reporter=lcov` CLI option or `coverageReporter` option in `bunfig.toml`.

```
[test]
coverageReporter  = ["text", "lcov"]  # default ["text"]
coverageDir = "path/to/somewhere"  # default "coverage"

```

| Reporter | Description |
| --- | --- |
| `text` | Prints a text summary of the coverage to the console. |
| `lcov` | Save coverage in [lcov](https://github.com/linux-test-project/lcov) format. |

#### lcov coverage reporter

To generate an lcov report, you can use the `lcov` reporter. This will generate an `lcov.info` file in the `coverage` directory.

```
[test]
coverageReporter = "lcov"

```

[Previous\\
\\
Dates and times](https://bun.com/docs/test/time) [Next\\
\\
Test reporters](https://bun.com/docs/test/reporters)

[![GitHub logo](<Base64-Image-Removed>)![GitHub logo](<Base64-Image-Removed>)\\
\\
Edit on GitHub](https://github.com/oven-sh/bun/edit/main/docs/test/coverage.md)

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