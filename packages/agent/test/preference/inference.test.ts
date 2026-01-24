import type {
  ConversationHistory,
  FeedbackHistory,
  ToolCallHistory,
} from "@alfred/type/preference";
import type { UIMessage } from "@alfred/type/stream";

import { beforeEach, describe, expect, it, mock } from "bun:test";

const inferResponsePreferencesSemanticMock = mock(() =>
  Promise.resolve({
    verbosity: [
      { label: "concise" as ResponseVerbosity, score: 0.62 },
      { label: "verbose" as ResponseVerbosity, score: 0.2 },
    ],
    tone: [{ label: "formal" as ResponseTone, score: 0.58 }],
    format: [{ label: "bullet" as ResponseFormat, score: 0.4 }],
  })
);

const detectToneSemanticMock = mock(() =>
  Promise.resolve("friendly" as ResponseTone)
);

mock.module("../../src/preference/semantic", () => ({
  inferResponsePreferencesSemantic: inferResponsePreferencesSemanticMock,
  detectToneSemantic: detectToneSemanticMock,
}));

const {
  inferDomainPreferences,
  inferPreferenceFromCorrection,
  inferPreferencesFromFeedback,
  inferResponsePreferences,
} = await import("../../src/preference/inference");

beforeEach(() => {
  inferResponsePreferencesSemanticMock.mockReset();
  inferResponsePreferencesSemanticMock.mockResolvedValue({
    verbosity: [
      { label: "concise" as ResponseVerbosity, score: 0.62 },
      { label: "verbose" as ResponseVerbosity, score: 0.2 },
    ],
    tone: [{ label: "formal" as ResponseTone, score: 0.58 }],
    format: [{ label: "bullet" as ResponseFormat, score: 0.4 }],
  });
  detectToneSemanticMock.mockReset();
  detectToneSemanticMock.mockResolvedValue("friendly");
});

let idCounter = 0;
function uid(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${idCounter}`;
}

function createMessage(role: UIMessage["role"], text: string): UIMessage {
  return {
    id: uid("msg"),
    role,
    parts: [{ type: "text", text }],
  };
}

function createConversation(messages: UIMessage[]): ConversationHistory {
  return {
    id: uid("conv"),
    userId: "user-1",
    messages,
    createdAt: new Date("2025-01-01T00:00:00Z"),
    updatedAt: new Date("2025-01-01T00:05:00Z"),
  };
}

describe("inferResponsePreferences", () => {
  it("maps semantic scores into preference details", async () => {
    const conversations = [
      createConversation([
        createMessage(
          "user",
          "You were too verbose last time, be concise and formal."
        ),
      ]),
    ];

    const prefs = await inferResponsePreferences(conversations);
    expect(prefs.get("response.verbosity")?.value).toBe("concise");
    expect(prefs.get("response.tone")?.value).toBe("formal");
    expect(prefs.get("response.format")?.value).toBe("bullet");
  });
});

describe("inferDomainPreferences", () => {
  it("infers config format and tool preference", () => {
    const toolCalls: ToolCallHistory[] = [
      {
        eventId: "evt-1",
        userId: "user-1",
        toolName: "proxmox.vm.apply",
        domain: "proxmox",
        parameters: { format: "yaml" },
        timestamp: new Date("2025-01-01T00:00:00Z"),
      },
      {
        eventId: "evt-2",
        userId: "user-1",
        toolName: "proxmox.vm.apply",
        domain: "proxmox",
        parameters: { format: "yaml" },
        timestamp: new Date("2025-01-01T00:01:00Z"),
      },
      {
        eventId: "evt-3",
        userId: "user-1",
        toolName: "proxmox.vm.apply",
        domain: "proxmox",
        parameters: {},
        timestamp: new Date("2025-01-01T00:02:00Z"),
      },
    ];

    const prefs = inferDomainPreferences(toolCalls);
    expect(prefs.get("domain.proxmox.config_format")?.value).toBe("yaml");
    expect(prefs.get("domain.proxmox.tool_preference")?.value).toBe(
      "proxmox.vm.apply"
    );
  });
});

describe("inferPreferencesFromFeedback", () => {
  it("translates feedback tags into learned preferences", () => {
    const feedbackItems: FeedbackHistory[] = [
      {
        feedbackId: "fb-1",
        userId: "user-1",
        tags: ["too_verbose"],
        timestamp: new Date(),
      },
      {
        feedbackId: "fb-2",
        userId: "user-1",
        tags: ["prefer_bullets"],
        timestamp: new Date(),
      },
    ];

    const prefs = inferPreferencesFromFeedback(feedbackItems);
    expect(prefs.get("response.verbosity")?.source).toBe("learned");
    expect(prefs.get("response.verbosity")?.value).toBe("concise");
    expect(prefs.get("response.format")?.value).toBe("bullet");
  });
});

describe("inferPreferenceFromCorrection", () => {
  it("detects verbosity changes", async () => {
    const original = createMessage(
      "assistant",
      "Here is a very long explanation that goes on and on."
    );
    const corrected = createMessage("assistant", "Keep it short.");
    const result = await inferPreferenceFromCorrection(
      original,
      corrected,
      "verbosity"
    );
    expect(result).toEqual({ key: "response.verbosity", value: "concise" });
  });

  it("detects format preferences from corrections", async () => {
    const original = createMessage(
      "assistant",
      "Paragraph one. Paragraph two."
    );
    const corrected = createMessage(
      "assistant",
      "- First point\n- Second point"
    );
    const result = await inferPreferenceFromCorrection(
      original,
      corrected,
      "format"
    );
    expect(result).toEqual({ key: "response.format", value: "bullet" });
  });

  it("delegates tone detection to semantic classifier", async () => {
    detectToneSemanticMock.mockResolvedValueOnce("formal");
    const original = createMessage("assistant", "hi");
    const corrected = createMessage("assistant", "Regards, Alfred.");
    const result = await inferPreferenceFromCorrection(
      original,
      corrected,
      "tone"
    );
    expect(result).toEqual({ key: "response.tone", value: "formal" });
  });
});
