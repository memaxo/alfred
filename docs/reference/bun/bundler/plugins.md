---
title: Plugins – Bundler | Bun Docs
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

[`bun run`](https://bun.com/docs/cli/run) [File types](https://bun.com/docs/runtime/loaders) [TypeScript](https://bun.com/docs/runtime/typescript) [JSX](https://bun.com/docs/runtime/jsx) [Environment variables](https://bun.com/docs/runtime/env) [Bun APIs](https://bun.com/docs/runtime/bun-apis) [Web APIs](https://bun.com/docs/runtime/web-apis) [Node.js compatibility](https://bun.com/docs/runtime/nodejs-apis) [Single-file executable](https://bun.com/docs/bundler/executables) [Plugins](https://bun.com/docs/runtime/plugins) [Watch mode](https://bun.com/docs/runtime/hot) [Module resolution](https://bun.com/docs/runtime/modules) [Auto-install](https://bun.com/docs/runtime/autoimport) [bunfig.toml](https://bun.com/docs/runtime/bunfig) [Debugger](https://bun.com/docs/runtime/debugger)

Framework APISOON

Package manager

[`bun install`](https://bun.com/docs/cli/install) [`bun add`](https://bun.com/docs/cli/add) [`bun remove`](https://bun.com/docs/cli/remove) [`bun update`](https://bun.com/docs/cli/update) [`bun publish`](https://bun.com/docs/cli/publish) [`bun outdated`](https://bun.com/docs/cli/outdated) [`bun link`](https://bun.com/docs/cli/link) [`bun pm`](https://bun.com/docs/cli/pm) [`bun why`](https://bun.com/docs/cli/why) [Global cache](https://bun.com/docs/install/cache) [Isolated installs](https://bun.com/docs/install/isolated) [Workspaces](https://bun.com/docs/install/workspaces) [Catalogs](https://bun.com/docs/install/catalogs) [Lifecycle scripts](https://bun.com/docs/install/lifecycle) [Filter](https://bun.com/docs/cli/filter) [Lockfile](https://bun.com/docs/install/lockfile) [Scopes and registries](https://bun.com/docs/install/registries) [Overrides and resolutions](https://bun.com/docs/install/overrides) [Patch dependencies](https://bun.com/docs/install/patch) [Audit dependencies](https://bun.com/docs/install/audit) [.npmrc support](https://bun.com/docs/install/npmrc) [Security Scanner API](https://bun.com/docs/install/security-scanner-api)

Bundler

[`Bun.build`](https://bun.com/docs/bundler) [HTML & static sites](https://bun.com/docs/bundler/html) [CSS](https://bun.com/docs/bundler/css) [Fullstack Dev Server](https://bun.com/docs/bundler/fullstack) [Hot reloading](https://bun.com/docs/bundler/hmr) [Loaders](https://bun.com/docs/bundler/loaders) [Plugins](https://bun.com/docs/bundler/plugins)

[Lifecycle hooks](https://bun.com/docs/bundler/plugins#lifecycle-hooks) [Reference](https://bun.com/docs/bundler/plugins#reference) [Usage](https://bun.com/docs/bundler/plugins#usage) [Plugin lifecycle](https://bun.com/docs/bundler/plugins#plugin-lifecycle) [Namespaces](https://bun.com/docs/bundler/plugins#namespaces) [`onStart`](https://bun.com/docs/bundler/plugins#onstart) [`onResolve`](https://bun.com/docs/bundler/plugins#onresolve) [`onLoad`](https://bun.com/docs/bundler/plugins#onload) [`onEnd`](https://bun.com/docs/bundler/plugins#onend) [Native plugins](https://bun.com/docs/bundler/plugins#native-plugins) [Creating a native plugin in Rust](https://bun.com/docs/bundler/plugins#creating-a-native-plugin-in-rust) [`onBeforeParse`](https://bun.com/docs/bundler/plugins#onbeforeparse)

[Macros](https://bun.com/docs/bundler/macros) [vs esbuild](https://bun.com/docs/bundler/vs-esbuild)

Test runner

[`bun test`](https://bun.com/docs/cli/test) [Writing tests](https://bun.com/docs/test/writing) [Watch mode](https://bun.com/docs/test/hot) [Lifecycle hooks](https://bun.com/docs/test/lifecycle) [Mocks](https://bun.com/docs/test/mocks) [Snapshots](https://bun.com/docs/test/snapshots) [Dates and times](https://bun.com/docs/test/time) [Code coverage](https://bun.com/docs/test/coverage) [Test reporters](https://bun.com/docs/test/reporters) [Test configuration](https://bun.com/docs/test/configuration) [Runtime behavior](https://bun.com/docs/test/runtime-behavior) [Finding tests](https://bun.com/docs/test/discovery) [DOM testing](https://bun.com/docs/test/dom)

Package runner

[`bunx`](https://bun.com/docs/cli/bunx)

API

[HTTP server](https://bun.com/docs/api/http) [HTTP client](https://bun.com/docs/api/fetch) [WebSockets](https://bun.com/docs/api/websockets) [Workers](https://bun.com/docs/api/workers) [Binary data](https://bun.com/docs/api/binary-data) [Streams](https://bun.com/docs/api/streams) [SQL](https://bun.com/docs/api/sql) [S3 Object Storage](https://bun.com/docs/api/s3) [File I/O](https://bun.com/docs/api/file-io) [Redis client](https://bun.com/docs/api/redis) [import.meta](https://bun.com/docs/api/import-meta) [SQLite](https://bun.com/docs/api/sqlite) [FileSystemRouter](https://bun.com/docs/api/file-system-router) [TCP sockets](https://bun.com/docs/api/tcp) [UDP sockets](https://bun.com/docs/api/udp) [Globals](https://bun.com/docs/api/globals) [$ Shell](https://bun.com/docs/runtime/shell) [Child processes](https://bun.com/docs/api/spawn) [YAML](https://bun.com/docs/api/yaml) [HTMLRewriter](https://bun.com/docs/api/html-rewriter) [Hashing](https://bun.com/docs/api/hashing) [Console](https://bun.com/docs/api/console) [Cookie](https://bun.com/docs/api/cookie) [FFI](https://bun.com/docs/api/ffi) [C Compiler](https://bun.com/docs/api/cc) [Secrets](https://bun.com/docs/api/secrets) [Testing](https://bun.com/docs/cli/test) [Utils](https://bun.com/docs/api/utils) [Node-API](https://bun.com/docs/api/node-api) [Glob](https://bun.com/docs/api/glob) [DNS](https://bun.com/docs/api/dns) [Semver](https://bun.com/docs/api/semver) [Color](https://bun.com/docs/api/color) [Transpiler](https://bun.com/docs/api/transpiler)

Project

[Roadmap](https://bun.com/docs/project/roadmap) [Benchmarking](https://bun.com/docs/project/benchmarking) [Contributing](https://bun.com/docs/project/contributing) [Building Windows](https://bun.com/docs/project/building-windows) [Bindgen](https://bun.com/docs/project/bindgen) [License](https://bun.com/docs/project/licensing)

Bun provides a universal plugin API that can be used to extend both the _runtime_ and _bundler_.

Plugins intercept imports and perform custom loading logic: reading files, transpiling code, etc. They can be used to add support for additional file types, like `.scss` or `.yaml`. In the context of Bun's bundler, plugins can be used to implement framework-level features like CSS extraction, macros, and client-server code co-location.

## [Lifecycle hooks](https://bun.com/docs/bundler/plugins#lifecycle-hooks)

Plugins can register callbacks to be run at various points in the lifecycle of a bundle:

- [`onStart()`](https://bun.com/docs/bundler/plugins#onstart): Run once the bundler has started a bundle
- [`onResolve()`](https://bun.com/docs/bundler/plugins#onresolve): Run before a module is resolved
- [`onLoad()`](https://bun.com/docs/bundler/plugins#onload): Run before a module is loaded.
- [`onEnd()`](https://bun.com/docs/bundler/plugins#onend): Run after the bundle has completed
- [`onBeforeParse()`](https://bun.com/docs/bundler/plugins#onbeforeparse): Run zero-copy native addons in the parser thread before a file is parsed.

### [Reference](https://bun.com/docs/bundler/plugins#reference)

A rough overview of the types (please refer to Bun's `bun.d.ts` for the full type definitions):

```
type PluginBuilder = {
  onStart(callback: () => void): void;
  onEnd(callback: (result: BuildOutput) => void | Promise<void>): void;
  onResolve: (
    args: { filter: RegExp; namespace?: string },
    callback: (args: { path: string; importer: string }) => {
      path: string;
      namespace?: string;
    } | void,
  ) => void;
  onLoad: (
    args: { filter: RegExp; namespace?: string },
    defer: () => Promise<void>,
    callback: (args: { path: string }) => {
      loader?: Loader;
      contents?: string;
      exports?: Record<string, any>;
    },
  ) => void;
  config: BuildConfig;
};

type Loader = "js" | "jsx" | "ts" | "tsx" | "css" | "json" | "toml";

```

## [Usage](https://bun.com/docs/bundler/plugins#usage)

A plugin is defined as simple JavaScript object containing a `name` property and a `setup` function.

myPlugin.ts

```
import type { BunPlugin } from "bun";

const myPlugin: BunPlugin = {
  name: "Custom loader",
  setup(build) {
    // implementation
  },
};

```

This plugin can be passed into the `plugins` array when calling `Bun.build`.

```
await Bun.build({
  entrypoints: ["./app.ts"],
  outdir: "./out",
  plugins: [myPlugin],
});

```

## [Plugin lifecycle](https://bun.com/docs/bundler/plugins#plugin-lifecycle)

### [Namespaces](https://bun.com/docs/bundler/plugins#namespaces)

`onLoad` and `onResolve` accept an optional `namespace` string. What is a namespace?

Every module has a namespace. Namespaces are used to prefix the import in transpiled code; for instance, a loader with a `filter: /\.yaml$/` and `namespace: "yaml:"` will transform an import from `./myfile.yaml` into `yaml:./myfile.yaml`.

The default namespace is `"file"` and it is not necessary to specify it, for instance: `import myModule from "./my-module.ts"` is the same as `import myModule from "file:./my-module.ts"`.

Other common namespaces are:

- `"bun"`: for Bun-specific modules (e.g. `"bun:test"`, `"bun:sqlite"`)
- `"node"`: for Node.js modules (e.g. `"node:fs"`, `"node:path"`)

### [`onStart`](https://bun.com/docs/bundler/plugins#onstart)

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

### [`onResolve`](https://bun.com/docs/bundler/plugins#onresolve)

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

The first argument to `onResolve()` is an object with a `filter` and [`namespace`](https://bun.com/docs/bundler/plugins#what-is-a-namespace) property. The filter is a regular expression which is run on the import string. Effectively, these allow you to filter which modules your custom resolution logic will apply to.

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

### [`onLoad`](https://bun.com/docs/bundler/plugins#onload)

```
onLoad(
  args: { filter: RegExp; namespace?: string },
  defer: () => Promise<void>,
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

const envPlugin: BunPlugin = {
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

Bun.build({
  entrypoints: ["./app.ts"],
  outdir: "./dist",
  plugins: [envPlugin],
});

// import env from "env"
// env.FOO === "bar"

```

This plugin will transform all imports of the form `import env from "env"` into a JavaScript module that exports the current environment variables.

#### `.defer()`

One of the arguments passed to the `onLoad` callback is a `defer` function. This function returns a `Promise` that is resolved when all _other_ modules have been loaded.

This allows you to delay execution of the `onLoad` callback until all other modules have been loaded.

This is useful for returning contents of a module that depends on other modules.

##### Example: tracking and reporting unused exports

```
import { plugin } from "bun";

plugin({
  name: "track imports",
  setup(build) {
    const transpiler = new Bun.Transpiler();

    let trackedImports: Record<string, number> = {};

    // Each module that goes through this onLoad callback
    // will record its imports in `trackedImports`
    build.onLoad({ filter: /\.ts/ }, async ({ path }) => {
      const contents = await Bun.file(path).arrayBuffer();

      const imports = transpiler.scanImports(contents);

      for (const i of imports) {
        trackedImports[i.path] = (trackedImports[i.path] || 0) + 1;
      }

      return undefined;
    });

    build.onLoad({ filter: /stats\.json/ }, async ({ defer }) => {
      // Wait for all files to be loaded, ensuring
      // that every file goes through the above `onLoad()` function
      // and their imports tracked
      await defer();

      // Emit JSON containing the stats of each import
      return {
        contents: `export default ${JSON.stringify(trackedImports)}`,
        loader: "json",
      };
    });
  },
});

```

Note that the `.defer()` function currently has the limitation that it can only be called once per `onLoad` callback.

### [`onEnd`](https://bun.com/docs/bundler/plugins#onend)

```
onEnd(callback: (result: BuildOutput) => void | Promise<void>): void;

```

Registers a callback to be run when the bundler completes a bundle (whether successful or not).

The callback receives the `BuildOutput` object containing:

- `success`: boolean indicating if the build succeeded
- `outputs`: array of generated build artifacts
- `logs`: array of build messages (warnings, errors, etc.)

This is useful for post-processing, cleanup, notifications, or custom error handling.

```
await Bun.build({
  entrypoints: ["./index.ts"],
  outdir: "./out",
  plugins: [\
    {\
      name: "onEnd example",\
      setup(build) {\
        build.onEnd(result => {\
          if (result.success) {\
            console.log(\
              `✅ Build succeeded with ${result.outputs.length} outputs`,\
            );\
          } else {\
            console.error(`❌ Build failed with ${result.logs.length} errors`);\
          }\
        });\
      },\
    },\
  ],
});

```

The `onEnd` callbacks are called:

- **Before** the build promise resolves or rejects
- **After** all bundling is complete
- **In the order** they were registered

Multiple plugins can register `onEnd` callbacks, and they will all be called sequentially. If an `onEnd` callback returns a promise, the build will wait for it to resolve before continuing.

## [Native plugins](https://bun.com/docs/bundler/plugins#native-plugins)

One of the reasons why Bun's bundler is so fast is that it is written in native code and leverages multi-threading to load and parse modules in parallel.

However, one limitation of plugins written in JavaScript is that JavaScript itself is single-threaded.

Native plugins are written as [NAPI](https://bun.com/docs/api/node-api) modules and can be run on multiple threads. This allows native plugins to run much faster than JavaScript plugins.

In addition, native plugins can skip unnecessary work such as the UTF-8 -> UTF-16 conversion needed to pass strings to JavaScript.

These are the following lifecycle hooks which are available to native plugins:

- [`onBeforeParse()`](https://bun.com/docs/bundler/plugins#onbeforeparse): Called on any thread before a file is parsed by Bun's bundler.

Native plugins are NAPI modules which expose lifecycle hooks as C ABI functions.

To create a native plugin, you must export a C ABI function which matches the signature of the native lifecycle hook you want to implement.

### [Creating a native plugin in Rust](https://bun.com/docs/bundler/plugins#creating-a-native-plugin-in-rust)

Native plugins are NAPI modules which expose lifecycle hooks as C ABI functions.

To create a native plugin, you must export a C ABI function which matches the signature of the native lifecycle hook you want to implement.

```
bun add -g @napi-rs/cli
napi new

```

Then install this crate:

```
cargo add bun-native-plugin

```

Now, inside the `lib.rs` file, we'll use the `bun_native_plugin::bun` proc macro to define a function whichwill implement our native plugin.

Here's an example implementing the `onBeforeParse` hook:

```
use bun_native_plugin::{define_bun_plugin, OnBeforeParse, bun, Result, anyhow, BunLoader};
use napi_derive::napi;

/// Define the plugin and its name
define_bun_plugin!("replace-foo-with-bar");

/// Here we'll implement `onBeforeParse` with code that replaces all occurrences of
/// `foo` with `bar`.
///
/// We use the #[bun] macro to generate some of the boilerplate code.
///
/// The argument of the function (`handle: &mut OnBeforeParse`) tells
/// the macro that this function implements the `onBeforeParse` hook.
#[bun]
pub fn replace_foo_with_bar(handle: &mut OnBeforeParse) -> Result<()> {
  // Fetch the input source code.
  let input_source_code = handle.input_source_code()?;

  // Get the Loader for the file
  let loader = handle.output_loader();

  let output_source_code = input_source_code.replace("foo", "bar");

  handle.set_output_source_code(output_source_code, BunLoader::BUN_LOADER_JSX);

  Ok(())
}

```

And to use it in Bun.build():

```
import myNativeAddon from "./my-native-addon";
Bun.build({
  entrypoints: ["./app.tsx"],
  plugins: [\
    {\
      name: "my-plugin",\
\
      setup(build) {\
        build.onBeforeParse(\
          {\
            namespace: "file",\
            filter: "**/*.tsx",\
          },\
          {\
            napiModule: myNativeAddon,\
            symbol: "replace_foo_with_bar",\
            // external: myNativeAddon.getSharedState()\
          },\
        );\
      },\
    },\
  ],
});

```

### [`onBeforeParse`](https://bun.com/docs/bundler/plugins#onbeforeparse)

```
onBeforeParse(
  args: { filter: RegExp; namespace?: string },
  callback: { napiModule: NapiModule; symbol: string; external?: unknown },
): void;

```

This lifecycle callback is run immediately before a file is parsed by Bun's bundler.

As input, it receives the file's contents and can optionally return new source code.

This callback can be called from any thread and so the napi module implementation must be thread-safe.

[Previous\\
\\
Loaders](https://bun.com/docs/bundler/loaders) [Next\\
\\
Macros](https://bun.com/docs/bundler/macros)

[![GitHub logo](Base64-Image-Removed)![GitHub logo](Base64-Image-Removed)\\
\\
Edit on GitHub](https://github.com/oven-sh/bun/edit/main/docs/bundler/plugins.md)

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
