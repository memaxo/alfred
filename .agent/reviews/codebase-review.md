# Codebase Review: Ugly Code, Type Complexity, Schema Standardization, Naming Violations

## Summary

Found multiple issues violating computational austerity principles:
- Complex type manipulations with `any` fallbacks
- Duplicate schemas and functions
- Type assertions instead of proper type guards
- Function names exceeding 20-character limit
- Multi-word file names (mostly in allowed exceptions)

## Critical Issues

### 1. Ugly Type Manipulations

#### `packages/api/src/gate.ts` (Lines 25, 27, 28, 41)
**Problem**: Complex type assertion with `any` fallback and multiple `as any` casts
```typescript
// Line 25: Overly complex type assertion
const sessionUser = ctx.session?.user as (Context["session"] extends { user: infer U } ? U : any) | undefined;

// Lines 27-28, 41: Multiple `as any` casts
const rawRoles: unknown[] = Array.isArray((sessionUser as any)?.roles) ? (sessionUser as any).roles : [];
scopes: Array.isArray((sessionUser as any)?.scopes) ? (sessionUser as any).scopes : undefined,
```

**Fix**: Extract proper type helper or use type guards. Context type should be properly defined.

#### `packages/api/src/context.ts` (Line 110)
**Problem**: Type assertion instead of proper type guard
```typescript
const user = session?.user as { id?: string; roles?: string[]; scopes?: string[] } | undefined;
```

**Fix**: Define proper session user type or use type guard.

#### `packages/knowledge/src/query.ts` (Line 196)
**Problem**: `as any` cast for operator
```typescript
op: args[1] as any,
```

**Fix**: Define proper operator type union: `type Operator = "<" | ">" | "=" | "!=" | "~"`

#### `packages/ui/src/chat/parts.ts` (Multiple lines)
**Problem**: Type assertions in type guards instead of proper narrowing
```typescript
return part.type === "text" && typeof (part as { text?: unknown }).text === "string";
const candidate = part as { mimeType?: unknown; data?: unknown };
const metadata = (message as { metadata?: unknown }).metadata;
```

**Fix**: Use proper discriminated union narrowing or zod schema validation.

#### `packages/type/src/guards.ts` (Lines 10, 14)
**Problem**: Uses type assertions instead of proper narrowing
```typescript
const msg = value as Record<string, unknown>;
const parts = msg.parts as unknown;
```

**Fix**: Use proper type narrowing with `typeof` checks and discriminated unions.

### 2. Duplicate Schemas

#### Message Schemas
**Files**: 
- `packages/api/src/routers/assistant.ts` line 15: `assistantMessageSchema`
- `packages/api/src/routers/orchestrator.ts` line 12: `messageSchema`

**Problem**: Identical schemas duplicated across routers
```typescript
// assistant.ts
const assistantMessageSchema = z.object({
  role: z.enum(["user", "assistant", "system", "tool"]),
  content: z.string().min(1),
});

// orchestrator.ts  
const messageSchema = z.object({
  role: z.enum(["user", "assistant", "system", "tool"]),
  content: z.string().min(1),
});
```

**Fix**: Extract to `packages/type/src/stream.zod.ts` as `routerMessageSchema`.

### 3. Duplicate Functions

#### `toModelMessages` Functions
**Files**:
- `packages/api/src/routers/assistant.ts` lines 77-89
- `packages/api/src/routers/orchestrator.ts` lines 39-51

**Problem**: Identical logic duplicated
```typescript
// Both convert role "assistant" | "tool" → "assistant", others unchanged
```

**Fix**: Extract to `packages/api/src/utils/message.ts` as shared utility.

#### `sanitize` Functions
**Files**:
- `packages/api/src/routers/assistant.ts` lines 91-119: `sanitizeGenerateResult`
- `packages/api/src/routers/orchestrator.ts` lines 53-75: `sanitizeResult`

**Problem**: Nearly identical functions with minor differences (assistant includes `object`, `steps`, `reasoning`)

**Fix**: Create shared `sanitizeGenerateResult` in `packages/api/src/utils/generate.ts` with optional fields.

### 4. Schema Standardization Opportunities

#### Router Input Schemas
**Files**: Multiple routers define similar patterns
- `thread: z.string().optional()`
- `resource: z.string().optional()`
- `toolChoice: z.enum(["auto", "none", "required"]).optional()`
- `maxSteps: z.number().int().min(1).max(12).optional()`

**Fix**: Extract common patterns to `packages/type/src/router.zod.ts`.

#### `mapResource` Functions
**Files**: 
- `packages/api/src/routers/assistant.ts` line 64
- `packages/api/src/routers/orchestrator.ts` line 26
- `packages/api/src/routers/home.ts` line 17
- `packages/api/src/routers/workflow.ts` line 70

**Problem**: Similar patterns but domain-specific. Acceptable duplication, but could benefit from helper.

### 5. Naming Violations

#### Function Names Exceeding 20 Characters
**Violations**:
- `persistGenerateResult` (21 chars) - Should be `persistResult` or `persistGen`
- `sanitizeGenerateResult` (21 chars) - Should be `sanitizeResult` (already exists in orchestrator)
- `buildAssistantTools` (18 chars) - OK (close to limit)
- `buildOrchestratorTools` (22 chars) - **VIOLATION** - Should be `buildTools` with context
- `getEmbeddingProvider` (20 chars) - OK (at limit)
- `getRerankingProvider` (20 chars) - OK (at limit)
- `checkEmbeddingProviderHealth` (26 chars) - **VIOLATION** - Should be `checkEmbedHealth`
- `checkRerankingProviderHealth` (26 chars) - **VIOLATION** - Should be `checkRerankHealth`
- `getEmbeddingProviderWithFallback` (33 chars) - **VIOLATION** - Should be `getEmbedWithFallback`
- `createTestCaller` (16 chars) - OK
- `cloneRuntimeContext` (19 chars) - OK
- `gatherCodeContext` (18 chars) - OK
- `gatherWebContext` (17 chars) - OK
- `buildContextBundle` (18 chars) - OK
- `indexCodeEmbeddings` (19 chars) - OK
- `searchChunksHybrid` (18 chars) - OK
- `getLinearInstallationByWorkspace` (31 chars) - **VIOLATION** - Should be `getLinearByWorkspace`
- `getLinearInstallationByOAuthClient` (33 chars) - **VIOLATION** - Should be `getLinearByOAuth`
- `getDeploymentByApp` (17 chars) - OK
- `getStaleDeployments` (18 chars) - OK
- `listActiveDeployments` (20 chars) - OK
- `recordVoiceStt` (14 chars) - OK
- `recordVoiceTts` (14 chars) - OK
- `recordAssistantStreamEvent` (25 chars) - **VIOLATION** - Should be `recordStreamEvent`
- `startAssistantStreamTimer` (23 chars) - **VIOLATION** - Should be `startStreamTimer`
- `getMetricsSnapshot` (17 chars) - OK
- `arrayBufferToBase64` (18 chars) - OK
- `base64ToArrayBuffer` (19 chars) - OK
- `createWebAdapter` (17 chars) - OK
- `createNativeAdapter` (19 chars) - OK
- `createVoiceSession` (18 chars) - OK
- `createVoiceClient` (17 chars) - OK
- `getOutboundEdges` (17 chars) - OK
- `getInboundEdges` (17 chars) - OK
- `getEvents` (9 chars) - OK
- `getAutonomy` (12 chars) - OK
- `recordMistake` (13 chars) - OK
- `analyzeMistakes` (15 chars) - OK
- `createTokenEstimator` (20 chars) - OK (at limit)
- `registerPolicyCacheObserver` (27 chars) - **VIOLATION** - Should be `registerCacheObs` or `onCacheObs`
- `getAuditLogsByTrace` (19 chars) - OK
- `getPendingApprovals` (18 chars) - OK
- `verifyRunBelongsToDataset` (25 chars) - **VIOLATION** - Should be `verifyRunDataset`
- `getPointsForDataset` (18 chars) - OK
- `getRunScoreStats` (16 chars) - OK
- `setDeploymentStatus` (19 chars) - OK
- `recordHealthCheck` (16 chars) - OK
- `upsertLinearInstallation` (22 chars) - **VIOLATION** - Should be `upsertLinear`
- `upsertEvalDef` (13 chars) - OK
- `getEvalDefBySlug` (16 chars) - OK
- `getEvalDefById` (14 chars) - OK
- `getDatasetById` (14 chars) - OK
- `getDocument` (12 chars) - OK
- `listDocuments` (14 chars) - OK
- `getChunks` (10 chars) - OK
- `upsertNodes` (11 chars) - OK
- `upsertEdges` (11 chars) - OK
- `getNode` (8 chars) - OK
- `getEdge` (8 chars) - OK
- `findNodesByKind` (16 chars) - OK
- `getProfile` (10 chars) - OK
- `upsertProfile` (13 chars) - OK
- `getPreferences` (14 chars) - OK
- `listFacts` (9 chars) - OK
- `addEvent` (8 chars) - OK
- `getEvents` (9 chars) - OK
- `getAutonomy` (12 chars) - OK
- `persistKnowledge` (15 chars) - OK
- `ingestCodeFiles` (15 chars) - OK
- `createPgClient` (14 chars) - OK
- `createPgPool` (13 chars) - OK
- `createDrizzleClient` (18 chars) - OK
- `resetAgentMocks` (15 chars) - OK
- `createTestDb` (13 chars) - OK
- `closeTestDb` (12 chars) - OK
- `truncateTables` (14 chars) - OK
- `setupEventSourceMock` (19 chars) - OK
- `getRedis` (9 chars) - OK
- `markVoice` (10 chars) - OK
- `loadPolicy` (10 chars) - OK
- `createAuditLog` (15 chars) - OK
- `getAuditLogs` (13 chars) - OK
- `getAuditLogsByTrace` (19 chars) - OK
- `getPendingApprovals` (18 chars) - OK
- `upsertDeployment` (17 chars) - OK
- `createDeployment` (16 chars) - OK
- `getDeploymentById` (17 chars) - OK
- `getDeploymentByApp` (17 chars) - OK
- `setDeploymentStatus` (19 chars) - OK
- `recordHealthCheck` (16 chars) - OK
- `getStaleDeployments` (18 chars) - OK
- `listActiveDeployments` (20 chars) - OK
- `updateTask` (10 chars) - OK
- `updateNote` (10 chars) - OK
- `getDueReminders` (16 chars) - OK

**Total Violations**: ~12 functions exceed 20-character limit

#### Variable/Schema Names Exceeding 15 Characters
**Violations** (Schema names may be exception):
- `assistantMessageSchema` (21 chars) - **VIOLATION**
- `memoryOptionsSchema` (18 chars) - **VIOLATION**
- `assistantGenerateInput` (21 chars) - **VIOLATION**
- `assistantEscalateInput` (21 chars) - **VIOLATION**
- `generateInput` (12 chars) - OK
- `messageSchema` (13 chars) - OK

**Note**: Schema names may be exception per naming rules, but should review against spirit of austerity.

#### File Names (Multi-word)
**Found**: Most multi-word files are in allowed exceptions:
- Test files: `use-assistant-stream.test.ts`, `cache-merge.test.ts` ✅ Allowed
- UI ergonomics: `chat-container.tsx`, `voice-btn.tsx`, `sign-in.tsx`, `sign-up.tsx` ✅ Allowed
- Framework files: `+not-found.tsx` ✅ Allowed
- Generated/types: `react-virtuoso.d.ts`, `expo-env.d.ts` ✅ Allowed
- Utils: `gen-keys.ts`, `check-names.ts` ✅ Possibly allowed (scripts)

**No violations** in core `packages/*/src` directories.

### 6. Type Guard Issues

#### `packages/type/src/guards.ts`
**Problem**: Uses type assertions (`as Record<string, unknown>`, `as unknown`) instead of proper narrowing
```typescript
const msg = value as Record<string, unknown>;
const parts = msg.parts as unknown;
```

**Fix**: Use proper type narrowing with `typeof` checks and discriminated unions.

## Recommendations

### High Priority
1. **Fix `gate.ts` type manipulations**: Extract proper session user type or use type guards
2. **Consolidate message schemas**: Move to `packages/type/src/stream.zod.ts`
3. **Extract `toModelMessages`**: Create shared utility in `packages/api/src/utils/message.ts`
4. **Consolidate sanitize functions**: Create single function with optional fields in `packages/api/src/utils/generate.ts`

### Medium Priority
5. **Fix type guards**: Replace assertions with proper narrowing
6. **Rename long functions**: Abbreviate functions exceeding 20 characters
7. **Standardize router input patterns**: Extract common schema patterns to `packages/type/src/router.zod.ts`
8. **Fix `as any` casts**: Replace with proper types (query.ts operator, etc.)

### Low Priority
9. **Review schema naming**: Consider if long schema names violate spirit of naming rules
10. **Create `mapResource` helper**: If patterns converge further

## Files Requiring Changes

1. `packages/api/src/gate.ts` - Fix type manipulations (lines 25, 27, 28, 41)
2. `packages/api/src/context.ts` - Fix type assertion (line 110)
3. `packages/api/src/routers/assistant.ts` - Remove duplicates, use shared schemas/utils, rename functions
4. `packages/api/src/routers/orchestrator.ts` - Remove duplicates, use shared schemas/utils
5. `packages/type/src/stream.zod.ts` - Add shared `routerMessageSchema`
6. `packages/api/src/utils/message.ts` - NEW: Add shared `toModelMessages`
7. `packages/api/src/utils/generate.ts` - NEW: Add shared `sanitizeGenerateResult`
8. `packages/ui/src/chat/parts.ts` - Fix type guard assertions
9. `packages/type/src/guards.ts` - Fix type guard assertions
10. `packages/knowledge/src/query.ts` - Fix `as any` cast (line 196)
11. `packages/api/src/metrics.ts` - Rename functions exceeding 20 chars
12. `packages/rag/src/providers.ts` - Rename functions exceeding 20 chars
13. `packages/db/src/repo/linear.ts` - Rename functions exceeding 20 chars
14. `packages/db/src/repo/eval.ts` - Rename `verifyRunBelongsToDataset`
15. `packages/policy/src/pdp.ts` - Rename `registerPolicyCacheObserver`
16. `packages/agent/src/v6.ts` - Rename `buildOrchestratorTools`

## Estimated Impact

- **Type safety**: High - Fixing `any` casts improves type safety
- **Code reuse**: Medium - Consolidating duplicates reduces maintenance
- **Naming consistency**: Low-Medium - Function renames improve readability but require updates
- **Performance**: Low - Most changes are structural, not performance-critical

