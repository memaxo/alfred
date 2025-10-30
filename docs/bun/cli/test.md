---
title: Testing – API | Bun Docs
url: 
description: Bun's built-in test runner is fast and uses Jest-compatible syntax.
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

[`bun test`](https://bun.com/docs/cli/test)

[Run tests](https://bun.com/docs/cli/test#run-tests) [CI/CD integration](https://bun.com/docs/cli/test#ci-cd-integration) [GitHub Actions](https://bun.com/docs/cli/test#github-actions) [JUnit XML reports (GitLab, etc.)](https://bun.com/docs/cli/test#junit-xml-reports-gitlab-etc) [Timeouts](https://bun.com/docs/cli/test#timeouts) [Rerun tests](https://bun.com/docs/cli/test#rerun-tests) [Bail out with `--bail`](https://bun.com/docs/cli/test#bail-out-with-bail) [Watch mode](https://bun.com/docs/cli/test#watch-mode) [Lifecycle hooks](https://bun.com/docs/cli/test#lifecycle-hooks) [Mocks](https://bun.com/docs/cli/test#mocks) [Snapshot testing](https://bun.com/docs/cli/test#snapshot-testing) [UI & DOM testing](https://bun.com/docs/cli/test#ui-dom-testing) [Performance](https://bun.com/docs/cli/test#performance) [AI Agent Integration](https://bun.com/docs/cli/test#ai-agent-integration) [Environment Variables](https://bun.com/docs/cli/test#environment-variables) [Behavior](https://bun.com/docs/cli/test#behavior)

[Writing tests](https://bun.com/docs/test/writing) [Watch mode](https://bun.com/docs/test/hot) [Lifecycle hooks](https://bun.com/docs/test/lifecycle) [Mocks](https://bun.com/docs/test/mocks) [Snapshots](https://bun.com/docs/test/snapshots) [Dates and times](https://bun.com/docs/test/time) [Code coverage](https://bun.com/docs/test/coverage) [Test reporters](https://bun.com/docs/test/reporters) [Test configuration](https://bun.com/docs/test/configuration) [Runtime behavior](https://bun.com/docs/test/runtime-behavior) [Finding tests](https://bun.com/docs/test/discovery) [DOM testing](https://bun.com/docs/test/dom)

Package runner

[`bunx`](https://bun.com/docs/cli/bunx)

API

[HTTP server](https://bun.com/docs/api/http) [HTTP client](https://bun.com/docs/api/fetch) [WebSockets](https://bun.com/docs/api/websockets) [Workers](https://bun.com/docs/api/workers) [Binary data](https://bun.com/docs/api/binary-data) [Streams](https://bun.com/docs/api/streams) [SQL](https://bun.com/docs/api/sql) [S3 Object Storage](https://bun.com/docs/api/s3) [File I/O](https://bun.com/docs/api/file-io) [Redis client](https://bun.com/docs/api/redis) [import.meta](https://bun.com/docs/api/import-meta) [SQLite](https://bun.com/docs/api/sqlite) [FileSystemRouter](https://bun.com/docs/api/file-system-router) [TCP sockets](https://bun.com/docs/api/tcp) [UDP sockets](https://bun.com/docs/api/udp) [Globals](https://bun.com/docs/api/globals) [$ Shell](https://bun.com/docs/runtime/shell) [Child processes](https://bun.com/docs/api/spawn) [YAML](https://bun.com/docs/api/yaml) [HTMLRewriter](https://bun.com/docs/api/html-rewriter) [Hashing](https://bun.com/docs/api/hashing) [Console](https://bun.com/docs/api/console) [Cookie](https://bun.com/docs/api/cookie) [FFI](https://bun.com/docs/api/ffi) [C Compiler](https://bun.com/docs/api/cc) [Secrets](https://bun.com/docs/api/secrets) [Testing](https://bun.com/docs/cli/test)

[Run tests](https://bun.com/docs/cli/test#run-tests) [CI/CD integration](https://bun.com/docs/cli/test#ci-cd-integration) [GitHub Actions](https://bun.com/docs/cli/test#github-actions) [JUnit XML reports (GitLab, etc.)](https://bun.com/docs/cli/test#junit-xml-reports-gitlab-etc) [Timeouts](https://bun.com/docs/cli/test#timeouts) [Rerun tests](https://bun.com/docs/cli/test#rerun-tests) [Bail out with `--bail`](https://bun.com/docs/cli/test#bail-out-with-bail) [Watch mode](https://bun.com/docs/cli/test#watch-mode) [Lifecycle hooks](https://bun.com/docs/cli/test#lifecycle-hooks) [Mocks](https://bun.com/docs/cli/test#mocks) [Snapshot testing](https://bun.com/docs/cli/test#snapshot-testing) [UI & DOM testing](https://bun.com/docs/cli/test#ui-dom-testing) [Performance](https://bun.com/docs/cli/test#performance) [AI Agent Integration](https://bun.com/docs/cli/test#ai-agent-integration) [Environment Variables](https://bun.com/docs/cli/test#environment-variables) [Behavior](https://bun.com/docs/cli/test#behavior)

[Utils](https://bun.com/docs/api/utils) [Node-API](https://bun.com/docs/api/node-api) [Glob](https://bun.com/docs/api/glob) [DNS](https://bun.com/docs/api/dns) [Semver](https://bun.com/docs/api/semver) [Color](https://bun.com/docs/api/color) [Transpiler](https://bun.com/docs/api/transpiler)

Project

[Roadmap](https://bun.com/docs/project/roadmap) [Benchmarking](https://bun.com/docs/project/benchmarking) [Contributing](https://bun.com/docs/project/contributing) [Building Windows](https://bun.com/docs/project/building-windows) [Bindgen](https://bun.com/docs/project/bindgen) [License](https://bun.com/docs/project/licensing)

Bun ships with a fast, built-in, Jest-compatible test runner. Tests are executed with the Bun runtime, and support the following features.

- TypeScript and JSX
- Lifecycle hooks
- Snapshot testing
- UI & DOM testing
- Watch mode with `--watch`
- Script pre-loading with `--preload`

Bun aims for compatibility with Jest, but not everything is implemented. To track compatibility, see [this tracking issue](https://github.com/oven-sh/bun/issues/1825).

## [Run tests](https://bun.com/docs/cli/test\#run-tests)

```
bun test
```

Tests are written in JavaScript or TypeScript with a Jest-like API. Refer to [Writing tests](https://bun.com/docs/test/writing) for full documentation.

math.test.ts

```
import { expect, test } from "bun:test";

test("2 + 2", () => {
  expect(2 + 2).toBe(4);
});

```

The runner recursively searches the working directory for files that match the following patterns:

- `*.test.{js|jsx|ts|tsx}`
- `*_test.{js|jsx|ts|tsx}`
- `*.spec.{js|jsx|ts|tsx}`
- `*_spec.{js|jsx|ts|tsx}`

You can filter the set of _test files_ to run by passing additional positional arguments to `bun test`. Any test file with a path that matches one of the filters will run. Commonly, these filters will be file or directory names; glob patterns are not yet supported.

```
bun test <filter> <filter> ...
```

To filter by _test name_, use the `-t`/ `--test-name-pattern` flag.

```
# run all tests or test suites with "addition" in the name
```

```
bun test --test-name-pattern addition
```

To run a specific file in the test runner, make sure the path starts with `./` or `/` to distinguish it from a filter name.

```
bun test ./test/specific-file.test.ts
```

The test runner runs all tests in a single process. It loads all `--preload` scripts (see [Lifecycle](https://bun.com/docs/test/lifecycle) for details), then runs all tests. If a test fails, the test runner will exit with a non-zero exit code.

## [CI/CD integration](https://bun.com/docs/cli/test\#ci-cd-integration)

`bun test` supports a variety of CI/CD integrations.

### [GitHub Actions](https://bun.com/docs/cli/test\#github-actions)

`bun test` automatically detects if it's running inside GitHub Actions and will emit GitHub Actions annotations to the console directly.

No configuration is needed, other than installing `bun` in the workflow and running `bun test`.

#### How to install `bun` in a GitHub Actions workflow

To use `bun test` in a GitHub Actions workflow, add the following step:

```
jobs:
  build:
    name: build-app
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4
      - name: Install bun
        uses: oven-sh/setup-bun@v2
      - name: Install dependencies # (assuming your project has dependencies)
        run: bun install # You can use npm/yarn/pnpm instead if you prefer
      - name: Run tests
        run: bun test

```

From there, you'll get GitHub Actions annotations.

### [JUnit XML reports (GitLab, etc.)](https://bun.com/docs/cli/test\#junit-xml-reports-gitlab-etc)

To use `bun test` with a JUnit XML reporter, you can use the `--reporter=junit` in combination with `--reporter-outfile`.

```
bun test --reporter=junit --reporter-outfile=./bun.xml
```

This will continue to output to stdout/stderr as usual, and also write a JUnitXML report to the given path at the very end of the test run.

JUnit XML is a popular format for reporting test results in CI/CD pipelines.

## [Timeouts](https://bun.com/docs/cli/test\#timeouts)

Use the `--timeout` flag to specify a _per-test_ timeout in milliseconds. If a test times out, it will be marked as failed. The default value is `5000`.

```
# default value is 5000
```

```
bun test --timeout 20
```

## [Rerun tests](https://bun.com/docs/cli/test\#rerun-tests)

Use the `--rerun-each` flag to run each test multiple times. This is useful for detecting flaky or non-deterministic test failures.

```
bun test --rerun-each 100
```

## [Bail out with `--bail`](https://bun.com/docs/cli/test\#bail-out-with-bail)

Use the `--bail` flag to abort the test run early after a pre-determined number of test failures. By default Bun will run all tests and report all failures, but sometimes in CI environments it's preferable to terminate earlier to reduce CPU usage.

```
# bail after 1 failure
```

```
bun test --bail
```

```

# bail after 10 failure
```

```
bun test --bail=10
```

## [Watch mode](https://bun.com/docs/cli/test\#watch-mode)

Similar to `bun run`, you can pass the `--watch` flag to `bun test` to watch for changes and re-run tests.

```
bun test --watch
```

## [Lifecycle hooks](https://bun.com/docs/cli/test\#lifecycle-hooks)

Bun supports the following lifecycle hooks:

| Hook | Description |
| --- | --- |
| `beforeAll` | Runs once before all tests. |
| `beforeEach` | Runs before each test. |
| `afterEach` | Runs after each test. |
| `afterAll` | Runs once after all tests. |

These hooks can be defined inside test files, or in a separate file that is preloaded with the `--preload` flag.

```
$ bun test --preload ./setup.ts

```

See [Test > Lifecycle](https://bun.com/docs/test/lifecycle) for complete documentation.

## [Mocks](https://bun.com/docs/cli/test\#mocks)

Create mock functions with the `mock` function.

```
import { test, expect, mock } from "bun:test";
const random = mock(() => Math.random());

test("random", () => {
  const val = random();
  expect(val).toBeGreaterThan(0);
  expect(random).toHaveBeenCalled();
  expect(random).toHaveBeenCalledTimes(1);
});

```

Alternatively, you can use `jest.fn()`, it behaves identically.

```
import { test, expect, mock } from "bun:test";
import { test, expect, jest } from "bun:test";

const random = mock(() => Math.random());
const random = jest.fn(() => Math.random());
```

See [Test > Mocks](https://bun.com/docs/test/mocks) for complete documentation.

## [Snapshot testing](https://bun.com/docs/cli/test\#snapshot-testing)

Snapshots are supported by `bun test`.

```
// example usage of toMatchSnapshot
import { test, expect } from "bun:test";

test("snapshot", () => {
  expect({ a: 1 }).toMatchSnapshot();
});

```

To update snapshots, use the `--update-snapshots` flag.

```
bun test --update-snapshots
```

See [Test > Snapshots](https://bun.com/docs/test/snapshots) for complete documentation.

## [UI & DOM testing](https://bun.com/docs/cli/test\#ui-dom-testing)

Bun is compatible with popular UI testing libraries:

- [HappyDOM](https://github.com/capricorn86/happy-dom)
- [DOM Testing Library](https://testing-library.com/docs/dom-testing-library/intro/)
- [React Testing Library](https://testing-library.com/docs/react-testing-library/intro)

See [Test > DOM Testing](https://bun.com/docs/test/dom) for complete documentation.

## [Performance](https://bun.com/docs/cli/test\#performance)

Bun's test runner is fast.

[![](https://bun.com/images/buntest.jpeg)](https://bun.com/images/buntest.jpeg) Running 266 React SSR tests faster than Jest can print its version number.

## [AI Agent Integration](https://bun.com/docs/cli/test\#ai-agent-integration)

When using Bun's test runner with AI coding assistants, you can enable quieter output to improve readability and reduce context noise. This feature minimizes test output verbosity while preserving essential failure information.

### [Environment Variables](https://bun.com/docs/cli/test\#environment-variables)

Set any of the following environment variables to enable AI-friendly output:

- `CLAUDECODE=1` \- For Claude Code
- `REPL_ID=1` \- For Replit
- `AGENT=1` \- Generic AI agent flag

### [Behavior](https://bun.com/docs/cli/test\#behavior)

When an AI agent environment is detected:

- Only test failures are displayed in detail
- Passing, skipped, and todo test indicators are hidden
- Summary statistics remain intact

```
# Example: Enable quiet output for Claude Code
```

```
CLAUDECODE=1 bun test
```

```

# Still shows failures and summary, but hides verbose passing test output
```

This feature is particularly useful in AI-assisted development workflows where reduced output verbosity improves context efficiency while maintaining visibility into test failures.

## CLI Usage

$buntest<patterns>

### Flags

#### Test Selection

--only

Only run tests that are marked with "test.only()"

--todo

Include tests that are marked with "test.todo()"

-t,--test-name-pattern=<val>

Run only tests with a name that matches the given regex.

#### Execution Control

--timeout=<val>

Set the per-test timeout in milliseconds, default is 5000.

--rerun-each=<val>

Re-run each test file <NUMBER> times, helps catch certain bugs

--bail=<val>

Exit the test suite after <NUMBER> failures. If you do not specify a number, it defaults to 1.

#### Coverage Options

--coverage

Generate a coverage profile

--coverage-reporter=<val>

Report coverage in 'text' and/or 'lcov'. Defaults to 'text'.

--coverage-dir=<val>

Directory for coverage files. Defaults to 'coverage'.

#### Output & Reporting

--reporter=<val>

Specify the test reporter. Currently --reporter=junit is the only supported format.

--reporter-outfile=<val>

The output file used for the format from --reporter.

#### Snapshot Management

-u,--update-snapshots

Update snapshot files

### Examples

Run all test files

bun test

Run all test files with "foo" or "bar" in the file name

bun test foo bar

Run all test files, only including tests whose names includes "baz"

bun test --test-name-pattern baz

Full documentation is available at https://bun.sh/docs/cli/test

[Previous\\
\\
Secrets](https://bun.com/docs/api/secrets) [Next\\
\\
Utils](https://bun.com/docs/api/utils)

[![GitHub logo](<Base64-Image-Removed>)![GitHub logo](<Base64-Image-Removed>)\\
\\
Edit on GitHub](https://github.com/oven-sh/bun/edit/main/docs/cli/test.md)

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