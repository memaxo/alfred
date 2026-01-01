// Install auth mock BEFORE other imports
import { installAuthTokenMock } from "@alfred/test-kit";

installAuthTokenMock();

import { afterEach, describe, expect, it, mock } from "bun:test";
import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import type { Workspace } from "@alfred/agent/environment/types";
import type { AgentSpec } from "@alfred/agent/orchestrator/multi/spawn";
import { createTrackerContext } from "@alfred/agent/orchestrator/multi/tracker";
import type { SubTask, WorkflowEvent } from "@alfred/type/plan";
import { AsyncQueue } from "../src/utils/concurrency";
import {
  isDockerAvailable,
  isImageAvailable,
  toPosixPath,
} from "./utils/infra";

const IMAGE = "alfred-agentfs:codex";

const dockerOk = isDockerAvailable();
const imageOk = dockerOk && isImageAvailable(IMAGE);

const codexExecuteMock = mock(async (_args: unknown) => ({
  result: "ok",
  artifacts: [],
}));

const processForLearningMock = mock(async (_dbPath: string) => ({
  patterns: [],
  mistakes: [],
  insights: [],
}));

mock.module("@alfred/agent/orchestrator/tool/codex/index", () => ({
  toolCodex: { execute: codexExecuteMock },
}));

mock.module("@alfred/agent/agentfs/learning-bridge", () => ({
  processForLearning: processForLearningMock,
}));

describe("runAgent threads AgentFS container metadata into Codex", () => {
  const repoRoot = process.cwd();
  const baseDir = path.join(
    repoRoot,
    ".agent",
    "test-workspaces",
    "runtime-agentfs"
  );
  let workspaceDir: string;
  const activeWorkspaces: Workspace[] = [];

  afterEach(async () => {
    for (const w of activeWorkspaces.splice(0, activeWorkspaces.length)) {
      try {
        await w.cleanup();
      } catch {
        // ignore
      }
    }
    if (workspaceDir) {
      await rm(workspaceDir, { recursive: true, force: true });
    }
    codexExecuteMock.mockClear();
    processForLearningMock.mockClear();
  });

  it.skipIf(!(dockerOk && imageOk))(
    "passes containerId/containerCw",
    async () => {
      const runId = `runtime-agentfs-${Date.now().toString(36)}`;
      const taskId = "T00000001";

      workspaceDir = path.join(baseDir, `run-${Date.now().toString(36)}`);
      await mkdir(workspaceDir, { recursive: true });

      const workspaceDirRel = path.relative(repoRoot, workspaceDir);

      const task: SubTask = {
        id: taskId,
        title: "AgentFS container wiring",
        requirement:
          "Codex should run inside the AgentFSWorkspace Docker container.",
        deps: [],
        priority: 1,
        acceptance: ["containerId/containerCw are passed to toolCodex"],
        filesHint: [],
      };

      const spec: AgentSpec = {
        agentId: `${runId}:${taskId}`,
        subTaskId: taskId,
        sessionId: `${runId}:${taskId}`,
        // NOTE: runAgent currently normalizes workingDirectory to workspace root.
        workingDirectory: workspaceDir,
        environment: "agentfs",
        auto: "low",
        agentfsOverlay: true,
        execPlanPath: path.join(
          workspaceDirRel,
          ".agent",
          "plans",
          runId,
          `${taskId}.md`
        ),
        context: {
          agentfsDbDir: path.join(workspaceDirRel, ".agentfs"),
        },
      };

      const tracker = createTrackerContext([task]);
      const trackerContextRef = { current: tracker };
      const queue = new AsyncQueue<WorkflowEvent>();

      const { runAgent } = await import("../src/orchestrator/agent");

      const outcome = await runAgent({
        spec,
        phaseId: "phase-test",
        runId,
        workspace: repoRoot,
        workspaceRoot: repoRoot,
        subTaskById: new Map([[taskId, task]]),
        projectConfig: null,
        activeWorkspaces,
        agentFileHints: new Map(),
        rootExecPlanPath: path.join(
          workspaceDir,
          ".agent",
          "plans",
          runId,
          "root.md"
        ),
        signal: new AbortController().signal,
        authz: "authz-token",
        userId: "user-1",
        trackerContextRef,
        queue,
      });

      expect(outcome.status).toBe("completed");
      expect(codexExecuteMock).toHaveBeenCalledTimes(1);
      expect(activeWorkspaces.length).toBe(1);

      const call = codexExecuteMock.mock.calls[0]?.[0] as
        | {
            input?: {
              containerId?: string;
              containerCw?: string;
              cw?: string;
            };
          }
        | undefined;

      const w = activeWorkspaces[0] as unknown as {
        containerName?: unknown;
        containerCw?: unknown;
      };
      const containerName =
        typeof w.containerName === "string" ? w.containerName : undefined;
      const containerCw =
        typeof w.containerCw === "string" ? w.containerCw : undefined;

      expect(containerName?.startsWith("alfred-agentfs-")).toBe(true);
      expect(containerCw).toBe("/workspace");

      expect(call?.input?.containerId).toBe(containerName);
      expect(call?.input?.containerCw).toBe(containerCw);
      expect(call?.input?.cw).toBe(toPosixPath(path.resolve(repoRoot)));
    }
  );
});
