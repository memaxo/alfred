# Linear Agent Setup

Linear agent activities allow Alfred to acknowledge issues within 10 seconds, stream tool execution updates, and mark outcomes without leaving Linear. This guide captures the configuration required for the new workflow runner and webhook integration.

## Prerequisites

- Alfred web app deployed with a publicly reachable base URL (`PUBLIC_URL`).
- A Linear OAuth installation for your workspace with `linear.write` scopes.
- Webhook secret from Linear settings (`Settings → API → Webhooks`).
- Alfred environment configured with:
  - `PUBLIC_URL=https://your-alfred-domain`
  - `LINEAR_WEBHOOK_SECRET=<copied from Linear>`
  - Existing Linear OAuth credentials (`LINEAR_CLIENT_ID`, `LINEAR_CLIENT_SECRET`).

> Tip: In development you can expose `localhost` via `ngrok` and point the webhook URL at `https://<ngrok-id>.ngrok.io/api/linear/webhook`.

## Configure the Webhook

1. In Linear settings create or edit the Alfred webhook.
2. Set the destination URL to `https://<PUBLIC_URL>/api/linear/webhook`.
3. Copy the generated webhook secret and update `LINEAR_WEBHOOK_SECRET`.
4. Restart the Alfred web process so the secret is loaded.

The webhook handler now verifies signatures using the Linear SDK, enforces a ±5 minute timestamp window, and immediately queues processing so Linear always receives a `202` response within the retry budget.

## Verifying the Workflow

1. Assign any issue to Alfred’s app user inside Linear.
2. Within 10 seconds a **thought** activity should appear (“Starting workflow: <issue title>”).
3. Tool execution emits **action** activities (throttled to 30s) and completion records a **response** activity. Errors map to **error** activities.
4. Moving the issue to “done” triggers a cancellation via `/api/linear/webhook`.

If activities do not appear, inspect:

- API logs for `linear_thought_activity_*` warnings.
- Workflow metrics (`linear_activity_emissions_total`, `linear_webhook_events_total`) via `GET /api/metrics`.
- The webhook delivery history inside Linear.

## Local Testing

```bash
# Fast type safety sweep
bun run typecheck

# Helper unit tests (mocked ticket tool)
(cd packages/agent && bun test test/linear.test.ts)

# Workflow runner integration tests (mocked Linear primitives)
(cd packages/api && bun test workflow.runner.linear.test.ts)
```

These tests replace `p-retry`, `toolTicket`, and webhook metrics with stubs so they run without the database or Linear API.

## Monitoring Checklist

| Metric | Purpose |
| --- | --- |
| `linear_activity_emissions_total{status="failure"}` | Detect retries or API outages |
| `linear_activity_duration_seconds` | Watch for slow acknowledges (budget 10s) |
| `linear_session_operations_total` | Delegate/state/external URL setup health |
| `linear_webhook_events_total` | Confirm events arriving from Linear |
| `linear_webhook_workflow_starts_total` | End-to-end workflow creations |
| `linear_webhook_workflow_cancels_total` | Issue-driven cancellations |

Configure alerts on failure rates >0 or acknowledgement duration >9 seconds to stay within Linear SLAs.
