# ALFRED Reviews: Developer Quick Start

**Get started implementing ALFRED Reviews in 30 minutes**

---

## Prerequisites

```bash
# 1. You have ALFRED development environment running
cd /Users/jackmazac/Development/alfred
bun install

# 2. Mobile app builds successfully
cd apps/native
bun run ios  # Should launch without errors

# 3. Backend is running
cd ../web
bun run dev  # Should start on localhost:3000
```

---

## Quick Start: Action Reviews (3 Steps)

### Step 1: Database Schema (5 minutes)

Create migration:

```bash
cd packages/db/drizzle
touch 0025_reviews.sql
```

```sql
-- 0025_reviews.sql
CREATE TABLE review_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  review_type VARCHAR(50) NOT NULL,
  subject_id UUID NOT NULL,
  subject_data JSONB NOT NULL,

  conversation_id VARCHAR(255),
  priority VARCHAR(10) NOT NULL DEFAULT 'medium',
  status VARCHAR(20) NOT NULL DEFAULT 'pending',

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  INDEX idx_review_queue_user_status (user_id, status),
  INDEX idx_review_queue_priority (priority, created_at DESC)
);
```

Run migration:

```bash
bun run migrate
```

### Step 2: Backend Router (10 minutes)

Create router:

```bash
cd packages/api/src/routers
touch review.ts
```

```typescript
// review.ts (simplified MVP)
import { z } from "zod";
import { router, authedProcedure } from "../trpc";

export const reviewRouter = router({
  queue: authedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session?.user?.id;
    if (!userId) throw new Error("Unauthorized");

    // TODO: Query review_queue table
    return { reviews: [], total: 0 };
  }),

  submit: authedProcedure
    .input(
      z.object({
        reviewId: z.string().uuid(),
        verdict: z.enum(["approve", "reject"]),
      })
    )
    .mutation(async ({ input }) => {
      // TODO: Update review status
      // TODO: Trigger learning (memory_boost or recordFailure)
      return { success: true };
    }),
});
```

Register router:

```bash
# Edit packages/api/src/index.ts
```

```typescript
import { reviewRouter } from "./routers/review";

export const appRouter = router({
  // ... existing routers
  review: reviewRouter, // ADD THIS
});
```

### Step 3: Mobile Screen (15 minutes)

Create screen:

```bash
cd apps/native/app/(drawer)/(tabs)
touch reviews.tsx
```

```typescript
// reviews.tsx (minimal MVP)
import { View, Text, TouchableOpacity } from 'react-native';
import { Container } from '@/components/container';
import { trpc } from '@/lib/api';

export default function ReviewsScreen() {
  const { data, isLoading } = trpc.review.queue.useQuery();

  return (
    <Container>
      <View className="flex-1 p-4">
        <Text className="mb-4 font-bold text-2xl">Reviews</Text>

        {isLoading ? (
          <Text>Loading...</Text>
        ) : (
          <Text>
            {data?.total ?? 0} pending reviews
          </Text>
        )}

        <TouchableOpacity
          className="mt-4 rounded-lg bg-blue-500 px-4 py-3"
          onPress={() => console.log('Start reviewing')}
        >
          <Text className="text-center text-white">
            Start Reviewing
          </Text>
        </TouchableOpacity>
      </View>
    </Container>
  );
}
```

Add tab:

```bash
# Edit apps/native/app/(drawer)/(tabs)/_layout.tsx
```

```typescript
<Tabs.Screen
  name="reviews"
  options={{
    title: "Reviews",
    tabBarIcon: ({ color }) => <TabBarIcon name="check-square" color={color} />,
  }}
/>
```

### Verify

```bash
bun run ios

# Navigate to Reviews tab
# Should see: "0 pending reviews"
# Tap "Start Reviewing" → logs to console

✓ Basic setup complete!
```

---

## Quick Start: Code Reviews (3 Steps)

### Step 1: Install Dependencies (2 minutes)

```bash
cd apps/native
bun add parse-diff @octokit/rest react-native-syntax-highlighter

cd ../../packages
mkdir code-analysis
cd code-analysis
bun init
bun add parse-diff typescript
```

### Step 2: Bug Detection Service (10 minutes)

```bash
cd packages/code-analysis
mkdir -p src/bugs
touch src/bugs/static.ts
```

```typescript
// src/bugs/static.ts (simplified)
export interface Bug {
  line: number;
  severity: "critical" | "warning" | "info";
  message: string;
  suggestion?: string;
  confidence: number;
}

export function detectStaticBugs(code: string): Bug[] {
  const bugs: Bug[] = [];

  // Pattern 1: Null pointer risk
  const nullPointerRegex = /(\w+)\.(\w+)\.(\w+)/g;
  let match;
  while ((match = nullPointerRegex.exec(code)) !== null) {
    const line = code.substring(0, match.index).split("\n").length;
    bugs.push({
      line,
      severity: "critical",
      message: "Potential null pointer: use optional chaining",
      suggestion: `${match[1]}?.${match[2]}?.${match[3]}`,
      confidence: 0.75,
    });
  }

  // Pattern 2: Missing await
  const missingAwaitRegex = /const \w+ = (fetch|axios|getUser)\(/g;
  while ((match = missingAwaitRegex.exec(code)) !== null) {
    const line = code.substring(0, match.index).split("\n").length;
    bugs.push({
      line,
      severity: "critical",
      message: "Promise not awaited",
      suggestion: `const ... = await ${match[1]}(`,
      confidence: 0.9,
    });
  }

  return bugs;
}
```

### Step 3: Code Review Router (10 minutes)

```bash
cd packages/api/src/routers
touch code-review.ts
```

```typescript
// code-review.ts (simplified)
import { z } from "zod";
import { router, authedProcedure } from "../trpc";
import parseDiff from "parse-diff";
import { detectStaticBugs } from "@alfred/code-analysis/bugs/static";

export const codeReviewRouter = router({
  analyze: authedProcedure
    .input(
      z.object({
        diff: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      // Parse diff
      const files = parseDiff(input.diff);

      // Detect bugs (simplified - just static for now)
      const bugs = files.flatMap((file) =>
        detectStaticBugs(file.chunks.map((c) => c.content).join("\n"))
      );

      // Create review
      return {
        files: files.length,
        bugs: bugs.length,
        qualityScore: bugs.length === 0 ? 10 : Math.max(5, 10 - bugs.length),
      };
    }),
});
```

Register:

```typescript
// packages/api/src/index.ts
import { codeReviewRouter } from "./routers/code-review";

export const appRouter = router({
  // ...
  codeReview: codeReviewRouter, // ADD THIS
});
```

### Verify

```bash
# Test bug detection
curl -X POST http://localhost:3000/api/trpc/codeReview.analyze \
  -H "Content-Type: application/json" \
  -d '{"diff":"... git diff here ..."}'

# Should return: { files: N, bugs: N, qualityScore: N }

✓ Bug detection working!
```

---

## Next Steps

### Immediate (Today)

1. Read complete design:

   ```bash
   cat docs/design/alfred-reviews-complete.md
   ```

2. Review mockups:

   ```bash
   cat docs/design/alfred-reviews-mockups.md
   cat docs/design/alfred-reviews-code-mockups.md
   ```

3. Study component spec:
   ```bash
   cat docs/design/alfred-reviews-component-spec.md
   ```

### This Week

1. **Implement ReviewCard** with swipe gesture

   ```bash
   # Follow: docs/execplans/alfred-reviews-implementation.md
   # Milestone 2: Review Card Component
   ```

2. **Create test reviews manually**

   ```sql
   INSERT INTO review_queue (user_id, review_type, subject_id, subject_data)
   VALUES ('your-user-id', 'tool_execution', gen_random_uuid(),
     '{"toolName":"note_create","summary":"Test note"}'::jsonb);
   ```

3. **Test swipe on device**
   ```bash
   bun run ios
   # Swipe card → should fly off screen
   ```

### Next Week

1. **Wire learning integration**
   - Approve → `memory_boost()`
   - Reject → `recordToolFailure()`

2. **Add analytics**
   - Approval rate chart
   - Review time stats
   - Trust score visualization

3. **Beta test with 5 users**
   - Collect feedback
   - Measure completion rate
   - Iterate on UX

### Month 2

1. **Add code review**
   - Diff parsing
   - Bug detection
   - GitHub integration

2. **Advanced features**
   - Auto-fix suggestions
   - Batch review
   - Voice integration

3. **Launch**
   - Public beta
   - Documentation
   - Marketing

---

## Common Issues & Solutions

### Issue 1: Swipe gesture not working

**Symptom**: Card doesn't move when swiping

**Fix**:

```bash
# Check react-native-gesture-handler is installed
cd apps/native
bun add react-native-gesture-handler

# Wrap app in GestureHandlerRootView
# Edit app/_layout.tsx:
import { GestureHandlerRootView } from 'react-native-gesture-handler';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      {/* ... */}
    </GestureHandlerRootView>
  );
}
```

### Issue 2: Reviews not appearing in queue

**Symptom**: Queue always empty

**Debug**:

```sql
-- Check if reviews exist
SELECT * FROM review_queue WHERE user_id = 'your-user-id';

-- If empty, create test review:
INSERT INTO review_queue (user_id, review_type, subject_id, subject_data, priority)
VALUES ('your-user-id', 'tool_execution', gen_random_uuid(),
  '{"toolName":"test","summary":"Test review"}'::jsonb, 'high');
```

### Issue 3: Bug detection not finding bugs

**Symptom**: Code review shows 0 bugs on obviously buggy code

**Debug**:

```typescript
// Test bug detector directly
import { detectStaticBugs } from "@alfred/code-analysis/bugs/static";

const code = `
const user = await getUser();
if (user.profile.email) {  // Should flag null risk
  sendEmail(user.profile.email);
}
`;

const bugs = detectStaticBugs(code);
console.log("Bugs found:", bugs);
// Should show: 1 bug (null pointer risk)
```

---

## Testing Checklist

### Action Reviews

- [ ] Create test tool execution → review appears in queue
- [ ] Swipe right → backend receives approve
- [ ] Swipe left → backend receives reject
- [ ] Tap card → details modal opens
- [ ] Complete 5 reviews → auto-approve enabled
- [ ] Analytics show approval rate

### Code Reviews

- [ ] Parse sample diff → files extracted
- [ ] Bug detection finds null checks
- [ ] LLM analysis explains changes
- [ ] Swipe through files → progress updates
- [ ] Approve all → posts to GitHub
- [ ] Request changes → GitHub comment appears

---

## Performance Targets

```
Action Review:
  • Card swipe: 60fps (16ms frames)
  • Queue load: <200ms
  • Submit: <500ms

Code Review:
  • Diff parse: <1s for 10 files
  • Bug detection: <5s for 10 files
  • File swipe: 60fps
  • Hunk render: <100ms
```

---

## Resources

### Design Docs

- `docs/design/alfred-reviews-complete.md` — Complete system
- `docs/design/alfred-reviews-comparison.md` — vs Devin/GitHub

### Implementation

- `docs/execplans/alfred-reviews-implementation.md` — Step-by-step

### Components

- `docs/design/alfred-reviews-component-spec.md` — Component API
- `docs/design/alfred-reviews-code-spec.md` — Code review features

### Mockups

- `docs/design/alfred-reviews-mockups.md` — Action review UX
- `docs/design/alfred-reviews-code-mockups.md` — Code review UX

### Integration

- `docs/design/alfred-reviews-integration.md` — Learning pipeline

---

## Get Help

### Questions?

1. **Read the docs** (linked above)
2. **Check examples** in mockups
3. **Ask ALFRED** (meta!)

### Found a bug?

1. File issue with:
   - What you expected
   - What happened
   - Steps to reproduce
2. Include screenshots/videos
3. Tag as `reviews` + `mobile`

### Want to contribute?

1. Pick a milestone from ExecPlan
2. Implement component/feature
3. Write tests
4. Submit PR
5. Use ALFRED Reviews to review your own PR! (dogfood)

---

_Quick Start Guide v1.0_  
_Get reviewing in 30 minutes_
