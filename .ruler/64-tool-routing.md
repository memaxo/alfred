# Tool Routing and Capability Parity

## Core Principle

Capability parity requires that every backend capability is reachable by both human UI and agent tools. Tool catalogs must stay small for AI SDK hygiene (≤5 tools), requiring intent-based routing rather than monolithic tool collections.

## Rules

1. **Tool catalog size limit.** Never expose more than 5 tools to a single agent. Exceeding this degrades model performance and increases latency. Use intent-based routing to select appropriate small catalogs.

2. **Intent-based routing.** Route user requests to tool catalogs using LLM classification with schema-based output. Keep heuristics as offline fallbacks only.

3. **Capability parity enforcement.** Every capability must have either:
   - Tool coverage (via routing catalogs), or
   - Explicit `uiOnly: true` marker with rationale
     Tests must verify this parity on every build.

4. **Catalog definitions.** Tool catalogs are defined in `packages/agent/src/routing/` with:
   - `id`: Intent category identifier
   - `name`: Human-readable name
   - `description`: Purpose documentation
   - `capabilities`: Capability IDs this catalog covers
   - `tools`: The actual AI SDK Tool instances (≤5)

5. **Classification schema.** Intent routing uses Zod schema with `category`, `confidence`, and optional `reasoning` fields. Confidence thresholds determine when to prompt for clarification.

6. **Offline fallback.** When `ALFRED_CLASSIFY_OFFLINE=1`, use deterministic heuristics. Log degraded behavior and surface in UI.

7. **Catalog per intent.** Each intent category maps to exactly one catalog. Multiple intent categories may share the same underlying tools (e.g., `code_edit` and `code_review`).

## Reference Implementations

- **Routing module:** `packages/agent/src/routing/intent.ts` — Intent classification and catalog selection
- **Capability registry:** `packages/agent/src/capability.ts` — Capability definitions with uiOnly markers
- **Parity tests:** `packages/agent/test/capability-parity.test.ts` — Enforcement of tool coverage
