# Generative UI Patterns

## Rules

1. **Register before render.** Initialize the GenUI component registry at app startup.
2. **Use `data-ui` parts.** Tools must return `data-ui` parts that include both `ui` and the underlying `data`.
3. **Validate and sandbox.** Validate untrusted schemas before render and wrap renders in an error boundary.
4. **Shallow trees.** Keep component depth ≤ 5.
5. **Name parity.** Schema component names must match manifest entries exactly.
6. **Prefer helpers.** Use the provided helper constructors (`create*Result`) over hand-built schemas.
7. **Capability check.** Verify the selected model supports GenUI/structured outputs before requesting schemas.
