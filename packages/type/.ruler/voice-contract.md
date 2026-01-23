# Voice Contract Types

## Core Principle

Voice streaming types define the protocol between voice servers and clients. Every structured payload must have a corresponding Zod schema and parser helper for runtime validation.

## Rules

1. **Type + schema parity.** Every voice payload type (e.g., `VoiceAssistantRaw`) must have a matching Zod schema in `voice.zod.ts`. Keep them adjacent and in sync.

2. **Parser helpers.** Export `parse<TypeName>()` functions that return `{ ok: true; value: T } | { ok: false; error: string }`. Never throw from parsers—callers decide error handling.

3. **UIMessage reuse.** `VoiceAssistantRaw.uiMessages` uses the existing `UIMessage[]` type and `uiMessageSchema`. Don't create parallel message structures.

4. **Optional meta.** The `meta` field uses `.passthrough()` to allow future keys. Required fields (`runId`, `planId`) are explicitly typed; extras are allowed.

5. **Discriminated events.** `VoiceStreamServerEvent` is a discriminated union on `_`. New event types add to the union; don't mutate existing event shapes.

6. **Backward compatibility.** The `raw` field on `assistant_message` is optional. Older clients that don't parse it still receive `text`. Newer clients check `raw` for structured data.

7. **Test coverage.** `packages/type/test/voice.test.ts` must cover valid payloads with GenUI parts, workflow metadata, and rejection of invalid structures.
