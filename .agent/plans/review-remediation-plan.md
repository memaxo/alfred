```md
# Review Remediation Plan – AI SDK v6 Follow-Ups

This plan tracks the remediation items R1–R6 identified during code review. Update the **Progress**, **Discoveries**, and **Decision Log** sections as work proceeds. All timestamps are UTC.

## 1. Objectives

- **R1**: Fix policy middleware default role escalation (`packages/api/src/gate.ts`).
- **R2**: Verify and stabilize RAG exports (`packages/rag/src/index.ts` and companions).
- **R3**: Align chat part guards/rendering with AI SDK v6 schema (`packages/ui/src/chat/*`).
- **R4**: Restore typed TRPC React client in web app (`apps/web/src/utils/trpc.ts`).
- **R5**: Validate payloads for HTTP SSE assistant/orchestrator endpoints (`apps/web/src/routes/api/*`).
- **R6**: Ensure workflow schema exports are available from DB package (`packages/db/src/index.ts`).

## 2. Progress

- [x] (2025-11-08 23:25Z) R1 – Adjust policy role default and add tests if needed.
- [x] (2025-11-08 23:27Z) R2 – Confirm/code fixes for RAG export surface.
- [x] (2025-11-08 23:30Z) R3 – Update chat part guards/rendering + tests.
- [x] (2025-11-08 23:32Z) R4 – Re-type TRPC client and compile.
- [x] (2025-11-08 23:34Z) R5 – Add request validation to SSE routes.
- [x] (2025-11-08 23:35Z) R6 – Export workflow schema from DB package.
- [x] (2025-11-08 23:38Z) Final smoke: `bun test`, `bun run typecheck`.

## 3. Discoveries & Notes

- Observation (2025-11-08): AI SDK’s `stepCountIs` helper returns a predicate function rather than a plain object; updated router tests to assert function presence instead of deep equality.

- Observation (2025-11-08): UIMessage schema from `@alfred/type` already enforces part structure, enabling direct reuse of the schema for SSE request validation.

## 4. Decision Log

- Decision (2025-11-08): Default policy roles to an empty array and trim user-provided values; rely on policy evaluation to reject subjects without explicit roles.
- Decision (2025-11-08): Replace wildcard exports in `@alfred/rag` with explicit named exports to guarantee tooling picks up the TypeScript sources.
- Decision (2025-11-08): Validate `/api/assistant` and `/api/orchestrator` payloads against `uiMessageSchema` and return HTTP 400 on malformed JSON or schema failures.

## 5. Validation Checklist

- `bun test`
- `bun run typecheck`
- `rg "@mastra/" --hidden --glob '!.git/*' --glob '!node_modules/*'` (sanity)
- Manual: curl `/api/assistant` & `/api/orchestrator` with minimal payloads to confirm validation + streaming.
```
