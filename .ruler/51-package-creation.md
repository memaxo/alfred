# Package Creation Standards

## Rules

1. **Scaffold first.** Use the repo’s generators when available; otherwise create `package.json`, `tsconfig.json`, `turbo.json`, `README.md`, `src/index.ts`, and `test/` before writing implementation code.
2. **ESM correctness.** Set `"type": "module"` and export subpaths explicitly in `package.json`; in `src/index.ts`, use `.js` extensions and keep exports alphabetized.
3. **Workspace deps.** Use `"workspace:*"` for internal package dependencies.
4. **TS config.** `tsconfig.json` must extend `"../tsconfig/tsconfig.json"` (relative path) and include only the package sources.
5. **TS version.** Package `devDependencies.typescript` must be an explicit version (e.g. `^5.7.3`), not `"catalog:"`.
6. **Naming.** New packages under `@alfred/` must be single-word domain nouns.
