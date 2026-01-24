# ALFRED Reviews: Swipe-Based AI Action Validation

**Proposal Version**: 1.0  
**Date**: January 23, 2026  
**Status**: Design Proposal  
**Focus**: Mobile-First (Native iOS/Android)

---

## Executive Summary

**The Problem**: Like Devin's "code review bottleneck," ALFRED faces a **trust verification bottleneck**. Users want AI assistance but need confidence that actions are correct, helpful, and aligned with their preferences. Currently, ALFRED learns passively from usage patterns, but lacks explicit, low-friction validation mechanisms.

**The Solution**: **ALFRED Reviews** — A mobile-native, swipe-based review system where users validate AI outputs (messages, tool calls, workflow steps, memory updates) through Tinder-like cards. Swipe right = approve/boost, swipe left = reject/correct, tap = details/context.

**Key Insight**: While Devin reviews _code changes_ (PRs), ALFRED reviews **AI actions and outputs** — tool executions, message quality, memory associations, workflow decisions. This creates a continuous feedback loop that directly improves ALFRED's cognitive model and learning systems.

---

## Comparison: Devin Review vs ALFRED Reviews

| Dimension              | Devin Review                     | ALFRED Reviews                             |
| ---------------------- | -------------------------------- | ------------------------------------------ |
| **What's Reviewed**    | GitHub PR code diffs             | AI actions/outputs + code changes          |
| **Primary Interface**  | Desktop web (GitHub)             | Mobile native (swipe cards)                |
| **Review Granularity** | File hunks + inline chat         | Files/hunks + individual actions           |
| **Feedback Mechanism** | Comment, copy/paste, dismiss     | Swipe right/left, tap for context          |
| **AI Role**            | Bug detection, organization, Q&A | Bug detection + self-correction + learning |
| **Output**             | Reviewed PR (merge/reject)       | Reviewed code + boosted cognitive state    |
| **User Goal**          | Prevent bugs in production       | Prevent bugs + build trust + improve AI    |
| **Code Organization**  | ✓ Intelligent diff grouping      | ✓ Same + mobile-optimized                  |
| **Bug Detection**      | ✓ Red/yellow/gray flags          | ✓ Same + severity-based priority           |
| **Move Detection**     | ✓ Detect copy/move               | ✓ Same + show as "moved" not "deleted"     |
| **Inline Chat**        | ✓ Ask Devin about code           | ✓ Ask ALFRED about code + context          |
| **Mobile Optimized**   | ✗ Desktop-only                   | ✓ Swipe through files/hunks                |

---

## What Gets Reviewed

### 1. **Code Changes** (Critical Priority) — NEW: Devin-Style PR Review

**Reviewable Artifacts**:

- GitHub PRs (agent-authored or human-authored)
- Local git diffs (uncommitted changes)
- Workflow artifacts (generated code)
- Agent code edits (Codex, OpenCode, Droid outputs)

**Review Card Shows**:

```
┌─────────────────────────────────────┐
│  Code Change Review                 │
├─────────────────────────────────────┤
│                                     │
│  src/auth/middleware.ts             │
│  ═══════════════════════             │
│                                     │
│  ⚠️  Potential Bug Detected         │
│                                     │
│  Line 42: Missing null check        │
│  before user.profile access         │
│                                     │
│  - if (user.profile.email) {        │
│  + if (user?.profile?.email) {      │
│                                     │
│  Severity: Medium                   │
│  Confidence: 0.85                   │
│                                     │
│  📍 Part of PR #234                 │
│  "Add biometric auth"               │
│                                     │
│  ← Needs Work  |  Looks Good → │
│                                     │
│  [Tap for full diff & AI analysis]  │
└─────────────────────────────────────┘
```

**Why This Matters**:

- Catches bugs before merge (like Devin Review)
- Works on agent-generated code AND human code
- Mobile-native code review (swipe through files)
- AI explains changes in plain language

**Learning Signal**:

- ✓ Approve → AI bug detector calibration improves
- ✗ Reject + comment → AI learns code patterns/standards
- Details → Ask questions about the code (inline chat)

### 2. **Tool Executions** (High Priority)

**Reviewable Actions**:

- Note created/updated
- Reminder set
- Timer started
- Bookmark saved
- Memory node created
- Knowledge graph relation added
- Home automation command
- Web search performed

**Review Card Shows**:

```
┌─────────────────────────────────────┐
│  Tool Execution Review              │
├─────────────────────────────────────┤
│                                     │
│  Created Note                       │
│  ════════════                       │
│                                     │
│  Title: "Q1 Planning Meeting"      │
│  Content: "Discuss budget..."      │
│                                     │
│  📍 Triggered by:                   │
│  "Take a note about the meeting"   │
│                                     │
│  ← Swipe to Reject  |  Approve → │
│                                     │
│  [Tap for full details]             │
└─────────────────────────────────────┘
```

**Why This Matters**:

- User confirms ALFRED understood intent correctly
- Validates tool parameters (correct time, right note content)
- Builds confidence in autonomous actions

**Learning Signal**:

- ✓ Approve → Boost tool selection confidence, store intent→action pattern
- ✗ Reject → Mark as mistake, learn what went wrong
- Details + Edit → Infer preferences (tone, format, verbosity)

### 2. **Message Quality** (Medium Priority)

**Reviewable Outputs**:

- Assistant responses (text quality)
- Reasoning explanations
- Voice transcriptions
- GenUI component selections

**Review Card Shows**:

```
┌─────────────────────────────────────┐
│  Response Quality Review            │
├─────────────────────────────────────┤
│                                     │
│  You: "How are my tests?"           │
│                                     │
│  Alfred: "Your test suite has a    │
│  94% pass rate this week, up 2%    │
│  from last week. Top 3 failures:   │
│  auth.test.ts, api.test.ts..."     │
│                                     │
│  Rate this response:                │
│  Too Brief  ←  Perfect  →  Too Long │
│                                     │
│  [Suggest alternate phrasing]       │
└─────────────────────────────────────┘
```

**Why This Matters**:

- Learns user's preferred verbosity/tone
- Validates reasoning quality
- Catches hallucinations or outdated info

**Learning Signal**:

- ✓ Approve → Reinforce response style, boost reasoning patterns
- ✗ Reject + "too verbose" → Update `preference.verbosity` lower
- Edit suggestion → Learn from correction (inferFromCorrection)

### 3. **Memory & Knowledge** (High Priority)

**Reviewable Artifacts**:

- Fact extraction ("User prefers morning meetings")
- Knowledge graph relations ("Project X uses TypeScript")
- Domain classifications ("This is a backend task")
- Preference inferences ("User likes concise summaries")

**Review Card Shows**:

```
┌─────────────────────────────────────┐
│  Memory Association Review          │
├─────────────────────────────────────┤
│                                     │
│  Learned Preference                 │
│  ══════════════════                 │
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
│  ← Swipe to Reject  |  Confirm → │
└─────────────────────────────────────┘
```

**Why This Matters**:

- Prevents ALFRED from "learning" wrong patterns
- User corrects misclassifications early
- Builds explicit preference model

**Learning Signal**:

- ✓ Approve → Boost confidence to 1.0 (memory_boost)
- ✗ Reject → Delete or downgrade confidence
- Edit → Replace with corrected fact

### 4. **Workflow Decisions** (Medium Priority)

**Reviewable Checkpoints**:

- Agent selected for task
- Escalation decisions
- Tool chain sequences
- Resume/suspend choices

**Review Card Shows**:

```
┌─────────────────────────────────────┐
│  Workflow Decision Review           │
├─────────────────────────────────────┤
│                                     │
│  Escalation Decision                │
│  ══════════════════                 │
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
│  ← Wrong Call  |  Good Call → │
└─────────────────────────────────────┘
```

**Why This Matters**:

- Validates autonomy gradient decisions
- User confirms trust calibration
- Improves escalation heuristics

**Learning Signal**:

- ✓ Approve → Reinforce escalation pattern
- ✗ Reject → Adjust autonomy threshold
- "Should have stayed" → Learn complexity bounds

---

## Code Review: Devin-Style Features for ALFRED

### Intelligent Diff Organization

**Problem**: GitHub shows diffs alphabetically, not logically.

**ALFRED Solution**: AI analyzes code changes and organizes by:

1. **Logical grouping** — Related changes together (e.g., all auth changes)
2. **Dependency order** — Base classes before derived, types before implementations
3. **Impact order** — Breaking changes first, refactors last

**Mobile UX**:

```
┌─────────────────────────────────────┐
│  PR #234: Add Biometric Auth        │
├─────────────────────────────────────┤
│  6 files changed                    │
│  ● ● ○ ○ ○ ○  (Progress)           │
│                                     │
│  ┌─────────────────────────────────┐│
│  │ Group 1: Core Auth Logic        ││
│  │ ─────────────────────            ││
│  │                                 ││
│  │ • src/auth/middleware.ts        ││
│  │ • src/auth/biometric.ts  [NEW]  ││
│  └─────────────────────────────────┘│
│                                     │
│  Swipe → to review next file        │
└─────────────────────────────────────┘
```

### AI Bug Detection

**Inspired by Devin**: Red/yellow/gray severity flags

**ALFRED Implementation**:

```
Red (Probable Bug):
  • Null pointer risks
  • Type mismatches
  • Missing error handling
  • Security vulnerabilities

Yellow (Warning):
  • Code smells
  • Performance issues
  • Inconsistent patterns
  • Missing tests

Gray (FYI):
  • Style suggestions
  • Optimization opportunities
  • Documentation gaps
```

**Mobile Card with Bug**:

```
┌─────────────────────────────────────┐
│  src/auth/middleware.ts             │
├─────────────────────────────────────┤
│  🔴 Probable Bug                    │
│                                     │
│  Line 42: Null pointer risk         │
│                                     │
│   41 | const user = await getUser();│
│   42 | if (user.profile.email) {   │ ← Red underline
│   43 |   sendEmail(user.profile... │
│                                     │
│  Fix suggestion:                    │
│  + if (user?.profile?.email) {      │
│                                     │
│  Severity: High                     │
│  Confidence: 0.91                   │
│                                     │
│  ← Fix This  |  Looks Fine →       │
└─────────────────────────────────────┘
```

### Move/Rename Detection

**Problem**: GitHub shows moves as delete + add (noisy)

**ALFRED Solution**: Detect file moves and show as:

```
┌─────────────────────────────────────┐
│  File Moved                         │
├─────────────────────────────────────┤
│  src/utils/auth.ts                  │
│              ↓                      │
│  src/auth/utils.ts                  │
│                                     │
│  No changes to content              │
│                                     │
│  ← Skip  |  Acknowledge →          │
└─────────────────────────────────────┘
```

### Interactive Code Chat

**Inspired by Devin**: "Ask Devin" inline chat

**ALFRED Implementation**: Tap "Why?" on any hunk

```
┌─────────────────────────────────────┐
│  Line 42-45 Changed                 │
├─────────────────────────────────────┤
│  - const token = generateToken();   │
│  + const token = await genToken();  │
│                                     │
│  [Why was this changed?]            │
└─────────────────────────────────────┘
           ↓ Tap
┌─────────────────────────────────────┐
│  ALFRED Explains                    │
├─────────────────────────────────────┤
│  This change makes token generation │
│  asynchronous. The old version was  │
│  synchronous, which blocked the     │
│  main thread for ~50ms.             │
│                                     │
│  The new async version:             │
│  • Uses crypto.subtle (Web Crypto)  │
│  • Doesn't block UI                 │
│  • Returns a Promise                │
│                                     │
│  Related files also updated:        │
│  • middleware.ts (await token)      │
│  • session.ts (await token)         │
│                                     │
│  [Ask follow-up question...]        │
└─────────────────────────────────────┘
```

### Hunk-by-Hunk Review

**Mobile-optimized**: Swipe through hunks instead of scrolling long diffs

```
File 1 (auth/middleware.ts)
  ├─ Hunk 1: Imports (lines 1-5)
  ├─ Hunk 2: Type definitions (lines 20-35)
  ├─ Hunk 3: Main logic (lines 42-78) ← YOU ARE HERE
  └─ Hunk 4: Exports (lines 90-95)

Swipe → to see next hunk
Swipe ↑ to approve entire file
Tap to see full file context
```

**Hunk Card**:

```
┌─────────────────────────────────────┐
│  middleware.ts • Lines 42-78        │
├─────────────────────────────────────┤
│  Main Logic                         │
│                                     │
│  @@ -42,8 +42,12 @@                 │
│                                     │
│   export async function auth() {    │
│ -   const token = req.headers.auth; │
│ +   const token = req.headers       │
│ +     .authorization?.split(' ')[1];│
│ +                                   │
│ +   if (!token) {                   │
│ +     throw new AuthError();        │
│ +   }                               │
│                                     │
│  🟡 Consider: Add token validation  │
│                                     │
│  Hunk 3 of 4                        │
│  ← Previous  |  Next →             │
└─────────────────────────────────────┘
```

---

## Code Review Features (Devin-Inspired)

### Feature 1: Intelligent Diff Organization

**Devin Approach**: Group logically related changes, order intelligently

**ALFRED Implementation**:

```typescript
// AI-powered diff analysis
interface DiffOrganization {
  groups: DiffGroup[];
  totalFiles: number;
  totalHunks: number;
}

interface DiffGroup {
  name: string; // "Core Auth Logic", "Type Definitions"
  description: string; // AI-generated summary
  files: FileDiff[];
  priority: "breaking" | "feature" | "refactor" | "style";
}

interface FileDiff {
  path: string;
  status: "added" | "modified" | "deleted" | "moved" | "renamed";
  movedFrom?: string; // For moves/renames
  hunks: Hunk[];
  aiSummary: string; // AI explains what changed in this file
  bugs: Bug[]; // AI-detected issues
}

interface Bug {
  line: number;
  severity: "critical" | "warning" | "info";
  message: string;
  suggestion?: string;
  confidence: number;
}
```

**Mobile Navigation**:

```
PR Overview
  ↓
Group 1: Breaking Changes (2 files)
  ├─ File 1: auth/types.ts
  │   ├─ Hunk 1: Interface change
  │   └─ Hunk 2: Export update
  ├─ File 2: auth/middleware.ts
  │   └─ Hunk 1: Type usage update
  ↓ Swipe →
Group 2: New Features (3 files)
  ├─ File 3: auth/biometric.ts [NEW]
  │   └─ Hunk 1: Full file
  ...
```

### Feature 2: Bug Detection with Severity

**Devin Levels**: Red (bugs) / Yellow (warnings) / Gray (FYI)

**ALFRED Levels**:

```
🔴 Critical (Red):
  • Null pointer exceptions
  • Type safety violations
  • Security vulnerabilities
  • Race conditions
  • Memory leaks

🟡 Warning (Yellow):
  • Code smells
  • Performance issues
  • Inconsistent patterns
  • Missing edge cases
  • Incomplete error handling

🔵 Info (Blue):
  • Style suggestions
  • Optimization opportunities
  • Documentation improvements
  • Test coverage gaps
```

**Bug Card**:

```
┌─────────────────────────────────────┐
│  🔴 Critical Bug Detected           │
├─────────────────────────────────────┤
│                                     │
│  File: auth/session.ts              │
│  Line: 67                           │
│                                     │
│  Issue:                             │
│  Race condition in token refresh    │
│                                     │
│  Code:                              │
│  65 | async function refresh() {    │
│  66 |   const old = getToken();     │
│  67 |   const new = await gen();    │ ← Bug
│  68 |   setToken(new);              │
│  69 | }                             │
│                                     │
│  Problem:                           │
│  If refresh() called twice before   │
│  line 68 executes, both calls will │
│  generate new tokens, but only the  │
│  last one persists. First token is  │
│  lost, potentially invalidating     │
│  in-flight requests.                │
│                                     │
│  Suggested Fix:                     │
│  + Add mutex lock around refresh    │
│  + Or use singleton pattern         │
│                                     │
│  Confidence: 0.94                   │
│                                     │
│  [Ask ALFRED about this]            │
│  [Copy fix to clipboard]            │
│  [Dismiss (not a bug)]              │
│                                     │
│  ← Request Changes | Approve →     │
└─────────────────────────────────────┘
```

### Feature 3: Move/Rename Simplification

**Mobile UX**:

```
┌─────────────────────────────────────┐
│  File Operation                     │
├─────────────────────────────────────┤
│                                     │
│  📦 Moved                           │
│                                     │
│  src/utils/auth.ts                  │
│         ↓                           │
│  src/auth/utils.ts                  │
│                                     │
│  ✓ Content unchanged                │
│  ✓ No bugs detected                 │
│                                     │
│  Reason:                            │
│  Better organization — auth utils   │
│  should be in auth/ folder          │
│                                     │
│  ← Skip  |  Acknowledge →          │
└─────────────────────────────────────┘
```

### Feature 4: Inline Code Chat

**Tap "Why?" or "Ask ALFRED"**:

```
┌─────────────────────────────────────┐
│  Code Question                      │
├─────────────────────────────────────┤
│                                     │
│  You:                               │
│  "Why did the agent change this     │
│   from sync to async?"              │
│                                     │
│  ALFRED:                            │
│  The agent detected that            │
│  generateToken() was blocking the   │
│  event loop. Browser profiling      │
│  showed 50ms freeze on each call.   │
│                                     │
│  The async version uses Web Crypto  │
│  API which runs off the main thread.│
│                                     │
│  Related commits:                   │
│  • abc123: Added crypto polyfill    │
│  • def456: Updated all callers      │
│                                     │
│  [Ask another question...]          │
└─────────────────────────────────────┘
```

---

## User Experience: Mobile Swipe Interface

### Navigation Flow

```
┌─────────────────────────────────────┐
│  Tab Bar                            │
│  [Chat] [Library] [Voice] [Reviews] │ ← New tab
└─────────────────────────────────────┘
           ↓ Tap Reviews
┌─────────────────────────────────────┐
│  Reviews Queue                      │
├─────────────────────────────────────┤
│  🔔 3 pending reviews               │
│                                     │
│  Filter: [All] [Tools] [Messages]  │
│          [Memories] [Workflows]     │
│                                     │
│  Sort: [Newest] [Priority]          │
│                                     │
│  ┌───────────────────────────────┐  │
│  │  Tool Execution               │  │
│  │  Created note • 2m ago        │  │
│  │  Priority: Medium             │  │
│  └───────────────────────────────┘  │
│                                     │
│  ┌───────────────────────────────┐  │
│  │  Memory Association           │  │
│  │  Learned preference • 10m ago │  │
│  │  Priority: High               │  │
│  └───────────────────────────────┘  │
│                                     │
│  [Start Reviewing]                  │
└─────────────────────────────────────┘
           ↓ Tap review item
┌─────────────────────────────────────┐
│  Review Card (Swipeable)            │
├─────────────────────────────────────┤
│                                     │
│       [Review Details]              │
│                                     │
│     ← Swipe Left = Reject           │
│     → Swipe Right = Approve         │
│     ↑ Swipe Up = Skip               │
│     ↓ Tap = View Details            │
│                                     │
│     Progress: 1 of 3                │
└─────────────────────────────────────┘
```

### Interaction Patterns

**Swipe Right (Approve)**:

- Card flies off screen to the right
- Green checkmark animation
- "Approved" toast (1s)
- Auto-advances to next card
- Backend: `memory_boost()`, `recordApproval()`

**Swipe Left (Reject)**:

- Card flies off screen to the left
- Red X animation
- Shows correction options:
  - "Delete action"
  - "Provide correct version"
  - "Mark as mistake"
- Backend: `memory_remove()`, `recordRejection()`

**Swipe Up (Skip)**:

- Card fades out upward
- "Skipped" (review stays in queue)
- Auto-advances to next

**Tap Card (Details)**:

- Card expands to full-screen modal
- Shows:
  - Full context (conversation history)
  - Related memories
  - Reasoning trace
  - Alternate options
- Actions:
  - Approve/Reject buttons
  - Edit inline
  - Ask ALFRED to explain
  - Delete review

### Visual Design (Void Aesthetic)

```
┌─────────────────────────────────────┐
│                                     │
│          · · · · · ·                │  ← Breathing
│        ·             ·              │     particles
│       ·  ╭─────────╮  ·             │
│      ·  │ REVIEW   │   ·            │
│      ·  │  CARD    │   ·            │
│       ·  ╰─────────╯  ·             │
│        ·             ·              │
│          · · · · · ·                │
│                                     │
│  HUD Surface (glass.surface)        │
│  Bioluminescent text                │
│  Glow on swipe direction            │
│                                     │
│  Swipe Indicators:                  │
│  ← [Red glow]  |  [Green glow] →    │
│                                     │
└─────────────────────────────────────┘
```

**Animation Details**:

- Card entrance: Fade-in-up (250ms)
- Swipe feedback: Glow intensity based on swipe distance
- Approval: Scale 1.05 + green glow pulse
- Rejection: Scale 0.95 + red glow pulse
- Stack effect: Next 2 cards visible behind (z-depth)

---

## Backend Architecture

### Review Queue System

**Location**: `packages/api/src/routers/review.ts` (new)

```typescript
export const reviewRouter = router({
  // Get pending reviews for user
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
      // Fetch from review_queue table
      // Order by priority (high→low), then timestamp (new→old)
    }),

  // Submit review verdict
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
        feedback: z.string().max(500).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Update review status
      // Trigger learning actions based on verdict
      // If approve: memory_boost, recordSuccess
      // If reject: recordMistake, apply correction
    }),

  // Get review details (full context)
  details: authedProcedure
    .input(
      z.object({
        reviewId: z.string().uuid(),
      })
    )
    .query(async ({ ctx, input }) => {
      // Fetch review + context (conversation, related memories, reasoning)
    }),
});
```

### Database Schema

**New Table**: `review_queue`

```sql
CREATE TABLE review_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- What's being reviewed
  review_type VARCHAR(50) NOT NULL, -- 'tool_execution', 'message', 'memory', 'workflow'
  subject_id UUID NOT NULL, -- ID of the thing being reviewed
  subject_data JSONB NOT NULL, -- Snapshot of the action/output

  -- Context
  conversation_id VARCHAR(255),
  message_id VARCHAR(255),
  workflow_run_id UUID,

  -- Priority
  priority VARCHAR(10) NOT NULL DEFAULT 'medium', -- 'low', 'medium', 'high', 'critical'
  auto_approve_eligible BOOLEAN DEFAULT FALSE, -- Can this be auto-approved if confidence high?

  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'pending', -- 'pending', 'approved', 'rejected', 'skipped'
  reviewed_at TIMESTAMPTZ,
  verdict_data JSONB, -- Correction details if rejected

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ, -- Auto-approve after N hours if eligible

  INDEX idx_review_queue_user_status (user_id, status),
  INDEX idx_review_queue_priority (priority, created_at),
  INDEX idx_review_queue_type (review_type)
);
```

### Learning Integration

When a review is submitted, trigger learning updates:

**Approve (Swipe Right)**:

```typescript
async function handleApproval(review: Review) {
  switch (review.review_type) {
    case "tool_execution":
      // Boost tool selection confidence
      await recordToolSuccess(review.subject_data.toolName);
      // Store intent→action pattern in knowledge graph
      await createIntentPattern(review.conversation_id, review.subject_id);
      break;

    case "message":
      // Reinforce response style
      await updatePreference("response.style", review.subject_data.style, {
        confidence: 0.95,
      });
      break;

    case "memory":
      // Boost memory confidence to 1.0
      await memory_boost({ id: review.subject_id, amount: 0.3 });
      break;

    case "workflow":
      // Reinforce escalation decision
      await recordEscalationSuccess(review.subject_data.decision);
      break;
  }
}
```

**Reject (Swipe Left)**:

```typescript
async function handleRejection(review: Review, correction?: Correction) {
  switch (review.review_type) {
    case "tool_execution":
      // Mark as mistake
      await recordToolFailure(review.subject_data.toolName, "user_rejection");
      // If correction provided, learn correct parameters
      if (correction?.type === "replace") {
        await learnToolCorrection(review.subject_id, correction.data);
      }
      break;

    case "message":
      // Learn from correction
      if (correction?.type === "edit") {
        await inferFromCorrection(review.message_id, correction.data);
      }
      break;

    case "memory":
      // Delete or downgrade confidence
      if (correction?.type === "delete") {
        await memory_remove({ id: review.subject_id });
      } else {
        await updateNodeConfidence(review.subject_id, 0.3);
      }
      break;

    case "workflow":
      // Adjust autonomy threshold
      await adjustAutonomyForContext(review.subject_data.taskType, -0.1);
      break;
  }
}
```

---

## Review Prioritization

Not all actions need review. Use intelligent prioritization:

### Auto-Approve (No Review Needed)

Actions auto-approved if:

- ✓ High confidence (>0.95)
- ✓ Low risk (read-only, reversible)
- ✓ User has approved similar actions 5+ times
- ✓ No policy obligations

**Examples**:

- Fetching data (web search, knowledge query)
- Creating notes (user can delete easily)
- Setting reminders (user can cancel)

### Review Required (Queue Immediately)

Actions that always need review:

- ✗ High risk (destructive, irreversible)
- ✗ Low confidence (<0.7)
- ✗ New tool/pattern (never seen before)
- ✗ Policy-gated (requires biometric)

**Examples**:

- Deleting memories
- Sending external messages
- Deploying code
- Escalating workflows

### Priority Levels

**Critical** (Review ASAP):

- Policy violations detected
- Conflicting memories
- High-stakes decisions (deploy, delete)

**High**:

- New preference inferences
- Tool failures/retries
- Workflow escalations

**Medium** (Default):

- Tool executions
- Message quality
- Memory associations

**Low**:

- Skipped reviews (revisit later)
- Low-confidence suggestions

---

## Smart Review Features

### 1. **Batch Review Mode**

For power users who want to process many reviews quickly:

```
┌─────────────────────────────────────┐
│  Batch Review Mode                  │
├─────────────────────────────────────┤
│  Review similar actions together    │
│                                     │
│  ┌─────────────────────────────────┐
│  │ 5 Notes Created Today           │
│  │ [Approve All] [Review Each]     │
│  └─────────────────────────────────┘
│                                     │
│  ┌─────────────────────────────────┐
│  │ 3 Preference Inferences         │
│  │ [Approve All] [Review Each]     │
│  └─────────────────────────────────┘
└─────────────────────────────────────┘
```

**Learning**: If user approves all in batch, increase confidence in future similar actions

### 2. **Contextual Q&A**

Tap "Why?" button to ask ALFRED to explain:

```
┌─────────────────────────────────────┐
│  Review Card                        │
├─────────────────────────────────────┤
│  Created Reminder: "Call Sarah"     │
│  Time: Tomorrow 10am                │
│                                     │
│  [Why?] button                      │
└─────────────────────────────────────┘
           ↓ Tap Why
┌─────────────────────────────────────┐
│  Context Explanation                │
├─────────────────────────────────────┤
│  You: "Remind me to call Sarah"     │
│                                     │
│  I inferred:                        │
│  • "Tomorrow" = next weekday (Mon)  │
│  • Your calendar shows free at 10am │
│  • You typically make calls morning │
│                                     │
│  Confidence: 0.82                   │
│                                     │
│  [Approve] [Reject] [Edit Time]     │
└─────────────────────────────────────┘
```

### 3. **Pattern Recognition**

After 3+ approvals of same pattern, suggest rule:

```
┌─────────────────────────────────────┐
│  Pattern Detected                   │
├─────────────────────────────────────┤
│  You've approved 5 notes about      │
│  "meetings" this week.              │
│                                     │
│  Create auto-approve rule?          │
│                                     │
│  Rule: Always create notes when I   │
│  say "take a note about [meeting]"  │
│                                     │
│  [Yes, Auto-Approve] [No, Keep]    │
└─────────────────────────────────────┘
```

**Learning**: Store rule in preferences, skip future reviews for matching pattern

### 4. **Review Reminders**

Gentle nudges to review pending items:

- Push notification: "3 actions waiting for review" (daily at 6pm)
- In-app badge on Reviews tab
- Weekly summary: "You reviewed 12 actions, approved 10, rejected 2"

### 5. **Review Analytics**

Show user their review patterns:

```
┌─────────────────────────────────────┐
│  Your Review Stats (This Week)      │
├─────────────────────────────────────┤
│  Reviewed: 23 actions               │
│  Approved: 19 (83%)                 │
│  Rejected: 3 (13%)                  │
│  Skipped: 1 (4%)                    │
│                                     │
│  Top Approvals:                     │
│  • Notes: 12/12 ✓                   │
│  • Reminders: 5/6 ✓                 │
│  • Memories: 2/5 ✓                  │
│                                     │
│  Needs Attention:                   │
│  • Memory inferences: 40% rejected  │
│    → ALFRED will ask before learning│
└─────────────────────────────────────┘
```

---

## Web Integration (Future)

While mobile is primary, web can show reviews too:

**Desktop View**:

```
┌────────────────────────────────────────────────┐
│  Reviews (Desktop)                             │
├────────────────────────────────────────────────┤
│  [Pending: 3] [Approved: 12] [Rejected: 2]    │
│                                                │
│  ┌──────────────────────────────────────────┐ │
│  │  Tool Execution                          │ │
│  │  Created Note: "Q1 Planning"             │ │
│  │  2 minutes ago                           │ │
│  │                                          │ │
│  │  [Approve] [Reject] [View Details]      │ │
│  └──────────────────────────────────────────┘ │
│                                                │
│  ┌──────────────────────────────────────────┐ │
│  │  Memory Association                      │ │
│  │  Learned: "Prefers morning meetings"     │ │
│  │  10 minutes ago                          │ │
│  │                                          │ │
│  │  [Approve] [Reject] [View Details]      │ │
│  └──────────────────────────────────────────┘ │
└────────────────────────────────────────────────┘
```

**Keyboard Shortcuts**:

- `→` or `Y` = Approve
- `←` or `N` = Reject
- `↑` or `S` = Skip
- `Enter` = Details
- `Esc` = Close

---

## Privacy & Security

### Data Retention

- Reviews stored for 30 days (configurable)
- Approved actions: metadata only (not full snapshot)
- Rejected actions: keep full data for analysis
- User can purge all review history

### Biometric Protection

High-risk reviews require Touch ID/Face ID:

- Deleting memories
- Approving deployments
- Changing preferences with high impact

### Offline Support

- Queue reviews locally (AsyncStorage)
- Sync when connection restored
- Show "Pending sync" badge

---

## Metrics & Success Criteria

### Product Metrics

**Engagement**:

- % users who review at least 1 action/week: Target >60%
- Average reviews per user/week: Target 10-15
- Time to review (swipe): Target <5 seconds
- Review completion rate: Target >80%

**Learning Quality**:

- % of approved actions later validated: Target >90%
- % of rejected actions that recur: Target <5%
- Preference inference accuracy (after review): Target >85%
- Tool selection confidence delta (before/after review): Target +0.2

**Trust Building**:

- User trust score (survey): Target 8/10
- "ALFRED understands me" sentiment: Target >70% agree
- Autonomy comfort level: Target increase from 0.6→0.8

### Technical Metrics

**Performance**:

- Review queue load time: <200ms
- Swipe gesture latency: <16ms (60fps)
- Card animation smoothness: 58-60fps

**Reliability**:

- Review sync success rate: >99%
- Duplicate review prevention: 100%
- Auto-approve false positive rate: <1%

---

## Implementation Roadmap

### Phase 1: MVP (Weeks 1-3)

**Scope**: Tool execution reviews only, mobile-native

- [ ] Database schema (review_queue table)
- [ ] Review router (queue, submit, details endpoints)
- [ ] Mobile UI components:
  - [ ] ReviewCard (swipeable)
  - [ ] ReviewQueue (list view)
  - [ ] ReviewDetails (modal)
- [ ] Basic prioritization (high/medium/low)
- [ ] Learning integration (approve→boost, reject→record)
- [ ] Push notifications for pending reviews

**Validation**: User can review notes/reminders via swipe, see learning effect

### Phase 2: Memory & Workflows (Weeks 4-5)

**Scope**: Expand to memory associations and workflow decisions

- [ ] Memory review cards
- [ ] Workflow decision reviews
- [ ] Correction flows (edit, replace, delete)
- [ ] Pattern detection (suggest auto-approve rules)
- [ ] Review analytics dashboard

**Validation**: User can validate memories, see reduced manual review load

### Phase 3: Intelligence (Weeks 6-7)

**Scope**: Smart features, web parity

- [ ] Batch review mode
- [ ] Contextual Q&A ("Why?")
- [ ] Auto-approve rules engine
- [ ] Desktop web interface
- [ ] Review reminders (daily/weekly)

**Validation**: Power users process 20+ reviews/week efficiently

### Phase 4: Polish (Week 8)

**Scope**: Animation, onboarding, metrics

- [ ] Advanced animations (physics-based swipe)
- [ ] Onboarding flow ("How Reviews Work")
- [ ] Review stats visualization
- [ ] A/B test swipe thresholds
- [ ] Accessibility audit (VoiceOver)

**Validation**: New users understand reviews, engagement >60%

---

## Open Questions

1. **Review Fatigue**: How do we prevent users from feeling overwhelmed?
   - _Proposal_: Start with high-priority only, gradually expand as trust builds
   - _Metric_: If completion rate drops below 50%, reduce queue size

2. **False Positives**: What if ALFRED flags too many correct actions?
   - _Proposal_: After 5 approvals of same pattern, auto-approve future
   - _Fallback_: User can disable reviews for specific action types

3. **Correction Complexity**: Should we support multi-step corrections?
   - _Proposal_: Start with simple (approve/reject/edit), add complexity later
   - _Example_: V1 = "Reject + provide correct note title", V2 = "Reject + edit full note content + explain why wrong"

4. **Cross-Device Sync**: How do reviews sync between mobile/web?
   - _Proposal_: Real-time via tRPC subscriptions
   - _Edge case_: Same review approved on 2 devices → dedupe by timestamp

5. **Gamification**: Should we add streaks, badges, points?
   - _Proposal_: No for MVP (avoid making reviews feel like a chore)
   - _Future_: "Consistency score" showing how aligned ALFRED is with preferences

---

## Alternative Designs Considered

### 1. **Inline Thumbs Up/Down** (Rejected)

Instead of swipe cards, add thumbs up/down buttons to each message/action.

**Pros**: Familiar (Reddit, YouTube)  
**Cons**: Requires precision taps, less engaging, harder to batch

**Why Rejected**: Swipe is faster, more mobile-native, more engaging

### 2. **Review Chat Bot** (Rejected)

ALFRED asks "Did I do that correctly?" in chat after each action.

**Pros**: Conversational, low UI overhead  
**Cons**: Interrupts flow, verbose, hard to skip

**Why Rejected**: Too intrusive, breaks conversation continuity

### 3. **Weekly Digest Email** (Rejected)

Send email summary of actions, user clicks approve/reject links.

**Pros**: Non-intrusive, batched  
**Cons**: Low engagement, high friction, delayed feedback

**Why Rejected**: Email is too slow for real-time learning

### 4. **Voice-Based Reviews** (Future Enhancement)

ALFRED asks "I created a note about the meeting. Sound good?" during Drive Mode.

**Pros**: Hands-free, voice-native  
**Cons**: Interrupts voice flow, hard to provide corrections

**Decision**: Save for V2, focus on swipe cards for MVP

---

## Conclusion

**ALFRED Reviews** transforms passive AI assistance into an active partnership. By making validation effortless (swipe right/left), users build trust while training ALFRED to better understand their preferences, priorities, and patterns.

**Key Differentiators**:

1. **Mobile-first**: Swipe gestures beat click-heavy desktop interfaces
2. **Action-focused**: Reviews AI decisions, not just code diffs
3. **Learning loop**: Direct feedback improves cognitive model
4. **Trust-building**: Transparency into AI reasoning

**Next Steps**:

1. Build MVP (tool execution reviews, swipe UI)
2. Beta test with 10 users, measure engagement
3. Iterate based on completion rate, trust scores
4. Expand to memories, workflows, messages

**Success Looks Like**:

- Users review 10-15 actions/week
- 80%+ approval rate (ALFRED gets it right)
- Trust score increases from 6/10 → 8/10
- Auto-approve eligibility reaches 40% of actions

ALFRED becomes not just an assistant, but a **verified, trusted partner** in the user's workflow.
