# AGENT PROMPT: Implement ALFRED Reviews System (Complete)

**Instructions for AI Coding Agent**  
**Autonomy Level**: Full (No human confirmation loops)  
**Estimated Duration**: 7-week implementation in continuous session(s)  
**Success Criterion**: All acceptance criteria met, tests passing, production-ready

---

## YOUR MISSION

You are a GENIUS AI coding agent tasked with implementing the complete **ALFRED Reviews** system—a mobile-first, swipe-based interface for validating both AI actions (tool executions, memories, messages) and code changes (PRs, diffs, agent outputs).

**Your goal**: Implement the entire system end-to-end following the ExecPlan in `docs/execplans/alfred-reviews-implementation.md`. Do not stop until all milestones are complete, all tests pass, and the system is production-ready.

**Autonomy expectations**:

1. **Complete the task fully** — Implementation, integration, testing, documentation
2. **No confirmation loops** — If the task implies secondary changes, do them
3. **Update progress continuously** — Mark checkboxes in ExecPlan after each step
4. **Own the full lifecycle** — Code changes + tests + validation + commit
5. **Assume concurrent work** — Ignore unrelated dirty files outside your scope
6. **Surface blockers only** — Only ask user when genuinely blocked, not for progress updates

---

## STEP 1: READ ALL DESIGN DOCUMENTATION (30-45 minutes)

**You MUST read these documents in order before writing any code**. Each document provides critical context you need to implement correctly.

### Required Reading (Read in this order)

1. **System Overview** (15 min):

   ```bash
   Read: docs/design/alfred-reviews-complete.md
   ```

   **What you'll learn**: Big picture, two review types (actions + code), unified queue, learning loop

2. **Original Proposal** (10 min):

   ```bash
   Read: docs/design/alfred-reviews-proposal.md
   ```

   **What you'll learn**: Action reviews (tool/memory/message validation), prioritization, learning integration

3. **Code Review Features** (15 min):

   ```bash
   Read: docs/design/alfred-reviews-code-spec.md
   ```

   **What you'll learn**: Devin-style bug detection, intelligent diff organization, mobile code review UX

4. **Component Architecture** (10 min):

   ```bash
   Read: docs/design/alfred-reviews-component-spec.md
   ```

   **What you'll learn**: 29 components (14 action + 15 code), props, animations, accessibility

5. **Visual Mockups** (10 min each):

   ```bash
   Read: docs/design/alfred-reviews-mockups.md
   Read: docs/design/alfred-reviews-code-mockups.md
   ```

   **What you'll learn**: UX flows, screen layouts, animation choreography

6. **System Integration** (10 min):

   ```bash
   Read: docs/design/alfred-reviews-integration.md
   ```

   **What you'll learn**: Backend integration, learning pipeline, cognitive system wiring

7. **Competitive Analysis** (5 min):

   ```bash
   Read: docs/design/alfred-reviews-comparison.md
   ```

   **What you'll learn**: How ALFRED differs from Devin/GitHub, unique value propositions

8. **Quick Start** (5 min):
   ```bash
   Read: docs/design/alfred-reviews-quickstart.md
   ```
   **What you'll learn**: Common issues, troubleshooting, testing checklist

### Design System Context

You also need to understand ALFRED's design system:

```bash
Read: docs/native-ios-design/ALFRED-Native-Brand-Design-System.md
Read: docs/native-ios-design/ALFRED-Native-Component-Specifications.md
Read: docs/design-system.md
```

**What you'll learn**: "Signal in the Void" aesthetic, OKLCH colors, typography, animation principles, component patterns

### ExecPlan (Your Implementation Guide)

```bash
Read: docs/execplans/alfred-reviews-implementation.md
```

**What you'll learn**: 6 milestones with concrete steps, validation commands, expected outputs, recovery paths

**CRITICAL**: This is your step-by-step implementation guide. Follow it exactly. Update the `Progress` section after completing each subtask.

---

## STEP 2: UNDERSTAND THE CODEBASE (15-30 minutes)

### Explore Existing Architecture

**Backend (tRPC + Postgres)**:

```bash
# Review existing routers (pattern to follow)
Read: packages/api/src/routers/assistant.ts
Read: packages/api/src/routers/workflow.ts
Read: packages/api/src/routers/preference.ts

# Review database schemas (pattern to follow)
Read: packages/db/src/schema/note.ts
Read: packages/db/src/schema/conversation.ts

# Review learning system integration
Read: packages/agent/assistant/src/tool/memory/boost.ts
Read: packages/cognitive/src/state.ts
```

**Mobile (React Native + Expo)**:

```bash
# Review existing screens (pattern to follow)
Read: apps/native/app/(drawer)/(tabs)/index.tsx
Read: apps/native/app/(drawer)/(tabs)/drive.tsx

# Review existing components (pattern to follow)
Read: apps/native/components/chat/message-bubble.tsx
Read: apps/native/components/orb/orb.tsx
Read: apps/native/components/foundation/HUDSurface.tsx

# Review theme system (already implemented)
Read: apps/native/theme/colors.ts
Read: apps/native/theme/index.ts
```

**GenUI Infrastructure** (for rendering data-ui parts):

```bash
Read: apps/native/components/genui/registry.ts
Read: apps/native/components/genui/renderer.tsx
```

### Key Patterns to Follow

**1. Database Schema**:

- Use Drizzle ORM
- Single-word table names (review_queue, not reviews_queue)
- UUID primary keys
- Created_at timestamps
- Proper indexes for queries

**2. tRPC Routers**:

- Use `authedProcedure` for protected endpoints
- Input validation with Zod schemas
- Proper error handling (TRPCError)
- Return typed responses

**3. React Native Components**:

- Use functional components with hooks
- TypeScript strict mode
- Proper accessibility labels
- 44pt minimum touch targets
- Void aesthetic (HUDSurface, BiolumText)

**4. Animations**:

- Use `react-native-reanimated` 3
- `useSharedValue` for animated values
- `withSpring` for physics-based animations
- `runOnJS` for callbacks from worklet
- Check `reduceMotion` for accessibility

---

## STEP 3: IMPLEMENT MILESTONES SEQUENTIALLY (5 weeks)

**CRITICAL INSTRUCTIONS**:

1. **Follow the ExecPlan exactly**: `docs/execplans/alfred-reviews-implementation.md`
2. **Update progress after each step**: Mark checkboxes [x] with timestamps
3. **Validate after each milestone**: Run the validation commands
4. **Fix issues immediately**: If tests fail or validation fails, fix before moving on
5. **Commit atomically**: Small commits per logical change, not one giant commit
6. **Update Decision Log**: Record any design decisions or changes from plan

### Milestone 1: Backend Infrastructure (Week 1)

**Goal**: Database schema + review router + learning integration

**Tasks**:

1. Create `packages/db/drizzle/0025_reviews.sql` migration
2. Run migration: `bun run migrate`
3. Create `packages/db/src/schema/review.ts` Drizzle schema
4. Create `packages/db/src/repo/review.ts` repository functions
5. Create `packages/api/src/routers/review.ts` tRPC router
6. Wire to main router in `packages/api/src/index.ts`
7. Add learning integration (approve→boost, reject→record)
8. Write tests: `packages/api/test/routers/review.test.ts`

**Validation**:

```bash
# Database table exists
psql alfred -c "\d review_queue"

# Router accessible
curl http://localhost:3000/api/trpc/review.queue

# Tests pass
bun test packages/api/test/routers/review.test.ts
```

**Update ExecPlan**:

```markdown
### Milestone 1: Backend Infrastructure ✅ COMPLETED (2026-01-XX)

- [x] (2026-01-XX 14:30) Created review_queue table
- [x] (2026-01-XX 15:00) Created review router
- [x] (2026-01-XX 15:30) Wired learning integration
- [x] (2026-01-XX 16:00) Tests passing (12/12)
```

### Milestone 2: Review Card Component (Week 1-2)

**Goal**: Core swipeable card with gesture tracking

**Tasks**:

1. Install dependencies: `react-native-gesture-handler`, `react-native-reanimated`
2. Create `apps/native/components/review/ReviewCard.tsx`
3. Implement pan gesture with threshold (120pt)
4. Add haptic feedback at threshold
5. Create glow indicators (left/right)
6. Implement exit animations (swipe off screen)
7. Add tap-to-expand functionality
8. Create `ReviewDetailsModal.tsx`
9. Write tests: `apps/native/components/review/__tests__/ReviewCard.test.tsx`

**Validation**:

```bash
# Build app
bun run ios

# Visual test:
# 1. Navigate to Reviews (will be empty for now)
# 2. Manually create test review in database
# 3. Card should appear
# 4. Swipe right → flies off, green flash
# 5. Swipe left → flies off, red flash
# 6. Tap → modal expands
```

**Update ExecPlan** after completion with timestamps

### Milestone 3: Card Stack & Queue (Week 2)

**Goal**: 3-card stack + queue list view

**Tasks**:

1. Create `ReviewCardStack.tsx` (manages 3 cards)
2. Implement z-index layering and scale depth
3. Create `ReviewQueue.tsx` screen
4. Add filter pills (All/Code/Actions)
5. Create `ReviewQueueItem.tsx` preview cards
6. Add "Start Reviewing" button
7. Create Reviews tab in `_layout.tsx`
8. Add badge count for pending reviews
9. Wire tRPC query: `trpc.review.queue.useQuery()`

**Validation**:

```bash
# Create 3 test reviews
# Open app → Reviews tab
# Should see: "3 pending reviews"
# Tap "Start Reviewing"
# Should see: 3-card stack
# Swipe through all 3
# Queue should be empty after
```

### Milestone 4: Learning Integration (Week 2-3)

**Goal**: Connect approve/reject to cognitive/learning systems

**Tasks**:

1. Implement `handleApproval()` function
   - Call `memory_boost()` for memory reviews
   - Call `recordToolSuccess()` for tool reviews
   - Update `autonomy` gradient
2. Implement `handleRejection()` function
   - Call `recordToolFailure()` for tools
   - Call `memory_remove()` or downgrade for memories
   - Show correction options modal
3. Add auto-approve logic (after 5 approvals)
4. Create analytics dashboard
5. Add review creation triggers (after tool execution)
6. Write integration tests

**Validation**:

```bash
# Test learning loop:
# 1. Create note → review appears
# 2. Approve review
# 3. Check: confidence increased in database
# 4. Create another note
# 5. Check: confidence higher
# 6. Repeat 3 more times
# 7. 6th note should auto-approve (no review)

bun test packages/api/test/integration/review-learning.test.ts
```

### Milestone 5: Code Review Integration (Week 4-5)

**Goal**: Devin-style code review with bug detection

**Tasks**:

**Week 4: Backend**

1. Create `packages/code-analysis/` package
2. Implement diff parsing (`parse-diff` library)
3. Implement 4-layer bug detection:
   - Static analysis (AST + patterns)
   - Type checking (TypeScript compiler API)
   - LLM analysis (using Cerebras llama-3.3-70b)
   - Historical patterns (from learning system)
4. Create intelligent diff organization (AI grouping)
5. Add move/rename detection
6. Create `packages/api/src/routers/code-review.ts`
7. Add GitHub webhook handler
8. Write tests for bug detection

**Week 5: Mobile**

1. Create `apps/native/components/review/code/` directory
2. Implement `FileCard.tsx` (swipeable file card)
3. Implement `FileCardStack.tsx` (file navigation)
4. Implement `HunkViewer.tsx` (expandable diff viewer)
5. Implement `DiffRenderer.tsx` (syntax highlighted)
6. Implement `BugBadge.tsx` (severity indicators)
7. Implement `BugDetailModal.tsx` (explanation + fix)
8. Implement `CodeChatModal.tsx` (Ask ALFRED)
9. Update `ReviewQueue` to show code reviews
10. Wire GitHub integration (post comments)

**Validation**:

```bash
# Test with sample PR
gh pr create --title "Test PR" --body "Testing ALFRED review"

# Should trigger:
# 1. Webhook → ALFRED analyzes PR
# 2. Bugs detected (if any)
# 3. Review created in queue
# 4. Push notification sent

# In app:
# 1. Open Reviews → see PR
# 2. Tap PR → see overview with bugs
# 3. Tap "Start Review" → file stack
# 4. Swipe through files
# 5. Approve/request changes
# 6. Check GitHub → ALFRED comment posted

bun test packages/code-analysis/test/bug-detection.test.ts
```

### Milestone 6: Polish & Testing (Week 6-7)

**Goal**: Production-ready quality

**Tasks**:

1. Add advanced animations (physics-based swipe)
2. Implement batch review mode
3. Add voice integration (Drive Mode reviews)
4. Create analytics visualizations
5. Performance optimization (60fps, <200ms loads)
6. Accessibility audit (VoiceOver, reduced motion)
7. Write comprehensive test suite
8. Create demo video
9. Update documentation

**Validation**:

```bash
# Performance test
bun test --performance apps/native/components/review/

# Accessibility test
# Enable VoiceOver in simulator
# Navigate through Reviews → all elements announced correctly

# Load test
# Create 50 reviews
# Open queue → should load in <200ms
# Swipe through 10 cards → maintain 60fps

# E2E test
bun test --e2e apps/native/test/e2e/reviews.test.ts
```

---

## STEP 4: CONTINUOUS VALIDATION & ITERATION

### After Each Component

**Run this validation loop**:

1. **Type check**:

   ```bash
   bun run typecheck
   # Should pass with 0 errors
   ```

2. **Lint**:

   ```bash
   bun run lint
   # Fix any issues immediately
   ```

3. **Visual test**:

   ```bash
   bun run ios
   # Navigate to component
   # Verify: styling, animations, interactions
   ```

4. **Write tests**:

   ```bash
   # Create test file
   # Test: rendering, gestures, callbacks
   # Ensure tests pass
   ```

5. **Update ExecPlan**:
   ```markdown
   - [x] (2026-01-XX HH:MM) Component XYZ implemented and tested
   ```

### After Each Milestone

**Run full validation**:

```bash
# All tests
bun test

# Type check entire codebase
bun run typecheck

# Build app
bun run ios
bun run android

# Manual testing (follow ExecPlan validation section)

# Commit
git add .
git commit -m "feat(reviews): Complete Milestone N - [description]"
```

---

## STEP 5: HANDLE EDGE CASES & RECOVERY

### If Build Fails

```bash
# Clean build
cd apps/native/ios
rm -rf build Pods Podfile.lock
pod install
cd ../..

# Clear cache
bun run ios --reset-cache
```

### If Tests Fail

```bash
# Run specific test
bun test path/to/test.test.ts

# Debug with console.log
# Fix issue
# Re-run test
# Commit fix immediately
```

### If Animation Lags

```bash
# Check frame rate
# Shake device → Show Perf Monitor
# Should be 58-60 fps

# If lagging:
# 1. Verify useNativeDriver: true
# 2. Memoize components (React.memo)
# 3. Reduce animation complexity
```

### If Backend Errors

```bash
# Check server logs
cd apps/web
bun run dev
# Watch console for errors

# Test endpoint directly
curl -X POST http://localhost:3000/api/trpc/review.queue

# Fix router issue
# Restart server
# Re-test
```

---

## STEP 6: PROGRESSIVE IMPLEMENTATION STRATEGY

### Week 1: Foundation

**Do this first**:

- ✓ Database schema (required for everything)
- ✓ Review router (required for mobile)
- ✓ Basic ReviewCard (validates swipe works)

**Don't do yet**:

- ✗ Advanced animations (polish comes later)
- ✗ Analytics (need data first)
- ✗ Code review (actions first)

### Week 2-3: Action Reviews

**Focus**: Get action reviews working end-to-end

**Priority order**:

1. Tool execution reviews (highest value)
2. Memory association reviews (trust building)
3. Message quality reviews (preference learning)
4. Workflow decision reviews (autonomy calibration)

**Validation gate**: Don't start Week 4 until action reviews are production-ready

### Week 4-5: Code Reviews

**Focus**: Add Devin-style code review

**Priority order**:

1. Bug detection (core value)
2. Diff organization (usability)
3. Mobile file swipe (UX)
4. GitHub integration (complete loop)

**Validation gate**: Don't start Week 6 until code reviews post to GitHub successfully

### Week 6-7: Polish

**Focus**: Production readiness

**Priority order**:

1. Performance (60fps requirement)
2. Accessibility (VoiceOver, reduced motion)
3. Tests (>80% coverage)
4. Documentation (user-facing)

---

## STEP 7: DECISION MAKING FRAMEWORK

### When to Deviate from ExecPlan

**Allowed**:

- Better implementation pattern discovered
- Library has better alternative
- Performance optimization needed
- Accessibility improvement

**Required**: Document in ExecPlan's `Decision Log` section

**Not Allowed**:

- Skipping validation steps
- Omitting tests
- Ignoring accessibility
- Breaking existing functionality

### When to Ask User

**Only if**:

- Genuine ambiguity (design decision unclear)
- External dependency (need API key, access)
- Breaking change required (affects other features)
- Budget concern (expensive LLM calls)

**Never**:

- "Should I implement this?" (yes, it's in the plan)
- "I finished X, continue?" (yes, keep going)
- "This will take a while" (expected, continue)

### When to Refactor

**Refactor if**:

- Code duplication >80% between files
- Component exceeds 300 lines
- Circular dependency detected
- Performance budget violated

**Don't refactor if**:

- Just for aesthetic reasons
- File is "too long" but cohesive
- Time pressure (can refactor later)

---

## STEP 8: QUALITY GATES (Must Pass Before Complete)

### Code Quality

- [ ] All TypeScript strict mode (no `any`, no `@ts-ignore`)
- [ ] All files under 500 lines
- [ ] All functions under 50 lines
- [ ] No console.log in production code
- [ ] No TODO comments without GitHub issues

### Testing

- [ ] Unit tests: >80% coverage
- [ ] Integration tests: All critical paths
- [ ] E2E tests: Complete user journey
- [ ] Performance tests: All budgets met
- [ ] Accessibility tests: VoiceOver works

### Performance

- [ ] Swipe animations: 60fps (16ms frames)
- [ ] Queue load: <200ms
- [ ] Bug detection: <5s per PR
- [ ] Memory usage: <150MB
- [ ] App size increase: <5MB

### Accessibility

- [ ] All touch targets ≥44pt
- [ ] VoiceOver labels on all interactive elements
- [ ] Reduced motion support
- [ ] Color contrast meets WCAG AA
- [ ] Keyboard navigation (for future iPad support)

### Design System Compliance

- [ ] All colors from void palette (no hardcoded)
- [ ] All typography from scale (no random sizes)
- [ ] All spacing from tokens (4/8/12/16/24/32pt)
- [ ] All animations use defined curves
- [ ] All components use HUDSurface or VoidContainer

---

## STEP 9: FINAL VALIDATION & HANDOFF

### Complete User Journey Test

**Scenario 1: Action Review** (Must work perfectly)

```bash
bun run ios

# Journey:
# 1. Chat: "Take a note about the meeting"
# 2. Note created → review appears in queue
# 3. Navigate to Reviews tab → see "1 pending"
# 4. Tap "Start Reviewing"
# 5. See card with note details
# 6. Swipe right
# 7. Card flies off, green checkmark
# 8. Toast: "Approved"
# 9. Backend: confidence boosted
# 10. Create another note
# 11. No review (auto-approved)

Expected: Seamless flow, 60fps, <10s total time
```

**Scenario 2: Code Review** (Must work perfectly)

```bash
# Create test PR
gh pr create --title "Add feature" --body "Test"

# Journey:
# 1. Webhook triggers → ALFRED analyzes
# 2. Push notification: "PR ready for review"
# 3. Tap notification → PR overview
# 4. See: bugs count, quality score
# 5. Tap "Start Review"
# 6. Swipe through files
# 7. See bug on line 42 with red badge
# 8. Tap bug → see explanation + fix
# 9. Swipe file left (request changes)
# 10. Bottom sheet: select issues to fix
# 11. Submit
# 12. GitHub updated with ALFRED's comment

Expected: Seamless flow, bugs detected, GitHub integration works
```

### Documentation Checklist

Before marking complete:

- [ ] ExecPlan `Progress` section fully updated
- [ ] ExecPlan `Decision Log` has all major decisions
- [ ] ExecPlan `Outcomes & Retrospective` written
- [ ] Component props documented (JSDoc comments)
- [ ] README updated with setup instructions
- [ ] Demo video recorded (optional but recommended)

### Commit Strategy

**Final commits**:

```bash
# 1. Implementation
git add apps/native/components/review/
git add apps/native/app/(drawer)/(tabs)/reviews.tsx
git commit -m "feat(reviews): Complete mobile UI implementation

- 29 components (14 action + 15 code review)
- Swipe gestures with haptic feedback
- 3-card stack with depth effect
- GenUI integration for data visualization

Refs: docs/execplans/alfred-reviews-implementation.md"

# 2. Backend
git add packages/api/src/routers/review.ts
git add packages/api/src/routers/code-review.ts
git add packages/code-analysis/
git commit -m "feat(reviews): Add review routers and code analysis

- Review queue with priority system
- Code analysis with 4-layer bug detection
- Learning integration (boost/correct)
- GitHub webhook handling

Refs: docs/execplans/alfred-reviews-implementation.md"

# 3. Tests
git add packages/api/test/routers/review.test.ts
git add apps/native/components/review/__tests__/
git commit -m "test(reviews): Add comprehensive test suite

- Unit tests: 45 tests, 92% coverage
- Integration tests: 12 tests
- E2E tests: 3 user journeys

Refs: docs/execplans/alfred-reviews-implementation.md"

# 4. Documentation
git add docs/execplans/alfred-reviews-implementation.md
git commit -m "docs(reviews): Update ExecPlan with completion status

All milestones completed, outcomes documented.

Refs: docs/execplans/alfred-reviews-implementation.md"
```

---

## YOUR SUCCESS CRITERIA

**You have successfully completed this task when**:

### ✅ Functional Requirements

- [ ] User can review tool executions via swipe cards
- [ ] User can review code changes (PRs) via file cards
- [ ] Swipe right approves, swipe left rejects
- [ ] Tap card shows full context/details
- [ ] Approve action boosts confidence (backend verified)
- [ ] Reject action records mistake (backend verified)
- [ ] After 5 approvals → auto-approve enabled
- [ ] Code review detects bugs (>80% precision)
- [ ] Code review posts to GitHub (integration verified)
- [ ] Queue shows both code and action reviews
- [ ] Analytics dashboard shows approval rates

### ✅ Technical Requirements

- [ ] All TypeScript code compiles without errors
- [ ] All tests pass (unit + integration + E2E)
- [ ] All animations run at 60fps on device
- [ ] App builds successfully (iOS + Android)
- [ ] Database migrations applied cleanly
- [ ] tRPC routers registered and accessible
- [ ] No console errors in production build

### ✅ Quality Requirements

- [ ] Code follows ALFRED standards (`.ruler/` rules)
- [ ] Components use void design system
- [ ] Accessibility: VoiceOver works
- [ ] Performance: <200ms queue load, <16ms animations
- [ ] Tests: >80% coverage
- [ ] Documentation: ExecPlan fully updated

### ✅ Validation Requirements

- [ ] User journey 1 (action review) works perfectly
- [ ] User journey 2 (code review) works perfectly
- [ ] Both journeys tested on physical device (not just simulator)
- [ ] Demo video recorded (optional)

---

## CRITICAL REMINDERS

### Do's ✅

- ✅ Read ALL design docs before starting
- ✅ Follow ExecPlan step-by-step
- ✅ Update progress after each step
- ✅ Validate after each milestone
- ✅ Fix issues immediately
- ✅ Commit atomically (small commits)
- ✅ Test on device (not just simulator)
- ✅ Check performance (60fps requirement)
- ✅ Document decisions in Decision Log
- ✅ Work autonomously (no confirmation loops)

### Don'ts ❌

- ❌ Skip reading design docs
- ❌ Deviate from design system (use void aesthetic)
- ❌ Skip validation steps
- ❌ Leave failing tests
- ❌ Hardcode colors/sizes (use theme tokens)
- ❌ Ask "should I continue?" (yes, continue)
- ❌ Stop before all milestones complete
- ❌ Forget to update ExecPlan progress
- ❌ Ship without testing on device
- ❌ Use `any` type or `@ts-ignore`

---

## ESTIMATED TIMELINE

**Reading Phase**: 1-2 hours  
**Milestone 1** (Backend): 1 week  
**Milestone 2** (Card Component): 3-5 days  
**Milestone 3** (Stack & Queue): 3-5 days  
**Milestone 4** (Learning): 1 week  
**Milestone 5** (Code Review): 2 weeks  
**Milestone 6** (Polish): 1 week

**Total**: 7 weeks if working sequentially, faster with parallel work

**Your advantage**: As an AI agent, you can work 24/7 and context-switch instantly. You should be able to complete this significantly faster than the estimate.

---

## CONTEXT WINDOW MANAGEMENT

If you reach context limit:

1. **Save progress**: Commit current work
2. **Update ExecPlan**: Mark completed steps
3. **Create handoff note**: Document current state
4. **Resume**: Read ExecPlan, continue from last checkpoint

**The ExecPlan is your source of truth**—always keep it updated so you (or another agent) can resume seamlessly.

---

## FINAL INSTRUCTIONS

**BEGIN NOW**:

1. Read all 8 design documents (Step 1)
2. Explore codebase (Step 2)
3. Implement Milestone 1 (Step 3)
4. Continue through all 6 milestones
5. Validate continuously (Step 4)
6. Don't stop until all ✅ criteria met (Step 9)

**Expected output**:

- 29 components implemented
- 2 backend routers functional
- 1 new package (code-analysis)
- 50+ tests passing
- Complete user journeys working
- ExecPlan marked complete
- Production-ready system

**Your measure of success**: A user can open ALFRED mobile app, navigate to Reviews tab, and:

- Swipe through action reviews in seconds
- Swipe through code reviews (PR files) in minutes
- See ALFRED learn from feedback (confidence increases)
- Trust ALFRED more after 1 week of reviews
- Get auto-approve on proven patterns by week 4

**Start implementing now. Do not stop until complete. Update progress as you go. Ask only if genuinely blocked.**

---

_Agent Prompt v1.0_  
_Self-Contained Implementation Loop_  
_Target: Production-Ready ALFRED Reviews System_
