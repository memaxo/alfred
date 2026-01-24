---
title: Color – API | Bun Docs
url:
description: Bun's color function leverages Bun's CSS parser for parsing, normalizing, and converting colors from user input to a variety of output formats.
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

[HTTP server](https://bun.com/docs/api/http) [HTTP client](https://bun.com/docs/api/fetch) [WebSockets](https://bun.com/docs/api/websockets) [Workers](https://bun.com/docs/api/workers) [Binary data](https://bun.com/docs/api/binary-data) [Streams](https://bun.com/docs/api/streams) [SQL](https://bun.com/docs/api/sql) [S3 Object Storage](https://bun.com/docs/api/s3) [File I/O](https://bun.com/docs/api/file-io) [Redis client](https://bun.com/docs/api/redis) [import.meta](https://bun.com/docs/api/import-meta) [SQLite](https://bun.com/docs/api/sqlite) [FileSystemRouter](https://bun.com/docs/api/file-system-router) [TCP sockets](https://bun.com/docs/api/tcp) [UDP sockets](https://bun.com/docs/api/udp) [Globals](https://bun.com/docs/api/globals) [$ Shell](https://bun.com/docs/runtime/shell) [Child processes](https://bun.com/docs/api/spawn) [YAML](https://bun.com/docs/api/yaml) [HTMLRewriter](https://bun.com/docs/api/html-rewriter) [Hashing](https://bun.com/docs/api/hashing) [Console](https://bun.com/docs/api/console) [Cookie](https://bun.com/docs/api/cookie) [FFI](https://bun.com/docs/api/ffi) [C Compiler](https://bun.com/docs/api/cc) [Secrets](https://bun.com/docs/api/secrets) [Testing](https://bun.com/docs/cli/test) [Utils](https://bun.com/docs/api/utils) [Node-API](https://bun.com/docs/api/node-api) [Glob](https://bun.com/docs/api/glob) [DNS](https://bun.com/docs/api/dns) [Semver](https://bun.com/docs/api/semver) [Color](https://bun.com/docs/api/color)

[Flexible input](https://bun.com/docs/api/color#flexible-input) [Format colors as CSS](https://bun.com/docs/api/color#format-colors-as-css) [Format colors as ANSI (for terminals)](https://bun.com/docs/api/color#format-colors-as-ansi-for-terminals) [Format colors as numbers](https://bun.com/docs/api/color#format-colors-as-numbers) [Get the red, green, blue, and alpha channels](https://bun.com/docs/api/color#get-the-red-green-blue-and-alpha-channels) [Format colors as hex strings](https://bun.com/docs/api/color#format-colors-as-hex-strings) [Bundle-time client-side color formatting](https://bun.com/docs/api/color#bundle-time-client-side-color-formatting)

[Transpiler](https://bun.com/docs/api/transpiler)

Project

[Roadmap](https://bun.com/docs/project/roadmap) [Benchmarking](https://bun.com/docs/project/benchmarking) [Contributing](https://bun.com/docs/project/contributing) [Building Windows](https://bun.com/docs/project/building-windows) [Bindgen](https://bun.com/docs/project/bindgen) [License](https://bun.com/docs/project/licensing)

`Bun.color(input, outputFormat?)` leverages Bun's CSS parser to parse, normalize, and convert colors from user input to a variety of output formats, including:

| Format       | Example                          |
| ------------ | -------------------------------- | --- |
| `"css"`      | `"red"`                          |
| `"ansi"`     | `"\x1b[38;2;255;0;0m"`           | \   |
| `"ansi-16"`  | `"\x1b[38;5;\tm"`                | \   |
| `"ansi-256"` | `"\x1b[38;5;196m"`               | \   |
| `"ansi-16m"` | `"\x1b[38;2;255;0;0m"`           | \   |
| `"number"`   | `0x1a2b3c`                       | \   |
| `"rgb"`      | `"rgb(255, 99, 71)"`             | \   |
| `"rgba"`     | `"rgba(255, 99, 71, 0.5)"`       | \   |
| `"hsl"`      | `"hsl(120, 50%, 50%)"`           | \   |
| `"hex"`      | `"#1a2b3c"`                      | \   |
| `"HEX"`      | `"#1A2B3C"`                      | \   |
| `"{rgb}"`    | `{ r: 255, g: 99, b: 71 }`       | \   |
| `"{rgba}"`   | `{ r: 255, g: 99, b: 71, a: 1 }` | \   |
| `"[rgb]"`    | `[ 255, 99, 71 ]`                | \   |
| `"[rgba]"`   | `[ 255, 99, 71, 255]`            | \   |

\
There are many different ways to use this API:\
\

- Validate and normalize colors to persist in a database ( `number` is the most database-friendly)\
- Convert colors to different formats\
- Colorful logging beyond the 16 colors many use today (use `ansi` if you don't want to figure out what the user's terminal supports, otherwise use `ansi-16`, `ansi-256`, or `ansi-16m` for how many colors the terminal supports)\
- Format colors for use in CSS injected into HTML\
- Get the `r`, `g`, `b`, and `a` color components as JavaScript objects or numbers from a CSS color string\
  \
  You can think of this as an alternative to the popular npm packages [`color`](https://github.com/Qix-/color) and [`tinycolor2`](https://github.com/bgrins/TinyColor) except with full support for parsing CSS color strings and zero dependencies built directly into Bun.\
  \

### [Flexible input](https://bun.com/docs/api/color#flexible-input)\

\
You can pass in any of the following:\
\

- Standard CSS color names like `"red"`\
- Numbers like `0xff0000`\
- Hex strings like `"#f00"`\
- RGB strings like `"rgb(255, 0, 0)"`\
- RGBA strings like `"rgba(255, 0, 0, 1)"`\
- HSL strings like `"hsl(0, 100%, 50%)"`\
- HSLA strings like `"hsla(0, 100%, 50%, 1)"`\
- RGB objects like `{ r: 255, g: 0, b: 0 }`\
- RGBA objects like `{ r: 255, g: 0, b: 0, a: 1 }`\
- RGB arrays like `[255, 0, 0]`\
- RGBA arrays like `[255, 0, 0, 255]`\
- LAB strings like `"lab(50% 50% 50%)"`\
- ... anything else that CSS can parse as a single color value\
  \

### [Format colors as CSS](https://bun.com/docs/api/color#format-colors-as-css)\

\
The `"css"` format outputs valid CSS for use in stylesheets, inline styles, CSS variables, css-in-js, etc. It returns the most compact representation of the color as a string.\
\

````\
Bun.color("red", "css"); // "red"\
Bun.color(0xff0000, "css"); // "#f000"\
Bun.color("#f00", "css"); // "red"\
Bun.color("#ff0000", "css"); // "red"\
Bun.color("rgb(255, 0, 0)", "css"); // "red"\
Bun.color("rgba(255, 0, 0, 1)", "css"); // "red"\
Bun.color("hsl(0, 100%, 50%)", "css"); // "red"\
Bun.color("hsla(0, 100%, 50%, 1)", "css"); // "red"\
Bun.color({ r: 255, g: 0, b: 0 }, "css"); // "red"\
Bun.color({ r: 255, g: 0, b: 0, a: 1 }, "css"); // "red"\
Bun.color([255, 0, 0], "css"); // "red"\
Bun.color([255, 0, 0, 255], "css"); // "red"\
\
```\
\
If the input is unknown or fails to parse, `Bun.color` returns `null`.\
\
### [Format colors as ANSI (for terminals)](https://bun.com/docs/api/color\#format-colors-as-ansi-for-terminals)\
\
The `"ansi"` format outputs ANSI escape codes for use in terminals to make text colorful.\
\
```\
Bun.color("red", "ansi"); // "\u001b[38;2;255;0;0m"\
Bun.color(0xff0000, "ansi"); // "\u001b[38;2;255;0;0m"\
Bun.color("#f00", "ansi"); // "\u001b[38;2;255;0;0m"\
Bun.color("#ff0000", "ansi"); // "\u001b[38;2;255;0;0m"\
Bun.color("rgb(255, 0, 0)", "ansi"); // "\u001b[38;2;255;0;0m"\
Bun.color("rgba(255, 0, 0, 1)", "ansi"); // "\u001b[38;2;255;0;0m"\
Bun.color("hsl(0, 100%, 50%)", "ansi"); // "\u001b[38;2;255;0;0m"\
Bun.color("hsla(0, 100%, 50%, 1)", "ansi"); // "\u001b[38;2;255;0;0m"\
Bun.color({ r: 255, g: 0, b: 0 }, "ansi"); // "\u001b[38;2;255;0;0m"\
Bun.color({ r: 255, g: 0, b: 0, a: 1 }, "ansi"); // "\u001b[38;2;255;0;0m"\
Bun.color([255, 0, 0], "ansi"); // "\u001b[38;2;255;0;0m"\
Bun.color([255, 0, 0, 255], "ansi"); // "\u001b[38;2;255;0;0m"\
\
```\
\
This gets the color depth of stdout and automatically chooses one of `"ansi-16m"`, `"ansi-256"`, `"ansi-16"` based on the environment variables. If stdout doesn't support any form of ANSI color, it returns an empty string. As with the rest of Bun's color API, if the input is unknown or fails to parse, it returns `null`.\
\
#### 24-bit ANSI colors ( `ansi-16m`)\
\
The `"ansi-16m"` format outputs 24-bit ANSI colors for use in terminals to make text colorful. 24-bit color means you can display 16 million colors on supported terminals, and requires a modern terminal that supports it.\
\
This converts the input color to RGBA, and then outputs that as an ANSI color.\
\
```\
Bun.color("red", "ansi-16m"); // "\x1b[38;2;255;0;0m"\
Bun.color(0xff0000, "ansi-16m"); // "\x1b[38;2;255;0;0m"\
Bun.color("#f00", "ansi-16m"); // "\x1b[38;2;255;0;0m"\
Bun.color("#ff0000", "ansi-16m"); // "\x1b[38;2;255;0;0m"\
\
```\
\
#### 256 ANSI colors ( `ansi-256`)\
\
The `"ansi-256"` format approximates the input color to the nearest of the 256 ANSI colors supported by some terminals.\
\
```\
Bun.color("red", "ansi-256"); // "\u001b[38;5;196m"\
Bun.color(0xff0000, "ansi-256"); // "\u001b[38;5;196m"\
Bun.color("#f00", "ansi-256"); // "\u001b[38;5;196m"\
Bun.color("#ff0000", "ansi-256"); // "\u001b[38;5;196m"\
\
```\
\
To convert from RGBA to one of the 256 ANSI colors, we ported the algorithm that [`tmux` uses](https://github.com/tmux/tmux/blob/dae2868d1227b95fd076fb4a5efa6256c7245943/colour.c#L44-L55).\
\
#### 16 ANSI colors ( `ansi-16`)\
\
The `"ansi-16"` format approximates the input color to the nearest of the 16 ANSI colors supported by most terminals.\
\
```\
Bun.color("red", "ansi-16"); // "\u001b[38;5;\tm"\
Bun.color(0xff0000, "ansi-16"); // "\u001b[38;5;\tm"\
Bun.color("#f00", "ansi-16"); // "\u001b[38;5;\tm"\
Bun.color("#ff0000", "ansi-16"); // "\u001b[38;5;\tm"\
\
```\
\
This works by first converting the input to a 24-bit RGB color space, then to `ansi-256`, and then we convert that to the nearest 16 ANSI color.\
\
### [Format colors as numbers](https://bun.com/docs/api/color\#format-colors-as-numbers)\
\
The `"number"` format outputs a 24-bit number for use in databases, configuration, or any other use case where a compact representation of the color is desired.\
\
```\
Bun.color("red", "number"); // 16711680\
Bun.color(0xff0000, "number"); // 16711680\
Bun.color({ r: 255, g: 0, b: 0 }, "number"); // 16711680\
Bun.color([255, 0, 0], "number"); // 16711680\
Bun.color("rgb(255, 0, 0)", "number"); // 16711680\
Bun.color("rgba(255, 0, 0, 1)", "number"); // 16711680\
Bun.color("hsl(0, 100%, 50%)", "number"); // 16711680\
Bun.color("hsla(0, 100%, 50%, 1)", "number"); // 16711680\
\
```\
\
### [Get the red, green, blue, and alpha channels](https://bun.com/docs/api/color\#get-the-red-green-blue-and-alpha-channels)\
\
You can use the `"{rgba}"`, `"{rgb}"`, `"[rgba]"` and `"[rgb]"` formats to get the red, green, blue, and alpha channels as objects or arrays.\
\
#### `{rgba}` object\
\
The `"{rgba}"` format outputs an object with the red, green, blue, and alpha channels.\
\
```\
type RGBAObject = {\
  // 0 - 255\
  r: number;\
  // 0 - 255\
  g: number;\
  // 0 - 255\
  b: number;\
  // 0 - 1\
  a: number;\
};\
\
```\
\
Example:\
\
```\
Bun.color("hsl(0, 0%, 50%)", "{rgba}"); // { r: 128, g: 128, b: 128, a: 1 }\
Bun.color("red", "{rgba}"); // { r: 255, g: 0, b: 0, a: 1 }\
Bun.color(0xff0000, "{rgba}"); // { r: 255, g: 0, b: 0, a: 1 }\
Bun.color({ r: 255, g: 0, b: 0 }, "{rgba}"); // { r: 255, g: 0, b: 0, a: 1 }\
Bun.color([255, 0, 0], "{rgba}"); // { r: 255, g: 0, b: 0, a: 1 }\
\
```\
\
To behave similarly to CSS, the `a` channel is a decimal number between `0` and `1`.\
\
The `"{rgb}"` format is similar, but it doesn't include the alpha channel.\
\
```\
Bun.color("hsl(0, 0%, 50%)", "{rgb}"); // { r: 128, g: 128, b: 128 }\
Bun.color("red", "{rgb}"); // { r: 255, g: 0, b: 0 }\
Bun.color(0xff0000, "{rgb}"); // { r: 255, g: 0, b: 0 }\
Bun.color({ r: 255, g: 0, b: 0 }, "{rgb}"); // { r: 255, g: 0, b: 0 }\
Bun.color([255, 0, 0], "{rgb}"); // { r: 255, g: 0, b: 0 }\
\
```\
\
#### `[rgba]` array\
\
The `"[rgba]"` format outputs an array with the red, green, blue, and alpha channels.\
\
```\
// All values are 0 - 255\
type RGBAArray = [number, number, number, number];\
\
```\
\
Example:\
\
```\
Bun.color("hsl(0, 0%, 50%)", "[rgba]"); // [128, 128, 128, 255]\
Bun.color("red", "[rgba]"); // [255, 0, 0, 255]\
Bun.color(0xff0000, "[rgba]"); // [255, 0, 0, 255]\
Bun.color({ r: 255, g: 0, b: 0 }, "[rgba]"); // [255, 0, 0, 255]\
Bun.color([255, 0, 0], "[rgba]"); // [255, 0, 0, 255]\
\
```\
\
Unlike the `"{rgba}"` format, the alpha channel is an integer between `0` and `255`. This is useful for typed arrays where each channel must be the same underlying type.\
\
The `"[rgb]"` format is similar, but it doesn't include the alpha channel.\
\
```\
Bun.color("hsl(0, 0%, 50%)", "[rgb]"); // [128, 128, 128]\
Bun.color("red", "[rgb]"); // [255, 0, 0]\
Bun.color(0xff0000, "[rgb]"); // [255, 0, 0]\
Bun.color({ r: 255, g: 0, b: 0 }, "[rgb]"); // [255, 0, 0]\
Bun.color([255, 0, 0], "[rgb]"); // [255, 0, 0]\
\
```\
\
### [Format colors as hex strings](https://bun.com/docs/api/color\#format-colors-as-hex-strings)\
\
The `"hex"` format outputs a lowercase hex string for use in CSS or other contexts.\
\
```\
Bun.color("hsl(0, 0%, 50%)", "hex"); // "#808080"\
Bun.color("red", "hex"); // "#ff0000"\
Bun.color(0xff0000, "hex"); // "#ff0000"\
Bun.color({ r: 255, g: 0, b: 0 }, "hex"); // "#ff0000"\
Bun.color([255, 0, 0], "hex"); // "#ff0000"\
\
```\
\
The `"HEX"` format is similar, but it outputs a hex string with uppercase letters instead of lowercase letters.\
\
```\
Bun.color("hsl(0, 0%, 50%)", "HEX"); // "#808080"\
Bun.color("red", "HEX"); // "#FF0000"\
Bun.color(0xff0000, "HEX"); // "#FF0000"\
Bun.color({ r: 255, g: 0, b: 0 }, "HEX"); // "#FF0000"\
Bun.color([255, 0, 0], "HEX"); // "#FF0000"\
\
```\
\
### [Bundle-time client-side color formatting](https://bun.com/docs/api/color\#bundle-time-client-side-color-formatting)\
\
Like many of Bun's APIs, you can use macros to invoke `Bun.color` at bundle-time for use in client-side JavaScript builds:\
\
client-side.ts\
\
```\
import { color } from "bun" with { type: "macro" };\
\
console.log(color("#f00", "css"));\
\
```\
\
Then, build the client-side code:\
\
```\
bun build ./client-side.ts\
\
```\
\
This will output the following to `client-side.js`:\
\
```\
// client-side.ts\
console.log("red");\
\
```\
\
[Previous\\
\\
Semver](https://bun.com/docs/api/semver) [Next\\
\\
Transpiler](https://bun.com/docs/api/transpiler)\
\
[![GitHub logo](<Base64-Image-Removed>)![GitHub logo](<Base64-Image-Removed>)\\
\\
Edit on GitHub](https://github.com/oven-sh/bun/edit/main/docs/api/color.md)\
\
Powered by\
\
[![inkeep search icon](https://uploads-ssl.webflow.com/63fd919a913cf54ca2d02cda/642ea6563549ced1bb379fea_inkeep-icon-medium-gray.svg)inkeep](https://www.inkeep.com/)\
\
![ai chat avatar](https://bun.com/logo_avatar.svg)\
\
Hi!\
\
I'm an AI assistant trained on documentation, GitHub issues, and other content.\
\
Ask me anything about `Bun`.\
\
### Popular Questions\
\
Can I use Bun with my existing Node.js project?\
\
How is Bun faster than Node.js? How can I benchmark it?\
\
Do I still need a bundler or TypeScript compiler?\
\
* * *\
\
Powered by\
\
[![inkeep search icon](https://uploads-ssl.webflow.com/63fd919a913cf54ca2d02cda/642ea6563549ced1bb379fea_inkeep-icon-medium-gray.svg)inkeep](https://www.inkeep.com/)\
\
Get help\
\
[Discord](https://bun.com/discord)\
\
[Migration help for organizations](https://t.co/0CA0Neqgts)
````
