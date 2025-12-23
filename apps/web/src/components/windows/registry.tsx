import type { NodeTypes } from "@xyflow/react";
import type { ComponentType } from "react";
import { LivingEdge } from "@/components/mindscape/living-edge";
import { ChatNode } from "@/components/mindscape/nodes/chat-node";
import { ConceptNode } from "@/components/mindscape/nodes/concept-node";
import { DroidNode } from "@/components/mindscape/nodes/droid-node";
import { IntegrationsNode } from "@/components/mindscape/nodes/integrations-node";
import { KnowledgeNode } from "@/components/mindscape/nodes/knowledge-node";
import { NoteNode } from "@/components/mindscape/nodes/note-node";
import { ReminderNode } from "@/components/mindscape/nodes/reminder-node";
import { SettingsNode } from "@/components/mindscape/nodes/settings-node";
import { TerminalNode } from "@/components/mindscape/nodes/terminal-node";
import { TodoNode } from "@/components/mindscape/nodes/todo-node";
import { WorkflowListNode } from "@/components/mindscape/nodes/workflow-list-node";
import { WorkflowNode } from "@/components/mindscape/nodes/workflow-node";
import type { WindowType } from "@/store/desktop/types";
import { WindowErrorBoundary } from "./shared/error-boundary";

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
  chat: wrapWithErrorBoundary(ChatNode),
  terminal: wrapWithErrorBoundary(TerminalNode),
  droid: wrapWithErrorBoundary(DroidNode),
  note: wrapWithErrorBoundary(NoteNode),
  reminder: wrapWithErrorBoundary(ReminderNode),
  todo: wrapWithErrorBoundary(TodoNode),
  workflow: wrapWithErrorBoundary(WorkflowNode),
  workflowlist: wrapWithErrorBoundary(WorkflowListNode),
  settings: wrapWithErrorBoundary(SettingsNode),
  integrations: wrapWithErrorBoundary(IntegrationsNode),
  knowledge: wrapWithErrorBoundary(KnowledgeNode),
  concept: wrapWithErrorBoundary(ConceptNode),
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
