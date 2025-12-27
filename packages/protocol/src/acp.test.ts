import { describe, expect, it } from "bun:test";
import type {
  AcpStopReason,
  AcpToolKind,
  ContentBlock,
  Plan,
  SessionId,
  ToolCall,
} from "./acp";
import {
  AGENT_METHODS,
  // SDK exports
  AgentSideConnection,
  CLIENT_METHODS,
  ClientSideConnection,
  mapAcpModeToAutonomy,
  // Legacy schemas (deprecated but still exported for backwards compatibility)
  mapAutonomyToAcpMode,
  PROTOCOL_VERSION,
  permissionOptionKindSchema,
  permissionOptionSchema,
  permissionOutcomeSchema,
  permissionRequestSchema,
  RequestError,
  sessionModeSchema,
  stopReasonSchema,
  TerminalHandle,
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
    const kinds = [
      "read",
      "edit",
      "delete",
      "move",
      "search",
      "execute",
      "think",
      "fetch",
      "other",
    ];
    for (const kind of kinds) {
      const result = toolKindSchema.safeParse(kind);
      expect(result.success).toBe(true);
    }
  });
});

describe("permissionOptionKindSchema", () => {
  it("validates all permission option kinds", () => {
    const kinds = [
      "allow_once",
      "allow_always",
      "reject_once",
      "reject_always",
    ];
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
    const reasons = [
      "end_turn",
      "max_tokens",
      "max_turn_requests",
      "refusal",
      "cancelled",
    ];
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

describe("mapAcpModeToAutonomy", () => {
  it("maps ask mode to low autonomy", () => {
    expect(mapAcpModeToAutonomy("ask")).toBe("low");
  });

  it("maps architect mode to medium autonomy", () => {
    expect(mapAcpModeToAutonomy("architect")).toBe("medium");
  });

  it("maps code mode to high autonomy", () => {
    expect(mapAcpModeToAutonomy("code")).toBe("high");
  });

  it("defaults unknown modes to low autonomy", () => {
    expect(mapAcpModeToAutonomy("unknown")).toBe("low");
    expect(mapAcpModeToAutonomy("custom")).toBe("low");
  });

  it("round-trips with mapAutonomyToAcpMode (where possible)", () => {
    // low -> ask -> low
    const askMode = mapAutonomyToAcpMode("low");
    expect(mapAcpModeToAutonomy(askMode.id)).toBe("low");

    // high -> code -> high
    const codeMode = mapAutonomyToAcpMode("high");
    expect(mapAcpModeToAutonomy(codeMode.id)).toBe("high");
  });

  it("is lossy for read and medium autonomy levels", () => {
    // read -> ask -> low (lossy: read becomes low)
    const readMode = mapAutonomyToAcpMode("read");
    expect(readMode.id).toBe("ask");
    expect(mapAcpModeToAutonomy(readMode.id)).toBe("low");

    // medium -> code -> high (lossy: medium becomes high)
    const mediumMode = mapAutonomyToAcpMode("medium");
    expect(mediumMode.id).toBe("code");
    expect(mapAcpModeToAutonomy(mediumMode.id)).toBe("high");
  });
});

// ============================================================================
// SDK Integration Tests
// ============================================================================

describe("SDK exports", () => {
  it("exports connection classes", () => {
    expect(AgentSideConnection).toBeDefined();
    expect(ClientSideConnection).toBeDefined();
    expect(TerminalHandle).toBeDefined();
  });

  it("exports RequestError class", () => {
    expect(RequestError).toBeDefined();

    const error = new RequestError(-32_600, "Invalid Request");
    expect(error.code).toBe(-32_600);
    expect(error.message).toBe("Invalid Request");
  });

  it("exports protocol constants", () => {
    expect(PROTOCOL_VERSION).toBe(1);
    expect(AGENT_METHODS.initialize).toBe("initialize");
    expect(AGENT_METHODS.session_new).toBe("session/new");
    expect(AGENT_METHODS.session_prompt).toBe("session/prompt");
    expect(CLIENT_METHODS.session_update).toBe("session/update");
    expect(CLIENT_METHODS.fs_read_text_file).toBe("fs/read_text_file");
    expect(CLIENT_METHODS.terminal_create).toBe("terminal/create");
  });
});

describe("SDK type compatibility", () => {
  it("SessionId is string", () => {
    const id: SessionId = "session-123";
    expect(typeof id).toBe("string");
  });

  it("AcpStopReason includes expected values", () => {
    const reasons: AcpStopReason[] = ["end_turn", "max_tokens", "cancelled"];
    expect(reasons).toContain("end_turn");
  });

  it("AcpToolKind includes expected values", () => {
    const kinds: AcpToolKind[] = ["read", "edit", "execute", "think"];
    expect(kinds).toContain("read");
  });

  it("Plan type structure", () => {
    const plan: Plan = {
      entries: [
        { content: "Step 1", priority: "high", status: "completed" },
        { content: "Step 2", priority: "medium", status: "in_progress" },
        { content: "Step 3", priority: "low", status: "pending" },
      ],
    };
    expect(plan.entries).toHaveLength(3);
    expect(plan.entries[0].priority).toBe("high");
  });

  it("ContentBlock discriminated union", () => {
    const textBlock: ContentBlock = { type: "text", text: "Hello" };
    expect(textBlock.type).toBe("text");
  });

  it("ToolCall structure", () => {
    const call: ToolCall = {
      id: "call-1",
      status: "completed",
    };
    expect(call.id).toBe("call-1");
    expect(call.status).toBe("completed");
  });
});
