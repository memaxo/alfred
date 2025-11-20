# Component Inventory & User Journey Gap Analysis

**Date:** 2025-01-27  
**Scope:** `apps/web/` - Frontend components and routes

## Executive Summary

The ALFRED frontend has **46 components** and **15 routes**, covering most core user journeys. However, several **critical gaps** exist for a complete user experience, particularly around **onboarding**, **workflow management**, and **mobile optimization**.

### Component Coverage: **7.5/10**
### User Journey Completeness: **6.5/10**

---

## Component Inventory

### Authentication & Onboarding Components

**✅ Existing:**
- `sign-in-form.tsx` - Email/password sign-in
- `sign-up-form.tsx` - Email/password sign-up with name
- `user-menu.tsx` - User dropdown with sign-out, token copy (dev)

**❌ Missing:**
- Password reset flow component
- Email verification component
- Passkey/biometric setup component
- Onboarding wizard (first-time user experience)
- Welcome screen/tour component

### Core Chat & Interaction Components

**✅ Existing:**
- `chat-container.tsx` - Main chat interface with agent switching
- `chat-render.tsx` - AI SDK v6 part rendering (plan, task, tool, code, cite, think)
- `actions.tsx` - Tool action visualization
- `connect.tsx` - Connection status indicator
- `controls.tsx` - Agent switcher and clear controls
- `load.tsx` - Loading indicator for active actions

**✅ Message Part Components:**
- `plan.tsx` - Plan visualization
- `task.tsx` - Task status visualization
- `tool.tsx` - Tool execution visualization
- `code.tsx` - Code block rendering
- `cite.tsx` - Citation rendering
- `think.tsx` - Reasoning steps visualization
- `thought.tsx` - Individual thought rendering

**❌ Missing:**
- Message history with infinite scroll
- Message editing/regeneration component
- Message search/filter component
- Conversation export component
- Thread management component

### Voice Components

**✅ Existing:**
- `voice-btn.tsx` - Voice button for chat
- `voice.tsx` - Voice visualization component
- `mic.tsx` - Microphone icon/indicator
- `wave.tsx` - Audio waveform visualization
- `audio.tsx` - Audio playback component
- `drive-mode.tsx` - Voice-first driving copilot interface

**❌ Missing:**
- Voice activity detection (VAD) indicator
- Voice session management UI
- Voice settings/preferences component
- Voice history/transcript component

### Management Pane Components

**✅ Existing:**
- `pane-layout.tsx` - Unified pane wrapper (used by Notes, Reminders)
- `list.tsx` - Generic list component (likely used by panes)

**Routes with Panes:**
- `/note` - Notes CRUD (uses `NotePane` from `@alfred/ui`)
- `/remind` - Reminders CRUD (uses `RemindPane` from `@alfred/ui`)
- `/todos` - Todos CRUD (custom implementation)

**❌ Missing:**
- Timer pane component (`/timer` route missing)
- Bookmarks pane component (`/book` route missing)
- Pane state persistence component
- Pane filtering/sorting component

### Settings & Configuration Components

**✅ Existing:**
- `autonomy-slider.tsx` - Autonomy level selector (read/low/medium/high)
- `privacy-controls.tsx` - Data export/forget controls

**Routes:**
- `/preferences` - Preference management (uses `AutonomySlider`)
- `/privacy` - Privacy controls (uses `PrivacyControls`)
- `/profile` - User profile management

**❌ Missing:**
- Linear connection management UI component
- Tool authorization management component
- Voice provider selection component (local vs OpenAI)
- Notification preferences component
- Theme/appearance settings component

### Workflow & Orchestration Components

**✅ Existing:**
- `orchestrator/run.tsx` - Workflow run viewer with real-time streaming
- `deploy/promote-dialog.tsx` - Deployment promotion dialog
- `artifact.tsx` - Artifact visualization
- `branch.tsx` - Git branch visualization
- `node.tsx` - Node visualization (likely for workflow graphs)
- `edge.tsx` - Edge visualization (likely for workflow graphs)
- `canvas.tsx` - Canvas component (likely for workflow visualization)
- `viz.tsx` - Visualization component

**Routes:**
- `/orchestrator/run` - Workflow execution interface
- `/deployments` - Deployment management

**❌ Missing:**
- Workflow history list component
- Workflow filtering/search component
- Workflow template library component
- Workflow performance metrics dashboard
- Workflow error analysis/debugging UI
- Biometric elevation challenge component (for suspend/resume)

### UI Primitives & Layout Components

**✅ Existing:**
- `ui/button.tsx` - Button component
- `ui/card.tsx` - Card component
- `ui/checkbox.tsx` - Checkbox component
- `ui/dropdown-menu.tsx` - Dropdown menu component
- `ui/input.tsx` - Input component
- `ui/label.tsx` - Label component
- `ui/skeleton.tsx` - Loading skeleton component
- `ui/sonner.tsx` - Toast notification component
- `header.tsx` - App header with navigation
- `loader.tsx` - Loading spinner
- `loading.tsx` - Loading state component
- `error-boundary.tsx` - Error boundary wrapper
- `route-error.tsx` - Route error component

**❌ Missing:**
- Modal/dialog component (only `promote-dialog.tsx` exists, no generic)
- Tooltip component
- Popover component
- Select/dropdown component (for forms)
- Tabs component
- Accordion component
- Progress bar component
- Badge component
- Avatar component

### Utility & Supporting Components

**✅ Existing:**
- `confirm.tsx` - Confirmation dialog
- `panel.tsx` - Panel component
- `preview.tsx` - Preview component
- `response.tsx` - Response component
- `queue.tsx` - Queue visualization
- `ctx.tsx` - Context component
- `toolbar.tsx` - Toolbar component
- `orb.tsx` - Orb visualization component
- `manifest.ts` - Component registry

---

## Route Inventory

### Public Routes

**✅ Existing:**
- `/` - Home page (API status, orchestrator link)
- `/login` - Authentication (sign-in/sign-up toggle)

**❌ Missing:**
- `/reset-password` - Password reset flow
- `/verify-email` - Email verification
- `/onboarding` - First-time user setup

### Protected Routes (Require Auth)

**✅ Existing:**
- `/dashboard` - Basic dashboard (minimal implementation)
- `/ai` - Chat interface (assistant agent)
- `/note` - Notes management
- `/remind` - Reminders management
- `/todos` - Todos management
- `/preferences` - User preferences
- `/privacy` - Privacy controls
- `/profile` - User profile
- `/orchestrator/run` - Workflow execution
- `/deployments` - Deployment management
- `/drive` - Voice-first driving mode

**❌ Missing:**
- `/timer` - Timer management (backend exists, frontend missing)
- `/book` - Bookmarks management (backend exists, frontend missing)
- `/workflows` - Workflow history/list
- `/workflows/$id` - Individual workflow view
- `/settings` - Comprehensive settings page
- `/integrations` - Third-party integrations (Linear, etc.)

### API Routes

**✅ Existing:**
- `/api/trpc/$` - tRPC endpoint
- `/api/assistant/$` - Assistant streaming endpoint
- `/api/orchestrator/$` - Orchestrator streaming endpoint
- `/api/auth/$` - Better Auth endpoint
- `/api/metrics` - Prometheus metrics
- `/api/jwks` - JWKS endpoint
- `/api/linear/webhook` - Linear webhook handler
- `/healthz` - Health check
- `/healthz/deps` - Dependency health check

---

## User Journey Mapping

### Journey 1: New User Onboarding

**Current State:** ⚠️ **Partial (3/7 stages)**

1. ✅ **Landing** - Home page (`/`) exists
2. ✅ **Sign Up** - `sign-up-form.tsx` exists
3. ❌ **Email Verification** - Missing component and route
4. ❌ **Onboarding Wizard** - Missing (first-time setup, preferences, tour)
5. ❌ **Welcome Screen** - Missing (introduction to features)
6. ✅ **First Chat** - `/ai` route exists
7. ❌ **Feature Tour** - Missing (interactive guide)

**Gaps:**
- No email verification flow
- No onboarding wizard
- No welcome/tour experience
- No first-time user guidance

### Journey 2: Daily Chat Interaction

**Current State:** ✅ **Complete (5/5 stages)**

1. ✅ **Chat Interface** - `chat-container.tsx` with streaming
2. ✅ **Message Rendering** - `chat-render.tsx` with all part types
3. ✅ **Voice Input** - `voice-btn.tsx` integrated
4. ✅ **Action Visualization** - `actions.tsx` for tool execution
5. ✅ **Error Handling** - Error boundaries and error states

**Gaps:**
- Message history with infinite scroll (mentioned in PRD as incomplete)
- Message editing/regeneration
- Thread management

### Journey 3: Workflow Execution

**Current State:** ⚠️ **Partial (4/7 stages)**

1. ✅ **Workflow Form** - `/orchestrator/run` exists
2. ✅ **Real-time Streaming** - Live workflow output
3. ✅ **Visualization** - Plan, task, tool components
4. ✅ **Deployment Management** - `/deployments` route
5. ❌ **Workflow History** - Missing list/history view
6. ❌ **Biometric Elevation** - Missing challenge UI (for suspend/resume)
7. ❌ **Error Analysis** - Missing debugging UI

**Gaps:**
- Workflow history/list page
- Biometric elevation challenge component
- Workflow error analysis UI
- Workflow performance metrics dashboard

### Journey 4: Personal Management

**Current State:** ⚠️ **Partial (3/5 stages)**

1. ✅ **Notes** - `/note` route with CRUD
2. ✅ **Reminders** - `/remind` route with CRUD
3. ✅ **Todos** - `/todos` route with CRUD
4. ❌ **Timers** - Missing (backend exists, frontend missing)
5. ❌ **Bookmarks** - Missing (backend exists, frontend missing)

**Gaps:**
- Timer management UI (`/timer` route)
- Bookmarks management UI (`/book` route)
- Unified management dashboard (all items in one view)

### Journey 5: Settings & Configuration

**Current State:** ⚠️ **Partial (4/7 stages)**

1. ✅ **Profile** - `/profile` route
2. ✅ **Preferences** - `/preferences` route with autonomy slider
3. ✅ **Privacy** - `/privacy` route with export/forget
4. ✅ **Autonomy Control** - `autonomy-slider.tsx` component
5. ❌ **Integrations** - Missing Linear connection UI
6. ❌ **Tool Authorization** - Missing management UI
7. ❌ **Voice Settings** - Missing provider selection

**Gaps:**
- Linear integration management UI
- Tool authorization management
- Voice provider selection (local vs OpenAI)
- Notification preferences
- Theme/appearance settings

### Journey 6: Voice-First Interaction

**Current State:** ✅ **Complete (3/3 stages)**

1. ✅ **Voice Capture** - `useVoiceCapture` hook
2. ✅ **Voice Synthesis** - TTS integration
3. ✅ **Drive Mode** - `/drive` route with voice-first UI

**Gaps:**
- Voice activity detection (VAD) indicator
- Voice session management UI
- Voice history/transcript component

### Journey 7: Mobile Experience

**Current State:** ⚠️ **Partial (1/5 stages)**

1. ✅ **React Native App** - `apps/native/` exists
2. ❌ **Mobile Chat** - Missing mobile-optimized chat interface
3. ❌ **Drive Mode Mobile** - Missing large controls for mobile
4. ❌ **Offline Queue** - Missing offline request queue
5. ❌ **Mobile Notifications** - Missing reminder notifications

**Gaps:**
- Mobile-optimized chat interface
- Drive mode with large touch targets
- Offline queue for requests
- Mobile notifications for reminders

---

## Critical Missing Components

### High Priority (Blocks Core Features)

1. **Timer Management UI** (`/timer` route)
   - **Impact:** Backend exists, users can't access timers
   - **Components Needed:** Timer pane, timer controls, timer list
   - **Estimated Effort:** 1-2 days

2. **Bookmarks Management UI** (`/book` route)
   - **Impact:** Backend exists, users can't access bookmarks
   - **Components Needed:** Bookmarks pane, bookmark form, bookmark list
   - **Estimated Effort:** 1-2 days

3. **Workflow History/List** (`/workflows` route)
   - **Impact:** Users can't see past workflows, only current execution
   - **Components Needed:** Workflow list, workflow card, filtering/search
   - **Estimated Effort:** 2-3 days

4. **Biometric Elevation Challenge** (for suspend/resume)
   - **Impact:** Workflow suspend/resume feature incomplete
   - **Components Needed:** Biometric challenge modal, elevation UI
   - **Estimated Effort:** 2-3 days

5. **Email Verification Flow** (`/verify-email` route)
   - **Impact:** New users can't verify email addresses
   - **Components Needed:** Verification page, resend email component
   - **Estimated Effort:** 1 day

### Medium Priority (Enhances UX)

6. **Onboarding Wizard** (`/onboarding` route)
   - **Impact:** New users lack guidance
   - **Components Needed:** Wizard steps, preference collection, tour
   - **Estimated Effort:** 3-4 days

7. **Message History with Infinite Scroll**
   - **Impact:** Long conversations become unwieldy
   - **Components Needed:** Virtualized message list, pagination
   - **Estimated Effort:** 2-3 days

8. **Linear Integration Management UI** (`/integrations` route)
   - **Impact:** Users can't manage Linear connection
   - **Components Needed:** Integration card, OAuth flow, connection status
   - **Estimated Effort:** 2-3 days

9. **Workflow Error Analysis UI**
   - **Impact:** Difficult to debug failed workflows
   - **Components Needed:** Error details panel, stack trace viewer
   - **Estimated Effort:** 2-3 days

10. **Voice Settings Component**
    - **Impact:** Users can't choose voice provider (local vs OpenAI)
    - **Components Needed:** Provider selector, voice preview
    - **Estimated Effort:** 1-2 days

### Low Priority (Nice to Have)

11. **Password Reset Flow** (`/reset-password` route)
12. **Message Editing/Regeneration**
13. **Workflow Template Library**
14. **Unified Management Dashboard**
15. **Theme/Appearance Settings**
16. **Mobile-Optimized Chat Interface**
17. **Offline Queue UI**
18. **Voice History/Transcript Component**

---

## Component Architecture Gaps

### Missing UI Primitives

**Critical:**
- Generic Modal/Dialog component (only `promote-dialog.tsx` exists)
- Tooltip component
- Select/Dropdown component (for forms)

**Nice to Have:**
- Popover component
- Tabs component
- Accordion component
- Progress bar component
- Badge component
- Avatar component

### Missing Layout Patterns

- **Split View** - For workflow visualization (plan + execution)
- **Sidebar Navigation** - For mobile/responsive layouts
- **Breadcrumbs** - For nested navigation
- **Command Palette** - For quick actions (Cmd+K)

---

## Recommendations

### Immediate Actions (This Week)

1. ✅ **Add Timer Management UI** (`/timer` route)
   - Create timer pane component
   - Add timer controls (start/pause/reset)
   - Wire to existing backend

2. ✅ **Add Bookmarks Management UI** (`/book` route)
   - Create bookmarks pane component
   - Add bookmark form
   - Wire to existing backend

3. ✅ **Create Generic Modal Component**
   - Extract from `promote-dialog.tsx`
   - Make reusable for all dialogs

### Short-Term (This Month)

4. ✅ **Add Workflow History Page** (`/workflows` route)
   - List all workflows with filtering
   - Link to individual workflow views

5. ✅ **Add Biometric Elevation UI**
   - Challenge modal component
   - Integration with suspend/resume flow

6. ✅ **Add Email Verification Flow**
   - Verification page
   - Resend email functionality

### Long-Term (Next Quarter)

7. ✅ **Build Onboarding Wizard**
   - Multi-step wizard component
   - Preference collection
   - Feature tour

8. ✅ **Add Message History with Infinite Scroll**
   - Virtualized list
   - Pagination/cursor-based loading

9. ✅ **Create Integrations Management UI**
   - Linear connection management
   - OAuth flow integration

---

## Component Reusability Analysis

### Highly Reusable Components ✅

- `pane-layout.tsx` - Used by Notes, Reminders (can extend to Timers, Bookmarks)
- `autonomy-slider.tsx` - Pure component, reusable anywhere
- `privacy-controls.tsx` - Pure component, reusable
- `chat-render.tsx` - Part rendering system, extensible

### Components Needing Refactoring ⚠️

- `orchestrator/run.tsx` - 883 lines, should be split into:
  - `orchestrator-run-form.tsx` - Form component
  - `orchestrator-run-replay.tsx` - Replay viewer
  - `orchestrator-run-stream.tsx` - Streaming component

- `promote-dialog.tsx` - Should extract generic dialog pattern

### Missing Shared Patterns ❌

- No generic form component (each route implements its own)
- No generic list component with filtering/sorting
- No generic detail view component
- No generic create/edit modal pattern

---

## Testing Coverage Gaps

### Components Without Tests

**Critical:**
- `chat-render.tsx` - Part rendering logic
- `autonomy-slider.tsx` - Settings component
- `privacy-controls.tsx` - Privacy operations
- `drive-mode.tsx` - Voice-first interface

**Medium:**
- `pane-layout.tsx` - Layout component
- `user-menu.tsx` - User actions
- `sign-in-form.tsx` - Authentication
- `sign-up-form.tsx` - Registration

**Low:**
- Visualization components (`viz.tsx`, `canvas.tsx`, etc.)
- Utility components (`confirm.tsx`, `panel.tsx`)

---

## Conclusion

The ALFRED frontend has **strong foundations** with excellent chat, voice, and workflow components. However, **critical gaps** exist in:

1. **Management Panes** - Timers and Bookmarks missing
2. **Workflow Management** - History and error analysis missing
3. **Onboarding** - No first-time user experience
4. **Settings** - Integration management missing
5. **UI Primitives** - Missing generic modal, tooltip, select components

**Priority Focus:**
1. Complete management panes (Timers, Bookmarks)
2. Add workflow history and error analysis
3. Build onboarding wizard
4. Create missing UI primitives
5. Add integration management UI

**Estimated Effort:** 2-3 weeks for critical gaps, 1-2 months for complete user journey.

