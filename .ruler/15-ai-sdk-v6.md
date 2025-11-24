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

4. **Message parts.** Use canonical AI SDK v6 part types exclusively:
   - `text` - Text content
   - `reasoning` - Reasoning steps (with `text`, `state`, `providerMetadata`)
   - `tool-call` - Tool invocations (with `toolCallId`, `toolName`, `args`)
   - `tool-result` - Tool results (with `toolCallId`, `toolName`, `result`, `isError`)
   - `file` - File attachments (with `mediaType`, `url`, `filename`)
   - `source-url` - Source URLs
   - `source-document` - Source documents
   - `data-status` - Data status updates
   - `data-cache` - Cache operations
   - `step-start` - Step initiation
   - **Note:** Do NOT use legacy custom parts like `dynamic-tool`. Use `tool-call` and `tool-result` instead.

5. **No type suppressions.** Avoid `@ts-expect-error`, `@ts-ignore`, and `@ts-nocheck` unless absolutely necessary (e.g., test mocks). If type errors occur, fix the root cause:
   - Use proper type assertions (`as Type`) only after runtime validation
   - Create helper functions with proper return types
   - Validate schemas before type assertions

6. **Streaming utilities.** Use AI SDK v6 streaming utilities:
   - `streamText` for text generation streams
   - `toUIMessageStreamResponse` for HTTP responses
   - `useChat` hook for React components
   - Native stream event types from `@ai-sdk/core`

7. **Model messages.** When working with model messages:
   - Use `ModelMessage` type from `ai` package
   - Tool messages must have `role: "tool"` with `tool-result` objects in `content` array
   - Never flatten tool call/result structures

8. **Core primitives only.** All LLM, embedding, speech, transcription, or image calls must go through AI SDK Core (`generateText`, `streamText`, `generateObject`, `streamObject`, `embed`, `embedMany`, `generateImage`, `generateSpeech`, `transcribe`) with provider registries or custom providers instead of raw HTTP clients.

9. **UI hooks & transports.** Conversational or completion UIs must rely on `useChat`, `useCompletion`, or `useObject` with the documented text/data stream protocol and `DefaultChatTransport` (or a transport that fully implements the same contract) instead of ad-hoc SSE/WebSocket layers.

10. **Tool hygiene.** Define every tool using `tool()` plus Zod/JSON schemas, keep tool catalogs lean (≤5 per agent), add `.describe` metadata, prefer `.nullable` instead of `.optional`, set `temperature: 0` for structured/tool generations, and orchestrate multi-step tool flows with `stopWhen`, `steps`, `onStepFinish`, and `prepareStep`.

11. **Agents use ToolLoopAgent.** Encapsulate reusable agents with `ToolLoopAgent`, specifying instructions, toolChoice, Output schemas, and `stopWhen` limits; bespoke while-loops or manual tool orchestration require explicit approval.

12. **Structured outputs.** Use `generateObject`/`streamObject` (and `useObject` client-side) for any structured payloads or streamed JSON instead of parsing free-form text, and treat `@ai-sdk/rsc` as experimental unless the official migration guide is followed.

13. **Runtime reliability.** Implement caching, rate limiting, back-pressure, abort handling, and error hooks with the prescribed middleware (`wrapLanguageModel`, `simulateReadableStream`, Upstash KV/Ratelimit patterns, `onAbort`, `onError`) before adding custom infra.

