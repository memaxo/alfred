/**
 * Applications - Desktop Apps
 *
 * Phase 2: Core Applications
 * Phase 3: System Applications
 * Phase 4: Knowledge & Integration Apps
 *
 * @see docs/execplans/desktop-evolution-prd.md Part III
 */

// Phase 3: System Applications
export { AdminApp, AdminAppWindow } from "./admin";
export { AgentFSApp, AgentFSAppWindow } from "./agentfs";
// Phase 2: Core Applications
export { AgentsApp, AgentsAppWindow } from "./agents";
export { ChatApp, ChatAppWindow } from "./chat";
export { CodeApp, CodeAppWindow } from "./code";
export { DockerApp, DockerAppWindow } from "./docker";
// Phase 4: Knowledge & Integration Apps
export { FilesApp, FilesAppWindow } from "./files";
export { KnowledgeApp, KnowledgeAppWindow } from "./knowledge";
export { LinearApp, LinearAppWindow } from "./linear";
export { MetricsApp, MetricsAppWindow } from "./metrics";
export { PolicyApp, PolicyAppWindow } from "./policy";
export { PRReviewApp, PRReviewAppWindow } from "./pr-review";
export { TaskManagerApp, TaskManagerAppWindow } from "./taskmanager";
export { TerminalApp, TerminalAppWindow } from "./terminal";
export { WorkflowApp, WorkflowAppWindow } from "./workflow";
