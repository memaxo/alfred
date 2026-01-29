# signals

Purpose: Define ALFRED’s LLM-judged “signals” system (friction + delight + interventions), including how it integrates with chat, pipeline, AgentFS, and learning, without heuristics or raw-content persistence.

Owner: runtime

## Overview

- **Signals**: Structured, privacy-preserving summaries of friction and delight identified by an LLM judge.
- **Interventions**: Judge-recommended steering messages injected at a consistent cadence (step-based via `prepareStep`).
- **Principle**: Detection is **LLM-first** (“LLM-as-a-logic-circuit”). Runtime code must not implement keyword/regex detectors or branching rule forests.

## Enablement

- **Env**: `ALFRED_SIGNALS=1`
- **Model**: Uses the **classify** role (`AI_MODEL_CLASSIFY` / `getClassificationModel()`).

## Data model

- **Schemas/types**: `packages/type/src/signals.ts`
- **Enrichment attachment**:
  - `packages/type/src/enrichment.ts` extends `FailureContext` and `StructuredHandoff` with `signals`, `delight`, and `interventions`.

## Integration surfaces

### Chat (step cadence + injection)

- **Where**: `packages/api/src/stream-handler.ts`
- **How**:
  - Wraps tools to collect fact-only tool outcomes.
  - Wraps `prepareStep` to run the judge per step and inject the top intervention as a system message.
  - Emits an abstract summary on the `finish` metadata payload (`metadata.signals`).

### Pipeline (durable run timeline)

- **Where**: `packages/pipeline/src/stages/execute.ts`
- **Event**: `agent:signal` (see `packages/pipeline/src/events.ts`)
- **Persistence mapping**: `packages/api/src/workflow/persist.ts`
  - Stored as workflow event `eventType: "report"` and `data.kind: "agent_signal"`.

### AgentFS KV (per-task persistence)

- **Keys + API**:
  - `packages/agent/src/agentfs/keys.ts` (`signals:<taskId>`)
  - `packages/agent/src/agentfs/signals.ts`
- **Runtime write**: `packages/runtime/src/orchestrator/agent.ts`

### Learning (knowledge enrichment)

- **Where**: `packages/agent/src/orchestrator/learning-worker.ts`
- **How**: reads `agent_signal` workflow reports and adds abstract “Signals:” summaries to the learning input.

## Privacy + redaction requirements

- Store and send only **abstract citations** (no raw user quotes, no code snippets, no raw paths).
- Trace collection must be **fact-only**:
  - ok: tool name, success/error, timing, step count
  - not ok: full tool input/output, user text, code deltas, file paths
- Use existing redaction utilities (e.g. `packages/agent/src/utils/redaction.ts`) for strings and structured objects.

## Metrics

- **Definitions**: `packages/metrics/src/signals.ts`
- **Emitted from**:
  - chat: `packages/api/src/stream-handler.ts`
  - pipeline: `packages/pipeline/src/stages/execute.ts`
  - agentfs: `packages/runtime/src/orchestrator/agent.ts`

## Testing

- Prompt hooks: `packages/hooks/test/prompt.test.ts`
- Judge wrapper: `packages/agent/test/signals.test.ts`
- Chat injection path: `apps/web/src/lib/api/__tests__/stream-handler.signals.test.ts`
