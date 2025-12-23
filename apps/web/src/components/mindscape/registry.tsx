import type { NodeTypes } from "@xyflow/react";
import type React from "react";
import { LivingEdge } from "./living-edge";
import { ArtifactNode } from "./nodes/artifact-node";
import { BookmarkNode } from "./nodes/bookmark-node";
import { ChatNode } from "./nodes/chat-node";
import { CodeNode } from "./nodes/code-node";
import { ConceptNode } from "./nodes/concept-node";
import { DeploymentNode } from "./nodes/deployment-node";
import { DroidNode } from "./nodes/droid-node";
import { NodeErrorBoundary } from "./nodes/error-boundary";
import { IntegrationsNode } from "./nodes/integrations-node";
import { KnowledgeNode } from "./nodes/knowledge-node";
import { NoteNode } from "./nodes/note-node";
import { OrbNode } from "./nodes/orb-node";
import { PrivacyNode } from "./nodes/privacy-node";
import { ProfileNode } from "./nodes/profile-node";
import { ReminderNode } from "./nodes/reminder-node";
import { SettingsNode } from "./nodes/settings-node";
import { TerminalNode } from "./nodes/terminal-node";
import { TicketNode } from "./nodes/ticket-node";
import { TimerNode } from "./nodes/timer-node";
import { TodoNode } from "./nodes/todo-node";
import { WorkflowListNode } from "./nodes/workflow-list-node";
import { WorkflowNode } from "./nodes/workflow-node";

/**
 * Wraps a node component with an error boundary for resilient rendering.
 * Using 'any' here because ReactFlow's internal NodeProps type system
 * conflicts with typed node components. Type safety is enforced at
 * individual node component level.
 */
export const wrapWithErrorBoundary =
  <T extends { id: string }>(Component: React.ComponentType<T>) =>
  (props: T) => (
    <NodeErrorBoundary nodeId={props.id}>
      <Component {...props} />
    </NodeErrorBoundary>
  );

export const nodeTypes: NodeTypes = {
  orb: wrapWithErrorBoundary(OrbNode),
  artifact: wrapWithErrorBoundary(ArtifactNode),
  chat: wrapWithErrorBoundary(ChatNode),
  workflow: wrapWithErrorBoundary(WorkflowNode),
  terminal: wrapWithErrorBoundary(TerminalNode),
  droid: wrapWithErrorBoundary(DroidNode),
  note: wrapWithErrorBoundary(NoteNode),
  reminder: wrapWithErrorBoundary(ReminderNode),
  ticket: wrapWithErrorBoundary(TicketNode),
  code: wrapWithErrorBoundary(CodeNode),
  timer: wrapWithErrorBoundary(TimerNode),
  bookmark: wrapWithErrorBoundary(BookmarkNode),
  todo: wrapWithErrorBoundary(TodoNode),
  settings: wrapWithErrorBoundary(SettingsNode),
  privacy: wrapWithErrorBoundary(PrivacyNode),
  profile: wrapWithErrorBoundary(ProfileNode),
  integrations: wrapWithErrorBoundary(IntegrationsNode),
  workflowlist: wrapWithErrorBoundary(WorkflowListNode),
  deployment: wrapWithErrorBoundary(DeploymentNode),
  knowledge: wrapWithErrorBoundary(KnowledgeNode),
  concept: wrapWithErrorBoundary(ConceptNode),
};

export const edgeTypes = {
  default: LivingEdge,
};
