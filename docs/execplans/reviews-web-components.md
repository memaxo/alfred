# ALFRED Reviews Web Dashboard — PM-Focused Components

This ExecPlan is a living document maintained per `.agent/PLANS.md`. All sections must be kept up to date so a newcomer can complete the effort without prior context.

---

## Purpose / Big Picture

**What this achieves**: Deliver a web-based Reviews dashboard that gives Project Managers real-time visibility into blocked work, risk assessment, learning progress, and agent activity. The dashboard answers the PM's core question: "What needs my attention, what's the risk, and how is ALFRED learning?"

**User-visible outcome**: After implementation, PMs can:

1. Open `/reviews` → see what work is blocked awaiting review
2. See risk assessment at a glance (high/medium/low)
3. Track ALFRED's learning progress toward auto-approve thresholds
4. View real-time agent activity feed
5. Understand review dependencies and downstream impact
6. Bulk-manage reviews via sortable/filterable table
7. Get full context via slide-out drawer without leaving the queue

**How to verify**:

```bash
# Start web app
cd apps/web
bun run dev

# Open dashboard
open http://localhost:3000/reviews

# Expected view:
# - BlockedWorkQueue showing pending reviews with time blocked
# - RiskAssessmentPanel with severity breakdown
# - TrustProgressBar showing auto-approve progress per type
# - ReviewCycleTimeChart showing average resolution times
# - AgentActivityFeed ticker at bottom

# Test interactions:
# 1. Click a blocked item → ReviewContextDrawer slides in
# 2. Click "Show impact" → ReviewDependencyGraph modal
# 3. Click "All Reviews" → ReviewTable with sorting/filtering
# 4. Approve a review → see queue update + activity feed entry
```

---

## Progress

### Phase 0: Planning & Setup

- [x] (2026-01-24 14:00Z) 0.1 Audit existing `review.ts` router to identify reusable endpoints
- [x] (2026-01-24 14:00Z) 0.2 Define TypeScript interfaces for all new API response shapes
- [x] (2026-01-24 14:05Z) 0.3 Create `apps/web/src/components/apps/reviews/` directory structure
- [x] (2026-01-24 14:05Z) 0.4 Install required dependencies (@tanstack/react-table - recharts already present)

### Phase 1: Backend API Extensions

- [x] (2026-01-24 14:15Z) 1.1 Add `getBlockedReviews()` repo function with time-blocked calculation
- [x] (2026-01-24 14:15Z) 1.2 Add `getRiskCounts()` repo function with severity aggregation
- [x] (2026-01-24 14:15Z) 1.3 Add `getCycleTimeStats()` repo function with trend data
- [ ] 1.4 Add `getDependencyGraph()` repo function for review relationships (deferred - requires graph schema)
- [x] (2026-01-24 14:15Z) 1.5 Add `getActivityFeed()` repo function for recent events
- [x] (2026-01-24 14:15Z) 1.6 Add `getAutoApproveProgress()` repo function for trust progress
- [x] (2026-01-24 14:20Z) 1.7 Create `review.blocked` tRPC endpoint
- [x] (2026-01-24 14:20Z) 1.8 Create `review.riskSummary` tRPC endpoint
- [x] (2026-01-24 14:20Z) 1.9 Create `review.cycleTime` tRPC endpoint
- [ ] 1.10 Create `review.dependencies` tRPC endpoint (deferred)
- [x] (2026-01-24 14:20Z) 1.11 Create `review.activityFeed` tRPC endpoint
- [x] (2026-01-24 14:20Z) 1.12 Create `review.trustProgress` tRPC endpoint
- [x] (2026-01-24 14:20Z) 1.13 Added `review.fullContext` endpoint for drawer context
- [ ] 1.14 Write tests for all new router endpoints (follow-up)

### Phase 2: Core Components (Milestone 1)

- [x] (2026-01-24 14:30Z) 2.1 Create `BlockedWorkQueue` component with item list
- [x] (2026-01-24 14:30Z) 2.2 Add quick-approve button for low-risk items in BlockedWorkQueue
- [x] (2026-01-24 14:30Z) 2.3 Add "Show Impact" button integration in BlockedWorkQueue
- [x] (2026-01-24 14:35Z) 2.4 Create `RiskAssessmentPanel` with stacked bar visualization
- [x] (2026-01-24 14:40Z) 2.5 Create `TrustProgressBar` with progress indicators per action type
- [x] (2026-01-24 14:45Z) 2.6 Create `ReviewContextDrawer` using Sheet/Drawer primitive
- [x] (2026-01-24 14:45Z) 2.7 Add trigger context section to ReviewContextDrawer
- [x] (2026-01-24 14:45Z) 2.8 Add agent reasoning section to ReviewContextDrawer
- [x] (2026-01-24 14:45Z) 2.9 Add similar past reviews section to ReviewContextDrawer
- [x] (2026-01-24 14:45Z) 2.10 Add risk factors section to ReviewContextDrawer

### Phase 3: Analytics & Visualization (Milestone 2)

- [x] (2026-01-24 14:50Z) 3.1 Create `ReviewCycleTimeChart` header with summary stats
- [x] (2026-01-24 14:50Z) 3.2 Add collapsible area chart to ReviewCycleTimeChart
- [x] (2026-01-24 14:50Z) 3.3 Add period selector (day/week/month) to ReviewCycleTimeChart
- [x] (2026-01-24 14:55Z) 3.4 Create `AgentActivityFeed` horizontal scrolling ticker
- [x] (2026-01-24 14:55Z) 3.5 Add animated entry/exit for new activity items
- [ ] 3.6 Create `ReviewDependencyGraph` modal with node layout (placeholder added)
- [ ] 3.7 Add critical path highlighting to ReviewDependencyGraph
- [ ] 3.8 Add "unblocks N tasks" badge to ReviewDependencyGraph

### Phase 4: Data Management (Milestone 3)

- [x] (2026-01-24 15:00Z) 4.1 Create `ReviewTable` with TanStack Table core setup
- [x] (2026-01-24 15:00Z) 4.2 Add sortable columns (type, risk, created, status)
- [x] (2026-01-24 15:00Z) 4.3 Add global search/filter input
- [x] (2026-01-24 15:00Z) 4.4 Add row selection with checkboxes
- [x] (2026-01-24 15:00Z) 4.5 Add batch approve action for selected rows
- [x] (2026-01-24 15:20Z) 4.6 Add batch reject action for selected rows
- [x] (2026-01-24 15:00Z) 4.7 Add pagination controls
- [x] (2026-01-24 15:25Z) 4.8 Add keyboard shortcuts (j/k navigate, a approve, r reject, space select, Enter open)

### Phase 5: Integration & Polish (Milestone 4)

- [x] (2026-01-24 15:05Z) 5.1 Create `/reviews` route file with TanStack Router
- [x] (2026-01-24 15:05Z) 5.2 Create `ReviewsDashboard` composition component
- [x] (2026-01-24 15:05Z) 5.3 Wire BlockedWorkQueue with 5s polling interval
- [x] (2026-01-24 15:05Z) 5.4 Wire ActivityFeed with 3s polling interval
- [x] (2026-01-24 15:05Z) 5.5 Wire CycleTimeChart with 60s polling interval
- [x] (2026-01-24 15:05Z) 5.6 Add loading skeletons for all components
- [x] (2026-01-24 15:35Z) 5.7 Add error boundaries and retry states
- [x] (2026-01-24 15:05Z) 5.8 Add empty states for each component
- [x] (2026-01-24 15:35Z) 5.9 Memoize expensive renders (chart data)
- [x] (2026-01-24 15:40Z) 5.10 Accessibility improvements (ARIA labels added)
- [x] (2026-01-24 15:40Z) 5.11 Add ARIA labels for interactive elements
- [x] (2026-01-24 15:25Z) 5.12 Keyboard navigation implemented (j/k/a/r/space/Enter)
- [x] (2026-01-24 15:45Z) 5.13 Write Playwright E2E test for full dashboard flow

### Deferred Items

- [ ] 1.4 `getDependencyGraph()` repo function - requires additional graph schema
- [ ] 3.7 Critical path highlighting in dependency graph - needs real dependency data
- [ ] 3.8 "Unblocks N tasks" badge - needs dependency tracking

### Validation

- [x] (2026-01-24 15:10Z) All typecheck passes (web, @alfred/db, @alfred/api)
- [x] (2026-01-24 15:10Z) All 28 existing review router tests pass
- [x] (2026-01-24 15:20Z) Added 20 new tests for PM endpoints + batchReject (48 total tests)

---

## Surprises & Discoveries

- **Date serialization**: Dates from Drizzle come as strings over tRPC, not Date objects. Fixed by accepting `string | Date` in component interfaces.
- **TanStack Table onClick**: TableHead doesn't support onClick directly - moved to inner div wrapper.
- **Sheet component**: Not present in UI library - created new `sheet.tsx` using Radix Dialog primitives.
- **Route generation**: TanStack Router routes are generated via Vite plugin at dev/build time, not manually. Added `@ts-expect-error` for initial route creation.
- **Dependency graph**: Real dependency tracking requires graph database schema changes. Implemented visualization with mock data based on review type.

---

## Decision Log

- Decision: Build 8 essential components instead of full 20-component list
  Rationale: Focus on highest PM utility while avoiding scope creep. Components selected maximize daily workflow value over retrospective/reporting features.
  Date/Author: 2026-01-24 / User + Agent

- Decision: Defer real dependency graph implementation
  Rationale: Requires graph schema changes to track review dependencies. Implemented placeholder with type-based mock data for now.
  Date/Author: 2026-01-24 / Agent

---

## Outcomes & Retrospective

**Completed**: 2026-01-24

**Deliverables**:

- 10 web components: BlockedWorkQueue, RiskAssessmentPanel, TrustProgressBar, ReviewContextDrawer, ReviewCycleTimeChart, AgentActivityFeed, ReviewTable, ReviewsDashboard, ReviewDependencyGraph, ReviewErrorBoundary
- 7 backend endpoints: blocked, riskSummary, cycleTime, activityFeed, trustProgress, fullContext, batchReject
- 48 router tests (20 new PM-focused tests)
- E2E test suite for dashboard flow
- Full keyboard navigation support
- ARIA accessibility labels

**Lines of Code**: ~2,500 lines of TypeScript across 15 files

**What Worked Well**:

- Error boundaries provide graceful degradation
- Keyboard shortcuts significantly improve power-user experience
- Real-time polling creates responsive dashboard feel

**What Could Be Improved**:

- Dependency graph needs real data tracking
- Could add more granular loading states
- Performance could be measured with real data volumes

---

## Context and Orientation

### Existing Infrastructure

The ALFRED Reviews system already has:

**Backend** (`packages/api/src/routers/review.ts`):

- `queue` - List pending reviews with filters
- `submit` - Approve/reject/skip a review
- `details` - Get full review context
- `create` - Create new review
- `analytics` - Basic analytics aggregation
- `batchApprove` - Approve multiple reviews

**Database** (`packages/db/src/schema/review.ts`):

- `review_queue` - Main reviews table
- `review_analytics` - Aggregated stats
- `review_auto_approve_patterns` - Learning patterns

**Mobile App** (`apps/native/components/review/`):

- `ReviewCard` - Swipeable card with gestures
- `ReviewCardStack` - 3-card stack
- `ReviewQueue` - List view with filters
- `ReviewDetailsModal` - Full context modal

**Code Analysis** (`packages/code-analysis/`):

- Diff parsing with `parse-diff`
- Pattern-based bug detection (20+ patterns)

### What's Missing for Web

The web dashboard needs:

1. **PM-specific views** - Blocked work, risk assessment, dependencies
2. **Analytics visualizations** - Cycle time charts, trust progress
3. **Bulk management** - Data table with sorting/filtering
4. **Real-time awareness** - Activity feed, live updates

### Technical Stack (Web)

- TanStack Start (React framework with SSR)
- TanStack Query (data fetching)
- TanStack Table (data tables)
- tRPC client (backend communication)
- Recharts or Nivo (charts)
- Framer Motion (animations)
- Tailwind CSS (styling)
- Radix UI primitives (accessible components)

### Design System Alignment

Follow existing web app patterns:

- Use `apps/web/src/components/apps/` structure for complex apps
- Use existing color tokens and typography
- Follow desktop window/panel patterns from existing apps
- Use HUD/glass-morphism aesthetic from design system

---

## Plan of Work

### Architecture

```
PM Opens /reviews
       ↓
Dashboard Layout renders with panels:
┌─────────────────────────────────────────────────┐
│ BlockedWorkQueue (60%) │ RiskAssessmentPanel    │
│                        │ TrustProgressBar       │
├────────────────────────┴────────────────────────┤
│ ReviewCycleTimeChart (collapsible)              │
├─────────────────────────────────────────────────┤
│ AgentActivityFeed (bottom ticker)               │
└─────────────────────────────────────────────────┘
       ↓
User clicks item
       ↓
ReviewContextDrawer slides in from right
       ↓
User clicks "Show impact"
       ↓
ReviewDependencyGraph modal opens
       ↓
User clicks "All Reviews"
       ↓
ReviewTable with full data management
```

### File Organization

**New Files** (Web App):

```
apps/web/src/routes/reviews/
  ├── index.tsx                      ← Main route
  ├── _layout.tsx                    ← Layout wrapper
  └── table.tsx                      ← Full table view route

apps/web/src/components/apps/reviews/
  ├── index.ts                       ← Barrel export
  ├── dashboard.tsx                  ← Main dashboard composition
  ├── blocked-queue.tsx              ← BlockedWorkQueue
  ├── risk-panel.tsx                 ← RiskAssessmentPanel
  ├── trust-progress.tsx             ← TrustProgressBar
  ├── context-drawer.tsx             ← ReviewContextDrawer
  ├── cycle-chart.tsx                ← ReviewCycleTimeChart
  ├── activity-feed.tsx              ← AgentActivityFeed
  ├── dependency-graph.tsx           ← ReviewDependencyGraph
  ├── review-table.tsx               ← ReviewTable
  └── hooks/
      ├── use-blocked-reviews.ts     ← Query hook
      ├── use-risk-summary.ts        ← Query hook
      ├── use-cycle-time.ts          ← Query hook
      └── use-activity-feed.ts       ← Query hook
```

**Modified Files** (Backend):

```
packages/api/src/routers/review.ts   ← Add new endpoints
packages/db/src/repo/review.ts       ← Add new queries
```

---

## Concrete Steps

### Step 1: Backend API Extensions

**Add to `packages/api/src/routers/review.ts`**:

```typescript
// 1. Blocked work queue - reviews blocking deployments or other work
blocked: authedProcedure
  .input(z.object({
    limit: z.number().int().min(1).max(50).default(20),
  }))
  .query(async ({ ctx, input }) => {
    const userId = ctx.session?.user?.id;
    if (!userId) throw new TRPCError({ code: 'UNAUTHORIZED' });

    const reviews = await reviewRepo.getBlockedReviews(userId, input.limit);

    // Calculate time blocked and estimated delay cost
    return reviews.map(review => ({
      ...review,
      timeBlockedMs: Date.now() - new Date(review.createdAt).getTime(),
      estimatedDelayCost: calculateDelayCost(review),
      blockingCount: review.dependentReviews?.length ?? 0,
    }));
  }),

// 2. Risk summary - aggregated risk counts by severity
riskSummary: authedProcedure
  .query(async ({ ctx }) => {
    const userId = ctx.session?.user?.id;
    if (!userId) throw new TRPCError({ code: 'UNAUTHORIZED' });

    const counts = await reviewRepo.getRiskCounts(userId);

    return {
      high: counts.high ?? 0,    // Production deploys, data mutations
      medium: counts.medium ?? 0, // External API changes
      low: counts.low ?? 0,      // Style, formatting
      total: counts.total ?? 0,
    };
  }),

// 3. Cycle time analytics
cycleTime: authedProcedure
  .input(z.object({
    period: z.enum(['day', 'week', 'month']).default('week'),
  }))
  .query(async ({ ctx, input }) => {
    const userId = ctx.session?.user?.id;
    if (!userId) throw new TRPCError({ code: 'UNAUTHORIZED' });

    const stats = await reviewRepo.getCycleTimeStats(userId, input.period);

    return {
      averageMs: stats.avgCycleTime,
      byType: {
        code: stats.codeAvg,
        tool: stats.toolAvg,
        memory: stats.memoryAvg,
        workflow: stats.workflowAvg,
      },
      trend: stats.trend, // Array of { date, avgMs }
      slaBreaches: stats.slaBreaches,
    };
  }),

// 4. Dependency graph data
dependencies: authedProcedure
  .input(z.object({
    reviewId: z.string().uuid(),
  }))
  .query(async ({ ctx, input }) => {
    const userId = ctx.session?.user?.id;
    if (!userId) throw new TRPCError({ code: 'UNAUTHORIZED' });

    const graph = await reviewRepo.getDependencyGraph(input.reviewId);

    return {
      nodes: graph.nodes.map(n => ({
        id: n.id,
        label: n.summary,
        type: n.reviewType,
        status: n.status,
      })),
      edges: graph.edges.map(e => ({
        source: e.from,
        target: e.to,
        type: e.dependencyType,
      })),
      criticalPath: graph.criticalPath,
      unblockCount: graph.unblockCount,
    };
  }),

// 5. Activity feed (recent events)
activityFeed: authedProcedure
  .input(z.object({
    limit: z.number().int().min(1).max(100).default(20),
    since: z.date().optional(),
  }))
  .query(async ({ ctx, input }) => {
    const userId = ctx.session?.user?.id;
    if (!userId) throw new TRPCError({ code: 'UNAUTHORIZED' });

    const events = await reviewRepo.getActivityFeed(userId, input);

    return events.map(e => ({
      id: e.id,
      type: e.eventType, // 'created' | 'approved' | 'rejected' | 'auto_approved'
      reviewId: e.reviewId,
      summary: e.summary,
      timestamp: e.createdAt,
      agent: e.agentName,
    }));
  }),

// 6. Trust progress (auto-approve threshold progress)
trustProgress: authedProcedure
  .query(async ({ ctx }) => {
    const userId = ctx.session?.user?.id;
    if (!userId) throw new TRPCError({ code: 'UNAUTHORIZED' });

    const patterns = await reviewRepo.getAutoApprovePatterns(userId);

    return patterns.map(p => ({
      actionType: p.actionType,
      approvalCount: p.approvalCount,
      threshold: 5, // 5 approvals to enable auto-approve
      enabled: p.enabled,
      lastApproved: p.lastApproved,
      confidenceTrend: p.confidenceTrend,
    }));
  }),
```

**Run to validate**:

```bash
cd packages/api
bun test src/routers/review.test.ts

# Expected: All new endpoints pass auth + return expected shapes
```

### Step 2: BlockedWorkQueue Component

**Create** `apps/web/src/components/apps/reviews/blocked-queue.tsx`:

```tsx
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

interface BlockedWorkQueueProps {
  onSelectReview: (reviewId: string) => void;
  onShowImpact: (reviewId: string) => void;
}

export function BlockedWorkQueue({
  onSelectReview,
  onShowImpact,
}: BlockedWorkQueueProps) {
  const { data, isLoading } = trpc.review.blocked.useQuery(
    { limit: 20 },
    {
      refetchInterval: 5000, // Poll every 5s
    }
  );

  const submitMutation = trpc.review.submit.useMutation({
    onSuccess: () => {
      // Invalidate queries
    },
  });

  if (isLoading) {
    return <BlockedQueueSkeleton />;
  }

  const reviews = data ?? [];

  return (
    <div className="flex flex-col gap-2 p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-foreground">Blocked Work</h2>
        <Badge variant="secondary">{reviews.length} pending</Badge>
      </div>

      {reviews.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-2">
          {reviews.map((review) => (
            <BlockedItem
              key={review.id}
              review={review}
              onSelect={() => onSelectReview(review.id)}
              onShowImpact={() => onShowImpact(review.id)}
              onQuickApprove={() => {
                submitMutation.mutate({
                  reviewId: review.id,
                  verdict: "approve",
                });
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface BlockedItemProps {
  review: BlockedReview;
  onSelect: () => void;
  onShowImpact: () => void;
  onQuickApprove: () => void;
}

function BlockedItem({
  review,
  onSelect,
  onShowImpact,
  onQuickApprove,
}: BlockedItemProps) {
  const riskColors = {
    high: "bg-red-500/20 text-red-400 border-red-500/40",
    medium: "bg-yellow-500/20 text-yellow-400 border-yellow-500/40",
    low: "bg-green-500/20 text-green-400 border-green-500/40",
  };

  const riskEmoji = {
    high: "🔴",
    medium: "🟡",
    low: "🟢",
  };

  return (
    <div
      className={cn(
        "group flex items-center gap-3 p-3 rounded-lg border cursor-pointer",
        "bg-card/50 hover:bg-card/80 transition-colors",
        "border-border/50 hover:border-border"
      )}
      onClick={onSelect}
    >
      {/* Risk indicator */}
      <span className="text-lg">{riskEmoji[review.risk ?? "low"]}</span>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-foreground truncate">
            {review.summary}
          </span>
          {review.blockingCount > 0 && (
            <Badge variant="outline" className="text-xs">
              Blocks {review.blockingCount}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>{review.reviewType}</span>
          <span>•</span>
          <span>{formatDistanceToNow(new Date(review.createdAt))} blocked</span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button
          size="sm"
          variant="ghost"
          onClick={(e) => {
            e.stopPropagation();
            onShowImpact();
          }}
        >
          Impact
        </Button>
        {review.risk === "low" && (
          <Button
            size="sm"
            variant="secondary"
            onClick={(e) => {
              e.stopPropagation();
              onQuickApprove();
            }}
          >
            Quick Approve
          </Button>
        )}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <span className="text-4xl mb-4">✅</span>
      <p className="text-lg font-medium text-foreground">All clear!</p>
      <p className="text-sm text-muted-foreground">
        No work is currently blocked
      </p>
    </div>
  );
}

function BlockedQueueSkeleton() {
  return (
    <div className="flex flex-col gap-2 p-4">
      <Skeleton className="h-6 w-32 mb-4" />
      {[1, 2, 3].map((i) => (
        <Skeleton key={i} className="h-20 w-full" />
      ))}
    </div>
  );
}
```

### Step 3: RiskAssessmentPanel Component

**Create** `apps/web/src/components/apps/reviews/risk-panel.tsx`:

```tsx
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

export function RiskAssessmentPanel() {
  const { data, isLoading } = trpc.review.riskSummary.useQuery(undefined, {
    refetchInterval: 10000,
  });

  if (isLoading || !data) {
    return <RiskPanelSkeleton />;
  }

  const total = data.high + data.medium + data.low;
  const highPct = total > 0 ? (data.high / total) * 100 : 0;
  const mediumPct = total > 0 ? (data.medium / total) * 100 : 0;
  const lowPct = total > 0 ? (data.low / total) * 100 : 0;

  return (
    <div className="p-4 space-y-4">
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
        Risk Summary
      </h3>

      {/* Stacked bar */}
      <div className="h-4 w-full rounded-full overflow-hidden bg-muted flex">
        {data.high > 0 && (
          <div
            className="bg-red-500 h-full transition-all"
            style={{ width: `${highPct}%` }}
          />
        )}
        {data.medium > 0 && (
          <div
            className="bg-yellow-500 h-full transition-all"
            style={{ width: `${mediumPct}%` }}
          />
        )}
        {data.low > 0 && (
          <div
            className="bg-green-500 h-full transition-all"
            style={{ width: `${lowPct}%` }}
          />
        )}
      </div>

      {/* Legend */}
      <div className="space-y-2">
        <RiskRow
          emoji="🔴"
          label="High"
          count={data.high}
          color="text-red-400"
        />
        <RiskRow
          emoji="🟡"
          label="Medium"
          count={data.medium}
          color="text-yellow-400"
        />
        <RiskRow
          emoji="🟢"
          label="Low"
          count={data.low}
          color="text-green-400"
        />
      </div>
    </div>
  );
}

function RiskRow({
  emoji,
  label,
  count,
  color,
}: {
  emoji: string;
  label: string;
  count: number;
  color: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <span>{emoji}</span>
        <span className="text-sm text-muted-foreground">{label}</span>
      </div>
      <span className={cn("font-mono text-sm", color)}>{count}</span>
    </div>
  );
}
```

### Step 4: TrustProgressBar Component

**Create** `apps/web/src/components/apps/reviews/trust-progress.tsx`:

```tsx
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { CheckCircle } from "lucide-react";

export function TrustProgressBar() {
  const { data, isLoading } = trpc.review.trustProgress.useQuery(undefined, {
    refetchInterval: 30000, // Less frequent - learning is slow
  });

  if (isLoading || !data) {
    return <TrustProgressSkeleton />;
  }

  return (
    <div className="p-4 space-y-4">
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
        Trust Progress
      </h3>

      <div className="space-y-3">
        {data.map((pattern) => (
          <TrustRow key={pattern.actionType} pattern={pattern} />
        ))}
      </div>

      <p className="text-xs text-muted-foreground">
        5 approvals = auto-approve enabled
      </p>
    </div>
  );
}

function TrustRow({ pattern }: { pattern: TrustPattern }) {
  const progress = (pattern.approvalCount / pattern.threshold) * 100;
  const remaining = pattern.threshold - pattern.approvalCount;

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="text-foreground capitalize">
          {pattern.actionType.replace("_", " ")}
        </span>
        {pattern.enabled ? (
          <Badge variant="secondary" className="gap-1">
            <CheckCircle className="w-3 h-3" />
            Auto
          </Badge>
        ) : (
          <span className="text-muted-foreground">{remaining} more</span>
        )}
      </div>
      <Progress
        value={progress}
        className={cn("h-2", pattern.enabled && "bg-green-500/20")}
      />
    </div>
  );
}
```

### Step 5: ReviewContextDrawer Component

**Create** `apps/web/src/components/apps/reviews/context-drawer.tsx`:

```tsx
import { trpc } from "@/lib/trpc";
import { formatDistanceToNow } from "date-fns";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ReviewContextDrawerProps {
  reviewId: string | null;
  onClose: () => void;
  onApprove: (reviewId: string) => void;
  onReject: (reviewId: string) => void;
}

export function ReviewContextDrawer({
  reviewId,
  onClose,
  onApprove,
  onReject,
}: ReviewContextDrawerProps) {
  const { data: review, isLoading } = trpc.review.details.useQuery(
    { reviewId: reviewId! },
    { enabled: !!reviewId }
  );

  return (
    <Sheet open={!!reviewId} onOpenChange={() => onClose()}>
      <SheetContent className="w-[500px] sm:max-w-[500px]">
        <SheetHeader>
          <SheetTitle>Review Details</SheetTitle>
        </SheetHeader>

        {isLoading ? (
          <DrawerSkeleton />
        ) : review ? (
          <ScrollArea className="h-[calc(100vh-8rem)] pr-4">
            <div className="space-y-6 py-4">
              {/* Header */}
              <div>
                <h3 className="text-lg font-semibold">{review.summary}</h3>
                <div className="flex items-center gap-2 mt-2">
                  <Badge variant="outline">{review.reviewType}</Badge>
                  <Badge
                    variant={
                      review.risk === "high" ? "destructive" : "secondary"
                    }
                  >
                    {review.risk} risk
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    {formatDistanceToNow(new Date(review.createdAt))} ago
                  </span>
                </div>
              </div>

              <Separator />

              {/* Trigger context */}
              <Section title="What triggered this">
                <p className="text-sm text-muted-foreground">
                  {review.triggerContext ?? "No trigger context available"}
                </p>
              </Section>

              {/* Agent reasoning */}
              {review.agentReasoning && (
                <Section title="Agent's reasoning">
                  <pre className="text-sm text-muted-foreground whitespace-pre-wrap font-mono bg-muted/50 p-3 rounded">
                    {review.agentReasoning}
                  </pre>
                </Section>
              )}

              {/* Related changes */}
              {review.relatedFiles && review.relatedFiles.length > 0 && (
                <Section title="Related files">
                  <ul className="space-y-1">
                    {review.relatedFiles.map((file, i) => (
                      <li
                        key={i}
                        className="text-sm font-mono text-muted-foreground"
                      >
                        {file}
                      </li>
                    ))}
                  </ul>
                </Section>
              )}

              {/* Previous similar reviews */}
              {review.similarReviews && review.similarReviews.length > 0 && (
                <Section title="Similar past reviews">
                  <div className="space-y-2">
                    {review.similarReviews.map((similar) => (
                      <div
                        key={similar.id}
                        className="flex items-center justify-between text-sm"
                      >
                        <span className="text-muted-foreground">
                          {similar.summary}
                        </span>
                        <Badge
                          variant={
                            similar.verdict === "approved"
                              ? "secondary"
                              : "destructive"
                          }
                        >
                          {similar.verdict}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </Section>
              )}

              {/* Risk factors */}
              {review.riskFactors && review.riskFactors.length > 0 && (
                <Section title="Risk factors">
                  <ul className="space-y-1">
                    {review.riskFactors.map((factor, i) => (
                      <li key={i} className="text-sm text-yellow-400">
                        ⚠️ {factor}
                      </li>
                    ))}
                  </ul>
                </Section>
              )}

              <Separator />

              {/* Actions */}
              <div className="flex gap-3">
                <Button
                  variant="destructive"
                  className="flex-1"
                  onClick={() => onReject(review.id)}
                >
                  Reject
                </Button>
                <Button
                  variant="default"
                  className="flex-1"
                  onClick={() => onApprove(review.id)}
                >
                  Approve
                </Button>
              </div>
            </div>
          </ScrollArea>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h4 className="text-sm font-semibold text-foreground mb-2">{title}</h4>
      {children}
    </div>
  );
}
```

### Step 6: ReviewCycleTimeChart Component

**Create** `apps/web/src/components/apps/reviews/cycle-chart.tsx`:

```tsx
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronUp } from "lucide-react";

export function ReviewCycleTimeChart() {
  const [expanded, setExpanded] = useState(false);
  const [period, setPeriod] = useState<"day" | "week" | "month">("week");

  const { data, isLoading } = trpc.review.cycleTime.useQuery(
    { period },
    {
      refetchInterval: 60000,
    }
  );

  if (isLoading || !data) {
    return <ChartSkeleton />;
  }

  const formatMs = (ms: number) => {
    if (ms < 60000) return `${Math.round(ms / 1000)}s`;
    if (ms < 3600000) return `${Math.round(ms / 60000)}m`;
    return `${Math.round(ms / 3600000)}h`;
  };

  return (
    <div className="border-t border-border">
      {/* Header - always visible */}
      <button
        className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-4">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Cycle Time
          </h3>
          <div className="flex items-center gap-4 text-sm">
            <span>
              Avg: <strong>{formatMs(data.averageMs)}</strong>
            </span>
            <span className="text-muted-foreground">|</span>
            <span>
              Code: <strong>{formatMs(data.byType.code)}</strong>
            </span>
            <span>
              Tools: <strong>{formatMs(data.byType.tool)}</strong>
            </span>
            {data.slaBreaches > 0 && (
              <Badge variant="destructive" className="text-xs">
                {data.slaBreaches} SLA breaches
              </Badge>
            )}
          </div>
        </div>
        {expanded ? (
          <ChevronUp className="w-4 h-4" />
        ) : (
          <ChevronDown className="w-4 h-4" />
        )}
      </button>

      {/* Expanded chart */}
      {expanded && (
        <div className="p-4 pt-0">
          <div className="flex justify-end mb-4">
            <Select
              value={period}
              onValueChange={(v) => setPeriod(v as typeof period)}
            >
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="day">Last 24h</SelectItem>
                <SelectItem value="week">Last 7 days</SelectItem>
                <SelectItem value="month">Last 30 days</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.trend}>
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v) =>
                    new Date(v).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })
                  }
                />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={formatMs} />
                <Tooltip
                  formatter={(value: number) => formatMs(value)}
                  labelFormatter={(label) =>
                    new Date(label).toLocaleDateString()
                  }
                />
                <Area
                  type="monotone"
                  dataKey="avgMs"
                  stroke="hsl(var(--primary))"
                  fill="hsl(var(--primary) / 0.2)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
```

### Step 7: AgentActivityFeed Component

**Create** `apps/web/src/components/apps/reviews/activity-feed.tsx`:

```tsx
import { useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

export function AgentActivityFeed() {
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data } = trpc.review.activityFeed.useQuery(
    { limit: 20 },
    { refetchInterval: 3000 }
  );

  const events = data ?? [];

  // Auto-scroll on new events
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollLeft = 0;
    }
  }, [events.length]);

  const eventIcons = {
    created: "📝",
    approved: "✅",
    rejected: "❌",
    auto_approved: "🤖",
  };

  return (
    <div className="border-t border-border bg-muted/30">
      <div
        ref={scrollRef}
        className="flex items-center gap-4 px-4 py-2 overflow-x-auto scrollbar-hide"
      >
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider shrink-0">
          Activity
        </span>

        <AnimatePresence mode="popLayout">
          {events.map((event) => (
            <motion.div
              key={event.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className={cn(
                "flex items-center gap-2 text-sm shrink-0",
                "px-3 py-1.5 rounded-full",
                "bg-background/50 border border-border/50"
              )}
            >
              <span>{eventIcons[event.type]}</span>
              <span className="text-foreground">{event.summary}</span>
              {event.agent && (
                <span className="text-muted-foreground">• {event.agent}</span>
              )}
              <span className="text-muted-foreground text-xs">
                {formatDistanceToNow(new Date(event.timestamp), {
                  addSuffix: true,
                })}
              </span>
            </motion.div>
          ))}
        </AnimatePresence>

        {events.length === 0 && (
          <span className="text-sm text-muted-foreground">
            No recent activity
          </span>
        )}
      </div>
    </div>
  );
}
```

### Step 8: ReviewDependencyGraph Component

**Create** `apps/web/src/components/apps/reviews/dependency-graph.tsx`:

```tsx
import { useMemo } from "react";
import { trpc } from "@/lib/trpc";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

interface ReviewDependencyGraphProps {
  reviewId: string | null;
  onClose: () => void;
}

export function ReviewDependencyGraph({
  reviewId,
  onClose,
}: ReviewDependencyGraphProps) {
  const { data, isLoading } = trpc.review.dependencies.useQuery(
    { reviewId: reviewId! },
    { enabled: !!reviewId }
  );

  // Simple tree layout (for MVP - could upgrade to D3/react-flow later)
  const layout = useMemo(() => {
    if (!data) return null;

    const root = data.nodes.find((n) => n.id === reviewId);
    const dependents = data.nodes.filter((n) => n.id !== reviewId);

    return { root, dependents, criticalPath: data.criticalPath };
  }, [data, reviewId]);

  return (
    <Dialog open={!!reviewId} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Impact Analysis</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <GraphSkeleton />
        ) : layout ? (
          <div className="space-y-6 py-4">
            {/* Summary */}
            <div className="flex items-center gap-4">
              <Badge variant="secondary" className="text-base px-4 py-2">
                Approving this unblocks {data?.unblockCount ?? 0} tasks
              </Badge>
              {layout.criticalPath && (
                <Badge variant="destructive">On critical path</Badge>
              )}
            </div>

            {/* Graph visualization */}
            <div className="relative p-8 bg-muted/50 rounded-lg min-h-[300px]">
              {/* Root node */}
              <div className="absolute top-8 left-1/2 -translate-x-1/2">
                <GraphNode node={layout.root!} isRoot />
              </div>

              {/* Dependent nodes */}
              <div className="flex justify-center gap-8 mt-32">
                {layout.dependents.map((node, i) => (
                  <div key={node.id} className="relative">
                    {/* Connection line */}
                    <svg
                      className="absolute -top-16 left-1/2 -translate-x-1/2 w-1 h-16"
                      viewBox="0 0 2 64"
                    >
                      <line
                        x1="1"
                        y1="0"
                        x2="1"
                        y2="64"
                        stroke="hsl(var(--border))"
                        strokeWidth="2"
                        strokeDasharray="4 4"
                      />
                    </svg>
                    <GraphNode node={node} />
                  </div>
                ))}
              </div>

              {layout.dependents.length === 0 && (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  No downstream dependencies
                </div>
              )}
            </div>

            {/* Legend */}
            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <span className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-yellow-500" />
                Pending
              </span>
              <span className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-green-500" />
                Approved
              </span>
              <span className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                Rejected
              </span>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function GraphNode({
  node,
  isRoot = false,
}: {
  node: GraphNode;
  isRoot?: boolean;
}) {
  const statusColors = {
    pending: "border-yellow-500 bg-yellow-500/20",
    approved: "border-green-500 bg-green-500/20",
    rejected: "border-red-500 bg-red-500/20",
  };

  return (
    <div
      className={cn(
        "px-4 py-3 rounded-lg border-2 text-center",
        "bg-background shadow-sm",
        statusColors[node.status],
        isRoot && "ring-2 ring-primary ring-offset-2"
      )}
    >
      <div className="text-sm font-medium text-foreground truncate max-w-[150px]">
        {node.label}
      </div>
      <div className="text-xs text-muted-foreground capitalize">
        {node.type}
      </div>
    </div>
  );
}
```

### Step 9: ReviewTable Component

**Create** `apps/web/src/components/apps/reviews/review-table.tsx`:

```tsx
import { useState, useMemo } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import { trpc } from "@/lib/trpc";
import { formatDistanceToNow } from "date-fns";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ChevronDown, ChevronUp, Check, X } from "lucide-react";

interface ReviewTableProps {
  onSelectReview: (reviewId: string) => void;
}

export function ReviewTable({ onSelectReview }: ReviewTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [rowSelection, setRowSelection] = useState({});

  const { data, isLoading } = trpc.review.queue.useQuery({
    filter: "all",
    limit: 100,
  });

  const batchApproveMutation = trpc.review.batchApprove.useMutation();

  const columns = useMemo<ColumnDef<Review>[]>(
    () => [
      {
        id: "select",
        header: ({ table }) => (
          <Checkbox
            checked={table.getIsAllPageRowsSelected()}
            onCheckedChange={(value) =>
              table.toggleAllPageRowsSelected(!!value)
            }
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(value) => row.toggleSelected(!!value)}
          />
        ),
        enableSorting: false,
      },
      {
        accessorKey: "reviewType",
        header: "Type",
        cell: ({ row }) => (
          <Badge variant="outline" className="capitalize">
            {row.getValue("reviewType")}
          </Badge>
        ),
      },
      {
        accessorKey: "summary",
        header: "Summary",
        cell: ({ row }) => (
          <button
            className="text-left hover:underline"
            onClick={() => onSelectReview(row.original.id)}
          >
            {row.getValue("summary")}
          </button>
        ),
      },
      {
        accessorKey: "risk",
        header: "Risk",
        cell: ({ row }) => {
          const risk = row.getValue("risk") as string;
          const colors = {
            high: "bg-red-500/20 text-red-400",
            medium: "bg-yellow-500/20 text-yellow-400",
            low: "bg-green-500/20 text-green-400",
          };
          return <Badge className={colors[risk] ?? colors.low}>{risk}</Badge>;
        },
      },
      {
        accessorKey: "createdAt",
        header: "Created",
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {formatDistanceToNow(new Date(row.getValue("createdAt")), {
              addSuffix: true,
            })}
          </span>
        ),
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => (
          <Badge
            variant={
              row.getValue("status") === "pending" ? "secondary" : "outline"
            }
          >
            {row.getValue("status")}
          </Badge>
        ),
      },
    ],
    [onSelectReview]
  );

  const table = useReactTable({
    data: data?.reviews ?? [],
    columns,
    state: { sorting, globalFilter, rowSelection },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    enableRowSelection: true,
  });

  const selectedCount = Object.keys(rowSelection).length;

  const handleBatchApprove = async () => {
    const selectedIds = table
      .getSelectedRowModel()
      .rows.map((row) => row.original.id);

    await batchApproveMutation.mutateAsync({ reviewIds: selectedIds });
    setRowSelection({});
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <Input
          placeholder="Search reviews..."
          value={globalFilter}
          onChange={(e) => setGlobalFilter(e.target.value)}
          className="max-w-sm"
        />

        {selectedCount > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {selectedCount} selected
            </span>
            <Button
              size="sm"
              variant="default"
              onClick={handleBatchApprove}
              disabled={batchApproveMutation.isPending}
            >
              <Check className="w-4 h-4 mr-1" />
              Approve All
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => {
                /* batch reject */
              }}
            >
              <X className="w-4 h-4 mr-1" />
              Reject All
            </Button>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    onClick={header.column.getToggleSortingHandler()}
                    className={
                      header.column.getCanSort()
                        ? "cursor-pointer select-none"
                        : ""
                    }
                  >
                    <div className="flex items-center gap-2">
                      {flexRender(
                        header.column.columnDef.header,
                        header.getContext()
                      )}
                      {header.column.getIsSorted() === "asc" && (
                        <ChevronUp className="w-4 h-4" />
                      )}
                      {header.column.getIsSorted() === "desc" && (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </div>
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="text-center py-8"
                >
                  No reviews found
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          Page {table.getState().pagination.pageIndex + 1} of{" "}
          {table.getPageCount()}
        </span>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
```

### Step 10: Dashboard Composition & Route

**Create** `apps/web/src/components/apps/reviews/dashboard.tsx`:

```tsx
import { useState } from "react";
import { BlockedWorkQueue } from "./blocked-queue";
import { RiskAssessmentPanel } from "./risk-panel";
import { TrustProgressBar } from "./trust-progress";
import { ReviewContextDrawer } from "./context-drawer";
import { ReviewCycleTimeChart } from "./cycle-chart";
import { AgentActivityFeed } from "./activity-feed";
import { ReviewDependencyGraph } from "./dependency-graph";
import { ReviewTable } from "./review-table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";

export function ReviewsDashboard() {
  const [selectedReviewId, setSelectedReviewId] = useState<string | null>(null);
  const [impactReviewId, setImpactReviewId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("dashboard");

  const submitMutation = trpc.review.submit.useMutation();

  const handleApprove = (reviewId: string) => {
    submitMutation.mutate({ reviewId, verdict: "approve" });
    setSelectedReviewId(null);
  };

  const handleReject = (reviewId: string) => {
    submitMutation.mutate({ reviewId, verdict: "reject" });
    setSelectedReviewId(null);
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b">
        <h1 className="text-2xl font-bold">ALFRED Reviews</h1>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="table">All Reviews</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === "dashboard" ? (
          <div className="h-full flex flex-col">
            {/* Main content area */}
            <div className="flex-1 flex overflow-hidden">
              {/* Left: Blocked Work Queue (60%) */}
              <div className="flex-[3] border-r overflow-auto">
                <BlockedWorkQueue
                  onSelectReview={setSelectedReviewId}
                  onShowImpact={setImpactReviewId}
                />
              </div>

              {/* Right: Risk + Trust (40%) */}
              <div className="flex-[2] overflow-auto">
                <RiskAssessmentPanel />
                <div className="border-t" />
                <TrustProgressBar />
              </div>
            </div>

            {/* Cycle time chart (collapsible) */}
            <ReviewCycleTimeChart />

            {/* Activity feed (bottom ticker) */}
            <AgentActivityFeed />
          </div>
        ) : (
          <div className="p-6 overflow-auto h-full">
            <ReviewTable onSelectReview={setSelectedReviewId} />
          </div>
        )}
      </div>

      {/* Drawers & Modals */}
      <ReviewContextDrawer
        reviewId={selectedReviewId}
        onClose={() => setSelectedReviewId(null)}
        onApprove={handleApprove}
        onReject={handleReject}
      />

      <ReviewDependencyGraph
        reviewId={impactReviewId}
        onClose={() => setImpactReviewId(null)}
      />
    </div>
  );
}
```

**Create route** `apps/web/src/routes/reviews/index.tsx`:

```tsx
import { createFileRoute } from "@tanstack/react-router";
import { ReviewsDashboard } from "@/components/apps/reviews/dashboard";

export const Route = createFileRoute("/reviews/")({
  component: ReviewsPage,
});

function ReviewsPage() {
  return (
    <div className="h-screen bg-background">
      <ReviewsDashboard />
    </div>
  );
}
```

---

## Validation and Acceptance

### Acceptance Criteria

**Backend API**:

- [ ] `review.blocked` returns reviews with time blocked and blocking count
- [ ] `review.riskSummary` returns high/medium/low counts
- [ ] `review.cycleTime` returns average times and trend data
- [ ] `review.dependencies` returns graph nodes and edges
- [ ] `review.activityFeed` returns recent events
- [ ] `review.trustProgress` returns auto-approve threshold progress

**Components**:

- [ ] BlockedWorkQueue shows pending reviews sorted by urgency
- [ ] BlockedWorkQueue supports quick-approve for low-risk items
- [ ] RiskAssessmentPanel shows stacked bar + counts
- [ ] TrustProgressBar shows progress toward auto-approve
- [ ] ReviewContextDrawer shows full review context
- [ ] ReviewCycleTimeChart shows trends (collapsible)
- [ ] AgentActivityFeed shows real-time events
- [ ] ReviewDependencyGraph shows impact visualization
- [ ] ReviewTable supports sorting, filtering, batch actions

**Integration**:

- [ ] Dashboard polls for updates every 5s (blocked queue)
- [ ] Activity feed updates every 3s
- [ ] Approve/reject updates all relevant panels
- [ ] Keyboard shortcuts work (j/k navigation, a/r approve/reject)

### Testing Commands

```bash
# Backend tests
cd packages/api
bun test src/routers/review.test.ts

# Component tests (if using Playwright)
cd apps/web
bun run test:e2e -- --grep "reviews"

# Type checking
bun run typecheck

# Start dev and verify
bun run dev
open http://localhost:3000/reviews
```

### Expected Visual

```
┌─────────────────────────────────────────────────────────────────────────┐
│  ALFRED Reviews                                [Dashboard] [All Reviews]│
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────────────────────────────┐  ┌───────────────────────────┐ │
│  │      Blocked Work                   │  │   Risk Summary            │ │
│  │      (3 pending)                    │  │                           │ │
│  │                                     │  │   ████████████░░░░        │ │
│  │  🔴 Deploy to prod blocked (2h)     │  │   🔴 2 High               │ │
│  │     Blocks 3 tasks     [Impact]     │  │   🟡 1 Medium             │ │
│  │                                     │  │   🟢 4 Low                │ │
│  │  🟡 PR #142 merge (45m)             │  ├───────────────────────────┤ │
│  │     Blocks 1 task      [Impact]     │  │   Trust Progress          │ │
│  │                                     │  │                           │ │
│  │  🟢 Style update (12m)              │  │   Code reviews: ████░ 4/5 │ │
│  │     No blockers [Quick Approve]     │  │   Deploys: ██░░░ 2/5      │ │
│  │                                     │  │   Style: ✓ Auto-approved  │ │
│  └─────────────────────────────────────┘  └───────────────────────────┘ │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │ ▼ Cycle Time: Avg 23min | Code 45min | Tools 12min | ⚠️ 2 breaches ││
│  └─────────────────────────────────────────────────────────────────────┘│
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │ Activity: ✅ Approved style fix • 🤖 Auto-approved CSS • 📝 New PR  ││
│  └─────────────────────────────────────────────────────────────────────┘│
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Idempotence and Recovery

**Safe Re-runs**:

- All components are stateless and re-render safely
- API endpoints are idempotent reads
- Submit mutations are idempotent (dedupe by review ID)

**Recovery Paths**:

**If API endpoints fail**:

```bash
# Check router is registered
grep -r "reviewRouter" packages/api/src/
# Verify DB connection
bun run db:status
```

**If components don't render**:

```bash
# Check route registration
cat apps/web/src/routeTree.gen.ts | grep reviews
# Restart dev server
bun run dev
```

**If real-time updates don't work**:

```bash
# Check polling interval in useQuery
# Verify network tab shows requests every 3-5s
# Check for React Query devtools
```

---

## Interfaces and Dependencies

### Required tRPC Endpoints

```typescript
// packages/api/src/routers/review.ts

interface BlockedReview {
  id: string;
  reviewType: string;
  summary: string;
  risk: "high" | "medium" | "low";
  createdAt: Date;
  timeBlockedMs: number;
  blockingCount: number;
  estimatedDelayCost?: number;
}

interface RiskSummary {
  high: number;
  medium: number;
  low: number;
  total: number;
}

interface CycleTimeStats {
  averageMs: number;
  byType: Record<string, number>;
  trend: Array<{ date: string; avgMs: number }>;
  slaBreaches: number;
}

interface DependencyGraph {
  nodes: Array<{ id: string; label: string; type: string; status: string }>;
  edges: Array<{ source: string; target: string; type: string }>;
  criticalPath: boolean;
  unblockCount: number;
}

interface ActivityEvent {
  id: string;
  type: "created" | "approved" | "rejected" | "auto_approved";
  reviewId: string;
  summary: string;
  timestamp: Date;
  agent?: string;
}

interface TrustPattern {
  actionType: string;
  approvalCount: number;
  threshold: number;
  enabled: boolean;
  lastApproved?: Date;
}
```

### External Dependencies

```json
{
  "dependencies": {
    "@tanstack/react-table": "^8.x",
    "recharts": "^2.x",
    "framer-motion": "^11.x"
  }
}
```

---

## Artifacts and Notes

### Component Hierarchy

```
ReviewsDashboard
├── BlockedWorkQueue
│   └── BlockedItem (per review)
├── RiskAssessmentPanel
│   └── RiskRow (per severity)
├── TrustProgressBar
│   └── TrustRow (per action type)
├── ReviewCycleTimeChart
│   └── AreaChart (recharts)
├── AgentActivityFeed
│   └── ActivityItem (per event)
├── ReviewContextDrawer (Sheet)
│   └── Section (trigger, reasoning, files, etc.)
├── ReviewDependencyGraph (Dialog)
│   └── GraphNode (per node)
└── ReviewTable
    └── TanStack Table
```

### Polling Intervals

| Component        | Interval | Rationale                          |
| ---------------- | -------- | ---------------------------------- |
| BlockedWorkQueue | 5s       | Critical - show new blocks quickly |
| RiskSummary      | 10s      | Aggregated - less volatile         |
| ActivityFeed     | 3s       | Real-time feel                     |
| CycleTime        | 60s      | Analytics - slow changing          |
| TrustProgress    | 30s      | Learning is slow                   |

---

_ExecPlan v1.0 — Reviews Web Dashboard (PM Focus)_
_Estimated: 2-3 weeks, 1 dev_
_Components: 8 essential + route + API extensions_
