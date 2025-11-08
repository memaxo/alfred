import { afterEach, beforeAll, describe, expect, it, mock, vi } from "bun:test";
import {
  mockPolicyAudit,
  resetAllMocks,
  setupTestEnv,
} from "./utils/router-helpers";
import { createTestCaller } from "./utils/trpc";

setupTestEnv();
mockPolicyAudit();

const searchFactsMock = vi.fn();
const listFactsMock = vi.fn();
const deleteFactMock = vi.fn();
const getEventsMock = vi.fn();
const recordMemoryForgetMock = vi.fn();

mock.module("@alfred/db", () => ({
  userRepo: {
    searchFacts: searchFactsMock,
    listFacts: listFactsMock,
    deleteFact: deleteFactMock,
    getEvents: getEventsMock,
  },
}));

mock.module("@alfred/agent", () => ({
  recordMemoryForget: recordMemoryForgetMock,
}));

let caller: Awaited<ReturnType<typeof createTestCaller>>;

beforeAll(async () => {
  caller = await createTestCaller({
    scopes: ["privacy.purge"],
  });
});

afterEach(() => {
  resetAllMocks();
});

describe("privacy router", () => {
  describe("facts", () => {
    it("searches facts by embedding", async () => {
      const mockFacts = [
        { id: "fact-1", content: "fact 1" },
        { id: "fact-2", content: "fact 2" },
      ];

      searchFactsMock.mockResolvedValue(mockFacts);

      const embedding = Array.from({ length: 1536 }, () => 0.1);
      const result = await caller.privacy.facts({
        embedding,
        limit: 10,
        threshold: 0.7,
      });

      expect(searchFactsMock).toHaveBeenCalledWith(
        "test-user",
        embedding,
        10,
        0.7
      );
      expect(result).toEqual(mockFacts);
    });

    it("lists facts without embedding", async () => {
      const mockFacts = [{ id: "fact-1", content: "fact 1" }];
      listFactsMock.mockResolvedValue(mockFacts);

      const result = await caller.privacy.facts({
        limit: 10,
        offset: 0,
      });

      expect(listFactsMock).toHaveBeenCalledWith("test-user", 10, 0);
      expect(result).toEqual(mockFacts);
    });
  });

  describe("deleteFact", () => {
    it("deletes a fact", async () => {
      deleteFactMock.mockResolvedValue(1);

      const result = await caller.privacy.deleteFact({
        id: "fact-id",
        scope: "fact",
      });

      expect(deleteFactMock).toHaveBeenCalledWith("fact-id");
      expect(recordMemoryForgetMock).toHaveBeenCalledWith("fact");
      expect(result).toEqual({ removed: 1 });
    });

    it("returns zero when fact not found", async () => {
      deleteFactMock.mockResolvedValue(0);

      const result = await caller.privacy.deleteFact({
        id: "nonexistent",
      });

      expect(result).toEqual({ removed: 0 });
      expect(recordMemoryForgetMock).not.toHaveBeenCalled();
    });
  });

  describe("events", () => {
    it("gets user events", async () => {
      const mockEvents = [
        { id: "event-1", type: "conversation" },
        { id: "event-2", type: "tool_use" },
      ];

      getEventsMock.mockResolvedValue(mockEvents);

      const result = await caller.privacy.events({
        type: "conversation",
        limit: 10,
        offset: 0,
      });

      expect(getEventsMock).toHaveBeenCalledWith(
        "test-user",
        "conversation",
        10,
        0
      );
      expect(result).toEqual(mockEvents);
    });
  });
});
