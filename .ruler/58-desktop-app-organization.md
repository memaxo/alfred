# Desktop App Organization

1. **Section directory.** Apps with 5+ categories must organize content in `sections/` subdirectory with one file per category.
2. **Self-contained sections.** Each section exports one component that handles its own tRPC queries, form state, and UI.
3. **Parent navigation.** Parent app manages navigation state and renders sections conditionally (not with routing or tabs).
4. **Sidebar pattern.** Use persistent sidebar with icon + label; keep metadata in const array.
5. **Width planning.** Multi-category apps require 600-800px windows; simple windows use 380-440px.
6. **Backend first.** Create tRPC routers and schemas before building section UI; don't use env vars for user preferences.
7. **Window wrapper mock.** Legacy wrappers (NodeProps) render new apps (WindowComponentProps) by providing mock callback props as no-ops.
8. **Consolidation order.** Build new unified app → update callers → delete deprecated files in one commit with byte count.
9. **Migration verification.** After consolidation: search for old path references, run typecheck, delete deprecated tests.
10. **Section naming.** Section files use single lowercase words (profile.tsx, voice.tsx) matching section ID.
