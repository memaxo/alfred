# Desktop App Migration Pattern

## Overview

This document describes the pattern for consolidating fragmented settings/configuration UIs into unified desktop applications with multi-category navigation.

## Problem

Settings and configuration UIs often start simple but grow fragmented over time:
- Settings spread across multiple route files
- Duplicate logic in window components and route pages
- Inconsistent organization and navigation
- Difficult to find specific settings
- Hard to add new categories

## Solution: Section-Based Desktop App

Consolidate all settings into a single desktop app with:
1. Persistent sidebar navigation (10-15 categories max)
2. Section-based file organization
3. Self-contained section components
4. Backend routers matching UI sections
5. Graceful deprecation of old routes

## Architecture

### Component Structure

```
apps/settings/
├── index.tsx              # Parent app with sidebar + routing
├── sections/              # One file per category
│   ├── profile.tsx
│   ├── devices.tsx
│   ├── security.tsx
│   └── ...
└── *-section.tsx          # Reusable sub-sections
```

### Parent App Responsibilities

```typescript
// apps/settings/index.tsx
export function SettingsApp({ window }: WindowComponentProps) {
  // 1. Navigation state
  const [section, setSection] = useState<SettingsSection>("profile");

  // 2. Section metadata
  const sections = [
    { id: "profile", icon: User, label: "Profile" },
    { id: "security", icon: Shield, label: "Security" },
    // ...
  ];

  // 3. Layout: Sidebar + Content
  return (
    <div className="flex">
      <aside>{/* Sidebar navigation */}</aside>
      <main>
        {section === "profile" && <ProfileSection />}
        {section === "security" && <SecuritySection />}
        {/* ... */}
      </main>
    </div>
  );
}
```

### Section Component Pattern

```typescript
// apps/settings/sections/profile.tsx
export function ProfileSection() {
  // 1. Data fetching
  const { data: profile } = trpc.profile.get.useQuery();
  const updateProfile = trpc.profile.update.useMutation();

  // 2. Local state
  const [name, setName] = useState("");

  // 3. Side effects
  useEffect(() => {
    if (profile) setName(profile.name);
  }, [profile]);

  // 4. Handlers
  const handleSave = () => {
    updateProfile.mutate({ name });
  };

  // 5. UI
  return (
    <div>
      <h2>Profile Settings</h2>
      {/* Form fields */}
    </div>
  );
}
```

## Migration Steps

### Phase 1: Create New Structure

1. **Create parent app**
   ```bash
   touch apps/web/src/components/apps/settings/index.tsx
   ```

2. **Create sections directory**
   ```bash
   mkdir apps/web/src/components/apps/settings/sections
   ```

3. **Define section types**
   ```typescript
   type SettingsSection = "profile" | "security" | "models" | ...
   ```

4. **Build sidebar navigation**
   - Icon + label for each section
   - Active state highlighting
   - Keyboard navigation support

### Phase 2: Migrate Sections

For each existing settings route/component:

1. **Extract content**
   - Copy relevant UI code
   - Copy tRPC queries/mutations
   - Copy local state management

2. **Create section file**
   ```bash
   touch apps/web/src/components/apps/settings/sections/profile.tsx
   ```

3. **Adapt to section pattern**
   - Remove route-specific code
   - Update imports
   - Simplify navigation

4. **Add to parent**
   ```typescript
   { section === "profile" && <ProfileSection /> }
   ```

### Phase 3: Backend Support

1. **Create tRPC routers**
   ```typescript
   // packages/api/src/routers/embed.ts
   export const embedRouter = router({
     getConfig: authedProcedure.query(async () => { ... }),
     setConfig: authedProcedure.input(...).mutation(async ({ input }) => { ... }),
   });
   ```

2. **Create database schemas** (if needed)
   ```typescript
   // packages/db/src/schema/notification.ts
   export const notificationPreferences = pgTable("notification_preferences", {
     userId: text("user_id").primaryKey(),
     agentCompletions: boolean("agent_completions").default(true),
     // ...
   });
   ```

3. **Wire up routers**
   ```typescript
   // packages/api/src/routers/index.ts
   export const appRouter = router({
     embed: embedRouter,
     notification: notificationRouter,
     // ...
   });
   ```

### Phase 4: Update Window Integration

1. **Update window component**
   ```typescript
   // components/windows/settings/settings-window.tsx
   import { SettingsApp } from "@/components/apps/settings";

   export function SettingsWindow({ id, data, selected }: NodeProps) {
     // Provide mock WindowComponentProps
     const mockProps = {
       window: {} as any,
       onClose: () => {},
       onMinimize: () => {},
       onMaximize: () => {},
       onRestore: () => {},
       onFocus: () => {},
       onBlur: () => {},
       onDragStart: () => {},
       onDragEnd: () => {},
       onResizeStart: () => {},
       onResizeEnd: () => {},
       onDataChange: () => {},
     };

     return (
       <WindowFrame {...frameProps}>
         <SettingsApp {...mockProps} />
       </WindowFrame>
     );
   }
   ```

2. **Increase window width**
   - Old: 380-440px
   - New: 600-800px for multi-column layout

### Phase 5: Deprecation

1. **Update route to redirect**
   ```typescript
   // apps/web/src/routes/_protected/settings.tsx
   function SettingsRoute() {
     useEffect(() => {
       toast.info("Settings moved to desktop app");
     }, []);

     return <RedirectPage />;
   }
   ```

2. **Find all callers**
   ```bash
   rg "/settings/(profile|visual|mcp)" --type tsx
   ```

3. **Update or remove callers**
   - Update links to spawn desktop window
   - Remove navigation to old routes

4. **Delete deprecated files**
   ```bash
   rm apps/web/src/routes/_protected/settings/profile.tsx
   rm apps/web/src/routes/_protected/settings/visual.tsx
   rm apps/web/src/routes/_protected/settings/mcp.tsx
   # ...
   ```

5. **Delete deprecated tests**
   ```bash
   rm components/windows/settings/__tests__/content.test.tsx
   ```

6. **Update test suite**
   - Test new desktop app integration
   - Test window sizing
   - Remove tests for deleted components

### Phase 6: Verification

1. **Typecheck**
   ```bash
   cd apps/web && bun run typecheck
   ```

2. **Search for broken imports**
   ```bash
   rg "from.*content-tabs" --type tsx
   rg "SettingsContent" --type tsx
   ```

3. **Test in browser**
   - Verify all sections load
   - Verify tRPC queries work
   - Verify navigation
   - Verify window sizing

4. **Commit**
   ```bash
   git add -A
   git commit -m "Consolidate settings into unified desktop app

   - 11 section files organized under sections/
   - 4 new tRPC routers (embed, integration, notification, shortcuts)
   - 2 new database schemas
   - Deleted 7 deprecated files (71KB)
   - All settings now accessible only through desktop app"
   ```

## Key Decisions

### Why Sidebar + Sections (Not Tabs)?

- **Persistent navigation:** Sidebar always visible
- **More categories:** Can show 10-15 items vs 5-7 tabs
- **Vertical space:** Desktop apps are often tall, not wide
- **Grouping:** Can add visual separators between groups

### Why Conditional Rendering (Not Routes)?

- **Single component tree:** Easier state management
- **No route changes:** Preserves window state
- **Simpler code:** No router configuration
- **Better UX:** Instant section switching

### Why Self-Contained Sections?

- **Independence:** Each section can be developed separately
- **Testability:** Easy to test in isolation
- **Reusability:** Sections can be extracted to reusable components
- **Maintainability:** Clear boundaries, easy to find code

### Why Mock WindowComponentProps?

- **Migration path:** Allows legacy window wrappers to use new apps
- **Gradual refactor:** Don't need to update entire window system
- **Type safety:** Props are typed even if unused
- **Future-proof:** When window system migrates, just wire up real handlers

## Success Metrics

Settings consolidation (2025-01):
- **Code removed:** 7 files, 71KB, 2,755 lines
- **Code added:** 11 sections, 4 routers, 2 schemas
- **Organization:** 10 categories in 1 place
- **UX:** Single window for all settings
- **Maintainability:** Clear file structure, no duplication

## Common Issues

### Issue: TypeScript errors with WindowComponentProps

**Symptom:**
```
Type 'NodeProps' is not assignable to type 'WindowInstance'
```

**Solution:** Provide mock props in window wrapper:
```typescript
const mockProps: WindowComponentProps = {
  window: {} as any,
  onClose: () => {},
  // ... all required props
};
```

### Issue: Section not updating on data change

**Symptom:** Form shows stale data after mutation

**Solution:** Invalidate queries after mutation:
```typescript
const utils = trpc.useUtils();
const mutation = trpc.section.update.useMutation({
  onSuccess: () => {
    utils.section.get.invalidate();
  },
});
```

### Issue: Old route still accessible

**Symptom:** Users can navigate to `/settings/profile`

**Solution:** Delete the route file, not just redirect:
```bash
rm routes/_protected/settings/profile.tsx
```

## References

- Implementation: `apps/web/src/components/apps/settings/`
- Pattern: `.ruler/58-desktop-app-organization.md`
- Window types: `packages/desktop/windows/types.ts`
- Commit: "Remove deprecated settings routes and consolidate to desktop app"
