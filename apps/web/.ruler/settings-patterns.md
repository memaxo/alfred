# Settings UI Patterns

## Preference Reading

1. **Query once per section.** Use single `trpc.user.getPreferences.useQuery()` at section top. Extract individual values with `.find()`.

2. **Default values inline.** Use `(prefs?.find(...)?.value as Type | undefined) ?? defaultValue` pattern for type-safe defaults.

3. **Type assertions.** Cast preference values to their expected union types (e.g., `as "brief" | "standard" | "detailed" | undefined`).

## Preference Writing

4. **Single mutation.** Use `trpc.user.setPreference.useMutation()` with `onSuccess` that invalidates and toasts.

5. **Key constants.** Reference preference keys from backend constants or use full `domain.subdomain.setting` strings inline.

## UI Components

6. **Radio groups for enums.** Use grid of clickable divs with active state styling. Include label and description per option.

7. **Toggle for booleans.** Use flex row with text left, toggle switch right. Include description below.

8. **Number inputs.** Use `<input type="number">` with `min`/`max` bounds. Clamp in onChange handler.

9. **Conditional sections.** Wrap dependent settings in `{parentEnabled && (<>...</>)}` to hide when parent is off.

## Grid Layouts

10. **Responsive grids.** Use `cn("grid gap-2", isCompact ? "grid-cols-1" : "grid-cols-N")` for adaptive layouts.

11. **Option cards.** Each option is a rounded border card with: title (bold, sm), description (faint, xs), active indicator dot.

12. **Active styling.** Active: `border-biolum/50 bg-biolum/10`. Inactive: `border-white/10 hover:border-biolum/30 hover:bg-biolum/5`.

## Toggle Switch Pattern

```tsx
<div
  className={cn(
    "h-5 w-9 rounded-full transition-colors",
    enabled ? "bg-biolum" : "bg-white/20"
  )}
>
  <div
    className={cn(
      "h-4 w-4 translate-y-0.5 rounded-full bg-white transition-transform",
      enabled ? "translate-x-4" : "translate-x-0.5"
    )}
  />
</div>
```

## Compact Mode

13. **Mode prop.** Settings sections receive `mode: SettingsMode` prop. Check `isCompact = mode === "compact"`.

14. **Compact adjustments.** Reduce grid columns, limit list items (`.slice(0, 4)`), hide verbose descriptions.
