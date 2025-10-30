---
title: Plugins – Runtime | Bun Docs
url: 
description: Implement custom loaders and module resolution logic with Bun's plugin system.
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

[`bun run`](https://bun.com/docs/cli/run) [File types](https://bun.com/docs/runtime/loaders) [TypeScript](https://bun.com/docs/runtime/typescript) [JSX](https://bun.com/docs/runtime/jsx) [Environment variables](https://bun.com/docs/runtime/env) [Bun APIs](https://bun.com/docs/runtime/bun-apis) [Web APIs](https://bun.com/docs/runtime/web-apis) [Node.js compatibility](https://bun.com/docs/runtime/nodejs-apis) [Single-file executable](https://bun.com/docs/bundler/executables) [Plugins](https://bun.com/docs/runtime/plugins)

[Usage](https://bun.com/docs/runtime/plugins#usage) [Plugin conventions](https://bun.com/docs/runtime/plugins#plugin-conventions) [Loaders](https://bun.com/docs/runtime/plugins#loaders) [Virtual Modules](https://bun.com/docs/runtime/plugins#virtual-modules) [Overriding existing modules](https://bun.com/docs/runtime/plugins#overriding-existing-modules) [Reading or modifying the config](https://bun.com/docs/runtime/plugins#reading-or-modifying-the-config) [Lifecycle hooks](https://bun.com/docs/runtime/plugins#lifecycle-hooks) [Reference](https://bun.com/docs/runtime/plugins#reference) [Namespaces](https://bun.com/docs/runtime/plugins#namespaces) [`onStart`](https://bun.com/docs/runtime/plugins#onstart) [`onResolve`](https://bun.com/docs/runtime/plugins#onresolve) [`onLoad`](https://bun.com/docs/runtime/plugins#onload)

[Watch mode](https://bun.com/docs/runtime/hot) [Module resolution](https://bun.com/docs/runtime/modules) [Auto-install](https://bun.com/docs/runtime/autoimport) [bunfig.toml](https://bun.com/docs/runtime/bunfig) [Debugger](https://bun.com/docs/runtime/debugger)

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

Bun provides a universal plugin API that can be used to extend both the _runtime_ and [_bundler_](https://bun.com/docs/bundler).

Plugins intercept imports and perform custom loading logic: reading files, transpiling code, etc. They can be used to add support for additional file types, like `.scss` or `.yaml`. In the context of Bun's bundler, plugins can be used to implement framework-level features like CSS extraction, macros, and client-server code co-location.

## [Usage](https://bun.com/docs/runtime/plugins\#usage)

A plugin is defined as simple JavaScript object containing a `name` property and a `setup` function. Register a plugin with Bun using the `plugin` function.

myPlugin.ts

```
import { plugin, type BunPlugin } from "bun";

const myPlugin: BunPlugin = {
  name: "Custom loader",
  setup(build) {
    // implementation
  },
};

plugin(myPlugin);

```

Plugins have to be loaded before any other code runs! To achieve this, use the `preload` option in your [`bunfig.toml`](https://bun.com/docs/runtime/bunfig). Bun automatically loads the files/modules specified in `preload` before running a file.

```
preload = ["./myPlugin.ts"]

```

Preloads can be either local files or npm packages. Anything that can be imported/required can be preloaded.

```
preload = ["bun-plugin-foo"]

```

To preload files before `bun test`:

```
[test]
preload = ["./myPlugin.ts"]

```

## [Plugin conventions](https://bun.com/docs/runtime/plugins\#plugin-conventions)

By convention, third-party plugins intended for consumption should export a factory function that accepts some configuration and returns a plugin object.

```
import { plugin } from "bun";
import fooPlugin from "bun-plugin-foo";

plugin(
  fooPlugin({
    // configuration
  }),
);

```

Bun's plugin API is loosely based on [esbuild](https://esbuild.github.io/plugins). Only [a subset](https://bun.com/docs/bundler/vs-esbuild#plugin-api) of the esbuild API is implemented, but some esbuild plugins "just work" in Bun, like the official [MDX loader](https://mdxjs.com/packages/esbuild/):

```
import { plugin } from "bun";
import mdx from "@mdx-js/esbuild";

plugin(mdx());

```

## [Loaders](https://bun.com/docs/runtime/plugins\#loaders)

Plugins are primarily used to extend Bun with loaders for additional file types. Let's look at a simple plugin that implements a loader for `.yaml` files.

yamlPlugin.ts

```
import { plugin } from "bun";

await plugin({
  name: "YAML",
  async setup(build) {
    const { load } = await import("js-yaml");

    // when a .yaml file is imported...
    build.onLoad({ filter: /\.(yaml|yml)$/ }, async (args) => {

      // read and parse the file
      const text = await Bun.file(args.path).text();
      const exports = load(text) as Record<string, any>;

      // and returns it as a module
      return {
        exports,
        loader: "object", // special loader for JS objects
      };
    });
  },
});

```

Register this file in `preload`:

bunfig.toml

```
preload = ["./yamlPlugin.ts"]

```

Once the plugin is registered, `.yaml` and `.yml` files can be directly imported.

index.ts

data.yml

index.ts

```
import * as data from "./data.yml"

console.log(data);

```

data.yml

```
name: Fast X
releaseYear: 2023

```

Note that the returned object has a `loader` property. This tells Bun which of its internal loaders should be used to handle the result. Even though we're implementing a loader for `.yaml`, the result must still be understandable by one of Bun's built-in loaders. It's loaders all the way down.

In this case we're using `"object"`—a built-in loader (intended for use by plugins) that converts a plain JavaScript object to an equivalent ES module. Any of Bun's built-in loaders are supported; these same loaders are used by Bun internally for handling files of various kinds. The table below is a quick reference; refer to [Bundler > Loaders](https://bun.com/docs/bundler/loaders) for complete documentation.

| Loader | Extensions | Output |
| --- | --- | --- |
| `js` | `.mjs` `.cjs` | Transpile to JavaScript files |
| `jsx` | `.js` `.jsx` | Transform JSX then transpile |
| `ts` | `.ts` `.mts` `.cts` | Transform TypeScript then transpile |
| `tsx` | `.tsx` | Transform TypeScript, JSX, then transpile |
| `toml` | `.toml` | Parse using Bun's built-in TOML parser |
| `json` | `.json` | Parse using Bun's built-in JSON parser |
| `napi` | `.node` | Import a native Node.js addon |
| `wasm` | `.wasm` | Import a native Node.js addon |
| `object` | _none_ | A special loader intended for plugins that converts a plain JavaScript object to an equivalent ES module. Each key in the object corresponds to a named export. |

Loading a YAML file is useful, but plugins support more than just data loading. Let's look at a plugin that lets Bun import `*.svelte` files.

sveltePlugin.ts

```
import { plugin } from "bun";

await plugin({
  name: "svelte loader",
  async setup(build) {
    const { compile } = await import("svelte/compiler");

    // when a .svelte file is imported...
    build.onLoad({ filter: /\.svelte$/ }, async ({ path }) => {

      // read and compile it with the Svelte compiler
      const file = await Bun.file(path).text();
      const contents = compile(file, {
        filename: path,
        generate: "ssr",
      }).js.code;

      // and return the compiled source code as "js"
      return {
        contents,
        loader: "js",
      };
    });
  },
});

```

Note: in a production implementation, you'd want to cache the compiled output and include additional error handling.

The object returned from `build.onLoad` contains the compiled source code in `contents` and specifies `"js"` as its loader. That tells Bun to consider the returned `contents` to be a JavaScript module and transpile it using Bun's built-in `js` loader.

With this plugin, Svelte components can now be directly imported and consumed.

```
import "./sveltePlugin.ts";
import MySvelteComponent from "./component.svelte";

console.log(MySvelteComponent.render());

```

## [Virtual Modules](https://bun.com/docs/runtime/plugins\#virtual-modules)

This feature is currently only available at runtime with `Bun.plugin` and not yet supported in the bundler, but you can mimic the behavior using `onResolve` and `onLoad`.

To create virtual modules at runtime, use `builder.module(specifier, callback)` in the `setup` function of a `Bun.plugin`.

For example:

```
import { plugin } from "bun";

plugin({
  name: "my-virtual-module",

  setup(build) {
    build.module(
      // The specifier, which can be any string - except a built-in, such as "buffer"
      "my-transpiled-virtual-module",
      // The callback to run when the module is imported or required for the first time
      () => {
        return {
          contents: "console.log('hello world!')",
          loader: "js",
        };
      },
    );

    build.module("my-object-virtual-module", () => {
      return {
        exports: {
          foo: "bar",
        },
        loader: "object",
      };
    });
  },
});

// Sometime later
// All of these work
import "my-transpiled-virtual-module";
require("my-transpiled-virtual-module");
await import("my-transpiled-virtual-module");
require.resolve("my-transpiled-virtual-module");

import { foo } from "my-object-virtual-module";
const object = require("my-object-virtual-module");
await import("my-object-virtual-module");
require.resolve("my-object-virtual-module");

```

### [Overriding existing modules](https://bun.com/docs/runtime/plugins\#overriding-existing-modules)

You can also override existing modules with `build.module`.

```
import { plugin } from "bun";
build.module("my-object-virtual-module", () => {
  return {
    exports: {
      foo: "bar",
    },
    loader: "object",
  };
});

require("my-object-virtual-module"); // { foo: "bar" }
await import("my-object-virtual-module"); // { foo: "bar" }

build.module("my-object-virtual-module", () => {
  return {
    exports: {
      baz: "quix",
    },
    loader: "object",
  };
});
require("my-object-virtual-module"); // { baz: "quix" }
await import("my-object-virtual-module"); // { baz: "quix" }

```

## [Reading or modifying the config](https://bun.com/docs/runtime/plugins\#reading-or-modifying-the-config)

Plugins can read and write to the [build config](https://bun.com/docs/bundler#api) with `build.config`.

```
await Bun.build({
  entrypoints: ["./app.ts"],
  outdir: "./dist",
  sourcemap: "external",
  plugins: [\
    {\
      name: "demo",\
      setup(build) {\
        console.log(build.config.sourcemap); // "external"\
\
        build.config.minify = true; // enable minification\
\
        // `plugins` is readonly\
        console.log(`Number of plugins: ${build.config.plugins.length}`);\
      },\
    },\
  ],
});

```

**NOTE**: Plugin lifecycle callbacks ( `onStart()`, `onResolve()`, etc.) do not have the ability to modify the `build.config` object in the `setup()` function. If you want to mutate `build.config`, you must do so directly in the `setup()` function:

```
await Bun.build({
  entrypoints: ["./app.ts"],
  outdir: "./dist",
  sourcemap: "external",
  plugins: [\
    {\
      name: "demo",\
      setup(build) {\
        // ✅ good! modifying it directly in the setup() function\
        build.config.minify = true;\
\
        build.onStart(() => {\
          // 🚫 uh-oh! this won't work!\
          build.config.minify = false;\
        });\
      },\
    },\
  ],
});

```

## [Lifecycle hooks](https://bun.com/docs/runtime/plugins\#lifecycle-hooks)

Plugins can register callbacks to be run at various points in the lifecycle of a bundle:

- [`onStart()`](https://bun.com/docs/runtime/plugins#onstart): Run once the bundler has started a bundle
- [`onResolve()`](https://bun.com/docs/runtime/plugins#onresolve): Run before a module is resolved
- [`onLoad()`](https://bun.com/docs/runtime/plugins#onload): Run before a module is loaded.

### [Reference](https://bun.com/docs/runtime/plugins\#reference)

A rough overview of the types (please refer to Bun's `bun.d.ts` for the full type definitions):

```
namespace Bun {
  function plugin(plugin: {
    name: string;
    setup: (build: PluginBuilder) => void;
  }): void;
}

type PluginBuilder = {
  onStart(callback: () => void): void;
  onResolve: (
    args: { filter: RegExp; namespace?: string },
    callback: (args: { path: string; importer: string }) => {
      path: string;
      namespace?: string;
    } | void,
  ) => void;
  onLoad: (
    args: { filter: RegExp; namespace?: string },
    callback: (args: { path: string }) => {
      loader?: Loader;
      contents?: string;
      exports?: Record<string, any>;
    },
  ) => void;
  config: BuildConfig;
};

type Loader = "js" | "jsx" | "ts" | "tsx" | "css" | "json" | "toml" | "object";

```

### [Namespaces](https://bun.com/docs/runtime/plugins\#namespaces)

`onLoad` and `onResolve` accept an optional `namespace` string. What is a namespace?

Every module has a namespace. Namespaces are used to prefix the import in transpiled code; for instance, a loader with a `filter: /\.yaml$/` and `namespace: "yaml:"` will transform an import from `./myfile.yaml` into `yaml:./myfile.yaml`.

The default namespace is `"file"` and it is not necessary to specify it, for instance: `import myModule from "./my-module.ts"` is the same as `import myModule from "file:./my-module.ts"`.

Other common namespaces are:

- `"bun"`: for Bun-specific modules (e.g. `"bun:test"`, `"bun:sqlite"`)
- `"node"`: for Node.js modules (e.g. `"node:fs"`, `"node:path"`)

### [`onStart`](https://bun.com/docs/runtime/plugins\#onstart)

```
onStart(callback: () => void): Promise<void> | void;

```

Registers a callback to be run when the bundler starts a new bundle.

```
import { plugin } from "bun";

plugin({
  name: "onStart example",

  setup(build) {
    build.onStart(() => {
      console.log("Bundle started!");
    });
  },
});

```

The callback can return a `Promise`. After the bundle process has initialized, the bundler waits until all `onStart()` callbacks have completed before continuing.

For example:

```
const result = await Bun.build({
  entrypoints: ["./app.ts"],
  outdir: "./dist",
  sourcemap: "external",
  plugins: [\
    {\
      name: "Sleep for 10 seconds",\
      setup(build) {\
        build.onStart(async () => {\
          await Bunlog.sleep(10_000);\
        });\
      },\
    },\
    {\
      name: "Log bundle time to a file",\
      setup(build) {\
        build.onStart(async () => {\
          const now = Date.now();\
          await Bun.$`echo ${now} > bundle-time.txt`;\
        });\
      },\
    },\
  ],
});

```

In the above example, Bun will wait until the first `onStart()` (sleeping for 10 seconds) has completed, _as well as_ the second `onStart()` (writing the bundle time to a file).

Note that `onStart()` callbacks (like every other lifecycle callback) do not have the ability to modify the `build.config` object. If you want to mutate `build.config`, you must do so directly in the `setup()` function.

### [`onResolve`](https://bun.com/docs/runtime/plugins\#onresolve)

```
onResolve(
  args: { filter: RegExp; namespace?: string },
  callback: (args: { path: string; importer: string }) => {
    path: string;
    namespace?: string;
  } | void,
): void;

```

To bundle your project, Bun walks down the dependency tree of all modules in your project. For each imported module, Bun actually has to find and read that module. The "finding" part is known as "resolving" a module.

The `onResolve()` plugin lifecycle callback allows you to configure how a module is resolved.

The first argument to `onResolve()` is an object with a `filter` and [`namespace`](https://bun.com/docs/runtime/plugins#what-is-a-namespace) property. The filter is a regular expression which is run on the import string. Effectively, these allow you to filter which modules your custom resolution logic will apply to.

The second argument to `onResolve()` is a callback which is run for each module import Bun finds that matches the `filter` and `namespace` defined in the first argument.

The callback receives as input the _path_ to the matching module. The callback can return a _new path_ for the module. Bun will read the contents of the _new path_ and parse it as a module.

For example, redirecting all imports to `images/` to `./public/images/`:

```
import { plugin } from "bun";

plugin({
  name: "onResolve example",
  setup(build) {
    build.onResolve({ filter: /.*/, namespace: "file" }, args => {
      if (args.path.startsWith("images/")) {
        return {
          path: args.path.replace("images/", "./public/images/"),
        };
      }
    });
  },
});

```

### [`onLoad`](https://bun.com/docs/runtime/plugins\#onload)

```
onLoad(
  args: { filter: RegExp; namespace?: string },
  callback: (args: { path: string, importer: string, namespace: string, kind: ImportKind  }) => {
    loader?: Loader;
    contents?: string;
    exports?: Record<string, any>;
  },
): void;

```

After Bun's bundler has resolved a module, it needs to read the contents of the module and parse it.

The `onLoad()` plugin lifecycle callback allows you to modify the _contents_ of a module before it is read and parsed by Bun.

Like `onResolve()`, the first argument to `onLoad()` allows you to filter which modules this invocation of `onLoad()` will apply to.

The second argument to `onLoad()` is a callback which is run for each matching module _before_ Bun loads the contents of the module into memory.

This callback receives as input the _path_ to the matching module, the _importer_ of the module (the module that imported the module), the _namespace_ of the module, and the _kind_ of the module.

The callback can return a new `contents` string for the module as well as a new `loader`.

For example:

```
import { plugin } from "bun";

plugin({
  name: "env plugin",
  setup(build) {
    build.onLoad({ filter: /env/, namespace: "file" }, args => {
      return {
        contents: `export default ${JSON.stringify(process.env)}`,
        loader: "js",
      };
    });
  },
});

```

This plugin will transform all imports of the form `import env from "env"` into a JavaScript module that exports the current environment variables.

[Previous\\
\\
Single-file executable](https://bun.com/docs/bundler/executables) [Next\\
\\
Watch mode](https://bun.com/docs/runtime/hot)

[![GitHub logo](<Base64-Image-Removed>)![GitHub logo](<Base64-Image-Removed>)\\
\\
Edit on GitHub](https://github.com/oven-sh/bun/edit/main/docs/runtime/plugins.md)

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