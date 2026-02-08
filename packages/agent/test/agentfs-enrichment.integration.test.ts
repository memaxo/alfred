// Install auth mock BEFORE other imports
import { installAuthTokenMock } from "@alfred/test-kit";

installAuthTokenMock();

import type { StructuredHandoff } from "@alfred/type";

import { afterAll, afterEach, beforeAll, describe, expect, it } from "bun:test";
import path from "node:path";

import {
  getFailureContext,
  getStructuredHandoff,
  persistStructuredHandoff,
} from "../src/agentfs/enrichment";
import { AgentFSWorkspace } from "../src/environment/agentfs";
import { finalizeOutcome } from "../src/orchestrator/outcome";
import {
  cleanupTestDir,
  createRepoTestDir,
  isDockerAvailable,
  isImageAvailable,
  runCmd,
} from "./utils/infra";

const IMAGE = "alfred-agentfs:codex";
const AUTHZ = "test-authz";

const dockerOk = isDockerAvailable();
const imageOk = dockerOk && isImageAvailable(IMAGE);
const dockerReady =
  imageOk && runCmd(["docker", "run", "--rm", IMAGE, "true"]).exitCode === 0;

let prevEnrichmentEnv: string | undefined;

beforeAll(() => {
  prevEnrichmentEnv = process.env.ALFRED_ENRICHMENT;
  process.env.ALFRED_ENRICHMENT = "1";
});

afterAll(() => {
  if (prevEnrichmentEnv === undefined) {
    delete process.env.ALFRED_ENRICHMENT;
  } else {
    process.env.ALFRED_ENRICHMENT = prevEnrichmentEnv;
  }
});

describe("AgentFS enrichment (docker + sdk)", () => {
  const repoRoot = process.cwd();
  const cleanupFns: (() => Promise<void> | void)[] = [];
  const dirs: string[] = [];

  afterEach(async () => {
    for (const fn of cleanupFns.splice(0).toReversed()) {
      try {
        await fn();
      } catch {
        // ignore
      }
    }
    for (const dir of dirs.splice(0)) {
      cleanupTestDir(dir);
    }
  });

  it.skipIf(!dockerReady)(
    "finalizeOutcome persists FailureContext based on real tool history",
    async () => {
      const baseDir = createRepoTestDir("agentfs-enrich");
      dirs.push(baseDir);

      const runId = `agentfs-enrich-${Date.now().toString(36)}`;
      const agentId = `agent-${Math.random().toString(36).slice(2, 8)}`;

      const relBase = path.relative(repoRoot, baseDir);
      const dbRel = path.join(relBase, ".agentfs", runId, "agentfs.db");

      const workspace = new AgentFSWorkspace(agentId, runId, repoRoot, {
        authz: AUTHZ,
        dbPath: dbRel,
        image: IMAGE,
      });
      cleanupFns.push(() => workspace.cleanup());

      await workspace.initialize();

      const agent = workspace.getAgent();
      const t0 = Date.now() / 1000;
      await agent.tools.record(
        "shell",
        t0,
        t0 + 0.01,
        { cmd: "false" },
        undefined,
        "Command failed"
      );
      await agent.tools.record(
        "shell",
        t0 + 1,
        t0 + 1.01,
        { cmd: "false" },
        undefined,
        "Command failed"
      );

      const outcome = await finalizeOutcome(
        {
          agentId: `${runId}:task-a`,
          durationSeconds: 1,
          result: {
            summary: "failed",
            artifacts: [],
            changes: [],
            notes: [],
          },
          role: "codex",
          status: "failure",
          stuck: false,
        },
        agent
      );

      expect(outcome.failureContext).toBeDefined();
      const stored = await getFailureContext(agent, "task-a");
      expect(stored?.taskId).toBe("task-a");
      expect(stored?.toolErrors.some((e) => e.tool === "shell")).toBe(true);
      expect(
        stored?.toolErrors.some((e) => (e.error ?? "").includes("failed"))
      ).toBe(true);
    }
  );

  it.skipIf(!dockerReady)("persists structured handoff to KV", async () => {
    const baseDir = createRepoTestDir("agentfs-handoff");
    dirs.push(baseDir);

    const runId = `agentfs-handoff-${Date.now().toString(36)}`;
    const agentId = `agent-${Math.random().toString(36).slice(2, 8)}`;

    const relBase = path.relative(repoRoot, baseDir);
    const dbRel = path.join(relBase, ".agentfs", runId, "agentfs.db");

    const workspace = new AgentFSWorkspace(agentId, runId, repoRoot, {
      authz: AUTHZ,
      dbPath: dbRel,
      image: IMAGE,
    });
    cleanupFns.push(() => workspace.cleanup());

    await workspace.initialize();
    const agent = workspace.getAgent();

    const handoff: StructuredHandoff = {
      blockers: [],
      decisions: [],
      filesCreated: [],
      filesDeleted: [],
      filesModified: ["a.txt"],
      fromWaveId: "wave-1",
      summary: "did things",
      toWaveId: "wave-2",
      toolsAvoided: [],
      ts: Date.now(),
    };

    await persistStructuredHandoff(agent, "wave-1", handoff);
    const stored = await getStructuredHandoff(agent, "wave-1");
    expect(stored?.fromWaveId).toBe("wave-1");
    expect(stored?.filesModified).toEqual(["a.txt"]);
  });
});
