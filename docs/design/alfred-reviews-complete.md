# ALFRED Reviews: Complete System Design

**Unified Review System for AI Actions & Code Changes**  
**Version**: 2.0 (includes Devin-style code review)  
**Date**: January 23, 2026  
**Status**: Design Complete, Ready for Implementation

---

## Vision

**One Unified Review Experience** where users validate both:

1. **AI Actions** (tool executions, memories, messages) — Build trust in ALFRED
2. **Code Changes** (PRs, diffs, agent outputs) — Catch bugs, improve quality

**Mobile-First UX**: Swipe through reviews like Tinder cards—approve right, reject left, tap for details.

**Devin + ALFRED Hybrid**:

- **Devin's strength**: Intelligent code analysis, bug detection, diff organization
- **ALFRED's strength**: Learning from feedback, mobile-native UX, voice integration
- **Combined**: The only review system that improves both code quality AND AI alignment

---

## What Makes This Unique

### 1. Unified Queue (Code + Actions)

**Other Tools**:

- Devin Review: Code only
- Cursor Composer: Code only
- ChatGPT: No review system
- GitHub: Code only, no AI assistance

**ALFRED Reviews**:

```
Single Queue:
├─ 💻 PR #234 (3 critical bugs)         ← Code
├─ 💻 Local changes (1 warning)         ← Code
├─ 🧠 Learned preference (validate)     ← Action
├─ 🛠️ Created note (approve tool use)   ← Action
└─ 💬 Message style (feedback)          ← Action
```

**Why This Matters**: Users review everything in one flow, ALFRED learns from all feedback

### 2. Mobile-Native (Swipe, Not Click)

**Desktop Tools** (GitHub, Devin):

- Click approve/reject buttons
- Type comments
- Scroll long diffs
- Mouse-heavy interactions

**ALFRED Mobile**:

- Swipe right/left (fast, one-handed)
- Tap for details (no typing required)
- Cards, not infinite scroll
- Touch-optimized (44pt+ targets)

**Speed Comparison**:

```
Desktop: 2-3 minutes per PR (scrolling, clicking, typing)
Mobile:  30-60 seconds per PR (swipe, tap, done)
```

### 3. AI Self-Improvement Loop

**Traditional Code Review**:

```
Human reviews code → Finds bugs → Comments → Dev fixes
(One-directional: human helps code)
```

**ALFRED Reviews**:

```
User reviews AI actions → Approves/rejects → ALFRED learns → Improves
     ↓
User reviews code → AI finds bugs → User confirms → AI learns patterns
     ↓
Next review: Better bug detection, higher confidence, fewer false positives
(Bidirectional: human helps AI, AI helps human, both improve)
```

### 4. Cross-Domain Learning

**Unique to ALFRED**: Code review feedback improves AI action confidence

**Example**:

```
Week 1: User reviews PR with auth code
  → Approves null check patterns
  → Rejects missing error handling

Week 2: ALFRED creates note via tool
  → Uses learned null check pattern
  → Adds error handling automatically
  → Higher confidence (0.92 vs 0.65)
  → Review not needed (auto-approved)

Result: Code review lessons transfer to tool execution
```

---

## Complete Review Type Matrix

| Type                    | Priority | Swipe Right      | Swipe Left       | Learning Output         |
| ----------------------- | -------- | ---------------- | ---------------- | ----------------------- |
| **Code (Critical Bug)** | Critical | Approve (risky!) | Request changes  | Bug pattern stored      |
| **Code (Warning)**      | High     | Approve file     | Comment on line  | Calibrate severity      |
| **Code (No Issues)**    | Medium   | Approve          | Skip             | Trust calibration       |
| **Memory Association**  | High     | Boost to 1.0     | Delete/downgrade | Preference learned      |
| **Tool Execution**      | Medium   | Boost confidence | Record mistake   | Tool selection improved |
| **Message Quality**     | Low      | Reinforce style  | Learn correction | Response style tuned    |
| **Workflow Decision**   | Medium   | Confirm choice   | Adjust autonomy  | Escalation calibrated   |

---

## Mobile UX: Dual Mode System

### Mode 1: Action Review (Existing Design)

**Card Stack** (3 cards visible):

```
Current:  Tool Execution Card
Next:     Memory Association Card
Next+1:   Message Quality Card

Swipe Right → Approve
Swipe Left  → Reject
Tap         → Details
```

### Mode 2: Code Review (NEW — Devin-Inspired)

**File Stack** (3 files visible):

```
Current:  auth/middleware.ts (🔴 1 bug)
Next:     auth/biometric.ts (🟡 2 warnings)
Next+1:   auth/session.ts (✓ no issues)

Swipe Right → Approve file
Swipe Left  → Request changes
Tap         → View hunks
Tap Bug     → See bug details
```

**Progressive Disclosure**:

```
Level 1: PR Overview
  ↓ Tap "Start Review"
Level 2: File Cards (summary + bugs)
  ↓ Tap "View Hunks"
Level 3: Hunk Viewer (actual diff)
  ↓ Tap Bug Badge
Level 4: Bug Detail (explanation + fix)
  ↓ Tap "Why?"
Level 5: Code Chat (ask ALFRED)
```

---

## Implementation Roadmap (Updated)

### Phase 1: Action Reviews (Weeks 1-3) ✓

- Backend (review router, queue)
- Mobile components (swipe cards)
- Learning integration
- Analytics

### Phase 2: Code Review Foundation (Week 4)

- [ ] Code analysis package
- [ ] Diff parsing + organization
- [ ] Bug detection (4 layers)
- [ ] GitHub API integration

### Phase 3: Code Review Mobile UI (Week 5)

- [ ] File card components
- [ ] Hunk viewer
- [ ] Diff renderer with syntax highlighting
- [ ] Bug badges + detail modals

### Phase 4: Advanced Features (Week 6)

- [ ] Code chat (Ask ALFRED)
- [ ] Auto-fix suggestions
- [ ] Multi-file bug tracking
- [ ] Test coverage analysis

### Phase 5: Integration & Polish (Week 7)

- [ ] Unified queue (code + actions)
- [ ] Cross-domain learning
- [ ] Performance optimization
- [ ] Accessibility testing

---

## Component Inventory (Complete)

### Action Review Components (14)

1. ReviewCard — Swipeable action card
2. ReviewCardStack — 3-card stack
3. SwipeIndicators — Left/right glow
4. ReviewDetailsModal — Full context
5. ReviewQueue — List view
6. ReviewQueueItem — Preview card
7. FilterPills — All/Code/Actions
8. PriorityBadge — Priority indicator
9. Toast — Success/error feedback
10. ProgressBar — Review progress
11. AnalyticsDashboard — Review stats
12. BatchReviewModal — Approve all similar
13. PatternSuggestionModal — Auto-approve rules
14. EmptyState — No reviews

### Code Review Components (15) — NEW

1. PROverviewCard — PR metadata + AI analysis
2. FileCard — Swipeable file review card
3. FileCardStack — File navigation stack
4. HunkViewer — Expandable diff viewer
5. DiffRenderer — Syntax-highlighted diff
6. DiffLine — Single line (add/delete/context)
7. BugBadge — Severity indicator (🔴🟡🔵)
8. BugDetailModal — Bug explanation + fix
9. CodeChatModal — Ask ALFRED about code
10. QualityScoreCard — Overall PR metrics
11. MovedFileCard — Simplified move/rename
12. InlineComment — Line-level comment
13. FileGroupCard — Logical group summary
14. CoverageWarning — Missing tests alert
15. SecurityAlert — Hardcoded secrets, etc.

**Total**: 29 components

---

## Database Schema (Updated)

```sql
CREATE TABLE review_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- What's being reviewed
  review_type VARCHAR(50) NOT NULL,
    -- 'tool_execution', 'message', 'memory', 'workflow', 'code'  ← NEW
  subject_id UUID NOT NULL,
  subject_data JSONB NOT NULL,

  -- Code review specific (NEW)
  code_source VARCHAR(20), -- 'github_pr', 'local_diff', 'agent_output'
  pr_number INTEGER,
  pr_url TEXT,
  repository VARCHAR(255),
  bug_count INTEGER DEFAULT 0,
  quality_score DECIMAL(3,1),

  -- Context
  conversation_id VARCHAR(255),
  message_id VARCHAR(255),
  workflow_run_id UUID,

  -- Priority
  priority VARCHAR(10) NOT NULL DEFAULT 'medium',
  auto_approve_eligible BOOLEAN DEFAULT FALSE,

  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  reviewed_at TIMESTAMPTZ,
  verdict_data JSONB,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,

  -- Indexes
  INDEX idx_review_queue_user_status (user_id, status),
  INDEX idx_review_queue_priority (priority, created_at DESC),
  INDEX idx_review_queue_type (review_type),
  INDEX idx_review_queue_pr (pr_number) WHERE pr_number IS NOT NULL,
  INDEX idx_review_queue_bugs (bug_count DESC) WHERE review_type = 'code'
);
```

---

## Backend Architecture (Complete)

### Router Structure

```typescript
// packages/api/src/routers/review.ts (Action Reviews)
export const reviewRouter = router({
  queue: ...,           // List pending action reviews
  submit: ...,          // Approve/reject action
  details: ...,         // Full context
  analytics: ...,       // Review stats
});

// packages/api/src/routers/code-review.ts (Code Reviews) — NEW
export const codeReviewRouter = router({
  analyze: ...,         // Analyze PR/diff, detect bugs
  getDiff: ...,         // Get organized diff for mobile
  submitToGitHub: ...,  // Post review to GitHub
  explainChange: ...,   // AI explains why code changed
  suggestFix: ...,      // AI suggests bug fix
  autoFix: ...,         // AI applies fix (if confident)
});

// packages/api/src/index.ts
export const appRouter = router({
  // ... existing
  review: reviewRouter,
  codeReview: codeReviewRouter,  // NEW
});
```

### Service Layer

```typescript
// packages/code-analysis/src/index.ts (NEW Package)
export interface CodeAnalysisService {
  // Parse git diff into structured format
  parseDiff(diff: string): ParsedDiff;

  // Organize files into logical groups
  organizeFiles(files: FileDiff[]): DiffGroup[];

  // Detect moved/renamed files
  detectMoves(files: FileDiff[]): MovedFile[];

  // Multi-layer bug detection
  detectBugs(files: FileDiff[]): Bug[];

  // Calculate quality score
  calculateQuality(files: FileDiff[], bugs: Bug[]): QualityScore;

  // Generate natural language summary
  summarizeChanges(diff: ParsedDiff): string;
}

// Bug detection layers
export interface BugDetector {
  // Layer 1: AST parsing (fast, rule-based)
  staticAnalysis(code: string): Bug[];

  // Layer 2: TypeScript compiler (type errors)
  typeCheck(files: string[]): Bug[];

  // Layer 3: LLM analysis (contextual)
  llmAnalysis(hunk: Hunk, context: string): Promise<Bug[]>;

  // Layer 4: Historical patterns
  historicalPatterns(files: FileDiff[]): Bug[];
}
```

---

## Cross-Domain Learning Examples

### Example 1: Null Check Pattern

**Code Review** (Week 1):

```typescript
// User reviews PR, approves fix:
- if (user.profile.email) {
+ if (user?.profile?.email) {

ALFRED learns: "User prefers optional chaining for nested properties"
Pattern stored with confidence: 0.85
```

**Tool Execution** (Week 2):

```typescript
// ALFRED creates reminder, applies learned pattern:
const time = reminder?.schedule?.time ?? 'tomorrow';
// Instead of:
// const time = reminder.schedule.time;  ← Would crash if schedule is null

Confidence: 0.92 (boosted from 0.65 because of learned pattern)
Result: Auto-approved, no review needed
```

### Example 2: Error Handling Standard

**Code Review** (Week 1):

```typescript
// User requests changes:
async function loadUser(id) {
  const res = await fetch(`/api/users/${id}`);
  return res.json(); // ✗ No error check
}

// User comment: "Always check response.ok before parsing"
```

**ALFRED learns**: Store pattern "fetch → check ok → parse json"

**Tool Execution** (Week 2):

```typescript
// ALFRED executes web_search tool, applies pattern:
const res = await fetch(searchUrl);
if (!res.ok) {  ← Learned pattern applied
  throw new Error(`Search failed: ${res.status}`);
}
return res.json();

Confidence: 0.94 (boosted from code review learning)
```

### Example 3: Code Style Preferences

**Code Review** (Week 1-3):

```typescript
// User consistently approves:
const items = data.map(item => item.name);  // Arrow function, implicit return

// User consistently rejects:
const items = data.map(function(item) {     // Function expression
  return item.name;
});

ALFRED learns: "User prefers arrow functions with implicit return"
```

**Agent Code Generation** (Week 4):

```typescript
// When Codex generates code, ALFRED suggests style:
const users = await Promise.all(
  ids.map(id => fetchUser(id))  ← Matches learned style
);

// Instead of:
const users = await Promise.all(
  ids.map(function(id) {
    return fetchUser(id);
  })
);

Result: Code passes review first time, no style comments needed
```

---

## User Journeys

### Journey 1: First-Time Code Review

**User**: Never used ALFRED Reviews before

**Step 1**: Codex completes task, creates PR

```
Notification:
┌─────────────────────────────────────┐
│  ALFRED                       🔔    │
│  Codex finished your task           │
│  PR #234 ready for review           │
│  [Review Now]                       │
└─────────────────────────────────────┘
```

**Step 2**: User taps notification, sees overview

```
PR Overview:
  • 6 files changed
  • 3 bugs detected (🔴🔴🔴)
  • Quality Score: 7.5/10

[Start Review] ← Taps this
```

**Step 3**: Swipes through files

```
File 1: middleware.ts
  • Shows: "🔴 Missing null check on line 42"
  • User taps bug → sees explanation + fix
  • Swipes LEFT (request changes)

File 2: biometric.ts
  • Shows: "🟡 Consider edge case: Face ID disabled"
  • User taps "Ask ALFRED" → "Why is this a warning?"
  • ALFRED explains: "iOS allows disabling Face ID..."
  • User swipes RIGHT (approve anyway)

File 3: session.ts
  • Shows: "✓ No issues detected"
  • User swipes RIGHT (approve)

... reviews remaining 3 files ...
```

**Step 4**: Complete review

```
All files reviewed!
  • Approved: 5 files
  • Requested changes: 1 file (middleware.ts)

[Submit to GitHub]
```

**Step 5**: GitHub updated

```
ALFRED posts review comment:
"Found 1 critical bug that needs fixing:

  Line 42: Missing null check before user.profile access

  Suggested fix:
  + if (!user?.profile?.email) {

  All other files look good!"
```

**Time**: 90 seconds total

**Result**: User caught critical bug before merge, ALFRED learned null check importance

---

### Journey 2: Reviewing ALFRED's Own Actions

**User**: Creates note, ALFRED learns preferences

**Step 1**: User says "Take a note about the meeting"

```
ALFRED executes note_create:
  • Title: "Q1 Planning Meeting"
  • Content: "Discuss budget, goals..."
  • Confidence: 0.85 (not confident enough)

→ Review created in queue
```

**Step 2**: User opens Reviews tab

```
Queue shows:
  • 🛠️ Tool Execution: Created note
  • Priority: Medium

[Start Reviewing] ← Taps
```

**Step 3**: Reviews note card

```
Card shows:
  • Title: "Q1 Planning Meeting"
  • Content preview
  • Context: From chat 2m ago
  • Confidence: 0.85

User swipes RIGHT (good title!)
```

**Step 4**: ALFRED learns

```
Backend:
  • memory_boost(noteId, +0.15)
  • Confidence: 0.85 → 1.0
  • Pattern stored: "meeting" → "Meeting" (capitalize)
  • recordToolSuccess("note_create")
```

**Step 5**: Next note auto-approved

```
User: "Note about the call with Sarah"
ALFRED: Creates note, confidence 0.96
→ Auto-approved, no review needed!
```

**Result**: 5 reviews → pattern learned → auto-approve enabled

---

### Journey 3: Mixed Review Session

**User**: Reviews both code and actions in one session

**Queue** (8 items):

1. 💻 PR #234 (critical) ← Code
2. 🧠 Memory (high) ← Action
3. 💻 Local diff (high) ← Code
4. 🛠️ Tool (medium) ← Action
5. 💬 Message (low) ← Action
6. 🛠️ Tool (medium) ← Action
7. 💻 Agent output (medium) ← Code
8. 🔄 Workflow (medium) ← Action

**User taps "Start Reviewing"**:

**Minute 1** (Critical items):

- Reviews PR #234 → finds 3 bugs → requests changes
- Time: 45 seconds

**Minute 2** (High priority):

- Reviews memory association → approves
- Reviews local diff → approves (no bugs)
- Time: 30 seconds

**Minute 3** (Medium/low priority):

- Batch approves 4 similar tool executions
- Time: 15 seconds

**Total**: 90 seconds, 8 items reviewed

**Learning**:

- Code: 3 bug patterns learned
- Actions: 1 memory boosted, 4 tool patterns reinforced
- ALFRED: Better at both code review AND action selection

---

## Success Metrics (Complete)

### Engagement

| Metric                  | Target | Measured | Status |
| ----------------------- | ------ | -------- | ------ |
| Users reviewing ≥1/week | 60%    | TBD      | -      |
| Reviews per user/week   | 10-15  | TBD      | -      |
| Time per action review  | <10s   | TBD      | -      |
| Time per file review    | <30s   | TBD      | -      |
| Completion rate         | >80%   | TBD      | -      |

### Code Review Quality

| Metric                   | Target   | Measured | Status |
| ------------------------ | -------- | -------- | ------ |
| Bug detection precision  | >80%     | TBD      | -      |
| Bug detection recall     | >70%     | TBD      | -      |
| False positive rate      | <20%     | TBD      | -      |
| Bugs caught before merge | >10/week | TBD      | -      |
| Code quality improvement | +15%     | TBD      | -      |

### Action Review Quality

| Metric                   | Target        | Measured | Status |
| ------------------------ | ------------- | -------- | ------ |
| Tool approval rate       | >85%          | TBD      | -      |
| Memory approval rate     | >70%          | TBD      | -      |
| Auto-approve eligibility | 40% by week 4 | TBD      | -      |
| Confidence delta         | +0.25         | TBD      | -      |

### Cross-Domain Learning

| Metric                           | Target          | Measured | Status |
| -------------------------------- | --------------- | -------- | ------ |
| Code patterns → tool improvement | +30% confidence | TBD      | -      |
| Action feedback → code detection | +20% precision  | TBD      | -      |
| Overall trust score              | 6/10 → 8/10     | TBD      | -      |

---

## Competitive Positioning

### vs Devin Review

**ALFRED Advantages**:

- ✓ Mobile-native (swipe, not click)
- ✓ Reviews AI actions (not just code)
- ✓ Learning loop (improves over time)
- ✓ Voice integration (ask questions)
- ✓ Auto-approve (after pattern validation)

**Devin Advantages**:

- ✓ More mature (shipped first)
- ✓ Desktop-optimized
- ✓ GitHub-native integration

**ALFRED Positioning**: "The only review system that makes AI smarter"

### vs GitHub Native

**ALFRED Advantages**:

- ✓ AI bug detection (4 layers)
- ✓ Intelligent diff organization
- ✓ Mobile-optimized
- ✓ Move detection
- ✓ Code chat (Ask ALFRED)
- ✓ Quality scoring

**GitHub Advantages**:

- ✓ Ubiquitous
- ✓ Team collaboration
- ✓ CI/CD integration

**ALFRED Positioning**: "GitHub PR review, but AI-powered and mobile-first"

### vs Cursor Composer

**ALFRED Advantages**:

- ✓ Mobile review (Cursor is desktop-only)
- ✓ Reviews finished work (not in-progress)
- ✓ Validates AI actions (not just code)
- ✓ Learning feedback loop

**Cursor Advantages**:

- ✓ In-editor (no context switch)
- ✓ Real-time suggestions

**ALFRED Positioning**: "Post-generation validation, not pre-generation assistance"

---

## Unique Value Propositions

### 1. "Review Anywhere"

**Problem**: Can't review PRs on commute, waiting in line, etc.

**Solution**: Mobile app with swipe interface

- Review PRs on iPhone while walking
- Review actions during coffee break
- Voice review during drive mode

### 2. "AI That Gets Smarter"

**Problem**: AI makes same mistakes repeatedly

**Solution**: Learning from review feedback

- Rejected null check → AI adds null checks everywhere
- Approved concise responses → AI shortens future messages
- Confirmed bugs → AI catches similar patterns

### 3. "Code + Context"

**Problem**: Code reviews miss behavioral context

**Solution**: ALFRED knows conversation history

- "Why did you change this?" → ALFRED explains from task context
- "Is this what user wanted?" → ALFRED checks against original prompt
- "What else is affected?" → ALFRED shows related memories/tools

### 4. "Trust Calibration"

**Problem**: Users either blindly trust AI or don't use it

**Solution**: Progressive trust building

- Start with 100% review (low confidence)
- Gradually auto-approve (proven patterns)
- Always review high-risk (never assume)

---

## Next Steps

### Immediate (Week 1)

- [ ] Implement Milestone 1: Backend infrastructure
- [ ] Create review_queue table
- [ ] Build review router (actions)
- [ ] Wire learning integration

### Near-Term (Weeks 2-3)

- [ ] Implement Milestones 2-4: Mobile action reviews
- [ ] ReviewCard component with swipe
- [ ] Queue screen + stack
- [ ] Analytics dashboard

### Mid-Term (Weeks 4-5)

- [ ] Implement Milestone 5: Code review
- [ ] Code analysis package
- [ ] Bug detection (4 layers)
- [ ] File stack + hunk viewer
- [ ] GitHub integration

### Long-Term (Weeks 6-7)

- [ ] Advanced features (auto-fix, chat, batch)
- [ ] Performance optimization
- [ ] A/B testing
- [ ] Public beta

---

## Conclusion

**ALFRED Reviews** is the first review system that:

1. **Unifies** code and AI action validation in one mobile app
2. **Learns** from feedback to improve both code quality and AI alignment
3. **Scales** human review capacity through swipe-based UX
4. **Builds trust** progressively through auto-approve patterns

**Vision**: Every developer's trusted companion for validating AI work—whether it's code changes or cognitive actions—with the speed and ease of swiping through social media.

**Launch Plan**:

- Week 1-3: Action reviews (MVP)
- Week 4-5: Code reviews (Devin parity)
- Week 6-7: Advanced features + beta
- Week 8+: Public release + iteration

---

_Complete System Design v2.0_  
_Includes Devin-Style Code Review_  
_Ready for Implementation_
