# Voice Package Naming Compliance

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

Reference: `.agent/PLANS.md` must be followed for maintenance of this document.

## Purpose / Big Picture

To bring the `@alfred/voice` package into full compliance with `AGENTS.md` naming conventions. Currently, several scripts and exported symbols violate the "single-word" rule.

**Core Rule**: "Files, directories, exported symbols, and route segments must remain a single lowercase word."

## Violations Identified

### Scripts (Snake-case/Multi-word)
- `packages/voice/scripts/stt_server.py` -> Should be `server.py` or `stt.py`
- `packages/voice/scripts/stt_transcribe.py` -> Should be `transcribe.py`
- `packages/voice/scripts/download_models.py` -> Should be `download.py`
- `packages/voice/scripts/install-deps.sh` -> Should be `install.sh`
- `packages/voice/scripts/download_supertonic.sh` -> Should be `supertonic.sh`
- `packages/voice/scripts/list_available_voices.py` -> Should be `list.py`
- `packages/voice/scripts/test_voice.py` -> Should be `test.py`
- `packages/voice/scripts/tts_say.py` -> Should be `say.py`

### Exported Symbols (Compound names)
- `src/process/maya.ts`: `MayaTTSProcess` -> Should be `Maya`
- `src/process/tts.ts`: `TTSPool` -> Should be `TTS` (or `Pool` if default export)
- `src/process/stt.ts`: `STTPool` -> Should be `STT`
- `src/process/base.ts`: `ModelProcess` -> Should be `Process`
- `src/process/ipc.ts`: `IPCBridge` -> Should be `Bridge`
- `src/process/supertonic.ts`: `SupertonicTTS` -> Should be `Supertonic`

## Plan of Work

### Phase 1: Script Renaming
Rename scripts to single words and update `package.json` and usage references.

- `stt_server.py` -> `server.py` (Context: It's the main STT server)
- `stt_transcribe.py` -> `transcribe.py`
- `download_models.py` -> `download.py`
- `install-deps.sh` -> `install.sh`
- `download_supertonic.sh` -> `supertonic.sh`
- `list_available_voices.py` -> `list.py`
- `test_voice.py` -> `test.py`
- `tts_say.py` -> `say.py`

**Updates Required:**
- `packages/voice/package.json` (scripts)
- `packages/api/src/voice/pools.ts` (script references)
- `packages/voice/src/process/tts.ts` (legacy script reference check)
- `packages/voice/src/process/stt.ts` (script reference)

### Phase 2: Symbol Renaming
Rename exported classes to match their filename/domain (single word).

- `MayaTTSProcess` -> `Maya`
- `TTSPool` -> `TTS`
- `STTPool` -> `STT`
- `ModelProcess` -> `Process`
- `IPCBridge` -> `Bridge`
- `SupertonicTTS` -> `Supertonic`

**Updates Required:**
- All internal imports in `packages/voice`
- Consumers in `packages/api` (`pools.ts`, `session.ts`)

## Progress

- [ ] Phase 1: Script Renaming
    - [ ] Rename files
    - [ ] Update `package.json`
    - [ ] Update `pools.ts` and config references
- [ ] Phase 2: Symbol Renaming
    - [ ] Rename `MayaTTSProcess` -> `Maya`
    - [ ] Rename `TTSPool` -> `TTS`
    - [ ] Rename `STTPool` -> `STT`
    - [ ] Rename `ModelProcess` -> `Process`
    - [ ] Rename `IPCBridge` -> `Bridge`
    - [ ] Rename `SupertonicTTS` -> `Supertonic`
    - [ ] Update imports in `packages/api`

## Context and Orientation

The `voice` package has accumulated technical debt in naming conventions during the migration. `AGENTS.md` demands strict single-word naming to enforce "Austerity" and "Cognition". This refactor aligns the code with the project philosophy.

## Interfaces and Dependencies

- `packages/api` depends on `TTSPool` and `STTPool` from `@alfred/voice`. These will break and need updating.
- `bun run setup` depends on script names.

## Decision Log

- **Decision**: Rename `stt_server.py` to `server.py`.
    - **Reason**: `stt.py` might be confused with the module name. `server.py` inside `scripts` (which are voice-specific) is clear enough. Actually, `stt.py` is better if we consider the domain. But `server.py` implies the persistent process. Let's stick to `server.py` for the STT server script, and `maya.py` for the TTS server script (which we already did). Wait, `maya.py` is specific. `stt.py` would be consistent with `maya.py`. Let's use `stt.py` for the server script to match `maya.py` (which is the TTS server).
    - **Correction**: `stt.py` is better.

- **Decision**: Rename `MayaTTSProcess` to `Maya`.
    - **Reason**: `Maya` class in `maya.ts`. Matches `Note` in `note.ts`.

- **Decision**: Rename `ModelProcess` to `Process`.
    - **Reason**: `Process` class in `base.ts`. Generic process wrapper.

## Outcomes & Retrospective

(To be filled)
