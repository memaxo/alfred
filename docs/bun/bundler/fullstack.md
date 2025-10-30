---
title: Fullstack Dev Server – Bundler | Bun Docs
url: 
description: Serve your frontend and backend from the same app with Bun's dev server.
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

[`Bun.build`](https://bun.com/docs/bundler) [HTML & static sites](https://bun.com/docs/bundler/html) [CSS](https://bun.com/docs/bundler/css) [Fullstack Dev Server](https://bun.com/docs/bundler/fullstack)

[HTML imports are routes](https://bun.com/docs/bundler/fullstack#html-imports-are-routes) [How to use with React](https://bun.com/docs/bundler/fullstack#how-to-use-with-react) [Development mode](https://bun.com/docs/bundler/fullstack#development-mode) [Plugins](https://bun.com/docs/bundler/fullstack#plugins) [Using TailwindCSS in HTML routes](https://bun.com/docs/bundler/fullstack#using-tailwindcss-in-html-routes) [Custom plugins](https://bun.com/docs/bundler/fullstack#custom-plugins) [How this works](https://bun.com/docs/bundler/fullstack#how-this-works) [This is a work in progress](https://bun.com/docs/bundler/fullstack#this-is-a-work-in-progress)

[Hot reloading](https://bun.com/docs/bundler/hmr) [Loaders](https://bun.com/docs/bundler/loaders) [Plugins](https://bun.com/docs/bundler/plugins) [Macros](https://bun.com/docs/bundler/macros) [vs esbuild](https://bun.com/docs/bundler/vs-esbuild)

Test runner

[`bun test`](https://bun.com/docs/cli/test) [Writing tests](https://bun.com/docs/test/writing) [Watch mode](https://bun.com/docs/test/hot) [Lifecycle hooks](https://bun.com/docs/test/lifecycle) [Mocks](https://bun.com/docs/test/mocks) [Snapshots](https://bun.com/docs/test/snapshots) [Dates and times](https://bun.com/docs/test/time) [Code coverage](https://bun.com/docs/test/coverage) [Test reporters](https://bun.com/docs/test/reporters) [Test configuration](https://bun.com/docs/test/configuration) [Runtime behavior](https://bun.com/docs/test/runtime-behavior) [Finding tests](https://bun.com/docs/test/discovery) [DOM testing](https://bun.com/docs/test/dom)

Package runner

[`bunx`](https://bun.com/docs/cli/bunx)

API

[HTTP server](https://bun.com/docs/api/http) [HTTP client](https://bun.com/docs/api/fetch) [WebSockets](https://bun.com/docs/api/websockets) [Workers](https://bun.com/docs/api/workers) [Binary data](https://bun.com/docs/api/binary-data) [Streams](https://bun.com/docs/api/streams) [SQL](https://bun.com/docs/api/sql) [S3 Object Storage](https://bun.com/docs/api/s3) [File I/O](https://bun.com/docs/api/file-io) [Redis client](https://bun.com/docs/api/redis) [import.meta](https://bun.com/docs/api/import-meta) [SQLite](https://bun.com/docs/api/sqlite) [FileSystemRouter](https://bun.com/docs/api/file-system-router) [TCP sockets](https://bun.com/docs/api/tcp) [UDP sockets](https://bun.com/docs/api/udp) [Globals](https://bun.com/docs/api/globals) [$ Shell](https://bun.com/docs/runtime/shell) [Child processes](https://bun.com/docs/api/spawn) [YAML](https://bun.com/docs/api/yaml) [HTMLRewriter](https://bun.com/docs/api/html-rewriter) [Hashing](https://bun.com/docs/api/hashing) [Console](https://bun.com/docs/api/console) [Cookie](https://bun.com/docs/api/cookie) [FFI](https://bun.com/docs/api/ffi) [C Compiler](https://bun.com/docs/api/cc) [Secrets](https://bun.com/docs/api/secrets) [Testing](https://bun.com/docs/cli/test) [Utils](https://bun.com/docs/api/utils) [Node-API](https://bun.com/docs/api/node-api) [Glob](https://bun.com/docs/api/glob) [DNS](https://bun.com/docs/api/dns) [Semver](https://bun.com/docs/api/semver) [Color](https://bun.com/docs/api/color) [Transpiler](https://bun.com/docs/api/transpiler)

Project

[Roadmap](https://bun.com/docs/project/roadmap) [Benchmarking](https://bun.com/docs/project/benchmarking) [Contributing](https://bun.com/docs/project/contributing) [Building Windows](https://bun.com/docs/project/building-windows) [Bindgen](https://bun.com/docs/project/bindgen) [License](https://bun.com/docs/project/licensing)

To get started, import HTML files and pass them to the `routes` option in `Bun.serve()`.

```
import { sql, serve } from "bun";
import dashboard from "./dashboard.html";
import homepage from "./index.html";

const server = serve({
  routes: {
    // ** HTML imports **
    // Bundle & route index.html to "/". This uses HTMLRewriter to scan the HTML for `<script>` and `<link>` tags, run's Bun's JavaScript & CSS bundler on them, transpiles any TypeScript, JSX, and TSX, downlevels CSS with Bun's CSS parser and serves the result.
    "/": homepage,
    // Bundle & route dashboard.html to "/dashboard"
    "/dashboard": dashboard,

    // ** API endpoints ** (Bun v1.2.3+ required)
    "/api/users": {
      async GET(req) {
        const users = await sql`SELECT * FROM users`;
        return Response.json(users);
      },
      async POST(req) {
        const { name, email } = await req.json();
        const [user] =
          await sql`INSERT INTO users (name, email) VALUES (${name}, ${email})`;
        return Response.json(user);
      },
    },
    "/api/users/:id": async req => {
      const { id } = req.params;
      const [user] = await sql`SELECT * FROM users WHERE id = ${id}`;
      return Response.json(user);
    },
  },

  // Enable development mode for:
  // - Detailed error messages
  // - Hot reloading (Bun v1.2.3+ required)
  development: true,

  // Prior to v1.2.3, the `fetch` option was used to handle all API requests. It is now optional.
  // async fetch(req) {
  //   // Return 404 for unmatched routes
  //   return new Response("Not Found", { status: 404 });
  // },
});

console.log(`Listening on ${server.url}`);

```

```
bun run app.ts
```

## [HTML imports are routes](https://bun.com/docs/bundler/fullstack\#html-imports-are-routes)

The web starts with HTML, and so does Bun's fullstack dev server.

To specify entrypoints to your frontend, import HTML files into your JavaScript/TypeScript/TSX/JSX files.

```
import dashboard from "./dashboard.html";
import homepage from "./index.html";

```

These HTML files are used as routes in Bun's dev server you can pass to `Bun.serve()`.

```
Bun.serve({
  routes: {
    "/": homepage,
    "/dashboard": dashboard,
  }

  fetch(req) {
    // ... api requests
  },
});

```

When you make a request to `/dashboard` or `/`, Bun automatically bundles the `<script>` and `<link>` tags in the HTML files, exposes them as static routes, and serves the result.

An index.html file like this:

index.html

```
<!DOCTYPE html>
<html>
  <head>
    <title>Home</title>
    <link rel="stylesheet" href="./reset.css" />
    <link rel="stylesheet" href="./styles.css" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="./sentry-and-preloads.ts"></script>
    <script type="module" src="./my-app.tsx"></script>
  </body>
</html>

```

Becomes something like this:

index.html

```
<!DOCTYPE html>
<html>
  <head>
    <title>Home</title>
    <link rel="stylesheet" href="/index-[hash].css" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/index-[hash].js"></script>
  </body>
</html>

```

### [How to use with React](https://bun.com/docs/bundler/fullstack\#how-to-use-with-react)

To use React in your client-side code, import `react-dom/client` and render your app.

src/backend.ts

src/frontend.tsx

public/dashboard.html

src/styles.css

src/app.tsx

src/backend.ts

```
import dashboard from "../public/dashboard.html";
import { serve } from "bun";

serve({
  routes: {
    "/": dashboard,
  },

  async fetch(req) {
    // ...api requests
    return new Response("hello world");
  },
});

```

src/frontend.tsx

```
import "./styles.css";
import { createRoot } from "react-dom/client";
import { App } from "./app.tsx";

document.addEventListener("DOMContentLoaded", () => {
  const root = createRoot(document.getElementById("root"));
  root.render(<App />);
});

```

public/dashboard.html

```
<!DOCTYPE html>
<html>
  <head>
    <title>Dashboard</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="../src/frontend.tsx"></script>
  </body>
</html>

```

src/styles.css

```
body {
  background-color: red;
}

```

src/app.tsx

```
export function App() {
  return <div>Hello World</div>;
}

```

### [Development mode](https://bun.com/docs/bundler/fullstack\#development-mode)

When building locally, enable development mode by setting `development: true` in `Bun.serve()`.

```
import homepage from "./index.html";
import dashboard from "./dashboard.html";

Bun.serve({
  routes: {
    "/": homepage,
    "/dashboard": dashboard,
  }

  development: true,

  fetch(req) {
    // ... api requests
  },
});
```

When `development` is `true`, Bun will:

- Include the `SourceMap` header in the response so that devtools can show the original source code
- Disable minification
- Re-bundle assets on each request to a .html file
- Enable hot module reloading (unless `hmr: false` is set)

#### Echo console logs from browser to terminal

Bun.serve() supports echoing console logs from the browser to the terminal.

To enable this, pass `console: true` in the `development` object in `Bun.serve()`.

```
import homepage from "./index.html";

Bun.serve({
  // development can also be an object.
  development: {
    // Enable Hot Module Reloading
    hmr: true,

    // Echo console logs from the browser to the terminal
    console: true,
  },

  routes: {
    "/": homepage,
  },
});

```

When `console: true` is set, Bun will stream console logs from the browser to the terminal. This reuses the existing WebSocket connection from HMR to send the logs.

#### Production mode

Hot reloading and `development: true` helps you iterate quickly, but in production, your server should be as fast as possible and have as few external dependencies as possible.

##### Ahead of time bundling (recommended)

As of Bun v1.2.17, you can use `Bun.build` or `bun build` to bundle your full-stack application ahead of time.

```
bun build --target=bun --production --outdir=dist ./src/index.ts
```

When Bun's bundler sees an HTML import from server-side code, it will bundle the referenced JavaScript/TypeScript/TSX/JSX and CSS files into a manifest object that Bun.serve() can use to serve the assets.

```
import { serve } from "bun";
import index from "./index.html";

serve({
  routes: { "/": index },
});

```

Internally, the `index` variable is a manifest object that looks something like this

```
{
  "index": "./index.html",
  "files": [\
    {\
      "input": "index.html",\
      "path": "./index-f2me3qnf.js",\
      "loader": "js",\
      "isEntry": true,\
      "headers": {\
        "etag": "eet6gn75",\
        "content-type": "text/javascript;charset=utf-8"\
      }\
    },\
    {\
      "input": "index.html",\
      "path": "./index.html",\
      "loader": "html",\
      "isEntry": true,\
      "headers": {\
        "etag": "r9njjakd",\
        "content-type": "text/html;charset=utf-8"\
      }\
    },\
    {\
      "input": "index.html",\
      "path": "./index-gysa5fmk.css",\
      "loader": "css",\
      "isEntry": true,\
      "headers": {\
        "etag": "50zb7x61",\
        "content-type": "text/css;charset=utf-8"\
      }\
    },\
    {\
      "input": "logo.svg",\
      "path": "./logo-kygw735p.svg",\
      "loader": "file",\
      "isEntry": false,\
      "headers": {\
        "etag": "kygw735p",\
        "content-type": "application/octet-stream"\
      }\
    },\
    {\
      "input": "react.svg",\
      "path": "./react-ck11dneg.svg",\
      "loader": "file",\
      "isEntry": false,\
      "headers": {\
        "etag": "ck11dneg",\
        "content-type": "application/octet-stream"\
      }\
    }\
  ]
}

```

##### Runtime bundling

When adding a build step is too complicated, you can set `development: false` in `Bun.serve()`.

- Enable in-memory caching of bundled assets. Bun will bundle assets lazily on the first request to an `.html` file, and cache the result in memory until the server restarts.
- Enables `Cache-Control` headers and `ETag` headers
- Minifies JavaScript/TypeScript/TSX/JSX files

## [Plugins](https://bun.com/docs/bundler/fullstack\#plugins)

Bun's [bundler plugins](https://bun.com/docs/bundler/plugins) are also supported when bundling static routes.

To configure plugins for `Bun.serve`, add a `plugins` array in the `[serve.static]` section of your `bunfig.toml`.

### [Using TailwindCSS in HTML routes](https://bun.com/docs/bundler/fullstack\#using-tailwindcss-in-html-routes)

For example, enable TailwindCSS on your routes by installing and adding the `bun-plugin-tailwind` plugin:

```
bun add bun-plugin-tailwind
```

bunfig.toml

```
[serve.static]
plugins = ["bun-plugin-tailwind"]

```

This will allow you to use TailwindCSS utility classes in your HTML and CSS files. All you need to do is import `tailwindcss` somewhere:

index.html

```
<!doctype html>
<html>
  <head>
    <title>Home</title>
    <link rel="stylesheet" href="tailwindcss" />
  </head>
  <body>
    <!-- the rest of your HTML... -->
  </body>
</html>

```

Or in your CSS:

style.css

```
@import "tailwindcss";

```

### [Custom plugins](https://bun.com/docs/bundler/fullstack\#custom-plugins)

Any JS file or module which exports a [valid bundler plugin object](https://bun.com/docs/bundler/plugins#usage) (essentially an object with a `name` and `setup` field) can be placed inside the `plugins` array:

bunfig.toml

```
[serve.static]
plugins = ["./my-plugin-implementation.ts"]

```

Bun will lazily resolve and load each plugin and use them to bundle your routes.

Note: this is currently in `bunfig.toml` to make it possible to know statically which plugins are in use when we eventually integrate this with the `bun build` CLI. These plugins work in `Bun.build()`'s JS API, but are not yet supported in the CLI.

## [How this works](https://bun.com/docs/bundler/fullstack\#how-this-works)

Bun uses [`HTMLRewriter`](https://bun.com/docs/api/html-rewriter) to scan for `<script>` and `<link>` tags in HTML files, uses them as entrypoints for [Bun's bundler](https://bun.com/docs/bundler), generates an optimized bundle for the JavaScript/TypeScript/TSX/JSX and CSS files, and serves the result.

1. **`<script>` processing**


   - Transpiles TypeScript, JSX, and TSX in `<script>` tags
   - Bundles imported dependencies
   - Generates sourcemaps for debugging
   - Minifies when `development` is not `true` in `Bun.serve()`

```
<script type="module" src="./counter.tsx"></script>

```

2. **`<link>` processing**


   - Processes CSS imports and `<link>` tags
   - Concatenates CSS files
   - Rewrites `url` and asset paths to include content-addressable hashes in URLs

```
<link rel="stylesheet" href="./styles.css" />

```

3. **`<img>` & asset processing**

   - Links to assets are rewritten to include content-addressable hashes in URLs
   - Small assets in CSS files are inlined into `data:` URLs, reducing the total number of HTTP requests sent over the wire
4. **Rewrite HTML**

   - Combines all `<script>` tags into a single `<script>` tag with a content-addressable hash in the URL
   - Combines all `<link>` tags into a single `<link>` tag with a content-addressable hash in the URL
   - Outputs a new HTML file
5. **Serve**

   - All the output files from the bundler are exposed as static routes, using the same mechanism internally as when you pass a `Response` object to [`static` in `Bun.serve()`](https://bun.com/docs/api/http#static-routes).

This works similarly to how [`Bun.build` processes HTML files](https://bun.com/docs/bundler/html).

## [This is a work in progress](https://bun.com/docs/bundler/fullstack\#this-is-a-work-in-progress)

- This doesn't support `bun build` yet. It also will in the future.

[Previous\\
\\
CSS](https://bun.com/docs/bundler/css) [Next\\
\\
Hot reloading](https://bun.com/docs/bundler/hmr)

[![GitHub logo](<Base64-Image-Removed>)![GitHub logo](<Base64-Image-Removed>)\\
\\
Edit on GitHub](https://github.com/oven-sh/bun/edit/main/docs/bundler/fullstack.md)

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