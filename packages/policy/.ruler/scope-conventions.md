# Scope Naming Conventions

## Core Principle

Scopes follow `<domain>.<operation>` pattern. Prefix with wildcard for admin operations. Never use wildcard for granular permissions.

## Rules

1. **Scope format.** Use lowercase with colon separator: `<domain>:<operation>`. Examples: `read:notes`, `write:knowledge`, `admin:system`.

2. **Domain taxonomy.** Use domains: `notes`, `reminders`, `timers`, `bookmarks`, `knowledge`, `cognitive`, `workflows`, `voice`, `system`.

3. **Operation taxonomy.** Use operations: `read`, `write`, `delete`, `admin`. Never mix domains and operations incorrectly.

4. **Read scopes.** Pattern: `read:<domain>` or `read:*`. Grants read access to domain resources.

5. **Write scopes.** Pattern: `write:<domain>` or `write:*`. Grants write/crud access to domain resources.

6. **Admin scopes.** Pattern: `admin:<domain>` or `admin:*`. Grants elevated privileges including delete.

7. **Wildcard restrictions.** Use `:*` sparingly. Prefer explicit domain scopes. Admin scopes may use wildcard but require elevated authentication.

8. **Scope roles mapping.** Map roles to scope arrays in policy YAML. Role scopes de-duplicate during `loadPolicy`.

9. **Top-level scopes.** Define top-level `scopes` array in policy for direct mapping. Use for system-wide permissions.

## See Also

- `.ruler/03-security.md` for security expectations
- `.ruler/constraint-definitions.md` for YAML structure
