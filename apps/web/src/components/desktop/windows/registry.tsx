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
  Box,
  Code,
  Code2,
  Database,
  FileText,
  FolderKanban,
  FolderOpen,
  GitBranch,
  GitPullRequest,
  Layers,
  LayoutDashboard,
  List,
  ListTodo,
  MessageSquare,
  Network,
  Search,
  Settings,
  Shield,
  Square,
  Terminal,
} from "lucide-react";
// Phase 2/3 apps
import {
  AdminAppWindow,
  AgentFSAppWindow,
  AgentsAppWindow,
  ChatAppWindow,
  CodeAppWindow,
  DockerAppWindow,
  FilesAppWindow,
  KnowledgeAppWindow,
  LinearAppWindow,
  MetricsAppWindow,
  PolicyAppWindow,
  PRReviewAppWindow,
  TaskManagerAppWindow,
  WorkflowAppWindow,
} from "@/components/apps";
import { CodexWindow } from "@/components/windows/codex/codex-window";
import { ConceptWindow } from "@/components/windows/concept/concept-window";
import { DroidWindow } from "@/components/windows/droid/droid-window";
import { IntegrationsWindow } from "@/components/windows/integrations/integrations-window";
import { NoteWindow } from "@/components/windows/note/note-window";
import { ProjectWindow } from "@/components/windows/project/project-window";
import { ReminderWindow } from "@/components/windows/reminder/reminder-window";
import { SettingsWindow } from "@/components/windows/settings/settings-window";
import { TerminalWindow } from "@/components/windows/terminal/terminal-window";
import { TodoWindow } from "@/components/windows/todo/todo-window";
import { WorkflowListWindow } from "@/components/windows/workflow/workflow-list-window";

import type { WindowType } from "@/store/desktop/types";

// Adapter for legacy components
export { withWindowAdapter } from "./adapter";

import type { WindowMetadata, WindowRegistryEntry } from "./types";

/**
 * Window registry mapping type to component and metadata
 */
export const windowRegistry: Record<WindowType, WindowRegistryEntry> = {
  // Tier 0: Core Experience (Legacy)
  chat: {
    type: "chat",
    component: ChatAppWindow,
    metadata: {
      label: "Chat",
      icon: MessageSquare,
      defaultSize: { width: 500, height: 600 },
      minSize: { width: 400, height: 400 },
      resizable: true,
      singleton: true,
      tier: "primary",
    },
    isLegacy: false,
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
    component: KnowledgeAppWindow,
    metadata: {
      label: "Knowledge",
      icon: Network,
      defaultSize: { width: 500, height: 400 },
      minSize: { width: 400, height: 300 },
      resizable: true,
      singleton: false,
      tier: "secondary",
    },
    isLegacy: false,
  },
  workflow: {
    type: "workflow",
    component: WorkflowAppWindow,
    metadata: {
      label: "Workflow",
      icon: GitBranch,
      defaultSize: { width: 700, height: 500 },
      minSize: { width: 500, height: 400 },
      resizable: true,
      singleton: false,
      tier: "secondary",
    },
    isLegacy: false,
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
  project: {
    type: "project",
    component: ProjectWindow,
    metadata: {
      label: "Projects",
      icon: FolderKanban,
      defaultSize: { width: 500, height: 450 },
      minSize: { width: 400, height: 350 },
      resizable: true,
      singleton: true,
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

  // Tier 0: Codex Direct UI
  codex: {
    type: "codex",
    component: CodexWindow,
    metadata: {
      label: "Codex",
      icon: Code,
      defaultSize: { width: 650, height: 550 },
      minSize: { width: 500, height: 400 },
      resizable: true,
      singleton: true,
      tier: "primary",
    },
    isLegacy: true,
  },

  // Placeholder for future windows (will be implemented as needed)
  code: {
    type: "code",
    component: CodeAppWindow,
    metadata: {
      label: "Code",
      icon: Code2,
      defaultSize: { width: 800, height: 600 },
      minSize: { width: 600, height: 400 },
      resizable: true,
      singleton: true,
      tier: "secondary",
    },
    isLegacy: false,
  },
  agents: {
    type: "agents",
    component: AgentsAppWindow,
    metadata: {
      label: "Agent Waves",
      icon: Bot,
      defaultSize: { width: 700, height: 500 },
      minSize: { width: 500, height: 400 },
      resizable: true,
      singleton: true,
      tier: "primary",
    },
    isLegacy: false,
  },
  admin: {
    type: "admin",
    component: AdminAppWindow,
    metadata: {
      label: "Admin",
      icon: Shield,
      defaultSize: { width: 700, height: 520 },
      minSize: { width: 500, height: 400 },
      resizable: true,
      singleton: true,
      tier: "tertiary",
    },
    isLegacy: false,
  },
  taskmanager: {
    type: "taskmanager",
    component: TaskManagerAppWindow,
    metadata: {
      label: "Task Manager",
      icon: List,
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
    component: DockerAppWindow,
    metadata: {
      label: "Docker",
      icon: Box,
      defaultSize: { width: 700, height: 500 },
      minSize: { width: 500, height: 400 },
      resizable: true,
      singleton: false,
      tier: "tertiary",
    },
    isLegacy: false,
  },
  "pr-review": {
    type: "pr-review",
    component: PRReviewAppWindow,
    metadata: {
      label: "PR Review",
      icon: GitPullRequest,
      defaultSize: { width: 800, height: 600 },
      minSize: { width: 600, height: 400 },
      resizable: true,
      singleton: false,
      tier: "tertiary",
    },
    isLegacy: false,
  },
  agentfs: {
    type: "agentfs",
    component: AgentFSAppWindow,
    metadata: {
      label: "AgentFS",
      icon: Database,
      defaultSize: { width: 600, height: 450 },
      minSize: { width: 400, height: 300 },
      resizable: true,
      singleton: true,
      tier: "tertiary",
    },
    isLegacy: false,
  },
  files: {
    type: "files",
    component: FilesAppWindow,
    metadata: {
      label: "Files",
      icon: FolderOpen,
      defaultSize: { width: 600, height: 450 },
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
    component: PolicyAppWindow,
    metadata: {
      label: "Policy",
      icon: Shield,
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
    component: MetricsAppWindow,
    metadata: {
      label: "Metrics",
      icon: LayoutDashboard,
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
    component: LinearAppWindow,
    metadata: {
      label: "Linear",
      icon: ListTodo,
      defaultSize: { width: 800, height: 600 },
      minSize: { width: 600, height: 400 },
      resizable: true,
      singleton: true,
      tier: "tertiary",
    },
    isLegacy: false,
  },
  notes: {
    type: "notes",
    component: NoteWindow,
    metadata: {
      label: "Notes",
      icon: FileText,
      defaultSize: { width: 600, height: 400 },
      minSize: { width: 400, height: 300 },
      resizable: true,
      singleton: false,
      tier: "tertiary",
    },
    isLegacy: true,
  },
  reminders: {
    type: "reminders",
    component: ReminderWindow,
    metadata: {
      label: "Reminders",
      icon: Bell,
      defaultSize: { width: 600, height: 400 },
      minSize: { width: 400, height: 300 },
      resizable: true,
      singleton: false,
      tier: "tertiary",
    },
    isLegacy: true,
  },
  todos: {
    type: "todos",
    component: TodoWindow,
    metadata: {
      label: "Todos",
      icon: Square,
      defaultSize: { width: 600, height: 400 },
      minSize: { width: 400, height: 300 },
      resizable: true,
      singleton: false,
      tier: "tertiary",
    },
    isLegacy: true,
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
export function getWindowIcon(type: WindowType): WindowMetadata["icon"] {
  return windowRegistry[type]?.metadata?.icon;
}
