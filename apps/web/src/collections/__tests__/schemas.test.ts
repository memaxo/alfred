import { describe, expect, it } from "bun:test";

import {
  edgeSchema,
  noteSchema,
  reminderSchema,
  threadSchema,
  workflowRunSchema,
} from "../schemas";

const UUID = "550e8400-e29b-41d4-a716-446655440000";

describe("noteSchema", () => {
  it("validates a valid note", () => {
    const note = {
      id: UUID,
      title: "Test Note",
      content: "This is content",
      tags: ["test", "example"],
      created: "2024-01-01T00:00:00Z",
      updated: "2024-01-02T00:00:00Z",
    };

    const result = noteSchema.safeParse(note);
    expect(result.success).toBe(true);
  });

  it("allows nullable fields", () => {
    const note = {
      id: UUID,
      title: null,
      content: "Content",
      tags: null,
      created: "2024-01-01T00:00:00Z",
      updated: "2024-01-02T00:00:00Z",
    };

    const result = noteSchema.safeParse(note);
    expect(result.success).toBe(true);
  });

  it("rejects missing required fields", () => {
    const note = {
      title: "Test Note",
    };

    const result = noteSchema.safeParse(note);
    expect(result.success).toBe(false);
  });

  it("rejects non-UUID id", () => {
    const note = {
      id: "not-a-uuid",
      title: "Test",
      content: "Content",
      tags: [],
      created: "2024-01-01T00:00:00Z",
      updated: "2024-01-02T00:00:00Z",
    };

    const result = noteSchema.safeParse(note);
    expect(result.success).toBe(false);
  });
});

describe("reminderSchema", () => {
  it("validates a valid reminder", () => {
    const reminder = {
      id: UUID,
      title: "Test Reminder",
      description: "Don't forget",
      due: "2024-01-01T12:00:00Z",
      status: "scheduled" as const,
      created: "2024-01-01T00:00:00Z",
      updated: "2024-01-02T00:00:00Z",
    };

    const result = reminderSchema.safeParse(reminder);
    expect(result.success).toBe(true);
  });

  it("validates fired status", () => {
    const reminder = {
      id: UUID,
      title: "Test",
      description: null,
      due: "2024-01-01T12:00:00Z",
      status: "fired" as const,
      created: "2024-01-01T00:00:00Z",
      updated: "2024-01-02T00:00:00Z",
    };

    const result = reminderSchema.safeParse(reminder);
    expect(result.success).toBe(true);
  });

  it("rejects invalid status", () => {
    const reminder = {
      id: UUID,
      title: "Test",
      description: null,
      due: "2024-01-01T12:00:00Z",
      status: "invalid",
      created: "2024-01-01T00:00:00Z",
      updated: "2024-01-02T00:00:00Z",
    };

    const result = reminderSchema.safeParse(reminder);
    expect(result.success).toBe(false);
  });
});

describe("threadSchema", () => {
  it("validates a valid thread", () => {
    const thread = {
      id: UUID,
      title: "Conversation",
      created: "2024-01-01T00:00:00Z",
      updated: "2024-01-02T00:00:00Z",
    };

    const result = threadSchema.safeParse(thread);
    expect(result.success).toBe(true);
  });
});

describe("workflowRunSchema", () => {
  it("validates a pending run", () => {
    const run = {
      id: UUID,
      requirement: "Build feature X",
      status: "pending" as const,
      startedAt: null,
      completedAt: null,
      error: null,
    };

    const result = workflowRunSchema.safeParse(run);
    expect(result.success).toBe(true);
  });

  it("validates a completed run", () => {
    const run = {
      id: UUID,
      requirement: "Build feature X",
      status: "completed" as const,
      startedAt: "2024-01-01T00:00:00Z",
      completedAt: "2024-01-01T01:00:00Z",
      error: null,
    };

    const result = workflowRunSchema.safeParse(run);
    expect(result.success).toBe(true);
  });

  it("validates a failed run with error", () => {
    const run = {
      id: UUID,
      requirement: "Build feature X",
      status: "failed" as const,
      startedAt: "2024-01-01T00:00:00Z",
      completedAt: null,
      error: "Something went wrong",
    };

    const result = workflowRunSchema.safeParse(run);
    expect(result.success).toBe(true);
  });
});

describe("edgeSchema", () => {
  it("validates a valid edge", () => {
    const edge = {
      id: UUID,
      sourceId: "node-1",
      targetId: "node-2",
      kind: "relates_to",
      createdAt: "2024-01-01T00:00:00Z",
    };

    const result = edgeSchema.safeParse(edge);
    expect(result.success).toBe(true);
  });

  it("rejects missing sourceId", () => {
    const edge = {
      id: UUID,
      targetId: "node-2",
      kind: "relates_to",
      createdAt: "2024-01-01T00:00:00Z",
    };

    const result = edgeSchema.safeParse(edge);
    expect(result.success).toBe(false);
  });
});
