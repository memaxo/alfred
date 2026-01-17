# Generative UI Framework

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This plan must be maintained in accordance with `.agent/PLANS.md`.

Owner: web

## Purpose / Big Picture

After this work, ALFRED can dynamically generate and render UI components based on LLM tool outputs, enabling richer AI-native interfaces that go beyond static text responses. A user chatting with ALFRED will see contextually appropriate visualizations (charts, progress indicators, data grids, interactive forms) that the model selects and configures based on the conversation, rather than relying solely on predefined response templates.

This matters because current chat UIs are limited to text + a fixed set of hardcoded tool renderers. Generative UI enables the model to act as a "dynamic router" that understands user intent and displays the most relevant UI component with appropriate data, creating more engaging and productive interactions.

Observable outcome: After completing this work, a user can ask ALFRED a question like "Show me my task progress" and receive a dynamically rendered progress visualization, or ask "What's the weather?" and see a weather card component—all without requiring new tool-specific code for each use case.

## Progress

- (2026-01-17) Pattern exploration: Identified existing component manifest, part rendering, and AI SDK v6 patterns.
- (2026-01-17) Architecture analysis: Documented three architectural options (A, B, C) with tradeoffs.
- (2026-01-17) Milestone 1: Architecture decision (Option B) and proof of concept.
  - Created `packages/type/src/genui.ts` with UIComponent, UIDataPart types
  - Created `packages/type/src/genui.zod.ts` with Zod v4 validation schemas
  - Created `packages/ui/src/genui/registry.ts` with dynamic component registry
  - Created `packages/ui/src/genui/interpreter.tsx` with recursive schema interpreter
  - Created `packages/ui/src/genui/index.ts` with public exports
  - Added 24 passing tests covering registry, interpreter, validation, and type guards
- (2026-01-17) Milestone 2: Auto-register manifest components at app initialization.
  - Created `apps/web/src/components/genui/registry.ts` with lazy component imports
  - Created `apps/web/src/components/genui/index.ts` with re-exports
  - Added `initGenUIRegistry()` call in `apps/web/src/router.tsx`
  - Registered core GenUI components: chart, grid, list, number, term, code, plan, task, loading
- (2026-01-17) Milestone 3: Error boundary for graceful degradation.
  - Created `packages/ui/src/genui/boundary.tsx` with `GenUIErrorBoundary` class component
  - Added `withGenUIErrorBoundary` HOC for wrapping components
  - Added 3 tests for error boundary exports and HOC behavior
- (2026-01-17) Milestone 4: Integration with chat-render.tsx (add data-ui part renderer).
  - Added `renderGenUI` function to `apps/web/src/components/chat-render.tsx`
  - Uses `isUIDataPart` guard to detect `data-ui` parts
  - Renders via `UISchemaRenderer` wrapped in `GenUIErrorBoundary`
  - Placed first in `dataPartRenderers` array for priority handling
- (2026-01-17) Milestone 5: Tool integration (convention for tools returning GenUIToolResult).
  - Created `packages/ui/src/genui/tool.ts` with helper functions:
    - `createGenUIResult` - generic result builder
    - `createChartResult`, `createGridResult`, `createListResult` - visualization helpers
    - `createTermResult`, `createCodeResult` - terminal/code helpers
    - `createLoadingResult`, `createPlanResult`, `createTaskResult` - state helpers
  - Added 9 tests for tool integration utilities
  - Total: 36 passing tests
- (2026-01-17) Milestone 6: Streaming UI support with useObject pattern.
  - Created `packages/ui/src/genui/streaming.tsx` with:
    - `GenUISkeleton` component with variants (default, chart, list, card)
    - `StreamingUIRenderer` for progressive schema rendering
    - `createGenUIObjectConfig` helper for AI SDK useObject integration
    - `isPartialSchemaRenderable` validation utility
  - Added 13 tests for streaming functionality
  - Total: 49 passing tests
- (2026-01-17) Milestone 7: Documentation (.ruler/genui-patterns.md).
  - Created `.ruler/genui-patterns.md` with usage rules and code examples
  - Ran `ruler:apply` to regenerate AI instructions
  - Documented architecture, registration, tool integration, and available components
- (2026-01-17) Milestone 8: Web chat “happy path” proof (tool-result + tests).
  - Added tool-result rendering for `GenUIToolResult` outputs in `apps/web/src/components/chat-render.tsx`
  - Added `extractGenUISchema()` helper in `packages/ui/src/chat/parts.ts`
  - Added explicit `@alfred/ui` subpath exports for `@alfred/ui/genui` and `@alfred/ui/chat/parts`
  - Added web integration tests in `apps/web/src/components/__tests__/genui.test.tsx`

## Surprises & Discoveries

- Observation: The codebase already has 50 integrated components in `apps/web/src/components/manifest.ts`, providing a rich palette for generative UI without new component development.
Evidence: `componentStatus` shows all 50 components as "integrated" with verified usage sites.
- Observation: AI SDK RSC (`streamUI`) is marked experimental and Vercel recommends AI SDK UI hooks for production.
Evidence: `docs/reference/ai-sdk-v6/ai-sdk-rsc_streaming-react-components.md` states "AI SDK RSC is currently experimental. We recommend using AI SDK UI for production."
- Observation: ALFRED uses explicit `tool-call` and `tool-result` part types rather than AI SDK's `tool-${toolName}` pattern for better persistence.
Evidence: `packages/ui/src/chat/parts.ts` defines custom `ToolCallPart` and `ToolResultPart` types.
- Observation: Zod v4 has breaking changes from v3. `z.record()` requires explicit key schema (e.g., `z.record(z.string(), z.unknown())`), and `.default()` behavior changed.
Evidence: Initial schema using `z.record(z.unknown()).default({})` failed type checking. Fixed by using `z.record(z.string(), z.unknown()).optional().transform(val => val ?? {})`.

## Decision Log

- Decision: Evaluate three architectural options before implementation.
Rationale: Generative UI has multiple valid approaches; premature commitment risks rework.
Date/Author: 2026-01-17 / Codex
- Decision: Selected Option B (Schema-Based Component Generation) with Option A fallback.
Rationale: Option B provides maximum flexibility for model-selected components while maintaining type safety through Zod validation. Option A patterns preserved for existing tools with fixed UI bindings. Option C (RSC streamUI) deferred due to experimental status and TanStack Start compatibility concerns.
Date/Author: 2026-01-17 / Codex

## Outcomes & Retrospective

### Completed (2026-01-17)

**Core Framework Delivered:**
- UIComponent schema system with Zod v4 validation
- Dynamic component registry with lazy loading
- Schema interpreter with recursive rendering support
- Error boundary for graceful degradation
- Chat rendering integration via `data-ui` parts
- Chat rendering integration via tool-result outputs shaped like `GenUIToolResult`
- Tool helper functions for common patterns
- Streaming UI support with skeleton states
- Documentation in `.ruler/genui-patterns.md`
- Web integration tests for GenUI chat rendering

**Test Coverage:**
- 49 passing tests across 6 test suites
- Registry, interpreter, validation, type guards, boundary, tool integration, streaming
- Web integration tests cover: data-ui rendering, unknown component placeholder, malformed data-ui handling, error boundary fallback, tool-result GenUI output rendering

**Files Created:**
- `packages/type/src/genui.ts` - Core types
- `packages/type/src/genui.zod.ts` - Validation schemas
- `packages/ui/src/genui/*` - Registry, interpreter, boundary, tool, streaming, index
- `apps/web/src/components/genui/*` - App-level registration and re-exports
- `.ruler/genui-patterns.md` - Documentation

**Files Modified:**
- `packages/type/package.json` - Added genui exports
- `packages/type/src/index.ts` - Added genui re-exports
- `apps/web/src/router.tsx` - Added registry initialization
- `apps/web/src/components/chat-render.tsx` - Added data-ui renderer

### Additional Work Completed (2026-01-17)

**Model Capability System:**
- Added `ModelCapability` type to `@alfred/type/model.ts`
- Implemented capability detection by model ID pattern
- Added `hasCapability()` and `supportsGenUI()` helper functions
- Extended `ModelSelection` to include capabilities array
- Added 7 tests for capability detection

**Orchestrator UI Components:**
- Created `packages/ui/src/genui/orchestrator.tsx` with:
  - `StreamingTerminal` - Real-time log streaming
  - `ProgressWindow` - Long-running operation tracking
  - `WorkflowTimeline` - Workflow execution visualization
  - `TaskTracker` - Async task tracking (UPID, etc.)
  - `ErrorPanel` - Error visualization
  - `ArtifactBrowser` - Output artifact management
  - `ResourceMonitor` - Container/VM resource monitoring
- Added 14 tests for orchestrator components and helpers
- Total: 63 passing tests in genui package, 22 in selector

### Remaining Work
None - all milestones complete.

## Context and Orientation

This plan applies to the ALFRED monorepo, specifically the web application under `apps/web/` and shared packages under `packages/`.

Key terms used in this plan:

- **Generative UI**: The ability for an LLM to select and configure UI components dynamically based on conversation context, rather than returning only text.
- **Part**: A structured segment of an AI SDK message (text, reasoning, tool-call, tool-result, data-*).
- **Tool**: A function the model can invoke to perform actions or retrieve data; tools have schemas and return structured outputs.
- **Component Manifest**: The registry at `apps/web/src/components/manifest.ts` that defines all available UI components.
- **Part Renderer**: A function that converts a message part into a React component for display.

Relevant files and their roles:

```
apps/web/src/components/manifest.ts
  - componentRegistry: Maps 50 component names to their source URLs
  - componentStatus: Tracks implementation status (all "integrated")
  - componentUsage: Verifies each component is used in production code

apps/web/src/components/chat-render.tsx
  - renderAssistantPart(): Main entry point for rendering message parts
  - partRenderers[]: Array of renderer functions tried in sequence
  - dataPartRenderers[]: Renderers for structured data-* parts

packages/ui/src/chat/parts.ts
  - Type guards: isTextPart, isToolCallPart, isToolResultPart, etc.
  - extractStructuredData(): Extracts typed data from parts
  - ToolInvocationState: State machine for tool execution lifecycle

apps/web/src/components/ai-elements/
  - Individual AI SDK element implementations (tool.tsx, plan.tsx, etc.)

packages/type/src/stream.ts
  - UIMessage type definition
  - Message part type unions
```

Current state (baseline):

The current system supports tool-based UI through hardcoded renderers in `chat-render.tsx`. Each tool name maps to a specific renderer function. Adding a new tool-to-component mapping requires modifying `chat-render.tsx` directly. There is no dynamic registration or schema-driven component selection.

## Architecture Options Comparison

This section compares three approaches to implementing Generative UI. Each has distinct tradeoffs in flexibility, type safety, complexity, and alignment with AI SDK patterns.

### Option A: Extended Tool-Based Pattern

Extend the current tool-based approach where tools explicitly declare their UI component.

How it works:

1. Each tool definition includes a `uiComponent` field naming the manifest component.
2. Tool execution returns structured data matching the component's props.
3. A dynamic renderer looks up the component by name and renders with the output data.
  // Tool definition with UI binding
    export const weatherTool = createTool({
      description: 'Get weather for a location',
      inputSchema: z.object({ location: z.string() }),
      uiComponent: 'chart', // References manifest component
      execute: async ({ location }) => ({
        type: 'line',
        data: [{ hour: '9am', temp: 52 }, { hour: '10am', temp: 54 }],
        title: `Weather in ${location}`,
      }),
    });
    // Dynamic renderer
    function renderToolWithUI(part: ToolResultPart) {
      const tool = getToolDefinition(part.toolName);
      const Component = resolveComponent(tool.uiComponent);
      return <Component {...part.output} />;
    }

Pros:

- Builds on existing patterns; minimal new concepts.
- Type-safe: tool output schema matches component props.
- Predictable: each tool has exactly one UI representation.
- Easy to test: tool → component mapping is explicit.

Cons:

- Limited flexibility: cannot change UI based on output data.
- Requires tool modification to add UI bindings.
- No runtime component selection by the model.

Files to modify:

- `packages/agent/src/tools/` - Add `uiComponent` to tool definitions
- `apps/web/src/components/chat-render.tsx` - Add dynamic renderer
- `packages/type/src/tool.ts` - Extend tool type with UI binding

### Option B: Schema-Based Component Generation

The model returns a structured UI schema that describes component composition; the client interprets and renders it.

How it works:

1. Define a `UISchema` Zod type that describes component trees.
2. Tools (or the model directly via `generateObject`) return `UISchema` objects.
3. A schema interpreter renders the component tree recursively.
  // UI Schema type
    const UIComponentSchema = z.object({
      component: z.enum(['chart', 'number', 'grid', 'task', 'plan', ...]),
      props: z.record(z.unknown()),
      children: z.array(z.lazy(() => UIComponentSchema)).optional(),
    });
    // Model returns schema
    const result = await generateObject({
      model: openai('gpt-4o'),
      schema: UIComponentSchema,
      prompt: 'Generate a dashboard showing task progress',
    });
    // Schema interpreter
    function renderUISchema(schema: UIComponent): ReactNode {
      const Component = resolveComponent(schema.component);
      return (
        <Component {...schema.props}>
          {schema.children?.map(renderUISchema)}
  ```
  );
  ```
    }

Pros:

- Maximum flexibility: model chooses components dynamically.
- Composable: supports nested component trees.
- Decoupled: tools don't need UI knowledge.
- Extensible: add components to manifest without code changes.

Cons:

- Type safety challenges: props must be validated at runtime.
- Model hallucination risk: may generate invalid schemas.
- More complex: requires schema validation and error handling.
- Performance: schema parsing adds overhead.

Files to modify:

- `packages/type/src/genui.ts` - New file for UI schema types
- `packages/ui/src/genui/schema.ts` - Schema validation
- `packages/ui/src/genui/interpreter.tsx` - Schema interpreter
- `apps/web/src/components/chat-render.tsx` - Wire interpreter

### Option C: React Server Components with streamUI

Use AI SDK RSC's `streamUI` to stream React components from server to client.

How it works:

1. Server Actions call `streamUI` with tools that return React components.
2. Components stream progressively as the model generates.
3. State is split into AI State (serializable) and UI State (React elements).
  // Server Action
    export async function generateUI(prompt: string) {
      'use server';
  ```
  const result = await streamUI({
    model: openai('gpt-4o'),
    prompt,
    text: ({ content }) => <Markdown>{content}</Markdown>,
    tools: {
      showWeather: {
        description: 'Show weather for a location',
        inputSchema: z.object({ location: z.string() }),
        generate: async function* ({ location }) {
          yield <Loading />;
          const weather = await getWeather(location);
          return <WeatherCard {...weather} />;
        },
      },
    },
  });

  return result.value;
  ```
    }
    // Client
    const [ui, setUI] = useState(null);
    const handleSubmit = async () => {
      setUI(await generateUI(input));
    };

Pros:

- True server-rendered components: rich interactivity.
- Progressive streaming: shows loading states naturally.
- AI SDK native: uses official patterns.
- State management: AI/UI state separation handles serialization.

Cons:

- Experimental: AI SDK RSC is not production-recommended.
- Next.js specific: requires React Server Components.
- TanStack Start compatibility: may need adaptation.
- Complexity: Server Actions, state splitting, hydration.

Files to modify:

- `apps/web/src/actions/genui.ts` - New server actions
- `apps/web/src/components/genui/provider.tsx` - AI context provider
- `apps/web/src/hooks/use-genui.ts` - Client hooks
- TanStack Start adaptation may require investigation

### Architecture Recommendation

**Recommended: Option B (Schema-Based) with Option A fallback**

Rationale:

1. Option B provides the flexibility needed for true "generative" UI where the model selects components.
2. Option A patterns already exist and should be preserved for tools with fixed UI bindings.
3. Option C is experimental and has framework compatibility concerns with TanStack Start.

Implementation strategy:

1. Implement Option B as the primary generative UI system.
2. Keep Option A patterns for existing tools that have explicit UI bindings.
3. Allow tools to opt into either pattern via configuration.
4. Revisit Option C when AI SDK RSC stabilizes and if TanStack Start adds RSC support.

## Plan of Work

### Milestone 1: Architecture Proof of Concept

At the end of this milestone, a minimal schema-based UI renderer exists and can render a component tree from a hardcoded schema. This validates the approach before full implementation.

Work:

1. Create `packages/type/src/genui.ts` with the `UIComponentSchema` Zod type.
2. Create `packages/ui/src/genui/interpreter.tsx` with `renderUISchema()`.
3. Create a test component that renders a hardcoded schema.
4. Verify the schema can describe: single component, nested components, props passing.

Acceptance:

Running `bun test packages/ui/src/genui/` passes with tests covering:

- Single component rendering
- Nested component trees
- Invalid schema rejection
- Unknown component fallback

### Milestone 2: Dynamic Component Registry

At the end of this milestone, components can be registered dynamically and resolved by name at runtime, decoupling the renderer from hardcoded imports.

Work:

1. Create `packages/ui/src/genui/registry.ts` with `registerComponent()` and `resolveComponent()`.
2. Auto-register all manifest components at app initialization.
3. Add fallback rendering for unknown components.
4. Wire registry into the schema interpreter.

Acceptance:

The registry can resolve all 50 manifest components by name.
Unknown component names render a placeholder with the component name.

### Milestone 3: UI Schema Validation and Error Handling

At the end of this milestone, schemas are validated before rendering with clear error messages for invalid schemas or props.

Work:

1. Add prop schema validation using component-specific Zod schemas.
2. Create error boundary component for rendering failures.
3. Add development-mode warnings for schema issues.
4. Implement graceful degradation (show raw data on render failure).

Acceptance:

Invalid schemas produce clear error messages.
Rendering failures are contained and don't crash the chat.

### Milestone 4: Integration with Chat Rendering

At the end of this milestone, the chat renderer can handle `data-ui` parts containing UI schemas, displaying them inline with other message content.

Work:

1. Add `data-ui` part type to `packages/type/src/stream.ts`.
2. Add `isUIDataPart()` type guard to `packages/ui/src/chat/parts.ts`.
3. Add UI schema renderer to `dataPartRenderers[]` in `chat-render.tsx`.
4. Test with real chat messages containing UI schemas.

Acceptance:

A message with a `data-ui` part renders the described component tree.
The component integrates visually with other chat content.

### Milestone 5: Tool Integration

At the end of this milestone, tools can return UI schemas and have them rendered automatically.

Work:

1. Define convention: tools return `{ ui: UISchema, data: unknown }` for generative UI.
2. Update tool result rendering to detect and handle UI schemas.
3. Create example tools that use generative UI.
4. Document the pattern for tool authors.

Acceptance:

A tool can return a UI schema that renders as a component.
Existing tools without UI schemas continue working unchanged.

### Milestone 6: Streaming UI Support

At the end of this milestone, long-running tools can stream UI updates progressively.

Work:

1. Implement `useObject` pattern for streaming schema updates.
2. Add skeleton/loading states during streaming.
3. Handle partial schema updates gracefully.
4. Test with slow tool execution.

Acceptance:

A slow tool shows progressive UI updates as data arrives.
Partial schemas render partial UIs without errors.

### Milestone 7: Testing and Documentation

At the end of this milestone, the generative UI system has comprehensive tests and documentation.

Work:

1. Add unit tests for registry, schema validation, interpreter.
2. Add integration tests for end-to-end rendering.
3. Create `.ruler/genui-patterns.md` with usage guidelines.
4. Add JSDoc comments to all public APIs.
5. Create example implementations.

Acceptance:

Test coverage exceeds 80% for new code.
Documentation enables a novice to add generative UI to a tool.

## Concrete Steps

All commands run from the repository root unless stated otherwise.

Milestone 1 setup:

```
mkdir -p packages/ui/src/genui
touch packages/type/src/genui.ts
touch packages/ui/src/genui/interpreter.tsx
touch packages/ui/src/genui/registry.ts
touch packages/ui/src/genui/index.ts
```

Type checking after changes:

```
cd packages/type && bun run typecheck
cd packages/ui && bun run typecheck
```

Running tests:

```
bun test packages/ui/src/genui/
```

Full validation:

```
bun run typecheck
bun test
```

## Validation and Acceptance

This plan is complete when:

1. A UI schema can describe any of the 50 manifest components.
2. Nested component trees render correctly.
3. Invalid schemas produce clear errors without crashing.
4. Tools can return UI schemas that render inline in chat.
5. Streaming updates work for long-running operations.
6. Test coverage exceeds 80% for generative UI code.
7. Documentation exists in `.ruler/genui-patterns.md`.

Observable demonstration:

After implementation, this interaction should work:

```
User: "Show me a dashboard with my task progress and recent activity"

ALFRED responds with a data-ui part containing:
{
  "component": "grid",
  "props": { "columns": 2 },
  "children": [
    {
      "component": "chart",
      "props": { "type": "bar", "data": [...], "title": "Task Progress" }
    },
    {
      "component": "list",
      "props": { "items": [...] }
    }
  ]
}

The chat renders: A two-column grid with a bar chart and an animated list.
```

## Idempotence and Recovery

All steps are additive. The generative UI system runs alongside existing renderers.

If a component fails to register, the registry logs a warning and continues.
If a schema fails to render, the error boundary shows a fallback.
If streaming fails mid-update, the last valid state is preserved.

Rollback: Delete `packages/ui/src/genui/` and remove the `data-ui` renderer from `chat-render.tsx`.

## Artifacts and Notes

Key type definitions (to be implemented):

```
// packages/type/src/genui.ts
import { z } from "zod";
import type { ComponentName } from "@alfred/web/components/manifest";

export const UIComponentSchema: z.ZodType<UIComponent> = z.object({
  component: z.string(), // Will be narrowed to ComponentName
  props: z.record(z.unknown()).default({}),
  children: z.array(z.lazy(() => UIComponentSchema)).optional(),
});

export type UIComponent = {
  component: string;
  props: Record<string, unknown>;
  children?: UIComponent[];
};

export const UIDataPart = z.object({
  type: z.literal("data-ui"),
  ui: UIComponentSchema,
});
```

Registry interface:

```
// packages/ui/src/genui/registry.ts
type ComponentResolver = (name: string) => React.ComponentType<any> | null;

export function registerComponent(name: string, component: React.ComponentType<any>): void;
export function resolveComponent(name: string): React.ComponentType<any>;
export function getRegisteredComponents(): string[];
```

## Interfaces and Dependencies

Dependencies (already in monorepo):

- `zod` - Schema validation
- `react` - Component rendering
- `@alfred/type` - Shared types
- `@alfred/ui` - UI utilities

New exports from `packages/ui`:

```
// packages/ui/src/genui/index.ts
export { UIComponentSchema, type UIComponent, UIDataPart } from "@alfred/type/genui";
export { registerComponent, resolveComponent } from "./registry";
export { renderUISchema, UISchemaRenderer } from "./interpreter";
export { GenUIErrorBoundary } from "./error-boundary";
```

Integration with existing code:

```
// apps/web/src/components/chat-render.tsx
import { isUIDataPart, renderUISchema } from "@alfred/ui/genui";

const dataPartRenderers: PartRenderer[] = [
  // ... existing renderers
  (part) => {
    if (isUIDataPart(part)) {
      return renderUISchema(part.ui);
    }
    return null;
  },
];
```

---

## Revision Notes

- 2026-01-17: Initial plan created with architecture comparison of options A, B, C. Recommended Option B (schema-based) with Option A fallback. Defined 7 milestones for implementation.

