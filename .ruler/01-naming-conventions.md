# Naming Conventions

1. **Single-word names.** Files, directories, exported symbols, and route segments must remain a single lowercase word (e.g. `remind.ts`, `policy`, `note`). Use suffixes only when required by tools (`.test.ts`, `.spec.ts`).
2. **Domain folders.** Group behaviour under domain nouns (`note`, `remind`, `timer`, `book`). Avoid verbs or multi-word folders (`create-note`, `assistant-notes`).
3. **Schema and repo parity.** Table names, Drizzle schemas, and repository helpers must share the same single-word root. Do not invent aliases between layers.
4. **Migrations.** Migration filenames must follow `NNNN_description.sql` with `description` as a single word. Comments inside migrations may explain details.
5. **Generated outputs.** Artifacts produced by tools (Ruler, Drizzle, Turbo) can use the tool’s default naming. Keep them out of `apps/*/src` and `packages/*/src` when they violate the rule.
6. **Tests.** Co-locate tests next to the unit under test or in the nearest `__tests__` folder. Use `<name>.test.ts` or `<name>.spec.ts`.
