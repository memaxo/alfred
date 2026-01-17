# Code Quality Corrections

## Rules

1. **Readonly by default.** Mark class fields and collection references `readonly` unless reassignment is required.
2. **No redundant async.** Don’t use `async` unless the function actually `await`s.
3. **ESM hygiene.** Use explicit `.js` extensions in ESM exports/imports where required (especially package entrypoints).
4. **Stable barrels.** Alphabetize exports in `src/index.ts` to reduce churn and merge conflicts.
5. **Readable types.** Break long type signatures across lines at semantic boundaries.
