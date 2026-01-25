# Code Quality Corrections

## Rules

1. **Readonly by default.** Mark class fields and collection references `readonly` unless reassignment is required.
2. **No redundant async.** Don’t use `async` unless the function actually `await`s.
3. **ESM hygiene.** Use explicit `.js` extensions in ESM exports/imports where required (especially package entrypoints).
4. **Stable barrels.** Alphabetize exports in `src/index.ts` to reduce churn and merge conflicts.
5. **Readable types.** Break long type signatures across lines at semantic boundaries.
6. **Avoid ES2023-only APIs.** Don’t use `toReversed`/`toSorted`/`toSpliced` unless the project `tsconfig` `lib` includes `es2023`.
7. **No empty imports.** Imported placeholder files must be modules; add `export {}` to intentionally-empty `.ts` files.
