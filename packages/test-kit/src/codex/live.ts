import { randomUUID } from "node:crypto";
import {
  isContainerWorkspace,
  type Workspace,
} from "@alfred/agent/environment/types";
import { WorkspaceFactory } from "@alfred/agent/environment/factory";
import { toolCodex } from "@alfred/agent/orchestrator/tool/codex/index";

export type CodexLiveWorkspaceKind = "worktree" | "container" | "poof" | "host";

export type CodexLiveWorkspace = {
  id: string;
  runId: string;
  kind: CodexLiveWorkspaceKind;
  root: string;
  workspace: Workspace;
  containerId?: string;
  containerCw?: string;
  poofUpperDir?: string;
  poofProfile?: "minimal" | "standard" | "intensive";
  poofMode?: "exec" | "run";
};

export type CodexLiveChunk = unknown;

export type CodexLiveRunResult = {
  result: string;
  artifacts?: Array<{ path: string; kind: string }>;
  chunks: CodexLiveChunk[];
};

export async function createCodexLiveWorkspace(options: {
  repoRoot: string;
  kind: CodexLiveWorkspaceKind;
  id?: string;
  runId?: string;
  dockerImage?: string;
  poofProfile?: "minimal" | "standard" | "intensive";
  poofMode?: "exec" | "run";
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
      poofProfile: options.poofProfile,
      poofMode: options.poofMode ?? "run",
    }
  );
  await ws.initialize();

  const kind = options.kind;
  const containerId = isContainerWorkspace(ws) ? ws.containerId : undefined;
  const containerCw = isContainerWorkspace(ws) ? ws.containerCw : undefined;
  const poofUpperDir = ws.kind === "poof" ? (ws as any).upperDir ?? undefined : undefined;
  const poofMode = ws.kind === "poof" ? (ws as any).mode ?? undefined : undefined;
  const poofProfileName =
    ws.kind === "poof" ? ((ws as any).profile?.name as unknown) : undefined;
  const poofProfile =
    poofProfileName === "minimal" || poofProfileName === "standard" || poofProfileName === "intensive"
      ? poofProfileName
      : undefined;

  return {
    id,
    runId,
    kind,
    root: ws.root,
    workspace: ws,
    containerId,
    containerCw,
    poofUpperDir,
    poofProfile,
    poofMode,
  };
}

export async function cleanupCodexLiveWorkspace(ws: CodexLiveWorkspace): Promise<void> {
  await ws.workspace.cleanup();
}

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
      poofUpperDir: options.workspace.poofUpperDir,
      poofProfile: options.workspace.poofProfile,
      poofMode: options.workspace.poofMode,
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

