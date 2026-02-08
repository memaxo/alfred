import type { Workspace } from "@alfred/agent/environment/types";

import { isAgentFSWorkspace } from "@alfred/agent/environment/agentfs";
import { WorkspaceFactory } from "@alfred/agent/environment/factory";
import { toolCodex } from "@alfred/agent/orchestrator/tool/codex/index";
import { randomUUID } from "node:crypto";

/**
 * Workspace kind for Codex live testing.
 * AgentFS inside Docker is the only supported configuration.
 */
export type CodexLiveWorkspaceKind = "agentfs";

/**
 * Codex live workspace configuration.
 * Contains workspace instance and AgentFS-specific metadata.
 */
export interface CodexLiveWorkspace {
  id: string;
  runId: string;
  kind: CodexLiveWorkspaceKind;
  root: string;
  workspace: Workspace;
  agentfsDbPath?: string;
  containerName: string;
  containerCw: string;
}

export type CodexLiveChunk = unknown;

export interface CodexLiveRunResult {
  result: string;
  artifacts?: { path: string; kind: string }[];
  chunks: CodexLiveChunk[];
}

/**
 * Create a Codex live workspace for testing.
 *
 * Uses AgentFS inside Docker container (production standard).
 */
export async function createCodexLiveWorkspace(options: {
  repoRoot: string;
  kind: CodexLiveWorkspaceKind;
  id?: string;
  runId?: string;
  dockerImage?: string;
  authz?: string;
}): Promise<CodexLiveWorkspace> {
  const runId = options.runId ?? randomUUID();
  const id = options.id ?? `codex-live-${runId}`;

  const ws = await WorkspaceFactory.create(
    options.kind,
    id,
    runId,
    options.repoRoot,
    {
      image: options.dockerImage,
      authz: options.authz,
    }
  );
  await ws.initialize();

  if (!isAgentFSWorkspace(ws)) {
    throw new Error("agentfs_workspace_required");
  }

  const agentfsDbPath = ws.dbPath;

  return {
    id,
    runId,
    kind: options.kind,
    root: ws.root,
    workspace: ws,
    agentfsDbPath,
    containerName: ws.containerName,
    containerCw: ws.containerCw,
  };
}

/**
 * Clean up a Codex live workspace.
 */
export async function cleanupCodexLiveWorkspace(
  ws: CodexLiveWorkspace
): Promise<void> {
  await ws.workspace.cleanup();
}

/**
 * Run Codex in a live workspace for testing.
 */
export async function runCodexLiveInWorkspace(options: {
  workspace: CodexLiveWorkspace;
  authz: string;
  sessionId: string;
  prompt: string;
  auto?: "read" | "low" | "medium" | "high";
  model?: string;
  profile?: string;
  timeoutSec?: number;
  signal?: AbortSignal;
}): Promise<CodexLiveRunResult> {
  const chunks: CodexLiveChunk[] = [];

  const result = await toolCodex.execute({
    input: {
      action: "exec",
      prompt: options.prompt,
      out: "text",
      auto: options.auto ?? "low",
      cw: options.workspace.root,
      sessionId: options.sessionId,
      agentfsDbPath: options.workspace.agentfsDbPath,
      containerName: options.workspace.containerName,
      containerCw: options.workspace.containerCw,
      model: options.model,
      profile: options.profile,
      authz: options.authz,
      timeoutSec: options.timeoutSec,
    },
    writer: {
      write: (chunk: unknown) => {
        chunks.push(chunk);
      },
    },
    signal: options.signal,
  });

  return {
    result: result.result,
    artifacts: result.artifacts,
    chunks,
  };
}
