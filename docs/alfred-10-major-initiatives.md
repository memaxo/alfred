# ALFRED: 10 Major Initiatives

A snapshot of the most impactful initiatives after the AI SDK v6 migration.

## 1. Harden AI SDK Streaming Endpoints (High)
- Add comprehensive SSE integration tests for `/api/assistant` and `/api/orchestrator`.
- Instrument Prometheus metrics for stream lifecycle events.
- Implement backpressure controls and graceful shutdown handling.

## 2. Workflow Runner Completion (High)
- Port legacy planning logic into the new workflow runner (replace placeholder events).
- Implement suspend/resume checkpoints with run registry integration.
- Add policy-aware gating (biometric obligations, autonomy thresholds).

## 3. RAG & Contextual Memory (High)
- Finish `packages/rag` ingest/retrieve APIs using AI SDK embeddings.
- Integrate retrieval into assistant/orchestrator context builders.
- Cache embeddings and expose metrics for hit/miss ratios.

## 4. Tooling Reliability (High)
- Add hermetic tests for docker/git/router tools.
- Improve error classification and retry/backoff policies.
- Wire structured logging and metrics for tool success/failure.

## 5. Linear Deep Integration (Medium)
- Enrich webhook payload handling (ticket state changes, comments).
- Mirror workflow status back to Linear issues and project boards.
- Implement proactive notifications for blocked runs.

## 6. Evaluation Harness (Medium)
- Replace the disabled `eval.run.start` path with an AI SDK-native evaluator.
- Persist run metadata and score distributions for regression tracking.
- Automate regression jobs via CI.

## 7. Voice Interface (Medium)
- Add speech-to-text and text-to-speech adapters with configurable providers.
- Surface latency/quality metrics and error handling for audio pipeline.

## 8. Observability & Alerting (Medium)
- Build Grafana dashboards for workflow throughput, tool latency, and stream health.
- Add alerting rules for stuck runs, resume failures, and tool error spikes.

## 9. Security & Compliance (Medium)
- Expand policy rules for new tools/endpoints.
- Implement audit log sinks (datadog/syslog) with retention policies.
- Harden secret rotation workflows.

## 10. UI Modernization (Medium)
- Refine chat UI theming, accessibility, and virtualization performance.
- Add workflow monitoring dashboards (progress timeline, resume actions).
- Build administrative controls for autonomy levels and policy overrides.
