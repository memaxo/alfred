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
  | "hide";

export type ContextAction = {
  id: ContextActionId;
  label: string;
  icon: LucideIcon;
  validNodeTypes: ArtifactType[] | "all";
  shortcut?: string;
  variant?: "default" | "destructive";
};

export const CONTEXT_ACTIONS: ContextAction[] = [
  // Global Actions
  {
    id: "focus",
    label: "Focus Node",
    icon: Maximize2,
    validNodeTypes: "all",
    shortcut: "F",
  },
  {
    id: "pin",
    label: "Pin Node",
    icon: Pin,
    validNodeTypes: "all",
    shortcut: "P",
  },
  {
    id: "delete",
    label: "Delete Node",
    icon: Trash2,
    validNodeTypes: "all",
    shortcut: "⌫",
    variant: "destructive",
  },

  // Workflow Actions
  {
    id: "retry",
    label: "Retry Workflow",
    icon: RotateCw,
    validNodeTypes: ["workflow"],
    shortcut: "R",
  },
  {
    id: "view-logs",
    label: "View Logs",
    icon: Activity,
    validNodeTypes: ["workflow"],
  },

  // Note Actions
  {
    id: "duplicate",
    label: "Duplicate Note",
    icon: Copy,
    validNodeTypes: ["note"],
    shortcut: "D",
  },

  // Chat Actions
  {
    id: "clear-history",
    label: "Clear History",
    icon: MessageSquare,
    validNodeTypes: ["chat"],
  },

  // Privacy/System
  {
    id: "hide",
    label: "Hide from Graph",
    icon: EyeOff,
    validNodeTypes: ["knowledge", "artifact"],
  },
];

export function getActionsForNode(type: ArtifactType): ContextAction[] {
  return CONTEXT_ACTIONS.filter(
    (action) =>
      action.validNodeTypes === "all" || action.validNodeTypes.includes(type)
  );
}
