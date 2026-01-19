export type WindowType =
  | "chat"
  | "inbox"
  | "terminal"
  | "code"
  | "codex"
  | "agents"
  | "taskmanager"
  | "docker"
  | "pr-review"
  | "agentfs"
  | "files"
  | "admin"
  | "cortex"
  | "learning"
  | "policy"
  | "tune"
  | "plan"
  | "visual-builder"
  | "metrics"
  | "rag"
  | "bookmarks"
  | "timers"
  | "knowledge"
  | "workflow"
  | "linear"
  | "concept"
  | "project"
  | "settings"
  | "components"
  | "workingset"
  | "notes"
  | "reminders"
  | "todos"
  | "droid"
  | "note"
  | "reminder"
  | "todo"
  | "workflowlist"
  | "integrations";

export type DesktopMode = "desktop" | "mindscape";

export type ViewMode = "compact" | "full" | "maximized";

export type Bounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type WindowState = "normal" | "minimized" | "maximized" | "fullscreen";

export type TileZone =
  | "left"
  | "right"
  | "top"
  | "bottom"
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right"
  | "center"
  | "full";

export type WindowData = {
  type: WindowType;
  label?: string;
  viewMode: ViewMode;
} & Record<string, unknown>;

export type WindowInstance = {
  id: string;
  type: WindowType;
  data: WindowData;
  bounds: Bounds;
  state: WindowState;
  isTiled: boolean;
  tileZone?: TileZone;
  zIndex: number;
  isFocused: boolean;
  createdAt: number;
  lastFocusedAt: number;
};
