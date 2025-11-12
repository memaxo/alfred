import { describe, expect, it, beforeEach, afterEach } from "bun:test";
import { ModelProcess, type ProcessConfig } from "../src/process/base";
import { __internals } from "../src/process/base";
import {
  saveEnvVars,
  restoreEnvVars,
  hasUv,
} from "./utils/python-helpers";

const { resolvePythonExecutable } = __internals;

describe("Environment Variable Overrides", () => {
  let savedEnv: Record<string, string | undefined>;
  let processInstance: ModelProcess;

  beforeEach(() => {
    savedEnv = saveEnvVars(["VOICE_USE_UV", "PYTHON_PATH"]);

    const config: ProcessConfig = {
      scriptPath: "/test/script.py",
      modelPath: "test-model",
    };
    processInstance = new ModelProcess(config);
  });

  afterEach(() => {
    restoreEnvVars(savedEnv);
  });

  it("should respect VOICE_USE_UV=false", async () => {
    const uvAvailable = await hasUv();
    process.env.VOICE_USE_UV = "false";
    delete process.env.PYTHON_PATH;

    const result = await resolvePythonExecutable(processInstance)();

    // Should skip UV even if available
    expect(result.cmd[0]).not.toContain("uv");
  });

  it("should auto-detect UV when VOICE_USE_UV unset", async () => {
    delete process.env.VOICE_USE_UV;
    delete process.env.PYTHON_PATH;

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
    delete process.env.PYTHON_PATH;

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

