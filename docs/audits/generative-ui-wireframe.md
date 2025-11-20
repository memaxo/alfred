# ALFRED Generative UI Wireframe

**Date:** 2025-01-27  
**Status:** Single-Page Generative Interface  
**Vision:** Jarvis-like voice-first desktop environment

---

## Single Page Layout

### Full Viewport Structure

```
╔═══════════════════════════════════════════════════════════════════════╗
║                                                                       ║
║                    THE VOID (oklch(0.05 0 0))                        ║
║                    + Static Noise Texture (2-3% opacity)             ║
║                                                                       ║
║                                                                       ║
║                                                                       ║
║                        ┌──────────────┐                               ║
║                        │              │                               ║
║                        │   🟢 ORB     │  ← Floating Avatar           ║
║                        │   (ALFRED)   │     (center stage)            ║
║                        │              │                               ║
║                        └──────────────┘                               ║
║                                                                       ║
║                                                                       ║
║                        [Voice Transcript]                             ║
║                        [Waveform Visualization]                       ║
║                                                                       ║
║                                                                       ║
║                                                                       ║
║                                                                       ║
║  ┌───────────────────────────────────────────────────────────────┐  ║
║  │  Context Bar (Fixed Bottom)                                   │  ║
║  │  ● Connected  │  14:32  │  Voice: Local  │  Cmd+K              │  ║
║  └───────────────────────────────────────────────────────────────┘  ║
║                                                                       ║
╚═══════════════════════════════════════════════════════════════════════╝
```

---

## State Wireframes

### 1. Idle State (Default)

```
╔═══════════════════════════════════════════════════════════════════════╗
║                                                                       ║
║                                                                       ║
║                                                                       ║
║                                                                       ║
║                        ┌──────────────┐                               ║
║                        │              │                               ║
║                        │   🟢 ORB     │  ← Idle: Gentle pulse        ║
║                        │   (ALFRED)   │     oklch(0.99 0 0)           ║
║                        │              │     Subtle breathing          ║
║                        └──────────────┘                               ║
║                                                                       ║
║                        "Listening..."                                ║
║                        (text-biolum-faint)                           ║
║                                                                       ║
║                                                                       ║
║                                                                       ║
║                                                                       ║
║  ┌───────────────────────────────────────────────────────────────┐  ║
║  │  ● Connected  │  14:32  │  Voice: Local                        │  ║
║  └───────────────────────────────────────────────────────────────┘  ║
║                                                                       ║
╚═══════════════════════════════════════════════════════════════════════╝
```

**Key Elements:**
- Orb: Centered, 200px diameter, floating animation
- No other UI visible
- Minimal cognitive load

---

### 2. Listening State

```
╔═══════════════════════════════════════════════════════════════════════╗
║                                                                       ║
║                                                                       ║
║                        ┌──────────────┐                               ║
║                        │              │                               ║
║                        │   🟣 ORB     │  ← Listening: Purple pulse    ║
║                        │   (ALFRED)   │     Reactive to voice input   ║
║                        │              │                               ║
║                        └──────────────┘                               ║
║                                                                       ║
║              ┌────────────────────────────────────┐                  ║
║              │  [Waveform Visualization]           │                  ║
║              │  ▁▂▃▅▆▇█▇▆▅▃▂▁▂▃▅▆▇█▇▆▅▃▂▁         │                  ║
║              └────────────────────────────────────┘                  ║
║                                                                       ║
║              "Create a note titled Meeting Notes"                    ║
║              (text-biolum, real-time transcript)                     ║
║                                                                       ║
║                                                                       ║
║  ┌───────────────────────────────────────────────────────────────┐  ║
║  │  ● Listening  │  14:32  │  Voice: Local                        │  ║
║  └───────────────────────────────────────────────────────────────┘  ║
║                                                                       ║
╚═══════════════════════════════════════════════════════════════════════╝
```

**Key Elements:**
- Orb: Reactive to voice input (waveform-driven)
- Waveform: Real-time visualization below orb
- Transcript: Appears as user speaks

---

### 3. Thinking/Processing State

```
╔═══════════════════════════════════════════════════════════════════════╗
║                                                                       ║
║                        ┌──────────────┐                               ║
║                        │              │                               ║
║                        │   🔵 ORB     │  ← Thinking: Blue pulse       ║
║                        │   (ALFRED)   │     Animated, rhythmic       ║
║                        │              │                               ║
║                        └──────────────┘                               ║
║                                                                       ║
║              "Creating a note..."                                     ║
║              (text-biolum-dim)                                         ║
║                                                                       ║
║              ┌────────────────────────────────────┐                  ║
║              │  [Progress Indicator]              │                  ║
║              │  ▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░░░░░░░    │                  ║
║              └────────────────────────────────────┘                  ║
║                                                                       ║
║                                                                       ║
║  ┌───────────────────────────────────────────────────────────────┐  ║
║  │  ● Processing  │  14:32  │  Voice: Local                      │  ║
║  └───────────────────────────────────────────────────────────────┘  ║
║                                                                       ║
╚═══════════════════════════════════════════════════════════════════════╝
```

**Key Elements:**
- Orb: Animated thinking state
- Progress: Subtle, non-intrusive
- Status: "Processing" in context bar

---

### 4. Speaking/Response State

```
╔═══════════════════════════════════════════════════════════════════════╗
║                                                                       ║
║                        ┌──────────────┐                               ║
║                        │              │                               ║
║                        │   🟢 ORB     │  ← Speaking: Green reactive   ║
║                        │   (ALFRED)   │     to TTS output            ║
║                        │              │                               ║
║                        └──────────────┘                               ║
║                                                                       ║
║              ┌────────────────────────────────────┐                  ║
║              │  "I've created a note titled      │                  ║
║              │   'Meeting Notes'."                │                  ║
║              └────────────────────────────────────┘                  ║
║                                                                       ║
║              ┌────────────────────────────────────┐                  ║
║              │  [Waveform - TTS Output]           │                  ║
║              │  ▁▂▃▅▆▇█▇▆▅▃▂▁▂▃▅▆▇█▇▆▅▃▂▁         │                  ║
║              └────────────────────────────────────┘                  ║
║                                                                       ║
║  ┌───────────────────────────────────────────────────────────────┐  ║
║  │  ● Speaking  │  14:32  │  Voice: Local                        │  ║
║  └───────────────────────────────────────────────────────────────┘  ║
║                                                                       ║
╚═══════════════════════════════════════════════════════════════════════╝
```

**Key Elements:**
- Orb: Reactive to TTS output
- Transcript: ALFRED's response
- Waveform: TTS visualization

---

### 5. Progressive Disclosure: Note Created

```
╔═══════════════════════════════════════════════════════════════════════╗
║                                                                       ║
║                        ┌──────────────┐                               ║
║                        │   🟢 ORB     │                               ║
║                        │   (ALFRED)   │                               ║
║                        └──────────────┘                               ║
║                                                                       ║
║              "I've created a note titled 'Meeting Notes'."            ║
║                                                                       ║
║  ┌───────────────────────────────────────────────────────────────┐  ║
║  │  Note Created                          [×]                     │  ║
║  │  ┌─────────────────────────────────────────────────────────┐  │  ║
║  │  │ Title: Meeting Notes                                    │  │  ║
║  │  │                                                          │  │  ║
║  │  │ Content: Discussion about Q1 planning...                │  │  ║
║  │  │                                                          │  │  ║
║  │  │ [View] [Edit] [Dismiss]                                 │  │  ║
║  │  └─────────────────────────────────────────────────────────┘  │  ║
║  └───────────────────────────────────────────────────────────────┘  ║
║                                                                       ║
║  ┌───────────────────────────────────────────────────────────────┐  ║
║  │  ● Ready  │  14:32  │  Voice: Local                            │  ║
║  └───────────────────────────────────────────────────────────────┘  ║
║                                                                       ║
╚═══════════════════════════════════════════════════════════════════════╝
```

**Card Styling:**
- Background: `bg-void-surface/40 backdrop-blur-xl`
- Border: `border-white/10 rounded-3xl`
- Shadow: Outer glow `shadow-biolum/20`
- Animation: Fade-in 200ms, auto-dismiss 5s

---

### 6. Progressive Disclosure: Multiple Contexts

```
╔═══════════════════════════════════════════════════════════════════════╗
║                                                                       ║
║  ┌──────────────────┐                                                ║
║  │  Reminder        │  ← Floating cards                              ║
║  │  Due in 5 min    │     (positioned dynamically)                  ║
║  │  [Dismiss]       │                                                ║
║  └──────────────────┘                                                ║
║                                                                       ║
║                        ┌──────────────┐                               ║
║                        │   🟢 ORB     │                               ║
║                        │   (ALFRED)   │                               ║
║                        └──────────────┘                               ║
║                                                                       ║
║              "What would you like to do next?"                        ║
║                                                                       ║
║  ┌──────────────────┐                                                ║
║  │  Active Timer    │  ← Contextual overlays                         ║
║  │  00:05:23        │     (non-intrusive)                            ║
║  │  [Stop]          │                                                ║
║  └──────────────────┘                                                ║
║                                                                       ║
║  ┌───────────────────────────────────────────────────────────────┐  ║
║  │  ● Ready  │  14:32  │  Voice: Local                            │  ║
║  └───────────────────────────────────────────────────────────────┘  ║
║                                                                       ║
╚═══════════════════════════════════════════════════════════════════════╝
```

**Positioning:**
- Cards avoid overlap (smart positioning)
- Z-index: Newer cards appear above
- Gestures: Drag to reposition, swipe to dismiss

---

### 7. Command Palette (Cmd+K)

```
╔═══════════════════════════════════════════════════════════════════════╗
║                                                                       ║
║                        ┌──────────────┐                               ║
║                        │   🟢 ORB     │                               ║
║                        │   (ALFRED)   │                               ║
║                        └──────────────┘                               ║
║                                                                       ║
║  ┌───────────────────────────────────────────────────────────────┐  ║
║  │  Command Palette                                               │  ║
║  │  ┌─────────────────────────────────────────────────────────┐  │  ║
║  │  │ > [Type command...]                                      │  │  ║
║  │  │                                                          │  │  ║
║  │  │  📝 Create Note                                          │  │  ║
║  │  │  ⏰ Set Reminder                                         │  │  ║
║  │  │  🔗 Open Bookmarks                                       │  │  ║
║  │  │  ⚙️  Settings                                            │  │  ║
║  │  │  📊 View Workflows                                       │  │  ║
║  │  └─────────────────────────────────────────────────────────┘  │  ║
║  └───────────────────────────────────────────────────────────────┘  ║
║                                                                       ║
║  ┌───────────────────────────────────────────────────────────────┐  ║
║  │  ● Ready  │  14:32  │  Voice: Local  │  Cmd+K                  │  ║
║  └───────────────────────────────────────────────────────────────┘  ║
║                                                                       ║
╚═══════════════════════════════════════════════════════════════════════╝
```

**Features:**
- Keyboard shortcut: `Cmd+K` (or `Ctrl+K` on Windows/Linux)
- Voice command: "show commands"
- Fuzzy search: Type to filter
- Keyboard navigation: Arrow keys + Enter

---

## Component Breakdown

### Orb Avatar States

```
┌──────────────┐
│              │
│   🟢 IDLE    │  ← White, gentle pulse
│              │
└──────────────┘

┌──────────────┐
│              │
│   🟣 LISTEN  │  ← Purple, reactive to voice
│              │
└──────────────┘

┌──────────────┐
│              │
│   🔵 THINK   │  ← Blue, animated pulse
│              │
└──────────────┘

┌──────────────┐
│              │
│   🟢 SPEAK   │  ← Green, reactive to TTS
│              │
└──────────────┘
```

---

### Progressive Card Types

#### Note Card
```
┌─────────────────────────────────────┐
│  Note Created              [×]       │
│  ┌───────────────────────────────┐  │
│  │ Title: Meeting Notes           │  │
│  │ Content: Discussion...        │  │
│  │                                │  │
│  │ [View] [Edit] [Dismiss]        │  │
│  └───────────────────────────────┘  │
└─────────────────────────────────────┘
```

#### Reminder Card
```
┌─────────────────────────────────────┐
│  Reminder Due            [×]         │
│  ┌───────────────────────────────┐  │
│  │ Team standup in 5 minutes     │  │
│  │                                │  │
│  │ [Snooze] [Complete] [Dismiss] │  │
│  └───────────────────────────────┘  │
└─────────────────────────────────────┘
```

#### Timer Overlay
```
┌─────────────────────────────────────┐
│  Active Timer            [×]        │
│  ┌───────────────────────────────┐  │
│  │  00:05:23                      │  │
│  │                                │  │
│  │  [Pause] [Stop]                │  │
│  └───────────────────────────────┘  │
└─────────────────────────────────────┘
```

#### Workflow Status Card
```
┌─────────────────────────────────────┐
│  Workflow Running        [×]         │
│  ┌───────────────────────────────┐  │
│  │ Deploying to production...     │  │
│  │                                │  │
│  │  [Progress Bar]                │  │
│  │                                │  │
│  │  [View Details] [Cancel]      │  │
│  └───────────────────────────────┘  │
└─────────────────────────────────────┘
```

---

## Interaction Flows

### Flow 1: Voice → Note Creation

```
Step 1: Idle
┌──────────────┐
│   🟢 ORB     │
└──────────────┘

Step 2: Listening
┌──────────────┐
│   🟣 ORB     │  + Waveform
└──────────────┘  + Transcript

Step 3: Thinking
┌──────────────┐
│   🔵 ORB     │  + "Creating..."
└──────────────┘

Step 4: Speaking
┌──────────────┐
│   🟢 ORB     │  + Response
└──────────────┘  + TTS Waveform

Step 5: Card Appears
┌──────────────┐
│   🟢 ORB     │
└──────────────┘
     ↓
┌──────────────┐
│ Note Card    │  ← Fade in
└──────────────┘

Step 6: Idle
┌──────────────┐
│   🟢 ORB     │
└──────────────┘
```

---

### Flow 2: Command Palette

```
Step 1: Press Cmd+K
┌──────────────┐
│   🟢 ORB     │
└──────────────┘
     ↓
┌──────────────────────┐
│ Command Palette      │  ← Appears
│ > [Type...]          │
└──────────────────────┘

Step 2: Type "note"
┌──────────────────────┐
│ > note               │
│                      │
│ 📝 Create Note       │  ← Highlighted
│ 📝 View Notes        │
└──────────────────────┘

Step 3: Press Enter
┌──────────────┐
│   🔵 ORB     │  ← Thinking
└──────────────┘
     ↓
┌──────────────┐
│ Note Card    │  ← Appears
└──────────────┘
```

---

## Responsive Behavior

### Desktop (>1024px)
- Orb: 200px diameter
- Cards: Max width 400px
- Context bar: Full width

### Tablet (768px - 1024px)
- Orb: 180px diameter
- Cards: Max width 350px
- Context bar: Full width

### Mobile (<768px)
- Orb: 150px diameter
- Cards: Full width (with padding)
- Context bar: Compact layout

---

## Animation Specifications

### Orb State Transitions
- Duration: 300ms
- Easing: `cubic-bezier(0.25, 0.4, 0.25, 1)`
- Effect: Color fade + scale pulse

### Card Appearance
- Duration: 200ms
- Easing: `cubic-bezier(0.25, 0.4, 0.25, 1)`
- Effect: Fade in + scale up (0.95 → 1.0)

### Card Dismissal
- Duration: 300ms
- Easing: `cubic-bezier(0.25, 0.4, 0.25, 1)`
- Effect: Fade out + scale down (1.0 → 0.95)

### Floating Animation
- Duration: 3s (infinite loop)
- Easing: `ease-in-out`
- Effect: Y-axis oscillation (±10px)

---

## Accessibility Features

### Keyboard Navigation
- `Cmd+K` / `Ctrl+K`: Open command palette
- `Esc`: Close command palette / dismiss card
- `Tab`: Navigate between cards
- `Enter`: Activate focused card action
- `Arrow keys`: Navigate command palette

### Screen Reader Support
- Orb state announced: "ALFRED is listening"
- Card content announced when appears
- Context bar status announced

### Focus Management
- Focus trap in command palette
- Focus returns to orb after card dismiss
- Focus visible indicators

---

## Technical Stack

### Core Components
- **Orb**: Three.js WebGL rendering (`@/components/ui/orb.tsx`)
- **Voice**: `useVoiceCapture` hook + `useAssistantStream`
- **Cards**: Custom progressive disclosure component
- **Command Palette**: Custom with fuzzy search

### State Management
- Zustand or React Context for global state
- Card registry for active cards
- Position management for card layout

### Styling
- Tailwind v4 with design system tokens
- Framer Motion for animations
- CSS variables for theming

---

## Migration Checklist

### Phase 1: Core Interface
- [ ] Create `GenerativeInterface` component
- [ ] Implement void background with noise
- [ ] Integrate orb avatar (centered, floating)
- [ ] Add context bar (bottom)

### Phase 2: Voice Layer
- [ ] Integrate `useVoiceCapture`
- [ ] Display transcript below orb
- [ ] Show waveform during input/output
- [ ] TTS integration with orb reactivity

### Phase 3: Progressive Disclosure
- [ ] Create card component (HUD styling)
- [ ] Implement appear/dismiss animations
- [ ] Position management (avoid overlap)
- [ ] Gesture support (drag, swipe)

### Phase 4: Features
- [ ] Migrate notes → progressive cards
- [ ] Migrate reminders → overlay cards
- [ ] Migrate timers → persistent overlay
- [ ] Migrate workflows → status cards

### Phase 5: Command Palette
- [ ] Keyboard shortcut (`Cmd+K`)
- [ ] Voice command ("show commands")
- [ ] Fuzzy search
- [ ] Keyboard navigation

### Phase 6: Polish
- [ ] Animations (orb transitions, card animations)
- [ ] Accessibility (keyboard, screen reader)
- [ ] Mobile optimization
- [ ] Performance optimization

---

## Success Criteria

### User Experience
- ✅ Minimal cognitive load (orb + context bar only at rest)
- ✅ Voice-first interaction (80%+ interactions via voice)
- ✅ Progressive disclosure (information appears only when needed)
- ✅ Desktop-like environment (not traditional web app)

### Performance
- ✅ Orb: 60fps smooth animation
- ✅ Card appear: <200ms fade-in
- ✅ Voice latency: <500ms (p90) for response

### Accessibility
- ✅ Keyboard navigation: 100% keyboard accessible
- ✅ Screen reader: Full ARIA support
- ✅ Focus management: Proper focus traps

---

## References

- Architecture: `docs/strategy/generative-ui-architecture.md`
- Design System: `docs/design-system.md`
- Orb Component: `apps/web/src/components/ui/orb.tsx`
- Voice Hooks: `apps/web/src/hooks/use-voice-capture.ts`

