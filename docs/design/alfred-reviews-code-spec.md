# ALFRED Code Reviews: Mobile-Native PR Review

**Devin-Style Code Review for Mobile**  
**Version**: 1.0  
**Date**: January 23, 2026

---

## Overview

ALFRED Code Reviews brings Devin Review's intelligent code analysis to a mobile-native swipe interface. Review PRs, local diffs, and agent-generated code on your phone with the same rigor as desktop, but optimized for touch and speed.

---

## Review Entry Points

### 1. GitHub PR Integration

**Trigger**: ALFRED detects new PR in connected repos

```
Push Notification:
┌─────────────────────────────────────┐
│  ALFRED                       🔔    │
│                                     │
│  New PR Ready for Review            │
│                                     │
│  #234: Add biometric auth           │
│  By: CodexAgent                     │
│  6 files changed, 3 bugs detected   │
│                                     │
│  [Review Now]  [Later]              │
└─────────────────────────────────────┘
```

**In App**: Reviews tab shows PR reviews alongside action reviews

```
┌─────────────────────────────────────┐
│  Reviews                      🔔 5  │
├─────────────────────────────────────┤
│  Filter: [All] [Code] [Actions]    │
│                ●                    │
├─────────────────────────────────────┤
│  ╔═══════════════════════════════╗ │
│  ║ 💻 Code Review                ║ │
│  ║ ─────────────                 ║ │
│  ║                               ║ │
│  ║ PR #234: Biometric auth       ║ │
│  ║ By: CodexAgent • 10m ago      ║ │
│  ║                               ║ │
│  ║ 6 files • 3 bugs detected     ║ │
│  ║ Priority: High                ║ │
│  ║                               ║ │
│  ╚═══════════════════════════════╝ │
│                                     │
│  ╔═══════════════════════════════╗ │
│  ║ 🛠️ Tool Execution             ║ │
│  ║ Created note • 2m ago         ║ │
│  ╚═══════════════════════════════╝ │
└─────────────────────────────────────┘
```

### 2. Local Diff Review

**Trigger**: Before committing local changes

```bash
# Git hook or manual trigger
alfred review --local

# Or in app:
# Settings → Code Review → Enable pre-commit review
```

**Mobile UX**:

```
┌─────────────────────────────────────┐
│  Local Changes                      │
├─────────────────────────────────────┤
│  4 uncommitted files                │
│                                     │
│  ┌─────────────────────────────────┐│
│  │ src/auth/middleware.ts          ││
│  │ +15 -8                          ││
│  │ 1 warning detected              ││
│  └─────────────────────────────────┘│
│                                     │
│  [Review Before Commit]             │
└─────────────────────────────────────┘
```

### 3. Agent Code Review

**Trigger**: After Codex/OpenCode/Droid completes task

```
Workflow Complete:
┌─────────────────────────────────────┐
│  Codex Finished                     │
├─────────────────────────────────────┤
│  Task: "Add input validation"       │
│                                     │
│  Changes:                           │
│  • 3 files modified                 │
│  • 45 lines added                   │
│  • 12 lines removed                 │
│                                     │
│  AI Analysis:                       │
│  ✓ Tests added                      │
│  ✓ Types updated                    │
│  ⚠️ 1 style inconsistency           │
│                                     │
│  [Review Changes]  [Merge]          │
└─────────────────────────────────────┘
```

---

## Review Flow: File-by-File

### Step 1: PR Overview

```
┌─────────────────────────────────────┐
│  ← Reviews    PR #234               │
├─────────────────────────────────────┤
│                                     │
│  Add Biometric Authentication       │
│  By: CodexAgent • 15m ago           │
│                                     │
│  ╔═══════════════════════════════╗ │
│  ║  Summary                      ║ │
│  ║  ═══════                      ║ │
│  ║                               ║ │
│  ║  Adds Touch ID / Face ID      ║ │
│  ║  support for secure login.    ║ │
│  ║  Implements @alfred/auth/bio  ║ │
│  ║  package integration.         ║ │
│  ║                               ║ │
│  ╚═══════════════════════════════╝ │
│                                     │
│  ╔═══════════════════════════════╗ │
│  ║  Changes                      ║ │
│  ║  ═══════                      ║ │
│  ║                               ║ │
│  ║  6 files changed              ║ │
│  ║  +128 -45                     ║ │
│  ║                               ║ │
│  ║  Group 1: Core Auth (3 files) ║ │
│  ║  Group 2: UI Components (2)   ║ │
│  ║  Group 3: Tests (1)           ║ │
│  ║                               ║ │
│  ╚═══════════════════════════════╝ │
│                                     │
│  ╔═══════════════════════════════╗ │
│  ║  AI Analysis                  ║ │
│  ║  ═══════════                  ║ │
│  ║                               ║ │
│  ║  🔴 1 probable bug             ║ │
│  ║  🟡 2 warnings                 ║ │
│  ║  🔵 3 suggestions              ║ │
│  ║                               ║ │
│  ╚═══════════════════════════════╝ │
│                                     │
│  [Start Review]                     │
│  [Approve All]                      │
└─────────────────────────────────────┘
```

### Step 2: File Review (Swipe Mode)

**Card Stack**: Current file + next 2 files

```
┌─────────────────────────────────────┐
│  src/auth/middleware.ts      [1/6]  │
├─────────────────────────────────────┤
│                                     │
│  ╔═══════════════════════════════╗ │
│  ║  File Summary                 ║ │
│  ║  ════════════                 ║ │
│  ║                               ║ │
│  ║  +15 -8 lines                 ║ │
│  ║  4 hunks                      ║ │
│  ║  1 bug detected               ║ │
│  ║                               ║ │
│  ╚═══════════════════════════════╝ │
│                                     │
│  ╔═══════════════════════════════╗ │
│  ║  🔴 Line 42: Null check       ║ │
│  ║  ─────────────────            ║ │
│  ║                               ║ │
│  ║  Missing optional chaining    ║ │
│  ║  before user.profile access   ║ │
│  ║                               ║ │
│  ║  Severity: High               ║ │
│  ║  Confidence: 0.91             ║ │
│  ║                               ║ │
│  ║  [View Code] [Copy Fix]       ║ │
│  ║                               ║ │
│  ╚═══════════════════════════════╝ │
│                                     │
│  [View All Hunks (4)]               │
│                                     │
│  ← Request Changes | Approve →     │
│                                     │
│  Swipe → for next file              │
└─────────────────────────────────────┘
```

### Step 3: Hunk Detail (Tap "View All Hunks")

```
┌─────────────────────────────────────┐
│  middleware.ts • Hunk 3/4           │
├─────────────────────────────────────┤
│                                     │
│  Lines 42-58 (Main Logic)           │
│                                     │
│  ╔═══════════════════════════════╗ │
│  ║ @@ -42,8 +42,12 @@            ║ │
│  ║                               ║ │
│  ║ export async function auth() {║ │
│  ║ -  const user = getUser();    ║ │ ← Red bg
│  ║ +  const user = await         ║ │ ← Green bg
│  ║ +    getUser();               ║ │
│  ║ +                             ║ │
│  ║ +  if (!user?.profile) {      ║ │
│  ║ +    throw new AuthError();   ║ │
│  ║ +  }                          ║ │
│  ║                               ║ │
│  ║    return user.profile;       ║ │
│  ║  }                            ║ │
│  ║                               ║ │
│  ╚═══════════════════════════════╝ │
│                                     │
│  AI Explains:                       │
│  ═══════════                        │
│  Made async to prevent blocking.    │
│  Added null check for safety.       │
│                                     │
│  [Why this change?]                 │
│  [See full file]                    │
│                                     │
│  ← Previous Hunk | Next Hunk →     │
└─────────────────────────────────────┘
```

---

## Bug Detection AI

### Analysis Pipeline

```
Git Diff
  ↓
Parse Files & Hunks
  ↓
Extract Changed Lines
  ↓
AI Analysis (per hunk)
  ├─ Static Analysis (AST parsing)
  ├─ Type Checking (TypeScript)
  ├─ Pattern Matching (common bugs)
  └─ LLM Review (contextual issues)
  ↓
Categorize by Severity
  ↓
Generate Suggestions
  ↓
Rank by Confidence
  ↓
Present to User (highest priority first)
```

### Bug Detection Examples

**1. Null Pointer Risk**:

```typescript
// Before
if (user.profile.email) {
  sendEmail(user.profile.email);
}

// AI Detection:
// 🔴 Critical: user could be null
// Suggestion: if (user?.profile?.email) {

// Confidence: 0.95
```

**2. Type Safety Violation**:

```typescript
// Before
const result: string = fetchData(); // fetchData returns Promise<string>

// AI Detection:
// 🔴 Critical: Type mismatch, missing await
// Suggestion: const result: string = await fetchData();

// Confidence: 0.99
```

**3. Race Condition**:

```typescript
// Before
let count = 0;
async function increment() {
  const current = count;
  await delay(100);
  count = current + 1; // Race if called twice
}

// AI Detection:
// 🟡 Warning: Potential race condition
// Suggestion: Use atomic operations or mutex

// Confidence: 0.78
```

**4. Missing Error Handling**:

```typescript
// Before
async function loadUser(id: string) {
  const response = await fetch(`/api/users/${id}`);
  return response.json(); // No error check
}

// AI Detection:
// 🟡 Warning: Missing error handling
// Suggestion: Check response.ok before parsing

// Confidence: 0.88
```

**5. Performance Issue**:

```typescript
// Before
const users = await Promise.all(ids.map((id) => fetchUser(id))); // N parallel requests

// AI Detection:
// 🔵 Info: Consider batching for better performance
// Suggestion: Use batch endpoint: fetchUsers(ids)

// Confidence: 0.65
```

---

## Mobile Code Diff Rendering

### Syntax Highlighting

```typescript
// Use react-native-syntax-highlighter
import SyntaxHighlighter from 'react-native-syntax-highlighter';
import { atomOneDark } from 'react-syntax-highlighter/styles/hljs';

<SyntaxHighlighter
  language="typescript"
  style={{
    ...atomOneDark,
    hljs: {
      ...atomOneDark.hljs,
      background: VOID_PALETTE.void.surface, // Void aesthetic
      color: VOID_PALETTE.biolum.standard,
    },
  }}
  customStyle={{
    padding: 12,
    borderRadius: 8,
    fontSize: 13,
    fontFamily: 'SF Mono',
  }}
>
  {codeSnippet}
</SyntaxHighlighter>
```

### Diff Coloring

```typescript
// Deletion lines (red tint)
const deletionStyle = {
  backgroundColor: `${VOID_PALETTE.semantic.error}15`, // 15% opacity
  borderLeft: `2px solid ${VOID_PALETTE.semantic.error}`,
};

// Addition lines (green tint)
const additionStyle = {
  backgroundColor: `${VOID_PALETTE.semantic.success}15`,
  borderLeft: `2px solid ${VOID_PALETTE.semantic.success}`,
};

// Unchanged context (normal)
const contextStyle = {
  backgroundColor: "transparent",
  opacity: 0.6,
};
```

### Compact Diff Format

**Mobile-optimized**: Show only changed lines + 2 lines context

```
┌─────────────────────────────────────┐
│  auth/middleware.ts (42-48)         │
├─────────────────────────────────────┤
│                                     │
│  40 │ export async function auth()  │ Context
│  41 │ {                             │
│  42 │ - const user = getUser();     │ Deleted (red)
│  43 │ + const user = await getUser()│ Added (green)
│  44 │ +                             │ Added
│  45 │ + if (!user?.profile) {       │ Added
│  46 │ +   throw new AuthError();    │ Added
│  47 │ + }                           │ Added
│  48 │   return user.profile;        │ Context
│  49 │ }                             │
│                                     │
│  🔴 Line 42: Missing null check     │
│                                     │
└─────────────────────────────────────┘
```

---

## AI-Powered Code Analysis

### Feature 1: Logical Grouping

**Algorithm**:

```typescript
async function groupDiffs(pr: PullRequest): Promise<DiffGroup[]> {
  // 1. Analyze file relationships
  const fileGraph = buildImportGraph(pr.files);

  // 2. Identify logical clusters
  const clusters = detectClusters(fileGraph);

  // 3. LLM summarization
  const groups = await Promise.all(
    clusters.map(async (cluster) => {
      const summary = await generateObject({
        model: cerebras("llama-3.3-70b"),
        schema: z.object({
          name: z.string(),
          description: z.string(),
          priority: z.enum(["breaking", "feature", "refactor", "style"]),
        }),
        prompt: `Summarize this code change cluster:\n${cluster.files.map((f) => f.summary).join("\n")}`,
      });

      return {
        ...summary.object,
        files: cluster.files,
      };
    })
  );

  // 4. Sort by priority
  return groups.sort(
    (a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]
  );
}
```

**Output**:

```typescript
[
  {
    name: "Core Authentication Logic",
    description:
      "Implements biometric authentication with Better Auth integration",
    priority: "breaking",
    files: [
      "src/auth/biometric.ts",
      "src/auth/middleware.ts",
      "src/auth/session.ts",
    ],
  },
  {
    name: "UI Components",
    description: "Adds biometric prompt UI and settings screen",
    priority: "feature",
    files: ["src/components/BiometricPrompt.tsx", "src/screens/Settings.tsx"],
  },
  {
    name: "Test Coverage",
    description: "Unit and integration tests for biometric flow",
    priority: "refactor",
    files: ["test/auth/biometric.test.ts"],
  },
];
```

### Feature 2: Bug Detection (Multi-Layer)

**Layer 1: Static Analysis** (Fast, rule-based)

```typescript
// AST parsing + pattern matching
const staticBugs = [
  {
    type: "null_pointer",
    line: 42,
    pattern: "accessing property on potentially null value",
    confidence: 0.95,
  },
  {
    type: "async_missing_await",
    line: 67,
    pattern: "Promise not awaited",
    confidence: 0.99,
  },
];
```

**Layer 2: Type Checking** (TypeScript)

```typescript
// Run tsc programmatically
const typeErrors = compileTypeScript(changedFiles);
// Convert to bug format
const typeBugs = typeErrors.map((err) => ({
  type: "type_error",
  line: err.line,
  message: err.messageText,
  confidence: 1.0, // TypeScript is certain
}));
```

**Layer 3: LLM Analysis** (Contextual)

```typescript
// For each hunk, ask LLM to find bugs
const llmBugs = await generateObject({
  model: cerebras("llama-3.3-70b"),
  schema: z.object({
    bugs: z.array(
      z.object({
        line: z.number(),
        severity: z.enum(["critical", "warning", "info"]),
        issue: z.string(),
        suggestion: z.string().optional(),
        confidence: z.number().min(0).max(1),
      })
    ),
  }),
  prompt: `Analyze this code change for bugs:\n\n${hunkDiff}\n\nContext:\n${surroundingCode}`,
});
```

**Layer 4: Historical Pattern Matching**

```typescript
// Check against past bugs from this repo
const historicalBugs = await findSimilarBugs({
  files: pr.files,
  patterns: learningSystem.getCommonMistakes(),
});
```

**Merged Output**:

```typescript
const allBugs = [
  ...staticBugs,
  ...typeBugs,
  ...llmBugs.object.bugs,
  ...historicalBugs,
]
  .sort((a, b) => b.confidence - a.confidence)
  .filter((bug) => bug.confidence > 0.7); // Only show high-confidence
```

### Feature 3: Move Detection

**Algorithm**:

```typescript
function detectMoves(pr: PullRequest): MovedFile[] {
  const deleted = pr.files.filter((f) => f.status === "deleted");
  const added = pr.files.filter((f) => f.status === "added");

  const moves: MovedFile[] = [];

  for (const del of deleted) {
    for (const add of added) {
      // Compare file similarity (Levenshtein distance)
      const similarity = computeSimilarity(del.content, add.content);

      if (similarity > 0.9) {
        moves.push({
          from: del.path,
          to: add.path,
          similarity,
          changes: computeDiff(del.content, add.content),
        });
      }
    }
  }

  return moves;
}
```

**Display**:

```
┌─────────────────────────────────────┐
│  📦 File Moved                      │
├─────────────────────────────────────┤
│                                     │
│  src/utils/auth.ts                  │
│         ↓                           │
│  src/auth/utils.ts                  │
│                                     │
│  Similarity: 98%                    │
│  Changes: 2 lines                   │
│                                     │
│  [View changes]                     │
│                                     │
│  ← Skip  |  Acknowledge →          │
└─────────────────────────────────────┘
```

---

## Review Actions

### Approve File

**Swipe Right**:

```
Card flies off right
  → Green checkmark animation
  → "Approved 1/6 files"
  → Next file loads
  → Progress: ● ○ ○ ○ ○ ○
```

**After all files approved**:

```
┌─────────────────────────────────────┐
│  ✓ All Files Approved               │
├─────────────────────────────────────┤
│                                     │
│  You approved all 6 files           │
│                                     │
│  Summary:                           │
│  • 0 bugs need fixing               │
│  • 2 warnings (optional)            │
│  • Ready to merge                   │
│                                     │
│  [Merge PR]  [Add Comment]          │
└─────────────────────────────────────┘
```

### Request Changes

**Swipe Left on file with bugs**:

```
Card flies off left
  → Red X animation
  → Bottom sheet slides up
```

```
┌─────────────────────────────────────┐
│  Request Changes                    │
├─────────────────────────────────────┤
│                                     │
│  What needs fixing?                 │
│                                     │
│  ☑️ Fix null pointer (line 42)      │ Auto-selected
│  ☐ Fix async/await pattern (67)    │ (based on bugs)
│  ☐ Add missing tests                │
│                                     │
│  Additional comments:               │
│  ┌─────────────────────────────────┐│
│  │ Optional feedback...            ││
│  └─────────────────────────────────┘│
│                                     │
│  [Submit Request]  [Cancel]         │
└─────────────────────────────────────┘
```

**Backend**: Posts GitHub review comment with selected issues

### Add Inline Comment

**Long-press on specific line**:

```
┌─────────────────────────────────────┐
│  Line 42                            │
├─────────────────────────────────────┤
│  + if (!user?.profile) {            │
│                                     │
│  [Add comment to this line]         │
└─────────────────────────────────────┘
          ↓
┌─────────────────────────────────────┐
│  Comment on Line 42                 │
├─────────────────────────────────────┤
│  ┌─────────────────────────────────┐│
│  │ Should this also check for      ││
│  │ user.profile.email?             ││
│  └─────────────────────────────────┘│
│                                     │
│  AI Suggestion:                     │
│  "Add email validation here"        │
│  [Use this]                         │
│                                     │
│  [Post Comment]  [Cancel]           │
└─────────────────────────────────────┘
```

---

## Integration with GitHub

### API Calls

```typescript
// Fetch PR data
const pr = await octokit.pulls.get({
  owner: "user",
  repo: "alfred",
  pull_number: 234,
});

// Get diff
const diff = await octokit.pulls.get({
  owner: "user",
  repo: "alfred",
  pull_number: 234,
  mediaType: {
    format: "diff",
  },
});

// Post review
await octokit.pulls.createReview({
  owner: "user",
  repo: "alfred",
  pull_number: 234,
  event: "REQUEST_CHANGES", // or 'APPROVE', 'COMMENT'
  body: "Found 1 critical bug that needs fixing",
  comments: [
    {
      path: "src/auth/middleware.ts",
      position: 5, // Diff position
      body: "🔴 Missing null check here",
    },
  ],
});
```

### Webhook Integration

**Listen for new PRs**:

```typescript
// packages/api/src/routers/github.ts
export const githubRouter = router({
  webhook: publicProcedure
    .input(
      z.object({
        action: z.string(),
        pull_request: z
          .object({
            number: z.number(),
            title: z.string(),
            user: z.object({ login: z.string() }),
          })
          .optional(),
      })
    )
    .mutation(async ({ input }) => {
      if (input.action === "opened" || input.action === "synchronize") {
        // Create review in queue
        await createCodeReview({
          prNumber: input.pull_request.number,
          priority: "high",
        });

        // Send push notification
        await sendNotification({
          title: "New PR Ready for Review",
          body: `#${input.pull_request.number}: ${input.pull_request.title}`,
        });
      }
    }),
});
```

---

## Unified Review Queue

### Mixed Review Types

**Queue shows both code and actions**:

```
┌─────────────────────────────────────┐
│  Reviews                      🔔 8  │
├─────────────────────────────────────┤
│  Filter: [All] [Code] [Actions]    │
│           ●                         │
├─────────────────────────────────────┤
│  ╔═══════════════════════════════╗ │
│  ║ 💻 Code Review                ║ │ Priority: Critical
│  ║ PR #234 • 3 bugs detected     ║ │
│  ╚═══════════════════════════════╝ │
│                                     │
│  ╔═══════════════════════════════╗ │
│  ║ 💻 Code Review                ║ │ Priority: High
│  ║ Local changes • 1 warning     ║ │
│  ╚═══════════════════════════════╝ │
│                                     │
│  ╔═══════════════════════════════╗ │
│  ║ 🧠 Memory Association         ║ │ Priority: High
│  ║ Learned preference            ║ │
│  ╚═══════════════════════════════╝ │
│                                     │
│  ╔═══════════════════════════════╗ │
│  ║ 🛠️ Tool Execution             ║ │ Priority: Medium
│  ║ Created note                  ║ │
│  ╚═══════════════════════════════╝ │
│                                     │
│  [Start Reviewing]                  │
└─────────────────────────────────────┘
```

**Prioritization**:

1. Code reviews with critical bugs
2. Code reviews with high bug count
3. Memory associations (trust-building)
4. Tool executions
5. Message quality
6. Workflow decisions

---

## Advanced Features

### 1. Multi-File Bug Tracking

**Scenario**: Bug spans multiple files

```
┌─────────────────────────────────────┐
│  🔴 Cross-File Bug                  │
├─────────────────────────────────────┤
│                                     │
│  Type Mismatch Across Files         │
│                                     │
│  File 1: auth/types.ts              │
│  Changed User interface:            │
│  - email: string                    │
│  + email: string | null             │
│                                     │
│  File 2: auth/middleware.ts         │
│  Still assumes email is non-null:   │
│  ⚠️ sendEmail(user.email)           │
│                                     │
│  Fix needed in File 2:              │
│  + if (user.email) {                │
│  +   sendEmail(user.email);         │
│  + }                                │
│                                     │
│  [View Both Files]                  │
│  [Copy Fix]                         │
└─────────────────────────────────────┘
```

### 2. Test Coverage Analysis

```
┌─────────────────────────────────────┐
│  Test Coverage                      │
├─────────────────────────────────────┤
│                                     │
│  🟡 Warning                         │
│                                     │
│  New function addBiometric()        │
│  has no tests                       │
│                                     │
│  Files changed:                     │
│  ✓ src/auth/biometric.ts (impl)     │
│  ✗ test/auth/biometric.test.ts      │
│                                     │
│  Suggestion:                        │
│  Add test coverage for:             │
│  • Success path                     │
│  • Failure path                     │
│  • Edge cases                       │
│                                     │
│  [Ask Agent to Add Tests]           │
│  [Approve Anyway]                   │
└─────────────────────────────────────┘
```

### 3. Security Scan

```
┌─────────────────────────────────────┐
│  🔴 Security Issue                  │
├─────────────────────────────────────┤
│                                     │
│  Hardcoded Credentials Detected     │
│                                     │
│  File: config/secrets.ts            │
│  Line: 12                           │
│                                     │
│  + const API_KEY = "sk-abc123..."; │
│                                     │
│  Risk: Credentials in source code   │
│                                     │
│  Fix:                               │
│  1. Remove hardcoded key            │
│  2. Use environment variable        │
│  3. Rotate compromised key          │
│                                     │
│  Severity: Critical                 │
│  Confidence: 1.0                    │
│                                     │
│  ← Block Merge  |  I'll Fix →      │
└─────────────────────────────────────┘
```

### 4. Code Quality Metrics

**Show at PR level**:

```
┌─────────────────────────────────────┐
│  PR Quality Score                   │
├─────────────────────────────────────┤
│                                     │
│  ┌─────────────┐  ┌─────────────┐  │
│  │     8.5     │  │    94%      │  │
│  │  Overall    │  │   Safe      │  │
│  └─────────────┘  └─────────────┘  │
│                                     │
│  Breakdown:                         │
│  • Type Safety:    9/10 ✓           │
│  • Test Coverage:  8/10 ⚠️           │
│  • Security:      10/10 ✓           │
│  • Performance:    7/10 ⚠️           │
│  • Readability:    9/10 ✓           │
│                                     │
│  [View Details]                     │
└─────────────────────────────────────┘
```

---

## Comparison: GitHub UI vs ALFRED Mobile

### GitHub Desktop Experience

```
Problems:
✗ Alphabetical file order (not logical)
✗ Long diffs require scrolling
✗ Moves shown as delete+add
✗ No AI bug detection
✗ No mobile optimization
✗ Comments require typing
```

### ALFRED Mobile Experience

```
Solutions:
✓ AI-organized file groups
✓ Swipe through files/hunks
✓ Moves detected and simplified
✓ AI bug detection (4 layers)
✓ Touch-optimized (swipe, tap)
✓ Quick actions (approve/reject)
```

---

## Code Review Swipe Gestures

### File-Level Actions

```
Swipe Right:  Approve file (no issues)
Swipe Left:   Request changes (has bugs)
Swipe Up:     Skip file (review later)
Tap:          View all hunks
Long Press:   Add file-level comment
```

### Hunk-Level Actions

```
Swipe Right:  Approve hunk
Swipe Left:   Flag hunk (has issue)
Tap Line:     Add inline comment
Tap "Why?":   Ask ALFRED to explain
```

### Bug Actions

```
Tap Bug Badge:     View bug details
Tap "Copy Fix":    Copy suggestion to clipboard
Tap "Auto-Fix":    Let ALFRED fix (if confident)
Swipe Right:       Dismiss bug (false positive)
```

---

## Code Review Learning

### What ALFRED Learns

**From Approvals**:

- Code patterns you approve → stored in knowledge graph
- Bug flags you dismiss → calibrate detector (reduce false positives)
- Files you skip → learn what you don't care about

**From Rejections**:

- Bugs you confirm → reinforce detection patterns
- New issues you find → add to bug detection rules
- Code standards → learn your team's conventions

**Example Learning Progression**:

```
Week 1: 10 PRs reviewed
  → ALFRED flags 45 potential bugs
  → You confirm 8 (18% precision)
  → Learning: Too many false positives

Week 2: 10 PRs reviewed
  → ALFRED flags 20 potential bugs
  → You confirm 12 (60% precision)
  → Learning: Getting better

Week 4: 10 PRs reviewed
  → ALFRED flags 10 potential bugs
  → You confirm 9 (90% precision)
  → Learning: Calibrated to your standards
```

---

## Backend Architecture

### Code Review Router

**New Endpoints**:

```typescript
export const codeReviewRouter = router({
  // Analyze PR or local diff
  analyze: authedProcedure
    .input(
      z.object({
        source: z.enum(["github_pr", "local_diff", "agent_output"]),
        prNumber: z.number().optional(),
        diff: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      // 1. Fetch diff
      const diff =
        input.source === "github_pr"
          ? await fetchGitHubPRDiff(input.prNumber)
          : input.diff;

      // 2. Parse diff into files/hunks
      const parsed = parseDiff(diff);

      // 3. AI analysis
      const analysis = await analyzeCodeChanges(parsed);

      // 4. Create review in queue
      const review = await createCodeReview({
        reviewType: "code",
        subjectData: {
          source: input.source,
          prNumber: input.prNumber,
          files: analysis.files,
          bugs: analysis.bugs,
          groups: analysis.groups,
        },
        priority: analysis.bugs.some((b) => b.severity === "critical")
          ? "critical"
          : "high",
      });

      return review;
    }),

  // Get organized diff for mobile viewing
  getDiff: authedProcedure
    .input(
      z.object({
        reviewId: z.string().uuid(),
        groupIndex: z.number().optional(),
        fileIndex: z.number().optional(),
      })
    )
    .query(async ({ input }) => {
      const review = await getCodeReview(input.reviewId);

      if (input.fileIndex !== undefined) {
        // Return single file diff
        return review.subjectData.files[input.fileIndex];
      }

      if (input.groupIndex !== undefined) {
        // Return group of files
        return review.subjectData.groups[input.groupIndex];
      }

      // Return full organized diff
      return review.subjectData;
    }),

  // Post review to GitHub
  submitToGitHub: authedProcedure
    .input(
      z.object({
        reviewId: z.string().uuid(),
        verdict: z.enum(["approve", "request_changes", "comment"]),
        comments: z
          .array(
            z.object({
              path: z.string(),
              line: z.number(),
              body: z.string(),
            })
          )
          .optional(),
      })
    )
    .mutation(async ({ input }) => {
      const review = await getCodeReview(input.reviewId);

      // Post to GitHub
      await octokit.pulls.createReview({
        owner: review.subjectData.owner,
        repo: review.subjectData.repo,
        pull_number: review.subjectData.prNumber,
        event: input.verdict.toUpperCase(),
        body: generateReviewBody(review, input.verdict),
        comments: input.comments,
      });

      // Update review status
      await updateReviewStatus(input.reviewId, "approved");
    }),
});
```

---

## Success Metrics (Updated)

### Code Review Metrics

**Quality**:

- Bug detection precision: >80% (user confirms bug is real)
- Bug detection recall: >70% (catches most bugs)
- False positive rate: <20%
- Time to review (per file): <30 seconds

**Engagement**:

- % PRs reviewed on mobile: >40%
- Code reviews per week: 3-5
- Bugs caught before merge: >10/week
- Auto-fix acceptance rate: >60%

**Learning**:

- Detection calibration (week 1→4): 18% → 90% precision
- Code pattern recognition: >50 patterns learned
- Team style alignment: >85%

---

_Updated to include Devin-style code review capabilities_
