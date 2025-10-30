---
title: Hashing – API | Bun Docs
url: 
description: Native support for a range of fast hashing algorithms.
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

[HTTP server](https://bun.com/docs/api/http) [HTTP client](https://bun.com/docs/api/fetch) [WebSockets](https://bun.com/docs/api/websockets) [Workers](https://bun.com/docs/api/workers) [Binary data](https://bun.com/docs/api/binary-data) [Streams](https://bun.com/docs/api/streams) [SQL](https://bun.com/docs/api/sql) [S3 Object Storage](https://bun.com/docs/api/s3) [File I/O](https://bun.com/docs/api/file-io) [Redis client](https://bun.com/docs/api/redis) [import.meta](https://bun.com/docs/api/import-meta) [SQLite](https://bun.com/docs/api/sqlite) [FileSystemRouter](https://bun.com/docs/api/file-system-router) [TCP sockets](https://bun.com/docs/api/tcp) [UDP sockets](https://bun.com/docs/api/udp) [Globals](https://bun.com/docs/api/globals) [$ Shell](https://bun.com/docs/runtime/shell) [Child processes](https://bun.com/docs/api/spawn) [YAML](https://bun.com/docs/api/yaml) [HTMLRewriter](https://bun.com/docs/api/html-rewriter) [Hashing](https://bun.com/docs/api/hashing)

[`Bun.password`](https://bun.com/docs/api/hashing#bun-password) [Salt](https://bun.com/docs/api/hashing#salt) [bcrypt - Modular Crypt Format](https://bun.com/docs/api/hashing#bcrypt-modular-crypt-format) [argon2 - PHC format](https://bun.com/docs/api/hashing#argon2-phc-format) [`Bun.hash`](https://bun.com/docs/api/hashing#bun-hash) [`Bun.CryptoHasher`](https://bun.com/docs/api/hashing#bun-cryptohasher) [HMAC in `Bun.CryptoHasher`](https://bun.com/docs/api/hashing#hmac-in-bun-cryptohasher)

[Console](https://bun.com/docs/api/console) [Cookie](https://bun.com/docs/api/cookie) [FFI](https://bun.com/docs/api/ffi) [C Compiler](https://bun.com/docs/api/cc) [Secrets](https://bun.com/docs/api/secrets) [Testing](https://bun.com/docs/cli/test) [Utils](https://bun.com/docs/api/utils) [Node-API](https://bun.com/docs/api/node-api) [Glob](https://bun.com/docs/api/glob) [DNS](https://bun.com/docs/api/dns) [Semver](https://bun.com/docs/api/semver) [Color](https://bun.com/docs/api/color) [Transpiler](https://bun.com/docs/api/transpiler)

Project

[Roadmap](https://bun.com/docs/project/roadmap) [Benchmarking](https://bun.com/docs/project/benchmarking) [Contributing](https://bun.com/docs/project/contributing) [Building Windows](https://bun.com/docs/project/building-windows) [Bindgen](https://bun.com/docs/project/bindgen) [License](https://bun.com/docs/project/licensing)

Bun implements the `createHash` and `createHmac` functions from [`node:crypto`](https://nodejs.org/api/crypto.html) in addition to the Bun-native APIs documented below.

## [`Bun.password`](https://bun.com/docs/api/hashing\#bun-password)

`Bun.password` is a collection of utility functions for hashing and verifying passwords with various cryptographically secure algorithms.

```
const password = "super-secure-pa$$word";

const hash = await Bun.password.hash(password);
// => $argon2id$v=19$m=65536,t=2,p=1$tFq+9AVr1bfPxQdh6E8DQRhEXg/M/SqYCNu6gVdRRNs$GzJ8PuBi+K+BVojzPfS5mjnC8OpLGtv8KJqF99eP6a4

const isMatch = await Bun.password.verify(password, hash);
// => true

```

The second argument to `Bun.password.hash` accepts a params object that lets you pick and configure the hashing algorithm.

```
const password = "super-secure-pa$$word";

// use argon2 (default)
const argonHash = await Bun.password.hash(password, {
  algorithm: "argon2id", // "argon2id" | "argon2i" | "argon2d"
  memoryCost: 4, // memory usage in kibibytes
  timeCost: 3, // the number of iterations
});

// use bcrypt
const bcryptHash = await Bun.password.hash(password, {
  algorithm: "bcrypt",
  cost: 4, // number between 4-31
});

```

The algorithm used to create the hash is stored in the hash itself. When using `bcrypt`, the returned hash is encoded in [Modular Crypt Format](https://passlib.readthedocs.io/en/stable/modular_crypt_format.html) for compatibility with most existing `bcrypt` implementations; with `argon2` the result is encoded in the newer [PHC format](https://github.com/P-H-C/phc-string-format/blob/master/phc-sf-spec.md).

The `verify` function automatically detects the algorithm based on the input hash and use the correct verification method. It can correctly infer the algorithm from both PHC- or MCF-encoded hashes.

```
const password = "super-secure-pa$$word";

const hash = await Bun.password.hash(password, {
  /* config */
});

const isMatch = await Bun.password.verify(password, hash);
// => true

```

Synchronous versions of all functions are also available. Keep in mind that these functions are computationally expensive, so using a blocking API may degrade application performance.

```
const password = "super-secure-pa$$word";

const hash = Bun.password.hashSync(password, {
  /* config */
});

const isMatch = Bun.password.verifySync(password, hash);
// => true

```

### [Salt](https://bun.com/docs/api/hashing\#salt)

When you use `Bun.password.hash`, a salt is automatically generated and included in the hash.

### [bcrypt - Modular Crypt Format](https://bun.com/docs/api/hashing\#bcrypt-modular-crypt-format)

In the following [Modular Crypt Format](https://passlib.readthedocs.io/en/stable/modular_crypt_format.html) hash (used by `bcrypt`):

Input:

```
await Bun.password.hash("hello", {
  algorithm: "bcrypt",
});

```

Output:

```
2b$10$Lyj9kHYZtiyfxh2G60TEfeqs7xkkGiEFFDi3iJGc50ZG/XJ1sxIFi;
```

The format is composed of:

- `bcrypt`: `$2b`
- `rounds`: `$10` \- rounds (log10 of the actual number of rounds)
- `salt`: `$Lyj9kHYZtiyfxh2G60TEfeqs7xkkGiEFFDi3iJGc50ZG/XJ1sxIFi`
- `hash`: `$GzJ8PuBi+K+BVojzPfS5mjnC8OpLGtv8KJqF99eP6a4`

By default, the bcrypt library truncates passwords longer than 72 bytes. In Bun, if you pass `Bun.password.hash` a password longer than 72 bytes and use the `bcrypt` algorithm, the password will be hashed via SHA-512 before being passed to bcrypt.

```
await Bun.password.hash("hello".repeat(100), {
  algorithm: "bcrypt",
});

```

So instead of sending bcrypt a 500-byte password silently truncated to 72 bytes, Bun will hash the password using SHA-512 and send the hashed password to bcrypt (only if it exceeds 72 bytes). This is a more secure default behavior.

### [argon2 - PHC format](https://bun.com/docs/api/hashing\#argon2-phc-format)

In the following [PHC format](https://github.com/P-H-C/phc-string-format/blob/master/phc-sf-spec.md) hash (used by `argon2`):

Input:

```
await Bun.password.hash("hello", {
  algorithm: "argon2id",
});

```

Output:

```
argon2id$v=19$m=65536,t=2,p=1$xXnlSvPh4ym5KYmxKAuuHVlDvy2QGHBNuI6bJJrRDOs$2YY6M48XmHn+s5NoBaL+ficzXajq2Yj8wut3r0vnrwI
```

The format is composed of:

- `algorithm`: `$argon2id`
- `version`: `$v=19`
- `memory cost`: `65536`
- `iterations`: `t=2`
- `parallelism`: `p=1`
- `salt`: `$xXnlSvPh4ym5KYmxKAuuHVlDvy2QGHBNuI6bJJrRDOs`
- `hash`: `$2YY6M48XmHn+s5NoBaL+ficzXajq2Yj8wut3r0vnrwI`

## [`Bun.hash`](https://bun.com/docs/api/hashing\#bun-hash)

`Bun.hash` is a collection of utilities for _non-cryptographic_ hashing. Non-cryptographic hashing algorithms are optimized for speed of computation over collision-resistance or security.

The standard `Bun.hash` functions uses [Wyhash](https://github.com/wangyi-fudan/wyhash) to generate a 64-bit hash from an input of arbitrary size.

```
Bun.hash("some data here");
// 11562320457524636935n

```

The input can be a string, `TypedArray`, `DataView`, `ArrayBuffer`, or `SharedArrayBuffer`.

```
const arr = new Uint8Array([1, 2, 3, 4]);

Bun.hash("some data here");
Bun.hash(arr);
Bun.hash(arr.buffer);
Bun.hash(new DataView(arr.buffer));

```

Optionally, an integer seed can be specified as the second parameter. For 64-bit hashes seeds above `Number.MAX_SAFE_INTEGER` should be given as BigInt to avoid loss of precision.

```
Bun.hash("some data here", 1234);
// 15724820720172937558n

```

Additional hashing algorithms are available as properties on `Bun.hash`. The API is the same for each, only changing the return type from number for 32-bit hashes to bigint for 64-bit hashes.

```
Bun.hash.wyhash("data", 1234); // equivalent to Bun.hash()
Bun.hash.crc32("data", 1234);
Bun.hash.adler32("data", 1234);
Bun.hash.cityHash32("data", 1234);
Bun.hash.cityHash64("data", 1234);
Bun.hash.xxHash32("data", 1234);
Bun.hash.xxHash64("data", 1234);
Bun.hash.xxHash3("data", 1234);
Bun.hash.murmur32v3("data", 1234);
Bun.hash.murmur32v2("data", 1234);
Bun.hash.murmur64v2("data", 1234);
Bun.hash.rapidhash("data", 1234);

```

## [`Bun.CryptoHasher`](https://bun.com/docs/api/hashing\#bun-cryptohasher)

`Bun.CryptoHasher` is a general-purpose utility class that lets you incrementally compute a hash of string or binary data using a range of cryptographic hash algorithms. The following algorithms are supported:

- `"blake2b256"`
- `"blake2b512"`
- `"md4"`
- `"md5"`
- `"ripemd160"`
- `"sha1"`
- `"sha224"`
- `"sha256"`
- `"sha384"`
- `"sha512"`
- `"sha512-224"`
- `"sha512-256"`
- `"sha3-224"`
- `"sha3-256"`
- `"sha3-384"`
- `"sha3-512"`
- `"shake128"`
- `"shake256"`

```
const hasher = new Bun.CryptoHasher("sha256");
hasher.update("hello world");
hasher.digest();
// Uint8Array(32) [ <byte>, <byte>, ... ]

```

Once initialized, data can be incrementally fed to to the hasher using `.update()`. This method accepts `string`, `TypedArray`, and `ArrayBuffer`.

```
const hasher = new Bun.CryptoHasher("sha256");

hasher.update("hello world");
hasher.update(new Uint8Array([1, 2, 3]));
hasher.update(new ArrayBuffer(10));

```

If a `string` is passed, an optional second parameter can be used to specify the encoding (default `'utf-8'`). The following encodings are supported:

| Binary encodings | `"base64"` `"base64url"` `"hex"` `"binary"` |
| Character encodings | `"utf8"` `"utf-8"` `"utf16le"` `"latin1"` |
| Legacy character encodings | `"ascii"` `"binary"` `"ucs2"` `"ucs-2"` |

```
hasher.update("hello world"); // defaults to utf8
hasher.update("hello world", "hex");
hasher.update("hello world", "base64");
hasher.update("hello world", "latin1");

```

After the data has been feed into the hasher, a final hash can be computed using `.digest()`. By default, this method returns a `Uint8Array` containing the hash.

```
const hasher = new Bun.CryptoHasher("sha256");
hasher.update("hello world");

hasher.digest();
// => Uint8Array(32) [ 185, 77, 39, 185, 147, ... ]

```

The `.digest()` method can optionally return the hash as a string. To do so, specify an encoding:

```
hasher.digest("base64");
// => "uU0nuZNNPgilLlLX2n2r+sSE7+N6U4DukIj3rOLvzek="

hasher.digest("hex");
// => "b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9"

```

Alternatively, the method can write the hash into a pre-existing `TypedArray` instance. This may be desirable in some performance-sensitive applications.

```
const arr = new Uint8Array(32);

hasher.digest(arr);

console.log(arr);
// => Uint8Array(32) [ 185, 77, 39, 185, 147, ... ]

```

### [HMAC in `Bun.CryptoHasher`](https://bun.com/docs/api/hashing\#hmac-in-bun-cryptohasher)

`Bun.CryptoHasher` can be used to compute HMAC digests. To do so, pass the key to the constructor.

```
const hasher = new Bun.CryptoHasher("sha256", "secret-key");
hasher.update("hello world");
console.log(hasher.digest("hex"));
// => "095d5a21fe6d0646db223fdf3de6436bb8dfb2fab0b51677ecf6441fcf5f2a67"

```

When using HMAC, a more limited set of algorithms are supported:

- `"blake2b512"`
- `"md5"`
- `"sha1"`
- `"sha224"`
- `"sha256"`
- `"sha384"`
- `"sha512-224"`
- `"sha512-256"`
- `"sha512"`

Unlike the non-HMAC `Bun.CryptoHasher`, the HMAC `Bun.CryptoHasher` instance is not reset after `.digest()` is called, and attempting to use the same instance again will throw an error.

Other methods like `.copy()` and `.update()` are supported (as long as it's before `.digest()`), but methods like `.digest()` that finalize the hasher are not.

```
const hasher = new Bun.CryptoHasher("sha256", "secret-key");
hasher.update("hello world");

const copy = hasher.copy();
copy.update("!");
console.log(copy.digest("hex"));
// => "3840176c3d8923f59ac402b7550404b28ab11cb0ef1fa199130a5c37864b5497"

console.log(hasher.digest("hex"));
// => "095d5a21fe6d0646db223fdf3de6436bb8dfb2fab0b51677ecf6441fcf5f2a67"

```

[Previous\\
\\
HTMLRewriter](https://bun.com/docs/api/html-rewriter) [Next\\
\\
Console](https://bun.com/docs/api/console)

[![GitHub logo](<Base64-Image-Removed>)![GitHub logo](<Base64-Image-Removed>)\\
\\
Edit on GitHub](https://github.com/oven-sh/bun/edit/main/docs/api/hashing.md)

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