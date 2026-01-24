// Install auth mock BEFORE other imports
import { installAuthTokenMock } from "@alfred/test-kit";

installAuthTokenMock();

import { describe, expect, it, mock } from "bun:test";
import path from "node:path";

import { AgentFSWorkspace } from "../src/environment/agentfs";
import { executeWithOpenCode } from "../src/orchestrator/tool/opencode/exec";
import {
  cleanupTestDir,
  createRepoTestDir,
  isDockerAvailable,
  isImageAvailable,
} from "./utils/infra";

const IMAGE = "alfred-agentfs:codex";
const AUTHZ = "test-authz";

const dockerOk = isDockerAvailable();
const imageOk = dockerOk && isImageAvailable(IMAGE);

function hasZenKey(): boolean {
  return (
    typeof process.env.OPENCODE_API_KEY === "string" &&
    process.env.OPENCODE_API_KEY.trim().length > 0
  );
}

function e2eEnabled(): boolean {
  const v = (process.env.ALFRED_OPENCODE_E2E ?? "").trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

describe("OpenCode Zen (grok-code) via ACP (integration)", () => {
  it.skipIf(!(dockerOk && imageOk && e2eEnabled() && hasZenKey()))(
    "runs a minimal prompt against opencode/grok-code in AgentFS container",
    async () => {
      const repoRoot = process.cwd();
      const baseDir = createRepoTestDir("opencode-zen");
      const runId = `opencode-zen-${Date.now().toString(36)}`;
      const agentId = `agent-${Math.random().toString(36).slice(2, 8)}`;

      const relBase = path.relative(repoRoot, baseDir);
      const dbRel = path.join(relBase, ".agentfs", runId, "agentfs.db");

      const workspace = new AgentFSWorkspace(agentId, runId, repoRoot, {
        authz: AUTHZ,
        image: IMAGE,
        dbPath: dbRel,
      });

      try {
        await workspace.initialize();

        // Ensure OpenCode doesn't try to self-update in CI/dev.
        process.env.OPENCODE_DISABLE_AUTOUPDATE = "1";

        const writer = { write: mock(() => {}) };

        const out = await executeWithOpenCode({
          input: {
            action: "exec",
            execProfile: "server",
            prompt:
              "Reply with exactly the token: ZEN_OK (no punctuation, no extra words).",
            auto: "read",
            model: "opencode/grok-code",
            containerName: workspace.containerName,
            containerCw: "/workspace",
            // OpenCode ACP entrypoint:
            cmd: "opencode",
            args: ["acp"],
            timeoutSec: 120,
          },
          writer,
          signal: new AbortController().signal,
        });

        expect(out.result.toUpperCase()).toContain("ZEN_OK");
      } finally {
        await workspace.cleanup().catch(() => {});
        cleanupTestDir(baseDir);
      }
    }
  );
});
