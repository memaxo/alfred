import { describe, expect, test } from "bun:test";

import { parseExecutorEvalsArgv } from "../src/config.js";

describe("config", () => {
  test("parses basic flags", () => {
    const cfg = parseExecutorEvalsArgv([
      "--confirm-cost",
      "--transport",
      "http",
      "--profiles",
      "server",
      "--strict",
      "--skip-build",
      "--retain",
      "always",
      "--image",
      "alfred-agentfs:codex",
      "--artifacts-dir",
      "/tmp/evals",
      "--authz",
      "Bearer xyz",
      "--skip-opencode",
    ]);

    expect(cfg.confirmCost).toBe(true);
    expect(cfg.transport).toBe("http");
    expect(cfg.profiles).toBe("server");
    expect(cfg.strict).toBe(true);
    expect(cfg.skipBuild).toBe(true);
    expect(cfg.retain).toBe("always");
    expect(cfg.image).toBe("alfred-agentfs:codex");
    expect(cfg.artifactsDir).toBe("/tmp/evals");
    expect(cfg.authz).toBe("Bearer xyz");
    expect(cfg.skip?.opencode).toBe(true);
  });
});
