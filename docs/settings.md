# settings

Owner: desktop

ALFRED’s Settings is a single, unified control center inside the Desktop UI. It consolidates personal preferences, security controls, model configuration, and system integrations into one window with a left-hand navigation sidebar.

## Quick start

```text
Open Desktop → App Launcher → Settings → pick a category in the left sidebar
```

## What “Settings” is (and isn’t)

- **Settings is**: A windowed “desktop app” for configuring ALFRED’s behavior, appearance, integrations, and credentials.
- **Settings is not**: A scattered set of web pages; categories live in one place so you can reliably find and change things.

## Core terms

- **Window**: A movable, resizable UI surface (Settings is one window).
- **Section**: A category inside Settings (Profile, Visual & Desktop, Notifications, etc.).
- **Preset**: A curated bundle of visual/performance choices for Mindscape rendering.
- **Quiet time**: Time-based suppression of non-critical notifications (snooze/vacation).
- **MCP server**: An external tool server ALFRED can connect to and call (outbound MCP).
- **Policy**: Permission rules that govern what ALFRED is allowed to do.

## Settings sections (what you can configure)

- **Profile**
  - Your display name, email, avatar URL, and timezone.
- **Devices & Sessions**
  - Review and manage active sessions and authorized devices.
- **Security**
  - **API Tokens**: Credentials used for programmatic access and integrations.
  - **Policy**: Permission controls that constrain actions and sensitive capabilities.
- **AI Models**
  - Choose which model/provider ALFRED uses for different roles (chat, planner, orchestrator, background, voice).
  - Changes are intended to take effect immediately.
- **Voice & Speech**
  - Input mode (push-to-talk, voice activity detection, continuous), VAD sensitivity, input/output devices, and a voice selection for TTS.
- **Embeddings**
  - Configure embedding behavior/models used for retrieval and memory features.
- **Visual & Desktop**
  - Choose a **quality preset** and a **color theme** for Mindscape visuals.
  - Includes a live preview (when supported) and clearly shows **Unsaved changes** until you save.
- **MCP Servers**
  - Add, enable/disable, update, and remove outbound MCP servers so ALFRED can discover and call tools.
- **Integrations**
  - Connect ALFRED to external services (varies by what you’ve enabled).
- **Notifications**
  - Toggle notification categories (agent completions, workflow events, system alerts).
  - Set **quiet time** (snooze until a date) and **vacation range** (start/end dates).
- **Keyboard**
  - Configure shortcut behavior and keyboard-related preferences.

## Saving and “unsaved changes”

- Some sections provide an explicit **Save** action (for example, Visual & Desktop).
- If a section shows an **Unsaved changes** indicator, changes are staged locally until saved.
- Other sections may apply changes immediately (for example, model selection), depending on the category.

## Troubleshooting

- **Settings won’t open**: Use the App Launcher path (`App Launcher → Settings`) to avoid shortcut conflicts.
- **Preview doesn’t load in Visual & Desktop**: Live preview requires WebGPU support; Settings still works without it.
- **Notifications don’t change**: Confirm you saved the section (if it has a Save action) and that quiet time isn’t still active.

## For developers

- **Frontend entry point**: `apps/web/src/components/apps/settings/index.tsx`
- **Section implementations**: `apps/web/src/components/apps/settings/sections/*.tsx`
- **E2E coverage (Settings visual)**:
  - `apps/web/.tests/visual-settings.e2e.spec.ts`
  - `apps/web/.tests/visual-regression.e2e.spec.ts`
