# ALFRED Reviews Architecture

Owner: learning

## Purpose

ALFRED Reviews is a mobile-first swipe interface for validating AI actions before they take effect. Users approve or reject pending actions (tool executions, memories, messages, workflows, code changes) to build trust progressively.

## Key Concepts

**Review Types:**

- `tool_execution` - Tool calls pending validation
- `memory` - Learned preferences/facts
- `message` - Response quality feedback
- `workflow` - Escalation/autonomy decisions
- `code` - PR reviews with bug detection

**Auto-Approve:** After 5 consecutive approvals of the same pattern, that pattern auto-approves without user intervention.

**Learning Integration:** Approvals/rejections feed into the graph database to improve future behavior.

## Package Structure

```
packages/db/src/
├── schema/review.ts        # Drizzle schema (3 tables)
├── repo/review.ts          # Repository functions
├── migrations/0090_review_queue.sql

packages/api/src/routers/
└── review.ts               # tRPC router with learning handlers

packages/code-analysis/     # Diff parsing and bug detection
├── src/
│   ├── types.ts           # TypeScript types
│   ├── diff.ts            # parse-diff wrapper
│   ├── detect.ts          # Pattern-based bug detection
│   └── index.ts           # Public API
└── test/

apps/native/
├── components/review/      # Mobile UI components
│   ├── ReviewCard.tsx     # Swipeable card
│   ├── ReviewCardStack.tsx # 3-card depth stack
│   ├── ReviewQueue.tsx    # List view with filters
│   └── ReviewDetailsModal.tsx
├── app/(drawer)/(tabs)/reviews.tsx
└── hooks/use-review-count.ts
```

## Database Schema

**review_queue** - Main table for pending reviews

- Priority sorting (critical > high > medium > low)
- Supports code review metadata (PR number, URL, bug count)
- Links to conversation/message/workflow context

**review_auto_approve_patterns** - Learning patterns

- Pattern key format: `{type}:{identifier}` (e.g., `tool:file_read`)
- Tracks approval/rejection counts
- Auto-enables after 5 consecutive approvals

**review_analytics** - Aggregated statistics per user per type

## API Endpoints

| Endpoint       | Method   | Description                      |
| -------------- | -------- | -------------------------------- |
| `queue`        | Query    | Get pending reviews with filters |
| `pendingCount` | Query    | Badge count for UI               |
| `details`      | Query    | Full review context              |
| `submit`       | Mutation | Approve/reject/skip              |
| `create`       | Mutation | Programmatic review creation     |
| `analytics`    | Query    | User statistics                  |
| `batchApprove` | Mutation | Approve multiple at once         |

## Learning Flow

1. User swipes right (approve) or left (reject)
2. `submitReview()` records verdict
3. `triggerLearningActions()` called based on review type
4. Graph node created for approved/rejected pattern
5. Auto-approve pattern updated (if applicable)
6. Future similar actions check `shouldAutoApprove()`

## Mobile UI Patterns

- **Gesture API v3** - Uses `Gesture.Pan()` not deprecated `useAnimatedGestureHandler`
- **Haptic feedback** - Triggers at 120pt swipe threshold
- **Reduced motion** - Respects `useReducedMotion()` for accessibility
- **Glow indicators** - Green (approve) / Red (reject) overlays

## Testing Strategy

- **Repository tests** - `packages/db/test/repo.review.test.ts` (requires `RUN_DB_TESTS=1`)
- **Router tests** - `packages/api/test/review.router.test.ts` (28 tests, mocked)
- **Code analysis tests** - `packages/code-analysis/test/` (15 tests)

## Future Work

- GitHub webhook integration for automatic PR review creation
- LLM-powered bug detection beyond pattern matching
- AST-based analysis for deeper code understanding
- Correction flows (edit/delete/replace modals)
