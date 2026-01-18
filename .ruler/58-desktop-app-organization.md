# Desktop App Organization

## Core Principle

Desktop apps with multiple categories (5+) should use a section-based architecture with sidebar navigation and conditional rendering rather than nested routing or tab components.

## Rules

1. **Section directory.** Apps with 5+ categories must organize content in a `sections/` subdirectory with one file per category.

2. **Self-contained sections.** Each section file exports a single function component that handles its own tRPC queries, form state, and UI.

3. **Parent navigation.** The parent app component manages navigation state (e.g., `selectedSection`) and renders sections conditionally.

4. **Sidebar pattern.** Use a persistent sidebar with icon + label for each section. Keep section metadata (id, icon, label) in a const array.

5. **Width planning.** Multi-category apps require wider windows (600-800px) than simple windows (380-440px). Plan for content density.

6. **Backend parity.** Create tRPC routers and database schemas to match section needs before building UI. Don't hardcode or use environment variables for user preferences.

7. **Deprecation strategy.** When consolidating fragmented settings:
   - Create new unified app first
   - Update all callers to use new app
   - Delete deprecated files in one commit
   - Provide redirect pages for old routes

8. **Window wrapper pattern.** Legacy window wrappers (NodeProps) can render new desktop apps (WindowComponentProps) by providing mock props:
   ```tsx
   const mockProps = {
     window: {} as any,
     onClose: () => {},
     onMinimize: () => {},
     // ... all required callbacks as no-ops
   };
   return <DesktopApp {...mockProps} />;
   ```

9. **Migration verification.** After consolidation:
   - Search codebase for references to old paths
   - Run typecheck to catch broken imports
   - Delete deprecated test files
   - Commit with detailed file count and byte savings

10. **Section naming.** Section files use single lowercase words (profile.tsx, voice.tsx) matching their section ID constant.

## Example Structure

```
apps/settings/
  index.tsx              # Parent with sidebar, 200 lines
  sections/
    profile.tsx          # 100 lines, uses trpc.profile.*
    devices.tsx          # 150 lines, uses trpc.admin.sessionsList
    security.tsx         # 120 lines, wraps TokensSection + PolicySection
    models.tsx           # 180 lines, uses trpc.preference.set
    voice.tsx            # 200 lines, uses useVoiceStore
    embeddings.tsx       # 140 lines, uses trpc.embed.*
    visual.tsx           # 250 lines, uses useVisualPreferences
    mcp.tsx              # 200 lines, uses trpc.mcp.*
    integrations.tsx     # 130 lines, uses trpc.integration.*
    notifications.tsx    # 160 lines, uses trpc.notification.*
    keyboard.tsx         # 100 lines, uses trpc.shortcuts.*
  sessions-section.tsx   # Reusable component
  tokens-section.tsx     # Reusable component
  policy-section.tsx     # Reusable component
```

## Anti-Patterns

1. **Route-based organization.** Don't create `/settings/profile`, `/settings/visual` routes when a desktop app is more appropriate.

2. **Content duplication.** Don't maintain parallel route-based and desktop-based settings UIs. Pick one.

3. **Nested tabs.** Don't use tab components inside tab components. Use sections with sidebar instead.

4. **God component.** Don't put all settings in one 2000+ line file. Extract sections at 5+ categories.

5. **Fragment sprawl.** Don't leave deprecated route/component files after migration. Delete in same commit as consolidation.

## Reference Implementation

Settings app consolidation (2025-01):
- Consolidated 5 route files + 2 component files into 1 desktop app
- 11 section files (avg 150 lines each)
- 4 new tRPC routers (embed, integration, notification, shortcuts)
- 2 new database schemas
- Deleted 71KB of deprecated code
- See: `apps/web/src/components/apps/settings/`
