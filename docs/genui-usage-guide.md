# Generative UI Framework - Usage Guide

## Overview

The Generative UI (GenUI) framework enables ALFRED to dynamically generate and render UI components based on LLM tool outputs. Instead of returning static text, tools can return rich, interactive visualizations that the model selects based on conversation context.

This guide applies to **ALFRED itself** (the web chat UI under `apps/web/` and shared packages under `packages/`), not to applications ALFRED generates.

## Quick Start

### 1. Returning GenUI from a tool

Tools can return a **GenUIToolResult** (a `{ ui, data }` object). The UI is rendered; the raw data is preserved for persistence and fallback rendering.

```typescript
import { createChartResult } from "@alfred/ui/genui";

export const myTool = tool({
  description: "Get task progress",
  parameters: z.object({ projectId: z.string() }),
  execute: async ({ projectId }) => {
    const tasks = await getTasks(projectId);
    const data = [
      { x: "Done", y: tasks.filter(t => t.status === "done").length },
      { x: "In Progress", y: tasks.filter(t => t.status === "in_progress").length },
      { x: "Blocked", y: tasks.filter(t => t.status === "blocked").length },
    ];
    
    // Returns both UI and raw data
    return createChartResult("Task Progress", data, { tasks });
  },
});
```

### 2. Message formats supported by the web chat renderer

The web chat renderer supports two canonical GenUI shapes:

- **`data-ui` message part** (inline part on a message)

```json
{
  "type": "data-ui",
  "ui": { "component": "task", "props": { "title": "Ship GenUI" } }
}
```

- **Tool output** (a tool-result `output` shaped like `GenUIToolResult`)

```json
{
  "ui": { "component": "task", "props": { "title": "Ship GenUI" } },
  "data": { "any": "json-serializable payload" }
}
```

### 2. Available Helper Functions

```typescript
// Visualization helpers
createChartResult(title, data, rawData);
createGridResult(children, rawData, cols?);
createListResult(items, rawData);

// Terminal and code helpers
createTermResult(title, lines, rawData);
createCodeResult(code, language, rawData);

// State helpers
createLoadingResult(message);
createPlanResult(requirement, tasks, rawData);
createTaskResult(id, title, status, progress, rawData);
```

### 3. Manual Schema Construction

For advanced use cases, construct UI schemas manually:

```typescript
import type { UIComponent } from "@alfred/type/genui";

const schema: UIComponent = {
  component: "grid",
  props: { columns: 2 },
  children: [
    {
      component: "chart",
      props: { type: "bar", data: [...], title: "Progress" },
    },
    {
      component: "list",
      props: { items: [...] },
    },
  ],
};

return {
  ui: schema,
  data: { /* raw data for persistence */ },
};
```

## Available Components

Component names must match what’s registered in the GenUI registry. In ALFRED web, default registration happens in `apps/web/src/components/genui/registry.ts`.

Core components registered at app init:
- `chart`
- `grid`
- `list`
- `number`
- `term`
- `code`
- `plan`
- `task`
- `loading`

### Orchestrator Components

For technical operations and workflow visualization:

**streaming-terminal** - Real-time log streaming
- Props: `{ stream, title, status }`

**progress-window** - Long-running operation tracking
- Props: `{ progress, total, message, status }`

**workflow-timeline** - Workflow execution visualization
- Props: `{ stages, currentStage, status }`

**task-tracker** - Async task tracking (UPID, etc.)
- Props: `{ taskId, status, progress, logs }`

**error-panel** - Error visualization
- Props: `{ error, stack, context }`

**artifact-browser** - Output artifact management
- Props: `{ artifacts, onSelect }`

**resource-monitor** - Container/VM resource monitoring
- Props: `{ cpu, memory, disk, network }`

## Patterns

### Pattern 1: Simple Data Visualization

```typescript
// Tool returns chart
const result = await getTasks();
return createChartResult(
  "Task Completion Rate",
  result.map(r => ({ x: r.date, y: r.completionRate })),
  { tasks: result }
);
```

### Pattern 2: Composite Layout

```typescript
// Build complex layouts with grid
return {
  ui: {
    component: "grid",
    props: { columns: 2 },
    children: [
      {
        component: "number",
        props: { value: stats.total, label: "Total Tasks" },
      },
      {
        component: "number",
        props: { value: stats.done, label: "Completed" },
      },
      {
        component: "chart",
        props: { type: "bar", data: chartData, title: "By Status" },
      },
      {
        component: "list",
        props: { items: recentTasks },
      },
    ],
  },
  data: stats,
};
```

### Pattern 3: Streaming UI

For long-running operations, use the streaming pattern:

```typescript
import { createGenUIObjectConfig, StreamingUIRenderer } from "@alfred/ui/genui";
import { uiComponentSchema } from "@alfred/type/genui.zod";

// In a component
const { object, submit } = useObject({
  api: "/api/generate-dashboard",
  schema: uiComponentSchema,
  onFinish: ({ object }) => {
    setDashboard(object);
  },
});

// Shows skeleton while streaming
<StreamingUIRenderer schema={object?.partial} isStreaming={isLoading} />
```

## Error Handling

Always wrap GenUI renders in error boundaries:

```typescript
import { GenUIErrorBoundary } from "@alfred/ui/genui";

<GenUIErrorBoundary schema={uiSchema}>
  <UISchemaRenderer schema={uiSchema} />
</GenUIErrorBoundary>
```

## Model Capability Checking

Not all models support structured output. Check before requesting GenUI:

```typescript
import { supportsGenUI } from "@alfred/agent/selector";

const selection = getModelForRole("assistant");
if (supportsGenUI(selection)) {
  // Can use GenUI
  return createChartResult(...);
} else {
  // Fall back to text
  return formatAsText(data);
}
```

## Best Practices

1. **Always include raw data** - Tool results must include both `ui` and `data` for persistence
2. **Keep trees shallow** - Max 5 levels of nesting to prevent performance issues
3. **Use helpers** - Prefer `createChartResult()` over manual schema construction
4. **Validate schemas** - Use `validateUIComponent()` for untrusted data
5. **Handle errors** - Wrap renders in `GenUIErrorBoundary`
6. **Check capabilities** - Verify model supports structured output with `supportsGenUI()`

## Testing

GenUI web chat rendering tests live in `apps/web/src/components/__tests__/genui.test.tsx`.

Because the GenUI registry is process-global, prefer isolating the test file when running locally:

```bash
ALFRED_TEST_ISOLATE_FILES=1 bun ./scripts/test-bun.ts apps/web/src/components/__tests__/genui.test.tsx
```

To test `@alfred/ui` GenUI helpers:

```bash
ALFRED_TEST_ISOLATE_FILES=1 bun ./scripts/test-bun.ts packages/ui/src/genui/__tests__/genui.test.tsx
```

Example (schema renderer):

```typescript
import { render } from "@testing-library/react";
import { UISchemaRenderer } from "@alfred/ui/genui";

test("renders chart component", () => {
  const schema: UIComponent = {
    component: "chart",
    props: { type: "bar", data: [{ x: "A", y: 10 }], title: "Test" },
  };
  
  const { getByText } = render(<UISchemaRenderer schema={schema} />);
  expect(getByText("Test")).toBeTruthy();
});
```

## Debugging

If you need deeper visibility, add targeted logging around component registration (`apps/web/src/components/genui/registry.ts`) or message rendering (`apps/web/src/components/chat-render.tsx`). There is no dedicated `VITE_GENUI_DEBUG` flag wired at the moment.

## Migration from Static Renderers

If you have existing tools with hardcoded UI:

**Before:**
```typescript
// Tool with custom renderer
export const weatherTool = tool({
  execute: async () => ({ temp: 72, conditions: "sunny" }),
});

// Custom renderer in chat-render.tsx
if (part.toolName === "weather") {
  return <WeatherCard {...part.output} />;
}
```

**After:**
```typescript
// Tool with GenUI
export const weatherTool = tool({
  execute: async () => {
    const weather = await getWeather();
    return createGenUIResult(
      {
        component: "weather-card",
        props: weather,
      },
      weather
    );
  },
});

// No custom renderer needed - GenUI handles it
```

## Examples

See `packages/ui/src/genui/__tests__/` for comprehensive examples of:
- All core components
- Nested layouts
- Streaming updates
- Error handling
- Validation patterns

## Further Reading

- [ExecPlan](/docs/execplans/generative-ui-framework.md) - Implementation details
- [Ruler Patterns](/.ruler/genui-patterns.md) - Coding standards
- [Component Manifest](/apps/web/src/components/manifest.ts) - Available components
