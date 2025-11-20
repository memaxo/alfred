# UI User Journey Wireframe

**Date:** 2025-01-27  
**Status:** Current Implementation

## Overview

This document wireframes the current ALFRED web application user journey, showing all routes, navigation flows, and user interactions.

---

## 1. Public Routes (Unauthenticated)

### Landing Page (`/`)

```
┌─────────────────────────────────────────────────────────┐
│  ALFRED HEADER                                          │
│  [Home] [Dashboard] [Chat] [Notes] ... [Settings] [👤] │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ██████╗ ███████╗████████╗████████╗███████╗██████╗      │
│  ██╔══██╗██╔════╝╚══██╔══╝╚══██╔══╝██╔════╝██╔══██╗     │
│  ██████╔╝█████╗     ██║      ██║   █████╗  ██████╔╝     │
│  ██╔══██╗██╔══╝     ██║      ██║   ██╔══╝  ██╔══██╗     │
│  ██████╔╝███████╗   ██║      ██║   ███████╗██║  ██║     │
│  ╚═════╝ ╚══════╝   ╚═╝      ╚═╝   ╚══════╝╚═╝  ╚═╝     │
│                                                         │
│  ████████╗    ███████╗████████╗ █████╗  ██████╗██╗  ██╗ │
│  ╚══██╔══╝    ██╔════╝╚══██╔══╝██╔══██╗██╔════╝██║ ██╔╝ │
│     ██║       ███████╗   ██║   ███████║██║     █████╔╝  │
│     ██║       ╚════██║   ██║   ██╔══██║██║     ██╔═██╗  │
│     ██║       ███████║   ██║   ██║  ██║╚██████╗██║  ██╗ │
│     ╚═╝       ╚══════╝   ╚═╝   ╚═╝  ╚═╝ ╚═════╝╚═╝  ╚═╝ │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │ API Status                                       │   │
│  │ ● Connected                                     │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │ Orchestrator Run Viewer                         │   │
│  │ Kick off a secure plan run, watch live droid    │   │
│  │ output, and test token elevation.               │   │
│  │ [Open Run Viewer]                               │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**User Actions:**
- Click "Open Run Viewer" → Redirects to `/orchestrator/run` (requires auth)
- Click any nav link → Redirects to `/login` (if not authenticated)

---

### Login Page (`/login`)

```
┌─────────────────────────────────────────────────────────┐
│  ALFRED HEADER                                          │
│  [Home] [Dashboard] [Chat] [Notes] ... [Settings] [👤] │
├─────────────────────────────────────────────────────────┤
│                                                         │
│                    ┌─────────────┐                      │
│                    │   Sign Up   │                      │
│                    └─────────────┘                      │
│                                                         │
│  ┌───────────────────────────────────────────────┐     │
│  │                                               │     │
│  │  Name: [________________________]            │     │
│  │                                               │     │
│  │  Email: [________________________]           │     │
│  │                                               │     │
│  │  Password: [________________________]        │     │
│  │                                               │     │
│  │  [Sign Up]                                    │     │
│  │                                               │     │
│  │  Already have an account?                    │     │
│  │  [Switch to Sign In]                          │     │
│  │                                               │     │
│  └───────────────────────────────────────────────┘     │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**User Actions:**
- Fill form → Submit → Creates account → Redirects to `/onboarding` (new user) or `/dashboard` (existing)
- Click "Switch to Sign In" → Shows Sign In form
- Sign In form has same layout with "Switch to Sign Up" option

**Flow:**
```
/login (Sign Up)
  ↓ [Submit]
  ↓ [Account Created]
  ↓
/onboarding (New User)
  OR
/dashboard (Existing User)
```

---

## 2. Onboarding Flow (`/onboarding`)

```
┌─────────────────────────────────────────────────────────┐
│  ALFRED HEADER                                          │
│  [Home] [Dashboard] [Chat] [Notes] ... [Settings] [👤] │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Step 1 of 4                                            │
│  [━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━]   │
│                                                         │
│  ┌───────────────────────────────────────────────┐     │
│  │                                               │     │
│  │  Welcome to ALFRED                           │     │
│  │                                               │     │
│  │  [Welcome content...]                        │     │
│  │                                               │     │
│  │  [Next →]                                     │     │
│  │                                               │     │
│  └───────────────────────────────────────────────┘     │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Steps:**
1. **Welcome** - Introduction to ALFRED
2. **Preferences** - Set autonomy level (read/low/medium/high)
3. **Integrations** - Connect Linear (optional)
4. **Tour** - Feature walkthrough

**Flow:**
```
/onboarding
  ↓ [Step 1: Welcome]
  ↓ [Next]
  ↓ [Step 2: Preferences]
  ↓ [Next]
  ↓ [Step 3: Integrations]
  ↓ [Next]
  ↓ [Step 4: Tour]
  ↓ [Complete]
  ↓
/dashboard
```

---

## 3. Authenticated Routes (Protected by `/_authed`)

### Dashboard (`/dashboard`)

```
┌─────────────────────────────────────────────────────────┐
│  ALFRED HEADER                                          │
│  [Home] [Dashboard] [Chat] [Notes] ... [Settings] [👤] │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌───────────────────────────────────────────────┐     │
│  │  Private Data                                 │     │     │
│  │                                               │     │
│  │  [Loading...]                                │     │
│  │                                               │     │
│  └───────────────────────────────────────────────┘     │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Note:** Currently minimal implementation - shows private data query result.

---

### Chat Interface (`/ai`)

```
┌─────────────────────────────────────────────────────────┐
│  ALFRED HEADER                                          │
│  [Home] [Dashboard] [Chat] [Notes] ... [Settings] [👤] │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌───────────────────────────────────────────────┐     │
│  │  Agent: [Assistant ▼]  [Clear]                │     │
│  ├───────────────────────────────────────────────┤     │
│  │                                               │     │
│  │  ┌─────────────────────────────────────┐     │     │
│  │  │ User: Hello                          │     │     │
│  │  └─────────────────────────────────────┘     │     │
│  │                                               │     │
│  │  ┌─────────────────────────────────────┐     │     │
│  │  │ Assistant: Hi! How can I help?      │     │     │
│  │  │                                     │     │     │
│  │  │ [Plan Component]                    │     │     │
│  │  │ [Task Component]                    │     │     │
│  │  │ [Tool Component]                    │     │     │
│  │  │ [Code Component]                    │     │     │
│  │  │ [Citation Component]                 │     │     │
│  │  │ [Reasoning Component]               │     │     │
│  │  └─────────────────────────────────────┘     │     │
│  │                                               │     │
│  │  ┌─────────────────────────────────────┐     │     │
│  │  │ User: [Type message...] [🎤] [Send]│     │     │
│  │  └─────────────────────────────────────┘     │     │
│  │                                               │     │
│  └───────────────────────────────────────────────┘     │
│                                                         │
│  ┌───────────────────────────────────────────────┐     │
│  │  Actions Panel                                │     │
│  │  [Tool executions...]                          │     │
│  └───────────────────────────────────────────────┘     │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Components:**
- **ChatContainer** - Main container with streaming
- **Controls** - Agent switcher (Assistant/Orchestrator) + Clear button
- **Chat** - Message list with part rendering
- **Actions** - Tool execution panel (collapsible)
- **Voice Button** - Microphone for voice input

**Flow:**
```
/ai
  ↓ [Type message / Voice input]
  ↓ [Send]
  ↓ [Streaming response]
  ↓ [Render parts: plan, task, tool, code, cite, think]
```

---

### Notes Management (`/note`)

```
┌─────────────────────────────────────────────────────────┐
│  ALFRED HEADER                                          │
│  [Home] [Dashboard] [Chat] [Notes] ... [Settings] [👤] │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌───────────────────────────────────────────────┐     │
│  │  Notes                                        │     │
│  │  Add a quick note and keep track of it.       │     │
│  ├───────────────────────────────────────────────┤     │
│  │                                               │     │
│  │  Title: [________________________]          │     │
│  │                                               │     │
│  │  Content: [________________________]        │     │
│  │              [________________________]       │     │
│  │                                               │     │
│  │  [Create Note]                                │     │
│  │                                               │     │
│  └───────────────────────────────────────────────┘     │
│                                                         │
│  ┌───────────────────────────────────────────────┐     │
│  │  Recent notes                                  │     │
│  ├───────────────────────────────────────────────┤     │
│  │                                               │     │
│  │  ┌─────────────────────────────────────┐     │     │
│  │  │ Note Title                          │     │     │
│  │  │ Note content preview...             │     │     │
│  │  │ [Delete]                            │     │     │
│  │  └─────────────────────────────────────┘     │     │
│  │                                               │     │
│  │  ┌─────────────────────────────────────┐     │     │
│  │  │ Another Note                        │     │     │
│  │  │ More content...                     │     │     │
│  │  │ [Delete]                            │     │     │
│  │  └─────────────────────────────────────┘     │     │
│  │                                               │     │
│  └───────────────────────────────────────────────┘     │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Components:**
- **PaneLayout** - Wrapper with title, description, create form
- **NotePane** - List component from `@alfred/ui`

**Flow:**
```
/note
  ↓ [Create Note]
  ↓ [Submit]
  ↓ [Optimistic Update]
  ↓ [List Refresh]
```

---

### Reminders Management (`/remind`)

```
┌─────────────────────────────────────────────────────────┐
│  ALFRED HEADER                                          │
│  [Home] [Dashboard] [Chat] [Notes] ... [Settings] [👤] │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌───────────────────────────────────────────────┐     │
│  │  Reminders                                     │     │
│  │  Set reminders for important tasks.             │     │
│  ├───────────────────────────────────────────────┤     │
│  │                                               │     │
│  │  Content: [________________________]         │     │
│  │                                               │     │
│  │  Due: [Date Picker] [Time Picker]           │     │
│  │                                               │     │
│  │  [Create Reminder]                           │     │
│  │                                               │     │
│  └───────────────────────────────────────────────┘     │
│                                                         │
│  ┌───────────────────────────────────────────────┐     │
│  │  Recent reminders                              │     │
│  ├───────────────────────────────────────────────┤     │
│  │                                               │     │
│  │  ┌─────────────────────────────────────┐     │     │
│  │  │ Due Now                              │     │     │
│  │  │ ┌─────────────────────────────────┐ │     │     │
│  │  │ │ Reminder content                │ │     │     │
│  │  │ │ Due: [Date/Time]                │ │     │     │
│  │  │ │ [Delete]                        │ │     │     │
│  │  │ └─────────────────────────────────┘ │     │     │
│  │  └─────────────────────────────────────┘     │     │
│  │                                               │     │
│  │  ┌─────────────────────────────────────┐     │     │
│  │  │ Upcoming                             │     │     │
│  │  │ ┌─────────────────────────────────┐ │     │     │
│  │  │ │ Reminder content                │ │     │     │
│  │  │ │ Due: [Date/Time]                │ │     │     │
│  │  │ │ [Delete]                        │ │     │     │
│  │  │ └─────────────────────────────────┘ │     │     │
│  │  └─────────────────────────────────────┘     │     │
│  │                                               │     │
│  └───────────────────────────────────────────────┘     │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Components:**
- **PaneLayout** - Same wrapper pattern
- **RemindPane** - List component with "Due Now" and "Upcoming" sections

**Flow:**
```
/remind
  ↓ [Create Reminder]
  ↓ [Set Due Date/Time]
  ↓ [Submit]
  ↓ [Optimistic Update]
  ↓ [List Refresh]
```

---

### Todos Management (`/todos`)

```
┌─────────────────────────────────────────────────────────┐
│  ALFRED HEADER                                          │
│  [Home] [Dashboard] [Chat] [Notes] ... [Settings] [👤] │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌───────────────────────────────────────────────┐     │
│  │  Todos                                        │     │
│  ├───────────────────────────────────────────────┤     │
│  │                                               │     │
│  │  [Add Todo Input] [Add]                       │     │
│  │                                               │     │
│  │  ┌─────────────────────────────────────┐     │     │
│  │  │ ☐ Todo item 1                       │     │     │
│  │  │ ☐ Todo item 2                       │     │     │
│  │  │ ☑ Completed todo                    │     │     │
│  │  └─────────────────────────────────────┘     │     │
│  │                                               │     │
│  └───────────────────────────────────────────────┘     │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Note:** Custom implementation (not using PaneLayout pattern).

---

### Timers (`/timer`)

```
┌─────────────────────────────────────────────────────────┐
│  ALFRED HEADER                                          │
│  [Home] [Dashboard] [Chat] [Notes] ... [Settings] [👤] │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  [Timer Management UI - Backend exists, frontend TBD]  │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Status:** Route exists, UI implementation pending.

---

### Bookmarks (`/book`)

```
┌─────────────────────────────────────────────────────────┐
│  ALFRED HEADER                                          │
│  [Home] [Dashboard] [Chat] [Notes] ... [Settings] [👤] │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  [Bookmark Management UI - Backend exists, frontend TBD]│
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Status:** Route exists, UI implementation pending.

---

### Workflows (`/workflows`)

```
┌─────────────────────────────────────────────────────────┐
│  ALFRED HEADER                                          │
│  [Home] [Dashboard] [Chat] [Notes] ... [Settings] [👤] │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌───────────────────────────────────────────────┐     │
│  │  Workflows                                    │     │
│  ├───────────────────────────────────────────────┤     │
│  │                                               │     │
│  │  [Filter: All ▼] [Search: ________]         │     │
│  │                                               │     │
│  │  ┌─────────────────────────────────────┐     │     │
│  │  │ Workflow #123                      │     │     │
│  │  │ Status: Completed                  │     │     │
│  │  │ Started: [Date]                    │     │     │
│  │  │ [View Details]                     │     │     │
│  │  └─────────────────────────────────────┘     │     │
│  │                                               │     │
│  │  ┌─────────────────────────────────────┐     │     │
│  │  │ Workflow #122                      │     │     │
│  │  │ Status: Running                    │     │     │
│  │  │ Started: [Date]                    │     │     │
│  │  │ [View Details]                     │     │     │
│  │  └─────────────────────────────────────┘     │     │
│  │                                               │     │
│  └───────────────────────────────────────────────┘     │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Status:** Route exists, shows workflow list with filtering.

---

### Orchestrator Run (`/orchestrator/run`)

```
┌─────────────────────────────────────────────────────────┐
│  ALFRED HEADER                                          │
│  [Home] [Dashboard] [Chat] [Notes] ... [Settings] [👤] │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌───────────────────────────────────────────────┐     │
│  │  Orchestrator Run                             │     │
│  ├───────────────────────────────────────────────┤     │
│  │                                               │     │
│  │  Workflow: [Select ▼]                        │     │
│  │  Input: [________________________]          │     │
│  │                                               │     │
│  │  [Start Run]                                  │     │
│  │                                               │     │
│  └───────────────────────────────────────────────┘     │
│                                                         │
│  ┌───────────────────────────────────────────────┐     │
│  │  Run Output (Streaming)                       │     │
│  ├───────────────────────────────────────────────┤     │
│  │                                               │     │
│  │  [Plan Component]                            │     │
│  │  [Task Components]                           │     │
│  │  [Tool Execution Components]                │     │
│  │  [Code Components]                           │     │
│  │                                               │     │
│  │  Status: Running                             │     │
│  │  [Suspend] [Cancel]                          │     │
│  │                                               │     │
│  └───────────────────────────────────────────────┘     │
│                                                         │
│  ┌───────────────────────────────────────────────┐     │
│  │  Replay Mode                                  │     │
│  │  [Load Previous Run]                          │     │
│  └───────────────────────────────────────────────┘     │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Components:**
- Form for workflow selection and input
- Real-time streaming output
- Plan/Task/Tool/Code visualization
- Suspend/Resume controls (requires biometric elevation)
- Replay mode for previous runs

**Flow:**
```
/orchestrator/run
  ↓ [Select Workflow]
  ↓ [Enter Input]
  ↓ [Start Run]
  ↓ [Streaming Output]
  ↓ [Suspend/Resume/Cancel]
  OR
  ↓ [Load Previous Run]
  ↓ [Replay Mode]
```

---

### Deployments (`/deployments`)

```
┌─────────────────────────────────────────────────────────┐
│  ALFRED HEADER                                          │
│  [Home] [Dashboard] [Chat] [Notes] ... [Settings] [👤] │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌───────────────────────────────────────────────┐     │
│  │  Deployments                                  │     │
│  ├───────────────────────────────────────────────┤     │
│  │                                               │     │
│  │  [Deployment List]                            │     │
│  │  [Promote Dialog]                             │     │
│  │                                               │     │
│  └───────────────────────────────────────────────┘     │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

### Integrations (`/integrations`)

```
┌─────────────────────────────────────────────────────────┐
│  ALFRED HEADER                                          │
│  [Home] [Dashboard] [Chat] [Notes] ... [Settings] [👤] │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌───────────────────────────────────────────────┐     │
│  │  Integrations                                  │     │
│  ├───────────────────────────────────────────────┤     │
│  │                                               │     │
│  │  ┌─────────────────────────────────────┐     │     │
│  │  │ Linear                               │     │     │
│  │  │ [Connect] [Disconnect]              │     │     │
│  │  │ Status: Connected                    │     │     │
│  │  └─────────────────────────────────────┘     │     │
│  │                                               │     │
│  └───────────────────────────────────────────────┘     │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

### Preferences (`/preferences`)

```
┌─────────────────────────────────────────────────────────┐
│  ALFRED HEADER                                          │
│  [Home] [Dashboard] [Chat] [Notes] ... [Settings] [👤] │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌───────────────────────────────────────────────┐     │
│  │  Preferences                                   │     │
│  ├───────────────────────────────────────────────┤     │
│  │                                               │     │
│  │  Autonomy Level                               │     │
│  │  ┌─────────────────────────────────────┐     │     │
│  │  │ Read  Low  Medium  High              │     │     │
│  │  │  ●─────○─────○─────○                │     │     │
│  │  └─────────────────────────────────────┘     │     │
│  │                                               │     │
│  │  [Save Preferences]                          │     │
│  │                                               │     │
│  └───────────────────────────────────────────────┘     │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Components:**
- **AutonomySlider** - Pure component with callback

---

### Privacy (`/privacy`)

```
┌─────────────────────────────────────────────────────────┐
│  ALFRED HEADER                                          │
│  [Home] [Dashboard] [Chat] [Notes] ... [Settings] [👤] │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌───────────────────────────────────────────────┐     │
│  │  Privacy Controls                              │     │
│  ├───────────────────────────────────────────────┤     │
│  │                                               │     │
│  │  Data Export                                   │     │
│  │  [Export All Data]                            │     │
│  │                                               │     │
│  │  Data Deletion                                 │     │
│  │  [Delete All Data]                            │     │
│  │                                               │     │
│  └───────────────────────────────────────────────┘     │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Components:**
- **PrivacyControls** - Pure component with callbacks

---

### Profile (`/profile`)

```
┌─────────────────────────────────────────────────────────┐
│  ALFRED HEADER                                          │
│  [Home] [Dashboard] [Chat] [Notes] ... [Settings] [👤] │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌───────────────────────────────────────────────┐     │
│  │  Profile                                      │     │
│  ├───────────────────────────────────────────────┤     │
│  │                                               │     │
│  │  Name: [________________________]           │     │
│  │  Email: [________________________]          │     │
│  │                                               │     │
│  │  [Update Profile]                             │     │
│  │                                               │     │
│  └───────────────────────────────────────────────┘     │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

### Drive Mode (`/drive`)

```
┌─────────────────────────────────────────────────────────┐
│  ALFRED HEADER                                          │
│  [Home] [Dashboard] [Chat] [Notes] ... [Settings] [👤] │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌───────────────────────────────────────────────┐     │
│  │  Drive Mode (Voice-First)                     │     │
│  ├───────────────────────────────────────────────┤     │
│  │                                               │     │
│  │  [Large Voice Button]                        │     │
│  │                                               │     │
│  │  [Waveform Visualization]                     │     │
│  │                                               │     │
│  │  [Transcript Display]                         │     │
│  │                                               │     │
│  └───────────────────────────────────────────────┘     │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Components:**
- **DriveMode** - Voice-first interface with large controls

---

## 4. Navigation Structure

### Header Navigation

```
┌─────────────────────────────────────────────────────────┐
│  [Home] [Dashboard] [Chat] [Notes] [Reminders]         │
│  [Timers] [Bookmarks] [Workflows] [Integrations]       │
│  [Settings]                                    [👤 Menu]│
└─────────────────────────────────────────────────────────┘
```

**User Menu (`👤`):**
- Sign Out
- Copy Token (dev)
- Profile link

---

## 5. Complete User Journey Flow

### New User Journey

```
1. Landing (/)
   ↓
2. Sign Up (/login)
   ↓
3. Onboarding (/onboarding)
   ├─ Step 1: Welcome
   ├─ Step 2: Preferences
   ├─ Step 3: Integrations
   └─ Step 4: Tour
   ↓
4. Dashboard (/dashboard)
   ↓
5. Chat (/ai) - Primary interaction
   ├─ Voice input
   ├─ Text input
   └─ Streaming responses
   ↓
6. Management Routes
   ├─ Notes (/note)
   ├─ Reminders (/remind)
   ├─ Todos (/todos)
   ├─ Timers (/timer) - TBD
   └─ Bookmarks (/book) - TBD
   ↓
7. Workflow Routes
   ├─ Workflows List (/workflows)
   └─ Orchestrator Run (/orchestrator/run)
   ↓
8. Settings Routes
   ├─ Preferences (/preferences)
   ├─ Privacy (/privacy)
   ├─ Profile (/profile)
   └─ Integrations (/integrations)
```

### Returning User Journey

```
1. Landing (/)
   ↓
2. Sign In (/login)
   ↓
3. Dashboard (/dashboard)
   ↓
4. Primary Routes (same as above)
```

---

## 6. Authentication Flow

```
┌─────────────────────────────────────────────────────────┐
│  Unauthenticated Request                                │
│  ↓                                                      │
│  Route: /_authed/*                                      │
│  ↓                                                      │
│  beforeLoad: Check Session                              │
│  ↓                                                      │
│  Session Exists?                                        │
│  ├─ Yes → Allow Access                                  │
│  └─ No → Redirect to /login?redirect=/original        │
└─────────────────────────────────────────────────────────┘
```

**Protected Routes:**
- All routes under `/_authed/*` require authentication
- `beforeLoad` guard checks session
- Redirects to `/login` with return URL

---

## 7. Component Hierarchy

### Chat Container

```
ChatContainer
├─ Controls (Agent Switcher + Clear)
├─ Chat
│  ├─ Message List
│  │  ├─ User Messages
│  │  └─ Assistant Messages
│  │     ├─ Text Parts
│  │     ├─ Plan Components
│  │     ├─ Task Components
│  │     ├─ Tool Components
│  │     ├─ Code Components
│  │     ├─ Citation Components
│  │     └─ Reasoning Components
│  └─ Input (Text + Voice Button)
└─ Actions Panel (Tool Executions)
```

### Pane Layout Pattern

```
PaneLayout
├─ Create Form Card
│  ├─ Title
│  ├─ Description
│  └─ Form Inputs
└─ List Card
   ├─ Title ("Recent {type}")
   └─ Pane Component (NotePane, RemindPane, etc.)
```

---

## 8. Missing UI Elements (Gaps)

### High Priority
- ❌ Timer Management UI (`/timer` route exists, UI missing)
- ❌ Bookmarks Management UI (`/book` route exists, UI missing)
- ❌ Biometric Elevation Challenge (for workflow suspend/resume)
- ❌ Email Verification Flow (`/verify-email` route missing)

### Medium Priority
- ❌ Message History with Infinite Scroll
- ❌ Workflow Error Analysis UI
- ❌ Linear Integration Management UI (partial - route exists)
- ❌ Voice Settings Component

### Low Priority
- ❌ Password Reset Flow (`/reset-password` route missing)
- ❌ Message Editing/Regeneration
- ❌ Workflow Template Library
- ❌ Theme/Appearance Settings

---

## 9. Route Summary

### Public Routes
- `/` - Landing page
- `/login` - Authentication (sign-in/sign-up toggle)
- `/healthz` - Health check
- `/healthz/deps` - Dependency health check

### Protected Routes (`/_authed/*`)
- `/dashboard` - Dashboard (minimal)
- `/ai` - Chat interface
- `/note` - Notes management
- `/remind` - Reminders management
- `/todos` - Todos management
- `/timer` - Timers (route exists, UI TBD)
- `/book` - Bookmarks (route exists, UI TBD)
- `/workflows` - Workflow list
- `/orchestrator/run` - Workflow execution
- `/deployments` - Deployment management
- `/integrations` - Integration management
- `/preferences` - User preferences
- `/privacy` - Privacy controls
- `/profile` - User profile
- `/drive` - Voice-first driving mode
- `/onboarding` - Onboarding wizard (accessible post-signup)

### API Routes
- `/api/trpc/$` - tRPC endpoint
- `/api/assistant/$` - Assistant streaming
- `/api/orchestrator/$` - Orchestrator streaming
- `/api/auth/$` - Better Auth endpoint
- `/api/metrics` - Prometheus metrics
- `/api/jwks` - JWKS endpoint
- `/api/linear/webhook` - Linear webhook handler

---

## 10. Key Patterns

### Authentication Pattern
- `/_authed` layout route with `beforeLoad` guard
- All protected routes inherit authentication
- Redirects to `/login` with return URL

### Pane Pattern
- `PaneLayout` wrapper component
- Create form + List view
- Used by Notes, Reminders (can extend to Timers, Bookmarks)

### Chat Pattern
- `ChatContainer` isolates streaming hooks
- `Chat` component renders messages
- `renderPart` function handles AI SDK v6 parts
- Voice integration via `useVoiceCapture` hook

### Settings Pattern
- Pure components with callbacks (`AutonomySlider`, `PrivacyControls`)
- Routes wire to tRPC mutations
- Optimistic updates via TanStack Query

---

## Conclusion

The ALFRED UI user journey is **well-structured** with clear navigation patterns and consistent component usage. The main gaps are:

1. **Timer and Bookmarks UI** - Routes exist, UI implementation needed
2. **Biometric Elevation** - Required for workflow suspend/resume
3. **Email Verification** - Missing flow for new users
4. **Message History** - Infinite scroll needed for long conversations

The architecture follows TanStack Start best practices with proper authentication guards, error boundaries, and component composition patterns.

