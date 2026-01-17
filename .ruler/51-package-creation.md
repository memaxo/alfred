# Package Creation Standards

## Core Principle

New packages must follow consistent structure and conventions. Every exported module must use explicit `.js` extensions for ESM compatibility, and package metadata must be complete before any code is written.

## Rules

1. **Package structure first.** Create `package.json`, `tsconfig.json`, `turbo.json`, and `README.md` before writing any code.

2. **Explicit file extensions.** All imports and exports in `index.ts` must use `.js` extensions for ESM compatibility (e.g., `export * from "./abort.js"`).

3. **TypeScript extends path.** Use relative path to tsconfig base: `"extends": "../tsconfig/tsconfig.json"` not catalog reference.

4. **Explicit TypeScript version.** Use explicit version like `"typescript": "^5.7.3"` not `"typescript": "catalog:"` in package-specific devDependencies.

5. **Readonly class properties.** Mark class properties as `readonly` if they should never be reassigned after construction (e.g., `private readonly handlers: Handler[]`).

6. **No redundant async.** Don't mark functions `async` if they only return a Promise without using `await` internally (e.g., `function race() { return Promise.race(...) }` not `async function race()`).

7. **Alphabetize exports.** Order module exports alphabetically in `index.ts` for consistency and merge conflict reduction.

8. **Workspace dependency format.** Reference other packages with `"workspace:*"` in dependencies, never explicit versions.

9. **Minimal turbo config.** Start with minimal turbo.json extending root config; add only package-specific overrides.

10. **README first.** Write comprehensive README with API reference before implementation to clarify package purpose and scope.

11. **Single-word package names.** Package names under `@alfred/` namespace must be single lowercase words matching the domain (e.g., `@alfred/resilience` not `@alfred/resilience-patterns`).

12. **Subpath exports.** Define explicit subpath exports for major modules (e.g., `"./abort": "./src/abort.ts"`) to enable tree-shaking and clear API surface.

## Package Structure Template

```
packages/<name>/
├── package.json          # Metadata, dependencies, exports
├── tsconfig.json         # TypeScript config extending base
├── turbo.json            # Build orchestration
├── README.md             # API reference and examples
├── src/
│   ├── index.ts          # Main entry with .js exports
│   ├── <module-a>.ts     # Logical module
│   ├── <module-b>.ts     # Another module
│   └── types.ts          # Shared types (if needed)
└── test/
    ├── <module-a>.test.ts
    └── <module-b>.test.ts
```

## package.json Template

```json
{
  "name": "@alfred/<name>",
  "version": "0.1.0",
  "type": "module",
  "exports": {
    ".": "./src/index.ts",
    "./<module>": "./src/<module>.ts"
  },
  "scripts": {
    "typecheck": "tsc -b"
  },
  "dependencies": {
    "@alfred/<dep>": "workspace:*"
  },
  "devDependencies": {
    "@types/bun": "latest",
    "typescript": "^5.7.3"
  }
}
```

## tsconfig.json Template

```json
{
  "extends": "../tsconfig/tsconfig.json",
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "dist"
  },
  "include": ["src/**/*"]
}
```

## Validation Checklist

Before committing a new package:

- [ ] `bun install` succeeds without errors
- [ ] `bun run typecheck` passes in package directory
- [ ] All exports use `.js` extensions in `index.ts`
- [ ] README includes purpose, installation, usage, and API reference
- [ ] Class properties marked `readonly` where appropriate
- [ ] No redundant `async` keywords
- [ ] Exports alphabetized in `index.ts`
- [ ] Subpath exports defined for all major modules

## Common Mistakes

1. **Forgetting .js extensions** - ESM requires explicit extensions even for TypeScript imports
2. **Using catalog: reference** - Not supported in all contexts; use explicit versions
3. **Absolute tsconfig paths** - Use relative paths like `../tsconfig/tsconfig.json`
4. **Mutable class state** - Mark private properties `readonly` unless mutation is required
5. **Async wrappers** - Don't wrap Promise-returning functions in `async` without `await`

## Integration After Creation

After creating a package, integrate it:

1. Run `bun install` at repo root to update lockfile
2. Reference new package in consumers with `"@alfred/<name>": "workspace:*"`
3. Update root `tsconfig.json` references if needed for project builds
4. Add to relevant `.ruler/` documentation mentioning the package
