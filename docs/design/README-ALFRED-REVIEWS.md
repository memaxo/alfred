# ALFRED Reviews: Documentation Index

**Complete design documentation for ALFRED's unified review system**

---

## Quick Links

| Document                                                                                           | Purpose                                      | Read This If...                   |
| -------------------------------------------------------------------------------------------------- | -------------------------------------------- | --------------------------------- |
| **[alfred-reviews-complete.md](./alfred-reviews-complete.md)**                                     | 🎯 **START HERE** — Complete system overview | You want the big picture          |
| **[alfred-reviews-proposal.md](./alfred-reviews-proposal.md)**                                     | Original proposal with action reviews        | You want design rationale         |
| **[alfred-reviews-code-spec.md](./alfred-reviews-code-spec.md)**                                   | Devin-style code review features             | You're implementing code review   |
| **[alfred-reviews-component-spec.md](./alfred-reviews-component-spec.md)**                         | Component architecture + props               | You're building UI components     |
| **[alfred-reviews-mockups.md](./alfred-reviews-mockups.md)**                                       | Visual mockups (action reviews)              | You want to see UX flows          |
| **[alfred-reviews-code-mockups.md](./alfred-reviews-code-mockups.md)**                             | Visual mockups (code reviews)                | You want to see code review UX    |
| **[alfred-reviews-integration.md](./alfred-reviews-integration.md)**                               | Backend integration + learning               | You're wiring to cognitive system |
| **[../execplans/alfred-reviews-implementation.md](../execplans/alfred-reviews-implementation.md)** | Step-by-step implementation plan             | You're ready to build             |

---

## System Overview

### What ALFRED Reviews Does

**In One Sentence**: Swipe-based mobile interface to validate AI actions (tool calls, memories, messages) and code changes (PRs, diffs), creating a learning loop that improves both AI alignment and code quality.

### Two Review Types

**1. Action Reviews** (Original)

```
🛠️ Tool Executions   → Did ALFRED execute correctly?
🧠 Memory Associations → Did ALFRED learn the right thing?
💬 Message Quality    → Was the response helpful?
🔄 Workflow Decisions → Was the escalation appropriate?

Swipe Right = Approve → Boost confidence
Swipe Left  = Reject  → Record mistake, learn
```

**2. Code Reviews** (NEW — Devin-Inspired)

```
💻 GitHub PRs        → Agent or human code changes
💻 Local Diffs       → Pre-commit review
💻 Agent Output      → Codex/OpenCode/Droid results

Features:
  • AI bug detection (4 layers: static, types, LLM, patterns)
  • Intelligent diff organization (logical groups, not alphabetical)
  • Move/rename detection (simplified view)
  • Inline code chat (Ask ALFRED)
  • Quality scoring (type safety, coverage, security)

Swipe Right = Approve File
Swipe Left  = Request Changes
Tap         = View Hunks
Tap Bug     = See Fix Suggestion
```

---

## Key Innovations

### 1. Mobile-First Code Review

**First mobile app** to support full PR review with:

- Swipe through files (not endless scrolling)
- Touch-optimized bug markers
- Inline code chat
- One-handed operation

**Comparison**:

- GitHub Mobile: Read-only, can't review
- Devin Review: Desktop-only
- ALFRED: Full review on phone

### 2. Unified Review Queue

**One queue** for all validation needs:

```
Priority Queue:
  1. 💻 PR with critical bugs
  2. 💻 PR with warnings
  3. 🧠 High-confidence memory
  4. 🛠️ Tool execution
  5. 💬 Message style
```

**Why**: User reviews in priority order, most important first

### 3. Cross-Domain Learning

**Code reviews improve AI actions**:

```
Code Review → Learn null check pattern → Apply to tool execution
Code Review → Learn error handling style → Apply to agent code
Code Review → Learn team conventions → Apply to future PRs
```

**Action reviews improve code quality**:

```
Memory review → Learn user preferences → Codex generates preferred style
Tool review → Learn what user cares about → Focus code review on those areas
Message review → Learn verbosity → Adjust PR description length
```

### 4. Progressive Auto-Approve

**Week 1**: Review everything (100% manual)

```
Tool executions: 15 reviews
Code files: 18 reviews
Total: 33 reviews
```

**Week 2**: Patterns emerge (80% manual)

```
Tool executions: 12 reviews (3 auto-approved)
Code files: 14 reviews (4 auto-approved)
Total: 26 reviews
```

**Week 4**: Confidence established (60% manual)

```
Tool executions: 6 reviews (9 auto-approved)
Code files: 8 reviews (10 auto-approved)
Total: 14 reviews
```

**Result**: Less work for user, more trust in ALFRED

---

## Technical Architecture

### Components (29 Total)

**Action Review (14)**:

1. ReviewCard
2. ReviewCardStack
3. SwipeIndicators
4. ReviewDetailsModal
5. ReviewQueue
6. ReviewQueueItem
7. FilterPills
8. PriorityBadge
9. Toast
10. ProgressBar
11. AnalyticsDashboard
12. BatchReviewModal
13. PatternSuggestionModal
14. EmptyState

**Code Review (15)** — NEW:

1. PROverviewCard
2. FileCard
3. FileCardStack
4. HunkViewer
5. DiffRenderer
6. DiffLine
7. BugBadge
8. BugDetailModal
9. CodeChatModal
10. QualityScoreCard
11. MovedFileCard
12. InlineComment
13. FileGroupCard
14. CoverageWarning
15. SecurityAlert

### Backend (3 Routers)

**1. Review Router** (`packages/api/src/routers/review.ts`)

```typescript
review.queue(); // List pending reviews
review.submit(); // Approve/reject
review.details(); // Full context
review.analytics(); // Stats
```

**2. Code Review Router** (`packages/api/src/routers/code-review.ts`) — NEW

```typescript
codeReview.analyze(); // Parse PR/diff, detect bugs
codeReview.getDiff(); // Organized diff for mobile
codeReview.submitToGitHub(); // Post review to GitHub
codeReview.explainChange(); // AI explains code
codeReview.suggestFix(); // AI suggests bug fix
codeReview.autoFix(); // AI applies fix
```

**3. GitHub Router** (`packages/api/src/routers/github.ts`) — NEW

```typescript
github.webhook(); // Listen for PR events
github.linkRepo(); // Connect GitHub account
github.listPRs(); // Show user's PRs
```

### New Package: Code Analysis

**Location**: `packages/code-analysis/`

**Exports**:

```typescript
// Diff parsing
export function parseDiff(diff: string): ParsedDiff;
export function organizeFiles(files: FileDiff[]): DiffGroup[];
export function detectMoves(files: FileDiff[]): MovedFile[];

// Bug detection (4 layers)
export function staticAnalysis(code: string): Bug[];
export function typeCheck(files: string[]): Bug[];
export function llmAnalysis(hunk: Hunk): Promise<Bug[]>;
export function historicalPatterns(files: FileDiff[]): Bug[];

// Quality metrics
export function calculateQuality(diff: ParsedDiff): QualityScore;
export function checkCoverage(diff: ParsedDiff): CoverageReport;
export function scanSecurity(diff: ParsedDiff): SecurityIssue[];
```

---

## Implementation Timeline

### Week 1: Action Review Backend

- Database schema
- Review router
- Learning integration
- Tests

### Week 2: Action Review Mobile

- ReviewCard component
- Swipe gestures
- Queue screen
- Analytics

### Week 3: Action Review Polish

- Animations
- Accessibility
- Performance
- Beta testing

### Week 4: Code Review Backend

- Code analysis package
- Bug detection (4 layers)
- Code review router
- GitHub integration

### Week 5: Code Review Mobile

- File card components
- Hunk viewer
- Diff renderer
- Bug modals

### Week 6: Advanced Features

- Code chat (Ask ALFRED)
- Auto-fix
- Multi-file bugs
- Coverage analysis

### Week 7: Integration & Launch

- Unified queue
- Cross-domain learning
- Performance tuning
- Public beta

---

## Getting Started (For Implementers)

### 1. Read Documents in Order

```
1. alfred-reviews-complete.md       (30 min)  ← Big picture
2. alfred-reviews-proposal.md        (20 min)  ← Design rationale
3. alfred-reviews-code-spec.md       (30 min)  ← Code review features
4. alfred-reviews-component-spec.md  (20 min)  ← Component architecture
5. alfred-reviews-mockups.md         (15 min)  ← Visual flows
6. alfred-reviews-code-mockups.md    (15 min)  ← Code review UX
7. ../execplans/...implementation.md (45 min)  ← Step-by-step plan

Total: ~3 hours reading
```

### 2. Set Up Environment

```bash
cd /Users/jackmazac/Development/alfred

# Install dependencies
cd apps/native
bun add react-native-gesture-handler
bun add react-native-reanimated
bun add react-native-syntax-highlighter
bun add parse-diff  # For diff parsing
bun add @octokit/rest  # GitHub API

cd ../../packages
mkdir code-analysis
cd code-analysis
bun init
bun add parse-diff @typescript/vfs typescript
```

### 3. Run Implementation Plan

```bash
# Follow ExecPlan step-by-step
cat docs/execplans/alfred-reviews-implementation.md

# Start with Milestone 1 (Backend)
cd packages/db
# Create migration...
```

### 4. Test as You Go

```bash
# After each milestone
bun test packages/api/src/routers/review.test.ts
bun run ios  # Visual verification

# After completion
bun test --coverage
```

---

## FAQ

### Q: Why swipe instead of buttons?

**A**: Speed and engagement. Swipe is:

- **Faster**: 10+ reviews in 1 minute
- **One-handed**: Can review while walking
- **Familiar**: Everyone knows Tinder UX
- **Low friction**: No precise tapping required

### Q: Why mobile-first for code review?

**A**: Desktop code review already works (GitHub, Devin). Mobile is underserved:

- Can't review PRs on commute
- Can't catch bugs during downtime
- ALFRED users are mobile-heavy (voice, Drive Mode)

### Q: How is this different from Devin Review?

**A**:

- **Devin**: Code review only, desktop-only, one-way (human → code)
- **ALFRED**: Code + actions, mobile-first, two-way (human ↔ AI)

### Q: Won't reviewing get tedious?

**A**: No, because:

- Auto-approve after 5 approvals (patterns learned)
- Batch review similar items (approve all at once)
- Skip low-priority (focus on critical)
- Expires after 7 days (doesn't accumulate forever)

### Q: How does ALFRED detect bugs?

**A**: Four layers:

1. **Static analysis**: AST parsing, pattern matching (fast, 80% recall)
2. **Type checking**: TypeScript compiler (100% precision for type errors)
3. **LLM analysis**: Contextual bug finding (catches subtle issues)
4. **Historical patterns**: Learn from past bugs (project-specific)

Combined precision: >80%, recall: >70%

### Q: Can ALFRED auto-fix bugs?

**A**: Yes, for high-confidence fixes:

- Null checks: user?.property
- Missing awaits: await asyncFunc()
- Type casts: value as Type

User must approve auto-fix suggestion first.

---

## Version History

| Version | Date       | Changes                                    |
| ------- | ---------- | ------------------------------------------ |
| 1.0     | 2026-01-23 | Initial proposal (action reviews only)     |
| 2.0     | 2026-01-23 | Added Devin-style code review capabilities |

---

_Documentation Index v2.0_  
_Last Updated: January 23, 2026_
