---
title: bun publish – Package manager | Bun Docs
url:
description: Publish your package to an npm registry.
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

[`bun install`](https://bun.com/docs/cli/install) [`bun add`](https://bun.com/docs/cli/add) [`bun remove`](https://bun.com/docs/cli/remove) [`bun update`](https://bun.com/docs/cli/update) [`bun publish`](https://bun.com/docs/cli/publish)

[`--access`](https://bun.com/docs/cli/publish#access) [`--tag`](https://bun.com/docs/cli/publish#tag) [`--dry-run`](https://bun.com/docs/cli/publish#dry-run) [`--gzip-level`](https://bun.com/docs/cli/publish#gzip-level) [`--auth-type`](https://bun.com/docs/cli/publish#auth-type) [`--otp`](https://bun.com/docs/cli/publish#otp)

[`bun outdated`](https://bun.com/docs/cli/outdated) [`bun link`](https://bun.com/docs/cli/link) [`bun pm`](https://bun.com/docs/cli/pm) [`bun why`](https://bun.com/docs/cli/why) [Global cache](https://bun.com/docs/install/cache) [Isolated installs](https://bun.com/docs/install/isolated) [Workspaces](https://bun.com/docs/install/workspaces) [Catalogs](https://bun.com/docs/install/catalogs) [Lifecycle scripts](https://bun.com/docs/install/lifecycle) [Filter](https://bun.com/docs/cli/filter) [Lockfile](https://bun.com/docs/install/lockfile) [Scopes and registries](https://bun.com/docs/install/registries) [Overrides and resolutions](https://bun.com/docs/install/overrides) [Patch dependencies](https://bun.com/docs/install/patch) [Audit dependencies](https://bun.com/docs/install/audit) [.npmrc support](https://bun.com/docs/install/npmrc) [Security Scanner API](https://bun.com/docs/install/security-scanner-api)

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

Use `bun publish` to publish a package to the npm registry.

`bun publish` will automatically pack your package into a tarball, strip catalog and workspace protocols from the `package.json` (resolving versions if necessary), and publish to the registry specified in your configuration files. Both `bunfig.toml` and `.npmrc` files are supported.

```
## Publishing the package from the current working directory
```

```
bun publish
```

```

## Output
bun publish v1.2.22 (ca7428e9)

packed 203B package.json
packed 224B README.md
packed 30B index.ts
packed 0.64KB tsconfig.json

Total files: 4
Shasum: 79e2b4377b63f4de38dc7ea6e5e9dbee08311a69
Integrity: sha512-6QSNlDdSwyG/+[...]X6wXHriDWr6fA==
Unpacked size: 1.1KB
Packed size: 0.76KB
Tag: latest
Access: default
Registry: http://localhost:4873/

 + publish-1@1.0.0
```

Alternatively, you can pack and publish your package separately by using `bun pm pack` followed by `bun publish` with the path to the output tarball.

```
bun pm pack
```

```
...
```

```
bun publish ./package.tgz
```

**Note** \- `bun publish` will not run lifecycle scripts ( `prepublishOnly/prepack/prepare/postpack/publish/postpublish`) if a tarball path is provided. Scripts will only be run if the package is packed by `bun publish`.

### [`--access`](https://bun.com/docs/cli/publish#access)

The `--access` flag can be used to set the access level of the package being published. The access level can be one of `public` or `restricted`. Unscoped packages are always public, and attempting to publish an unscoped package with `--access restricted` will result in an error.

```
bun publish --access public
```

`--access` can also be set in the `publishConfig` field of your `package.json`.

```
{
  "publishConfig": {
    "access": "restricted"
  }
}

```

### [`--tag`](https://bun.com/docs/cli/publish#tag)

Set the tag of the package version being published. By default, the tag is `latest`. The initial version of a package is always given the `latest` tag in addition to the specified tag.

```
bun publish --tag alpha
```

`--tag` can also be set in the `publishConfig` field of your `package.json`.

```
{
  "publishConfig": {
    "tag": "next"
  }
}

```

### [`--dry-run`](https://bun.com/docs/cli/publish#dry-run)

The `--dry-run` flag can be used to simulate the publish process without actually publishing the package. This is useful for verifying the contents of the published package without actually publishing the package.

```
bun publish --dry-run
```

### [`--gzip-level`](https://bun.com/docs/cli/publish#gzip-level)

Specify the level of gzip compression to use when packing the package. Only applies to `bun publish` without a tarball path argument. Values range from `0` to `9` (default is `9`).

## CLI Usage

$bunpublishdist

### Flags

#### Publishing Options

--dry-run

Don't install anything

--access=<val>

Set access level for scoped packages

--tag=<val>

Tag the release. Default is "latest"

--gzip-level=<val>

Specify a custom compression level for gzip. Default is 9.

#### Registry & Authentication

--ca=<val>

Provide a Certificate Authority signing certificate

--cafile=<val>

The same as \`--ca\`, but is a file path to the certificate

--registry=<val>

Use a specific registry by default, overriding .npmrc, bunfig.toml and environment variables

--otp=<val>

Provide a one-time password for authentication

--auth-type=<val>

Specify the type of one-time password authentication (default is 'web')

#### Dependency & Install Behavior

-p,--production

Don't install devDependencies

-f,--force

Always request the latest versions from the registry & reinstall all dependencies

--no-verify

Skip verifying integrity of newly downloaded packages

--ignore-scripts

Skip lifecycle scripts in the project's package.json (dependency scripts are never run)

--trust

Add to trustedDependencies in the project's package.json and install the package(s)

-g,--global

Install globally

--backend=<val>

Platform-specific optimizations for installing dependencies. Possible values: "clonefile" (default), "hardlink", "symlink", "copyfile"

--omit=<val>

Exclude 'dev', 'optional', or 'peer' dependencies from install

#### Lockfile Management

-y,--yarn

Write a yarn.lock file (yarn v1)

--no-save

Don't update package.json or save a lockfile

--save

Save to package.json (true by default)

--frozen-lockfile

Disallow changes to lockfile

--save-text-lockfile

Save a text-based lockfile

--lockfile-only

Generate a lockfile without installing dependencies

#### Caching

--cache-dir=<val>

Store & load cached data from a specific directory path

--no-cache

Ignore manifest cache entirely

#### Output & Logging

--silent

Don't log anything

--verbose

Excessively verbose logging

--no-progress

Disable the progress bar

--no-summary

Don't print a summary

#### Performance & Concurrency

--concurrent-scripts=<val>

Maximum number of concurrent jobs for lifecycle scripts (default 5)

--network-concurrency=<val>

Maximum number of concurrent network requests (default 48)

#### General Configuration & Context

-c,--config=<val>

Specify path to config file (bunfig.toml)

--cwd=<val>

Set a specific cwd

#### Help

-h,--help

Print this help menu

### Examples

Display files that would be published, without publishing to the registry.

bun publish --dry-run

Publish the current package with public access.

bun publish --access public

Publish a pre-existing package tarball with tag 'next'.

bun publish --tag next ./path/to/tarball.tgz

Full documentation is available at https://bun.sh/docs/cli/publish.

### [`--auth-type`](https://bun.com/docs/cli/publish#auth-type)

If you have 2FA enabled for your npm account, `bun publish` will prompt you for a one-time password. This can be done through a browser or the CLI. The `--auth-type` flag can be used to tell the npm registry which method you prefer. The possible values are `web` and `legacy`, with `web` being the default.

```
bun publish --auth-type legacy
```

```
...
This operation requires a one-time password.
Enter OTP: 123456
...
```

### [`--otp`](https://bun.com/docs/cli/publish#otp)

Provide a one-time password directly to the CLI. If the password is valid, this will skip the extra prompt for a one-time password before publishing. Example usage:

```
bun publish --otp 123456
```

**Note** \- `bun publish` respects the `NPM_CONFIG_TOKEN` environment variable which can be used when publishing in github actions or automated workflows.

[Previous\\
\\
`bun update`](https://bun.com/docs/cli/update) [Next\\
\\
`bun outdated`](https://bun.com/docs/cli/outdated)

[![GitHub logo](Base64-Image-Removed)![GitHub logo](Base64-Image-Removed)\\
\\
Edit on GitHub](https://github.com/oven-sh/bun/edit/main/docs/cli/publish.md)

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
