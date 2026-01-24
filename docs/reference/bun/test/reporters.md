---
title: Test reporters – Test runner | Bun Docs
url:
description: Add a junit reporter to your test runs
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

[`bun test`](https://bun.com/docs/cli/test) [Writing tests](https://bun.com/docs/test/writing) [Watch mode](https://bun.com/docs/test/hot) [Lifecycle hooks](https://bun.com/docs/test/lifecycle) [Mocks](https://bun.com/docs/test/mocks) [Snapshots](https://bun.com/docs/test/snapshots) [Dates and times](https://bun.com/docs/test/time) [Code coverage](https://bun.com/docs/test/coverage) [Test reporters](https://bun.com/docs/test/reporters)

[Built-in Reporters](https://bun.com/docs/test/reporters#built-in-reporters) [Default Console Reporter](https://bun.com/docs/test/reporters#default-console-reporter) [JUnit XML Reporter](https://bun.com/docs/test/reporters#junit-xml-reporter) [GitHub Actions reporter](https://bun.com/docs/test/reporters#github-actions-reporter) [Custom Reporters](https://bun.com/docs/test/reporters#custom-reporters) [Inspector Protocol for Testing](https://bun.com/docs/test/reporters#inspector-protocol-for-testing) [Key Events](https://bun.com/docs/test/reporters#key-events)

[Test configuration](https://bun.com/docs/test/configuration) [Runtime behavior](https://bun.com/docs/test/runtime-behavior) [Finding tests](https://bun.com/docs/test/discovery) [DOM testing](https://bun.com/docs/test/dom)

Package runner

[`bunx`](https://bun.com/docs/cli/bunx)

API

[HTTP server](https://bun.com/docs/api/http) [HTTP client](https://bun.com/docs/api/fetch) [WebSockets](https://bun.com/docs/api/websockets) [Workers](https://bun.com/docs/api/workers) [Binary data](https://bun.com/docs/api/binary-data) [Streams](https://bun.com/docs/api/streams) [SQL](https://bun.com/docs/api/sql) [S3 Object Storage](https://bun.com/docs/api/s3) [File I/O](https://bun.com/docs/api/file-io) [Redis client](https://bun.com/docs/api/redis) [import.meta](https://bun.com/docs/api/import-meta) [SQLite](https://bun.com/docs/api/sqlite) [FileSystemRouter](https://bun.com/docs/api/file-system-router) [TCP sockets](https://bun.com/docs/api/tcp) [UDP sockets](https://bun.com/docs/api/udp) [Globals](https://bun.com/docs/api/globals) [$ Shell](https://bun.com/docs/runtime/shell) [Child processes](https://bun.com/docs/api/spawn) [YAML](https://bun.com/docs/api/yaml) [HTMLRewriter](https://bun.com/docs/api/html-rewriter) [Hashing](https://bun.com/docs/api/hashing) [Console](https://bun.com/docs/api/console) [Cookie](https://bun.com/docs/api/cookie) [FFI](https://bun.com/docs/api/ffi) [C Compiler](https://bun.com/docs/api/cc) [Secrets](https://bun.com/docs/api/secrets) [Testing](https://bun.com/docs/cli/test) [Utils](https://bun.com/docs/api/utils) [Node-API](https://bun.com/docs/api/node-api) [Glob](https://bun.com/docs/api/glob) [DNS](https://bun.com/docs/api/dns) [Semver](https://bun.com/docs/api/semver) [Color](https://bun.com/docs/api/color) [Transpiler](https://bun.com/docs/api/transpiler)

Project

[Roadmap](https://bun.com/docs/project/roadmap) [Benchmarking](https://bun.com/docs/project/benchmarking) [Contributing](https://bun.com/docs/project/contributing) [Building Windows](https://bun.com/docs/project/building-windows) [Bindgen](https://bun.com/docs/project/bindgen) [License](https://bun.com/docs/project/licensing)

bun test supports different output formats through reporters. This document covers both built-in reporters and how to implement your own custom reporters.

## [Built-in Reporters](https://bun.com/docs/test/reporters#built-in-reporters)

### [Default Console Reporter](https://bun.com/docs/test/reporters#default-console-reporter)

By default, bun test outputs results to the console in a human-readable format:

```
test/package-json-lint.test.ts:
✓ test/package.json [0.88ms]
✓ test/js/third_party/grpc-js/package.json [0.18ms]
✓ test/js/third_party/svelte/package.json [0.21ms]
✓ test/js/third_party/express/package.json [1.05ms]

 4 pass
 0 fail
 4 expect() calls
Ran 4 tests in 1.44ms

```

When a terminal doesn't support colors, the output avoids non-ascii characters:

```
test/package-json-lint.test.ts:
(pass) test/package.json [0.48ms]
(pass) test/js/third_party/grpc-js/package.json [0.10ms]
(pass) test/js/third_party/svelte/package.json [0.04ms]
(pass) test/js/third_party/express/package.json [0.04ms]

 4 pass
 0 fail
 4 expect() calls
Ran 4 tests across 1 files. [0.66ms]

```

### [JUnit XML Reporter](https://bun.com/docs/test/reporters#junit-xml-reporter)

For CI/CD environments, Bun supports generating JUnit XML reports. JUnit XML is a widely-adopted format for test results that can be parsed by many CI/CD systems, including GitLab, Jenkins, and others.

#### Using the JUnit Reporter

To generate a JUnit XML report, use the `--reporter=junit` flag along with `--reporter-outfile` to specify the output file:

```
bun test --reporter=junit --reporter-outfile=./junit.xml
```

This continues to output to the console as usual while also writing the JUnit XML report to the specified path at the end of the test run.

#### Configuring via bunfig.toml

You can also configure the JUnit reporter in your `bunfig.toml` file:

```
[test.reporter]
junit = "path/to/junit.xml"  # Output path for JUnit XML report

```

#### Environment Variables in JUnit Reports

The JUnit reporter automatically includes environment information as `<properties>` in the XML output. This can be helpful for tracking test runs in CI environments.

Specifically, it includes the following environment variables when available:

| Environment Variable                                                    | Property Name | Description            |
| ----------------------------------------------------------------------- | ------------- | ---------------------- |
| `GITHUB_RUN_ID`, `GITHUB_SERVER_URL`, `GITHUB_REPOSITORY`, `CI_JOB_URL` | `ci`          | CI build information   |
| `GITHUB_SHA`, `CI_COMMIT_SHA`, `GIT_SHA`                                | `commit`      | Git commit identifiers |
| System hostname                                                         | `hostname`    | Machine hostname       |

This makes it easier to track which environment and commit a particular test run was for.

#### Current Limitations

The JUnit reporter currently has a few limitations that will be addressed in future updates:

- `stdout` and `stderr` output from individual tests are not included in the report
- Precise timestamp fields per test case are not included

### [GitHub Actions reporter](https://bun.com/docs/test/reporters#github-actions-reporter)

Bun test automatically detects when it's running inside GitHub Actions and emits GitHub Actions annotations to the console directly. No special configuration is needed beyond installing Bun and running `bun test`.

For a GitHub Actions workflow configuration example, see the [CI/CD integration](https://bun.com/docs/cli/test.md#cicd-integration) section of the CLI documentation.

## [Custom Reporters](https://bun.com/docs/test/reporters#custom-reporters)

Bun allows developers to implement custom test reporters by extending the WebKit Inspector Protocol with additional testing-specific domains.

### [Inspector Protocol for Testing](https://bun.com/docs/test/reporters#inspector-protocol-for-testing)

To support test reporting, Bun extends the standard WebKit Inspector Protocol with two custom domains:

1. **TestReporter**: Reports test discovery, execution start, and completion events
2. **LifecycleReporter**: Reports errors and exceptions during test execution

These extensions allow you to build custom reporting tools that can receive detailed information about test execution in real-time.

### [Key Events](https://bun.com/docs/test/reporters#key-events)

Custom reporters can listen for these key events:

- `TestReporter.found`: Emitted when a test is discovered
- `TestReporter.start`: Emitted when a test starts running
- `TestReporter.end`: Emitted when a test completes
- `Console.messageAdded`: Emitted when console output occurs during a test
- `LifecycleReporter.error`: Emitted when an error or exception occurs

[Previous\\
\\
Code coverage](https://bun.com/docs/test/coverage) [Next\\
\\
Test configuration](https://bun.com/docs/test/configuration)

[![GitHub logo](Base64-Image-Removed)![GitHub logo](Base64-Image-Removed)\\
\\
Edit on GitHub](https://github.com/oven-sh/bun/edit/main/docs/test/reporters.md)

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
