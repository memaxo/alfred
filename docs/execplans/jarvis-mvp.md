# JARVIS MVP wiring across web HUD, voice, and TUI

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This plan must be maintained in accordance with `.agent/PLANS.md` from the repository root.

## Purpose / Big Picture

After this change, ALFRED’s “JARVIS evolution” is no longer a set of orphan modules: the existing JARVIS persona code, web HUD overlay, ambient awareness, and voice pipeline are all active in real production paths (guarded by a feature flag). A user can verify success by:

1) visiting protected web routes and seeing the JARVIS HUD (status panel + ambient notifications) mounted and updating based on real `/healthz`/`/healthz/deps` checks, and
2) using the voice S2S route and hearing replies that begin with a JARVIS-style opening (time-of-day greeting or crisp acknowledgment), and
3) using the TUI to run `alfred ask "<query>"` / `alfred jarvis greet` / `alfred jarvis status` to get JARVIS-styled text output and (optionally) spoken playback.

The work is explicitly split into two domains so it stays clear:

- ALFRED itself (this repo): backend persona + voice prompt wiring, web HUD wiring, and TUI command wiring.
- End-user applications ALFRED might generate: not applicable for this plan.

## Progress

- [x] 2025-12-30 00:00Z Created ExecPlan `docs/execplans/jarvis-mvp.md`.
- [x] 2025-12-30 00:10Z Phase 1 (backend persona): wired `ENABLE_JARVIS_PERSONA` into `packages/agent/src/assistant/src/adapter.ts` and re-exported JARVIS selectors for downstream use.
- [x] 2025-12-30 00:30Z Phase 1 (voice): applied JARVIS opening + system prompt enhancement in `packages/api/src/voice/assistant.ts` (covers clip S2S + streaming prototype) behind `ENABLE_JARVIS_PERSONA`.
- [x] 2025-12-30 00:45Z Phase 2 (web HUD): mounted `JarvisHUDProvider` in `apps/web/src/routes/__root.tsx` with protected-route gating and added `apps/web/src/hooks/use-jarvis-tts.ts` to connect `onSpeak` → `voice.ttsSynthesize` (opt-in via `VITE_JARVIS_SPEAK`).
- [x] 2025-12-30 00:50Z Phase 2 (ambient): added real health polling in `apps/web/src/routes/_protected.tsx` updating HUD system status from `/healthz` + `/healthz/deps`.
- [x] 2025-12-30 01:10Z Phase 3 (TUI): added `alfred ask`, `alfred jarvis <subcommand>`, and `alfred voice --file ...` commands and ensured they exit cleanly (no leaked handles) under test.
- [~] 2025-12-30 01:10Z Phase 4 (proactive MVP): long-session triggers + degraded/critical health triggers are now real; proactive speaking is opt-in via `VITE_JARVIS_SPEAK`. Build/Linear deadline integrations remain future work.
- [x] 2025-12-30 01:15Z Validation: Biome clean on staged files, `bun run typecheck` passes, and `bun scripts/test-bun.ts` runs green for `packages/api/test/voice.cognitive.test.ts`, `packages/tui/test/cli.test.ts`, and `packages/agent/test/agents.test.ts`.

## Surprises & Discoveries

- Observation (pre-change): `apps/web/src/components/hud/JarvisHUDProvider` already existed (with `onSpeak` + greeting/status helpers), but it was not mounted anywhere in the route layouts.
  Evidence: Prior to this rollout, `apps/web/src/routes/__root.tsx` did not mount the provider, so `<JarvisGreeting />` could not work “anywhere.”
- Observation (during early TUI wiring): Importing `@alfred/agent/assistant/src/adapter` in short-lived TUI subprocesses increased startup cost and made tests flaky.
  Evidence: TUI JARVIS commands now import `@alfred/agent/assistant/src/jarvis-persona` via a dedicated export to keep subprocesses lightweight.
- Observation: Bun fetch typings in `packages/tui` do not accept `RequestInit.cache`.
  Evidence: `tsc -b` failed on `fetch(..., { cache: "no-store" })` calls in `packages/tui/src/commands/jarvis.ts`.
- Observation: `useReducedMotion()` is typed as `boolean | null` and must be normalized before passing to boolean-only props.
  Evidence: `tsc -b` failed in `apps/web/src/components/hud/status-panel.tsx` until `useReducedMotion() ?? false` was applied.
- Observation: Cognitive event timestamps are branded (`Timestamp`), so `Date.now() as any` is a correctness smell and breaks linting.
  Evidence: Biome flagged `as any` in `packages/api/src/voice/assistant.ts`; fixed with `timestamp(Date.now())`.

## Decision Log

- Decision: Keep the public signature `getPersonaInstruction(domains: string[])` backwards-compatible and gate JARVIS behavior inside the adapter via `process.env.ENABLE_JARVIS_PERSONA`.
  Rationale: This avoids rippling signature changes across API + web server routes and keeps existing tests (which don’t set the env var) stable.
  Date/Author: 2025-12-30 / agent
- Decision: Add an explicit `@alfred/agent/assistant/src/jarvis-persona` subpath export so non-agent runtimes (TUI + API voice) can use JARVIS phrase selection without importing the heavier adaptive persona adapter.
  Rationale: Prevents leaked handles / long-lived imports in short CLI runs while still reusing the canonical JARVIS persona definitions.
  Date/Author: 2025-12-30 / agent
- Decision: Ensure all JARVIS greeting variants include an honorific (currently defaulting to “Sir”).
  Rationale: Matches ALFRED’s global persona contract and makes CLI/voice openings deterministic for tests.
  Date/Author: 2025-12-30 / agent
- Decision: For TUI health checks, avoid `RequestInit.cache` and rely on direct fetches (or headers) instead.
  Rationale: Keeps `packages/tui` compatible with Bun’s fetch typings and avoids DOM-lib leakage in TS configs.
  Date/Author: 2025-12-30 / agent

## Outcomes & Retrospective

- JARVIS persona enhancement is wired into production backend paths behind `ENABLE_JARVIS_PERSONA`.
- Web HUD is mounted globally with protected-route gating and health polling feeding real ambient system state.
- TUI now supports `alfred ask`, `alfred jarvis greet/status/ask`, and `alfred voice --file ...` for quick interaction loops.
- Verified by Biome, repo-wide `tsc -b`, and targeted Bun tests for API voice + TUI CLI + agent defaults.

## Context and Orientation

This repo already contains the JARVIS implementation pieces, but they are not fully integrated:

Persona (backend):

- `packages/agent/src/assistant/src/adapter.ts` provides `getPersonaInstruction()` used by:
  - `packages/api/src/ai/assistant-context.ts` (RAG + persona injection for `assistant.generate`)
  - `apps/web/src/routes/api/assistant/$.ts` (streaming assistant endpoint)
- `packages/agent/src/assistant/src/jarvis-persona.ts` contains the JARVIS system prompt enhancement and phrase selectors, but nothing imports it in production paths today.

Voice (API):

- `packages/api/src/voice/assistant.ts` implements `runAssistantForVoice()`, used by both:
  - `packages/api/src/routers/voice.ts` clip-based `voice.speechToSpeech`
  - `packages/api/src/voice/streaming.ts` (the streaming prototype) via `runAssistantForVoice`

Web HUD + Ambient Awareness:

- `apps/web/src/components/hud/jarvis-hud.tsx` defines `JarvisHUDProvider`, `JarvisGreeting`, and `JarvisStatus`.
- `apps/web/src/hooks/use-ambient-awareness.ts` defines `useAmbientAwareness` plus default proactive triggers (long session, late night, system degraded/critical, etc.).
- The HUD is not currently mounted in `apps/web/src/routes/__root.tsx` or `apps/web/src/routes/_protected.tsx`.
- Health endpoints exist in the web app: `apps/web/src/routes/healthz.ts` and `apps/web/src/routes/healthz/deps.ts`.

TUI:

- `packages/tui/src/cli/index.ts` is the CLI entrypoint, with explicit early handling for `auth` and `tui`.
- There is no `jarvis` or `voice` command yet, but the TUI already has voice panels under `packages/tui/src/tui/panels/voice/`.

## Plan of Work

First, wire the JARVIS persona into the backend persona adapter so all assistant contexts can opt into JARVIS prompt enhancements without changing call sites. Then update `runAssistantForVoice()` to choose a time-of-day greeting or JARVIS transition before generation and ensure the final returned text begins with that opening. Because both `voice.speechToSpeech` and the streaming prototype call `runAssistantForVoice()`, this single integration point ensures `/voice-s2s` and streaming gain JARVIS persona consistently.

Next, mount the existing `JarvisHUDProvider` in the web root layout to ensure `JarvisGreeting` can render anywhere, but gate visible HUD chrome (status panel + notifications) to protected routes. Connect HUD speaking to `voice.ttsSynthesize` via a new `apps/web/src/hooks/use-jarvis-tts.ts` hook that turns base64 audio into browser playback and respects a user-controlled opt-in setting.

Then, add a protected-layout ambient integration that polls `/healthz` and `/healthz/deps` periodically (measuring latency) and updates the HUD’s ambient system state so the status panel reflects reality.

Finally, add TUI commands for `ask`, `jarvis`, and `voice`. The MVP “ask” and “jarvis greet/status” commands should work even when audio playback is disabled (for CI), but should support speaking via `voice.ttsSynthesize` when enabled. The “voice” command should support both `--file <path>` (testable) and best-effort microphone capture (optional), then call `voice.speechToSpeech` and play the returned audio.

## Concrete Steps

All commands below assume the repository root as the working directory (`/Users/jackmazac/Development/alfred`).

1) Backend persona:

   - Edit `packages/agent/src/assistant/src/adapter.ts` to import `JARVIS_SYSTEM_ENHANCEMENT` and conditionally append it when `process.env.ENABLE_JARVIS_PERSONA` is enabled. Re-export JARVIS selection helpers for downstream use.

2) Voice persona:

   - Edit `packages/api/src/voice/assistant.ts` to:
     - compute an opening using `buildJarvisOpening()` when enabled,
     - instruct the model to start with the opening, and
     - post-process the final text to ensure it starts with that opening exactly once.

3) Web HUD:

   - Edit `apps/web/src/routes/__root.tsx` to mount `JarvisHUDProvider` and pass an `onSpeak` callback (from `useJarvisTts`).
   - Edit `apps/web/src/routes/_protected.tsx` to poll `/healthz` + `/healthz/deps` and update the HUD’s system state.
   - Add `apps/web/src/hooks/use-jarvis-tts.ts` as the HUD → `voice.ttsSynthesize` bridge.

4) TUI commands:

   - Edit `packages/tui/src/cli/index.ts` to intercept `ask`, `voice`, and `jarvis` commands before registry initialization, mirroring the `auth` pattern.
   - Add `packages/tui/src/commands/jarvis.ts` and `packages/tui/src/commands/voice.ts` implementing the commands and keeping side effects strictly inside command handlers.
   - Update `packages/tui/package.json` dependencies as needed and add any missing local `.d.ts` shims if a dependency lacks types.

## Validation and Acceptance

The work is accepted when:

1) Web HUD:

   - After starting the dev server, navigating to a protected route (e.g., `/`) shows a HUD status panel (desktop widths) and ambient notifications can appear after long sessions.
   - The status panel reflects `/healthz/deps` transitions (nominal → degraded/critical) when dependencies fail.

2) Voice:

   - On `/voice-s2s`, the assistant reply text begins with a JARVIS-style opening (time-of-day greeting for first interaction, otherwise an acknowledgment).
   - Both clip S2S and streaming prototype responses show the same persona behavior (because both call `runAssistantForVoice()`).

3) TUI:

   - `bun test packages/tui/test/cli.test.ts --grep "jarvis"` passes.
   - `alfred ask "what's my status"` prints a response and, when audio is enabled, plays a spoken reply.
   - `alfred jarvis status` prints and (optionally) speaks a concise system health summary.

Recommended test commands (run as close to the changed packages as possible):

   - `bun test packages/tui/test/cli.test.ts --grep "jarvis"`
   - `bun test packages/api/test/voice.s2s.test.ts`
   - `bun test apps/web/src/tests/routes/voice-s2s.route.test.tsx`
   - `bun test apps/web/src/components/hud/ --watch` (manual loop)

## Idempotence and Recovery

All changes are additive and safe to re-run. If the feature flag `ENABLE_JARVIS_PERSONA` is unset, the system should behave as before (no JARVIS prompt additions, no forced openings). Web HUD mounting should be gated so public routes remain clean. If audio playback fails (missing system player, browser autoplay restrictions, missing local voice models), the system must still return text and show notifications without crashing.

## Artifacts and Notes

As the work proceeds, add short evidence snippets here (test output excerpts, sample console logs showing JARVIS openings, etc.).

## Interfaces and Dependencies

Environment:

- `ENABLE_JARVIS_PERSONA` (server-side): enables JARVIS prompt enhancement and voice openings.
- Optional web build flag: `VITE_ENABLE_JARVIS_PERSONA` can be used to show HUD chrome on protected routes if needed.

Key exported functions:

- From `packages/agent/src/assistant/src/adapter.ts`:
  - `getPersonaInstruction(domains: string[]): string | null` (existing signature preserved)
  - re-exports for downstream use: `selectGreeting(hour?: number)`, `selectTransition(category)`, `buildJarvisOpening(context)`

Key web component:

- `apps/web/src/components/hud/jarvis-hud.tsx`:
  - `JarvisHUDProvider`
  - `JarvisGreeting` (must work anywhere provider is mounted)

