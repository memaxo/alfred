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
 */
export const componentStatus: Record<
  ComponentName,
  "pending" | "installed" | "integrated"
> = {
  // Phase 1
  connect: "pending",
  ctx: "pending",
  actions: "pending",
  think: "pending",
  load: "pending",
  plan: "pending",
  tool: "pending",
  task: "pending",
  queue: "pending",
  confirm: "pending",
  cite: "pending",
  branch: "pending",
  thought: "pending",
  code: "pending",
  controls: "pending",
  audio: "pending",
  viz: "pending",
  chat: "pending",
  chatbar: "pending",
  voice: "pending",
  orb: "pending",
  wave: "pending",
  response: "pending",
  mic: "pending",
  msg: "pending",
  voiceBtn: "pending",
  preview: "pending",
  node: "pending",
  artifact: "pending",
  panel: "pending",
  toolbar: "pending",
  canvas: "pending",
  edge: "pending",
  loading: "pending",
  list: "pending",

  // Phase 2
  number: "pending",
  chart: "pending",
  matrix: "pending",
  grid: "pending",
  dock: "pending",
  term: "pending",

  // Phase 3
  text: "pending",
  select: "pending",
  date: "pending",
  daterange: "pending",
  checkbox: "pending",
  choice: "pending",
  autocomplete: "pending",
  dropdown: "pending",
  profile: "pending",
};
