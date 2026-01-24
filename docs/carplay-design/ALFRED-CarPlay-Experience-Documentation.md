# ALFRED CarPlay Experience
## Complete Design & Architecture Documentation

---

# Part 1: CarPlay UI Specifications

## 1.1 Design System Adaptation

### Void Aesthetic in CarPlay Constraints

CarPlay enforces strict UI templates, but ALFRED's "Signal in the Void" aesthetic translates through careful use of allowed customizations:

| Design System Element | CarPlay Translation |
|----------------------|---------------------|
| Void background | CarPlay dark mode (system-enforced black) |
| Biolum text hierarchy | Template text styles (primary/secondary/tertiary) |
| Glow effects | Tint color on icons and highlights |
| Breathing animation | Not available (static templates) |
| HUD surfaces | Card-based template layouts |
| Orb | App icon + custom imagery in templates |

### Tint Color Strategy

CarPlay allows a single tint color that applies to icons and interactive elements:

```
ALFRED CarPlay Tint: #E5E5E5 (biolum.bright)

Rationale: Pure white (#FCFCFC) is too harsh in dark car environments.
           Slightly dimmed white maintains void aesthetic while being
           comfortable for night driving.
```

### Typography Mapping

| ALFRED System | CarPlay Equivalent | Usage |
|---------------|-------------------|-------|
| Display Medium | CPListItem.text (primary) | Workflow titles, alert headlines |
| Body Large | CPListItem.detailText | Status descriptions, summaries |
| Caption Medium | Tertiary text | Timestamps, metadata |
| Mono Medium | Not available | N/A (no monospace in CarPlay) |

---

## 1.2 Template Specifications

### Template A: Dashboard Widget

**CarPlay Template:** CPDashboardButton (iOS 17.4+)

**Purpose:** Glanceable agent status without launching app

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        DASHBOARD WIDGET SPEC                            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  LAYOUT (2×1 Dashboard Button)                                          │
│  ═════════════════════════════                                          │
│                                                                         │
│  ┌─────────────────────────────────────┐                                │
│  │  ┌────┐                             │                                │
│  │  │ ◉  │  Auth Refactor              │  ← Primary: Workflow name      │
│  │  │    │  ████████░░ 73%             │  ← Secondary: Progress         │
│  │  └────┘                             │                                │
│  └─────────────────────────────────────┘                                │
│                                                                         │
│  ICON STATES                                                            │
│  ═══════════                                                            │
│                                                                         │
│  ◉  Running     │  Animated dots (if supported) or solid orb            │
│  ◐  Thinking    │  Half-filled orb                                      │
│  ⏸  Paused      │  Pause symbol                                         │
│  ●  Blocked     │  Solid with alert badge                               │
│  ✓  Complete    │  Checkmark                                            │
│                                                                         │
│  TAP ACTION                                                             │
│  ══════════                                                             │
│                                                                         │
│  Opens ALFRED app to Workflow Detail (InformationTemplate)              │
│                                                                         │
│  REFRESH RATE                                                           │
│  ════════════                                                           │
│                                                                         │
│  Every 30 seconds via background refresh                                │
│  Immediate on significant state change (completion, error, escalation)  │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

### Template B: Escalation Alert

**CarPlay Template:** CPAlertTemplate

**Purpose:** Interrupt user when agent needs human decision

```
┌─────────────────────────────────────────────────────────────────────────┐
│                       ESCALATION ALERT SPEC                             │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  VISUAL LAYOUT                                                          │
│  ═════════════                                                          │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                                                                 │    │
│  │                          ⚠                                      │    │
│  │                                                                 │    │
│  │              Agent Needs Your Decision                          │    │
│  │                                                                 │    │
│  │     Should I delete the deprecated API endpoint                 │    │
│  │     or maintain backward compatibility?                         │    │
│  │                                                                 │    │
│  │     Workflow: Auth Refactor                                     │    │
│  │     Blocking for: 12 minutes                                    │    │
│  │                                                                 │    │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │    │
│  │  │   Delete    │  │    Keep     │  │   Later     │             │    │
│  │  └─────────────┘  └─────────────┘  └─────────────┘             │    │
│  │                                                                 │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                         │
│  ALERT PRIORITY LEVELS                                                  │
│  ═════════════════════                                                  │
│                                                                         │
│  Critical (interrupts navigation):                                      │
│    • Security-sensitive decisions                                       │
│    • Production deployment approvals                                    │
│    • Merge conflicts in protected branches                              │
│                                                                         │
│  High (shows immediately when safe):                                    │
│    • Standard escalations requiring human input                         │
│    • PR approval requests                                               │
│    • Resource provisioning approvals                                    │
│                                                                         │
│  Normal (queued for next interaction):                                  │
│    • Non-blocking questions                                             │
│    • Informational updates                                              │
│                                                                         │
│  ACTION BUTTONS (Maximum 3)                                             │
│  ══════════════════════════                                             │
│                                                                         │
│  Primary action    │  Destructive styling if irreversible               │
│  Secondary action  │  Standard styling                                  │
│  Defer action      │  "Later" / "Remind me" / "Skip"                    │
│                                                                         │
│  VOICE ANNOUNCEMENT (Automatic)                                         │
│  ══════════════════════════════                                         │
│                                                                         │
│  On alert presentation, TTS reads:                                      │
│  "Alfred needs your decision. [Title]. [Detail]. Say Delete,            │
│   Keep, or Later."                                                      │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

### Template C: Workflow NowPlaying

**CarPlay Template:** CPNowPlayingTemplate

**Purpose:** Stream workflow status updates as audio experience

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      WORKFLOW NOWPLAYING SPEC                           │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  VISUAL LAYOUT                                                          │
│  ═════════════                                                          │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                                                                 │    │
│  │                     ┌───────────────┐                           │    │
│  │                     │               │                           │    │
│  │                     │      ◉        │  ← Album art = Orb        │    │
│  │                     │    ALFRED     │    with workflow icon     │    │
│  │                     │               │                           │    │
│  │                     └───────────────┘                           │    │
│  │                                                                 │    │
│  │                    Auth Refactor                                │    │
│  │                    Working on: Integration tests                │    │
│  │                                                                 │    │
│  │         ════════════════════════░░░░░░░░                        │    │
│  │         12:34                              18:00 est            │    │
│  │                                                                 │    │
│  │              ⏮      ⏸      ⏭                                  │    │
│  │                                                                 │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                         │
│  TRANSPORT CONTROLS MAPPING                                             │
│  ═══════════════════════════                                            │
│                                                                         │
│  ⏮  Previous    │  Repeat last status update                           │
│  ⏸  Pause       │  Pause TTS updates (workflow continues)              │
│  ▶  Play        │  Resume TTS updates                                  │
│  ⏭  Next        │  Skip to latest status / next pending item           │
│                                                                         │
│  STEERING WHEEL CONTROLS                                                │
│  ═══════════════════════                                                │
│                                                                         │
│  Volume +/-     │  Standard audio volume                                │
│  Track +/-      │  Next/Previous status update                          │
│  Play/Pause     │  Toggle TTS stream                                    │
│  Voice button   │  Activate voice command mode                          │
│                                                                         │
│  PROGRESS BAR                                                           │
│  ════════════                                                           │
│                                                                         │
│  Shows workflow progress (0-100%)                                       │
│  Left timestamp: Elapsed time                                           │
│  Right timestamp: Estimated completion                                  │
│  Scrubbing: Not functional (progress is informational only)             │
│                                                                         │
│  ALBUM ART VARIATIONS                                                   │
│  ═════════════════════                                                  │
│                                                                         │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐                    │
│  │    ◉    │  │    ◐    │  │    ⚡   │  │    ✓    │                    │
│  │ Running │  │Thinking │  │Executing│  │Complete │                    │
│  └─────────┘  └─────────┘  └─────────┘  └─────────┘                    │
│                                                                         │
│  TTS UPDATE CADENCE                                                     │
│  ══════════════════                                                     │
│                                                                         │
│  Automatic announcement on:                                             │
│    • Task completion within workflow                                    │
│    • Phase transition (e.g., "tests" → "deployment")                    │
│    • Error or warning encountered                                       │
│    • Escalation required                                                │
│                                                                         │
│  Manual trigger via ⏭ (Next) to hear current status on demand          │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

### Template D: Decision Queue

**CarPlay Template:** CPListTemplate

**Purpose:** Review and action pending decisions in batch

```
┌─────────────────────────────────────────────────────────────────────────┐
│                       DECISION QUEUE SPEC                               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  VISUAL LAYOUT                                                          │
│  ═════════════                                                          │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                                                                 │    │
│  │  Pending Decisions                                    3 items   │    │
│  │  ─────────────────────────────────────────────────────────────  │    │
│  │                                                                 │    │
│  │  ┌─────────────────────────────────────────────────────────┐   │    │
│  │  │  🔴  PR #142: Merge conflict                            │   │    │
│  │  │      package.json • Auth Refactor • 23 min ago          │   │    │
│  │  └─────────────────────────────────────────────────────────┘   │    │
│  │                                                                 │    │
│  │  ┌─────────────────────────────────────────────────────────┐   │    │
│  │  │  🟡  Credentials needed                                 │   │    │
│  │  │      AWS deployment • Deploy Pipeline • 8 min ago       │   │    │
│  │  └─────────────────────────────────────────────────────────┘   │    │
│  │                                                                 │    │
│  │  ┌─────────────────────────────────────────────────────────┐   │    │
│  │  │  🟡  Security review                                    │   │    │
│  │  │      auth.ts flagged • Code Review • 2 min ago          │   │    │
│  │  └─────────────────────────────────────────────────────────┘   │    │
│  │                                                                 │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                         │
│  LIST ITEM STRUCTURE                                                    │
│  ════════════════════                                                   │
│                                                                         │
│  ┌──────┬────────────────────────────────────────────────┬───────┐     │
│  │ Icon │  Primary text (decision title)                 │ Badge │     │
│  │      │  Secondary text (context • workflow • time)    │       │     │
│  └──────┴────────────────────────────────────────────────┴───────┘     │
│                                                                         │
│  PRIORITY INDICATORS                                                    │
│  ════════════════════                                                   │
│                                                                         │
│  🔴  Critical    │  Blocking production or security-related             │
│  🟡  High        │  Blocking workflow progress                          │
│  🟢  Normal      │  Non-blocking, can defer                             │
│                                                                         │
│  TAP ACTION                                                             │
│  ══════════                                                             │
│                                                                         │
│  Opens Decision Detail (CPInformationTemplate) with:                    │
│    • Full context of the decision                                       │
│    • Available actions as buttons                                       │
│    • Voice command hints                                                │
│                                                                         │
│  SORTING                                                                │
│  ═══════                                                                │
│                                                                         │
│  Primary: Priority (Critical → High → Normal)                           │
│  Secondary: Time waiting (oldest first)                                 │
│                                                                         │
│  EMPTY STATE                                                            │
│  ═══════════                                                            │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                                                                 │    │
│  │                          ✓                                      │    │
│  │                                                                 │    │
│  │                   All caught up                                 │    │
│  │              No pending decisions                               │    │
│  │                                                                 │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

### Template E: PR Summary

**CarPlay Template:** CPInformationTemplate

**Purpose:** Review and approve/reject completed work

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          PR SUMMARY SPEC                                │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  VISUAL LAYOUT                                                          │
│  ═════════════                                                          │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                                                                 │    │
│  │                     ┌───────────────┐                           │    │
│  │                     │      ✓        │                           │    │
│  │                     │   PR Ready    │                           │    │
│  │                     └───────────────┘                           │    │
│  │                                                                 │    │
│  │                 Add OAuth2 Support                              │    │
│  │                                                                 │    │
│  │  ───────────────────────────────────────────────────────────    │    │
│  │                                                                 │    │
│  │  Files changed                                          12      │    │
│  │  Lines added                                          +342      │    │
│  │  Lines removed                                         -89      │    │
│  │  Tests                                           47 passing     │    │
│  │  Coverage                                              94%      │    │
│  │  Build status                                       Passing     │    │
│  │                                                                 │    │
│  │  ───────────────────────────────────────────────────────────    │    │
│  │                                                                 │    │
│  │  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐       │    │
│  │  │Approve & Merge│  │Request Changes│  │  Review Later │       │    │
│  │  └───────────────┘  └───────────────┘  └───────────────┘       │    │
│  │                                                                 │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                         │
│  INFORMATION ITEMS (Maximum 10)                                         │
│  ══════════════════════════════                                         │
│                                                                         │
│  Required items:                                                        │
│    • Files changed (count)                                              │
│    • Lines added/removed                                                │
│    • Test status                                                        │
│    • Build status                                                       │
│                                                                         │
│  Optional items (if space):                                             │
│    • Coverage percentage                                                │
│    • Review comments                                                    │
│    • Linked issues                                                      │
│    • Time to complete                                                   │
│                                                                         │
│  ACTION BUTTONS                                                         │
│  ══════════════                                                         │
│                                                                         │
│  "Approve & Merge"     │  Confirms via voice, then merges               │
│  "Request Changes"     │  Opens voice input for change request          │
│  "Review Later"        │  Queues for desktop review, workflow continues │
│                                                                         │
│  POST-ACTION FLOW                                                       │
│  ════════════════                                                       │
│                                                                         │
│  After "Approve & Merge":                                               │
│    1. TTS: "Merging PR 142. One moment."                                │
│    2. API call to merge                                                 │
│    3. TTS: "PR merged successfully. Deployment starting."               │
│    4. Return to previous template or NowPlaying                         │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

### Template F: Multi-Agent Grid

**CarPlay Template:** CPGridTemplate

**Purpose:** Overview of all running agents

```
┌─────────────────────────────────────────────────────────────────────────┐
│                       MULTI-AGENT GRID SPEC                             │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  VISUAL LAYOUT (2×2 or 2×3 grid)                                        │
│  ═══════════════════════════════                                        │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                                                                 │    │
│  │  Active Agents                                                  │    │
│  │                                                                 │    │
│  │  ┌─────────────────────┐    ┌─────────────────────┐            │    │
│  │  │         ◉           │    │         ◐           │            │    │
│  │  │                     │    │                     │            │    │
│  │  │   Auth Refactor     │    │    Test Suite       │            │    │
│  │  │       73%           │    │      Thinking       │            │    │
│  │  └─────────────────────┘    └─────────────────────┘            │    │
│  │                                                                 │    │
│  │  ┌─────────────────────┐    ┌─────────────────────┐            │    │
│  │  │         ●           │    │         ✓           │            │    │
│  │  │                     │    │                     │            │    │
│  │  │  Deploy Pipeline    │    │   DB Migration      │            │    │
│  │  │      Blocked        │    │      Complete       │            │    │
│  │  └─────────────────────┘    └─────────────────────┘            │    │
│  │                                                                 │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                         │
│  GRID BUTTON STRUCTURE                                                  │
│  ══════════════════════                                                 │
│                                                                         │
│  ┌─────────────────────────────┐                                        │
│  │           Icon              │  ← State icon (orb variant)            │
│  │                             │                                        │
│  │      Workflow Name          │  ← Primary title                       │
│  │         Status              │  ← Secondary (% or state)              │
│  └─────────────────────────────┘                                        │
│                                                                         │
│  GRID ICONS BY STATE                                                    │
│  ════════════════════                                                   │
│                                                                         │
│  ◉  Active/Running    │  Green badge, animated if possible              │
│  ◐  Thinking          │  Neutral, pulsing                               │
│  ⏸  Paused            │  Gray, static                                   │
│  ●  Blocked           │  Red badge, requires attention                  │
│  ✓  Complete          │  Green checkmark                                │
│  ✕  Failed            │  Red X                                          │
│                                                                         │
│  TAP ACTION                                                             │
│  ══════════                                                             │
│                                                                         │
│  Opens workflow detail as InformationTemplate with full status          │
│  and available actions for that specific agent.                         │
│                                                                         │
│  MAXIMUM ITEMS                                                          │
│  ═════════════                                                          │
│                                                                         │
│  CarPlay grid supports up to 8 items                                    │
│  Show most relevant: Running → Blocked → Paused → Recently Complete     │
│  "View all" item if more than 8 agents active (opens ListTemplate)      │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

### Template G: ExecPlan Review

**CarPlay Template:** CPInformationTemplate

**Purpose:** Approve agent's proposed plan before execution begins

```
┌─────────────────────────────────────────────────────────────────────────┐
│                       EXECPLAN REVIEW SPEC                              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  VISUAL LAYOUT                                                          │
│  ═════════════                                                          │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                                                                 │    │
│  │                     ┌───────────────┐                           │    │
│  │                     │      📋       │                           │    │
│  │                     │  Plan Ready   │                           │    │
│  │                     └───────────────┘                           │    │
│  │                                                                 │    │
│  │              Migrate to PostgreSQL                              │    │
│  │                                                                 │    │
│  │  ───────────────────────────────────────────────────────────    │    │
│  │                                                                 │    │
│  │  Step 1                                       Schema design     │    │
│  │  Step 2                                   Migration scripts     │    │
│  │  Step 3                                        Update ORM       │    │
│  │  Step 4                                  Integration tests      │    │
│  │  Estimated time                                    4 hours      │    │
│  │  Risk level                                         Medium      │    │
│  │                                                                 │    │
│  │  ───────────────────────────────────────────────────────────    │    │
│  │                                                                 │    │
│  │  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐       │    │
│  │  │ Approve Plan  │  │ Modify Scope  │  │    Cancel     │       │    │
│  │  └───────────────┘  └───────────────┘  └───────────────┘       │    │
│  │                                                                 │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                         │
│  INFORMATION ITEMS                                                      │
│  ═════════════════                                                      │
│                                                                         │
│  • Step 1-N (up to 5 steps shown, "and N more" if exceeds)              │
│  • Estimated time                                                       │
│  • Risk level (Low / Medium / High)                                     │
│  • Files affected (count)                                               │
│  • Dependencies (if any)                                                │
│                                                                         │
│  ACTION BUTTONS                                                         │
│  ══════════════                                                         │
│                                                                         │
│  "Approve Plan"    │  Agent begins execution immediately                │
│  "Modify Scope"    │  Opens voice input to adjust plan                  │
│  "Cancel"          │  Aborts plan, agent idles                          │
│                                                                         │
│  VOICE SUMMARY (Auto-read on open)                                      │
│  ═════════════════════════════════                                      │
│                                                                         │
│  "Alfred proposes: Migrate to PostgreSQL in four steps.                 │
│   Schema design, migration scripts, update ORM, integration tests.      │
│   Estimated four hours at medium risk.                                  │
│   Say Approve, Modify, or Cancel."                                      │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

### Template H: Voice Command

**CarPlay Template:** CPVoiceControlTemplate

**Purpose:** Hands-free agent control

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      VOICE COMMAND SPEC                                 │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  VISUAL LAYOUT (Listening State)                                        │
│  ═══════════════════════════════                                        │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                                                                 │    │
│  │                                                                 │    │
│  │                     ┌───────────────┐                           │    │
│  │                     │               │                           │    │
│  │                     │      ◉        │  ← Orb, animated          │    │
│  │                     │               │                           │    │
│  │                     └───────────────┘                           │    │
│  │                                                                 │    │
│  │                    Listening...                                 │    │
│  │                                                                 │    │
│  │  ───────────────────────────────────────────────────────────    │    │
│  │                                                                 │    │
│  │  Try saying:                                                    │    │
│  │    "Check on auth refactor"                                     │    │
│  │    "Pause all workflows"                                        │    │
│  │    "What's blocking deployment?"                                │    │
│  │                                                                 │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                         │
│  VOICE COMMAND CATEGORIES                                               │
│  ════════════════════════                                               │
│                                                                         │
│  Status Queries:                                                        │
│    • "Check on [workflow name]"                                         │
│    • "What's the status?"                                               │
│    • "Any blockers?"                                                    │
│    • "How long until [workflow] completes?"                             │
│                                                                         │
│  Control Commands:                                                      │
│    • "Pause [workflow / all workflows]"                                 │
│    • "Resume [workflow]"                                                │
│    • "Cancel [workflow]"                                                │
│    • "Prioritize [workflow]"                                            │
│                                                                         │
│  Decision Commands:                                                     │
│    • "Approve"                                                          │
│    • "Reject"                                                           │
│    • "Delete it"                                                        │
│    • "Keep it"                                                          │
│    • "Skip" / "Later" / "Defer"                                         │
│                                                                         │
│  Task Assignment:                                                       │
│    • "Start a new workflow for [issue/task]"                            │
│    • "Fix [issue number]"                                               │
│    • "Deploy to [environment]"                                          │
│    • "Run tests"                                                        │
│                                                                         │
│  RECOGNITION FLOW                                                       │
│  ════════════════                                                       │
│                                                                         │
│  1. User presses voice button or says "Hey Siri, Alfred"                │
│  2. VoiceControlTemplate opens with listening animation                 │
│  3. Speech-to-text processes input                                      │
│  4. Intent recognition matches to command                               │
│  5. Confirmation TTS: "Pausing auth refactor. Confirmed."               │
│  6. Action executes                                                     │
│  7. Template dismisses or shows result                                  │
│                                                                         │
│  ERROR HANDLING                                                         │
│  ══════════════                                                         │
│                                                                         │
│  Unrecognized: "Sorry, I didn't catch that. Try 'check status'          │
│                 or 'pause workflow'."                                   │
│                                                                         │
│  Ambiguous:    "Which workflow? Auth refactor or deploy pipeline?"      │
│                                                                         │
│  No workflows: "No active workflows right now. Say 'start new'          │
│                 to begin one."                                          │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

# Part 2: Voice Interaction Scripts

## 2.1 TTS Voice Profile

### Voice Characteristics

```
┌─────────────────────────────────────────────────────────────────────────┐
│                       ALFRED TTS PROFILE                                │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Voice Selection:  iOS "Samantha" (Enhanced) or premium TTS API         │
│  Speaking Rate:    0.92x (slightly slower than default for clarity)     │
│  Pitch:            1.0 (neutral)                                        │
│  Tone:             Professional, calm, slightly warm                    │
│                                                                         │
│  PERSONALITY GUIDELINES                                                 │
│  ═════════════════════                                                  │
│                                                                         │
│  • Concise: Driving requires attention. No unnecessary words.           │
│  • Confident: State facts directly. Avoid hedging language.             │
│  • Actionable: Always end with what user can do next.                   │
│  • Calm: Even errors delivered without urgency/alarm.                   │
│  • Contextual: Knows user is driving, adapts detail level.              │
│                                                                         │
│  NEVER SAY                          INSTEAD SAY                         │
│  ──────────────                     ───────────                         │
│  "Um" / "Uh"                        [silence]                           │
│  "I think" / "Maybe"                "The workflow is..." (direct)       │
│  "Please" (excessive)               One "please" max per interaction    │
│  "Sorry to interrupt"               "Quick update:" or just state it    │
│  Technical jargon                   Plain language                      │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 2.2 Script Templates by Feature

### Escalation Alert Scripts

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     ESCALATION ALERT SCRIPTS                            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  STANDARD ESCALATION                                                    │
│  ═══════════════════                                                    │
│                                                                         │
│  Opening:                                                               │
│  "Alfred needs your decision."                                          │
│                                                                         │
│  Context:                                                               │
│  "[Workflow name]. [Decision question]."                                │
│                                                                         │
│  Options:                                                               │
│  "Say [Option 1], [Option 2], or Later."                                │
│                                                                         │
│  Example:                                                               │
│  "Alfred needs your decision. Auth refactor workflow. Should I          │
│   delete the deprecated API endpoint or maintain backward               │
│   compatibility? Say Delete, Keep, or Later."                           │
│                                                                         │
│  ─────────────────────────────────────────────────────────────────────  │
│                                                                         │
│  MERGE CONFLICT                                                         │
│  ══════════════                                                         │
│                                                                         │
│  "Alfred hit a merge conflict. [File name] in [workflow].               │
│   Say 'use mine', 'use theirs', or 'review later'."                     │
│                                                                         │
│  Example:                                                               │
│  "Alfred hit a merge conflict. Package dot json in auth refactor.       │
│   Say use mine, use theirs, or review later."                           │
│                                                                         │
│  ─────────────────────────────────────────────────────────────────────  │
│                                                                         │
│  CREDENTIALS NEEDED                                                     │
│  ══════════════════                                                     │
│                                                                         │
│  "[Workflow] needs [credential type] to continue.                       │
│   Say 'use saved', 'skip step', or 'pause workflow'."                   │
│                                                                         │
│  Example:                                                               │
│  "Deploy pipeline needs AWS credentials to continue.                    │
│   Say use saved, skip step, or pause workflow."                         │
│                                                                         │
│  ─────────────────────────────────────────────────────────────────────  │
│                                                                         │
│  SECURITY ALERT                                                         │
│  ══════════════                                                         │
│                                                                         │
│  "Security flag. [Description]. Review required before merge.           │
│   Say 'show details', 'approve anyway', or 'block merge'."              │
│                                                                         │
│  Example:                                                               │
│  "Security flag. Agent modified files containing API keys.              │
│   Review required before merge. Say show details, approve anyway,       │
│   or block merge."                                                      │
│                                                                         │
│  ─────────────────────────────────────────────────────────────────────  │
│                                                                         │
│  CONFIRMATION RESPONSES                                                 │
│  ══════════════════════                                                 │
│                                                                         │
│  On "Delete":    "Deleting deprecated endpoint. Workflow continuing."   │
│  On "Keep":      "Keeping backward compatibility. Workflow continuing." │
│  On "Later":     "Decision deferred. I'll remind you in 30 minutes."    │
│  On "Approve":   "Approved. Merging now."                               │
│  On "Block":     "Merge blocked. Flagged for desktop review."           │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

### Workflow Status Scripts

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     WORKFLOW STATUS SCRIPTS                             │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  PROGRESS UPDATE (NowPlaying)                                           │
│  ════════════════════════════                                           │
│                                                                         │
│  Template:                                                              │
│  "[Completed task]. Now working on: [Current task].                     │
│   [Progress metric]."                                                   │
│                                                                         │
│  Examples:                                                              │
│  "Completed: Unit tests. Now working on: Integration tests.             │
│   4 of 7 tasks complete."                                               │
│                                                                         │
│  "Refactoring auth module. 73% complete.                                │
│   Estimated 12 minutes remaining."                                      │
│                                                                         │
│  "Tests passing. 47 of 47. Now starting deployment."                    │
│                                                                         │
│  ─────────────────────────────────────────────────────────────────────  │
│                                                                         │
│  PHASE TRANSITION                                                       │
│  ════════════════                                                       │
│                                                                         │
│  Template:                                                              │
│  "Phase complete: [Phase name]. Starting: [Next phase]."                │
│                                                                         │
│  Examples:                                                              │
│  "Phase complete: Development. Starting: Code review."                  │
│  "Phase complete: Testing. Starting: Staging deployment."               │
│                                                                         │
│  ─────────────────────────────────────────────────────────────────────  │
│                                                                         │
│  WORKFLOW COMPLETE                                                      │
│  ═════════════════                                                      │
│                                                                         │
│  Template:                                                              │
│  "[Workflow name] complete. [Key outcome]. [Next action if any]."       │
│                                                                         │
│  Examples:                                                              │
│  "Auth refactor complete. PR ready for review.                          │
│   12 files changed, all tests passing."                                 │
│                                                                         │
│  "Database migration complete. Production updated.                      │
│   No action needed."                                                    │
│                                                                         │
│  "Deploy pipeline complete. Version 2.4.1 live on staging.              │
│   Say 'promote to prod' or 'run smoke tests'."                          │
│                                                                         │
│  ─────────────────────────────────────────────────────────────────────  │
│                                                                         │
│  ERROR ENCOUNTERED                                                      │
│  ═════════════════                                                      │
│                                                                         │
│  Template:                                                              │
│  "[Workflow name] hit an error. [Brief description].                    │
│   [Recovery options]."                                                  │
│                                                                         │
│  Examples:                                                              │
│  "Deploy pipeline hit an error. Build failed on test step.              │
│   Say 'show logs', 'retry', or 'pause'."                                │
│                                                                         │
│  "Auth refactor hit an error. Dependency conflict in package.           │
│   Say 'auto-resolve', 'show details', or 'pause'."                      │
│                                                                         │
│  ─────────────────────────────────────────────────────────────────────  │
│                                                                         │
│  STATUS CHECK RESPONSE                                                  │
│  ═════════════════════                                                  │
│                                                                         │
│  When user asks "What's the status?" or "Check on [workflow]":          │
│                                                                         │
│  Running:                                                               │
│  "[Workflow] is running. Currently [task]. [Progress]%.                 │
│   [Time estimate]."                                                     │
│                                                                         │
│  Paused:                                                                │
│  "[Workflow] is paused at [task]. Ready to resume.                      │
│   Say 'resume' to continue."                                            │
│                                                                         │
│  Blocked:                                                               │
│  "[Workflow] is blocked. Waiting on [blocker].                          │
│   [Action needed]."                                                     │
│                                                                         │
│  Complete:                                                              │
│  "[Workflow] completed [time ago]. [Outcome summary]."                  │
│                                                                         │
│  No workflows:                                                          │
│  "No active workflows. Say 'start new' to begin one."                   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

### PR Review Scripts

```
┌─────────────────────────────────────────────────────────────────────────┐
│                       PR REVIEW SCRIPTS                                 │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  PR READY ANNOUNCEMENT                                                  │
│  ═════════════════════                                                  │
│                                                                         │
│  Template:                                                              │
│  "PR ready. [Title]. [Key metrics]. Say 'details', 'approve',           │
│   or 'review later'."                                                   │
│                                                                         │
│  Example:                                                               │
│  "PR ready. Add OAuth 2 support. 12 files, plus 342 lines,              │
│   all tests passing. Say details, approve, or review later."            │
│                                                                         │
│  ─────────────────────────────────────────────────────────────────────  │
│                                                                         │
│  PR DETAILS (on request)                                                │
│  ════════════════════════                                               │
│                                                                         │
│  Template:                                                              │
│  "[Title]. [File count] files changed. [Lines added] added,             │
│   [lines removed] removed. [Test status]. [Coverage]%.                  │
│   [Build status]. Ready to approve?"                                    │
│                                                                         │
│  Example:                                                               │
│  "Add OAuth 2 support. 12 files changed. 342 lines added,               │
│   89 removed. 47 tests passing. 94% coverage. Build passing.            │
│   Ready to approve?"                                                    │
│                                                                         │
│  ─────────────────────────────────────────────────────────────────────  │
│                                                                         │
│  DIFF SUMMARY (Spoken)                                                  │
│  ═════════════════════                                                  │
│                                                                         │
│  Agent generates natural language summary of key changes:               │
│                                                                         │
│  "Main changes: In auth dot ts, replaced session token validation       │
│   with JWT verification. Added three test cases for token expiry.       │
│   User service now accepts optional refresh token. Config updated       │
│   with new OAuth endpoints."                                            │
│                                                                         │
│  ─────────────────────────────────────────────────────────────────────  │
│                                                                         │
│  APPROVAL CONFIRMATION                                                  │
│  ═════════════════════                                                  │
│                                                                         │
│  "Merging PR 142 into main. One moment."                                │
│  [2 second pause]                                                       │
│  "Merged successfully. CI pipeline started.                             │
│   I'll notify you when deployment completes."                           │
│                                                                         │
│  ─────────────────────────────────────────────────────────────────────  │
│                                                                         │
│  REQUEST CHANGES FLOW                                                   │
│  ═════════════════════                                                  │
│                                                                         │
│  Alfred: "What changes should I request?"                               │
│  User: "Add error handling to the token refresh"                        │
│  Alfred: "Requesting: Add error handling to token refresh.              │
│           Agent will address and update PR. Confirmed."                 │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

### Voice Command Response Scripts

```
┌─────────────────────────────────────────────────────────────────────────┐
│                   VOICE COMMAND RESPONSE SCRIPTS                        │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  CONTROL COMMANDS                                                       │
│  ════════════════                                                       │
│                                                                         │
│  "Pause workflow"                                                       │
│  → "Pausing [workflow name]. Will resume when you say 'resume'."        │
│                                                                         │
│  "Pause all"                                                            │
│  → "Pausing all [N] workflows. Ready to resume on command."             │
│                                                                         │
│  "Resume [workflow]"                                                    │
│  → "Resuming [workflow name]. Currently at [task]."                     │
│                                                                         │
│  "Cancel [workflow]"                                                    │
│  → "Cancel [workflow name]? This can't be undone. Say 'confirm'         │
│     or 'keep running'."                                                 │
│  → [On confirm] "Cancelled. Work saved to branch [branch name]."        │
│                                                                         │
│  "Prioritize [workflow]"                                                │
│  → "Moving [workflow] to top of queue. Will run next."                  │
│                                                                         │
│  ─────────────────────────────────────────────────────────────────────  │
│                                                                         │
│  STATUS QUERIES                                                         │
│  ══════════════                                                         │
│                                                                         │
│  "What's the status?"                                                   │
│  → [If one workflow] "[Workflow] status: [status details]."             │
│  → [If multiple] "You have [N] workflows. [Quick summary].              │
│     Say a name for details."                                            │
│                                                                         │
│  "Check on [workflow]"                                                  │
│  → "[Workflow] is [state]. [Current task]. [Progress/estimate]."        │
│                                                                         │
│  "Any blockers?"                                                        │
│  → [If yes] "Yes. [Workflow] blocked on [reason]. [Action needed]."     │
│  → [If no] "No blockers. All workflows running smoothly."               │
│                                                                         │
│  "How long until [workflow] completes?"                                 │
│  → "Estimated [time] remaining for [workflow].                          │
│     Currently on [task]."                                               │
│                                                                         │
│  ─────────────────────────────────────────────────────────────────────  │
│                                                                         │
│  TASK ASSIGNMENT                                                        │
│  ═══════════════                                                        │
│                                                                         │
│  "Start a new workflow for [description]"                               │
│  → "Creating workflow: [interpreted task]. I'll have a plan ready       │
│     in a moment."                                                       │
│  → [Plan ready] "Plan ready for [task]. [Step count] steps,             │
│     estimated [time]. Say 'approve' or 'modify'."                       │
│                                                                         │
│  "Fix issue [number]"                                                   │
│  → "Looking up issue [number]. [Issue title].                           │
│     Creating workflow to fix it. One moment."                           │
│                                                                         │
│  "Deploy to [environment]"                                              │
│  → "Starting deployment to [environment].                               │
│     Current version: [version]. Say 'confirm' to proceed."              │
│                                                                         │
│  "Run tests"                                                            │
│  → "Running test suite on [branch/repo]. I'll report results            │
│     when complete."                                                     │
│                                                                         │
│  ─────────────────────────────────────────────────────────────────────  │
│                                                                         │
│  ERROR RESPONSES                                                        │
│  ═══════════════                                                        │
│                                                                         │
│  Command not understood:                                                │
│  "Sorry, I didn't catch that. Try 'check status' or 'pause workflow'."  │
│                                                                         │
│  Workflow not found:                                                    │
│  "No workflow called [name]. Active workflows are:                      │
│   [list]. Which one?"                                                   │
│                                                                         │
│  Action not available:                                                  │
│  "Can't [action] right now. [Workflow] is [reason].                     │
│   Try [alternative action]."                                            │
│                                                                         │
│  No workflows active:                                                   │
│  "No active workflows. Say 'start new' followed by a task               │
│   description."                                                         │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 2.3 Audio Cues

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         AUDIO CUE SYSTEM                                │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Non-verbal audio cues supplement TTS for quicker recognition:          │
│                                                                         │
│  CUE               │ SOUND                │ MEANING                     │
│  ──────────────────┼──────────────────────┼─────────────────────────    │
│  Listening start   │ Soft rising tone     │ Alfred ready for input      │
│  Listening end     │ Soft falling tone    │ Processing command          │
│  Command confirmed │ Double tap/click     │ Action acknowledged         │
│  Escalation        │ Gentle chime         │ Decision needed (not alarm) │
│  Error             │ Low double-tone      │ Something went wrong        │
│  Complete          │ Ascending triad      │ Workflow/task finished      │
│  Blocked           │ Sustained tone       │ Attention needed            │
│                                                                         │
│  CHARACTERISTICS                                                        │
│  ═══════════════                                                        │
│                                                                         │
│  • All cues under 500ms duration                                        │
│  • Frequency range: 400-800Hz (audible over road noise, not jarring)    │
│  • Volume: 70% of TTS volume                                            │
│  • Style: Minimal, synthetic, matches void aesthetic                    │
│  • Never alarming—even errors are calm                                  │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

# Part 3: Implementation Architecture

## 3.1 System Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    ALFRED CARPLAY ARCHITECTURE                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                         CAR HEAD UNIT                           │    │
│  │  ┌─────────────────────────────────────────────────────────┐   │    │
│  │  │                    CarPlay Display                      │   │    │
│  │  │   ┌───────────┐  ┌───────────┐  ┌───────────┐          │   │    │
│  │  │   │ Templates │  │  Audio    │  │   Voice   │          │   │    │
│  │  │   │ (UI)      │  │  Output   │  │   Input   │          │   │    │
│  │  │   └─────┬─────┘  └─────┬─────┘  └─────┬─────┘          │   │    │
│  │  └─────────┼──────────────┼──────────────┼────────────────┘   │    │
│  └────────────┼──────────────┼──────────────┼────────────────────┘    │
│               │              │              │                          │
│               │         USB / WiFi          │                          │
│               │              │              │                          │
│  ┌────────────┼──────────────┼──────────────┼────────────────────┐    │
│  │            ▼              ▼              ▼                    │    │
│  │  ┌─────────────────────────────────────────────────────────┐ │    │
│  │  │                    ALFRED iOS APP                       │ │    │
│  │  │                                                         │ │    │
│  │  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │ │    │
│  │  │  │  CarPlay    │  │    TTS      │  │   Speech    │     │ │    │
│  │  │  │  Scene      │  │   Engine    │  │ Recognition │     │ │    │
│  │  │  │  Delegate   │  │             │  │             │     │ │    │
│  │  │  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘     │ │    │
│  │  │         │                │                │             │ │    │
│  │  │         ▼                ▼                ▼             │ │    │
│  │  │  ┌─────────────────────────────────────────────────┐   │ │    │
│  │  │  │            CarPlay Controller                   │   │ │    │
│  │  │  │  • Template management                          │   │ │    │
│  │  │  │  • State synchronization                        │   │ │    │
│  │  │  │  • Voice command routing                        │   │ │    │
│  │  │  │  • Audio session management                     │   │ │    │
│  │  │  └────────────────────┬────────────────────────────┘   │ │    │
│  │  │                       │                                 │ │    │
│  │  │                       ▼                                 │ │    │
│  │  │  ┌─────────────────────────────────────────────────┐   │ │    │
│  │  │  │            ALFRED Core Services                 │   │ │    │
│  │  │  │  ┌───────────┐ ┌───────────┐ ┌───────────┐     │   │ │    │
│  │  │  │  │ Workflow  │ │  State    │ │   Push    │     │   │ │    │
│  │  │  │  │ Manager   │ │   Store   │ │  Handler  │     │   │ │    │
│  │  │  │  └───────────┘ └───────────┘ └───────────┘     │   │ │    │
│  │  │  └────────────────────┬────────────────────────────┘   │ │    │
│  │  │                       │                                 │ │    │
│  │  └───────────────────────┼─────────────────────────────────┘ │    │
│  │                          │                                   │    │
│  │  iPhone                  │ WebSocket / HTTPS                 │    │
│  └──────────────────────────┼───────────────────────────────────┘    │
│                             │                                        │
│                             ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────┐  │
│  │                     ALFRED BACKEND                              │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │  │
│  │  │ Orchestrator│  │  Workflow   │  │    Agent    │             │  │
│  │  │   API       │  │   Engine    │  │   Runtime   │             │  │
│  │  └─────────────┘  └─────────────┘  └─────────────┘             │  │
│  └─────────────────────────────────────────────────────────────────┘  │
│                                                                       │
└───────────────────────────────────────────────────────────────────────┘
```

---

## 3.2 Component Responsibilities

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    COMPONENT RESPONSIBILITIES                           │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  CARPLAY SCENE DELEGATE                                                 │
│  ══════════════════════                                                 │
│                                                                         │
│  Lifecycle:                                                             │
│    • Connects/disconnects CarPlay sessions                              │
│    • Creates root template (TabBar or single template)                  │
│    • Handles scene activation/deactivation                              │
│                                                                         │
│  Template Management:                                                   │
│    • Presents alerts (escalations)                                      │
│    • Pushes/pops navigation stack                                       │
│    • Manages NowPlaying integration                                     │
│                                                                         │
│  ─────────────────────────────────────────────────────────────────────  │
│                                                                         │
│  CARPLAY CONTROLLER                                                     │
│  ══════════════════                                                     │
│                                                                         │
│  State Bridge:                                                          │
│    • Subscribes to workflow state changes                               │
│    • Transforms state into template updates                             │
│    • Batches updates to respect CarPlay refresh limits                  │
│                                                                         │
│  Voice Routing:                                                         │
│    • Receives transcribed speech                                        │
│    • Parses intent (status query, command, decision)                    │
│    • Routes to appropriate handler                                      │
│    • Triggers TTS response                                              │
│                                                                         │
│  Alert Queue:                                                           │
│    • Prioritizes escalations                                            │
│    • Manages alert presentation timing                                  │
│    • Handles user responses                                             │
│                                                                         │
│  ─────────────────────────────────────────────────────────────────────  │
│                                                                         │
│  TTS ENGINE                                                             │
│  ══════════                                                             │
│                                                                         │
│  Speech Generation:                                                     │
│    • Converts status updates to natural speech                          │
│    • Manages audio session for playback                                 │
│    • Handles interruptions gracefully                                   │
│                                                                         │
│  NowPlaying Integration:                                                │
│    • Streams workflow updates as audio content                          │
│    • Responds to transport controls (pause/skip)                        │
│    • Updates Now Playing info (title, progress)                         │
│                                                                         │
│  ─────────────────────────────────────────────────────────────────────  │
│                                                                         │
│  SPEECH RECOGNITION                                                     │
│  ══════════════════                                                     │
│                                                                         │
│  Input Processing:                                                      │
│    • Activates on voice button or Siri trigger                          │
│    • Streams audio to recognition engine                                │
│    • Returns transcribed text                                           │
│                                                                         │
│  Intent Parsing:                                                        │
│    • Matches transcription to known commands                            │
│    • Extracts entities (workflow names, actions)                        │
│    • Handles ambiguity with follow-up prompts                           │
│                                                                         │
│  ─────────────────────────────────────────────────────────────────────  │
│                                                                         │
│  WORKFLOW MANAGER (Core Service)                                        │
│  ═══════════════════════════════                                        │
│                                                                         │
│  State Tracking:                                                        │
│    • Maintains local cache of all workflow states                       │
│    • Syncs with backend via WebSocket                                   │
│    • Emits state change events                                          │
│                                                                         │
│  Command Execution:                                                     │
│    • Pause/Resume/Cancel workflows                                      │
│    • Submit decisions for escalations                                   │
│    • Approve/reject PRs and plans                                       │
│                                                                         │
│  ─────────────────────────────────────────────────────────────────────  │
│                                                                         │
│  PUSH HANDLER                                                           │
│  ════════════                                                           │
│                                                                         │
│  Notification Routing:                                                  │
│    • Receives APNs for escalations                                      │
│    • Wakes app if needed                                                │
│    • Routes to CarPlay if connected                                     │
│                                                                         │
│  Priority Handling:                                                     │
│    • Critical: Immediate alert                                          │
│    • High: Alert when navigation allows                                 │
│    • Normal: Queue for next interaction                                 │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 3.3 Data Flow Diagrams

### Escalation Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      ESCALATION DATA FLOW                               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  1. AGENT BLOCKS                                                        │
│  ───────────────                                                        │
│                                                                         │
│  Agent Runtime                                                          │
│       │                                                                 │
│       │ "Need human decision: delete deprecated endpoint?"              │
│       ▼                                                                 │
│  Orchestrator API                                                       │
│       │                                                                 │
│       │ Creates escalation record, triggers push                        │
│       ▼                                                                 │
│  Push Notification Service                                              │
│       │                                                                 │
│       │ APNs: { "type": "escalation", "priority": "high", ... }         │
│       ▼                                                                 │
│                                                                         │
│  2. NOTIFICATION RECEIVED                                               │
│  ────────────────────────                                               │
│                                                                         │
│  iPhone (ALFRED App)                                                    │
│       │                                                                 │
│       │ Push Handler receives, checks CarPlay connection                │
│       ▼                                                                 │
│  ┌─────────────────────────────────────────┐                            │
│  │ CarPlay Connected?                      │                            │
│  └────────────┬────────────────────────────┘                            │
│               │                                                         │
│       ┌───────┴───────┐                                                 │
│       ▼               ▼                                                 │
│      YES              NO                                                │
│       │               │                                                 │
│       │               └──► Standard iOS notification                    │
│       ▼                                                                 │
│  CarPlay Controller                                                     │
│       │                                                                 │
│       │ Builds CPAlertTemplate from escalation data                     │
│       ▼                                                                 │
│                                                                         │
│  3. ALERT PRESENTATION                                                  │
│  ─────────────────────                                                  │
│                                                                         │
│  CarPlay Scene                                                          │
│       │                                                                 │
│       │ presentTemplate(alertTemplate, animated: true)                  │
│       ▼                                                                 │
│  TTS Engine                                                             │
│       │                                                                 │
│       │ Speaks: "Alfred needs your decision..."                         │
│       ▼                                                                 │
│  CarPlay Display                                                        │
│       │                                                                 │
│       │ Shows alert with action buttons                                 │
│       ▼                                                                 │
│                                                                         │
│  4. USER RESPONDS                                                       │
│  ────────────────                                                       │
│                                                                         │
│  User taps "Keep" or says "Keep"                                        │
│       │                                                                 │
│       ▼                                                                 │
│  CarPlay Controller                                                     │
│       │                                                                 │
│       │ Maps action to decision payload                                 │
│       ▼                                                                 │
│  Workflow Manager                                                       │
│       │                                                                 │
│       │ POST /escalations/{id}/resolve { decision: "keep" }             │
│       ▼                                                                 │
│  Orchestrator API                                                       │
│       │                                                                 │
│       │ Unblocks agent, resumes workflow                                │
│       ▼                                                                 │
│  Agent Runtime                                                          │
│       │                                                                 │
│       │ Continues with decision applied                                 │
│       ▼                                                                 │
│                                                                         │
│  5. CONFIRMATION                                                        │
│  ───────────────                                                        │
│                                                                         │
│  TTS Engine                                                             │
│       │                                                                 │
│       │ Speaks: "Keeping backward compatibility. Workflow continuing."  │
│       ▼                                                                 │
│  CarPlay Scene                                                          │
│       │                                                                 │
│       │ Dismisses alert, returns to previous view                       │
│       ▼                                                                 │
│  Done                                                                   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

### Voice Command Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     VOICE COMMAND DATA FLOW                             │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  1. ACTIVATION                                                          │
│  ─────────────                                                          │
│                                                                         │
│  User presses steering wheel voice button                               │
│       │                                                                 │
│       ▼                                                                 │
│  CarPlay Scene                                                          │
│       │                                                                 │
│       │ Presents CPVoiceControlTemplate                                 │
│       ▼                                                                 │
│  Audio Session                                                          │
│       │                                                                 │
│       │ Activates recording mode                                        │
│       ▼                                                                 │
│  [Listening tone plays]                                                 │
│                                                                         │
│  ─────────────────────────────────────────────────────────────────────  │
│                                                                         │
│  2. SPEECH CAPTURE                                                      │
│  ─────────────────                                                      │
│                                                                         │
│  User: "Check on the auth refactor"                                     │
│       │                                                                 │
│       ▼                                                                 │
│  Speech Recognition                                                     │
│       │                                                                 │
│       │ Transcribes: "check on the auth refactor"                       │
│       ▼                                                                 │
│  [End listening tone plays]                                             │
│                                                                         │
│  ─────────────────────────────────────────────────────────────────────  │
│                                                                         │
│  3. INTENT PARSING                                                      │
│  ─────────────────                                                      │
│                                                                         │
│  Intent Parser                                                          │
│       │                                                                 │
│       │ Pattern match: "check on {workflow}"                            │
│       │ Intent: STATUS_QUERY                                            │
│       │ Entity: workflow = "auth refactor"                              │
│       ▼                                                                 │
│  Workflow Manager                                                       │
│       │                                                                 │
│       │ Fuzzy match "auth refactor" → "auth-refactor-2024-01"           │
│       │ Fetch current state                                             │
│       ▼                                                                 │
│                                                                         │
│  ─────────────────────────────────────────────────────────────────────  │
│                                                                         │
│  4. RESPONSE GENERATION                                                 │
│  ────────────────────────                                               │
│                                                                         │
│  CarPlay Controller                                                     │
│       │                                                                 │
│       │ Builds response from workflow state:                            │
│       │ {                                                               │
│       │   name: "Auth Refactor",                                        │
│       │   status: "running",                                            │
│       │   currentTask: "Integration tests",                             │
│       │   progress: 73,                                                 │
│       │   estimate: "12 minutes"                                        │
│       │ }                                                               │
│       ▼                                                                 │
│  Response Builder                                                       │
│       │                                                                 │
│       │ Template: "{name} is {status}. Currently {currentTask}.         │
│       │            {progress}% complete. Estimated {estimate}           │
│       │            remaining."                                          │
│       ▼                                                                 │
│                                                                         │
│  ─────────────────────────────────────────────────────────────────────  │
│                                                                         │
│  5. RESPONSE DELIVERY                                                   │
│  ────────────────────                                                   │
│                                                                         │
│  TTS Engine                                                             │
│       │                                                                 │
│       │ Speaks: "Auth refactor is running. Currently integration        │
│       │          tests. 73% complete. Estimated 12 minutes remaining."  │
│       ▼                                                                 │
│  CarPlay Scene                                                          │
│       │                                                                 │
│       │ Dismisses VoiceControlTemplate                                  │
│       │ Returns to previous view                                        │
│       ▼                                                                 │
│  Done                                                                   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

### NowPlaying Status Stream Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    NOWPLAYING STATUS STREAM FLOW                        │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  1. STREAM INITIALIZATION                                               │
│  ────────────────────────                                               │
│                                                                         │
│  User opens ALFRED in CarPlay, workflow running                         │
│       │                                                                 │
│       ▼                                                                 │
│  CarPlay Controller                                                     │
│       │                                                                 │
│       │ Configures CPNowPlayingTemplate                                 │
│       │ Sets album art (Orb image)                                      │
│       │ Sets initial title/subtitle                                     │
│       ▼                                                                 │
│  NowPlaying Info Center                                                 │
│       │                                                                 │
│       │ Updates system Now Playing metadata                             │
│       │ Enables remote command targets                                  │
│       ▼                                                                 │
│                                                                         │
│  ─────────────────────────────────────────────────────────────────────  │
│                                                                         │
│  2. STATUS UPDATE ARRIVES                                               │
│  ────────────────────────                                               │
│                                                                         │
│  WebSocket: workflow state change                                       │
│       │                                                                 │
│       │ { "event": "task_complete", "task": "unit_tests",               │
│       │   "next": "integration_tests", "progress": 57 }                 │
│       ▼                                                                 │
│  Workflow Manager                                                       │
│       │                                                                 │
│       │ Updates local state, emits change event                         │
│       ▼                                                                 │
│  CarPlay Controller                                                     │
│       │                                                                 │
│       │ Checks if NowPlaying active and not paused                      │
│       ▼                                                                 │
│                                                                         │
│  ─────────────────────────────────────────────────────────────────────  │
│                                                                         │
│  3. UPDATE DELIVERY                                                     │
│  ──────────────────                                                     │
│                                                                         │
│  NowPlaying Info Center                                                 │
│       │                                                                 │
│       │ Updates:                                                        │
│       │   • Title: "Auth Refactor"                                      │
│       │   • Subtitle: "Working on: Integration tests"                   │
│       │   • Progress: 57%                                               │
│       ▼                                                                 │
│  TTS Engine (if updates enabled)                                        │
│       │                                                                 │
│       │ Speaks: "Completed: Unit tests. Now working on:                 │
│       │          Integration tests. 4 of 7 tasks complete."             │
│       ▼                                                                 │
│  CarPlay Display                                                        │
│       │                                                                 │
│       │ Updates Now Playing screen                                      │
│       ▼                                                                 │
│                                                                         │
│  ─────────────────────────────────────────────────────────────────────  │
│                                                                         │
│  4. TRANSPORT CONTROL INTERACTION                                       │
│  ─────────────────────────────────                                      │
│                                                                         │
│  User presses Pause (steering wheel or screen)                          │
│       │                                                                 │
│       ▼                                                                 │
│  Remote Command Center                                                  │
│       │                                                                 │
│       │ Receives: .pauseCommand                                         │
│       ▼                                                                 │
│  CarPlay Controller                                                     │
│       │                                                                 │
│       │ Sets: ttsUpdatesEnabled = false                                 │
│       │ Updates playback state: .paused                                 │
│       ▼                                                                 │
│  [TTS updates stop, visual updates continue]                            │
│                                                                         │
│  ─────────────────────────────────────────────────────────────────────  │
│                                                                         │
│  User presses Next Track                                                │
│       │                                                                 │
│       ▼                                                                 │
│  Remote Command Center                                                  │
│       │                                                                 │
│       │ Receives: .nextTrackCommand                                     │
│       ▼                                                                 │
│  CarPlay Controller                                                     │
│       │                                                                 │
│       │ Triggers immediate status TTS regardless of pause state         │
│       ▼                                                                 │
│  TTS Engine                                                             │
│       │                                                                 │
│       │ Speaks current status on demand                                 │
│       ▼                                                                 │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 3.4 State Synchronization

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    STATE SYNCHRONIZATION MODEL                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  WORKFLOW STATE OBJECT                                                  │
│  ═════════════════════                                                  │
│                                                                         │
│  WorkflowState {                                                        │
│    id: string                    // Unique identifier                   │
│    name: string                  // Human-readable name                 │
│    status: enum                  // running|paused|blocked|complete|    │
│                                  // failed                              │
│    progress: number              // 0-100                               │
│    currentTask: string           // Current step description            │
│    tasksComplete: number         // Completed task count                │
│    tasksTotal: number            // Total task count                    │
│    estimatedRemaining: number    // Seconds                             │
│    startedAt: timestamp                                                 │
│    updatedAt: timestamp                                                 │
│    escalation: Escalation?       // Present if blocked on decision      │
│    pr: PullRequest?              // Present if PR ready                 │
│    error: Error?                 // Present if failed                   │
│  }                                                                      │
│                                                                         │
│  ─────────────────────────────────────────────────────────────────────  │
│                                                                         │
│  SYNC STRATEGY                                                          │
│  ═════════════                                                          │
│                                                                         │
│  Primary: WebSocket                                                     │
│    • Real-time state change events                                      │
│    • Bi-directional (commands sent back)                                │
│    • Auto-reconnect with exponential backoff                            │
│                                                                         │
│  Fallback: Polling                                                      │
│    • GET /workflows every 30 seconds                                    │
│    • Used when WebSocket unavailable                                    │
│    • Triggered on app foreground                                        │
│                                                                         │
│  Push: Critical Events                                                  │
│    • Escalations always via APNs                                        │
│    • Workflow completion                                                │
│    • Errors requiring attention                                         │
│                                                                         │
│  ─────────────────────────────────────────────────────────────────────  │
│                                                                         │
│  CARPLAY REFRESH CONSTRAINTS                                            │
│  ═══════════════════════════                                            │
│                                                                         │
│  CarPlay templates have refresh limitations:                            │
│                                                                         │
│  • List items: Update in place, no animation                            │
│  • Grid items: Update in place, no animation                            │
│  • Information items: Full template reload required                     │
│  • Alerts: Cannot update, must dismiss and re-present                   │
│  • NowPlaying: Update freely via MPNowPlayingInfoCenter                 │
│                                                                         │
│  Strategy:                                                              │
│    • Batch updates every 5 seconds for lists/grids                      │
│    • Immediate update for state transitions (running→blocked)           │
│    • Debounce rapid progress updates                                    │
│                                                                         │
│  ─────────────────────────────────────────────────────────────────────  │
│                                                                         │
│  OFFLINE BEHAVIOR                                                       │
│  ════════════════                                                       │
│                                                                         │
│  When connectivity lost:                                                │
│                                                                         │
│  1. Display last known state with "Offline" indicator                   │
│  2. Queue voice commands locally                                        │
│  3. Show queued commands in InformationTemplate                         │
│  4. On reconnect:                                                       │
│     a. Sync full state from backend                                     │
│     b. Execute queued commands in order                                 │
│     c. Report results via TTS                                           │
│                                                                         │
│  Offline limitations:                                                   │
│    • Cannot start new workflows                                         │
│    • Cannot submit escalation decisions (queued)                        │
│    • Status shown as "Last updated: [time]"                             │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 3.5 API Contract Summary

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    API ENDPOINTS FOR CARPLAY                            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  WORKFLOWS                                                              │
│  ═════════                                                              │
│                                                                         │
│  GET  /workflows                    List all active workflows           │
│  GET  /workflows/{id}               Get workflow detail                 │
│  POST /workflows/{id}/pause         Pause workflow                      │
│  POST /workflows/{id}/resume        Resume workflow                     │
│  POST /workflows/{id}/cancel        Cancel workflow                     │
│  POST /workflows                    Create new workflow                 │
│                                                                         │
│  ESCALATIONS                                                            │
│  ═══════════                                                            │
│                                                                         │
│  GET  /escalations                  List pending escalations            │
│  GET  /escalations/{id}             Get escalation detail               │
│  POST /escalations/{id}/resolve     Submit decision                     │
│  POST /escalations/{id}/defer       Defer decision                      │
│                                                                         │
│  PULL REQUESTS                                                          │
│  ═════════════                                                          │
│                                                                         │
│  GET  /prs                          List PRs ready for review           │
│  GET  /prs/{id}                     Get PR detail                       │
│  POST /prs/{id}/approve             Approve and merge                   │
│  POST /prs/{id}/request-changes     Request changes (with comment)      │
│  POST /prs/{id}/defer               Defer to desktop                    │
│                                                                         │
│  PLANS                                                                  │
│  ═════                                                                  │
│                                                                         │
│  GET  /plans                        List plans awaiting approval        │
│  GET  /plans/{id}                   Get plan detail                     │
│  POST /plans/{id}/approve           Approve plan, start execution       │
│  POST /plans/{id}/modify            Modify plan scope                   │
│  POST /plans/{id}/cancel            Cancel plan                         │
│                                                                         │
│  WEBSOCKET                                                              │
│  ═════════                                                              │
│                                                                         │
│  WSS /stream                        Real-time state updates             │
│                                                                         │
│  Events:                                                                │
│    workflow.updated                 Workflow state change               │
│    workflow.complete                Workflow finished                   │
│    workflow.error                   Workflow failed                     │
│    escalation.created               New escalation                      │
│    escalation.resolved              Escalation resolved                 │
│    pr.ready                         PR ready for review                 │
│    pr.merged                        PR merged                           │
│    plan.ready                       Plan ready for approval             │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

# Part 4: Figma-Ready Wireframes

## 4.1 Screen Flow Map

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      CARPLAY SCREEN FLOW MAP                            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│                         ┌─────────────────┐                             │
│                         │  Dashboard      │                             │
│                         │  Widget         │                             │
│                         │  (Glanceable)   │                             │
│                         └────────┬────────┘                             │
│                                  │ tap                                  │
│                                  ▼                                      │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                                                                 │    │
│  │                         TAB BAR ROOT                            │    │
│  │  ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌───────────┐   │    │
│  │  │  Status   │  │ Decisions │  │   PRs     │  │   Voice   │   │    │
│  │  │  (Grid)   │  │  (List)   │  │  (List)   │  │ (Control) │   │    │
│  │  └─────┬─────┘  └─────┬─────┘  └─────┬─────┘  └───────────┘   │    │
│  │        │              │              │                         │    │
│  └────────┼──────────────┼──────────────┼─────────────────────────┘    │
│           │              │              │                              │
│           ▼              ▼              ▼                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                     │
│  │  Workflow   │  │  Decision   │  │    PR       │                     │
│  │  Detail     │  │  Detail     │  │  Summary    │                     │
│  │  (Info)     │  │  (Info)     │  │  (Info)     │                     │
│  └─────────────┘  └─────────────┘  └──────┬──────┘                     │
│                                           │                            │
│                                           ▼                            │
│                                  ┌─────────────────┐                   │
│                                  │  Diff Summary   │                   │
│                                  │  (NowPlaying    │                   │
│                                  │   TTS Stream)   │                   │
│                                  └─────────────────┘                   │
│                                                                         │
│  ─────────────────────────────────────────────────────────────────────  │
│                                                                         │
│  INTERRUPT FLOWS (Can appear at any time)                               │
│                                                                         │
│                   ┌─────────────────┐                                   │
│                   │  Escalation     │──► Decision Detail               │
│   Push ─────────► │  Alert          │    or dismiss                     │
│                   └─────────────────┘                                   │
│                                                                         │
│                   ┌─────────────────┐                                   │
│                   │  Plan Ready     │──► Plan Review                   │
│   Push ─────────► │  Alert          │    (Info template)               │
│                   └─────────────────┘                                   │
│                                                                         │
│                   ┌─────────────────┐                                   │
│                   │  PR Ready       │──► PR Summary                    │
│   Push ─────────► │  Alert          │    (Info template)               │
│                   └─────────────────┘                                   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 4.2 Dashboard Widget Wireframe

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    DASHBOARD WIDGET WIREFRAME                           │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  CONTEXT: CarPlay Dashboard (Home screen)                               │
│  SIZE: 2×1 grid unit (approximately 200pt × 100pt)                      │
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────┐      │
│  │                                                               │      │
│  │   ┌─────────────────────────────────────────────────────┐    │      │
│  │   │                                                     │    │      │
│  │   │     ┌────┐                                          │    │      │
│  │   │     │    │    Auth Refactor                         │    │      │
│  │   │     │ ◉  │    ████████████░░░░  73%                 │    │      │
│  │   │     │    │                                          │    │      │
│  │   │     └────┘                                          │    │      │
│  │   │                                                     │    │      │
│  │   └─────────────────────────────────────────────────────┘    │      │
│  │                                                               │      │
│  │   SPECS                                                       │      │
│  │   ─────                                                       │      │
│  │   Icon area:     40pt × 40pt                                  │      │
│  │   Icon:          Orb with state color                         │      │
│  │   Title:         Workflow name, SF Pro Semibold 15pt          │      │
│  │   Progress:      Bar + percentage, SF Pro Regular 13pt        │      │
│  │   Background:    System dark (CarPlay provided)               │      │
│  │   Touch target:  Entire widget                                │      │
│  │                                                               │      │
│  └───────────────────────────────────────────────────────────────┘      │
│                                                                         │
│  STATE VARIATIONS                                                       │
│  ════════════════                                                       │
│                                                                         │
│  Running:                                                               │
│  ┌──────────────────────────────────────────────┐                       │
│  │  ┌────┐                                      │                       │
│  │  │ ◉  │  Auth Refactor                       │                       │
│  │  └────┘  ████████████░░░░  73%               │                       │
│  └──────────────────────────────────────────────┘                       │
│                                                                         │
│  Blocked (requires attention):                                          │
│  ┌──────────────────────────────────────────────┐                       │
│  │  ┌────┐                                      │                       │
│  │  │ ●! │  Deploy Pipeline                     │                       │
│  │  └────┘  Blocked - Decision needed           │  ← Red badge on icon  │
│  └──────────────────────────────────────────────┘                       │
│                                                                         │
│  Complete:                                                              │
│  ┌──────────────────────────────────────────────┐                       │
│  │  ┌────┐                                      │                       │
│  │  │ ✓  │  DB Migration                        │                       │
│  │  └────┘  Complete - 12 min ago               │  ← Checkmark icon     │
│  └──────────────────────────────────────────────┘                       │
│                                                                         │
│  No workflows:                                                          │
│  ┌──────────────────────────────────────────────┐                       │
│  │  ┌────┐                                      │                       │
│  │  │ ◯  │  ALFRED                              │                       │
│  │  └────┘  No active workflows                 │                       │
│  └──────────────────────────────────────────────┘                       │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 4.3 Multi-Agent Grid Wireframe

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    MULTI-AGENT GRID WIREFRAME                           │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  CONTEXT: Status tab (CPGridTemplate)                                   │
│  LAYOUT: 2×2 or 2×3 grid based on agent count                           │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                                                                 │    │
│  │     Active Agents                                               │    │
│  │                                                                 │    │
│  │     ┌─────────────────────┐    ┌─────────────────────┐         │    │
│  │     │                     │    │                     │         │    │
│  │     │         ◉           │    │         ◐           │         │    │
│  │     │                     │    │                     │         │    │
│  │     │    Auth Refactor    │    │     Test Suite      │         │    │
│  │     │        73%          │    │      Thinking       │         │    │
│  │     │                     │    │                     │         │    │
│  │     └─────────────────────┘    └─────────────────────┘         │    │
│  │                                                                 │    │
│  │     ┌─────────────────────┐    ┌─────────────────────┐         │    │
│  │     │                     │    │                     │         │    │
│  │     │         ●           │    │         ✓           │         │    │
│  │     │                     │    │                     │         │    │
│  │     │   Deploy Pipeline   │    │    DB Migration     │         │    │
│  │     │       Blocked       │    │      Complete       │         │    │
│  │     │                     │    │                     │         │    │
│  │     └─────────────────────┘    └─────────────────────┘         │    │
│  │                                                                 │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                         │
│  GRID BUTTON SPECS                                                      │
│  ═════════════════                                                      │
│                                                                         │
│  ┌─────────────────────────────┐                                        │
│  │                             │                                        │
│  │          [ICON]             │  ← 44pt, state-colored                 │
│  │                             │                                        │
│  │       Workflow Name         │  ← SF Pro Semibold 15pt                │
│  │          Status             │  ← SF Pro Regular 13pt, secondary      │
│  │                             │                                        │
│  └─────────────────────────────┘                                        │
│                                                                         │
│  Button size: ~160pt × 120pt (CarPlay determines)                       │
│  Touch target: Entire button                                            │
│  Tap action: Push to Workflow Detail                                    │
│                                                                         │
│  ICON SPECIFICATIONS                                                    │
│  ═══════════════════                                                    │
│                                                                         │
│  ┌────┐ Running     White orb, optional animation                       │
│  │ ◉  │             if CarPlay supports                                 │
│  └────┘                                                                 │
│                                                                         │
│  ┌────┐ Thinking    Half-filled orb, neutral color                      │
│  │ ◐  │                                                                 │
│  └────┘                                                                 │
│                                                                         │
│  ┌────┐ Blocked     Solid with red badge/exclamation                    │
│  │ ●! │             Draws immediate attention                           │
│  └────┘                                                                 │
│                                                                         │
│  ┌────┐ Complete    Green checkmark                                     │
│  │ ✓  │                                                                 │
│  └────┘                                                                 │
│                                                                         │
│  ┌────┐ Failed      Red X                                               │
│  │ ✕  │                                                                 │
│  └────┘                                                                 │
│                                                                         │
│  ┌────┐ Paused      Pause icon, gray/dim                                │
│  │ ⏸  │                                                                 │
│  └────┘                                                                 │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 4.4 Decision Queue Wireframe

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    DECISION QUEUE WIREFRAME                             │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  CONTEXT: Decisions tab (CPListTemplate)                                │
│  LAYOUT: Scrollable list, grouped by priority                           │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                                                                 │    │
│  │     Pending Decisions                                  3 items  │    │
│  │     ─────────────────────────────────────────────────────────   │    │
│  │                                                                 │    │
│  │     ┌─────────────────────────────────────────────────────┐    │    │
│  │     │  🔴    PR #142: Merge conflict                     >│    │    │
│  │     │        package.json • Auth Refactor • 23m ago       │    │    │
│  │     └─────────────────────────────────────────────────────┘    │    │
│  │                                                                 │    │
│  │     ┌─────────────────────────────────────────────────────┐    │    │
│  │     │  🟡    AWS credentials needed                      >│    │    │
│  │     │        Deploy Pipeline • 8m ago                     │    │    │
│  │     └─────────────────────────────────────────────────────┘    │    │
│  │                                                                 │    │
│  │     ┌─────────────────────────────────────────────────────┐    │    │
│  │     │  🟡    Security review required                    >│    │    │
│  │     │        auth.ts flagged • Code Review • 2m ago       │    │    │
│  │     └─────────────────────────────────────────────────────┘    │    │
│  │                                                                 │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                         │
│  LIST ITEM SPECS                                                        │
│  ═══════════════                                                        │
│                                                                         │
│  ┌──────┬─────────────────────────────────────────────────┬──────┐     │
│  │      │                                                 │      │     │
│  │ ICON │  PRIMARY TEXT                                   │  >   │     │
│  │      │  Secondary text • Context • Time                │      │     │
│  │      │                                                 │      │     │
│  └──────┴─────────────────────────────────────────────────┴──────┘     │
│                                                                         │
│  Icon:          Priority indicator (SF Symbol or custom)                │
│  Primary:       Decision title, SF Pro Semibold 17pt                    │
│  Secondary:     Context • Workflow • Time, SF Pro Regular 15pt          │
│  Accessory:     Disclosure indicator (>)                                │
│  Row height:    ~88pt (CarPlay standard)                                │
│                                                                         │
│  PRIORITY ICONS                                                         │
│  ══════════════                                                         │
│                                                                         │
│  🔴  Critical   │  exclamationmark.circle.fill (red)                    │
│  🟡  High       │  exclamationmark.triangle.fill (yellow)               │
│  🟢  Normal     │  questionmark.circle.fill (green)                     │
│                                                                         │
│  EMPTY STATE                                                            │
│  ═══════════                                                            │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                                                                 │    │
│  │                                                                 │    │
│  │                            ✓                                    │    │
│  │                                                                 │    │
│  │                      All caught up                              │    │
│  │                   No pending decisions                          │    │
│  │                                                                 │    │
│  │                                                                 │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 4.5 Escalation Alert Wireframe

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    ESCALATION ALERT WIREFRAME                           │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  CONTEXT: Interrupt alert (CPAlertTemplate)                             │
│  TRIGGER: Push notification for escalation                              │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                                                                 │    │
│  │                                                                 │    │
│  │                           ⚠                                     │    │
│  │                                                                 │    │
│  │                                                                 │    │
│  │               Agent Needs Your Decision                         │    │
│  │                                                                 │    │
│  │      Should I delete the deprecated API endpoint                │    │
│  │      or maintain backward compatibility?                        │    │
│  │                                                                 │    │
│  │      ─────────────────────────────────────────────              │    │
│  │                                                                 │    │
│  │      Workflow: Auth Refactor                                    │    │
│  │      Blocked for: 12 minutes                                    │    │
│  │                                                                 │    │
│  │                                                                 │    │
│  │      ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │    │
│  │      │   Delete    │  │    Keep     │  │   Later     │         │    │
│  │      └─────────────┘  └─────────────┘  └─────────────┘         │    │
│  │                                                                 │    │
│  │                                                                 │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                         │
│  ALERT SPECS                                                            │
│  ═══════════                                                            │
│                                                                         │
│  Icon:           Warning symbol (exclamationmark.triangle)              │
│  Title:          "Agent Needs Your Decision"                            │
│                  SF Pro Semibold 22pt                                   │
│  Message:        Decision question + context                            │
│                  SF Pro Regular 17pt                                    │
│  Buttons:        Maximum 3 (CarPlay limitation)                         │
│                  Primary action, Secondary action, Defer                │
│                                                                         │
│  TTS (Auto):     "Alfred needs your decision. [Context]. [Question].    │
│                   Say [Option 1], [Option 2], or Later."                │
│                                                                         │
│  BUTTON VARIATIONS                                                      │
│  ═════════════════                                                      │
│                                                                         │
│  Binary decision (keep/delete):                                         │
│  [  Delete  ]    [   Keep   ]    [  Later  ]                            │
│                                                                         │
│  Merge conflict:                                                        │
│  [ Use Mine ]    [Use Theirs]    [ Review  ]                            │
│                                                                         │
│  Credentials:                                                           │
│  [Use Saved ]    [Skip Step ]    [  Pause  ]                            │
│                                                                         │
│  Security:                                                              │
│  [ Details  ]    [ Approve  ]    [  Block  ]                            │
│                                                                         │
│  DESTRUCTIVE STYLING                                                    │
│  ═══════════════════                                                    │
│                                                                         │
│  For irreversible actions, use destructive button style:                │
│                                                                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                      │
│  │   DELETE    │  │    Keep     │  │   Later     │                      │
│  │   (red)     │  │  (default)  │  │  (default)  │                      │
│  └─────────────┘  └─────────────┘  └─────────────┘                      │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 4.6 PR Summary Wireframe

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      PR SUMMARY WIREFRAME                               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  CONTEXT: PR detail (CPInformationTemplate)                             │
│  ENTRY: From PRs list or PR Ready alert                                 │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                                                                 │    │
│  │                      ┌───────────────┐                          │    │
│  │                      │               │                          │    │
│  │                      │      ✓        │                          │    │
│  │                      │   PR Ready    │                          │    │
│  │                      │               │                          │    │
│  │                      └───────────────┘                          │    │
│  │                                                                 │    │
│  │                   Add OAuth2 Support                            │    │
│  │                                                                 │    │
│  │      ─────────────────────────────────────────────────────      │    │
│  │                                                                 │    │
│  │      Files changed                                      12      │    │
│  │      Lines added                                      +342      │    │
│  │      Lines removed                                     -89      │    │
│  │      Tests                                       47 passing     │    │
│  │      Coverage                                          94%      │    │
│  │      Build                                         Passing      │    │
│  │                                                                 │    │
│  │      ─────────────────────────────────────────────────────      │    │
│  │                                                                 │    │
│  │      ┌───────────────┐  ┌───────────────┐  ┌────────────┐      │    │
│  │      │Approve & Merge│  │Request Changes│  │Review Later│      │    │
│  │      └───────────────┘  └───────────────┘  └────────────┘      │    │
│  │                                                                 │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                         │
│  INFORMATION TEMPLATE SPECS                                             │
│  ══════════════════════════                                             │
│                                                                         │
│  Header image:   Custom (orb with checkmark)                            │
│                  Or SF Symbol (checkmark.circle.fill)                   │
│                                                                         │
│  Title:          PR title                                               │
│                  SF Pro Semibold 22pt                                   │
│                                                                         │
│  Items:          Label / Value pairs                                    │
│                  Label: SF Pro Regular 17pt, secondary color            │
│                  Value: SF Pro Semibold 17pt, primary color             │
│                  Maximum: 10 items                                      │
│                                                                         │
│  Buttons:        Maximum 3                                              │
│                                                                         │
│  ITEM PRIORITIZATION                                                    │
│  ═════════════════════                                                  │
│                                                                         │
│  Always show (in order):                                                │
│    1. Files changed                                                     │
│    2. Lines added/removed                                               │
│    3. Test status                                                       │
│    4. Build status                                                      │
│                                                                         │
│  Show if space:                                                         │
│    5. Coverage                                                          │
│    6. Linked issues                                                     │
│    7. Time to complete                                                  │
│    8. Review comments                                                   │
│                                                                         │
│  POST-ACTION SCREENS                                                    │
│  ═══════════════════                                                    │
│                                                                         │
│  After "Approve & Merge":                                               │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                                                                 │    │
│  │                            ✓                                    │    │
│  │                                                                 │    │
│  │                    PR Merged                                    │    │
│  │                                                                 │    │
│  │            CI Pipeline started                                  │    │
│  │            Deployment in progress                               │    │
│  │                                                                 │    │
│  │                       [ Done ]                                  │    │
│  │                                                                 │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                         │
│  After "Request Changes":                                               │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                                                                 │    │
│  │            What changes should I request?                       │    │
│  │                                                                 │    │
│  │            [Voice input active...]                              │    │
│  │                                                                 │    │
│  │                      [ Cancel ]                                 │    │
│  │                                                                 │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 4.7 NowPlaying Wireframe

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      NOWPLAYING WIREFRAME                               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  CONTEXT: Workflow status stream (CPNowPlayingTemplate)                 │
│  ENTRY: From workflow detail or auto on workflow start                  │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                                                                 │    │
│  │                                                                 │    │
│  │                      ┌───────────────┐                          │    │
│  │                      │               │                          │    │
│  │                      │               │                          │    │
│  │                      │      ◉        │  ← Album art: Orb        │    │
│  │                      │    ALFRED     │    with state icon       │    │
│  │                      │               │                          │    │
│  │                      │               │                          │    │
│  │                      └───────────────┘                          │    │
│  │                                                                 │    │
│  │                                                                 │    │
│  │                      Auth Refactor                              │    │
│  │                Working on: Integration tests                    │    │
│  │                                                                 │    │
│  │                                                                 │    │
│  │         ════════════════════════░░░░░░░░                        │    │
│  │         12:34                              18:00 est            │    │
│  │                                                                 │    │
│  │                                                                 │    │
│  │                   ⏮       ⏸       ⏭                            │    │
│  │                                                                 │    │
│  │                                                                 │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                         │
│  NOWPLAYING SPECS                                                       │
│  ════════════════                                                       │
│                                                                         │
│  Album Art:       Square image, Orb with workflow state                 │
│                   Update on state change                                │
│                                                                         │
│  Title:           Workflow name                                         │
│                   SF Pro Semibold 22pt                                  │
│                                                                         │
│  Subtitle:        Current task description                              │
│                   SF Pro Regular 17pt, secondary                        │
│                                                                         │
│  Progress bar:    Visual progress (0-100%)                              │
│                   Not scrubbable                                        │
│                                                                         │
│  Elapsed time:    Time since workflow started                           │
│                   Format: MM:SS or H:MM:SS                              │
│                                                                         │
│  Remaining:       Estimated completion                                  │
│                   Format: "XX:XX est"                                   │
│                                                                         │
│  Transport:       Previous, Play/Pause, Next                            │
│                                                                         │
│  TRANSPORT BEHAVIOR                                                     │
│  ══════════════════                                                     │
│                                                                         │
│  ⏮  Previous     Re-speak last status update                           │
│                   "Replaying: Completed unit tests..."                  │
│                                                                         │
│  ⏸  Pause        Stop TTS updates (visual continues)                   │
│                   Icon changes to ▶                                     │
│                                                                         │
│  ▶  Play         Resume TTS updates                                    │
│                   Speaks current status immediately                     │
│                                                                         │
│  ⏭  Next         Speak current status on demand                        │
│                   "Currently: Integration tests. 73%."                  │
│                                                                         │
│  ALBUM ART STATES                                                       │
│  ════════════════                                                       │
│                                                                         │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐       │
│  │         │  │         │  │         │  │         │  │         │       │
│  │    ◉    │  │    ◐    │  │    ●    │  │    ✓    │  │    ✕    │       │
│  │         │  │         │  │         │  │         │  │         │       │
│  │ Running │  │Thinking │  │ Blocked │  │Complete │  │ Failed  │       │
│  └─────────┘  └─────────┘  └─────────┘  └─────────┘  └─────────┘       │
│                                                                         │
│  Each should be a distinct image asset for clarity at small sizes.      │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 4.8 Voice Control Wireframe

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     VOICE CONTROL WIREFRAME                             │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  CONTEXT: Voice command input (CPVoiceControlTemplate)                  │
│  TRIGGER: Steering wheel button, Siri, or Voice tab                     │
│                                                                         │
│  LISTENING STATE                                                        │
│  ───────────────                                                        │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                                                                 │    │
│  │                                                                 │    │
│  │                      ┌───────────────┐                          │    │
│  │                      │               │                          │    │
│  │                      │      ◉        │  ← Animated orb          │    │
│  │                      │               │    (pulsing)             │    │
│  │                      └───────────────┘                          │    │
│  │                                                                 │    │
│  │                       Listening...                              │    │
│  │                                                                 │    │
│  │      ─────────────────────────────────────────────────────      │    │
│  │                                                                 │    │
│  │      Try saying:                                                │    │
│  │                                                                 │    │
│  │        "Check on auth refactor"                                 │    │
│  │        "Pause all workflows"                                    │    │
│  │        "What's blocking deployment?"                            │    │
│  │                                                                 │    │
│  │                                                                 │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                         │
│  PROCESSING STATE                                                       │
│  ────────────────                                                       │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                                                                 │    │
│  │                                                                 │    │
│  │                      ┌───────────────┐                          │    │
│  │                      │               │                          │    │
│  │                      │      ◐        │  ← Thinking orb          │    │
│  │                      │               │                          │    │
│  │                      └───────────────┘                          │    │
│  │                                                                 │    │
│  │                    Processing...                                │    │
│  │                                                                 │    │
│  │      ─────────────────────────────────────────────────────      │    │
│  │                                                                 │    │
│  │        "Check on the auth refactor"                             │    │
│  │                                                                 │    │
│  │                                                                 │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                         │
│  VOICE CONTROL SPECS                                                    │
│  ════════════════════                                                   │
│                                                                         │
│  Title:           "Listening..." or "Processing..."                     │
│                   SF Pro Semibold 22pt                                  │
│                                                                         │
│  Transcription:   User's spoken text (in processing state)              │
│                   SF Pro Regular 17pt, quoted                           │
│                                                                         │
│  Hints:           Example commands                                      │
│                   SF Pro Regular 15pt, secondary color                  │
│                   Maximum 3-4 examples                                  │
│                                                                         │
│  HINT VARIATIONS (Context-sensitive)                                    │
│  ═══════════════════════════════════                                    │
│                                                                         │
│  Default:                                                               │
│    "Check on [workflow name]"                                           │
│    "Pause all workflows"                                                │
│    "Any blockers?"                                                      │
│                                                                         │
│  When escalation pending:                                               │
│    "Delete" or "Keep"                                                   │
│    "Show me the decision"                                               │
│    "Skip for now"                                                       │
│                                                                         │
│  When PR ready:                                                         │
│    "Approve and merge"                                                  │
│    "Tell me the changes"                                                │
│    "Review later"                                                       │
│                                                                         │
│  When no workflows:                                                     │
│    "Start new workflow"                                                 │
│    "Fix issue [number]"                                                 │
│    "Deploy to staging"                                                  │
│                                                                         │
│  ERROR STATE                                                            │
│  ═══════════                                                            │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                                                                 │    │
│  │                      ┌───────────────┐                          │    │
│  │                      │      ?        │                          │    │
│  │                      └───────────────┘                          │    │
│  │                                                                 │    │
│  │                   Didn't catch that                             │    │
│  │                                                                 │    │
│  │      ─────────────────────────────────────────────────────      │    │
│  │                                                                 │    │
│  │      Try:                                                       │    │
│  │        "Check status"                                           │    │
│  │        "Pause workflow"                                         │    │
│  │                                                                 │    │
│  │                    [ Try Again ]                                │    │
│  │                                                                 │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 4.9 Plan Review Wireframe

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      PLAN REVIEW WIREFRAME                              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  CONTEXT: ExecPlan approval (CPInformationTemplate)                     │
│  ENTRY: From Plan Ready alert or task assignment                        │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                                                                 │    │
│  │                      ┌───────────────┐                          │    │
│  │                      │               │                          │    │
│  │                      │      📋       │                          │    │
│  │                      │  Plan Ready   │                          │    │
│  │                      │               │                          │    │
│  │                      └───────────────┘                          │    │
│  │                                                                 │    │
│  │                Migrate to PostgreSQL                            │    │
│  │                                                                 │    │
│  │      ─────────────────────────────────────────────────────      │    │
│  │                                                                 │    │
│  │      Step 1                                    Schema design    │    │
│  │      Step 2                                Migration scripts    │    │
│  │      Step 3                                     Update ORM      │    │
│  │      Step 4                               Integration tests     │    │
│  │      Estimated                                      4 hours     │    │
│  │      Risk                                            Medium     │    │
│  │                                                                 │    │
│  │      ─────────────────────────────────────────────────────      │    │
│  │                                                                 │    │
│  │      ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │    │
│  │      │Approve Plan │  │Modify Scope │  │   Cancel    │         │    │
│  │      └─────────────┘  └─────────────┘  └─────────────┘         │    │
│  │                                                                 │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                         │
│  PLAN TEMPLATE SPECS                                                    │
│  ════════════════════                                                   │
│                                                                         │
│  Header image:    Clipboard icon (doc.plaintext)                        │
│                   or custom plan icon                                   │
│                                                                         │
│  Title:           Plan/task title                                       │
│                   SF Pro Semibold 22pt                                  │
│                                                                         │
│  Steps:           Numbered list of plan phases                          │
│                   Show max 5, "+ N more" if exceeds                     │
│                   Label: "Step N", Value: step description              │
│                                                                         │
│  Metadata:                                                              │
│    • Estimated time                                                     │
│    • Risk level (with appropriate color hint)                           │
│    • Files affected (optional)                                          │
│    • Dependencies (optional)                                            │
│                                                                         │
│  RISK INDICATORS                                                        │
│  ════════════════                                                       │
│                                                                         │
│  Risk                                               Low    │ Green      │
│  Risk                                            Medium    │ Yellow     │
│  Risk                                              High    │ Red        │
│                                                                         │
│  POST-APPROVAL FLOW                                                     │
│  ══════════════════                                                     │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                                                                 │    │
│  │                            ◉                                    │    │
│  │                                                                 │    │
│  │                    Workflow Started                             │    │
│  │                                                                 │    │
│  │            Migrate to PostgreSQL                                │    │
│  │            Starting: Schema design                              │    │
│  │                                                                 │    │
│  │                    [ View Status ]                              │    │
│  │                                                                 │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                         │
│  "View Status" → Opens NowPlaying for this workflow                     │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 4.10 Complete Tab Bar Layout

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      TAB BAR ROOT LAYOUT                                │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  CONTEXT: CPTabBarTemplate as root                                      │
│  TABS: 4 maximum for CarPlay                                            │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                                                                 │    │
│  │                                                                 │    │
│  │                     [ TAB CONTENT AREA ]                        │    │
│  │                                                                 │    │
│  │                     Varies by selected tab                      │    │
│  │                                                                 │    │
│  │                                                                 │    │
│  │                                                                 │    │
│  │                                                                 │    │
│  │                                                                 │    │
│  │                                                                 │    │
│  │                                                                 │    │
│  │                                                                 │    │
│  ├─────────────────────────────────────────────────────────────────┤    │
│  │                                                                 │    │
│  │     ┌────┐      ┌────┐      ┌────┐      ┌────┐                 │    │
│  │     │ ◉  │      │ ⚠  │      │ ✓  │      │ 🎤 │                 │    │
│  │     │    │      │ 3  │      │ 2  │      │    │                 │    │
│  │     └────┘      └────┘      └────┘      └────┘                 │    │
│  │     Status     Decisions     PRs       Voice                   │    │
│  │                                                                 │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                         │
│  TAB SPECIFICATIONS                                                     │
│  ══════════════════                                                     │
│                                                                         │
│  Tab 1: Status                                                          │
│    Icon: Orb (custom) or circle.grid.2x2                                │
│    Content: CPGridTemplate (Multi-Agent Grid)                           │
│    Badge: None (status shown in grid)                                   │
│                                                                         │
│  Tab 2: Decisions                                                       │
│    Icon: exclamationmark.triangle                                       │
│    Content: CPListTemplate (Decision Queue)                             │
│    Badge: Count of pending decisions                                    │
│                                                                         │
│  Tab 3: PRs                                                             │
│    Icon: checkmark.circle                                               │
│    Content: CPListTemplate (PRs Ready)                                  │
│    Badge: Count of PRs awaiting review                                  │
│                                                                         │
│  Tab 4: Voice                                                           │
│    Icon: mic.fill                                                       │
│    Content: CPVoiceControlTemplate                                      │
│    Badge: None                                                          │
│                                                                         │
│  BADGE STYLING                                                          │
│  ═════════════                                                          │
│                                                                         │
│  Badges appear as small numbers in circles on tab icons.                │
│  CarPlay system handles badge rendering.                                │
│  Update badge counts via template configuration.                        │
│                                                                         │
│  ALTERNATIVE: 3-TAB LAYOUT                                              │
│  ══════════════════════════                                             │
│                                                                         │
│  If simpler layout preferred:                                           │
│                                                                         │
│  ┌────────────────────────────────────────────────────────────────┐     │
│  │     ┌────┐           ┌────┐           ┌────┐                  │     │
│  │     │ ◉  │           │ ⚠  │           │ 🎤 │                  │     │
│  │     └────┘           └────┘           └────┘                  │     │
│  │    Workflows        Actions          Voice                    │     │
│  └────────────────────────────────────────────────────────────────┘     │
│                                                                         │
│  Workflows: Grid of all workflows                                       │
│  Actions: Combined Decisions + PRs list                                 │
│  Voice: Voice control                                                   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

*Document: ALFRED CarPlay Experience*
*Version: 1.0*
*Sections: UI Specifications, Voice Scripts, Architecture, Wireframes*
