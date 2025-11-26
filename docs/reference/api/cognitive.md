# Cognitive API Reference

**Owner:** API  
**Last Updated:** 2025-11-26

## Purpose

This document provides a complete reference for ALFRED's cognitive API, including feedback submission, state query endpoints, and event replay capabilities.

## Base Path

All cognitive endpoints are under the `cognitive` tRPC router:

```typescript
trpc.cognitive.feedback()
```

## Endpoints

### `cognitive.feedback`

Submits user feedback to the cognitive loop for learning and autonomy adjustment.

**Type:** `mutation`

**Input Schema:**
```typescript
{
  streamId: string;          // Cognitive stream identifier (e.g., threadId)
  expected: string;          // What user expected
  actual?: string;           // What actually happened (default: "")
  ts?: number;               // Timestamp (default: Date.now())
  surface?: "chat" | "mindscape" | "voice";  // UI surface (default: "chat")
}
```

**Response:**
```typescript
{
  state: CognitiveState;     // Updated cognitive state
  obligations: Obligation[]; // Policy obligations (if any)
}
```

**Authentication:** Required (authed procedure)

**Policy:** Requires `cognitive.feedback` permission

**Behavior:**
1. Creates `feedback` event
2. Feeds event into `runCognitiveLoop`
3. Updates autonomy gradient based on feedback
4. Handles cognitive effects (e.g., `generate_response`)
5. Returns updated state

**Example:**
```typescript
const result = await trpc.cognitive.feedback.mutate({
  streamId: "thread-123",
  expected: "Deploy to staging",
  actual: "Deployed to production",
  surface: "chat",
});

console.log("Updated state:", result.state);
console.log("Autonomy level:", result.state.autonomy?.level);
```

## Event Replay

### Repository Functions

Event replay is handled via the cognitive repository (`packages/db/src/repo/cognitive.ts`):

**`getAllEvents(streamId)`**
- Retrieves all events for a stream
- Used for state hydration
- Returns events in chronological order

**`getLatestSnapshot(streamId)`**
- Retrieves latest state snapshot
- Used for fast state hydration
- Returns snapshot with `lastEventId`

**`getEventsSince(streamId, since)`**
- Retrieves events since timestamp
- Used with snapshots for optimized hydration
- Returns events in chronological order

**Example:**
```typescript
import { cognitiveRepo } from "@alfred/db";

// Get all events for replay
const events = await cognitiveRepo.getAllEvents("thread-123");

// Replay events to rebuild state
let state = idle(Date.now());
for (const record of events) {
  const event = record.payload as Event;
  const result = applyTransition(state, autonomy, event);
  state = result.state;
}
```

## State Query

### Direct State Access

State can be queried by replaying events:

```typescript
import { runCognitiveLoop } from "@alfred/runtime";
import { cognitiveRepo } from "@alfred/db";

// Get current state by replaying events
const events = await cognitiveRepo.getAllEvents(streamId);
let state = idle(Date.now());
let autonomy = initialAutonomy(Date.now());

for (const record of events) {
  const result = applyTransition(state, autonomy, record.payload);
  state = result.state;
  autonomy = result.autonomy;
}

// State now reflects current cognitive state
console.log("Current state:", state._);
console.log("Physiology:", state.physiology);
console.log("Autonomy:", autonomy.level);
```

### State Types

**Cognitive States:**
- `idle` - Waiting for input
- `capturing` - Processing user input
- `thinking` - Analyzing and reasoning
- `deciding` - Choosing between options
- `executing` - Running a plan
- `reflecting` - Learning from outcomes

**State Properties:**
- `physiology` - Energy, boredom, frustration (0..1)
- `autonomy` - Autonomy gradient (level, confidence, Beta prior)
- State-specific fields (e.g., `thinking.about`, `executing.plan`)

## Feedback Types

### Positive Feedback

When `expected === actual`:
- Increases autonomy `alpha` (success evidence)
- Decreases frustration
- Increases energy

**Example:**
```typescript
await trpc.cognitive.feedback.mutate({
  streamId: "thread-123",
  expected: "Deploy to staging",
  actual: "Deployed to staging",  // Matches expected
});
```

### Negative Feedback

When `expected !== actual`:
- Increases autonomy `beta` (failure evidence)
- Increases frustration
- May trigger reflection state

**Example:**
```typescript
await trpc.cognitive.feedback.mutate({
  streamId: "thread-123",
  expected: "Deploy to staging",
  actual: "Deployed to production",  // Doesn't match
});
```

## Cognitive Effects

After processing feedback, the cognitive loop may emit effects:

### `generate_response`

Triggers AI response generation.

**Handled Automatically:** The feedback endpoint handles this effect internally.

### `execute_plan`

Triggers plan execution (not yet implemented).

### `log_reflection`

Records reflection outcome (not yet implemented).

## Error Handling

### Error Types

**tRPC Errors:**
- `UNAUTHORIZED` - Session required
- `FORBIDDEN` - Insufficient permissions
- `INTERNAL_SERVER_ERROR` - Unexpected error

### Error Handling Pattern

```typescript
try {
  const result = await trpc.cognitive.feedback.mutate(input);
} catch (error) {
  if (error.data?.code === "FORBIDDEN") {
    // Handle permission denied
  } else {
    // Handle other errors
  }
}
```

## Metrics

Prometheus metrics exposed:

- `cognitiveFeedbackSubmissionsTotal{surface}` - Feedback submission counts
- `cognitivePhysiologyGauge{metric}` - Physiology metrics (energy, boredom, frustration)
- `cognitiveAutonomyUpdateDuration` - Autonomy update duration
- `cognitiveTransitionDuration` - State transition duration

**Location:** `packages/api/src/metrics.ts`

## Integration with Voice/Chat

### Voice Integration

Voice assistant calls `runCognitiveLoop` directly:

```typescript
// In voice assistant
const result = await runCognitiveLoop(ctx, threadId, {
  _: "input",
  content: input.text,
  source: "user",
  ts: Date.now(),
});
```

### Chat Integration

Chat interface can submit feedback via `cognitive.feedback` endpoint:

```typescript
// In chat UI
const handleFeedback = async (expected: string, actual: string) => {
  await trpc.cognitive.feedback.mutate({
    streamId: threadId,
    expected,
    actual,
    surface: "chat",
  });
};
```

## Related Documentation

- [Cognitive Architecture Guide](../guides/cognitive-architecture.md) - High-level overview
- [Cognitive Runtime Architecture](../architecture/cognitive-runtime.md) - Detailed implementation
- [ExecPlan: Cognitive Runtime Loop](../execplans/cognitive-runtime-loop.md) - Implementation plan

