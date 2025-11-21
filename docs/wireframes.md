# ALFRED Frontend Wireframes

Text-based wireframes of current UI implementation.

## Web App Wireframes

### 1. Mindscape Canvas (`/mindscape`)

```
┌─────────────────────────────────────────────────────────────────────────┐
│ Header: [Home] [Mindscape]                    [User Menu ▼]             │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                                                                  │  │
│  │                    [React Flow Canvas]                          │  │
│  │                                                                  │  │
│  │         ┌─────┐                                                  │  │
│  │         │ ORB │  ┌────────┐  ┌────────┐  ┌────────┐            │  │
│  │         │     │  │ Chat   │  │ Note   │  │ Workflow│            │  │
│  │         │     │  │ Node   │  │ Node   │  │ Node   │            │  │
│  │         └─────┘  └────────┘  └────────┘  └────────┘            │  │
│  │            │          │            │            │                │  │
│  │            └──────────┴────────────┴────────────┘                │  │
│  │                                                                  │  │
│  │  [Background Grid]                                              │  │
│  │                                                                  │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ [Controls] [MiniMap] [Panel]                                    │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  [Cmd+K] Command Palette (overlay)                                     │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘

Features:
- Infinite canvas with pan/zoom
- Node types: orb, chat, note, reminder, timer, todo, workflow, etc.
- Drag-and-drop nodes
- Connect nodes with edges
- Command palette (Cmd+K) for spawning nodes
- MiniMap for navigation
- Controls for zoom/pan
```

### 2. Chat Node (within Mindscape)

```
┌─────────────────────────────────────────────────────────────┐
│ Chat                                    [×] [⚙]            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌───────────────────────────────────────────────────────┐ │
│  │ Controls: [Assistant ▼] [Clear]                      │ │
│  │ Status: [● Connected] [Running 1 action]             │ │
│  └───────────────────────────────────────────────────────┘ │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐ │
│  │                                                       │ │
│  │  [Virtualized Message List]                          │ │
│  │                                                       │ │
│  │  ┌─────────────────────────────────────────────┐    │ │
│  │  │ User: "What's the weather?"                  │    │ │
│  │  └─────────────────────────────────────────────┘    │ │
│  │                                                       │ │
│  │  ┌─────────────────────────────────────────────┐    │ │
│  │  │ Assistant: "It's sunny, 72°F..."            │    │ │
│  │  │ [Tool Call: weather_api]                    │    │ │
│  │  └─────────────────────────────────────────────┘    │ │
│  │                                                       │ │
│  └───────────────────────────────────────────────────────┘ │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐ │
│  │ [Text Input] "Ask Alfred how to help…"  [🎤 Voice]    │ │
│  └───────────────────────────────────────────────────────┘ │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐ │
│  │ Actions Panel (when actions active)                  │ │
│  │ ┌───────────────────────────────────────────────┐   │ │
│  │ │ Tool: weather_api                              │   │ │
│  │ │ Status: [Running]                              │   │ │
│  │ │ Args: { location: "SF" }                      │   │ │
│  │ └───────────────────────────────────────────────┘   │ │
│  └───────────────────────────────────────────────────────┘ │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 3. Drive Mode (`/drive`)

```
┌─────────────────────────────────────────────────────────────┐
│ Header: [Home] [Mindscape]                    [User Menu ▼] │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│                                                             │
│                    Drive Mode                              │
│          Tap and speak. Keep eyes forward.                 │
│                                                             │
│                    ┌─────────┐                             │
│                    │         │                             │
│                    │   ORB   │  [Animated: listening/     │
│                    │         │   thinking/idle]            │
│                    └─────────┘                             │
│                                                             │
│              [Processing your request...]                   │
│                                                             │
│                    ┌─────────┐                             │
│                    │  🎤     │  [Large Voice Button]        │
│                    │ RECORD  │                             │
│                    └─────────┘                             │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐ │
│  │ YOU SAID                                             │ │
│  │ "What's the weather in San Francisco?"               │ │
│  │                                                      │ │
│  │ ALFRED                                               │ │
│  │ "It's sunny, 72°F with light winds."                │ │
│  └─────────────────────────────────────────────────────┘ │
│                                                             │
│              [Exit Drive Mode]                              │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 4. Voice S2S (`/voice-s2s`)

```
┌─────────────────────────────────────────────────────────────┐
│ Header: [Home] [Mindscape]                    [User Menu ▼] │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Voice (Speech to Speech)                                  │
│  Press the button, speak a short prompt, and Alfred will   │
│  reply with synthesized speech via the unified voice        │
│  pipeline.                                                  │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐  │
│  │                                                     │  │
│  │              [Hold to talk]                        │  │
│  │          State: IDLE                                │  │
│  │                                                     │  │
│  └─────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐  │
│  │                                                     │  │
│  │    [Start streaming] (Streaming Prototype)          │  │
│  │          Status: IDLE                               │  │
│  │                                                     │  │
│  └─────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐  │
│  │ Transcript                                          │  │
│  │ "What's the weather?"                               │  │
│  └─────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐  │
│  │ Assistant Reply                                     │  │
│  │ "It's sunny, 72°F..."                               │  │
│  └─────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐  │
│  │ Streaming Transcript                                 │  │
│  │ "What's the weather?"                                │  │
│  │                                                       │  │
│  │ Streaming Reply                                       │  │
│  │ "It's sunny..."                                      │  │
│  │                                                       │  │
│  │ Status: idle                                          │  │
│  └─────────────────────────────────────────────────────┘  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 5. Home (`/`)

```
┌─────────────────────────────────────────────────────────────┐
│ Header: [Home] [Mindscape]                    [User Menu ▼] │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────────────────────────────────────┐  │
│  │                                                      │  │
│  │   ██████╗ ███████╗████████╗████████╗███████╗██████╗ │  │
│  │   ██╔══██╗██╔════╝╚══██╔══╝╚══██╔══╝██╔════╝██╔══██╗ │  │
│  │   ██████╔╝█████╗     ██║      ██║   █████╗  ██████╔╝ │  │
│  │   ██╔══██╗██╔══╝     ██║      ██║   ██╔══╝  ██╔══██╗ │  │
│  │   ██████╔╝███████╗   ██║      ██║   ███████╗██║  ██║ │  │
│  │   ╚═════╝ ╚══════╝   ╚═╝      ╚═╝   ╚══════╝╚═╝  ╚═╝ │  │
│  │                                                      │  │
│  │   ████████╗    ███████╗████████╗ █████╗  ██████╗██╗ │  │
│  │   ╚══██╔══╝    ██╔════╝╚══██╔══╝██╔══██╗██╔════╝██║ │  │
│  │      ██║       ███████╗   ██║   ███████║██║     █████╔╝ │  │
│  │      ██║       ╚════██║   ██║   ██╔══██║██║     ██╔═██╗ │  │
│  │      ██║       ███████║   ██║   ██║  ██║╚██████╗██║  ██╗ │  │
│  │      ╚═╝       ╚══════╝   ╚═╝   ╚═╝  ╚═╝ ╚═════╝╚═╝  ╚═╝ │  │
│  │                                                      │  │
│  └─────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐  │
│  │ API Status                                          │  │
│  │ [●] Connected                                       │  │
│  └─────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐  │
│  │ Enter the Mindscape                                  │  │
│  │ Open the spatial canvas to chat, capture notes,     │  │
│  │ run workflows, and manage Alfred in one place.     │  │
│  │                                                      │  │
│  │              [Launch Mindscape]                      │  │
│  └─────────────────────────────────────────────────────┘  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 6. Onboarding (`/onboarding`)

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  Step 1 of 4                                   25%          │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐  │
│  │                                                      │  │
│  │          Welcome to ALFRED                         │  │
│  │  Your personal AI assistant for workflow             │  │
│  │  automation, productivity, and infrastructure       │  │
│  │  management.                                         │  │
│  │                                                      │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐        │  │
│  │  │   🤖     │  │   ✨     │  │   ⚡     │        │  │
│  │  │ AI-Powered│  │ Intelligent│  │ Fast &   │        │  │
│  │  │ Workflows │  │ Memory    │  │ Secure   │        │  │
│  │  └──────────┘  └──────────┘  └──────────┘        │  │
│  │                                                      │  │
│  └─────────────────────────────────────────────────────┘  │
│                                                             │
│  [Previous]                          [Next]                │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Native App Wireframes

### 1. Drive Mode (Native)

```
┌─────────────────────────────────────┐
│                                     │
│         Drive Mode                  │
│                                     │
│                                     │
│         ┌─────────┐                │
│         │         │                │
│         │   ORB   │                │
│         │         │                │
│         └─────────┘                │
│                                     │
│         ┌─────────┐                │
│         │  🎤     │                │
│         │ HOLD TO │                │
│         │  TALK   │                │
│         └─────────┘                │
│                                     │
│         Transcript                  │
│         "What's the weather?"       │
│                                     │
│         Response                    │
│         "It's sunny, 72°F..."       │
│                                     │
│         [Error message if any]      │
│                                     │
└─────────────────────────────────────┘

Status indicators:
- Holding: Green button, "Listening…"
- Thinking: Blue button, "Thinking…"
- Responding: Blue button, "Speaking…"
- Error: Red button, "Check connection"
```

### 2. Todos Screen (Native)

```
┌─────────────────────────────────────┐
│ [☰] Todos                    [⚙]  │
├─────────────────────────────────────┤
│                                     │
│  ┌───────────────────────────────┐ │
│  │ Add new todo...              │ │
│  │                              │ │
│  │                    [Add]      │ │
│  └───────────────────────────────┘ │
│                                     │
│  ┌───────────────────────────────┐ │
│  │ ☐ Buy groceries               │ │
│  │                              │ │
│  │ ☑ Complete project            │ │
│  │                              │ │
│  │ ☐ Call dentist               │ │
│  └───────────────────────────────┘ │
│                                     │
│  Filter: [All] [Active] [Completed] │
│                                     │
└─────────────────────────────────────┘
```

### 3. AI Chat Screen (Native)

```
┌─────────────────────────────────────┐
│ [☰] AI Chat                  [⚙]  │
├─────────────────────────────────────┤
│                                     │
│  AI Chat                            │
│  Chat with our AI assistant         │
│                                     │
│  ┌───────────────────────────────┐ │
│  │                               │ │
│  │  Ask me anything to get       │ │
│  │  started!                     │ │
│  │                               │ │
│  │  ┌─────────────────────────┐ │ │
│  │  │ You: "Hello"            │ │ │
│  │  └─────────────────────────┘ │ │
│  │                               │ │
│  │  ┌─────────────────────────┐ │ │
│  │  │ AI Assistant: "Hi!..."  │ │ │
│  │  └─────────────────────────┘ │ │
│  │                               │ │
│  └───────────────────────────────┘ │
│                                     │
│  ┌───────────────────────────────┐ │
│  │ Type your message...    [📤] │ │
│  └───────────────────────────────┘ │
│                                     │
└─────────────────────────────────────┘
```

### 4. Home Screen (Native)

```
┌─────────────────────────────────────┐
│ [☰] Home                     [⚙]  │
├─────────────────────────────────────┤
│                                     │
│  ┌───────────────────────────────┐ │
│  │                               │ │
│  │    Welcome to ALFRED          │ │
│  │                               │ │
│  │    Your personal AI assistant │ │
│  │                               │ │
│  └───────────────────────────────┘ │
│                                     │
│  Quick Actions:                     │
│                                     │
│  ┌─────────┐  ┌─────────┐        │
│  │   🎤    │  │   📝    │        │
│  │  Drive  │  │  Todos  │        │
│  └─────────┘  └─────────┘        │
│                                     │
│  ┌─────────┐  ┌─────────┐        │
│  │   💬    │  │   ⚙     │        │
│  │   AI    │  │ Settings│        │
│  └─────────┘  └─────────┘        │
│                                     │
└─────────────────────────────────────┘
```

### 5. Navigation Structure (Native)

```
┌─────────────────────────────────────┐
│                                     │
│  Drawer Navigation:                 │
│                                     │
│  ┌───────────────────────────────┐ │
│  │ 🏠 Home                      │ │
│  ├───────────────────────────────┤ │
│  │ 📑 Tabs                      │ │
│  ├───────────────────────────────┤ │
│  │ ☑ Todos                      │ │
│  ├───────────────────────────────┤ │
│  │ 💬 AI                         │ │
│  └───────────────────────────────┘ │
│                                     │
│  Tab Navigation (within Tabs):      │
│                                     │
│  ┌───────────────────────────────┐ │
│  │ 🏠 Home │ 🧭 Explore │ 🚗 Drive│ │
│  └───────────────────────────────┘ │
│                                     │
└─────────────────────────────────────┘
```

---

## Component Hierarchy

### Web App Component Structure

```
__root.tsx
├── Header
│   ├── Navigation Links
│   └── UserMenu
├── Outlet (Routes)
│   ├── index.tsx (Home)
│   ├── mindscape.tsx
│   │   └── MindscapeCanvas
│   │       ├── ReactFlow
│   │       │   ├── Background
│   │       │   ├── Controls
│   │       │   ├── MiniMap
│   │       │   └── Nodes (21 types)
│   │       │       ├── ChatNode
│   │       │       │   └── ChatContainer
│   │       │       │       ├── Controls
│   │       │       │       ├── Chat (from @alfred/ui)
│   │       │       │       └── Actions Panel
│   │       │       ├── NoteNode
│   │       │       ├── WorkflowNode
│   │       │       └── ...
│   │       ├── CommandPalette
│   │       └── WorkflowManager
│   ├── drive.tsx
│   │   └── DriveMode
│   │       ├── Orb
│   │       ├── VoiceBtn
│   │       └── Transcript/Reply Display
│   ├── voice-s2s.tsx
│   │   └── VoiceS2SRouteView
│   └── onboarding.tsx
│       ├── WelcomeStep
│       ├── PreferencesStep
│       ├── IntegrationsStep
│       └── TourStep
└── Toaster (Sonner)
```

### Native App Component Structure

```
_layout.tsx (Root)
├── Drawer Navigation
│   ├── index.tsx (Home)
│   ├── (tabs)/
│   │   ├── index.tsx (Tab One)
│   │   ├── two.tsx (Tab Two)
│   │   └── drive.tsx
│   │       └── DriveScreen
│   │           ├── Voice Session Hook
│   │           ├── Status Display
│   │           └── Transcript/Reply
│   ├── todos.tsx
│   │   └── TodosScreen
│   │       ├── Todo List
│   │       └── Add Todo Form
│   └── ai.tsx
│       └── AIScreen
│           └── Chat Interface
└── Modal (overlay)
```

---

## Design System Tokens

### Colors (Signal in the Void)
- `--color-void`: `oklch(0.05 0 0)` - Background
- `--color-void-surface`: `oklch(0.14 0 0)` - Surface
- `--color-biolum`: `oklch(0.99 0 0)` - Primary text/active
- `--color-biolum-dim`: `oklch(0.70 0 0)` - Secondary text
- `--color-biolum-faint`: `oklch(0.40 0 0)` - Inactive

### Typography
- Font: "Inter Tight", "Geist Sans", "San Francisco"
- Tracking: `-0.04em` (headers), `-0.02em` (body)

### Spacing & Layout
- Border radius: `24px` (containers), `9999px` (buttons/pills)
- Border: `1px` thin borders with `border-white/10`
- HUD Pattern: `bg-void-surface/40` + `backdrop-blur-xl` + `border border-white/10`

---

## Interaction Patterns

### Keyboard Shortcuts
- `Cmd/Ctrl + M`: Toggle Mindscape
- `Cmd/Ctrl + K`: Open Command Palette (Mindscape)

### Voice Interactions
- **Drive Mode**: Press and hold → speak → release → process
- **Voice S2S**: Click → speak → click → process
- **Streaming**: Continuous listening with VAD

### Gestures (Native)
- **Drive Mode**: Press and hold button
- **Drawer**: Swipe from left edge
- **Tabs**: Bottom navigation bar

---

## Notes

- Web app uses TanStack Start with SSR
- Native app uses Expo Router with file-based routing
- Both apps share tRPC client for API communication
- Design system follows "Signal in the Void" aesthetic
- Voice features are production-ready except streaming (prototype)
- Mindscape is web-only; native app lacks spatial canvas

