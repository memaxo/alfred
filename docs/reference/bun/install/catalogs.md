---
title: Catalogs – Package manager | Bun Docs
url:
description: Use catalogs to share dependency versions between packages in a monorepo.
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

[`bun install`](https://bun.com/docs/cli/install) [`bun add`](https://bun.com/docs/cli/add) [`bun remove`](https://bun.com/docs/cli/remove) [`bun update`](https://bun.com/docs/cli/update) [`bun publish`](https://bun.com/docs/cli/publish) [`bun outdated`](https://bun.com/docs/cli/outdated) [`bun link`](https://bun.com/docs/cli/link) [`bun pm`](https://bun.com/docs/cli/pm) [`bun why`](https://bun.com/docs/cli/why) [Global cache](https://bun.com/docs/install/cache) [Isolated installs](https://bun.com/docs/install/isolated) [Workspaces](https://bun.com/docs/install/workspaces) [Catalogs](https://bun.com/docs/install/catalogs)

[Overview](https://bun.com/docs/install/catalogs#overview) [How to Use Catalogs](https://bun.com/docs/install/catalogs#how-to-use-catalogs) [Directory Structure Example](https://bun.com/docs/install/catalogs#directory-structure-example) [1\. Define Catalogs in Root package.json](https://bun.com/docs/install/catalogs#1-define-catalogs-in-root-package-json) [2\. Reference Catalog Versions in Workspace Packages](https://bun.com/docs/install/catalogs#2-reference-catalog-versions-in-workspace-packages) [3\. Run Bun Install](https://bun.com/docs/install/catalogs#3-run-bun-install) [Catalog vs Catalogs](https://bun.com/docs/install/catalogs#catalog-vs-catalogs) [Benefits of Using Catalogs](https://bun.com/docs/install/catalogs#benefits-of-using-catalogs) [Real-World Example](https://bun.com/docs/install/catalogs#real-world-example) [Updating Versions](https://bun.com/docs/install/catalogs#updating-versions) [Lockfile Integration](https://bun.com/docs/install/catalogs#lockfile-integration) [Limitations and Edge Cases](https://bun.com/docs/install/catalogs#limitations-and-edge-cases) [Publishing](https://bun.com/docs/install/catalogs#publishing)

[Lifecycle scripts](https://bun.com/docs/install/lifecycle) [Filter](https://bun.com/docs/cli/filter) [Lockfile](https://bun.com/docs/install/lockfile) [Scopes and registries](https://bun.com/docs/install/registries) [Overrides and resolutions](https://bun.com/docs/install/overrides) [Patch dependencies](https://bun.com/docs/install/patch) [Audit dependencies](https://bun.com/docs/install/audit) [.npmrc support](https://bun.com/docs/install/npmrc) [Security Scanner API](https://bun.com/docs/install/security-scanner-api)

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

Catalogs in Bun provide a straightforward way to share common dependency versions across multiple packages in a monorepo. Rather than specifying the same versions repeatedly in each workspace package, you define them once in the root package.json and reference them consistently throughout your project.

## [Overview](https://bun.com/docs/install/catalogs#overview)

Unlike traditional dependency management where each workspace package needs to independently specify versions, catalogs let you:

1. Define version catalogs in the root package.json
2. Reference these versions with a simple `catalog:` protocol
3. Update all packages simultaneously by changing the version in just one place

This is especially useful in large monorepos where dozens of packages need to use the same version of key dependencies.

## [How to Use Catalogs](https://bun.com/docs/install/catalogs#how-to-use-catalogs)

### [Directory Structure Example](https://bun.com/docs/install/catalogs#directory-structure-example)

Consider a monorepo with the following structure:

```
my-monorepo/
├── package.json
├── bun.lock
└── packages/
    ├── app/
    │   └── package.json
    ├── ui/
    │   └── package.json
    └── utils/
        └── package.json

```

### [1\. Define Catalogs in Root package.json](https://bun.com/docs/install/catalogs#1-define-catalogs-in-root-package-json)

In your root-level `package.json`, add a `catalog` or `catalogs` field within the `workspaces` object:

```
{
  "name": "my-monorepo",
  "workspaces": {
    "packages": ["packages/*"],
    "catalog": {
      "react": "^19.0.0",
      "react-dom": "^19.0.0"
    },
    "catalogs": {
      "testing": {
        "jest": "30.0.0",
        "testing-library": "14.0.0"
      }
    }
  }
}

```

If you put `catalog` or `catalogs` at the top level of the `package.json` file, that will work too.

### [2\. Reference Catalog Versions in Workspace Packages](https://bun.com/docs/install/catalogs#2-reference-catalog-versions-in-workspace-packages)

In your workspace packages, use the `catalog:` protocol to reference versions:

**packages/app/package.json**

```
{
  "name": "app",
  "dependencies": {
    "react": "catalog:",
    "react-dom": "catalog:",
    "jest": "catalog:testing"
  }
}

```

**packages/ui/package.json**

```
{
  "name": "ui",
  "dependencies": {
    "react": "catalog:",
    "react-dom": "catalog:"
  },
  "devDependencies": {
    "jest": "catalog:testing",
    "testing-library": "catalog:testing"
  }
}

```

### [3\. Run Bun Install](https://bun.com/docs/install/catalogs#3-run-bun-install)

Run `bun install` to install all dependencies according to the catalog versions.

## [Catalog vs Catalogs](https://bun.com/docs/install/catalogs#catalog-vs-catalogs)

Bun supports two ways to define catalogs:

1. **`catalog`** (singular): A single default catalog for commonly used dependencies

```
"catalog": {
     "react": "^19.0.0",
     "react-dom": "^19.0.0"
}

```

Reference with simply `catalog:`:

```
"dependencies": {
     "react": "catalog:"
}

```

2. **`catalogs`** (plural): Multiple named catalogs for grouping dependencies

```
"catalogs": {
     "testing": {
       "jest": "30.0.0"
     },
     "ui": {
       "tailwind": "4.0.0"
     }
}

```

Reference with `catalog:<name>`:

```
"dependencies": {
     "jest": "catalog:testing",
     "tailwind": "catalog:ui"
}

```

## [Benefits of Using Catalogs](https://bun.com/docs/install/catalogs#benefits-of-using-catalogs)

- **Consistency**: Ensures all packages use the same version of critical dependencies
- **Maintenance**: Update a dependency version in one place instead of across multiple package.json files
- **Clarity**: Makes it obvious which dependencies are standardized across your monorepo
- **Simplicity**: No need for complex version resolution strategies or external tools

## [Real-World Example](https://bun.com/docs/install/catalogs#real-world-example)

Here's a more comprehensive example for a React application:

**Root package.json**

```
{
  "name": "react-monorepo",
  "workspaces": {
    "packages": ["packages/*"],
    "catalog": {
      "react": "^19.0.0",
      "react-dom": "^19.0.0",
      "react-router-dom": "^6.15.0"
    },
    "catalogs": {
      "build": {
        "webpack": "5.88.2",
        "babel": "7.22.10"
      },
      "testing": {
        "jest": "29.6.2",
        "react-testing-library": "14.0.0"
      }
    }
  },
  "devDependencies": {
    "typescript": "5.1.6"
  }
}

```

**packages/app/package.json**

```
{
  "name": "app",
  "dependencies": {
    "react": "catalog:",
    "react-dom": "catalog:",
    "react-router-dom": "catalog:",
    "@monorepo/ui": "workspace:*",
    "@monorepo/utils": "workspace:*"
  },
  "devDependencies": {
    "webpack": "catalog:build",
    "babel": "catalog:build",
    "jest": "catalog:testing",
    "react-testing-library": "catalog:testing"
  }
}

```

**packages/ui/package.json**

```
{
  "name": "@monorepo/ui",
  "dependencies": {
    "react": "catalog:",
    "react-dom": "catalog:"
  },
  "devDependencies": {
    "jest": "catalog:testing",
    "react-testing-library": "catalog:testing"
  }
}

```

**packages/utils/package.json**

```
{
  "name": "@monorepo/utils",
  "dependencies": {
    "react": "catalog:"
  },
  "devDependencies": {
    "jest": "catalog:testing"
  }
}

```

## [Updating Versions](https://bun.com/docs/install/catalogs#updating-versions)

To update versions across all packages, simply change the version in the root package.json:

```
"catalog": {
  "react": "^19.1.0",  // Updated from ^19.0.0
  "react-dom": "^19.1.0"  // Updated from ^19.0.0
}

```

Then run `bun install` to update all packages.

## [Lockfile Integration](https://bun.com/docs/install/catalogs#lockfile-integration)

Bun's lockfile tracks catalog versions, making it easy to ensure consistent installations across different environments. The lockfile includes:

- The catalog definitions from your package.json
- The resolution of each cataloged dependency

```
// bun.lock (excerpt)
{
  "lockfileVersion": 1,
  "workspaces": {
    "": {
      "name": "react-monorepo",
    },
    "packages/app": {
      "name": "app",
      "dependencies": {
        "react": "catalog:",
        "react-dom": "catalog:",
        ...
      },
    },
    ...
  },
  "catalog": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    ...
  },
  "catalogs": {
    "build": {
      "webpack": "5.88.2",
      ...
    },
    ...
  },
  "packages": {
    ...
  }
}

```

## [Limitations and Edge Cases](https://bun.com/docs/install/catalogs#limitations-and-edge-cases)

- Catalog references must match a dependency defined in either `catalog` or one of the named `catalogs`
- Empty strings and whitespace in catalog names are ignored (treated as default catalog)
- Invalid dependency versions in catalogs will fail to resolve during `bun install`
- Catalogs are only available within workspaces; they cannot be used outside the monorepo

Bun's catalog system provides a powerful yet simple way to maintain consistency across your monorepo without introducing additional complexity to your workflow.

## [Publishing](https://bun.com/docs/install/catalogs#publishing)

When you run `bun publish` or `bun pm pack`, Bun automatically replaces `catalog:` references in your `package.json` with the resolved version numbers.The published package includes regular semver strings and no longer depends onyour catalog definitions.

[Previous\\
\\
Workspaces](https://bun.com/docs/install/workspaces) [Next\\
\\
Lifecycle scripts](https://bun.com/docs/install/lifecycle)

[![GitHub logo](Base64-Image-Removed)![GitHub logo](Base64-Image-Removed)\\
\\
Edit on GitHub](https://github.com/oven-sh/bun/edit/main/docs/install/catalogs.md)

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
