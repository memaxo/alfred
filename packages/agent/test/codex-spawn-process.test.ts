import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync, chmodSync } from "node:fs";
import os from "node:os";
import path from "node:path";

// Mock the secure spawn to avoid actual process spawning
const spawnWithSecureCwdMock = mock(() => ({
  stdout: null,
  stderr: null,
  exited: Promise.resolve(0),
  kill: () => {},
}));

mock.module("../src/security/secure-spawn.js", () => ({
  spawnWithSecureCwd: spawnWithSecureCwdMock,
}));

// Mock resolveExecutable to return predictable paths
const resolveExecutableMock = mock((cmd: string) => `/usr/bin/${cmd}`);

mock.module("../src/orchestrator/tool/codex/policy.js", () => ({
  resolveExecutable: resolveExecutableMock,
}));

const { createCodexSpawn } = await import(
  "../src/orchestrator/tool/codex/spawn-process"
);

function createMockCwdHandle(dirPath: string) {
  return {
    path: dirPath,
    fd: 123,
    close: () => {},
  };
}

describe("createCodexSpawn", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(path.join(os.tmpdir(), "codex-spawn-test-"));
    spawnWithSecureCwdMock.mockClear();
    resolveExecutableMock.mockClear();
    resolveExecutableMock.mockImplementation((cmd: string) => `/usr/bin/${cmd}`);
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  describe("host mode", () => {
    it("creates host spawn function when no container or poof", async () => {
      const cwdHandle = createMockCwdHandle(tempDir);
      const spawn = await createCodexSpawn({}, cwdHandle);

      spawn({ cmd: "/usr/bin/codex", args: ["--version"], env: { PATH: "/usr/bin" } });

      expect(spawnWithSecureCwdMock).toHaveBeenCalledTimes(1);
      const call = spawnWithSecureCwdMock.mock.calls[0]?.[0];
      expect(call.cmd).toBe("/usr/bin/codex");
      expect(call.args).toEqual(["--version"]);
      expect(call.cwdHandle).toBe(cwdHandle);
    });

    it("returns wrapped process with stdout/stderr/exited/kill", async () => {
      const mockProc = {
        stdout: new ReadableStream(),
        stderr: new ReadableStream(),
        exited: Promise.resolve(0),
        kill: mock(() => {}),
      };
      spawnWithSecureCwdMock.mockReturnValue(mockProc);

      const cwdHandle = createMockCwdHandle(tempDir);
      const spawn = await createCodexSpawn({}, cwdHandle);
      const result = spawn({ cmd: "codex", args: [], env: {} });

      expect(result.stdout).toBe(mockProc.stdout);
      expect(result.stderr).toBe(mockProc.stderr);
      expect(result.exited).toBe(mockProc.exited);
      expect(typeof result.kill).toBe("function");
    });

    it("wraps kill with signal handling", async () => {
      const killMock = mock(() => {});
      spawnWithSecureCwdMock.mockReturnValue({
        stdout: null,
        stderr: null,
        exited: Promise.resolve(0),
        kill: killMock,
      });

      const cwdHandle = createMockCwdHandle(tempDir);
      const spawn = await createCodexSpawn({}, cwdHandle);
      const result = spawn({ cmd: "codex", args: [], env: {} });

      result.kill(9);
      expect(killMock).toHaveBeenCalledWith(9);

      killMock.mockClear();
      result.kill("SIGTERM");
      expect(killMock).toHaveBeenCalledWith("SIGTERM");

      killMock.mockClear();
      result.kill();
      expect(killMock).toHaveBeenCalledWith();
    });
  });

  describe("docker mode", () => {
    it("creates docker spawn with container ID", async () => {
      const cwdHandle = createMockCwdHandle(tempDir);
      const spawn = await createCodexSpawn(
        { containerId: "container-abc" },
        cwdHandle
      );

      spawn({ cmd: "/usr/bin/codex", args: ["exec", "--prompt", "test"], env: { CODEX_API_KEY: "key" } });

      expect(resolveExecutableMock).toHaveBeenCalledWith("docker");
      expect(spawnWithSecureCwdMock).toHaveBeenCalledTimes(1);

      const call = spawnWithSecureCwdMock.mock.calls[0]?.[0];
      expect(call.cmd).toBe("/usr/bin/docker");
      expect(call.args).toContain("exec");
      expect(call.args).toContain("--workdir");
      expect(call.args).toContain("/workspace");
      expect(call.args).toContain("container-abc");
      expect(call.args).toContain("codex");
    });

    it("uses containerCw as workdir when provided", async () => {
      const cwdHandle = createMockCwdHandle(tempDir);
      const spawn = await createCodexSpawn(
        {
          containerId: "container-xyz",
          containerCw: "/workspace/subdir/project",
        },
        cwdHandle
      );

      spawn({ cmd: "codex", args: [], env: {} });

      const call = spawnWithSecureCwdMock.mock.calls[0]?.[0];
      expect(call.args).toContain("--workdir");
      const workdirIdx = call.args.indexOf("--workdir");
      expect(call.args[workdirIdx + 1]).toBe("/workspace/subdir/project");
    });

    it("throws for containerCw not under /workspace", async () => {
      const cwdHandle = createMockCwdHandle(tempDir);
      const spawn = await createCodexSpawn(
        {
          containerId: "container-bad",
          containerCw: "/tmp/escape",
        },
        cwdHandle
      );

      expect(() => spawn({ cmd: "codex", args: [], env: {} })).toThrow(
        "codex_container_cwd_invalid"
      );
    });

    it("passes environment variables with -e flags", async () => {
      const cwdHandle = createMockCwdHandle(tempDir);
      const spawn = await createCodexSpawn(
        { containerId: "container-env" },
        cwdHandle
      );

      spawn({
        cmd: "codex",
        args: [],
        env: { CODEX_API_KEY: "key", CUSTOM_VAR: "value", PATH: "/usr/bin" },
      });

      const call = spawnWithSecureCwdMock.mock.calls[0]?.[0];
      expect(call.args).toContain("-e");
      expect(call.args).toContain("CODEX_API_KEY");
      expect(call.args).toContain("CUSTOM_VAR");
      // PATH should be filtered out
      expect(call.args).not.toContain("PATH");
    });
  });

  describe("stdout/stderr handling", () => {
    it("returns null for numeric file descriptors", async () => {
      spawnWithSecureCwdMock.mockReturnValue({
        stdout: 1,
        stderr: 2,
        exited: Promise.resolve(0),
        kill: () => {},
      });

      const cwdHandle = createMockCwdHandle(tempDir);
      const spawn = await createCodexSpawn({}, cwdHandle);
      const result = spawn({ cmd: "codex", args: [], env: {} });

      expect(result.stdout).toBeNull();
      expect(result.stderr).toBeNull();
    });

    it("returns null for undefined streams", async () => {
      spawnWithSecureCwdMock.mockReturnValue({
        stdout: undefined,
        stderr: undefined,
        exited: Promise.resolve(0),
        kill: () => {},
      });

      const cwdHandle = createMockCwdHandle(tempDir);
      const spawn = await createCodexSpawn({}, cwdHandle);
      const result = spawn({ cmd: "codex", args: [], env: {} });

      expect(result.stdout).toBeNull();
      expect(result.stderr).toBeNull();
    });
  });
});
