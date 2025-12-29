# Constraint Definition Patterns

## Core Principle

Policy constraints defined in YAML. Zod validates schema. Roles map to scopes. Rules match actions/resources/conditions.

## Rules

1. **Policy location.** Store policy file at `config/policy.yaml`. Default path exported as `DEFAULT_POLICY_PATH` from types.ts.

2. **YAML structure.** Define top-level keys: `roles` (object), `rules` (array), `scopes` (array). Roles map to `scopes` arrays.

3. **Rule schema.** Each rule requires: `id` (string), `actions` (non-empty array). Optional: `effect`, `roles`, `resource`, `conditions`, `obligations`, `description`, `priority`.

4. **Effect default.** Omitted or explicitly set `"allow"` defaults to allow. Set `effect: "deny"` for denial rules.

5. **Resource matching.** Match by `resource.kind` pattern (`"kind:*"` prefix for wildcard). Match specific IDs via `resource.ids` array.

6. **Conditions.** Use `source: "context"` (only supported source). Use `field` with dot-path. Use operators: `equals`, `notEquals`, `in`, `notIn`, `exists`, `gt`, `gte`, `lt`, `lte`.

7. **Obligation presets.** Use string presets: `"requireBio"`, `"requireManual"`, `"audit"`. Use object form: `{ type, reason, metadata? }`.

8. **Scope de-duplication.** `loadPolicy` de-duplicates scopes within roles and top-level array. Never define duplicate scopes.

## See Also

- `.ruler/policy.md` for PDP usage patterns
