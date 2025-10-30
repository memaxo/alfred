---
title: Secrets – API | Bun Docs
url: 
description: Store and retrieve sensitive credentials securely using the operating system's native credential storage APIs.
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

[HTTP server](https://bun.com/docs/api/http) [HTTP client](https://bun.com/docs/api/fetch) [WebSockets](https://bun.com/docs/api/websockets) [Workers](https://bun.com/docs/api/workers) [Binary data](https://bun.com/docs/api/binary-data) [Streams](https://bun.com/docs/api/streams) [SQL](https://bun.com/docs/api/sql) [S3 Object Storage](https://bun.com/docs/api/s3) [File I/O](https://bun.com/docs/api/file-io) [Redis client](https://bun.com/docs/api/redis) [import.meta](https://bun.com/docs/api/import-meta) [SQLite](https://bun.com/docs/api/sqlite) [FileSystemRouter](https://bun.com/docs/api/file-system-router) [TCP sockets](https://bun.com/docs/api/tcp) [UDP sockets](https://bun.com/docs/api/udp) [Globals](https://bun.com/docs/api/globals) [$ Shell](https://bun.com/docs/runtime/shell) [Child processes](https://bun.com/docs/api/spawn) [YAML](https://bun.com/docs/api/yaml) [HTMLRewriter](https://bun.com/docs/api/html-rewriter) [Hashing](https://bun.com/docs/api/hashing) [Console](https://bun.com/docs/api/console) [Cookie](https://bun.com/docs/api/cookie) [FFI](https://bun.com/docs/api/ffi) [C Compiler](https://bun.com/docs/api/cc) [Secrets](https://bun.com/docs/api/secrets)

[Overview](https://bun.com/docs/api/secrets#overview) [API](https://bun.com/docs/api/secrets#api) [`Bun.secrets.get(options)`](https://bun.com/docs/api/secrets#bun-secrets-get-options) [`Bun.secrets.set(options, value)`](https://bun.com/docs/api/secrets#bun-secrets-set-options-value) [`Bun.secrets.delete(options)`](https://bun.com/docs/api/secrets#bun-secrets-delete-options) [Examples](https://bun.com/docs/api/secrets#examples) [Storing CLI Tool Credentials](https://bun.com/docs/api/secrets#storing-cli-tool-credentials) [Migrating from Plaintext Config Files](https://bun.com/docs/api/secrets#migrating-from-plaintext-config-files) [Error Handling](https://bun.com/docs/api/secrets#error-handling) [Updating Credentials](https://bun.com/docs/api/secrets#updating-credentials) [Platform Behavior](https://bun.com/docs/api/secrets#platform-behavior) [macOS (Keychain)](https://bun.com/docs/api/secrets#macos-keychain) [Linux (libsecret)](https://bun.com/docs/api/secrets#linux-libsecret) [Windows (Credential Manager)](https://bun.com/docs/api/secrets#windows-credential-manager) [Security Considerations](https://bun.com/docs/api/secrets#security-considerations) [Limitations](https://bun.com/docs/api/secrets#limitations) [Comparison with Environment Variables](https://bun.com/docs/api/secrets#comparison-with-environment-variables) [Best Practices](https://bun.com/docs/api/secrets#best-practices) [TypeScript](https://bun.com/docs/api/secrets#typescript) [See Also](https://bun.com/docs/api/secrets#see-also)

[Testing](https://bun.com/docs/cli/test) [Utils](https://bun.com/docs/api/utils) [Node-API](https://bun.com/docs/api/node-api) [Glob](https://bun.com/docs/api/glob) [DNS](https://bun.com/docs/api/dns) [Semver](https://bun.com/docs/api/semver) [Color](https://bun.com/docs/api/color) [Transpiler](https://bun.com/docs/api/transpiler)

Project

[Roadmap](https://bun.com/docs/project/roadmap) [Benchmarking](https://bun.com/docs/project/benchmarking) [Contributing](https://bun.com/docs/project/contributing) [Building Windows](https://bun.com/docs/project/building-windows) [Bindgen](https://bun.com/docs/project/bindgen) [License](https://bun.com/docs/project/licensing)

Store and retrieve sensitive credentials securely using the operating system's native credential storage APIs.

**Experimental:** This API is new and experimental. It may change in the future.

```
import { secrets } from "bun";

const githubToken = await secrets.get({
  service: "my-cli-tool",
  name: "github-token",
});

if (!githubToken) {
  const response = await fetch("https://api.github.com/name", {
    headers: { "Authorization": `token ${githubToken}` },
  });
  console.log("Please enter your GitHub token");
} else {
  await secrets.set({
    service: "my-cli-tool",
    name: "github-token",
    value: prompt("Please enter your GitHub token"),
  });
  console.log("GitHub token stored");
}

```

## [Overview](https://bun.com/docs/api/secrets\#overview)

`Bun.secrets` provides a cross-platform API for managing sensitive credentials that CLI tools and development applications typically store in plaintext files like `~/.npmrc`, `~/.aws/credentials`, or `.env` files. It uses:

- **macOS**: Keychain Services
- **Linux**: libsecret (GNOME Keyring, KWallet, etc.)
- **Windows**: Windows Credential Manager

All operations are asynchronous and non-blocking, running on Bun's threadpool.

Note: in the future, we may add an additional `provider` option to make this better for production deployment secrets, but today this API is mostly useful for local development tools.

## [API](https://bun.com/docs/api/secrets\#api)

### [`Bun.secrets.get(options)`](https://bun.com/docs/api/secrets\#bun-secrets-get-options)

Retrieve a stored credential.

```
import { secrets } from "bun";

const password = await Bun.secrets.get({
  service: "my-app",
  name: "alice@example.com",
});
// Returns: string | null

// Or if you prefer without an object
const password = await Bun.secrets.get("my-app", "alice@example.com");

```

**Parameters:**

- `options.service` (string, required) - The service or application name
- `options.name` (string, required) - The username or account identifier

**Returns:**

- `Promise<string | null>` \- The stored password, or `null` if not found

### [`Bun.secrets.set(options, value)`](https://bun.com/docs/api/secrets\#bun-secrets-set-options-value)

Store or update a credential.

```
import { secrets } from "bun";

await secrets.set({
  service: "my-app",
  name: "alice@example.com",
  value: "super-secret-password",
});

```

**Parameters:**

- `options.service` (string, required) - The service or application name
- `options.name` (string, required) - The username or account identifier
- `value` (string, required) - The password or secret to store

**Notes:**

- If a credential already exists for the given service/name combination, it will be replaced
- The stored value is encrypted by the operating system

### [`Bun.secrets.delete(options)`](https://bun.com/docs/api/secrets\#bun-secrets-delete-options)

Delete a stored credential.

```
const deleted = await Bun.secrets.delete({
  service: "my-app",
  name: "alice@example.com",
  value: "super-secret-password",
});
// Returns: boolean

```

**Parameters:**

- `options.service` (string, required) - The service or application name
- `options.name` (string, required) - The username or account identifier

**Returns:**

- `Promise<boolean>` \- `true` if a credential was deleted, `false` if not found

## [Examples](https://bun.com/docs/api/secrets\#examples)

### [Storing CLI Tool Credentials](https://bun.com/docs/api/secrets\#storing-cli-tool-credentials)

```
// Store GitHub CLI token (instead of ~/.config/gh/hosts.yml)
await Bun.secrets.set({
  service: "my-app.com",
  name: "github-token",
  value: "ghp_xxxxxxxxxxxxxxxxxxxx",
});

// Or if you prefer without an object
await Bun.secrets.set("my-app.com", "github-token", "ghp_xxxxxxxxxxxxxxxxxxxx");

// Store npm registry token (instead of ~/.npmrc)
await Bun.secrets.set({
  service: "npm-registry",
  name: "https://registry.npmjs.org",
  value: "npm_xxxxxxxxxxxxxxxxxxxx",
});

// Retrieve for API calls
const token = await Bun.secrets.get({
  service: "gh-cli",
  name: "github.com",
});

if (token) {
  const response = await fetch("https://api.github.com/name", {
    headers: {
      "Authorization": `token ${token}`,
    },
  });
}

```

### [Migrating from Plaintext Config Files](https://bun.com/docs/api/secrets\#migrating-from-plaintext-config-files)

```
// Instead of storing in ~/.aws/credentials
await Bun.secrets.set({
  service: "aws-cli",
  name: "AWS_SECRET_ACCESS_KEY",
  value: process.env.AWS_SECRET_ACCESS_KEY,
});

// Instead of .env files with sensitive data
await Bun.secrets.set({
  service: "my-app",
  name: "api-key",
  value: "sk_live_xxxxxxxxxxxxxxxxxxxx",
});

// Load at runtime
const apiKey =
  (await Bun.secrets.get({
    service: "my-app",
    name: "api-key",
  })) || process.env.API_KEY; // Fallback for CI/production

```

### [Error Handling](https://bun.com/docs/api/secrets\#error-handling)

```
try {
  await Bun.secrets.set({
    service: "my-app",
    name: "alice",
    value: "password123",
  });
} catch (error) {
  console.error("Failed to store credential:", error.message);
}

// Check if a credential exists
const password = await Bun.secrets.get({
  service: "my-app",
  name: "alice",
});

if (password === null) {
  console.log("No credential found");
}

```

### [Updating Credentials](https://bun.com/docs/api/secrets\#updating-credentials)

```
// Initial password
await Bun.secrets.set({
  service: "email-server",
  name: "admin@example.com",
  value: "old-password",
});

// Update to new password
await Bun.secrets.set({
  service: "email-server",
  name: "admin@example.com",
  value: "new-password",
});

// The old password is replaced

```

## [Platform Behavior](https://bun.com/docs/api/secrets\#platform-behavior)

### [macOS (Keychain)](https://bun.com/docs/api/secrets\#macos-keychain)

- Credentials are stored in the name's login keychain
- The keychain may prompt for access permission on first use
- Credentials persist across system restarts
- Accessible by the name who stored them

### [Linux (libsecret)](https://bun.com/docs/api/secrets\#linux-libsecret)

- Requires a secret service daemon (GNOME Keyring, KWallet, etc.)
- Credentials are stored in the default collection
- May prompt for unlock if the keyring is locked
- The secret service must be running

### [Windows (Credential Manager)](https://bun.com/docs/api/secrets\#windows-credential-manager)

- Credentials are stored in Windows Credential Manager
- Visible in Control Panel → Credential Manager → Windows Credentials
- Persist with `CRED_PERSIST_ENTERPRISE` flag so it's scoped per user
- Encrypted using Windows Data Protection API

## [Security Considerations](https://bun.com/docs/api/secrets\#security-considerations)

1. **Encryption**: Credentials are encrypted by the operating system's credential manager
2. **Access Control**: Only the name who stored the credential can retrieve it
3. **No Plain Text**: Passwords are never stored in plain text
4. **Memory Safety**: Bun zeros out password memory after use
5. **Process Isolation**: Credentials are isolated per name account

## [Limitations](https://bun.com/docs/api/secrets\#limitations)

- Maximum password length varies by platform (typically 2048-4096 bytes)
- Service and name names should be reasonable lengths (< 256 characters)
- Some special characters may need escaping depending on the platform
- Requires appropriate system services:
  - Linux: Secret service daemon must be running
  - macOS: Keychain Access must be available
  - Windows: Credential Manager service must be enabled

## [Comparison with Environment Variables](https://bun.com/docs/api/secrets\#comparison-with-environment-variables)

Unlike environment variables, `Bun.secrets`:

- ✅ Encrypts credentials at rest (thanks to the operating system)
- ✅ Avoids exposing secrets in process memory dumps (memory is zeroed after its no longer needed)
- ✅ Survives application restarts
- ✅ Can be updated without restarting the application
- ✅ Provides name-level access control
- ❌ Requires OS credential service
- ❌ Not very useful for deployment secrets (use environment variables in production)

## [Best Practices](https://bun.com/docs/api/secrets\#best-practices)

1. **Use descriptive service names**: Match the tool or application nameIf you're building a CLI for external use, you probably should use a UTI (Uniform Type Identifier) for the service name.







```
// Good - matches the actual tool
{ service: "com.docker.hub", name: "username" }
{ service: "com.vercel.cli", name: "team-name" }

// Avoid - too generic
{ service: "api", name: "key" }

```

2. **Credentials-only**: Don't store application configuration in this APIThis API is slow, you probably still need to use a config file for some things.

3. **Use for local development tools**:

   - ✅ CLI tools (gh, npm, docker, kubectl)
   - ✅ Local development servers
   - ✅ Personal API keys for testing
   - ❌ Production servers (use proper secret management)

## [TypeScript](https://bun.com/docs/api/secrets\#typescript)

```
namespace Bun {
  interface SecretsOptions {
    service: string;
    name: string;
  }

  interface Secrets {
    get(options: SecretsOptions): Promise<string | null>;
    set(options: SecretsOptions, value: string): Promise<void>;
    delete(options: SecretsOptions): Promise<boolean>;
  }

  const secrets: Secrets;
}

```

## [See Also](https://bun.com/docs/api/secrets\#see-also)

- [Environment Variables](https://bun.com/docs/api/env.md) \- For deployment configuration
- [Bun.password](https://bun.com/docs/api/password.md) \- For password hashing and verification

[Previous\\
\\
C Compiler](https://bun.com/docs/api/cc) [Next\\
\\
Testing](https://bun.com/docs/cli/test)

[![GitHub logo](<Base64-Image-Removed>)![GitHub logo](<Base64-Image-Removed>)\\
\\
Edit on GitHub](https://github.com/oven-sh/bun/edit/main/docs/api/secrets.md)

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