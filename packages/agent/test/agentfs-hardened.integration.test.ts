// packages/agent/test/agentfs-hardened.integration.test.ts
import { installAuthTokenMock } from "@alfred/test-kit";

installAuthTokenMock();

import { afterEach, describe, expect, it } from "bun:test";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { AgentFSWorkspace } from "../src/environment/agentfs";
import { toolDocker } from "../src/orchestrator/tool/docker";
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
  dockerOk &&
  imageOk &&
  runCmd(["docker", "run", "--rm", IMAGE, "true"]).exitCode === 0;
const hardenedOk =
  dockerReady && process.env.ALFRED_RUN_AGENTFS_HARDENED === "1";

describe("AgentFS Hardening (RO Isolation + CoW)", () => {
  const cleanupFns: (() => Promise<void> | void)[] = [];
  const dirs: string[] = [];

  afterEach(async () => {
    for (const fn of cleanupFns.splice(0).toReversed()) {
      try {
        await fn();
      } catch {}
    }
    for (const dir of dirs.splice(0)) {
      cleanupTestDir(dir);
    }
  });

  it.skipIf(!hardenedOk)(
    "prevents mutations to host repo while allowing changes in CoW workspace",
    async () => {
      const testDir = createRepoTestDir("agentfs-hardened");
      const absTestDir = path.resolve(testDir);
      console.log("Test dir (host):", absTestDir);
      console.log("Test dir exists:", existsSync(absTestDir));
      console.log("Repo root:", process.cwd());
      console.log(
        "Test dir is under repo root:",
        absTestDir.startsWith(process.cwd())
      );
      dirs.push(testDir);

      const canaryFile = path.join(absTestDir, "canary.txt");
      writeFileSync(canaryFile, "original content");
      console.log(
        "Host canary file:",
        canaryFile,
        "exists:",
        existsSync(canaryFile)
      );
      console.log("Host testDir content:", readdirSync(testDir));

      const runId = `hardened-${Date.now().toString(36)}`;
      const agentId = "agent-1";

      // Ensure database directory is clean before creating workspace
      const dbDir = path.join(absTestDir, ".agentfs", runId);
      if (existsSync(dbDir)) {
        const { rmSync } = await import("node:fs");
        rmSync(dbDir, { recursive: true, force: true });
      }

      const workspace = new AgentFSWorkspace(agentId, runId, absTestDir, {
        authz: AUTHZ,
        image: IMAGE,
        dbPath: path.join(".agentfs", runId, "agentfs.db"),
      });
      cleanupFns.push(() => workspace.cleanup());

      try {
        await workspace.initialize();
        // Small delay to ensure container is fully started
        await new Promise((resolve) => setTimeout(resolve, 1000));
      } catch (error) {
        console.error("Initialize error:", error);
        // Check if container exists with any name pattern
        const allContainers = runCmd([
          "docker",
          "ps",
          "-a",
          "--format",
          "{{.Names}}",
        ]);
        console.log("All containers:", allContainers.stdout);
        const rawDockerPs = runCmd([
          "docker",
          "ps",
          "-a",
          "--filter",
          `name=${workspace.containerName}`,
          "--format",
          "{{.ID}} {{.Names}} {{.Status}}",
        ]);
        console.log("Raw docker ps (on error):", rawDockerPs.stdout);
        throw error;
      }

      // Check container ID directly from workspace
      console.log("Workspace containerId:", workspace.containerId);
      console.log("Workspace containerName:", workspace.containerName);

      // Also check what docker actually sees
      const rawDockerPs = runCmd([
        "docker",
        "ps",
        "-a",
        "--filter",
        `name=${workspace.containerName}`,
        "--format",
        "{{.ID}} {{.Names}} {{.Status}}",
      ]);
      console.log("Raw docker ps:", rawDockerPs.stdout);
      if (rawDockerPs.stdout.trim()) {
        console.log("Container EXISTS in docker!");
      } else {
        console.log("Container DOES NOT EXIST in docker");
      }

      // Verify container was created and is running
      const initialInspect = await toolDocker.execute({
        input: {
          action: "inspect",
          name: workspace.containerName,
          authz: AUTHZ,
          cw: absTestDir,
        },
      });
      console.log(
        "After init - Container ID:",
        initialInspect.details?.containerId
      );
      console.log(
        "After init - Container running:",
        initialInspect.details?.running
      );

      if (!initialInspect.details?.running) {
        const logsRes = await toolDocker.execute({
          input: {
            action: "logs",
            name: workspace.containerName,
            authz: AUTHZ,
            cw: absTestDir,
            tail: 100,
          },
        });
        console.error("Container not running. Logs:", logsRes.details?.text);
        throw new Error("Container not running after initialization");
      }

      const inspectRes = await toolDocker.execute({
        input: {
          action: "inspect",
          name: workspace.containerName,
          authz: AUTHZ,
          cw: absTestDir,
        },
      });
      console.log("Container running:", inspectRes.details?.running);
      console.log("Container state:", inspectRes.details);
      if (!inspectRes.details?.running) {
        const logsRes = await toolDocker.execute({
          input: {
            action: "logs",
            name: workspace.containerName,
            authz: AUTHZ,
            cw: absTestDir,
            tail: 100,
          },
        });
        console.error("Container exited. Logs:", logsRes.details?.text);
      }

      // Wait for setup-workspace.sh to finish the mount inside the container
      await new Promise((resolve) => setTimeout(resolve, 5000));

      const lsBaseRes = await workspace.exec("ls -la /workspace.base");
      console.log("LS /workspace.base:", lsBaseRes.stdout);

      const lsRes = await workspace.exec("ls -la /workspace");
      console.log("LS /workspace:", lsRes.stdout);

      // Check if mount is active
      const mountRes = await workspace.exec(
        "mountpoint /workspace || mount | grep workspace"
      );
      console.log("Mount check:", mountRes.stdout);

      // Attempt to modify the canary file inside the container
      // First, read it to trigger AgentFS lazy loading from base
      const readRes = await workspace.exec("cat /workspace/canary.txt");
      console.log(
        "Read canary (should be 'original content'):",
        readRes.stdout
      );
      expect(readRes.exitCode).toBe(0);
      expect(readRes.stdout.trim()).toBe("original content");

      // Now modify it in the CoW view
      const modifyRes = await workspace.exec(
        "echo 'mutated content' > /workspace/canary.txt"
      );
      if (modifyRes.exitCode !== 0) {
        console.error("Modify failed:", modifyRes.stderr);
        const logsRes = await toolDocker.execute({
          input: {
            action: "logs",
            name: workspace.containerName,
            authz: AUTHZ,
            cw: absTestDir,
          },
        });
        console.error("Container logs:", logsRes.details?.text);
      }
      expect(modifyRes.exitCode).toBe(0);

      // Verify it's mutated inside the CoW view
      const catRes = await workspace.exec("cat /workspace/canary.txt");
      expect(catRes.stdout.trim()).toBe("mutated content");

      // CRITICAL: Verify the host file remains UNTOUCHED
      const hostContent = readFileSync(canaryFile, "utf8");
      expect(hostContent).toBe("original content");

      // Verify diff API shows the change
      const diff = await workspace.diff();
      const canaryChange = diff.find(
        (c: any) => c.path === "/canary.txt" || c.path === "canary.txt"
      );
      expect(canaryChange).toBeTruthy();
      expect(canaryChange.type).toBe("modified");
    },
    { timeout: 30_000 }
  );
});
