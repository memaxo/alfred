import { afterEach, beforeAll, describe, expect, it, mock, vi } from "bun:test";
import {
  mockPolicyAudit,
  resetAllMocks,
  setupTestEnv,
} from "./utils/router-helpers";
import { createTestCaller } from "./utils/trpc";

setupTestEnv();
mockPolicyAudit();

const upsertEvalDefMock = vi.fn();
const listEvalDefsMock = vi.fn();
const getEvalDefBySlugMock = vi.fn();
const createDatasetMock = vi.fn();
const getDatasetByIdMock = vi.fn();
const addPointsMock = vi.fn();
const listDatasetsMock = vi.fn();
const getRunMock = vi.fn();
const listRunsMock = vi.fn();
const listRunScoresMock = vi.fn();

mock.module("@alfred/db/repo/eval", () => ({
  upsertEvalDef: upsertEvalDefMock,
  listEvalDefs: listEvalDefsMock,
  getEvalDefBySlug: getEvalDefBySlugMock,
  createDataset: createDatasetMock,
  getDatasetById: getDatasetByIdMock,
  addPoints: addPointsMock,
  listDatasets: listDatasetsMock,
  getRun: getRunMock,
  listRuns: listRunsMock,
  listRunScores: listRunScoresMock,
}));

let caller: Awaited<ReturnType<typeof createTestCaller>>;

beforeAll(async () => {
  caller = await createTestCaller({
    scopes: ["eval.define", "eval.dataset", "eval.run"],
  });
});

afterEach(() => {
  resetAllMocks();
});

describe.skip("eval router", () => {
  describe("define", () => {
    it("creates an eval definition", async () => {
      const mockDef = {
        id: "def-id",
        slug: "test-eval",
        agent: "assistant",
      };

      upsertEvalDefMock.mockResolvedValue(mockDef);

      const result = await caller.eval.define({
        slug: "test-eval",
        agent: "assistant",
        title: "Test Eval",
      });

      expect(upsertEvalDefMock).toHaveBeenCalled();
      expect(result).toEqual({ id: "def-id", slug: "test-eval" });
    });
  });

  describe("list", () => {
    it("lists eval definitions", async () => {
      const mockDefs = [
        { id: "def-1", slug: "eval-1" },
        { id: "def-2", slug: "eval-2" },
      ];

      listEvalDefsMock.mockResolvedValue(mockDefs);

      const result = await caller.eval.list({
        limit: 50,
        offset: 0,
      });

      expect(listEvalDefsMock).toHaveBeenCalledWith(50, 0);
      expect(result).toEqual(mockDefs);
    });
  });

  describe("dataset.create", () => {
    it("creates a dataset", async () => {
      const mockDef = { id: "def-id", slug: "test-eval" };
      const mockDataset = { id: "dataset-id" };

      getEvalDefBySlugMock.mockResolvedValue(mockDef);
      createDatasetMock.mockResolvedValue(mockDataset);

      const result = await caller.eval.dataset.create({
        defSlug: "test-eval",
        name: "test dataset",
        source: "manual",
      });

      expect(createDatasetMock).toHaveBeenCalled();
      expect(result).toEqual({ id: "dataset-id" });
    });

    it("throws NOT_FOUND when definition not found", async () => {
      getEvalDefBySlugMock.mockResolvedValue(null);

      await expect(
        caller.eval.dataset.create({
          defSlug: "nonexistent",
          name: "test",
          source: "manual",
        })
      ).rejects.toThrow("eval_definition_not_found");
    });
  });

  describe("run.start", () => {
    it("throws NOT_IMPLEMENTED", async () => {
      const mockDef = { id: "def-id", slug: "test-eval" };
      const mockDataset = { id: "dataset-id", defId: "def-id" };

      getEvalDefBySlugMock.mockResolvedValue(mockDef);
      getDatasetByIdMock.mockResolvedValue(mockDataset);

      await expect(
        caller.eval.run.start({
          defSlug: "test-eval",
          datasetId: "dataset-id",
        })
      ).rejects.toThrow("eval_run_disabled");
    });
  });

  describe("run.get", () => {
    it("gets a run", async () => {
      const mockRun = {
        run: { id: "run-id" },
        def: { id: "def-id" },
        dataset: { id: "dataset-id" },
      };

      getRunMock.mockResolvedValue(mockRun);

      const result = await caller.eval.run.get({
        runId: "run-id",
      });

      expect(getRunMock).toHaveBeenCalledWith("run-id");
      expect(result).toEqual(mockRun);
    });
  });
});
