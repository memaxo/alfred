/**
 * Window Component Registry - DOM-based Window System
 *
 * Registry mapping window types to their component implementations and metadata.
 * This replaces ReactFlow-based windowTypes registry.
 *
 * @see docs/execplans/desktop-type-migration.md Section 6.2
 */

import {
  Bell,
  Bot,
  FileText,
  Layers,
  List,
  MessageSquare,
  Network,
  Search,
  Settings,
  Square,
  Terminal,
  Workflow,
} from "lucide-react";
// Legacy window components (from old ReactFlow system)
import { ChatWindow } from "@/components/windows/chat/chat-window";
import { ConceptWindow } from "@/components/windows/concept/concept-window";
import { DroidWindow } from "@/components/windows/droid/droid-window";
import { IntegrationsWindow } from "@/components/windows/integrations/integrations-window";
import { KnowledgeWindow } from "@/components/windows/knowledge/knowledge-window";
import { NoteWindow } from "@/components/windows/note/note-window";
import { ReminderWindow } from "@/components/windows/reminder/reminder-window";
import { SettingsWindow } from "@/components/windows/settings/settings-window";
import { TerminalWindow } from "@/components/windows/terminal/terminal-window";
import { TodoWindow } from "@/components/windows/todo/todo-window";
import { WorkflowListWindow } from "@/components/windows/workflow/workflow-list-window";
import { WorkflowWindow } from "@/components/windows/workflow/workflow-window";
import type { WindowType } from "@/store/desktop/types.new";

// Adapter for legacy components
export { withWindowAdapter } from "./adapter";

import type { WindowRegistryEntry } from "./types";

/**
 * Window registry mapping type to component and metadata
 */
export const windowRegistry: Record<WindowType, WindowRegistryEntry> = {
  // Tier 0: Core Experience (Legacy)
  chat: {
    type: "chat",
    component: ChatWindow,
    metadata: {
      label: "Chat",
      icon: MessageSquare,
      defaultSize: { width: 500, height: 600 },
      minSize: { width: 400, height: 400 },
      resizable: true,
      singleton: true,
      tier: "primary",
    },
    isLegacy: true,
  },
  terminal: {
    type: "terminal",
    component: TerminalWindow,
    metadata: {
      label: "Terminal",
      icon: Terminal,
      defaultSize: { width: 600, height: 400 },
      minSize: { width: 400, height: 300 },
      resizable: true,
      singleton: true,
      tier: "primary",
    },
    isLegacy: true,
  },
  droid: {
    type: "droid",
    component: DroidWindow,
    metadata: {
      label: "Droid",
      icon: Bot,
      defaultSize: { width: 500, height: 500 },
      minSize: { width: 400, height: 400 },
      resizable: true,
      singleton: true,
      tier: "primary",
    },
    isLegacy: true,
  },

  // Tier 1: Knowledge & Exploration (Legacy)
  knowledge: {
    type: "knowledge",
    component: KnowledgeWindow,
    metadata: {
      label: "Knowledge",
      icon: Network,
      defaultSize: { width: 500, height: 400 },
      minSize: { width: 400, height: 300 },
      resizable: true,
      singleton: false,
      tier: "secondary",
    },
    isLegacy: true,
  },
  workflow: {
    type: "workflow",
    component: WorkflowWindow,
    metadata: {
      label: "Workflow",
      icon: Workflow,
      defaultSize: { width: 700, height: 500 },
      minSize: { width: 500, height: 400 },
      resizable: true,
      singleton: false,
      tier: "secondary",
    },
    isLegacy: true,
  },
  concept: {
    type: "concept",
    component: ConceptWindow,
    metadata: {
      label: "Concept",
      icon: Search,
      defaultSize: { width: 400, height: 300 },
      minSize: { width: 300, height: 200 },
      resizable: true,
      singleton: false,
      tier: "secondary",
    },
    isLegacy: true,
  },

  // Tier 2: Productivity & Settings (Legacy)
  settings: {
    type: "settings",
    component: SettingsWindow,
    metadata: {
      label: "Settings",
      icon: Settings,
      defaultSize: { width: 500, height: 500 },
      minSize: { width: 400, height: 400 },
      resizable: true,
      singleton: true,
      tier: "tertiary",
    },
    isLegacy: true,
  },
  note: {
    type: "note",
    component: NoteWindow,
    metadata: {
      label: "Note",
      icon: FileText,
      defaultSize: { width: 450, height: 400 },
      minSize: { width: 300, height: 300 },
      resizable: true,
      singleton: false,
      tier: "tertiary",
    },
    isLegacy: true,
  },
  reminder: {
    type: "reminder",
    component: ReminderWindow,
    metadata: {
      label: "Reminder",
      icon: Bell,
      defaultSize: { width: 400, height: 350 },
      minSize: { width: 300, height: 250 },
      resizable: true,
      singleton: false,
      tier: "tertiary",
    },
    isLegacy: true,
  },
  todo: {
    type: "todo",
    component: TodoWindow,
    metadata: {
      label: "Todo",
      icon: Square,
      defaultSize: { width: 400, height: 400 },
      minSize: { width: 300, height: 300 },
      resizable: true,
      singleton: true,
      tier: "tertiary",
    },
    isLegacy: true,
  },
  workflowlist: {
    type: "workflowlist",
    component: WorkflowListWindow,
    metadata: {
      label: "Workflows",
      icon: List,
      defaultSize: { width: 500, height: 400 },
      minSize: { width: 400, height: 300 },
      resizable: true,
      singleton: true,
      tier: "secondary",
    },
    isLegacy: true,
  },
  integrations: {
    type: "integrations",
    component: IntegrationsWindow,
    metadata: {
      label: "Integrations",
      icon: Layers,
      defaultSize: { width: 500, height: 500 },
      minSize: { width: 400, height: 400 },
      resizable: true,
      singleton: true,
      tier: "tertiary",
    },
    isLegacy: true,
  },

  // Placeholder for future windows (will be implemented as needed)
  code: {
    type: "code",
    component: null,
    metadata: {
      label: "Code",
      defaultSize: { width: 600, height: 400 },
      minSize: { width: 400, height: 300 },
      resizable: true,
      singleton: true,
      tier: "secondary",
    },
    isLegacy: false,
  },
  agents: {
    type: "agents",
    component: null,
    metadata: {
      label: "Agents",
      defaultSize: { width: 600, height: 400 },
      minSize: { width: 400, height: 300 },
      resizable: true,
      singleton: true,
      tier: "secondary",
    },
    isLegacy: false,
  },
  taskmanager: {
    type: "taskmanager",
    component: null,
    metadata: {
      label: "Task Manager",
      defaultSize: { width: 600, height: 400 },
      minSize: { width: 400, height: 300 },
      resizable: true,
      singleton: true,
      tier: "tertiary",
    },
    isLegacy: false,
  },
  docker: {
    type: "docker",
    component: null,
    metadata: {
      label: "Docker",
      defaultSize: { width: 600, height: 400 },
      minSize: { width: 400, height: 300 },
      resizable: true,
      singleton: false,
      tier: "tertiary",
    },
    isLegacy: false,
  },
  "pr-review": {
    type: "pr-review",
    component: null,
    metadata: {
      label: "PR Review",
      defaultSize: { width: 600, height: 400 },
      minSize: { width: 400, height: 300 },
      resizable: true,
      singleton: false,
      tier: "tertiary",
    },
    isLegacy: false,
  },
  agentfs: {
    type: "agentfs",
    component: null,
    metadata: {
      label: "AgentFS",
      defaultSize: { width: 600, height: 400 },
      minSize: { width: 400, height: 300 },
      resizable: true,
      singleton: true,
      tier: "tertiary",
    },
    isLegacy: false,
  },
  files: {
    type: "files",
    component: null,
    metadata: {
      label: "Files",
      defaultSize: { width: 600, height: 400 },
      minSize: { width: 400, height: 300 },
      resizable: true,
      singleton: false,
      tier: "tertiary",
    },
    isLegacy: false,
  },
  cortex: {
    type: "cortex",
    component: null,
    metadata: {
      label: "Cortex",
      defaultSize: { width: 600, height: 400 },
      minSize: { width: 400, height: 300 },
      resizable: true,
      singleton: true,
      tier: "tertiary",
    },
    isLegacy: false,
  },
  learning: {
    type: "learning",
    component: null,
    metadata: {
      label: "Learning",
      defaultSize: { width: 600, height: 400 },
      minSize: { width: 400, height: 300 },
      resizable: true,
      singleton: true,
      tier: "tertiary",
    },
    isLegacy: false,
  },
  policy: {
    type: "policy",
    component: null,
    metadata: {
      label: "Policy",
      defaultSize: { width: 600, height: 400 },
      minSize: { width: 400, height: 300 },
      resizable: true,
      singleton: true,
      tier: "tertiary",
    },
    isLegacy: false,
  },
  tune: {
    type: "tune",
    component: null,
    metadata: {
      label: "Tune",
      defaultSize: { width: 600, height: 400 },
      minSize: { width: 400, height: 300 },
      resizable: true,
      singleton: false,
      tier: "tertiary",
    },
    isLegacy: false,
  },
  plan: {
    type: "plan",
    component: null,
    metadata: {
      label: "Plan",
      defaultSize: { width: 600, height: 400 },
      minSize: { width: 400, height: 300 },
      resizable: true,
      singleton: false,
      tier: "tertiary",
    },
    isLegacy: false,
  },
  metrics: {
    type: "metrics",
    component: null,
    metadata: {
      label: "Metrics",
      defaultSize: { width: 600, height: 400 },
      minSize: { width: 400, height: 300 },
      resizable: true,
      singleton: true,
      tier: "tertiary",
    },
    isLegacy: false,
  },
  rag: {
    type: "rag",
    component: null,
    metadata: {
      label: "RAG",
      defaultSize: { width: 600, height: 400 },
      minSize: { width: 400, height: 300 },
      resizable: true,
      singleton: true,
      tier: "tertiary",
    },
    isLegacy: false,
  },
  linear: {
    type: "linear",
    component: null,
    metadata: {
      label: "Linear",
      defaultSize: { width: 600, height: 400 },
      minSize: { width: 400, height: 300 },
      resizable: true,
      singleton: true,
      tier: "tertiary",
    },
    isLegacy: false,
  },
  notes: {
    type: "notes",
    component: null,
    metadata: {
      label: "Notes",
      defaultSize: { width: 600, height: 400 },
      minSize: { width: 400, height: 300 },
      resizable: true,
      singleton: false,
      tier: "tertiary",
    },
    isLegacy: false,
  },
  reminders: {
    type: "reminders",
    component: null,
    metadata: {
      label: "Reminders",
      defaultSize: { width: 600, height: 400 },
      minSize: { width: 400, height: 300 },
      resizable: true,
      singleton: false,
      tier: "tertiary",
    },
    isLegacy: false,
  },
  todos: {
    type: "todos",
    component: null,
    metadata: {
      label: "Todos",
      defaultSize: { width: 600, height: 400 },
      minSize: { width: 400, height: 300 },
      resizable: true,
      singleton: false,
      tier: "tertiary",
    },
    isLegacy: false,
  },
};

/**
 * Get spawnable window types (excluding types without components)
 */
export function getSpawnableWindowTypes(): WindowType[] {
  return Object.keys(windowRegistry)
    .map((key) => key as WindowType)
    .filter((type) => windowRegistry[type]?.component !== null);
}

/**
 * Get window label from type
 */
export function getWindowLabel(type: WindowType): string {
  return windowRegistry[type]?.metadata?.label ?? type;
}

/**
 * Get window icon from type
 */
export function getWindowIcon(type: WindowType): React.ReactNode | undefined {
  return windowRegistry[type]?.metadata?.icon;
}
