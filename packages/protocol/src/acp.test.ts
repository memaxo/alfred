import { describe, expect, it } from "bun:test";
import {
  mapAutonomyToAcpMode,
  permissionOptionKindSchema,
  permissionOptionSchema,
  permissionOutcomeSchema,
  permissionRequestSchema,
  sessionModeSchema,
  stopReasonSchema,
  toolCallStatusSchema,
  toolKindSchema,
} from "./acp";

describe("toolCallStatusSchema", () => {
  it("validates all status values", () => {
    const statuses = ["pending", "in_progress", "completed", "failed"];
    for (const status of statuses) {
      const result = toolCallStatusSchema.safeParse(status);
      expect(result.success).toBe(true);
    }
  });

  it("rejects invalid status", () => {
    const result = toolCallStatusSchema.safeParse("running");
    expect(result.success).toBe(false);
  });
});

describe("toolKindSchema", () => {
  it("validates all kind values", () => {
    const kinds = ["read", "edit", "delete", "move", "search", "execute", "think", "fetch", "other"];
    for (const kind of kinds) {
      const result = toolKindSchema.safeParse(kind);
      expect(result.success).toBe(true);
    }
  });
});

describe("permissionOptionKindSchema", () => {
  it("validates all permission option kinds", () => {
    const kinds = ["allow_once", "allow_always", "reject_once", "reject_always"];
    for (const kind of kinds) {
      const result = permissionOptionKindSchema.safeParse(kind);
      expect(result.success).toBe(true);
    }
  });
});

describe("permissionOptionSchema", () => {
  it("validates permission option", () => {
    const option = {
      optionId: "allow-1",
      name: "Allow once",
      kind: "allow_once",
    };
    const result = permissionOptionSchema.safeParse(option);
    expect(result.success).toBe(true);
  });
});

describe("permissionRequestSchema", () => {
  it("validates permission request", () => {
    const request = {
      sessionId: "session-123",
      toolCallId: "call-456",
      title: "Delete file",
      kind: "delete",
      options: [
        { optionId: "allow", name: "Allow", kind: "allow_once" },
        { optionId: "reject", name: "Reject", kind: "reject_once" },
      ],
    };
    const result = permissionRequestSchema.safeParse(request);
    expect(result.success).toBe(true);
  });

  it("validates request without kind", () => {
    const request = {
      sessionId: "session-123",
      toolCallId: "call-456",
      title: "Some operation",
      options: [],
    };
    const result = permissionRequestSchema.safeParse(request);
    expect(result.success).toBe(true);
  });
});

describe("permissionOutcomeSchema", () => {
  it("validates selected outcome", () => {
    const outcome = { outcome: "selected", optionId: "allow-1" };
    const result = permissionOutcomeSchema.safeParse(outcome);
    expect(result.success).toBe(true);
  });

  it("validates cancelled outcome", () => {
    const outcome = { outcome: "cancelled" };
    const result = permissionOutcomeSchema.safeParse(outcome);
    expect(result.success).toBe(true);
  });

  it("rejects selected without optionId", () => {
    const outcome = { outcome: "selected" };
    const result = permissionOutcomeSchema.safeParse(outcome);
    expect(result.success).toBe(false);
  });
});

describe("sessionModeSchema", () => {
  it("validates session mode", () => {
    const mode = {
      id: "code",
      name: "Code",
      description: "Write and modify code",
    };
    const result = sessionModeSchema.safeParse(mode);
    expect(result.success).toBe(true);
  });

  it("validates mode without description", () => {
    const mode = { id: "ask", name: "Ask" };
    const result = sessionModeSchema.safeParse(mode);
    expect(result.success).toBe(true);
  });
});

describe("stopReasonSchema", () => {
  it("validates all stop reasons", () => {
    const reasons = ["end_turn", "max_tokens", "max_turn_requests", "refusal", "cancelled"];
    for (const reason of reasons) {
      const result = stopReasonSchema.safeParse(reason);
      expect(result.success).toBe(true);
    }
  });
});

describe("mapAutonomyToAcpMode", () => {
  it("maps read to ask mode", () => {
    const mode = mapAutonomyToAcpMode("read");
    expect(mode.id).toBe("ask");
    expect(mode.name).toBe("Ask");
  });

  it("maps low to ask mode", () => {
    const mode = mapAutonomyToAcpMode("low");
    expect(mode.id).toBe("ask");
  });

  it("maps medium to code mode", () => {
    const mode = mapAutonomyToAcpMode("medium");
    expect(mode.id).toBe("code");
    expect(mode.name).toBe("Code");
  });

  it("maps high to code mode", () => {
    const mode = mapAutonomyToAcpMode("high");
    expect(mode.id).toBe("code");
  });

  it("returns valid SessionMode for all autonomy levels", () => {
    const levels = ["read", "low", "medium", "high"] as const;
    for (const level of levels) {
      const mode = mapAutonomyToAcpMode(level);
      const result = sessionModeSchema.safeParse(mode);
      expect(result.success).toBe(true);
    }
  });
});
