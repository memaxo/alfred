# Backend-Frontend Coverage Audit

**Owner:** UI/UX  
**Status:** Complete  
**Created:** 2026-01-02

---

## Purpose

Comprehensive audit of backend capabilities vs. existing frontend coverage to identify gaps requiring new desktop apps or integrations.

---

## Executive Summary

| Category         | Backend Capabilities | Current UI Coverage | Gap Level |
| ---------------- | -------------------- | ------------------- | --------- |
| **AI/Chat**      | 6 routers            | Partial             | Medium    |
| **Productivity** | 6 routers            | Good                | Low       |
| **System**       | 8 routers            | Poor                | High      |
| **Integrations** | 4 routers            | Partial             | Medium    |
| **Development**  | 5 routers            | Poor                | High      |
| **Knowledge**    | 3 routers            | Partial             | Medium    |

**Total backend routers: 34**
**Fully covered: ~12 (35%)**
**Partially covered: ~10 (29%)**
**No coverage: ~12 (35%)**

---

## Detailed Router Audit

### Category: AI/Chat

| Router         | Procedures            | Current UI               | Gap                             | Priority |
| -------------- | --------------------- | ------------------------ | ------------------------------- | -------- |
| `assistant`    | chat, stream, history | ChatWindow               | None                            | -        |
| `orchestrator` | run, stream, events   | WorkflowWindow (partial) | Multi-agent orchestration UI    | P1       |
| `cognitive`    | state, feedback       | HUD status panel         | Full cognitive dashboard        | P2       |
| `voice`        | stt, tts, s2s, stream | VoiceBtn (partial)       | Voice settings, model selection | P1       |
| `droid`        | run, stream, resume   | DroidWindow (basic)      | Full agent viewer               | P0       |
| `codex`        | run, stream, sessions | None                     | Code execution viewer           | P1       |

### Category: Productivity

| Router    | Procedures         | Current UI     | Gap             | Priority |
| --------- | ------------------ | -------------- | --------------- | -------- |
| `note`    | CRUD, search       | NoteWindow     | None            | -        |
| `remind`  | CRUD, schedule     | ReminderWindow | None            | -        |
| `todo`    | CRUD, complete     | TodoWindow     | None            | -        |
| `timer`   | CRUD, start/stop   | None           | Timer app       | P2       |
| `book`    | CRUD (bookmarks)   | None           | Bookmarks app   | P2       |
| `project` | detect, link, list | None           | Project manager | P1       |

### Category: System/Admin

| Router       | Procedures                     | Current UI               | Gap                       | Priority |
| ------------ | ------------------------------ | ------------------------ | ------------------------- | -------- |
| `admin`      | voiceStats, perfStats, restart | None                     | Admin/System monitor      | P0       |
| `profile`    | get, update                    | SettingsWindow (basic)   | Enhanced profile editor   | P2       |
| `preference` | CRUD, feedback, inference      | SettingsWindow (partial) | Preference learning UI    | P2       |
| `privacy`    | facts, events, delete          | PrivacyControls (basic)  | Full privacy dashboard    | P1       |
| `fs`         | read, write                    | None                     | File browser              | P0       |
| `terminal`   | createSession, write, resize   | TerminalWindow           | Enhanced (tabs, profiles) | P2       |
| `agentfs`    | workspace CRUD                 | None                     | AgentFS viewer            | P1       |
| `user`       | get, events                    | UserMenu (basic)         | User dashboard            | P3       |

### Category: Integrations

| Router   | Procedures                      | Current UI                       | Gap                      | Priority |
| -------- | ------------------------------- | -------------------------------- | ------------------------ | -------- |
| `linear` | OAuth, status, updateIssue      | IntegrationsWindow (config only) | Linear issue viewer      | P1       |
| `home`   | list, status, set               | HomePane (exists in @alfred/ui)  | Smart home control panel | P2       |
| `deploy` | preview, promote, probe, health | None                             | Deployment manager       | P0       |
| `token`  | issue, revoke, list             | None                             | Token/API key manager    | P2       |

### Category: Development/Workflows

| Router        | Procedures                   | Current UI                         | Gap                        | Priority |
| ------------- | ---------------------------- | ---------------------------------- | -------------------------- | -------- |
| `workflow`    | create, run, stream, suspend | WorkflowWindow, WorkflowListWindow | Enhanced n8n-style builder | P0       |
| `plan`        | generate, validate           | WorkflowCanvas (basic)             | Full plan editor           | P1       |
| `eval`        | define, dataset, run, scores | None                               | Eval/Testing dashboard     | P1       |
| `tune`        | start (fine-tuning)          | None                               | Fine-tuning UI             | P3       |
| `codexIntent` | classify, suggest            | None                               | Intent debugging           | P3       |

### Category: Knowledge/Graph

| Router      | Procedures               | Current UI              | Gap                         | Priority |
| ----------- | ------------------------ | ----------------------- | --------------------------- | -------- |
| `graph`     | query, connect, watch    | KnowledgeWindow (basic) | Full graph explorer         | P1       |
| `knowledge` | extract, search, explain | ConceptWindow (basic)   | Knowledge extraction viewer | P1       |
| `visual`    | config, presets, export  | Settings (partial)      | Visual config panel         | P2       |

### Category: Utility

| Router        | Procedures    | Current UI | Gap           | Priority |
| ------------- | ------------- | ---------- | ------------- | -------- |
| `jwks`        | keys (public) | None       | Not needed    | -        |
| `healthCheck` | query         | None       | System status | P3       |

---

## Required New Desktop Apps

### Priority 0 (Critical - Ship First)

#### 1. **Task Manager** (`taskmanager`)

**Backend sources:** `admin`, `workflow`, `droid`, `codex`

Features:

- Process list (running agents, workflows, codex sessions)
- CPU/memory/API usage charts
- Kill/pause/resume controls
- History tab (recent executions)
- Network tab (active connections)

Existing resources:

- `admin.getVoiceStats()`, `admin.getPerformanceStats()`
- `workflow.list()`, `workflow.events()`
- `droid.stream()`, `codex.sessions()`

#### 2. **Deployment Manager** (`deploy`)

**Backend source:** `deploy`

Features:

- List all deployments (preview/production)
- Create preview from context
- Promote to production (biometric gate)
- Health status streaming
- Container logs viewer
- Remove deployment

Existing resources:

- Full `deploy` router coverage needed
- `PromoteDialog` exists but not integrated

#### 3. **File Browser** (`files`)

**Backend source:** `fs`

Features:

- Tree view sidebar
- List/grid file view
- Read/write files
- Breadcrumb navigation
- Quick Look preview
- Drag to desktop icons

Existing resources:

- `fs.read()`, `fs.write()` - basic but functional

#### 4. **Code Editor** (`code`)

**Backend sources:** `fs`, `codex`

Features:

- Monaco editor integration
- Multi-tab editing
- AI inline completions
- Syntax highlighting
- Git diff view
- Command palette (⌘⇧P)

Existing resources:

- `@monaco-editor/react` already in dependencies
- `fs.read()`, `fs.write()` for persistence

#### 5. **Workflow Builder** (`workflow-builder`)

**Backend sources:** `workflow`, `plan`

Features:

- n8n-style node canvas
- Node palette (triggers, actions, agents, logic)
- Execution visualization
- Debug panel (events, variables)
- Save/load workflows
- Template library

Existing resources:

- `WorkflowCanvas` exists but basic
- `plan.generate()`, `workflow.create()`

### Priority 1 (Important)

#### 6. **Agent Viewer** (`agent`)

**Backend sources:** `droid`, `codex`, `cognitive`

Features:

- Agent state visualization
- Tool call history
- Execution logs
- Cognitive state display
- Policy decision log
- Resource usage

Existing resources:

- `DroidWindow` exists but basic
- `cognitive.state()`, `droid.stream()`

#### 7. **Eval Dashboard** (`eval`)

**Backend source:** `eval`

Features:

- Define evaluations
- Manage datasets
- Run evaluations
- Score visualization
- Comparison charts
- Export results

Existing resources:

- Full `eval` router - no UI

#### 8. **Linear Viewer** (`linear`)

**Backend source:** `linear`

Features:

- Connected workspace display
- Issue list/search
- Issue detail view
- Status updates
- Linked workflows

Existing resources:

- `IntegrationsWindow` has OAuth flow
- Need issue CRUD UI

#### 9. **Privacy Dashboard** (`privacy-dashboard`)

**Backend source:** `privacy`, `preference`

Features:

- Learned facts browser
- Delete/modify facts
- Event log viewer
- Data export
- "Forget me" controls

Existing resources:

- `PrivacyControls` exists but basic
- `privacy.facts()`, `privacy.deleteFact()`

#### 10. **Project Manager** (`project`)

**Backend source:** `project`, `linear`

Features:

- Project list
- Workspace detection
- Linear linking
- Project settings
- Recent files per project

Existing resources:

- `project.detect()`, `project.linkLinear()`

#### 11. **AgentFS Viewer** (`agentfs`)

**Backend source:** `agentfs`

Features:

- Workspace list
- File audit trail
- Checkpoint browser
- KV store viewer
- Container status

Existing resources:

- Full `agentfs` router

### Priority 2 (Nice to Have)

#### 12. **Timer App** (`timer`)

**Backend source:** `timer`

Features:

- Active timers list
- Start/pause/stop
- History
- Pomodoro mode

Existing resources:

- `TimerPane` exists in `@alfred/ui`

#### 13. **Bookmarks** (`bookmark`)

**Backend source:** `book`

Features:

- Bookmark list
- Tag filtering
- Preview cards
- Import/export

Existing resources:

- `BookPane` exists in `@alfred/ui`

#### 14. **Smart Home** (`home`)

**Backend source:** `home`

Features:

- Device grid
- Toggle controls
- Status display
- Automation triggers

Existing resources:

- `HomePane` exists in `@alfred/ui`
- Router is TODO stub

#### 15. **Voice Settings** (`voice-settings`)

**Backend source:** `voice`

Features:

- Model selection
- Voice preview
- Download models
- Session management
- Audio settings

Existing resources:

- `voice.listVoices()`, `voice.previewVoice()`

#### 16. **Visual Config** (`visual-config`)

**Backend source:** `visual`

Features:

- Preset selection
- Parameter sliders
- Live preview
- Import/export themes

Existing resources:

- `visual-config` components exist
- Full `visual` router

### Priority 3 (Future)

#### 17. **Fine-Tuning UI** (`tune`)

**Backend source:** `tune`

#### 18. **Intent Debugger** (`codex-intent`)

**Backend source:** `codexIntent`

#### 19. **Token Manager** (`tokens`)

**Backend source:** `token`

#### 20. **User Dashboard** (`user-dashboard`)

**Backend source:** `user`

---

## Backend Packages Without Router (Potential Additions)

| Package             | Purpose           | Needs UI? | Notes                |
| ------------------- | ----------------- | --------- | -------------------- |
| `@alfred/cognitive` | State machine     | Yes       | Via cognitive router |
| `@alfred/cortex`    | GPU visualization | Yes       | Visual config        |
| `@alfred/embed`     | Embeddings        | No        | Internal             |
| `@alfred/graph`     | Graph queries     | Yes       | Via graph router     |
| `@alfred/history`   | Message history   | No        | Via assistant        |
| `@alfred/knowledge` | Hypergraph        | Yes       | Via knowledge router |
| `@alfred/learning`  | Self-supervision  | Future    | Learning dashboard   |
| `@alfred/metrics`   | Prometheus        | Yes       | System monitor       |
| `@alfred/plan`      | Plan generation   | Yes       | Via plan router      |
| `@alfred/policy`    | Policy engine     | Partial   | Admin view           |
| `@alfred/protocol`  | ACP/events        | No        | Internal             |
| `@alfred/rag`       | Vector search     | No        | Via graph            |
| `@alfred/runtime`   | Workflow runtime  | Partial   | Task manager         |
| `@alfred/tui`       | Terminal UI       | No        | CLI only             |
| `@alfred/voice`     | Voice services    | Yes       | Voice settings       |

---

## Schema/DB Coverage

| Schema        | Covered By UI              | Gap                     |
| ------------- | -------------------------- | ----------------------- |
| assistant     | ChatWindow                 | None                    |
| auth          | Sign-in flows              | None                    |
| clarification | None                       | Clarification requests  |
| codex         | None                       | Codex session viewer    |
| cognitive     | HUD partial                | Full dashboard          |
| conversation  | ChatWindow                 | None                    |
| deploy        | None                       | Deploy manager          |
| eval          | None                       | Eval dashboard          |
| graph         | KnowledgeWindow partial    | Full graph explorer     |
| linear        | IntegrationsWindow partial | Issue viewer            |
| pattern       | None                       | Pattern learning viewer |
| plan          | WorkflowCanvas partial     | Full plan editor        |
| policy        | None                       | Policy audit log        |
| project       | None                       | Project manager         |
| rag           | None                       | RAG debug viewer        |
| todo          | TodoWindow                 | None                    |
| user          | Settings partial           | Full profile            |
| workflow      | WorkflowWindow             | Enhanced builder        |

---

## Recommended Implementation Order

### Phase 1: Core Desktop (Week 1-2)

1. Window chrome enhancement
2. Taskbar + MenuBar
3. Desktop icons
4. File Browser (basic)
5. Code Editor (basic)

### Phase 2: System Apps (Week 3-4)

6. Task Manager
7. Deployment Manager
8. Enhanced Terminal (tabs)

### Phase 3: Development (Week 5-6)

9. Workflow Builder (n8n-style)
10. Agent Viewer
11. Eval Dashboard

### Phase 4: Integrations (Week 7-8)

12. Linear Viewer
13. Project Manager
14. AgentFS Viewer

### Phase 5: Knowledge (Week 9-10)

15. Full Graph Explorer
16. Privacy Dashboard
17. Voice Settings

### Phase 6: Polish (Week 11-12)

18. Timer, Bookmarks, Smart Home
19. Visual Config panel
20. User Dashboard

---

## Summary Table

| App Name          | Router(s)               | Priority | Exists? | Effort |
| ----------------- | ----------------------- | -------- | ------- | ------ |
| Task Manager      | admin, workflow, droid  | P0       | No      | Large  |
| File Browser      | fs                      | P0       | No      | Medium |
| Code Editor       | fs, codex               | P0       | No      | Large  |
| Workflow Builder  | workflow, plan          | P0       | Partial | Large  |
| Deploy Manager    | deploy                  | P0       | No      | Medium |
| Agent Viewer      | droid, codex, cognitive | P1       | Partial | Medium |
| Eval Dashboard    | eval                    | P1       | No      | Medium |
| Linear Viewer     | linear                  | P1       | Partial | Small  |
| Privacy Dashboard | privacy, preference     | P1       | Partial | Medium |
| Project Manager   | project, linear         | P1       | No      | Medium |
| AgentFS Viewer    | agentfs                 | P1       | No      | Medium |
| Graph Explorer    | graph, knowledge        | P1       | Partial | Large  |
| Timer             | timer                   | P2       | No      | Small  |
| Bookmarks         | book                    | P2       | No      | Small  |
| Smart Home        | home                    | P2       | No      | Medium |
| Voice Settings    | voice                   | P2       | Partial | Small  |
| Visual Config     | visual                  | P2       | Partial | Small  |

---

## Dependencies Between Apps

```
┌─────────────────────┐
│   Window Chrome     │
│   (Foundation)      │
└─────────┬───────────┘
          │
    ┌─────┴─────┐
    ▼           ▼
┌───────┐   ┌───────┐
│ File  │   │ Code  │
│Browser│──▶│Editor │
└───────┘   └───┬───┘
                │
    ┌───────────┼───────────┐
    ▼           ▼           ▼
┌───────┐   ┌───────┐   ┌───────┐
│Workflow│   │Agent  │   │ Task  │
│Builder │◀──│Viewer │──▶│Manager│
└───────┘   └───────┘   └───────┘
                │
    ┌───────────┼───────────┐
    ▼           ▼           ▼
┌───────┐   ┌───────┐   ┌───────┐
│Deploy │   │ Eval  │   │ Graph │
│Manager│   │Dashbd │   │Explorer│
└───────┘   └───────┘   └───────┘
```

---

## Conclusion

**35% of backend capabilities have no frontend coverage.** The highest priority gaps are:

1. **Task Manager** - Critical for monitoring agents/workflows
2. **File Browser** - Foundation for code editing
3. **Code Editor** - Core development experience
4. **Workflow Builder** - n8n-style visual programming
5. **Deploy Manager** - Production deployment lifecycle

These 5 apps + desktop chrome enhancements constitute the minimum viable desktop environment.
