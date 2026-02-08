import { afterEach, beforeEach, describe, expect, it, vi } from "bun:test";
import path from "node:path";

import * as codexPolicy from "../src/orchestrator/tool/codex/policy";
import { createCodexSpawn } from "../src/orchestrator/tool/codex/spawn-process";

function createMockCwdHandle(dirPath: string) {
  return {
    close: () => {},
    fd: 123,
    path: dirPath,
  };
}

describe("createCodexSpawn", () => {
  let tempDir: string;
  let dockerBin: string;
  let spawnSpy: ReturnType<typeof vi.spyOn> | null = null;
  let resolveExecutableSpy: ReturnType<typeof vi.spyOn> | null = null;

  beforeEach(() => {
    tempDir = path.join("/tmp", `codex-spawn-test-${Date.now()}`);
    dockerBin = path.join(tempDir, "docker");
    process.env.ORCH_SKIP_SECURE_SPAWN = "1";

    spawnSpy = vi.spyOn(Bun, "spawn").mockImplementation(() => ({
      exited: Promise.resolve(0),
      kill: () => {},
      stderr: null,
      stdout: null,
      stdin: null,
    }));

    resolveExecutableSpy = vi
      .spyOn(codexPolicy, "resolveExecutable")
      .mockReturnValue(dockerBin);
  });

  afterEach(() => {
    spawnSpy?.mockRestore();
    spawnSpy = null;
    resolveExecutableSpy?.mockRestore();
    resolveExecutableSpy = null;
    process.env.ORCH_SKIP_SECURE_SPAWN = undefined;
  });

  describe("docker mode", () => {
    it("creates docker spawn with container ID", async () => {
      const cwdHandle = createMockCwdHandle(tempDir);
      const spawn = await createCodexSpawn(
        {
          containerCw: "/workspace",
          containerName: "alfred-agentfs-container-abc",
        },
        cwdHandle
      );

      spawn({
        args: ["exec", "--prompt", "test"],
        cmd: "/usr/bin/codex",
        env: { CODEX_API_KEY: "key" },
      });

      expect(spawnSpy).toHaveBeenCalledTimes(1);

      const call = spawnSpy?.mock.calls[0];
      const spawnArgs = call?.[0] as string[] | undefined;
      expect(spawnArgs?.[0]).toBe(dockerBin);
      expect(spawnArgs).toContain("exec");
      expect(spawnArgs).toContain("--workdir");
      expect(spawnArgs).toContain("/workspace");
      expect(spawnArgs).toContain("alfred-agentfs-container-abc");
      expect(spawnArgs).toContain("codex");
    });

    it("throws for containerName not matching AgentFS naming", () => {
      const cwdHandle = createMockCwdHandle(tempDir);
      expect(() =>
        createCodexSpawn(
          { containerCw: "/workspace", containerName: "container-abc" },
          cwdHandle
        )
      ).toThrow("codex_container_name_invalid");
    });

    it("uses containerCw as workdir when provided", async () => {
      const cwdHandle = createMockCwdHandle(tempDir);
      const spawn = await createCodexSpawn(
        {
          containerCw: "/workspace/subdir/project",
          containerName: "alfred-agentfs-container-xyz",
        },
        cwdHandle
      );

      spawn({ args: [], cmd: "codex", env: {} });

      const call = spawnSpy?.mock.calls[0];
      const spawnArgs = call?.[0] as string[] | undefined;
      expect(spawnArgs).toContain("--workdir");
      const workdirIdx = spawnArgs?.indexOf("--workdir") ?? -1;
      expect(spawnArgs?.[workdirIdx + 1]).toBe("/workspace/subdir/project");
    });

    it("throws for containerCw not under /workspace", async () => {
      const cwdHandle = createMockCwdHandle(tempDir);
      const spawn = await createCodexSpawn(
        {
          containerCw: "/tmp/escape",
          containerName: "alfred-agentfs-container-bad",
        },
        cwdHandle
      );

      expect(() => spawn({ args: [], cmd: "codex", env: {} })).toThrow(
        "codex_container_cwd_invalid"
      );
    });

    it("passes environment variables with -e flags", async () => {
      const cwdHandle = createMockCwdHandle(tempDir);
      const spawn = await createCodexSpawn(
        {
          containerCw: "/workspace",
          containerName: "alfred-agentfs-container-env",
        },
        cwdHandle
      );

      spawn({
        args: [],
        cmd: "codex",
        env: { CODEX_API_KEY: "key", CUSTOM_VAR: "value", PATH: "/usr/bin" },
      });

      const call = spawnSpy?.mock.calls[0];
      const spawnArgs = call?.[0] as string[] | undefined;
      expect(spawnArgs).toContain("-e");
      expect(spawnArgs).toContain("CODEX_API_KEY");
      expect(spawnArgs).toContain("CUSTOM_VAR");
      // PATH should be filtered out
      expect(spawnArgs).not.toContain("PATH");
    });

    it("injects AGENTFS_DB_PATH into docker env and -e flags when provided", async () => {
      const cwdHandle = createMockCwdHandle(tempDir);
      const spawn = await createCodexSpawn(
        {
          agentfsDbPath: "/tmp/agentfs.db",
          containerCw: "/workspace",
          containerName: "alfred-agentfs-container-agentfs",
        },
        cwdHandle
      );

      spawn({
        args: [],
        cmd: "codex",
        env: { CODEX_API_KEY: "key" },
      });

      const call = spawnSpy?.mock.calls[0];
      const spawnOptions = call?.[1] as { env?: Record<string, string> };
      const spawnArgs = call?.[0] as string[] | undefined;
      expect(spawnOptions?.env).toMatchObject({
        AGENTFS_DB_PATH: "/tmp/agentfs.db",
        CODEX_API_KEY: "key",
      });
      expect(spawnArgs).toContain("AGENTFS_DB_PATH");
    });
  });

  describe("stdout/stderr handling", () => {
    it("returns null for numeric file descriptors", async () => {
      spawnSpy?.mockReturnValueOnce({
        exited: Promise.resolve(0),
        kill: () => {},
        stderr: 2,
        stdout: 1,
      });

      const cwdHandle = createMockCwdHandle(tempDir);
      const spawn = await createCodexSpawn(
        {
          containerCw: "/workspace",
          containerName: "alfred-agentfs-container-stdout",
        },
        cwdHandle
      );
      const result = spawn({ args: [], cmd: "codex", env: {} });

      expect(result.stdout).toBeNull();
      expect(result.stderr).toBeNull();
    });

    it("returns null for undefined streams", async () => {
      spawnSpy?.mockReturnValueOnce({
        exited: Promise.resolve(0),
        kill: () => {},
        stderr: undefined,
        stdout: undefined,
      });

      const cwdHandle = createMockCwdHandle(tempDir);
      const spawn = await createCodexSpawn(
        {
          containerCw: "/workspace",
          containerName: "alfred-agentfs-container-stdout2",
        },
        cwdHandle
      );
      const result = spawn({ args: [], cmd: "codex", env: {} });

      expect(result.stdout).toBeNull();
      expect(result.stderr).toBeNull();
    });
  });
});
