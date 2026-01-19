/**
 * Component Manifest
 *
 * Maps registry components to Alfred's single-word naming convention.
 * Follows .ruler/01-naming-conventions.md guidelines.
 */

export const componentRegistry = {
  // Phase 1: AI Chat UI

  // Core Conversation Components (AI SDK Elements)
  connect: "ai-sdk.dev/elements/components/connection",
  ctx: "ai-sdk.dev/elements/components/context",
  actions: "ai-sdk.dev/elements/components/actions",
  think: "ai-sdk.dev/elements/components/reasoning",
  load: "ai-sdk.dev/elements/components/loader",
  plan: "ai-sdk.dev/elements/components/plan",
  tool: "ai-sdk.dev/elements/components/tool",
  task: "ai-sdk.dev/elements/components/task",
  queue: "ai-sdk.dev/elements/components/queue",
  confirm: "ai-sdk.dev/elements/components/confirmation",
  cite: "ai-sdk.dev/elements/components/inline-citation",
  branch: "ai-sdk.dev/elements/components/branch",
  thought: "ai-sdk.dev/elements/components/chain-of-thought",
  code: "ai-sdk.dev/elements/components/code-block",
  controls: "ai-sdk.dev/elements/components/controls",

  // Voice & Audio Components (ElevenLabs UI)
  audio: "ui.elevenlabs.io/docs/components/audio-player",
  viz: "ui.elevenlabs.io/docs/components/bar-visualizer",
  chat: "ui.elevenlabs.io/docs/components/conversation",
  chatbar: "ui.elevenlabs.io/docs/components/conversation-bar",
  voice: "ui.elevenlabs.io/docs/components/voice-picker",
  orb: "ui.elevenlabs.io/docs/components/orb",
  wave: "ui.elevenlabs.io/docs/components/live-waveform",
  response: "ui.elevenlabs.io/docs/components/response",
  mic: "ui.elevenlabs.io/docs/components/mic-selector",
  msg: "ui.elevenlabs.io/docs/components/message",
  voiceBtn: "ui.elevenlabs.io/docs/components/voice-button",

  // Canvas & Preview Components (AI SDK Elements)
  preview: "ai-sdk.dev/elements/components/web-preview",
  node: "ai-sdk.dev/elements/components/node",
  artifact: "ai-sdk.dev/elements/components/artifact",
  panel: "ai-sdk.dev/elements/components/panel",
  toolbar: "ai-sdk.dev/elements/components/toolbar",
  canvas: "ai-sdk.dev/elements/components/canvas",
  edge: "ai-sdk.dev/elements/components/edge",

  // Loading & Animation
  loading: "kokonutui.com/docs/components/ai-loading",
  list: "magicui.design/docs/components/animated-list",

  // Phase 2: Data Visualization

  // Progress & Metrics
  number: "motion-primitives.com/docs/sliding-number",
  chart: "ui.spectrumhq.in/docs/animatedchart",
  matrix: "ui.elevenlabs.io/docs/components/matrix",

  // Layout Components
  grid: "magicui.design/docs/components/bento-grid",
  dock: "magicui.design/docs/components/dock",
  term: "magicui.design/docs/components/terminal",

  // Phase 3: Forms & Input

  // Form Fields (Wandry UI)
  text: "ui.wandry.com.ua/docs/components/text-field",
  select: "ui.wandry.com.ua/docs/components/select-field",
  date: "ui.wandry.com.ua/docs/components/datepicker-field",
  daterange: "ui.wandry.com.ua/docs/components/datepicker-range-field",
  checkbox: "ui.wandry.com.ua/docs/components/checkbox-field",
  choice: "ui.wandry.com.ua/docs/components/choisebox-field",
  autocomplete: "ui.wandry.com.ua/docs/components/async-autocomplete-field",
  dropdown: "coss.com/ui/docs/components/select",

  // Profile & User
  profile: "kokonutui.com/docs/components/profile-dropdown",
} as const;

export type ComponentName = keyof typeof componentRegistry;

/**
 * Status tracking for component installation
 *
 * - pending: No local implementation exists yet
 * - installed: Local implementation exists but is not yet used by a real product surface
 * - integrated: Implemented and used by at least one real (non-demo) product surface
 */
export const componentStatus: Record<
  ComponentName,
  "pending" | "installed" | "integrated"
> = {
  // Phase 1: AI Chat UI
  connect: "integrated",
  ctx: "integrated",
  actions: "integrated",
  think: "integrated",
  load: "integrated",
  plan: "integrated",
  tool: "integrated",
  task: "integrated",
  queue: "integrated",
  confirm: "integrated",
  cite: "integrated",
  branch: "integrated",
  thought: "integrated",
  code: "integrated",
  controls: "integrated",

  // Voice & Audio (ElevenLabs)
  audio: "integrated",
  viz: "integrated",
  chat: "integrated",
  chatbar: "integrated",
  voice: "integrated",
  orb: "integrated",
  wave: "integrated",
  response: "integrated",
  mic: "integrated",
  msg: "integrated",
  voiceBtn: "integrated",

  // Canvas & Preview
  preview: "integrated",
  node: "integrated",
  artifact: "integrated",
  panel: "integrated",
  toolbar: "integrated",
  canvas: "integrated",
  edge: "integrated",
  loading: "integrated",
  list: "integrated",

  // Phase 2: Data Visualization
  number: "integrated",
  chart: "integrated",
  matrix: "integrated",
  grid: "integrated",
  dock: "integrated",
  term: "integrated",

  // Phase 3: Forms & Input
  text: "integrated",
  select: "integrated",
  date: "integrated",
  daterange: "integrated",
  checkbox: "integrated",
  choice: "integrated",
  autocomplete: "integrated",
  dropdown: "integrated",
  profile: "integrated",
};

export type ComponentUse = {
  /**
   * File path relative to `apps/web/`.
   *
   * This must point at a non-demo product surface module (Decision B).
   */
  file: string;
  /**
   * A stable "proof" substring that must exist in the target file.
   *
   * Prefer matching import lines (e.g. `from "./code"` or `from "@/components/code"`)
   * so drift is caught mechanically.
   */
  match: string;
};

/**
 * Contract gate for `componentStatus[name] === "integrated"`.
 *
 * Integrated (Decision B) means:
 * - Local implementation exists, AND
 * - The component is used in at least one real (non-demo) product surface.
 *
 * Demo surfaces are explicitly excluded (e.g. the Components window and the
 * `/components` inspection routes).
 */
export const componentUsage: Record<ComponentName, readonly ComponentUse[]> = {
  // Phase 1: AI Chat UI
  connect: [
    { file: "src/components/chat-container.tsx", match: 'from "./connect"' },
  ],
  ctx: [
    {
      file: "src/components/shared/context-lens.tsx",
      match: 'from "@/components/ctx"',
    },
  ],
  actions: [
    { file: "src/components/chat-container.tsx", match: 'from "./actions"' },
  ],
  think: [{ file: "src/components/chat-render.tsx", match: 'from "./think"' }],
  load: [{ file: "src/components/chat-container.tsx", match: 'from "./load"' }],
  plan: [{ file: "src/components/chat-render.tsx", match: 'from "./plan"' }],
  tool: [{ file: "src/components/chat-render.tsx", match: 'from "./tool"' }],
  task: [{ file: "src/components/chat-render.tsx", match: 'from "./task"' }],
  queue: [
    { file: "src/components/chat-container.tsx", match: 'from "./queue"' },
  ],
  confirm: [
    { file: "src/components/chat-render.tsx", match: 'from "./confirm"' },
  ],
  cite: [{ file: "src/components/chat-render.tsx", match: 'from "./cite"' }],
  branch: [
    { file: "src/components/chat-render.tsx", match: 'from "./branch"' },
  ],
  thought: [
    { file: "src/components/chat-render.tsx", match: 'from "./thought"' },
  ],
  code: [{ file: "src/components/chat-render.tsx", match: 'from "./code"' }],
  controls: [
    { file: "src/components/chat-container.tsx", match: 'from "./controls"' },
  ],

  // Voice & Audio (ElevenLabs)
  audio: [
    {
      file: "src/routes/_protected/drive.tsx",
      match: 'from "@/components/audio"',
    },
  ],
  viz: [
    {
      file: "src/routes/_protected/voice-s2s.tsx",
      match: 'from "@/components/viz"',
    },
  ],
  chat: [
    {
      file: "src/routes/_protected/voice-s2s.tsx",
      match: 'from "@/components/ui/conversation"',
    },
  ],
  chatbar: [
    {
      file: "src/routes/_protected/voice-s2s.tsx",
      match: 'from "@/components/ui/conversation-bar"',
    },
  ],
  voice: [
    {
      file: "src/routes/_protected/voice-s2s.tsx",
      match: 'from "@/components/voice"',
    },
  ],
  orb: [{ file: "src/components/drive-mode.tsx", match: 'from "./orb"' }],
  wave: [
    {
      file: "src/components/onboarding/voice-step.tsx",
      match: 'from "@/components/ui/live-waveform"',
    },
  ],
  response: [
    { file: "src/components/chat-render.tsx", match: 'from "./response"' },
  ],
  mic: [
    {
      file: "src/routes/_protected/drive.tsx",
      match: 'from "@/components/mic"',
    },
  ],
  msg: [
    {
      file: "src/routes/_protected/voice-s2s.tsx",
      match: 'from "@/components/ui/message"',
    },
  ],
  voiceBtn: [
    { file: "src/components/drive-mode.tsx", match: 'from "./voice-btn"' },
  ],

  // Canvas & Preview
  preview: [
    { file: "src/components/chat-render.tsx", match: 'from "./preview"' },
  ],
  node: [{ file: "src/components/chat-render.tsx", match: 'from "./node"' }],
  artifact: [
    { file: "src/components/chat-render.tsx", match: 'from "./artifact"' },
  ],
  panel: [{ file: "src/components/chat-render.tsx", match: 'from "./panel"' }],
  toolbar: [
    {
      file: "src/components/apps/metrics/dashboard-builder.tsx",
      match: 'from "@/components/toolbar"',
    },
  ],
  canvas: [
    { file: "src/components/chat-render.tsx", match: 'from "./canvas"' },
  ],
  edge: [{ file: "src/components/chat-render.tsx", match: 'from "./edge"' }],

  // Loading & Animation
  loading: [
    {
      file: "src/components/apps/metrics/dashboard-builder.tsx",
      match: 'from "@/components/loading"',
    },
  ],
  list: [
    {
      file: "src/components/apps/settings/index.tsx",
      match: 'from "@/components/list"',
    },
  ],

  // Phase 2: Data Visualization
  number: [
    {
      file: "src/components/apps/metrics/dashboard-builder.tsx",
      match: 'from "@/components/number"',
    },
  ],
  chart: [
    {
      file: "src/components/apps/metrics/dashboard-builder.tsx",
      match: 'from "@/components/chart"',
    },
  ],
  matrix: [
    {
      file: "src/routes/_protected/voice-s2s.tsx",
      match: 'from "@/components/ui/matrix"',
    },
  ],
  grid: [
    {
      file: "src/components/apps/metrics/dashboard-builder.tsx",
      match: 'from "@/components/grid"',
    },
  ],
  dock: [
    {
      file: "src/components/desktop/taskbar/index.tsx",
      match: 'from "@/components/dock"',
    },
  ],
  term: [
    {
      file: "src/components/windows/droid/droid-window.tsx",
      match: 'from "@/components/term"',
    },
  ],

  // Phase 3: Forms & Input
  text: [
    {
      file: "src/routes/_protected/voice-s2s.tsx",
      match: 'from "@/components/text"',
    },
  ],
  select: [
    {
      file: "src/components/windows/droid/droid-window.tsx",
      match: 'from "@/components/select"',
    },
  ],
  date: [
    {
      file: "src/components/apps/settings/index.tsx",
      match: 'from "@/components/date"',
    },
  ],
  daterange: [
    {
      file: "src/components/apps/settings/index.tsx",
      match: 'from "@/components/daterange"',
    },
  ],
  checkbox: [
    {
      file: "src/components/apps/settings/index.tsx",
      match: 'from "@/components/checkbox"',
    },
  ],
  choice: [
    {
      file: "src/components/apps/settings/index.tsx",
      match: 'from "@/components/choice"',
    },
  ],
  autocomplete: [
    {
      file: "src/components/apps/settings/sections/profile.tsx",
      match: 'from "@/components/autocomplete"',
    },
  ],
  dropdown: [
    {
      file: "src/components/profile.tsx",
      match: 'from "@/components/dropdown"',
    },
  ],
  profile: [
    { file: "src/components/user-menu.tsx", match: 'from "./profile"' },
  ],
} as const;
