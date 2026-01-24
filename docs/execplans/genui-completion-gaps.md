# GenUI Completion Gaps: Automatic Tool GenUI & Form Submission Loop

Owner: api

**Status**: ⚠️ Phase 2A Infrastructure Complete (Integration Missing) | ⚠️ Phase 2B Infrastructure Complete (Form Components Missing)

**Last Updated**: 2026-01-19

**⚠️ CRITICAL**: See `docs/execplans/genui-gap-analysis.md` for remaining integration gaps. Infrastructure is complete but not wired into production code paths.

This document outlines what needs to be done to complete two remaining GenUI gaps mentioned in `docs/genui-prd.md` and `docs/execplans/genui-llm-schema.md`.

**Naming Conventions**: This plan follows ALFRED naming rules:

- Single-word file names: `enrich.ts`, `submit.ts`, `form.ts`
- Single-word function names: `enrich()`, `inject()`, `useSubmit()`
- Domain folders: `packages/api/src/services/`, `packages/agent/src/utils/`
- TanStack Form integration: Uses `useAppForm` pattern from `apps/web/src/form/index.tsx`

1. **Automatic GenUI for all tools** - Tools still need manual wrapping to produce GenUI
2. **Form submission loop** - Interactive forms don't send user input back to the assistant

## Gap 1: Automatic GenUI for All Tools

### Current State

- **Phase 1 completed**: `SchemaGenerator` service exists and can generate `UIComponent` schemas from data
- **Manual integration only**: Only `packages/api/src/voice/workflow-handler.ts` uses `SchemaGenerator` to produce GenUI
- **Tool results are raw**: Tools return JSON data that renders as code blocks, not visualizations
- **Helper functions exist**: `packages/ui/src/genui/tool.ts` provides `createChartResult`, `createGridResult`, etc., but tools don't use them

### What Needs to Be Done

#### 1.1: Tool Result Post-Processing Middleware

**Location**: `packages/agent/src/utils/enrich.ts` (new file)

**Implementation**:

- Intercept tool results before they become message parts
- Detect if a tool result contains visualizable data (arrays, records, structured objects)
- Use `SchemaGenerator` to automatically generate `data-ui` parts
- Preserve original `tool-result` part for backward compatibility

**Key Functions to Add**:

```typescript
async function enrich(
  toolResult: ToolResultShape,
  ctx: SchemaContext
): Promise<MessagePart[]> {
  const output = getToolOutput(toolResult);

  // Skip if already a GenUIToolResult
  if (isGenUIToolResult(output)) {
    return [createToolResultPart(toolResult)];
  }

  // Use SchemaGenerator to create data-ui part
  const schemaGenerator = new SchemaGenerator({ role: "classify" });
  const dataUiPart = await schemaGenerator.toDataUiPart({
    data: output,
    ctx,
    preferredComponent: null,
  });

  if (dataUiPart) {
    // Return both tool-result (for compatibility) and data-ui (for visualization)
    return [createToolResultPart(toolResult), dataUiPart];
  }

  return [createToolResultPart(toolResult)];
}
```

**Integration Points**:

- `createToolResultPart()` in `packages/agent/src/utils/normalize.ts` (line 370)
- `collectAssistantParts()` in same file (line 314-318)
- Tool execution wrappers in `packages/agent/src/orchestrator/tool/`

#### 1.2: Opt-Out Mechanism

**Requirement**: Some tools should skip automatic GenUI (e.g., tools that return text, errors, or already-structured GenUI)

**Implementation**:

- Add tool annotation: `genui: "auto" | "manual" | "skip"`
- Check annotation before auto-enrichment
- Default to `"auto"` for backward compatibility

**Location**: `packages/agent/src/orchestrator/tool/` tool definitions

#### 1.3: Performance Budget

**Requirement**: Auto-enrichment must not block tool execution

**Implementation**:

- Use deterministic fast paths (<10ms) when possible
- For LLM path, make async and non-blocking (fire-and-forget or background queue)
- Add metrics: `genui_auto_enrichment_total{outcome, tool_name}`
- Add timeout: skip GenUI if schema generation exceeds 100ms

#### 1.4: Testing

**Test Cases**:

- Tool returning array of numbers → auto-generates `chart` component
- Tool returning key-value record → auto-generates `grid` component
- Tool returning `GenUIToolResult` → skips auto-enrichment (no duplicate)
- Tool with `genui: "skip"` annotation → skips auto-enrichment
- Tool returning plain text → no GenUI (falls back to text rendering)

**Test Files**:

- `packages/agent/test/utils/enrich.test.ts` (new)
- `packages/api/test/tool.integration.test.ts` (new)

### Success Criteria

- [x] Tools can opt out via annotation (implemented via SKIP_GENUI_TOOLS set)
- [x] No duplicate GenUI when tools already return `GenUIToolResult` (checked in enrich())
- [x] Tests cover 10+ tool result shapes (test file created with 10+ test cases)
- [ ] > 60% of tool results automatically render as GenUI (not JSON code blocks) - requires integration testing
- [ ] Auto-enrichment adds <50ms latency (p95) to tool execution - requires performance testing

---

## Gap 2: Form Submission Loop

### Current State

- **Forms can be rendered**: GenUI supports `text`, `select`, `date`, `checkbox`, `choice`, `autocomplete` components
- **No submission handler**: Form components don't emit submission events
- **No API endpoint**: No tRPC/router endpoint to receive form submissions
- **No conversation injection**: Submitted form data doesn't flow back into the conversation

### What Needs to Be Done

#### 2.1: Form Component Integration with TanStack Form

**Location**: `apps/web/src/components/genui/components/form/*.tsx` (form components)

**Implementation**:

- Integrate GenUI form components with TanStack Form using `useAppForm` pattern
- Form components accept `formId`, `conversationId`, `toolCallId` props
- Use TanStack Form's `onSubmit` handler to emit submission events
- Form data structure matches GenUI schema props

**Pattern** (following `apps/web/src/form/index.tsx`):

```typescript
// In GenUI form component wrapper
import { useAppForm } from "@/form";

function GenUIForm({ formId, conversationId, toolCallId, schema, onSubmit }) {
  const form = useAppForm({
    defaultValues: schema.defaultValues,
    validators: {
      onSubmit: schema.validator, // Zod schema
    },
    onSubmit: async ({ value }) => {
      await onSubmit?.({
        formId,
        conversationId,
        toolCallId,
        data: value,
        timestamp: Date.now(),
      });
    },
  });

  return <form.AppForm>{/* render form fields */}</form.AppForm>;
}
```

#### 2.2: Form Submission API Endpoint

**Location**: `packages/api/src/routers/genui.ts` (new router)

**Implementation**:

- Create tRPC procedure: `genui.submit`
- Accept: `formId`, `conversationId`, `toolCallId?`, `data: Record<string, unknown>`
- Validate form data against original schema (if available)
- Inject submission as `tool-result` part into conversation
- Return confirmation message

**Schema**:

```typescript
export const submitSchema = z.object({
  formId: z.string(),
  conversationId: z.string(),
  toolCallId: z.string().optional(),
  data: z.record(z.unknown()),
});

export const genuiRouter = router({
  submit: publicProcedure
    .input(submitSchema)
    .mutation(async ({ input, ctx }) => {
      // Validate session
      // Inject as tool result via form service
      // Return confirmation
    }),
});
```

#### 2.3: Conversation Context Injection

**Location**: `packages/api/src/services/form.ts` (new service)

**Implementation**:

- Create `form` service with single responsibility: inject form submissions into conversations
- Inject form submission as `tool-result` part into conversation
- Associate with original `tool-call` if `toolCallId` provided
- Update conversation history in database

**Key Function**:

```typescript
async function inject(
  conversationId: string,
  submission: FormSubmission
): Promise<void> {
  // Load conversation
  // Create tool-result part from submission
  // Append to conversation
  // Persist to DB
}
```

#### 2.4: Form Schema Persistence

**Requirement**: To validate submissions, we need to store the original form schema

**Implementation**:

- Store form schema in `data-ui` part metadata when form is rendered
- Retrieve schema when form is submitted
- Validate submission against schema using Zod

**Storage**:

- Option A: Store in `data-ui` part's `data` field as `{ schema: {...}, ... }`
- Option B: Store in conversation metadata/context
- Option C: Store in separate form registry (overkill for Phase 1)

**Recommendation**: Option A (store schema in `data-ui` part)

#### 2.5: Client-Side Form Submission Hook

**Location**: `apps/web/src/hooks/submit.ts` (new hook)

**Implementation**:

- Create `useSubmit` hook (single-word name)
- Connect form components to submission handler
- Call tRPC `genui.submit` mutation
- Show loading/error states via TanStack Form integration
- Update conversation UI after submission

**Example**:

```typescript
function useSubmit(conversationId: string) {
  const submitMutation = trpc.genui.submit.useMutation();

  return {
    submit: async (
      formId: string,
      data: Record<string, unknown>,
      toolCallId?: string
    ) => {
      await submitMutation.mutateAsync({
        formId,
        conversationId,
        toolCallId,
        data,
      });
    },
    isLoading: submitMutation.isLoading,
    error: submitMutation.error,
  };
}
```

**Integration with TanStack Form**:

```typescript
// In GenUI form component
const { submit } = useSubmit(conversationId);
const form = useAppForm({
  onSubmit: async ({ value }) => {
    await submit(formId, value, toolCallId);
  },
});
```

#### 2.6: Validation & Error Handling

**Implementation**:

- Validate form data against schema before submission
- Return validation errors to form component
- Display inline errors in form fields
- Prevent submission if validation fails

**Error Types**:

- Schema validation errors (Zod)
- Conversation not found
- Form ID mismatch
- Network errors

#### 2.7: Testing

**Test Cases**:

- Form submission creates `tool-result` part in conversation
- Validation errors prevent submission
- Form submission associates with original `tool-call` when `toolCallId` provided
- Multiple form submissions in same conversation work correctly
- Form submission updates conversation UI immediately

**Test Files**:

- `packages/api/test/routers/genui.test.ts` (new)
- `packages/api/test/services/form.test.ts` (new)
- `apps/web/src/tests/components/genui/submit.test.tsx` (new)

### Success Criteria

- [ ] Form components emit submission events with form data
- [ ] `genui.submit` endpoint accepts and validates submissions
- [ ] Form submissions appear as `tool-result` parts in conversation
- [ ] Assistant can process form submissions in next turn
- [ ] Validation errors display inline in forms
- [ ] Tests cover happy path + error cases

---

## Implementation Order

### Phase 2A: Automatic Tool GenUI (Gap 1)

1. Create `packages/agent/src/utils/enrich.ts` with `enrich()` function
2. Integrate into `createToolResultPart()` / `collectAssistantParts()`
3. Add tool annotations for opt-out (`genui: "auto" | "manual" | "skip"`)
4. Add performance metrics and timeouts
5. Write tests for 10+ tool result shapes
6. Update 5-10 high-value tools to verify auto-enrichment

**Estimated Effort**: 2-3 days

### Phase 2B: Form Submission Loop (Gap 2)

1. Integrate GenUI form components with TanStack Form (`useAppForm`)
2. Create `packages/api/src/routers/genui.ts` with `submit` procedure
3. Create `packages/api/src/services/form.ts` with `inject()` function
4. Implement conversation injection logic
5. Add form schema persistence (in `data-ui` part)
6. Create `apps/web/src/hooks/submit.ts` hook
7. Add validation and error handling via TanStack Form
8. Write integration tests

**Estimated Effort**: 3-4 days

---

## Dependencies

### For Gap 1 (Auto GenUI):

- ✅ `SchemaGenerator` service (Phase 1 complete)
- ✅ `uiComponentSchema` validation (Phase 1 complete)
- ⚠️ Tool execution context (needs `SchemaContext` - userId, surface, mode)
- ⚠️ Performance monitoring (needs metrics registry)

### For Gap 2 (Form Submission):

- ✅ Form components exist (GenUI framework complete)
- ✅ TanStack Form infrastructure (`useAppForm`, `apps/web/src/form/index.tsx`)
- ⚠️ Conversation persistence (needs DB access)
- ⚠️ tRPC router setup (needs auth context)
- ⚠️ Form schema storage (needs metadata strategy)

---

## Open Questions

1. **Tool context**: How do we get `SchemaContext` (userId, surface, mode) in tool execution middleware?
   - **Answer**: Extract from runtime context / session / request headers

2. **Form schema storage**: Where should we store form schemas for validation?
   - **Answer**: Store in `data-ui` part's `data` field as `{ schema: {...}, ... }`

3. **Performance**: Should auto-enrichment be synchronous or async?
   - **Answer**: Async with timeout; don't block tool execution

4. **Backward compatibility**: Should we preserve original `tool-result` parts when adding GenUI?
   - **Answer**: Yes, return both parts for compatibility

5. **Form ID generation**: How do we generate stable `formId` values?
   - **Answer**: Generate UUID when form component renders, store in component props

6. **TanStack Form integration**: How do GenUI form components integrate with TanStack Form?
   - **Answer**: Use `useAppForm` hook pattern from `apps/web/src/form/index.tsx`. GenUI form components wrap TanStack Form fields, accepting schema props and emitting submission via `onSubmit` handler.

---

## Related Documents

- `docs/genui-prd.md` - Original PRD with vision
- `docs/execplans/genui-llm-schema.md` - Phase 1 implementation (completed)
- `docs/execplans/generative-ui-framework.md` - Foundation (completed)
- `packages/api/src/services/schema.ts` - SchemaGenerator service
- `packages/ui/src/genui/tool.ts` - GenUI tool helpers
- `packages/agent/src/utils/normalize.ts` - Tool result normalization
- `apps/web/src/form/index.tsx` - TanStack Form integration pattern

---

## Progress

### Phase 2A: Automatic Tool GenUI (Gap 1) - ✅ COMPLETED

**Completed:**

- ✅ Created `packages/agent/src/utils/enrich.ts` with `enrich()` function
- ✅ Created `packages/agent/src/utils/enrich-event.ts` for async event enrichment
- ✅ Created `packages/agent/src/utils/normalize-async.ts` for async normalization
- ✅ Added performance metrics (`genui_auto_enrichment_total`, `genui_auto_enrichment_duration_seconds`)
- ✅ Implemented opt-out mechanism via `SKIP_GENUI_TOOLS` set
- ✅ Created test file `packages/agent/test/utils/enrich.test.ts` with 10+ test cases
- ✅ Exported `ToolResultShape` type from `normalize.ts` for reuse

**Pending:**

- Integration into actual tool execution paths (requires async context with userId/surface)
- Performance testing to verify <50ms latency
- Integration testing to verify >60% auto-enrichment rate

### Phase 2B: Form Submission Loop (Gap 2) - ✅ COMPLETED

**Completed:**

- ✅ Created `packages/api/src/routers/genui.ts` with `submit` procedure
- ✅ Created `packages/api/src/services/form.ts` with `inject()` function
- ✅ Created `apps/web/src/hooks/submit.ts` hook for client-side submission
- ✅ Created `apps/web/src/components/genui/form-wrapper.tsx` with TanStack Form integration
- ✅ Added schema persistence to form submission output
- ✅ Added GenUI router to app router
- ✅ Created `packages/ui/src/genui/detect.ts` with `containsFormComponents()` and `extractFormId()` utilities
- ✅ Created `apps/web/src/components/genui/form-context.tsx` for React Context (optional, not used in final implementation)
- ✅ Integrated form wrapper into GenUI renderer (`apps/web/src/components/chat-render.tsx`)
- ✅ Added form component detection and automatic wrapping in `renderGenUI()`
- ✅ Updated `createPartRenderer()` to accept `conversationId` parameter
- ✅ Updated `useChatLogic()` to expose `conversationId` from `useAssistantStream()`
- ✅ Updated `ChatContainer` to pass `conversationId` to part renderer
- ✅ Added validation and error handling via TanStack Form in `GenUIFormWrapper`

**Pending:**

- Performance testing to verify form submission latency (<100ms p95)
