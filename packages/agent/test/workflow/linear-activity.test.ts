import { beforeEach, describe, expect, it, mock, vi } from "bun:test";

const linearMocks = {
  commentOnLinearIssue: vi.fn(),
  emitLinearActivity: vi.fn(),
  extractIssueIdFromSession: vi.fn(),
  setLinearCancelled: vi.fn(),
  setLinearCompleted: vi.fn(),
  setLinearDelegate: vi.fn(),
  setLinearSessionExternalUrl: vi.fn(),
  setLinearStarted: vi.fn(),
};

mock.module("../../src/orchestrator/linear", () => linearMocks);

import { installLoggerMock, loggerMocks } from "@alfred/test-kit/logger";

installLoggerMock();

const { LinearActivityService } =
  await import("../../src/workflow/linear-activity");

describe("LinearActivityService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    linearMocks.emitLinearActivity.mockResolvedValue({ ok: true });
    linearMocks.setLinearDelegate.mockResolvedValue();
    linearMocks.setLinearStarted.mockResolvedValue();
    linearMocks.setLinearCompleted.mockResolvedValue();
    linearMocks.setLinearCancelled.mockResolvedValue();
    linearMocks.setLinearSessionExternalUrl.mockResolvedValue();
    linearMocks.commentOnLinearIssue.mockResolvedValue();
    linearMocks.extractIssueIdFromSession.mockReturnValue("ISS-123");
  });

  describe("constructor", () => {
    it("stores linear config, authz, and runId", () => {
      const service = new LinearActivityService(
        { issueId: "ISS-1", sessionId: "sess-1", space: "space-1" },
        "authz-token",
        "run-123"
      );

      expect(service.isFailureNotified).toBe(false);
    });
  });

  describe("resolveIssueId", () => {
    it("uses issueId when provided", async () => {
      const service = new LinearActivityService(
        { issueId: "ISS-DIRECT", sessionId: "sess-1", space: "space-1" },
        "authz-token",
        "run-123"
      );

      await service.completeSuccess({
        finalMessage: "Done",
        reviewChecks: [],
        workflowUrl: null,
      });

      expect(linearMocks.setLinearCompleted).toHaveBeenCalledWith(
        expect.objectContaining({ issueId: "ISS-DIRECT" })
      );
    });

    it("extracts issueId from sessionId when issueId is not provided", async () => {
      linearMocks.extractIssueIdFromSession.mockReturnValue("ISS-FROM-SESSION");

      const service = new LinearActivityService(
        { sessionId: "sess-1", space: "space-1" },
        "authz-token",
        "run-123"
      );

      await service.completeSuccess({
        finalMessage: "Done",
        reviewChecks: [],
        workflowUrl: null,
      });

      expect(linearMocks.extractIssueIdFromSession).toHaveBeenCalledWith(
        "sess-1"
      );
      expect(linearMocks.setLinearCompleted).toHaveBeenCalledWith(
        expect.objectContaining({ issueId: "ISS-FROM-SESSION" })
      );
    });

    it("returns null when neither issueId nor sessionId resolves", async () => {
      linearMocks.extractIssueIdFromSession.mockReturnValue(null);

      const service = new LinearActivityService(
        { space: "space-1" },
        "authz-token",
        "run-123"
      );

      await service.completeSuccess({
        finalMessage: "Done",
        reviewChecks: [],
        workflowUrl: null,
      });

      // Should log warning but not call setLinearCompleted
      expect(loggerMocks.warn).toHaveBeenCalledWith(
        "linear_success_finalization_failed",
        expect.any(Object)
      );
    });
  });

  describe("bootstrap", () => {
    it("emits thought activity with requirement", async () => {
      const service = new LinearActivityService(
        { sessionId: "sess-1", space: "space-1" },
        "authz-token",
        "run-123"
      );

      await service.bootstrap({
        requirement: "Fix the bug",
        workflowUrl: "https://app.example.com/workflow/run-123",
      });

      expect(linearMocks.emitLinearActivity).toHaveBeenCalledWith("thought", {
        authz: "authz-token",
        body: "Starting workflow: Fix the bug",
        sessionId: "sess-1",
        space: "space-1",
      });
    });

    it("sets delegate and started state", async () => {
      linearMocks.extractIssueIdFromSession.mockReturnValue("ISS-123");

      const service = new LinearActivityService(
        { sessionId: "sess-1", space: "space-1" },
        "authz-token",
        "run-123"
      );

      await service.bootstrap({
        requirement: "Fix the bug",
        workflowUrl: "https://app.example.com/workflow/run-123",
      });

      expect(linearMocks.setLinearDelegate).toHaveBeenCalledWith({
        authz: "authz-token",
        issueId: "ISS-123",
        space: "space-1",
      });
      expect(linearMocks.setLinearStarted).toHaveBeenCalledWith({
        authz: "authz-token",
        issueId: "ISS-123",
        space: "space-1",
      });
    });

    it("sets external URL when workflowUrl is provided", async () => {
      const service = new LinearActivityService(
        { sessionId: "sess-1", space: "space-1" },
        "authz-token",
        "run-123"
      );

      await service.bootstrap({
        requirement: "Fix the bug",
        workflowUrl: "https://app.example.com/workflow/run-123",
      });

      expect(linearMocks.setLinearSessionExternalUrl).toHaveBeenCalledWith(
        "sess-1",
        "space-1",
        "authz-token",
        "https://app.example.com/workflow/run-123"
      );
    });

    it("logs warning when workflowUrl is missing", async () => {
      const service = new LinearActivityService(
        { sessionId: "sess-1", space: "space-1" },
        "authz-token",
        "run-123"
      );

      await service.bootstrap({
        requirement: "Fix the bug",
        workflowUrl: null,
      });

      expect(loggerMocks.warn).toHaveBeenCalledWith(
        "linear_external_url_setup_missing_base",
        expect.objectContaining({ runId: "run-123" })
      );
    });

    it("handles thought activity failure gracefully", async () => {
      linearMocks.emitLinearActivity.mockRejectedValue(new Error("api_error"));

      const service = new LinearActivityService(
        { sessionId: "sess-1", space: "space-1" },
        "authz-token",
        "run-123"
      );

      await service.bootstrap({
        requirement: "Fix the bug",
        workflowUrl: null,
      });

      expect(loggerMocks.warn).toHaveBeenCalledWith(
        "linear_thought_activity_failed",
        expect.any(Object)
      );
    });

    it("logs warning when issueId cannot be resolved", async () => {
      linearMocks.extractIssueIdFromSession.mockReturnValue(null);

      const service = new LinearActivityService(
        { sessionId: "sess-1", space: "space-1" },
        "authz-token",
        "run-123"
      );

      await service.bootstrap({
        requirement: "Fix the bug",
        workflowUrl: null,
      });

      expect(loggerMocks.warn).toHaveBeenCalledWith(
        "linear_issue_id_missing",
        expect.objectContaining({ runId: "run-123" })
      );
    });
  });

  describe("completeSuccess", () => {
    it("sets completed state and posts comment", async () => {
      const service = new LinearActivityService(
        { issueId: "ISS-1", sessionId: "sess-1", space: "space-1" },
        "authz-token",
        "run-123"
      );

      await service.completeSuccess({
        finalMessage: "All done!",
        reviewChecks: [
          { attempts: 1, id: "test", status: "passed", type: "test" },
        ],
        workflowUrl: "https://app.example.com/workflow/run-123",
      });

      expect(linearMocks.setLinearCompleted).toHaveBeenCalledWith({
        authz: "authz-token",
        issueId: "ISS-1",
        space: "space-1",
      });
      expect(linearMocks.commentOnLinearIssue).toHaveBeenCalledWith({
        authz: "authz-token",
        body: expect.stringContaining("completed successfully"),
        issueId: "ISS-1",
        space: "space-1",
      });
    });

    it("includes review checks in comment", async () => {
      const service = new LinearActivityService(
        { issueId: "ISS-1", sessionId: "sess-1", space: "space-1" },
        "authz-token",
        "run-123"
      );

      await service.completeSuccess({
        finalMessage: null,
        reviewChecks: [
          { attempts: 0, id: "lint", status: "passed", type: "lint" },
          { attempts: 2, id: "test", status: "passed", type: "test" },
        ],
        workflowUrl: null,
      });

      const commentCall = linearMocks.commentOnLinearIssue.mock.calls[0];
      const { body } = commentCall[0];
      expect(body).toContain("- lint: passed");
      expect(body).toContain("- test: passed (attempt 2)");
    });

    it("handles errors gracefully", async () => {
      linearMocks.setLinearCompleted.mockRejectedValue(new Error("api_error"));

      const service = new LinearActivityService(
        { issueId: "ISS-1", sessionId: "sess-1", space: "space-1" },
        "authz-token",
        "run-123"
      );

      await service.completeSuccess({
        finalMessage: "Done",
        reviewChecks: [],
        workflowUrl: null,
      });

      expect(loggerMocks.warn).toHaveBeenCalledWith(
        "linear_success_finalization_failed",
        expect.any(Object)
      );
    });
  });

  describe("completeFailure", () => {
    it("sets cancelled state and posts failure comment", async () => {
      const service = new LinearActivityService(
        { issueId: "ISS-1", sessionId: "sess-1", space: "space-1" },
        "authz-token",
        "run-123"
      );

      await service.completeFailure("workflow_timeout");

      expect(linearMocks.setLinearCancelled).toHaveBeenCalledWith({
        authz: "authz-token",
        issueId: "ISS-1",
        space: "space-1",
      });
      expect(linearMocks.commentOnLinearIssue).toHaveBeenCalledWith({
        authz: "authz-token",
        body: expect.stringContaining("failed"),
        issueId: "ISS-1",
        space: "space-1",
      });
    });

    it("is idempotent (only notifies once)", async () => {
      const service = new LinearActivityService(
        { issueId: "ISS-1", sessionId: "sess-1", space: "space-1" },
        "authz-token",
        "run-123"
      );

      await service.completeFailure("first_error");
      await service.completeFailure("second_error");
      await service.completeFailure("third_error");

      expect(linearMocks.setLinearCancelled).toHaveBeenCalledTimes(1);
      expect(linearMocks.commentOnLinearIssue).toHaveBeenCalledTimes(1);
      expect(service.isFailureNotified).toBe(true);
    });

    it("includes reason in failure comment", async () => {
      const service = new LinearActivityService(
        { issueId: "ISS-1", sessionId: "sess-1", space: "space-1" },
        "authz-token",
        "run-123"
      );

      await service.completeFailure("review_checklist_incomplete");

      const commentCall = linearMocks.commentOnLinearIssue.mock.calls[0];
      expect(commentCall[0].body).toContain("review_checklist_incomplete");
    });

    it("handles errors gracefully", async () => {
      linearMocks.setLinearCancelled.mockRejectedValue(new Error("api_error"));

      const service = new LinearActivityService(
        { issueId: "ISS-1", sessionId: "sess-1", space: "space-1" },
        "authz-token",
        "run-123"
      );

      await service.completeFailure("error");

      expect(loggerMocks.warn).toHaveBeenCalledWith(
        "linear_failure_notification_failed",
        expect.any(Object)
      );
      expect(service.isFailureNotified).toBe(true);
    });
  });

  describe("emitError", () => {
    it("emits error activity", async () => {
      const service = new LinearActivityService(
        { sessionId: "sess-1", space: "space-1" },
        "authz-token",
        "run-123"
      );

      await service.emitError("Something went wrong");

      expect(linearMocks.emitLinearActivity).toHaveBeenCalledWith("error", {
        authz: "authz-token",
        body: "Something went wrong",
        sessionId: "sess-1",
        space: "space-1",
      });
    });

    it("handles errors gracefully", async () => {
      linearMocks.emitLinearActivity.mockRejectedValue(new Error("api_error"));

      const service = new LinearActivityService(
        { sessionId: "sess-1", space: "space-1" },
        "authz-token",
        "run-123"
      );

      await service.emitError("Error message");

      expect(loggerMocks.warn).toHaveBeenCalledWith(
        "linear_activity_emission_failed",
        expect.any(Object)
      );
    });
  });
});
