import type { ComponentType } from "react";

import type { WindowType } from "@/store/desktop.types";

import type { WindowComponentProps } from "./types";

import { AdminWindow } from "./admin";
import { AgentfsWindow } from "./agentfs";
import { AgentsWindow } from "./agents";
import { BookmarksWindow } from "./bookmarks";
import { ChatWindow } from "./chat";
import { CodeWindow } from "./code";
import { CodexWindow } from "./codex";
import { ComponentsWindow } from "./components";
import { CortexWindow } from "./cortex";
import { DockerWindow } from "./docker";
import { DroidWindow } from "./droid";
import { ExploreWindow } from "./explore";
import { FilesWindow } from "./files";
import { InboxWindow } from "./inbox";
import { IntegrationsWindow } from "./integrations";
import { KnowledgeWindow } from "./knowledge";
import { LearningWindow } from "./learning";
import { LinearWindow } from "./linear";
import { MetricsWindow } from "./metrics";
import { NoteWindow } from "./note";
import { NotesWindow } from "./notes";
import { PlanWindow } from "./plan";
import { PolicyWindow } from "./policy";
import { PrReviewWindow } from "./pr";
import { ProjectWindow } from "./project";
import { RagWindow } from "./rag";
import { ReminderWindow } from "./reminder";
import { RemindersWindow } from "./reminders";
import { SettingsWindow } from "./settings";
import { TaskmanagerWindow } from "./taskmanager";
import { TerminalWindow } from "./terminal";
import { TimersWindow } from "./timers";
import { TodosWindow } from "./todos";
import { TuneWindow } from "./tune";
import { VisualWindow } from "./visual";
import { WorkflowWindow } from "./workflow";
import { WorkflowlistWindow } from "./workflowlist";
import { WorkingsetWindow } from "./workingset";

export type WindowComponentType = ComponentType<WindowComponentProps>;

export const windowRegistry: Record<WindowType, WindowComponentType> = {
  admin: AdminWindow,
  agentfs: AgentfsWindow,
  agents: AgentsWindow,
  bookmarks: BookmarksWindow,
  chat: ChatWindow,
  code: CodeWindow,
  codex: CodexWindow,
  components: ComponentsWindow,
  concept: ExploreWindow,
  cortex: CortexWindow,
  docker: DockerWindow,
  droid: DroidWindow,
  files: FilesWindow,
  inbox: InboxWindow,
  integrations: IntegrationsWindow,
  knowledge: KnowledgeWindow,
  learning: LearningWindow,
  linear: LinearWindow,
  metrics: MetricsWindow,
  note: NoteWindow,
  notes: NotesWindow,
  plan: PlanWindow,
  policy: PolicyWindow,
  "pr-review": PrReviewWindow,
  project: ProjectWindow,
  rag: RagWindow,
  reminder: ReminderWindow,
  reminders: RemindersWindow,
  settings: SettingsWindow,
  taskmanager: TaskmanagerWindow,
  terminal: TerminalWindow,
  timers: TimersWindow,
  todo: TodosWindow,
  todos: TodosWindow,
  tune: TuneWindow,
  "visual-builder": VisualWindow,
  workflow: WorkflowWindow,
  workflowlist: WorkflowlistWindow,
  workingset: WorkingsetWindow,
};
