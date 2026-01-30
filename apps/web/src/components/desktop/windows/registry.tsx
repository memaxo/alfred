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
  Bookmark,
  Bot,
  Box,
  Brain,
  Clock,
  Code,
  Code2,
  Cpu,
  Database,
  FileText,
  FolderKanban,
  FolderOpen,
  GitBranch,
  GitPullRequest,
  Inbox,
  Layers,
  LayoutDashboard,
  LayoutGrid,
  List,
  ListTodo,
  MessageSquare,
  Network,
  Rocket,
  ScanLine,
  Search,
  Settings,
  Shield,
  Square,
  Target,
  Terminal,
  Wand2,
  Workflow,
} from "lucide-react";
import { type ComponentType, lazy, Suspense } from "react";

import type { WindowType } from "@/store/desktop/types";

import { AdminAppWindow } from "@/components/apps/admin";
import { AgentFSAppWindow } from "@/components/apps/agentfs";
import { AgentsAppWindow } from "@/components/apps/agents";
import { BookmarksAppWindow } from "@/components/apps/bookmarks";
import { CapabilityAppWindow } from "@/components/apps/capability";
import { ChatAppWindow } from "@/components/apps/chat";
import { ComponentsAppWindow } from "@/components/apps/components";
import { CortexAppWindow } from "@/components/apps/cortex";
import { DeployAppWindow } from "@/components/apps/deploy";
import { DockerAppWindow } from "@/components/apps/docker";
import { FilesAppWindow } from "@/components/apps/files";
import { FocusAppWindow } from "@/components/apps/focus";
import { InboxAppWindow } from "@/components/apps/inbox";
import { KnowledgeAppWindow } from "@/components/apps/knowledge";
import { LearningAppWindow } from "@/components/apps/learning";
import { LinearAppWindow } from "@/components/apps/linear";
import { MetricsAppWindow } from "@/components/apps/metrics";
import { NotesAppWindow } from "@/components/apps/notes";
import { PlanAppWindow } from "@/components/apps/plan";
import { PolicyAppWindow } from "@/components/apps/policy";
import { PRReviewAppWindow } from "@/components/apps/pr-review";
import { RagAppWindow } from "@/components/apps/rag";
import { ReviewsAppWindow } from "@/components/apps/reviews";
import { SettingsAppWindow } from "@/components/apps/settings";
import { TaskManagerAppWindow } from "@/components/apps/taskmanager";
import { TerminalAppWindow } from "@/components/apps/terminal";
import { TimersAppWindow } from "@/components/apps/timers";
import { TuneAppWindow } from "@/components/apps/tune";
import { WorkingSetAppWindow } from "@/components/apps/workingset";
import { CodexWindow } from "@/components/windows/codex/codex-window";
import { ConceptWindow } from "@/components/windows/concept/concept-window";
import { DroidWindow } from "@/components/windows/droid/droid-window";
import { IntegrationsWindow } from "@/components/windows/integrations/integrations-window";
import { NoteWindow } from "@/components/windows/note/note-window";
import { ProjectWindow } from "@/components/windows/project/project-window";
import { ReminderWindow } from "@/components/windows/reminder/reminder-window";
import { TodoWindow } from "@/components/windows/todo/todo-window";
import { VisualBuilderWindow } from "@/components/windows/visual-builder/visual-builder-window";
import { WorkflowListWindow } from "@/components/windows/workflow/workflow-list-window";
import { WorkflowWindow } from "@/components/windows/workflow/workflow-window";

// Adapter for legacy components
export { useWindowProps, withWindowAdapter } from "./adapter";

import type {
  WindowComponentProps,
  WindowMetadata,
  WindowRegistryEntry,
} from "./types";

const LazyCodeAppWindow = lazy(async () => {
  const mod = await import("@/components/apps/code");
  return {
    default: mod.CodeAppWindow as ComponentType<WindowComponentProps>,
  };
});

const CodeAppWindowLazy: ComponentType<WindowComponentProps> = (props) => (
  <Suspense fallback={null}>
    <LazyCodeAppWindow {...props} />
  </Suspense>
);

/**
 * Window registry mapping type to component and metadata
 */
export const windowRegistry: Record<string, WindowRegistryEntry> = {
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
  inbox: {
    type: "inbox",
    component: InboxAppWindow,
    metadata: {
      label: "Inbox",
      icon: Inbox,
      defaultSize: { width: 650, height: 550 },
      minSize: { width: 450, height: 350 },
      resizable: true,
      singleton: true,
      tier: "primary",
    },
    isLegacy: false,
  },
  workingset: {
    type: "workingset",
    component: WorkingSetAppWindow,
    metadata: {
      label: "Working Set",
      icon: Target,
      defaultSize: { width: 650, height: 550 },
      minSize: { width: 450, height: 350 },
      resizable: true,
      singleton: true,
      tier: "primary",
    },
    isLegacy: false,
  },
  focus: {
    type: "focus",
    component: FocusAppWindow,
    metadata: {
      label: "Focus",
      icon: Target,
      defaultSize: { width: 780, height: 560 },
      minSize: { width: 500, height: 420 },
      resizable: true,
      singleton: true,
      tier: "primary",
    },
    isLegacy: false,
  },
  terminal: {
    type: "terminal",
    component: TerminalAppWindow,
    metadata: {
      label: "Terminal",
      icon: Terminal,
      defaultSize: { width: 600, height: 400 },
      minSize: { width: 400, height: 300 },
      resizable: true,
      singleton: true,
      tier: "primary",
    },
    isLegacy: false,
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
    component: WorkflowWindow,
    metadata: {
      label: "Workflow",
      icon: GitBranch,
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
    component: SettingsAppWindow,
    metadata: {
      label: "Settings",
      icon: Settings,
      defaultSize: { width: 500, height: 500 },
      minSize: { width: 400, height: 400 },
      resizable: true,
      singleton: true,
      tier: "tertiary",
    },
    isLegacy: false,
  },
  components: {
    type: "components",
    component: ComponentsAppWindow,
    metadata: {
      label: "Components",
      icon: LayoutGrid,
      defaultSize: { width: 900, height: 650 },
      minSize: { width: 500, height: 400 },
      resizable: true,
      singleton: true,
      tier: "tertiary",
    },
    isLegacy: false,
  },
  capability: {
    type: "capability",
    component: CapabilityAppWindow,
    metadata: {
      label: "Capabilities",
      icon: Layers,
      defaultSize: { width: 900, height: 650 },
      minSize: { width: 500, height: 400 },
      resizable: true,
      singleton: true,
      tier: "tertiary",
    },
    isLegacy: false,
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
  bookmarks: {
    type: "bookmarks",
    component: BookmarksAppWindow,
    metadata: {
      label: "Bookmarks",
      icon: Bookmark,
      defaultSize: { width: 400, height: 500 },
      minSize: { width: 300, height: 300 },
      resizable: true,
      singleton: true,
      tier: "tertiary",
    },
    isLegacy: false,
  },
  timers: {
    type: "timers",
    component: TimersAppWindow,
    metadata: {
      label: "Timers",
      icon: Clock,
      defaultSize: { width: 300, height: 400 },
      minSize: { width: 250, height: 250 },
      resizable: true,
      singleton: true,
      tier: "tertiary",
    },
    isLegacy: false,
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
    component: CodeAppWindowLazy,
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
  deploy: {
    type: "deploy",
    component: DeployAppWindow,
    metadata: {
      label: "Deploy",
      icon: Rocket,
      defaultSize: { width: 800, height: 600 },
      minSize: { width: 600, height: 450 },
      resizable: true,
      singleton: true,
      tier: "secondary",
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
  reviews: {
    type: "reviews",
    component: ReviewsAppWindow,
    metadata: {
      label: "Reviews",
      icon: ScanLine,
      defaultSize: { width: 900, height: 650 },
      minSize: { width: 700, height: 500 },
      resizable: true,
      singleton: true,
      tier: "secondary",
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
    component: CortexAppWindow,
    metadata: {
      label: "Cortex",
      icon: Cpu,
      defaultSize: { width: 900, height: 600 },
      minSize: { width: 600, height: 400 },
      resizable: true,
      singleton: true,
      tier: "tertiary",
    },
    isLegacy: false,
  },
  learning: {
    type: "learning",
    component: LearningAppWindow,
    metadata: {
      label: "Learning",
      icon: Brain,
      defaultSize: { width: 700, height: 500 },
      minSize: { width: 500, height: 400 },
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
    component: TuneAppWindow,
    metadata: {
      label: "Tune",
      icon: Wand2,
      defaultSize: { width: 800, height: 600 },
      minSize: { width: 600, height: 400 },
      resizable: true,
      singleton: false,
      tier: "tertiary",
    },
    isLegacy: false,
  },
  plan: {
    type: "plan",
    component: PlanAppWindow,
    metadata: {
      label: "Plan",
      icon: LayoutGrid,
      defaultSize: { width: 900, height: 600 },
      minSize: { width: 600, height: 400 },
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
    component: RagAppWindow,
    metadata: {
      label: "RAG",
      icon: Network,
      defaultSize: { width: 900, height: 600 },
      minSize: { width: 600, height: 400 },
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
    component: NotesAppWindow,
    metadata: {
      label: "Notes",
      icon: FileText,
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
  "visual-builder": {
    type: "visual-builder",
    component: VisualBuilderWindow,
    metadata: {
      label: "Visual Builder",
      icon: Workflow,
      defaultSize: { width: 1200, height: 800 },
      minSize: { width: 800, height: 600 },
      resizable: true,
      singleton: false,
      tier: "secondary",
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
export function getWindowIcon(type: WindowType): WindowMetadata["icon"] {
  return windowRegistry[type]?.metadata?.icon;
}
