# Bun Runtime Standards

## Core Principle

Bun provides native, high-performance APIs that outperform Node.js compatibility layers. Prefer Bun-native APIs for performance-critical operations and leverage Bun's built-in capabilities to simplify workflows.

## Rules

1. **Native APIs over compatibility layers.** Prefer Bun-native APIs (`Bun.file`, `Bun.write`, `Bun.serve`, `Bun.spawn`, `bun:sqlite`) over Node.js compatibility modules (`fs`, `http`, `child_process`, `sqlite3`) for performance-critical code paths. Use Node.js APIs only when specific compatibility is required.

2. **Bun.spawn for subprocess execution.** Always use `Bun.spawn` instead of Node.js `child_process.spawn`:
   - Use ReadableStream API for stdout/stderr (`proc.stdout.getReader()`)
   - Use `proc.exited` promise for exit handling (not EventEmitter `.on("close")`)
   - Use `proc.kill()` for termination
   - Configure streams with `stdout: "pipe"`, `stderr: "pipe"`, `stdin: "ignore"`
   - Command array format: `Bun.spawn([command, ...args], options)`
   - Bun's spawn uses `posix_spawn(3)` and is ~60% faster than Node.js

3. **Direct TypeScript execution.** Execute `.ts` and `.tsx` files directly with `bun run`; never compile to JavaScript before execution. Use `tsc` only for type checking, not execution.

4. **Web-standard APIs.** Always prefer Web-standard APIs (`fetch`, `WebSocket`, `Request`/`Response`, `URL`, `Headers`) over Node.js equivalents (`http`, `https`, `url.parse`) unless specific Node.js compatibility is required.

5. **Bun.serve for HTTP servers.** Use `Bun.serve` for all HTTP server implementations instead of Node.js `http` or `express`; leverage its native performance, Web-standard APIs, and built-in WebSocket support.

6. **Bun.file for file operations.** Always use `Bun.file` and `Bun.write` for file I/O instead of Node.js `fs`; they provide better performance and `Blob`-compatible interfaces.

7. **TypeScript configuration.** Configure `tsconfig.json` with `module: "Preserve"`, `allowImportingTsExtensions: true`, and `verbatimModuleSyntax: true` for Bun projects; these settings enable native TypeScript execution and extensioned imports.

8. **Automatic .env loading.** Rely on Bun's automatic `.env` file loading instead of external packages like `dotenv`; use `process.env` or `Bun.env` for environment variable access.

9. **Workspaces and catalogs.** In monorepos, use Bun workspaces with catalogs to share dependency versions across packages; reference catalog versions with `"catalog:"` instead of duplicating version strings.

10. **Lockfile commitment.** Always commit `bun.lock` to version control and use `--frozen-lockfile` in CI/CD to ensure reproducible dependency resolution; never ignore the lockfile.

11. **Hot reloading for development.** Use `bun --hot` for development servers to preserve global state during code changes; use `bun --watch` only when hard restarts are required (e.g., configuration changes).

12. **Bun.build for bundling.** Use `Bun.build` for all bundling tasks instead of esbuild, webpack, or rollup; leverage its native performance, plugin system, and executable generation capabilities.

14. **Optional dependencies.** Wrap optional or heavy dependencies (WASM, native modules) in dynamic imports with try/catch blocks that provide explicit installation instructions on failure.


