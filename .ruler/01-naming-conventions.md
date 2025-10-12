# Naming Conventions

1. **Single-word names.** Files, directories, exported symbols, and route segments must remain a single lowercase word (e.g. `remind.ts`, `policy`, `note`). Use suffixes only when required by tools (`.test.ts`, `.spec.ts`).

   **Framework and UI exceptions (limited):**
   - TanStack Start reserved files: `_layout.tsx`, `+not-found.tsx`, route loader/action filenames the framework mandates.
   - React / React Native ergonomics in UI packages: conventional hook/component prefixes or platform hints are allowed (e.g. `use-color-scheme.ts`, `android-navigation-bar.tsx`, `header-button.tsx`, `sign-in.tsx`, `sign-up.tsx`).
   - Generated outputs that land outside `apps/*/src` and `packages/*/src` may follow the generator’s naming.
   Outside these cases, keep names to a single word.
2. **Domain folders.** Group behaviour under domain nouns (`note`, `remind`, `timer`, `book`). Avoid verbs or multi-word folders (`create-note`, `assistant-notes`).
3. **Schema and repo parity.** Table names, Drizzle schemas, and repository helpers must share the same single-word root. Do not invent aliases between layers.
4. **Migrations.** Migration filenames must follow `NNNN_description.sql` with `description` as a single word. Comments inside migrations may explain details.
5. **Generated outputs.** Artifacts produced by tools (Ruler, Drizzle, Turbo) can use the tool’s default naming. Keep them out of `apps/*/src` and `packages/*/src` when they violate the rule.
6. **Tests.** Co-locate tests next to the unit under test or in the nearest `__tests__` folder. Use `<name>.test.ts` or `<name>.spec.ts`.
