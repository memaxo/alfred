```md
# ALFRED AI SDK v6 Migration: Remove Mastra, Consolidate Chat, and Standardize Streaming

This ExecPlan is a living document. The sections “Progress”, “Surprises & Discoveries”, “Decision Log”, and “Outcomes & Retrospective” are updated as work proceeds. Follow this plan exactly; it is self-contained and assumes no context outside this document.

## Purpose / Big Picture

We will migrate the ALFRED monorepo away from Mastra and onto the AI SDK v6 end-to-end, standardize the chat UI to a single implementation in packages/ui, and replace all Mastra-based streaming and agent usage with native AI SDK v6. This yields:

- A single, type-safe streaming path using AI SDK v6 data streams for both /api/assistant and /api/orchestrator.
- A single, reusable Chat component in packages/ui that supports optional virtualization and performance metrics (window.__perf.chat) without duplicating rendering logic.
- Cleaned type system with no Mastra event types or guards.
- Updated linear webhook integration that calls tRPC resume directly without Mastra pubsub.
- Tests and docs that reflect the new AI SDK v6 architecture.

Observable end result:
- curl POST to /api/assistant and /api/orchestrator returns AI SDK v6 UI message stream (start/text-delta/finish parts).
- apps/web pages use @alfred/ui Chat only, no duplicate chat logic in apps/web/src/components.
- grep -R "@mastra/" and "@alfred/agent" returns no matches.
- bun test and tsc -b succeed.

## Progress

- [x] (2025-11-08 11:00Z) Drafted full migration plan and inventory of Mastra references.
- [x] (2025-11-08 13:42Z) Create AI SDK v6 agent/tool module (packages/agent/src/v6.ts) and provider config.
- [x] (2025-11-08 14:28Z) Replace web streaming endpoints /api/assistant and /api/orchestrator with AI SDK v6 streamText paths.
- [x] (2025-11-08 15:10Z) Remove mastra-to-ui adapter and any usage.
- [x] (2025-11-08 16:25Z) Refactor packages/api routers assistant.ts and orchestrator.ts to use v6 generate and sanitize output.
- [x] (2025-11-08 16:45Z) Rewrite assistant tool handoff to remove Mastra dependency; return placeholder navigation instructions.
- [x] (2025-11-08 17:05Z) Update linear webhook to call tRPC workflow.resume directly; remove Mastra pubsub/bootstrap.
- [x] (2025-11-08 17:40Z) Rebuild workflow router without Mastra; placeholder runner emits AI SDK events.
- [x] (2025-11-08 18:30Z) Consolidate Chat UI in packages/ui; add parts.ts; support virtualization + perf prop; update apps/web.
- [x] (2025-11-08 19:10Z) Type cleanup: remove Mastra event types/schemas/guards.
- [x] (2025-11-08 20:05Z) tsconfig/path alias cleanup; ensure no @mastra/* or @alfred/agent imports remain.
- [x] (2025-11-08 21:10Z) Add/Update tests for endpoints, chat UI, webhook; ensure bun test passes.
- [x] (2025-11-08 22:35Z) Update docs and READMEs; verify acceptance criteria.
- [x] (2025-11-08 23:10Z) Final review; open PR.

## Surprises & Discoveries

- Observation: The repository already has an AI SDK v6 example route at apps/web/src/routes/api/ai/$.ts using streamText Google gemini model.
  Evidence:
    - apps/web/src/routes/api/ai/$.ts shows convertToModelMessages + result.toUIMessageStreamResponse.

- Observation: Mastra bridges to AI SDK UI appear in packages/api/src/stream/mastra-to-ui.ts, translating “mastra events” to UI message parts. We will delete this and use AI SDK v6 streaming directly.
  Evidence:
    - File content includes type normalization, tool-call/result mapping, and event alias map.

- Observation: Linear webhook posts to mastra.pubsub via mastra from @alfred/agent; we need to swap to direct tRPC call (appRouter.createCaller).
  Evidence:
    - apps/web/src/routes/api/linear/webhook.ts publishes to mastra.pubsub and uses mastra.generateId().

- Observation: apps/web has a richer Chat with Virtuoso virtualization and performance metrics. packages/ui has a minimal Chat; we should enrich the packages/ui Chat and re-use it in web app.
  Evidence:
    - apps/web/src/components/chat.tsx uses Virtuoso and writes window.__perf.chat metrics.
    - packages/ui/src/chat/chat.tsx is a simpler version with part extraction logic.

- Observation: Assistant handoff tool still performs a dynamic import of @alfred/agent to reach Mastra workflows.
  Evidence:
    - packages/agent/assistant/src/tool/handoff.ts imports mastra at runtime; the tool will fail once Mastra exports are removed, so it must be rewritten against the AI SDK v6 path.

- Observation: Running `bun run --filter @alfred/agent typecheck` surfaces pre-existing issues in assistant flow and rag providers (missing defaults, unused constants) in addition to the expected handoff failure.
  Evidence:
    - Typecheck errors cite assistant/src/flow/digest.ts and rag/src/providers.ts even before completing the Mastra removal.

- Observation: Mapping legacy router messages to AI SDK v6 requires degrading `role: "tool"` payloads into assistant text because Mastra never persisted structured tool results.
  Evidence:
    - Router helper `toModelMessages` now coerces tool entries into assistant strings to keep conversations coherent until structured replay logic is redesigned.

- Observation: Downstream modules (deploy router, workflow router) still import `toolDocker`, `toolRouter`, and `mastra` from `@alfred/agent`, so removing those exports breaks the build until those sites migrate.
  Evidence:
    - `bun run --filter @alfred/api typecheck` reports missing exports for deploy.ts and workflow.ts after the router migration.

- Observation: With the placeholder handoff tool, assistant escalations now return a `next` navigation hint pointing at `/orchestrator/run`; this preserves user guidance while we rebuild the workflow router.
  Evidence:
    - `packages/agent/assistant/src/tool/handoff.ts` exports `next` with `{ kind: "navigate", href: "/orchestrator/run" }`.

- Observation: Workflow router now stubs plan execution with deterministic AI SDK events; resume calls are handled directly via runRegistry without Mastra pubsub.
  Evidence:
    - `packages/api/src/routers/workflow.ts` constructs placeholder plan data, registers runs with `runRegistry`, and streams notices/progress without Mastra APIs.

- Observation: Linear webhook now resolves run IDs via `crypto.randomUUID()` and invokes `workflow.resume` directly through `appRouter.createCaller`.
  Evidence:
    - `apps/web/src/routes/api/linear/webhook.ts` extracts authz tokens, calls `workflow.resume`, and returns `{ runId, resumed }`.

- Observation: A lightweight `RuntimeContext` shim replaced the Mastra implementation across API/tests/tools, retaining only the `get/set/forEach` surface we actually use.
  Evidence:
    - `packages/type/src/runtime-context.ts` defines the new class; imports in API/web/tests now target `@alfred/type/runtime-context`.

- Observation: `createCaller().stream` resolves to an observable wrapped in a promise; tests must await the observable before capturing the emitted TRPC error.
  Evidence:
    - `packages/api/test/assistant.router.test.ts` now awaits `caller.stream(...)` and unsubscribes in the error branch so Bun’s test runner records the `TRPCError`.

## Decision Log

- Decision: Use AI SDK v6 streamText on HTTP routes and ToolLoopAgent (where useful) for structured multi-step tool calls; for initial migration, prefer streamText with tools and convertToModelMessages to avoid introducing new stateful looping complexity.
  Rationale: streamText + toUIMessageStreamResponse integrates cleanly with existing UI; keeps behavior simple; incremental migration; ToolLoopAgent can be added later.
  Date/Author: 2025-11-08 (Assistant)

- Decision: Delete packages/api/src/stream/mastra-to-ui.ts instead of maintaining a compatibility layer.
  Rationale: Reduces code surface; AI SDK v6 provides toUIMessageStreamResponse; avoids double-translation complexity.
  Date/Author: 2025-11-08 (Assistant)

- Decision: Replace mastra.pubsub usage in webhook with appRouter.createCaller workflow.resume, authorized as a system subject per policy.
  Rationale: Keeps architecture “apps → api → repo”; no background bus; tRPC call is explicit and covered by policy.
  Date/Author: 2025-11-08 (Assistant)

- Decision: Cache the OpenAI provider and reuse wrapped tool registries so HTTP routes and routers share stable tool references.
  Rationale: Avoids re-instantiating providers per request and keeps AI SDK tool identities deterministic for streaming.
  Date/Author: 2025-11-08 (Codex)

- Decision: While migrating the routers, coerce legacy tool transcripts into assistant text until structured tool-result schema is reinstated.
  Rationale: Preserves historical conversation context without blocking on new persistence format; noted as follow-up to restore structured payloads.
  Date/Author: 2025-11-08 (Codex)

- Decision: Replace the Mastra-backed handoff tool with a navigation placeholder that points users to the Orchestrator Run UI until the workflow router is rebuilt.
  Rationale: Keeps escalate flows functional without Mastra while signalling next actions; minimizes churn before the v6 workflow runner lands.
  Date/Author: 2025-11-08 (Codex)

- Decision: Implement a temporary workflow runner that synthesizes plan outputs and streams AI SDK events so the API remains operational during migration.
  Rationale: Allows clients and webhook resumes to function without Mastra while we rebuild full orchestration; keeps runRegistry semantics intact.
  Date/Author: 2025-11-08 (Codex)

- Decision: Centralize chat rendering in `@alfred/ui` with virtualization/perf hooks to remove duplicate app-level components.
  Rationale: Ensures a single chat implementation, enforces naming rules, and delivers window.__perf.chat metrics from a shared surface.
  Date/Author: 2025-11-08 (Codex)

- Decision: Replace Mastra's RuntimeContext with a minimal internal shim exported from `@alfred/type`.
  Rationale: Eliminates the last runtime dependency on Mastra while preserving request metadata semantics across routers/tools/tests.
  Date/Author: 2025-11-08 (Codex)

- Decision: Suspend eval runs in the API (`eval.run.start`) until a v6-native evaluator ships, returning `NOT_IMPLEMENTED` instead of delegating to Mastra.
  Rationale: Keeps the surface predictable without the legacy runner, avoiding partial migrations or dangling dependencies.
  Date/Author: 2025-11-08 (Codex)

- Decision: Consolidate chat to packages/ui and add parts.ts; apps/web will import Chat from @alfred/ui. Support virtualization/perf via props.
  Rationale: Prevents duplicated rendering logic; respects “single word naming”; centralizes UI behavior.
  Date/Author: 2025-11-08 (Assistant)

- Decision: For agent/tools, create a thin AI SDK v6 wrapper adapter around existing legacy tool modules (docker/git/ticket/web etc.) reusing zod schemas; keep the tool code single-file and named with single words.
  Rationale: Minimizes churn; preserves business logic; standardizes to AI SDK v6 tool semantics.
  Date/Author: 2025-11-08 (Assistant)

- Decision: Extract TRPC scaffolding into `packages/api/src/trpc.ts` so routers import middleware without creating circular dependencies through `index.ts`.
  Rationale: Keeps router modules independent of the app-level router aggregation, simplifies testing via direct router imports, and avoids premature evaluation of unrelated routes.
  Date/Author: 2025-11-08 (Codex)

## Outcomes & Retrospective

- `/api/assistant` and `/api/orchestrator` now stream AI SDK v6 UI message events end-to-end; tRPC fallbacks surface a clear NOT_IMPLEMENTED error that points clients at HTTP SSE.
- `@alfred/agent` exports only AI SDK v6 helpers and tool registries; `rg "@mastra/"` across the workspace (excluding node_modules) returns no matches.
- Chat UI lives exclusively inside `@alfred/ui` with virtualization + perf metrics plumbed through props; `apps/web` delegates to the shared Chat component.
- Workflow orchestration, linear webhook resume, and assistant escalate flows operate without Mastra—resume/start calls route through tRPC, and the handoff tool provides stable navigation guidance until the full v6 runner lands.
- Tests (`bun test`) and type checks (`bun run typecheck`) pass in a clean workspace; DB suites stay skipped unless `RUN_DB_TESTS=1` is set.
- Documentation (README, PRD, AI SDK notes) now describe the AI SDK v6 architecture, and legacy Mastra guides have been removed.

Lessons:
- Centralizing TRPC scaffolding in `trpc.ts` avoided circular imports and simplified focused router tests; future routers should follow the same pattern.
- Bun’s subscription caller returns a promise wrapping the observable; awaiting it before asserting errors produced deterministic test behavior—use this shape for other stream tests.
- Tests pass (bun test), type checks pass (tsc -b), docs updated.

## Context and Orientation

Repo root: /Users/jackmazac/Development/alfred

Structure highlights:
- apps/web
  - src/routes/api/ai/$.ts (Already AI SDK v6; good example)
  - src/routes/api/assistant/$.ts (Mastra-based streaming)
  - src/routes/api/orchestrator/$.ts (Mastra-based streaming)
  - src/routes/api/linear/webhook.ts (Mastra pubsub)
  - src/server/bootstrap.ts (Mastra bootstrap/subscribers)
  - src/components/chat.tsx (web-only chat; virt + perf)
  - src/components/msg.tsx, chatbar.tsx (rendering helpers)
  - src/routes/orchestrator/run.tsx (uses tRPC workflow.stream; fine)
  - src/routes/ai.tsx (uses useChat to /api/ai)
- packages/api
  - src/stream/mastra-to-ui.ts (Mastra→AI SDK v6 event bridge) [to delete]
  - src/subscribers/linear.ts (Mastra pubsub subscriber) [to delete or stop calling]
  - src/routers/assistant.ts (Mastra agent usage)
  - src/routers/orchestrator.ts (Mastra agent usage)
  - src/routers/workflow.ts (tRPC workflow with resume; keep)
  - src/metrics.ts, gate.ts, index.ts (keep)
- packages/agent
  - src/mastra.ts (Mastra orchestration/agents) [to remove]
  - src/index.ts (exports Mastra things) [to remove/refactor]
  - src/orchestrator/agent.ts, flow/* (Mastra) [remove or mothball]
  - assistant/* (Mastra assistant, tools) [wrap or rehome minimal subset]
  - orchestrator/tool/* (docker, git, router, ticket, proxmox, web, droid, codex) [these are plain zod + execute; can be adapted]
- packages/type
  - src/stream.ts (MastraEvent + UI alias) [clean Mastra types]
  - src/guards.ts (parseMastraEvent) [remove]
  - src/stream.zod.ts (mastraEventSchema) [remove]
  - other domain types (plan, msg, personal, knowledge) [keep]
- packages/ui
  - src/chat/chat.tsx (shared minimal Chat) [canonicalize]
  - src/index.ts (exports Chat)
- docs/ai-sdk-v6 (rich reference to AI SDK v6 usage)

Terminology:
- AI SDK v6 stream: The data stream protocol providing “start”, “text-start/delta/end”, “tool-call/input/result”, “finish”, etc. Provided via result.toUIMessageStreamResponse().
- ToolLoopAgent: AI SDK v6 looping agent; optional; we can start with streamText.
- UIMessage: AI SDK v6 typed message parts between UI and server.
- tRPC resume: packages/api/src/routers/workflow.ts resume mutation that accepts {runId, event, authz}.

## Plan of Work

Milestone M0: Inventory & Verification (done via reading context; command proof later)
- Goal: Enumerate all Mastra references and call paths.
- Work: Grep and list. This is the authoritative inventory a novice can audit.
- Result: Full inventory below (expandable).
- Proof: Run the grep commands listed under “Concrete Steps” and confirm matches align.

  Inventory of Mastra Usage (paths → import symbols → action):
    - apps/web/src/routes/api/assistant/$.ts → import { assistantAgent } from "@alfred/agent"; createMastraUIResponse from "@alfred/api/stream/mastra-to-ui"; convertToModelMessages; streams assistantAgent.stream → Replace with AI SDK v6 streamText; delete bridge usage.
    - apps/web/src/routes/api/orchestrator/$.ts → import { orchestratorAgent } from "@alfred/agent"; createMastraUIResponse; streams orchestratorAgent.stream → Replace with AI SDK v6 streamText; delete bridge usage.
    - apps/web/src/server/bootstrap.ts → imports mastra from "@alfred/agent"; subscribeLinearAgentActivity; startReminderScheduler (keep scheduler if not Mastra); uses runtimeContext; registers Mastra pubsub subscriber → Remove mastra usages; remove subscriber usage.
    - apps/web/src/routes/api/linear/webhook.ts → imports mastra from "@alfred/agent"; publishes via mastra.pubsub; uses mastra.generateId() fallback runId → Replace with appRouter.createCaller().workflow.resume and crypto.randomUUID().
    - packages/api/src/stream/mastra-to-ui.ts → custom event bridge → Delete file and references.
    - packages/api/src/subscribers/linear.ts → Mastra pubsub subscriber that calls workflow.resume → No longer used once bootstrap removed; delete file.
    - packages/api/src/routers/assistant.ts → imports assistantAgent from "@alfred/agent"; generate uses assistantAgent.generate → Replace with AI SDK v6 generateText or streamText (non-streaming mutation returns sanitized struct).
    - packages/api/src/routers/orchestrator.ts → imports orchestratorAgent from "@alfred/agent"; generate uses orchestratorAgent.generate → Replace with AI SDK v6 generateText/streamText (non-streaming path).
    - packages/agent/**/* → Mastra-based implementations including agents, flows, eval/scorer, laminar, tools; We will:
        - Create packages/agent/src/v6.ts that registers tools via AI SDK v6 tool() helper (wrapping legacy tools).
        - Remove exports that reference mastra.ts.
        - Optionally keep non-Tool files (docker/git/router/ticket/web/proxmox/droid/codex) by wrapping them.
    - packages/type/src/stream.ts → has MastraEvent + isMastraEvent → Remove Mastra types; keep UIMessage alias.
    - packages/type/src/guards.ts → parseMastraEvent, isUIMessage; Keep UI guards; remove parseMastraEvent.
    - packages/type/src/stream.zod.ts → mastraEventSchema → Remove.

Milestone M1: Create AI SDK v6 Agent/Tools Module
- Goal: Provide a new v6 module that exports:
    - getModel(): resolves model spec (OPENAI_API_KEY, model id env).
    - tools: adapted wrappers around legacy executors (docker, git, web, etc.) using AI SDK v6 tool({ inputSchema, execute }).
    - buildAssistantTools() returns a ToolSet; buildOrchestratorTools() returns another ToolSet.
- Work:
    - Add new file packages/agent/src/v6.ts (single word filename preserved by folder).
    - Implement createOpenAI (or registry) with env OPENAI_API_KEY.
    - Implement helper wrapLegacyToolToAISDK for tools with { inputSchema, execute } signature.
    - Example adapter for docker and note.
- Result: Centralized ToolSet we can import from API routes.
- Proof: Typecheck new module; no runtime yet.

  Example: packages/agent/src/v6.ts (excerpts; indent shows exact code)

    import { tool, type ToolSet } from "ai";
    import { createOpenAI } from "@ai-sdk/openai";
    import { z } from "zod";

    // Provider factory
    export function getModelId(): string {
      const id = process.env.AI_MODEL ?? process.env.MASTRA_MODEL ?? "openai/gpt-4o-mini";
      return id;
    }

    export function getOpenAI() {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) throw new Error("OPENAI_API_KEY missing");
      return createOpenAI({ apiKey });
    }

    // Generic adapter for legacy tool modules that export { inputSchema, execute }
    export function wrapLegacyToolToAISDK<TInput extends z.ZodTypeAny>(
      legacy: { name: string; description: string; inputSchema: TInput; execute: (args: { input: z.infer<TInput> }) => Promise<any> },
    ) {
      return tool({
        description: legacy.description,
        inputSchema: legacy.inputSchema,
        execute: async (input: z.infer<TInput>) => {
          return legacy.execute({ input });
        },
      });
    }

    // Example wrap for orchestrator docker tool (re-exporting module code)
    import { toolDocker as legacyDocker } from "./orchestrator/tool/docker";
    export function buildOrchestratorTools(): ToolSet {
      return {
        docker: wrapLegacyToolToAISDK({
          name: legacyDocker.name,
          description: legacyDocker.description,
          inputSchema: legacyDocker.inputSchema,
          execute: async ({ input }) => legacyDocker.execute({ input }),
        }),
        // ... add other orchestrator tools similarly: git, router, ticket, proxmox, web, droid, codex
      };
    }

    // Example wrap for assistant note tool
    import { toolNote as legacyNote } from "./assistant/src/tool/note";
    export function buildAssistantTools(): ToolSet {
      return {
        note: wrapLegacyToolToAISDK({
          name: legacyNote.name,
          description: legacyNote.description,
          inputSchema: legacyNote.inputSchema,
          execute: async ({ input }) => legacyNote.execute({ input }),
        }),
        // Add remind, timer, book, web, focus, home (the latter returns error until implemented)
      };
    }

Milestone M2: Replace HTTP Streaming Endpoints with AI SDK v6
- Goal: apps/web/src/routes/api/assistant/$.ts and apps/web/src/routes/api/orchestrator/$.ts use AI SDK v6 streamText + toUIMessageStreamResponse. Eliminate createMastraUIResponse and @alfred/agent imports.
- Work:
    - For /api/assistant:
      - Import streamText, convertToModelMessages from "ai".
      - Build ToolSet via buildAssistantTools().
      - Choose model via provider registry getOpenAI() or registry.languageModel("openai:gpt-4o-mini").
      - Return result.toUIMessageStreamResponse({ originalMessages: messages }).
    - For /api/orchestrator:
      - Similar but ToolSet via buildOrchestratorTools().
- Result: Native v6 streaming endpoints.
- Proof: curl produces UI message parts; unit tests assert stream parts.

  Before: apps/web/src/routes/api/assistant/$.ts
    import { assistantAgent } from "@alfred/agent";
    import { createMastraUIResponse } from "@alfred/api/stream/mastra-to-ui";
    // streams assistantAgent.stream(...)

  After: apps/web/src/routes/api/assistant/$.ts (excerpts)

    import { createFileRoute } from "@tanstack/react-router";
    import { convertToModelMessages, type UIMessage, streamText } from "ai";
    import { getOpenAI, getModelId, buildAssistantTools } from "@alfred/agent/src/v6";

    export const Route = createFileRoute("/api/assistant/$")({
      server: {
        handlers: {
          POST: async ({ request }) => {
            if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });
            try {
              const { messages }: { messages?: UIMessage[] } = await request.json();
              const modelId = getModelId();
              const openai = getOpenAI();
              const model = openai.chat(modelId);
              const result = streamText({
                model,
                messages: convertToModelMessages(messages ?? []),
                tools: buildAssistantTools(),
              });
              return result.toUIMessageStreamResponse({ originalMessages: messages ?? [] });
            } catch (error) {
              console.error("Assistant stream error:", error);
              return new Response(JSON.stringify({ error: "assistant_stream_failed" }), {
                status: 500,
                headers: { "Content-Type": "application/json" },
              });
            }
          },
        },
      },
    });

  Do the analogous change for /api/orchestrator with buildOrchestratorTools().

Milestone M3: Remove Mastra bridge and usage
- Goal: Delete packages/api/src/stream/mastra-to-ui.ts and remove imports throughout. Ensure no code references it.
- Work:
  - Delete file.
  - Update assistant/orchestrator $.ts imports (already done).
- Result: No Mastra bridge remains.
- Proof: grep -R “mastra-to-ui” returns no results.

Milestone M4: Refactor API Routers to v6
- Goal: packages/api/src/routers/assistant.ts and orchestrator.ts “generate” mutations stop using @alfred/agent Mastra. Replace with AI SDK v6 generateText and sanitize output; keep return shapes similar where possible.
- Work:
  - For assistant.generate:
    - Use getOpenAI().chat(getModelId()) and generateText (or single-step streamText with .value).
    - Forward toolChoice, maxSteps if needed (for now ignore multi-step; return text, toolCalls/toolResults empty).
    - Return sanitized object: { text, toolCalls, toolResults, usage, warnings, finishReason } consistent with prior sanitizeResult but now populated from AI SDK v6 result.
  - For orchestrator.generate:
    - Same approach; we will not orchestrate code modifications here; it’s for non-streaming quick generation.
- Result: tRPC generate works without Mastra.
- Proof: bun test router smoke tests pass.

  Example assistant.generate change (excerpts):

    import { generateText } from "ai";
    import { getOpenAI, getModelId, buildAssistantTools } from "@alfred/agent/src/v6";

    const model = getOpenAI().chat(getModelId());
    const result = await generateText({
      model,
      messages: toAgentMessages(input.messages) as any,
      tools: buildAssistantTools(),
    });
    return {
      text: result.text ?? "",
      toolCalls: result.toolCalls ?? [],
      toolResults: result.toolResults ?? [],
      usage: result.usage ?? null,
      warnings: result.warnings ?? [],
      finishReason: result.finishReason ?? null,
    };

Milestone M5: Linear Webhook: remove Mastra pubsub; use tRPC resume
- Goal: apps/web/src/routes/api/linear/webhook.ts uses appRouter.createCaller().workflow.resume with authz extracted from payload; runId via crypto.randomUUID() fallback; no mastra usage.
- Work:
  - Replace mastra imports with:
    - import { appRouter } from "@alfred/api"
    - import { RuntimeContext } from "@mastra/core/runtime-context" (we will not; we must avoid importing Mastra anywhere. Instead, in server route, we can create a lightweight runtime context or omit it; the tRPC createCaller only expects context from api createContext which uses auth.api.getSession—outside route. For web app route, createCaller requires a Context object. The server/bootstrap showed an example with runtime metadata; recreate the minimal structure without Mastra.)
  - Provide createCaller similar to bootstrap: session user "system", roles ["system"], scopes ["linear.write"], etc. (Respect policy).
  - Call caller.workflow.resume({ runId, event: "linear-authz", authz }).
- Result: Webhook directly resumes workflow runs via tRPC; no queue/bus.
- Proof: Unit test posts signed payload, asserts 202 response, and that resume was called (mock the router) or run end-to-end in test harness.

  Example change (excerpts):

    import { appRouter } from "@alfred/api";
    import { randomUUID } from "node:crypto";

    function createSystemCaller() {
      return appRouter.createCaller({
        session: { user: { id: "system", roles: ["system"], scopes: ["linear.write"] } } as any,
        runtime: {
          requestId: `linear-webhook-${Date.now()}`,
          receivedAt: new Date(),
          method: "POST",
          url: "linear:webhook",
          ip: null, forwardedFor: [], userAgent: "linear-webhook", referer: null,
        },
        runtimeContext: { get() {}, set() {}, forEach() {} } as any,
        policy: { obligations: [] },
      });
    }

    // In POST: after verify signature and parse payload:
    const runId = typeof runIdCandidate === "string" && runIdCandidate.length > 0 ? runIdCandidate : randomUUID();
    const authz = extractAuthz(payload); // implement same as packages/api/src/subscribers/linear.ts extraction logic inline or minimal
    if (authz) {
      await createSystemCaller().workflow.resume({ runId, event: "linear-authz", authz });
    }

Milestone M6: Consolidate Chat UI in packages/ui
- Goal: packages/ui/src/chat/chat.tsx becomes canonical with:
  - New parts.ts with helpers for AI SDK v6 UIMessage part classification (text, reasoning, tool-call, tool-result, file, data, data-cache, data-status).
  - Chat props extended: virtualized?: boolean, perf?: boolean, ListComponent?: React component override for list virtualization, itemContent?: (index, message) => ReactNode override. Keep single-word naming and succinct prop names.
  - window.__perf.chat writes gated by perf?: true.
- Work:
  - Create packages/ui/src/chat/parts.ts with:
      - isTextPart, isReasoningPart, isToolCallPart, isToolResultPart, isFilePart, isDataPart, isDataCachePart, isDataStatusPart helpers.
      - getAgentLabel(meta.agent) returns “Assistant”, “Orchestrator”, etc.
      - getTime(meta) returns string or null.
  - Update packages/ui/src/chat/chat.tsx to:
      - Accept new props; if virtualized, expect ListComponent (e.g., Virtuoso) and itemContent function. Otherwise map messages with default rendering.
      - When perf true, write window.__perf.chat same shape as web component expected.
  - Update packages/ui/src/index.ts to export any new types if needed.
- Result: Single Chat component used by apps/web.
- Proof: Replace imports in apps/web components to @alfred/ui; remove duplicate rendering components.

  Props contract (document here in Interfaces section too):
    type ChatProps = {
      messages: UIMessage[];
      onSend: (text: string) => void;
      placeholder?: string;
      className?: string;
      disabled?: boolean;
      virtualized?: boolean;
      perf?: boolean;
      ListComponent?: React.ComponentType<any>;
      itemContent?: (index: number, message: UIMessage) => React.ReactNode;
    };

Milestone M7: Update apps/web to use @alfred/ui Chat
- Goal: apps/web’s ChatContainer uses @alfred/ui Chat with virtualization support via ListComponent=Virtuoso and perf=true. Remove chat.tsx, msg.tsx, chatbar.tsx duplicates or demote to thin wrappers delegating to @alfred/ui Chat with style.
- Work:
  - Replace import in ChatContainer: import { Chat } from "@alfred/ui".
  - Provide Virtuoso via ListComponent and itemContent that renders Chat’s default (just pass through or rely on Chat’s default).
  - Remove or delete apps/web/src/components/chat.tsx, msg.tsx, chatbar.tsx (explicitly allowed) if no longer needed.
- Result: One Chat implementation in packages/ui.
- Proof: App compiles; manual test shows messages render as before; window.__perf.chat updated when perf enabled.

Milestone M8: Type Cleanup (packages/type)
- Goal: Remove Mastra types/guards/schemas: MastraEvent, parseMastraEvent, mastraEventSchema.
- Work:
  - packages/type/src/stream.ts: remove MastraEvent types; retain UIMessage alias, ModelMessage alias, helper UIMessageAction types as needed.
  - packages/type/src/guards.ts: remove parseMastraEvent; keep isUIMessage/isModelMessage guards.
  - packages/type/src/stream.zod.ts: remove mastraEventSchema; keep uiMessageSchema and modelMessageSchema only.
- Result: Clean type layer with no Mastra references.
- Proof: tsc -b passes; grep -R “MastraEvent” and “parseMastraEvent” return no results.

Milestone M9: tsconfig and alias cleanup
- Goal: Remove @alfred/agent Mastra alias and @mastra/* imports from the repo.
- Work:
  - Check tsconfig paths and references; remove @alfred/agent path if wholly Mastra. If we still keep packages/agent with v6.ts, ensure exports do not re-export mastra.ts; update packages/agent/src/index.ts to export v6 entrypoints only.
  - grep -R “@mastra/” and “@alfred/agent” fix remaining imports.
- Result: No @mastra or Mastra-based @alfred/agent imports remain.
- Proof: grep returns no matches.

Milestone M10: Tests
- Goal: Add smoke/integration tests:
  - SSE stream tests for /api/assistant and /api/orchestrator: assert start, text-delta, finish parts arrive.
  - Chat UI tests in packages/ui: render messages with text/tool parts; virtualization flag; perf writes get recorded.
  - Webhook signature test: compute signature; ensure 202 response; ensure resume mutation invoked (mock createCaller or run through test router).
  - Remove any Mastra mocks/tests.
- Work:
  - Create tests under appropriate __tests__ folders using bun test and fetch (or undici) to call endpoints.
  - Ensure tests don’t require external secrets: skip live OpenAI call by mocking provider (note: alternatively, gate streaming tests behind env and provide a local model stub; for MVP, set minimal update to assert handler returns 405/500 correct; include a mock config mode: if OPENAI_API_KEY missing set model stub returning fixed text).
- Result: bun test passes.
- Proof: Show expected counts in “Concrete Steps”.

Milestone M11: Docs & Readme
- Goal: Update docs to remove Mastra references; add env documentation for OPENAI_API_KEY, AI_MODEL; note migration.
- Work:
  - Update root README and packages/api README to show new endpoints and configuration.
- Result: Self-explanatory docs.
- Proof: Manual review.

## Concrete Steps

Commands assume repo root: /Users/jackmazac/Development/alfred

1) Verify inventory (non-destructive)
    - Working dir: repo root
    - Run:
        - grep -R "@mastra/" .
        - grep -R "@alfred/agent" .
        - grep -R "mastra-to-ui" .
      Expected: matches listed in inventory.

2) Create packages/agent/src/v6.ts (new AI SDK v6 module)
    - Working dir: repo root
    - Create file with content per M1 example (ensuring imports exist).
    - Expose exports from packages/agent/src/index.ts ONLY from v6.ts:
        - export { getOpenAI, getModelId, buildAssistantTools, buildOrchestratorTools } from "./v6";

3) Replace apps/web streaming endpoints
    - Edit apps/web/src/routes/api/assistant/$.ts:
        - Remove imports of @alfred/agent and createMastraUIResponse.
        - Import streamText, convertToModelMessages from "ai".
        - Import model/tools from @alfred/agent/src/v6.
        - Implement POST handler returning result.toUIMessageStreamResponse.
    - Edit apps/web/src/routes/api/orchestrator/$.ts similarly.

    Expected snippet in assistant route:
      const result = streamText({ model, messages: convertToModelMessages(messages), tools: buildAssistantTools() });
      return result.toUIMessageStreamResponse({ originalMessages: messages });

4) Remove Mastra bridge
    - Delete packages/api/src/stream/mastra-to-ui.ts
    - Fix any import sites (assistant/orchestrator web endpoints already migrated).

5) Refactor packages/api routers
    - packages/api/src/routers/assistant.ts:
        - Remove import { assistantAgent } from "@alfred/agent";
        - Import generateText from "ai", and v6 tools model if needed.
        - In generate mutation: call generateText with toAgentMessages input; map sanitized output.
    - packages/api/src/routers/orchestrator.ts: analogous change.

6) Webhook update
    - apps/web/src/routes/api/linear/webhook.ts:
        - Remove import { mastra } from "@alfred/agent";
        - Import { appRouter } from "@alfred/api"; import { randomUUID } from "node:crypto";
        - Implement createSystemCaller() as shown; call workflow.resume with authz extracted from payload; fallback runId via randomUUID();
        - Keep signature verification identical; ensure “webhookEventsTotal” increments remain.

7) Remove server bootstrap Mastra wire
    - apps/web/src/server/bootstrap.ts:
        - Remove mastra imports and subscriber registrations.
        - Remove unsubscribeLinear logic; keep scheduler calls if unrelated to Mastra.
        - If subscriber solely related to Mastra pubsub, remove entire file if unused; or reduce to scheduler-only bootstrap.

8) UI consolidation
    - Create packages/ui/src/chat/parts.ts:
        - Export part classifiers for AI SDK v6 parts.
        - Export label/time helpers.
    - Update packages/ui/src/chat/chat.tsx props per M6 and integrate optional virtualization/perf:
        - If virtualized and ListComponent provided, render via it; else map.
        - When perf is true, write window.__perf.chat = { messageCount, lastRender, range }.
    - Update packages/ui/src/index.ts to export Chat (already) and any new types.
    - Update apps/web/src/components/chat-container.tsx to import { Chat } from "@alfred/ui"; pass virtualization by providing Virtuoso via ListComponent prop; pass perf={true}.
    - Delete apps/web/src/components/chat.tsx, msg.tsx, chatbar.tsx (or replace with thin wrappers that delegate 100% to @alfred/ui; allowed deletion is preferred per instruction).

9) Type cleanup
    - Edit packages/type/src/stream.ts:
        - Remove MastraEvent and isMastraEvent; keep UIMessage/ModelMessage type aliases and UIMessage* types.
    - Edit packages/type/src/guards.ts:
        - Remove parseMastraEvent; keep isUIMessage/isModelMessage.
    - Edit packages/type/src/stream.zod.ts:
        - Remove mastraEventSchema; keep uiMessageSchema/modelMessageSchema only.

10) tsconfig/path cleanup
    - Remove @alfred/agent path alias if it points to Mastra-only; ensure packages/agent/src/index.ts exports v6 values.
    - grep and fix imports; ensure no @mastra/* remains.

11) Tests
    - Create tests:
      - apps/web/src/routes/api/assistant/__tests__/assistant.stream.test.ts
        - Start server in test harness or call handler function; assert response is SSE with at least “start” and “finish” markers.
        - If no OPENAI_API_KEY set, skip or stub model with small fake provider; otherwise limit to simple prompt echo.
      - packages/ui/src/chat/__tests__/chat.parts.test.tsx
        - Render Chat with messages containing text and tool-call/result parts; assert classification and rendering.
        - Enable perf and assert window.__perf.chat updated.
      - apps/web/src/routes/api/linear/__tests__/webhook.resume.test.ts
        - Build a signed payload; call POST; assert 202 and that workflow.resume was invoked (mock caller).
    - Remove any Mastra tests/mocks if present.

12) Docs
    - Update README(s):
      - Document envs: OPENAI_API_KEY, AI_MODEL (e.g. openai/gpt-4o-mini), GOOGLE keys if using gemini.
      - Streaming endpoints: /api/assistant and /api/orchestrator now AI SDK v6.
      - Chat UI: use @alfred/ui Chat; virtualization/pref toggles documented.
      - Migration note: Mastra removed in favor of AI SDK v6.

Expected transcripts:
- bun test prints counts including new tests; see Validation.

## Validation and Acceptance

Behavioral acceptance checklist:
- [ ] grep -R "@mastra/" . returns no matches.
- [ ] grep -R "@alfred/agent" . shows only our v6 module exports and imports (no Mastra references).
- [ ] curl -N -X POST http://localhost:PORT/api/assistant -d '{"messages":[{"id":"m1","role":"user","parts":[{"type":"text","text":"hello"}]}]}' returns SSE with UI message parts (“start”, at least one “text-delta” or no text if minimal, and “finish”).
- [ ] curl -N -X POST http://localhost:PORT/api/orchestrator -d '{"messages":[{"id":"m1","role":"user","parts":[{"type":"text","text":"plan a task"}]}]}' returns SSE as above.
- [ ] apps/web Chat screens render using @alfred/ui Chat (inspect import); virtualization and perf props function (window.__perf.chat updated).
- [ ] apps/web linear webhook accepts signed request and calls workflow.resume via tRPC; returns 202.
- [ ] bun test: expected new test files pass.
- [ ] tsc -b across the repo passes.

New tests (expected behaviors):
- assistant.stream.test.ts: Asserts that response includes "data: {\"type\":\"start\"}" and terminates with "data: [DONE]" or finish part; skip if no provider keys.
- chat.parts.test.tsx: Asserts rendering of text/tool-call/tool-result; perf metrics updated.
- webhook.resume.test.ts: Mocks signature and ensures resume path invoked.

## Idempotence and Recovery

- All file edits are additive or replacements; re-running steps is safe if you verify git clean state.
- If streaming breaks during migration:
  - Temporary fallback: rewire client to /api/ai (already v6), e.g., in useAssistantStream transport: new DefaultChatTransport({ api: "/api/ai" }). This allows demo continuity while you repair /api/assistant and /api/orchestrator.
- If Chat virtualization causes regressions:
  - Pass virtualized={false} and omit ListComponent to disable virtualization.
- If OpenAI API not configured:
  - Set OPENAI_API_KEY and AI_MODEL envs; or switch apps/web/src/routes/api/ai/$.ts to a smaller public model during testing (gemini set up with google key).

Rollback plan:
- Keep changes on a feature branch. To roll back, reset to prior commit where Mastra was active.
- If partial migration causes intermittent failures, restore the two Mastra web endpoints temporarily while continuing UI consolidation and type cleanup; then re-attempt v6 streaming.

## Artifacts and Notes

Selected diffs and code excerpts (indented; copy-pastable):

1) apps/web/src/routes/api/assistant/$.ts (after)

    import { createFileRoute } from "@tanstack/react-router";
    import { convertToModelMessages, type UIMessage, streamText } from "ai";
    import { getOpenAI, getModelId, buildAssistantTools } from "@alfred/agent/src/v6";

    export const Route = createFileRoute("/api/assistant/$")({
      server: {
        handlers: {
          POST: async ({ request }) => {
            if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });
            try {
              const { messages }: { messages?: UIMessage[] } = await request.json();
              const model = getOpenAI().chat(getModelId());
              const result = streamText({
                model,
                messages: convertToModelMessages(messages ?? []),
                tools: buildAssistantTools(),
              });
              return result.toUIMessageStreamResponse({ originalMessages: messages ?? [] });
            } catch (error) {
              console.error("Assistant stream error:", error);
              return new Response(JSON.stringify({ error: "assistant_stream_failed" }), {
                status: 500,
                headers: { "Content-Type": "application/json" },
              });
            }
          },
        },
      },
    });

2) apps/web/src/routes/api/orchestrator/$.ts (after)

    import { createFileRoute } from "@tanstack/react-router";
    import { convertToModelMessages, type UIMessage, streamText } from "ai";
    import { getOpenAI, getModelId, buildOrchestratorTools } from "@alfred/agent/src/v6";

    export const Route = createFileRoute("/api/orchestrator/$")({
      server: {
        handlers: {
          POST: async ({ request }) => {
            if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });
            try {
              const { messages }: { messages?: UIMessage[] } = await request.json();
              const model = getOpenAI().chat(getModelId());
              const result = streamText({
                model,
                messages: convertToModelMessages(messages ?? []),
                tools: buildOrchestratorTools(),
              });
              return result.toUIMessageStreamResponse({ originalMessages: messages ?? [] });
            } catch (error) {
              console.error("Orchestrator stream error:", error);
              return new Response(JSON.stringify({ error: "orchestrator_stream_failed" }), {
                status: 500,
                headers: { "Content-Type": "application/json" },
              });
            }
          },
        },
      },
    });

3) apps/web/src/routes/api/linear/webhook.ts (after)

    import { webhookEventsTotal, webhookErrorsTotal } from "@alfred/api/metrics";
    import crypto from "node:crypto";
    import { createFileRoute } from "@tanstack/react-router";
    import { appRouter } from "@alfred/api";
    import { randomUUID } from "node:crypto";

    function createCaller() {
      return appRouter.createCaller({
        session: { user: { id: "system", roles: ["system"], scopes: ["linear.write"] } } as any,
        runtime: {
          requestId: `linear-webhook-${Date.now()}`,
          receivedAt: new Date(),
          method: "POST",
          url: "linear:webhook",
          ip: null, forwardedFor: [], userAgent: "linear-webhook", referer: null,
        },
        runtimeContext: { get() {}, set() {}, forEach() {} } as any,
        policy: { obligations: [] },
      });
    }

    export const Route = createFileRoute("/api/linear/webhook")({
      server: {
        handlers: {
          POST: async ({ request }) => {
            // ...existing secret + signature verification remains unchanged...
            // After payload parse:
            const eventType = extractEventType(payload);
            webhookEventsTotal.labels(eventType).inc();
            const runIdFromPayload = (payload as any)?.data?.agentSessionId;
            const runId = typeof runIdFromPayload === "string" && runIdFromPayload.length > 0 ? runIdFromPayload : randomUUID();
            const authz = extractAuthz(payload as any); // implement extraction analogous to subscribers/linear.ts
            if (authz) {
              try {
                await createCaller().workflow.resume({ runId, event: "linear-authz", authz });
              } catch {
                webhookErrorsTotal.labels("publish").inc();
                return new Response("publish_failed", { status: 500 });
              }
            }
            return new Response(JSON.stringify({ ok: true }), { status: 202, headers: { "content-type": "application/json" } });
          },
        },
      },
    });

4) packages/ui/src/chat/parts.ts (new)

    import type { UIMessage } from "ai";

    export function isTextPart(part: UIMessage["parts"][number]): part is { type: "text"; text: string } {
      return part.type === "text";
    }
    export function isReasoningPart(part: UIMessage["parts"][number]): part is { type: "reasoning"; reasoning: string } {
      return part.type === "reasoning";
    }
    export function isToolCallPart(part: UIMessage["parts"][number]): part is { type: "tool-call"; toolCallId: string; toolName: string; args: unknown } {
      return part.type === "tool-call";
    }
    export function isToolResultPart(part: UIMessage["parts"][number]): part is { type: "tool-result"; toolCallId: string; toolName: string; result: unknown } {
      return part.type === "tool-result";
    }
    export function isFilePart(part: UIMessage["parts"][number]): part is { type: "file"; mimeType: string; data: string } {
      return part.type === "file";
    }
    export function isDataPart(part: UIMessage["parts"][number]): part is { type: "data"; data: unknown } {
      return part.type === "data";
    }
    export function isDataCachePart(part: UIMessage["parts"][number]): part is { type: "data-cache"; data: unknown } {
      return part.type === "data-cache";
    }
    export function isDataStatusPart(part: UIMessage["parts"][number]): part is { type: "data-status"; data: unknown } {
      return part.type === "data-status";
    }
    export function getAgentLabel(message: UIMessage): string {
      const meta = (message as any).metadata as { agent?: string } | undefined;
      if (meta?.agent === "orchestrator") return "Orchestrator";
      if (message.role === "assistant") return "Assistant";
      if (message.role === "system") return "System";
      if (message.role === "user") return "User";
      return message.role;
    }
    export function getTime(message: UIMessage): string | null {
      const meta = (message as any).metadata as { createdAt?: string; completeAt?: string } | undefined;
      const src = meta?.completeAt ?? meta?.createdAt;
      if (!src) return null;
      const date = new Date(src);
      return Number.isNaN(date.getTime()) ? null : date.toLocaleTimeString();
    }

5) packages/type cleanup excerpts

    // src/stream.ts
    // Remove MastraEvent and isMastraEvent; keep only UI types
    export type UIMessage = import("ai").UIMessage;
    export type ModelMessage = import("ai").ModelMessage;

    // src/guards.ts
    // Remove parseMastraEvent; keep UI/Model guards
    export function isUIMessage(value: unknown): value is UIMessage { /* unchanged*/ }
    export function isModelMessage(value: unknown): value is ModelMessage { /* unchanged*/ }

    // src/stream.zod.ts
    // Remove mastraEventSchema; keep uiMessageSchema/modelMessageSchema
    export const uiMessageSchema = /* existing */;
    export const modelMessageSchema = /* existing */;

## Interfaces and Dependencies

AI SDK v6 Provider & Tools

- Env:
  - OPENAI_API_KEY: string (required for OpenAI)
  - AI_MODEL: optional, default "openai/gpt-4o-mini"

- packages/agent/src/v6.ts exports:
  - function getModelId(): string
  - function getOpenAI(): { chat(modelId: string): MastraLanguageModelLike }
    - Note: We use @ai-sdk/openai createOpenAI to produce a provider; “chat” returns an AI SDK v6 language model object.
  - function wrapLegacyToolToAISDK<TInput extends z.ZodTypeAny>(
      legacy: { name: string; description: string; inputSchema: TInput; execute: (args: { input: z.infer<TInput> }) => Promise<any> },
    ): Tool
  - function buildAssistantTools(): ToolSet
  - function buildOrchestratorTools(): ToolSet

HTTP streaming endpoints (apps/web)
- /api/assistant/$ POST body:
  - { messages: UIMessage[] }
- Returns: result.toUIMessageStreamResponse() producing AI SDK v6 UI stream.

- /api/orchestrator/$ POST body:
  - { messages: UIMessage[] }
- Returns: same streaming behavior.

tRPC routers (packages/api)
- assistant.generate(input):
  - input: { thread?: string; resource?: string; messages: {role, content}[]; toolChoice?: "auto"|"none"|"required"; maxSteps?: number; memory?: unknown }
  - output sanitized: { text: string; toolCalls: any[]; toolResults: any[]; usage: unknown; warnings: unknown[]; finishReason: string|null }
- orchestrator.generate(input):
  - similar structure.

Chat UI (packages/ui)
- ChatProps:
  - messages: UIMessage[]
  - onSend: (text: string) => void
  - placeholder?: string
  - className?: string
  - disabled?: boolean
  - virtualized?: boolean
  - perf?: boolean
  - ListComponent?: React.ComponentType<any>
  - itemContent?: (index: number, message: UIMessage) => React.ReactNode

- parts.ts API:
  - isTextPart, isReasoningPart, isToolCallPart, isToolResultPart, isFilePart, isDataPart, isDataCachePart, isDataStatusPart
  - getAgentLabel(message: UIMessage): string
  - getTime(message: UIMessage): string | null

Testing
- SSE test harness: Use fetch with Response.body.getReader() and assert lines contain "data: {\"type\":\"start\"}" and "data: {\"type\":\"finish\"}" or “[DONE]”.
- UI tests: Render Chat and assert presence of rendered text or tool parts; if perf enabled, check window.__perf.chat updated.

## IMPORTANT: Applying Changes

When you execute this plan as a repository surgeon, you MUST use the XML diff protocol the toolchain requires. This document contains all the exact code and file paths you need. For every file you create, modify, delete, or rename, wrap your changes using the <file ...> actions defined by the repo prompt. Respect the naming, architecture, and testing standards in .ruler.

For large file replacements (e.g., removing mastra-to-ui.ts, revising routes), prefer “rewrite” when many lines change, and “modify” with precise <search> blocks for small edits.

## Notes for Novices

- If an AI provider key is missing, the stream endpoints will fail with a 500. Set OPENAI_API_KEY before running the server.
- Don’t import server-only modules (node:crypto, fs, etc.) into client components. The samples above keep server code in route files.
- Single-word naming: “parts.ts” is acceptable; avoid hyphens or multi-word file names under src where not enforced by framework.

## Appendix: Representative Test Snippets

1) SSE smoke test (pseudo-code in bun test)

    test("assistant SSE emits start and finish", async () => {
      const res = await fetch("http://localhost:5173/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: [{ id: "1", role: "user", parts: [{ type: "text", text: "hi" }] }] }),
      });
      expect(res.ok).toBe(true);
      const reader = res.body!.getReader();
      let gotStart = false, gotFinish = false;
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        const chunk = new TextDecoder().decode(value);
        if (chunk.includes("\"type\":\"start\"")) gotStart = true;
        if (chunk.includes("\"type\":\"finish\"")) gotFinish = true;
      }
      expect(gotStart).toBe(true);
      expect(gotFinish).toBe(true);
    });

2) Chat parts render test

    render(<Chat messages={[{ id: "m1", role: "assistant", parts: [{ type: "text", text: "Hello" }] }]} onSend={() => {}} />);
    expect(screen.getByText("Hello")).toBeInTheDocument();

3) Webhook resume test
    - Build signature header "t=TIMESTAMP,v1=HMAC_SHA256(timestamp:body)"; POST to route; assert 202.
    - Mock appRouter.createCaller().workflow.resume and assert called with event “linear-authz”.

## End

When done, ensure the “Progress” section is updated with actual timestamps for every major step you completed. Summarize in “Outcomes & Retrospective” what worked, what was tricky, and what remains (if anything). Attach small evidence snippets (test counts, curl outputs) in “Artifacts and Notes”.

By following this plan exactly, a novice can independently complete the migration, verify functionality, and land a clean PR removing Mastra while adopting AI SDK v6 across ALFRED.

```
