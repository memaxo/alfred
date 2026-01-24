# ALFRED Native Mobile Design System

## "Signal in the Void" — Brand Design Document v1.0

---

# Executive Summary

This design system translates Endel's masterful "generative ambient" aesthetic into ALFRED's "Signal in the Void" philosophy. Where Endel creates calm through organic flow, ALFRED creates intelligence through precise emergence. Both share the principle that **light emerges from darkness with purpose**.

---

# Part 1: Design Philosophy

## 1.1 Core Concept: "Signal in the Void"

ALFRED's mobile interface embodies **intelligence emerging from darkness**—the moment before a thought crystallizes, when potential becomes action.

### Key Principles (Inspired by Endel Analysis)

| Endel Principle                | ALFRED Translation              |
| ------------------------------ | ------------------------------- |
| Generative soundscapes         | Generative UI responses         |
| Organic flowing forms          | Neural pathway visualizations   |
| Modes for mental states        | Modes for AI agent states       |
| Ambient, always-there presence | Ambient, always-ready assistant |
| Self-illuminated icons         | Self-illuminated intelligence   |

### The ALFRED Difference

While Endel represents **biological rhythm** (sleep, focus, relax), ALFRED represents **cognitive emergence** (thinking, executing, synthesizing). Our visual language suggests:

- Neural synapses firing
- Data crystallizing into insight
- The quiet hum of intelligence at work
- Precision within organic flow

---

## 1.2 Visual Metaphors

### Primary Metaphor: The Void

```
The void is not empty—it is potential.
Every pixel of black holds possibility.
Light emerges only where meaning exists.
```

### Secondary Metaphors

| Metaphor            | Visual Expression                   | Use Case             |
| ------------------- | ----------------------------------- | -------------------- |
| **Neural Pulse**    | Thin lines that illuminate and fade | Agent thinking state |
| **Crystallization** | Particles coalescing into form      | Data processing      |
| **Breath**          | Subtle scale oscillation            | Idle/listening state |
| **Signal**          | Single bright element in darkness   | Focus/attention      |
| **Constellation**   | Scattered points with connections   | Knowledge graph      |

---

# Part 2: Color System

## 2.1 The Monochromatic Foundation

Following Endel's strict discipline, ALFRED uses a **pure monochromatic palette** with functional opacity layers.

### Core Colors (OKLCH)

```typescript
const VOID_PALETTE = {
  // === BACKGROUNDS ===
  void: {
    absolute: "oklch(0.00 0 0)", // #000000 - True black
    deep: "oklch(0.05 0 0)", // #0a0a0a - Primary background
    surface: "oklch(0.10 0 0)", // #171717 - Elevated surface
    raised: "oklch(0.14 0 0)", // #212121 - Cards, modals
  },

  // === BIOLUMINESCENT TEXT ===
  biolum: {
    full: "oklch(0.99 0 0)", // #fcfcfc - Primary text
    bright: "oklch(0.90 0 0)", // #e5e5e5 - Emphasis
    standard: "oklch(0.75 0 0)", // #b3b3b3 - Body text
    dim: "oklch(0.55 0 0)", // #7a7a7a - Secondary text
    faint: "oklch(0.35 0 0)", // #4a4a4a - Tertiary/hints
    whisper: "oklch(0.20 0 0)", // #2e2e2e - Subtle dividers
  },

  // === FUNCTIONAL OPACITY LAYERS ===
  glass: {
    surface: "rgba(255, 255, 255, 0.05)", // Card backgrounds
    border: "rgba(255, 255, 255, 0.08)", // Subtle borders
    hover: "rgba(255, 255, 255, 0.10)", // Hover states
    active: "rgba(255, 255, 255, 0.15)", // Active/pressed
    glow: "rgba(255, 255, 255, 0.03)", // Outer glow
  },
};
```

### Accent Philosophy

Unlike apps that use accent colors for branding, ALFRED uses **luminosity as accent**. Brighter = more important.

```typescript
// Attention hierarchy through brightness only
const ATTENTION_SCALE = {
  critical: "oklch(0.99 0 0)", // Pure white - immediate action needed
  primary: "oklch(0.90 0 0)", // High attention - interactive
  secondary: "oklch(0.70 0 0)", // Normal - readable content
  tertiary: "oklch(0.50 0 0)", // Low - supplementary
  ambient: "oklch(0.30 0 0)", // Minimal - background elements
};
```

### Semantic Colors (Minimal, Desaturated)

```typescript
// Only used for explicit status indication
const SEMANTIC = {
  success: "oklch(0.75 0.05 145)", // Very soft green
  warning: "oklch(0.75 0.05 85)", // Very soft amber
  error: "oklch(0.75 0.05 25)", // Very soft red
  info: "oklch(0.75 0.05 230)", // Very soft blue
};
```

---

## 2.2 Gradient System

### Radial Depth Gradient (Background)

Inspired by Endel's subtle center-lit backgrounds:

```typescript
const VOID_GRADIENT = {
  // Primary app background - subtle center illumination
  ambient: `radial-gradient(
    ellipse 80% 60% at 50% 40%,
    oklch(0.08 0 0) 0%,
    oklch(0.04 0 0) 50%,
    oklch(0.00 0 0) 100%
  )`,

  // Header fade into content
  headerFade: `linear-gradient(
    to bottom,
    oklch(0.06 0 0) 0%,
    transparent 100%
  )`,

  // Bottom control area rise
  controlRise: `linear-gradient(
    to top,
    oklch(0.08 0 0) 0%,
    transparent 100%
  )`,
};
```

### Glow Effects

```typescript
const GLOW = {
  // Element self-illumination (used sparingly)
  subtle: "0 0 20px rgba(255, 255, 255, 0.03)",
  medium: "0 0 40px rgba(255, 255, 255, 0.05)",
  strong: "0 0 60px rgba(255, 255, 255, 0.08)",

  // Focus ring for interactive elements
  focus: "0 0 0 2px rgba(255, 255, 255, 0.20)",
};
```

---

# Part 3: Typography

## 3.1 Type Scale

Following Endel's clean hierarchy with SF Pro (iOS system font):

```typescript
const TYPOGRAPHY = {
  // Display - Mode titles, hero text
  display: {
    large: { size: 34, lineHeight: 41, weight: "600", tracking: 0.37 },
    medium: { size: 28, lineHeight: 34, weight: "600", tracking: 0.36 },
    small: { size: 22, lineHeight: 28, weight: "600", tracking: 0.35 },
  },

  // Title - Section headers, card titles
  title: {
    large: { size: 22, lineHeight: 28, weight: "500", tracking: 0.35 },
    medium: { size: 17, lineHeight: 22, weight: "600", tracking: -0.41 },
    small: { size: 15, lineHeight: 20, weight: "600", tracking: -0.24 },
  },

  // Body - Primary content
  body: {
    large: { size: 17, lineHeight: 25, weight: "400", tracking: -0.41 },
    medium: { size: 15, lineHeight: 22, weight: "400", tracking: -0.24 },
    small: { size: 13, lineHeight: 18, weight: "400", tracking: -0.08 },
  },

  // Caption - Labels, timestamps, metadata
  caption: {
    large: { size: 13, lineHeight: 18, weight: "400", tracking: -0.08 },
    medium: { size: 12, lineHeight: 16, weight: "400", tracking: 0 },
    small: { size: 11, lineHeight: 13, weight: "400", tracking: 0.07 },
  },

  // Monospace - Code, data, terminal output
  mono: {
    large: {
      size: 15,
      lineHeight: 22,
      weight: "400",
      tracking: 0,
      family: "SF Mono",
    },
    medium: {
      size: 13,
      lineHeight: 18,
      weight: "400",
      tracking: 0,
      family: "SF Mono",
    },
    small: {
      size: 11,
      lineHeight: 14,
      weight: "400",
      tracking: 0,
      family: "SF Mono",
    },
  },
};
```

## 3.2 Typography Principles

### Weight Usage

- **Semibold (600)**: Titles, mode names, emphasis
- **Medium (500)**: Subtitles, labels, navigation
- **Regular (400)**: Body text, descriptions
- **Never use bold (700+)** — too heavy for void aesthetic

### Color Application

```
Title text:      biolum.full (0.99)
Body text:       biolum.standard (0.75)
Secondary text:  biolum.dim (0.55)
Hint text:       biolum.faint (0.35)
```

### Dynamic Type Support

All sizes should scale with iOS accessibility settings while maintaining relative hierarchy.

---

# Part 4: Iconography

## 4.1 Icon Design Principles

Direct translation from Endel's iconic system:

### Construction Rules

```
┌─────────────────────────────────────────┐
│  ALFRED ICON GRID SYSTEM                │
│                                         │
│  Container: 44pt × 44pt (touch target)  │
│  Icon area: 24pt × 24pt (visual)        │
│  Stroke weight: 1.5pt                   │
│  Corner radius: Rounded caps            │
│  Style: Outline only, no fills          │
│                                         │
│  For circular container icons:          │
│  - Circle stroke: 1.5pt                 │
│  - Inner icon: 16pt × 16pt              │
│  - Padding: 4pt from circle edge        │
└─────────────────────────────────────────┘
```

### Icon Categories

```typescript
const ICON_CATEGORIES = {
  // Agent Mode Icons (circular container)
  agentModes: {
    assistant: "Neural network pattern", // Connected nodes
    orchestrator: "Branching paths", // Decision tree
    researcher: "Magnifying constellation", // Search + nodes
    executor: "Lightning through grid", // Action + structure
  },

  // State Icons (circular container, matches Endel)
  states: {
    thinking: "Pulsing concentric circles",
    listening: "Sound wave arc",
    speaking: "Radiating lines from center",
    idle: "Static single circle",
    error: "Broken circle with gap",
  },

  // Action Icons (standalone)
  actions: {
    send: "Arrow pointing up-right",
    mic: "Microphone with base",
    stop: "Square with rounded corners",
    menu: "Three horizontal lines",
    settings: "Gear outline",
  },

  // GenUI Icons (circular container)
  genui: {
    chart: "Rising bar graph",
    list: "Stacked horizontal lines",
    grid: "Curved latitude/longitude (like Endel Focus)",
    form: "Rectangle with fields",
    code: "Angle brackets",
  },
};
```

## 4.2 ALFRED Mode Icons (Endel-Inspired)

Translating Endel's mode icons to ALFRED's cognitive states:

```
┌────────────────────────────────────────────────────────────────┐
│                     ALFRED MODE ICONS                          │
├───────────────┬────────────────────────────────────────────────┤
│   THINKING    │   ◐                                            │
│               │   Concentric circles with pulse                │
│               │   Represents neural activity                    │
├───────────────┼────────────────────────────────────────────────┤
│   EXECUTING   │   ⚡                                            │
│               │   Lightning bolt through grid                  │
│               │   Represents action in progress                │
├───────────────┼────────────────────────────────────────────────┤
│   LISTENING   │   )))                                          │
│               │   Sound wave arcs (like Endel's waves)         │
│               │   Represents voice input active                │
├───────────────┼────────────────────────────────────────────────┤
│   COMPLETE    │   ✓                                            │
│               │   Checkmark with soft glow                     │
│               │   Represents task finished                     │
├───────────────┼────────────────────────────────────────────────┤
│   CONNECTED   │   ◉──◉──◉                                      │
│               │   Constellation nodes                          │
│               │   Represents multi-agent orchestration         │
└───────────────┴────────────────────────────────────────────────┘
```

## 4.3 Icon States

```typescript
const ICON_STATES = {
  default: {
    color: "biolum.dim", // oklch(0.55 0 0)
    opacity: 1,
  },
  selected: {
    color: "biolum.full", // oklch(0.99 0 0)
    opacity: 1,
    // Optional: subtle fill at 10% opacity
  },
  disabled: {
    color: "biolum.faint", // oklch(0.35 0 0)
    opacity: 0.5,
  },
  loading: {
    color: "biolum.standard", // oklch(0.75 0 0)
    animation: "pulse 2s ease-in-out infinite",
  },
};
```

---

# Part 5: Component Specifications

## 5.1 Foundation Components

### VoidContainer

The base container for all screens:

```typescript
interface VoidContainerProps {
  gradient?: "ambient" | "flat" | "custom";
  noise?: boolean; // 2-3% noise overlay
  children: ReactNode;
}

// Visual specification
const VoidContainer = {
  background: VOID_PALETTE.void.deep,
  gradient: VOID_GRADIENT.ambient, // Subtle center illumination
  noise: {
    opacity: 0.02,
    blend: "overlay",
  },
};
```

### HUDSurface

Floating card/panel component (like Endel's control areas):

```typescript
interface HUDSurfaceProps {
  elevation?: 1 | 2 | 3;
  glow?: boolean;
  children: ReactNode;
}

const HUD_SURFACE = {
  elevation1: {
    background: "rgba(255, 255, 255, 0.03)",
    border: "1px solid rgba(255, 255, 255, 0.06)",
    borderRadius: 16,
  },
  elevation2: {
    background: "rgba(255, 255, 255, 0.05)",
    border: "1px solid rgba(255, 255, 255, 0.08)",
    borderRadius: 20,
  },
  elevation3: {
    background: "rgba(255, 255, 255, 0.07)",
    border: "1px solid rgba(255, 255, 255, 0.10)",
    borderRadius: 24,
    boxShadow: GLOW.medium,
  },
};
```

### GlowBorder

Self-illuminated border effect:

```typescript
const GlowBorder = {
  // Achieved via layered borders and shadows
  inner: "1px solid rgba(255, 255, 255, 0.15)",
  outer: "0 0 20px rgba(255, 255, 255, 0.05)",

  // Active/focused state
  active: {
    inner: "1px solid rgba(255, 255, 255, 0.25)",
    outer: "0 0 30px rgba(255, 255, 255, 0.10)",
  },
};
```

---

## 5.2 Chat & Messaging Components

### MessageBubble

```typescript
interface MessageBubbleProps {
  role: "user" | "assistant";
  status?: "streaming" | "complete" | "error";
  children: ReactNode;
}

const MESSAGE_BUBBLE = {
  user: {
    background: "rgba(255, 255, 255, 0.08)",
    border: "rgba(255, 255, 255, 0.10)",
    borderRadius: { topLeft: 20, topRight: 20, bottomLeft: 20, bottomRight: 8 },
    alignment: "right",
    maxWidth: "85%",
    padding: { vertical: 12, horizontal: 16 },
  },
  assistant: {
    background: "transparent",
    border: "none",
    borderRadius: 0,
    alignment: "left",
    maxWidth: "100%",
    padding: { vertical: 8, horizontal: 0 },
  },
};
```

### ReasoningCard

Shows AI thinking process:

```typescript
const REASONING_CARD = {
  container: {
    background: "rgba(255, 255, 255, 0.03)",
    border: "1px solid rgba(255, 255, 255, 0.06)",
    borderRadius: 12,
    padding: 12,
  },
  header: {
    icon: "thinking", // Animated concentric circles
    label: "Thinking...",
    labelColor: "biolum.dim",
  },
  content: {
    fontFamily: "SF Mono",
    fontSize: 13,
    color: "biolum.faint",
    opacity: 0.8,
  },
  // Collapsed: shows just header
  // Expanded: shows full reasoning text
};
```

### ToolCallCard

Displays tool execution:

```typescript
const TOOL_CALL_CARD = {
  container: {
    background: "rgba(255, 255, 255, 0.02)",
    borderLeft: "2px solid rgba(255, 255, 255, 0.15)",
    padding: { left: 12, vertical: 8 },
  },
  states: {
    pending: { borderColor: "biolum.faint", icon: "loading" },
    running: { borderColor: "biolum.standard", icon: "executing" },
    success: { borderColor: "semantic.success", icon: "complete" },
    error: { borderColor: "semantic.error", icon: "error" },
  },
  content: {
    toolName: { weight: "500", color: "biolum.standard" },
    params: { family: "SF Mono", size: 12, color: "biolum.faint" },
    result: { family: "SF Mono", size: 13, color: "biolum.dim" },
  },
};
```

---

## 5.3 The Orb (Voice Interface)

ALFRED's central voice indicator, inspired by Endel's organic logo:

### Orb States

```typescript
const ORB_SPECIFICATION = {
  // Base dimensions
  size: {
    collapsed: 64, // Compact in chat
    expanded: 160, // Full-screen voice mode
    mini: 44, // Tab bar indicator
  },

  // Core visual
  base: {
    fill: "radial-gradient(circle, rgba(255,255,255,0.10) 0%, transparent 70%)",
    stroke: "rgba(255, 255, 255, 0.20)",
    strokeWidth: 1.5,
  },

  // State animations
  states: {
    idle: {
      animation: "breathe",
      duration: 4000,
      scale: [1, 1.02, 1],
      opacity: [0.6, 0.8, 0.6],
    },
    listening: {
      animation: "pulse",
      duration: 150, // Reactive to audio input
      scale: "audio-reactive", // 1.0 - 1.15 based on volume
      rings: 3, // Expanding rings on voice detection
    },
    thinking: {
      animation: "rotate",
      duration: 2000,
      particles: 12, // Orbiting dots
      opacity: [0.5, 1, 0.5],
    },
    speaking: {
      animation: "radiate",
      duration: "speech-reactive",
      rays: 8, // Lines emanating outward
      intensity: "audio-reactive",
    },
    error: {
      animation: "shake",
      duration: 300,
      color: "semantic.error",
    },
  },
};
```

### Orb Visualization Layers

```
┌─────────────────────────────────────────────┐
│                 ORB ANATOMY                  │
│                                             │
│  Layer 1: Outer glow (25% opacity)          │
│     ↓                                       │
│  Layer 2: Particle field (12 dots)          │
│     ↓                                       │
│  Layer 3: Primary ring (1.5pt stroke)       │
│     ↓                                       │
│  Layer 4: Inner gradient fill               │
│     ↓                                       │
│  Layer 5: Center icon (mode indicator)      │
│                                             │
│  All layers animate independently           │
│  based on current state                     │
└─────────────────────────────────────────────┘
```

---

## 5.4 Mode Selector (Endel-Style)

Horizontal scrolling mode selection:

```typescript
const MODE_SELECTOR = {
  container: {
    height: 80,
    paddingHorizontal: 20,
    gap: 16,
  },

  item: {
    width: 64,
    height: 64,

    icon: {
      size: 44,
      container: "circle",
      strokeWidth: 1.5,
    },

    label: {
      fontSize: 11,
      fontWeight: "500",
      marginTop: 4,
    },

    states: {
      default: {
        iconColor: "biolum.dim",
        labelColor: "biolum.faint",
        background: "transparent",
      },
      selected: {
        iconColor: "biolum.full",
        labelColor: "biolum.standard",
        background: "rgba(255, 255, 255, 0.08)",
        scale: 1.05,
      },
      disabled: {
        iconColor: "biolum.whisper",
        labelColor: "biolum.whisper",
        opacity: 0.5,
      },
    },
  },
};
```

---

## 5.5 GenUI Components

### Chart Component

```typescript
const CHART_STYLES = {
  container: {
    background: "transparent",
    padding: 16,
  },

  axes: {
    color: "biolum.faint",
    strokeWidth: 1,
    labels: {
      color: "biolum.dim",
      fontSize: 11,
    },
  },

  data: {
    // Line charts
    line: {
      stroke: "biolum.bright",
      strokeWidth: 2,
      dot: {
        fill: "biolum.full",
        radius: 4,
      },
    },
    // Bar charts
    bar: {
      fill: "rgba(255, 255, 255, 0.15)",
      border: "rgba(255, 255, 255, 0.30)",
      borderRadius: 4,
    },
    // Area charts
    area: {
      fill: "linear-gradient(to bottom, rgba(255,255,255,0.15), transparent)",
      stroke: "biolum.standard",
    },
  },

  grid: {
    color: "rgba(255, 255, 255, 0.05)",
    strokeDasharray: "4 4",
  },

  tooltip: {
    background: "rgba(0, 0, 0, 0.90)",
    border: "rgba(255, 255, 255, 0.20)",
    borderRadius: 8,
    padding: 8,
  },
};
```

### Grid Component

```typescript
const GRID_STYLES = {
  container: {
    gap: 12,
  },

  cell: {
    background: "rgba(255, 255, 255, 0.03)",
    border: "1px solid rgba(255, 255, 255, 0.06)",
    borderRadius: 12,
    padding: 12,
    minHeight: 80,

    hover: {
      background: "rgba(255, 255, 255, 0.06)",
      border: "1px solid rgba(255, 255, 255, 0.10)",
    },
  },

  header: {
    background: "rgba(255, 255, 255, 0.05)",
    fontWeight: "500",
    color: "biolum.standard",
  },
};
```

### Progress Component

Radial progress indicator (Endel-style):

```typescript
const PROGRESS_STYLES = {
  radial: {
    size: 64,
    strokeWidth: 3,

    track: {
      stroke: "rgba(255, 255, 255, 0.10)",
    },

    progress: {
      stroke: "biolum.bright",
      linecap: "round",
    },

    center: {
      fontSize: 15,
      fontWeight: "500",
      color: "biolum.full",
    },

    // Breathing glow when complete
    complete: {
      glow: "0 0 20px rgba(255, 255, 255, 0.15)",
      animation: "breathe 3s ease-in-out infinite",
    },
  },

  linear: {
    height: 4,
    borderRadius: 2,

    track: {
      background: "rgba(255, 255, 255, 0.10)",
    },

    progress: {
      background: "linear-gradient(90deg, biolum.dim, biolum.full)",
    },
  },
};
```

---

## 5.6 Navigation Components

### Tab Bar

```typescript
const TAB_BAR = {
  container: {
    height: 83, // Including safe area
    background: "linear-gradient(to top, rgba(0,0,0,0.95), rgba(0,0,0,0.80))",
    borderTop: "1px solid rgba(255, 255, 255, 0.06)",
    paddingTop: 8,
    paddingBottom: "safe-area-bottom",
  },

  item: {
    minWidth: 64,

    icon: {
      size: 24,
      marginBottom: 2,
    },

    label: {
      fontSize: 10,
      fontWeight: "500",
    },

    states: {
      inactive: {
        iconColor: "biolum.faint",
        labelColor: "biolum.faint",
      },
      active: {
        iconColor: "biolum.full",
        labelColor: "biolum.full",
      },
    },
  },

  // Optional center orb
  centerOrb: {
    size: 56,
    offset: -12, // Raised above bar
    glow: GLOW.medium,
  },
};
```

### Control Bar (Endel-Style Playback)

```typescript
const CONTROL_BAR = {
  container: {
    height: 56,
    paddingHorizontal: 16,
    gap: 16,
    justifyContent: "center",
  },

  button: {
    size: 44,
    borderRadius: 22,
    background: "transparent",
    border: "1px solid rgba(255, 255, 255, 0.15)",

    icon: {
      size: 20,
      color: "biolum.dim",
    },

    states: {
      pressed: {
        background: "rgba(255, 255, 255, 0.10)",
        scale: 0.95,
      },
      active: {
        border: "1px solid rgba(255, 255, 255, 0.30)",
        iconColor: "biolum.full",
      },
    },
  },

  // Primary action (larger)
  primaryButton: {
    size: 56,
    borderRadius: 28,
    background: "rgba(255, 255, 255, 0.10)",
    border: "1px solid rgba(255, 255, 255, 0.20)",

    icon: {
      size: 24,
      color: "biolum.full",
    },
  },
};
```

### Pill Tabs (Your Guide / Library style)

```typescript
const PILL_TABS = {
  container: {
    background: "rgba(255, 255, 255, 0.05)",
    borderRadius: 12,
    padding: 4,
    gap: 4,
  },

  tab: {
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 10,

    label: {
      fontSize: 13,
      fontWeight: "500",
    },

    states: {
      inactive: {
        background: "transparent",
        labelColor: "biolum.dim",
      },
      active: {
        background: "rgba(255, 255, 255, 0.10)",
        labelColor: "biolum.full",
      },
    },
  },
};
```

---

# Part 6: Animation System

## 6.1 Timing Functions

```typescript
const EASING = {
  // Standard motion
  standard: "cubic-bezier(0.25, 0.1, 0.25, 1)", // ease-out

  // Entrance (deceleration)
  enter: "cubic-bezier(0, 0, 0.2, 1)", // ease-out-cubic

  // Exit (acceleration)
  exit: "cubic-bezier(0.4, 0, 1, 1)", // ease-in-cubic

  // Emphasis (bounce)
  emphasis: "cubic-bezier(0.34, 1.56, 0.64, 1)", // spring

  // Breathing (organic, continuous)
  breathe: "cubic-bezier(0.25, 0.4, 0.25, 1)", // Endel-style

  // Sharp (instant feel)
  sharp: "cubic-bezier(0.4, 0, 0.6, 1)", // ease-in-out
};
```

## 6.2 Duration Scale

```typescript
const DURATION = {
  instant: 100, // Micro-interactions
  fast: 150, // Button feedback
  normal: 250, // Standard transitions
  slow: 400, // Page transitions
  slower: 600, // Complex animations

  // Continuous animations
  breathe: 4000, // Idle breathing loop
  pulse: 2000, // Thinking pulse
  rotate: 3000, // Orbital rotation
};
```

## 6.3 Animation Patterns

### Breathing Animation

```typescript
const BREATHE_ANIMATION = {
  keyframes: {
    "0%": { transform: "scale(1)", opacity: 0.6 },
    "50%": { transform: "scale(1.03)", opacity: 0.9 },
    "100%": { transform: "scale(1)", opacity: 0.6 },
  },
  duration: DURATION.breathe,
  easing: EASING.breathe,
  iterations: "infinite",
};
```

### Pulse Animation

```typescript
const PULSE_ANIMATION = {
  keyframes: {
    "0%": { transform: "scale(1)", opacity: 0.5 },
    "50%": { transform: "scale(1.1)", opacity: 1 },
    "100%": { transform: "scale(1)", opacity: 0.5 },
  },
  duration: DURATION.pulse,
  easing: EASING.standard,
  iterations: "infinite",
};
```

### Ring Expansion (Voice Detection)

```typescript
const RING_EXPANSION = {
  keyframes: {
    "0%": { transform: "scale(0.8)", opacity: 0.8 },
    "100%": { transform: "scale(2)", opacity: 0 },
  },
  duration: 800,
  easing: EASING.exit,
  stagger: 200, // Delay between rings
  count: 3,
};
```

### Fade In Up (Content Entry)

```typescript
const FADE_IN_UP = {
  keyframes: {
    "0%": { transform: "translateY(20px)", opacity: 0 },
    "100%": { transform: "translateY(0)", opacity: 1 },
  },
  duration: DURATION.normal,
  easing: EASING.enter,
};
```

### Crossfade (Mode Transition)

```typescript
const CROSSFADE = {
  outgoing: {
    keyframes: { "100%": { opacity: 0 } },
    duration: DURATION.fast,
    easing: EASING.exit,
  },
  incoming: {
    keyframes: { "0%": { opacity: 0 }, "100%": { opacity: 1 } },
    duration: DURATION.normal,
    easing: EASING.enter,
    delay: DURATION.fast,
  },
};
```

---

# Part 7: Screen Templates

## 7.1 Chat Screen Layout

```
┌────────────────────────────────────────┐
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ │  ← Status bar
├────────────────────────────────────────┤
│                                        │
│  [Agent Mode Selector - Horizontal]    │  ← 80pt
│                                        │
├────────────────────────────────────────┤
│                                        │
│                                        │
│      Message Thread                    │
│      (ScrollView)                      │
│                                        │
│                                        │
│      ┌────────────────────────┐        │
│      │  User Message          │────────┤  ← HUDSurface
│      └────────────────────────┘        │
│                                        │
│      Assistant Response                │  ← Transparent
│      with GenUI components             │
│                                        │
│      [Tool Call Card]                  │
│      [Reasoning Card]                  │
│                                        │
│                                        │
├────────────────────────────────────────┤
│                                        │
│  ┌──────┐                              │  ← Input area
│  │  ◉   │  [  Text input...  ]  [▲]   │     with Orb
│  └──────┘                              │
│                                        │
├────────────────────────────────────────┤
│   ◯        ◯        ◉        ◯        │  ← Tab bar
│  Chat   History    Orb    Settings     │
└────────────────────────────────────────┘
```

## 7.2 Voice Mode Screen (Full Orb)

```
┌────────────────────────────────────────┐
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ │
├────────────────────────────────────────┤
│                                        │
│         Current Mode                   │  ← Title
│         Energy State                   │  ← Subtitle
│                                        │
│                                        │
│                                        │
│              ╭─────────╮               │
│            ╭───────────────╮           │
│           ╭─────────────────╮          │
│          │                   │         │
│          │        ◉          │         │  ← Orb (160pt)
│          │                   │         │
│           ╰─────────────────╯          │
│            ╰───────────────╯           │
│              ╰─────────╯               │
│                                        │
│                                        │
│    [Transcript preview line...]        │  ← Live transcript
│                                        │
│                                        │
├────────────────────────────────────────┤
│   ◯  ◯  ◯  ◯  ◯  ◯                    │  ← Mode icons
├────────────────────────────────────────┤
│      ⏸     ↻     ⊙     ⏱              │  ← Control bar
├────────────────────────────────────────┤
│  [ Your Guide ]    [ Library ]         │  ← Pill tabs
└────────────────────────────────────────┘
```

## 7.3 GenUI Visualization Screen

```
┌────────────────────────────────────────┐
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ │
├────────────────────────────────────────┤
│  ←  Report Title                    ⋯  │  ← Header
├────────────────────────────────────────┤
│                                        │
│  ┌─────────────────────────────────┐   │
│  │                                 │   │
│  │         Chart Component         │   │  ← Full-width
│  │                                 │   │
│  └─────────────────────────────────┘   │
│                                        │
│  Summary text with key insights...     │
│                                        │
│  ┌───────────┐  ┌───────────┐         │
│  │   Stat    │  │   Stat    │         │  ← Grid cells
│  │   $12.4M  │  │   +24.5%  │         │
│  └───────────┘  └───────────┘         │
│                                        │
│  ┌─────────────────────────────────┐   │
│  │  Data Table with rows...        │   │
│  │  - Item 1          $1,234       │   │
│  │  - Item 2          $2,345       │   │
│  └─────────────────────────────────┘   │
│                                        │
├────────────────────────────────────────┤
│   ◯        ◯        ◉        ◯        │
│  Chat   History    Orb    Settings     │
└────────────────────────────────────────┘
```

---

# Part 8: Visualization System

## 8.1 Generative Background Patterns

Inspired by Endel's full-screen visualizations:

### Particle Field (Recovery/Thinking)

```typescript
const PARTICLE_FIELD = {
  count: 40,
  distribution: "random",

  particle: {
    shape: "dandelion", // Custom SVG path
    sizeRange: [8, 24],
    opacityRange: [0.2, 0.8],
    color: "biolum.standard",
  },

  animation: {
    drift: {
      direction: "up",
      speedRange: [0.2, 0.8], // px per frame
      sway: 20, // horizontal oscillation
    },
    fade: {
      inDuration: 2000,
      outDuration: 3000,
    },
  },
};
```

### Neural Network (Thinking/Orchestrating)

```typescript
const NEURAL_NETWORK = {
  nodes: {
    count: 12,
    sizeRange: [4, 12],
    color: "biolum.dim",
    glowOnActive: true,
  },

  connections: {
    maxPerNode: 3,
    strokeWidth: 1,
    color: "rgba(255, 255, 255, 0.15)",
    animated: true, // Pulse travels along line
  },

  animation: {
    nodeFloat: {
      radius: 20,
      duration: 8000,
    },
    connectionPulse: {
      duration: 1500,
      stagger: 200,
    },
  },
};
```

### Concentric Ripples (Listening/Speaking)

```typescript
const CONCENTRIC_RIPPLES = {
  center: { x: "50%", y: "50%" },
  rings: 5,

  ring: {
    strokeWidth: 1.5,
    color: "biolum.faint",
    maxRadius: 200,
  },

  animation: {
    expand: {
      duration: 2000,
      stagger: 400,
      easing: EASING.exit,
    },
    intensity: "audio-reactive",
  },
};
```

### Waveform (Audio Feedback)

```typescript
const WAVEFORM = {
  bars: 32,

  bar: {
    width: 3,
    maxHeight: 40,
    borderRadius: 1.5,
    color: "biolum.standard",
    gap: 2,
  },

  animation: {
    source: "audio-input",
    smoothing: 0.8,
    minHeight: 4,
  },
};
```

---

# Part 9: Accessibility

## 9.1 Touch Targets

Following iOS HIG and Endel's touch-friendly design:

```typescript
const TOUCH_TARGETS = {
  minimum: 44, // iOS minimum
  comfortable: 48, // Recommended
  large: 56, // Primary actions

  // Spacing between targets
  minSpacing: 8,
  recommendedSpacing: 12,
};
```

## 9.2 Contrast Requirements

Even with void aesthetic, maintain readability:

```typescript
const CONTRAST_RATIOS = {
  // WCAG AA compliance
  normalText: 4.5, // biolum.standard on void.deep passes
  largeText: 3.0, // biolum.dim on void.deep passes

  // Our palette compliance
  "biolum.full / void.deep": 19.7, // ✓ AAA
  "biolum.standard / void.deep": 9.1, // ✓ AAA
  "biolum.dim / void.deep": 4.7, // ✓ AA
  "biolum.faint / void.deep": 2.4, // ✓ Large text only
};
```

## 9.3 Motion Preferences

```typescript
const REDUCED_MOTION = {
  // When prefers-reduced-motion: reduce
  breathingAnimation: "none",
  particleField: "static",
  transitionDuration: DURATION.fast,

  // Keep essential feedback
  buttonPress: "opacity only",
  stateChanges: "instant crossfade",
};
```

## 9.4 VoiceOver Support

```typescript
const ACCESSIBILITY_LABELS = {
  orb: {
    idle: "ALFRED, idle",
    listening: "ALFRED, listening for voice input",
    thinking: "ALFRED, processing your request",
    speaking: "ALFRED, speaking response",
  },

  modes: {
    assistant: "Assistant mode, general conversation",
    orchestrator: "Orchestrator mode, multi-agent coordination",
  },

  genui: {
    chart: (title) => `Chart showing ${title}`,
    grid: (count) => `Data grid with ${count} items`,
  },
};
```

---

# Part 10: Implementation Guide

## 10.1 React Native Setup

```typescript
// theme/index.ts
export const VoidTheme = {
  colors: VOID_PALETTE,
  typography: TYPOGRAPHY,
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    xxl: 32,
  },
  radii: {
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    full: 9999,
  },
  animation: {
    easing: EASING,
    duration: DURATION,
  },
};

// Usage with styled-components or StyleSheet
const styles = StyleSheet.create({
  container: {
    backgroundColor: VoidTheme.colors.void.deep,
    padding: VoidTheme.spacing.lg,
    borderRadius: VoidTheme.radii.lg,
  },
});
```

## 10.2 Animation Implementation (Reanimated)

```typescript
// hooks/useBreathing.ts
import {
  useAnimatedStyle,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

export function useBreathing() {
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      {
        scale: withRepeat(
          withTiming(1.03, {
            duration: 2000,
            easing: Easing.bezier(0.25, 0.4, 0.25, 1),
          }),
          -1,
          true
        ),
      },
    ],
    opacity: withRepeat(
      withTiming(0.9, {
        duration: 2000,
        easing: Easing.bezier(0.25, 0.4, 0.25, 1),
      }),
      -1,
      true
    ),
  }));

  return animatedStyle;
}
```

## 10.3 OKLCH to RGB Conversion

```typescript
// utils/oklch.ts
import { oklch, formatRgb } from "culori";

export function oklchToRgb(l: number, c: number, h: number): string {
  const color = oklch({ l, c, h });
  return formatRgb(color);
}

// Usage
const voidDeep = oklchToRgb(0.05, 0, 0); // '#0a0a0a'
const biolumFull = oklchToRgb(0.99, 0, 0); // '#fcfcfc'
```

## 10.4 Component Library Structure

```
alfred-native/
├── src/
│   ├── theme/
│   │   ├── colors.ts
│   │   ├── typography.ts
│   │   ├── spacing.ts
│   │   ├── animation.ts
│   │   └── index.ts
│   │
│   ├── components/
│   │   ├── foundation/
│   │   │   ├── VoidContainer.tsx
│   │   │   ├── HUDSurface.tsx
│   │   │   ├── BiolumText.tsx
│   │   │   ├── GlowBorder.tsx
│   │   │   └── index.ts
│   │   │
│   │   ├── chat/
│   │   │   ├── MessageBubble.tsx
│   │   │   ├── StreamingText.tsx
│   │   │   ├── ReasoningCard.tsx
│   │   │   ├── ToolCallCard.tsx
│   │   │   └── index.ts
│   │   │
│   │   ├── genui/
│   │   │   ├── Chart.tsx
│   │   │   ├── Grid.tsx
│   │   │   ├── List.tsx
│   │   │   ├── Progress.tsx
│   │   │   └── index.ts
│   │   │
│   │   ├── voice/
│   │   │   ├── Orb.tsx
│   │   │   ├── Waveform.tsx
│   │   │   ├── TranscriptStream.tsx
│   │   │   └── index.ts
│   │   │
│   │   └── navigation/
│   │       ├── TabBar.tsx
│   │       ├── ControlBar.tsx
│   │       ├── ModeSelector.tsx
│   │       └── index.ts
│   │
│   ├── visualizations/
│   │   ├── ParticleField.tsx
│   │   ├── NeuralNetwork.tsx
│   │   ├── ConcentricRipples.tsx
│   │   └── index.ts
│   │
│   └── hooks/
│       ├── useBreathing.ts
│       ├── usePulse.ts
│       ├── useAudioReactive.ts
│       └── useVoidTheme.ts
```

---

# Part 11: Quality Checklist

## Design Review Checklist

- [ ] All backgrounds use void palette, no pure white backgrounds
- [ ] Text follows luminosity hierarchy (brighter = more important)
- [ ] All icons use 1.5pt stroke weight consistently
- [ ] Touch targets are minimum 44pt × 44pt
- [ ] Animations use defined easing curves
- [ ] Breathing animation present on idle states
- [ ] Mode icons are in circular containers
- [ ] GenUI components render properly (no raw JSON)
- [ ] Contrast ratios meet WCAG AA minimum
- [ ] Reduced motion preferences respected
- [ ] Tab bar uses proper glow for selected state
- [ ] Orb responds to voice input visually
- [ ] HUD surfaces have subtle border + background
- [ ] No hard edges—all corners appropriately rounded
- [ ] Gradient backgrounds add depth without distraction

---

# Appendix A: Color Token Reference

| Token           | OKLCH    | Hex     | Usage        |
| --------------- | -------- | ------- | ------------ |
| void.absolute   | 0 0 0    | #000000 | True black   |
| void.deep       | 0.05 0 0 | #0a0a0a | Primary BG   |
| void.surface    | 0.10 0 0 | #171717 | Elevated     |
| void.raised     | 0.14 0 0 | #212121 | Cards        |
| biolum.full     | 0.99 0 0 | #fcfcfc | Primary text |
| biolum.bright   | 0.90 0 0 | #e5e5e5 | Emphasis     |
| biolum.standard | 0.75 0 0 | #b3b3b3 | Body text    |
| biolum.dim      | 0.55 0 0 | #7a7a7a | Secondary    |
| biolum.faint    | 0.35 0 0 | #4a4a4a | Tertiary     |
| biolum.whisper  | 0.20 0 0 | #2e2e2e | Dividers     |

---

# Appendix B: Figma Export Settings

For design handoff:

```
Icons:
- Format: SVG
- Stroke: Outline (not preserve)
- Naming: icon-[category]-[name].svg

Images:
- Format: PNG
- Scale: 1x, 2x, 3x
- Naming: [name]@[scale].png

Animations:
- Format: Lottie JSON
- Frame rate: 60fps
- Naming: anim-[name].json
```

---

_Document Version: 1.0_
_Last Updated: January 2026_
_Design System: ALFRED Native "Signal in the Void"_
