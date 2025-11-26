# Linear Integration Guide

**Owner:** Infrastructure  
**Last Updated:** 2025-11-26

## Purpose

This guide explains how to set up and use ALFRED's Linear integration. ALFRED functions as a first-class Linear agent, allowing users to assign issues to Alfred and see real-time progress updates.

## Overview

ALFRED integrates with Linear through:

1. **Agent Activities** - Real-time progress updates (thought, action, response, error)
2. **Webhooks** - Bidirectional sync (issue assignments trigger workflows, state changes cancel workflows)
3. **OAuth** - Authentication for Linear API access

## Setup

### 1. Linear OAuth Configuration

1. **Create Linear App:**
   - Go to Linear Settings → API → Applications
   - Create new application
   - Note: Client ID, Client Secret, Redirect URI

2. **Configure Environment Variables:**
   ```bash
   LINEAR_CLIENT_ID=your_client_id
   LINEAR_CLIENT_SECRET=your_client_secret
   LINEAR_REDIRECT_URI=https://your-domain.com/api/auth/callback/linear
   ```

3. **OAuth Flow:**
   - User visits `/api/auth/linear` to initiate OAuth
   - Linear redirects to callback with authorization code
   - ALFRED exchanges code for access token
   - Token stored in `linear_installations` table

### 2. Webhook Configuration

1. **Create Webhook in Linear:**
   - Go to Linear Settings → API → Webhooks
   - Create webhook pointing to: `https://your-domain.com/api/linear/webhook`
   - Select events: Issue assignment, state changes, comments
   - Copy webhook secret

2. **Configure Webhook Secret:**
   ```bash
   LINEAR_WEBHOOK_SECRET=your_webhook_secret
   ```

3. **Local Development:**
   - Use `ngrok` to expose local server:
     ```bash
     ngrok http 3000
     ```
   - Configure Linear webhook to point to ngrok URL

### 3. Assign Alfred to Linear Team

1. Install Alfred app in Linear workspace
2. Assign issues to Alfred's app user
3. Alfred will automatically start workflows and emit activities

## How It Works

### Agent Activities

When a workflow runs with Linear context, Alfred emits activities:

1. **Thought** (within 10 seconds) - "Starting workflow: [issue title]"
2. **Action** (during execution) - Tool executions (throttled to 1 per 30 seconds)
3. **Response** (on completion) - Final results summary
4. **Error** (on failure) - Error message with workflow link

**Key Files:**
- `packages/agent/src/orchestrator/linear.ts` - Helper functions
- `packages/api/src/routers/workflow.ts` - Integration into workflow runner

### 10-Second Acknowledgment

Linear requires the first activity within 10 seconds or marks the agent as unresponsive.

**Implementation:**
- Uses `Promise.race` with 9-second timeout
- Emits thought activity immediately on workflow start
- Non-blocking (fire-and-forget pattern)

### Session Initialization

On workflow start with Linear context:

1. **Set Delegate** - Assigns Alfred as issue owner
2. **Set Started** - Moves issue to "In Progress" state
3. **Set External URL** - Links to ALFRED workflow viewer

All operations are fire-and-forget (non-blocking).

### Webhook Handling

**Endpoint:** `POST /api/linear/webhook`

**Events Handled:**

1. **Issue Assignment** - Starts workflow automatically
2. **Issue State Change** - Cancels workflow if issue marked complete/cancelled
3. **Comment Creation** - Logs for future context addition

**Signature Verification:**
- Uses HMAC SHA256 signature in `linear-signature` header
- Prevents spoofed webhook events

**Key File:** `apps/web/src/routes/api/linear/webhook.ts`

## Testing

### Manual End-to-End Test

1. **Prerequisites:**
   - Linear workspace with Alfred installed
   - OAuth credentials configured
   - Webhook endpoint accessible (use ngrok for local)

2. **Test Workflow:**
   - Create Linear issue: "Test Alfred Integration"
   - Assign to Alfred's app user
   - Within 10 seconds: Check for "thought" activity
   - During execution: Check for "action" activities
   - On completion: Check for "response" activity
   - Verify issue moved to "Completed" state

3. **Test Cancellation:**
   - Start workflow via assignment
   - Manually mark issue as "Done" in Linear
   - Verify workflow cancelled in ALFRED logs
   - Check for cancellation comment

### Unit Tests

```bash
# Test Linear helper functions
bun run --filter @alfred/agent test linear

# Test webhook handler
bun run --filter @alfred/api test linear.webhook
```

## Metrics

Prometheus metrics exposed on `/api/metrics`:

- `linear_activity_emissions_total{type,status}` - Activity emission counts
- `linear_activity_duration_seconds{type}` - Activity emission duration
- `linear_session_operations_total{operation}` - Session operations (delegate, state, URL)
- `linear_webhook_events_total{event_type,action}` - Webhook events received
- `linear_webhook_workflow_starts_total` - Workflows started from webhooks
- `linear_webhook_workflow_cancels_total` - Workflows cancelled from webhooks

## Troubleshooting

### Activities Not Appearing

- Check `linear_activity_emissions_total{status="failure"}` metric
- Verify OAuth token is valid (check `linear_installations` table)
- Check logs for `linear_activity_failed` entries

### 10-Second Timeout

- Check `linear_activity_duration_seconds{type="thought"}` metric
- Verify Linear API is reachable (network issues)
- Check for rate limiting (429 errors)

### Webhook Not Working

- Verify `LINEAR_WEBHOOK_SECRET` matches Linear settings
- Check webhook signature verification logs
- Ensure webhook endpoint is accessible (use ngrok for local)

### Workflow Not Starting from Assignment

- Check `linear_webhook_events_total` metric
- Verify webhook handler is receiving events
- Check workflow runner logs for Linear context

## Related Documentation

- [ExecPlan: Linear Integration](../execplans/linear-integration.md) - Detailed implementation plan
- [Linear Integration Rules](../../.ruler/24-linear-integration.md) - Development rules
- [Linear API Reference](../reference/linear/graphql/) - Linear GraphQL API docs

