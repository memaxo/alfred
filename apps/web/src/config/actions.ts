import type { LucideIcon } from "lucide-react";
import {
  Activity,
  Copy,
  EyeOff,
  Maximize2,
  MessageSquare,
  Pin,
  RotateCw,
  Trash2,
  Zap,
} from "lucide-react";
import type { ArtifactType } from "@/store/mindscape";

export type ContextActionId =
  | "delete"
  | "focus"
  | "pin"
  | "duplicate"
  | "retry"
  | "view-logs"
  | "summarize"
  | "clear-history"
  | "hide"
  | "simulate-activation"
  | "spawn-starfield";

export type ContextAction = {
  id: ContextActionId;
  label: string;
  icon: LucideIcon;
  validNodeTypes: ArtifactType[] | "all";
  shortcut?: string;
  variant?: "default" | "destructive";
  aliases?: string[];
};

export const CONTEXT_ACTIONS: ContextAction[] = [
  // Global Actions
  {
    id: "focus",
    label: "Focus Node",
    icon: Maximize2,
    validNodeTypes: "all",
    shortcut: "F",
    aliases: ["zoom", "expand", "view", "open"],
  },
  {
    id: "pin",
    label: "Pin Node",
    icon: Pin,
    validNodeTypes: "all",
    shortcut: "P",
    aliases: ["save", "keep", "sticky", "lock"],
  },
  {
    id: "delete",
    label: "Delete Node",
    icon: Trash2,
    validNodeTypes: "all",
    shortcut: "⌫",
    variant: "destructive",
    aliases: ["remove", "destroy", "trash", "discard"],
  },

  // Workflow Actions
  {
    id: "retry",
    label: "Retry Workflow",
    icon: RotateCw,
    validNodeTypes: ["workflow"],
    shortcut: "R",
    aliases: ["rerun", "restart", "replay", "again"],
  },
  {
    id: "view-logs",
    label: "View Logs",
    icon: Activity,
    validNodeTypes: ["workflow"],
    aliases: ["debug", "history", "events", "trace"],
  },

  // Note Actions
  {
    id: "duplicate",
    label: "Duplicate Note",
    icon: Copy,
    validNodeTypes: ["note"],
    shortcut: "D",
    aliases: ["clone", "copy", "replicate"],
  },

  // Chat Actions
  {
    id: "clear-history",
    label: "Clear History",
    icon: MessageSquare,
    validNodeTypes: ["chat"],
    aliases: ["reset", "wipe", "empty", "new session"],
  },

  // Privacy/System
  {
    id: "hide",
    label: "Hide from Graph",
    icon: EyeOff,
    validNodeTypes: ["knowledge", "artifact"],
    aliases: ["dismiss", "invisible", "cloak"],
  },

  // Debug/Simulate
  {
    id: "simulate-activation",
    label: "Simulate Activation",
    icon: Zap,
    validNodeTypes: "all",
    aliases: ["glow", "trigger", "path", "visualize"],
  },
  
  // Stress Test
  {
    id: "spawn-starfield",
    label: "Spawn Starfield (1000 Nodes)",
    icon: Activity,
    validNodeTypes: "all",
    aliases: ["stress test", "benchmark", "load test", "starfield"],
  },
];

export function getActionsForNode(type: ArtifactType): ContextAction[] {
  return CONTEXT_ACTIONS.filter(
    (action) =>
      action.validNodeTypes === "all" || action.validNodeTypes.includes(type)
  );
}
