# Tool Security Patterns

Owner: Orchestrator / Assistant

## Overview

This document outlines the security and authorization patterns for ALFRED tools across the Orchestrator and Assistant domains.

## Tool Categories

### 1. Orchestrator Tools
**Examples:** `codex`, `git`, `docker`, `ticket`, `web`, `rag_ingest`, `rag_query`, `rag_list`, `rag_delete`

*   **Context:** High-risk, system-level operations.
*   **Security:** **Strictly Policy-Enforced**.
*   **Mechanism:** `requireToolScopesAndPolicy(authz, scopes, context)`
*   **Requirements:**
    *   Must accept an `authz` token in input.
    *   Must validate scopes (e.g., `droid.exec`, `repo.write`).
    *   Must consult the Policy Decision Point (PDP) for finer-grained checks (e.g., "requires biometric elevation for write operations").
*   **Pattern:**
    ```typescript
    async function enforcePolicy(input: ToolInput) {
      const { claims } = await requireToolScopesAndPolicy(
        input.authz,
        ["required.scope"],
        { action: "resource.action", resource: { ... } }
      );
      // Check for obligations (elevated, mfa, etc.)
    }
    ```

### 2. Assistant Tools
**Examples:** `note`, `remind`, `timer`, `book`, `focus`

*   **Context:** User-facing, personal context operations.
*   **Security:** **Trusted Single-User Context** (currently).
*   **Mechanism:** Direct repository calls (`assistantRepo`, `userRepo`) using `userId`.
*   **Pattern:**
    *   Inputs typically include `userId`.
    *   Operations are assumed to be authorized by virtue of the user session invoking the assistant.
    *   No explicit `requireToolScopesAndPolicy` call is currently enforced.

## Findings & Recommendations (Nov 2025 Audit)

### Findings
*   Orchestrator tools consistently enforce policies.
*   Assistant tools (`note`, `remind`, `timer`, `book`, `focus`) consistently use direct repo access without explicit policy checks.
*   This bifurcation is intentional for the current single-user architecture but presents a risk if the Assistant is ever exposed to multi-tenant or delegated contexts.

### Recommendations
1.  **Add Optional `authz` Field:** Assistant tools should add an optional `authz` field to their input schemas. This paves the way for future policy enforcement without breaking existing clients.
2.  **Migrate to Policy Checks:** Eventually, Assistant tools should also use `requireToolScopesAndPolicy` (e.g., checking `assistant.write` scope) to unify the security model.
3.  **Validate `userId` against Token:** When `authz` is present, the tool should verify that the `sub` (subject) of the token matches the `userId` in the input.

## Current Status
*   **Orchestrator:** ✅ Policy Enforced
*   **Assistant:** ⚠️ Trusted Input (Acceptable for Single-User)
