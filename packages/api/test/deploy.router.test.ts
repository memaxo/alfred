import { afterEach, beforeAll, describe, expect, it, mock, vi } from "bun:test";
import {
  mockPolicyAudit,
  resetAllMocks,
  setupTestEnv,
} from "./utils/router-helpers";
import { createTestCaller } from "./utils/trpc";

setupTestEnv();
mockPolicyAudit();

const listDeploymentsMock = vi.fn();
const getDeploymentByIdMock = vi.fn();
const createDeploymentMock = vi.fn();
const removeDeploymentMock = vi.fn();

mock.module("@alfred/db", () => ({
  deployRepo: {
    listDeployments: listDeploymentsMock,
    getDeploymentById: getDeploymentByIdMock,
    createDeployment: createDeploymentMock,
    removeDeployment: removeDeploymentMock,
  },
}));

const toolDockerMock = {
  build: vi.fn(),
  run: vi.fn(),
  stop: vi.fn(),
};

const toolRouterMock = {
  addRoute: vi.fn(),
  removeRoute: vi.fn(),
};

mock.module("@alfred/agent/orchestrator/tool/docker", () => ({
  toolDocker: toolDockerMock,
}));

mock.module("@alfred/agent/orchestrator/tool/router", () => ({
  toolRouter: toolRouterMock,
}));

let caller: Awaited<ReturnType<typeof createTestCaller>>;

beforeAll(async () => {
  caller = await createTestCaller({
    scopes: ["deploy.read", "deploy.write"],
  });
});

afterEach(() => {
  resetAllMocks();
});

describe("deploy router", () => {
  describe("list", () => {
    it("lists deployments", async () => {
      const mockDeployments = [
        { id: "deploy-1", app: "app1", type: "preview" },
      ];

      listDeploymentsMock.mockResolvedValue(mockDeployments);

      const result = await caller.deploy.list({});

      expect(listDeploymentsMock).toHaveBeenCalled();
      expect(result).toEqual(mockDeployments);
    });
  });

  describe("get", () => {
    it("gets a deployment", async () => {
      const mockDeployment = {
        id: "deploy-1",
        app: "app1",
        type: "preview",
      };

      getDeploymentByIdMock.mockResolvedValue(mockDeployment);

      const result = await caller.deploy.get({
        id: "deploy-1",
      });

      expect(getDeploymentByIdMock).toHaveBeenCalledWith("deploy-1");
      expect(result).toEqual(mockDeployment);
    });
  });
});
