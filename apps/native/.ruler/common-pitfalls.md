# Common React Native Pitfalls

## Rules

1. **tRPC hook options.** Pass callbacks as the hook options object (don’t “append” them after calling the hook).
2. **Query enablement.** Pass query options (like `enabled`) as the hook’s second argument.
3. **Hook imports.** Import every React hook you use (no implicit globals).
4. **No JSX type assertions.** Don’t put type assertions in JSX tags; extract to a variable first.
5. **Use `.tsx` for JSX.** Any file containing JSX must be `.tsx`.
6. **RN accessibility roles.** Use React Native’s valid `accessibilityRole` values (e.g., `"search"` not `"searchbox"`; avoid invalid roles like `"listitem"`).
7. **Optional deps.** Treat “optional” libraries as non-optional for Metro bundling; use stubs/abstractions instead of conditional imports.
8. **iOS simulator signing.** Simulator builds must not require code signing.
9. **Patching.** Apply third-party patches via the repo’s patch scripts, not ad-hoc edits.
