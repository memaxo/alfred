import { beforeEach, describe, expect, it, mock } from "bun:test";

const requireToolScopesAndPolicyMock = mock(async () => ({}));

mock.module("@alfred/auth/token", () => ({
  requireToolScopesAndPolicy: requireToolScopesAndPolicyMock,
}));

describe("toolOpenCode policy", () => {
  beforeEach(() => {
    requireToolScopesAndPolicyMock.mockClear();
  });

  it("enforces droid.exec scope for OpenCode execution", async () => {
    const { enforcePolicy } = await import("./policy.js");

    await enforcePolicy({
      action: "exec",
      prompt: "hi",
      auto: "low",
      authz: "Bearer token",
    });

    expect(requireToolScopesAndPolicyMock).toHaveBeenCalledTimes(1);
    const call = requireToolScopesAndPolicyMock.mock.calls[0];
    expect(call?.[1]).toEqual(["droid.exec"]);
    expect(call?.[2]).toMatchObject({
      action: "droid.exec",
      resource: { kind: "repo" },
    });
  });

  it("validates minimal input schema", async () => {
    const { opencodeInputSchema } = await import("./definition.js");
    const parsed = opencodeInputSchema.parse({
      action: "exec",
      prompt: "hello",
    });
    expect(parsed.action).toBe("exec");
    expect(parsed.prompt).toBe("hello");
    expect(parsed.auto).toBe("read");
  });
});
