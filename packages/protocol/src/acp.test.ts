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
  AgentSideConnection,
  CLIENT_METHODS,
  ClientSideConnection,
  mapAcpModeToAutonomy,
  mapAutonomyToAcpMode,
  PROTOCOL_VERSION,
  RequestError,
  TerminalHandle,
} from "./acp";

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

  it("returns valid AcpSessionMode for all autonomy levels", () => {
    const levels = ["read", "low", "medium", "high"] as const;
    for (const level of levels) {
      const mode = mapAutonomyToAcpMode(level);
      expect(mode.id).toBeDefined();
      expect(mode.name).toBeDefined();
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
