---
title: Watch mode – Test runner | Bun Docs
url: 
description: Reload your tests automatically on change.
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

[HTTP server](https://bun.com/docs/api/http) [HTTP client](https://bun.com/docs/api/fetch) [WebSockets](https://bun.com/docs/api/websockets) [Workers](https://bun.com/docs/api/workers) [Binary data](https://bun.com/docs/api/binary-data) [Streams](https://bun.com/docs/api/streams) [SQL](https://bun.com/docs/api/sql) [S3 Object Storage](https://bun.com/docs/api/s3) [File I/O](https://bun.com/docs/api/file-io) [Redis client](https://bun.com/docs/api/redis) [import.meta](https://bun.com/docs/api/import-meta) [SQLite](https://bun.com/docs/api/sqlite) [FileSystemRouter](https://bun.com/docs/api/file-system-router) [TCP sockets](https://bun.com/docs/api/tcp) [UDP sockets](https://bun.com/docs/api/udp) [Globals](https://bun.com/docs/api/globals) [$ Shell](https://bun.com/docs/runtime/shell) [Child processes](https://bun.com/docs/api/spawn) [YAML](https://bun.com/docs/api/yaml) [HTMLRewriter](https://bun.com/docs/api/html-rewriter) [Hashing](https://bun.com/docs/api/hashing) [Console](https://bun.com/docs/api/console) [Cookie](https://bun.com/docs/api/cookie) [FFI](https://bun.com/docs/api/ffi) [C Compiler](https://bun.com/docs/api/cc) [Secrets](https://bun.com/docs/api/secrets) [Testing](https://bun.com/docs/cli/test) [Utils](https://bun.com/docs/api/utils) [Node-API](https://bun.com/docs/api/node-api) [Glob](https://bun.com/docs/api/glob) [DNS](https://bun.com/docs/api/dns) [Semver](https://bun.com/docs/api/semver) [Color](https://bun.com/docs/api/color) [Transpiler](https://bun.com/docs/api/transpiler)

Project

[Roadmap](https://bun.com/docs/project/roadmap) [Benchmarking](https://bun.com/docs/project/benchmarking) [Contributing](https://bun.com/docs/project/contributing) [Building Windows](https://bun.com/docs/project/building-windows) [Bindgen](https://bun.com/docs/project/bindgen) [License](https://bun.com/docs/project/licensing)

To automatically re-run tests when files change, use the `--watch` flag:

```
bun test --watch
```

Bun will watch for changes to any files imported in a test file, and re-run tests when a change is detected.

It's fast.

Twitter Embed

[Visit this post on X](https://twitter.com/jarredsumner/status/1640890850535436288?ref_src=twsrc%5Etfw%7Ctwcamp%5Etweetembed%7Ctwterm%5E1640890850535436288%7Ctwgr%5E862e0c5e81f29b03b43ee9cdba247bfdb02aff43%7Ctwcon%5Es1_&ref_url=https%3A%2F%2Fbun.com%2Fdocs%2Ftest%2Fhot)

[![](https://pbs.twimg.com/profile_images/1342417825483300864/Vz4ChOFG_normal.jpg)](https://twitter.com/jarredsumner?ref_src=twsrc%5Etfw%7Ctwcamp%5Etweetembed%7Ctwterm%5E1640890850535436288%7Ctwgr%5E862e0c5e81f29b03b43ee9cdba247bfdb02aff43%7Ctwcon%5Es1_&ref_url=https%3A%2F%2Fbun.com%2Fdocs%2Ftest%2Fhot)

[Jarred Sumner\\
\\
![](https://pbs.twimg.com/profile_images/1809959835884216320/MDn6rbnJ_bigger.jpg)](https://twitter.com/jarredsumner?ref_src=twsrc%5Etfw%7Ctwcamp%5Etweetembed%7Ctwterm%5E1640890850535436288%7Ctwgr%5E862e0c5e81f29b03b43ee9cdba247bfdb02aff43%7Ctwcon%5Es1_&ref_url=https%3A%2F%2Fbun.com%2Fdocs%2Ftest%2Fhot)

[@jarredsumner](https://twitter.com/jarredsumner?ref_src=twsrc%5Etfw%7Ctwcamp%5Etweetembed%7Ctwterm%5E1640890850535436288%7Ctwgr%5E862e0c5e81f29b03b43ee9cdba247bfdb02aff43%7Ctwcon%5Es1_&ref_url=https%3A%2F%2Fbun.com%2Fdocs%2Ftest%2Fhot)

·

[Follow](https://twitter.com/intent/follow?ref_src=twsrc%5Etfw%7Ctwcamp%5Etweetembed%7Ctwterm%5E1640890850535436288%7Ctwgr%5E862e0c5e81f29b03b43ee9cdba247bfdb02aff43%7Ctwcon%5Es1_&ref_url=https%3A%2F%2Fbun.com%2Fdocs%2Ftest%2Fhot&screen_name=jarredsumner)

[View on X](https://twitter.com/jarredsumner/status/1640890850535436288?ref_src=twsrc%5Etfw%7Ctwcamp%5Etweetembed%7Ctwterm%5E1640890850535436288%7Ctwgr%5E862e0c5e81f29b03b43ee9cdba247bfdb02aff43%7Ctwcon%5Es1_&ref_url=https%3A%2F%2Fbun.com%2Fdocs%2Ftest%2Fhot)

"bun test --watch url" in a large folder with multiple files that start with "url"

![](https://pbs.twimg.com/tweet_video_thumb/FsWdcJEaAAAphwb.jpg)

GIF

[Watch on X](https://twitter.com/jarredsumner/status/1640890850535436288?ref_src=twsrc%5Etfw%7Ctwcamp%5Etweetembed%7Ctwterm%5E1640890850535436288%7Ctwgr%5E862e0c5e81f29b03b43ee9cdba247bfdb02aff43%7Ctwcon%5Es1_&ref_url=https%3A%2F%2Fbun.com%2Fdocs%2Ftest%2Fhot)

[1:37 AM · Mar 29, 2023](https://twitter.com/jarredsumner/status/1640890850535436288?ref_src=twsrc%5Etfw%7Ctwcamp%5Etweetembed%7Ctwterm%5E1640890850535436288%7Ctwgr%5E862e0c5e81f29b03b43ee9cdba247bfdb02aff43%7Ctwcon%5Es1_&ref_url=https%3A%2F%2Fbun.com%2Fdocs%2Ftest%2Fhot)

[X Ads info and privacy](https://help.twitter.com/en/twitter-for-websites-ads-info-and-privacy)

[54](https://twitter.com/intent/like?ref_src=twsrc%5Etfw%7Ctwcamp%5Etweetembed%7Ctwterm%5E1640890850535436288%7Ctwgr%5E862e0c5e81f29b03b43ee9cdba247bfdb02aff43%7Ctwcon%5Es1_&ref_url=https%3A%2F%2Fbun.com%2Fdocs%2Ftest%2Fhot&tweet_id=1640890850535436288) [Reply](https://twitter.com/intent/tweet?ref_src=twsrc%5Etfw%7Ctwcamp%5Etweetembed%7Ctwterm%5E1640890850535436288%7Ctwgr%5E862e0c5e81f29b03b43ee9cdba247bfdb02aff43%7Ctwcon%5Es1_&ref_url=https%3A%2F%2Fbun.com%2Fdocs%2Ftest%2Fhot&in_reply_to=1640890850535436288)

Copy link

[Read 4 replies](https://twitter.com/jarredsumner/status/1640890850535436288?ref_src=twsrc%5Etfw%7Ctwcamp%5Etweetembed%7Ctwterm%5E1640890850535436288%7Ctwgr%5E862e0c5e81f29b03b43ee9cdba247bfdb02aff43%7Ctwcon%5Es1_&ref_url=https%3A%2F%2Fbun.com%2Fdocs%2Ftest%2Fhot)

[Previous\\
\\
Writing tests](https://bun.com/docs/test/writing) [Next\\
\\
Lifecycle hooks](https://bun.com/docs/test/lifecycle)

[![GitHub logo](<Base64-Image-Removed>)![GitHub logo](<Base64-Image-Removed>)\\
\\
Edit on GitHub](https://github.com/oven-sh/bun/edit/main/docs/test/hot.md)

Twitter Widget Iframe

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