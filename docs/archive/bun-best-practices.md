# Bun Best Practices for Agent Rules

## Best Practice 1: Use Native Bun APIs for Performance-Critical Operations

**Explanation:** Prefer Bun's native APIs (`Bun.file`, `Bun.write`, `Bun.serve`) over Node.js compatibility APIs (`fs`, `http`) for better performance, especially in hot paths.

**Example:**
```typescript
// ✅ Native Bun API
const file = Bun.file("data.json");
const content = await file.text();
await Bun.write("output.json", content);

// ❌ Node.js compatibility API (slower)
import fs from "node:fs/promises";
const content = await fs.readFile("data.json", "utf-8");
await fs.writeFile("output.json", content);
```

**Agent Rule:** When implementing file I/O, HTTP servers, or other operations with Bun-native alternatives, always prefer the native API (`Bun.file`, `Bun.serve`, `bun:sqlite`) over Node.js compatibility modules for performance-critical code paths.

## Best Practice 2: Execute TypeScript Directly Without Compilation Step

**Explanation:** Bun executes `.ts` and `.tsx` files natively without requiring a separate transpilation step, simplifying development workflows and reducing build complexity.

**Example:**
```typescript
// ✅ Direct execution
// Run with: bun src/index.ts
export function handler() {
  return new Response("Hello");
}

// No tsconfig.json compilation step needed for execution
```

**Agent Rule:** When writing Bun scripts or server code, execute TypeScript files directly with `bun run` rather than compiling to JavaScript first; only use `tsc` for type checking, not execution.

## Best Practice 3: Use Web-Standard APIs Over Node.js Equivalents

**Explanation:** Bun implements Web-standard APIs (`fetch`, `WebSocket`, `Request`, `Response`) natively with better performance than Node.js equivalents; prefer these for cross-platform compatibility and performance.

**Example:**
```typescript
// ✅ Web-standard API
const response = await fetch("https://api.example.com/data");
const data = await response.json();

// ❌ Node.js API (compatibility layer, slower)
import https from "node:https";
// More verbose, less performant
```

**Agent Rule:** Always prefer Web-standard APIs (`fetch`, `WebSocket`, `Request`/`Response`, `URL`, `Headers`) over Node.js equivalents (`http`, `https`, `url.parse`) unless specific Node.js compatibility is required.

## Best Practice 4: Leverage Bun.serve for High-Performance HTTP Servers

**Explanation:** `Bun.serve` provides a fast, native HTTP server using Web-standard `Request`/`Response` objects with built-in routing, streaming, and WebSocket support.

**Example:**
```typescript
// ✅ Bun.serve with type-safe routing
const server = Bun.serve({
  port: 3000,
  fetch(req) {
    const url = new URL(req.url);
    if (url.pathname === "/api/data") {
      return Response.json({ data: "value" });
    }
    return new Response("Not found", { status: 404 });
  },
});
```

**Agent Rule:** Use `Bun.serve` for all HTTP server implementations instead of Node.js `http` or `express`; leverage its native performance, Web-standard APIs, and built-in WebSocket support.

## Best Practice 5: Use Bun's Native SQLite Driver for Local Databases

**Explanation:** `bun:sqlite` provides a synchronous, high-performance SQLite driver that outperforms Node.js alternatives and integrates seamlessly with Bun's runtime.

**Example:**
```typescript
// ✅ Native SQLite
import { Database } from "bun:sqlite";
const db = new Database("app.db");
db.run("CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, name TEXT)");
const stmt = db.prepare("INSERT INTO users (name) VALUES (?)");
stmt.run("Alice");

// ❌ Node.js SQLite (slower, async overhead)
import sqlite3 from "sqlite3";
```

**Agent Rule:** For local SQLite databases, always use `bun:sqlite` instead of Node.js SQLite packages; it provides synchronous operations, better performance, and native integration.

## Best Practice 6: Use Hot Reloading for Development Workflows

**Explanation:** Bun's `--hot` flag enables soft reloading that preserves global state, while `--watch` performs hard restarts; use `--hot` for development to maintain application state during code changes.

**Example:**
```typescript
// ✅ Hot reloading preserves state
globalThis.count ??= 0;
globalThis.count++;

Bun.serve({
  fetch() {
    return new Response(`Reloaded ${globalThis.count} times`);
  },
  port: 3000,
});

// Run with: bun --hot server.ts
```

**Agent Rule:** Use `bun --hot` for development servers to preserve global state during code changes; use `bun --watch` only when hard restarts are required (e.g., configuration changes).

## Best Practice 7: Use Bun's Test Runner Instead of External Frameworks

**Explanation:** `bun:test` provides a fast, Jest-compatible test runner with built-in TypeScript support, mocks, snapshots, and coverage; avoid external test frameworks to leverage Bun's performance.

**Example:**
```typescript
// ✅ Bun test runner
import { test, expect, mock } from "bun:test";

test("should handle async operations", async () => {
  const result = await fetchData();
  expect(result).toBeDefined();
});

test("should mock functions", () => {
  const fn = mock(() => 42);
  expect(fn()).toBe(42);
});
```

**Agent Rule:** Always use `bun:test` for all test suites instead of Jest, Vitest, or other test runners; it provides better performance, native TypeScript support, and built-in mocking capabilities.

## Best Practice 8: Use Workspaces and Catalogs for Monorepo Dependency Management

**Explanation:** Bun's workspace support with catalogs centralizes dependency versions across packages, reducing duplication and ensuring consistent versions throughout the monorepo.

**Example:**
```json
// ✅ Root package.json
{
  "workspaces": ["packages/*"],
  "catalog": {
    "react": "^18.2.0",
    "typescript": "^5.3.0"
  }
}

// ✅ Package package.json
{
  "dependencies": {
    "react": "catalog:",
    "typescript": "catalog:"
  }
}
```

**Agent Rule:** In monorepos, use Bun workspaces with catalogs to share dependency versions across packages; reference catalog versions with `"catalog:"` instead of duplicating version strings.

## Best Practice 9: Use Macros for Compile-Time Code Generation

**Explanation:** Bun's macro system runs JavaScript functions at bundle-time and inlines results, enabling compile-time optimizations, embedding build metadata, and reducing runtime overhead.

**Example:**
```typescript
// ✅ Macro for git commit hash
export function getGitCommitHash() {
  const { stdout } = Bun.spawnSync({
    cmd: ["git", "rev-parse", "HEAD"],
    stdout: "pipe",
  });
  return stdout.toString().trim();
}

// Usage
import { getGitCommitHash } from "./macros.ts" with { type: "macro" };
const commitHash = getGitCommitHash(); // Inlined at build time
```

**Agent Rule:** Use macros (`with { type: "macro" }`) for compile-time code generation, build metadata embedding, and dead code elimination; avoid runtime computation when values can be determined at build time.

## Best Practice 10: Use Bun.build for Fast Bundling and Executables

**Explanation:** `Bun.build` provides native, fast bundling with support for code splitting, plugins, macros, and single-file executables; prefer it over external bundlers for Bun projects.

**Example:**
```typescript
// ✅ Bun.build configuration
await Bun.build({
  entrypoints: ["./src/index.ts"],
  outdir: "./dist",
  target: "bun", // or "browser", "node"
  format: "esm",
  minify: true,
  splitting: true,
  plugins: [/* custom plugins */],
});

// ✅ Single-file executable
// bun build --compile --target=bun-linux-x64 src/index.ts
```

**Agent Rule:** Use `Bun.build` for all bundling tasks instead of esbuild, webpack, or rollup; leverage its native performance, plugin system, and executable generation capabilities.

## Best Practice 11: Use Bun.secrets for Sensitive Credential Storage

**Explanation:** `Bun.secrets` stores credentials in OS-native secure storage (Keychain, libsecret, Credential Manager) instead of environment variables, providing better security for development tools.

**Example:**
```typescript
// ✅ Secure secret storage
Bun.secrets.set("api_key", "secret-value");
const apiKey = Bun.secrets.get("api_key");

// ❌ Environment variables (less secure, visible in process list)
const apiKey = process.env.API_KEY;
```

**Agent Rule:** For sensitive credentials in development tools, use `Bun.secrets` instead of environment variables; it provides OS-native secure storage and prevents credential exposure in process lists.

## Best Practice 12: Use Plugins for Custom Loaders and Module Resolution

**Explanation:** Bun's universal plugin API extends both runtime and bundler with custom loaders and resolution logic, enabling support for new file types and build transformations.

**Example:**
```typescript
// ✅ Custom YAML loader plugin
import { plugin } from "bun";
import { load } from "js-yaml";

await plugin({
  name: "YAML",
  setup(build) {
    build.onLoad({ filter: /\.(yaml|yml)$/ }, async (args) => {
      const text = await Bun.file(args.path).text();
      const exports = load(text);
      return { exports, loader: "object" };
    });
  },
});

// Usage: import data from "./config.yaml";
```

**Agent Rule:** Use Bun plugins (`plugin()`) to extend runtime and bundler capabilities with custom loaders; prefer plugins over external build tools for file type support and module resolution.

## Best Practice 13: Use bun:sql for Unified Database Access

**Explanation:** `bun:sql` provides a unified Promise-based API for PostgreSQL, MySQL, and SQLite using tagged template literals, enabling safe queries and consistent database access patterns.

**Example:**
```typescript
// ✅ Unified SQL API
import { sql } from "bun:sql";

const db = sql`postgresql://user:pass@localhost/db`;
const users = await db`SELECT * FROM users WHERE id = ${userId}`;
await db`INSERT INTO users (name) VALUES (${name})`;
```

**Agent Rule:** Use `bun:sql` for database queries when supporting multiple database backends; it provides a unified API with safe parameter binding and Promise-based operations.

## Best Practice 14: Configure TypeScript for Bun-Specific Features

**Explanation:** Bun requires specific `tsconfig.json` settings (`module: "Preserve"`, `allowImportingTsExtensions: true`) to leverage native TypeScript execution and extensioned imports.

**Example:**
```json
// ✅ Bun-optimized tsconfig.json
{
  "compilerOptions": {
    "lib": ["ESNext"],
    "target": "ESNext",
    "module": "Preserve",
    "moduleDetection": "force",
    "allowImportingTsExtensions": true,
    "verbatimModuleSyntax": true,
    "noEmit": true,
    "strict": true,
    "skipLibCheck": true
  }
}
```

**Agent Rule:** Always configure `tsconfig.json` with `module: "Preserve"`, `allowImportingTsExtensions: true`, and `verbatimModuleSyntax: true` for Bun projects; these settings enable native TypeScript execution and extensioned imports.

## Best Practice 15: Use Environment Variables with Automatic .env Loading

**Explanation:** Bun automatically loads `.env` files and supports expansion, providing seamless environment variable access via `process.env`, `Bun.env`, or `import.meta.env` without external libraries.

**Example:**
```typescript
// ✅ Automatic .env loading
// .env file: API_KEY=secret
const apiKey = process.env.API_KEY; // Automatically loaded
const apiKey2 = Bun.env.API_KEY; // Alternative access

// No need for dotenv package
```

**Agent Rule:** Rely on Bun's automatic `.env` file loading instead of external packages like `dotenv`; use `process.env` or `Bun.env` for environment variable access.

## Best Practice 16: Use Bun's Debugger for Development Debugging

**Explanation:** Bun's debugger is compatible with WebKit Inspector Protocol and integrates with VS Code, providing network request logging, sourcemapped stack traces, and breakpoint debugging.

**Example:**
```bash
# ✅ Start with debugger
bun --inspect server.ts
# Connect via debug.bun.sh or VS Code

# ✅ VS Code launch.json
{
  "type": "bun",
  "request": "launch",
  "name": "Debug Bun",
  "program": "${workspaceFolder}/src/index.ts"
}
```

**Agent Rule:** Use Bun's built-in debugger (`--inspect`) for development debugging instead of external debugging tools; it provides WebKit Inspector Protocol compatibility and VS Code integration.

## Best Practice 17: Use Lifecycle Script Security with trustedDependencies

**Explanation:** Bun's "default-secure" approach requires explicit `trustedDependencies` for lifecycle scripts, preventing malicious script execution during package installation.

**Example:**
```json
// ✅ Explicit trust for lifecycle scripts
{
  "trustedDependencies": [
    "some-package-with-postinstall"
  ],
  "scripts": {
    "postinstall": "some-package-with-postinstall"
  }
}

// ❌ Unsafe: scripts run without trust
```

**Agent Rule:** Always explicitly list packages with lifecycle scripts in `trustedDependencies`; never use `--ignore-scripts` as a workaround—fix trust configuration instead.

## Best Practice 18: Use Workers for CPU-Bound Concurrent Tasks

**Explanation:** Bun's `Worker` API enables running code in separate threads with optimized `postMessage` performance, ideal for CPU-bound tasks that benefit from parallelism.

**Example:**
```typescript
// ✅ Worker for CPU-bound tasks
const worker = new Worker(new URL("worker.ts", import.meta.url));
worker.postMessage({ data: largeDataset });
worker.onmessage = (event) => {
  const result = event.data;
  // Process result
};
```

**Agent Rule:** Use Bun's `Worker` API for CPU-bound concurrent tasks instead of spawning separate processes; it provides better performance and optimized message passing.

## Best Practice 19: Use Bun.file for Optimized File Operations

**Explanation:** `Bun.file` returns a `Blob`-compatible object with optimized native file I/O, providing better performance than Node.js `fs` for reading and writing files.

**Example:**
```typescript
// ✅ Optimized file I/O
const file = Bun.file("data.json");
const text = await file.text();
const json = await file.json();
const arrayBuffer = await file.arrayBuffer();

// Streaming write
const sink = Bun.file("output.json").writer();
await sink.write(jsonString);
await sink.end();
```

**Agent Rule:** Always use `Bun.file` and `Bun.write` for file operations instead of Node.js `fs`; they provide better performance and `Blob`-compatible interfaces.

## Best Practice 20: Use Bun's Lockfile for Reproducible Installs

**Explanation:** `bun.lock` is a text-based lockfile that ensures reproducible dependency resolution across environments; commit it to version control for consistent installs.

**Example:**
```bash
# ✅ Generate and commit lockfile
bun install
git add bun.lock

# ✅ Reproducible installs
bun install --frozen-lockfile
```

**Agent Rule:** Always commit `bun.lock` to version control and use `--frozen-lockfile` in CI/CD to ensure reproducible dependency resolution; never ignore the lockfile.

