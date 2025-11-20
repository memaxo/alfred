# ALFRED UI/UX Comprehensive Strategy

**Date:** 2025-01-27  
**Status:** Strategic Planning  
**Scope:** Frontend Component Architecture & User Journey Optimization

---

## Executive Summary

ALFRED's frontend is **well-architected** (8.5/10 health) but has **critical user journey gaps**. With access to 300+ Tremor Blocks and 24 ElevenLabs voice components, we can complete incomplete journeys while maintaining the "Signal in the Void" aesthetic.

**Key Findings:**
- ✅ **Strengths:** Excellent AI SDK v6 integration, strong component patterns, good error handling
- ⚠️ **Gaps:** 5/7 user journeys incomplete, missing management panes (Timers/Bookmarks), no workflow history
- 🎯 **Opportunity:** Tremor's KPI Cards, Status Monitoring, and Dialogs perfectly align with ALFRED's workflow automation use case

**Recommended Approach:**
1. **Consolidate voice components** (merge ElevenLabs with existing, not replace)
2. **Use Tremor for data-heavy UIs** (metrics, workflows, tables)
3. **Keep shadcn/ui for forms** (already integrated, less customization needed)
4. **Create "Void-themed" wrapper components** for frequently used Tremor blocks

---

## 1. Component Gap Analysis

### Current State vs. Available Components

| Category | Existing | Tremor Available | ElevenLabs Available | Gap Status |
|----------|----------|------------------|----------------------|------------|
| **Chat/Messaging** | 10 components | 0 | 7 components | ✅ Well covered |
| **Voice/Audio** | 6 components | 0 | 17 components | ⚠️ Overlap risk |
| **Data Visualization** | 9 components | 68 chart blocks | 0 | 🎯 Major opportunity |
| **Management Panes** | 3 (Note, Remind, Todo) | 15 grid lists | 0 | ⚠️ Missing Timers/Bookmarks |
| **Settings/Forms** | 5 components | 13 form blocks | 0 | ⚠️ Integration UI missing |
| **Status/Monitoring** | 1 (connect.tsx) | 10 status blocks | 0 | 🎯 Major opportunity |
| **Workflow Visualization** | 7 components | 15 chart compositions | 0 | ⚠️ Missing history/list |
| **Dialogs/Modals** | 1 (promote-dialog) | 9 dialog blocks | 0 | ⚠️ No generic modal |
| **Empty States** | 0 | 10 empty state blocks | 0 | ❌ Critical gap |
| **Onboarding** | 0 | 16 onboarding blocks | 0 | ❌ Critical gap |

### Tremor Categories Best Suited for ALFRED

#### 🥇 **Tier 1: Critical for Core Features**

1. **KPI Cards (29 blocks)** - [View Blocks](https://blocks.tremor.so/blocks?category=kpi-cards)
   - **Use Cases:** 
     - Workflow execution metrics (success rate, duration, cost)
     - System health (API latency, DB performance, voice model status)
     - User productivity (notes created, reminders completed, timers active)
   - **Priority:** HIGH
   - **Customization:** Medium (color overrides, no shadows)

2. **Status Monitoring (10 blocks)** - [View Blocks](https://blocks.tremor.so/blocks?category=status-monitoring)
   - **Use Cases:**
     - Deployment health (Proxmox VMs, Docker containers)
     - Linear integration status
     - Voice model health (local vs OpenAI)
   - **Priority:** HIGH
   - **Customization:** Light (primarily text/bg colors)

3. **Dialogs (9 blocks)** - [View Blocks](https://blocks.tremor.so/blocks?category=dialogs)
   - **Use Cases:**
     - Biometric elevation challenge
     - Workflow error details
     - Confirmation dialogs (delete, cancel)
   - **Priority:** HIGH
   - **Customization:** Heavy (backdrop needs void aesthetic)

#### 🥈 **Tier 2: Enhance Existing Features**

4. **Chart Compositions (15 blocks)** - [View Blocks](https://blocks.tremor.so/blocks?category=chart-compositions)
   - **Use Cases:**
     - Runtime metrics dashboard (cognitive state, performance budgets)
     - Workflow execution timeline
     - Resource usage trends
   - **Priority:** MEDIUM
   - **Customization:** Medium (chart colors, animations)

5. **Filterbar (16 blocks)** - [View Blocks](https://blocks.tremor.so/blocks?category=filterbar)
   - **Use Cases:**
     - Workflow history filtering (date, status, agent)
     - Notes/reminders search
     - Deployment filtering
   - **Priority:** MEDIUM
   - **Customization:** Light (input styling already defined)

6. **Grid Lists (15 blocks)** - [View Blocks](https://blocks.tremor.so/blocks?category=grid-lists)
   - **Use Cases:**
     - Timer cards (extend PaneLayout pattern)
     - Bookmark cards
     - Integration cards (Linear, Laminar, etc.)
   - **Priority:** MEDIUM
   - **Customization:** Medium (card backgrounds, borders)

#### 🥉 **Tier 3: New Features**

7. **Empty States (10 blocks)** - [View Blocks](https://blocks.tremor.so/blocks?category=empty-states)
   - **Use Cases:**
     - First-time user onboarding
     - No workflows yet
     - No integrations connected
   - **Priority:** MEDIUM
   - **Customization:** Light (illustrations + text)

8. **Onboarding & Feed (16 blocks)** - [View Blocks](https://blocks.tremor.so/blocks?category=onboarding-feed)
   - **Use Cases:**
     - Welcome wizard
     - Feature tour
     - Activity feed
   - **Priority:** LOW (nice-to-have)
   - **Customization:** Heavy (multi-step flows)

9. **Form Layouts (6 blocks)** - [View Blocks](https://blocks.tremor.so/blocks?category=form-layouts)
   - **Use Cases:**
     - Settings pages (already have some, but can improve)
     - Integration setup
     - Profile management
   - **Priority:** LOW
   - **Customization:** Light (already using shadcn forms)

---

## 2. ElevenLabs vs. Existing Voice Components

### Current Voice Stack

**Existing Components (6):**
- `voice-btn.tsx` - Primary voice button for chat
- `drive-mode.tsx` - Full-screen voice-first UI
- `audio.tsx` - Audio playback component
- `wave.tsx` - Waveform visualization
- `mic.tsx` - Microphone icon/indicator
- `voice.tsx` - Voice visualization component

**ElevenLabs Components (24):**
- **Visualizations:** live-waveform, orb, waveform, bar-visualizer, matrix
- **Playback:** audio-player, scrub-bar
- **Controls:** voice-picker, voice-button, mic-selector
- **Chat Integration:** conversation, message, response, conversation-bar, transcript-viewer
- **Utility:** avatar, badge, dialog, progress, popover, separator, textarea, command, shimmering-text

### Consolidation Strategy: **MERGE, DON'T REPLACE**

#### ✅ **Keep Existing (Integrated, Working)**
1. `voice-btn.tsx` - Already integrated in ChatContainer, works with useVoiceCapture
2. `drive-mode.tsx` - Unique full-screen experience, no ElevenLabs equivalent
3. `audio.tsx` - Simple playback, no need to replace

#### 🔄 **Enhance with ElevenLabs**
1. **Replace `wave.tsx` with `live-waveform.tsx`**
   - **Rationale:** ElevenLabs has real-time audio reactivity
   - **Trade-off:** More complex, but better UX
   - **Action:** Migrate existing usage to ElevenLabs version

2. **Add `orb.tsx` as alternative visualization**
   - **Rationale:** Aligns with "Signal in the Void" (bioluminescent orb)
   - **Trade-off:** More GPU-intensive
   - **Action:** Use in Drive Mode, keep wave.tsx for chat

3. **Use `transcript-viewer.tsx` for voice history**
   - **Rationale:** We don't have this feature yet
   - **Trade-off:** New feature scope
   - **Action:** Add to user journey (Voice History component)

#### ➕ **Add New Capabilities**
1. **`conversation-bar.tsx` + `message.tsx` + `response.tsx`**
   - **Use Case:** Replace custom chat rendering with ElevenLabs components?
   - **Decision:** **NO** - Our `chat-render.tsx` handles AI SDK v6 parts (plan, task, tool, etc.). ElevenLabs is generic.
   - **Action:** Keep our custom implementation

2. **`voice-picker.tsx`**
   - **Use Case:** Voice settings (choose local vs OpenAI voice)
   - **Decision:** **YES** - Missing from settings
   - **Action:** Add to `/preferences` route

3. **`audio-player.tsx`**
   - **Use Case:** Playback of assistant responses (TTS)
   - **Decision:** **MAYBE** - Current `audio.tsx` is simpler
   - **Action:** Evaluate if enhanced controls (scrub-bar) are needed

### Consolidation Plan

| Component | Action | Rationale | Priority |
|-----------|--------|-----------|----------|
| `wave.tsx` → `live-waveform.tsx` | Replace | Better real-time visualization | HIGH |
| `orb.tsx` | Add (Drive Mode) | Aligns with design system | MEDIUM |
| `voice-picker.tsx` | Add (Settings) | Missing voice provider selection | HIGH |
| `transcript-viewer.tsx` | Add (New feature) | Voice history feature gap | MEDIUM |
| `audio-player.tsx` + `scrub-bar.tsx` | Evaluate | Enhanced controls if needed | LOW |
| Conversation components | Keep separate | Our chat handles AI SDK v6 parts | N/A |

**Recommendation:** Keep both libraries. Use ElevenLabs for **voice-specific UX enhancements**, keep custom components for **AI SDK v6 integration**.

---

## 3. Tremor vs. shadcn/ui: When to Use Each

### Decision Matrix

| Use Case | Use Tremor | Use shadcn/ui | Rationale |
|----------|-----------|---------------|-----------|
| **Forms (input, select, checkbox)** | ❌ | ✅ | Already integrated, less customization |
| **Data tables** | ✅ | ❌ | Tremor has built-in sorting, filtering |
| **Charts & metrics** | ✅ | ❌ | Tremor's core strength |
| **Buttons, cards, badges** | ❌ | ✅ | shadcn already styled for void aesthetic |
| **Dialogs (simple confirmation)** | ❌ | ✅ | shadcn simpler for basic cases |
| **Dialogs (complex, multi-step)** | ✅ | ❌ | Tremor has form dialog blocks |
| **Empty states** | ✅ | ❌ | Tremor has pre-designed blocks |
| **KPI cards** | ✅ | ❌ | Tremor's specialty |
| **Status indicators** | ✅ | ❌ | Tremor's status monitoring blocks |
| **Grid layouts** | ✅ | ❌ | Tremor's grid list blocks |
| **Navigation (tabs)** | ❌ | ✅ | shadcn already used in codebase |

### General Guidelines

**Use Tremor when:**
- Displaying data (charts, tables, metrics)
- Building dashboards
- Showing status/health
- Creating data-dense layouts

**Use shadcn/ui when:**
- Building forms
- Simple UI primitives (buttons, cards, inputs)
- Navigation elements
- Already integrated components

**Avoid duplication:**
- Don't use Tremor's Button if shadcn's Button works
- Don't use Tremor's Card for simple containers (use shadcn)
- Don't use Tremor's basic inputs (TextInput) when shadcn's Input + Label works

---

## 4. User Journey Completion Roadmap

### Journey 1: New User Onboarding (Currently 3/7 stages)

**Missing Stages:**
- ❌ Email Verification (stage 3)
- ❌ Onboarding Wizard (stage 4)
- ❌ Welcome Screen (stage 5)
- ❌ Feature Tour (stage 7)

**Proposed Components:**

| Stage | Component | Tremor Block | Estimated Effort |
|-------|-----------|--------------|------------------|
| Email Verification | Empty state + form | [Empty States](https://blocks.tremor.so/blocks?category=empty-states) (Email verification variant) | 1 day |
| Onboarding Wizard | Multi-step form | [Onboarding & Feed](https://blocks.tremor.so/blocks?category=onboarding-feed) (Step-by-step guide) | 3 days |
| Welcome Screen | Hero + feature cards | [Onboarding & Feed](https://blocks.tremor.so/blocks?category=onboarding-feed) (Welcome screen) | 2 days |
| Feature Tour | Overlay tooltips | Custom (use Radix Tooltip + positioning) | 2 days |

**Total Effort:** 8 days (1.5 weeks)

### Journey 2: Daily Chat Interaction (Currently 5/5 stages) ✅

**Status:** Complete, but can enhance with ElevenLabs visualizations

**Enhancements:**
- Replace `wave.tsx` with `live-waveform.tsx` (1 day)
- Add `orb.tsx` as alternative visualization (1 day)

**Total Effort:** 2 days

### Journey 3: Workflow Execution (Currently 4/7 stages)

**Missing Stages:**
- ❌ Workflow History (stage 5)
- ❌ Biometric Elevation (stage 6)
- ❌ Error Analysis (stage 7)

**Proposed Components:**

| Stage | Component | Tremor Block | Estimated Effort |
|-------|-----------|--------------|------------------|
| Workflow History | Table + filterbar | [Tables](https://blocks.tremor.so/blocks?category=tables) + [Filterbar](https://blocks.tremor.so/blocks?category=filterbar) | 3 days |
| Biometric Elevation | Dialog with challenge | [Dialogs](https://blocks.tremor.so/blocks?category=dialogs) (Form dialog) | 2 days |
| Error Analysis | Status panel + details | [Status Monitoring](https://blocks.tremor.so/blocks?category=status-monitoring) + Dialog | 2 days |

**Total Effort:** 7 days (1.5 weeks)

### Journey 4: Personal Management (Currently 3/5 stages)

**Missing Stages:**
- ❌ Timers (stage 4)
- ❌ Bookmarks (stage 5)

**Proposed Components:**

| Stage | Component | Tremor Block | Estimated Effort |
|-------|-----------|--------------|------------------|
| Timers | Grid cards with controls | [Grid Lists](https://blocks.tremor.so/blocks?category=grid-lists) (Card grid) | 2 days |
| Bookmarks | Table or grid | [Grid Lists](https://blocks.tremor.so/blocks?category=grid-lists) (Product grid) | 2 days |

**Total Effort:** 4 days (1 week)

### Journey 5: Settings & Configuration (Currently 4/7 stages)

**Missing Stages:**
- ❌ Integrations (stage 5)
- ❌ Tool Authorization (stage 6)
- ❌ Voice Settings (stage 7)

**Proposed Components:**

| Stage | Component | Tremor Block / ElevenLabs | Estimated Effort |
|-------|-----------|---------------------------|------------------|
| Integrations | Card grid with status | [Grid Lists](https://blocks.tremor.so/blocks?category=grid-lists) (Integration cards) | 2 days |
| Tool Authorization | Table with permissions | [Tables](https://blocks.tremor.so/blocks?category=tables) (Row actions) | 2 days |
| Voice Settings | Voice picker + preview | ElevenLabs `voice-picker.tsx` | 1 day |

**Total Effort:** 5 days (1 week)

### Journey 6: Voice-First Interaction (Currently 3/3 stages) ✅

**Status:** Complete

**Enhancements:**
- Add voice history with `transcript-viewer.tsx` (2 days)

### Journey 7: Mobile Experience (Currently 1/5 stages)

**Status:** Out of scope for Tremor (web-only library)

**Recommendation:** Focus on responsive web design first, native app later

---

## 5. Design System Integration Guidelines

### Tremor Style Override Strategy

#### Pattern 1: Global CSS Overrides (Recommended)

Create `apps/web/src/styles/tremor-overrides.css`:

```css
/* Import after tremor styles */
@layer components {
  /* Card overrides - HUD aesthetic */
  .tremor-Card-root {
    @apply rounded-3xl border border-white/10 bg-void-surface/40 backdrop-blur-xl;
    @apply shadow-none; /* Remove default shadow */
  }

  /* Text overrides - Bioluminescent */
  .tremor-Text-root {
    @apply text-biolum tracking-tight;
  }

  .tremor-Title-root {
    @apply text-biolum tracking-tighter;
  }

  /* Chart overrides - Void background */
  .tremor-ChartContainer-root {
    @apply bg-transparent;
  }

  /* Remove all box-shadows */
  [class*="tremor-"] {
    box-shadow: none !important;
  }

  /* Button overrides - Rounded pill */
  .tremor-Button-root {
    @apply rounded-full;
  }

  /* Input overrides - Transparent backgrounds */
  .tremor-TextInput-root,
  .tremor-Select-root {
    @apply bg-void-surface/20 border-white/10 text-biolum;
  }

  /* Badge overrides - Glow effect */
  .tremor-Badge-root {
    @apply bg-biolum/20 text-biolum border-biolum/30;
    box-shadow: 0 0 10px oklch(0.99 0 0 / 0.2); /* Outer glow */
  }

  /* Dialog overrides - Void backdrop */
  .tremor-Dialog-overlay {
    @apply bg-void/80 backdrop-blur-sm;
  }

  .tremor-Dialog-content {
    @apply rounded-3xl border border-white/10 bg-void-surface/90 backdrop-blur-xl;
  }

  /* Table overrides */
  .tremor-Table-root {
    @apply bg-transparent;
  }

  .tremor-TableRow-root {
    @apply border-b-white/10;
  }

  .tremor-TableRow-root:hover {
    @apply bg-void-surface/40;
  }

  /* Chart color overrides */
  .tremor-AreaChart-root .recharts-area {
    @apply fill-biolum/20 stroke-biolum;
  }

  .tremor-LineChart-root .recharts-line {
    @apply stroke-biolum;
  }

  .tremor-BarChart-root .recharts-bar {
    @apply fill-biolum/80;
  }
}
```

Import in `apps/web/src/index.css`:

```css
@import "tailwindcss";
@import "tw-animate-css";
@plugin "@tailwindcss/forms";
@import "./styles/tremor-overrides.css"; /* Add this line */
```

#### Pattern 2: Component Wrappers (For Frequently Used)

Create `apps/web/src/components/tremor/` folder:

**`void-card.tsx`:**
```tsx
import { Card, type CardProps } from "@tremor/react";
import { cn } from "@/lib/utils";

export function VoidCard({ className, children, ...props }: CardProps) {
  return (
    <Card
      className={cn(
        "rounded-3xl border border-white/10 bg-void-surface/40 backdrop-blur-xl",
        "shadow-none", // Remove default shadow
        className
      )}
      {...props}
    >
      {children}
    </Card>
  );
}
```

**`biolum-badge.tsx`:**
```tsx
import { Badge, type BadgeProps } from "@tremor/react";
import { cn } from "@/lib/utils";

export function BiolumBadge({ className, children, ...props }: BadgeProps) {
  return (
    <Badge
      className={cn(
        "bg-biolum/20 text-biolum border-biolum/30",
        "shadow-[0_0_10px_oklch(0.99_0_0_/_0.2)]", // Outer glow
        className
      )}
      {...props}
    >
      {children}
    </Badge>
  );
}
```

**`void-dialog.tsx`:**
```tsx
import { Dialog, DialogPanel, type DialogProps } from "@tremor/react";
import { cn } from "@/lib/utils";

export function VoidDialog({ children, ...props }: DialogProps) {
  return (
    <Dialog {...props}>
      <DialogPanel
        className={cn(
          "rounded-3xl border border-white/10 bg-void-surface/90 backdrop-blur-xl",
          "shadow-none"
        )}
      >
        {children}
      </DialogPanel>
    </Dialog>
  );
}
```

#### Pattern 3: Theme Configuration (Chart Colors)

Update `apps/web/src/lib/chartUtils.ts` to use ALFRED colors:

```tsx
export const chartColors = {
  biolum: {
    bg: "bg-biolum",
    stroke: "stroke-biolum",
    fill: "fill-biolum",
    text: "text-biolum",
  },
  "biolum-dim": {
    bg: "bg-biolum-dim",
    stroke: "stroke-biolum-dim",
    fill: "fill-biolum-dim",
    text: "text-biolum-dim",
  },
  "biolum-faint": {
    bg: "bg-biolum-faint",
    stroke: "stroke-biolum-faint",
    fill: "fill-biolum-faint",
    text: "text-biolum-faint",
  },
  // Keep original colors for multi-series charts
  blue: { ... },
  emerald: { ... },
  // ...
} as const;
```

### Animation Alignment with `--ease-fluid`

Tremor uses `cubic-bezier(0.16, 1, 0.3, 1)` by default. ALFRED uses `cubic-bezier(0.25, 0.4, 0.25, 1)`.

**Override in CSS:**

```css
/* Align Tremor animations with ALFRED's fluid easing */
@layer components {
  [class*="tremor-"] {
    transition-timing-function: var(--ease-fluid) !important;
  }
}
```

### Recommendation: **Use Global CSS Overrides + Selective Wrappers**

- **Global CSS:** Handles 80% of styling (colors, shadows, borders)
- **Wrappers:** Only for heavily customized components (VoidCard, BiolumBadge, VoidDialog)
- **Theme Config:** Chart colors for data visualization consistency

---

## 6. Tremor Component Selection Matrix

| Component Category | Use Case in ALFRED | Priority | Customization Level | Specific Blocks |
|-------------------|-------------------|----------|---------------------|-----------------|
| **KPI Cards** | Workflow metrics, System health, Productivity stats | HIGH | Medium | [Single Metric](https://blocks.tremor.so/blocks/kpi-cards/single-metric), [Trend Comparison](https://blocks.tremor.so/blocks/kpi-cards/trend-comparison) |
| **Status Monitoring** | Deployment health, Linear status, Voice model status | HIGH | Light | [Service Status](https://blocks.tremor.so/blocks/status-monitoring/service-status), [Uptime Monitor](https://blocks.tremor.so/blocks/status-monitoring/uptime-monitor) |
| **Dialogs** | Biometric challenge, Workflow errors, Confirmations | HIGH | Heavy | [Form Dialog](https://blocks.tremor.so/blocks/dialogs/form-dialog), [Confirmation Dialog](https://blocks.tremor.so/blocks/dialogs/confirmation) |
| **Chart Compositions** | Runtime dashboard, Execution timeline, Resource usage | MEDIUM | Medium | [Multi-Chart Grid](https://blocks.tremor.so/blocks/chart-compositions/multi-chart-grid), [Metric + Chart](https://blocks.tremor.so/blocks/chart-compositions/metric-chart) |
| **Filterbar** | Workflow history, Notes search, Deployment filter | MEDIUM | Light | [Advanced Filter](https://blocks.tremor.so/blocks/filterbar/advanced-filter), [Date Range Filter](https://blocks.tremor.so/blocks/filterbar/date-range) |
| **Grid Lists** | Timer cards, Bookmark cards, Integration cards | MEDIUM | Medium | [Card Grid](https://blocks.tremor.so/blocks/grid-lists/card-grid), [Product Grid](https://blocks.tremor.so/blocks/grid-lists/product-grid) |
| **Empty States** | First-time onboarding, No workflows, No integrations | MEDIUM | Light | [No Data State](https://blocks.tremor.so/blocks/empty-states/no-data), [Onboarding Empty](https://blocks.tremor.so/blocks/empty-states/onboarding) |
| **Tables** | Workflow history, Tool permissions, Deployment list | MEDIUM | Light | [Sortable Table](https://blocks.tremor.so/blocks/tables/sortable), [Row Actions](https://blocks.tremor.so/blocks/table-actions/row-actions) |
| **Onboarding & Feed** | Welcome wizard, Feature tour, Activity feed | LOW | Heavy | [Step-by-Step Guide](https://blocks.tremor.so/blocks/onboarding-feed/step-by-step), [Welcome Screen](https://blocks.tremor.so/blocks/onboarding-feed/welcome) |
| **Form Layouts** | Settings pages, Integration setup | LOW | Light | [Settings Form](https://blocks.tremor.so/blocks/form-layouts/settings), [Multi-Column Form](https://blocks.tremor.so/blocks/form-layouts/multi-column) |

---

## 7. 3-Week Implementation Plan

### Week 1: Critical Gaps (Timers, Bookmarks, Workflow History)

**Goal:** Fill highest-priority component gaps to complete Personal Management and Workflow Execution journeys.

#### Day 1-2: Timer Management UI
- **Components:** Tremor Grid List (Card Grid) + Custom timer controls
- **Route:** `/timer`
- **Blocks Reference:** [Card Grid](https://blocks.tremor.so/blocks/grid-lists/card-grid)
- **Tasks:**
  1. Create `timer.tsx` route
  2. Implement `TimerPane` component using Tremor Card + Grid
  3. Add timer controls (start/pause/reset buttons)
  4. Wire to existing timer backend (tRPC `timer.*` procedures)
  5. Apply Void styling (VoidCard wrapper)
- **Estimated Effort:** 2 days

#### Day 3-4: Bookmarks Management UI
- **Components:** Tremor Grid List (Product Grid) or Table
- **Route:** `/book`
- **Blocks Reference:** [Product Grid](https://blocks.tremor.so/blocks/grid-lists/product-grid)
- **Tasks:**
  1. Create `book.tsx` route
  2. Implement `BookmarkPane` component (grid or table based on UX preference)
  3. Add bookmark form (title, URL, tags)
  4. Wire to existing bookmark backend
  5. Apply Void styling
- **Estimated Effort:** 2 days

#### Day 5: Workflow History Page (Part 1: Layout)
- **Components:** Tremor Table + Filterbar
- **Route:** `/workflows`
- **Blocks Reference:** [Sortable Table](https://blocks.tremor.so/blocks/tables/sortable) + [Advanced Filter](https://blocks.tremor.so/blocks/filterbar/advanced-filter)
- **Tasks:**
  1. Create `workflows.tsx` route
  2. Implement table layout with columns: ID, Status, Agent, Started, Duration, Actions
  3. Add basic filtering (status, date range)
  4. Wire to workflow backend (query all runs)
  5. Apply Void styling to table
- **Estimated Effort:** 1 day

**Week 1 Deliverables:**
- ✅ Timer management fully functional
- ✅ Bookmarks management fully functional
- ✅ Workflow history page (basic layout)

---

### Week 2: Voice Consolidation & Settings UI

**Goal:** Enhance voice experience with ElevenLabs components and complete Settings journey.

#### Day 1: Voice Component Consolidation
- **Components:** Replace `wave.tsx` with `live-waveform.tsx`, add `orb.tsx` to Drive Mode
- **Tasks:**
  1. Migrate `ChatContainer` to use `live-waveform.tsx`
  2. Update `drive-mode.tsx` to use `orb.tsx` as primary visualization
  3. Test voice capture integration
  4. Remove unused `wave.tsx` after migration
- **Estimated Effort:** 1 day

#### Day 2: Voice Settings Component
- **Components:** ElevenLabs `voice-picker.tsx`
- **Route:** `/preferences` (add voice section)
- **Tasks:**
  1. Add voice provider selection (local vs OpenAI)
  2. Integrate `voice-picker.tsx` for voice model selection
  3. Wire to preferences backend (store voice preferences)
  4. Add voice preview functionality
- **Estimated Effort:** 1 day

#### Day 3-4: Linear Integration Management UI
- **Components:** Tremor Grid List (Integration Cards) + Status Monitoring
- **Route:** `/integrations` (new)
- **Blocks Reference:** [Integration Cards](https://blocks.tremor.so/blocks/grid-lists/integration-cards) + [Service Status](https://blocks.tremor.so/blocks/status-monitoring/service-status)
- **Tasks:**
  1. Create `integrations.tsx` route
  2. Display Linear connection status (connected/disconnected)
  3. Add OAuth connection flow
  4. Show integration health metrics
  5. Apply Void styling
- **Estimated Effort:** 2 days

#### Day 5: Workflow History (Part 2: Details & Actions)
- **Components:** Tremor Dialog + Status Monitoring
- **Tasks:**
  1. Add row actions (view details, cancel, replay)
  2. Implement workflow detail modal (events, steps, output)
  3. Add workflow cancellation
  4. Add workflow replay
- **Estimated Effort:** 1 day

**Week 2 Deliverables:**
- ✅ Voice components consolidated
- ✅ Voice settings UI complete
- ✅ Linear integration management complete
- ✅ Workflow history fully functional (with details & actions)

---

### Week 3: Onboarding Wizard & Error Analysis UI

**Goal:** Complete Onboarding journey and Workflow Execution journey (error analysis).

#### Day 1-2: Biometric Elevation Challenge Modal
- **Components:** Tremor Dialog (Form Dialog)
- **Blocks Reference:** [Form Dialog](https://blocks.tremor.so/blocks/dialogs/form-dialog)
- **Tasks:**
  1. Create `BiometricChallengeDialog` component
  2. Integrate with workflow suspend/resume flow
  3. Add passkey prompt UI
  4. Wire to auth backend (requireRecentBiometric)
  5. Apply Void styling (VoidDialog wrapper)
- **Estimated Effort:** 2 days

#### Day 3: Workflow Error Analysis UI
- **Components:** Tremor Status Monitoring + Dialog
- **Blocks Reference:** [Status Monitoring](https://blocks.tremor.so/blocks/status-monitoring/status-monitoring) + Dialog
- **Tasks:**
  1. Create `WorkflowErrorPanel` component
  2. Display error details (message, stack trace, context)
  3. Add debugging hints (common issues, solutions)
  4. Show affected resources
  5. Apply Void styling
- **Estimated Effort:** 1 day

#### Day 4-5: Onboarding Wizard
- **Components:** Tremor Onboarding & Feed (Step-by-Step Guide)
- **Route:** `/onboarding` (new)
- **Blocks Reference:** [Step-by-Step Guide](https://blocks.tremor.so/blocks/onboarding-feed/step-by-step)
- **Tasks:**
  1. Create multi-step wizard (Welcome → Preferences → Integrations → Tour)
  2. Add progress indicator
  3. Store onboarding completion state
  4. Redirect to dashboard on completion
  5. Apply Void styling
- **Estimated Effort:** 2 days

**Week 3 Deliverables:**
- ✅ Biometric elevation challenge complete
- ✅ Workflow error analysis UI complete
- ✅ Onboarding wizard complete
- ✅ All high-priority user journeys complete (5/7 → 7/7)

---

## 8. Trade-offs & Recommendations

### Complexity vs. Benefit Analysis

| Decision | Complexity | Benefit | Recommendation |
|----------|-----------|---------|----------------|
| **Global CSS overrides** | Low | High (80% coverage) | ✅ **DO IT** - Low effort, high impact |
| **Component wrappers** | Medium | Medium (reusability) | ✅ **DO IT** - For Card, Badge, Dialog only |
| **Replace all voice components** | High | Low (working already) | ❌ **DON'T** - Merge selectively instead |
| **Use Tremor for all forms** | Medium | Low (shadcn works) | ❌ **DON'T** - Keep shadcn for forms |
| **Build custom chart library** | Very High | Low (Tremor exists) | ❌ **DON'T** - Use Tremor charts |
| **Onboarding wizard** | High | High (user retention) | ✅ **DO IT** - But Week 3 (lower priority) |
| **Workflow history page** | Medium | High (missing feature) | ✅ **DO IT** - Week 1 (high priority) |
| **Timer/Bookmark UIs** | Low | High (backend exists) | ✅ **DO IT** - Week 1 (quick wins) |

### Final Recommendations

1. **Adopt Tremor incrementally:** Don't replace existing working components. Use Tremor for new features first (Timers, Bookmarks, Workflow History).

2. **Prioritize data-dense UIs:** Tremor shines in dashboards and metrics. Use it for workflow metrics, status monitoring, and analytics.

3. **Keep voice stack hybrid:** ElevenLabs for visualizations + controls, custom components for AI SDK v6 integration.

4. **Design system discipline:** Apply Void aesthetic consistently via global CSS + selective wrappers. Don't let Tremor's default styles leak through.

5. **User journey focus:** Complete high-value incomplete journeys first (Personal Management, Workflow Execution) before nice-to-haves (Onboarding).

---

## 9. Success Metrics

### Technical Metrics
- **Component Coverage:** 46 components → 70+ components (50% increase)
- **User Journey Completion:** 2/7 complete → 5/7 complete (by end of Week 2)
- **Design System Consistency:** 100% of new components use Void aesthetic

### User Experience Metrics
- **Time to First Value:** Reduce from "no onboarding" to < 5 minutes (with wizard)
- **Feature Discoverability:** 0% (Timers/Bookmarks hidden) → 100% (visible in UI)
- **Workflow Transparency:** No history → Full audit trail

### Development Metrics
- **Code Reuse:** 80% of new UIs use Tremor blocks (vs. custom components)
- **Development Speed:** 2-3 days per feature (vs. 5-7 days for fully custom)
- **Maintenance Burden:** Reduce by consolidating duplicate components (voice stack)

---

## 10. Next Steps

1. **Review & Approve:** Get stakeholder approval on this strategy
2. **Create GitHub Issues:** Break down 3-week plan into trackable tasks
3. **Setup Tremor Overrides:** Create `tremor-overrides.css` (Day 0)
4. **Week 1 Kickoff:** Start with Timer management UI (high value, low risk)
5. **Iterate & Learn:** Adjust plan based on learnings from Week 1

---

**Document Status:** Draft for Review  
**Last Updated:** 2025-01-27  
**Author:** AI Assistant  
**Next Review:** After stakeholder feedback

