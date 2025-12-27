import { afterEach, beforeAll, describe, expect, it, mock, vi } from "bun:test";
import { dbModuleStub } from "./utils/mock-db-client";
import {
  mockPolicyAudit,
  resetAllMocks,
  setupTestEnv,
} from "./utils/router-helpers";
import { createTestCaller } from "./utils/trpc";

setupTestEnv();
mockPolicyAudit();

const listDeploymentsMock = dbModuleStub.deployRepo.listDeployments;
const getDeploymentByIdMock = dbModuleStub.deployRepo.getDeploymentById;

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
      const deploymentId = "00000000-0000-0000-0000-000000000000";
      const mockDeployments = [
        {
          id: deploymentId,
          userId: "test-user",
          app: "app1",
          type: "preview",
          status: "running",
        },
      ];

      listDeploymentsMock.mockResolvedValue(mockDeployments);

      const result = await caller.deploy.list({});

      expect(listDeploymentsMock).toHaveBeenCalled();
      expect(result).toEqual(mockDeployments);
    });
  });

  describe("get", () => {
    it("gets a deployment", async () => {
      const deploymentId = "00000000-0000-0000-0000-000000000000";
      const mockDeployment = {
        id: deploymentId,
        userId: "test-user",
        app: "app1",
        type: "preview",
        status: "running",
      };

      getDeploymentByIdMock.mockResolvedValue(mockDeployment);

      const result = await caller.deploy.get({
        id: deploymentId,
      });

      expect(getDeploymentByIdMock).toHaveBeenCalledWith(deploymentId);
      expect(result).toEqual(mockDeployment);
    });
  });
});
