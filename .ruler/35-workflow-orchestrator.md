## Workflow Orchestrator Modularity

1. Keep workflow orchestrators as thin coordinators that wire executor, registry, persistence, and side effects.
2. Split orchestrator concerns into focused single-word modules (`linear`, `history`, `observe`, `persist`, `lifecycle`, `timeout`) within the same domain folder.
3. Enforce redaction before any persistence or external emission (Linear, UI callbacks).
4. Persist every workflow event using the envelope wrapper and deterministic event IDs (`wrapEventEnvelope` + `makeEventId`).
5. Metrics and external integrations (Linear) must never break streaming; log and swallow their failures.
6. Make terminal transitions single-shot: exactly one of cancelled/suspended/completed/failed, and `emitComplete` must fire once.
7. Always pair `registerRunHandle` with `unregisterRunHandle` via `finally`.
8. Enforce a workflow-level global timeout (30 minutes) that aborts the run and updates status to failed.

