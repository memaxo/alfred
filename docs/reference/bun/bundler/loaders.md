---
title: Loaders – Bundler | Bun Docs
url: 
description: Bun's built-in loaders for the bundler and runtime
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

[`Bun.build`](https://bun.com/docs/bundler) [HTML & static sites](https://bun.com/docs/bundler/html) [CSS](https://bun.com/docs/bundler/css) [Fullstack Dev Server](https://bun.com/docs/bundler/fullstack) [Hot reloading](https://bun.com/docs/bundler/hmr) [Loaders](https://bun.com/docs/bundler/loaders)

[Built-in loaders](https://bun.com/docs/bundler/loaders#built-in-loaders) [`js`](https://bun.com/docs/bundler/loaders#js) [`jsx`](https://bun.com/docs/bundler/loaders#jsx) [`ts`](https://bun.com/docs/bundler/loaders#ts) [`tsx`](https://bun.com/docs/bundler/loaders#tsx) [`json`](https://bun.com/docs/bundler/loaders#json) [`toml`](https://bun.com/docs/bundler/loaders#toml) [`yaml`](https://bun.com/docs/bundler/loaders#yaml) [`text`](https://bun.com/docs/bundler/loaders#text) [`napi`](https://bun.com/docs/bundler/loaders#napi) [`sqlite`](https://bun.com/docs/bundler/loaders#sqlite) [`html`](https://bun.com/docs/bundler/loaders#html) [`sh` loader](https://bun.com/docs/bundler/loaders#sh-loader) [`file`](https://bun.com/docs/bundler/loaders#file)

[Plugins](https://bun.com/docs/bundler/plugins) [Macros](https://bun.com/docs/bundler/macros) [vs esbuild](https://bun.com/docs/bundler/vs-esbuild)

Test runner

[`bun test`](https://bun.com/docs/cli/test) [Writing tests](https://bun.com/docs/test/writing) [Watch mode](https://bun.com/docs/test/hot) [Lifecycle hooks](https://bun.com/docs/test/lifecycle) [Mocks](https://bun.com/docs/test/mocks) [Snapshots](https://bun.com/docs/test/snapshots) [Dates and times](https://bun.com/docs/test/time) [Code coverage](https://bun.com/docs/test/coverage) [Test reporters](https://bun.com/docs/test/reporters) [Test configuration](https://bun.com/docs/test/configuration) [Runtime behavior](https://bun.com/docs/test/runtime-behavior) [Finding tests](https://bun.com/docs/test/discovery) [DOM testing](https://bun.com/docs/test/dom)

Package runner

[`bunx`](https://bun.com/docs/cli/bunx)

API

[HTTP server](https://bun.com/docs/api/http) [HTTP client](https://bun.com/docs/api/fetch) [WebSockets](https://bun.com/docs/api/websockets) [Workers](https://bun.com/docs/api/workers) [Binary data](https://bun.com/docs/api/binary-data) [Streams](https://bun.com/docs/api/streams) [SQL](https://bun.com/docs/api/sql) [S3 Object Storage](https://bun.com/docs/api/s3) [File I/O](https://bun.com/docs/api/file-io) [Redis client](https://bun.com/docs/api/redis) [import.meta](https://bun.com/docs/api/import-meta) [SQLite](https://bun.com/docs/api/sqlite) [FileSystemRouter](https://bun.com/docs/api/file-system-router) [TCP sockets](https://bun.com/docs/api/tcp) [UDP sockets](https://bun.com/docs/api/udp) [Globals](https://bun.com/docs/api/globals) [$ Shell](https://bun.com/docs/runtime/shell) [Child processes](https://bun.com/docs/api/spawn) [YAML](https://bun.com/docs/api/yaml) [HTMLRewriter](https://bun.com/docs/api/html-rewriter) [Hashing](https://bun.com/docs/api/hashing) [Console](https://bun.com/docs/api/console) [Cookie](https://bun.com/docs/api/cookie) [FFI](https://bun.com/docs/api/ffi) [C Compiler](https://bun.com/docs/api/cc) [Secrets](https://bun.com/docs/api/secrets) [Testing](https://bun.com/docs/cli/test) [Utils](https://bun.com/docs/api/utils) [Node-API](https://bun.com/docs/api/node-api) [Glob](https://bun.com/docs/api/glob) [DNS](https://bun.com/docs/api/dns) [Semver](https://bun.com/docs/api/semver) [Color](https://bun.com/docs/api/color) [Transpiler](https://bun.com/docs/api/transpiler)

Project

[Roadmap](https://bun.com/docs/project/roadmap) [Benchmarking](https://bun.com/docs/project/benchmarking) [Contributing](https://bun.com/docs/project/contributing) [Building Windows](https://bun.com/docs/project/building-windows) [Bindgen](https://bun.com/docs/project/bindgen) [License](https://bun.com/docs/project/licensing)

The Bun bundler implements a set of default loaders out of the box. As a rule of thumb, the bundler and the runtime both support the same set of file types out of the box.

`.js` `.cjs` `.mjs` `.mts` `.cts` `.ts` `.tsx` `.jsx` `.toml` `.json` `.yaml` `.yml` `.txt` `.wasm` `.node` `.html`

Bun uses the file extension to determine which built-in _loader_ should be used to parse the file. Every loader has a name, such as `js`, `tsx`, or `json`. These names are used when building [plugins](https://bun.com/docs/bundler/plugins) that extend Bun with custom loaders.

You can explicitly specify which loader to use using the 'loader' import attribute.

```
import my_toml from "./my_file" with { loader: "toml" };

```

## [Built-in loaders](https://bun.com/docs/bundler/loaders\#built-in-loaders)

### [`js`](https://bun.com/docs/bundler/loaders\#js)

**JavaScript**. Default for `.cjs` and `.mjs`.

Parses the code and applies a set of default transforms like dead-code elimination and tree shaking. Note that Bun does not attempt to down-convert syntax at the moment.

### [`jsx`](https://bun.com/docs/bundler/loaders\#jsx)

**JavaScript + JSX.**. Default for `.js` and `.jsx`.

Same as the `js` loader, but JSX syntax is supported. By default, JSX is down-converted to plain JavaScript; the details of how this is done depends on the `jsx*` compiler options in your `tsconfig.json`. Refer to the TypeScript documentation [on JSX](https://www.typescriptlang.org/docs/handbook/jsx.html) for more information.

### [`ts`](https://bun.com/docs/bundler/loaders\#ts)

**TypeScript loader**. Default for `.ts`, `.mts`, and `.cts`.

Strips out all TypeScript syntax, then behaves identically to the `js` loader. Bun does not perform typechecking.

### [`tsx`](https://bun.com/docs/bundler/loaders\#tsx)

**TypeScript + JSX loader**. Default for `.tsx`. Transpiles both TypeScript and JSX to vanilla JavaScript.

### [`json`](https://bun.com/docs/bundler/loaders\#json)

**JSON loader**. Default for `.json`.

JSON files can be directly imported.

```
import pkg from "./package.json";
pkg.name; // => "my-package"

```

During bundling, the parsed JSON is inlined into the bundle as a JavaScript object.

```
var pkg = {
  name: "my-package",
  // ... other fields
};
pkg.name;

```

If a `.json` file is passed as an entrypoint to the bundler, it will be converted to a `.js` module that `export default` s the parsed object.

Input

Output

Input

```
{
  "name": "John Doe",
  "age": 35,
  "email": "johndoe@example.com"
}

```

Output

```
export default {
  name: "John Doe",
  age: 35,
  email: "johndoe@example.com"
}

```

### [`toml`](https://bun.com/docs/bundler/loaders\#toml)

**TOML loader**. Default for `.toml`.

TOML files can be directly imported. Bun will parse them with its fast native TOML parser.

```
import config from "./bunfig.toml";
config.logLevel; // => "debug"

// via import attribute:
// import myCustomTOML from './my.config' with {type: "toml"};

```

During bundling, the parsed TOML is inlined into the bundle as a JavaScript object.

```
var config = {
  logLevel: "debug",
  // ...other fields
};
config.logLevel;

```

If a `.toml` file is passed as an entrypoint, it will be converted to a `.js` module that `export default` s the parsed object.

Input

Output

Input

```
name = "John Doe"
age = 35
email = "johndoe@example.com"

```

Output

```
export default {
  name: "John Doe",
  age: 35,
  email: "johndoe@example.com"
}

```

### [`yaml`](https://bun.com/docs/bundler/loaders\#yaml)

**YAML loader**. Default for `.yaml` and `.yml`.

YAML files can be directly imported. Bun will parse them with its fast native YAML parser.

```
import config from "./config.yaml";
config.database.host; // => "localhost"

// via import attribute:
// import myCustomYAML from './my.config' with {type: "yaml"};

```

During bundling, the parsed YAML is inlined into the bundle as a JavaScript object.

```
var config = {
  database: {
    host: "localhost",
    port: 5432,
  },
  // ...other fields
};
config.database.host;

```

If a `.yaml` or `.yml` file is passed as an entrypoint, it will be converted to a `.js` module that `export default` s the parsed object.

Input

Output

Input

```
name: John Doe
age: 35
email: johndoe@example.com

```

Output

```
export default {
  name: "John Doe",
  age: 35,
  email: "johndoe@example.com"
}

```

For more details on YAML support including the runtime API `Bun.YAML.parse()`, see the [YAML API documentation](https://bun.com/docs/api/yaml).

### [`text`](https://bun.com/docs/bundler/loaders\#text)

**Text loader**. Default for `.txt`.

The contents of the text file are read and inlined into the bundle as a string.Text files can be directly imported. The file is read and returned as a string.

```
import contents from "./file.txt";
console.log(contents); // => "Hello, world!"

// To import an html file as text
// The "type' attribute can be used to override the default loader.
import html from "./index.html" with { type: "text" };

```

When referenced during a build, the contents are inlined into the bundle as a string.

```
var contents = `Hello, world!`;
console.log(contents);

```

If a `.txt` file is passed as an entrypoint, it will be converted to a `.js` module that `export default` s the file contents.

Input

Output

Input

```
Hello, world!

```

Output

```
export default "Hello, world!";

```

### [`napi`](https://bun.com/docs/bundler/loaders\#napi)

**Native addon loader**. Default for `.node`.

In the runtime, native addons can be directly imported.

```
import addon from "./addon.node";
console.log(addon);

```

In the bundler, `.node` files are handled using the [`file`](https://bun.com/docs/bundler/loaders#file) loader.

### [`sqlite`](https://bun.com/docs/bundler/loaders\#sqlite)

**SQLite loader**. `with { "type": "sqlite" }` import attribute

In the runtime and bundler, SQLite databases can be directly imported. This will load the database using [`bun:sqlite`](https://bun.com/docs/api/sqlite).

```
import db from "./my.db" with { type: "sqlite" };

```

This is only supported when the `target` is `bun`.

By default, the database is external to the bundle (so that you can potentially use a database loaded elsewhere), so the database file on-disk won't be bundled into the final output.

You can change this behavior with the `"embed"` attribute:

```
// embed the database into the bundle
import db from "./my.db" with { type: "sqlite", embed: "true" };

```

When using a [standalone executable](https://bun.com/docs/bundler/executables), the database is embedded into the single-file executable.

Otherwise, the database to embed is copied into the `outdir` with a hashed filename.

### [`html`](https://bun.com/docs/bundler/loaders\#html)

The html loader processes HTML files and bundles any referenced assets. It will:

- Bundle and hash referenced JavaScript files ( `<script src="...">`)
- Bundle and hash referenced CSS files ( `<link rel="stylesheet" href="...">`)
- Hash referenced images ( `<img src="...">`)
- Preserve external URLs (by default, anything starting with `http://` or `https://`)

For example, given this HTML file:

src/index.html

src/index.html

```
<!DOCTYPE html>
<html>
  <body>
    <img src="./image.jpg" alt="Local image">
    <img src="https://example.com/image.jpg" alt="External image">
    <script type="module" src="./script.js"></script>
  </body>
</html>

```

It will output a new HTML file with the bundled assets:

dist/output.html

dist/output.html

```
<!DOCTYPE html>
<html>
  <body>
    <img src="./image-HASHED.jpg" alt="Local image">
    <img src="https://example.com/image.jpg" alt="External image">
    <script type="module" src="./output-ALSO-HASHED.js"></script>
  </body>
</html>

```

Under the hood, it uses [`lol-html`](https://github.com/cloudflare/lol-html) to extract script and link tags as entrypoints, and other assets as external.

Currently, the list of selectors is:

- `audio[src]`
- `iframe[src]`
- `img[src]`
- `img[srcset]`
- `link:not([rel~='stylesheet']):not([rel~='modulepreload']):not([rel~='manifest']):not([rel~='icon']):not([rel~='apple-touch-icon'])[href]`
- `link[as='font'][href], link[type^='font/'][href]`
- `link[as='image'][href]`
- `link[as='style'][href]`
- `link[as='video'][href], link[as='audio'][href]`
- `link[as='worker'][href]`
- `link[rel='icon'][href], link[rel='apple-touch-icon'][href]`
- `link[rel='manifest'][href]`
- `link[rel='stylesheet'][href]`
- `script[src]`
- `source[src]`
- `source[srcset]`
- `video[poster]`
- `video[src]`

**HTML Loader Behavior in Different Contexts**

The `html` loader behaves differently depending on how it's used:

1. **Static Build:** When you run `bun build ./index.html`, Bun produces a static site with all assets bundled and hashed.

2. **Runtime:** When you run `bun run server.ts` (where `server.ts` imports an HTML file), Bun bundles assets on-the-fly during development, enabling features like hot module replacement.

3. **Full-stack Build:** When you run `bun build --target=bun server.ts` (where `server.ts` imports an HTML file), the import resolves to a manifest object that `Bun.serve` uses to efficiently serve pre-bundled assets in production.


### [`sh` loader](https://bun.com/docs/bundler/loaders\#sh-loader)

**Bun Shell loader**. Default for `.sh` files

This loader is used to parse [Bun Shell](https://bun.com/docs/runtime/shell) scripts. It's only supported when starting Bun itself, so it's not available in the bundler or in the runtime.

```
bun run ./script.sh
```

### [`file`](https://bun.com/docs/bundler/loaders\#file)

**File loader**. Default for all unrecognized file types.

The file loader resolves the import as a _path/URL_ to the imported file. It's commonly used for referencing media or font assets.

logo.ts

```
import logo from "./logo.svg";
console.log(logo);

```

_In the runtime_, Bun checks that the `logo.svg` file exists and converts it to an absolute path to the location of `logo.svg` on disk.

```
bun run logo.ts
```

```
/path/to/project/logo.svg
```

_In the bundler_, things are slightly different. The file is copied into `outdir` as-is, and the import is resolved as a relative path pointing to the copied file.

Output

```
var logo = "./logo.svg";
console.log(logo);

```

If a value is specified for `publicPath`, the import will use value as a prefix to construct an absolute path/URL.

| Public path | Resolved import |
| --- | --- |
| `""` (default) | `/logo.svg` |
| `"/assets"` | `/assets/logo.svg` |
| `"https://cdn.example.com/"` | `https://cdn.example.com/logo.svg` |

The location and file name of the copied file is determined by the value of [`naming.asset`](https://bun.com/docs/bundler#naming).

This loader is copied into the `outdir` as-is. The name of the copied file is determined using the value of `naming.asset`.

Fixing TypeScript import errors

If you're using TypeScript, you may get an error like this:

```
// TypeScript error
// Cannot find module './logo.svg' or its corresponding type declarations.

```

This can be fixed by creating `*.d.ts` file anywhere in your project (any name will work) with the following contents:

```
declare module "*.svg" {
  const content: string;
  export default content;
}

```

This tells TypeScript that any default imports from `.svg` should be treated as a string.

[Previous\\
\\
Hot reloading](https://bun.com/docs/bundler/hmr) [Next\\
\\
Plugins](https://bun.com/docs/bundler/plugins)

[![GitHub logo](<Base64-Image-Removed>)![GitHub logo](<Base64-Image-Removed>)\\
\\
Edit on GitHub](https://github.com/oven-sh/bun/edit/main/docs/bundler/loaders.md)

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