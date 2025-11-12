# ALFRED Next Priority Development Goals

**Last Updated**: 2025-01-15

Based on comprehensive architectural analysis, these priorities reflect the critical path to making ALFRED's well-designed packages actually work together as an integrated intelligence system.

## Executive Summary

ALFRED has **excellent architectural foundations** but suffers from a **critical integration gap**. All domain packages (cognitive, knowledge, learning, policy) exist but don't compose into workflows. The workflow runner emits placeholder events instead of executing real AI SDK streaming with tool integration.

**The bottleneck**: No composition layer connects the packages.

**The solution**: Create `packages/runtime/` as the conductor that orchestrates all domain packages.

---

## 🔥 CRITICAL PRIORITY: Runtime Integration Layer

**Estimated Duration**: 5-6 weeks  
**Blocks**: Everything else depends on this  
**Status**: Not started

### Why This is Priority #1

Every other feature (RAG, Linear, UI, Voice) assumes workflows can:
1. Query knowledge graph for context
2. Use cognitive state for reasoning
3. Learn from outcomes
4. Execute tools via AI SDK

**None of this works today.** The runner is a placeholder that emits fake events.

Without runtime integration:
- ❌ RAG retrieval has nowhere to integrate
- ❌ Learning system has no outcomes to record
- ❌ Cognitive states don't affect behavior
- ❌ Preferences don't influence responses
- ❌ Linear activities can't report real progress
- ❌ UI streams fake data

With runtime integration:
- ✅ All packages compose into cohesive intelligence
- ✅ Real AI SDK streaming with tool execution
- ✅ Context-aware workflows that improve over time
- ✅ Foundation for all future features

---

## Phase 1: Core Runtime (Week 1-2)

### Goal
Create the composition layer that makes all packages work together.

### Tasks

#### 1.1 Create Runtime Package Structure

```bash
mkdir -p packages/runtime/src/{core,workflow,context,domains}
cd packages/runtime
bun init
```

**Files to create:**
- `packages/runtime/package.json` - Dependencies on cognitive, knowledge, learning, policy
- `packages/runtime/src/index.ts` - Public API exports
- `packages/runtime/tsconfig.json` - TypeScript config
- `packages/runtime/README.md` - Package documentation

**Duration**: 1 day

#### 1.2 Implement CoreRuntime Class

```typescript
// packages/runtime/src/core/runtime.ts
export class CoreRuntime {
  constructor(private deps: {
    cognitive: CognitiveEngine;
    knowledge: KnowledgeGraph;
    learning: LearningSystem;
    policy: PolicyEngine;
  }) {}

  async buildContext(input: UserRequest): Promise<ExecutionContext> {
    // 1. Load user preferences
    const preferences = await this.loadPreferences(input.userId);
    
    // 2. Query knowledge graph for relevant memories
    const memories = await this.knowledge.query({
      related_to: input.requirement,
      user_id: input.userId,
      topK: 10
    });
    
    // 3. Load cognitive state
    const cogState = await this.cognitive.getCurrentState(input.userId);
    
    // 4. Get recent learnings
    const learnings = await this.learning.getPatterns({
      domain: this.inferDomain(input.requirement),
      userId: input.userId,
      minConfidence: 0.8
    });
    
    return { preferences, memories, cogState, learnings };
  }
  
  async recordOutcome(
    input: UserRequest,
    result: ExecutionResult,
    context: ExecutionContext
  ): Promise<void> {
    // Record to learning system
    await this.learning.record({
      prediction: context.cogState.prediction,
      actual: result,
      successful: result.status === "completed",
    });
    
    // Update knowledge graph
    await this.knowledge.addPattern({
      trigger: input.requirement,
      actions: result.toolCalls,
      outcome: result.status,
      confidence: result.successful ? 1.0 : 0.0
    });
  }
}
```

**Duration**: 3 days

#### 1.3 Implement Context Builders

```typescript
// packages/runtime/src/context/builder.ts
export class ContextBuilder {
  async buildForDomain(
    domain: Domain,
    input: UserRequest,
    runtime: CoreRuntime
  ): Promise<DomainContext> {
    switch (domain) {
      case "proxmox":
        return this.buildProxmoxContext(input, runtime);
      case "development":
        return this.buildDevelopmentContext(input, runtime);
      case "productivity":
        return this.buildProductivityContext(input, runtime);
      default:
        return this.buildGenericContext(input, runtime);
    }
  }

  private async buildProxmoxContext(
    input: UserRequest,
    runtime: CoreRuntime
  ): Promise<ProxmoxContext> {
    const baseContext = await runtime.buildContext(input);
    
    // Add Proxmox-specific context
    const clusters = await runtime.knowledge.query({
      type: "proxmox_cluster",
      owner: input.userId
    });
    
    const recentDeploys = await runtime.knowledge.query({
      type: "deployment",
      target: "proxmox",
      since: Date.now() - 30 * 24 * 60 * 60 * 1000
    });
    
    return {
      ...baseContext,
      clusters,
      recentDeploys,
      commonPatterns: await this.getProxmoxPatterns(input.userId)
    };
  }
}
```

**Duration**: 2 days

#### 1.4 Add Runtime Metrics

```typescript
// packages/runtime/src/metrics.ts
export const runtimeContextBuildDuration = new Histogram({
  name: "runtime_context_build_duration_seconds",
  help: "Time to build execution context",
  labelNames: ["domain", "outcome"],
});

export const runtimeOutcomeRecordDuration = new Histogram({
  name: "runtime_outcome_record_duration_seconds",
  help: "Time to record workflow outcome",
  labelNames: ["domain", "status"],
});
```

**Duration**: 1 day

#### 1.5 Write Unit Tests

```typescript
// packages/runtime/test/core-runtime.test.ts
describe("CoreRuntime", () => {
  it("builds context from all domain packages", async () => {
    // Mock dependencies
    // Assert context includes preferences, memories, cognitive state, learnings
  });
  
  it("records outcomes to learning and knowledge", async () => {
    // Execute workflow
    // Assert learning.record called
    // Assert knowledge.addPattern called
  });
});
```

**Duration**: 2 days

**Phase 1 Total**: 9 days (~2 weeks with testing)

---

## Phase 2: Workflow Runtime with Real AI SDK (Week 3-4)

### Goal
Replace placeholder runner with real AI SDK v6 streaming.

### Tasks

#### 2.1 Implement WorkflowRuntime

```typescript
// packages/runtime/src/workflow/runtime.ts
export class WorkflowRuntime extends CoreRuntime {
  async *execute(input: WorkflowInput): AsyncGenerator<WorkflowEvent> {
    // Build context using CoreRuntime
    const context = await this.buildContext(input);
    
    // Build system prompt with personalization
    const systemPrompt = this.buildSystemPrompt(context);
    
    // Real AI SDK streaming
    const result = await streamText({
      model: getOpenAI()(getModelId()),
      system: systemPrompt,
      messages: [{ role: "user", content: input.requirement }],
      tools: buildTools(),
      maxSteps: 10,
      onStepFinish: async ({ toolCalls, toolResults }) => {
        // Update knowledge graph in real-time
        for (const call of toolCalls) {
          await this.knowledge.addEdge({
            from: input.requirement,
            to: call.toolName,
            type: "tool_used",
            metadata: { args: call.args }
          });
        }
      }
    });
    
    // Stream events with normalization
    for await (const event of result.fullStream) {
      // Normalize AI SDK event to WorkflowEvent
      const normalized = this.normalizeEvent(event, context);
      
      yield normalized;
      
      // Update cognitive state
      if (event.type === "step-finish") {
        await this.cognitive.transition(
          context.cogState,
          { type: "step_complete", step: event }
        );
      }
    }
    
    // Record outcome
    await this.recordOutcome(input, result, context);
  }
}
```

**Duration**: 4 days

#### 2.2 Event Normalization

```typescript
// packages/runtime/src/workflow/normalize.ts
export function normalizeEvent(
  aiSdkEvent: AISDKStreamEvent,
  context: ExecutionContext
): WorkflowEvent {
  switch (aiSdkEvent.type) {
    case "text-delta":
      return {
        type: "assistant",
        text: aiSdkEvent.textDelta,
        metadata: { context: context.cogState }
      };
      
    case "tool-call":
      return {
        type: "tool-call",
        id: aiSdkEvent.toolCallId,
        toolName: aiSdkEvent.toolName,
        args: aiSdkEvent.args,
        metadata: { confidence: context.cogState.confidence }
      };
      
    case "tool-result":
      return {
        type: "tool-result",
        id: aiSdkEvent.toolCallId,
        toolName: aiSdkEvent.toolName,
        result: aiSdkEvent.result,
      };
      
    default:
      return { type: "event", data: aiSdkEvent };
  }
}
```

**Duration**: 2 days

#### 2.3 Integration with API Router

```typescript
// packages/api/src/routers/workflow.ts
import { WorkflowRuntime } from "@alfred/runtime";

const runtime = new WorkflowRuntime({
  cognitive: createCognitiveEngine(),
  knowledge: createKnowledgeGraph(),
  learning: createLearningSystem(),
  policy: createPolicyEngine(),
});

export const workflowRouter = router({
  stream: authedProcedure
    .input(workflowInput)
    .subscription(({ input, ctx }) =>
      observable<WorkflowEvent>((emit) => {
        (async () => {
          try {
            for await (const event of runtime.execute(input)) {
              emit.next(event);
              
              // Persist event
              await workflowRepo.appendEvent({
                runId: input.runId,
                eventData: event,
              });
            }
            emit.complete();
          } catch (error) {
            emit.error(toTRPCError(error, "workflow_execution_failed"));
          }
        })();
      })
    ),
});
```

**Duration**: 2 days

#### 2.4 End-to-End Testing

```typescript
// packages/runtime/test/workflow-runtime.test.ts
describe("WorkflowRuntime", () => {
  it("executes real AI SDK streaming", async () => {
    // Create runtime with real dependencies
    // Execute workflow with simple requirement
    // Assert tool calls happen
    // Assert events are normalized correctly
  });
  
  it("updates knowledge graph during execution", async () => {
    // Execute workflow
    // Assert knowledge graph has new edges
  });
  
  it("records outcomes after completion", async () => {
    // Execute workflow
    // Assert learning system has new records
  });
});
```

**Duration**: 3 days

**Phase 2 Total**: 11 days (~2.5 weeks with testing)

---

## Phase 3: Learning Loop Closure (Week 5)

### Goal
Make ALFRED actually learn from outcomes and improve over time.

### Tasks

#### 3.1 Outcome Recording

```typescript
// packages/learning/src/record.ts
export async function recordOutcome(params: {
  userId: string;
  domain: Domain;
  requirement: string;
  prediction: unknown;
  actual: WorkflowResult;
  toolsUsed: string[];
  successful: boolean;
  durationMs: number;
}): Promise<void> {
  // Store outcome
  await db.insert(learningOutcomes).values({
    userId: params.userId,
    domain: params.domain,
    requirement: params.requirement,
    prediction: params.prediction as any,
    actual: params.actual as any,
    toolsUsed: params.toolsUsed,
    successful: params.successful,
    durationMs: params.durationMs,
    timestamp: new Date(),
  });
  
  // Extract patterns if successful
  if (params.successful) {
    await extractPattern(params);
  } else {
    await analyzeMistake(params);
  }
}
```

**Duration**: 2 days

#### 3.2 Pattern Extraction

```typescript
// packages/learning/src/patterns.ts
export async function extractPattern(outcome: LearningOutcome): Promise<void> {
  // Look for similar past outcomes
  const similar = await db
    .select()
    .from(learningOutcomes)
    .where(
      and(
        eq(learningOutcomes.userId, outcome.userId),
        eq(learningOutcomes.domain, outcome.domain),
        eq(learningOutcomes.successful, true)
      )
    )
    .limit(10);
  
  // Find common tool sequences
  const toolSequences = similar.map(s => s.toolsUsed);
  const commonSequence = findCommonSequence(toolSequences);
  
  if (commonSequence.length >= 2) {
    // Store as pattern
    await db.insert(learningPatterns).values({
      userId: outcome.userId,
      domain: outcome.domain,
      triggerPattern: outcome.requirement,
      toolSequence: commonSequence,
      confidence: 0.8,
      usageCount: 1,
    });
  }
}
```

**Duration**: 3 days

#### 3.3 Integrate Learning into Context

```typescript
// packages/runtime/src/core/runtime.ts
async buildContext(input: UserRequest): Promise<ExecutionContext> {
  // ... existing context building
  
  // Add learnings
  const patterns = await this.learning.getPatterns({
    domain: this.inferDomain(input.requirement),
    userId: input.userId,
    minConfidence: 0.7,
  });
  
  const mistakes = await this.learning.getRecentMistakes({
    domain: this.inferDomain(input.requirement),
    userId: input.userId,
    limit: 3,
  });
  
  return {
    ...baseContext,
    patterns,
    mistakes, // So Alfred knows what NOT to do
  };
}
```

**Duration**: 2 days

**Phase 3 Total**: 7 days (~1.5 weeks)

---

## Phase 4: Domain-Specific Runtimes (Week 6)

### Goal
Create specialized runtimes for major use case domains.

### Tasks

#### 4.1 Proxmox Runtime

```typescript
// packages/runtime/src/domains/proxmox.ts
export class ProxmoxRuntime extends WorkflowRuntime {
  async buildContext(input: ProxmoxTask): Promise<ProxmoxContext> {
    const baseContext = await super.buildContext(input);
    
    // Load Proxmox-specific context
    const clusters = await this.knowledge.query({
      type: "proxmox_cluster",
      user_id: input.userId,
    });
    
    const preferences = {
      defaultStorage: await this.getPreference("proxmox.storage"),
      containerType: await this.getPreference("proxmox.container_type"),
      networkBridge: await this.getPreference("proxmox.network_bridge"),
    };
    
    return { ...baseContext, clusters, preferences };
  }
  
  buildSystemPrompt(context: ProxmoxContext): string {
    return `You are Alfred, an expert Proxmox administrator.

User's infrastructure:
${context.clusters.map(c => `- Cluster: ${c.name}, Nodes: ${c.nodes.length}`).join("\n")}

User preferences:
- Default storage: ${context.preferences.defaultStorage}
- Container type: ${context.preferences.containerType}

Past successful deployments:
${context.patterns.map(p => `- ${p.description}`).join("\n")}

Be specific and reference the user's actual infrastructure.`;
  }
}
```

**Duration**: 2 days per domain × 3 domains = 6 days

**Phase 4 Total**: 6 days (~1.5 weeks)

---

## Phase 5: Agent Package Restructuring (Week 7)

### Goal
Clean up naming confusion and improve package organization.

### Tasks

#### 5.1 Rename and Reorganize

```bash
# Move orchestrator tools
mv packages/agent/src/orchestrator/tool packages/agent/src/tools/orchestrator

# Move assistant tools
mv packages/agent/assistant/src/tool packages/agent/src/tools/assistant

# Move linear helpers
mv packages/agent/src/orchestrator/linear.ts packages/agent/src/helpers/linear.ts

# Update tool registry
mv packages/agent/src/v6.ts packages/agent/src/registry.ts
```

**Duration**: 2 days

#### 5.2 Update All Imports

```bash
# Use sed or global search/replace
find packages apps -name "*.ts" -o -name "*.tsx" | xargs sed -i 's/@alfred\/agent\/orchestrator\/tool/@alfred\/agent\/tools\/orchestrator/g'
```

**Duration**: 1 day

#### 5.3 Update Documentation

Update:
- `packages/agent/README.md`
- `packages/agent/package.json` exports
- Import examples in docs

**Duration**: 1 day

#### 5.4 Test Suite Verification

```bash
bun run test
bun run typecheck
```

Fix any import errors or test failures.

**Duration**: 1 day

**Phase 5 Total**: 5 days (~1 week)

---

## Success Criteria

### Phase 1 (Core Runtime)
- ✅ `CoreRuntime` class composes all domain packages
- ✅ `buildContext()` returns preferences + memories + cognitive state + learnings
- ✅ `recordOutcome()` updates learning and knowledge
- ✅ 100% test coverage for runtime composition
- ✅ Metrics instrumented and verified

### Phase 2 (Workflow Runtime)
- ✅ Real AI SDK v6 streaming with tools
- ✅ Tools actually execute (not placeholders)
- ✅ Events normalized from AI SDK to WorkflowEvent
- ✅ Knowledge graph updated in real-time during execution
- ✅ Cognitive state transitions during workflow phases
- ✅ End-to-end test with real OpenAI API

### Phase 3 (Learning Loop)
- ✅ Outcomes recorded after every workflow
- ✅ Patterns extracted from successful workflows
- ✅ Mistakes analyzed and recorded
- ✅ Learnings integrated into future context
- ✅ Demonstrable improvement over time (run same task twice, second is better)

### Phase 4 (Domain Runtimes)
- ✅ Proxmox runtime with infrastructure-specific context
- ✅ Development runtime with code/git context
- ✅ Productivity runtime with task/note context
- ✅ Domain-specific system prompts
- ✅ Domain-specific pattern recognition

### Phase 5 (Restructuring)
- ✅ All tools in `agent/src/tools/`
- ✅ No "orchestrator" naming confusion
- ✅ Clean import paths
- ✅ 100% test pass rate
- ✅ Documentation updated

---

## What Comes After

Once runtime integration is complete, these become unblocked:

### Immediate (Week 8-10)
1. **RAG Implementation** - Has a place to integrate (context building)
2. **Complete Assistant Tools** (focus, web, home) - Can be used by runtime
3. **Linear Activities** - Can emit real progress updates
4. **UI Implementation** - Can stream real workflow events

### Medium-term (Week 11-14)
5. **Workflow Suspend/Resume** - Runtime supports this pattern
6. **Voice Interface** - Can interact with working runtime
7. **Mobile App** - Can use same runtime via API

### Long-term (Week 15+)
8. **Advanced Learning** - More sophisticated pattern recognition
9. **Multi-domain Optimization** - Cross-domain learning
10. **Evaluation Framework** - Systematic improvement measurement

---

## Risk Mitigation

### Risk: Runtime Complexity Spirals
**Mitigation**: Start simple, prove integration works, then add features incrementally.

### Risk: Performance Degradation
**Mitigation**: Instrument everything, enforce budgets, profile early and often.

### Risk: Scope Creep
**Mitigation**: Stick to the 6-week plan. Don't add features to runtime until basic integration proves valuable.

### Risk: Breaking Changes
**Mitigation**: Comprehensive test suite, gradual migration, keep old runner until new one proves stable.

---

## Measurement

Track these metrics weekly:

1. **Integration Coverage**: % of workflows using runtime (target: 100%)
2. **Context Quality**: Avg items in context (preferences, memories, learnings)
3. **Learning Rate**: New patterns extracted per week
4. **Performance**: Context build time (target: <100ms)
5. **Test Coverage**: Runtime package coverage (target: >90%)

---

## Conclusion

The runtime integration layer is the **highest-leverage work** in the entire codebase. It transforms ALFRED from a collection of well-designed packages into an actual integrated intelligence system.

Everything else depends on this foundation.

**Estimated total time**: 6 weeks  
**Team size**: 1 developer (Jack)  
**Expected outcome**: Working, learning, context-aware AI assistant

Let's build it.
