# Bun Feature Flags

1. **Type declarations.** Create `src/env.d.ts` declaring `bun:bundle` module with `Registry.features` union type and `feature()` function signature.

2. **Guard pattern.** Wrap deprecated/platform-specific code in `if (feature("FLAG_NAME")) { ... }` blocks. The flag is replaced with `true`/`false` at build time.

3. **Dynamic imports.** Use `await import("./module.js")` inside feature guards for tree-shakeable code paths. Bundler resolves imports but eliminates dead paths.

4. **Sync function capture.** When feature-flagged code is needed in sync functions, capture the import at initialization time (async context) and store in a module-level variable.

5. **Build scripts.** Production builds omit flags (dead code eliminated). Dev builds use `--feature=FLAG_A --feature=FLAG_B` to include legacy paths.

6. **Naming convention.** Use `LEGACY_*` for deprecated features, `DEBUG` for debug-only code, explicit platform names for platform-specific features.

7. **Runtime vs compile-time.** Feature flags are compile-time only. Use environment variables for runtime configuration.
