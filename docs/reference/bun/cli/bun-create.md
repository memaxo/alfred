---
title: bun create – Templating | Bun Docs
url:
description: Scaffold a new Bun project from an official template or GitHub repo.
language: en
---

Search`` `K`

Ask AI

![ai chat avatar](https://bun.com/logo_avatar.svg)

Intro

[What is Bun?](https://bun.com/docs/index) [Installation](https://bun.com/docs/installation) [Quickstart](https://bun.com/docs/quickstart) [TypeScript](https://bun.com/docs/typescript)

Templating

[`bun init`](https://bun.com/docs/cli/init) [`bun create`](https://bun.com/docs/cli/bun-create)

[From a React component](https://bun.com/docs/cli/bun-create#from-a-react-component) [Using TailwindCSS with Bun](https://bun.com/docs/cli/bun-create#using-tailwindcss-with-bun) [Using `shadcn/ui` with Bun](https://bun.com/docs/cli/bun-create#using-shadcn-ui-with-bun) [From `npm`](https://bun.com/docs/cli/bun-create#from-npm) [From GitHub](https://bun.com/docs/cli/bun-create#from-github) [From a local template](https://bun.com/docs/cli/bun-create#from-a-local-template) [Reference](https://bun.com/docs/cli/bun-create#reference) [CLI flags](https://bun.com/docs/cli/bun-create#cli-flags) [Environment variables](https://bun.com/docs/cli/bun-create#environment-variables)

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

**Note** — You don’t need `bun create` to use Bun. You don’t need any configuration at all. This command exists to make getting started a bit quicker and easier.

Template a new Bun project with `bun create`. This is a flexible command that can be used to create a new project from a React component, a `create-<template>` npm package, a GitHub repo, or a local template.

If you're looking to create a brand new empty project, use [`bun init`](https://bun.com/docs/cli/init).

## [From a React component](https://bun.com/docs/cli/bun-create#from-a-react-component)

`bun create ./MyComponent.tsx` turns an existing React component into a complete dev environment with hot reload and production builds in one command.

```
bun create ./MyComponent.jsx # .tsx also supported
```

🚀 **Create React App Successor** — `bun create <component>` provides everything developers loved about Create React App, but with modern tooling, faster builds, and backend support.

#### How this works

When you run `bun create <component>`, Bun:

1. Uses [Bun's JavaScript bundler](https://bun.com/docs/bundler) to analyze your module graph.
2. Collects all the dependencies needed to run the component.
3. Scans the exports of the entry point for a React component.
4. Generates a `package.json` file with the dependencies and scripts needed to run the component.
5. Installs any missing dependencies using [`bun install --only-missing`](https://bun.com/docs/cli/install).
6. Generates the following files:
   - `${component}.html`
   - `${component}.client.tsx` (entry point for the frontend)
   - `${component}.css` (css file)
7. Starts a frontend dev server automatically.

### [Using TailwindCSS with Bun](https://bun.com/docs/cli/bun-create#using-tailwindcss-with-bun)

[TailwindCSS](https://tailwindcss.com/) is an extremely popular utility-first CSS framework used to style web applications.

When you run `bun create <component>`, Bun scans your JSX/TSX file for TailwindCSS class names (and any files it imports). If it detects TailwindCSS class names, it will add the following dependencies to your `package.json`:

package.json

```
{
  "dependencies": {
    "tailwindcss": "^4",
    "bun-plugin-tailwind": "latest"
  }
}

```

We also configure `bunfig.toml` to use Bun's TailwindCSS plugin with `Bun.serve()`

bunfig.toml

```
[serve.static]
plugins = ["bun-plugin-tailwind"]

```

And a `${component}.css` file with `@import "tailwindcss";` at the top:

MyComponent.css

```
@import "tailwindcss";

```

### [Using `shadcn/ui` with Bun](https://bun.com/docs/cli/bun-create#using-shadcn-ui-with-bun)

[`shadcn/ui`](https://ui.shadcn.com/) is an extremely popular component library tool for building web applications.

`bun create <component>` scans for any shadcn/ui components imported from `@/components/ui`.

If it finds any, it runs:

```
# Assuming bun detected imports to @/components/ui/accordion and @/components/ui/button
```

```
bunx shadcn@canary add accordion button # and any other components
```

Since `shadcn/ui` itself uses TailwindCSS, `bun create` also adds the necessary TailwindCSS dependencies to your `package.json` and configures `bunfig.toml` to use Bun's TailwindCSS plugin with `Bun.serve()` as described above.

Additionally, we setup the following:

- `tsconfig.json` to alias `"@/*"` to `"src/*"` or `.` (depending on if there is a `src/` directory)
- `components.json` so that shadcn/ui knows its a shadcn/ui project
- `styles/globals.css` file that configures Tailwind v4 in the way that shadcn/ui expects
- `${component}.build.ts` file that builds the component for production with `bun-plugin-tailwind` configured

`bun create ./MyComponent.jsx` is one of the easiest ways to run code generated from LLMs like [Claude](https://claude.ai/) or ChatGPT locally.

## [From `npm`](https://bun.com/docs/cli/bun-create#from-npm)

```
bun create <template> [<destination>]
```

Assuming you don't have a [local template](https://bun.com/docs/cli/bun-create#from-a-local-template) with the same name, this command will download and execute the `create-<template>` package from npm. The following two commands will behave identically:

```
bun create remix
```

```
bunx create-remix
```

Refer to the documentation of the associated `create-<template>` package for complete documentation and usage instructions.

## [From GitHub](https://bun.com/docs/cli/bun-create#from-github)

This will download the contents of the GitHub repo to disk.

```
bun create <user>/<repo>
```

```
bun create github.com/<user>/<repo>
```

Optionally specify a name for the destination folder. If no destination is specified, the repo name will be used.

```
bun create <user>/<repo> mydir
```

```
bun create github.com/<user>/<repo> mydir
```

Bun will perform the following steps:

- Download the template
- Copy all template files into the destination folder
- Install dependencies with `bun install`.
- Initialize a fresh Git repo. Opt out with the `--no-git` flag.
- Run the template's configured `start` script, if defined.

By default Bun will _not overwrite_ any existing files. Use the `--force` flag to overwrite existing files.

## [From a local template](https://bun.com/docs/cli/bun-create#from-a-local-template)

**⚠️ Warning** — Unlike remote templates, running `bun create` with a local template will delete the entire destination folder if it already exists! Be careful.

Bun's templater can be extended to support custom templates defined on your local file system. These templates should live in one of the following directories:

- `$HOME/.bun-create/<name>`: global templates
- `<project root>/.bun-create/<name>`: project-specific templates

**Note** — You can customize the global template path by setting the `BUN_CREATE_DIR` environment variable.

To create a local template, navigate to `$HOME/.bun-create` and create a new directory with the desired name of your template.

```
cd $HOME/.bun-create
```

```
mkdir foo
```

```
cd foo
```

Then, create a `package.json` file in that directory with the following contents:

```
{
  "name": "foo"
}

```

You can run `bun create foo` elsewhere on your file system to verify that Bun is correctly finding your local template.

#### Setup logic

You can specify pre- and post-install setup scripts in the `"bun-create"` section of your local template's `package.json`.

```
{
  "name": "@bun-examples/simplereact",
  "version": "0.0.1",
  "main": "index.js",
  "dependencies": {
    "react": "^17.0.2",
    "react-dom": "^17.0.2"
  },
  "bun-create": {
    "preinstall": "echo 'Installing...'", // a single command
    "postinstall": ["echo 'Done!'"], // an array of commands
    "start": "bun run echo 'Hello world!'"
  }
}

```

The following fields are supported. Each of these can correspond to a string or array of strings. An array of commands will be executed in order.

| `postinstall` | runs after installing dependencies |
| `preinstall` | runs before installing dependencies |

After cloning a template, `bun create` will automatically remove the `"bun-create"` section from `package.json` before writing it to the destination folder.

## [Reference](https://bun.com/docs/cli/bun-create#reference)

### [CLI flags](https://bun.com/docs/cli/bun-create#cli-flags)

| Flag           | Description                            |
| -------------- | -------------------------------------- |
| `--force`      | Overwrite existing files               |
| `--no-install` | Skip installing `node_modules` & tasks |
| `--no-git`     | Don’t initialize a git repository      |
| `--open`       | Start & open in-browser after finish   |

### [Environment variables](https://bun.com/docs/cli/bun-create#environment-variables)

| Name                                      | Description                                                                                                                                          |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GITHUB_API_DOMAIN`                       | If you’re using a GitHub enterprise or a proxy, you can customize the GitHub domain Bun pings for downloads                                          |
| `GITHUB_TOKEN` (or `GITHUB_ACCESS_TOKEN`) | This lets `bun create` work with private repositories or if you get rate-limited. `GITHUB_TOKEN` is chosen over `GITHUB_ACCESS_TOKEN` if both exist. |

How `bun create` works

When you run `bun create ${template} ${destination}`, here’s what happens:

IF remote template

1. GET `registry.npmjs.org/@bun-examples/${template}/latest` and parse it
2. GET `registry.npmjs.org/@bun-examples/${template}/-/${template}-${latestVersion}.tgz`
3. Decompress & extract `${template}-${latestVersion}.tgz` into `${destination}`
   - If there are files that would overwrite, warn and exit unless `--force` is passed

IF GitHub repo

1. Download the tarball from GitHub’s API
2. Decompress & extract into `${destination}`
   - If there are files that would overwrite, warn and exit unless `--force` is passed

ELSE IF local template

1. Open local template folder

2. Delete destination directory recursively

3. Copy files recursively using the fastest system calls available (on macOS `fcopyfile` and Linux, `copy_file_range`). Do not copy or traverse into `node_modules` folder if exists (this alone makes it faster than `cp`)

4. Parse the `package.json` (again!), update `name` to be `${basename(destination)}`, remove the `bun-create` section from the `package.json` and save the updated `package.json` to disk.
   - IF Next.js is detected, add `bun-framework-next` to the list of dependencies
   - IF Create React App is detected, add the entry point in /src/index.{js,jsx,ts,tsx} to `public/index.html`
   - IF Relay is detected, add `bun-macro-relay` so that Relay works

5. Auto-detect the npm client, preferring `pnpm`, `yarn` (v1), and lastly `npm`

6. Run any tasks defined in `"bun-create": { "preinstall" }` with the npm client

7. Run `${npmClient} install` unless `--no-install` is passed OR no dependencies are in package.json

8. Run any tasks defined in `"bun-create": { "postinstall" }` with the npm client

9. Run `git init; git add -A .; git commit -am "Initial Commit";`
   - Rename `gitignore` to `.gitignore`. NPM automatically removes `.gitignore` files from appearing in packages.
   - If there are dependencies, this runs in a separate thread concurrently while node_modules are being installed
   - Using libgit2 if available was tested and performed 3x slower in microbenchmarks

[Previous\\
\\
`bun init`](https://bun.com/docs/cli/init) [Next\\
\\
`bun run`](https://bun.com/docs/cli/run)

[![GitHub logo](Base64-Image-Removed)![GitHub logo](Base64-Image-Removed)\\
\\
Edit on GitHub](https://github.com/oven-sh/bun/edit/main/docs/cli/bun-create.md)

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
