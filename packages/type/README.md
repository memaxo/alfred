# @alfred/type

Shared data transfer objects and system events for the ALFRED monorepo.

## Type Hierarchy

### System Events
The core of ALFRED's communication is based on system events, unified in `packages/type/src/events.ts`.

- **DomainEvent**: The top-level union of all domain events.
  - `cognitive`: Events from `@alfred/cognitive` state machine.
  - `workflow`: Events from the orchestrator and workflow execution.
  - `stream`: Events from AI SDK v6 streams (text, tool calls, reasoning).
  - `voice`: Events from the voice pipeline (STT, TTS, VAD).

### Data Transfer Objects (DTOs)
- **CognitiveState**: Discriminated union of all possible cognitive states.
- **ImplementationPlan**: Orchestrator's plan structure.
- **UIMessage**: AI SDK v6 compatible message format.
- **Envelope**: Generic wrapper for persisted events with metadata (ID, version, timestamp, causal links).

## Conventions
- **Discriminants**: All discriminated unions use `_` as the discriminant property (e.g., `{ _: "idle" }`).
- **Purity**: Files in this package should generally be pure type definitions. Runtime code is permitted only for shared constants or basic serialization helpers.
- **Serialization**: Use `stableStringify` for deterministic JSON serialization.
- **Versioning**: All events are wrapped in an `EventEnvelope` with a version `v`. Use `deserializeWithMigration()` to handle backward compatibility.