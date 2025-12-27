import { describe, expect, it } from "bun:test";
import {
  agentMetadataSchema,
  artifactSummarySchema,
  createAgentMetadata,
  reasoningTraceSchema,
  tokenUsageSchema,
  toolOutputWithMetadataSchema,
} from "./metadata";

describe("tokenUsageSchema", () => {
  it("validates valid token usage", () => {
    const usage = {
      inputTokens: 100,
      outputTokens: 200,
      cachedInputTokens: 50,
    };
    const result = tokenUsageSchema.safeParse(usage);
    expect(result.success).toBe(true);
  });

  it("allows cachedInputTokens to be optional", () => {
    const usage = {
      inputTokens: 100,
      outputTokens: 200,
    };
    const result = tokenUsageSchema.safeParse(usage);
    expect(result.success).toBe(true);
  });

  it("rejects negative token counts", () => {
    const usage = {
      inputTokens: -1,
      outputTokens: 200,
    };
    const result = tokenUsageSchema.safeParse(usage);
    expect(result.success).toBe(false);
  });

  it("rejects non-integer token counts", () => {
    const usage = {
      inputTokens: 100.5,
      outputTokens: 200,
    };
    const result = tokenUsageSchema.safeParse(usage);
    expect(result.success).toBe(false);
  });
});

describe("agentMetadataSchema", () => {
  it("validates minimal metadata with just agentName", () => {
    const metadata = { agentName: "codex" };
    const result = agentMetadataSchema.safeParse(metadata);
    expect(result.success).toBe(true);
  });

  it("validates full metadata", () => {
    const metadata = {
      agentName: "codex",
      agentVersion: "1.0.0",
      modelUsed: "gpt-4",
      threadId: "thread-123",
      sessionId: "session-456",
      turnDurationMs: 5000,
      tokenUsage: {
        inputTokens: 100,
        outputTokens: 200,
        cachedInputTokens: 50,
      },
      resumedFromThread: true,
      workingDirectory: "/home/user/project",
      autonomyLevel: "medium" as const,
    };
    const result = agentMetadataSchema.safeParse(metadata);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual(metadata);
    }
  });

  it("validates autonomy levels", () => {
    for (const level of ["read", "low", "medium", "high"] as const) {
      const metadata = { agentName: "codex", autonomyLevel: level };
      const result = agentMetadataSchema.safeParse(metadata);
      expect(result.success).toBe(true);
    }
  });

  it("rejects invalid autonomy level", () => {
    const metadata = { agentName: "codex", autonomyLevel: "invalid" };
    const result = agentMetadataSchema.safeParse(metadata);
    expect(result.success).toBe(false);
  });
});

describe("artifactSummarySchema", () => {
  it("validates artifact summary", () => {
    const artifact = { path: "/src/file.ts", kind: "add" };
    const result = artifactSummarySchema.safeParse(artifact);
    expect(result.success).toBe(true);
  });

  it("rejects missing path", () => {
    const artifact = { kind: "add" };
    const result = artifactSummarySchema.safeParse(artifact);
    expect(result.success).toBe(false);
  });
});

describe("reasoningTraceSchema", () => {
  it("validates reasoning trace", () => {
    const trace = { text: "Analyzing the code...", timestamp: Date.now() };
    const result = reasoningTraceSchema.safeParse(trace);
    expect(result.success).toBe(true);
  });
});

describe("toolOutputWithMetadataSchema", () => {
  it("validates minimal output", () => {
    const output = { result: "Done" };
    const result = toolOutputWithMetadataSchema.safeParse(output);
    expect(result.success).toBe(true);
  });

  it("validates full output with all fields", () => {
    const output = {
      result: "Task completed successfully",
      artifacts: [{ path: "/src/new-file.ts", kind: "add" }],
      reasoning: [{ text: "Created new file", timestamp: 1_234_567_890 }],
      metadata: {
        agentName: "codex",
        threadId: "thread-123",
        turnDurationMs: 3000,
      },
      sessionState: {
        sessionId: "session-456",
        threadId: "thread-123",
        canResume: true,
        isResumed: false,
      },
    };
    const result = toolOutputWithMetadataSchema.safeParse(output);
    expect(result.success).toBe(true);
  });

  it("validates sessionState with resumeReason", () => {
    const output = {
      result: "Done",
      sessionState: {
        sessionId: "session-456",
        threadId: "",
        canResume: false,
        resumeReason: "thread-invalid",
      },
    };
    const result = toolOutputWithMetadataSchema.safeParse(output);
    expect(result.success).toBe(true);
  });
});

describe("createAgentMetadata", () => {
  it("creates minimal metadata", () => {
    const metadata = createAgentMetadata({ agentName: "codex" });
    expect(metadata).toEqual({ agentName: "codex" });
  });

  it("creates full metadata with all fields", () => {
    const params = {
      agentName: "codex" as const,
      agentVersion: "1.0.0",
      modelUsed: "gpt-4",
      threadId: "thread-123",
      sessionId: "session-456",
      turnDurationMs: 5000,
      tokenUsage: {
        inputTokens: 100,
        outputTokens: 200,
        cachedInputTokens: 50,
      },
      resumedFromThread: true,
      workingDirectory: "/home/user/project",
      autonomyLevel: "medium" as const,
    };
    const metadata = createAgentMetadata(params);
    expect(metadata.agentName).toBe("codex");
    expect(metadata.agentVersion).toBe("1.0.0");
    expect(metadata.modelUsed).toBe("gpt-4");
    expect(metadata.threadId).toBe("thread-123");
    expect(metadata.sessionId).toBe("session-456");
    expect(metadata.turnDurationMs).toBe(5000);
    expect(metadata.tokenUsage).toEqual(params.tokenUsage);
    expect(metadata.resumedFromThread).toBe(true);
    expect(metadata.workingDirectory).toBe("/home/user/project");
    expect(metadata.autonomyLevel).toBe("medium");
  });

  it("omits undefined optional fields", () => {
    const metadata = createAgentMetadata({
      agentName: "droid",
      threadId: "thread-789",
    });
    expect(metadata).toEqual({
      agentName: "droid",
      threadId: "thread-789",
    });
    expect("agentVersion" in metadata).toBe(false);
    expect("modelUsed" in metadata).toBe(false);
  });

  it("includes turnDurationMs when 0", () => {
    const metadata = createAgentMetadata({
      agentName: "codex",
      turnDurationMs: 0,
    });
    expect(metadata.turnDurationMs).toBe(0);
  });

  it("includes resumedFromThread when false", () => {
    const metadata = createAgentMetadata({
      agentName: "codex",
      resumedFromThread: false,
    });
    expect(metadata.resumedFromThread).toBe(false);
  });
});
