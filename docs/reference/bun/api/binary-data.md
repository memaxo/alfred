---
title: Binary data – API | Bun Docs
url:
description: How to represent and manipulate binary data in Bun.
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

[HTTP server](https://bun.com/docs/api/http) [HTTP client](https://bun.com/docs/api/fetch) [WebSockets](https://bun.com/docs/api/websockets) [Workers](https://bun.com/docs/api/workers) [Binary data](https://bun.com/docs/api/binary-data)

[`ArrayBuffer` and views](https://bun.com/docs/api/binary-data#arraybuffer-and-views) [`DataView`](https://bun.com/docs/api/binary-data#dataview) [`TypedArray`](https://bun.com/docs/api/binary-data#typedarray) [`Uint8Array`](https://bun.com/docs/api/binary-data#uint8array) [`Buffer`](https://bun.com/docs/api/binary-data#buffer) [`Blob`](https://bun.com/docs/api/binary-data#blob) [`BunFile`](https://bun.com/docs/api/binary-data#bunfile) [`File`](https://bun.com/docs/api/binary-data#file) [Streams](https://bun.com/docs/api/binary-data#streams) [Conversion](https://bun.com/docs/api/binary-data#conversion) [From `ArrayBuffer`](https://bun.com/docs/api/binary-data#from-arraybuffer) [From `TypedArray`](https://bun.com/docs/api/binary-data#from-typedarray) [From `DataView`](https://bun.com/docs/api/binary-data#from-dataview) [From `Buffer`](https://bun.com/docs/api/binary-data#from-buffer) [From `Blob`](https://bun.com/docs/api/binary-data#from-blob) [From `ReadableStream`](https://bun.com/docs/api/binary-data#from-readablestream)

[Streams](https://bun.com/docs/api/streams) [SQL](https://bun.com/docs/api/sql) [S3 Object Storage](https://bun.com/docs/api/s3) [File I/O](https://bun.com/docs/api/file-io) [Redis client](https://bun.com/docs/api/redis) [import.meta](https://bun.com/docs/api/import-meta) [SQLite](https://bun.com/docs/api/sqlite) [FileSystemRouter](https://bun.com/docs/api/file-system-router) [TCP sockets](https://bun.com/docs/api/tcp) [UDP sockets](https://bun.com/docs/api/udp) [Globals](https://bun.com/docs/api/globals) [$ Shell](https://bun.com/docs/runtime/shell) [Child processes](https://bun.com/docs/api/spawn) [YAML](https://bun.com/docs/api/yaml) [HTMLRewriter](https://bun.com/docs/api/html-rewriter) [Hashing](https://bun.com/docs/api/hashing) [Console](https://bun.com/docs/api/console) [Cookie](https://bun.com/docs/api/cookie) [FFI](https://bun.com/docs/api/ffi) [C Compiler](https://bun.com/docs/api/cc) [Secrets](https://bun.com/docs/api/secrets) [Testing](https://bun.com/docs/cli/test) [Utils](https://bun.com/docs/api/utils) [Node-API](https://bun.com/docs/api/node-api) [Glob](https://bun.com/docs/api/glob) [DNS](https://bun.com/docs/api/dns) [Semver](https://bun.com/docs/api/semver) [Color](https://bun.com/docs/api/color) [Transpiler](https://bun.com/docs/api/transpiler)

Project

[Roadmap](https://bun.com/docs/project/roadmap) [Benchmarking](https://bun.com/docs/project/benchmarking) [Contributing](https://bun.com/docs/project/contributing) [Building Windows](https://bun.com/docs/project/building-windows) [Bindgen](https://bun.com/docs/project/bindgen) [License](https://bun.com/docs/project/licensing)

This page is intended as an introduction to working with binary data in JavaScript. Bun implements a number of data types and utilities for working with binary data, most of which are Web-standard. Any Bun-specific APIs will be noted as such.

Below is a quick "cheat sheet" that doubles as a table of contents. Click an item in the left column to jump to that section.

| [`TypedArray`](https://bun.com/docs/api/binary-data#typedarray) | A family of classes that provide an `Array`-like interface for interacting with binary data. Includes `Uint8Array`, `Uint16Array`, `Int8Array`, and more. |
| [`Buffer`](https://bun.com/docs/api/binary-data#buffer) | A subclass of `Uint8Array` that implements a wide range of convenience methods. Unlike the other elements in this table, this is a Node.js API (which Bun implements). It can't be used in the browser. |
| [`DataView`](https://bun.com/docs/api/binary-data#dataview) | A class that provides a `get/set` API for writing some number of bytes to an `ArrayBuffer` at a particular byte offset. Often used reading or writing binary protocols. |
| [`Blob`](https://bun.com/docs/api/binary-data#blob) | A readonly blob of binary data usually representing a file. Has a MIME `type`, a `size`, and methods for converting to `ArrayBuffer`, `ReadableStream`, and string. |
| [`File`](https://bun.com/docs/api/binary-data#file) | A subclass of `Blob` that represents a file. Has a `name` and `lastModified` timestamp. There is experimental support in Node.js v20. |
| [`BunFile`](https://bun.com/docs/api/binary-data#bunfile) | _Bun only_. A subclass of `Blob` that represents a lazily-loaded file on disk. Created with `Bun.file(path)`. |

## [`ArrayBuffer` and views](https://bun.com/docs/api/binary-data#arraybuffer-and-views)

Until 2009, there was no language-native way to store and manipulate binary data in JavaScript. ECMAScript v5 introduced a range of new mechanisms for this. The most fundamental building block is `ArrayBuffer`, a simple data structure that represents a sequence of bytes in memory.

```
// this buffer can store 8 bytes
const buf = new ArrayBuffer(8);

```

Despite the name, it isn't an array and supports none of the array methods and operators one might expect. In fact, there is no way to directly read or write values from an `ArrayBuffer`. There's very little you can do with one except check its size and create "slices" from it.

```
const buf = new ArrayBuffer(8);
buf.byteLength; // => 8

const slice = buf.slice(0, 4); // returns new ArrayBuffer
slice.byteLength; // => 4

```

To do anything interesting we need a construct known as a "view". A view is a class that _wraps_ an `ArrayBuffer` instance and lets you read and manipulate the underlying data. There are two types of views: _typed arrays_ and `DataView`.

### [`DataView`](https://bun.com/docs/api/binary-data#dataview)

The `DataView` class is a lower-level interface for reading and manipulating the data in an `ArrayBuffer`.

Below we create a new `DataView` and set the first byte to 3.

```
const buf = new ArrayBuffer(4);
// [0b00000000, 0b00000000, 0b00000000, 0b00000000]

const dv = new DataView(buf);
dv.setUint8(0, 3); // write value 3 at byte offset 0
dv.getUint8(0); // => 3
// [0b00000011, 0b00000000, 0b00000000, 0b00000000]

```

Now let's write a `Uint16` at byte offset `1`. This requires two bytes. We're using the value `513`, which is `2 * 256 + 1`; in bytes, that's `00000010 00000001`.

```
dv.setUint16(1, 513);
// [0b00000011, 0b00000010, 0b00000001, 0b00000000]

console.log(dv.getUint16(1)); // => 513

```

We've now assigned a value to the first three bytes in our underlying `ArrayBuffer`. Even though the second and third bytes were created using `setUint16()`, we can still read each of its component bytes using `getUint8()`.

```
console.log(dv.getUint8(1)); // => 2
console.log(dv.getUint8(2)); // => 1

```

Attempting to write a value that requires more space than is available in the underlying `ArrayBuffer` will cause an error. Below we attempt to write a `Float64` (which requires 8 bytes) at byte offset `0`, but there are only four total bytes in the buffer.

```
dv.setFloat64(0, 3.1415);
// ^ RangeError: Out of bounds access

```

The following methods are available on `DataView`:

| Getters                                                                                                                    | Setters                                                                                                                    |
| -------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| [`getBigInt64()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/DataView/getBigInt64)   | [`setBigInt64()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/DataView/setBigInt64)   |
| [`getBigUint64()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/DataView/getBigUint64) | [`setBigUint64()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/DataView/setBigUint64) |
| [`getFloat32()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/DataView/getFloat32)     | [`setFloat32()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/DataView/setFloat32)     |
| [`getFloat64()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/DataView/getFloat64)     | [`setFloat64()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/DataView/setFloat64)     |
| [`getInt16()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/DataView/getInt16)         | [`setInt16()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/DataView/setInt16)         |
| [`getInt32()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/DataView/getInt32)         | [`setInt32()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/DataView/setInt32)         |
| [`getInt8()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/DataView/getInt8)           | [`setInt8()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/DataView/setInt8)           |
| [`getUint16()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/DataView/getUint16)       | [`setUint16()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/DataView/setUint16)       |
| [`getUint32()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/DataView/getUint32)       | [`setUint32()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/DataView/setUint32)       |
| [`getUint8()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/DataView/getUint8)         | [`setUint8()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/DataView/setUint8)         |

### [`TypedArray`](https://bun.com/docs/api/binary-data#typedarray)

Typed arrays are a family of classes that provide an `Array`-like interface for interacting with data in an `ArrayBuffer`. Whereas a `DataView` lets you write numbers of varying size at a particular offset, a `TypedArray` interprets the underlying bytes as an array of numbers, each of a fixed size.

**Note** — It's common to refer to this family of classes collectively by their shared superclass `TypedArray`. This class as _internal_ to JavaScript; you can't directly create instances of it, and `TypedArray` is not defined in the global scope. Think of it as an `interface` or an abstract class.

```
const buffer = new ArrayBuffer(3);
const arr = new Uint8Array(buffer);

// contents are initialized to zero
console.log(arr); // Uint8Array(3) [0, 0, 0]

// assign values like an array
arr[0] = 0;
arr[1] = 10;
arr[2] = 255;
arr[3] = 255; // no-op, out of bounds

```

While an `ArrayBuffer` is a generic sequence of bytes, these typed array classes interpret the bytes as an array of numbers of a given byte size.The top row contains the raw bytes, and the later rows contain how these bytes will be interpreted when _viewed_ using different typed array classes.

The following classes are typed arrays, along with a description of how they interpret the bytes in an `ArrayBuffer`:

| Class                                                                                                                     | Description                                                                                                                                                                |
| ------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`Uint8Array`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Uint8Array)               | Every one (1) byte is interpreted as an unsigned 8-bit integer. Range 0 to 255.                                                                                            |
| [`Uint16Array`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Uint16Array)             | Every two (2) bytes are interpreted as an unsigned 16-bit integer. Range 0 to 65535.                                                                                       |
| [`Uint32Array`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Uint32Array)             | Every four (4) bytes are interpreted as an unsigned 32-bit integer. Range 0 to 4294967295.                                                                                 |
| [`Int8Array`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Int8Array)                 | Every one (1) byte is interpreted as a signed 8-bit integer. Range -128 to 127.                                                                                            |
| [`Int16Array`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Int16Array)               | Every two (2) bytes are interpreted as a signed 16-bit integer. Range -32768 to 32767.                                                                                     |
| [`Int32Array`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Int32Array)               | Every four (4) bytes are interpreted as a signed 32-bit integer. Range -2147483648 to 2147483647.                                                                          |
| [`Float16Array`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Float16Array)           | Every two (2) bytes are interpreted as a 16-bit floating point number. Range -6.104e5 to 6.55e4.                                                                           |
| [`Float32Array`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Float32Array)           | Every four (4) bytes are interpreted as a 32-bit floating point number. Range -3.4e38 to 3.4e38.                                                                           |
| [`Float64Array`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Float64Array)           | Every eight (8) bytes are interpreted as a 64-bit floating point number. Range -1.7e308 to 1.7e308.                                                                        |
| [`BigInt64Array`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/BigInt64Array)         | Every eight (8) bytes are interpreted as a signed `BigInt`. Range -9223372036854775808 to 9223372036854775807 (though `BigInt` is capable of representing larger numbers). |
| [`BigUint64Array`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/BigUint64Array)       | Every eight (8) bytes are interpreted as an unsigned `BigInt`. Range 0 to 18446744073709551615 (though `BigInt` is capable of representing larger numbers).                |
| [`Uint8ClampedArray`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Uint8ClampedArray) | Same as `Uint8Array`, but automatically "clamps" to the range 0-255 when assigning a value to an element.                                                                  |

The table below demonstrates how the bytes in an `ArrayBuffer` are interpreted when viewed using different typed array classes.

| `ArrayBuffer` | `00000000` | `00000001` | `00000010` | `00000011` | `00000100` | `00000101` | `00000110` | `00000111` |
| `Uint8Array` | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 |
| `Uint16Array` | 256 ( `1 * 256 + 0`) | 770 ( `3 * 256 + 2`) | 1284 ( `5 * 256 + 4`) | 1798 ( `7 * 256 + 6`) |
| `Uint32Array` | 50462976 | 117835012 |
| `BigUint64Array` | 506097522914230528n |

To create a typed array from a pre-defined `ArrayBuffer`:

```
// create typed array from ArrayBuffer
const buf = new ArrayBuffer(10);
const arr = new Uint8Array(buf);

arr[0] = 30;
arr[1] = 60;

// all elements are initialized to zero
console.log(arr); // => Uint8Array(10) [ 30, 60, 0, 0, 0, 0, 0, 0, 0, 0 ];

```

If we tried to instantiate a `Uint32Array` from this same `ArrayBuffer`, we'd get an error.

```
const buf = new ArrayBuffer(10);
const arr = new Uint32Array(buf);
//          ^  RangeError: ArrayBuffer length minus the byteOffset
//             is not a multiple of the element size

```

A `Uint32` value requires four bytes (16 bits). Because the `ArrayBuffer` is 10 bytes long, there's no way to cleanly divide its contents into 4-byte chunks.

To fix this, we can create a typed array over a particular "slice" of an `ArrayBuffer`. The `Uint16Array` below only "views" the _first_ 8 bytes of the underlying `ArrayBuffer`. To achieve these, we specify a `byteOffset` of `0` and a `length` of `2`, which indicates the number of `Uint32` numbers we want our array to hold.

```
// create typed array from ArrayBuffer slice
const buf = new ArrayBuffer(10);
const arr = new Uint32Array(buf, 0, 2);

/*
  buf    _ _ _ _ _ _ _ _ _ _    10 bytes
  arr   [_______,_______]       2 4-byte elements
*/

arr.byteOffset; // 0
arr.length; // 2

```

You don't need to explicitly create an `ArrayBuffer` instance; you can instead directly specify a length in the typed array constructor:

```
const arr2 = new Uint8Array(5);

// all elements are initialized to zero
// => Uint8Array(5) [0, 0, 0, 0, 0]

```

Typed arrays can also be instantiated directly from an array of numbers, or another typed array:

```
// from an array of numbers
const arr1 = new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7]);
arr1[0]; // => 0;
arr1[7]; // => 7;

// from another typed array
const arr2 = new Uint8Array(arr);

```

Broadly speaking, typed arrays provide the same methods as regular arrays, with a few exceptions. For example, `push` and `pop` are not available on typed arrays, because they would require resizing the underlying `ArrayBuffer`.

```
const arr = new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7]);

// supports common array methods
arr.filter(n => n > 128); // Uint8Array(1) [255]
arr.map(n => n * 2); // Uint8Array(8) [0, 2, 4, 6, 8, 10, 12, 14]
arr.reduce((acc, n) => acc + n, 0); // 28
arr.forEach(n => console.log(n)); // 0 1 2 3 4 5 6 7
arr.every(n => n < 10); // true
arr.find(n => n > 5); // 6
arr.includes(5); // true
arr.indexOf(5); // 5

```

Refer to the [MDN documentation](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/TypedArray) for more information on the properties and methods of typed arrays.

### [`Uint8Array`](https://bun.com/docs/api/binary-data#uint8array)

It's worth specifically highlighting `Uint8Array`, as it represents a classic "byte array"—a sequence of 8-bit unsigned integers between 0 and 255. This is the most common typed array you'll encounter in JavaScript.

In Bun, and someday in other JavaScript engines, it has methods available for converting between byte arrays and serialized representations of those arrays as base64 or hex strings.

```
new Uint8Array([1, 2, 3, 4, 5]).toBase64(); // "AQIDBA=="
Uint8Array.fromBase64("AQIDBA=="); // Uint8Array(4) [1, 2, 3, 4, 5]

new Uint8Array([255, 254, 253, 252, 251]).toHex(); // "fffefdfcfb=="
Uint8Array.fromHex("fffefdfcfb"); // Uint8Array(5) [255, 254, 253, 252, 251]

```

It is the return value of [`TextEncoder#encode`](https://developer.mozilla.org/en-US/docs/Web/API/TextEncoder), and the input type of [`TextDecoder#decode`](https://developer.mozilla.org/en-US/docs/Web/API/TextDecoder), two utility classes designed to translate strings and various binary encodings, most notably `"utf-8"`.

```
const encoder = new TextEncoder();
const bytes = encoder.encode("hello world");
// => Uint8Array(11) [ 104, 101, 108, 108, 111, 32, 119, 111, 114, 108, 100 ]

const decoder = new TextDecoder();
const text = decoder.decode(bytes);
// => hello world

```

### [`Buffer`](https://bun.com/docs/api/binary-data#buffer)

Bun implements `Buffer`, a Node.js API for working with binary data that pre-dates the introduction of typed arrays in the JavaScript spec. It has since been re-implemented as a subclass of `Uint8Array`. It provides a wide range of methods, including several Array-like and `DataView`-like methods.

```
const buf = Buffer.from("hello world");
// => Buffer(11) [ 104, 101, 108, 108, 111, 32, 119, 111, 114, 108, 100 ]

buf.length; // => 11
buf[0]; // => 104, ascii for 'h'
buf.writeUInt8(72, 0); // => ascii for 'H'

console.log(buf.toString());
// => Hello world

```

For complete documentation, refer to the [Node.js documentation](https://nodejs.org/api/buffer.html).

## [`Blob`](https://bun.com/docs/api/binary-data#blob)

`Blob` is a Web API commonly used for representing files. `Blob` was initially implemented in browsers (unlike `ArrayBuffer` which is part of JavaScript itself), but it is now supported in Node and Bun.

It isn't common to directly create `Blob` instances. More often, you'll receive instances of `Blob` from an external source (like an `<input type="file">` element in the browser) or library. That said, it is possible to create a `Blob` from one or more string or binary "blob parts".

```
const blob = new Blob(["<html>Hello</html>"], {
  type: "text/html",
});

blob.type; // => text/html
blob.size; // => 19

```

These parts can be `string`, `ArrayBuffer`, `TypedArray`, `DataView`, or other `Blob` instances. The blob parts are concatenated together in the order they are provided.

```
const blob = new Blob([\
  "<html>",\
  new Blob(["<body>"]),\
  new Uint8Array([104, 101, 108, 108, 111]), // "hello" in binary\
  "</body></html>",\
]);

```

The contents of a `Blob` can be asynchronously read in various formats.

```
await blob.text(); // => <html><body>hello</body></html>
await blob.bytes(); // => Uint8Array (copies contents)
await blob.arrayBuffer(); // => ArrayBuffer (copies contents)
await blob.stream(); // => ReadableStream

```

### [`BunFile`](https://bun.com/docs/api/binary-data#bunfile)

`BunFile` is a subclass of `Blob` used to represent a lazily-loaded file on disk. Like `File`, it adds a `name` and `lastModified` property. Unlike `File`, it does not require the file to be loaded into memory.

```
const file = Bun.file("index.txt");
// => BunFile

```

### [`File`](https://bun.com/docs/api/binary-data#file)

Browser only. Experimental support in Node.js 20.

[`File`](https://developer.mozilla.org/en-US/docs/Web/API/File) is a subclass of `Blob` that adds a `name` and `lastModified` property. It's commonly used in the browser to represent files uploaded via a `<input type="file">` element. Node.js and Bun implement `File`.

```
// on browser!
// <input type="file" id="file" />

const files = document.getElementById("file").files;
// => File[]

```

```
const file = new File(["<html>Hello</html>"], "index.html", {
  type: "text/html",
});

```

Refer to the [MDN documentation](https://developer.mozilla.org/en-US/docs/Web/API/Blob) for complete docs information.

## [Streams](https://bun.com/docs/api/binary-data#streams)

Streams are an important abstraction for working with binary data without loading it all into memory at once. They are commonly used for reading and writing files, sending and receiving network requests, and processing large amounts of data.

Bun implements the Web APIs [`ReadableStream`](https://developer.mozilla.org/en-US/docs/Web/API/ReadableStream) and [`WritableStream`](https://developer.mozilla.org/en-US/docs/Web/API/ReadableStream).

Bun also implements the `node:stream` module, including [`Readable`](https://nodejs.org/api/stream.html#stream_readable_streams), [`Writable`](https://nodejs.org/api/stream.html#stream_writable_streams), and [`Duplex`](https://nodejs.org/api/stream.html#stream_duplex_and_transform_streams). For complete documentation, refer to the Node.js docs.

To create a simple readable stream:

```
const stream = new ReadableStream({
  start(controller) {
    controller.enqueue("hello");
    controller.enqueue("world");
    controller.close();
  },
});

```

The contents of this stream can be read chunk-by-chunk with `for await` syntax.

```
for await (const chunk of stream) {
  console.log(chunk);
  // => "hello"
  // => "world"
}

```

For a more complete discussion of streams in Bun, see [API > Streams](https://bun.com/docs/api/streams).

## [Conversion](https://bun.com/docs/api/binary-data#conversion)

Converting from one binary format to another is a common task. This section is intended as a reference.

### [From `ArrayBuffer`](https://bun.com/docs/api/binary-data#from-arraybuffer)

Since `ArrayBuffer` stores the data that underlies other binary structures like `TypedArray`, the snippets below are not _converting_ from `ArrayBuffer` to another format. Instead, they are _creating_ a new instance using the data stored underlying data.

#### To `TypedArray`

```
new Uint8Array(buf);

```

#### To `DataView`

```
new DataView(buf);

```

#### To `Buffer`

```
// create Buffer over entire ArrayBuffer
Buffer.from(buf);

// create Buffer over a slice of the ArrayBuffer
Buffer.from(buf, 0, 10);

```

#### To `string`

As UTF-8:

```
new TextDecoder().decode(buf);

```

#### To `number[]`

```
Array.from(new Uint8Array(buf));

```

#### To `Blob`

```
new Blob([buf], { type: "text/plain" });

```

#### To `ReadableStream`

The following snippet creates a `ReadableStream` and enqueues the entire `ArrayBuffer` as a single chunk.

```
new ReadableStream({
  start(controller) {
    controller.enqueue(buf);
    controller.close();
  },
});

```

With chunking

To stream the `ArrayBuffer` in chunks, use a `Uint8Array` view and enqueue each chunk.

```
const view = new Uint8Array(buf);
const chunkSize = 1024;

new ReadableStream({
  start(controller) {
    for (let i = 0; i < view.length; i += chunkSize) {
      controller.enqueue(view.slice(i, i + chunkSize));
    }
    controller.close();
  },
});

```

### [From `TypedArray`](https://bun.com/docs/api/binary-data#from-typedarray)

#### To `ArrayBuffer`

This retrieves the underlying `ArrayBuffer`. Note that a `TypedArray` can be a view of a _slice_ of the underlying buffer, so the sizes may differ.

```
arr.buffer;

```

#### To `DataView`

To creates a `DataView` over the same byte range as the TypedArray.

```
new DataView(arr.buffer, arr.byteOffset, arr.byteLength);

```

#### To `Buffer`

```
Buffer.from(arr);

```

#### To `string`

As UTF-8:

```
new TextDecoder().decode(arr);

```

#### To `number[]`

```
Array.from(arr);

```

#### To `Blob`

```
// only if arr is a view of its entire backing TypedArray
new Blob([arr.buffer], { type: "text/plain" });

```

#### To `ReadableStream`

```
new ReadableStream({
  start(controller) {
    controller.enqueue(arr);
    controller.close();
  },
});

```

With chunking

To stream the `ArrayBuffer` in chunks, split the `TypedArray` into chunks and enqueue each one individually.

```
new ReadableStream({
  start(controller) {
    for (let i = 0; i < arr.length; i += chunkSize) {
      controller.enqueue(arr.slice(i, i + chunkSize));
    }
    controller.close();
  },
});

```

### [From `DataView`](https://bun.com/docs/api/binary-data#from-dataview)

#### To `ArrayBuffer`

```
view.buffer;

```

#### To `TypedArray`

Only works if the `byteLength` of the `DataView` is a multiple of the `BYTES_PER_ELEMENT` of the `TypedArray` subclass.

```
new Uint8Array(view.buffer, view.byteOffset, view.byteLength);
new Uint16Array(view.buffer, view.byteOffset, view.byteLength / 2);
new Uint32Array(view.buffer, view.byteOffset, view.byteLength / 4);
// etc...

```

#### To `Buffer`

```
Buffer.from(view.buffer, view.byteOffset, view.byteLength);

```

#### To `string`

As UTF-8:

```
new TextDecoder().decode(view);

```

#### To `number[]`

```
Array.from(view);

```

#### To `Blob`

```
new Blob([view.buffer], { type: "text/plain" });

```

#### To `ReadableStream`

```
new ReadableStream({
  start(controller) {
    controller.enqueue(view.buffer);
    controller.close();
  },
});

```

With chunking

To stream the `ArrayBuffer` in chunks, split the `DataView` into chunks and enqueue each one individually.

```
new ReadableStream({
  start(controller) {
    for (let i = 0; i < view.byteLength; i += chunkSize) {
      controller.enqueue(view.buffer.slice(i, i + chunkSize));
    }
    controller.close();
  },
});

```

### [From `Buffer`](https://bun.com/docs/api/binary-data#from-buffer)

#### To `ArrayBuffer`

```
buf.buffer;

```

#### To `TypedArray`

```
new Uint8Array(buf);

```

#### To `DataView`

```
new DataView(buf.buffer, buf.byteOffset, buf.byteLength);

```

#### To `string`

As UTF-8:

```
buf.toString();

```

As base64:

```
buf.toString("base64");

```

As hex:

```
buf.toString("hex");

```

#### To `number[]`

```
Array.from(buf);

```

#### To `Blob`

```
new Blob([buf], { type: "text/plain" });

```

#### To `ReadableStream`

```
new ReadableStream({
  start(controller) {
    controller.enqueue(buf);
    controller.close();
  },
});

```

With chunking

To stream the `ArrayBuffer` in chunks, split the `Buffer` into chunks and enqueue each one individually.

```
new ReadableStream({
  start(controller) {
    for (let i = 0; i < buf.length; i += chunkSize) {
      controller.enqueue(buf.slice(i, i + chunkSize));
    }
    controller.close();
  },
});

```

### [From `Blob`](https://bun.com/docs/api/binary-data#from-blob)

#### To `ArrayBuffer`

The `Blob` class provides a convenience method for this purpose.

```
await blob.arrayBuffer();

```

#### To `TypedArray`

```
await blob.bytes();

```

#### To `DataView`

```
new DataView(await blob.arrayBuffer());

```

#### To `Buffer`

```
Buffer.from(await blob.arrayBuffer());

```

#### To `string`

As UTF-8:

```
await blob.text();

```

#### To `number[]`

```
Array.from(await blob.bytes());

```

#### To `ReadableStream`

```
blob.stream();

```

### [From `ReadableStream`](https://bun.com/docs/api/binary-data#from-readablestream)

It's common to use [`Response`](https://developer.mozilla.org/en-US/docs/Web/API/Response) as a convenient intermediate representation to make it easier to convert `ReadableStream` to other formats.

```
stream; // ReadableStream

const buffer = new Response(stream).arrayBuffer();

```

However this approach is verbose and adds overhead that slows down overall performance unnecessarily. Bun implements a set of optimized convenience functions for converting `ReadableStream` various binary formats.

#### To `ArrayBuffer`

```
// with Response
new Response(stream).arrayBuffer();

// with Bun function
Bun.readableStreamToArrayBuffer(stream);

```

#### To `Uint8Array`

```
// with Response
new Response(stream).bytes();

// with Bun function
Bun.readableStreamToBytes(stream);

```

#### To `TypedArray`

```
// with Response
const buf = await new Response(stream).arrayBuffer();
new Int8Array(buf);

// with Bun function
new Int8Array(Bun.readableStreamToArrayBuffer(stream));

```

#### To `DataView`

```
// with Response
const buf = await new Response(stream).arrayBuffer();
new DataView(buf);

// with Bun function
new DataView(Bun.readableStreamToArrayBuffer(stream));

```

#### To `Buffer`

```
// with Response
const buf = await new Response(stream).arrayBuffer();
Buffer.from(buf);

// with Bun function
Buffer.from(Bun.readableStreamToArrayBuffer(stream));

```

#### To `string`

As UTF-8:

```
// with Response
await new Response(stream).text();

// with Bun function
await Bun.readableStreamToText(stream);

```

#### To `number[]`

```
// with Response
const arr = await new Response(stream).bytes();
Array.from(arr);

// with Bun function
Array.from(new Uint8Array(Bun.readableStreamToArrayBuffer(stream)));

```

Bun provides a utility for resolving a `ReadableStream` to an array of its chunks. Each chunk may be a string, typed array, or `ArrayBuffer`.

```
// with Bun function
Bun.readableStreamToArray(stream);

```

#### To `Blob`

```
new Response(stream).blob();

```

#### To `ReadableStream`

To split a `ReadableStream` into two streams that can be consumed independently:

```
const [a, b] = stream.tee();

```

[Previous\\
\\
Workers](https://bun.com/docs/api/workers) [Next\\
\\
Streams](https://bun.com/docs/api/streams)

[![GitHub logo](Base64-Image-Removed)![GitHub logo](Base64-Image-Removed)\\
\\
Edit on GitHub](https://github.com/oven-sh/bun/edit/main/docs/api/binary-data.md)

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
