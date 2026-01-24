---
title: YAML – API | Bun Docs
url:
description: Bun.YAML.parse(string) lets you parse YAML files in JavaScript
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

[HTTP server](https://bun.com/docs/api/http) [HTTP client](https://bun.com/docs/api/fetch) [WebSockets](https://bun.com/docs/api/websockets) [Workers](https://bun.com/docs/api/workers) [Binary data](https://bun.com/docs/api/binary-data) [Streams](https://bun.com/docs/api/streams) [SQL](https://bun.com/docs/api/sql) [S3 Object Storage](https://bun.com/docs/api/s3) [File I/O](https://bun.com/docs/api/file-io) [Redis client](https://bun.com/docs/api/redis) [import.meta](https://bun.com/docs/api/import-meta) [SQLite](https://bun.com/docs/api/sqlite) [FileSystemRouter](https://bun.com/docs/api/file-system-router) [TCP sockets](https://bun.com/docs/api/tcp) [UDP sockets](https://bun.com/docs/api/udp) [Globals](https://bun.com/docs/api/globals) [$ Shell](https://bun.com/docs/runtime/shell) [Child processes](https://bun.com/docs/api/spawn) [YAML](https://bun.com/docs/api/yaml)

[Conformance](https://bun.com/docs/api/yaml#conformance) [Runtime API](https://bun.com/docs/api/yaml#runtime-api) [`Bun.YAML.parse()`](https://bun.com/docs/api/yaml#bun-yaml-parse) [Module Import](https://bun.com/docs/api/yaml#module-import) [ES Modules](https://bun.com/docs/api/yaml#es-modules) [CommonJS](https://bun.com/docs/api/yaml#commonjs) [TypeScript Support](https://bun.com/docs/api/yaml#typescript-support) [Hot Reloading with YAML](https://bun.com/docs/api/yaml#hot-reloading-with-yaml) [Configuration Hot Reloading](https://bun.com/docs/api/yaml#configuration-hot-reloading) [Configuration Management](https://bun.com/docs/api/yaml#configuration-management) [Environment-Based Configuration](https://bun.com/docs/api/yaml#environment-based-configuration) [Feature Flags Configuration](https://bun.com/docs/api/yaml#feature-flags-configuration) [Database Configuration](https://bun.com/docs/api/yaml#database-configuration) [Bundler Integration](https://bun.com/docs/api/yaml#bundler-integration) [Dynamic Imports](https://bun.com/docs/api/yaml#dynamic-imports)

[HTMLRewriter](https://bun.com/docs/api/html-rewriter) [Hashing](https://bun.com/docs/api/hashing) [Console](https://bun.com/docs/api/console) [Cookie](https://bun.com/docs/api/cookie) [FFI](https://bun.com/docs/api/ffi) [C Compiler](https://bun.com/docs/api/cc) [Secrets](https://bun.com/docs/api/secrets) [Testing](https://bun.com/docs/cli/test) [Utils](https://bun.com/docs/api/utils) [Node-API](https://bun.com/docs/api/node-api) [Glob](https://bun.com/docs/api/glob) [DNS](https://bun.com/docs/api/dns) [Semver](https://bun.com/docs/api/semver) [Color](https://bun.com/docs/api/color) [Transpiler](https://bun.com/docs/api/transpiler)

Project

[Roadmap](https://bun.com/docs/project/roadmap) [Benchmarking](https://bun.com/docs/project/benchmarking) [Contributing](https://bun.com/docs/project/contributing) [Building Windows](https://bun.com/docs/project/building-windows) [Bindgen](https://bun.com/docs/project/bindgen) [License](https://bun.com/docs/project/licensing)

In Bun, YAML is a first-class citizen alongside JSON and TOML.

Bun provides built-in support for YAML files through both runtime APIs and bundler integration. You can

- Parse YAML strings with `Bun.YAML.parse`
- import & require YAML files as modules at runtime (including hot reloading & watch mode support)
- import & require YAML files in frontend apps via bun's bundler

## [Conformance](https://bun.com/docs/api/yaml#conformance)

Bun's YAML parser currently passes over 90% of the official YAML test suite. While we're actively working on reaching 100% conformance, the current implementation covers the vast majority of real-world use cases. The parser is written in Zig for optimal performance and is continuously being improved.

## [Runtime API](https://bun.com/docs/api/yaml#runtime-api)

### [`Bun.YAML.parse()`](https://bun.com/docs/api/yaml#bun-yaml-parse)

Parse a YAML string into a JavaScript object.

```
import { YAML } from "bun";
const text = `
name: John Doe
age: 30
email: john@example.com
hobbies:
  - reading
  - coding
  - hiking
`;

const data = YAML.parse(text);
console.log(data);
// {
//   name: "John Doe",
//   age: 30,
//   email: "john@example.com",
//   hobbies: ["reading", "coding", "hiking"]
// }

```

#### Multi-document YAML

When parsing YAML with multiple documents (separated by `---`), `Bun.YAML.parse()` returns an array:

```
const multiDoc = `
---
name: Document 1
---
name: Document 2
---
name: Document 3
`;

const docs = Bun.YAML.parse(multiDoc);
console.log(docs);
// [\
//   { name: "Document 1" },\
//   { name: "Document 2" },\
//   { name: "Document 3" }\
// ]

```

#### Supported YAML Features

Bun's YAML parser supports the full YAML 1.2 specification, including:

- **Scalars**: strings, numbers, booleans, null values
- **Collections**: sequences (arrays) and mappings (objects)
- **Anchors and Aliases**: reusable nodes with `&` and `*`
- **Tags**: type hints like `!!str`, `!!int`, `!!float`, `!!bool`, `!!null`
- **Multi-line strings**: literal ( `|`) and folded ( `>`) scalars
- **Comments**: using `#`
- **Directives**: `%YAML` and `%TAG`

```
const yaml = `
# Employee record
employee: &emp
  name: Jane Smith
  department: Engineering
  skills:
    - JavaScript
    - TypeScript
    - React

manager: *emp  # Reference to employee

config: !!str 123  # Explicit string type

description: |
  This is a multi-line
  literal string that preserves
  line breaks and spacing.

summary: >
  This is a folded string
  that joins lines with spaces
  unless there are blank lines.
`;

const data = Bun.YAML.parse(yaml);

```

#### Error Handling

`Bun.YAML.parse()` throws a `SyntaxError` if the YAML is invalid:

```
try {
  Bun.YAML.parse("invalid: yaml: content:");
} catch (error) {
  console.error("Failed to parse YAML:", error.message);
}

```

## [Module Import](https://bun.com/docs/api/yaml#module-import)

### [ES Modules](https://bun.com/docs/api/yaml#es-modules)

You can import YAML files directly as ES modules. The YAML content is parsed and made available as both default and named exports:

config.yaml

```
database:
  host: localhost
  port: 5432
  name: myapp

redis:
  host: localhost
  port: 6379

features:
  auth: true
  rateLimit: true
  analytics: false

```

#### Default Import

app.ts

```
import config from "./config.yaml";

console.log(config.database.host); // "localhost"
console.log(config.redis.port); // 6379

```

#### Named Imports

You can destructure top-level YAML properties as named imports:

```
import { database, redis, features } from "./config.yaml";

console.log(database.host); // "localhost"
console.log(redis.port); // 6379
console.log(features.auth); // true

```

Or combine both:

```
import config, { database, features } from "./config.yaml";

// Use the full config object
console.log(config);

// Or use specific parts
if (features.rateLimit) {
  setupRateLimiting(database);
}

```

### [CommonJS](https://bun.com/docs/api/yaml#commonjs)

YAML files can also be required in CommonJS:

```
const config = require("./config.yaml");
console.log(config.database.name); // "myapp"

// Destructuring also works
const { database, redis } = require("./config.yaml");
console.log(database.port); // 5432

```

### [TypeScript Support](https://bun.com/docs/api/yaml#typescript-support)

While Bun can import YAML files directly, TypeScript doesn't know the types of your YAML files by default. To add TypeScript support for your YAML imports, create a declaration file with `.d.ts` appended to the YAML filename (e.g., `config.yaml` → `config.yaml.d.ts`):

config.yaml

```
features: "advanced"
server:
  host: localhost
  port: 3000

```

config.yaml.d.ts

```
const contents: {
  features: string;
  server: {
    host: string;
    port: number;
  };
};

export = contents;

```

Now TypeScript will provide proper type checking and auto-completion:

app.ts

```
import config from "./config.yaml";

// TypeScript knows the types!
config.server.port; // number
config.server.host; // string
config.features; // string

// TypeScript will catch errors
config.server.unknown; // Error: Property 'unknown' does not exist

```

This approach works for both ES modules and CommonJS, giving you full type safety while Bun continues to handle the actual YAML parsing at runtime.

## [Hot Reloading with YAML](https://bun.com/docs/api/yaml#hot-reloading-with-yaml)

One of the most powerful features of Bun's YAML support is hot reloading. When you run your application with `bun --hot`, changes to YAML files are automatically detected and reloaded without closing connections

### [Configuration Hot Reloading](https://bun.com/docs/api/yaml#configuration-hot-reloading)

config.yaml

```
server:
  port: 3000
  host: localhost

features:
  debug: true
  verbose: false

```

server.ts

```
import { server, features } from "./config.yaml";

console.log(`Starting server on ${server.host}:${server.port}`);

if (features.debug) {
  console.log("Debug mode enabled");
}

// Your server code here
Bun.serve({
  port: server.port,
  hostname: server.host,
  fetch(req) {
    if (features.verbose) {
      console.log(`${req.method} ${req.url}`);
    }
    return new Response("Hello World");
  },
});

```

Run with hot reloading:

```
bun --hot server.ts

```

Now when you modify `config.yaml`, the changes are immediately reflected in your running application. This is perfect for:

- Adjusting configuration during development
- Testing different settings without restarts
- Live debugging with configuration changes
- Feature flag toggling

## [Configuration Management](https://bun.com/docs/api/yaml#configuration-management)

### [Environment-Based Configuration](https://bun.com/docs/api/yaml#environment-based-configuration)

YAML excels at managing configuration across different environments:

config.yaml

```
defaults: &defaults
  timeout: 5000
  retries: 3
  cache:
    enabled: true
    ttl: 3600

development:
  <<: *defaults
  api:
    url: http://localhost:4000
    key: dev_key_12345
  logging:
    level: debug
    pretty: true

staging:
  <<: *defaults
  api:
    url: https://staging-api.example.com
    key: ${STAGING_API_KEY}
  logging:
    level: info
    pretty: false

production:
  <<: *defaults
  api:
    url: https://api.example.com
    key: ${PROD_API_KEY}
  cache:
    enabled: true
    ttl: 86400
  logging:
    level: error
    pretty: false

```

app.ts

```
import configs from "./config.yaml";

const env = process.env.NODE_ENV || "development";
const config = configs[env];

// Environment variables in YAML values can be interpolated
function interpolateEnvVars(obj: any): any {
  if (typeof obj === "string") {
    return obj.replace(/\${(\w+)}/g, (_, key) => process.env[key] || "");
  }
  if (typeof obj === "object") {
    for (const key in obj) {
      obj[key] = interpolateEnvVars(obj[key]);
    }
  }
  return obj;
}

export default interpolateEnvVars(config);

```

### [Feature Flags Configuration](https://bun.com/docs/api/yaml#feature-flags-configuration)

features.yaml

```
features:
  newDashboard:
    enabled: true
    rolloutPercentage: 50
    allowedUsers:
      - admin@example.com
      - beta@example.com

  experimentalAPI:
    enabled: false
    endpoints:
      - /api/v2/experimental
      - /api/v2/beta

  darkMode:
    enabled: true
    default: auto # auto, light, dark

```

feature-flags.ts

```
import { features } from "./features.yaml";

export function isFeatureEnabled(
  featureName: string,
  userEmail?: string,
): boolean {
  const feature = features[featureName];

  if (!feature?.enabled) {
    return false;
  }

  // Check rollout percentage
  if (feature.rolloutPercentage < 100) {
    const hash = hashCode(userEmail || "anonymous");
    if (hash % 100 >= feature.rolloutPercentage) {
      return false;
    }
  }

  // Check allowed users
  if (feature.allowedUsers && userEmail) {
    return feature.allowedUsers.includes(userEmail);
  }

  return true;
}

// Use with hot reloading to toggle features in real-time
if (isFeatureEnabled("newDashboard", user.email)) {
  renderNewDashboard();
} else {
  renderLegacyDashboard();
}

```

### [Database Configuration](https://bun.com/docs/api/yaml#database-configuration)

database.yaml

```
connections:
  primary:
    type: postgres
    host: ${DB_HOST:-localhost}
    port: ${DB_PORT:-5432}
    database: ${DB_NAME:-myapp}
    username: ${DB_USER:-postgres}
    password: ${DB_PASS}
    pool:
      min: 2
      max: 10
      idleTimeout: 30000

  cache:
    type: redis
    host: ${REDIS_HOST:-localhost}
    port: ${REDIS_PORT:-6379}
    password: ${REDIS_PASS}
    db: 0

  analytics:
    type: clickhouse
    host: ${ANALYTICS_HOST:-localhost}
    port: 8123
    database: analytics

migrations:
  autoRun: ${AUTO_MIGRATE:-false}
  directory: ./migrations

seeds:
  enabled: ${SEED_DB:-false}
  directory: ./seeds

```

db.ts

```
import { connections, migrations } from "./database.yaml";
import { createConnection } from "./database-driver";

// Parse environment variables with defaults
function parseConfig(config: any) {
  return JSON.parse(
    JSON.stringify(config).replace(
      /\${([^:-]+)(?::([^}]+))?}/g,
      (_, key, defaultValue) => process.env[key] || defaultValue || "",
    ),
  );
}

const dbConfig = parseConfig(connections);

export const db = await createConnection(dbConfig.primary);
export const cache = await createConnection(dbConfig.cache);
export const analytics = await createConnection(dbConfig.analytics);

// Auto-run migrations if configured
if (parseConfig(migrations).autoRun === "true") {
  await runMigrations(db, migrations.directory);
}

```

### [Bundler Integration](https://bun.com/docs/api/yaml#bundler-integration)

When you import YAML files in your application and bundle it with Bun, the YAML is parsed at build time and included as a JavaScript module:

```
bun build app.ts --outdir=dist

```

This means:

- Zero runtime YAML parsing overhead in production
- Smaller bundle sizes
- Tree-shaking support for unused configuration (named imports)

### [Dynamic Imports](https://bun.com/docs/api/yaml#dynamic-imports)

YAML files can be dynamically imported, useful for loading configuration on demand:

Load

```
const env = process.env.NODE_ENV || "development";
const config = await import(`./configs/${env}.yaml`);

// Load user-specific settings
async function loadUserSettings(userId: string) {
  try {
    const settings = await import(`./users/${userId}/settings.yaml`);
    return settings.default;
  } catch {
    return await import("./users/default-settings.yaml");
  }
}

```

[Previous\\
\\
Child processes](https://bun.com/docs/api/spawn) [Next\\
\\
HTMLRewriter](https://bun.com/docs/api/html-rewriter)

[![GitHub logo](Base64-Image-Removed)![GitHub logo](Base64-Image-Removed)\\
\\
Edit on GitHub](https://github.com/oven-sh/bun/edit/main/docs/api/yaml.md)

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
