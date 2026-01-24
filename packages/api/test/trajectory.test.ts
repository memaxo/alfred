import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  mock,
  vi,
} from "bun:test";

import {
  mockPolicyAudit,
  resetAllMocks,
  setupTestEnv,
} from "./utils/router-helpers";
import { createTestCaller } from "./utils/trpc";

setupTestEnv();

describe("trajectory router", () => {
  let caller: Awaited<ReturnType<typeof createTestCaller>>;
  let getRunMock: ReturnType<typeof vi.fn>;
  let listEventsMock: ReturnType<typeof vi.fn>;
  let getRunEventMarkerMock: ReturnType<typeof vi.fn>;
  let getTrajectoryByRunIdMock: ReturnType<typeof vi.fn>;
  let upsertTrajectoryMock: ReturnType<typeof vi.fn>;
  let buildAtifTrajectoryMock: ReturnType<typeof vi.fn>;
  let validateAtifTrajectoryMock: ReturnType<typeof vi.fn>;

  beforeAll(async () => {
    caller = await createTestCaller({
      scopes: ["workflow.read"],
      userId: "test-user",
    });
  });

  beforeEach(() => {
    // Setup mocks inside beforeEach to avoid module cache pollution
    getRunMock = vi.fn();
    listEventsMock = vi.fn();
    getRunEventMarkerMock = vi.fn();
    getTrajectoryByRunIdMock = vi.fn();
    upsertTrajectoryMock = vi.fn();
    buildAtifTrajectoryMock = vi.fn();
    validateAtifTrajectoryMock = vi.fn();

    mockPolicyAudit();

    mock.module("@alfred/db/repo/workflow", () => ({
      getRun: getRunMock,
      listEvents: listEventsMock,
    }));

    mock.module("@alfred/db/repo/trajectory", () => ({
      getRunEventMarker: getRunEventMarkerMock,
      getTrajectoryByRunId: getTrajectoryByRunIdMock,
      upsertTrajectory: upsertTrajectoryMock,
    }));

    mock.module("@alfred/runtime/trajectory/atif", () => ({
      buildAtifTrajectory: buildAtifTrajectoryMock,
    }));

    mock.module("@alfred/runtime/trajectory/validate", () => ({
      validateAtifTrajectory: validateAtifTrajectoryMock,
    }));
  });

  afterEach(() => {
    resetAllMocks();
    vi.clearAllMocks();
  });

  it("denies access when caller is not the run owner", async () => {
    const runId = "00000000-0000-0000-0000-000000000000";
    getRunMock.mockResolvedValue({
      id: runId,
      userId: "other-user",
      requirement: "x",
    });

    await expect(
      caller.trajectory.get({ runId, format: "atif" })
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "access_denied",
    });
  });

  it("returns cached trajectory when fresh", async () => {
    const runId = "00000000-0000-0000-0000-000000000000";
    const updatedAt = new Date("2025-01-01T00:00:00.000Z");

    getRunMock.mockResolvedValue({
      id: runId,
      userId: "test-user",
      requirement: "x",
    });

    getRunEventMarkerMock.mockResolvedValue({
      lastEventId: "e-last",
      lastSeq: 7,
    });

    getTrajectoryByRunIdMock.mockResolvedValue({
      schemaVersion: "ATIF-v1.4",
      data: { schema_version: "ATIF-v1.4", session_id: runId, steps: [] },
      valid: true,
      errors: null,
      lastEventId: "e-last",
      lastSeq: 7,
      updatedAt,
    });

    const result = await caller.trajectory.get({ runId, format: "atif" });

    expect(listEventsMock).not.toHaveBeenCalled();
    expect(upsertTrajectoryMock).not.toHaveBeenCalled();
    expect(result.validation.ok).toBe(true);
    expect(result.lastEventId).toBe("e-last");
  });

  it("rebuilds and persists when stale", async () => {
    const runId = "00000000-0000-0000-0000-000000000000";
    const updatedAt = new Date("2025-01-01T00:00:00.000Z");

    getRunMock.mockResolvedValue({
      id: runId,
      userId: "test-user",
      requirement: "x",
    });

    getRunEventMarkerMock.mockResolvedValue({
      lastEventId: "e-last",
      lastSeq: 7,
    });

    getTrajectoryByRunIdMock.mockResolvedValue(null);
    listEventsMock.mockResolvedValue([]);

    buildAtifTrajectoryMock.mockReturnValue({
      schema_version: "ATIF-v1.4",
      session_id: runId,
      agent: { name: "alfred", version: "x", model_name: "y" },
      steps: [],
    });
    validateAtifTrajectoryMock.mockReturnValue({ ok: true, errors: [] });

    upsertTrajectoryMock.mockResolvedValue({
      schemaVersion: "ATIF-v1.4",
      data: { schema_version: "ATIF-v1.4", session_id: runId, steps: [] },
      updatedAt,
      lastEventId: "e-last",
      lastSeq: 7,
      valid: true,
    });

    const result = await caller.trajectory.get({ runId, format: "atif" });

    expect(listEventsMock).toHaveBeenCalled();
    expect(upsertTrajectoryMock).toHaveBeenCalled();
    expect(result.validation.ok).toBe(true);
  });
});
