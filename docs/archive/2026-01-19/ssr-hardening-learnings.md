# Learnings

1. **Vite Static Analysis vs Dynamic Imports**: Vite aggressively bundles imports even if they are inside `if (typeof window === 'undefined')` blocks. Simply using `await import("@alfred/db")` is not enough because Vite statically analyzes the string literal. The workaround is to use a variable: `const pkg = "@alfred/db"; await import(pkg)`. This forces Vite to ignore the import during client bundling.

2. **Browser-Only Libraries in SSR**: Libraries like `xterm.js` that access `window` or `document` at the top level will crash the server process if imported normally. They must be imported dynamically inside `useEffect` or `componentDidMount` to ensure they only load in the browser.

3. **Automated Verification**: Relying on manual testing for bundle leakage is insufficient. Automated scripts (`verify-build.ts`) that grep the production bundle for forbidden strings (like "postgres", "drizzle-orm", "openai") are essential for preventing regressions.

# Recommended Rules

## .ruler/21-tanstack-start.md (Update)

Already added:

- **Rule 21: Variable-Based Dynamic Imports.** (For server packages in API routes)
- **Rule 22: Browser-Only Libraries.** (For libraries like xterm)

## .ruler/02-architecture.md (Update)

Already added:

- **Rule 13: Vite Externalization.** (Explicit `ssr.external` configuration)

## Additional Rules to Consider

### .ruler/05-testing.md

13. **Production Build Verification.** Maintain a `scripts/verify-build.ts` script that builds the application and scans client bundles for forbidden strings (e.g., "postgres", "drizzle-orm", "openai") to detect server code leakage. Run this in CI.

### .ruler/22-bun-runtime.md

15. **Prerendering Limitations.** Disable static prerendering (`prerender: { enabled: false }`) if your app relies on runtime-specific APIs (like Bun) that are not available in the build-time prerender environment, or use a compatible compatibility layer.

# Next Steps

1.  **Institutionalize Verification**: Add `bun run scripts/verify-build.ts` to the CI pipeline (e.g., GitHub Actions) to prevent future PRs from introducing leaks.
2.  **Refine False Positives**: The verification script currently has a basic allowlist. As the app grows, this list might need more sophisticated context awareness (e.g., using an AST-based checker instead of simple string matching).
3.  **Smoke Tests**: Expand the "Smoke Test" suite to run against the _production preview_ (`vite preview`), not just the dev server, to catch runtime issues that only appear in the built artifact.
