# AI SDK v6 Standards

## Core Principle

Always use native AI SDK v6 functionality. Never duplicate or reimplement AI SDK v6 features. Custom code introduces bugs, maintenance burden, and divergence from the framework's evolution.

## Rules

1. **Native message conversion.** Always use `convertToModelMessages` from `ai` package to convert `UIMessage[]` to `ModelMessage[]`. Never create custom conversion functions like `toModelMessages` or `transformMessages`.

2. **UIMessage format.** All message inputs to tRPC routers must accept `UIMessage[]` with full `parts` structure. Never accept simplified formats like `{ role: string, content: string }[]` or flattened message structures.

3. **Schema validation.** When validating `UIMessage[]` in tRPC routers:
   - Use `z.array(z.unknown()).min(1)` for the input schema (tRPC type compatibility)
   - Validate each message individually using `uiMessageSchema.safeParse()` in a helper function
   - Return properly typed `UIMessage[]` after validation
   - Never use `@ts-expect-error` or `@ts-ignore` to bypass validation

4. **Message parts.** Use canonical AI SDK v6 part types:
   - `text` - Text content
   - `reasoning` - Reasoning steps (with `text`, `state`, `providerMetadata`)
   - `tool-call` - Tool invocations (with `toolCallId`, `toolName`, `input`)
   - `tool-result` - Tool results (with `toolCallId`, `toolName`, `output`, `isError`)
   - `file` - File attachments (with `mediaType`, `url`, `filename`)
   - `source-url` - Source URLs
   - `source-document` - Source documents
   - `data-status` - Data status updates
   - `data-cache` - Cache operations
   - `step-start` - Step initiation
   - **Note:** AI SDK v6 uses `input`/`output`, NOT `args`/`result`. ALFRED's custom zod schema (`@alfred/type/stream.zod.ts`) uses explicit `tool-call`/`tool-result` types for persistence benefits.

5. **Streaming utilities.** Use AI SDK v6 streaming utilities:
   - `streamText` for text generation streams
   - `toUIMessageStreamResponse` for HTTP responses
   - `useChat` hook for React components
   - Native stream event types from `@ai-sdk/core`

6. **Model messages.** When working with model messages:
   - Use `ModelMessage` type from `ai` package
   - Tool messages must have `role: "tool"` with `tool-result` objects in `content` array
   - Never flatten tool call/result structures

7. **Core primitives only.** All LLM, embedding, speech, transcription, or image calls must go through AI SDK Core (`generateText`, `streamText`, `generateObject`, `streamObject`, `embed`, `embedMany`, `generateImage`, `generateSpeech`, `transcribe`) with provider registries or custom providers instead of raw HTTP clients.

8. **UI hooks & transports.** Conversational or completion UIs must rely on `useChat`, `useCompletion`, or `useObject` with the documented text/data stream protocol and `DefaultChatTransport` (or a transport that fully implements the same contract) instead of ad-hoc SSE/WebSocket layers.

9. **Tool hygiene.** Define every tool using `tool()` plus Zod/JSON schemas, keep tool catalogs lean (≤5 per agent), add `.describe` metadata, prefer `.nullable` instead of `.optional`, set `temperature: 0` for structured/tool generations, and orchestrate multi-step tool flows with `stopWhen`, `steps`, `onStepFinish`, and `prepareStep`.

10. **Agents use ToolLoopAgent.** Encapsulate reusable agents with `ToolLoopAgent`, specifying instructions, toolChoice, Output schemas, and `stopWhen` limits; bespoke while-loops or manual tool orchestration require explicit approval.

11. **Structured outputs.** Use `generateObject`/`streamObject` (and `useObject` client-side) for any structured payloads or streamed JSON instead of parsing free-form text, and treat `@ai-sdk/rsc` as experimental unless the official migration guide is followed.

12. **Runtime reliability.** Implement caching, rate limiting, back-pressure, abort handling, and error hooks with the prescribed middleware (`wrapLanguageModel`, `simulateReadableStream`, Upstash KV/Ratelimit patterns, `onAbort`, `onError`) before adding custom infra.

## ALFRED's Custom UIMessage Format

ALFRED intentionally deviates from AI SDK v6's native `ToolUIPart` format for persistence and validation benefits:

**AI SDK v6 Native Format:**
- Tool parts use `type: "tool-${toolName}"` (e.g., `tool-weather`)
- Single part represents entire tool lifecycle with `state` property
- Rich state machine: `input-streaming` → `input-available` → `approval-requested` → `output-available`

**ALFRED's Custom Format (`@alfred/type/stream.zod.ts`):**
- Explicit `type: "tool-call"` and `type: "tool-result"` discriminants
- Separate parts for call and result (easier to persist/query)
- Uses `input`/`output` properties (matches v6 naming)

**Why the deviation:**
1. **Persistence simplicity** - Static type discriminants are easier to index/query
2. **Serialization determinism** - Explicit types serialize predictably
3. **Validation clarity** - Zod discriminated unions work cleanly
4. **History reconstruction** - Separate parts make replay straightforward

**Type guard implications:**
- TypeScript's AI SDK types don't include ALFRED's custom part types
- Type guards must accept `unknown` and return explicit predicates
- Use `as unknown as ToolCallPart` after guards with explanatory comments
- See `@alfred/ui/chat/parts.ts` for canonical type guards

