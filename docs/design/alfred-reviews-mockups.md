# ALFRED Reviews: Visual Mockups & UX Flows

**Mobile Interface Design**  
**Version**: 1.0  
**Platform**: iOS/Android (React Native)

---

## Flow Overview

```
HOME TAB
   ↓
[Reviews Badge: 8]
   ↓
TAP REVIEWS TAB
   ↓
QUEUE SCREEN
   ├─ Code Reviews (3 PRs)
   └─ Action Reviews (5 tools)
   ↓
TAP "START REVIEWING"
   ↓
┌──────────┴──────────┐
│                     │
CODE REVIEW      ACTION REVIEW
   ↓                  ↓
PR OVERVIEW      SWIPE CARD MODE
   ↓                  ↓
FILE STACK       APPROVAL/REJECT
   ↓                  ↓
HUNK VIEWER      NEXT CARD
   ↓
BUG DETAILS
   ↓
APPROVE/REQUEST CHANGES
   ↓
POST TO GITHUB
   ↓
QUEUE COMPLETE
   ↓
ANALYTICS SCREEN
```

---

## Screen 1A: Reviews Tab (Queue View - Code + Actions)

```
┌─────────────────────────────────────────────┐
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ │
│ 9:40        📶 🔋                          │
├─────────────────────────────────────────────┤
│                                             │
│  Reviews                           🔔 8     │
│                                             │
│  Code reviews & AI action validation        │
│                                             │
├─────────────────────────────────────────────┤
│  ┌───┐  ┌───┐  ┌───┐                       │
│  │All│  │💻 │  │🛠️ │                       │
│  └───┘  └───┘  └───┘                       │
│   ●     ○     ○                            │
│                                             │
│  Sort: Priority ▾                           │
│                                             │
├─────────────────────────────────────────────┤
│  ╔═══════════════════════════════════════╗ │
│  ║                                       ║ │
│  ║  💻 Code Review                       ║ │ Critical Priority
│  ║  ─────────────                        ║ │
│  ║                                       ║ │
│  ║  PR #234: Add biometric auth          ║ │
│  ║  By: CodexAgent • 10m ago             ║ │
│  ║                                       ║ │
│  ║  📊 6 files • +128 -45                ║ │
│  ║  🔴 3 bugs  🟡 2 warnings             ║ │
│  ║                                       ║ │
│  ║  Priority: Critical                   ║ │
│  ║                                       ║ │
│  ╚═══════════════════════════════════════╝ │
│                                             │
│  ╔═══════════════════════════════════════╗ │
│  ║  💻 Code Review                       ║ │ High Priority
│  ║  Local changes • 5m ago               ║ │
│  ║  4 files • 1 warning                  ║ │
│  ╚═══════════════════════════════════════╝ │
│                                             │
│  ╔═══════════════════════════════════════╗ │
│  ║  🧠 Memory Association                ║ │ High Priority
│  ║  Learned: "Prefers 10am+ meetings"    ║ │
│  ║  10m ago • Confidence: 0.73           ║ │
│  ╚═══════════════════════════════════════╝ │
│                                             │
│  ╔═══════════════════════════════════════╗ │
│  ║  🛠️ Tool Execution                    ║ │ Medium Priority
│  ║  Created note • 2m ago                ║ │
│  ║  Confidence: 0.87                     ║ │
│  ╚═══════════════════════════════════════╝ │
│                                             │
│  [Start Reviewing (8)]                      │
│                                             │
├─────────────────────────────────────────────┤
│  ○        ○        ○        ○        ●     │
│ Chat   Library   Voice   Workflows Reviews │
└─────────────────────────────────────────────┘
```

---

## Screen 1B: Code Review Queue (Filtered)

```
┌─────────────────────────────────────────────┐
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ │
│ 9:40        📶 🔋                          │
├─────────────────────────────────────────────┤
│                                             │
│  Reviews                           🔔 3     │
│                                             │
├─────────────────────────────────────────────┤
│  ┌───┐  ┌───┐  ┌───┐                       │
│  │All│  │💻 │  │🛠️ │                       │
│  └───┘  └───┘  └───┘                       │
│   ○     ●     ○          ← Code filter     │
│                                             │
├─────────────────────────────────────────────┤
│  ╔═══════════════════════════════════════╗ │
│  ║  💻 PR #234: Biometric Auth           ║ │
│  ║  ─────────────────────                ║ │
│  ║  By: CodexAgent • 10m ago             ║ │
│  ║                                       ║ │
│  ║  Changes:                             ║ │
│  ║  • 6 files changed                    ║ │
│  ║  • +128 -45 lines                     ║ │
│  ║                                       ║ │
│  ║  AI Analysis:                         ║ │
│  ║  • 🔴 3 critical bugs                 ║ │
│  ║  • 🟡 2 warnings                      ║ │
│  ║  • 🔵 1 suggestion                    ║ │
│  ║                                       ║ │
│  ║  Quality Score: 7.5/10                ║ │
│  ║                                       ║ │
│  ╚═══════════════════════════════════════╝ │
│                                             │
│  ╔═══════════════════════════════════════╗ │
│  ║  💻 Local Changes                     ║ │
│  ║  Uncommitted • 5m ago                 ║ │
│  ║  4 files • 1 warning                  ║ │
│  ╚═══════════════════════════════════════╝ │
│                                             │
│  ╔═══════════════════════════════════════╗ │
│  ║  💻 Codex Output                      ║ │
│  ║  Task complete • 1h ago               ║ │
│  ║  3 files • 0 bugs ✓                   ║ │
│  ╚═══════════════════════════════════════╝ │
│                                             │
│  [Start Reviewing (3)]                      │
└─────────────────────────────────────────────┘
```

---

## Screen 1: Reviews Tab (Queue View)

```
┌─────────────────────────────────────────────┐
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ │ Status Bar
│ 9:40        📶 🔋                          │
├─────────────────────────────────────────────┤
│                                             │
│  Reviews                           🔔 3     │ Title + Badge
│                                             │
│  Pending actions waiting for validation     │ Subtitle
│                                             │
├─────────────────────────────────────────────┤
│  ┌───┐  ┌───┐  ┌───┐  ┌───┐  ┌───┐        │ Filter Pills
│  │All│  │⚙️ │  │💬 │  │🧠 │  │🔄 │        │
│  └───┘  └───┘  └───┘  └───┘  └───┘        │
│   ●     ○     ○     ○     ○                │
│                                             │
│  Sort: Newest First ▾                       │ Sort Dropdown
│                                             │
├─────────────────────────────────────────────┤
│                                             │
│  ╔═══════════════════════════════════════╗ │ HUD Surface
│  ║                                       ║ │ (glass.surface)
│  ║  🛠️  Tool Execution                   ║ │
│  ║  ───────────────                      ║ │
│  ║                                       ║ │
│  ║  Created Note: "Q1 Planning"         ║ │
│  ║  2 minutes ago                        ║ │
│  ║                                       ║ │
│  ║  Priority: High   Confidence: 0.87   ║ │
│  ║                                       ║ │
│  ╚═══════════════════════════════════════╝ │
│                                             │
│  ╔═══════════════════════════════════════╗ │
│  ║  🧠  Memory Association               ║ │
│  ║  ───────────────────                  ║ │
│  ║                                       ║ │
│  ║  Learned: "Prefers 10am+ meetings"   ║ │
│  ║  10 minutes ago                       ║ │
│  ║                                       ║ │
│  ║  Priority: Medium   Confidence: 0.73 ║ │
│  ║                                       ║ │
│  ╚═══════════════════════════════════════╝ │
│                                             │
│  ╔═══════════════════════════════════════╗ │
│  ║  💬  Message Quality                  ║ │
│  ║  ─────────────────                    ║ │
│  ║                                       ║ │
│  ║  Response style check                 ║ │
│  ║  1 hour ago                           ║ │
│  ║                                       ║ │
│  ║  Priority: Low   Confidence: 0.91    ║ │
│  ║                                       ║ │
│  ╚═══════════════════════════════════════╝ │
│                                             │
│                                             │
│  ┌─────────────────────────────────────┐   │ Primary Action
│  │        Start Reviewing              │   │ (FluidButton)
│  │           (3 items)                 │   │
│  └─────────────────────────────────────┘   │
│                                             │
├─────────────────────────────────────────────┤
│  ○        ○        ○        ○        ●     │ Tab Bar
│ Chat   Library   Voice   Workflows Reviews │
└─────────────────────────────────────────────┘
```

---

## Screen 2: Swipe Mode (Idle State)

```
┌─────────────────────────────────────────────┐
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ │
│ 9:40        📶 🔋                  [X]     │ ← Close button
├─────────────────────────────────────────────┤
│                                             │
│                                             │
│  ←                                 →        │ Swipe Indicators
│  ╔═╗                           ╔═╗        │ (faint, idle)
│  ║X║                           ║✓║        │
│  ╚═╝                           ╚═╝        │
│  Reject                    Approve         │
│                                             │
│                                             │
│     ┌───────────────────────────────┐      │
│    ┌─────────────────────────────────┐     │ Card Stack
│   ┌───────────────────────────────────┐    │ (3 cards visible)
│   │                                   │    │
│   │  ╔═══════════════════════════╗   │    │ Current Card
│   │  ║                           ║   │    │ (scale: 1.0)
│   │  ║  🛠️  Tool Execution        ║   │    │ (breathing)
│   │  ║  ─────────────             ║   │    │
│   │  ║                           ║   │    │
│   │  ║  Created Note              ║   │    │
│   │  ║                           ║   │    │
│   │  ║  Title:                   ║   │    │
│   │  ║  "Q1 Planning Meeting"    ║   │    │
│   │  ║                           ║   │    │
│   │  ║  Content:                 ║   │    │
│   │  ║  "Discuss budget for      ║   │    │
│   │  ║   new quarter, review     ║   │    │
│   │  ║   team goals, allocate    ║   │    │
│   │  ║   resources..."           ║   │    │
│   │  ║                           ║   │    │
│   │  ║  📍 Context:               ║   │    │
│   │  ║  From: Chat 2m ago        ║   │    │
│   │  ║  Prompt: "Take a note     ║   │    │
│   │  ║          about meeting"   ║   │    │
│   │  ║                           ║   │    │
│   │  ║  Confidence: 0.87         ║   │    │
│   │  ║                           ║   │    │
│   │  ║  ← Swipe to Reject        ║   │    │
│   │  ║     Approve →             ║   │    │
│   │  ║                           ║   │    │
│   │  ║  [Tap for details]        ║   │    │
│   │  ║                           ║   │    │
│   │  ╚═══════════════════════════╝   │    │
│   │                                   │    │
│   └───────────────────────────────────┘    │
│    └─────────────────────────────────┘     │ Next Card
│     └───────────────────────────────┘      │ (scale: 0.95, 0.90)
│                                             │
│                                             │
│                                             │
│  Progress: 1 of 3                          │ Progress Indicator
│  ●  ○  ○                                   │
│                                             │
└─────────────────────────────────────────────┘
```

---

## Screen 3: Swipe Mode (Swiping Right - Approve)

```
┌─────────────────────────────────────────────┐
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ │
│ 9:40        📶 🔋                  [X]     │
├─────────────────────────────────────────────┤
│                                             │
│                                             │
│  ←                                 →        │
│  ╔═╗                           ╔═╗        │
│  ║X║                           ║✓║        │ ← RIGHT GLOWING
│  ╚═╝                           ╚═╝        │   (Green, intense)
│  Reject                    Approve         │
│     ↑                          ↑           │
│   Faint                    BRIGHT          │
│                                             │
│                                             │
│                 ┌─────────────────────╗    │ Card Rotated
│                 │                     ║    │ (~8° clockwise)
│                 │  ╔══════════════╗   ║    │ Translated Right
│                 │  ║              ║   ║    │ (+150pt)
│                 │  ║  Created Note║   ║    │
│                 │  ║              ║   ║    │
│                 │  ║  "Q1 Plan... ║   ║    │
│                 │  ║              ║   ║    │
│                 │  ╚══════════════╝   ║    │
│                 │                     ║    │
│                 └─────────────────────╝    │
│                                             │
│      ┌─────────────────────────────┐       │ Next Card
│     ┌───────────────────────────────┐      │ Moving Up
│    ┌─────────────────────────────────┐     │ (scale: 0.95→1.0)
│    │  🧠  Memory Association          │     │
│    │  "Prefers morning meetings"      │     │
│    └─────────────────────────────────┘     │
│                                             │
│  Progress: 1 of 3                          │
│  ●  ○  ○                                   │
│                                             │
└─────────────────────────────────────────────┘
```

**State Changes**:

- Current card: `translateX: +150pt`, `rotateZ: +8°`
- Right indicator: `opacity: 0.8` (from 0), `glow: intense`
- Haptic: **Medium impact** (triggered at 120pt)
- Next card: Starting to scale up (0.95 → 0.98)

---

## Screen 4: Swipe Complete - Approval

```
┌─────────────────────────────────────────────┐
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ │
│ 9:40        📶 🔋                  [X]     │
├─────────────────────────────────────────────┤
│                                             │
│                                             │
│  ←                                 →        │
│  ╔═╗                           ╔═╗        │
│  ║X║                           ║✓║        │
│  ╚═╝                           ╚═╝        │
│  Reject                    Approve         │
│                                             │
│                                             │
│                                             │
│         ✓                                   │ Green Checkmark
│      ✓     ✓                                │ (pulsing)
│         ✓                                   │
│                                             │
│                                             │
│   ┌─────────────────────────────────┐      │
│  ┌───────────────────────────────────┐     │ New Current Card
│ ┌─────────────────────────────────────┐    │ (was Next)
│ │                                     │    │
│ │  ╔═══════════════════════════════╗ │    │
│ │  ║                               ║ │    │
│ │  ║  🧠  Memory Association       ║ │    │
│ │  ║  ─────────────────            ║ │    │
│ │  ║                               ║ │    │
│ │  ║  Learned Preference           ║ │    │
│ │  ║                               ║ │    │
│ │  ║  "You prefer meetings         ║ │    │
│ │  ║   scheduled after 10am"       ║ │    │
│ │  ║                               ║ │    │
│ │  ║  Evidence:                    ║ │    │
│ │  ║  • 3 reschedules from 9am     ║ │    │
│ │  ║  • Said "too early" 2x        ║ │    │
│ │  ║                               ║ │    │
│ │  ║  Confidence: 0.73             ║ │    │
│ │  ║                               ║ │    │
│ │  ║  ← Swipe to Reject            ║ │    │
│ │  ║     Confirm →                 ║ │    │
│ │  ║                               ║ │    │
│ │  ╚═══════════════════════════════╝ │    │
│ │                                     │    │
│ └─────────────────────────────────────┘    │
│  └───────────────────────────────────┘     │
│   └─────────────────────────────────┘      │
│                                             │
│  Progress: 2 of 3                          │
│  ●  ●  ○                                   │
│                                             │
│  ┌───────────────────────────────────────┐ │ Toast
│  │  ✓ Approved                           │ │ (fading out)
│  └───────────────────────────────────────┘ │
└─────────────────────────────────────────────┘
```

**Timing**:

```
t=0ms:     Release finger (swipe > threshold)
t=0-300ms: Card flies off right, green flash
t=100ms:   Haptic success feedback
t=150ms:   Toast slides up: "✓ Approved"
t=200ms:   Stack animates up
t=300ms:   New card becomes current
t=1000ms:  Toast fades out
```

---

## Screen 5: Swipe Mode (Swiping Left - Reject)

```
┌─────────────────────────────────────────────┐
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ │
│ 9:40        📶 🔋                  [X]     │
├─────────────────────────────────────────────┤
│                                             │
│                                             │
│  ←                                 →        │
│  ╔═╗                           ╔═╗        │ ← LEFT GLOWING
│  ║X║                           ║✓║        │   (Red, intense)
│  ╚═╝                           ╚═╝        │
│  Reject                    Approve         │
│     ↑                          ↑           │
│  BRIGHT                      Faint         │
│                                             │
│                                             │
│   ╔─────────────────────────────            │ Card Rotated
│   ║                             │           │ (~8° counter-
│   ║  ╔══════════════╗            │           │  clockwise)
│   ║  ║              ║            │           │ Translated Left
│   ║  ║  Memory Assoc║            │           │ (-150pt)
│   ║  ║              ║            │           │
│   ║  ║  "Prefers... ║            │           │
│   ║  ║              ║            │           │
│   ║  ╚══════════════╝            │           │
│   ║                             │           │
│   ╚─────────────────────────────            │
│                                             │
│           ┌─────────────────────────┐       │
│          ┌───────────────────────────┐      │
│         ┌─────────────────────────────┐     │
│         │  💬  Message Quality         │     │
│         │  Response style check        │     │
│         └─────────────────────────────┘     │
│                                             │
│  Progress: 2 of 3                          │
│  ●  ●  ○                                   │
│                                             │
└─────────────────────────────────────────────┘
```

---

## Screen 6: Rejection - Correction Options

```
┌─────────────────────────────────────────────┐
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ │
│ 9:40        📶 🔋                  [X]     │
├─────────────────────────────────────────────┤
│                                             │
│         ✗                                   │ Red X
│      ✗     ✗                                │ (pulsing)
│         ✗                                   │
│                                             │
│  ╔═══════════════════════════════════════╗ │ Bottom Sheet
│  ║ ────────                               ║ │ (slides up)
│  ║                                        ║ │
│  ║  How would you like to handle this?   ║ │
│  ║                                        ║ │
│  ║  ┌─────────────────────────────────┐  ║ │
│  ║  │  ✏️  Provide Correct Version    │  ║ │ Option 1
│  ║  │                                 │  ║ │
│  ║  │  I'll show you what it should  │  ║ │
│  ║  │  have been                      │  ║ │
│  ║  └─────────────────────────────────┘  ║ │
│  ║                                        ║ │
│  ║  ┌─────────────────────────────────┐  ║ │
│  ║  │  🗑️  Delete & Forget            │  ║ │ Option 2
│  ║  │                                 │  ║ │
│  ║  │  This was completely wrong     │  ║ │
│  ║  └─────────────────────────────────┘  ║ │
│  ║                                        ║ │
│  ║  ┌─────────────────────────────────┐  ║ │
│  ║  │  ⚠️  Mark as Low Confidence     │  ║ │ Option 3
│  ║  │                                 │  ║ │
│  ║  │  Downgrade but don't delete    │  ║ │
│  ║  └─────────────────────────────────┘  ║ │
│  ║                                        ║ │
│  ║  ┌─────────────────────────────────┐  ║ │
│  ║  │  ↩️  Skip for Now               │  ║ │ Option 4
│  ║  │                                 │  ║ │
│  ║  │  I'll decide later              │  ║ │
│  ║  └─────────────────────────────────┘  ║ │
│  ║                                        ║ │
│  ╚═══════════════════════════════════════╝ │
└─────────────────────────────────────────────┘
```

---

## Screen 7: Details Modal (Tap Card)

```
┌─────────────────────────────────────────────┐
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ │
│ 9:40        📶 🔋                  [X]     │
├─────────────────────────────────────────────┤
│  ╔═══════════════════════════════════════╗ │
│  ║ ────────                               ║ │ Drag Handle
│  ║                                        ║ │
│  ║  Review Details                        ║ │ Title
│  ║                                        ║ │
│  ║  ───────────────────────────────────── ║ │ Divider
│  ║                                        ║ │
│  ║  Context                               ║ │ Section 1
│  ║  ════════                              ║ │
│  ║                                        ║ │
│  ║  From conversation (2m ago):           ║ │
│  ║                                        ║ │
│  ║  You: "Take a note about the meeting  ║ │
│  ║        tomorrow with the product team"║ │
│  ║                                        ║ │
│  ║  Alfred: "I've created a note with   ║ │
│  ║          the title 'Q1 Planning..."  ║ │
│  ║                                        ║ │
│  ║  ───────────────────────────────────── ║ │
│  ║                                        ║ │
│  ║  Reasoning                             ║ │ Section 2
│  ║  ═════════                             ║ │
│  ║                                        ║ │
│  ║  I inferred:                           ║ │
│  ║  • Title from "meeting" keyword        ║ │
│  ║  • Added calendar context from history║ │
│  ║  • Used your preference for brief     ║ │
│  ║    note format                         ║ │
│  ║                                        ║ │
│  ║  Confidence: 0.87                      ║ │
│  ║  ────────────────                      ║ │
│  ║  Based on:                             ║ │
│  ║  • 12 similar notes created           ║ │
│  ║  • 11/12 approved in past             ║ │
│  ║                                        ║ │
│  ║  ───────────────────────────────────── ║ │
│  ║                                        ║ │
│  ║  Related Memories                      ║ │ Section 3
│  ║  ════════════════                      ║ │
│  ║                                        ║ │
│  ║  • You prefer brief notes (0.92)      ║ │
│  ║  • Work meetings → calendar (0.88)    ║ │
│  ║  • Product team = Sarah, Tom (0.95)   ║ │
│  ║                                        ║ │
│  ║  ───────────────────────────────────── ║ │
│  ║                                        ║ │
│  ║  [Ask ALFRED to Explain More]          ║ │ Action Button
│  ║                                        ║ │
│  ╠═══════════════════════════════════════╣ │
│  ║                                        ║ │
│  ║  [Approve]  [Reject]  [Edit Note]     ║ │ Primary Actions
│  ║                                        ║ │
│  ╚═══════════════════════════════════════╝ │
└─────────────────────────────────────────────┘
```

**Modal Features**:

- Height: 70% of screen (snap point)
- Backdrop: Blur + dim (glass.glow)
- Swipe down to dismiss
- Scroll for full content
- Tap outside to close

---

## Screen 8: Queue Complete

```
┌─────────────────────────────────────────────┐
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ │
│ 9:40        📶 🔋                          │
├─────────────────────────────────────────────┤
│                                             │
│                                             │
│                                             │
│              ✓                              │
│           ✓     ✓                           │ Success Icon
│        ✓     ✓     ✓                        │ (large, glowing)
│           ✓     ✓                           │
│              ✓                              │
│                                             │
│                                             │
│         All Caught Up!                      │ Title
│                                             │
│    You reviewed 3 actions today            │ Subtitle
│                                             │
│                                             │
│  ╔═══════════════════════════════════════╗ │
│  ║                                        ║ │ Stats Card
│  ║  Today's Review Stats                  ║ │
│  ║  ════════════════════                  ║ │
│  ║                                        ║ │
│  ║  Reviewed:  3 actions                  ║ │
│  ║  Approved:  2  (67%)                   ║ │
│  ║  Rejected:  1  (33%)                   ║ │
│  ║                                        ║ │
│  ║  Time:  45 seconds                     ║ │
│  ║  Avg per review:  15s                  ║ │
│  ║                                        ║ │
│  ╚═══════════════════════════════════════╝ │
│                                             │
│                                             │
│  ┌─────────────────────────────────────┐   │
│  │        View Analytics               │   │ Secondary Action
│  └─────────────────────────────────────┘   │
│                                             │
│  ┌─────────────────────────────────────┐   │
│  │        Back to Home                 │   │ Primary Action
│  └─────────────────────────────────────┘   │
│                                             │
└─────────────────────────────────────────────┘
```

---

## Screen 9: Analytics Dashboard

```
┌─────────────────────────────────────────────┐
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ │
│ 9:40        📶 🔋                    ←    │
├─────────────────────────────────────────────┤
│                                             │
│  Review Analytics                           │
│                                             │
│  ┌───────────────────┐  ┌───────────────┐  │
│  │  This Week        │  │  This Month   │  │ Pill Tabs
│  └───────────────────┘  └───────────────┘  │
│       ●                      ○              │
│                                             │
├─────────────────────────────────────────────┤
│                                             │
│  ╔═══════════════════════════════════════╗ │
│  ║                                        ║ │
│  ║  Overview                              ║ │
│  ║  ════════                              ║ │
│  ║                                        ║ │
│  ║  ┌─────────────┐  ┌─────────────┐     ║ │ Number Cards
│  ║  │     23      │  │     83%     │     ║ │
│  ║  │  Reviewed   │  │  Approved   │     ║ │
│  ║  └─────────────┘  └─────────────┘     ║ │
│  ║                                        ║ │
│  ║  ┌─────────────┐  ┌─────────────┐     ║ │
│  ║  │     3       │  │     15s     │     ║ │
│  ║  │  Rejected   │  │  Avg Time   │     ║ │
│  ║  └─────────────┘  └─────────────┘     ║ │
│  ║                                        ║ │
│  ╚═══════════════════════════════════════╝ │
│                                             │
│  ╔═══════════════════════════════════════╗ │
│  ║                                        ║ │
│  ║  Approval Rate by Type                 ║ │
│  ║  ══════════════════════                ║ │
│  ║                                        ║ │
│  ║  Tool Executions    ████████░░  80%   ║ │ Bar Chart
│  ║  Messages           ██████████  100%  ║ │
│  ║  Memories           ████░░░░░░  40%   ║ │
│  ║  Workflows          ████████░░  80%   ║ │
│  ║                                        ║ │
│  ╚═══════════════════════════════════════╝ │
│                                             │
│  ╔═══════════════════════════════════════╗ │
│  ║                                        ║ │
│  ║  Top Approved Actions                  ║ │
│  ║  ═══════════════════                   ║ │
│  ║                                        ║ │
│  ║  1. Create Note           12/12  ✓    ║ │ List
│  ║  2. Set Reminder           5/6   ✓    ║ │
│  ║  3. Start Timer            3/3   ✓    ║ │
│  ║                                        ║ │
│  ╚═══════════════════════════════════════╝ │
│                                             │
│  ╔═══════════════════════════════════════╗ │
│  ║                                        ║ │
│  ║  Needs Attention                       ║ │
│  ║  ═══════════════                       ║ │
│  ║                                        ║ │
│  ║  ⚠️  Memory inferences: 40% rejected  ║ │ Warning
│  ║      → ALFRED will ask before learning ║ │
│  ║                                        ║ │
│  ╚═══════════════════════════════════════╝ │
│                                             │
└─────────────────────────────────────────────┘
```

---

## UX Enhancements

### 1. Smart Suggestions

After rejecting a tool execution, suggest pattern:

```
┌─────────────────────────────────────────────┐
│  You rejected this note creation            │
│                                             │
│  Would you like to add a rule?              │
│                                             │
│  ┌─────────────────────────────────────┐   │
│  │  Rule: "When I say 'note about     │   │
│  │   [topic]', ask me to confirm      │   │
│  │   before creating"                  │   │
│  └─────────────────────────────────────┘   │
│                                             │
│  [Yes, Add Rule]  [No Thanks]              │
└─────────────────────────────────────────────┘
```

### 2. Review Reminders

Daily notification if pending reviews > 0:

```
┌─────────────────────────────────────────────┐
│  ALFRED                           🔔        │
│                                             │
│  3 actions waiting for review               │
│                                             │
│  Take 30 seconds to help ALFRED learn       │
│  what you prefer.                           │
│                                             │
│  [Review Now]  [Later]                     │
└─────────────────────────────────────────────┘
```

### 3. Batch Review

For similar actions:

```
┌─────────────────────────────────────────────┐
│  ╔═══════════════════════════════════════╗ │
│  ║                                        ║ │
│  ║  5 Notes Created Today                 ║ │
│  ║  ══════════════════                    ║ │
│  ║                                        ║ │
│  ║  All created via "take a note about"  ║ │
│  ║  command. All have similar format.     ║ │
│  ║                                        ║ │
│  ║  ┌─────────────────────────────────┐  ║ │
│  ║  │  Approve All (5)                │  ║ │
│  ║  └─────────────────────────────────┘  ║ │
│  ║                                        ║ │
│  ║  ┌─────────────────────────────────┐  ║ │
│  ║  │  Review Each Individually       │  ║ │
│  ║  └─────────────────────────────────┘  ║ │
│  ║                                        ║ │
│  ╚═══════════════════════════════════════╝ │
└─────────────────────────────────────────────┘
```

### 4. Learning Progress

Show how reviews improve ALFRED:

```
┌─────────────────────────────────────────────┐
│  ╔═══════════════════════════════════════╗ │
│  ║                                        ║ │
│  ║  ALFRED is Learning                    ║ │
│  ║  ══════════════════                    ║ │
│  ║                                        ║ │
│  ║  After 5 approvals of "create note":  ║ │
│  ║                                        ║ │
│  ║  Confidence: 0.65 → 0.98  ✓            ║ │ Progress Bar
│  ║  ████████████████████░                 ║ │
│  ║                                        ║ │
│  ║  Future notes will be auto-approved!  ║ │
│  ║                                        ║ │
│  ║  [View Learning History]               ║ │
│  ║                                        ║ │
│  ╚═══════════════════════════════════════╝ │
└─────────────────────────────────────────────┘
```

---

## Animation Choreography

### Approval Sequence (600ms total)

```
t=0ms:     Swipe release (distance > 120pt)
           ├─ Card translateX: 0 → 400
           ├─ Card rotateZ: 0 → 15°
           └─ Haptic: success

t=100ms:   Green flash screen overlay
           └─ Opacity: 0 → 0.3 → 0

t=150ms:   Toast slides up
           └─ "✓ Approved"

t=200ms:   Stack animates up
           ├─ Card 2: scale 0.95 → 1.0, y 20 → 0
           └─ Card 3: scale 0.90 → 0.95, y 40 → 20

t=300ms:   Card exits fully
           └─ Remove from DOM

t=1000ms:  Toast fades out

Total: 1000ms
```

### Rejection Sequence (800ms total)

```
t=0ms:     Swipe release (distance > 120pt left)
           ├─ Card translateX: 0 → -400
           ├─ Card rotateZ: 0 → -15°
           └─ Haptic: warning

t=100ms:   Red flash screen overlay
           └─ Opacity: 0 → 0.3 → 0

t=300ms:   Card exits fully
           └─ Remove from DOM

t=400ms:   Bottom sheet slides up
           ├─ Correction options
           └─ Backdrop blur

Total: 800ms
```

---

## Performance Budget

```
Metric                    | Budget  | Measured | Status
--------------------------|---------|----------|--------
Card swipe frame time     | <16ms   | 14ms     | ✓
Stack animation           | <16ms   | 12ms     | ✓
Glow opacity update       | <8ms    | 6ms      | ✓
Modal expansion           | <16ms   | 15ms     | ✓
Queue list scroll         | <16ms   | 11ms     | ✓
```

---

## Accessibility Specification

### VoiceOver Flow

**Queue Screen**:

```
VoiceOver: "Reviews. 3 pending reviews."
User: Swipe right
VoiceOver: "Tool Execution. Created note Q1 Planning. 2 minutes ago. Button."
User: Double tap
VoiceOver: "Start reviewing button"
User: Double tap
→ Enters swipe mode
```

**Swipe Mode**:

```
VoiceOver: "Review card. Tool Execution. Created note Q1 Planning Meeting.
           Swipe right to approve, left to reject, or tap for details."
User: Swipe right (custom action)
VoiceOver: "Approved"
→ Advances to next card
```

### Reduced Motion

When `reduceMotion === true`:

- Disable breathing animation on cards
- Disable swipe rotation
- Use instant fade instead of spring
- Keep haptic feedback (important for blind users)

### Touch Targets

All interactive elements validated:

```
Element              | Size    | Meets 44pt?
---------------------|---------|-------------
Review card          | 320×500 | ✓
Approve button       | 100×48  | ✓
Reject button        | 100×48  | ✓
Details button       | 44×44   | ✓
Filter pill          | 60×32   | ✗ (visual only)
Start reviewing btn  | 320×56  | ✓
```

---

_Visual Mockups v1.0_  
_Ready for Development Handoff_
