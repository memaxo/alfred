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
   - `tool-call` - Tool invocations (with `toolCallId`, `toolName`, `input`)
   - `tool-result` - Tool results (with `toolCallId`, `output`)
   - `file` - File attachments (with `mediaType`, `url`, `filename`)
   - `source-url` - Source URLs
   - `source-document` - Source documents
   - `data-status` - Data status updates
   - `data-cache` - Cache operations
   - `step-start` - Step initiation

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


