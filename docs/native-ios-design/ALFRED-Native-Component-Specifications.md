# ALFRED Native Component Visual Specifications

## Quick Reference & Implementation Guide

---

# Icon System Reference

## Mode Icons (Endel-Inspired Circular Icons)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         ALFRED MODE ICON SYSTEM                         │
│                                                                         │
│    44pt touch target │ 24pt visual │ 1.5pt stroke │ Circular container  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│     ASSISTANT              ORCHESTRATOR            RESEARCHER           │
│    ┌─────────┐            ┌─────────┐            ┌─────────┐           │
│    │  ╭───╮  │            │  ╱─┬─╲  │            │    ◎    │           │
│    │ ╭┼───┼╮ │            │ ╱  │  ╲ │            │   /│\   │           │
│    │ ╰┼───┼╯ │            │╱───┼───╲│            │  ◎─┼─◎  │           │
│    │  ╰───╯  │            │    │    │            │    │    │           │
│    └─────────┘            └─────────┘            └─────────┘           │
│    Neural grid            Branch paths           Search nodes           │
│                                                                         │
│     EXECUTOR               THINKING               LISTENING             │
│    ┌─────────┐            ┌─────────┐            ┌─────────┐           │
│    │    ⚡   │            │  ╭───╮  │            │   )))   │           │
│    │  ──┼──  │            │ ╭─────╮ │            │  (((    │           │
│    │    │    │            │╭───────╮│            │   )))   │           │
│    │   ╱╲    │            │         │            │         │           │
│    └─────────┘            └─────────┘            └─────────┘           │
│    Lightning grid         Concentric             Sound waves            │
│                                                                         │
│     SPEAKING               COMPLETE               CONNECTED             │
│    ┌─────────┐            ┌─────────┐            ┌─────────┐           │
│    │    │    │            │         │            │  ◉──◉   │           │
│    │  ──◉──  │            │    ✓    │            │   \ /   │           │
│    │   /│\   │            │         │            │    ◉    │           │
│    │    │    │            │         │            │   / \   │           │
│    └─────────┘            └─────────┘            └─────────┘           │
│    Radiating              Checkmark              Constellation          │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

## GenUI Component Icons

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        GenUI COMPONENT ICONS                            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│      CHART                  GRID                   LIST                 │
│    ┌─────────┐            ┌─────────┐            ┌─────────┐           │
│    │    ▄    │            │ ┌─┬─┬─┐ │            │ ───────  │           │
│    │  ▄ █    │            │ ├─┼─┼─┤ │            │ ───────  │           │
│    │▄ █ █ ▄  │            │ ├─┼─┼─┤ │            │ ───────  │           │
│    │█ █ █ █  │            │ └─┴─┴─┘ │            │ ───────  │           │
│    └─────────┘            └─────────┘            └─────────┘           │
│    Bar chart              Data grid              Stacked lines          │
│                                                                         │
│      FORM                   CODE                 PROGRESS               │
│    ┌─────────┐            ┌─────────┐            ┌─────────┐           │
│    │┌───────┐│            │  <  />  │            │  ╭───╮   │           │
│    │└───────┘│            │  { }    │            │ ╱     ╲  │           │
│    │┌───────┐│            │  < />   │            │ │  %  │  │           │
│    │└───────┘│            │         │            │  ╲   ╱   │           │
│    └─────────┘            └─────────┘            └─────────┘           │
│    Input fields           Code brackets          Radial progress        │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

# Color Palette Visual

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         VOID PALETTE SPECTRUM                           │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  BACKGROUNDS (Dark to Light)                                            │
│  ════════════════════════════                                           │
│                                                                         │
│  ████████  void.absolute   #000000   OKLCH(0.00 0 0)   True black       │
│  ████████  void.deep       #0a0a0a   OKLCH(0.05 0 0)   Primary BG       │
│  ████████  void.surface    #171717   OKLCH(0.10 0 0)   Elevated         │
│  ████████  void.raised     #212121   OKLCH(0.14 0 0)   Cards            │
│                                                                         │
│  BIOLUMINESCENT TEXT (Dim to Bright)                                    │
│  ═══════════════════════════════════                                    │
│                                                                         │
│  ████████  biolum.whisper  #2e2e2e   OKLCH(0.20 0 0)   Dividers         │
│  ████████  biolum.faint    #4a4a4a   OKLCH(0.35 0 0)   Tertiary         │
│  ████████  biolum.dim      #7a7a7a   OKLCH(0.55 0 0)   Secondary        │
│  ████████  biolum.standard #b3b3b3   OKLCH(0.75 0 0)   Body text        │
│  ████████  biolum.bright   #e5e5e5   OKLCH(0.90 0 0)   Emphasis         │
│  ████████  biolum.full     #fcfcfc   OKLCH(0.99 0 0)   Primary text     │
│                                                                         │
│  GLASS LAYERS (Opacity)                                                 │
│  ══════════════════════                                                 │
│                                                                         │
│  ░░░░░░░░  glass.glow      rgba(255,255,255, 0.03)    Outer glow        │
│  ▒▒▒▒▒▒▒▒  glass.surface   rgba(255,255,255, 0.05)    Card BG           │
│  ▓▓▓▓▓▓▓▓  glass.border    rgba(255,255,255, 0.08)    Subtle border     │
│  ████████  glass.hover     rgba(255,255,255, 0.10)    Hover state       │
│  ████████  glass.active    rgba(255,255,255, 0.15)    Active state      │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

# Typography Scale

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         TYPOGRAPHY HIERARCHY                            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Display Large                                                          │
│  ════════════════════════════════════════════════════                   │
│  34pt / 600 weight / 41pt line height                                   │
│  Use: Hero text, mode titles on full-screen                             │
│                                                                         │
│  Display Medium                                                         │
│  ══════════════════════════════════════════                             │
│  28pt / 600 weight / 34pt line height                                   │
│  Use: Section headers, voice mode title                                 │
│                                                                         │
│  Title Large                                                            │
│  ════════════════════════════════════                                   │
│  22pt / 500 weight / 28pt line height                                   │
│  Use: Card titles, navigation headers                                   │
│                                                                         │
│  Body Large                                                             │
│  ══════════════════════════════                                         │
│  17pt / 400 weight / 25pt line height                                   │
│  Use: Primary content, messages                                         │
│                                                                         │
│  Body Medium                                                            │
│  ════════════════════════                                               │
│  15pt / 400 weight / 22pt line height                                   │
│  Use: Secondary content, descriptions                                   │
│                                                                         │
│  Caption                                                                │
│  ═══════════════                                                        │
│  12pt / 400 weight / 16pt line height                                   │
│  Use: Labels, timestamps, metadata                                      │
│                                                                         │
│  Mono Medium                                                            │
│  ══════════════════════                                                 │
│  13pt / SF Mono / 18pt line height                                      │
│  Use: Code, terminal output, tool calls                                 │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

# Component Anatomy

## The Orb

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           ORB ANATOMY                                   │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│                    160pt (expanded voice mode)                          │
│                    64pt (chat input compact)                            │
│                    44pt (tab bar mini)                                  │
│                                                                         │
│                         ╭─ ─ ─ ─ ─ ─ ─╮                                 │
│                       ╭─              ─╮   ← Layer 1: Outer glow        │
│                     ╭───────────────────╮     25% opacity, blur 40px    │
│                   ╭───────────────────────╮                             │
│                 ┌───────────────────────────┐                           │
│                 │  · · ·                    │  ← Layer 2: Particle field │
│                 │       ·    ·              │     12 orbiting dots       │
│                 │  ·      ╭─────╮      ·    │                            │
│                 │       ╭─┤     ├─╮        │  ← Layer 3: Primary ring   │
│                 │  ·    │ │  ◉  │ │    ·   │     1.5pt stroke           │
│                 │       ╰─┤     ├─╯        │                            │
│                 │  ·      ╰─────╯      ·    │  ← Layer 4: Inner gradient │
│                 │       ·    ·              │     Radial, center-lit     │
│                 │  · · ·                    │                            │
│                 └───────────────────────────┘  ← Layer 5: Mode icon     │
│                   ╰───────────────────────╯     (thinking/listening/etc) │
│                     ╰───────────────────╯                               │
│                       ╰─              ─╯                                │
│                         ╰─ ─ ─ ─ ─ ─ ─╯                                 │
│                                                                         │
│  STATES:                                                                │
│  ═══════                                                                │
│  Idle:      Breathe animation (4s), scale 1.0-1.03, opacity 0.6-0.9    │
│  Listening: Pulse reactive to audio, scale 1.0-1.15, rings expand      │
│  Thinking:  Particle rotation (2s), dots orbit, opacity oscillates     │
│  Speaking:  Radiate rays outward, intensity matches speech audio       │
│  Error:     Red tint, shake animation (300ms)                          │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

## Message Bubble

```
┌─────────────────────────────────────────────────────────────────────────┐
│                       MESSAGE BUBBLE ANATOMY                            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  USER MESSAGE (Right-aligned, HUD surface)                              │
│  ══════════════════════════════════════════                             │
│                                                                         │
│                           ┌────────────────────────────────┐            │
│                           │                                │ ← 20pt     │
│                           │  Message content goes here     │   radius   │
│                           │  with body text styling        │            │
│                           │                                │            │
│                           └───────────────────────────────┬┘ ← 8pt     │
│                                                                         │
│  Background: rgba(255,255,255, 0.08)                                    │
│  Border: 1px solid rgba(255,255,255, 0.10)                              │
│  Padding: 12pt vertical, 16pt horizontal                                │
│  Max width: 85% of container                                            │
│                                                                         │
│  ASSISTANT MESSAGE (Left-aligned, transparent)                          │
│  ══════════════════════════════════════════════                         │
│                                                                         │
│  Assistant responses flow naturally                                     │
│  without bubble container, using                                        │
│  biolum.standard text color.                                            │
│                                                                         │
│  Background: transparent                                                │
│  Padding: 8pt vertical                                                  │
│  Max width: 100%                                                        │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

## HUD Surface Card

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        HUD SURFACE ANATOMY                              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─┐      │
│  │ ╔═══════════════════════════════════════════════════════════╗ │      │
│  │ ║                                                           ║ │      │
│  │ ║   Card Title                                      ⋯       ║ │      │
│  │ ║   ─────────────────────────────────────────────────       ║ │      │
│  │ ║                                                           ║ │      │
│  │ ║   Content area with appropriate padding                   ║ │      │
│  │ ║   and text hierarchy following the                        ║ │      │
│  │ ║   typography system.                                      ║ │      │
│  │ ║                                                           ║ │      │
│  │ ║   [ Action Button ]                                       ║ │      │
│  │ ║                                                           ║ │      │
│  │ ╚═══════════════════════════════════════════════════════════╝ │      │
│  └─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─┘      │
│     ↑ Outer glow (optional)                                             │
│                                                                         │
│  ELEVATION LEVELS:                                                      │
│  ═════════════════                                                      │
│                                                                         │
│  Level 1 (Low):                                                         │
│    Background: rgba(255,255,255, 0.03)                                  │
│    Border: rgba(255,255,255, 0.06)                                      │
│    Radius: 16pt                                                         │
│                                                                         │
│  Level 2 (Medium):                                                      │
│    Background: rgba(255,255,255, 0.05)                                  │
│    Border: rgba(255,255,255, 0.08)                                      │
│    Radius: 20pt                                                         │
│                                                                         │
│  Level 3 (High):                                                        │
│    Background: rgba(255,255,255, 0.07)                                  │
│    Border: rgba(255,255,255, 0.10)                                      │
│    Radius: 24pt                                                         │
│    Shadow: 0 0 40px rgba(255,255,255, 0.05)                             │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

## Control Bar (Endel-Style)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                       CONTROL BAR ANATOMY                               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                                                                 │    │
│  │      ┌───┐     ┌───┐     ┌─────┐     ┌───┐     ┌───┐          │    │
│  │      │ ⏸ │     │ ↻ │     │  ●  │     │ @ │     │ ⏱ │          │    │
│  │      └───┘     └───┘     └─────┘     └───┘     └───┘          │    │
│  │       44pt      44pt       56pt       44pt      44pt           │    │
│  │                                                                 │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                         │
│  BUTTON SPECIFICATIONS:                                                 │
│  ══════════════════════                                                 │
│                                                                         │
│  Standard Button (44pt):                                                │
│    Size: 44pt × 44pt                                                    │
│    Border radius: 22pt (circle)                                         │
│    Border: 1px solid rgba(255,255,255, 0.15)                            │
│    Background: transparent                                              │
│    Icon size: 20pt                                                      │
│    Icon color: biolum.dim                                               │
│                                                                         │
│  Primary Button (56pt):                                                 │
│    Size: 56pt × 56pt                                                    │
│    Border radius: 28pt (circle)                                         │
│    Border: 1px solid rgba(255,255,255, 0.20)                            │
│    Background: rgba(255,255,255, 0.10)                                  │
│    Icon size: 24pt                                                      │
│    Icon color: biolum.full                                              │
│                                                                         │
│  States:                                                                │
│    Pressed: background +5% opacity, scale 0.95                          │
│    Active: border +15% opacity, icon biolum.full                        │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

## Mode Selector (Horizontal)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      MODE SELECTOR ANATOMY                              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                                                                 │    │
│  │    ●          ○          ○          ○          ○          ○    │    │
│  │  ┌───┐      ┌───┐      ┌───┐      ┌───┐      ┌───┐      ┌───┐ │    │
│  │  │ ◎ │      │ ◎ │      │ ◎ │      │ ◎ │      │ ◎ │      │ ◎ │ │    │
│  │  └───┘      └───┘      └───┘      └───┘      └───┘      └───┘ │    │
│  │  Focus      Relax      Sleep      Work       Chat       Code  │    │
│  │   ↑                                                            │    │
│  │ Selected                                                       │    │
│  │                                                                 │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                         │
│  ITEM SPECIFICATIONS:                                                   │
│  ════════════════════                                                   │
│                                                                         │
│  Container: 64pt × 80pt                                                 │
│  Icon circle: 44pt diameter                                             │
│  Icon stroke: 1.5pt                                                     │
│  Label: 11pt, 500 weight, 4pt margin-top                                │
│  Gap between items: 16pt                                                │
│  Horizontal padding: 20pt                                               │
│  Scrollable: true (if more items than fit)                              │
│                                                                         │
│  Default state:                                                         │
│    Icon: biolum.dim                                                     │
│    Label: biolum.faint                                                  │
│    Background: transparent                                              │
│                                                                         │
│  Selected state:                                                        │
│    Icon: biolum.full                                                    │
│    Label: biolum.standard                                               │
│    Background: rgba(255,255,255, 0.08)                                  │
│    Scale: 1.05                                                          │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

# Screen Layout Templates

## Chat Screen

```
┌─────────────────────────────────────────────────────────────────────────┐
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   ●       ○       ○       ○       ○       ○                            │
│  ┌─┐     ┌─┐     ┌─┐     ┌─┐     ┌─┐     ┌─┐                           │  80pt
│  └─┘     └─┘     └─┘     └─┘     └─┘     └─┘                           │
│  Asst    Orch    Rsrch   Exec    Code    Chat                          │
│                                                                         │
├ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─┤
│                                                                         │
│                                     ┌────────────────────────────┐      │
│                                     │ Can you help me analyze    │      │
│                                     │ this data set?             │      │
│                                     └────────────────────────────┘      │
│                                                                         │
│  I'd be happy to help analyze your data.                               │
│  Let me take a look at what you have.                                  │
│                                                                         │
│  ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐                │
│  │ ◐ Thinking...                                      │                │
│  │   Analyzing CSV structure                          │                │
│  │   Identifying key patterns                         │                │
│  └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘                │
│                                                                         │
│  │ ⚡ analyze_csv                                                       │
│  │   file: "data.csv"                                                  │
│  │   ✓ Complete                                                        │
│                                                                         │
│  Based on my analysis, here are the key findings...                    │
│                                                                         │
│                                                                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   ┌────┐                                                               │
│   │ ◉  │   ┌──────────────────────────────────────┐    ┌───┐          │  64pt
│   └────┘   │  Type a message...                   │    │ ▲ │          │
│            └──────────────────────────────────────┘    └───┘          │
│                                                                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│      ○              ○              ●              ○                     │  83pt
│    ┌───┐          ┌───┐          ┌───┐          ┌───┐                  │
│    │💬│          │📜│          │ ◉ │          │⚙️│                  │
│    └───┘          └───┘          └───┘          └───┘                  │
│    Chat          History         Voice        Settings                  │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

## Voice Mode Screen

```
┌─────────────────────────────────────────────────────────────────────────┐
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│                                                                         │
│                           Assistant                                     │  Title
│                        Active Listening                                 │  Subtitle
│                                                                         │
│                                                                         │
│                                                                         │
│                        · · · · · · · ·                                  │
│                      ·                 ·                                │
│                    ·    ╭─────────╮     ·                               │
│                   ·   ╭───────────────╮  ·                              │
│                  ·  ╭───────────────────╮ ·                             │
│                  · │                     │ ·                            │  160pt
│                  · │         ◉          │ ·                             │  Orb
│                  · │                     │ ·                            │
│                  ·  ╰───────────────────╯ ·                             │
│                   ·   ╰───────────────╯  ·                              │
│                    ·    ╰─────────╯     ·                               │
│                      ·                 ·                                │
│                        · · · · · · · ·                                  │
│                                                                         │
│                                                                         │
│                   "Tell me about quantum computing..."                  │  Transcript
│                                                                         │
│                                                                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│      ○       ○       ○       ●       ○       ○                         │  Mode row
│     ┌─┐     ┌─┐     ┌─┐     ┌─┐     ┌─┐     ┌─┐                        │
│     └─┘     └─┘     └─┘     └─┘     └─┘     └─┘                        │
│                                                                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│            ┌───┐     ┌───┐     ┌───┐     ┌───┐                         │  Control
│            │ ⏸ │     │ ↻ │     │ @ │     │ ⏱ │                         │  bar
│            └───┘     └───┘     └───┘     └───┘                         │
│                                                                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│       ┌────────────────────┐  ┌────────────────────┐                   │  Pill
│       │    Your Guide      │  │      Library       │                   │  tabs
│       └────────────────────┘  └────────────────────┘                   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

# Animation Timing Reference

```
┌─────────────────────────────────────────────────────────────────────────┐
│                       ANIMATION TIMING GUIDE                            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  DURATION SCALE                                                         │
│  ══════════════                                                         │
│                                                                         │
│  instant    100ms  ████                     Micro-interactions          │
│  fast       150ms  ██████                   Button feedback             │
│  normal     250ms  ██████████               Standard transitions        │
│  slow       400ms  ████████████████         Page transitions            │
│  slower     600ms  ████████████████████████ Complex animations          │
│                                                                         │
│  CONTINUOUS ANIMATIONS                                                  │
│  ═════════════════════                                                  │
│                                                                         │
│  breathe    4000ms │▁▂▃▄▅▆▇█▇▆▅▄▃▂▁│       Idle orb state             │
│  pulse      2000ms │▁▃▅▇█▇▅▃▁│             Thinking state              │
│  rotate     3000ms │◦ ◦◦◦ ◦◦◦ ◦◦│          Particle orbit              │
│                                                                         │
│  EASING CURVES                                                          │
│  ═════════════                                                          │
│                                                                         │
│  standard   ╭──────╮                                                    │
│             │      ╲                        ease-out                    │
│             ╰───────╲──────                 0.25, 0.1, 0.25, 1          │
│                                                                         │
│  enter      ╭──────╮                                                    │
│             │       ╲                       decelerate                  │
│             ╰────────╲─────                 0, 0, 0.2, 1                │
│                                                                         │
│  exit            ╭──╮                                                   │
│                 ╱    ╲                      accelerate                  │
│             ────╯     ╲─────                0.4, 0, 1, 1                │
│                                                                         │
│  breathe    ╭──────╮                                                    │
│            ╱        ╲                       organic                     │
│           ╱          ╲──────                0.25, 0.4, 0.25, 1          │
│                                                                         │
│  emphasis       ╭╮                                                      │
│               ╭╯  ╲                         spring/bounce               │
│             ──╯    ╲────────                0.34, 1.56, 0.64, 1         │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

# Spacing System

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         SPACING SCALE                                   │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  xs     4pt   ████                          Tight grouping              │
│  sm     8pt   ████████                      Component padding           │
│  md    12pt   ████████████                  Standard gaps               │
│  lg    16pt   ████████████████              Section spacing             │
│  xl    24pt   ████████████████████████      Major sections              │
│  xxl   32pt   ████████████████████████████████    Screen margins        │
│                                                                         │
│  TOUCH TARGETS                                                          │
│  ═════════════                                                          │
│                                                                         │
│  minimum      44pt  ┌────────────────────┐  iOS minimum                 │
│                     │                    │                              │
│                     └────────────────────┘                              │
│                                                                         │
│  comfortable  48pt  ┌──────────────────────┐  Recommended               │
│                     │                      │                            │
│                     └──────────────────────┘                            │
│                                                                         │
│  large        56pt  ┌────────────────────────┐  Primary actions         │
│                     │                        │                          │
│                     └────────────────────────┘                          │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

_Quick Reference Document v1.0_
_Companion to ALFRED Native Brand Design System_
