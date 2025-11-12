# Orchestrator Quickstart

This guide shows how to start a workflow, stream events via SSE, resume with authorization, and replay persisted UI messages.

## Prereqs
- Set `OPENAI_API_KEY` in your `.env` (or use mocks in tests).
- Run the dev server: `bun run dev`.

## Start a Workflow (tRPC /start)

```bash
curl -sS -X POST http://localhost:3000/api/trpc/workflow.start \
  -H 'Content-Type: application/json' \
  --data-binary '{"0":{"json":{"requirement":"add a status endpoint","auto":"low"}}}'
```

Response includes `runId`. Use it to stream and replay.

## Stream via HTTP SSE

```bash
RUN_ID=YOUR_RUN_ID
curl -N -sS -X POST http://localhost:3000/api/orchestrator \
  -H 'Content-Type: application/json' \
  --data '{"requirement":"add a status endpoint","auto":"low"}'
```

You should see events like `run`, `progress`, and possibly `require-scope`.

## Resume with Authorization

When a `require-scope` event arrives, resume with an auth token:

```bash
curl -sS -X POST http://localhost:3000/api/trpc/workflow.resume \
  -H 'Content-Type: application/json' \
  --data-binary '{"0":{"json":{"runId":"'$RUN_ID'","event":"deploy-authz","authz":"Bearer TOKEN"}}}'
```

## Replay Persisted UI Messages

```bash
curl -sS -X POST http://localhost:3000/api/trpc/workflow.replay \
  -H 'Content-Type: application/json' \
  --data-binary '{"0":{"json":{"runId":"'$RUN_ID'","eventType":"ui-message","order":"desc","page":0,"pageSize":100}}}'
```

The response includes `{ items, page, pageSize, hasMore }`. Each item contains `eventId` for dedupe and `eventData` holding UIMessage[] for rendering.

## UI Run Viewer

Open `/orchestrator/run` and start a run from the form, or pass a `runId` query param to hydrate persisted events before streaming. The UI implements:

- Dual-pane logs and UI messages
- Message dedupe by `eventId`
- Order toggle and “Load newer/older” controls
- “Jump to newest” action

## Deterministic Event Identity (Optional)

Enable deterministic `eventId` via `.env`:

```
DETERMINISTIC_EVENT_IDS=1
```

This uses a SHA‑256 hash of `(runId|type|data)` for event identity. Keep disabled by default to minimize overhead; turn on for debugging and test determinism.

