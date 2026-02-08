import { mock, vi } from "bun:test";

export const workflowRepoMocks = {
  appendEvent: vi.fn(),
  createRun: vi.fn(),
  getRun: vi.fn(),
  listEvents: vi.fn(),
  updateRun: vi.fn(),
  listRunsByStatuses: vi.fn(),
};

export function installWorkflowRepoMock() {
  mock.module("@alfred/db/repo/workflow", () => workflowRepoMocks);
  return workflowRepoMocks;
}
