---
title: HTML & static sites – Bundler | Bun Docs
url:
description: Zero-config HTML bundler for single-page apps and multi-page apps. Automatic bundling, TailwindCSS plugins, TypeScript, JSX, React support, and incredibly fast builds
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

[`Bun.build`](https://bun.com/docs/bundler) [HTML & static sites](https://bun.com/docs/bundler/html)

[Single Page Apps (SPA)](https://bun.com/docs/bundler/html#single-page-apps-spa) [Multi-page apps (MPA)](https://bun.com/docs/bundler/html#multi-page-apps-mpa) [Glob patterns](https://bun.com/docs/bundler/html#glob-patterns) [Path normalization](https://bun.com/docs/bundler/html#path-normalization) [JavaScript, TypeScript, and JSX](https://bun.com/docs/bundler/html#javascript-typescript-and-jsx) [ES Modules & CommonJS](https://bun.com/docs/bundler/html#es-modules-commonjs) [CSS](https://bun.com/docs/bundler/html#css) [Referencing local assets in CSS](https://bun.com/docs/bundler/html#referencing-local-assets-in-css) [Importing CSS in JavaScript](https://bun.com/docs/bundler/html#importing-css-in-javascript) [Plugins](https://bun.com/docs/bundler/html#plugins) [Tailwind CSS](https://bun.com/docs/bundler/html#tailwind-css) [Echo console logs from browser to terminal](https://bun.com/docs/bundler/html#echo-console-logs-from-browser-to-terminal) [Edit files in the browser](https://bun.com/docs/bundler/html#edit-files-in-the-browser) [Keyboard Shortcuts](https://bun.com/docs/bundler/html#keyboard-shortcuts) [Build for Production](https://bun.com/docs/bundler/html#build-for-production) [Watch Mode](https://bun.com/docs/bundler/html#watch-mode) [Plugin API](https://bun.com/docs/bundler/html#plugin-api) [What Gets Processed?](https://bun.com/docs/bundler/html#what-gets-processed) [This is a work in progress](https://bun.com/docs/bundler/html#this-is-a-work-in-progress) [How this works](https://bun.com/docs/bundler/html#how-this-works) [Adding a backend to your frontend](https://bun.com/docs/bundler/html#adding-a-backend-to-your-frontend)

[CSS](https://bun.com/docs/bundler/css) [Fullstack Dev Server](https://bun.com/docs/bundler/fullstack) [Hot reloading](https://bun.com/docs/bundler/hmr) [Loaders](https://bun.com/docs/bundler/loaders) [Plugins](https://bun.com/docs/bundler/plugins) [Macros](https://bun.com/docs/bundler/macros) [vs esbuild](https://bun.com/docs/bundler/vs-esbuild)

Test runner

[`bun test`](https://bun.com/docs/cli/test) [Writing tests](https://bun.com/docs/test/writing) [Watch mode](https://bun.com/docs/test/hot) [Lifecycle hooks](https://bun.com/docs/test/lifecycle) [Mocks](https://bun.com/docs/test/mocks) [Snapshots](https://bun.com/docs/test/snapshots) [Dates and times](https://bun.com/docs/test/time) [Code coverage](https://bun.com/docs/test/coverage) [Test reporters](https://bun.com/docs/test/reporters) [Test configuration](https://bun.com/docs/test/configuration) [Runtime behavior](https://bun.com/docs/test/runtime-behavior) [Finding tests](https://bun.com/docs/test/discovery) [DOM testing](https://bun.com/docs/test/dom)

Package runner

[`bunx`](https://bun.com/docs/cli/bunx)

API

[HTTP server](https://bun.com/docs/api/http) [HTTP client](https://bun.com/docs/api/fetch) [WebSockets](https://bun.com/docs/api/websockets) [Workers](https://bun.com/docs/api/workers) [Binary data](https://bun.com/docs/api/binary-data) [Streams](https://bun.com/docs/api/streams) [SQL](https://bun.com/docs/api/sql) [S3 Object Storage](https://bun.com/docs/api/s3) [File I/O](https://bun.com/docs/api/file-io) [Redis client](https://bun.com/docs/api/redis) [import.meta](https://bun.com/docs/api/import-meta) [SQLite](https://bun.com/docs/api/sqlite) [FileSystemRouter](https://bun.com/docs/api/file-system-router) [TCP sockets](https://bun.com/docs/api/tcp) [UDP sockets](https://bun.com/docs/api/udp) [Globals](https://bun.com/docs/api/globals) [$ Shell](https://bun.com/docs/runtime/shell) [Child processes](https://bun.com/docs/api/spawn) [YAML](https://bun.com/docs/api/yaml) [HTMLRewriter](https://bun.com/docs/api/html-rewriter) [Hashing](https://bun.com/docs/api/hashing) [Console](https://bun.com/docs/api/console) [Cookie](https://bun.com/docs/api/cookie) [FFI](https://bun.com/docs/api/ffi) [C Compiler](https://bun.com/docs/api/cc) [Secrets](https://bun.com/docs/api/secrets) [Testing](https://bun.com/docs/cli/test) [Utils](https://bun.com/docs/api/utils) [Node-API](https://bun.com/docs/api/node-api) [Glob](https://bun.com/docs/api/glob) [DNS](https://bun.com/docs/api/dns) [Semver](https://bun.com/docs/api/semver) [Color](https://bun.com/docs/api/color) [Transpiler](https://bun.com/docs/api/transpiler)

Project

[Roadmap](https://bun.com/docs/project/roadmap) [Benchmarking](https://bun.com/docs/project/benchmarking) [Contributing](https://bun.com/docs/project/contributing) [Building Windows](https://bun.com/docs/project/building-windows) [Bindgen](https://bun.com/docs/project/bindgen) [License](https://bun.com/docs/project/licensing)

Bun's bundler has first-class support for HTML. Build static sites, landing pages, and web applications with zero configuration. Just point Bun at your HTML file and it handles everything else.

index.html

```
<!doctype html>
<html>
  <head>
    <link rel="stylesheet" href="./styles.css" />
    <script src="./app.ts" type="module"></script>
  </head>
  <body>
    <img src="./logo.png" />
  </body>
</html>

```

To get started, pass HTML files to `bun`.

❯

bun./index.html

Bunv1.2.22ready in6.62ms

→http://localhost:3000/

Pressh+Enterto show shortcuts

Bun's development server provides powerful features with zero configuration:

- **Automatic Bundling** \- Bundles and serves your HTML, JavaScript, and CSS
- **Multi-Entry Support** \- Handles multiple HTML entry points and glob entry points
- **Modern JavaScript** \- TypeScript & JSX support out of the box
- **Smart Configuration** \- Reads `tsconfig.json` for paths, JSX options, experimental decorators, and more
- **Plugins** \- Plugins for TailwindCSS and more
- **ESM & CommonJS** \- Use ESM and CommonJS in your JavaScript, TypeScript, and JSX files
- **CSS Bundling & Minification** \- Bundles CSS from `<link>` tags and `@import` statements
- **Asset Management**
  - Automatic copying & hashing of images and assets
  - Rewrites asset paths in JavaScript, CSS, and HTML

## [Single Page Apps (SPA)](https://bun.com/docs/bundler/html#single-page-apps-spa)

When you pass a single .html file to Bun, Bun will use it as a fallback route for all paths. This makes it perfect for single page apps that use client-side routing:

❯

bunindex.html

Bunv1.2.22ready in6.62ms

→http://localhost:3000/

Pressh+Enterto show shortcuts

Your React or other SPA will work out of the box — no configuration needed. All routes like `/about`, `/users/123`, etc. will serve the same HTML file, letting your client-side router handle the navigation.

index.html

```
<!doctype html>
<html>
  <head>
    <title>My SPA</title>
    <script src="./app.tsx" type="module"></script>
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>

```

## [Multi-page apps (MPA)](https://bun.com/docs/bundler/html#multi-page-apps-mpa)

Some projects have several separate routes or HTML files as entry points. To support multiple entry points, pass them all to `bun`

❯

bun./index.html ./about.html

Bunv1.2.22ready in6.62ms

→http://localhost:3000/

Routes:

└─/→./index.html

└─/about→./about.html

Pressh+Enterto show shortcuts

This will serve:

- `index.html` at `/`
- `about.html` at `/about`

### [Glob patterns](https://bun.com/docs/bundler/html#glob-patterns)

To specify multiple files, you can use glob patterns that end in `.html`:

❯

bun./\*\*/\*.html

Bunv1.2.22ready in6.62ms

→http://localhost:3000/

Routes:

└─/→./index.html

└─/about→./about.html

Pressh+Enterto show shortcuts

### [Path normalization](https://bun.com/docs/bundler/html#path-normalization)

The base path is chosen from the longest common prefix among all the files.

❯

bun./index.html ./about/index.html ./about/foo/index.html

Bunv1.2.22ready in6.62ms

→http://localhost:3000/

Routes:

└─/→./index.html

└─/about→./about/index.html

└─/about/foo→./about/foo/index.html

Pressh+Enterto show shortcuts

## [JavaScript, TypeScript, and JSX](https://bun.com/docs/bundler/html#javascript-typescript-and-jsx)

Bun's transpiler natively implements JavaScript, TypeScript, and JSX support. [Learn more about loaders in Bun](https://bun.com/docs/bundler/loaders).

Bun's transpiler is also used at runtime.

### [ES Modules & CommonJS](https://bun.com/docs/bundler/html#es-modules-commonjs)

You can use ESM and CJS in your JavaScript, TypeScript, and JSX files. Bun will handle the transpilation and bundling automatically.

There is no pre-build or separate optimization step. It's all done at the same time.

Learn more about [module resolution in Bun](https://bun.com/docs/runtime/modules).

## [CSS](https://bun.com/docs/bundler/html#css)

Bun's CSS parser is also natively implemented (clocking in around 58,000 lines of Zig).

It's also a CSS bundler. You can use `@import` in your CSS files to import other CSS files.

For example:

styles.css

```
@import "./abc.css";

.container {
  background-color: blue;
}

```

abc.css

```
body {
  background-color: red;
}

```

This outputs:

styles.css

```
body {
  background-color: red;
}

.container {
  background-color: blue;
}

```

### [Referencing local assets in CSS](https://bun.com/docs/bundler/html#referencing-local-assets-in-css)

You can reference local assets in your CSS files.

styles.css

```
body {
  background-image: url("./logo.png");
}

```

This will copy `./logo.png` to the output directory and rewrite the path in the CSS file to include a content hash.

styles.css

```
body {
  background-image: url("./logo-[ABC123].png");
}

```

### [Importing CSS in JavaScript](https://bun.com/docs/bundler/html#importing-css-in-javascript)

To associate a CSS file with a JavaScript file, you can import it in your JavaScript file.

app.ts

```
import "./styles.css";
import "./more-styles.css";

```

This generates `./app.css` and `./app.js` in the output directory. All CSS files imported from JavaScript will be bundled into a single CSS file per entry point. If you import the same CSS file from multiple JavaScript files, it will only be included once in the output CSS file.

## [Plugins](https://bun.com/docs/bundler/html#plugins)

The dev server supports plugins.

### [Tailwind CSS](https://bun.com/docs/bundler/html#tailwind-css)

To use TailwindCSS, install the `bun-plugin-tailwind` plugin:

```
# Or any npm client
```

```
bun install --dev bun-plugin-tailwind
```

Then, add the plugin to your `bunfig.toml`:

```
[serve.static]
plugins = ["bun-plugin-tailwind"]

```

Then, reference TailwindCSS in your HTML via `<link>` tag, `@import` in CSS, or `import` in JavaScript.

index.html

styles.css

app.ts

index.html

```
<!-- Reference TailwindCSS in your HTML -->
<link rel="stylesheet" href="tailwindcss" />

```

styles.css

```
/* Import TailwindCSS in your CSS */
@import "tailwindcss";

```

app.ts

```
/* Import TailwindCSS in your JavaScript */
import "tailwindcss";

```

Only one of those are necessary, not all three.

### [Echo console logs from browser to terminal](https://bun.com/docs/bundler/html#echo-console-logs-from-browser-to-terminal)

Bun's dev server supports streaming console logs from the browser to the terminal.

To enable, pass the `--console` CLI flag.

❯

bun./index.html --console

Bunv1.2.22ready in6.62ms

→http://localhost:3000/

Pressh+Enterto show shortcuts

Each call to `console.log` or `console.error` will be broadcast to the terminal that started the server. This is useful to see errors from the browser in the same place you run your server. This is also useful for AI agents that watch terminal output.

Internally, this reuses the existing WebSocket connection from hot module reloading to send the logs.

### [Edit files in the browser](https://bun.com/docs/bundler/html#edit-files-in-the-browser)

Bun's frontend dev server has support for [Automatic Workspace Folders](https://chromium.googlesource.com/devtools/devtools-frontend/+/main/docs/ecosystem/automatic_workspace_folders.md) in Chrome DevTools, which lets you save edits to files in the browser.

[![Bun's frontend dev server has support for Automatic Workspace Folders in Chrome DevTools, which lets you save edits to files in the browser.](https://bun.com/images/bun-chromedevtools.gif)](https://bun.com/images/bun-chromedevtools.gif)

How it works

Bun's dev server automatically adds a `/.well-known/appspecific/com.chrome.devtools.json` route to the server.

This route returns a JSON object with the following shape:

```
{
  "workspace": {
    "root": "/path/to/your/project",
    "uuid": "a-unique-identifier-for-this-workspace"
  }
}

```

For security reasons, this is only enabled when:

1. The request is coming from localhost, 127.0.0.1, or ::1.
2. Hot Module Reloading is enabled.
3. The `chromeDevToolsAutomaticWorkspaceFolders` flag is set to `true` or `undefined`.
4. There are no other routes that match the request.

You can disable this by passing `development: { chromeDevToolsAutomaticWorkspaceFolders: false }` in `Bun.serve`'s options.

## [Keyboard Shortcuts](https://bun.com/docs/bundler/html#keyboard-shortcuts)

While the server is running:

- `o + Enter` \- Open in browser
- `c + Enter` \- Clear console
- `q + Enter` (or Ctrl+C) - Quit server

## [Build for Production](https://bun.com/docs/bundler/html#build-for-production)

When you're ready to deploy, use `bun build` to create optimized production bundles:

CLI

API

CLI

```
bun build ./index.html --minify --outdir=dist
```

API

```
Bun.build({
  entrypoints: ["./index.html"],
  outdir: "./dist",
  minify: {
    whitespace: true,
    identifiers: true,
    syntax: true,
  }
});

```

Currently, plugins are only supported through `Bun.build`'s API or through `bunfig.toml` with the frontend dev server - not yet supported in `bun build`'s CLI.

### [Watch Mode](https://bun.com/docs/bundler/html#watch-mode)

You can run `bun build --watch` to watch for changes and rebuild automatically. This works nicely for library development.

You've never seen a watch mode this fast.

### [Plugin API](https://bun.com/docs/bundler/html#plugin-api)

Need more control? Configure the bundler through the JavaScript API and use Bun's builtin `HTMLRewriter` to preprocess HTML.

```
await Bun.build({
  entrypoints: ["./index.html"],
  outdir: "./dist",
  minify: true,

  plugins: [\
    {\
      // A plugin that makes every HTML tag lowercase\
      name: "lowercase-html-plugin",\
      setup({ onLoad }) {\
        const rewriter = new HTMLRewriter().on("*", {\
          element(element) {\
            element.tagName = element.tagName.toLowerCase();\
          },\
          text(element) {\
            element.replace(element.text.toLowerCase());\
          },\
        });\
\
        onLoad({ filter: /\.html$/ }, async args => {\
          const html = await Bun.file(args.path).text();\
\
          return {\
            // Bun's bundler will scan the HTML for <script> tags, <link rel="stylesheet"> tags, and other assets\
            // and bundle them automatically\
            contents: rewriter.transform(html),\
            loader: "html",\
          };\
        });\
      },\
    },\
  ],
});

```

## [What Gets Processed?](https://bun.com/docs/bundler/html#what-gets-processed)

Bun automatically handles all common web assets:

- Scripts ( `<script src>`) are run through Bun's JavaScript/TypeScript/JSX bundler
- Stylesheets ( `<link rel="stylesheet">`) are run through Bun's CSS parser & bundler
- Images ( `<img>`, `<picture>`) are copied and hashed
- Media ( `<video>`, `<audio>`, `<source>`) are copied and hashed
- Any `<link>` tag with an `href` attribute pointing to a local file is rewritten to the new path, and hashed

All paths are resolved relative to your HTML file, making it easy to organize your project however you want.

## [This is a work in progress](https://bun.com/docs/bundler/html#this-is-a-work-in-progress)

- Need more plugins
- Need more configuration options for things like asset handling
- Need a way to configure CORS, headers, etc.

If you want to submit a PR, most of the [code is here](https://github.com/oven-sh/bun/blob/main/src/js/internal/html.ts). You could even copy paste that file into your project and use it as a starting point.

## [How this works](https://bun.com/docs/bundler/html#how-this-works)

This is a small wrapper around Bun's support for HTML imports in JavaScript.

### [Adding a backend to your frontend](https://bun.com/docs/bundler/html#adding-a-backend-to-your-frontend)

To add a backend to your frontend, you can use the `"routes"` option in `Bun.serve`.

Learn more in [the full-stack docs](https://bun.com/docs/bundler/fullstack).

[Previous\\
\\
`Bun.build`](https://bun.com/docs/bundler) [Next\\
\\
CSS](https://bun.com/docs/bundler/css)

[![GitHub logo](Base64-Image-Removed)![GitHub logo](Base64-Image-Removed)\\
\\
Edit on GitHub](https://github.com/oven-sh/bun/edit/main/docs/bundler/html.md)

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
