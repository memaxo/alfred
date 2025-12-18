import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { __internals } from "../src/orchestrator/tool/codex/exec";

const { createFilesystemThreadValidatorForTests } = __internals;

describe("filesystem thread validator fallback", () => {
  let tempHome: string;

  beforeEach(() => {
    tempHome = mkdtempSync(path.join(os.tmpdir(), "codex-validator-"));
  });

  afterEach(() => {
    rmSync(tempHome, { recursive: true, force: true });
  });

  it("returns true when the thread file exists", async () => {
    const sessionsDir = path.join(tempHome, "sessions");
    mkdirSync(sessionsDir, { recursive: true });
    writeFileSync(path.join(sessionsDir, "thread-abc.json"), "{}");

    const validator = createFilesystemThreadValidatorForTests(tempHome);
    expect(validator).toBeDefined();
    const result = await validator?.("thread-abc");
    expect(result).toBe(true);
  });

  it("returns false when the thread file is missing", async () => {
    const sessionsDir = path.join(tempHome, "sessions");
    mkdirSync(sessionsDir, { recursive: true });

    const validator = createFilesystemThreadValidatorForTests(tempHome);
    expect(validator).toBeDefined();
    const result = await validator?.("missing-thread");
    expect(result).toBe(false);
  });

  it("rejects invalid thread identifiers", async () => {
    const sessionsDir = path.join(tempHome, "sessions");
    mkdirSync(sessionsDir, { recursive: true });
    writeFileSync(path.join(sessionsDir, "thread-abc.json"), "{}");

    const validator = createFilesystemThreadValidatorForTests(tempHome);
    expect(validator).toBeDefined();
    const result = await validator?.("../../../etc/passwd");
    expect(result).toBe(false);
  });
});
