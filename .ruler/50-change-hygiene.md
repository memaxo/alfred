# Change Hygiene

1. Before committing, ensure there are **no unstaged changes** in files that auto-formatters may rewrite; stash or commit unrelated work first.
2. Prefer **single-purpose commits** (feature vs docs vs formatting) to avoid hook conflicts and review ambiguity.
3. When adding a new window type, update both the `WindowType` union and `WINDOW_DEFAULTS` so typecheck remains exhaustive.
4. Do not assume `Date` survives JSON boundaries; treat timestamps as strings/numbers and parse explicitly at the edge.
