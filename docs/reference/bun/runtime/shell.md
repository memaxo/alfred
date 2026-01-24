---
title: $ Shell – API | Bun Docs
url:
description: Bun's cross-platform shell-scripting API makes shell scripting with JavaScript fun
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

[HTTP server](https://bun.com/docs/api/http) [HTTP client](https://bun.com/docs/api/fetch) [WebSockets](https://bun.com/docs/api/websockets) [Workers](https://bun.com/docs/api/workers) [Binary data](https://bun.com/docs/api/binary-data) [Streams](https://bun.com/docs/api/streams) [SQL](https://bun.com/docs/api/sql) [S3 Object Storage](https://bun.com/docs/api/s3) [File I/O](https://bun.com/docs/api/file-io) [Redis client](https://bun.com/docs/api/redis) [import.meta](https://bun.com/docs/api/import-meta) [SQLite](https://bun.com/docs/api/sqlite) [FileSystemRouter](https://bun.com/docs/api/file-system-router) [TCP sockets](https://bun.com/docs/api/tcp) [UDP sockets](https://bun.com/docs/api/udp) [Globals](https://bun.com/docs/api/globals) [$ Shell](https://bun.com/docs/runtime/shell)

[Features:](https://bun.com/docs/runtime/shell#features) [Getting started](https://bun.com/docs/runtime/shell#getting-started) [Error handling](https://bun.com/docs/runtime/shell#error-handling) [Redirection](https://bun.com/docs/runtime/shell#redirection) [Example: Redirect output to JavaScript objects ( `>`)](https://bun.com/docs/runtime/shell#example-redirect-output-to-javascript-objects) [Example: Redirect input from JavaScript objects ( `<`)](https://bun.com/docs/runtime/shell#example-redirect-input-from-javascript-objects) [Example: Redirect stdin -> file](https://bun.com/docs/runtime/shell#example-redirect-stdin-file) [Example: Redirect stdout -> file](https://bun.com/docs/runtime/shell#example-redirect-stdout-file) [Example: Redirect stderr -> file](https://bun.com/docs/runtime/shell#example-redirect-stderr-file) [Example: Redirect stderr -> stdout](https://bun.com/docs/runtime/shell#example-redirect-stderr-stdout) [Example: Redirect stdout -> stderr](https://bun.com/docs/runtime/shell#example-redirect-stdout-stderr) [Piping ( `|`)](https://bun.com/docs/runtime/shell#piping) [Command substitution ( `$(...)`)](https://bun.com/docs/runtime/shell#command-substitution) [Environment variables](https://bun.com/docs/runtime/shell#environment-variables) [Changing the environment variables](https://bun.com/docs/runtime/shell#changing-the-environment-variables) [Changing the working directory](https://bun.com/docs/runtime/shell#changing-the-working-directory) [Reading output](https://bun.com/docs/runtime/shell#reading-output) [Reading output as JSON](https://bun.com/docs/runtime/shell#reading-output-as-json) [Reading output line-by-line](https://bun.com/docs/runtime/shell#reading-output-line-by-line) [Reading output as a Blob](https://bun.com/docs/runtime/shell#reading-output-as-a-blob) [Builtin Commands](https://bun.com/docs/runtime/shell#builtin-commands) [Utilities](https://bun.com/docs/runtime/shell#utilities) [`$.braces` (brace expansion)](https://bun.com/docs/runtime/shell#braces-brace-expansion) [`$.escape` (escape strings)](https://bun.com/docs/runtime/shell#escape-escape-strings) [.sh file loader](https://bun.com/docs/runtime/shell#sh-file-loader) [Implementation notes](https://bun.com/docs/runtime/shell#implementation-notes) [Security in the Bun shell](https://bun.com/docs/runtime/shell#security-in-the-bun-shell) [Security considerations](https://bun.com/docs/runtime/shell#security-considerations) [Argument injection](https://bun.com/docs/runtime/shell#argument-injection) [Credits](https://bun.com/docs/runtime/shell#credits)

[Child processes](https://bun.com/docs/api/spawn) [YAML](https://bun.com/docs/api/yaml) [HTMLRewriter](https://bun.com/docs/api/html-rewriter) [Hashing](https://bun.com/docs/api/hashing) [Console](https://bun.com/docs/api/console) [Cookie](https://bun.com/docs/api/cookie) [FFI](https://bun.com/docs/api/ffi) [C Compiler](https://bun.com/docs/api/cc) [Secrets](https://bun.com/docs/api/secrets) [Testing](https://bun.com/docs/cli/test) [Utils](https://bun.com/docs/api/utils) [Node-API](https://bun.com/docs/api/node-api) [Glob](https://bun.com/docs/api/glob) [DNS](https://bun.com/docs/api/dns) [Semver](https://bun.com/docs/api/semver) [Color](https://bun.com/docs/api/color) [Transpiler](https://bun.com/docs/api/transpiler)

Project

[Roadmap](https://bun.com/docs/project/roadmap) [Benchmarking](https://bun.com/docs/project/benchmarking) [Contributing](https://bun.com/docs/project/contributing) [Building Windows](https://bun.com/docs/project/building-windows) [Bindgen](https://bun.com/docs/project/bindgen) [License](https://bun.com/docs/project/licensing)

Bun Shell makes shell scripting with JavaScript & TypeScript fun. It's a cross-platform bash-like shell with seamless JavaScript interop.

Quickstart:

```
import { $ } from "bun";

const response = await fetch("https://example.com");

// Use Response as stdin.
await $`cat < ${response} | wc -c`; // 1256

```

## [Features:](https://bun.com/docs/runtime/shell#features)

- **Cross-platform**: works on Windows, Linux & macOS. Instead of `rimraf` or `cross-env`', you can use Bun Shell without installing extra dependencies. Common shell commands like `ls`, `cd`, `rm` are implemented natively.
- **Familiar**: Bun Shell is a bash-like shell, supporting redirection, pipes, environment variables and more.
- **Globs**: Glob patterns are supported natively, including `**`, `*`, `{expansion}`, and more.
- **Template literals**: Template literals are used to execute shell commands. This allows for easy interpolation of variables and expressions.
- **Safety**: Bun Shell escapes all strings by default, preventing shell injection attacks.
- **JavaScript interop**: Use `Response`, `ArrayBuffer`, `Blob`, `Bun.file(path)` and other JavaScript objects as stdin, stdout, and stderr.
- **Shell scripting**: Bun Shell can be used to run shell scripts ( `.bun.sh` files).
- **Custom interpreter**: Bun Shell is written in Zig, along with its lexer, parser, and interpreter. Bun Shell is a small programming language.

## [Getting started](https://bun.com/docs/runtime/shell#getting-started)

The simplest shell command is `echo`. To run it, use the `$` template literal tag:

```
import { $ } from "bun";

await $`echo "Hello World!"`; // Hello World!

```

By default, shell commands print to stdout. To quiet the output, call `.quiet()`:

```
import { $ } from "bun";

await $`echo "Hello World!"`.quiet(); // No output

```

What if you want to access the output of the command as text? Use `.text()`:

```
import { $ } from "bun";

// .text() automatically calls .quiet() for you
const welcome = await $`echo "Hello World!"`.text();

console.log(welcome); // Hello World!\n

```

By default, `await` ing will return stdout and stderr as `Buffer` s.

```
import { $ } from "bun";

const { stdout, stderr } = await $`echo "Hello!"`.quiet();

console.log(stdout); // Buffer(7) [ 72, 101, 108, 108, 111, 33, 10 ]
console.log(stderr); // Buffer(0) []

```

## [Error handling](https://bun.com/docs/runtime/shell#error-handling)

By default, non-zero exit codes will throw an error. This `ShellError` contains information about the command run.

```
import { $ } from "bun";

try {
  const output = await $`something-that-may-fail`.text();
  console.log(output);
} catch (err) {
  console.log(`Failed with code ${err.exitCode}`);
  console.log(err.stdout.toString());
  console.log(err.stderr.toString());
}

```

Throwing can be disabled with `.nothrow()`. The result's `exitCode` will need to be checked manually.

```
import { $ } from "bun";

const { stdout, stderr, exitCode } = await $`something-that-may-fail`
  .nothrow()
  .quiet();

if (exitCode !== 0) {
  console.log(`Non-zero exit code ${exitCode}`);
}

console.log(stdout);
console.log(stderr);

```

The default handling of non-zero exit codes can be configured by calling `.nothrow()` or `.throws(boolean)` on the `$` function itself.

```
import { $ } from "bun";
// shell promises will not throw, meaning you will have to
// check for `exitCode` manually on every shell command.
$.nothrow(); // equivalent to $.throws(false)

// default behavior, non-zero exit codes will throw an error
$.throws(true);

// alias for $.nothrow()
$.throws(false);

await $`something-that-may-fail`; // No exception thrown

```

## [Redirection](https://bun.com/docs/runtime/shell#redirection)

A command's _input_ or _output_ may be _redirected_ using the typical Bash operators:

- `<` redirect stdin
- `>` or `1>` redirect stdout
- `2>` redirect stderr
- `&>` redirect both stdout and stderr
- `>>` or `1>>` redirect stdout, _appending_ to the destination, instead of overwriting
- `2>>` redirect stderr, _appending_ to the destination, instead of overwriting
- `&>>` redirect both stdout and stderr, _appending_ to the destination, instead of overwriting
- `1>&2` redirect stdout to stderr (all writes to stdout will instead be in stderr)
- `2>&1` redirect stderr to stdout (all writes to stderr will instead be in stdout)

Bun Shell also supports redirecting from and to JavaScript objects.

### [Example: Redirect output to JavaScript objects ( `>`)](https://bun.com/docs/runtime/shell#example-redirect-output-to-javascript-objects)

To redirect stdout to a JavaScript object, use the `>` operator:

```
import { $ } from "bun";

const buffer = Buffer.alloc(100);
await $`echo "Hello World!" > ${buffer}`;

console.log(buffer.toString()); // Hello World!\n

```

The following JavaScript objects are supported for redirection to:

- `Buffer`, `Uint8Array`, `Uint16Array`, `Uint32Array`, `Int8Array`, `Int16Array`, `Int32Array`, `Float32Array`, `Float64Array`, `ArrayBuffer`, `SharedArrayBuffer` (writes to the underlying buffer)
- `Bun.file(path)`, `Bun.file(fd)` (writes to the file)

### [Example: Redirect input from JavaScript objects ( `<`)](https://bun.com/docs/runtime/shell#example-redirect-input-from-javascript-objects)

To redirect the output from JavaScript objects to stdin, use the `<` operator:

```
import { $ } from "bun";

const response = new Response("hello i am a response body");

const result = await $`cat < ${response}`.text();

console.log(result); // hello i am a response body

```

The following JavaScript objects are supported for redirection from:

- `Buffer`, `Uint8Array`, `Uint16Array`, `Uint32Array`, `Int8Array`, `Int16Array`, `Int32Array`, `Float32Array`, `Float64Array`, `ArrayBuffer`, `SharedArrayBuffer` (reads from the underlying buffer)
- `Bun.file(path)`, `Bun.file(fd)` (reads from the file)
- `Response` (reads from the body)

### [Example: Redirect stdin -> file](https://bun.com/docs/runtime/shell#example-redirect-stdin-file)

```
import { $ } from "bun";

await $`cat < myfile.txt`;

```

### [Example: Redirect stdout -> file](https://bun.com/docs/runtime/shell#example-redirect-stdout-file)

```
import { $ } from "bun";

await $`echo bun! > greeting.txt`;

```

### [Example: Redirect stderr -> file](https://bun.com/docs/runtime/shell#example-redirect-stderr-file)

```
import { $ } from "bun";

await $`bun run index.ts 2> errors.txt`;

```

### [Example: Redirect stderr -> stdout](https://bun.com/docs/runtime/shell#example-redirect-stderr-stdout)

```
import { $ } from "bun";

// redirects stderr to stdout, so all output
// will be available on stdout
await $`bun run ./index.ts 2>&1`;

```

### [Example: Redirect stdout -> stderr](https://bun.com/docs/runtime/shell#example-redirect-stdout-stderr)

```
import { $ } from "bun";

// redirects stdout to stderr, so all output
// will be available on stderr
await $`bun run ./index.ts 1>&2`;

```

## [Piping ( `|`)](https://bun.com/docs/runtime/shell#piping)

Like in bash, you can pipe the output of one command to another:

```
import { $ } from "bun";

const result = await $`echo "Hello World!" | wc -w`.text();

console.log(result); // 2\n

```

You can also pipe with JavaScript objects:

```
import { $ } from "bun";

const response = new Response("hello i am a response body");

const result = await $`cat < ${response} | wc -w`.text();

console.log(result); // 6\n

```

## [Command substitution ( `$(...)`)](https://bun.com/docs/runtime/shell#command-substitution)

Command substitution allows you to substitute the output of another script into the current script:

```
import { $ } from "bun";

// Prints out the hash of the current commit
await $`echo Hash of current commit: $(git rev-parse HEAD)`;

```

This is a textual insertion of the command's output and can be used to, for example, declare a shell variable:

```
import { $ } from "bun";

await $`
  REV=$(git rev-parse HEAD)
  docker built -t myapp:$REV
  echo Done building docker image "myapp:$REV"
`;

```

**NOTE**: Because Bun internally uses the special [`raw`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Template_literals#raw_strings) property on the input template literal, using the backtick syntax for command substitution won't work:

```
import { $ } from "bun";

await $`echo \`echo hi\``;

```

Instead of printing:

```
hi

```

The above will print out:

```
echo hi

```

We instead recommend sticking to the `$(...)` syntax.

## [Environment variables](https://bun.com/docs/runtime/shell#environment-variables)

Environment variables can be set like in bash:

```
import { $ } from "bun";

await $`FOO=foo bun -e 'console.log(process.env.FOO)'`; // foo\n

```

You can use string interpolation to set environment variables:

```
import { $ } from "bun";

const foo = "bar123";

await $`FOO=${foo + "456"} bun -e 'console.log(process.env.FOO)'`; // bar123456\n

```

Input is escaped by default, preventing shell injection attacks:

```
import { $ } from "bun";

const foo = "bar123; rm -rf /tmp";

await $`FOO=${foo} bun -e 'console.log(process.env.FOO)'`; // bar123; rm -rf /tmp\n

```

### [Changing the environment variables](https://bun.com/docs/runtime/shell#changing-the-environment-variables)

By default, `process.env` is used as the environment variables for all commands.

You can change the environment variables for a single command by calling `.env()`:

```
import { $ } from "bun";

await $`echo $FOO`.env({ ...process.env, FOO: "bar" }); // bar

```

You can change the default environment variables for all commands by calling `$.env`:

```
import { $ } from "bun";

$.env({ FOO: "bar" });

// the globally-set $FOO
await $`echo $FOO`; // bar

// the locally-set $FOO
await $`echo $FOO`.env({ FOO: "baz" }); // baz

```

You can reset the environment variables to the default by calling `$.env()` with no arguments:

```
import { $ } from "bun";

$.env({ FOO: "bar" });

// the globally-set $FOO
await $`echo $FOO`; // bar

// the locally-set $FOO
await $`echo $FOO`.env(undefined); // ""

```

### [Changing the working directory](https://bun.com/docs/runtime/shell#changing-the-working-directory)

You can change the working directory of a command by passing a string to `.cwd()`:

```
import { $ } from "bun";

await $`pwd`.cwd("/tmp"); // /tmp

```

You can change the default working directory for all commands by calling `$.cwd`:

```
import { $ } from "bun";

$.cwd("/tmp");

// the globally-set working directory
await $`pwd`; // /tmp

// the locally-set working directory
await $`pwd`.cwd("/"); // /

```

## [Reading output](https://bun.com/docs/runtime/shell#reading-output)

To read the output of a command as a string, use `.text()`:

```
import { $ } from "bun";

const result = await $`echo "Hello World!"`.text();

console.log(result); // Hello World!\n

```

### [Reading output as JSON](https://bun.com/docs/runtime/shell#reading-output-as-json)

To read the output of a command as JSON, use `.json()`:

```
import { $ } from "bun";

const result = await $`echo '{"foo": "bar"}'`.json();

console.log(result); // { foo: "bar" }

```

### [Reading output line-by-line](https://bun.com/docs/runtime/shell#reading-output-line-by-line)

To read the output of a command line-by-line, use `.lines()`:

```
import { $ } from "bun";

for await (let line of $`echo "Hello World!"`.lines()) {
  console.log(line); // Hello World!
}

```

You can also use `.lines()` on a completed command:

```
import { $ } from "bun";

const search = "bun";

for await (let line of $`cat list.txt | grep ${search}`.lines()) {
  console.log(line);
}

```

### [Reading output as a Blob](https://bun.com/docs/runtime/shell#reading-output-as-a-blob)

To read the output of a command as a Blob, use `.blob()`:

```
import { $ } from "bun";

const result = await $`echo "Hello World!"`.blob();

console.log(result); // Blob(13) { size: 13, type: "text/plain" }

```

## [Builtin Commands](https://bun.com/docs/runtime/shell#builtin-commands)

For cross-platform compatibility, Bun Shell implements a set of builtin commands, in addition to reading commands from the PATH environment variable.

- `cd`: change the working directory
- `ls`: list files in a directory
- `rm`: remove files and directories
- `echo`: print text
- `pwd`: print the working directory
- `bun`: run bun in bun
- `cat`
- `touch`
- `mkdir`
- `which`
- `mv`
- `exit`
- `true`
- `false`
- `yes`
- `seq`
- `dirname`
- `basename`

**Partially** implemented:

- `mv`: move files and directories (missing cross-device support)

**Not** implemented yet, but planned:

- See [Issue #9716](https://github.com/oven-sh/bun/issues/9716) for the full list.

## [Utilities](https://bun.com/docs/runtime/shell#utilities)

Bun Shell also implements a set of utilities for working with shells.

### [`$.braces` (brace expansion)](https://bun.com/docs/runtime/shell#braces-brace-expansion)

This function implements simple [brace expansion](https://www.gnu.org/software/bash/manual/html_node/Brace-Expansion.html) for shell commands:

```
import { $ } from "bun";

await $.braces(`echo {1,2,3}`);
// => ["echo 1", "echo 2", "echo 3"]

```

### [`$.escape` (escape strings)](https://bun.com/docs/runtime/shell#escape-escape-strings)

Exposes Bun Shell's escaping logic as a function:

```
import { $ } from "bun";

console.log($.escape('$(foo) `bar` "baz"'));
// => \$(foo) \`bar\` \"baz\"

```

If you do not want your string to be escaped, wrap it in a `{ raw: 'str' }` object:

```
import { $ } from "bun";

await $`echo ${{ raw: '$(foo) `bar` "baz"' }}`;
// => bun: command not found: foo
// => bun: command not found: bar
// => baz

```

## [.sh file loader](https://bun.com/docs/runtime/shell#sh-file-loader)

For simple shell scripts, instead of `/bin/sh`, you can use Bun Shell to run shell scripts.

To do so, just run the script with `bun` on a file with the `.sh` extension.

script.sh

```
echo "Hello World! pwd=$(pwd)"

```

```
bun ./script.sh
```

```
Hello World! pwd=/home/demo
```

Scripts with Bun Shell are cross platform, which means they work on Windows:

```
bun .\script.sh
```

```
Hello World! pwd=C:\Users\Demo
```

## [Implementation notes](https://bun.com/docs/runtime/shell#implementation-notes)

Bun Shell is a small programming language in Bun that is implemented in Zig. It includes a handwritten lexer, parser, and interpreter. Unlike bash, zsh, and other shells, Bun Shell runs operations concurrently.

## [Security in the Bun shell](https://bun.com/docs/runtime/shell#security-in-the-bun-shell)

By design, the Bun shell _does not invoke a system shell_ (like `/bin/sh`) andis instead a re-implementation of bash that runs in the same Bun process,designed with security in mind.

When parsing command arguments, it treats all _interpolated variables_ as single, literal strings.

This protects the Bun shell against **command injection**:

```
import { $ } from "bun";

const userInput = "my-file.txt; rm -rf /";

// SAFE: `userInput` is treated as a single quoted string
await $`ls ${userInput}`;

```

In the above example, `userInput` is treated as a single string. This causesthe `ls` command to try to read the contents of a single directory named"my-file; rm -rf /".

### [Security considerations](https://bun.com/docs/runtime/shell#security-considerations)

While command injection is prevented by default, developers are stillresponsible for security in certain scenarios.

Similar to the `Bun.spawn` or `node:child_process.exec()` APIs, you can intentionallyexecute a command which spawns a new shell (e.g. `bash -c`) with arguments.

When you do this, you hand off control, and Bun's built-in protections nolonger apply to the string interpreted by that new shell.

```
import { $ } from "bun";

const userInput = "world; touch /tmp/pwned";

// UNSAFE: You have explicitly started a new shell process with `bash -c`.
// This new shell will execute the `touch` command. Any user input
// passed this way must be rigorously sanitized.
await $`bash -c "echo ${userInput}"`;

```

### [Argument injection](https://bun.com/docs/runtime/shell#argument-injection)

The Bun shell cannot know how an external command interprets its owncommand-line arguments. An attacker can supply input that the target programrecognizes as one of its own options or flags, leading to unintended behavior.

```
import { $ } from "bun";

// Malicious input formatted as a Git command-line flag
const branch = "--upload-pack=echo pwned";

// UNSAFE: While Bun safely passes the string as a single argument,
// the `git` program itself sees and acts upon the malicious flag.
await $`git ls-remote origin ${branch}`;

```

**Recommendation** — As is best practice in every language, always sanitizeuser-provided input before passing it as an argument to an external command.The responsibility for validating arguments rests with your application code.

## [Credits](https://bun.com/docs/runtime/shell#credits)

Large parts of this API were inspired by [zx](https://github.com/google/zx), [dax](https://github.com/dsherret/dax), and [bnx](https://github.com/wobsoriano/bnx). Thank you to the authors of those projects.

[Previous\\
\\
Globals](https://bun.com/docs/api/globals) [Next\\
\\
Child processes](https://bun.com/docs/api/spawn)

[![GitHub logo](Base64-Image-Removed)![GitHub logo](Base64-Image-Removed)\\
\\
Edit on GitHub](https://github.com/oven-sh/bun/edit/main/docs/runtime/shell.md)

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
