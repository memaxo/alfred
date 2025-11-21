import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  mock,
  vi,
} from "bun:test";
import { metricsStub } from "./utils/mock-metrics";

const emitMock = mock((type: string, params: unknown) => ({
  type,
  params,
}));
async function emitLinearActivityStub(
  type: string,
  params: unknown
): Promise<{ ok: boolean; id?: string }> {
  emitMock(type, params);
  return { ok: true, id: `${type}-activity` };
}
const delegateMock = mock(async () => {});
const startedMock = mock(async () => ({ stateId: "state-id" }));
const externalUrlMock = mock(async () => {});

mock.module("@alfred/agent/orchestrator/linear", () => ({
  __esModule: true,
  emitLinearActivity: emitLinearActivityStub,
  setLinearDelegate: delegateMock,
  setLinearStarted: startedMock,
  setLinearSessionExternalUrl: externalUrlMock,
  extractIssueIdFromSession: (sessionId: string) => sessionId,
}));

mock.module("@alfred/api/metrics", () => ({
  __esModule: true,
  ...metricsStub,
  runnerStepsTotal: { inc: vi.fn() },
  runnerErrorsTotal: { inc: vi.fn() },
  linearActivityEmissionsTotal: { inc: vi.fn() },
  linearActivityDurationSeconds: { startTimer: () => () => {} },
  linearSessionOperationsTotal: { inc: vi.fn() },
}));

const { runPlanV6 } = await import("@alfred/api/workflow/runner");

async function collectEvents<T>(gen: AsyncGenerator<T>): Promise<T[]> {
  const results: T[] = [];
  for await (const event of gen) {
    results.push(event);
  }
  return results;
}

describe("workflow runner linear integration", () => {
  const originalPublicUrl = process.env.PUBLIC_URL;

  beforeEach(() => {
    emitMock.mockClear();
    delegateMock.mockClear();
    startedMock.mockClear();
    externalUrlMock.mockClear();
    process.env.PUBLIC_URL = "https://alfred.test";
  });

  afterEach(() => {
    if (originalPublicUrl === undefined) {
      process.env.PUBLIC_URL = undefined;
    } else {
      process.env.PUBLIC_URL = originalPublicUrl;
    }
  });

  it("initializes Linear session and emits thought activity on start", async () => {
    const runner = runPlanV6({
      requirement: "Start linear workflow",
      auto: "low",
      linear: {
        sessionId: "session-123",
        space: "space-1",
        authz: "linear-token",
      },
    });

    // Consume initial run event to trigger async setup.
    await runner.stream.next();
    await runner.stream.next();
    // Allow fire-and-forget promises to resolve.
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(emitMock).toHaveBeenCalled();
    const thoughtCall = emitMock.mock.calls.find(
      ([type]) => type === "thought"
    );
    expect(thoughtCall).toBeDefined();
    expect(delegateMock).toHaveBeenCalledWith({
      space: "space-1",
      issueId: "session-123",
      authz: "linear-token",
    });
    expect(startedMock).toHaveBeenCalledWith({
      space: "space-1",
      issueId: "session-123",
      authz: "linear-token",
    });
    expect(externalUrlMock).toHaveBeenCalled();
    const urlArgs = externalUrlMock.mock.calls[0];
    expect(urlArgs?.[3]).toMatch(/^https:\/\/alfred\.test\/workflow\//);
  });

  it("emits action and response activities during execution", async () => {
    const runner = runPlanV6({
      requirement: "Complete linear workflow",
      auto: "low",
      linear: {
        sessionId: "session-abc",
        space: "space-1",
        authz: "linear-token",
      },
    });

    const events = await collectEvents(runner.stream);
    expect(events.length).toBeGreaterThan(0);

    const types = emitMock.mock.calls.map(([type]) => type);
    expect(types).toContain("action");
    expect(types).toContain("response");

    const responseCall = emitMock.mock.calls.find(
      ([type]) => type === "response"
    );
    expect(responseCall?.[1]).toMatchObject({
      sessionId: "session-abc",
      space: "space-1",
      authz: "linear-token",
    });
  });
});
