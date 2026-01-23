# GenUI System Gap Analysis

**Date**: 2026-01-19  
**Status**: Critical gaps identified

## Executive Summary

While Phase 2A (Auto GenUI) and Phase 2B (Form Submission) infrastructure is complete, **critical integration points are missing** that prevent the features from working end-to-end:

1. **Auto-enrichment is not wired into event streams** - `enrich()` exists but is never called
2. **Form components don't integrate with TanStack Form** - Components are generic UI, not form-aware
3. **Form components not registered in GenUI registry** - Form components missing from `initGenUIRegistry()`
4. **Assistant router uses sync normalization** - Doesn't use async enrichment functions

## Critical Gaps

### Gap 1: Auto-Enrichment Not Integrated into Event Streams ⚠️ CRITICAL

**Problem**: The `enrich()` function exists (`packages/agent/src/utils/enrich.ts`) but is **never called** in production code paths.

**Evidence**:
- `packages/runtime/src/workflow/persist.ts` line 73-75: `maybeUiMessages()` calls `eventToUiMessages()` (synchronous)
- `eventToUiMessages()` (line 187-190) has a comment: "enrichment will be handled in async contexts" but no actual integration
- `enrichToolResultEvent()` exists but is never imported or called
- `normalizeToUiMessagesAsync()` exists but is never used

**Impact**: Tool results render as JSON code blocks, not GenUI visualizations.

**Fix Required**:
1. Update `packages/runtime/src/workflow/persist.ts` to use `enrichToolResultEvent()` for tool-result events
2. Update `packages/api/src/routers/assistant.ts` to use `normalizeToUiMessagesAsync()` instead of `normalizeToUiMessages()`
3. Pass `SchemaContext` (userId, surface, mode) through the call chain

**Files to Modify**:
- `packages/runtime/src/workflow/persist.ts` - Replace `maybeUiMessages()` with async version
- `packages/api/src/routers/assistant.ts` - Use async normalization
- `packages/agent/src/workflow/event-persistence.ts` - Use async enrichment

### Gap 2: Form Components Not Form-Aware ⚠️ CRITICAL

**Problem**: GenUI form components (`text`, `select`, `date`, etc.) are generic UI components that don't integrate with TanStack Form.

**Evidence**:
- `apps/web/src/components/text.tsx` - Just re-exports `Input` component
- `apps/web/src/components/select.tsx` - Just re-exports `Select` component
- `apps/web/src/form/index.tsx` - Has `TextField`, `TextareaField` that use `useFieldContext()`, but these are NOT the GenUI components
- `GenUIFormWrapper` wraps the schema but individual form components don't bind to form fields

**Impact**: Forms render but don't collect user input or validate.

**Fix Required**:
1. Create GenUI-aware form components that use `form.Field` or `useFieldContext()`
2. Map GenUI schema props (`name`, `label`, `required`, etc.) to TanStack Form field props
3. Register form components in GenUI registry

**Files to Create/Modify**:
- `apps/web/src/components/genui/components/text.tsx` - GenUI-aware text field
- `apps/web/src/components/genui/components/select.tsx` - GenUI-aware select field
- `apps/web/src/components/genui/components/date.tsx` - GenUI-aware date picker
- `apps/web/src/components/genui/components/checkbox.tsx` - GenUI-aware checkbox
- `apps/web/src/components/genui/registry.ts` - Register form components

### Gap 3: Form Components Not Registered ⚠️ HIGH

**Problem**: Form components are not registered in the GenUI component registry.

**Evidence**:
- `apps/web/src/components/genui/registry.ts` - `initGenUIRegistry()` doesn't include form components
- Form components exist (`text`, `select`, `date`, etc.) but aren't registered
- `UISchemaRenderer` will render "unknown component" placeholders for form schemas

**Impact**: Forms won't render at all.

**Fix Required**:
1. Import form components in `initGenUIRegistry()`
2. Register them with `registerComponents()`

**Files to Modify**:
- `apps/web/src/components/genui/registry.ts` - Add form component registration

### Gap 4: Form Field Name Mapping Missing ⚠️ HIGH

**Problem**: GenUI schemas use props like `label`, `name`, `required` but there's no mapping to TanStack Form field names.

**Evidence**:
- `GenUIFormWrapper` passes props to `UISchemaRenderer` but doesn't map schema props to form field names
- Form components need `name` prop to bind to form state
- No schema-to-field-name extraction logic

**Impact**: Form fields won't bind to form state, values won't be collected.

**Fix Required**:
1. Extract field names from GenUI schema structure
2. Map schema props to TanStack Form field props
3. Ensure form components receive `name` prop from schema

**Files to Modify**:
- `apps/web/src/components/genui/form-wrapper.tsx` - Add field name extraction
- Form component implementations - Accept and use `name` prop

### Gap 5: Schema Context Not Passed Through ⚠️ MEDIUM

**Problem**: `enrich()` needs `SchemaContext` (userId, surface, mode) but it's not available in event processing paths.

**Evidence**:
- `enrich()` defaults to `surface: "web"`, `mode: "assistant"` when ctx is missing
- `persistStreamEvent()` doesn't have access to userId/surface/mode
- Assistant router doesn't pass context to normalization

**Impact**: Auto-enrichment uses wrong defaults, may not optimize for correct surface.

**Fix Required**:
1. Extract userId from runtime context
2. Determine surface from request headers/context
3. Pass context through to enrichment functions

**Files to Modify**:
- `packages/runtime/src/workflow/persist.ts` - Extract and pass context
- `packages/api/src/routers/assistant.ts` - Pass context to normalization

### Gap 6: Form Validation Schema Extraction ⚠️ MEDIUM

**Problem**: `GenUIFormWrapper` tries to extract Zod schema from `formData.schema` but GenUI schemas aren't Zod schemas.

**Evidence**:
- `GenUIFormWrapper` line 42-56: Attempts to parse schema as Zod but GenUI uses `UIComponent` schema
- No conversion from `UIComponent` props to Zod validation schema
- Form validation will always use `z.record(z.unknown())` (accepts anything)

**Impact**: Forms don't validate user input.

**Fix Required**:
1. Create `uiComponentToZodSchema()` converter
2. Extract validation rules from `UIComponent` props (`required`, `type`, `min`, `max`, etc.)
3. Generate Zod schema for form validation

**Files to Create**:
- `apps/web/src/components/genui/schema-converter.ts` - Convert UIComponent to Zod

### Gap 7: Performance Testing Missing ⚠️ LOW

**Problem**: No performance tests to verify latency budgets.

**Evidence**:
- ExecPlan lists "<50ms latency (p95)" and "<100ms p95" but no tests exist
- Metrics exist but no benchmarks

**Impact**: Can't verify performance requirements are met.

**Fix Required**:
1. Create performance test suite
2. Measure enrichment latency
3. Measure form submission latency

**Files to Create**:
- `tests/perf/genui-enrichment-latency.test.ts`
- `tests/perf/genui-form-submission-latency.test.ts`

## Integration Checklist

### Phase 2A: Auto GenUI Integration

- [ ] **CRITICAL**: Wire `enrichToolResultEvent()` into `packages/runtime/src/workflow/persist.ts`
- [ ] **CRITICAL**: Update `packages/api/src/routers/assistant.ts` to use `normalizeToUiMessagesAsync()`
- [ ] **HIGH**: Extract and pass `SchemaContext` through event processing
- [ ] **MEDIUM**: Add integration tests to verify >60% auto-enrichment rate
- [ ] **LOW**: Add performance tests for <50ms latency

### Phase 2B: Form Integration

- [ ] **CRITICAL**: Create GenUI-aware form components with TanStack Form integration
- [ ] **CRITICAL**: Register form components in GenUI registry
- [ ] **HIGH**: Implement field name mapping from schema to form fields
- [ ] **HIGH**: Create `uiComponentToZodSchema()` converter for validation
- [ ] **MEDIUM**: Add inline error display in form components
- [ ] **LOW**: Add performance tests for form submission latency

## Priority Order

1. **Gap 1** (Auto-enrichment integration) - Blocks Phase 2A entirely
2. **Gap 2** (Form-aware components) - Blocks Phase 2B entirely  
3. **Gap 3** (Form component registration) - Blocks form rendering
4. **Gap 4** (Field name mapping) - Blocks form data collection
5. **Gap 5** (Schema context) - Affects enrichment quality
6. **Gap 6** (Validation schema) - Affects form validation
7. **Gap 7** (Performance tests) - Verification only

## Estimated Effort

- Gap 1: 4-6 hours (integration + context passing)
- Gap 2: 8-12 hours (create 8 form components)
- Gap 3: 1 hour (registry update)
- Gap 4: 2-3 hours (field mapping logic)
- Gap 5: 2-3 hours (context extraction)
- Gap 6: 4-6 hours (schema converter)
- Gap 7: 2-3 hours (performance tests)

**Total**: ~23-34 hours (3-4 days)

## Related Files

### Auto-Enrichment Integration Points
- `packages/runtime/src/workflow/persist.ts` - Event persistence (needs async enrichment)
- `packages/api/src/routers/assistant.ts` - Assistant router (needs async normalization)
- `packages/agent/src/workflow/event-persistence.ts` - Agent event persistence

### Form Component Files
- `apps/web/src/components/genui/components/` - Create form components here
- `apps/web/src/components/genui/registry.ts` - Register components
- `apps/web/src/components/genui/form-wrapper.tsx` - Enhance field mapping
- `apps/web/src/components/genui/schema-converter.ts` - Create converter

### Existing Form Infrastructure
- `apps/web/src/form/index.tsx` - TanStack Form patterns (reference)
- `apps/web/src/components/text.tsx` - Generic text component (not form-aware)
- `apps/web/src/components/select.tsx` - Generic select component (not form-aware)
