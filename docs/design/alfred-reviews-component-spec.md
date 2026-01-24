# ALFRED Reviews: Component Specification

**Mobile-Native Swipe Interface**  
**Design Version**: 1.0  
**Status**: Implementation Ready

---

## Component Architecture

### Component Tree

```
ReviewsScreen (Screen)
├── ReviewQueue (List View)
│   ├── ReviewQueueHeader
│   │   ├── PendingCount
│   │   ├── FilterPills (All/Code/Actions)
│   │   └── SortDropdown
│   ├── ReviewQueueList (FlatList)
│   │   ├── ReviewQueueItem (Preview Card)
│   │   └── CodeReviewQueueItem (PR/Diff Preview)
│   └── StartReviewingButton
│
├── ReviewSwiper (Full-Screen Modal) — Action Reviews
│   ├── ReviewCardStack
│   │   ├── ReviewCard (Swipeable) [Current]
│   │   ├── ReviewCard (Preview) [Next]
│   │   └── ReviewCard (Preview) [Next+1]
│   ├── SwipeIndicators
│   │   ├── RejectIndicator (Left, Red Glow)
│   │   └── ApproveIndicator (Right, Green Glow)
│   ├── ReviewProgressBar
│   └── ReviewDetailsModal
│
└── CodeReviewSwiper (Full-Screen Modal) — Code Reviews
    ├── PROverviewCard
    │   ├── PRMetadata (number, title, author)
    │   ├── ChangesSummary (files, lines, groups)
    │   └── AIAnalysis (bugs, warnings, score)
    │
    ├── FileCardStack (Swipeable)
    │   ├── FileCard [Current]
    │   │   ├── FileHeader (path, +/- lines)
    │   │   ├── BugBadges (critical/warning/info)
    │   │   ├── AISummary (what changed)
    │   │   └── HunkPreview (collapsed)
    │   ├── FileCard [Next]
    │   └── FileCard [Next+1]
    │
    ├── HunkViewer (Expandable)
    │   ├── DiffRenderer (syntax highlighted)
    │   │   ├── DiffLine (added/deleted/context)
    │   │   └── InlineBugMarker
    │   ├── HunkNavigation (prev/next)
    │   └── LineCommentButton
    │
    ├── BugDetailModal
    │   ├── BugDescription
    │   ├── CodeSnippet
    │   ├── SuggestedFix (copy/apply)
    │   └── Actions (dismiss/fix/comment)
    │
    └── CodeChatModal
        ├── ChatThread (ask questions)
        └── CodeContext (related files)
```

---

## Core Components

### 1. ReviewCard (Swipeable)

**Location**: `apps/native/components/review/ReviewCard.tsx`

**Props**:

```typescript
interface ReviewCardProps {
  review: Review;
  onSwipeRight: (review: Review) => void;
  onSwipeLeft: (review: Review) => void;
  onSwipeUp: (review: Review) => void;
  onTap: (review: Review) => void;
  isTopCard: boolean;
  zIndex: number;
}

interface Review {
  id: string;
  reviewType: "tool_execution" | "message" | "memory" | "workflow";
  priority: "low" | "medium" | "high" | "critical";
  subjectData: {
    // Type-specific data
    toolName?: string;
    messageContent?: string;
    memoryFact?: string;
    workflowDecision?: string;
  };
  context: {
    conversationId?: string;
    messageId?: string;
    timestamp: number;
  };
  createdAt: Date;
}
```

**Visual Specification**:

```
┌─────────────────────────────────────┐
│  ReviewCard (HUDSurface elevation3) │
├─────────────────────────────────────┤
│                                     │
│  [Icon]  Review Type                │ ← Title (title.medium)
│  ─────────────────                  │
│                                     │
│  Primary Content                    │ ← Body (body.large)
│  Secondary details...               │
│                                     │
│  📍 Context:                        │ ← Caption (caption.medium)
│  "From chat 5 minutes ago"          │
│                                     │
│  Priority Badge                     │ ← Optional
│                                     │
│  ← Swipe to Reject | Approve →    │ ← Hint text
│                                     │
│  [Tap for details]                  │
└─────────────────────────────────────┘
```

**Animations**:

```typescript
// Swipe gesture tracking
const translateX = useSharedValue(0);
const translateY = useSharedValue(0);
const rotateZ = useSharedValue(0);

// Glow intensity based on swipe distance
const leftGlowOpacity = useDerivedValue(() => {
  return (
    Math.min(Math.abs(translateX.value) / 150, 1) *
    (translateX.value < 0 ? 1 : 0)
  );
});

const rightGlowOpacity = useDerivedValue(() => {
  return Math.min(translateX.value / 150, 1) * (translateX.value > 0 ? 1 : 0);
});

// Swipe threshold: 120pt
const SWIPE_THRESHOLD = 120;

// Card exit animation
const exitAnimation = (direction: "left" | "right" | "up") => {
  "worklet";
  const targetX = direction === "left" ? -400 : direction === "right" ? 400 : 0;
  const targetY = direction === "up" ? -600 : 0;

  return withSequence(
    withSpring(
      { x: targetX, y: targetY },
      {
        damping: 20,
        stiffness: 90,
      }
    ),
    withTiming(0, { duration: 0 }) // Reset for next card
  );
};
```

**Interaction States**:

- **Idle**: Breathing animation (subtle scale 1.0-1.02)
- **Dragging**: Rotate ±5° based on swipe angle, glow on swipe direction
- **Threshold Reached**: Haptic feedback (medium), glow intensifies
- **Release (< threshold)**: Spring back to center
- **Release (> threshold)**: Fly off screen, trigger callback
- **Tap**: Expand to full-screen modal (500ms scale + fade)

### 2. ReviewCardStack

**Location**: `apps/native/components/review/ReviewCardStack.tsx`

**Purpose**: Manages 3-card stack (current + 2 previews)

**Props**:

```typescript
interface ReviewCardStackProps {
  reviews: Review[];
  currentIndex: number;
  onApprove: (review: Review) => void;
  onReject: (review: Review) => void;
  onSkip: (review: Review) => void;
  onDetails: (review: Review) => void;
}
```

**Layout**:

```
Current Card (z-index: 3)
  ↓ Scale: 1.0, Opacity: 1.0, Y: 0

Next Card (z-index: 2)
  ↓ Scale: 0.95, Opacity: 0.8, Y: 20pt

Next+1 Card (z-index: 1)
  ↓ Scale: 0.90, Opacity: 0.6, Y: 40pt
```

**Animation on Swipe**:

```typescript
// When current card exits, next cards move up
const animateStackUp = () => {
  "worklet";
  // Card 2 becomes Card 1
  card2Scale.value = withSpring(1.0);
  card2Y.value = withSpring(0);
  card2Opacity.value = withSpring(1.0);

  // Card 3 becomes Card 2
  card3Scale.value = withSpring(0.95);
  card3Y.value = withSpring(20);
  card3Opacity.value = withSpring(0.8);

  // Load new Card 3
  // Fade in from bottom
};
```

### 3. SwipeIndicators

**Location**: `apps/native/components/review/SwipeIndicators.tsx`

**Visual**:

```
┌─────────────────────────────────────┐
│                                     │
│                                     │
│  ←                         →        │ ← Icons
│  [X]                      [✓]       │    (48pt)
│                                     │
│  Reject                Approve      │ ← Labels
│                                     │
│  [Red Glow]          [Green Glow]   │ ← Reactive
└─────────────────────────────────────┘
```

**Glow Effect**:

```typescript
// Left indicator (Reject)
<Animated.View
  style={[
    styles.indicator,
    { opacity: leftGlowOpacity },
    {
      shadowColor: VOID_PALETTE.semantic.error,
      shadowRadius: leftGlowOpacity.value * 40,
      shadowOpacity: leftGlowOpacity.value * 0.6,
    }
  ]}
>
  <Ionicons name="close-circle" size={48} color={VOID_PALETTE.semantic.error} />
  <BiolumText variant="caption" color="error">Reject</BiolumText>
</Animated.View>

// Right indicator (Approve)
<Animated.View
  style={[
    styles.indicator,
    { opacity: rightGlowOpacity },
    {
      shadowColor: VOID_PALETTE.semantic.success,
      shadowRadius: rightGlowOpacity.value * 40,
      shadowOpacity: rightGlowOpacity.value * 0.6,
    }
  ]}
>
  <Ionicons name="checkmark-circle" size={48} color={VOID_PALETTE.semantic.success} />
  <BiolumText variant="caption" color="success">Approve</BiolumText>
</Animated.View>
```

### 4. ReviewQueue (List View)

**Location**: `apps/native/app/(drawer)/(tabs)/reviews.tsx`

**Layout**:

```
┌─────────────────────────────────────┐
│  Reviews                            │ ← Header
│  🔔 5 pending reviews               │
├─────────────────────────────────────┤
│  Filter: [All] [Tools] [Memories]  │ ← Filter Pills
│  Sort: [Newest ▾]                   │
├─────────────────────────────────────┤
│                                     │
│  ┌───────────────────────────────┐  │
│  │ 🛠️ Tool Execution             │  │ ← Preview Card
│  │ Created note • 2m ago         │  │   (HUDSurface)
│  │ Priority: High                │  │
│  └───────────────────────────────┘  │
│                                     │
│  ┌───────────────────────────────┐  │
│  │ 🧠 Memory Association         │  │
│  │ Learned preference • 10m ago  │  │
│  │ Priority: Medium              │  │
│  └───────────────────────────────┘  │
│                                     │
│  ┌───────────────────────────────┐  │
│  │ 💬 Message Quality            │  │
│  │ Response style • 1h ago       │  │
│  │ Priority: Low                 │  │
│  └───────────────────────────────┘  │
│                                     │
├─────────────────────────────────────┤
│  [Start Reviewing]                  │ ← Action Button
└─────────────────────────────────────┘
```

**Components**:

```typescript
// Filter Pills
<View style={styles.filterRow}>
  <FilterPill label="All" active={filter === 'all'} onPress={() => setFilter('all')} />
  <FilterPill label="Tools" active={filter === 'tools'} onPress={() => setFilter('tools')} />
  <FilterPill label="Messages" active={filter === 'messages'} onPress={() => setFilter('messages')} />
  <FilterPill label="Memories" active={filter === 'memories'} onPress={() => setFilter('memories')} />
</View>

// Review List
<FlatList
  data={filteredReviews}
  renderItem={({ item }) => (
    <ReviewQueueItem
      review={item}
      onPress={() => openReviewSwiper(item.id)}
    />
  )}
  keyExtractor={(item) => item.id}
  contentContainerStyle={styles.listContent}
/>
```

### 5. ReviewDetailsModal

**Location**: `apps/native/components/review/ReviewDetailsModal.tsx`

**Trigger**: Tap card or swipe down on card

**Layout**:

```
┌─────────────────────────────────────┐
│  ─────                              │ ← Drag Handle
│                                     │
│  Review Details                     │ ← Title
│                                     │
├─────────────────────────────────────┤
│                                     │
│  Context                            │ ← Section
│  ════════                           │
│  From conversation:                 │
│  "You: Take a note about meeting"   │
│  "Alfred: Created note"             │
│                                     │
│  Reasoning                          │
│  ═════════                          │
│  I inferred:                        │
│  • Title from "meeting" keyword     │
│  • Content from context             │
│  Confidence: 0.85                   │
│                                     │
│  Related Memories                   │
│  ════════════════                   │
│  • You prefer brief notes           │
│  • Work meetings → calendar         │
│                                     │
│  [Ask ALFRED to Explain]            │
│                                     │
├─────────────────────────────────────┤
│  [Approve] [Reject] [Edit]          │ ← Actions
└─────────────────────────────────────┘
```

**Scroll Behavior**:

- Modal height: 70% of screen
- Snap points: 70%, 90%
- Over-scroll dismisses modal
- Backdrop blur + dim

---

## Review Type Variants

### Tool Execution Card

```typescript
interface ToolExecutionReview {
  reviewType: "tool_execution";
  subjectData: {
    toolName: string;
    toolInput: Record<string, unknown>;
    toolOutput: Record<string, unknown>;
    success: boolean;
  };
}
```

**Visual**:

```
┌─────────────────────────────────────┐
│  🛠️  Tool Execution                │
│  ─────────────────                  │
│                                     │
│  Created Note                       │
│                                     │
│  Title: "Q1 Planning Meeting"      │
│  Content: "Discuss budget, goals,  │
│            team allocation..."      │
│                                     │
│  📍 Triggered by:                   │
│  "Take a note about the meeting"   │
│                                     │
│  Confidence: 0.87                   │
│                                     │
│  ← Swipe to Reject | Approve →    │
└─────────────────────────────────────┘
```

### Message Quality Card

```typescript
interface MessageReview {
  reviewType: "message";
  subjectData: {
    messageId: string;
    messageContent: string;
    userPrompt: string;
    responseStyle: "concise" | "detailed" | "technical";
  };
}
```

**Visual**:

```
┌─────────────────────────────────────┐
│  💬  Message Quality                │
│  ─────────────────                  │
│                                     │
│  You: "How are my tests?"           │
│                                     │
│  Alfred:                            │
│  "Your test suite has a 94% pass   │
│  rate this week, up 2% from last   │
│  week. Top 3 failures:              │
│  auth.test.ts, api.test.ts..."     │
│                                     │
│  Rate verbosity:                    │
│  Too Brief ←  ●  → Too Long         │
│               ↑ Perfect             │
│                                     │
│  ← Swipe to Reject | Approve →    │
└─────────────────────────────────────┘
```

### Memory Association Card

```typescript
interface MemoryReview {
  reviewType: "memory";
  subjectData: {
    memoryId: string;
    memoryType: "fact" | "preference" | "relation";
    fact: string;
    evidence: string[];
    confidence: number;
  };
}
```

**Visual**:

```
┌─────────────────────────────────────┐
│  🧠  Memory Association             │
│  ─────────────────                  │
│                                     │
│  Learned Preference                 │
│                                     │
│  "You prefer meetings               │
│   scheduled after 10am"             │
│                                     │
│  Evidence:                          │
│  • Rescheduled 3 meetings from 9am │
│  • Said "too early" twice           │
│  • Calendar shows 10am+ pattern     │
│                                     │
│  Confidence: 0.85                   │
│                                     │
│  ← Swipe to Reject | Confirm →    │
└─────────────────────────────────────┘
```

### Workflow Decision Card

```typescript
interface WorkflowReview {
  reviewType: "workflow";
  subjectData: {
    workflowId: string;
    decision: "escalate" | "continue" | "suspend";
    reason: string;
    alternative: string;
  };
}
```

### Code Review Card (NEW — Devin-Style)

```typescript
interface CodeReview {
  reviewType: "code";
  subjectData: {
    source: "github_pr" | "local_diff" | "agent_output";
    prNumber?: number;
    prTitle?: string;
    author?: string;
    files: FileDiff[];
    groups: DiffGroup[];
    bugs: Bug[];
    summary: string;
    qualityScore: number;
  };
}

interface FileDiff {
  path: string;
  status: "added" | "modified" | "deleted" | "moved" | "renamed";
  movedFrom?: string;
  additions: number;
  deletions: number;
  hunks: Hunk[];
  aiSummary: string;
  bugs: Bug[];
}

interface Hunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: DiffLine[];
  summary: string;
}

interface DiffLine {
  type: "add" | "delete" | "context";
  lineNumber: number;
  content: string;
  hasBug?: boolean;
  bugId?: string;
}

interface Bug {
  id: string;
  file: string;
  line: number;
  severity: "critical" | "warning" | "info";
  category: "null_check" | "type_error" | "security" | "performance" | "style";
  message: string;
  suggestion?: string;
  confidence: number;
}

interface DiffGroup {
  name: string;
  description: string;
  priority: "breaking" | "feature" | "refactor" | "style";
  files: string[];
}
```

**Visual**:

```
┌─────────────────────────────────────┐
│  🔄  Workflow Decision              │
│  ─────────────────                  │
│                                     │
│  Escalation Decision                │
│                                     │
│  Task: "Refactor auth middleware"   │
│                                     │
│  Decided to:                        │
│  → Escalate to Orchestrator         │
│                                     │
│  Reason:                            │
│  Task involves 5+ files, requires   │
│  architectural review               │
│                                     │
│  Alternative:                       │
│  Continue with Assistant            │
│                                     │
│  ← Wrong Call | Good Call →        │
└─────────────────────────────────────┘
```

---

## Animations Specification

### Card Entrance

```typescript
// Fade in from bottom
const cardEntrance = () => {
  "worklet";
  return {
    from: { opacity: 0, translateY: 50 },
    to: { opacity: 1, translateY: 0 },
    config: {
      duration: 300,
      easing: Easing.bezier(0, 0, 0.2, 1), // ease-out-cubic
    },
  };
};
```

### Swipe Gesture

```typescript
// Track finger movement
const gesture = Gesture.Pan()
  .onUpdate((event) => {
    translateX.value = event.translationX;
    translateY.value = event.translationY;

    // Rotate card based on swipe angle
    rotateZ.value = (event.translationX / 400) * 15; // Max ±15°

    // Haptic feedback at threshold
    if (Math.abs(event.translationX) > SWIPE_THRESHOLD && !hapticTriggered) {
      runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Medium);
      hapticTriggered = true;
    }
  })
  .onEnd((event) => {
    const velocityX = event.velocityX;
    const absTranslateX = Math.abs(translateX.value);

    // Determine swipe direction
    if (absTranslateX > SWIPE_THRESHOLD || Math.abs(velocityX) > 1000) {
      const direction = translateX.value > 0 ? "right" : "left";

      // Exit animation
      translateX.value = withSpring(direction === "right" ? 400 : -400, {
        damping: 20,
        stiffness: 90,
      });
      translateY.value = withSpring(event.translationY, {
        damping: 20,
        stiffness: 90,
      });

      // Trigger callback
      runOnJS(handleSwipe)(direction);
    } else {
      // Return to center
      translateX.value = withSpring(0);
      translateY.value = withSpring(0);
      rotateZ.value = withSpring(0);
      hapticTriggered = false;
    }
  });
```

### Stack Animation

```typescript
// When card exits, animate stack up
const animateStackUp = useCallback(() => {
  // Card 2 → Card 1
  card2Scale.value = withTiming(1.0, { duration: 250 });
  card2Y.value = withTiming(0, { duration: 250 });
  card2Opacity.value = withTiming(1.0, { duration: 250 });

  // Card 3 → Card 2
  card3Scale.value = withTiming(0.95, { duration: 250 });
  card3Y.value = withTiming(20, { duration: 250 });
  card3Opacity.value = withTiming(0.8, { duration: 250 });

  // New card 3 fades in
  setTimeout(() => {
    setCurrentIndex((prev) => prev + 1);
  }, 250);
}, []);
```

### Approval/Rejection Flash

```typescript
// Green flash on approve
const approvalFlash = () => {
  "worklet";
  return withSequence(
    withTiming(
      { backgroundColor: VOID_PALETTE.semantic.success, opacity: 0.3 },
      {
        duration: 100,
      }
    ),
    withTiming(
      { backgroundColor: "transparent", opacity: 0 },
      {
        duration: 200,
      }
    )
  );
};

// Red flash on reject
const rejectionFlash = () => {
  "worklet";
  return withSequence(
    withTiming(
      { backgroundColor: VOID_PALETTE.semantic.error, opacity: 0.3 },
      {
        duration: 100,
      }
    ),
    withTiming(
      { backgroundColor: "transparent", opacity: 0 },
      {
        duration: 200,
      }
    )
  );
};
```

---

## Performance Optimizations

### 1. Lazy Loading

```typescript
// Only render 3 cards at a time (current + 2 previews)
const visibleReviews = useMemo(() => {
  return reviews.slice(currentIndex, currentIndex + 3);
}, [reviews, currentIndex]);
```

### 2. Memoization

```typescript
// Memoize card renders
const ReviewCardMemo = React.memo(ReviewCard, (prev, next) => {
  return prev.review.id === next.review.id && prev.isTopCard === next.isTopCard;
});
```

### 3. Native Driver

```typescript
// All animations use native driver
translateX.value = withSpring(0, {
  useNativeDriver: true,
});
```

### 4. Throttle Gestures

```typescript
// Limit update frequency to 60fps
const gesture = Gesture.Pan().onUpdate(
  throttle((event) => {
    translateX.value = event.translationX;
  }, 16)
); // ~60fps
```

---

## Accessibility

### VoiceOver Support

```typescript
<Animated.View
  accessible={true}
  accessibilityLabel={`Review ${reviewTypeName}: ${subjectSummary}`}
  accessibilityHint="Swipe right to approve, left to reject, or tap for details"
  accessibilityActions={[
    { name: 'approve', label: 'Approve' },
    { name: 'reject', label: 'Reject' },
    { name: 'details', label: 'View details' },
  ]}
  onAccessibilityAction={(event) => {
    switch (event.nativeEvent.actionName) {
      case 'approve':
        handleApprove();
        break;
      case 'reject':
        handleReject();
        break;
      case 'details':
        handleDetails();
        break;
    }
  }}
>
  {/* Card content */}
</Animated.View>
```

### Reduced Motion

```typescript
const [reduceMotion, setReduceMotion] = useState(false);

useEffect(() => {
  AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
}, []);

// Disable swipe animations if reduce motion enabled
const animationConfig = reduceMotion
  ? { duration: 0 } // Instant
  : { duration: 300, easing: Easing.bezier(0, 0, 0.2, 1) };
```

### Touch Target Size

```typescript
// All interactive elements ≥ 44pt
const styles = StyleSheet.create({
  card: {
    minWidth: 320,
    minHeight: 400,
    // Ensures swipeable area is large enough
  },
  detailsButton: {
    minWidth: 44,
    minHeight: 44,
    // Meets iOS HIG minimum
  },
});
```

---

## Testing Checklist

### Unit Tests

- [ ] ReviewCard renders all review types correctly
- [ ] Swipe gesture triggers callbacks at correct threshold
- [ ] Stack animation updates z-index and scale properly
- [ ] Details modal opens/closes with correct animation

### Integration Tests

- [ ] Queue fetches from backend and displays reviews
- [ ] Approve action updates backend and advances card
- [ ] Reject action shows correction options
- [ ] Skip action preserves review in queue

### Performance Tests

- [ ] Swipe animation maintains 60fps
- [ ] Card stack with 10+ reviews doesn't lag
- [ ] Details modal scroll is smooth
- [ ] Memory usage stays under 100MB

### Accessibility Tests

- [ ] VoiceOver announces card content correctly
- [ ] Custom actions (approve/reject) work with VoiceOver
- [ ] Reduced motion disables swipe animations
- [ ] Touch targets meet 44pt minimum

---

## File Structure

```
apps/native/components/review/
├── ReviewCard.tsx               ← Main swipeable card (actions)
├── ReviewCardStack.tsx          ← 3-card stack manager
├── SwipeIndicators.tsx          ← Left/right glow indicators
├── ReviewDetailsModal.tsx       ← Expandable detail view
├── ReviewQueue.tsx              ← List view component
├── ReviewQueueItem.tsx          ← Preview card in list
├── FilterPills.tsx              ← Filter selector
├── PriorityBadge.tsx            ← Priority indicator
│
├── code/                        ← NEW: Code review components
│   ├── CodeReviewCard.tsx       ← PR/diff review card
│   ├── FileCard.tsx             ← Individual file swipeable card
│   ├── FileCardStack.tsx        ← File stack (like ReviewCardStack)
│   ├── HunkViewer.tsx           ← Expandable hunk diff viewer
│   ├── DiffRenderer.tsx         ← Syntax-highlighted diff
│   ├── DiffLine.tsx             ← Single line (add/delete/context)
│   ├── BugBadge.tsx             ← Bug indicator (red/yellow/blue)
│   ├── BugDetailModal.tsx       ← Bug explanation + fix
│   ├── CodeChatModal.tsx        ← Ask ALFRED about code
│   ├── PROverview.tsx           ← PR summary card
│   ├── QualityScore.tsx         ← Overall PR quality metrics
│   └── MovedFileCard.tsx        ← Simplified move/rename view
│
└── hooks/
    ├── useReviewGesture.ts      ← Swipe gesture logic
    ├── useReviewQueue.ts        ← tRPC query hook
    ├── useReviewAnimation.ts    ← Animation values
    ├── useCodeDiff.ts           ← NEW: Parse and organize diffs
    ├── useBugDetection.ts       ← NEW: AI bug analysis
    └── useGitHubPR.ts           ← NEW: GitHub API integration

apps/native/app/(drawer)/(tabs)/
└── reviews.tsx                  ← Main screen (handles both types)

packages/api/src/routers/
├── review.ts                    ← Backend router (actions)
└── code-review.ts               ← NEW: Code review router

packages/db/src/schema/
└── review.ts                    ← Database schema (both types)

packages/code-analysis/          ← NEW: Code analysis package
├── src/
│   ├── diff/
│   │   ├── parse.ts             ← Parse git diff format
│   │   ├── organize.ts          ← AI-powered grouping
│   │   └── detect-moves.ts      ← Move/rename detection
│   ├── bugs/
│   │   ├── static.ts            ← AST-based analysis
│   │   ├── types.ts             ← TypeScript type checking
│   │   ├── llm.ts               ← LLM-based detection
│   │   └── patterns.ts          ← Historical pattern matching
│   └── quality/
│       ├── metrics.ts           ← Code quality score
│       └── coverage.ts          ← Test coverage analysis
└── test/
    └── bug-detection.test.ts
```

---

## Next Steps

1. **Create backend router** (`packages/api/src/routers/review.ts`)
2. **Add database schema** (`packages/db/src/schema/review.ts`)
3. **Build foundation components** (VoidContainer, HUDSurface from Phase 1)
4. **Implement ReviewCard** with swipe gesture
5. **Build ReviewCardStack** with 3-card layout
6. **Create ReviewQueue** screen
7. **Wire to backend** (tRPC queries/mutations)
8. **Add learning integration** (approve→boost, reject→correct)
9. **Test on device** (iOS + Android)
10. **Iterate based on user feedback**

---

_Component Spec v1.0 — Ready for Implementation_
