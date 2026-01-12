# ai-devtools

Owner: infra

ALFRED supports optional AI SDK v6 DevTools and OpenTelemetry spans for AI SDK calls. Both features are opt-in and off by default.

## DevTools (AI SDK)

- Enable: set `AI_DEVTOOLS=1` and ensure `NODE_ENV` is not `"production"`.
- Run viewer: `bunx @ai-sdk/devtools` (opens `http://localhost:4983`).
- Storage: DevTools writes `.devtools/generations.json` in the repo root.

## Telemetry (OpenTelemetry)

- Enable: set `AI_TELEMETRY=1`.
- Behavior: ALFRED enables `experimental_telemetry` on key AI SDK calls and disables `recordInputs` / `recordOutputs` by default.
- Output: spans are emitted via OpenTelemetry; you must provide an exporter/tracer provider in your runtime environment.
