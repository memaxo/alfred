# persona-architecture

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This plan must be maintained in accordance with `.agent/PLANS.md` from the repository root.

## Purpose / Big Picture

After this change, ALFRED has one coherent persona across voice, text chat, workflow narration, and TUI: the same identity, tone, principles, and tool-calling “presentation layer” regardless of modality. Users can verify success by:

1. Starting a voice session and hearing a consistent opening + concise butler-style spoken output, while the system also emits typed “control-plane” metadata (speech act, constraints applied, tool lifecycle state) for debugging/UX.
2. Using text chat and seeing the same persona principles (calm authority, succinctness, no emojis, no “I’m happy to help”, respectful address).
3. Using the TUI and seeing greetings and status copy that match the voice/chat persona.
4. Running a workflow and hearing/read status updates that are persona-consistent without changing pipeline semantics.

The key design constraint is: the envelope is deterministic, the content is generative. We will use a small state machine for the conversation protocol and structured model outputs for decisions/content. We will not hardcode conversational content via keyword heuristics.

## Progress

- [x] 2026-01-20 Create `docs/execplans/persona-architecture.md` ExecPlan (this file) and link to the PRD that motivated it.
- [x] 2026-01-20 Define and implement `@alfred/persona` as a new pure, isomorphic package (no IO, no timers) with a stable API used by API + apps + TUI.
- [x] 2026-01-20 Replace JARVIS/persona fragments with `@alfred/persona` imports and remove `ENABLE_JARVIS_PERSONA` gating.
- [x] 2026-01-20 Voice runtime: implement a single spoken stream plus typed telemetry (speech act, constraints, tool lifecycle), with a deterministic protocol controller and a generative model producing the spoken content.
- [x] 2026-01-20 Remove brittle heuristics:
  - [x] Remove `looksLikeStatusQuery()` from `packages/api/src/voice/assistant.ts` (was used only for opening selection).
  - [x] Remove keyword-forest heuristic fallback in `classifyVoiceIntent()` (keep only minimal, state-gated approve/reject fallback for `awaiting_approval`).
- [x] 2026-01-20 Add contract tests that enforce persona consistency across modalities and guard against “telemetry leaks into user-facing output”.
- [ ] Delete older conflicting/obsolete persona ExecPlans and docs that contradict this plan (record deletions here).
- [x] 2026-01-20 Deleted `docs/execplans/jarvis-mvp.md` (older feature-flagged JARVIS wiring plan that conflicts with consolidation approach).

## Surprises & Discoveries

- Observation (resolved): The repo previously gated core persona behavior behind `ENABLE_JARVIS_PERSONA`, producing two different user experiences depending on environment configuration. This flag was removed and the gating paths were deleted.
  Evidence: `config/env.example` no longer documents `ENABLE_JARVIS_PERSONA`; `packages/api/src/voice/assistant.ts` and `packages/agent/src/assistant/src/adapter.ts` no longer reference it.
- Observation (resolved): Voice prompt behavior previously used a string heuristic (`looksLikeStatusQuery()`) for opening selection. This was removed; openings are now deterministic (session start) and typed telemetry captures the protocol state.
- Observation: The TTS accent is determined by voice model selection, not by prompt instructions (“British RP” in the LLM prompt affects word choice, not pronunciation).
  Evidence: `packages/voice/src/services/config.ts` line 18-19 defines `DEFAULT_TTS_VOICE = "en_US-lessac-medium"` (Piper voice). `packages/api/src/routers/voice.ts` allows override via `ttsVoice` parameter.
- Observation: Voice already has a workflow state machine (`planning`, `awaiting_approval`, `executing`, `completed`) but no conversation protocol state machine for speech acts.
  Evidence: `packages/api/src/voice/workflow-state.ts` defines workflow phases. `packages/api/src/voice/assistant.ts` has no protocol state tracking for conversation turns.
- Observation: Tools are handled automatically by AI SDK `ToolLoopAgent`; there's no explicit “tool announcement” mechanism. Tool results appear in the model's free-form text response.
  Evidence: `packages/api/src/voice/assistant.ts` line 384 calls `generateText()` with `tools: defaults.tools` from `getVoiceAgentDefaults()`. No pre-tool or post-tool framing exists.
- Observation: Voice response structure already includes `raw: VoiceAssistantRaw` with `uiMessages` and `meta`, which can carry GenUI parts (workflow timeline, plan data) but the main spoken text is in `text: string`.
  Evidence: `packages/type/src/voice.ts` line 19-26 defines `VoiceAssistantRaw`. `packages/api/src/voice/workflow-handler.ts` line 528-583 builds `raw` with GenUI parts.
- Observation: Telemetry infrastructure already exists: `durationSeconds`, session status tracking, network telemetry (`telemetry_report` events), cognitive loop integration.
  Evidence: `VoiceAssistantResult` includes `durationSeconds`. `packages/api/src/voice/session-registry.ts` tracks session state. `packages/type/src/voice.ts` line 139-145 defines `telemetry_report` event type.

## Decision Log

- Decision: Do not implement any “internal monologue stream” (no parallel internal text stream). Use a single user-facing stream and emit only typed, non-prose telemetry for debugging/UX.
  Rationale: A second narrative stream inevitably trends toward chain-of-thought-like content, increases persistence/transport complexity, and creates leakage and privacy risks. Typed telemetry (speech act, constraints, tool lifecycle) provides observability without a second story.
  Date/Author: 2026-01-20 / agent
- Decision: Use a state machine only for the deterministic conversation protocol (“speech acts” and tool lifecycle), not for the conversational content.
  Rationale: Matches ALFRED’s architecture (boundary orchestration is deterministic; content is generative), avoids brittle heuristics, and supports robust barge-in/timeouts/tooling flows.
  Date/Author: 2026-01-20 / agent
- Decision: Allow only minimal, state-gated heuristics (<5 branches) as a fallback when LLM classification is unavailable; remove keyword forests and scoring heuristics.
  Rationale: We need deterministic reliability for a tiny set of high-stakes voice actions (for example, “approve”/“reject” while awaiting approval), but large keyword lists drift, misclassify silently, and create inconsistent behavior across environments. The approved compromise is: keep only an unambiguous fallback (exact/near-exact matches in a known session state) and otherwise degrade safely (return “conversational” / ask to clarify) rather than guessing.
  Date/Author: 2026-01-20 / agent
- Decision: Create a new package `@alfred/persona` rather than embedding persona under `@alfred/agent`.
  Rationale: Persona must be safe to import in `apps/web`, `apps/native`, and `packages/tui` without dragging server-only dependencies; it is a cross-layer presentation primitive, not agent orchestration.
  Date/Author: 2026-01-20 / agent
- Decision: The pipeline (`packages/pipeline`) must never import persona; persona formatting happens in API/UI layers consuming pipeline events.
  Rationale: Preserves pipeline boundaries: pipeline emits typed, neutral events; presentation is above it.
  Date/Author: 2026-01-20 / agent

## Outcomes & Retrospective

(Write this section as milestones complete. At the end, summarize how persona coherence was validated across voice/text/TUI, what was deleted, and what remaining gaps exist.)

## Context and Orientation

ALFRED currently has persona-relevant behavior split across multiple files and layers:

- Backend adaptive persona and JARVIS enhancement:
  - `packages/agent/src/assistant/src/adapter.ts` defines domain personas (adaptive only). Core persona is centralized in `@alfred/persona`.
  - `packages/agent/src/assistant/src/jarvis-persona.ts` defines transitions, humor examples, and a system prompt block (`JARVIS_SYSTEM_ENHANCEMENT`).
  - `packages/agent/src/agents.ts` defines base agent instructions (`assistantInstructions`, `orchestratorInstructions`) and exports `getVoiceAgentDefaults()` which returns `ToolLoopAgentSettings` with `tools`, `instructions`, `stopWhen`, `prepareStep`.
  - `packages/agent/src/preference/prompt.ts` builds preference-based “response style” system prompts (feature-flag gated via `PREFERENCE_ADAPTATION_ENABLED`).
- Voice assistant and workflow speech:
  - `packages/api/src/voice/assistant.ts` implements `runAssistantForVoice()` which:
    - Routes to workflow handlers (`handleWorkflowIntent`, `handleApprovalIntent`, `handleStatusQuery`) if workflow is enabled and intent matches.
    - Falls back to `runConversationalAssistant()` which calls `generateText()` with tools from `getVoiceAgentDefaults()`.
    - Applies `@alfred/persona` prompt + deterministic session-start greeting.
    - Emits typed persona telemetry via `raw.meta.personaTelemetry`.
    - Returns `VoiceAssistantResult` with `text`, `replayId`, `raw: VoiceAssistantRaw`, `durationSeconds`.
  - `packages/api/src/voice/intent.ts` implements `classifyVoiceIntent()` which uses LLM-first classification via `@alfred/plan/classify` with a minimal, state-gated approval fallback only.
  - Note: The keyword-forest heuristic fallback has been removed; only a minimal, state-gated fallback remains for unambiguous approval/rejection when `awaiting_approval`.
  - `packages/api/src/voice/workflow-handler.ts` handles workflow intents and returns TTS-optimized plan summaries.
  - `packages/api/src/voice/plan-speech.ts` converts `StructuredPlan` to natural language with verbosity levels (`brief`, `standard`, `detailed`).
  - `packages/api/src/voice/session-context.ts` manages workflow state in Redis (with in-memory fallback) for multi-turn voice workflow interactions.
  - `packages/api/src/voice/workflow-state.ts` defines workflow state machine: `planning`, `awaiting_approval`, `executing`, `completed`.
- Voice response structure:
  - `VoiceAssistantResult` contains: `text: string` (spoken), `replayId: string | null`, `raw: VoiceAssistantRaw`, `durationSeconds: number`.
  - `VoiceAssistantRaw` contains: `uiMessages: UIMessage[]` (AI SDK v6 format, can include GenUI parts), `meta?: { runId?, planId?, ... }`.
  - Tools are called automatically via AI SDK `generateText()` with `tools: defaults.tools`; results appear in the model's text response (no explicit tool announcement mechanism exists).
- Voice session state:
  - `VoiceSessionStatus` tracks: `idle`, `recording`, `processing`, `responding`, `error`.
  - Session registry stores: `lastTranscript`, `lastAssistantText`, `lastError`, `status`, `createdAt`, `updatedAt`.
  - Network telemetry exists: `telemetry_report` events with `packetLoss`, `jitter`, `rtt`.
- Voice streaming:
  - `packages/api/src/voice/streaming.ts` implements WebSocket-based streaming prototype.
  - `packages/api/src/voice/webrtcsession.ts` implements WebRTC-based streaming.
  - Both call `runAssistantForVoice()` and emit `assistant_message` events with `raw` payload.
- TUI greetings:
  - `packages/tui/src/tui/intro/greeting.ts` contains butler greetings (hardcoded “Sir”, time-of-day aware).
- Voice synthesis configuration:
  - `packages/voice/src/services/config.ts` defines `DEFAULT_TTS_VOICE = "en_US-lessac-medium"` (Piper voice).
  - `packages/api/src/routers/voice.ts` allows user override via `ttsVoice` parameter.
- Design documents:
  - `docs/architecture/jarvis-evolution.md` (spec; not fully implemented)
  - `docs/architecture/personality-architecture.md` (design for cognitive traits; separate from persona/prompt identity)
- PRD that motivates this ExecPlan:
  - `docs/execplans/persona-consolidation.md` (PRD; this ExecPlan is the implementation plan)

Definitions (as used in this plan):

- Persona: The stable “presentation identity” of ALFRED (address style, tone, openings, vocabulary constraints, do/don’t rules, tool-call framing).
- Modality: Where the user experiences output (voice TTS, text chat, workflow narration, TUI).
- Deterministic envelope: The state machine and structured schemas controlling *when* and *what kind* of thing ALFRED says (acknowledge vs clarify vs answer vs error), plus tool lifecycle constraints.
- Generative content: The actual user-facing words inside that envelope, produced by the model within strict constraints.
- Typed telemetry: Non-prose, structured metadata that describes protocol state (speech act), constraints applied, tool lifecycle progress, and evidence gates. Telemetry is safe to store/inspect and must never be spoken.

## Plan of Work

We will implement persona as a pure, shared package and then integrate it at the boundaries that generate user-facing language. We will keep orchestration layers (pipeline stages and core runner logic) persona-free. Voice runtime will gain a small protocol state machine that drives structured generation and tool execution. For observability, we will emit typed telemetry (speech act, constraints, tool lifecycle, evidence gates) rather than an internal monologue stream.

This work is primarily ALFRED itself (this repo). It does not change “applications ALFRED generates”.

## Concrete Steps

All commands below assume the repository root as the working directory (`/Users/jackmazac/Development/alfred`).

Milestone 1: Create `@alfred/persona` (pure shared package)

Create a new package under `packages/persona/` following package standards:

  - `packages/persona/package.json` with `"name": "@alfred/persona"`, `"type": "module"`, `exports` for main entry and any subpaths, and `"workspace:*"` deps.
  - `packages/persona/tsconfig.json` extending `../tsconfig/tsconfig.json`.
  - `packages/persona/turbo.json`, `README.md`, `src/index.ts`, `test/`.

Implement the following modules (all pure; no IO; no `Date.now()` internally; accept timestamps as arguments). This package must not read user preferences directly; callers must pass `honorific`, `verbosity`, and other user state explicitly.

  - `src/character.ts`: Canonical ALFRED character constants and “do/don’t” rules.
  - `src/transitions.ts`: Openings/transitions (acknowledge/status/alert/uncertain/complete/close) with honorific support.
  - `src/honorific.ts`: `HonorificPreference` and `applyHonorific()`; plus a small “render honorific” helper.
  - `src/prompt.ts`: `buildPersonaPrompt({ modality, honorific, focusMode, … })` including “runtime hints” with good vs bad examples.
  - `src/voice.ts`: `adaptForVoice(text)` (remove markdown/odd punctuation, shorten sentences safely).
  - `src/telemetry.ts`: Zod schema for persona-related telemetry that boundaries can emit and UIs can render (no free-text reasoning).

Milestone 2: Integrate persona into voice runtime (single spoken stream + deterministic protocol + typed telemetry)

Update `packages/api/src/voice/assistant.ts` to:

  - Stop building persona strings ad-hoc; instead call `@alfred/persona` builders to produce system prompt blocks for modality `"voice"`.
  - Remove `looksLikeStatusQuery()` heuristic (currently only used to select opening type). Use `classifyVoiceIntent()` result to determine appropriate opening instead.
  - Replace the current heuristic fallback in `classifyVoiceIntent()` with the approved minimal fallback (<5 branches), state-gated to only handle unambiguous cases (example: exact/near-exact “approve/yes” vs “reject/no” when `awaiting_approval`). In all other cases, degrade safely to “conversational” (or ask a clarification) rather than guessing “workflow/status” via keyword scoring.
  - Remove `ENABLE_JARVIS_PERSONA` gating; persona is always active.
  - Implement a deterministic conversation protocol state machine (separate from workflow state machine) that tracks speech acts:
    - States: `greet` (session start), `ack` (routine acknowledgment), `clarify` (needs user input), `answer` (direct response), `tooling` (tools executing), `recover` (error handling), `close` (session end).
    - Transitions driven by: classified intent (`classifyVoiceIntent()` result), session state (first turn vs continuation), tool execution state (tools in flight vs complete).
    - The state machine determines *what kind* of response is needed, but the actual text remains generative (via `generateText()` with persona prompt).
  - Emit typed persona telemetry using a single canonical transport:
    - Transport: `VoiceAssistantRaw.meta.personaTelemetry` (validated by `@alfred/persona` `personaTelemetrySchema`).
    - Do not add a separate `VoiceAssistantResult.telemetry` field (avoid duplicated surfaces and drift).
    - Minimum telemetry fields:
      - `speechAct: "greet" | "ack" | "clarify" | "answer" | "tooling" | "recover" | "close"`
      - `constraints: { focusMode: boolean; ttsSafe: boolean; maxWords?: number | null }`
      - `tooling: { toolsUsed: string[]; hasToolResults: boolean }`
      - `heuristicFallbackUsed: boolean` (true only for the minimal approval/rejection fallback)
      - `intent: { type: "workflow" | "approval" | "status_query" | "conversational"; confidence?: number | null }`
  - Add runtime hints to persona prompt with good/bad examples (e.g., “Never claim tool results without tool evidence. Good: 'I'll check that for you, Sir.' Bad: 'I've found the answer' when no tool has run yet.”).
  - Ensure tool-call framing: when tools are about to execute, inject persona-appropriate preamble into system prompt (e.g., “When calling tools, frame your announcement as: 'I'll look into that for you, {honorific}.' Do not claim results until tool execution completes.”).
  - Define “tool evidence” precisely (so it can be tested):
    - `toolsUsed`: derived from the AI SDK result (names of tools invoked during the `generateText()` tool loop).
    - `hasToolResults`: true iff the AI SDK result contains at least one tool result for an invoked tool (not inferred from the spoken text).

Milestone 3: Integrate persona into text assistant (and preference prompt)

Update the text assistant prompt pipeline:

  - `packages/agent/src/agents.ts`: Replace the hardcoded `assistantInstructions` string with `@alfred/persona` prompt construction for modality `"text"` (and keep `getVoiceAgentDefaults()` / `getAssistantAgentDefaults()` wired to the shared persona instructions).
  - `packages/agent/src/preference/prompt.ts`: Keep preference adaptation as additive “response formatting” (verbosity/tone/format). It must append after persona prompt and must not contradict persona do/don’t rules.
  - Tool-call framing: tools are executed via AI SDK `ToolLoopAgent`; persona prompt should only shape how tool execution is described to the user (before/after), not introduce separate “tool narration” heuristics.

Milestone 4: Integrate persona into TUI greetings and workflow narration

Update:

  - `packages/tui/src/tui/intro/greeting.ts`: Replace hardcoded greetings with calls to `@alfred/persona` `formatGreeting({ timeOfDay, honorific })`. Honorific preference lookup must stay outside `@alfred/persona` (TUI loads it via existing preference mechanisms and passes it in).
  - `packages/api/src/voice/plan-speech.ts`: Keep the structured plan-to-speech conversion logic (it's domain-specific), but use persona helpers for phrasing (e.g., `formatOpening()` from persona module instead of `formatOpening()` local function). Ensure honorific is passed through from user preferences.
  - Web HUD greetings (`apps/web/src/hooks/use-ambient-awareness.ts`, `apps/web/src/components/hud/jarvis-hud.tsx`): Update to call `@alfred/persona` greeting generator so UI copy matches voice/TUI.

Milestone 5: Remove legacy gating + conflicting persona fragments

Remove:

  - `ENABLE_JARVIS_PERSONA` gating and related conditional prompt behavior in code paths where persona should always be active.
  - Legacy persona ExecPlans that conflict with this approach.

Milestone 6: Validation and contract tests

Add/extend tests that prove:

  - Voice emits typed telemetry and never emits/stores any internal monologue text stream.
  - Honorific preference is respected across modalities (voice/text/TUI).
  - “Bad examples” constraints are enforced (no emojis, no “I’m happy to help”, no panic/alarmist language).
  - Pipeline remains persona-free (no `@alfred/persona` imports under `packages/pipeline`).

## Validation and Acceptance

Acceptance is achieved when the following are true:

1. Voice:
   - In a voice session, the first response includes a greeting/opening appropriate for session start and honorific.
   - Subsequent responses do not re-greet, remain concise, and never leak telemetry into user-facing speech.
   - Tool-backed answers never claim results before tool results exist.

2. Text:
   - Text responses follow the same persona do/don’t rules and remain consistent in tone and address.

3. TUI:
   - Greeting output matches the same persona (wording, honorific handling, calm tone).

4. Architecture:
   - `packages/pipeline` contains no persona imports and remains event-driven and neutral.

Proof (manual, copy/pasteable checks):

1) Voice session greeting + no re-greet:
   - Start a voice session and speak two back-to-back queries.
   - Expect: first reply may include a greeting/opening; second reply must not include a greeting/opening.

2) Telemetry never leaks into speech:
   - Trigger a voice response that includes `raw.meta.personaTelemetry`.
   - Expect: `VoiceAssistantResult.text` contains no JSON, keys like `speechAct`, or any telemetry values.

3) Minimal heuristic fallback only:
   - Put the system into `awaiting_approval` voice workflow state, then speak “approve” and “reject”.
   - Expect: it resolves correctly even when LLM classification is unavailable; `raw.meta.personaTelemetry.heuristicFallbackUsed === true`.
   - Speak an ambiguous utterance (e.g. “let’s do it”) outside awaiting approval.
   - Expect: no keyword-forest classification; degrade safely to “conversational” or ask a clarification; `heuristicFallbackUsed === false`.

Validation commands (examples; adjust as the implementation progresses):

  - `bun test packages/api/test --grep persona`
  - `bun test packages/agent/test --grep persona`
  - `bun test packages/tui/test --grep greeting`
  - `bun run typecheck`

## Idempotence and Recovery

This plan should be implemented as additive changes first (new package, new helpers, new tests), then migrate call sites, then delete legacy code/docs. If a migration step breaks a consumer (voice/text/TUI), keep a temporary adapter layer that calls into `@alfred/persona` while preserving the old function signature, then remove the adapter only once tests are green.

## Artifacts and Notes

As work proceeds, record short evidence here:

  - Snippets of test output that demonstrate telemetry emission and that no “internal monologue” stream exists.
  - A before/after transcript showing consistent honorific usage.

Evidence (2026-01-20):

- Tests run:
  - `bun test packages/persona/test/persona.test.ts`
  - `bun test packages/api/test/voice.s2s.test.ts packages/api/test/voice.workflow.test.ts packages/api/test/persona.boundary.test.ts`
  - `bun test packages/api/test/assistant.router.test.ts`
  - `bun test packages/agent/test/agents.test.ts packages/agent/test/emergent-behavior.test.ts`
  - A short grep result proving `ENABLE_JARVIS_PERSONA` is removed.

## Interfaces and Dependencies

New package:

  - `@alfred/persona` must be safe to import in browser and Bun CLI environments. It must not import server-only packages (`@alfred/db`, `pg`, Node-only APIs) or start timers at import time.

Stable APIs to implement in `@alfred/persona`:

  - `buildPersonaPrompt(context: PersonaContext) -> string` (for model system prompt construction, includes runtime hints with good/bad examples)
  - `formatGreeting({ timeOfDay, honorific, … }) -> string`
  - `getTransition(kind, honorific) -> string`
  - `adaptForVoice(text: string) -> string` (TTS-safe transformation)
  - `personaTelemetrySchema` (Zod schema for typed telemetry) + `parsePersonaTelemetry(unknown) -> PersonaTelemetry | error`

Voice runtime contract (single spoken stream + typed telemetry):

  - User-facing speech (`VoiceAssistantResult.text`) is a single stream and must not include telemetry or tool internals.
  - Telemetry is structured data only (no free-text reasoning) and is safe to store/inspect. Canonical transport is `VoiceAssistantRaw.meta.personaTelemetry` (validated by schema).
  - Tool-backed answers never claim tool results without tool result evidence. Runtime hints in persona prompt enforce this; protocol state machine tracks `toolLifecycle.phase` to validate.
  - Tools are called automatically via AI SDK `ToolLoopAgent`; persona prompt guides how the model describes tool calls/results, but we do not intercept tool execution.
  - Conversation protocol state machine (new) tracks speech acts deterministically; workflow state machine (existing) tracks workflow phases. These are separate concerns.

Test plan notes (concrete):

- Add a contract test for voice response shape:
  - Asserts `raw.meta.personaTelemetry` exists and validates against `personaTelemetrySchema`.
  - Asserts `VoiceAssistantResult.text` does not contain telemetry-like keys (e.g. `speechAct`, `constraints`, `{`, `}`) for a set of fixture inputs.
- Add a test for heuristic fallback:
  - When `awaiting_approval`, “approve”/“reject” resolves via fallback with `heuristicFallbackUsed=true`.
  - Outside awaiting approval, fallback must not classify workflow/status by keyword lists (the keyword forests must be deleted).
