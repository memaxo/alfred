import { describe, expect, it } from "bun:test";
import { spawn } from "bun";

describe("codex live verification (gated)", () => {
  it.skipIf(process.env.RUN_CODEX_LIVE !== "1")(
    "runs scripts/verify-codex-live.ts",
    async () => {
      const proc = spawn(["bun", "run", "scripts/verify-codex-live.ts"], {
        stdout: "inherit",
        stderr: "inherit",
        env: process.env,
      });
      const code = await proc.exited;
      expect(code).toBe(0);
    }
  );
});
