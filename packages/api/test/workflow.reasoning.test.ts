import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  mock,
  vi,
} from "bun:test";
import "./utils/mock-metrics";
import { mockPolicyAudit, setupTestEnv } from "./utils/router-helpers";
import { createTestCaller } from "./utils/trpc";

setupTestEnv();

const getRunMock = vi.fn();
const getReasoningChainMock = vi.fn();
const reconstructReasoningChainMock = vi.fn();
const evaluateMock = vi
  .fn()
  .mockResolvedValue({ allow: true, obligations: [] });

mockPolicyAudit();

mock.module("@alfred/db/repo/workflow", () => ({
  getRun: getRunMock,
}));

mock.module("@alfred/db/repo/graph", () => ({
  getReasoningChain: getReasoningChainMock,
}));

mock.module("@alfred/knowledge/query", () => ({
  reconstructReasoningChain: reconstructReasoningChainMock,
}));

mock.module("@alfred/policy", () => ({
  evaluate: evaluateMock,
  registerCacheObs: () => {},
}));

beforeEach(() => {
  vi.restoreAllMocks();
  getRunMock.mockReset();
  getReasoningChainMock.mockReset();
  reconstructReasoningChainMock.mockReset();
  evaluateMock.mockClear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("workflow reasoning query", () => {
  it("returns ordered reasoning chain for a workflow run", async () => {
    const createdAt = new Date("2025-01-01T12:00:00.000Z");
    getRunMock.mockResolvedValue({
      id: "run-123",
      userId: "test-user",
      workflowId: "plan",
      status: "running",
      inputData: {
        cw: "/tmp/project",
        executionId: "exec-789",
      },
      created: createdAt,
    });

    const chainPayload = [
      {
        id: "node-a",
        hash: "hash-a",
        text: "Considering option alpha",
        index: 0,
        timestamp: 1_735_732_800_000,
        previousHash: null,
        nextHash: "hash-b",
        relations: [],
      },
      {
        id: "node-b",
        hash: "hash-b",
        text: "Selecting option beta",
        index: 1,
        timestamp: 1_735_732_810_000,
        previousHash: "hash-a",
        nextHash: null,
        relations: [{ toId: "node-b", timeDelta: 1000 }],
      },
    ];

    getReasoningChainMock.mockResolvedValue({
      nodes: [
        {
          id: "node-a",
          hash: "hash-a",
          label: "Considering option alpha",
          resource: "/tmp/project",
          kind: "reasoning",
          properties: {
            sequenceIndex: 0,
            timestamp: 1_735_732_800_000,
            nextHash: "hash-b",
          },
        },
        {
          id: "node-b",
          hash: "hash-b",
          label: "Selecting option beta",
          resource: "/tmp/project",
          kind: "reasoning",
          properties: {
            sequenceIndex: 1,
            timestamp: 1_735_732_810_000,
            previousHash: "hash-a",
          },
        },
      ],
      edges: [
        {
          id: "edge-1",
          hash: "edge-hash",
          resource: "/tmp/project",
          fromId: "node-a",
          toId: "node-b",
          kind: "precedes",
          weight: 1,
          metadata: {
            timeDelta: 1000,
            fromIndex: 0,
            toIndex: 1,
          },
        },
      ],
    });

    reconstructReasoningChainMock.mockReturnValue(chainPayload);

    const caller = await createTestCaller({
      scopes: [
        "workflow.plan",
        "workflow.stream",
        "workflow.resume",
        "workflow.read",
      ],
    });

    const result = await caller.workflow.reasoning({
      runId: "run-123",
      limit: 10,
    });

    expect(getRunMock).toHaveBeenCalledWith("run-123");
    expect(getReasoningChainMock).toHaveBeenCalledWith({
      resource: "/tmp/project",
      executionId: "exec-789",
      since: createdAt.getTime(),
      limit: 10,
    });
    expect(result).toMatchObject({
      runId: "run-123",
      resource: "/tmp/project",
      executionId: "exec-789",
    });
    expect(result.chain).toEqual(chainPayload);
  });

  it("falls back to resource-only lookup when execution-scoped query returns no nodes", async () => {
    getRunMock.mockResolvedValue({
      id: "run-999",
      userId: "test-user",
      workflowId: "plan",
      status: "completed",
      inputData: {
        workspace: "/project",
        executionId: "exec-missing",
      },
      created: new Date("2025-02-01T00:00:00.000Z"),
    });

    getReasoningChainMock
      .mockResolvedValueOnce({ nodes: [], edges: [] })
      .mockResolvedValueOnce({
        nodes: [
          {
            id: "node-x",
            hash: "hash-x",
            label: "Fallback reasoning",
            resource: "/project",
            kind: "reasoning",
            properties: { sequenceIndex: 0 },
          },
        ],
        edges: [],
      });

    reconstructReasoningChainMock.mockReturnValue([
      {
        id: "node-x",
        hash: "hash-x",
        text: "Fallback reasoning",
        index: 0,
        timestamp: null,
        previousHash: null,
        nextHash: null,
        relations: [],
      },
    ]);

    const caller = await createTestCaller({
      scopes: ["workflow.plan", "workflow.read"],
    });

    const result = await caller.workflow.reasoning({ runId: "run-999" });

    expect(getReasoningChainMock).toHaveBeenNthCalledWith(1, {
      resource: "/project",
      executionId: "exec-missing",
      since: expect.any(Number),
      limit: undefined,
    });
    expect(getReasoningChainMock).toHaveBeenNthCalledWith(2, {
      resource: "/project",
      since: expect.any(Number),
      limit: undefined,
    });
    expect(result.chain).toHaveLength(1);
  });

  it("enforces ownership", async () => {
    getRunMock.mockResolvedValue({
      id: "run-456",
      userId: "other-user",
      workflowId: "plan",
      status: "running",
      created: new Date(),
    } as any);

    const caller = await createTestCaller({
      scopes: ["workflow.plan", "workflow.read"],
    });

    await expect(
      caller.workflow.reasoning({ runId: "run-456" })
    ).rejects.toThrow("access_denied");
  });
});
