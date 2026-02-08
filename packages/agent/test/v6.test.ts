import { describe, expect, it } from "bun:test";

const { codexInputSchema } =
  await import("../src/orchestrator/tool/codex/definition");
const { opencodeInputSchema } =
  await import("../src/orchestrator/tool/opencode/definition");

describe("v6 tool registry guards", () => {
  it("v6 imports modern codex + opencode tools", async () => {
    const v6Path = new URL("../src/v6.ts", import.meta.url);
    const src = await Bun.file(v6Path).text();

    expect(src).toContain(
      'import { toolCodex } from "./orchestrator/tool/codex/index";'
    );
    expect(src).toContain(
      'import { toolOpenCode } from "./orchestrator/tool/opencode";'
    );
  });

  it("opencode input schema preserves transport + execProfile", () => {
    const parsed = opencodeInputSchema.parse({
      action: "exec",
      auto: "read",
      containerCw: "/workspace",
      containerName: "alfred-agentfs-test",
      execProfile: "server",
      prompt: "hi",
      transport: "http",
    });

    expect(parsed.transport).toBe("http");
    expect(parsed.execProfile).toBe("server");
  });

  it("codex input schema preserves execProfile", () => {
    const parsed = codexInputSchema.parse({
      action: "exec",
      auto: "read",
      containerCw: "/workspace",
      containerName: "alfred-agentfs-test",
      execProfile: "server",
      out: "text",
      prompt: "hi",
    });

    expect(parsed.execProfile).toBe("server");
  });
});
