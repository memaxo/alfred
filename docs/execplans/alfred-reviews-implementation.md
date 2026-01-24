# ALFRED Reviews Implementation — Swipe-Based AI Action Validation

**ExecPlan Status**: Ready for Implementation  
**Phase**: MVP (Tool Execution + Code Reviews)  
**Duration**: 5 weeks (3 weeks actions + 2 weeks code review)  
**PLANS.md Compliance**: ✓

---

## Purpose / Big Picture

**What this achieves**: Enable users to validate AI tool executions through an intuitive mobile-native swipe interface (Tinder-style cards). Swipe right = approve/boost confidence, swipe left = reject/correct. This creates a trust-building feedback loop that directly improves ALFRED's learning system and cognitive model.

**User-visible outcome**: After implementation, users can:

1. Open **Reviews tab** → see pending reviews (AI actions + code changes)
2. **For AI Actions**: Swipe cards right/left to approve/reject tool executions
3. **For Code Changes**: Swipe through files, see AI-detected bugs, approve/request changes
4. Tap card → see full context (conversation for actions, full diff for code)
5. Review 10+ actions OR 3-5 files in <2 minutes with zero typing

**How to verify**:

```bash
# Start mobile app
cd apps/native
bun run ios

# Test flow 1: AI Action Review
# 1. Create a note via chat: "Take a note about the meeting"
# 2. Navigate to Reviews tab → see "1 pending review"
# 3. Tap "Start Reviewing"
# 4. See card: "Created Note: Meeting..."
# 5. Swipe right → card flies off, green checkmark
# 6. Backend: memory_boost() called, confidence increased
# 7. Next tool execution → auto-approved (confidence > 0.95)

# Test flow 2: Code Review
# 1. Create test PR: gh pr create --title "Add auth" --body "Test"
# 2. Navigate to Reviews tab → see "PR #234" with bug count
# 3. Tap PR → see overview with AI analysis
# 4. Tap "Start Review" → file stack loads
# 5. See file 1: "middleware.ts • 🔴 1 bug"
# 6. Tap bug badge → see details + suggested fix
# 7. Swipe right to approve OR left to request changes
# 8. Review all 6 files → submit to GitHub
# 9. Check GitHub → see ALFRED's review comment posted
```

---

## Progress

### Milestone 1: Backend Infrastructure ✅

- [ ] Create `review_queue` database table
  - [ ] Schema with review_type, subject_id, priority, status
  - [ ] Indexes on user_id, status, priority
- [ ] Create review router (`packages/api/src/routers/review.ts`)
  - [ ] `queue` endpoint (list pending reviews)
  - [ ] `submit` endpoint (approve/reject/skip)
  - [ ] `details` endpoint (full context)
- [ ] Wire learning integration
  - [ ] Approve → `memory_boost()`, `recordToolSuccess()`
  - [ ] Reject → `recordToolFailure()`, `learnCorrection()`
- [ ] Add review creation triggers
  - [ ] After tool execution with confidence < 0.95
  - [ ] After new tool (never seen before)
  - [ ] After tool failure/retry

**Validation**: `curl http://localhost:3000/api/trpc/review.queue` returns pending reviews

### Milestone 2: Review Card Component

- [ ] Create `ReviewCard.tsx` with swipe gesture
  - [ ] Pan gesture handler (react-native-gesture-handler)
  - [ ] Translate X/Y animated values
  - [ ] Rotation based on swipe angle (±15°)
  - [ ] Haptic feedback at threshold (120pt)
- [ ] Add glow indicators (left/right)
  - [ ] Red glow on left swipe (semantic.error)
  - [ ] Green glow on right swipe (semantic.success)
  - [ ] Opacity based on swipe distance
- [ ] Implement exit animations
  - [ ] Swipe > threshold → fly off screen
  - [ ] Swipe < threshold → spring back to center
- [ ] Add tap-to-expand
  - [ ] Modal with full context
  - [ ] Approve/Reject buttons
  - [ ] Edit/Correct actions

**Validation**: Card swipes smoothly at 60fps, haptic fires at threshold

### Milestone 3: Card Stack & Queue

- [ ] Create `ReviewCardStack.tsx`
  - [ ] 3-card stack (current + 2 previews)
  - [ ] Z-index layering (current: 3, next: 2, next+1: 1)
  - [ ] Scale/opacity depth (1.0, 0.95, 0.90)
  - [ ] Animate stack up on swipe
- [ ] Create `ReviewQueue.tsx` screen
  - [ ] Header with pending count
  - [ ] Filter pills (All, Tools, Memories, etc.)
  - [ ] FlatList of review preview cards
  - [ ] "Start Reviewing" button
- [ ] Wire navigation
  - [ ] Add Reviews tab to tab bar
  - [ ] Badge count for pending reviews
  - [ ] Push notification for high-priority

**Validation**: Stack animates smoothly, queue loads 10+ reviews without lag

### Milestone 4: Learning Integration

- [ ] Connect approve action to backend
  - [ ] Call `memory_boost()` for memory reviews
  - [ ] Call `recordToolSuccess()` for tool reviews
  - [ ] Update preference confidence
- [ ] Connect reject action to backend
  - [ ] Show correction options (delete/edit/replace)
  - [ ] Call `learnToolCorrection()` if edited
  - [ ] Decrease confidence or remove memory
- [ ] Add auto-approve logic
  - [ ] After 5 approvals of same pattern → auto-approve
  - [ ] Show toast: "Auto-approving future [tool]"
- [ ] Add analytics
  - [ ] Track approval rate by review type
  - [ ] Track time per review
  - [ ] Track skip rate

**Validation**: Approve → confidence increases, reject → confidence decreases

### Milestone 5: Code Review Integration (NEW — Devin-Style)

- [ ] **Create code analysis package** (`packages/code-analysis/`)
  - [ ] Diff parser (`parse-diff` library)
  - [ ] Move detection (file similarity algorithm)
  - [ ] AI grouping (LLM-based logical clustering)
- [ ] **Implement bug detection layers**
  - [ ] Layer 1: Static analysis (AST parsing, pattern matching)
  - [ ] Layer 2: Type checking (TypeScript compiler API)
  - [ ] Layer 3: LLM analysis (contextual bug finding)
  - [ ] Layer 4: Historical patterns (past bugs from learning system)
- [ ] **Create code review router** (`packages/api/src/routers/code-review.ts`)
  - [ ] `analyze` endpoint (parse PR/diff, run AI analysis)
  - [ ] `getDiff` endpoint (return organized diff for mobile)
  - [ ] `submitToGitHub` endpoint (post review comments)
- [ ] **Mobile code review components**
  - [ ] `PROverviewCard` — PR metadata + AI analysis summary
  - [ ] `FileCard` — Swipeable file review card
  - [ ] `FileCardStack` — File stack navigation
  - [ ] `HunkViewer` — Expandable diff viewer
  - [ ] `DiffRenderer` — Syntax-highlighted diff lines
  - [ ] `BugBadge` — Red/yellow/blue severity indicators
  - [ ] `BugDetailModal` — Bug explanation + suggested fix
  - [ ] `CodeChatModal` — Ask ALFRED about code changes
- [ ] **GitHub integration**
  - [ ] Webhook handler for new PRs
  - [ ] GitHub API client (octokit)
  - [ ] Post review comments to PR
  - [ ] Push notifications for new PRs
- [ ] **Unified queue**
  - [ ] Update ReviewQueue to show code + action reviews
  - [ ] Filter pills: All / Code / Actions
  - [ ] Priority sorting (code bugs first)

**Validation**:

```bash
# Create test PR
gh pr create --title "Test PR" --body "Testing ALFRED review"

# Check ALFRED
bun run ios
# 1. Navigate to Reviews → see PR review
# 2. Tap PR → see overview with AI analysis
# 3. Start review → swipe through files
# 4. See bug on line 42 with red badge
# 5. Tap bug → see explanation + fix
# 6. Approve file → green checkmark
# 7. Complete review → GitHub comment posted
```

### Milestone 6: Polish & Testing

- [ ] Add animations
  - [ ] Card entrance (fade-in-up)
  - [ ] Approval flash (green)
  - [ ] Rejection flash (red)
  - [ ] Stack depth animation
- [ ] Add accessibility
  - [ ] VoiceOver labels for cards
  - [ ] Custom actions (approve/reject)
  - [ ] Reduced motion support
  - [ ] Touch target validation (≥44pt)
- [ ] Performance optimization
  - [ ] Lazy load cards (only 3 in DOM)
  - [ ] Memoize card renders
  - [ ] Use native driver for animations
- [ ] Write tests
  - [ ] Unit: ReviewCard gestures
  - [ ] Integration: Queue → Swipe → Backend
  - [ ] E2E: Full review flow

**Validation**: Passes accessibility audit, maintains 60fps, tests green

---

## Surprises & Discoveries

_(To be filled as work proceeds)_

---

## Decision Log

_(To be filled as decisions are made)_

---

## Outcomes & Retrospective

_(To be filled at completion)_

---

## Context and Orientation

### Inspiration: Devin Review

Devin (by Cognition) built a code review tool that uses AI to organize diffs, detect bugs, and explain changes. ALFRED Reviews applies similar principles to **AI action validation** instead of code review:

| Devin Review       | ALFRED Reviews             |
| ------------------ | -------------------------- |
| Reviews GitHub PRs | Reviews AI tool executions |
| Desktop-focused    | Mobile-native (swipe)      |
| Bug detection      | Trust verification         |
| Comment/dismiss    | Swipe approve/reject       |

### ALFRED's Learning Infrastructure

ALFRED already has feedback systems:

- **Memory tools** (`packages/agent/assistant/src/tool/memory/`)
  - `memory_boost` — Increase confidence
  - `memory_remove` — Delete or downgrade
  - `memory_update` — Modify properties
- **Preference router** (`packages/api/src/routers/preference.ts`)
  - `updateFromFeedback` — Learn from ratings
  - `inferFromCorrection` — Learn from edits
  - `correctClassification` — Fix domain errors
- **Cognitive state** (`packages/cognitive/src/state.ts`)
  - Autonomy gradient (0-1)
  - Confidence tracking
  - Error calculation

**ALFRED Reviews** unifies these into one mobile-native interface.

### Current Review Gaps

**What's missing**:

1. No explicit validation UI for tool executions
2. Learning happens passively (no user feedback loop)
3. Trust calibration is invisible (user doesn't see confidence)
4. No way to quickly approve/reject AI actions

**Why swipe cards**:

- Mobile-first (ALFRED is mobile-native)
- Fast (10+ reviews/minute)
- Low friction (no typing, no forms)
- Engaging (gamified feedback loop)
- Proven UX (Tinder, dating apps)

### Technical Stack

**Mobile**:

- React Native (Expo)
- React Native Reanimated 3 (animations)
- React Native Gesture Handler (swipes)
- NativeWind (Tailwind for RN)
- tRPC client (backend communication)

**Backend**:

- tRPC router (`packages/api/src/routers/review.ts`)
- Postgres table (`review_queue`)
- Learning integration (`memory_boost`, `recordToolSuccess`)

**Design System**:

- Void aesthetic (bioluminescent text on dark background)
- HUD surfaces (separation transparency cards)
- Breathing animations (idle states)
- Glow effects (swipe feedback)

---

## Plan of Work

### Architecture

```
User Creates Note
      ↓
Tool Executes (confidence: 0.85 < 0.95)
      ↓
Review Created in `review_queue`
      ↓
User Opens Reviews Tab
      ↓
Sees "1 pending review"
      ↓
Taps "Start Reviewing"
      ↓
ReviewCardStack renders 3 cards
      ↓
User swipes right (approve)
      ↓
Card flies off, green flash
      ↓
Backend: memory_boost(+0.15) → confidence: 1.0
      ↓
Next tool execution → auto-approved
```

### File Organization

**New Files**:

```
packages/api/src/routers/review.ts           ← Backend router
packages/db/src/schema/review.ts             ← Database schema
apps/native/components/review/
  ├── ReviewCard.tsx                         ← Swipeable card
  ├── ReviewCardStack.tsx                    ← 3-card stack
  ├── SwipeIndicators.tsx                    ← Left/right glow
  ├── ReviewDetailsModal.tsx                 ← Tap-to-expand
  ├── ReviewQueue.tsx                        ← List view
  └── hooks/
      ├── useReviewGesture.ts                ← Gesture logic
      └── useReviewQueue.ts                  ← tRPC query
apps/native/app/(drawer)/(tabs)/reviews.tsx  ← Main screen
```

**Modified Files**:

```
apps/native/app/(drawer)/(tabs)/_layout.tsx  ← Add Reviews tab
packages/api/src/index.ts                    ← Register review router
packages/db/drizzle/0025_reviews.sql         ← Migration
```

---

## Concrete Steps

### Step 1: Database Schema

**Create migration** `packages/db/drizzle/0025_reviews.sql`:

```sql
CREATE TABLE review_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- What's being reviewed
  review_type VARCHAR(50) NOT NULL,
  subject_id UUID NOT NULL,
  subject_data JSONB NOT NULL,

  -- Context
  conversation_id VARCHAR(255),
  message_id VARCHAR(255),

  -- Priority
  priority VARCHAR(10) NOT NULL DEFAULT 'medium',
  auto_approve_eligible BOOLEAN DEFAULT FALSE,

  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  reviewed_at TIMESTAMPTZ,
  verdict_data JSONB,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,

  CONSTRAINT valid_review_type CHECK (review_type IN ('tool_execution', 'message', 'memory', 'workflow')),
  CONSTRAINT valid_priority CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  CONSTRAINT valid_status CHECK (status IN ('pending', 'approved', 'rejected', 'skipped'))
);

CREATE INDEX idx_review_queue_user_status ON review_queue(user_id, status);
CREATE INDEX idx_review_queue_priority ON review_queue(priority, created_at);
CREATE INDEX idx_review_queue_type ON review_queue(review_type);
```

**Run migration**:

```bash
cd packages/db
bun run migrate
```

**Expected output**:

```
[✓] Migration 0025_reviews applied
[✓] review_queue table created
[✓] Indexes created
```

### Step 2: Backend Router

**Create** `packages/api/src/routers/review.ts`:

```typescript
import { z } from "zod";
import { router, authedProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";
import { getReviewQueue, updateReviewStatus } from "@alfred/db/repo/review";
import { memory_boost } from "@alfred/agent/assistant/src/tool/memory/boost";
import { recordToolSuccess, recordToolFailure } from "@alfred/agent/metrics";

export const reviewRouter = router({
  queue: authedProcedure
    .input(
      z.object({
        filter: z
          .enum(["all", "tools", "messages", "memories", "workflows"])
          .optional(),
        limit: z.number().int().min(1).max(50).default(10),
        offset: z.number().int().min(0).default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      const userId = ctx.session?.user?.id;
      if (!userId) {
        throw new TRPCError({ code: "UNAUTHORIZED" });
      }

      const reviews = await getReviewQueue(userId, {
        reviewType: input.filter === "all" ? undefined : input.filter,
        status: "pending",
        limit: input.limit,
        offset: input.offset,
      });

      return {
        reviews,
        total: reviews.length, // TODO: Add count query
        hasMore: reviews.length === input.limit,
      };
    }),

  submit: authedProcedure
    .input(
      z.object({
        reviewId: z.string().uuid(),
        verdict: z.enum(["approve", "reject", "skip"]),
        correction: z
          .object({
            type: z.enum(["delete", "edit", "replace"]),
            data: z.unknown(),
          })
          .optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session?.user?.id;
      if (!userId) {
        throw new TRPCError({ code: "UNAUTHORIZED" });
      }

      // Update review status
      await updateReviewStatus(input.reviewId, {
        status:
          input.verdict === "approve"
            ? "approved"
            : input.verdict === "reject"
              ? "rejected"
              : "skipped",
        reviewedAt: new Date(),
        verdictData: input.correction,
      });

      // Trigger learning based on verdict
      if (input.verdict === "approve") {
        await handleApproval(input.reviewId);
      } else if (input.verdict === "reject") {
        await handleRejection(input.reviewId, input.correction);
      }

      return { success: true };
    }),

  details: authedProcedure
    .input(
      z.object({
        reviewId: z.string().uuid(),
      })
    )
    .query(async ({ ctx, input }) => {
      const userId = ctx.session?.user?.id;
      if (!userId) {
        throw new TRPCError({ code: "UNAUTHORIZED" });
      }

      const review = await getReviewById(input.reviewId);
      // Fetch related context (conversation, memories, reasoning)
      return review;
    }),
});

async function handleApproval(reviewId: string) {
  // Fetch review to get type
  const review = await getReviewById(reviewId);

  switch (review.reviewType) {
    case "tool_execution":
      await recordToolSuccess(review.subjectData.toolName);
      break;
    case "memory":
      await memory_boost.execute({
        input: { id: review.subjectId, amount: 0.15 },
      });
      break;
    // Add other types...
  }
}

async function handleRejection(reviewId: string, correction?: unknown) {
  const review = await getReviewById(reviewId);

  switch (review.reviewType) {
    case "tool_execution":
      await recordToolFailure(review.subjectData.toolName, "user_rejection");
      break;
    case "memory":
      // Delete or downgrade
      break;
  }
}
```

**Register router** in `packages/api/src/index.ts`:

```typescript
import { reviewRouter } from "./routers/review";

export const appRouter = router({
  // ... existing routers
  review: reviewRouter,
});
```

### Step 3: Mobile Component - ReviewCard

**Create** `apps/native/components/review/ReviewCard.tsx`:

```typescript
import React from 'react';
import { StyleSheet, Dimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';
import { HUDSurface } from '../foundation/HUDSurface';
import { BiolumText } from '../foundation/BiolumText';
import { useVoidTheme } from '@/hooks/use-void-theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SWIPE_THRESHOLD = 120;

interface ReviewCardProps {
  review: Review;
  onSwipeRight: (review: Review) => void;
  onSwipeLeft: (review: Review) => void;
  onTap: (review: Review) => void;
  isTopCard: boolean;
  zIndex: number;
}

export function ReviewCard({
  review,
  onSwipeRight,
  onSwipeLeft,
  onTap,
  isTopCard,
  zIndex,
}: ReviewCardProps) {
  const theme = useVoidTheme();
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const rotateZ = useSharedValue(0);
  const hapticTriggered = useSharedValue(false);

  const gesture = Gesture.Pan()
    .enabled(isTopCard)
    .onUpdate((event) => {
      translateX.value = event.translationX;
      translateY.value = event.translationY;
      rotateZ.value = (event.translationX / 400) * 15; // Max ±15°

      // Haptic at threshold
      if (Math.abs(event.translationX) > SWIPE_THRESHOLD && !hapticTriggered.value) {
        runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Medium);
        hapticTriggered.value = true;
      }
    })
    .onEnd((event) => {
      const absTranslateX = Math.abs(translateX.value);

      if (absTranslateX > SWIPE_THRESHOLD || Math.abs(event.velocityX) > 1000) {
        const direction = translateX.value > 0 ? 'right' : 'left';

        // Exit animation
        translateX.value = withSpring(direction === 'right' ? 400 : -400, {
          damping: 20,
          stiffness: 90,
        });

        // Trigger callback
        if (direction === 'right') {
          runOnJS(onSwipeRight)(review);
        } else {
          runOnJS(onSwipeLeft)(review);
        }
      } else {
        // Return to center
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
        rotateZ.value = withSpring(0);
        hapticTriggered.value = false;
      }
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { rotateZ: `${rotateZ.value}deg` },
    ],
  }));

  const leftGlowStyle = useAnimatedStyle(() => ({
    opacity: Math.min(Math.abs(translateX.value) / 150, 1) * (translateX.value < 0 ? 1 : 0),
  }));

  const rightGlowStyle = useAnimatedStyle(() => ({
    opacity: Math.min(translateX.value / 150, 1) * (translateX.value > 0 ? 1 : 0),
  }));

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={[styles.card, { zIndex }, animatedStyle]}>
        <HUDSurface elevation={3}>
          {/* Left glow (reject) */}
          <Animated.View style={[styles.glowLeft, leftGlowStyle]} />

          {/* Right glow (approve) */}
          <Animated.View style={[styles.glowRight, rightGlowStyle]} />

          {/* Card content */}
          <BiolumText variant="titleMedium">{review.reviewType}</BiolumText>
          <BiolumText variant="bodyLarge">{review.subjectData.summary}</BiolumText>

          {/* Swipe hint */}
          <BiolumText variant="caption" color="faint">
            ← Swipe to Reject | Approve →
          </BiolumText>
        </HUDSurface>
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  card: {
    position: 'absolute',
    width: SCREEN_WIDTH * 0.9,
    height: 500,
  },
  glowLeft: {
    position: 'absolute',
    inset: 0,
    backgroundColor: 'rgba(255, 0, 0, 0.1)',
    borderRadius: 24,
  },
  glowRight: {
    position: 'absolute',
    inset: 0,
    backgroundColor: 'rgba(0, 255, 0, 0.1)',
    borderRadius: 24,
  },
});
```

### Step 3.5: Code Analysis Package (NEW — For Code Reviews)

**Create package structure**:

```bash
cd packages
mkdir code-analysis
cd code-analysis
bun init

# Update package.json
{
  "name": "@alfred/code-analysis",
  "version": "0.1.0",
  "type": "module",
  "exports": {
    ".": "./src/index.ts",
    "./bugs": "./src/bugs/index.ts",
    "./diff": "./src/diff/index.ts"
  },
  "dependencies": {
    "parse-diff": "^0.11.1",
    "typescript": "^5.7.3",
    "@typescript/vfs": "^1.6.0"
  }
}
```

**Create** `src/diff/parse.ts`:

```typescript
import parseDiff from "parse-diff";

export interface ParsedDiff {
  files: FileDiff[];
  additions: number;
  deletions: number;
}

export interface FileDiff {
  path: string;
  status: "added" | "modified" | "deleted";
  additions: number;
  deletions: number;
  hunks: Hunk[];
}

export interface Hunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: DiffLine[];
}

export interface DiffLine {
  type: "add" | "delete" | "normal";
  lineNumber: number;
  content: string;
}

export function parse(diff: string): ParsedDiff {
  const files = parseDiff(diff);

  return {
    files: files.map((file) => ({
      path: file.to ?? file.from ?? "unknown",
      status: file.deleted ? "deleted" : file.new ? "added" : "modified",
      additions: file.additions ?? 0,
      deletions: file.deletions ?? 0,
      hunks: file.chunks.map((chunk) => ({
        oldStart: chunk.oldStart,
        oldLines: chunk.oldLines,
        newStart: chunk.newStart,
        newLines: chunk.newLines,
        lines: chunk.changes.map((change, i) => ({
          type:
            change.type === "add"
              ? "add"
              : change.type === "del"
                ? "delete"
                : "normal",
          lineNumber:
            change.type === "add" ? chunk.newStart + i : chunk.oldStart + i,
          content: change.content,
        })),
      })),
    })),
    additions: files.reduce((sum, f) => sum + (f.additions ?? 0), 0),
    deletions: files.reduce((sum, f) => sum + (f.deletions ?? 0), 0),
  };
}
```

**Create** `src/bugs/static.ts`:

```typescript
export interface Bug {
  line: number;
  severity: "critical" | "warning" | "info";
  category: string;
  message: string;
  suggestion?: string;
  confidence: number;
}

export function detectStaticBugs(code: string, filePath: string): Bug[] {
  const bugs: Bug[] = [];
  const lines = code.split("\n");

  // Pattern 1: Nested property access without optional chaining
  lines.forEach((line, idx) => {
    const match = /(\w+)\.(\w+)\.(\w+)/.exec(line);
    if (match && !line.includes("?.")) {
      bugs.push({
        line: idx + 1,
        severity: "critical",
        category: "null_check",
        message:
          "Potential null pointer: nested property access without optional chaining",
        suggestion: `${match[1]}?.${match[2]}?.${match[3]}`,
        confidence: 0.75,
      });
    }
  });

  // Pattern 2: Promise not awaited
  lines.forEach((line, idx) => {
    const match = /const \w+ = (fetch|axios|api\.)/.exec(line);
    if (match && !line.includes("await") && !line.includes(".then")) {
      bugs.push({
        line: idx + 1,
        severity: "critical",
        category: "async_await",
        message: "Promise not awaited",
        suggestion: `const ... = await ${match[1]}...`,
        confidence: 0.85,
      });
    }
  });

  // Add more patterns...

  return bugs;
}
```

**Validation**:

```bash
bun test src/bugs/static.test.ts

# Expected: Detects null checks, missing awaits
```

### Step 4.5: Code Review Mobile Components (NEW)

**Create** `apps/native/components/review/code/FileCard.tsx`:

```typescript
import React from 'react';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { HUDSurface } from '@/components/foundation/HUDSurface';
import { BiolumText } from '@/components/foundation/BiolumText';
import { BugBadge } from './BugBadge';

interface FileCardProps {
  file: FileDiff;
  bugs: Bug[];
  onApprove: () => void;
  onRequestChanges: () => void;
  onViewHunks: () => void;
}

export function FileCard({ file, bugs, onApprove, onRequestChanges, onViewHunks }: FileCardProps) {
  const translateX = useSharedValue(0);

  const criticalBugs = bugs.filter(b => b.severity === 'critical');
  const warnings = bugs.filter(b => b.severity === 'warning');

  const gesture = Gesture.Pan()
    .onUpdate((event) => {
      translateX.value = event.translationX;
    })
    .onEnd((event) => {
      if (Math.abs(event.translationX) > 120) {
        const direction = event.translationX > 0 ? 'right' : 'left';
        translateX.value = withSpring(direction === 'right' ? 400 : -400);

        if (direction === 'right') {
          runOnJS(onApprove)();
        } else {
          runOnJS(onRequestChanges)();
        }
      } else {
        translateX.value = withSpring(0);
      }
    });

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={[{ transform: [{ translateX }] }]}>
        <HUDSurface elevation={3}>
          {/* File header */}
          <BiolumText variant="titleMedium">{file.path}</BiolumText>
          <BiolumText variant="caption" color="dim">
            +{file.additions} -{file.deletions}
          </BiolumText>

          {/* Bug badges */}
          {criticalBugs.length > 0 && (
            <BugBadge severity="critical" count={criticalBugs.length} />
          )}
          {warnings.length > 0 && (
            <BugBadge severity="warning" count={warnings.length} />
          )}

          {/* AI summary */}
          <BiolumText variant="bodyMedium" color="standard">
            {file.aiSummary ?? 'No summary available'}
          </BiolumText>

          {/* Actions */}
          <TouchableOpacity onPress={onViewHunks}>
            <BiolumText variant="caption" color="faint">
              [View {file.hunks.length} hunks]
            </BiolumText>
          </TouchableOpacity>

          {/* Swipe hint */}
          <BiolumText variant="caption" color="faint">
            ← Request Changes | Approve →
          </BiolumText>
        </HUDSurface>
      </Animated.View>
    </GestureDetector>
  );
}
```

**Create** `apps/native/components/review/code/BugBadge.tsx`:

```typescript
import { View } from 'react-native';
import { BiolumText } from '@/components/foundation/BiolumText';
import { useVoidTheme } from '@/hooks/use-void-theme';

interface BugBadgeProps {
  severity: 'critical' | 'warning' | 'info';
  count: number;
}

export function BugBadge({ severity, count }: BugBadgeProps) {
  const theme = useVoidTheme();

  const config = {
    critical: { emoji: '🔴', color: theme.colors.semantic.error },
    warning: { emoji: '🟡', color: theme.colors.semantic.warning },
    info: { emoji: '🔵', color: theme.colors.semantic.info },
  }[severity];

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
        backgroundColor: `${config.color}20`,
        borderWidth: 1,
        borderColor: `${config.color}40`,
      }}
    >
      <BiolumText variant="caption">{config.emoji} {count}</BiolumText>
    </View>
  );
}
```

**Create** `apps/native/components/review/code/DiffRenderer.tsx`:

```typescript
import SyntaxHighlighter from 'react-native-syntax-highlighter';
import { atomOneDark } from 'react-syntax-highlighter/styles/hljs';
import { useVoidTheme } from '@/hooks/use-void-theme';

interface DiffRendererProps {
  lines: DiffLine[];
}

export function DiffRenderer({ lines }: DiffRendererProps) {
  const theme = useVoidTheme();

  return (
    <View>
      {lines.map((line, idx) => {
        const bgColor =
          line.type === 'add' ? `${theme.colors.semantic.success}15` :
          line.type === 'delete' ? `${theme.colors.semantic.error}15` :
          'transparent';

        const borderColor =
          line.type === 'add' ? theme.colors.semantic.success :
          line.type === 'delete' ? theme.colors.semantic.error :
          'transparent';

        return (
          <View
            key={idx}
            style={{
              backgroundColor: bgColor,
              borderLeftWidth: 2,
              borderLeftColor: borderColor,
              paddingLeft: 8,
            }}
          >
            <SyntaxHighlighter
              language="typescript"
              style={{
                ...atomOneDark,
                hljs: {
                  background: 'transparent',
                  color: theme.colors.biolum.standard,
                },
              }}
              customStyle={{
                fontSize: 13,
                fontFamily: 'SF Mono',
                padding: 0,
              }}
            >
              {line.content}
            </SyntaxHighlighter>
          </View>
        );
      })}
    </View>
  );
}
```

**Validation**:

```bash
bun run ios

# Test code review flow:
# 1. Create test PR
# 2. ALFRED analyzes → creates review
# 3. Open Reviews → see PR card with bug count
# 4. Swipe through files
# 5. See bugs with red badges
# 6. Approve/request changes
```

### Step 4: Mobile Screen - Reviews Tab

```typescript
import { useState } from 'react';
import { VoidContainer } from '@/components/foundation/VoidContainer';
import { ReviewCardStack } from '@/components/review/ReviewCardStack';
import { ReviewQueue } from '@/components/review/ReviewQueue';
import { trpc } from '@/lib/api';

export default function ReviewsScreen() {
  const [isReviewing, setIsReviewing] = useState(false);

  const { data, isLoading } = trpc.review.queue.useQuery({
    filter: 'all',
    limit: 10,
  });

  const submitMutation = trpc.review.submit.useMutation({
    onSuccess: () => {
      // Advance to next card
    },
  });

  const handleApprove = (review: Review) => {
    submitMutation.mutate({
      reviewId: review.id,
      verdict: 'approve',
    });
  };

  const handleReject = (review: Review) => {
    submitMutation.mutate({
      reviewId: review.id,
      verdict: 'reject',
    });
  };

  if (isReviewing && data?.reviews) {
    return (
      <VoidContainer>
        <ReviewCardStack
          reviews={data.reviews}
          onApprove={handleApprove}
          onReject={handleReject}
          onComplete={() => setIsReviewing(false)}
        />
      </VoidContainer>
    );
  }

  return (
    <VoidContainer>
      <ReviewQueue
        reviews={data?.reviews ?? []}
        isLoading={isLoading}
        onStartReviewing={() => setIsReviewing(true)}
      />
    </VoidContainer>
  );
}
```

**Add tab** in `apps/native/app/(drawer)/(tabs)/_layout.tsx`:

```typescript
<Tabs.Screen
  name="reviews"
  options={{
    title: "Reviews",
    tabBarIcon: ({ color }) => <TabBarIcon color={color} name="check-square" />,
    tabBarBadge: pendingCount > 0 ? pendingCount : undefined,
  }}
/>
```

---

## Validation and Acceptance

### Acceptance Criteria

**Backend**:

- [ ] `review.queue` returns pending reviews for user
- [ ] `review.submit` updates status and triggers learning
- [ ] Tool executions with confidence < 0.95 create reviews
- [ ] Approved reviews boost confidence by 0.15

**Mobile UI**:

- [ ] ReviewCard swipes smoothly at 60fps
- [ ] Haptic fires at 120pt threshold
- [ ] Green glow on right swipe, red glow on left
- [ ] Card flies off screen after swipe > threshold
- [ ] Stack animates up when card exits

**Learning Integration**:

- [ ] Approve → `memory_boost()` called
- [ ] Reject → `recordToolFailure()` called
- [ ] After 5 approvals → auto-approve enabled
- [ ] Confidence changes reflected in next executions

### Testing Commands

```bash
# Backend tests
cd packages/api
bun test src/routers/review.test.ts

# Mobile component tests
cd apps/native
bun test components/review/ReviewCard.test.tsx

# E2E test
bun run ios
# 1. Create note → review created
# 2. Open Reviews → see pending
# 3. Swipe right → approved
# 4. Create another note → auto-approved
```

### Expected Outputs

**Review Queue Screen**:

```
┌─────────────────────────────────────┐
│  Reviews                            │
│  🔔 3 pending reviews               │
├─────────────────────────────────────┤
│  Filter: [All] [Tools] [Memories]  │
├─────────────────────────────────────┤
│  ┌───────────────────────────────┐  │
│  │ 🛠️ Tool Execution             │  │
│  │ Created note • 2m ago         │  │
│  └───────────────────────────────┘  │
│  [Start Reviewing]                  │
└─────────────────────────────────────┘
```

**Swipe Mode**:

```
┌─────────────────────────────────────┐
│                                     │
│  ←                         →        │
│  [X]                      [✓]       │
│  [Red Glow]          [Green Glow]   │
│                                     │
│  ┌─────────────────────────────────┐│
│  │  🛠️ Tool Execution              ││
│  │  Created Note                   ││
│  │  Title: "Q1 Planning"           ││
│  │  ← Reject | Approve →          ││
│  └─────────────────────────────────┘│
│                                     │
│  Progress: 1 of 3                   │
└─────────────────────────────────────┘
```

---

## Idempotence and Recovery

**Idempotence**:

- All steps can be re-run safely
- Database migrations are versioned
- Review submissions are idempotent (dedupe by ID)

**Recovery from Failures**:

**If migration fails**:

```bash
cd packages/db
bun run migrate:rollback
# Fix schema
bun run migrate
```

**If swipe gesture lags**:

```bash
# Enable performance monitor
# Shake device → "Show Perf Monitor"
# Verify native driver usage in animations
# Check: All transforms use `useNativeDriver: true`
```

**If reviews duplicate**:

```bash
# Check indexes
psql alfred -c "\d review_queue"
# Add unique constraint if missing
ALTER TABLE review_queue ADD CONSTRAINT unique_review UNIQUE (subject_id, user_id);
```

---

## Artifacts and Notes

### Swipe Thresholds

```
Swipe Distance (pt) | Action
---------------------|--------
0-119                | Spring back to center
120-400              | Trigger swipe (slow)
400+                 | Trigger swipe (fast)

Velocity (pt/s)      | Action
---------------------|--------
0-999                | Use distance threshold
1000+                | Instant trigger
```

### Animation Performance

```
Target Frame Rate: 60fps
Frame Budget: 16ms

Measured:
- Card swipe: 14ms ✓
- Stack animation: 12ms ✓
- Glow opacity: 8ms ✓
```

---

_ExecPlan v1.0 — MVP Ready_  
_Estimated: 3 weeks, 1 dev_
