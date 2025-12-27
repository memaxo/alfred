import { beforeEach, describe, expect, it, mock } from "bun:test";

// Use shared test utilities - install BEFORE importing tool modules.
import {
  authTokenMocks,
  installAuthTokenMock,
  resetAuthTokenMocks,
} from "@alfred/test-kit/auth/token";
import { installLoggerMock } from "@alfred/test-kit/logger";

installAuthTokenMock();
installLoggerMock();

const mockListRuns = mock();
const mockGetRun = mock();
const mockListEvents = mock();
const mockSearchEvents = mock();

mock.module("@alfred/db/repo/codex-run", () => ({
  listRuns: mockListRuns,
  getRun: mockGetRun,
  listEvents: mockListEvents,
  searchEvents: mockSearchEvents,
}));

const { toolCodexlog } = await import("../src/orchestrator/tool/codexlog");

describe("codexlog tool", () => {
  beforeEach(() => {
    resetAuthTokenMocks();
    mockListRuns.mockReset();
    mockGetRun.mockReset();
    mockListEvents.mockReset();
    mockSearchEvents.mockReset();

    authTokenMocks.requireToolScopesAndPolicy.mockResolvedValue({
      decision: { allow: true },
      claims: {
        sub: "test-user",
        scopes: ["codex.read"],
        elevated: true,
        mfa: "passkey",
      },
    });
  });

  it("lists runs for the token subject", async () => {
    mockListRuns.mockResolvedValueOnce([
      {
        id: "00000000-0000-4000-8000-000000000001",
        userId: "test-user",
        resultText: "ok",
      },
    ]);

    const out = await toolCodexlog.execute({
      input: { action: "list", limit: 10 },
    });

    expect(out).toMatchObject({ action: "list" });
    expect(mockListRuns).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "test-user", limit: 10 })
    );
  });

  it("enforces ownership when fetching a run", async () => {
    mockGetRun.mockResolvedValueOnce({
      id: "00000000-0000-4000-8000-000000000002",
      userId: "other-user",
      resultText: "ok",
    });

    await expect(
      toolCodexlog.execute({
        input: {
          action: "get",
          runId: "00000000-0000-4000-8000-000000000002",
        },
      })
    ).rejects.toThrow("codexlog_forbidden");
  });

  it("extracts thought reasoning from persisted events and redacts secrets", async () => {
    const runId = "00000000-0000-4000-8000-000000000003";
    mockGetRun.mockResolvedValueOnce({
      id: runId,
      userId: "test-user",
      artifacts: [],
    });
    mockListEvents.mockResolvedValueOnce([
      {
        id: "00000000-0000-4000-8000-000000000010",
        runId,
        seq: 1,
        eventType: "alfred_event",
        eventData: {
          type: "codex_event",
          event: {
            type: "thought",
            content: "sk-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
          },
        },
        text: null,
        createdAt: new Date("2025-12-20T00:00:00.000Z"),
      },
    ]);

    const out = await toolCodexlog.execute({
      input: { action: "reasoning", runId, limit: 50 },
    });

    expect(out).toMatchObject({ action: "reasoning" });
    const result = out as {
      action: "reasoning";
      reasoning: Array<{ text: string }>;
    };
    expect(result.reasoning).toHaveLength(1);
    expect(result.reasoning[0]?.text).not.toContain(
      "sk-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"
    );
  });
});
