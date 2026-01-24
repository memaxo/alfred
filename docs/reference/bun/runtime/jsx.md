---
title: JSX – Runtime | Bun Docs
url:
description: Bun can directly execute TypeScript files without additional configuration.
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

[`bun run`](https://bun.com/docs/cli/run) [File types](https://bun.com/docs/runtime/loaders) [TypeScript](https://bun.com/docs/runtime/typescript) [JSX](https://bun.com/docs/runtime/jsx)

[Configuration](https://bun.com/docs/runtime/jsx#configuration) [`jsx`](https://bun.com/docs/runtime/jsx#jsx) [`jsxFactory`](https://bun.com/docs/runtime/jsx#jsxfactory) [`jsxFragmentFactory`](https://bun.com/docs/runtime/jsx#jsxfragmentfactory) [`jsxImportSource`](https://bun.com/docs/runtime/jsx#jsximportsource) [`jsxSideEffects`](https://bun.com/docs/runtime/jsx#jsxsideeffects) [JSX pragma](https://bun.com/docs/runtime/jsx#jsx-pragma) [Logging](https://bun.com/docs/runtime/jsx#logging) [Prop punning](https://bun.com/docs/runtime/jsx#prop-punning)

[Environment variables](https://bun.com/docs/runtime/env) [Bun APIs](https://bun.com/docs/runtime/bun-apis) [Web APIs](https://bun.com/docs/runtime/web-apis) [Node.js compatibility](https://bun.com/docs/runtime/nodejs-apis) [Single-file executable](https://bun.com/docs/bundler/executables) [Plugins](https://bun.com/docs/runtime/plugins) [Watch mode](https://bun.com/docs/runtime/hot) [Module resolution](https://bun.com/docs/runtime/modules) [Auto-install](https://bun.com/docs/runtime/autoimport) [bunfig.toml](https://bun.com/docs/runtime/bunfig) [Debugger](https://bun.com/docs/runtime/debugger)

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

Bun supports `.jsx` and `.tsx` files out of the box. Bun's internal transpiler converts JSX syntax into vanilla JavaScript before execution.

react.tsx

```
function Component(props: {message: string}) {
  return (
    <body>
      <h1 style={{color: 'red'}}>{props.message}</h1>
    </body>
  );
}

console.log(<Component message="Hello world!" />);

```

## [Configuration](https://bun.com/docs/runtime/jsx#configuration)

Bun reads your `tsconfig.json` or `jsconfig.json` configuration files to determines how to perform the JSX transform internally. To avoid using either of these, the following options can also be defined in [`bunfig.toml`](https://bun.com/docs/runtime/bunfig).

The following compiler options are respected.

### [`jsx`](https://www.typescriptlang.org/tsconfig#jsx)

How JSX constructs are transformed into vanilla JavaScript internally. The table below lists the possible values of `jsx`, along with their transpilation of the following simple JSX component:

```
<Box width={5}>Hello</Box>

```

| Compiler options                            | Transpiled output                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `<br>{<br>  "jsx": "react"<br>}<br>`        | `<br>import { createElement } from "react";<br>createElement("Box", { width: 5 }, "Hello");<br>`                                                                                                                                                                                                                                                                                                                                                       |
| `<br>{<br>  "jsx": "react-jsx"<br>}<br>`    | `<br>import { jsx } from "react/jsx-runtime";<br>jsx("Box", { width: 5 }, "Hello");<br>`                                                                                                                                                                                                                                                                                                                                                               |
| `<br>{<br>  "jsx": "react-jsxdev"<br>}<br>` | `<br>import { jsxDEV } from "react/jsx-dev-runtime";<br>jsxDEV(<br>  "Box",<br>  { width: 5, children: "Hello" },<br>  undefined,<br>  false,<br>  undefined,<br>  this,<br>);<br>`<br>The `jsxDEV` variable name is a convention used by React. The `DEV` suffix is a visible way to indicate that the code is intended for use in development. The development version of React is slower and includes additional validity checks & debugging tools. |
| `<br>{<br>  "jsx": "preserve"<br>}<br>`     | `<br>// JSX is not transpiled<br>// "preserve" is not supported by Bun currently<br><Box width={5}>Hello</Box><br>`                                                                                                                                                                                                                                                                                                                                    |

### [`jsxFactory`](https://www.typescriptlang.org/tsconfig#jsxFactory)

**Note** — Only applicable when `jsx` is `react`.

The function name used to represent JSX constructs. Default value is `"createElement"`. This is useful for libraries like [Preact](https://preactjs.com/) that use a different function name ( `"h"`).

| Compiler options                                             | Transpiled output                                                        |
| ------------------------------------------------------------ | ------------------------------------------------------------------------ |
| `<br>{<br>  "jsx": "react",<br>  "jsxFactory": "h"<br>}<br>` | `<br>import { h } from "react";<br>h("Box", { width: 5 }, "Hello");<br>` |

### [`jsxFragmentFactory`](https://www.typescriptlang.org/tsconfig#jsxFragmentFactory)

**Note** — Only applicable when `jsx` is `react`.

The function name used to represent [JSX fragments](https://react.dev/reference/react/Fragment) such as `<>Hello</>`; only applicable when `jsx` is `react`. Default value is `"Fragment"`.

| Compiler options                                                                                          | Transpiled output                                                                                                                 |
| --------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `<br>{<br>  "jsx": "react",<br>  "jsxFactory": "myjsx",<br>  "jsxFragmentFactory": "MyFragment"<br>}<br>` | `<br>// input<br><>Hello</>;<br>// output<br>import { myjsx, MyFragment } from "react";<br>myjsx(MyFragment, null, "Hello");<br>` |

### [`jsxImportSource`](https://www.typescriptlang.org/tsconfig#jsxImportSource)

**Note** — Only applicable when `jsx` is `react-jsx` or `react-jsxdev`.

The module from which the component factory function ( `createElement`, `jsx`, `jsxDEV`, etc) will be imported. Default value is `"react"`. This will typically be necessary when using a component library like Preact.

| Compiler options                                                                                        | Transpiled output                                                                                                                                                                                                                 |
| ------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `<br>{<br>  "jsx": "react",<br>  // jsxImportSource is not defined<br>  // default to "react"<br>}<br>` | `<br>import { jsx } from "react/jsx-runtime";<br>jsx("Box", { width: 5, children: "Hello" });<br>`                                                                                                                                |
| `<br>{<br>  "jsx": "react-jsx",<br>  "jsxImportSource": "preact",<br>}<br>`                             | `<br>import { jsx } from "preact/jsx-runtime";<br>jsx("Box", { width: 5, children: "Hello" });<br>`                                                                                                                               |
| `<br>{<br>  "jsx": "react-jsxdev",<br>  "jsxImportSource": "preact",<br>}<br>`                          | `<br>// /jsx-runtime is automatically appended<br>import { jsxDEV } from "preact/jsx-dev-runtime";<br>jsxDEV(<br>  "Box",<br>  { width: 5, children: "Hello" },<br>  undefined,<br>  false,<br>  undefined,<br>  this,<br>);<br>` |

### [`jsxSideEffects`](https://bun.com/docs/runtime/jsx#jsxsideeffects)

By default, Bun marks JSX expressions as `/* @__PURE__ */` so they can be removed during bundling if they are unused (known as "dead code elimination" or "tree shaking"). Set `jsxSideEffects` to `true` to prevent this behavior.

| Compiler options                                                                 | Transpiled output                                                                                             |
| -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `<br>{<br>  "jsx": "react",<br>  // jsxSideEffects is false by default<br>}<br>` | `<br>// JSX expressions are marked as pure<br>/* @__PURE__ */ React.createElement("div", null, "Hello");<br>` |
| `<br>{<br>  "jsx": "react",<br>  "jsxSideEffects": true,<br>}<br>`               | `<br>// JSX expressions are not marked as pure<br>React.createElement("div", null, "Hello");<br>`             |
| `<br>{<br>  "jsx": "react-jsx",<br>  "jsxSideEffects": true,<br>}<br>`           | `<br>// Automatic runtime also respects jsxSideEffects<br>jsx("div", { children: "Hello" });<br>`             |

This option is also available as a CLI flag:

```
bun build --jsx-side-effects
```

### [JSX pragma](https://bun.com/docs/runtime/jsx#jsx-pragma)

All of these values can be set on a per-file basis using _pragmas_. A pragma is a special comment that sets a compiler option in a particular file.

| Pragma                               | Equivalent config                                         |
| ------------------------------------ | --------------------------------------------------------- |
| `<br>// @jsx h<br>`                  | `<br>{<br>  "jsxFactory": "h",<br>}<br>`                  |
| `<br>// @jsxFrag MyFragment<br>`     | `<br>{<br>  "jsxFragmentFactory": "MyFragment",<br>}<br>` |
| `<br>// @jsxImportSource preact<br>` | `<br>{<br>  "jsxImportSource": "preact",<br>}<br>`        |

## [Logging](https://bun.com/docs/runtime/jsx#logging)

Bun implements special logging for JSX to make debugging easier. Given the following file:

index.tsx

```
import { Stack, UserCard } from "./components";

console.log(
  <Stack>
    <UserCard name="Dom" bio="Street racer and Corona lover" />
    <UserCard name="Jakob" bio="Super spy and Dom's secret brother" />
  </Stack>
);

```

Bun will pretty-print the component tree when logged:

[![](https://github.com/oven-sh/bun/assets/3084745/d29db51d-6837-44e2-b8be-84fc1b9e9d97)](https://github.com/oven-sh/bun/assets/3084745/d29db51d-6837-44e2-b8be-84fc1b9e9d97)

## [Prop punning](https://bun.com/docs/runtime/jsx#prop-punning)

The Bun runtime also supports "prop punning" for JSX. This is a shorthand syntax useful for assigning a variable to a prop with the same name.

```
function Div(props: {className: string;}) {
  const {className} = props;

  // without punning
  return <div className={className} />;
  // with punning
  return <div {className} />;
}

```

[Previous\\
\\
TypeScript](https://bun.com/docs/runtime/typescript) [Next\\
\\
Environment variables](https://bun.com/docs/runtime/env)

[![GitHub logo](Base64-Image-Removed)![GitHub logo](Base64-Image-Removed)\\
\\
Edit on GitHub](https://github.com/oven-sh/bun/edit/main/docs/runtime/jsx.md)

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
