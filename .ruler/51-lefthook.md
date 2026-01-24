# Lefthook Hygiene

1. Run commits with a **clean working tree** (or stash unrelated changes) so lefthook never has to restore unstaged patches.
2. Avoid **partially staged** files that formatters touch; stage whole files or run formatting before staging.
3. Never add `oxlint-disable` suppressions unless they silence a real diagnostic; delete suppressions that don’t match.
4. Prefer repo-native discovery tools (`fd`, `rg`, `ast-grep`) over shell-specific commands.
