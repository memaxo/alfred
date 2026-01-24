# CarPlay Integration Patterns

1. **Bridge existing systems.** When integrating with CarPlay, wrap existing voice/TTS/sync infrastructure rather than reimplementing. Create bridge files that adapt existing hooks for CarPlay context.

2. **Zustand for feature state.** Use a dedicated Zustand store per major feature domain (e.g., `useCarPlayStore`). Include computed selectors as store methods.

3. **Intent classification: local first.** Use regex pattern matching for common commands (fast path), fall back to LLM classification for complex intents. Return confidence scores.

4. **Pattern matching: use word boundaries.** CarPlay intent patterns must use `\b` or `$` to avoid false matches (e.g., `/prs?$/i` not `/prs?/i` to avoid matching "progress").

5. **Template callbacks: individual params.** react-native-carplay template constructors take callbacks as individual parameters, not as an object. Check the template type definitions.

6. **Offline queue: reuse sync infrastructure.** CarPlay offline commands should use the existing `lib/sync/queue.ts` infrastructure, adding a table prefix for filtering.

7. **Speech generators: truncate for voice.** TTS speech should be truncated to ~20 words per utterance. Use helper functions like `truncateForSpeech(text, maxWords)`.

8. **Module structure.** CarPlay features belong in `lib/carplay/` with subdirectories for voice, nowplaying, offline, and scenes. Export everything from a barrel `index.ts`.
