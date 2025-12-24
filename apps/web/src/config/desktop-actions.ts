import type { LucideIcon } from "lucide-react";
import {
  Activity,
  Bell,
  Bot,
  Brain,
  CheckSquare,
  Copy,
  EyeOff,
  FileText,
  Maximize2,
  MessageSquare,
  Network,
  Pin,
  RotateCw,
  Settings,
  Terminal,
  Trash2,
  Workflow,
} from "lucide-react";
import type { WindowType } from "@/store/desktop/types";

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
  | "ask";

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

export const DESKTOP_ACTIONS: DesktopAction[] = [
  // Spawn Actions (always available)
  {
    id: "spawn-chat",
    label: "New Chat",
    icon: MessageSquare,
    validWindowTypes: "none",
    shortcut: "C",
    category: "spawn",
    aliases: ["chat", "conversation", "assistant"],
  },
  {
    id: "spawn-note",
    label: "New Note",
    icon: FileText,
    validWindowTypes: "none",
    shortcut: "N",
    category: "spawn",
    aliases: ["note", "document", "text"],
  },
  {
    id: "spawn-reminder",
    label: "New Reminder",
    icon: Bell,
    validWindowTypes: "none",
    shortcut: "R",
    category: "spawn",
    aliases: ["reminder", "remind", "alarm"],
  },
  {
    id: "spawn-todo",
    label: "New Todo",
    icon: CheckSquare,
    validWindowTypes: "none",
    category: "spawn",
    aliases: ["todo", "task", "checklist"],
  },
  {
    id: "spawn-workflow",
    label: "New Workflow",
    icon: Workflow,
    validWindowTypes: "none",
    category: "spawn",
    aliases: ["workflow", "automation", "flow"],
  },
  {
    id: "spawn-terminal",
    label: "New Terminal",
    icon: Terminal,
    validWindowTypes: "none",
    shortcut: "T",
    category: "spawn",
    aliases: ["terminal", "shell", "console", "cli"],
  },
  {
    id: "spawn-droid",
    label: "New Droid",
    icon: Bot,
    validWindowTypes: "none",
    shortcut: "D",
    category: "spawn",
    aliases: ["droid", "agent", "bot", "ai"],
  },
  {
    id: "spawn-settings",
    label: "Open Settings",
    icon: Settings,
    validWindowTypes: "none",
    shortcut: ",",
    category: "spawn",
    aliases: ["settings", "preferences", "config"],
  },
  {
    id: "spawn-knowledge",
    label: "New Knowledge",
    icon: Brain,
    validWindowTypes: "none",
    category: "spawn",
    aliases: ["knowledge", "fact", "memory"],
  },

  // Window Actions (context-dependent)
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

  // Workflow Actions
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

  // Knowledge Actions
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

export function getActionsForWindow(
  type: WindowType | null
): DesktopAction[] {
  return DESKTOP_ACTIONS.filter((action) => {
    if (action.validWindowTypes === "none") {
      return true; // Spawn actions always available
    }
    if (action.validWindowTypes === "all") {
      return type !== null; // Context actions need a focused window
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
  const mapping: Record<string, WindowType> = {
    "spawn-chat": "chat",
    "spawn-note": "note",
    "spawn-reminder": "reminder",
    "spawn-todo": "todo",
    "spawn-workflow": "workflowlist",
    "spawn-terminal": "terminal",
    "spawn-droid": "droid",
    "spawn-settings": "settings",
    "spawn-knowledge": "knowledge",
  };
  return mapping[actionId] ?? null;
}
