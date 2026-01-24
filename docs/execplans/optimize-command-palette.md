# Plan: Command Palette Performance & Usability Optimization

## 1. Objective

Optimize the `MindscapeCommandPalette` to ensure zero-latency typing (input response < 16ms) and frictionless usability, even with hundreds of commands and aliases.

## 2. Performance Bottlenecks

- **O(N\*M) Scanning:** The `suggestion` logic iterates through every action AND every alias on every keystroke. As actions grow, this will block the main thread.
- **Re-rendering:** Typing causes the entire `CommandDialog` tree to re-render, not just the input.
- **Memoization Misses:** Inline filtering of `searchableNodes` happens on every render if dependencies aren't strictly stable.

## 3. Technical Strategy

### A. Algorithmic Optimization (Trie Data Structure)

Instead of linear scanning, we will pre-compute a **Trie (Prefix Tree)** for all commands and aliases.

- **Why:** Lookups become O(K) where K is the length of the typed word, independent of the number of commands.
- **Implementation:** A `useCommandTrie` hook that builds the index once (or when commands change) and offers instant lookups.

### B. React Optimization (Isolation)

- **Input Isolation:** Move `CommandInput` state into a separate, smaller component so typing doesn't re-render the `CommandList` (which is expensive).
- **Deferred Filtering:** Use `useDeferredValue` for the filtering of the list, while keeping the input and ghost text immediate. This keeps typing responsive even if list rendering lags.

### C. Usability Enhancements

- **Visual Matching:** Highlight the _matched part_ of the ghost text (e.g., user types "doc", ghost shows "**doc**umentation") to clarify why a suggestion appeared.
- **Smart Ordering:** Track "Recently Used" commands and boost their score in the Trie.
- **Fuzzy Scoring:** Integrate `cmdk`'s native scoring or a lightweight fuzzy library (like `fuzzysort`) for the list filtering, ensuring "typo-tolerance" (e.g., "wokflow" -> "Workflow").

## 4. Execution Steps

1.  [ ] **Create `PrefixTrie` Utility:** Implement a lightweight Trie class in `lib/trie.ts` tailored for command + alias mapping.
2.  [ ] **Refactor State:** Split `MindscapeCommandPalette` into `PaletteInput` and `PaletteList` to isolate render cycles.
3.  [ ] **Implement `useDeferredValue`:** Wrap the search term passed to the list component.
4.  [ ] **Add Usage History:** Persist `lastUsedCommands` in `localStorage` (or `MindscapeStore`) and use it to sort Trie results.
5.  [ ] **Visual Polish:** Ensure ghost text styling perfectly overlaps input text (font-family/size/letter-spacing consistency).
