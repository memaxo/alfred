import { memoryEdges, memoryNodes } from "@alfred/db/schema/graph";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  mock,
  vi,
} from "bun:test";

const dbModule = await import("@alfred/db");

interface Call {
  table: unknown | null;
  whereCalls: number;
  limit: number | null;
}

const calls: Call[] = [];

let nodeRows: { id: string; label: string; kind: string }[] = [];
let edgeRows: { from: string; to: string; kind: string }[] = [];

function builder(call: Call) {
  return {
    from(table: unknown) {
      call.table = table;
      return builder(call);
    },
    where(_predicate: unknown) {
      call.whereCalls += 1;
      return builder(call);
    },
    orderBy(..._args: unknown[]) {
      return builder(call);
    },
    limit(value: number) {
      call.limit = value;
      if (call.table === memoryNodes) {
        return Promise.resolve(nodeRows);
      }
      if (call.table === memoryEdges) {
        return Promise.resolve(edgeRows);
      }
      return Promise.resolve([]);
    },
  };
}

const selectMock = mock((_shape?: unknown) => {
  const call: Call = { table: null, whereCalls: 0, limit: null };
  calls.push(call);
  return builder(call);
});

let dbSelectSpy: ReturnType<typeof vi.spyOn> | null = null;

const { toolMindscapeRead } = await import("../assistant/src/tool/mindscape");

describe("mindscape tool", () => {
  beforeAll(() => {
    dbSelectSpy = vi
      .spyOn(dbModule.db, "select")
      .mockImplementation((...args) => selectMock(...args));
  });

  beforeEach(() => {
    calls.length = 0;
    nodeRows = [];
    edgeRows = [];
    selectMock.mockClear();
  });

  afterAll(() => {
    dbSelectSpy?.mockRestore();
    dbSelectSpy = null;
  });

  it("bounds node and edge reads without a query", async () => {
    nodeRows = [{ id: "n1", label: "Alpha", kind: "fact" }];
    edgeRows = [{ from: "n1", to: "n2", kind: "relates_to" }];

    const result = await toolMindscapeRead.execute({});

    expect(result.count).toBe(1);
    expect(result.nodes).toEqual(nodeRows);
    expect(result.edges).toEqual(edgeRows);

    expect(calls).toHaveLength(2);
    expect(calls[0]?.whereCalls).toBe(0);
    expect(calls[0]?.limit).toBe(200);
    expect(calls[1]?.limit).toBe(2000);
  });

  it("applies DB-native filtering when query is provided", async () => {
    nodeRows = [{ id: "n1", label: "Alpha", kind: "fact" }];
    edgeRows = [];

    const result = await toolMindscapeRead.execute({ query: "alp" });

    expect(result.count).toBe(1);
    expect(calls).toHaveLength(2);
    expect(calls[0]?.whereCalls).toBe(1);
    expect(calls[0]?.limit).toBe(200);
  });

  it("skips edge query when no nodes match", async () => {
    nodeRows = [];
    edgeRows = [{ from: "n1", to: "n2", kind: "relates_to" }];

    const result = await toolMindscapeRead.execute({ query: "zzz" });

    expect(result.count).toBe(0);
    expect(result.nodes).toEqual([]);
    expect(result.edges).toEqual([]);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.whereCalls).toBe(1);
  });
});
