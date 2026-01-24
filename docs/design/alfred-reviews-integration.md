# ALFRED Reviews: System Integration & Learning Pipeline

**Integration Architecture**  
**Version**: 1.0  
**Date**: January 23, 2026

---

## System Integration Map

```
┌─────────────────────────────────────────────────────────────┐
│                     ALFRED REVIEWS                          │
│                  (Trust Verification Layer)                 │
└─────────────────────────────────────────────────────────────┘
                            ↓
        ┌───────────────────┼───────────────────┐
        ↓                   ↓                   ↓
┌───────────────┐  ┌───────────────┐  ┌───────────────┐
│   COGNITIVE   │  │   LEARNING    │  │   KNOWLEDGE   │
│     STATE     │  │    SYSTEM     │  │     GRAPH     │
└───────────────┘  └───────────────┘  └───────────────┘
        ↓                   ↓                   ↓
   Autonomy           Pattern           Memory
   Gradient          Extraction         Confidence
     (0-1)          (Tool Success)      (Boost/Decay)
```

---

## Integration Points

### 1. Cognitive State Integration

**File**: `packages/cognitive/src/state.ts`

**How Reviews Affect Cognition**:

```typescript
// When user approves a tool execution:
async function onToolApproved(toolName: string, confidence: number) {
  // 1. Update autonomy gradient
  const evidence: Evidence = {
    successes: 1,
    failures: 0,
    total: 1,
  };

  const newAutonomy = updateAutonomy(currentAutonomy, evidence, Date.now());
  // Result: Autonomy increases (more trust = more autonomy)

  // 2. Boost tool selection confidence
  await memory_boost({
    id: toolMemoryId,
    amount: 0.15,
    reason: "user_approved",
  });

  // 3. Record success pattern
  await recordToolSuccess(toolName);
}

// When user rejects a tool execution:
async function onToolRejected(toolName: string, reason: string) {
  // 1. Decrease autonomy for this tool type
  const evidence: Evidence = {
    successes: 0,
    failures: 1,
    total: 1,
  };

  const newAutonomy = updateAutonomy(currentAutonomy, evidence, Date.now());
  // Result: Autonomy decreases (less trust = less autonomy)

  // 2. Downgrade tool confidence
  await updateNodeConfidence(toolMemoryId, 0.3);

  // 3. Record failure pattern
  await recordToolFailure(toolName, reason);
}
```

**Autonomy Impact**:

```
Initial Autonomy: 0.60
After 5 approvals: 0.75 (ALFRED acts more independently)
After 2 rejections: 0.50 (ALFRED asks before acting)
```

---

### 2. Learning System Integration

**File**: `packages/learning/src/mistake_ledger.ts`

**How Reviews Feed Learning**:

```typescript
// Rejection creates mistake entry
async function recordRejection(review: Review) {
  const mistake = {
    category: review.reviewType,
    subcategory: review.subjectData.toolName,
    description: `User rejected ${review.reviewType}: ${review.subjectData.summary}`,
    context: review.context,
    severity: review.priority === "critical" ? "high" : "medium",
    timestamp: Date.now(),
  };

  await mistakeLedger.record(mistake);

  // Trigger pattern analysis
  const patterns = await mistakeLedger.analyzePatterns({
    category: review.reviewType,
    lookbackDays: 7,
  });

  // If pattern detected (3+ similar rejections):
  if (patterns.length > 0) {
    // Create learning task
    await createLearningTask({
      type: "avoid_pattern",
      pattern: patterns[0],
      priority: "high",
    });
  }
}

// Approval creates success entry
async function recordApproval(review: Review) {
  const success = {
    category: review.reviewType,
    subcategory: review.subjectData.toolName,
    confidence: review.subjectData.confidence,
    timestamp: Date.now(),
  };

  await successLedger.record(success);

  // Check for auto-approve eligibility
  const successCount = await successLedger.count({
    category: review.reviewType,
    subcategory: review.subjectData.toolName,
    since: Date.now() - 7 * 24 * 60 * 60 * 1000, // 7 days
  });

  // If 5+ approvals in 7 days → enable auto-approve
  if (successCount >= 5) {
    await enableAutoApprove({
      toolName: review.subjectData.toolName,
      pattern: review.subjectData.inputPattern,
    });
  }
}
```

---

### 3. Knowledge Graph Integration

**File**: `packages/knowledge/src/graph.ts`

**How Reviews Update Memory**:

```typescript
// Approve memory association:
async function approveMemoryAssociation(memoryId: string) {
  // 1. Boost node confidence to 1.0
  await memory_boost({
    id: memoryId,
    amount: 0.3, // Large boost for explicit approval
    reason: "user_verified",
  });

  // 2. Strengthen related edges
  const edges = await getNodeEdges(memoryId);
  for (const edge of edges) {
    await updateEdgeWeight(edge.id, Math.min(edge.weight + 0.2, 1.0));
  }

  // 3. Mark as "verified" in properties
  await updateNodeProperties(memoryId, {
    verified: true,
    verifiedAt: Date.now(),
  });
}

// Reject memory association:
async function rejectMemoryAssociation(
  memoryId: string,
  correction?: Correction
) {
  if (correction?.type === "delete") {
    // Hard delete
    await memory_remove({ id: memoryId });
  } else if (correction?.type === "replace") {
    // Update with correct fact
    await updateNode(memoryId, {
      label: correction.data.correctFact,
      confidence: 1.0, // User-provided = high confidence
      properties: {
        corrected: true,
        originalFact: review.subjectData.fact,
      },
    });
  } else {
    // Soft delete (downgrade confidence)
    await updateNodeConfidence(memoryId, 0.2);
  }
}
```

---

### 4. Preference System Integration

**File**: `packages/api/src/routers/preference.ts`

**How Reviews Infer Preferences**:

```typescript
// Review reveals preference pattern
async function inferPreferenceFromReview(
  review: Review,
  verdict: "approve" | "reject"
) {
  if (review.reviewType !== "message") return;

  const { messageContent, responseStyle } = review.subjectData;

  if (verdict === "approve") {
    // User likes this style → store preference
    await userRepo.setPreference(
      userId,
      `response.style.${responseStyle}`,
      true,
      0.9,
      "learned"
    );
  } else {
    // User dislikes this style → store anti-preference
    await userRepo.setPreference(
      userId,
      `response.style.${responseStyle}`,
      false,
      0.9,
      "learned"
    );
  }
}
```

**Example Preferences Learned**:

```
Key: "response.verbosity"
Value: "concise" (learned from 3 "too long" rejections)
Confidence: 0.85

Key: "tool.note.format"
Value: "title_only" (learned from 5 approvals of brief notes)
Confidence: 0.92

Key: "workflow.escalation_threshold"
Value: 5 (learned from rejecting escalations for <5 file tasks)
Confidence: 0.78
```

---

## Review Triggering Logic

### When to Create a Review

**Auto-Review (No Queue)**:

```typescript
function shouldAutoApprove(action: ToolExecution): boolean {
  return (
    action.confidence > 0.95 && // High confidence
    action.risk === "low" && // Low risk
    recentApprovals(action.toolName) >= 5 // Proven pattern
  );
}
```

**Queue for Review**:

```typescript
function shouldQueueReview(action: ToolExecution): boolean {
  return (
    action.confidence < 0.95 || // Not confident enough
    action.risk === "high" || // High risk
    isNewTool(action.toolName) || // Never seen before
    recentRejections(action.toolName) > 0 // Previous issues
  );
}
```

**Priority Calculation**:

```typescript
function calculatePriority(action: ToolExecution): Priority {
  if (action.risk === "critical") return "critical";
  if (action.confidence < 0.5) return "high";
  if (isNewTool(action.toolName)) return "high";
  if (action.confidence < 0.75) return "medium";
  return "low";
}
```

**Example Scenarios**:

```
Scenario: Create note (confidence: 0.87, risk: low, tool: note_create)
Decision: Queue as MEDIUM priority
Reason: Confidence < 0.95, but low risk

Scenario: Delete memory (confidence: 0.92, risk: high, tool: memory_remove)
Decision: Queue as HIGH priority
Reason: High risk, always requires review

Scenario: Search web (confidence: 0.98, risk: low, tool: web_search)
Decision: Auto-approve, no review
Reason: High confidence, low risk, read-only

Scenario: Deploy code (confidence: 0.99, risk: critical, tool: deploy)
Decision: Queue as CRITICAL priority
Reason: Critical risk, always requires review + biometric
```

---

## Review Metadata & Context

### What Gets Stored in `review_queue.subject_data`

**Tool Execution Review**:

```json
{
  "toolName": "note_create",
  "toolInput": {
    "title": "Q1 Planning Meeting",
    "content": "Discuss budget for new quarter...",
    "tags": ["work", "planning"]
  },
  "toolOutput": {
    "success": true,
    "noteId": "uuid-here"
  },
  "confidence": 0.87,
  "risk": "low",
  "reasoning": "Inferred title from 'meeting' keyword, content from context",
  "alternativeOptions": [
    { "title": "Meeting Notes", "reasoning": "Generic title alternative" }
  ]
}
```

**Memory Association Review**:

```json
{
  "memoryId": "uuid-here",
  "memoryType": "preference",
  "fact": "User prefers meetings scheduled after 10am",
  "evidence": [
    "Rescheduled 3 meetings from 9am to 10am+",
    "Said 'too early' twice in conversations",
    "Calendar pattern shows 87% of meetings after 10am"
  ],
  "confidence": 0.73,
  "inferredFrom": "conversationId-123",
  "relatedMemories": ["uuid-1", "uuid-2"]
}
```

**Message Quality Review**:

```json
{
  "messageId": "msg-123",
  "messageContent": "Your test suite has a 94% pass rate...",
  "userPrompt": "How are my tests?",
  "responseStyle": "concise",
  "wordCount": 45,
  "genUIUsed": ["number", "chart", "list"],
  "reasoningSteps": 3,
  "confidenceScore": 0.91
}
```

---

## Learning Feedback Loop

### Flow Diagram

```
User Interacts
      ↓
Tool Executes (Assistant/Orchestrator)
      ↓
Confidence Check (< 0.95?)
      ↓ Yes
Review Created in Queue
      ↓
User Opens Reviews Tab
      ↓
Swipes Card (Right/Left)
      ↓
┌─────────────┴─────────────┐
│                           │
↓ Approve                   ↓ Reject
│                           │
memory_boost(+0.15)         recordToolFailure()
recordToolSuccess()         updateNodeConfidence(-0.4)
updateAutonomy(+0.05)       updateAutonomy(-0.1)
      │                           │
      ↓                           ↓
Store Success Pattern       Analyze Failure Pattern
      │                           │
      ↓                           ↓
Check Auto-Approve          Suggest Correction Rule
Eligibility (5+ approvals)  or Disable Tool
      │                           │
      └───────────┬───────────────┘
                  ↓
          Next Tool Execution
          Uses Updated Confidence
                  ↓
        Higher Confidence = Auto-Approve
        Lower Confidence = Queue Review
```

### Confidence Evolution Example

**Scenario**: User approves 5 "create note" executions

```
Execution 1: confidence 0.65 → Review → Approve → 0.80
Execution 2: confidence 0.80 → Review → Approve → 0.87
Execution 3: confidence 0.87 → Review → Approve → 0.92
Execution 4: confidence 0.92 → Review → Approve → 0.96
Execution 5: confidence 0.96 → Auto-Approved (>0.95)
Execution 6: confidence 0.98 → Auto-Approved
Execution 7: confidence 0.99 → Auto-Approved
```

**Pattern Stored**:

```json
{
  "toolName": "note_create",
  "inputPattern": {
    "userPromptContains": ["note about", "take a note"],
    "contextType": "meeting"
  },
  "autoApproveEnabled": true,
  "approvalHistory": {
    "total": 7,
    "approved": 7,
    "rejected": 0,
    "approvalRate": 1.0
  }
}
```

---

## Comparison: Devin Review vs ALFRED Reviews

### Feature Matrix

| Feature               | Devin Review                | ALFRED Reviews                   |
| --------------------- | --------------------------- | -------------------------------- |
| **Primary Use Case**  | Code PR review              | AI action validation             |
| **Review Target**     | GitHub diffs                | Tool calls, memories, messages   |
| **Interface**         | Desktop web                 | Mobile swipe cards               |
| **Interaction**       | Comment, dismiss            | Swipe right/left                 |
| **AI Role**           | Bug detection, organization | Self-correction, learning        |
| **Batch Mode**        | ✗ No                        | ✓ Yes (approve all similar)      |
| **Learning Loop**     | ✗ No                        | ✓ Yes (feeds cognitive system)   |
| **Auto-Approve**      | ✗ No                        | ✓ Yes (after pattern validation) |
| **Voice Integration** | ✗ No                        | ✓ Yes (voice-based reviews)      |
| **Offline Support**   | ✗ No                        | ✓ Yes (queue syncs later)        |
| **Context Q&A**       | ✓ Yes (Ask Devin)           | ✓ Yes (Ask ALFRED)               |
| **Priority System**   | ✗ No                        | ✓ Yes (critical/high/medium/low) |
| **Analytics**         | ✗ No                        | ✓ Yes (approval rates, patterns) |

### Unique ALFRED Capabilities

**1. Bidirectional Learning**:

- Devin Review: One-way (user → code feedback)
- ALFRED Reviews: Two-way (user → AI → improved actions)

**2. Progressive Trust**:

- Devin Review: Static review (always manual)
- ALFRED Reviews: Adaptive (auto-approve after pattern)

**3. Mobile-Native**:

- Devin Review: Desktop-focused (GitHub UI)
- ALFRED Reviews: Mobile-first (swipe gestures)

**4. Voice Integration**:

- Devin Review: Visual only
- ALFRED Reviews: "Did I get that right?" during Drive Mode

**5. Memory Validation**:

- Devin Review: Code only
- ALFRED Reviews: Validates learned facts, preferences, patterns

---

## Review Types Deep Dive

### Type 1: Tool Execution Review

**When Triggered**:

- After any tool call with confidence < 0.95
- After tool failure/retry
- First time using a new tool

**Review Card Content**:

```typescript
interface ToolExecutionReview {
  toolName: string;
  toolInput: Record<string, unknown>;
  toolOutput: Record<string, unknown>;
  userPrompt: string;
  reasoning: string;
  confidence: number;
  alternativeOptions?: Array<{
    action: string;
    reasoning: string;
  }>;
}
```

**Correction Options**:

1. **Delete & Undo**: Reverse the action (delete note, cancel reminder)
2. **Edit Parameters**: Keep action, fix inputs (correct time, title, etc.)
3. **Replace Tool**: Use different tool (calendar_add instead of remind_set)

**Learning Outcome**:

- Approved → Store intent→tool mapping
- Rejected + edited → Learn correct parameters
- Rejected + replaced → Learn tool selection

### Type 2: Message Quality Review

**When Triggered**:

- Random sampling (10% of messages)
- After user gives explicit feedback ("too long", "unclear")
- When using new response style

**Review Card Content**:

```typescript
interface MessageReview {
  messageId: string;
  messageContent: string;
  userPrompt: string;
  responseStyle: "concise" | "detailed" | "technical" | "casual";
  wordCount: number;
  genUIComponents: string[];
  reasoningQuality: number; // 0-1
}
```

**Correction Options**:

1. **Too Verbose**: Shorten future responses
2. **Too Brief**: Add more detail
3. **Wrong Tone**: Adjust formality
4. **Missing Info**: Include specific details

**Learning Outcome**:

- Store verbosity preference
- Adjust response templates
- Update tone calibration

### Type 3: Memory Association Review

**When Triggered**:

- After inferring new preference (confidence < 0.9)
- Before creating new fact nodes
- When conflicting memories detected

**Review Card Content**:

```typescript
interface MemoryReview {
  memoryId: string;
  memoryType: "fact" | "preference" | "relation";
  fact: string;
  evidence: string[];
  confidence: number;
  conflictsWith?: string[]; // IDs of conflicting memories
}
```

**Correction Options**:

1. **Confirm**: Boost to confidence 1.0
2. **Reject & Delete**: Remove from graph
3. **Correct Fact**: Replace with accurate version
4. **Merge with Existing**: Combine with related memory

**Learning Outcome**:

- Verified facts become high-confidence
- Rejected inferences stop pattern
- Corrections update inference rules

### Type 4: Workflow Decision Review

**When Triggered**:

- Before escalating to Orchestrator
- Before suspending workflow
- When autonomy threshold uncertain

**Review Card Content**:

```typescript
interface WorkflowReview {
  workflowId: string;
  taskDescription: string;
  decision: "escalate" | "continue" | "suspend";
  reasoning: string;
  complexityScore: number;
  fileCount: number;
  estimatedTime: number;
}
```

**Correction Options**:

1. **Agree**: Proceed with decision
2. **Continue Instead**: Don't escalate
3. **Different Agent**: Use specific agent type

**Learning Outcome**:

- Calibrate complexity thresholds
- Adjust escalation rules
- Update autonomy gradient

---

## Analytics & Insights

### User Dashboard Metrics

**Personal Learning Curve**:

```
Week 1: 23 reviews, 15 approved (65%) ← ALFRED learning your patterns
Week 2: 18 reviews, 16 approved (89%) ← Confidence improving
Week 3: 12 reviews, 11 approved (92%) ← Auto-approve kicking in
Week 4:  5 reviews,  5 approved (100%) ← Mostly auto-approved
```

**Tool Confidence Evolution**:

```
note_create:
  Initial: 0.50
  After 5 approvals: 0.96
  Status: Auto-approve enabled ✓

remind_set:
  Initial: 0.60
  After 3 approvals, 2 rejections: 0.55
  Status: Still requires review

memory_boost:
  Initial: 0.75
  After 8 approvals: 0.98
  Status: Auto-approve enabled ✓
```

**Top Insights**:

```
Most Approved:
1. Note creation (12/12 approved, 100%)
2. Timer start (8/8 approved, 100%)
3. Web search (6/7 approved, 86%)

Most Rejected:
1. Memory inferences (3/8 approved, 38%)
   → ALFRED will ask before inferring preferences
2. Reminder times (4/6 approved, 67%)
   → ALFRED will confirm time before setting
```

---

## Edge Cases & Safeguards

### 1. Review Fatigue Prevention

**Problem**: Too many reviews = user ignores them

**Solution**:

```typescript
// Adaptive review rate
function calculateReviewRate(userStats: ReviewStats): number {
  const completionRate = userStats.completed / userStats.queued;

  if (completionRate < 0.5) {
    // User ignoring reviews → reduce queue size
    return 0.5; // Only queue 50% of eligible actions
  }

  if (completionRate > 0.9) {
    // User engaged → can handle more
    return 1.0; // Queue all eligible actions
  }

  return 0.75; // Default
}
```

### 2. Duplicate Prevention

**Problem**: Same action reviewed multiple times

**Solution**:

```sql
-- Unique constraint on subject_id per user
ALTER TABLE review_queue
ADD CONSTRAINT unique_review_per_subject
UNIQUE (user_id, subject_id, review_type);
```

### 3. Expiration & Auto-Approval

**Problem**: Old reviews clog queue

**Solution**:

```typescript
// Reviews expire after 7 days
// If auto_approve_eligible = true, approve on expiration
// If not eligible, mark as skipped

async function processExpiredReviews() {
  const expired = await getExpiredReviews();

  for (const review of expired) {
    if (review.autoApproveEligible) {
      await submitReview(review.id, "approve");
    } else {
      await submitReview(review.id, "skip");
    }
  }
}
```

### 4. Conflict Resolution

**Problem**: User approves conflicting memories

**Example**:

- Review 1: "User prefers meetings at 10am" → Approve
- Review 2: "User prefers meetings at 2pm" → Approve

**Solution**:

```typescript
// Detect conflict before storing
async function checkMemoryConflict(newMemory: Memory) {
  const conflicts = await findConflictingMemories(newMemory);

  if (conflicts.length > 0) {
    // Add to review with conflict notice
    await createReview({
      reviewType: "memory",
      priority: "high",
      subjectData: {
        ...newMemory,
        conflictsWith: conflicts.map((c) => c.id),
        conflictMessage: "This conflicts with existing preference",
      },
    });
  }
}
```

---

## Voice-Based Reviews (Future)

**During Drive Mode**: ALFRED can ask for quick validation

```
User: "Remind me to call Sarah tomorrow"
Alfred: [Creates reminder for tomorrow 10am]

Alfred (voice): "I've set a reminder to call Sarah tomorrow at 10am. Sound good?"

User: "Yes" (or nod gesture)
→ Auto-approved

User: "No, make it 2pm"
→ Rejected + corrected
```

**Voice Review Card**:

- Shows on screen during Drive Mode
- Simplified (just title + approve/reject)
- Can swipe or speak ("yes"/"no")

---

## Integration Checklist

**Backend**:

- [ ] Review queue table created
- [ ] Review router with queue/submit/details endpoints
- [ ] Triggers added to tool executions
- [ ] Learning integration (approve→boost, reject→correct)
- [ ] Auto-approve logic

**Frontend (Mobile)**:

- [ ] ReviewCard component with swipe gesture
- [ ] ReviewCardStack with 3-card depth
- [ ] ReviewQueue screen with filters
- [ ] ReviewDetailsModal with context
- [ ] Analytics dashboard

**Cognitive Integration**:

- [ ] Autonomy gradient updated on approve/reject
- [ ] Confidence scores adjusted
- [ ] Error patterns recorded

**Knowledge Integration**:

- [ ] Memory boost on approve
- [ ] Memory remove on reject
- [ ] Edge weight updates

**Learning Integration**:

- [ ] Pattern extraction from approvals
- [ ] Mistake recording from rejections
- [ ] Preference inference from corrections

---

## Success Metrics

**Engagement**:

- Target: 60% of users review ≥1 action/week
- Target: Average 10-15 reviews/user/week
- Target: <10 seconds per review (swipe)

**Learning Quality**:

- Target: 90%+ of approved actions remain valid (no reversal)
- Target: <5% rejection rate after 4 weeks (convergence)
- Target: Auto-approve rate reaches 40% by week 4

**Trust Building**:

- Target: User trust score increases 6/10 → 8/10
- Target: "ALFRED understands me" >70% agree
- Target: Autonomy comfort increases 0.6 → 0.8

**System Health**:

- Target: Review queue size <10 items (managed well)
- Target: Completion rate >80% (not overwhelming)
- Target: Average confidence delta +0.25 after reviews

---

_Integration Architecture v1.0_  
_Ready for Backend Development_
