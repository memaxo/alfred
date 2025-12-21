import { randomUUID } from "node:crypto";
import {
  isContainerWorkspace,
  type Workspace,
} from "@alfred/agent/environment/types";
import { WorkspaceFactory } from "@alfred/agent/environment/factory";
import { toolCodex } from "@alfred/agent/orchestrator/tool/codex/index";

/**
 * Workspace kind for Codex live testing.
 * Production uses container isolation only.
 */
export type CodexLiveWorkspaceKind = "container";

/**
 * Codex live workspace configuration.
 * Contains workspace instance and container-specific metadata.
 */
export type CodexLiveWorkspace = {
  id: string;
  runId: string;
  kind: CodexLiveWorkspaceKind;
  root: string;
  workspace: Workspace;
  containerId?: string;
  containerCw?: string;
};

export type CodexLiveChunk = unknown;

export type CodexLiveRunResult = {
  result: string;
  artifacts?: Array<{ path: string; kind: string }>;
  chunks: CodexLiveChunk[];
};

/**
 * Create a Codex live workspace for testing.
 *
 * Uses Docker container isolation (production standard).
 */
export async function createCodexLiveWorkspace(options: {
  repoRoot: string;
  kind: CodexLiveWorkspaceKind;
  id?: string;
  runId?: string;
  dockerImage?: string;
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
    }
  );
  await ws.initialize();

  const containerId = isContainerWorkspace(ws) ? ws.containerId : undefined;
  const containerCw = isContainerWorkspace(ws) ? ws.containerCw : undefined;

  return {
    id,
    runId,
    kind: options.kind,
    root: ws.root,
    workspace: ws,
    containerId,
    containerCw,
  };
}

/**
 * Clean up a Codex live workspace.
 */
export async function cleanupCodexLiveWorkspace(ws: CodexLiveWorkspace): Promise<void> {
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
      containerId: options.workspace.containerId,
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
