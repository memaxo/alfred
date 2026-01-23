## Escalation Semantics (Runtime)

1. Escalations are severity-scoped: `warning` continues; `blocking` suspends the workflow.
2. Prefer deterministic Runtime MCP escalation over file-based escalation; file escalation remains deprecated fallback only.
3. MCP escalation must return an immediate receipt; only `blocking` receipts trigger orchestrator abort.
4. Normalize all escalations into a single event path (`agent:escalate-request`) for realtime UI and history persistence.
