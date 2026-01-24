import { describe, expect, it } from "bun:test";

import { __internals } from "../src/orchestrator/tool/browser";

describe("browser tool internals", () => {
  it("derives session from runId when session is absent", () => {
    const session = __internals.resolveSessionName({
      action: "snapshot",
      runId: "abc-123",
    });
    expect(session).toBe("run-abc-123");
  });

  it("prefers explicit session over runId", () => {
    const session = __internals.resolveSessionName({
      action: "snapshot",
      runId: "abc-123",
      session: "my-session",
    });
    expect(session).toBe("my-session");
  });

  it("sanitizes session names to safe characters", () => {
    expect(__internals.sanitizeSessionName(" hi there ")).toBe("hi-there");
    expect(__internals.sanitizeSessionName("a/b\\c")).toBe("a-b-c");
  });

  it("builds snapshot args with defaults (interactive+compact, depth 6)", () => {
    const args = __internals.buildCommandArgs({
      action: "snapshot",
    });
    expect(args).toEqual(["snapshot", "-i", "-c", "-d", "6"]);
  });

  it("builds scoped snapshot args", () => {
    const args = __internals.buildCommandArgs({
      action: "snapshot",
      snapshot: { scope: "#main", depth: 3 },
    });
    expect(args).toEqual(["snapshot", "-i", "-c", "-d", "3", "-s", "#main"]);
  });

  it("builds open args with headers (no global flags embedded)", () => {
    const args = __internals.buildCommandArgs({
      action: "open",
      url: "https://example.com",
      headers: { Authorization: "Bearer test" },
    });
    expect(args.slice(0, 2)).toEqual(["open", "https://example.com"]);
    expect(args).toContain("--headers");
  });

  it("parses agent-browser JSON output", () => {
    const parsed = __internals.parseAgentBrowserJson(
      JSON.stringify({ success: true, data: { ok: true } })
    );
    expect(parsed).toEqual({ success: true, data: { ok: true } });
  });

  it("returns null for non-json output", () => {
    expect(__internals.parseAgentBrowserJson("not json")).toBeNull();
  });

  it("keeps artifacts within repo root", () => {
    const cwd = "/repo";
    const dir = __internals.resolveArtifactDir({
      cwd,
      session: "default",
      input: {
        action: "snapshot",
        runId: "r1",
        artifacts: { dir: "/tmp/outside" },
      },
    });
    expect(dir).toBe("/repo/.agent/artifacts/browser/r1");
  });
});
