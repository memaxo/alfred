---
title: Runtime behavior – Test runner | Bun Docs
url: 
description: Learn how the test runner affects Bun's runtime behavior
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

[`bun test`](https://bun.com/docs/cli/test) [Writing tests](https://bun.com/docs/test/writing) [Watch mode](https://bun.com/docs/test/hot) [Lifecycle hooks](https://bun.com/docs/test/lifecycle) [Mocks](https://bun.com/docs/test/mocks) [Snapshots](https://bun.com/docs/test/snapshots) [Dates and times](https://bun.com/docs/test/time) [Code coverage](https://bun.com/docs/test/coverage) [Test reporters](https://bun.com/docs/test/reporters) [Test configuration](https://bun.com/docs/test/configuration) [Runtime behavior](https://bun.com/docs/test/runtime-behavior)

[Error Handling](https://bun.com/docs/test/runtime-behavior#error-handling) [Unhandled Errors](https://bun.com/docs/test/runtime-behavior#unhandled-errors) [Using General CLI Flags with Tests](https://bun.com/docs/test/runtime-behavior#using-general-cli-flags-with-tests) [Memory Usage](https://bun.com/docs/test/runtime-behavior#memory-usage) [Debugging](https://bun.com/docs/test/runtime-behavior#debugging) [Module Loading](https://bun.com/docs/test/runtime-behavior#module-loading) [Installation-related Flags](https://bun.com/docs/test/runtime-behavior#installation-related-flags) [Watch and Hot Reloading](https://bun.com/docs/test/runtime-behavior#watch-and-hot-reloading) [Global Variables](https://bun.com/docs/test/runtime-behavior#global-variables)

[Finding tests](https://bun.com/docs/test/discovery) [DOM testing](https://bun.com/docs/test/dom)

Package runner

[`bunx`](https://bun.com/docs/cli/bunx)

API

[HTTP server](https://bun.com/docs/api/http) [HTTP client](https://bun.com/docs/api/fetch) [WebSockets](https://bun.com/docs/api/websockets) [Workers](https://bun.com/docs/api/workers) [Binary data](https://bun.com/docs/api/binary-data) [Streams](https://bun.com/docs/api/streams) [SQL](https://bun.com/docs/api/sql) [S3 Object Storage](https://bun.com/docs/api/s3) [File I/O](https://bun.com/docs/api/file-io) [Redis client](https://bun.com/docs/api/redis) [import.meta](https://bun.com/docs/api/import-meta) [SQLite](https://bun.com/docs/api/sqlite) [FileSystemRouter](https://bun.com/docs/api/file-system-router) [TCP sockets](https://bun.com/docs/api/tcp) [UDP sockets](https://bun.com/docs/api/udp) [Globals](https://bun.com/docs/api/globals) [$ Shell](https://bun.com/docs/runtime/shell) [Child processes](https://bun.com/docs/api/spawn) [YAML](https://bun.com/docs/api/yaml) [HTMLRewriter](https://bun.com/docs/api/html-rewriter) [Hashing](https://bun.com/docs/api/hashing) [Console](https://bun.com/docs/api/console) [Cookie](https://bun.com/docs/api/cookie) [FFI](https://bun.com/docs/api/ffi) [C Compiler](https://bun.com/docs/api/cc) [Secrets](https://bun.com/docs/api/secrets) [Testing](https://bun.com/docs/cli/test) [Utils](https://bun.com/docs/api/utils) [Node-API](https://bun.com/docs/api/node-api) [Glob](https://bun.com/docs/api/glob) [DNS](https://bun.com/docs/api/dns) [Semver](https://bun.com/docs/api/semver) [Color](https://bun.com/docs/api/color) [Transpiler](https://bun.com/docs/api/transpiler)

Project

[Roadmap](https://bun.com/docs/project/roadmap) [Benchmarking](https://bun.com/docs/project/benchmarking) [Contributing](https://bun.com/docs/project/contributing) [Building Windows](https://bun.com/docs/project/building-windows) [Bindgen](https://bun.com/docs/project/bindgen) [License](https://bun.com/docs/project/licensing)

`bun test` is deeply integrated with Bun's runtime. This is part of what makes `bun test` fast and simple to use.

#### `$NODE_ENV` environment variable

`bun test` automatically sets `$NODE_ENV` to `"test"` unless it's already set in the environment or via .env files. This is standard behavior for most test runners and helps ensure consistent test behavior.

```
import { test, expect } from "bun:test";

test("NODE_ENV is set to test", () => {
  expect(process.env.NODE_ENV).toBe("test");
});

```

When `NODE_ENV` is set to `"test"`, Bun will not load `.env.local` files. This ensures consistent test environments across different executions by preventing local overrides during testing. Instead, use `.env.test` for test-specific environment variables, which should be committed to your repository for consistency across all developers and CI environments.

#### `$TZ` environment variable

By default, all `bun test` runs use UTC ( `Etc/UTC`) as the time zone unless overridden by the `TZ` environment variable. This ensures consistent date and time behavior across different development environments.

#### Test Timeouts

Each test has a default timeout of 5000ms (5 seconds) if not explicitly overridden. Tests that exceed this timeout will fail. This can be changed globally with the `--timeout` flag or per-test as the third parameter to the test function.

## [Error Handling](https://bun.com/docs/test/runtime-behavior\#error-handling)

### [Unhandled Errors](https://bun.com/docs/test/runtime-behavior\#unhandled-errors)

`bun test` tracks unhandled promise rejections and errors that occur between tests. If such errors occur, the final exit code will be non-zero (specifically, the count of such errors), even if all tests pass.

This helps catch errors in asynchronous code that might otherwise go unnoticed:

```
import { test } from "bun:test";

test("test 1", () => {
  // This test passes
});

// This error happens outside any test
setTimeout(() => {
  throw new Error("Unhandled error");
}, 0);

test("test 2", () => {
  // This test also passes
});

// The test run will still fail with a non-zero exit code
// because of the unhandled error

```

Internally, this occurs with a higher precedence than `process.on("unhandledRejection")` or `process.on("uncaughtException")`, which makes it simpler to integrate with existing code.

## [Using General CLI Flags with Tests](https://bun.com/docs/test/runtime-behavior\#using-general-cli-flags-with-tests)

Several Bun CLI flags can be used with `bun test` to modify its behavior:

### [Memory Usage](https://bun.com/docs/test/runtime-behavior\#memory-usage)

- `--smol`: Reduces memory usage for the test runner VM

### [Debugging](https://bun.com/docs/test/runtime-behavior\#debugging)

- `--inspect`, `--inspect-brk`: Attaches the debugger to the test runner process

### [Module Loading](https://bun.com/docs/test/runtime-behavior\#module-loading)

- `--preload`: Runs scripts before test files (useful for global setup/mocks)
- `--define`: Sets compile-time constants
- `--loader`: Configures custom loaders
- `--tsconfig-override`: Uses a different tsconfig
- `--conditions`: Sets package.json conditions for module resolution
- `--env-file`: Loads environment variables for tests

### [Installation-related Flags](https://bun.com/docs/test/runtime-behavior\#installation-related-flags)

- `--prefer-offline`, `--frozen-lockfile`, etc.: Affect any network requests or auto-installs during test execution

## [Watch and Hot Reloading](https://bun.com/docs/test/runtime-behavior\#watch-and-hot-reloading)

When running `bun test` with the `--watch` flag, the test runner will watch for file changes and re-run affected tests.

The `--hot` flag provides similar functionality but is more aggressive about trying to preserve state between runs. For most test scenarios, `--watch` is the recommended option.

## [Global Variables](https://bun.com/docs/test/runtime-behavior\#global-variables)

The following globals are automatically available in test files without importing (though they can be imported from `bun:test` if preferred):

- `test`, `it`: Define tests
- `describe`: Group tests
- `expect`: Make assertions
- `beforeAll`, `beforeEach`, `afterAll`, `afterEach`: Lifecycle hooks
- `jest`: Jest global object
- `vi`: Vitest compatibility alias for common jest methods

[Previous\\
\\
Test configuration](https://bun.com/docs/test/configuration) [Next\\
\\
Finding tests](https://bun.com/docs/test/discovery)

[![GitHub logo](<Base64-Image-Removed>)![GitHub logo](<Base64-Image-Removed>)\\
\\
Edit on GitHub](https://github.com/oven-sh/bun/edit/main/docs/test/runtime-behavior.md)

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