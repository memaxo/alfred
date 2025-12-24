# Utility Standards

1. **Pure Utilities.** Helper functions in `@alfred/util` must be pure and side-effect free.

2. **Zero Dependencies.** Minimize external dependencies in the util package to prevent bloat in consumer bundles.

3. **Native APIs.** Prefer Bun-native or Web-standard APIs over Node.js polyfills.
