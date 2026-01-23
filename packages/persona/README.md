# @alfred/persona

Pure, shared persona utilities for ALFRED (voice, text, workflow narration, and TUI).

This package is **isomorphic** and **pure**:
- no IO
- no timers
- no environment reads
- no `Date.now()` calls (callers pass time inputs explicitly)

## Exports

- `buildPersonaPrompt()` — system prompt block for a given modality
- `formatGreeting()` / `getTransition()` — deterministic butler-style openings/transitions
- `adaptForVoice()` — TTS-safe text transform
- `personaTelemetrySchema` — typed, non-prose telemetry schema for `raw.meta.personaTelemetry`

