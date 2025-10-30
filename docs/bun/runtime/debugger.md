---
title: Debugger – Runtime | Bun Docs
url: 
description: Debug your code with Bun's web-based debugger or VS Code extension
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

[Debugging JavaScript and TypeScript](https://bun.com/docs/runtime/debugger#debugging-javascript-and-typescript) [`--inspect`](https://bun.com/docs/runtime/debugger#inspect) [`--inspect-brk`](https://bun.com/docs/runtime/debugger#inspect-brk) [`--inspect-wait`](https://bun.com/docs/runtime/debugger#inspect-wait) [Setting a port or URL for the debugger](https://bun.com/docs/runtime/debugger#setting-a-port-or-url-for-the-debugger) [Debuggers](https://bun.com/docs/runtime/debugger#debuggers) [`debug.bun.sh`](https://bun.com/docs/runtime/debugger#debug-bun-sh) [Visual Studio Code Debugger](https://bun.com/docs/runtime/debugger#visual-studio-code-debugger) [Debugging Network Requests](https://bun.com/docs/runtime/debugger#debugging-network-requests) [Print fetch & node:http requests as curl commands](https://bun.com/docs/runtime/debugger#print-fetch-node-http-requests-as-curl-commands) [Stacktraces & sourcemaps](https://bun.com/docs/runtime/debugger#stacktraces-sourcemaps) [Syntax-highlighted source code preview](https://bun.com/docs/runtime/debugger#syntax-highlighted-source-code-preview) [V8 Stack Traces](https://bun.com/docs/runtime/debugger#v8-stack-traces)

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

Bun speaks the [WebKit Inspector Protocol](https://github.com/oven-sh/bun/blob/main/packages/bun-inspector-protocol/src/protocol/jsc/index.d.ts), so you can debug your code with an interactive debugger. For demonstration purposes, consider the following simple web server.

## [Debugging JavaScript and TypeScript](https://bun.com/docs/runtime/debugger\#debugging-javascript-and-typescript)

server.ts

```
Bun.serve({
  fetch(req){
    console.log(req.url);
    return new Response("Hello, world!");
  }
})

```

### [`--inspect`](https://bun.com/docs/runtime/debugger\#inspect)

To enable debugging when running code with Bun, use the `--inspect` flag. This automatically starts a WebSocket server on an available port that can be used to introspect the running Bun process.

```
bun --inspect server.ts
```

```
------------------ Bun Inspector ------------------
Listening at:
  ws://localhost:6499/0tqxs9exrgrm

Inspect in browser:
  https://debug.bun.sh/#localhost:6499/0tqxs9exrgrm
------------------ Bun Inspector ------------------
```

### [`--inspect-brk`](https://bun.com/docs/runtime/debugger\#inspect-brk)

The `--inspect-brk` flag behaves identically to `--inspect`, except it automatically injects a breakpoint at the first line of the executed script. This is useful for debugging scripts that run quickly and exit immediately.

### [`--inspect-wait`](https://bun.com/docs/runtime/debugger\#inspect-wait)

The `--inspect-wait` flag behaves identically to `--inspect`, except the code will not execute until a debugger has attached to the running process.

### [Setting a port or URL for the debugger](https://bun.com/docs/runtime/debugger\#setting-a-port-or-url-for-the-debugger)

Regardless of which flag you use, you can optionally specify a port number, URL prefix, or both.

```
bun --inspect=4000 server.ts
```

```
bun --inspect=localhost:4000 server.ts
```

```
bun --inspect=localhost:4000/prefix server.ts
```

## [Debuggers](https://bun.com/docs/runtime/debugger\#debuggers)

Various debugging tools can connect to this server to provide an interactive debugging experience.

### [`debug.bun.sh`](https://bun.com/docs/runtime/debugger\#debug-bun-sh)

Bun hosts a web-based debugger at [debug.bun.sh](https://debug.bun.sh/). It is a modified version of WebKit's [Web Inspector Interface](https://webkit.org/web-inspector/web-inspector-interface/), which will look familiar to Safari users.

Open the provided `debug.bun.sh` URL in your browser to start a debugging session. From this interface, you'll be able to view the source code of the running file, view and set breakpoints, and execute code with the built-in console.

[![Screenshot of Bun debugger, Console tab](https://github.com/oven-sh/bun/assets/3084745/e6a976a8-80cc-4394-8925-539025cc025d)](https://github.com/oven-sh/bun/assets/3084745/e6a976a8-80cc-4394-8925-539025cc025d)

Let's set a breakpoint. Navigate to the Sources tab; you should see the code from earlier. Click on the line number `3` to set a breakpoint on our `console.log(req.url)` statement.

[![screenshot of Bun debugger](https://github.com/oven-sh/bun/assets/3084745/3b69c7e9-25ff-4f9d-acc4-caa736862935)](https://github.com/oven-sh/bun/assets/3084745/3b69c7e9-25ff-4f9d-acc4-caa736862935)

Then visit [`http://localhost:3000`](http://localhost:3000/) in your web browser. This will send an HTTP request to our `localhost` web server. It will seem like the page isn't loading. Why? Because the program has paused execution at the breakpoint we set earlier.

Note how the UI has changed.

[![screenshot of Bun debugger](https://github.com/oven-sh/bun/assets/3084745/8b565e58-5445-4061-9bc4-f41090dfe769)](https://github.com/oven-sh/bun/assets/3084745/8b565e58-5445-4061-9bc4-f41090dfe769)

At this point there's a lot we can do to introspect the current execution environment. We can use the console at the bottom to run arbitrary code in the context of the program, with full access to the variables in scope at our breakpoint.

[![](https://github.com/oven-sh/bun/assets/3084745/f4312b76-48ba-4a7d-b3b6-6205968ac681)](https://github.com/oven-sh/bun/assets/3084745/f4312b76-48ba-4a7d-b3b6-6205968ac681)

On the right side of the Sources pane, we can see all local variables currently in scope, and drill down to see their properties and methods. Here, we're inspecting the `req` variable.

[![](https://github.com/oven-sh/bun/assets/3084745/63d7f843-5180-489c-aa94-87c486e68646)](https://github.com/oven-sh/bun/assets/3084745/63d7f843-5180-489c-aa94-87c486e68646)

In the upper left of the Sources pane, we can control the execution of the program.

[![](https://github.com/oven-sh/bun/assets/3084745/41b76deb-7371-4461-9d5d-81b5a6d2f7a4)](https://github.com/oven-sh/bun/assets/3084745/41b76deb-7371-4461-9d5d-81b5a6d2f7a4)

Here's a cheat sheet explaining the functions of the control flow buttons.

- _Continue script execution_ — continue running the program until the next breakpoint or exception.
- _Step over_ — The program will continue to the next line.
- _Step into_ — If the current statement contains a function call, the debugger will "step into" the called function.
- _Step out_ — If the current statement is a function call, the debugger will finish executing the call, then "step out" of the function to the location where it was called.

[![](https://github-production-user-asset-6210df.s3.amazonaws.com/3084745/261510346-6a94441c-75d3-413a-99a7-efa62365f83d.png)](https://github-production-user-asset-6210df.s3.amazonaws.com/3084745/261510346-6a94441c-75d3-413a-99a7-efa62365f83d.png)

### [Visual Studio Code Debugger](https://bun.com/docs/runtime/debugger\#visual-studio-code-debugger)

Experimental support for debugging Bun scripts is available in Visual Studio Code. To use it, you'll need to install the [Bun VSCode extension](https://bun.com/guides/runtime/vscode-debugger).

## [Debugging Network Requests](https://bun.com/docs/runtime/debugger\#debugging-network-requests)

The `BUN_CONFIG_VERBOSE_FETCH` environment variable lets you log network requests made with `fetch()` or `node:http` automatically.

| Value | Description |
| --- | --- |
| `curl` | Print requests as `curl` commands. |
| `true` | Print request & response info |
| `false` | Don't print anything. Default |

### [Print fetch & node:http requests as curl commands](https://bun.com/docs/runtime/debugger\#print-fetch-node-http-requests-as-curl-commands)

Bun also supports printing `fetch()` and `node:http` network requests as `curl` commands by setting the environment variable `BUN_CONFIG_VERBOSE_FETCH` to `curl`.

```
process.env.BUN_CONFIG_VERBOSE_FETCH = "curl";

await fetch("https://example.com", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ foo: "bar" }),
});

```

This prints the `fetch` request as a single-line `curl` command to let you copy-paste into your terminal to replicate the request.

```
[fetch] $ curl --http1.1 "https://example.com/" -X POST -H "content-type: application/json" -H "Connection: keep-alive" -H "User-Agent: Bun/1.2.22" -H "Accept: */*" -H "Host: example.com" -H "Accept-Encoding: gzip, deflate, br" --compressed -H "Content-Length: 13" --data-raw "{\"foo\":\"bar\"}"
[fetch] > HTTP/1.1 POST https://example.com/
[fetch] > content-type: application/json
[fetch] > Connection: keep-alive
[fetch] > User-Agent: Bun/1.2.22
[fetch] > Accept: */*
[fetch] > Host: example.com
[fetch] > Accept-Encoding: gzip, deflate, br
[fetch] > Content-Length: 13

[fetch] < 200 OK
[fetch] < Accept-Ranges: bytes
[fetch] < Cache-Control: max-age=604800
[fetch] < Content-Type: text/html; charset=UTF-8
[fetch] < Date: Tue, 18 Jun 2024 05:12:07 GMT
[fetch] < Etag: "3147526947"
[fetch] < Expires: Tue, 25 Jun 2024 05:12:07 GMT
[fetch] < Last-Modified: Thu, 17 Oct 2019 07:18:26 GMT
[fetch] < Server: EOS (vny/044F)
[fetch] < Content-Length: 1256

```

The lines with `[fetch] >` are the request from your local code, and the lines with `[fetch] <` are the response from the remote server.

The `BUN_CONFIG_VERBOSE_FETCH` environment variable is supported in both `fetch()` and `node:http` requests, so it should just work.

To print without the `curl` command, set `BUN_CONFIG_VERBOSE_FETCH` to `true`.

```
process.env.BUN_CONFIG_VERBOSE_FETCH = "true";

await fetch("https://example.com", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ foo: "bar" }),
});

```

This prints the following to the console:

```
[fetch] > HTTP/1.1 POST https://example.com/
[fetch] > content-type: application/json
[fetch] > Connection: keep-alive
[fetch] > User-Agent: Bun/1.2.22
[fetch] > Accept: */*
[fetch] > Host: example.com
[fetch] > Accept-Encoding: gzip, deflate, br
[fetch] > Content-Length: 13

[fetch] < 200 OK
[fetch] < Accept-Ranges: bytes
[fetch] < Cache-Control: max-age=604800
[fetch] < Content-Type: text/html; charset=UTF-8
[fetch] < Date: Tue, 18 Jun 2024 05:12:07 GMT
[fetch] < Etag: "3147526947"
[fetch] < Expires: Tue, 25 Jun 2024 05:12:07 GMT
[fetch] < Last-Modified: Thu, 17 Oct 2019 07:18:26 GMT
[fetch] < Server: EOS (vny/044F)
[fetch] < Content-Length: 1256

```

## [Stacktraces & sourcemaps](https://bun.com/docs/runtime/debugger\#stacktraces-sourcemaps)

Bun transpiles every file, which sounds like it would mean that the stack traces you see in the console would unhelpfully point to the transpiled output. To address this, Bun automatically generates and serves sourcemapped files for every file it transpiles. When you see a stack trace in the console, you can click on the file path and be taken to the original source code, even though it was written in TypeScript or JSX, or has some other transformation applied.

Bun automatically loads sourcemaps both at runtime when transpiling files on-demand, and when using `bun build` to precompile files ahead of time.

### [Syntax-highlighted source code preview](https://bun.com/docs/runtime/debugger\#syntax-highlighted-source-code-preview)

To help with debugging, Bun automatically prints a small source-code preview when an unhandled exception or rejection occurs. You can simulate this behavior by calling `Bun.inspect(error)`:

```
// Create an error
const err = new Error("Something went wrong");
console.log(Bun.inspect(err, { colors: true }));

```

This prints a syntax-highlighted preview of the source code where the error occurred, along with the error message and stack trace.

```
1 | // Create an error
2 | const err = new Error("Something went wrong");
                ^
error: Something went wrong
      at file.js:2:13

```

### [V8 Stack Traces](https://bun.com/docs/runtime/debugger\#v8-stack-traces)

Bun uses JavaScriptCore as it's engine, but much of the Node.js ecosystem & npm expects V8. JavaScript engines differ in `error.stack` formatting. Bun intends to be a drop-in replacement for Node.js, and that means it's our job to make sure that even though the engine is different, the stack traces are as similar as possible.

That's why when you log `error.stack` in Bun, the formatting of `error.stack` is the same as in Node.js's V8 engine. This is especially useful when you're using libraries that expect V8 stack traces.

#### V8 Stack Trace API

Bun implements the [V8 Stack Trace API](https://v8.dev/docs/stack-trace-api), which is a set of functions that allow you to manipulate stack traces.

##### Error.prepareStackTrace

The `Error.prepareStackTrace` function is a global function that lets you customize the stack trace output. This function is called with the error object and an array of `CallSite` objects and lets you return a custom stack trace.

```
Error.prepareStackTrace = (err, stack) => {
  return stack.map(callSite => {
    return callSite.getFileName();
  });
};

const err = new Error("Something went wrong");
console.log(err.stack);
// [ "error.js" ]

```

The `CallSite` object has the following methods:

| Method | Returns |
| --- | --- |
| `getThis` | `this` value of the function call |
| `getTypeName` | typeof `this` |
| `getFunction` | function object |
| `getFunctionName` | function name as a string |
| `getMethodName` | method name as a string |
| `getFileName` | file name or URL |
| `getLineNumber` | line number |
| `getColumnNumber` | column number |
| `getEvalOrigin` | `undefined` |
| `getScriptNameOrSourceURL` | source URL |
| `isToplevel` | returns `true` if the function is in the global scope |
| `isEval` | returns `true` if the function is an `eval` call |
| `isNative` | returns `true` if the function is native |
| `isConstructor` | returns `true` if the function is a constructor |
| `isAsync` | returns `true` if the function is `async` |
| `isPromiseAll` | Not implemented yet. |
| `getPromiseIndex` | Not implemented yet. |
| `toString` | returns a string representation of the call site |

In some cases, the `Function` object may have already been garbage collected, so some of these methods may return `undefined`.

##### Error.captureStackTrace(error, startFn)

The `Error.captureStackTrace` function lets you capture a stack trace at a specific point in your code, rather than at the point where the error was thrown.

This can be helpful when you have callbacks or asynchronous code that makes it difficult to determine where an error originated. The 2nd argument to `Error.captureStackTrace` is the function where you want the stack trace to start.

For example, the below code will make `err.stack` point to the code calling `fn()`, even though the error was thrown at `myInner`.

```
const fn = () => {
  function myInner() {
    throw err;
  }

  try {
    myInner();
  } catch (err) {
    console.log(err.stack);
    console.log("");
    console.log("-- captureStackTrace --");
    console.log("");
    Error.captureStackTrace(err, fn);
    console.log(err.stack);
  }
};

fn();

```

This logs the following:

```
Error: here!
    at myInner (file.js:4:15)
    at fn (file.js:8:5)
    at module code (file.js:17:1)
    at moduleEvaluation (native)
    at moduleEvaluation (native)
    at <anonymous> (native)

-- captureStackTrace --

Error: here!
    at module code (file.js:17:1)
    at moduleEvaluation (native)
    at moduleEvaluation (native)
    at <anonymous> (native)

```

[Previous\\
\\
bunfig.toml](https://bun.com/docs/runtime/bunfig) [Next\\
\\
`bun install`](https://bun.com/docs/cli/install)

[![GitHub logo](<Base64-Image-Removed>)![GitHub logo](<Base64-Image-Removed>)\\
\\
Edit on GitHub](https://github.com/oven-sh/bun/edit/main/docs/runtime/debugger.md)

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