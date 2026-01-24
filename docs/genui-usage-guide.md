# Generative UI Framework - Usage Guide

## Overview

The Generative UI (GenUI) framework enables ALFRED to dynamically generate and render UI components based on LLM tool outputs. Instead of returning static text, tools can return rich, interactive visualizations that the model selects based on conversation context.

## Quick Start

### 1. Creating a Tool with GenUI

Use the helper functions to create tool results with UI:

```typescript
import { createChartResult } from "@alfred/ui/genui";

export const myTool = tool({
  description: "Get task progress",
  parameters: z.object({ projectId: z.string() }),
  execute: async ({ projectId }) => {
    const tasks = await getTasks(projectId);
    const data = [
      { x: "Done", y: tasks.filter((t) => t.status === "done").length },
      {
        x: "In Progress",
        y: tasks.filter((t) => t.status === "in_progress").length,
      },
      { x: "Blocked", y: tasks.filter((t) => t.status === "blocked").length },
    ];

    // Returns both UI and raw data
    return createChartResult("Task Progress", data, { tasks });
  },
});
```

### 2. Available Helper Functions

```typescript
// Visualization helpers
createChartResult(title, data, rawData);
createGridResult(columns, items, rawData);
createListResult(items, rawData);
createNumberResult(value, label, rawData);

// Terminal and code helpers
createTermResult(output, rawData);
createCodeResult(code, language, rawData);

// State helpers
createLoadingResult(message);
createPlanResult(plan, rawData);
createTaskResult(task, rawData);
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

### Core Visualization Components

**chart** - Data visualization

- Props: `{ type, data, title, height?, width? }`
- Types: `"line"`, `"bar"`, `"pie"`, `"area"`

**grid** - Layout grid

- Props: `{ columns, gap?, className? }`
- Children: Any other components

**list** - Animated list

- Props: `{ items, animated? }`

**number** - Sliding number display

- Props: `{ value, label?, format?, duration? }`

**term** - Terminal output

- Props: `{ output, theme?, readOnly? }`

**code** - Code block

- Props: `{ code, language, fileName?, showLineNumbers? }`

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
  result.map((r) => ({ x: r.date, y: r.completionRate })),
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
import { createGenUIObjectConfig } from "@alfred/ui/genui/streaming";

// In a component
const { object, submit } = useObject({
  api: "/api/generate-dashboard",
  schema: uiComponentSchema,
  onFinish: ({ object }) => {
    setDashboard(object);
  },
});

// Shows skeleton while streaming
{object?.partial && <StreamingUIRenderer schema={object.partial} />}
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

Test GenUI components with the test utilities:

```typescript
import { render } from "@testing-library/react";
import { UISchemaRenderer } from "@alfred/ui/genui";

test("renders chart component", () => {
  const schema: UIComponent = {
    component: "chart",
    props: { type: "bar", data: [{ x: "A", y: 10 }], title: "Test" },
  };

  const { getByText } = render(<UISchemaRenderer schema={schema} />);
  expect(getByText("Test")).toBeInTheDocument();
});
```

## Debugging

Enable debug mode to see schema validation and rendering details:

```typescript
// In .env.local
VITE_GENUI_DEBUG = 1;
```

This will log:

- Schema validation results
- Component resolution attempts
- Render failures with stack traces
- Performance metrics

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
