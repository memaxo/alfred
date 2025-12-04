# ALFRED Design System
## Extracted from Reference Images

---

## 1. Color Palette

### Primary Colors

| Name | Hex | OKLCH | Usage |
|------|-----|-------|-------|
| Void Black | `#000000` | `oklch(0 0 0)` | Background, orb centers |
| Deep Black | `#030303` | `oklch(0.02 0 0)` | Elevated surfaces |
| Bioluminescent Cyan | `#00FF88` | `oklch(0.85 0.2 165)` | Primary accent, active edges |
| Corona White | `#FFFFFF` | `oklch(1 0 0)` | Orb corona, primary text |
| Electric Cyan | `#00E5CC` | `oklch(0.82 0.15 180)` | Secondary accent, atmospheric glow |
| Deep Teal | `#0A3D3D` | `oklch(0.28 0.05 180)` | Atmospheric fog, ocean |

### Accent Colors

| Name | Hex | Usage |
|------|-----|-------|
| Magenta Active | `#FF00FF` → `#CC44AA` | Active neuron state, workflow |
| Violet Node | `#9D4EDD` | Workflow node accent |
| Warm White | `#FFF8E7` | Notes node, warm elements |
| Ice Blue | `#A5F3FC` | Inactive edges, subtle glow |

### Opacity Scale

| Level | Value | Usage |
|-------|-------|-------|
| Full | `100%` | Active elements, newest messages |
| High | `80%` | Recent messages, secondary text |
| Medium | `50%` | Older messages, inactive nodes |
| Low | `30%` | Dim labels, dormant edges |
| Subtle | `15%` | Background glow, atmosphere |
| Ghost | `5%` | Barely visible hints |

---

## 2. Typography

### Font Stack

```css
--font-primary: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
--font-mono: 'JetBrains Mono', 'Fira Code', 'SF Mono', monospace;
--font-display: 'Inter', sans-serif; /* wide letter-spacing for titles */
```

### Type Scale

| Name | Size | Weight | Letter-Spacing | Line-Height | Usage |
|------|------|--------|----------------|-------------|-------|
| Display XL | 48px | 300 | 0.3em | 1.1 | "ENTER MINDSCAPE" |
| Display L | 32px | 400 | 0.2em | 1.2 | Page titles |
| Display M | 24px | 400 | 0.15em | 1.3 | Section headers |
| Label L | 14px | 500 | 0.1em | 1.4 | Node labels (CHAT, WORKFLOW) |
| Label M | 12px | 400 | 0.08em | 1.4 | Secondary labels |
| Label S | 10px | 400 | 0.05em | 1.4 | Tertiary labels, status |
| Body L | 18px | 400 | 0 | 1.5 | Newest message |
| Body M | 16px | 400 | 0 | 1.5 | Standard message |
| Body S | 14px | 400 | 0 | 1.5 | Older message |
| Caption | 10px | 400 | 0.02em | 1.4 | Timestamps, metadata |

### Text Styles

**Node Labels** (from ALFRED-FINAL-1):
- All caps
- Letter-spacing: 0.1em
- Font-weight: 500
- Color: `#FFFFFF` at 80% opacity
- Position: Offset from node with leader line

**Message Text**:
- Sentence case
- No letter-spacing
- Color hierarchy by recency:
  - Newest: `#FFFFFF` 100%
  - Recent: `#FFFFFF` 80%
  - Older: `#FFFFFF` 50%
  - Oldest: `#FFFFFF` 30%

**UI Chrome**:
- All caps or small caps
- Letter-spacing: 0.05-0.1em
- Weight: 400
- Color: `#FFFFFF` at 30-50% opacity

---

## 3. The Orb (Central Presence)

### Orb Variants

**Variant A: Fibrous Vortex** (ALFRED-FINAL-1)
```
Diameter: 350-400px
Structure:
  - Pure black void center (90% of diameter)
  - Fibrous corona spiraling inward
  - Asymmetric, organic edge
  - Light appears to bend toward center
  
Corona Properties:
  - Width: 5-15% of diameter (irregular)
  - Color: White → Cyan gradient
  - Texture: Thousands of fine fiber strands
  - Animation: Slow spiral rotation (60s per revolution)
  - Glow: 50px blur, 20% opacity outer
```

**Variant B: Eclipse/Black Sun** (intro-minimal, main-orb-view)
```
Diameter: 300-450px
Structure:
  - Perfect circle void center
  - Clean luminous ring edge
  - Horizontal accretion disk/beam
  
Corona Properties:
  - Width: 2-4px sharp inner ring
  - Outer glow: 30-80px soft blur
  - Color: Pure white center → cyan outer
  - Horizontal beam extends full frame width
  
Beam Properties:
  - Height: 2-4px at center, expanding to 20-40px at edges
  - Gradient: Bright at orb → fade to transparent at frame edge
  - Creates horizon line effect
```

**Variant C: Atmospheric Portal** (landing-page-v2)
```
Diameter: 400px
Structure:
  - Void center with slight texture
  - Irregular corona edge
  - Surrounded by atmospheric fog/clouds
  
Environment:
  - Cyan atmospheric glow fills frame
  - Ocean/water surface below
  - Fog particles throughout
  - More environmental, less isolated
```

### Orb States

| State | Corona Intensity | Glow Radius | Animation |
|-------|------------------|-------------|-----------|
| Dormant | 30% | 20px | None, subtle breathing |
| Idle | 60% | 40px | Slow pulse (4s) |
| Listening | 80% | 60px | Faster pulse (1s), slight expansion |
| Active | 100% | 80px | Rapid pulse, corona flare |
| Processing | 100% | 100px | Spiral animation accelerates |

---

## 4. Satellite Nodes

### Node Anatomy (from ALFRED-FINAL-1)

```
┌─────────────────────────────────────┐
│                                     │
│    ┌─────────────────────┐         │
│    │                     │ ← Stroke ring (1-2px)
│    │    ○ Void center    │         │
│    │                     │         │
│    └─────────────────────┘         │
│              │                      │
│              │ ← Connection point   │
│              │                      │
│         LABEL ← All caps label      │
│         detail text                 │
│                                     │
└─────────────────────────────────────┘
```

### Node Sizes

| Type | Diameter | Stroke | Label Size |
|------|----------|--------|------------|
| Primary (Chat) | 80-100px | 2px | 14px |
| Secondary (Workflow, Knowledge) | 60-70px | 1.5px | 12px |
| Tertiary (Notes, Reminders) | 45-55px | 1px | 10px |
| Minimal (distant/LOD) | 20-30px | 1px | 8px |

### Node Styles

**Geometric Node** (ALFRED-FINAL-1 satellites):
```css
.node-geometric {
  /* Shape */
  border-radius: 50%;
  background: #000000;
  
  /* Stroke */
  border: 1.5px solid rgba(0, 255, 136, 0.6);
  
  /* Glow */
  box-shadow: 
    0 0 20px rgba(0, 255, 136, 0.2),
    inset 0 0 20px rgba(0, 255, 136, 0.05);
}
```

**Inactive Neuron** (inactive-neuron):
```
Structure:
  - Not a clean circle
  - Organic cellular membrane shape
  - Multiple void holes in tissue-like structure
  - Part of larger neural network texture
  
Color: Monochrome white/gray
Opacity: 40-60%
Edge: Fibrous, irregular
```

**Active Neuron** (active-neuron):
```
Structure:
  - Dense central void
  - Radiating fiber tendrils
  - Magenta-cyan color gradient
  - Particles concentrated at center
  
Color: 
  - Core: Magenta (#FF00FF → #CC44AA)
  - Edges: Cyan (#00E5CC)
  - Gradient blend between
  
Animation:
  - Pulsing glow (0.5s)
  - Particle emission from center
  - Fiber tendrils slowly writhe
```

### Node Color Coding

| Node Type | Ring Color | Glow Color | Accent |
|-----------|------------|------------|--------|
| Orb (center) | White | Cyan | — |
| Chat | Cyan `#00FF88` | Cyan | — |
| Workflow | Violet `#9D4EDD` | Magenta | Active: magenta pulse |
| Knowledge | Cyan `#00E5CC` | Cyan | — |
| Notes | Warm white `#FFF8E7` | Warm | — |
| Reminders | Gold `#FFD700` | Gold | — |
| Settings | Gray `#888888` | White | — |

---

## 5. Connection Edges

### Edge Styles (from connection-edge.png)

**Style 1: Fibrous Membrane** (top-left)
```
Structure:
  - Organic, tissue-like connection
  - Multiple thin strands bundled
  - Cyan-white particles along path
  - Frayed edges
  
Width: 10-30px (irregular)
Color: White with cyan particles
Opacity: 40-70%
Usage: Dormant/background connections
```

**Style 2: Smooth Flow** (top-right)
```
Structure:
  - Clean curved bezier path
  - Multiple parallel strands (3-5)
  - Bundled cable appearance
  - Smooth, flowing curve
  
Width: 8-15px for bundle
Color: Bright cyan `#00E5CC`
Opacity: 80-100%
Usage: Active data flow, primary connections
```

**Style 3: Particle Stream - Magenta** (bottom-left)
```
Structure:
  - Curved path defined by particles
  - Dense particle concentration
  - Gradient: Magenta → Blue → Cyan
  - Sparkle/glitter effect
  
Width: 15-25px particle spread
Color: Magenta `#FF0066` → Blue `#0066FF`
Animation: Particles flow along path (2s loop)
Usage: Workflow active, processing state
```

**Style 4: Particle Stream - Cyan** (bottom-right)
```
Structure:
  - Diagonal flow of particles
  - Less dense than magenta
  - Uniform cyan color
  - Comet tail effect
  
Width: 10-20px particle spread
Color: Cyan `#00FFCC`
Animation: Particles flow one direction (1.5s loop)
Usage: Data transfer, active edge
```

### Edge States

| State | Style | Width | Opacity | Animation |
|-------|-------|-------|---------|-----------|
| Dormant | Single line | 1px | 20% | None |
| Inactive | Fibrous | 2px | 40% | None |
| Hover | Fibrous | 3px | 60% | Soft pulse |
| Active | Smooth Flow | 4-8px | 80% | Particle flow (2s) |
| Streaming | Particle Stream | 10-20px | 100% | Fast particles (0.5s) |

### Edge Rendering

```css
/* Basic edge */
.edge-dormant {
  stroke: rgba(255, 255, 255, 0.2);
  stroke-width: 1px;
  fill: none;
}

/* Active edge with glow */
.edge-active {
  stroke: #00FF88;
  stroke-width: 2px;
  filter: drop-shadow(0 0 4px #00FF88) 
          drop-shadow(0 0 8px rgba(0, 255, 136, 0.5));
}

/* Particle animation along path */
@keyframes particleFlow {
  0% { stroke-dashoffset: 20; }
  100% { stroke-dashoffset: 0; }
}

.edge-streaming {
  stroke-dasharray: 2 4;
  animation: particleFlow 0.5s linear infinite;
}
```

---

## 6. Layout System

### Mindscape Canvas (ALFRED-FINAL-1)

```
Frame: 1920 × 1080px

Orb Position: Center (960, 450)
Orb Diameter: 380px

Node Positions (relative to orb center):
┌────────────────────────────────────────────────────────────┐
│                                                            │
│   CHAT                              WORKFLOW (top)         │
│   (-400, -150)                      (300, -300)           │
│   80px                              65px                   │
│                                                            │
│                    ┌─────────┐                             │
│                    │         │                             │
│         ──────────▶│   ORB   │◀──────────                 │
│                    │         │                             │
│                    └─────────┘                             │
│                                                            │
│   KNOWLEDGE                         NOTES                  │
│   (-450, 250)                       (350, 200)            │
│   65px                              55px                   │
│                                                            │
│                                     STATUS (bottom-right)  │
│                                     (500, 350)            │
│                                     50px                   │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

### Label Positioning

```
Node Label System:
  
  ┌──────────────────┐
  │     NODE         │
  │      ○           │
  └──────────────────┘
         │
         │ Leader line (30-50px)
         │
    ─────┼─────
         │
      LABEL        ← Primary label (14px, caps)
      secondary    ← Secondary info (10px)
      details      ← Tertiary (10px, dim)
```

**Leader Line Specs:**
- Stroke: 1px
- Color: Same as node ring at 50% opacity
- Style: Solid with small circle terminus (3px)
- Angle: Radiates outward from orb center

### Spacing System

| Unit | Pixels | Usage |
|------|--------|-------|
| 4xs | 4px | Inline spacing |
| 3xs | 8px | Icon gaps |
| 2xs | 12px | Tight grouping |
| xs | 16px | Label offset |
| sm | 24px | Component gaps |
| md | 32px | Section spacing |
| lg | 48px | Major sections |
| xl | 64px | Canvas regions |
| 2xl | 96px | Node minimum distance |
| 3xl | 128px | Node comfortable distance |

---

## 7. UI Chrome

### Header Bar (from landing-page-v2)

```
Height: 24-32px
Background: Transparent
Position: Fixed top

Layout:
┌──────────────────────────────────────────────────────────────┐
│ BRAND        NAV1    NAV2    NAV3    NAV4           ACTION  │
│ (left)       (center, evenly spaced)                (right) │
└──────────────────────────────────────────────────────────────┘

Typography:
  - All caps
  - 10-12px
  - Letter-spacing: 0.1em
  - Weight: 400
  - Color: #FFFFFF at 50% opacity
  - Hover: 80% opacity
```

### Status Indicators

**Connection Status:**
```
Size: 8px circle
States:
  - Connected: #00FF88, subtle pulse
  - Connecting: #FFD700, faster pulse
  - Disconnected: #FF5252, static
  
Position: Header left or bottom-left corner
Label: Optional "CONNECTED" text at 30% opacity
```

**Node Status Badge:**
```
Size: 6px circle
Position: Top-right of node ring
States:
  - Active: Cyan glow
  - Processing: Animated pulse
  - Error: Red
  - Idle: None (hidden)
```

### Input Bar

```
Position: Bottom center
Width: 400-600px
Height: 2-4px base, expanding on focus

Visual:
  - Horizontal luminous line
  - Soft glow (10-20px blur)
  - Gradient: transparent → cyan → transparent
  
Cursor:
  - 2px wide, 16px tall
  - Blink animation: 1s ease-in-out
  - Color: #00FF88 at 80%
  
Placeholder:
  - "speak or type..."
  - 12px, lowercase
  - Color: #FFFFFF at 30%
  - Letter-spacing: 0.05em
```

---

## 8. Atmospheric Effects

### Fog/Mist Layer (landing-page-v2)

```css
.atmosphere {
  background: radial-gradient(
    ellipse at center,
    transparent 0%,
    rgba(0, 229, 204, 0.1) 30%,
    rgba(0, 229, 204, 0.2) 60%,
    rgba(0, 60, 60, 0.4) 100%
  );
  
  /* Animated noise texture overlay */
  animation: fogDrift 30s linear infinite;
}
```

### Ocean Surface (landing-page-v2)

```
Position: Bottom 20% of frame
Appearance:
  - Dark teal base (#0A2020)
  - Reflective highlights from orb
  - Subtle wave motion
  - Horizon line with glow reflection
```

### Particle Field

```
Density: 50-200 particles per 1920×1080
Size: 1-3px
Color: White or Cyan at 20-60% opacity
Animation:
  - Slow drift toward orb (gravitational)
  - Slight random wander
  - Fade in/out at edges

Distribution:
  - Denser near orb (gravitational lensing)
  - Sparser at edges
  - None inside orb void
```

### Fiber Texture (inactive-neuron, ALFRED-FINAL-1 orb)

```
Structure:
  - Thousands of thin strands (0.5-2px)
  - Organic, web-like distribution
  - Void holes/gaps throughout
  - Connects and branches

Color: Monochrome white/gray
Opacity: 30-80% varying by strand
Animation: Very slow writhe/shift (30s+ cycles)

Usage:
  - Background texture
  - Orb corona detail
  - Neural network topology
```

---

## 9. Animation Specifications

### Timing Functions

```css
--ease-out-expo: cubic-bezier(0.16, 1, 0.3, 1);
--ease-in-out-sine: cubic-bezier(0.37, 0, 0.63, 1);
--ease-organic: cubic-bezier(0.4, 0, 0.2, 1);
--ease-bounce: cubic-bezier(0.34, 1.56, 0.64, 1);
```

### Duration Scale

| Name | Duration | Usage |
|------|----------|-------|
| instant | 0ms | State changes |
| fast | 150ms | Micro-interactions |
| normal | 300ms | Standard transitions |
| slow | 500ms | Major state changes |
| slower | 800ms | Focus transitions |
| slowest | 1200ms | View transitions |
| breathing | 4000ms | Idle pulse |
| rotation | 60000ms | Orb corona rotation |

### Core Animations

**Orb Breathing:**
```css
@keyframes orbBreathe {
  0%, 100% { 
    transform: scale(1);
    filter: blur(0px) brightness(1);
  }
  50% { 
    transform: scale(1.02);
    filter: blur(1px) brightness(1.1);
  }
}
/* Duration: 4s, ease-in-out-sine, infinite */
```

**Corona Rotation:**
```css
@keyframes coronaRotate {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
/* Duration: 60s, linear, infinite */
```

**Edge Particle Flow:**
```css
@keyframes particleFlow {
  0% { 
    stroke-dashoffset: 20;
    opacity: 0.6;
  }
  50% { opacity: 1; }
  100% { 
    stroke-dashoffset: 0;
    opacity: 0.6;
  }
}
/* Duration: 1-2s based on activity, linear, infinite */
```

**Node Pulse (active):**
```css
@keyframes nodePulse {
  0%, 100% {
    box-shadow: 0 0 20px rgba(0, 255, 136, 0.3);
  }
  50% {
    box-shadow: 0 0 40px rgba(0, 255, 136, 0.6);
  }
}
/* Duration: 1s, ease-in-out, infinite */
```

**Message Appear:**
```css
@keyframes messageAppear {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
/* Duration: 400ms, ease-out-expo */
```

---

## 10. Component Specifications

### Message Bubble (implied from layouts)

```
Structure: NO CONTAINER, text floats in void

Positioning:
  - Zone: Between orb and chat node
  - Alignment: Left-aligned stack
  - Spacing: 24px between messages

Text Properties by Recency:
  Newest:
    - Size: 18px
    - Color: #FFFFFF 100%
    - Optional: subtle glow
    
  Recent:
    - Size: 16px
    - Color: #FFFFFF 80%
    
  Older:
    - Size: 16px
    - Color: #FFFFFF 50%
    
  Oldest:
    - Size: 14px
    - Color: #FFFFFF 30%

User vs Assistant:
  - User: Slight blue tint (#A5C4FF)
  - Assistant: Pure white

Connection Thread:
  - Hair-thin line (0.5-1px) from each message
  - Curves toward orb
  - Opacity matches message recency
```

### Landing Page CTA (landing-page-v2)

```
Text: "ENTER MINDSCAPE"
Typography:
  - Size: 32-48px
  - Weight: 300-400
  - Letter-spacing: 0.2em
  - All caps

Position: Centered in orb void
Color: #FFFFFF
Hover: Slight glow increase

Secondary Text:
  - Size: 12px
  - Letter-spacing: 0.15em
  - Color: #FFFFFF at 50%
```

---

## 11. Figma Implementation Guide

### Layer Structure

```
ALFRED Mindscape
├── Background
│   └── #000000 fill
├── Atmosphere (optional)
│   ├── Fog gradients
│   ├── Particle field
│   └── Ocean surface
├── Edges Layer
│   ├── Dormant edges (back)
│   └── Active edges (front)
├── Orb
│   ├── Void center
│   ├── Corona
│   └── Glow effects
├── Nodes
│   ├── Chat node
│   │   ├── Ring
│   │   ├── Label group
│   │   └── Connection point
│   ├── Workflow node
│   ├── Knowledge node
│   └── Notes node
├── Content
│   ├── Messages group
│   ├── Message threads (lines)
│   └── Input bar
└── Chrome
    ├── Header
    ├── Status indicators
    └── Corner labels
```

### Component Variants

**Node Component:**
- Type: Chat / Workflow / Knowledge / Notes / Settings
- State: Dormant / Idle / Hover / Active / Error
- Size: Large / Medium / Small / Minimal

**Edge Component:**
- State: Dormant / Inactive / Active / Streaming
- Style: Simple / Fibrous / Particle

**Orb Component:**
- Variant: Vortex / Eclipse / Atmospheric
- State: Dormant / Idle / Listening / Active / Processing

---

## 12. Asset Export Specifications

### Orb Assets

| Asset | Format | Size | Notes |
|-------|--------|------|-------|
| orb-vortex | PNG + Lottie | 800×800 @2x | Animated corona |
| orb-eclipse | PNG + SVG | 600×600 @2x | Static option |
| orb-corona-only | PNG | 1000×1000 @2x | For composite |

### Node Assets

| Asset | Format | Size |
|-------|--------|------|
| node-ring-[type] | SVG | 200×200 |
| neuron-active | PNG + Lottie | 400×400 @2x |
| neuron-inactive | PNG | 400×400 @2x |

### Edge Assets

| Asset | Format | Notes |
|-------|--------|-------|
| edge-particle-cyan | Lottie | Looping particle stream |
| edge-particle-magenta | Lottie | Looping particle stream |
| edge-fiber-texture | PNG tile | Seamless, 512×128 |

### Atmosphere Assets

| Asset | Format | Size |
|-------|--------|------|
| fog-layer | PNG | 1920×1080 @2x |
| particle-field | Lottie | Full viewport |
| ocean-surface | PNG + video | 1920×400 |
