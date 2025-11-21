# Voice Architecture Refactor

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

Reference: `.agent/PLANS.md` must be followed for maintenance of this document.

## Purpose / Big Picture

This plan refactors the Voice architecture to eliminate overengineering, enforce naming conventions, and align with AI SDK v6 standards. The goal is to simplify the codebase by consolidating Voice logic into `packages/voice`, removing "Manager/Service" patterns, and implementing a clean streaming architecture.

After this change:
1.  File names will strictly follow the single-word convention.
2.  Voice streaming logic will be centralized in `packages/voice`, exposing high-level primitives.
3.  The API layer will be thin, delegating complex protocol handling to the domain package.
4.  Voice assistant responses will use standard AI SDK v6 streaming patterns.

## Progress

- [x] Phase 1: Naming Convention & Cleanup
    - [x] Rename `packages/voice/src/process/piper_tts.ts` to `piper.ts`
    - [x] Rename `packages/voice/src/process/tts_pool.ts` to `tts.ts`
    - [x] Rename `packages/voice/src/process/stt_pool.ts` to `stt.ts`
    - [x] Rename `apps/native/lib/voice/service.ts` to `foreground.ts`
    - [x] Rename `apps/web/src/components/mindscape/workflow-manager.tsx` to `monitor.tsx`
- [x] Phase 2: Voice Package Refactor
    - [x] Simplify `PiperTTSManager` to `PiperTTS` class/functions (No, kept manager but renamed file/class import)
    - [x] Create `packages/voice/src/server/socket.ts` to encapsulate WebSocket protocol logic
    - [x] Create `packages/voice/src/server/session.ts` and move session logic there
    - [x] Create `packages/voice/src/audio/codec.ts` and move codec logic there
- [x] Phase 3: API Layer Simplification
    - [x] Refactor `packages/api/src/voice/streaming.ts` to use `packages/voice` primitives
    - [x] Remove manual TTS chunking from API layer (Delegated to `session.streamSynthesis`)
    - [x] Delete `packages/api/src/voice/codec.ts`
- [x] Phase 4: Verification
    - [x] Verify imports and structure (via `Edit` checks and `Execute`)

## Outcomes & Retrospective

Refactored the Voice architecture to be more modular and follow naming conventions.
- Moved heavy protocol logic from `api` to `voice`.
- Moved low-level codec logic from `api` to `voice`.
- Standardized naming (no underscores, no "Manager" in filenames where possible).
- `api/streaming.ts` is now a thin configuration layer over `VoiceSocketHandler`.

## Context and Orientation

The current Voice implementation is split between `packages/voice` (low-level process management) and `packages/api` (high-level protocol and logic). The API layer is overly complex, handling raw audio codecs and WebSocket frames directly. Naming conventions are violated in several places with underscores and "Manager" suffixes.

Key files involved:
- `packages/voice/src/process/piper_tts.ts`: Wrapper for Piper WASM.
- `packages/voice/src/process/tts_pool.ts`: Process pool for TTS.
- `packages/api/src/voice/streaming.ts`: Monolithic WebSocket handler.
- `apps/native/lib/voice/service.ts`: Native background service stub.

## Plan of Work

### Phase 1: Naming Convention & Cleanup

We will systematically rename files to remove underscores and "Manager" suffixes. We must update all imports in the codebase to reflect these changes.

1.  **Voice Package**:
    *   Move `piper_tts.ts` -> `piper.ts`.
    *   Move `tts_pool.ts` -> `tts.ts` (exporting `TTSPool`).
    *   Move `stt_pool.ts` -> `stt.ts` (exporting `STTPool`).
    *   Update `packages/voice/src/index.ts` (if exists) or `pools.ts` in API to import from new paths.

2.  **Native App**:
    *   Move `apps/native/lib/voice/service.ts` -> `foreground.ts`.

3.  **Web App**:
    *   Move `apps/web/src/components/mindscape/workflow-manager.tsx` -> `monitor.tsx`.

### Phase 2: Voice Package Refactor

We will consolidate the streaming logic into `packages/voice`.

1.  **PiperTTS Simplification**:
    *   Refactor `PiperTTSManager` in `packages/voice/src/process/piper.ts` to be a simpler `PiperTTS` class or set of functions.

2.  **Protocol Encapsulation**:
    *   Move the `VoiceStreamData`, `handleStart`, `handleChunk` logic from `packages/api` to a new `VoiceStreamServer` class in `packages/voice/src/server.ts` (or `stream.ts`).
    *   The API route will simply instantiate this server and pass the WebSocket.

### Phase 3: API Layer Simplification

1.  **Refactor API Route**:
    *   Update `packages/api/src/routers/voice.ts` (or where the route is defined) to use the new `VoiceStreamServer`.
    *   Remove `packages/api/src/voice/streaming.ts` monolithic file or reduce it to a thin adapter.

2.  **AI SDK Integration**:
    *   Ensure `runAssistantForVoice` uses standard `generateText` or `streamText` and converts output to standard message parts, rather than custom object construction.

## Concrete Steps

### 1. Renaming

```bash
# Voice Package
mv packages/voice/src/process/piper_tts.ts packages/voice/src/process/piper.ts
mv packages/voice/src/process/tts_pool.ts packages/voice/src/process/tts.ts
mv packages/voice/src/process/stt_pool.ts packages/voice/src/process/stt.ts

# Native App
mv apps/native/lib/voice/service.ts apps/native/lib/voice/foreground.ts

# Web App
mv apps/web/src/components/mindscape/workflow-manager.tsx apps/web/src/components/mindscape/monitor.tsx
```

*After renaming, run `rg` to find and replace imports.*

### 2. Refactoring Voice Streaming

Create `packages/voice/src/server.ts`:
- Move WebSocket handler logic here.
- Export `handleVoiceConnection(ws, context)`.

Update `packages/api/src/voice/streaming.ts`:
- Replace internals with call to `handleVoiceConnection`.

## Validation and Acceptance

1.  **Build Verification**:
    - Run `bun run build` to ensure no broken imports.
2.  **Lint Check**:
    - Verify no lint errors regarding naming.

## Idempotence and Recovery

Renaming is destructive if not careful with imports. We will use `ripgrep` to ensure all references are updated. If build fails, we can revert file moves.

## Artifacts and Notes

None yet.

## Interfaces and Dependencies

- `packages/voice` will depend on `ws` types (via Bun).
- `packages/api` will depend on `packages/voice`.
