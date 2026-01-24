# TypeScript Native Compiler (tsgo)

1. **Use tsgo.** Prefer `tsgo` over `tsc` for type checking. It is significantly faster and tracks the native TypeScript compiler preview.
2. **baseUrl forbidden.** Do not use `baseUrl` in `tsconfig.json`. It is deprecated and removed in the native compiler.
3. **Explicit paths.** Use explicit `paths` mappings for all module resolution.
4. **Relative paths.** All values in `paths` must be relative paths (starting with `./` or `../`). Non-relative paths are forbidden.
5. **Wildcard mapping.** When using `paths`, ensure a wildcard mapping `"*": ["./*"]` exists if root resolution is needed.
6. **Composite projects.** Maintain the composite project structure using `references` in `tsconfig.json`.
7. **Typecheck command.** The canonical typecheck command is `tsgo -b`.
