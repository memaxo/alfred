# ALFRED Generative UI Architecture

**Date:** 2025-01-27  
**Status:** Architectural Redesign  
**Vision:** Jarvis-like single-page generative interface with progressive disclosure

---

## Core Philosophy

ALFRED is not a website with pages. It is a **generative desktop environment** where:

1. **Voice is primary** - All interactions start with voice
2. **Progressive disclosure** - Information appears only when needed
3. **Single page** - No navigation, no tabs, no traditional routing
4. **Floating orb avatar** - ALFRED's presence is always visible
5. **Minimal cognitive load** - Clean void, bioluminescent signals only

---

## Architecture Overview

### Single Page Structure

```
┌─────────────────────────────────────────────────────────────┐
│  THE VOID (oklch(0.05 0 0) + noise texture)                 │
│                                                              │
│  ┌────────────────────────────────────────────────────┐     │
│  │                                                    │     │
│  │              ┌──────────────┐                      │     │
│  │              │              │                      │     │
│  │              │   🟢 ORB     │  ← Floating Avatar   │     │
│  │              │   (ALFRED)    │     (center stage)   │     │
│  │              │              │                      │     │
│  │              └──────────────┘                      │     │
│  │                                                    │     │
│  │         [Voice Input Area]                         │     │
│  │         [Transcript Display]                      │     │
│  │                                                    │     │
│  └────────────────────────────────────────────────────┘     │
│                                                              │
│  ┌────────────────────────────────────────────────────┐     │
│  │  Progressive Disclosure Layer                      │     │
│  │  (Appears on demand - notes, reminders, etc.)      │     │
│  └────────────────────────────────────────────────────┘     │
│                                                              │
│  ┌────────────────────────────────────────────────────┐     │
│  │  Context Bar (bottom)                              │     │
│  │  [Status] [Time] [Connection]                      │     │
│  └────────────────────────────────────────────────────┘     │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Component Hierarchy

### Root Component: `GenerativeInterface`

```typescript
<GenerativeInterface>
  <VoidBackground />           {/* Static noise texture */}
  <OrbAvatar />                 {/* Floating orb - always visible */}
  <VoiceInteraction />          {/* Primary interaction layer */}
  <ProgressiveDisclosure />     {/* Contextual UI elements */}
  <ContextBar />                {/* Minimal status bar */}
</GenerativeInterface>
```

---

## Detailed Wireframes

### 1. Idle State (Default) - The Void

```
╔═══════════════════════════════════════════════════════════════════════╗
║                                                                       ║
║                    THE VOID (oklch(0.05 0 0))                        ║
║                    + Static Noise Texture (2-3% opacity)              ║
║                                                                       ║
║                                                                       ║
║                                                                       ║
║                        ┌──────────────┐                               ║
║                        │              │                               ║
║                        │   🟢 ORB     │  ← Idle: Gentle pulse         ║
║                        │   (ALFRED)   │     oklch(0.99 0 0)           ║
║                        │              │     Subtle breathing          ║
║                        │   [Floating] │     (±10px Y-axis)            ║
║                        └──────────────┘                               ║
║                                                                       ║
║                        "Listening..."                                 ║
║                        (text-biolum-faint, 0.40 opacity)             ║
║                                                                       ║
║                                                                       ║
║                                                                       ║
║  ┌───────────────────────────────────────────────────────────────┐  ║
║  │  ● Connected  │  14:32  │  Voice: Local  │  Cmd+K              │  ║
║  └───────────────────────────────────────────────────────────────┘  ║
║                                                                       ║
╚═══════════════════════════════════════════════════════════════════════╝
```

**Elements:**
- **Orb:** Centered, 200px diameter, floating animation (subtle Y-axis oscillation)
- **State:** `idle` - Gentle white pulse, calm presence
- **Emotion:** Neutral, ready, attentive
- **No other UI visible** - Minimal cognitive load
- **Context bar:** Minimal status indicators (transparent background)
- **Voice:** Always-on listening (no visual indicator needed at idle)

---

### 2. Listening State - Active Voice Input

```
╔═══════════════════════════════════════════════════════════════════════╗
║                                                                       ║
║                        ┌──────────────┐                               ║
║                        │              │                               ║
║                        │   🟣 ORB     │  ← Listening: Purple pulse      ║
║                        │   (ALFRED)   │     Reactive to voice input     ║
║                        │   [Pulsing]  │     Waveform-driven animation  ║
║                        └──────────────┘                               ║
║                                                                       ║
║              ┌────────────────────────────────────┐                  ║
║              │  [Live Waveform Visualization]      │                  ║
║              │  ▁▂▃▅▆▇█▇▆▅▃▂▁▂▃▅▆▇█▇▆▅▃▂▁         │                  ║
║              │  Real-time audio reactivity         │                  ║
║              └────────────────────────────────────┘                  ║
║                                                                       ║
║              ┌────────────────────────────────────┐                  ║
║              │  "Create a note titled Meeting     │                  ║
║              │   Notes about Q1 planning..."      │                  ║
║              │  (text-biolum, real-time transcript)│                  ║
║              └────────────────────────────────────┘                  ║
║                                                                       ║
║  ┌───────────────────────────────────────────────────────────────┐  ║
║  │  ● Listening  │  14:32  │  Voice: Local                      │  ║
║  └───────────────────────────────────────────────────────────────┘  ║
║                                                                       ║
╚═══════════════════════════════════════════════════════════════════════╝
```

**Elements:**
- **Orb:** Purple pulse (`curious` emotion), reactive to voice input amplitude
- **State:** `listening` - Active voice capture, waveform visualization
- **Emotion:** Curious, attentive, engaged
- **Waveform:** Real-time visualization below orb (reacts to audio)
- **Transcript:** Appears as user speaks (real-time STT)
- **Visual Feedback:** Orb pulses in sync with voice input

---

### 3. Thinking/Processing State - ALFRED Working

```
╔═══════════════════════════════════════════════════════════════════════╗
║                                                                       ║
║                        ┌──────────────┐                               ║
║                        │              │                               ║
║                        │   🔵 ORB     │  ← Thinking: Blue pulse       ║
║                        │   (ALFRED)   │     Animated, rhythmic        ║
║                        │   [Pulsing]  │     Processing indicator      ║
║                        └──────────────┘                               ║
║                                                                       ║
║              ┌────────────────────────────────────┐                  ║
║              │  "Creating a note..."               │                  ║
║              │  (text-biolum-dim, 0.70 opacity)   │                  ║
║              └────────────────────────────────────┘                  ║
║                                                                       ║
║              ┌────────────────────────────────────┐                  ║
║              │  [Progress Indicator]               │                  ║
║              │  ▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░░░░░░░    │                  ║
║              │  Subtle, non-intrusive              │                  ║
║              └────────────────────────────────────┘                  ║
║                                                                       ║
║  ┌───────────────────────────────────────────────────────────────┐  ║
║  │  ● Processing  │  14:32  │  Voice: Local                      │  ║
║  └───────────────────────────────────────────────────────────────┘  ║
║                                                                       ║
╚═══════════════════════════════════════════════════════════════════════╝
```

**Elements:**
- **Orb:** Blue animated pulse (`thoughtful` emotion)
- **State:** `thinking` - Processing request, executing tool
- **Emotion:** Thoughtful, focused, working
- **Progress:** Subtle indicator (not blocking, just feedback)
- **Narration:** ALFRED speaks what it's doing ("Creating a note...")
- **Status:** "Processing" in context bar

---

### 4. Speaking/Response State - ALFRED Responds

```
╔═══════════════════════════════════════════════════════════════════════╗
║                                                                       ║
║                        ┌──────────────┐                               ║
║                        │              │                               ║
║                        │   🟢 ORB     │  ← Speaking: Green reactive   ║
║                        │   (ALFRED)   │     to TTS output             ║
║                        │   [Reactive] │     Pulses with speech         ║
║                        └──────────────┘                               ║
║                                                                       ║
║              ┌────────────────────────────────────┐                  ║
║              │  "I've created a note titled       │                  ║
║              │   'Meeting Notes'."                │                  ║
║              │  (text-biolum, ALFRED's response)  │                  ║
║              └────────────────────────────────────┘                  ║
║                                                                       ║
║              ┌────────────────────────────────────┐                  ║
║              │  [Waveform - TTS Output]            │                  ║
║              │  ▁▂▃▅▆▇█▇▆▅▃▂▁▂▃▅▆▇█▇▆▅▃▂▁         │                  ║
║              │  Reactive to speech synthesis       │                  ║
║              └────────────────────────────────────┘                  ║
║                                                                       ║
║  ┌───────────────────────────────────────────────────────────────┐  ║
║  │  ● Speaking  │  14:32  │  Voice: Local                        │  ║
║  └───────────────────────────────────────────────────────────────┘  ║
║                                                                       ║
╚═══════════════════════════════════════════════════════════════════════╝
```

**Elements:**
- **Orb:** Green reactive pulse (`confident` emotion)
- **State:** `speaking` - TTS playback active
- **Emotion:** Confident, helpful, communicative
- **Transcript:** ALFRED's response text (appears as it speaks)
- **Waveform:** TTS visualization (reacts to audio output)
- **Narration:** ALFRED narrates actions ("I've created a note...")

---

### 5. Progressive Disclosure: Note Created Card

```
╔═══════════════════════════════════════════════════════════════════════╗
║                                                                       ║
║                        ┌──────────────┐                               ║
║                        │   🟢 ORB     │  ← Idle: Ready for next       ║
║                        │   (ALFRED)   │     Gentle pulse               ║
║                        └──────────────┘                               ║
║                                                                       ║
║              "I've created a note titled 'Meeting Notes'."             ║
║                                                                       ║
║  ┌───────────────────────────────────────────────────────────────┐  ║
║  │  Note Created                          [×]  ← Dismiss          │  ║
║  │  ┌─────────────────────────────────────────────────────────┐  │  ║
║  │  │ Title: Meeting Notes                                    │  │  ║
║  │  │                                                          │  │  ║
║  │  │ Content: Discussion about Q1 planning...                 │  │  ║
║  │  │                                                          │  │  ║
║  │  │ [View] [Edit] [Dismiss]  ← Actions (hover to show)      │  │  ║
║  │  └─────────────────────────────────────────────────────────┘  │  ║
║  │  HUD Styling: bg-void-surface/40 backdrop-blur-xl            │  ║
║  │  Border: border-white/10 rounded-3xl                         │  ║
║  │  Shadow: shadow-biolum/20 (outer glow)                       │  ║
║  └───────────────────────────────────────────────────────────────┘  ║
║  ↑ Fade-in animation (200ms, fluid easing)                          ║
║  Auto-dismiss: 5s if not interacted                                  ║
║                                                                       ║
║  ┌───────────────────────────────────────────────────────────────┐  ║
║  │  ● Ready  │  14:32  │  Voice: Local                            │  ║
║  └───────────────────────────────────────────────────────────────┘  ║
║                                                                       ║
╚═══════════════════════════════════════════════════════════════════════╝
```

**Elements:**
- **Card Type:** `card` (ephemeral, auto-dismisses)
- **Appearance:** Smooth fade-in from void (200ms, fluid easing)
- **Styling:** HUD pattern (`bg-void-surface/40 backdrop-blur-xl border-white/10 rounded-3xl`)
- **Shadow:** Outer glow (`shadow-biolum/20`) instead of drop shadow
- **Actions:** Contextual buttons (appear on hover, fade on idle)
- **Lifecycle:** Ephemeral - auto-dismisses after 5s if not interacted
- **Position:** Smart positioning (near orb, avoids overlap)

---

### 6. Progressive Disclosure: Multiple Windows - Desktop Metaphor

```
╔═══════════════════════════════════════════════════════════════════════╗
║                                                                       ║
║  ┌──────────────────┐  ← Reminder Card (ephemeral)                  ║
║  │  Reminder        │     Position: Top-left                         ║
║  │  Due in 5 min    │     Z-index: 10                                ║
║  │  Team standup    │     Draggable: Yes                              ║
║  │  [Snooze] [×]    │     Lifecycle: Contextual                      ║
║  └──────────────────┘                                                 ║
║                                                                       ║
║                        ┌──────────────┐                               ║
║                        │   🟢 ORB     │  ← Idle: Ready                 ║
║                        │   (ALFRED)   │     Gentle pulse               ║
║                        └──────────────┘                               ║
║                                                                       ║
║              "What would you like to do next?"                         ║
║                                                                       ║
║  ┌──────────────────┐  ← Timer Overlay (persistent)                  ║
║  │  Active Timer    │     Position: Bottom-right                      ║
║  │  00:05:23        │     Z-index: 5                                  ║
║  │  [Pause] [Stop]  │     Draggable: Yes                              ║
║  └──────────────────┘     Lifecycle: Session                          ║
║                                                                       ║
║  ┌───────────────────────────────────────────────────────────────┐  ║
║  │  Docker Containers                    [─] [□] [×]  ← Window   │  ║
║  │  ┌─────────────────────────────────────────────────────────┐  │  ║
║  │  │ Container  Status  CPU   Memory                         │  ║
║  │  │ app-1      ● Run   45%   2.1GB  [Logs] [Restart]       │  ║
║  │  │ app-2      ● Run   12%   512MB  [Logs] [Restart]       │  ║
║  │  │ db-1       ● Run   8%    1.2GB  [Logs] [Restart]       │  ║
║  │  └─────────────────────────────────────────────────────────┘  ║
║  │  Position: Top-right (400x600px)                              │  ║
║  │  Z-index: 15 (above other windows)                            │  ║
║  │  Draggable: Yes | Resizable: Yes                               │  ║
║  │  Lifecycle: Session (persists until browser close)            │  ║
║  └───────────────────────────────────────────────────────────────┘  ║
║                                                                       ║
║  ┌───────────────────────────────────────────────────────────────┐  ║
║  │  ● Ready  │  14:32  │  Voice: Local                            │  ║
║  └───────────────────────────────────────────────────────────────┘  ║
║                                                                       ║
╚═══════════════════════════════════════════════════════════════════════╝
```

**Window Management:**
- **Smart Positioning:** ALFRED positions windows to avoid overlap
- **Z-index Management:** Newer windows appear above (Docker window: 15, Reminder: 10, Timer: 5)
- **Window Types:**
  - **Card:** Ephemeral notification (Reminder)
  - **Overlay:** Persistent indicator (Timer)
  - **Window:** Draggable, resizable (Docker Containers)
- **Gestures:** Drag to reposition, resize handles, window controls (minimize/maximize/close)
- **Grouping:** Related windows can be grouped (all Docker windows move together)
- **Persistence:** Session windows survive page reload (localStorage)

---

### 7. Command Palette - Keyboard Fallback (Cmd+K)

```
╔═══════════════════════════════════════════════════════════════════════╗
║                                                                       ║
║                        ┌──────────────┐                               ║
║                        │   🟢 ORB     │  ← Idle: Waiting              ║
║                        │   (ALFRED)   │     Gentle pulse               ║
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
║  │  │  🐳 Docker Status                                        │  │  ║
║  │  │  ⚙️  Settings                                            │  │  ║
║  │  │                                                          │  │  ║
║  │  │  Press ↑↓ to navigate, Enter to select, Esc to close    │  │  ║
║  │  └─────────────────────────────────────────────────────────┘  ║
║  │  HUD Styling: bg-void-surface/40 backdrop-blur-xl            │  ║
║  │  Position: Centered (modal overlay)                          │  ║
║  │  Z-index: 100 (above all windows)                            │  ║
║  └───────────────────────────────────────────────────────────────┘  ║
║                                                                       ║
║  ┌───────────────────────────────────────────────────────────────┐  ║
║  │  ● Ready  │  14:32  │  Voice: Local  │  Cmd+K                  │  ║
║  └───────────────────────────────────────────────────────────────┘  ║
║                                                                       ║
╚═══════════════════════════════════════════════════════════════════════╝
```

**Command Palette Features:**
- **Trigger:** `Cmd+K` / `Ctrl+K` (keyboard) or voice: "show commands"
- **Search:** Fuzzy search through all available actions
- **Navigation:** Arrow keys (↑↓) to navigate, Enter to select, Esc to close
- **Actions:** All tools and features accessible via command palette
- **Styling:** HUD pattern, centered modal overlay
- **Focus:** Focus trap (keyboard navigation only within palette)
- **Voice Alternative:** Can be triggered via voice command

### 8. Emotional Expression - ALFRED's Personality

```
╔═══════════════════════════════════════════════════════════════════════╗
║                                                                       ║
║  ┌───────────────────────────────────────────────────────────────┐  ║
║  │  Orb Emotional States                                          │  ║
║  │                                                                │  ║
║  │  🟢 Idle:        Gentle pulse, ready, attentive               │  ║
║  │  🟣 Curious:     Purple pulse, exploring options               │  ║
║  │  🔵 Thoughtful:  Blue pulse, processing, working               │  ║
║  │  🟢 Confident:   Bright green, certain of action               │  ║
║  │  🟡 Uncertain:   Yellow pulse, needs clarification            │  ║
║  │  🔴 Apologetic:  Dim red pulse, error occurred                 │  ║
║  │  🟢 Celebratory: Green pulse, success achieved                │  ║
║  └───────────────────────────────────────────────────────────────┘  ║
║                                                                       ║
║  Example: ALFRED notices pattern                                     ║
║  ┌───────────────────────────────────────────────────────────────┐  ║
║  │  [Orb: 🟣 Curious]                                            │  ║
║  │  "I noticed you have 3 reminders due today.                   │  ║
║  │   Would you like me to show them?"                             │  ║
║  │  [Proactive suggestion card appears]                           │  ║
║  └───────────────────────────────────────────────────────────────┘  ║
║                                                                       ║
╚═══════════════════════════════════════════════════════════════════════╝
```

**Emotional Expression:**
- **Orb Colors:** Express ALFRED's emotional state
- **Proactive Behavior:** ALFRED notices patterns and suggests actions
- **Personality:** Learns user preferences, adapts communication style
- **Narration:** ALFRED narrates actions ("I'm creating a note...")
- **Celebration:** Success states trigger celebratory orb animation

---

## Component Specifications

### 1. OrbAvatar Component

**Purpose:** ALFRED's visual presence - always visible, state-reactive, emotional expression

**States & Emotions:**
- `idle` - Gentle pulse, `oklch(0.99 0 0)` (biolum white), ready
- `listening` / `curious` - Purple pulse, reactive to voice input, exploring
- `thinking` / `thoughtful` - Blue animated pulse, processing, working
- `speaking` / `confident` - Green reactive to TTS output, certain
- `uncertain` - Yellow pulse, needs clarification
- `apologetic` - Dim red pulse, error occurred
- `celebratory` - Bright green pulse, success achieved

**Implementation:**
- Use existing `Orb` component from `@/components/ui/orb.tsx` (Three.js version)
- Position: Fixed center of viewport
- Size: Responsive (200px on desktop, 150px on mobile)
- Animation: Floating/breathe effect (subtle Y-axis oscillation, ±10px)
- Performance: 60fps WebGL rendering

**Props:**
```typescript
interface OrbAvatarProps {
  state: "idle" | "listening" | "thinking" | "speaking";
  emotion?: "curious" | "confident" | "uncertain" | "apologetic" | "celebratory" | "thoughtful";
  inputVolume?: number;  // For listening state reactivity (0-1)
  outputVolume?: number; // For speaking state reactivity (0-1)
  className?: string;
}
```

**Emotional Expression:**
- Orb color changes based on emotion
- Pulse rate varies (faster = more urgent, slower = calmer)
- Reactive animation to voice input/output
- Proactive state changes (notices patterns, shows curiosity)

---

### 2. VoiceInteraction Component

**Purpose:** Primary interaction layer - voice input/output

**Features:**
- Always-on voice listening (with visual indicator)
- Real-time transcript display
- TTS response playback
- Waveform visualization

**Implementation:**
- Use existing `useVoiceCapture` hook
- Integrate with `useAssistantStream` for responses
- Display transcript below orb
- Show waveform during input/output

**Layout:**
```
┌─────────────────────────────────────┐
│         [Orb Avatar]                │
│                                     │
│    [Transcript Display]             │
│    "User: Create a note..."        │
│                                     │
│    [Waveform Visualization]         │
│    (during input/output)           │
└─────────────────────────────────────┘
```

---

### 3. ProgressiveDisclosure Component - Window Management System

**Purpose:** Contextual UI elements that appear on demand with desktop-like interactions

**Window Types:**
- **Card** - Ephemeral notification (notes, reminders) - auto-dismisses
- **Overlay** - Persistent indicator (timers, status) - non-intrusive
- **Window** - Draggable, resizable (Docker, workflows) - desktop-like
- **Modal** - Focused interaction (settings, confirmations) - requires action
- **Panel** - Persistent sidebar (reminders list, timers) - always accessible

**Window Behavior:**
- **Appear:** Smooth fade-in from void (200ms, fluid easing)
- **Position:** Smart positioning to avoid overlap (collision detection)
- **Z-index:** Newer windows appear above (managed automatically)
- **Dismiss:** Auto-dismiss (ephemeral) OR manual dismiss (persistent)
- **Gestures:** Drag to reposition, resize handles, window controls
- **Grouping:** Related windows can be grouped (move together)

**Styling:**
- HUD pattern: `bg-void-surface/40 backdrop-blur-xl border-white/10 rounded-3xl`
- Shadow: Outer glow (`shadow-biolum/20`) instead of drop shadow
- Animation: Fluid easing (`cubic-bezier(0.25, 0.4, 0.25, 1)`)
- Window controls: Minimize (`─`), Maximize (`□`), Close (`×`)

**Implementation:**
```typescript
interface WindowSpec {
  id: string;
  type: "card" | "overlay" | "window" | "modal" | "panel";
  component: ComponentSpec;
  position?: { x: number; y: number };
  size?: { width: number; height: number };
  zIndex?: number;
  draggable?: boolean;
  resizable?: boolean;
  persistent?: boolean;  // Survives page reload
  group?: string;        // Group related windows
  lifecycle?: "ephemeral" | "session" | "persistent" | "contextual" | "user-controlled";
  autoDismiss?: number; // milliseconds (for ephemeral)
  onDismiss: () => void;
}

interface ComponentSpec {
  type: string;
  data: unknown;
  actions?: Array<{
    id: string;
    label: string;
    handler: "tool-call" | "navigation" | "state-update";
    params: Record<string, unknown>;
  }>;
  style?: {
    theme?: "default" | "accent" | "muted";
    size?: "sm" | "md" | "lg" | "xl";
  };
}
```

**Window Management:**
- Smart positioning algorithm (avoids overlap, respects viewport bounds)
- Z-index management (newer windows above, grouped windows same layer)
- State persistence (position, size, expanded state for persistent windows)
- Gesture support (drag, resize, swipe to dismiss on mobile)

---

### 4. ContextBar Component

**Purpose:** Minimal status bar at bottom

**Elements:**
- Connection status (● Connected / ○ Disconnected)
- Current time
- Voice provider (Local / OpenAI)
- Keyboard shortcut hints (Cmd+K)

**Styling:**
- Minimal: `text-biolum-dim` (secondary text color)
- Position: Fixed bottom, full width
- Height: 32px
- Background: Transparent (void shows through)

**Implementation:**
```typescript
<ContextBar>
  <StatusIndicator status={connectionStatus} />
  <TimeDisplay />
  <VoiceProvider provider={voiceProvider} />
  <KeyboardHint shortcut="Cmd+K" />
</ContextBar>
```

---

## State Management

### Global State (Zustand Store)

```typescript
interface GenerativeUIState {
  // Orb state
  orbState: "idle" | "listening" | "thinking" | "speaking";
  orbEmotion: "curious" | "confident" | "uncertain" | "apologetic" | "celebratory" | "thoughtful" | null;
  inputVolume: number;  // 0-1
  outputVolume: number; // 0-1
  
  // Voice state
  isListening: boolean;
  transcript: string;
  response: string;
  ttsPlaying: boolean;
  
  // Window management
  windows: WindowSpec[];
  windowGroups: Record<string, string[]>;  // groupId -> windowIds[]
  focusedWindowId: string | null;
  commandPaletteOpen: boolean;
  
  // Component registry
  componentRegistry: Record<string, React.ComponentType>;
  activeComponents: Map<string, ComponentSpec>;
  
  // Context
  connectionStatus: "connected" | "disconnected";
  voiceProvider: "local" | "openai";
  
  // User preferences (learned)
  disclosureStrategy: DisclosureStrategy;
  windowPreferences: Record<string, WindowPreferences>;  // componentType -> preferences
}

interface DisclosureStrategy {
  mode: "minimal" | "balanced" | "detailed";
  proactivity: number;  // 0-1
  context: "work" | "casual" | "focus";
  userPreferences: {
    alwaysShow: string[];
    neverShow: string[];
    expandByDefault: string[];
  };
}

interface WindowPreferences {
  defaultPosition: { x: number; y: number };
  defaultSize: { width: number; height: number };
  lifecycle: ComponentLifecycle;
  pinned: boolean;
}
```

**State Actions:**
```typescript
// Window management
createWindow(spec: WindowSpec): string;
dismissWindow(windowId: string): void;
updateWindowPosition(windowId: string, position: { x: number; y: number }): void;
updateWindowSize(windowId: string, size: { width: number; height: number }): void;
groupWindows(windowIds: string[], groupId: string): void;

// Orb state
setOrbState(state: OrbState, emotion?: OrbEmotion): void;
setInputVolume(volume: number): void;
setOutputVolume(volume: number): void;

// Voice
startListening(): void;
stopListening(): void;
setTranscript(text: string): void;
setResponse(text: string): void;
playTTS(text: string): Promise<void>;

// Component registry
registerComponent(type: string, component: React.ComponentType): void;
generateComponent(spec: ComponentSpec): React.ComponentType;
```

---

## Interaction Patterns

### 1. Voice-First Flow (Primary)

```
User: [Voice] "Create a note titled Meeting Notes"
  ↓
Orb: idle → listening (🟣 curious, purple pulse)
  ↓
Transcript: "Create a note titled Meeting Notes" (real-time STT)
Waveform: [Visual feedback during speech]
  ↓
Orb: listening → thinking (🔵 thoughtful, blue pulse)
ALFRED: [Speaks] "Creating a note..."
Progress: [Subtle indicator]
  ↓
Tool Execution: note.create({ title: "Meeting Notes", ... })
  ↓
Orb: thinking → speaking (🟢 confident, green reactive to TTS)
ALFRED: [Speaks] "Done! I've created a note titled 'Meeting Notes'."
Waveform: [TTS visualization]
  ↓
Card Appears: Note card fades in (200ms, near orb)
  ↓
Orb: speaking → idle (🟢 gentle pulse, ready)
Card: Auto-dismisses after 5s (if not interacted)
```

### 2. Keyboard Fallback (Secondary)

```
User: Presses Cmd+K
  ↓
Command Palette: Appears (centered modal, z-index: 100)
  ↓
User: Types "note"
  ↓
Fuzzy Search: Filters commands, highlights "Create Note"
  ↓
User: Presses Enter
  ↓
Orb: idle → thinking (🔵 thoughtful)
  ↓
Action Executed: note.create(...)
  ↓
Card Appears: Note card
Orb: thinking → idle
```

### 3. Window Management Gestures

```
Desktop:
  Drag window → Reposition (smart collision detection)
  Resize handle → Resize window (maintains aspect ratio)
  Window controls → Minimize/Maximize/Close
  Double-click title → Maximize/Restore

Mobile:
  Swipe down → Dismiss card
  Swipe left/right → Navigate between windows
  Long press → Show window menu (dismiss, pin, group)
  Pinch → Zoom window content
```

### 4. Proactive Disclosure Flow

```
ALFRED: [Notices pattern] User has 3 reminders due
  ↓
Orb: idle → curious (🟣 purple pulse)
  ↓
ALFRED: [Speaks] "I noticed you have 3 reminders due today.
         Would you like me to show them?"
  ↓
Proactive Card: Appears with reminder summary
  ↓
User: [Voice] "Yes, show them"
  ↓
Orb: curious → thinking (🔵 thoughtful)
  ↓
Reminder Window: Appears (draggable, resizable)
Orb: thinking → idle
```

### 5. Component Generation Flow

```
Tool Result: docker.status({ containers: [...] })
  ↓
Component Spec Generated: {
  type: "docker-status",
  component: { kind: "composite", layout: "grid", ... },
  data: { source: "tool-result", path: "$.containers" },
  actions: [{ id: "restart", handler: "tool-call", ... }]
}
  ↓
Spec Validation: Zod schema validation
  ↓
Registry Check: "docker-status" in componentRegistry?
  ├─ Yes → Use pre-built DockerStatusCard
  └─ No → Generate from spec using primitives
  ↓
Component Rendered: Window appears with Docker status
  ↓
Fallback (if generation fails): StructuredDataDisplay
```

---

## Routing Strategy

### Single Route: `/` - State-Based Navigation

**No traditional routing.** Instead:

- **State-based navigation** - UI changes based on state, not routes
- **Deep linking** - Use URL hash for specific contexts (e.g., `/#note:123`)
- **History** - Use browser history API for back/forward (if needed)
- **Window state** - Windows persist state via localStorage (for persistent lifecycle)

**Implementation:**
```typescript
// Single route component
export const Route = createFileRoute("/")({
  component: GenerativeInterface,
  ssr: false, // Browser-only (voice, WebGL orb)
});

// State-based navigation
function GenerativeInterface() {
  const [windows, setWindows] = useState<WindowSpec[]>([]);
  const [context, setContext] = useState<Context | null>(null);
  
  // Deep linking via hash
  useEffect(() => {
    const hash = window.location.hash;
    if (hash.startsWith('#note:')) {
      const noteId = hash.split(':')[1];
      setContext({ type: 'note', id: noteId });
      // Open note window
      createWindow({
        type: 'window',
        component: { type: 'note', data: { id: noteId } },
        lifecycle: 'persistent',
      });
    }
  }, []);
  
  // Restore persistent windows from localStorage
  useEffect(() => {
    const persistent = restorePersistentWindows();
    setWindows(persistent);
  }, []);
  
  return (
    <GenerativeInterface>
      <VoidBackground />
      <OrbAvatar />
      <VoiceInteraction />
      <WindowManager windows={windows} />
      <ContextBar />
    </GenerativeInterface>
  );
}
```

**Deep Linking Examples:**
- `/#note:123` - Open note with ID 123
- `/#reminder:456` - Open reminder with ID 456
- `/#docker:status` - Open Docker status window
- `/#workflow:789` - Open workflow with ID 789

**Window State Persistence:**
```typescript
// Save persistent windows to localStorage
function saveWindowState(window: WindowSpec) {
  if (window.lifecycle === 'persistent') {
    localStorage.setItem(`window.${window.id}`, JSON.stringify({
      id: window.id,
      position: window.position,
      size: window.size,
      component: window.component,
    }));
  }
}

// Restore on page load
function restorePersistentWindows(): WindowSpec[] {
  const keys = Object.keys(localStorage).filter(k => k.startsWith('window.'));
  return keys.map(key => JSON.parse(localStorage.getItem(key)!));
}
```

---

## Migration Path

### Phase 1: Core Interface (Week 1)

1. **Create `GenerativeInterface` component**
   - Void background with noise texture
   - Orb avatar (centered, floating)
   - Context bar (bottom)

2. **Voice interaction layer**
   - Integrate `useVoiceCapture`
   - Display transcript
   - Show waveform

3. **Basic progressive disclosure**
   - Card component (HUD styling)
   - Appear/dismiss animations
   - Position management

### Phase 2: Voice Integration (Week 2)

1. **TTS integration**
   - Orb reactive to TTS output
   - Response transcript display
   - Waveform visualization

2. **State management**
   - Global state for orb/voice
   - Card registry
   - Context management

### Phase 3: Feature Migration (Week 3-4)

1. **Migrate existing features**
   - Notes → Progressive cards
   - Reminders → Overlay cards
   - Timers → Persistent overlay
   - Workflows → Status cards

2. **Command palette**
   - Keyboard shortcut (`Cmd+K`)
   - Voice command ("show commands")
   - Fuzzy search

### Phase 4: Polish (Week 5)

1. **Animations**
   - Orb state transitions
   - Card appear/dismiss
   - Gesture support

2. **Accessibility**
   - Keyboard navigation
   - Screen reader support
   - Focus management

---

## Design System Integration

### Maintain "Signal in the Void" Aesthetic

**Colors:**
- Void: `oklch(0.05 0 0)` (background)
- Biolum: `oklch(0.99 0 0)` (orb, text)
- Surface: `oklch(0.14 0 0)` (cards, HUDs)

**Typography:**
- Font: "Inter Tight" or "Geist Sans"
- Tracking: `-0.02em` (tight)
- Weight: Light for large text, medium for body

**Geometry:**
- Radius: `24px` for cards (`rounded-3xl`)
- Icons: `lucide-react` with `strokeWidth={1.5}`

**Animation:**
- Easing: `cubic-bezier(0.25, 0.4, 0.25, 1)` (fluid)
- Duration: 200ms for appear, 300ms for dismiss

---

## Technical Considerations

### Performance

- **Orb rendering:** Use WebGL (Three.js) for smooth 60fps
- **Card virtualization:** Limit visible cards (max 5-6)
- **Voice processing:** Offload to Web Workers if needed

### Accessibility

- **Keyboard navigation:** Full keyboard support
- **Screen readers:** ARIA labels for all interactive elements
- **Focus management:** Focus trap for modals

### Mobile

- **Touch gestures:** Swipe to dismiss, drag to reposition
- **Responsive orb:** Smaller size on mobile (150px)
- **Voice-first:** Optimize for voice input (larger touch targets)

---

## Example User Flows

### Flow 1: Create Note via Voice (Complete)

```
1. User: [Voice] "Create a note titled Meeting Notes"
   ↓
2. Orb: idle → listening (🟣 curious, purple pulse)
   Waveform: [Appears, reacts to voice]
   Transcript: "Create a note titled Meeting Notes" (real-time)
   ↓
3. Orb: listening → thinking (🔵 thoughtful, blue pulse)
   ALFRED: [Speaks] "Creating a note..."
   Progress: [Subtle indicator]
   ↓
4. Tool Execution: note.create({ title: "Meeting Notes", content: "" })
   ↓
5. Orb: thinking → speaking (🟢 confident, green reactive to TTS)
   ALFRED: [Speaks] "Done! I've created a note titled 'Meeting Notes'."
   Waveform: [TTS visualization]
   ↓
6. Card Appears: Note card fades in (200ms, positioned near orb)
   - Title: "Meeting Notes"
   - Content: [Empty]
   - Actions: [View] [Edit] [Dismiss]
   ↓
7. Orb: speaking → idle (🟢 gentle pulse, ready)
   Card: Auto-dismisses after 5s (if not interacted)
```

### Flow 2: Multi-Window Desktop Experience

```
1. User: [Voice] "Show me my Docker containers and create a note"
   ↓
2. ALFRED: [Thinking] Executes docker.status() and note.create()
   ↓
3. Docker Window Appears:
   - Type: window (draggable, resizable)
   - Position: Top-right (400x600px)
   - Content: Container list with status, CPU, memory
   - Actions: [Logs] [Restart] [Stop] per container
   ↓
4. Note Card Appears:
   - Type: card (ephemeral)
   - Position: Near orb (smart positioning avoids Docker window)
   - Content: Note preview
   ↓
5. User: [Drags Docker window] to preferred position
   ALFRED: [Remembers position] for future Docker windows
   ↓
6. User: [Voice] "Restart the app-1 container"
   ↓
7. ALFRED: [Executes] docker.restart({ container: "app-1" })
   Docker Window: [Updates] Container status changes to "restarting"
   ↓
8. User: [Closes note card] Card fades out
   Docker Window: [Remains] Persistent until dismissed
```

### Flow 3: Proactive ALFRED Behavior

```
1. ALFRED: [Notices pattern] User has 3 reminders due in next hour
   ↓
2. Orb: idle → curious (🟣 purple pulse)
   ↓
3. ALFRED: [Speaks] "I noticed you have 3 reminders due soon.
         Would you like me to show them?"
   ↓
4. Proactive Card Appears:
   - Type: card (ephemeral, but user can interact)
   - Content: "3 reminders due soon"
   - Actions: [Show] [Dismiss] [Snooze All]
   ↓
5. User: [Voice] "Yes, show them"
   ↓
6. Orb: curious → thinking (🔵 thoughtful)
   ↓
7. Reminder Window Appears:
   - Type: window (draggable, resizable)
   - Content: List of 3 reminders with due times
   - Actions: [Complete] [Snooze] [Dismiss] per reminder
   ↓
8. Orb: thinking → idle (🟢 ready)
   ALFRED: [Learns] User likes to see reminders proactively
```

### Flow 4: Component Generation (Novel Tool Output)

```
1. User: [Voice] "Show me the status of my Proxmox VMs"
   ↓
2. ALFRED: [Executes] proxmox.vm_status({ node: "pve1" })
   ↓
3. Tool Result: { vms: [{ id: 101, name: "web", status: "running" }, ...] }
   ↓
4. Component Spec Generated:
   {
     type: "proxmox-vm-status",
     component: {
       kind: "composite",
       layout: "grid-2-col",
       children: [
         { kind: "card", content: "VM Status Overview" },
         { kind: "list", items: "$.vms" }
       ]
     },
     data: { source: "tool-result", path: "$.vms" }
   }
   ↓
5. Registry Check: "proxmox-vm-status" not in registry
   ↓
6. Component Generated: Composes VoidCard + VoidList primitives
   ↓
7. Window Appears: Proxmox VM status window
   - Shows VM list with status indicators
   - Actions: [Start] [Stop] [Restart] per VM
   ↓
8. ALFRED: [Remembers] User likes Proxmox windows
   [Saves] Window position/size preferences
```

### Flow 5: Window Grouping & Management

```
1. User: [Voice] "Show me Docker and Git status"
   ↓
2. Docker Window Appears: Top-right
   Git Window Appears: Top-left (smart positioning)
   ↓
3. User: [Drags Docker window] near Git window
   ↓
4. ALFRED: [Detects proximity] Suggests grouping
   Orb: 🟣 curious
   ALFRED: [Speaks] "Would you like me to group these windows?"
   ↓
5. User: [Voice] "Yes"
   ↓
6. Windows Grouped:
   - Group ID: "dev-status"
   - Windows: [docker-window, git-window]
   - Behavior: Move together, same z-index
   ↓
7. User: [Drags group] Both windows move together
   ↓
8. ALFRED: [Remembers] User prefers grouped dev status windows
   [Future] Docker + Git windows auto-group
```

---

## Success Metrics

### User Experience

- **Cognitive load:** Minimal UI visible at rest (orb + context bar only)
- **Voice-first:** 80%+ interactions via voice
- **Progressive disclosure:** Information appears only when needed

### Performance

- **Orb FPS:** 60fps smooth animation
- **Card appear:** <200ms fade-in
- **Voice latency:** <500ms (p90) for response

### Accessibility

- **Keyboard navigation:** 100% keyboard accessible
- **Screen reader:** Full ARIA support
- **Focus management:** Proper focus traps

---

## Next Steps

1. **Create wireframe mockups** (Figma or similar)
2. **Build `GenerativeInterface` component** (Phase 1)
3. **Integrate voice layer** (Phase 2)
4. **Migrate existing features** (Phase 3)
5. **Polish and accessibility** (Phase 4)

---

## Orchestrator UI Patterns

**See:** `docs/strategy/orchestrator-ui-patterns.md` for detailed technical operation UI patterns.

The generative UI architecture supports both:
- **Personal Assistant UI** - Voice-first, progressive disclosure (notes, reminders)
- **Orchestrator UI** - Technical operations (Codex, Docker, Proxmox, workflows)

**Key Differences:**
- **Assistant:** Ephemeral cards, voice-first, minimal cognitive load
- **Orchestrator:** Persistent windows, streaming output, resource monitoring, long-running operations

**Integration:**
- Both use the same window management system
- Both follow "Signal in the Void" design system
- Orchestrator windows are more technical (terminals, graphs, timelines)
- Assistant windows are more conversational (cards, notifications)

---

## References

- Design System: `docs/design-system.md`
- Orchestrator Patterns: `docs/strategy/orchestrator-ui-patterns.md`
- Current Components: `apps/web/src/components/`
- Orb Component: `apps/web/src/components/ui/orb.tsx`
- Voice Hooks: `apps/web/src/hooks/use-voice-capture.ts`

