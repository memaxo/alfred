# Signals (LLM Judge)

## Rules

1. Signals detection must be LLM-judged via `generateObject` + Zod schema; no keyword/regex detectors or heuristic branch forests.
2. Signals inputs must be fact-only traces; never send raw user quotes, code, or file paths to the judge.
3. Persist only abstract citations and structured summaries (`FrictionSignal`, `DelightSignal`, `SignalIntervention`).
4. Gate judge execution behind `ALFRED_SIGNALS=1`.
5. Use `getClassificationModel()` (classify role) for all signals judging.
6. Chat steering must be step-cadenced via AI SDK `prepareStep` and inject only system guidance derived from the judge output.
7. Workflow durability must flow through pipeline events (`agent:signal`) mapped to workflow events (`eventType: "report"`, `kind: "agent_signal"`).
8. AgentFS persistence must use KV keys `signals:<taskId>` and validate payloads with Zod before writing.
9. Learning worker consumption must summarize signals as types/actions only; do not replay raw content.
10. Add metrics for judge latency and counts across surfaces (chat/pipeline/agentfs).
