import type { NodeTypes } from "@xyflow/react";
import type { ComponentType } from "react";
import { LivingEdge } from "@/components/shared/living-edge";
import type { WindowType } from "@/store/desktop/types";
import { ChatWindow } from "./chat";
import { ConceptWindow } from "./concept";
import { DroidWindow } from "./droid";
import { IntegrationsWindow } from "./integrations";
import { KnowledgeWindow } from "./knowledge";
import { NoteWindow } from "./note";
import { ReminderWindow } from "./reminder";
import { SettingsWindow } from "./settings";
import { WindowErrorBoundary } from "./shared/error-boundary";
import { TerminalWindow } from "./terminal";
import { TodoWindow } from "./todo";
import { WorkflowListWindow, WorkflowWindow } from "./workflow";

function wrapWithErrorBoundary<T extends { id: string }>(
  Component: ComponentType<T>
) {
  return function WrappedComponent(props: T) {
    return (
      <WindowErrorBoundary windowId={props.id}>
        <Component {...props} />
      </WindowErrorBoundary>
    );
  };
}

export const windowTypes: NodeTypes = {
  chat: wrapWithErrorBoundary(ChatWindow),
  terminal: wrapWithErrorBoundary(TerminalWindow),
  droid: wrapWithErrorBoundary(DroidWindow),
  note: wrapWithErrorBoundary(NoteWindow),
  reminder: wrapWithErrorBoundary(ReminderWindow),
  todo: wrapWithErrorBoundary(TodoWindow),
  workflow: wrapWithErrorBoundary(WorkflowWindow),
  workflowlist: wrapWithErrorBoundary(WorkflowListWindow),
  settings: wrapWithErrorBoundary(SettingsWindow),
  integrations: wrapWithErrorBoundary(IntegrationsWindow),
  knowledge: wrapWithErrorBoundary(KnowledgeWindow),
  concept: wrapWithErrorBoundary(ConceptWindow),
};

export const edgeTypes = {
  default: LivingEdge,
};

export const windowSpawnTypes: WindowType[] = [
  "chat",
  "terminal",
  "droid",
  "note",
  "reminder",
  "todo",
  "workflow",
  "workflowlist",
  "settings",
  "integrations",
];

export const singletonWindowTypes: WindowType[] = [
  "chat",
  "terminal",
  "droid",
  "todo",
  "settings",
  "integrations",
  "workflowlist",
];

const windowLabels: Record<WindowType, string> = {
  chat: "Chat",
  terminal: "Terminal",
  droid: "Droid",
  note: "Note",
  reminder: "Reminder",
  todo: "Todo",
  workflow: "Workflow",
  workflowlist: "Workflows",
  settings: "Settings",
  integrations: "Integrations",
  knowledge: "Knowledge",
  concept: "Concept",
};

export function getWindowLabel(type: WindowType): string {
  return windowLabels[type];
}
