import type { WindowType } from "@/store/desktop.types";
import { AdminWindow } from "./admin";
import { AgentfsWindow } from "./agentfs";
import { AgentsWindow } from "./agents";
import { ChatWindow } from "./chat";
import { CodeWindow } from "./code";
import { CodexWindow } from "./codex";
import { DockerWindow } from "./docker";
import { ExploreWindow } from "./explore";
import { FilesWindow } from "./files";
import { InboxWindow } from "./inbox";
import { IntelWindow } from "./intel";
import { PlaceholderWindow } from "./placeholder";
import { PrReviewWindow } from "./pr";
import { TaskmanagerWindow } from "./taskmanager";
import { TerminalWindow } from "./terminal";
import type { WindowComponentProps } from "./types";
import { WorkWindow } from "./work";

export type WindowComponentType = React.ComponentType<WindowComponentProps>;

export const windowRegistry: Record<WindowType, WindowComponentType> = {
  admin: AdminWindow,
  agentfs: AgentfsWindow,
  agents: AgentsWindow,
  bookmarks: IntelWindow,
  chat: ChatWindow,
  code: CodeWindow,
  codex: CodexWindow,
  components: WorkWindow,
  concept: ExploreWindow,
  cortex: IntelWindow,
  docker: DockerWindow,
  droid: PlaceholderWindow,
  files: FilesWindow,
  inbox: InboxWindow,
  integrations: PlaceholderWindow,
  knowledge: ExploreWindow,
  learning: IntelWindow,
  linear: ExploreWindow,
  metrics: IntelWindow,
  note: PlaceholderWindow,
  notes: WorkWindow,
  plan: IntelWindow,
  policy: IntelWindow,
  "pr-review": PrReviewWindow,
  project: ExploreWindow,
  rag: IntelWindow,
  reminder: PlaceholderWindow,
  reminders: WorkWindow,
  settings: WorkWindow,
  taskmanager: TaskmanagerWindow,
  terminal: TerminalWindow,
  timers: IntelWindow,
  todo: PlaceholderWindow,
  todos: WorkWindow,
  tune: IntelWindow,
  "visual-builder": IntelWindow,
  workflow: ExploreWindow,
  workflowlist: PlaceholderWindow,
  workingset: WorkWindow,
};
