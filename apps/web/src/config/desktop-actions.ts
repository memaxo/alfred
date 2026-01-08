import type { LucideIcon } from "lucide-react";
import {
  Activity,
  Copy,
  EyeOff,
  Maximize2,
  MessageSquare,
  Network,
  Pin,
  RotateCw,
  Trash2,
} from "lucide-react";
import { windowRegistry } from "@/components/desktop/windows/registry";
import type { WindowType } from "@/store/desktop/types.new";

export type DesktopActionId =
  | "spawn-chat"
  | "spawn-note"
  | "spawn-reminder"
  | "spawn-todo"
  | "spawn-workflow"
  | "spawn-terminal"
  | "spawn-droid"
  | "spawn-settings"
  | "spawn-knowledge"
  | "delete"
  | "focus"
  | "pin"
  | "duplicate"
  | "retry"
  | "view-logs"
  | "clear-history"
  | "hide"
  | "visualize"
  | "ask"
  | (string & {}); // Allow for dynamic spawn action IDs

export type DesktopAction = {
  id: DesktopActionId;
  label: string;
  icon: LucideIcon;
  validWindowTypes: WindowType[] | "all" | "none";
  shortcut?: string;
  variant?: "default" | "destructive";
  aliases?: string[];
  category: "spawn" | "window" | "workflow" | "knowledge";
};

// Spawn actions are auto-generated from the window registry
function generateSpawnActions(): DesktopAction[] {
  const spawnActionConfig: Partial<
    Record<WindowType, { shortcut?: string; aliases?: string[] }>
  > = {
    chat: { shortcut: "C", aliases: ["conversation", "assistant"] },
    note: { shortcut: "N", aliases: ["document", "text"] },
    reminder: { shortcut: "R", aliases: ["remind", "alarm"] },
    todo: { aliases: ["task", "checklist"] },
    workflow: { aliases: ["automation", "flow"] },
    workflowlist: { aliases: ["list", "all-workflows"] },
    terminal: { shortcut: "T", aliases: ["shell", "console", "cli"] },
    droid: { shortcut: "D", aliases: ["agent", "bot", "ai"] },
    settings: { shortcut: ",", aliases: ["preferences", "config"] },
    knowledge: { aliases: ["fact", "memory"] },
    concept: { aliases: ["search", "entity"] },
    integrations: { aliases: ["apps", "connections"] },
    code: { shortcut: "G", aliases: ["editor", "ide"] },
    agents: { aliases: ["agent", "bot", "ai-assistant"] },
    taskmanager: { aliases: ["process", "tasks", "system"] },
    docker: { aliases: ["container", "containers", "docker-container"] },
    "pr-review": { aliases: ["pr", "pull-request", "review"] },
    agentfs: { aliases: ["fs", "filesystem", "agent-fs"] },
    files: { aliases: ["file", "file-browser", "explorer"] },
    cortex: { aliases: ["cognitive", "brain", "mind"] },
    learning: { aliases: ["learn", "self-improvement", "train"] },
    policy: { aliases: ["rules", "guardrails", "safety"] },
    tune: { aliases: ["tuning", "optimize", "adjust"] },
    plan: { aliases: ["planning", "schedule", "roadmap"] },
    metrics: { aliases: ["stats", "analytics", "performance"] },
    rag: { aliases: ["retrieval", "vector", "search"] },
    linear: { aliases: ["ticket", "issue", "project"] },
    notes: { aliases: ["notes-app", "notepad"] },
    reminders: { aliases: ["alarms", "notifications", "alerts"] },
    todos: { aliases: ["tasks-app", "checklist-app"] },
  };

  return Object.keys(windowRegistry)
    .filter((type) => windowRegistry[type as WindowType]?.component !== null)
    .map((type) => {
      const windowType = type as WindowType;
      const metadata = windowRegistry[windowType].metadata;
      const config = spawnActionConfig[windowType] || {};

      return {
        id: `spawn-${windowType}` as DesktopActionId,
        label: `New ${metadata.label}`,
        icon: (metadata.icon as unknown as LucideIcon) || MessageSquare,
        validWindowTypes: "none",
        shortcut: config.shortcut,
        category: "spawn",
        aliases: config.aliases,
      };
    });
}

// Window Actions (context-dependent)
const WINDOW_ACTIONS: DesktopAction[] = [
  {
    id: "focus",
    label: "Focus Window",
    icon: Maximize2,
    validWindowTypes: "all",
    shortcut: "F",
    category: "window",
    aliases: ["zoom", "expand", "view", "open"],
  },
  {
    id: "ask",
    label: "Ask about Window",
    icon: MessageSquare,
    validWindowTypes: "all",
    shortcut: "A",
    category: "window",
    aliases: ["chat", "query", "question", "discuss"],
  },
  {
    id: "pin",
    label: "Pin Window",
    icon: Pin,
    validWindowTypes: "all",
    shortcut: "P",
    category: "window",
    aliases: ["save", "keep", "sticky", "lock"],
  },
  {
    id: "delete",
    label: "Delete Window",
    icon: Trash2,
    validWindowTypes: "all",
    shortcut: "⌫",
    variant: "destructive",
    category: "window",
    aliases: ["remove", "destroy", "trash", "discard", "close"],
  },
  {
    id: "duplicate",
    label: "Duplicate",
    icon: Copy,
    validWindowTypes: ["note"],
    category: "window",
    aliases: ["clone", "copy", "replicate"],
  },
  {
    id: "clear-history",
    label: "Clear History",
    icon: MessageSquare,
    validWindowTypes: ["chat"],
    category: "window",
    aliases: ["reset", "wipe", "empty", "new session"],
  },
  {
    id: "hide",
    label: "Hide from Graph",
    icon: EyeOff,
    validWindowTypes: ["knowledge", "concept"],
    category: "window",
    aliases: ["dismiss", "invisible", "cloak"],
  },
  {
    id: "retry",
    label: "Retry Workflow",
    icon: RotateCw,
    validWindowTypes: ["workflow"],
    category: "workflow",
    aliases: ["rerun", "restart", "replay", "again"],
  },
  {
    id: "view-logs",
    label: "View Logs",
    icon: Activity,
    validWindowTypes: ["workflow"],
    category: "workflow",
    aliases: ["debug", "history", "events", "trace"],
  },
  {
    id: "visualize",
    label: "Visualize Knowledge",
    icon: Network,
    validWindowTypes: ["note", "knowledge", "concept"],
    shortcut: "V",
    category: "knowledge",
    aliases: ["graph", "concepts", "entities", "extract"],
  },
];

export const DESKTOP_ACTIONS: DesktopAction[] = [
  ...generateSpawnActions(),
  ...WINDOW_ACTIONS,
];

export function getActionsForWindow(type: WindowType | null): DesktopAction[] {
  return DESKTOP_ACTIONS.filter((action) => {
    if (action.validWindowTypes === "none") {
      return true;
    }
    if (action.validWindowTypes === "all") {
      return type !== null;
    }
    return type !== null && action.validWindowTypes.includes(type);
  });
}

export function getSpawnActions(): DesktopAction[] {
  return DESKTOP_ACTIONS.filter((action) => action.category === "spawn");
}

export function getWindowTypeFromSpawnAction(
  actionId: DesktopActionId
): WindowType | null {
  if (!actionId.startsWith("spawn-")) {
    return null;
  }
  const windowType = actionId.slice(6) as WindowType;
  if (!windowRegistry[windowType]) {
    return null;
  }
  return windowType;
}
