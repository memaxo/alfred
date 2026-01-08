import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "bun:test";
import { join } from "node:path";
import {
  __internals,
  ModelProcess,
  type ProcessConfig,
} from "../src/process/base";
import { hasUv, restoreEnvVars, saveEnvVars } from "./utils/python-helpers";

const { resolvePythonExecutable } = __internals;

describe("Environment Variable Overrides", () => {
  let savedEnv: Record<string, string | undefined>;

  // ProcessInstance is immutable - create once
  let processInstance: ModelProcess;

  beforeAll(() => {
    const voiceDir = join(process.cwd(), "packages", "voice");
    const config: ProcessConfig = {
      // Needs to be under packages/voice so uv is eligible.
      scriptPath: join(voiceDir, "scripts", "test.py"),
      modelPath: "test-model",
    };
    processInstance = new ModelProcess(config);
  });

  beforeEach(() => {
    // Save env vars before each test (they get mutated)
    savedEnv = saveEnvVars(["VOICE_USE_UV", "PYTHON_PATH"]);
  });

  afterEach(() => {
    restoreEnvVars(savedEnv);
  });

  it("should respect VOICE_USE_UV=false", async () => {
    const _uvAvailable = await hasUv();
    process.env.VOICE_USE_UV = "false";
    process.env.PYTHON_PATH = undefined;

    const result = await resolvePythonExecutable(processInstance)();

    // Should skip UV even if available
    expect(result.cmd[0]).not.toContain("uv");
  });

  it("should auto-detect UV when VOICE_USE_UV unset", async () => {
    process.env.VOICE_USE_UV = undefined;
    process.env.PYTHON_PATH = undefined;

    const uvAvailable = await hasUv();
    if (uvAvailable) {
      const result = await resolvePythonExecutable(processInstance)();
      // May use UV if available
      expect(result.cmd).toBeDefined();
    } else {
      // Should fallback to venv or system Python
      const result = await resolvePythonExecutable(processInstance)();
      expect(result.cmd[0]).not.toContain("uv");
    }
  });

  it("should use UV when VOICE_USE_UV=true", async () => {
    process.env.VOICE_USE_UV = "true";
    process.env.PYTHON_PATH = undefined;

    const uvAvailable = await hasUv();
    if (uvAvailable) {
      const result = await resolvePythonExecutable(processInstance)();
      expect(result.cmd[0]).toContain("uv");
    } else {
      // Should fallback if UV not available
      const result = await resolvePythonExecutable(processInstance)();
      expect(result.cmd[0]).not.toContain("uv");
    }
  });

  it("should respect PYTHON_PATH override", async () => {
    process.env.VOICE_USE_UV = "false";
    process.env.PYTHON_PATH = "/custom/python";

    const result = await resolvePythonExecutable(processInstance)();

    expect(result.cmd[0]).toBe("/custom/python");
  });
});
