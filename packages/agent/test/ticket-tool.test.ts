import { describe, expect, it } from "bun:test";
import { z } from "zod";

// Local schema definition for testing (mirrors the actual schema)
const ticketInputSchema = z.object({
  space: z.string().min(1),
  action: z.enum([
    "create",
    "update",
    "comment",
    "set-started",
    "set-completed",
    "set-cancelled",
    "set-delegate",
    "activity.thought",
    "activity.action",
    "activity.response",
    "activity.error",
    "session.external-url",
    "add-relation",
    "remove-relation",
  ]),
  teamId: z.string().optional(),
  issueId: z.string().optional(),
  title: z.string().optional(),
  description: z.string().optional(),
  priority: z.number().int().min(0).max(4).optional(),
  estimate: z.number().int().min(0).optional(),
  dueDate: z.string().optional(),
  cycleId: z.string().optional(),
  labelIds: z.array(z.string()).optional(),
  sessionId: z.string().optional(),
  delegateId: z.string().optional(),
  parameter: z.string().optional(),
  result: z.string().optional(),
  ephemeral: z.boolean().optional(),
  url: z.string().url().optional(),
  relatedIssueId: z.string().optional(),
  relationType: z.enum(["blocks", "duplicate", "related", "similar"]).optional(),
  authz: z.string().optional(),
});

const ticketOutputSchema = z.object({
  ok: z.boolean(),
  id: z.string().optional(),
  url: z.string().optional(),
  stateId: z.string().optional(),
  activityId: z.string().optional(),
  commentId: z.string().optional(),
  relationId: z.string().optional(),
  message: z.string().optional(),
});

describe("ticket tool schema validation", () => {
  describe("input schema", () => {
    it("requires space and action", () => {
      const result = ticketInputSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it("accepts valid create action", () => {
      const result = ticketInputSchema.safeParse({
        space: "workspace",
        action: "create",
        teamId: "team-123",
        title: "Test Issue",
      });
      expect(result.success).toBe(true);
    });

    it("accepts valid update action", () => {
      const result = ticketInputSchema.safeParse({
        space: "workspace",
        action: "update",
        issueId: "issue-123",
        title: "Updated Title",
      });
      expect(result.success).toBe(true);
    });

    it("accepts valid comment action", () => {
      const result = ticketInputSchema.safeParse({
        space: "workspace",
        action: "comment",
        issueId: "issue-123",
        description: "This is a comment",
      });
      expect(result.success).toBe(true);
    });

    it("accepts agent activity actions", () => {
      const actions = ["activity.thought", "activity.action", "activity.response", "activity.error"];

      for (const action of actions) {
        const result = ticketInputSchema.safeParse({
          space: "workspace",
          action,
          sessionId: "session-123",
          description: "Agent activity",
        });
        expect(result.success).toBe(true);
      }
    });

    it("accepts add-relation action", () => {
      const result = ticketInputSchema.safeParse({
        space: "workspace",
        action: "add-relation",
        issueId: "issue-123",
        relatedIssueId: "related-456",
        relationType: "blocks",
      });
      expect(result.success).toBe(true);
    });

    it("accepts remove-relation action", () => {
      const result = ticketInputSchema.safeParse({
        space: "workspace",
        action: "remove-relation",
        issueId: "issue-123",
        relatedIssueId: "related-456",
      });
      expect(result.success).toBe(true);
    });

    it("validates relation types", () => {
      const validTypes = ["blocks", "duplicate", "related", "similar"];

      for (const type of validTypes) {
        const result = ticketInputSchema.safeParse({
          space: "workspace",
          action: "add-relation",
          issueId: "issue-123",
          relatedIssueId: "related-456",
          relationType: type,
        });
        expect(result.success).toBe(true);
      }
    });

    it("rejects invalid relation type", () => {
      const result = ticketInputSchema.safeParse({
        space: "workspace",
        action: "add-relation",
        issueId: "issue-123",
        relatedIssueId: "related-456",
        relationType: "invalid",
      });
      expect(result.success).toBe(false);
    });

    it("accepts set-started action", () => {
      const result = ticketInputSchema.safeParse({
        space: "workspace",
        action: "set-started",
        issueId: "issue-123",
      });
      expect(result.success).toBe(true);
    });

    it("accepts set-completed action", () => {
      const result = ticketInputSchema.safeParse({
        space: "workspace",
        action: "set-completed",
        issueId: "issue-123",
      });
      expect(result.success).toBe(true);
    });

    it("accepts set-cancelled action", () => {
      const result = ticketInputSchema.safeParse({
        space: "workspace",
        action: "set-cancelled",
        issueId: "issue-123",
      });
      expect(result.success).toBe(true);
    });

    it("accepts set-delegate action with delegateId", () => {
      const result = ticketInputSchema.safeParse({
        space: "workspace",
        action: "set-delegate",
        issueId: "issue-123",
        delegateId: "user-456",
      });
      expect(result.success).toBe(true);
    });

    it("accepts set-delegate action without delegateId", () => {
      const result = ticketInputSchema.safeParse({
        space: "workspace",
        action: "set-delegate",
        issueId: "issue-123",
      });
      expect(result.success).toBe(true);
    });

    it("accepts session.external-url action", () => {
      const result = ticketInputSchema.safeParse({
        space: "workspace",
        action: "session.external-url",
        sessionId: "session-123",
        url: "https://example.com/session/123",
      });
      expect(result.success).toBe(true);
    });

    it("validates url format", () => {
      const result = ticketInputSchema.safeParse({
        space: "workspace",
        action: "session.external-url",
        sessionId: "session-123",
        url: "not-a-url",
      });
      expect(result.success).toBe(false);
    });

    it("accepts optional priority", () => {
      const result = ticketInputSchema.safeParse({
        space: "workspace",
        action: "create",
        teamId: "team-123",
        title: "Test",
        priority: 2,
      });
      expect(result.success).toBe(true);
    });

    it("validates priority range - too high", () => {
      const result = ticketInputSchema.safeParse({
        space: "workspace",
        action: "create",
        teamId: "team-123",
        title: "Test",
        priority: 5,
      });
      expect(result.success).toBe(false);
    });

    it("validates priority range - too low", () => {
      const result = ticketInputSchema.safeParse({
        space: "workspace",
        action: "create",
        teamId: "team-123",
        title: "Test",
        priority: -1,
      });
      expect(result.success).toBe(false);
    });

    it("accepts optional estimate", () => {
      const result = ticketInputSchema.safeParse({
        space: "workspace",
        action: "create",
        teamId: "team-123",
        title: "Test",
        estimate: 3,
      });
      expect(result.success).toBe(true);
    });

    it("accepts optional dueDate", () => {
      const result = ticketInputSchema.safeParse({
        space: "workspace",
        action: "create",
        teamId: "team-123",
        title: "Test",
        dueDate: "2024-12-31",
      });
      expect(result.success).toBe(true);
    });

    it("accepts optional cycleId", () => {
      const result = ticketInputSchema.safeParse({
        space: "workspace",
        action: "create",
        teamId: "team-123",
        title: "Test",
        cycleId: "cycle-123",
      });
      expect(result.success).toBe(true);
    });

    it("accepts optional labelIds", () => {
      const result = ticketInputSchema.safeParse({
        space: "workspace",
        action: "create",
        teamId: "team-123",
        title: "Test",
        labelIds: ["label-1", "label-2"],
      });
      expect(result.success).toBe(true);
    });

    it("accepts optional activity parameters", () => {
      const result = ticketInputSchema.safeParse({
        space: "workspace",
        action: "activity.action",
        sessionId: "session-123",
        description: "Running tests",
        parameter: "npm test",
        result: "All tests passed",
      });
      expect(result.success).toBe(true);
    });

    it("accepts optional ephemeral flag", () => {
      const result = ticketInputSchema.safeParse({
        space: "workspace",
        action: "activity.thought",
        sessionId: "session-123",
        description: "Ephemeral thought",
        ephemeral: true,
      });
      expect(result.success).toBe(true);
    });

    it("requires non-empty space", () => {
      const result = ticketInputSchema.safeParse({
        space: "",
        action: "create",
        teamId: "team-123",
        title: "Test",
      });
      expect(result.success).toBe(false);
    });

    it("rejects invalid action", () => {
      const result = ticketInputSchema.safeParse({
        space: "workspace",
        action: "invalid",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("output schema", () => {
    it("validates successful output with id", () => {
      const result = ticketOutputSchema.safeParse({
        ok: true,
        id: "issue-123",
        url: "https://linear.app/test/issue-123",
      });
      expect(result.success).toBe(true);
    });

    it("validates activity output", () => {
      const result = ticketOutputSchema.safeParse({
        ok: true,
        activityId: "activity-123",
      });
      expect(result.success).toBe(true);
    });

    it("validates comment output", () => {
      const result = ticketOutputSchema.safeParse({
        ok: true,
        commentId: "comment-123",
      });
      expect(result.success).toBe(true);
    });

    it("validates relation output", () => {
      const result = ticketOutputSchema.safeParse({
        ok: true,
        relationId: "relation-123",
      });
      expect(result.success).toBe(true);
    });

    it("validates state transition output", () => {
      const result = ticketOutputSchema.safeParse({
        ok: true,
        stateId: "state-123",
      });
      expect(result.success).toBe(true);
    });

    it("validates output without optional fields", () => {
      const result = ticketOutputSchema.safeParse({
        ok: true,
      });
      expect(result.success).toBe(true);
    });

    it("requires ok field", () => {
      const result = ticketOutputSchema.safeParse({
        id: "issue-123",
      });
      expect(result.success).toBe(false);
    });

    it("validates failed output with message", () => {
      const result = ticketOutputSchema.safeParse({
        ok: false,
        message: "Operation failed",
      });
      expect(result.success).toBe(true);
    });
  });
});
