// Install auth mock BEFORE other imports
import { installAuthTokenMock } from "@alfred/test-kit";

installAuthTokenMock();

import {
  getStructuredHandoff,
  listFailureContexts,
  persistStructuredHandoff,
} from "@alfred/agent/agentfs/enrichment";
import { AgentFSWorkspace } from "@alfred/agent/environment/agentfs";
import { finalizeOutcome } from "@alfred/agent/orchestrator/outcome";
import { db } from "@alfred/db";
import { memoryNodes } from "@alfred/db/src/schema/graph";
import { describePostgres, requirePostgresTestEnv } from "@alfred/db/testing";
import {
  afterEach,
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "bun:test";
import { sql } from "drizzle-orm";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

import {
  addHandoffContext,
  addUpstreamFailures,
  applyEnrichmentToTask,
  queryTaskEnrichment,
} from "../packages/plan/src/enrich/index.js";
import { buildStructuredHandoff } from "../packages/runtime/src/orchestrator/handoff.js";

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

interface CmdResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

const decoder = new TextDecoder();

function runCmd(argv: string[], cwd?: string): CmdResult {
  const proc = Bun.spawnSync(argv, {
    cwd,
    stdin: "ignore",
    stdout: "pipe",
    stderr: "pipe",
    env: process.env,
  });

  const stdout =
    proc.stdout && typeof proc.stdout !== "number"
      ? decoder.decode(proc.stdout)
      : "";
  const stderr =
    proc.stderr && typeof proc.stderr !== "number"
      ? decoder.decode(proc.stderr)
      : "";

  return { exitCode: proc.exitCode ?? 1, stdout, stderr };
}

function isDockerAvailable(): boolean {
  return runCmd(["docker", "info"]).exitCode === 0;
}

function isImageAvailable(tag: string): boolean {
  return runCmd(["docker", "image", "inspect", tag]).exitCode === 0;
}

function createTestDir(prefix: string): string {
  const base = path.join(process.cwd(), ".agent", "test-workspaces");
  mkdirSync(base, { recursive: true });
  const dir = path.join(
    base,
    `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
  );
  mkdirSync(dir, { recursive: true });
  return dir;
}

async function resetGraphTables() {
  await db.execute(
    sql`TRUNCATE memory_edges, memory_nodes RESTART IDENTITY CASCADE`
  );
}

const SHOULD_RUN_DB = process.env.RUN_DB_TESTS === "1";
const IMAGE = "alfred-agentfs:codex";
const AUTHZ = "test-authz";
const dockerOk = isDockerAvailable();
const imageOk = dockerOk && isImageAvailable(IMAGE);
const describeFn = SHOULD_RUN_DB ? describePostgres : describe.skip;

describeFn(
  "Task enrichment end-to-end (AgentFS KV + DB + plan + runtime)",
  () => {
    let testDir: string;
    let gitRepoDir: string;
    let runA: string;
    let runB: string;
    let wsA: AgentFSWorkspace | null = null;
    let wsB: AgentFSWorkspace | null = null;

    const createdAgentfsRunDirs: string[] = [];
    const prevOpenAiKey = process.env.OPENAI_API_KEY;

    beforeAll(async () => {
      requirePostgresTestEnv(
        "E2E enrichment tests need Postgres. Set DATABASE_URL and RUN_DB_TESTS=1."
      );
    });

    beforeEach(async () => {
      if (!(dockerOk && imageOk)) {
        return;
      }

      process.env.OPENAI_API_KEY = "";

      await resetGraphTables();

      testDir = createTestDir("enrich-e2e");
      gitRepoDir = path.join(testDir, "repo");
      mkdirSync(gitRepoDir, { recursive: true });

      // Initialize a tiny git repo for deterministic handoff diff.
      runCmd(["git", "init"], gitRepoDir);
      runCmd(["git", "config", "user.email", "test@example.com"], gitRepoDir);
      runCmd(["git", "config", "user.name", "Test"], gitRepoDir);
      writeFileSync(path.join(gitRepoDir, "a.txt"), "one\n");
      runCmd(["git", "add", "."], gitRepoDir);
      runCmd(["git", "commit", "-m", "init"], gitRepoDir);

      runA = `enrich-a-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
      runB = `enrich-b-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

      createdAgentfsRunDirs.push(path.join(process.cwd(), ".agentfs", runA));
      createdAgentfsRunDirs.push(path.join(process.cwd(), ".agentfs", runB));

      wsA = new AgentFSWorkspace("agent-a", runA, process.cwd(), {
        authz: AUTHZ,
        image: IMAGE,
      });
      await wsA.initialize();

      // Record a repeated tool failure so finalizeOutcome has real tool history.
      const agentA = wsA.getAgent();
      const t0 = Date.now() / 1000;
      await agentA.tools.record(
        "shell",
        t0,
        t0 + 0.01,
        { cmd: "false" },
        undefined,
        "Command failed"
      );
      await agentA.tools.record(
        "shell",
        t0 + 1,
        t0 + 1.01,
        { cmd: "false" },
        undefined,
        "Command failed"
      );

      await finalizeOutcome(
        {
          agentId: `${runA}:task-a`,
          stuck: false,
          status: "failure",
          durationSeconds: 1,
          role: "codex",
          result: {
            summary: "failed",
            artifacts: [],
            changes: [],
            notes: [],
          },
        },
        agentA
      );

      // Insert DB learning signals (heuristic + similar execution).
      const keyword = "flibbertigibbet";
      const { createHeuristicFromFailure } =
        await import("@alfred/db/repo/codex-learning");
      await createHeuristicFromFailure({
        rule: `If you see ${keyword} failures, check tool history first.`,
        domain: "workflow",
        severity: "high",
        sourceRunId: runA,
        sourceTaskId: "task-a",
        sourceError: "Command failed",
        sourceStatus: "failure",
      });

      await db.insert(memoryNodes).values({
        kind: "codex_execution",
        label: `Fix ${keyword} issue in parser`,
        resource: "repo/test",
        hash: `exec-${runA}`,
        properties: {
          sessionId: runA,
          auto: "low",
          result: `Fixed ${keyword} by updating parser config.`,
        },
        sanitized: true,
      });

      // Make a workspace change so handoff has a file diff.
      writeFileSync(path.join(gitRepoDir, "a.txt"), "one\ntwo\n");

      const handoff = await buildStructuredHandoff(
        "wave-1",
        "wave-2",
        [
          {
            agentId: `${runA}:task-a`,
            stuck: false,
            status: "failed",
            durationSeconds: 1,
            role: "codex",
            result: {
              summary: "Investigated failure",
              artifacts: [],
              changes: [],
              notes: ["DECISION: Use fallback|LLM unavailable"],
            },
            failureContext: {
              taskId: "task-a",
              runId: runA,
              status: "failure",
              toolErrors: [
                {
                  tool: "shell",
                  error: "Command failed",
                  count: 2,
                  lastOccurrence: Date.now(),
                },
              ],
              loopDetections: [],
              escalations: [],
              reviewFailures: [],
              durationMs: 1000,
              ts: Date.now(),
            },
          },
        ],
        gitRepoDir
      );

      await persistStructuredHandoff(agentA, "wave-1", handoff);

      // Consumer workspace: clone AgentFS DB from runA into runB.
      wsB = new AgentFSWorkspace("agent-b", runB, process.cwd(), {
        authz: AUTHZ,
        image: IMAGE,
        baseDbPath: path.join(process.cwd(), ".agentfs", runA, "agentfs.db"),
      });
      await wsB.initialize();
    });

    afterEach(async () => {
      process.env.OPENAI_API_KEY = prevOpenAiKey;

      try {
        await wsB?.cleanup();
      } catch {
        // ignore
      }
      try {
        await wsA?.cleanup();
      } catch {
        // ignore
      }
      wsA = null;
      wsB = null;

      if (testDir) {
        rmSync(testDir, { recursive: true, force: true });
      }
      for (const dir of createdAgentfsRunDirs.splice(0)) {
        rmSync(dir, { recursive: true, force: true });
      }
    });

    it.skipIf(!(dockerOk && imageOk))(
      "persists run A signals and applies them to a related task in run B",
      async () => {
        if (!(wsB && wsA)) {
          throw new Error("missing_workspaces");
        }

        const agentB = wsB.getAgent();
        const failures = await listFailureContexts(agentB);
        expect(failures.some((f) => f.taskId === "task-a")).toBe(true);

        const handoff = await getStructuredHandoff(agentB, "wave-1");
        expect(handoff?.fromWaveId).toBe("wave-1");
        expect(handoff?.filesModified).toContain("a.txt");

        const failureMap = new Map(failures.map((f) => [f.taskId, f]));

        const tasks = [
          {
            id: "task-a",
            title: "Upstream",
            requirement: "Upstream task",
            deps: [],
            priority: 1,
            acceptance: ["ok"],
            filesHint: [],
          },
          {
            id: "task-b",
            title: "Downstream",
            requirement: "Fix flibbertigibbet issue in parser",
            deps: ["task-a"],
            priority: 1,
            acceptance: ["ok"],
            filesHint: [],
          },
        ];

        const enrichment = await queryTaskEnrichment(tasks[1]!, {
          runId: runB,
          resource: "repo/test",
        });

        const withUpstream = addUpstreamFailures(
          enrichment,
          failureMap,
          tasks[1]!.deps
        );
        const withHandoff = handoff
          ? addHandoffContext(withUpstream, handoff)
          : withUpstream;
        const enriched = applyEnrichmentToTask(tasks[1]!, withHandoff);

        expect(enriched.requirement).toContain("# Context from Prior Runs");
        expect(enriched.requirement).toContain("Prior Similar Tasks");
        expect(enriched.requirement).toContain("Learned Heuristics");
        expect(enriched.requirement).toContain("flibbertigibbet");
        expect(enriched.requirement).toContain("Upstream Task Failures");
        expect(enriched.requirement).toContain("Avoid tools");
        expect(enriched.requirement).toContain("shell");
        expect(enriched.requirement).toContain("Handoff from Previous Wave");
      }
    );
  }
);
