// Install auth mock BEFORE other imports
import { installAuthTokenMock } from "@alfred/test-kit";

installAuthTokenMock();

import { afterEach, describe, expect, it } from "bun:test";
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";

import { AgentFSWorkspace } from "../src/environment/agentfs";
import {
  cleanupTestDir,
  createRepoTestDir,
  isDockerAvailable,
  isImageAvailable,
  runCmd,
  toPosixPath,
} from "./utils/infra";

const IMAGE = "alfred-agentfs:codex";
const AUTHZ = "test-authz";

const dockerOk = isDockerAvailable();
const imageOk = dockerOk && isImageAvailable(IMAGE);
const dockerReady =
  imageOk && runCmd(["docker", "run", "--rm", IMAGE, "true"]).exitCode === 0;

function createWorkspace(args: {
  repoRoot: string;
  baseDir: string;
  runId: string;
  agentId: string;
}) {
  const relBase = path.relative(args.repoRoot, args.baseDir);
  const dbRel = path.join(relBase, ".agentfs", args.runId, "agentfs.db");
  mkdirSync(path.dirname(path.resolve(dbRel)), { recursive: true });

  const workspace = new AgentFSWorkspace(
    args.agentId,
    args.runId,
    args.repoRoot,
    {
      authz: AUTHZ,
      image: IMAGE,
      dbPath: dbRel,
    }
  );

  return {
    workspace,
    dbRel,
    dbAbs: path.resolve(dbRel),
  };
}

describe("AgentFSWorkspace (docker + sdk)", () => {
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
    "initializes container + executes inside it",
    async () => {
      const baseDir = createRepoTestDir("agentfs-container");
      dirs.push(baseDir);

      const runId = `agentfs-container-${Date.now().toString(36)}`;
      const agentId = `agent-${Math.random().toString(36).slice(2, 8)}`;

      const { workspace, dbAbs } = createWorkspace({
        repoRoot,
        baseDir,
        runId,
        agentId,
      });
      cleanupFns.push(() => workspace.cleanup());

      await workspace.initialize();

      expect(workspace.containerId).toBeTruthy();
      expect(workspace.containerName.startsWith("alfred-agentfs-")).toBe(true);

      const pwd = await workspace.exec("pwd");
      expect(pwd.exitCode).toBe(0);
      expect(pwd.stdout.trim()).toBe("/workspace");

      const envDb = await workspace.exec("echo $AGENTFS_DB_PATH");
      expect(envDb.exitCode).toBe(0);
      expect(envDb.stdout.trim()).toBe(workspace.dbPath);

      const envRun = await workspace.exec("echo $AGENTFS_RUN_ID");
      expect(envRun.exitCode).toBe(0);
      expect(envRun.stdout.trim()).toBe(runId);

      const envAgent = await workspace.exec("echo $AGENTFS_AGENT_ID");
      expect(envAgent.exitCode).toBe(0);
      expect(envAgent.stdout.trim()).toBe(agentId);

      await workspace.cleanup();
      expect(existsSync(dbAbs)).toBe(true);
    }
  );

  it.skipIf(!dockerReady)("respects exec cwd under /workspace", async () => {
    const baseDir = createRepoTestDir("agentfs-container-cwd");
    dirs.push(baseDir);

    const runId = `agentfs-container-cwd-${Date.now().toString(36)}`;
    const agentId = `agent-${Math.random().toString(36).slice(2, 8)}`;

    const { workspace } = createWorkspace({
      repoRoot,
      baseDir,
      runId,
      agentId,
    });
    cleanupFns.push(() => workspace.cleanup());

    await workspace.initialize();

    const rel = toPosixPath(path.relative(repoRoot, baseDir));
    const res = await workspace.exec("pwd", { cwd: rel });
    expect(res.exitCode).toBe(0);
    expect(res.stdout.trim()).toBe(`/workspace/${rel}`);
  });

  it.skipIf(!dockerReady)(
    "checkpoints and restores AgentFS state",
    async () => {
      const baseDir = createRepoTestDir("agentfs-container-checkpoint");
      dirs.push(baseDir);

      const runId = `agentfs-container-checkpoint-${Date.now().toString(36)}`;
      const agentId = `agent-${Math.random().toString(36).slice(2, 8)}`;

      const { workspace } = createWorkspace({
        repoRoot,
        baseDir,
        runId,
        agentId,
      });
      cleanupFns.push(() => workspace.cleanup());

      await workspace.initialize();

      await workspace.setKV("k", "v1");
      await workspace.checkpoint("a");
      await workspace.setKV("k", "v2");
      expect(await workspace.getKV<string>("k")).toBe("v2");

      await workspace.restore("a");
      expect(await workspace.getKV<string>("k")).toBe("v1");
    }
  );

  it.skipIf(!dockerReady)(
    "reuses container across workspaces in same run",
    async () => {
      const baseDir = createRepoTestDir("agentfs-container-reuse");
      dirs.push(baseDir);

      const runId = `agentfs-container-reuse-${Date.now().toString(36)}`;
      const a1 = `agent-${Math.random().toString(36).slice(2, 8)}`;
      const a2 = `agent-${Math.random().toString(36).slice(2, 8)}`;

      const w1 = createWorkspace({
        repoRoot,
        baseDir,
        runId,
        agentId: a1,
      }).workspace;
      const w2 = createWorkspace({
        repoRoot,
        baseDir,
        runId,
        agentId: a2,
      }).workspace;
      cleanupFns.push(() => w2.cleanup());
      cleanupFns.push(() => w1.cleanup());

      await w1.initialize();
      await w2.initialize();

      expect(w1.containerName).toBe(w2.containerName);
      expect(w1.containerId).toBeTruthy();
      expect(w2.containerId).toBeTruthy();
      expect(w1.containerId).toBe(w2.containerId);
    }
  );
});
