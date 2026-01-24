---
title: File I/O – API | Bun Docs
url:
description: Read and write files fast with Bun's heavily optimized file system API.
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

[HTTP server](https://bun.com/docs/api/http) [HTTP client](https://bun.com/docs/api/fetch) [WebSockets](https://bun.com/docs/api/websockets) [Workers](https://bun.com/docs/api/workers) [Binary data](https://bun.com/docs/api/binary-data) [Streams](https://bun.com/docs/api/streams) [SQL](https://bun.com/docs/api/sql) [S3 Object Storage](https://bun.com/docs/api/s3) [File I/O](https://bun.com/docs/api/file-io)

[Reading files ( `Bun.file()`)](https://bun.com/docs/api/file-io#reading-files-bun-file) [Deleting files ( `file.delete()`)](https://bun.com/docs/api/file-io#deleting-files-file-delete) [Writing files ( `Bun.write()`)](https://bun.com/docs/api/file-io#writing-files-bun-write) [Incremental writing with `FileSink`](https://bun.com/docs/api/file-io#incremental-writing-with-filesink) [Directories](https://bun.com/docs/api/file-io#directories) [Reading directories (readdir)](https://bun.com/docs/api/file-io#reading-directories-readdir) [Creating directories (mkdir)](https://bun.com/docs/api/file-io#creating-directories-mkdir) [Benchmarks](https://bun.com/docs/api/file-io#benchmarks) [Reference](https://bun.com/docs/api/file-io#reference)

[Redis client](https://bun.com/docs/api/redis) [import.meta](https://bun.com/docs/api/import-meta) [SQLite](https://bun.com/docs/api/sqlite) [FileSystemRouter](https://bun.com/docs/api/file-system-router) [TCP sockets](https://bun.com/docs/api/tcp) [UDP sockets](https://bun.com/docs/api/udp) [Globals](https://bun.com/docs/api/globals) [$ Shell](https://bun.com/docs/runtime/shell) [Child processes](https://bun.com/docs/api/spawn) [YAML](https://bun.com/docs/api/yaml) [HTMLRewriter](https://bun.com/docs/api/html-rewriter) [Hashing](https://bun.com/docs/api/hashing) [Console](https://bun.com/docs/api/console) [Cookie](https://bun.com/docs/api/cookie) [FFI](https://bun.com/docs/api/ffi) [C Compiler](https://bun.com/docs/api/cc) [Secrets](https://bun.com/docs/api/secrets) [Testing](https://bun.com/docs/cli/test) [Utils](https://bun.com/docs/api/utils) [Node-API](https://bun.com/docs/api/node-api) [Glob](https://bun.com/docs/api/glob) [DNS](https://bun.com/docs/api/dns) [Semver](https://bun.com/docs/api/semver) [Color](https://bun.com/docs/api/color) [Transpiler](https://bun.com/docs/api/transpiler)

Project

[Roadmap](https://bun.com/docs/project/roadmap) [Benchmarking](https://bun.com/docs/project/benchmarking) [Contributing](https://bun.com/docs/project/contributing) [Building Windows](https://bun.com/docs/project/building-windows) [Bindgen](https://bun.com/docs/project/bindgen) [License](https://bun.com/docs/project/licensing)

**Note** — The `Bun.file` and `Bun.write` APIs documented on this page are heavily optimized and represent the recommended way to perform file-system tasks using Bun. For operations that are not yet available with `Bun.file`, such as `mkdir` or `readdir`, you can use Bun's [nearly complete](https://bun.com/docs/runtime/nodejs-apis#node-fs) implementation of the [`node:fs`](https://nodejs.org/api/fs.html) module.

Bun provides a set of optimized APIs for reading and writing files.

## [Reading files ( `Bun.file()`)](https://bun.com/docs/api/file-io#reading-files-bun-file)

`Bun.file(path): BunFile`

Create a `BunFile` instance with the `Bun.file(path)` function. A `BunFile` represents a lazily-loaded file; initializing it does not actually read the file from disk.

```
const foo = Bun.file("foo.txt"); // relative to cwd
foo.size; // number of bytes
foo.type; // MIME type

```

The reference conforms to the [`Blob`](https://developer.mozilla.org/en-US/docs/Web/API/Blob) interface, so the contents can be read in various formats.

```
const foo = Bun.file("foo.txt");

await foo.text(); // contents as a string
await foo.stream(); // contents as ReadableStream
await foo.arrayBuffer(); // contents as ArrayBuffer
await foo.bytes(); // contents as Uint8Array

```

File references can also be created using numerical [file descriptors](https://en.wikipedia.org/wiki/File_descriptor) or `file://` URLs.

```
Bun.file(1234);
Bun.file(new URL(import.meta.url)); // reference to the current file

```

A `BunFile` can point to a location on disk where a file does not exist.

```
const notreal = Bun.file("notreal.txt");
notreal.size; // 0
notreal.type; // "text/plain;charset=utf-8"
const exists = await notreal.exists(); // false

```

The default MIME type is `text/plain;charset=utf-8`, but it can be overridden by passing a second argument to `Bun.file`.

```
const notreal = Bun.file("notreal.json", { type: "application/json" });
notreal.type; // => "application/json;charset=utf-8"

```

For convenience, Bun exposes `stdin`, `stdout` and `stderr` as instances of `BunFile`.

```
Bun.stdin; // readonly
Bun.stdout;
Bun.stderr;

```

### [Deleting files ( `file.delete()`)](https://bun.com/docs/api/file-io#deleting-files-file-delete)

You can delete a file by calling the `.delete()` function.

```
await Bun.file("logs.json").delete();

```

## [Writing files ( `Bun.write()`)](https://bun.com/docs/api/file-io#writing-files-bun-write)

`Bun.write(destination, data): Promise<number>`

The `Bun.write` function is a multi-tool for writing payloads of all kinds to disk.

The first argument is the `destination` which can have any of the following types:

- `string`: A path to a location on the file system. Use the `"path"` module to manipulate paths.
- `URL`: A `file://` descriptor.
- `BunFile`: A file reference.

The second argument is the data to be written. It can be any of the following:

- `string`
- `Blob` (including `BunFile`)
- `ArrayBuffer` or `SharedArrayBuffer`
- `TypedArray` ( `Uint8Array`, et. al.)
- `Response`

All possible permutations are handled using the fastest available system calls on the current platform.

See syscalls

| Output               | Input          | System call                   | Platform |
| -------------------- | -------------- | ----------------------------- | -------- |
| file                 | file           | copy_file_range               | Linux    |
| file                 | pipe           | sendfile                      | Linux    |
| pipe                 | pipe           | splice                        | Linux    |
| terminal             | file           | sendfile                      | Linux    |
| terminal             | terminal       | sendfile                      | Linux    |
| socket               | file or pipe   | sendfile (if http, not https) | Linux    |
| file (doesn't exist) | file (path)    | clonefile                     | macOS    |
| file (exists)        | file           | fcopyfile                     | macOS    |
| file                 | Blob or string | write                         | macOS    |
| file                 | Blob or string | write                         | Linux    |

To write a string to disk:

```
const data = `It was the best of times, it was the worst of times.`;
await Bun.write("output.txt", data);

```

To copy a file to another location on disk:

```
const input = Bun.file("input.txt");
const output = Bun.file("output.txt"); // doesn't exist yet!
await Bun.write(output, input);

```

To write a byte array to disk:

```
const encoder = new TextEncoder();
const data = encoder.encode("datadatadata"); // Uint8Array
await Bun.write("output.txt", data);

```

To write a file to `stdout`:

```
const input = Bun.file("input.txt");
await Bun.write(Bun.stdout, input);

```

To write the body of an HTTP response to disk:

```
const response = await fetch("https://bun.com");
await Bun.write("index.html", response);

```

## [Incremental writing with `FileSink`](https://bun.com/docs/api/file-io#incremental-writing-with-filesink)

Bun provides a native incremental file writing API called `FileSink`. To retrieve a `FileSink` instance from a `BunFile`:

```
const file = Bun.file("output.txt");
const writer = file.writer();

```

To incrementally write to the file, call `.write()`.

```
const file = Bun.file("output.txt");
const writer = file.writer();

writer.write("it was the best of times\n");
writer.write("it was the worst of times\n");

```

These chunks will be buffered internally. To flush the buffer to disk, use `.flush()`. This returns the number of flushed bytes.

```
writer.flush(); // write buffer to disk

```

The buffer will also auto-flush when the `FileSink`'s _high water mark_ is reached; that is, when its internal buffer is full. This value can be configured.

```
const file = Bun.file("output.txt");
const writer = file.writer({ highWaterMark: 1024 * 1024 }); // 1MB

```

To flush the buffer and close the file:

```
writer.end();

```

Note that, by default, the `bun` process will stay alive until this `FileSink` is explicitly closed with `.end()`. To opt out of this behavior, you can "unref" the instance.

```
writer.unref();

// to "re-ref" it later
writer.ref();

```

## [Directories](https://bun.com/docs/api/file-io#directories)

Bun's implementation of `node:fs` is fast, and we haven't implemented a Bun-specific API for reading directories just yet. For now, you should use `node:fs` for working with directories in Bun.

### [Reading directories (readdir)](https://bun.com/docs/api/file-io#reading-directories-readdir)

To read a directory in Bun, use `readdir` from `node:fs`.

```
import { readdir } from "node:fs/promises";

// read all the files in the current directory
const files = await readdir(import.meta.dir);

```

#### Reading directories recursively

To recursively read a directory in Bun, use `readdir` with `recursive: true`.

```
import { readdir } from "node:fs/promises";

// read all the files in the current directory, recursively
const files = await readdir("../", { recursive: true });

```

### [Creating directories (mkdir)](https://bun.com/docs/api/file-io#creating-directories-mkdir)

To recursively create a directory, use `mkdir` in `node:fs`:

```
import { mkdir } from "node:fs/promises";

await mkdir("path/to/dir", { recursive: true });

```

## [Benchmarks](https://bun.com/docs/api/file-io#benchmarks)

The following is a 3-line implementation of the Linux `cat` command.

cat.ts

```
// Usage
// $ bun ./cat.ts ./path-to-file

import { resolve } from "path";

const path = resolve(process.argv.at(-1));
await Bun.write(Bun.stdout, Bun.file(path));

```

To run the file:

```
bun ./cat.ts ./path-to-file
```

It runs 2x faster than GNU `cat` for large files on Linux.

[![](https://bun.com/images/cat.jpg)](https://bun.com/images/cat.jpg)

## [Reference](https://bun.com/docs/api/file-io#reference)

```
interface Bun {
  stdin: BunFile;
  stdout: BunFile;
  stderr: BunFile;

  file(path: string | number | URL, options?: { type?: string }): BunFile;

  write(
    destination: string | number | BunFile | URL,
    input:
      | string
      | Blob
      | ArrayBuffer
      | SharedArrayBuffer
      | TypedArray
      | Response,
  ): Promise<number>;
}

interface BunFile {
  readonly size: number;
  readonly type: string;

  text(): Promise<string>;
  stream(): ReadableStream;
  arrayBuffer(): Promise<ArrayBuffer>;
  json(): Promise<any>;
  writer(params: { highWaterMark?: number }): FileSink;
  exists(): Promise<boolean>;
}

export interface FileSink {
  write(
    chunk: string | ArrayBufferView | ArrayBuffer | SharedArrayBuffer,
  ): number;
  flush(): number | Promise<number>;
  end(error?: Error): number | Promise<number>;
  start(options?: { highWaterMark?: number }): void;
  ref(): void;
  unref(): void;
}

```

[Previous\\
\\
S3 Object Storage](https://bun.com/docs/api/s3) [Next\\
\\
Redis client](https://bun.com/docs/api/redis)

[![GitHub logo](Base64-Image-Removed)![GitHub logo](Base64-Image-Removed)\\
\\
Edit on GitHub](https://github.com/oven-sh/bun/edit/main/docs/api/file-io.md)

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
