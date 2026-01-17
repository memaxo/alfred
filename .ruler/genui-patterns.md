# Generative UI Patterns

## Overview

GenUI enables LLM-generated dynamic UI components. Tools can return UI schemas that are interpreted and rendered using registered components.

## Rules

1. **Register before render.** Call `initGenUIRegistry()` at app startup to register components with the interpreter.

2. **Use data-ui parts.** Return `{ type: "data-ui", ui: UIComponent }` parts from tools for dynamic rendering.

3. **Wrap with error boundary.** Always wrap GenUI renders in `GenUIErrorBoundary` for graceful degradation.

4. **Prefer helper functions.** Use `createChartResult`, `createGridResult`, etc. over manual schema construction.

5. **Include raw data.** Tool results must include both `ui` and `data` for persistence and fallback.

6. **Single-word component names.** Component names in schemas must match manifest entries exactly.

7. **Validate before render.** Use `validateUIComponent` to check schemas from untrusted sources.

8. **Max depth limit.** Keep component trees shallow (max 5 levels) to prevent render performance issues.

9. **Model capability.** Check `supportsGenUI(selection)` before requesting structured output. Not all models support JSON mode reliably.

10. **Orchestrator patterns.** Use specialized components for technical operations: `StreamingTerminal`, `ProgressWindow`, `WorkflowTimeline`, `TaskTracker`, `ErrorPanel`, `ArtifactBrowser`, `ResourceMonitor`.

## Architecture

```
Tool Result → data-ui Part → isUIDataPart → UISchemaRenderer → Component Registry → React Component
```

## Component Registration

```typescript
// apps/web/src/components/genui/registry.ts
import { registerComponents } from "@alfred/ui/genui";

await initGenUIRegistry(); // Registers chart, grid, list, etc.
```

## Tool Integration

```typescript
// In a tool handler
import { createChartResult } from "@alfred/ui/genui";

const result = createChartResult(
  "Task Progress",
  [{ x: "Done", y: 45 }, { x: "Pending", y: 55 }],
  { tasks: rawTasks }
);
return result;
```

## Chat Rendering

GenUI parts are handled by `renderGenUI` in `chat-render.tsx`:

```typescript
function renderGenUI(part: AssistantPart): ReactNode | null {
  if (!isUIDataPart(part)) return null;
  return (
    <GenUIErrorBoundary schema={part.ui}>
      <UISchemaRenderer schema={part.ui} />
    </GenUIErrorBoundary>
  );
}
```

## Available Components

Core visualization components registered at app init:
- `chart` - Data visualization
- `grid` - Layout grid
- `list` - Animated list
- `number` - Sliding number display
- `term` - Terminal output
- `code` - Code block
- `plan` - Plan visualization
- `task` - Task progress
- `loading` - Loading indicator

Orchestrator components for technical operations:
- `streaming-terminal` - Real-time log streaming
- `progress-window` - Long-running operation tracking
- `workflow-timeline` - Workflow execution visualization
- `task-tracker` - Async task tracking (UPID, etc.)
- `error-panel` - Error visualization
- `artifact-browser` - Output artifact management
- `resource-monitor` - Container/VM resource monitoring

## Type Safety

```typescript
import type { UIComponent, GenUIToolResult } from "@alfred/type/genui";
import { validateUIComponent, isUIDataPart } from "@alfred/ui/genui";

// Validate unknown data
const result = validateUIComponent(unknownData);
if (result.valid) {
  // result.component is typed UIComponent
}
```

## Testing

Test GenUI components with real registry operations:

```typescript
import { clearRegistry, registerComponent } from "@alfred/ui/genui";
import { validateUIComponent } from "@alfred/type/genui.zod";

beforeEach(() => {
  clearRegistry();
});

test("tool result produces valid schema", () => {
  const result = createChartResult("Test", [{ x: "A", y: 1 }], {});
  const validation = validateUIComponent(result.ui);
  expect(validation.valid).toBe(true);
});
```

Test edge cases: null input, deep nesting, unicode props, empty children arrays.
