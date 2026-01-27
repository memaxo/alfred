# ALFRED Hooks System

> **Owner:** platform
> **Status:** Implementation (Phases 1-4 complete, Phase 5 partial, Phases 6-7 complete)
> **Inspired by:** [Cursor Agent Hooks](https://cursor.com/docs/agent/hooks)

## Purpose

Design and implement a user-extensible hooks system for ALFRED that allows observation, control, and extension of the agent loop, cognitive transitions, memory operations, and voice interactions. Unlike Cursor (a general IDE agent), ALFRED's hooks leverage its unique differentiators: event-sourced cognition, hypergraph memory, self-supervision, and single-user personalization.

## Case Study: Cursor Hooks

### What Cursor Does Well

1. **Simple JSON configuration** - `hooks.json` at project/user/global levels
2. **Stdio protocol** - Scripts receive JSON input, return JSON output
3. **Permission model** - `allow | deny | ask` for gating operations
4. **Matchers** - Filter hooks by tool name, subagent type
5. **Prompt-based hooks** - LLM evaluation for natural language policies
6. **Exit code semantics** - `0` = success, `2` = deny, other = fail-open
7. **Environment injection** - `sessionStart` can inject env vars for session
8. **Fail-closed for sensitive ops** - `beforeMCPExecution`, `beforeReadFile` block on hook failure
9. **Loop limits** - `loop_limit` prevents infinite follow-up loops
10. **Partner integrations** - Security, governance, secrets management

### What ALFRED Can Do Better

1. **Cognitive-aware hooks** - Hook into cognitive state transitions, not just tool execution
2. **Memory hooks** - Observe and control knowledge graph operations
3. **Learning hooks** - Influence pattern extraction and heuristic formation
4. **Autonomy hooks** - Dynamic autonomy adjustment based on context
5. **Voice hooks** - Real-time speech processing with barge-in awareness
6. **Preference hooks** - User preference learning and application
7. **Typed events** - TypeScript-first with full type definitions (not just JSON)
8. **Observable hooks** - Hooks can emit their own events to the workflow stream
9. **Async/streaming hooks** - Support for long-running and streaming hooks
10. **Learning from hooks** - ALFRED can learn which hooks fire when and why

---

## ALFRED Hooks Architecture

### Design Principles

1. **TypeScript-first** - Full type definitions; JSON config is optional sugar
2. **Observer-compatible** - Hooks implement `PipelineObserver`-like interface
3. **Event-sourced** - All hook executions are events in the audit log
4. **Learning-enabled** - ALFRED learns hook patterns over time
5. **Single-user optimized** - No multi-tenant isolation concerns
6. **Fail-safe defaults** - Sensible fail-open/closed per hook category
7. **Composable** - Hooks can chain, filter, and transform events
8. **Performance-budgeted** - Hook categories have latency budgets

### Hook Categories

#### 1. Lifecycle Hooks (Session/Workflow)

| Hook                | Trigger                           | Use Cases                                             |
| ------------------- | --------------------------------- | ----------------------------------------------------- |
| `session:start`     | New conversation begins           | Init telemetry, inject context, load preferences      |
| `session:end`       | Conversation ends                 | Cleanup, persist stats, trigger learning              |
| `workflow:start`    | Pipeline execution begins         | Validate permissions, setup workspace                 |
| `workflow:suspend`  | Biometric elevation required      | Notify user, prepare elevation UI                     |
| `workflow:resume`   | Execution resumes after elevation | Verify bio-ticket, restore context                    |
| `workflow:complete` | Pipeline completes                | Persist artifacts, update Linear, trigger learn stage |
| `workflow:error`    | Unrecoverable error               | Error reporting, recovery suggestions                 |

#### 2. Cognitive Hooks (State Transitions)

| Hook                         | Trigger                              | Use Cases                              |
| ---------------------------- | ------------------------------------ | -------------------------------------- |
| `cognitive:transition`       | Any state change                     | Audit, custom state logging            |
| `cognitive:input`            | User input received                  | Intent classification override         |
| `cognitive:thinking`         | Enters thinking state                | Show thinking indicator, start timer   |
| `cognitive:deciding`         | Agent making decision                | Policy gates, autonomy checks          |
| `cognitive:acting`           | Action execution begins              | Permission checks, resource allocation |
| `cognitive:learning`         | Learning phase begins                | Custom pattern extraction              |
| `cognitive:autonomy:change`  | Autonomy level changes               | Notify user, update UI                 |
| `cognitive:physiology:alert` | Energy/boredom/frustration threshold | Adaptive behavior suggestions          |

#### 3. Agent Hooks (Tool/Execution)

| Hook                 | Trigger                   | Use Cases                            |
| -------------------- | ------------------------- | ------------------------------------ |
| `agent:spawn`        | Sub-agent created         | Resource limits, context injection   |
| `agent:tool:before`  | Before any tool execution | Permission gate, input validation    |
| `agent:tool:after`   | After tool execution      | Audit, output transformation         |
| `agent:tool:error`   | Tool execution failed     | Recovery, escalation decision        |
| `agent:escalate`     | Agent requests escalation | Human review, auto-approve policies  |
| `agent:stuck`        | Stuck detection triggered | Recovery strategies, context refresh |
| `agent:shell:before` | Before shell command      | Security scan, blocklist check       |
| `agent:shell:after`  | After shell command       | Output capture, artifact detection   |
| `agent:file:before`  | Before file read/write    | Access control, redaction            |
| `agent:file:after`   | After file edit           | Format, lint, commit hook            |
| `agent:mcp:before`   | Before MCP tool           | MCP governance, credential check     |
| `agent:mcp:after`    | After MCP tool            | Result validation, caching           |

#### 4. Memory Hooks (Knowledge Graph)

| Hook                 | Trigger                         | Use Cases                            |
| -------------------- | ------------------------------- | ------------------------------------ |
| `memory:search`      | Semantic search initiated       | Query augmentation, result filtering |
| `memory:retrieve`    | Memory node retrieved           | Access logging, confidence boost     |
| `memory:create`      | New memory created              | Validation, classification           |
| `memory:update`      | Memory updated                  | Change tracking, conflict detection  |
| `memory:decay`       | Memory confidence decayed       | Archive decision, reinforcement      |
| `memory:forget`      | Memory deleted                  | Audit, GDPR compliance               |
| `memory:traverse`    | Graph traversal executed        | Path logging, cycle detection        |
| `memory:consolidate` | Memory consolidation (dreaming) | Custom heuristic injection           |

#### 5. Learning Hooks (Self-Supervision)

| Hook                        | Trigger                      | Use Cases                     |
| --------------------------- | ---------------------------- | ----------------------------- |
| `learn:pattern:detected`    | New pattern identified       | Validation, custom extraction |
| `learn:heuristic:proposed`  | Heuristic about to be stored | Approval, modification        |
| `learn:convention:learned`  | Convention extracted         | Scope control, override       |
| `learn:antipattern:flagged` | Failed strategy recorded     | Context enrichment            |
| `learn:feedback:positive`   | Positive outcome recorded    | Reinforcement multiplier      |
| `learn:feedback:negative`   | Negative outcome recorded    | Custom recovery logic         |

#### 6. Voice Hooks (Speech Pipeline)

| Hook                  | Trigger                   | Use Cases                       |
| --------------------- | ------------------------- | ------------------------------- |
| `voice:session:start` | Voice session opened      | Device setup, noise calibration |
| `voice:session:end`   | Voice session closed      | Stats, quality metrics          |
| `voice:stt:before`    | Before speech-to-text     | Audio preprocessing, noise gate |
| `voice:stt:after`     | After transcription       | Correction, PII redaction       |
| `voice:tts:before`    | Before text-to-speech     | SSML injection, rate adjustment |
| `voice:tts:after`     | After speech generated    | Volume normalization            |
| `voice:bargein`       | User interrupted TTS      | Priority handling, context save |
| `voice:silence`       | Extended silence detected | Timeout handling, prompt        |

#### 7. UI Hooks (Mindscape/Desktop)

| Hook                   | Trigger                  | Use Cases                        |
| ---------------------- | ------------------------ | -------------------------------- |
| `ui:window:open`       | Window spawned           | Layout constraints, focus rules  |
| `ui:window:close`      | Window closed            | State persistence, cleanup       |
| `ui:focus:change`      | Focus gravity shift      | Dim/blur effects, context switch |
| `ui:notification:show` | Notification displayed   | Priority filtering, aggregation  |
| `ui:genui:render`      | GenUI component rendered | Validation, fallback             |

#### 8. Policy Hooks (Security/Governance)

| Hook                   | Trigger                       | Use Cases               |
| ---------------------- | ----------------------------- | ----------------------- |
| `policy:check`         | PDP evaluation requested      | Custom policy injection |
| `policy:elevate`       | Biometric elevation requested | Alternative auth, MFA   |
| `policy:deny`          | Action denied by policy       | Audit, appeal workflow  |
| `policy:scope:request` | New tool scope requested      | Just-in-time approval   |

---

## Hook Configuration

### TypeScript-First Registration

```typescript
// packages/hooks/src/register.ts
import type { HookRegistry } from "@alfred/hooks";

export function registerHooks(registry: HookRegistry): void {
  // Lifecycle hooks
  registry.on("workflow:complete", async (event, ctx) => {
    // Trigger custom analytics
    await ctx.emit({ type: "hook:analytics", data: event });
  });

  // Cognitive hooks with autonomy awareness
  registry.on("cognitive:deciding", async (event, ctx) => {
    if (ctx.autonomy < 0.5 && event.action.risk === "high") {
      return { decision: "ask", reason: "High-risk action with low autonomy" };
    }
    return { decision: "allow" };
  });

  // Memory hooks for PII protection
  registry.on("memory:create", async (event, ctx) => {
    const redacted = await redactPII(event.content);
    return { ...event, content: redacted };
  });

  // Learning hooks for custom patterns
  registry.on("learn:pattern:detected", async (event, ctx) => {
    // Validate pattern before storage
    if (event.pattern.confidence < 0.7) {
      return { decision: "deny", reason: "Insufficient confidence" };
    }
    return { decision: "allow" };
  });
}
```

### JSON Configuration (Optional Sugar)

```jsonc
// ~/.alfred/hooks.json
{
  "version": 1,
  "hooks": {
    "agent:shell:before": [
      {
        "command": "./hooks/security-scan.sh",
        "timeout": 10,
        "fail_mode": "closed", // Block on hook failure (default for security)
        "matcher": { "command_pattern": "^(rm|sudo|curl)" },
      },
      {
        "type": "prompt",
        "prompt": "Is this shell command safe? Context: $CONTEXT",
        "model": "gpt-oss-20b",
      },
    ],
    "memory:create": [
      {
        "command": "bun run ~/.alfred/hooks/redact-pii.ts",
        "timeout": 5,
        "transform": true, // Hook output replaces event data
      },
    ],
    "cognitive:autonomy:change": [
      {
        "command": "./hooks/notify-autonomy.sh",
        "async": true, // Fire-and-forget, don't block
      },
    ],
    "voice:stt:after": [
      {
        "command": "./hooks/correct-transcription.py",
        "timeout": 2,
        "transform": true,
      },
    ],
  },
}
```

### Environment Variables

Hooks receive environment variables:

| Variable                 | Description                      |
| ------------------------ | -------------------------------- |
| `ALFRED_SESSION_ID`      | Current session identifier       |
| `ALFRED_WORKFLOW_ID`     | Current workflow run ID          |
| `ALFRED_USER_ID`         | User identifier                  |
| `ALFRED_AUTONOMY`        | Current autonomy level (0.0-1.0) |
| `ALFRED_COGNITIVE_STATE` | Current cognitive state          |
| `ALFRED_PROJECT_DIR`     | Active project directory         |
| `ALFRED_VERSION`         | ALFRED version string            |
| `ALFRED_TRANSCRIPT_PATH` | Path to conversation transcript  |
| `ALFRED_HOOK_EVENT`      | Hook event name                  |

---

## Hook Protocol

### Input Schema

All hooks receive JSON input via stdin:

```typescript
interface HookInput<T = unknown> {
  // Common fields
  hook_event: string; // e.g., "agent:shell:before"
  session_id: string;
  workflow_id?: string;
  timestamp: string; // ISO 8601
  alfred_version: string;

  // Cognitive context
  cognitive: {
    state: CognitiveState; // idle | thinking | deciding | acting | learning
    autonomy: number; // 0.0-1.0
    physiology: {
      energy: number;
      boredom: number;
      frustration: number;
    };
  };

  // Event-specific payload
  payload: T;

  // Optional context
  context?: {
    recent_events: HookInput[]; // Last N events for context
    preferences: UserPreferences;
    active_project?: ProjectInfo;
  };
}
```

### Output Schema

```typescript
interface HookOutput<T = unknown> {
  // Decision (for gating hooks)
  decision?: "allow" | "deny" | "ask";
  reason?: string; // Shown to agent when denied

  // Messages
  user_message?: string; // Shown to user
  agent_message?: string; // Injected into agent context

  // Transformation (for transform hooks)
  transformed?: T; // Replaces input payload

  // Continuation (for lifecycle hooks)
  followup_message?: string; // Auto-submit as next user message

  // Environment injection (for session:start)
  env?: Record<string, string>;

  // Context injection
  additional_context?: string;

  // Emit additional events
  emit?: WorkflowEvent[];

  // Learning hints
  learn?: {
    pattern?: string; // Suggest pattern to learn
    feedback?: "positive" | "negative";
    weight?: number;
  };
}
```

### Exit Code Semantics

| Exit Code | Meaning   | Behavior                                 |
| --------- | --------- | ---------------------------------------- |
| `0`       | Success   | Use JSON output                          |
| `1`       | Error     | Fail-open (default) or fail-closed       |
| `2`       | Deny      | Block action (equiv. `decision: "deny"`) |
| `3`       | Transform | Use stdout as transformed payload        |
| `4`       | Skip      | Skip remaining hooks for this event      |

---

## Fail Modes

Hooks specify fail mode for when the script fails (timeout, crash, invalid output):

| Category             | Default Fail Mode | Rationale                            |
| -------------------- | ----------------- | ------------------------------------ |
| `session:*`          | open              | Don't block session on hook failure  |
| `workflow:*`         | open              | Don't block workflow on hook failure |
| `cognitive:*`        | open              | Cognitive loop must continue         |
| `agent:shell:before` | closed            | Security-critical                    |
| `agent:file:before`  | closed            | Security-critical                    |
| `agent:mcp:before`   | closed            | Security-critical                    |
| `agent:tool:after`   | open              | Audit only                           |
| `memory:*`           | open              | Don't block memory ops               |
| `learn:*`            | open              | Learning is best-effort              |
| `voice:*`            | open              | Real-time latency critical           |
| `ui:*`               | open              | UI must remain responsive            |
| `policy:*`           | closed            | Security-critical                    |

---

## Performance Budgets

Each hook category has a latency budget:

| Category            | Budget | Rationale                             |
| ------------------- | ------ | ------------------------------------- |
| `cognitive:*`       | 10ms   | Hot path, <100µs ideal for transition |
| `voice:*`           | 50ms   | Real-time audio processing            |
| `agent:tool:before` | 100ms  | Can gate but shouldn't block          |
| `agent:tool:after`  | 500ms  | Async-ok for audit                    |
| `memory:*`          | 100ms  | Part of RAG pipeline                  |
| `learn:*`           | 1s     | Offline-ok                            |
| `workflow:*`        | 500ms  | Setup/teardown                        |
| `ui:*`              | 16ms   | 60fps frame budget                    |

Hooks exceeding budget emit `hook:budget:exceeded` event and are marked for optimization.

---

## Learning from Hooks

ALFRED learns from hook executions:

1. **Pattern Correlation** - Which hooks fire together? Before what outcomes?
2. **Timing Patterns** - When are certain hooks most useful?
3. **User Preferences** - Which hooks does user enable/disable?
4. **Failure Patterns** - Which hooks fail and when?
5. **Transformation Quality** - Do hook transformations improve outcomes?

This learning informs:

- Auto-suggested hooks for new users
- Hook ordering optimization
- Proactive hook recommendations
- Budget adjustments

---

## Package Structure

```
packages/
├── hooks/
│   ├── src/
│   │   ├── index.ts           # Public API
│   │   ├── registry.ts        # Hook registration
│   │   ├── executor.ts        # Hook execution engine
│   │   ├── protocol.ts        # Input/output schemas
│   │   ├── loader.ts          # JSON config loader
│   │   ├── matchers.ts        # Event filtering
│   │   ├── budgets.ts         # Performance monitoring
│   │   ├── events.ts          # Hook-related events
│   │   └── types.ts           # TypeScript definitions
│   ├── observers/
│   │   ├── pipeline.ts        # PipelineObserver adapter
│   │   ├── cognitive.ts       # Cognitive event hooks
│   │   └── memory.ts          # Memory operation hooks
│   └── test/
│       ├── registry.test.ts
│       ├── executor.test.ts
│       └── fixtures/
├── hooks-cli/                  # Hook development tools
│   ├── src/
│   │   ├── create.ts          # Scaffold new hook
│   │   ├── test.ts            # Test hook locally
│   │   ├── validate.ts        # Validate hooks.json
│   │   └── debug.ts           # Debug hook execution
```

---

## Integration Points

### Pipeline Integration

```typescript
// packages/pipeline/src/runner.ts
import { HooksObserver } from "@alfred/hooks/observers/pipeline";

const runner = new PipelineRunner(config);
runner.addObserver(new HooksObserver(hookRegistry));
```

### Cognitive Integration

```typescript
// packages/cognitive/src/transition.ts
import { emitHook } from "@alfred/hooks";

export function applyTransition(
  state: CognitiveState,
  event: CognitiveEvent
): CognitiveState {
  const hookResult = await emitHook("cognitive:transition", { state, event });
  if (hookResult.decision === "deny") {
    return state; // No transition
  }
  return applyTransitionPure(state, hookResult.transformed ?? event);
}
```

### Voice Integration

```typescript
// packages/voice/src/services/stt.ts
import { emitHook } from "@alfred/hooks";

export async function transcribe(audio: Buffer): Promise<string> {
  const beforeResult = await emitHook("voice:stt:before", { audio });
  if (beforeResult.decision === "deny") throw new TranscriptionDenied();

  const transcript = await runSTT(beforeResult.transformed?.audio ?? audio);

  const afterResult = await emitHook("voice:stt:after", { transcript });
  return afterResult.transformed?.transcript ?? transcript;
}
```

---

## Example Hooks

### Security: Block Dangerous Commands

```bash
#!/bin/bash
# hooks/security-scan.sh
input=$(cat)
command=$(echo "$input" | jq -r '.payload.command')

# Block rm -rf /
if echo "$command" | grep -qE '^rm\s+-rf\s+/'; then
  echo '{"decision":"deny","reason":"Blocked: destructive command"}'
  exit 2
fi

# Require confirmation for sudo
if echo "$command" | grep -q '^sudo'; then
  echo '{"decision":"ask","user_message":"Sudo command requires approval"}'
  exit 0
fi

echo '{"decision":"allow"}'
```

### Privacy: Redact PII from Memory

```typescript
// hooks/redact-pii.ts
import { readFileSync } from "fs";

const input = JSON.parse(readFileSync("/dev/stdin", "utf-8"));
const content = input.payload.content;

// Redact email addresses
const redacted = content.replace(
  /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
  "[EMAIL_REDACTED]"
);

// Redact phone numbers
const finalContent = redacted.replace(
  /(\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g,
  "[PHONE_REDACTED]"
);

console.log(
  JSON.stringify({
    transformed: { ...input.payload, content: finalContent },
  })
);
```

### Learning: Custom Pattern Extraction

```typescript
// hooks/custom-patterns.ts
import { readFileSync } from "fs";

const input = JSON.parse(readFileSync("/dev/stdin", "utf-8"));
const { pattern, context } = input.payload;

// Only learn patterns from specific projects
if (!context.active_project?.path.includes("alfred")) {
  console.log(
    JSON.stringify({ decision: "deny", reason: "Not in ALFRED project" })
  );
  process.exit(0);
}

// Boost confidence for test patterns
const boosted =
  pattern.type === "test_pattern"
    ? { ...pattern, confidence: Math.min(pattern.confidence * 1.2, 1.0) }
    : pattern;

console.log(
  JSON.stringify({
    decision: "allow",
    transformed: { ...input.payload, pattern: boosted },
    learn: { pattern: "custom_pattern_boosting", feedback: "positive" },
  })
);
```

### Voice: Transcription Correction

```python
#!/usr/bin/env python3
# hooks/correct-transcription.py
import json
import sys
import re

input_data = json.load(sys.stdin)
transcript = input_data["payload"]["transcript"]

# Common corrections for technical terms
corrections = {
    "alfred": "ALFRED",
    "pipeline": "pipeline",
    "cognitive": "cognitive",
    "hypergraph": "hypergraph",
}

corrected = transcript
for wrong, right in corrections.items():
    corrected = re.sub(rf"\b{wrong}\b", right, corrected, flags=re.IGNORECASE)

print(json.dumps({
    "transformed": {**input_data["payload"], "transcript": corrected}
}))
```

---

## Comparison: Cursor vs ALFRED Hooks

| Aspect         | Cursor Hooks             | ALFRED Hooks                                 |
| -------------- | ------------------------ | -------------------------------------------- |
| **Scope**      | Tool execution, file ops | Full cognitive/memory/learning loop          |
| **Config**     | JSON only                | TypeScript-first + JSON sugar                |
| **Events**     | ~15 hook points          | 50+ hook points across all subsystems        |
| **Context**    | Basic (session, model)   | Rich (cognitive state, autonomy, physiology) |
| **Learning**   | None                     | ALFRED learns from hook patterns             |
| **Typing**     | Loose JSON               | Full TypeScript definitions                  |
| **Streaming**  | None                     | Hooks can emit workflow events               |
| **Memory**     | None                     | Full memory operation hooks                  |
| **Voice**      | None                     | Real-time voice pipeline hooks               |
| **Autonomy**   | Static permissions       | Dynamic autonomy-aware decisions             |
| **Multi-user** | Team distribution        | Single-user optimized                        |

---

## Plan

### Phase 1: Core Infrastructure

- [x] Create `packages/hooks` with registry, executor, protocol
- [x] Define TypeScript types for all hook categories
- [x] Implement JSON config loader with validation
- [x] Add performance budgeting infrastructure
- [x] Write unit tests for core functionality

### Phase 2: Pipeline Integration

- [x] Create `HooksObserver` for pipeline events
- [x] Map pipeline events to hook events (workflow lifecycle + stage/review/learn/budget/wave/context)
- [x] Implement fail-mode handling
- [x] Add hook execution metrics
- [x] Wire `HooksObserver` into pipeline runner construction sites

### Phase 3: Cognitive Integration

- [x] Hook into cognitive state transitions
- [x] Expose autonomy and physiology in hook context
- [x] Implement cognitive-aware permission model

### Phase 4: Memory Integration

- [x] Hook into memory operations (search, retrieve, update, forget, traverse)
- [x] Support transformation hooks for PII/redaction
- [x] Integrate with knowledge graph traversal

### Phase 5: Learning Integration

- [x] Hook into explicit learning tools (pattern/feedback/mistake)
- [ ] Enable hook-suggested learning
- [ ] Track hook execution patterns for meta-learning

### Phase 6: Voice Integration

- [x] Hook into STT/TTS pipeline
- [x] Real-time hooks with strict latency budget
- [x] Barge-in awareness in hooks

### Phase 7: CLI & Developer Experience

- [x] Create `alfred hooks create` scaffolding
- [x] Add `alfred hooks test` for local testing
- [x] Add `alfred hooks validate` for config validation
- [x] Add `alfred hooks debug` for execution tracing

---

## Progress

### 2026-01-27

- Phase 2 pipeline mapping:
  - Added workflow pipeline hook event types in `packages/type/src/hooks.ts`.
  - Extended `packages/hookpipe/src/pipeline.ts` mapping and added `packages/hookpipe/test/pipeline.test.ts`.
- Phase 3 cognitive permission gating:
  - Enforced `deny|ask` decisions via `interrupt` events in `packages/runtime/src/loops/cognitive.ts` and `packages/cognitive/src/transition.ts`.
- Phase 6 voice hooks:
  - Added `voice:*` hooks to `packages/voice/src/server/session.ts` and threaded hooks through WebRTC voice sessions in `packages/api/src/voice/webrtcsession.ts`.
- Phase 7 CLI:
  - Added `alfred hooks {create,validate,test,debug}` in `packages/tui/src/commands/hooks.ts` and wired into `packages/tui/src/cli/index.ts`.
  - Tests: `packages/tui/test/hooks.test.ts`.

- Validation (scoped):
  - `bunx tsgo -b packages/type/tsconfig.json packages/hooks/tsconfig.json packages/hookpipe/tsconfig.json packages/runtime/tsconfig.json packages/voice/tsconfig.json`
  - `bun scripts/test-bun.ts packages/hookpipe/test/pipeline.test.ts packages/runtime/test/cognitive-hooks.test.ts packages/voice/test/utils/audio-resample.test.ts`
  - `bun scripts/test-bun.ts packages/tui/test/cli.test.ts packages/tui/test/hooks.test.ts`

### 2026-01-25

- Implemented `@alfred/hooks` package (`packages/hooks`) with:
  - `createHookRegistry()` (typed `on()`/`emit()`, transform chaining, decision gating, skip semantics)
  - Command-hook executor via `Bun.spawn` (`stdin` JSON → `stdout` JSON + exit code semantics)
  - Hook matchers (toolName/agentType/commandPattern/state/risk/memoryKind)
  - Budget + fail-mode resolution (`DEFAULT_HOOK_BUDGETS`, `DEFAULT_FAIL_MODES`)
  - `hooks.json` loader with Zod validation
  - Pipeline observer scaffold (`HooksObserver`) mapping pipeline lifecycle → workflow hooks
- Updated `@alfred/type` hook types (`packages/type/src/hooks.ts`) to match implementation (`HookHandler(event, ctx)`, `HookHandlerResult`, richer `HookContext`, `skipRemaining`).
- Wired `HooksObserver` into API/voice pipeline runner construction (best-effort load from `<workspace>/hooks.json`):
  - `packages/api/src/workflow/hooks.ts`
  - `packages/api/src/routers/workflow/{stream,resume}.ts`
  - `packages/api/src/routers/workflow/phase/{plan,execute}.ts`
  - `packages/api/src/voice/workflow-handler.ts`
- Expanded pipeline→hook mapping to include `agent:{spawn,stuck,escalate}` events.
- Added hook system events for metrics/observability:
  - `hook:executed`
  - `hook:error`
  - (existing) `hook:budget:exceeded`
- Validation:
  - `bun x tsgo -b packages/type packages/hooks`
  - `ALFRED_TEST_SCOPE=unit bun scripts/test-bun.ts packages/hooks/test/*.test.ts`

- Added Phase 3 cognitive integration (best-effort, opt-in via `RuntimeContext`):
  - `packages/runtime/src/loops/cognitive.ts`: emits cognitive hook events (`cognitive:input` w/ transform, `cognitive:transition`, `cognitive:{thinking,deciding,acting,learning}`, `cognitive:autonomy:change`, `cognitive:physiology:alert`) when `ctx.get("hooks")` is present.
  - `packages/api/src/workflow/hooks.ts`: `ensureHooksRuntime()` helper to attach `{ registry, ctx }` onto `RuntimeContext`.
  - Wired `ensureHooksRuntime()` into:
    - `packages/api/src/voice/assistant.ts`
    - `packages/api/src/routers/cognitive.ts` (feedback loop)
  - Tests:
    - `packages/runtime/test/cognitive-hooks.test.ts`
    - `packages/api/test/workflow.hooks.test.ts`

## Surprises & Discoveries

- `Bun.spawn()` is not reliably runnable inside `bun test` in this environment (subprocesses exit `1` with no output), so the command-hook unit test uses a `Bun.spawn` mock.

## Decision Log

| Date       | Decision                        | Rationale                                                     |
| ---------- | ------------------------------- | ------------------------------------------------------------- |
| 2026-01-24 | TypeScript-first, JSON as sugar | ALFRED is TS-native; type safety > portability                |
| 2026-01-24 | 50+ hook points vs Cursor's ~15 | ALFRED's architecture is richer (cognitive, memory, learning) |
| 2026-01-24 | Learning from hooks             | Single-user means we can learn preferences deeply             |
| 2026-01-24 | Autonomy-aware permissions      | Dynamic autonomy is unique to ALFRED                          |
| 2026-01-25 | Minimal env for hook subprocess | Avoid leaking test/CI env into hooks; predictable execution   |
| 2026-01-25 | Mock `Bun.spawn` in unit tests  | Keep unit tests deterministic despite subprocess limitations  |

## Outcomes & Retrospective

- Phase 1 complete: core hooks registry + config loader + command executor + unit tests.
- Phase 2 started: pipeline observer exists but is not yet wired into pipeline runner call sites.

- Added Phase 4 memory tool hooks (AI SDK v6 `ToolCallOptions.experimental_context`):
  - `packages/agent/assistant/src/tool/memory/{retrieve,update,remove,boost,traverse,search}.ts`: emits `memory:*` hook events with allow/deny/ask gating and transform support.
  - `packages/agent/src/v6.ts`: threads tool `options` into legacy tool execute signature.
  - `packages/api/src/{routers/assistant.ts,services/orchestrator.ts,voice/assistant.ts}`: constructs hook runtime per request and passes it to `generateText()` via `experimental_context`.
  - Tests: `packages/agent/test/tool/memory.test.ts` (hook transform + deny).

- Fixed unrelated typecheck regressions:
  - `packages/history/src/history-context.ts`: import + timing fix.
  - `packages/pipeline/src/snapshot.ts`: explicit default return in reducer.

- Validation:
  - `bun test packages/agent/test/tool/memory.test.ts`
  - `bun test packages/pipeline/test/snapshot.test.ts packages/history/test/history-context.test.ts`
  - `bun run typecheck`

- Added Phase 5 learning tool hooks:
  - `packages/agent/src/orchestrator/tool/learning/index.ts`: emits `learn:{pattern:detected,feedback:{positive,negative},heuristic:proposed}` with gating + transform.
  - Tests: `packages/agent/test/learning.test.ts`.
