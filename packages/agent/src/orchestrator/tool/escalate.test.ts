import { describe, expect, it, mock } from "bun:test";
import { EscalationError, isEscalationError, toolEscalate } from "./escalate";
import {
  AGENT_ESCALATION_REASONS,
  type AgentEscalationEvent,
  isAgentEscalationEvent,
} from "./shared/context";

describe("toolEscalate", () => {
  it("has correct name and description", () => {
    expect(toolEscalate.name).toBe("escalate");
    expect(toolEscalate.description).toContain("environment blocker");
  });

  it("throws EscalationError on execute", async () => {
    const writeMock = mock(() => Promise.resolve());
    const writer = { write: writeMock };

    await expect(
      toolEscalate.execute({
        input: {
          reason: AGENT_ESCALATION_REASONS.MISSING_DEPENDENCY,
          details: "Cannot find package @acme/widget version 2.0",
          suggestions: ["Install @acme/widget@2.0", "Use alternative package"],
          severity: "blocking",
        },
        writer,
      })
    ).rejects.toThrow(EscalationError);
  });

  it("emits escalation event via writer before throwing", async () => {
    const writtenChunks: unknown[] = [];
    const writer = {
      write: (chunk: unknown) => {
        writtenChunks.push(chunk);
        return Promise.resolve();
      },
    };

    try {
      await toolEscalate.execute({
        input: {
          reason: AGENT_ESCALATION_REASONS.WRONG_ARCHITECTURE,
          details: "Expected REST API but found GraphQL endpoint",
          severity: "blocking",
        },
        writer,
      });
    } catch {
      // Expected
    }

    expect(writtenChunks).toHaveLength(1);
    const event = writtenChunks[0] as AgentEscalationEvent;
    expect(event.type).toBe("escalate");
    expect(event.reason).toBe("wrong_architecture");
    expect(event.details).toBe("Expected REST API but found GraphQL endpoint");
    expect(event.severity).toBe("blocking");
  });

  it("supports warning severity", async () => {
    const writtenChunks: unknown[] = [];
    const writer = {
      write: (chunk: unknown) => {
        writtenChunks.push(chunk);
        return Promise.resolve();
      },
    };

    try {
      await toolEscalate.execute({
        input: {
          reason: AGENT_ESCALATION_REASONS.RESOURCE_EXHAUSTED,
          details: "Memory usage high but still functional",
          severity: "warning",
        },
        writer,
      });
    } catch {
      // Expected
    }

    const event = writtenChunks[0] as AgentEscalationEvent;
    expect(event.severity).toBe("warning");
  });

  it("includes suggestions when provided", async () => {
    const writtenChunks: unknown[] = [];
    const writer = {
      write: (chunk: unknown) => {
        writtenChunks.push(chunk);
        return Promise.resolve();
      },
    };

    try {
      await toolEscalate.execute({
        input: {
          reason: AGENT_ESCALATION_REASONS.PERMISSION_DENIED,
          details: "Cannot write to /etc/config",
          suggestions: ["Run with sudo", "Use writable directory"],
          severity: "blocking",
        },
        writer,
      });
    } catch {
      // Expected
    }

    const event = writtenChunks[0] as AgentEscalationEvent;
    expect(event.suggestions).toEqual([
      "Run with sudo",
      "Use writable directory",
    ]);
  });
});

describe("EscalationError", () => {
  it("captures all escalation data", () => {
    const error = new EscalationError(
      AGENT_ESCALATION_REASONS.EXTERNAL_SERVICE_UNAVAILABLE,
      "API returned 503",
      ["Retry later", "Use cached data"],
      "blocking"
    );

    expect(error.name).toBe("EscalationError");
    expect(error.reason).toBe("external_service_unavailable");
    expect(error.details).toBe("API returned 503");
    expect(error.suggestions).toEqual(["Retry later", "Use cached data"]);
    expect(error.severity).toBe("blocking");
    expect(error.message).toContain("external_service_unavailable");
    expect(error.message).toContain("API returned 503");
  });

  it("defaults to blocking severity", () => {
    const error = new EscalationError(
      AGENT_ESCALATION_REASONS.OTHER,
      "Unknown issue"
    );
    expect(error.severity).toBe("blocking");
  });
});

describe("isEscalationError", () => {
  it("returns true for EscalationError", () => {
    const error = new EscalationError(
      AGENT_ESCALATION_REASONS.MISSING_DEPENDENCY,
      "test"
    );
    expect(isEscalationError(error)).toBe(true);
  });

  it("returns false for regular Error", () => {
    const error = new Error("test");
    expect(isEscalationError(error)).toBe(false);
  });

  it("returns false for non-errors", () => {
    expect(isEscalationError(null)).toBe(false);
    expect(isEscalationError(undefined)).toBe(false);
    expect(isEscalationError("string")).toBe(false);
    expect(isEscalationError({})).toBe(false);
  });
});

describe("isAgentEscalationEvent", () => {
  it("returns true for valid escalation event", () => {
    const event: AgentEscalationEvent = {
      type: "escalate",
      reason: AGENT_ESCALATION_REASONS.MISSING_DEPENDENCY,
      details: "Missing package",
      severity: "blocking",
    };
    expect(isAgentEscalationEvent(event)).toBe(true);
  });

  it("returns true for event with suggestions", () => {
    const event: AgentEscalationEvent = {
      type: "escalate",
      reason: AGENT_ESCALATION_REASONS.WRONG_ARCHITECTURE,
      details: "Wrong API",
      suggestions: ["Use REST"],
      severity: "warning",
    };
    expect(isAgentEscalationEvent(event)).toBe(true);
  });

  it("returns false for non-escalate events", () => {
    expect(isAgentEscalationEvent({ type: "notice", message: "test" })).toBe(
      false
    );
    expect(isAgentEscalationEvent({ type: "stdout", event: {} })).toBe(false);
  });

  it("returns false for incomplete escalation events", () => {
    expect(isAgentEscalationEvent({ type: "escalate" })).toBe(false);
    expect(
      isAgentEscalationEvent({ type: "escalate", reason: "missing_dependency" })
    ).toBe(false);
    expect(
      isAgentEscalationEvent({
        type: "escalate",
        reason: "missing_dependency",
        details: "test",
      })
    ).toBe(false);
  });

  it("returns false for non-objects", () => {
    expect(isAgentEscalationEvent(null)).toBe(false);
    expect(isAgentEscalationEvent(undefined)).toBe(false);
    expect(isAgentEscalationEvent("string")).toBe(false);
    expect(isAgentEscalationEvent(123)).toBe(false);
  });
});

describe("AGENT_ESCALATION_REASONS", () => {
  it("has all expected reason values", () => {
    expect(AGENT_ESCALATION_REASONS.MISSING_DEPENDENCY).toBe(
      "missing_dependency"
    );
    expect(AGENT_ESCALATION_REASONS.WRONG_ARCHITECTURE).toBe(
      "wrong_architecture"
    );
    expect(AGENT_ESCALATION_REASONS.PERMISSION_DENIED).toBe(
      "permission_denied"
    );
    expect(AGENT_ESCALATION_REASONS.RESOURCE_EXHAUSTED).toBe(
      "resource_exhausted"
    );
    expect(AGENT_ESCALATION_REASONS.EXTERNAL_SERVICE_UNAVAILABLE).toBe(
      "external_service_unavailable"
    );
    expect(AGENT_ESCALATION_REASONS.CONFLICTING_REQUIREMENTS).toBe(
      "conflicting_requirements"
    );
    expect(AGENT_ESCALATION_REASONS.OTHER).toBe("other");
  });
});
