import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  mock,
} from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";

// NOTE: Use beforeAll for module mocks so this file does not poison other test files
// during Bun's initial module load phase.
const spawnWithSecureCwdMock = mock(() => ({
  exited: Promise.resolve(0),
  kill: () => {},
  stderr: null,
  stdout: null,
}));

const resolveExecutableMock = mock((cmd: string) => `/usr/bin/${cmd}`);

let createCodexSpawn: typeof import("../src/orchestrator/tool/codex/spawn-process").createCodexSpawn;

beforeAll(async () => {
  mock.module("../src/security/secure-spawn.js", () => ({
    spawnWithSecureCwd: spawnWithSecureCwdMock,
  }));

  mock.module("../src/orchestrator/tool/codex/policy.js", () => ({
    resolveExecutable: resolveExecutableMock,
  }));

  ({ createCodexSpawn } =
    await import("../src/orchestrator/tool/codex/spawn-process"));
});

afterAll(() => {
  mock.restore();
});

function createMockCwdHandle(dirPath: string) {
  return {
    close: () => {},
    fd: 123,
    path: dirPath,
  };
}

describe("createCodexSpawn", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(path.join(os.tmpdir(), "codex-spawn-test-"));
    spawnWithSecureCwdMock.mockClear();
    resolveExecutableMock.mockClear();
    resolveExecutableMock.mockImplementation(
      (cmd: string) => `/usr/bin/${cmd}`
    );
  });

  afterEach(() => {
    rmSync(tempDir, { force: true, recursive: true });
  });

  describe("host mode", () => {
    it("creates host spawn function when no container", async () => {
      const cwdHandle = createMockCwdHandle(tempDir);
      const spawn = await createCodexSpawn({}, cwdHandle);

      spawn({
        args: ["--version"],
        cmd: "/usr/bin/codex",
        env: { PATH: "/usr/bin" },
      });

      expect(spawnWithSecureCwdMock).toHaveBeenCalledTimes(1);
      const call = spawnWithSecureCwdMock.mock.calls[0]?.[0];
      expect(call.cmd).toBe("/usr/bin/codex");
      expect(call.args).toEqual(["--version"]);
      expect(call.cwdHandle).toBe(cwdHandle);
    });

    it("injects AGENTFS_DB_PATH into env when provided", async () => {
      const cwdHandle = createMockCwdHandle(tempDir);
      const spawn = await createCodexSpawn(
        { agentfsDbPath: "/tmp/agentfs.db" },
        cwdHandle
      );

      spawn({
        args: ["--version"],
        cmd: "/usr/bin/codex",
        env: { CUSTOM_VAR: "value" },
      });

      expect(spawnWithSecureCwdMock).toHaveBeenCalledTimes(1);
      const call = spawnWithSecureCwdMock.mock.calls[0]?.[0];
      expect(call.env).toMatchObject({
        AGENTFS_DB_PATH: "/tmp/agentfs.db",
        CUSTOM_VAR: "value",
      });
    });

    it("returns wrapped process with stdout/stderr/exited/kill", async () => {
      const mockProc = {
        exited: Promise.resolve(0),
        kill: mock(() => {}),
        stderr: new ReadableStream(),
        stdout: new ReadableStream(),
      };
      spawnWithSecureCwdMock.mockReturnValue(mockProc);

      const cwdHandle = createMockCwdHandle(tempDir);
      const spawn = await createCodexSpawn({}, cwdHandle);
      const result = spawn({ args: [], cmd: "codex", env: {} });

      expect(result.stdout).toBe(mockProc.stdout);
      expect(result.stderr).toBe(mockProc.stderr);
      expect(result.exited).toBe(mockProc.exited);
      expect(typeof result.kill).toBe("function");
    });

    it("wraps kill with signal handling", async () => {
      const killMock = mock(() => {});
      spawnWithSecureCwdMock.mockReturnValue({
        exited: Promise.resolve(0),
        kill: killMock,
        stderr: null,
        stdout: null,
      });

      const cwdHandle = createMockCwdHandle(tempDir);
      const spawn = await createCodexSpawn({}, cwdHandle);
      const result = spawn({ args: [], cmd: "codex", env: {} });

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
        { containerName: "alfred-agentfs-container-abc" },
        cwdHandle
      );

      spawn({
        args: ["exec", "--prompt", "test"],
        cmd: "/usr/bin/codex",
        env: { CODEX_API_KEY: "key" },
      });

      expect(resolveExecutableMock).toHaveBeenCalledWith("docker");
      expect(spawnWithSecureCwdMock).toHaveBeenCalledTimes(1);

      const call = spawnWithSecureCwdMock.mock.calls[0]?.[0];
      expect(call.cmd).toBe("/usr/bin/docker");
      expect(call.args).toContain("exec");
      expect(call.args).toContain("--workdir");
      expect(call.args).toContain("/workspace");
      expect(call.args).toContain("alfred-agentfs-container-abc");
      expect(call.args).toContain("codex");
    });

    it("throws for containerName not matching AgentFS naming", () => {
      const cwdHandle = createMockCwdHandle(tempDir);
      expect(() =>
        createCodexSpawn({ containerName: "container-abc" }, cwdHandle)
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

      const call = spawnWithSecureCwdMock.mock.calls[0]?.[0];
      expect(call.args).toContain("--workdir");
      const workdirIdx = call.args.indexOf("--workdir");
      expect(call.args[workdirIdx + 1]).toBe("/workspace/subdir/project");
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
        { containerName: "alfred-agentfs-container-env" },
        cwdHandle
      );

      spawn({
        args: [],
        cmd: "codex",
        env: { CODEX_API_KEY: "key", CUSTOM_VAR: "value", PATH: "/usr/bin" },
      });

      const call = spawnWithSecureCwdMock.mock.calls[0]?.[0];
      expect(call.args).toContain("-e");
      expect(call.args).toContain("CODEX_API_KEY");
      expect(call.args).toContain("CUSTOM_VAR");
      // PATH should be filtered out
      expect(call.args).not.toContain("PATH");
    });

    it("injects AGENTFS_DB_PATH into docker env and -e flags when provided", async () => {
      const cwdHandle = createMockCwdHandle(tempDir);
      const spawn = await createCodexSpawn(
        {
          agentfsDbPath: "/tmp/agentfs.db",
          containerName: "alfred-agentfs-container-agentfs",
        },
        cwdHandle
      );

      spawn({
        args: [],
        cmd: "codex",
        env: { CODEX_API_KEY: "key" },
      });

      const call = spawnWithSecureCwdMock.mock.calls[0]?.[0];
      expect(call.env).toMatchObject({
        AGENTFS_DB_PATH: "/tmp/agentfs.db",
        CODEX_API_KEY: "key",
      });
      expect(call.args).toContain("AGENTFS_DB_PATH");
    });
  });

  describe("stdout/stderr handling", () => {
    it("returns null for numeric file descriptors", async () => {
      spawnWithSecureCwdMock.mockReturnValue({
        exited: Promise.resolve(0),
        kill: () => {},
        stderr: 2,
        stdout: 1,
      });

      const cwdHandle = createMockCwdHandle(tempDir);
      const spawn = await createCodexSpawn({}, cwdHandle);
      const result = spawn({ args: [], cmd: "codex", env: {} });

      expect(result.stdout).toBeNull();
      expect(result.stderr).toBeNull();
    });

    it("returns null for undefined streams", async () => {
      spawnWithSecureCwdMock.mockReturnValue({
        exited: Promise.resolve(0),
        kill: () => {},
        stderr: undefined,
        stdout: undefined,
      });

      const cwdHandle = createMockCwdHandle(tempDir);
      const spawn = await createCodexSpawn({}, cwdHandle);
      const result = spawn({ args: [], cmd: "codex", env: {} });

      expect(result.stdout).toBeNull();
      expect(result.stderr).toBeNull();
    });
  });
});
