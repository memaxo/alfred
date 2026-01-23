import { describe, expect, it } from "bun:test";
import {
  buildPersonaPrompt,
  parsePersonaTelemetry,
  personaTelemetrySchema,
} from "../src/index.js";

describe("@alfred/persona", () => {
  it("buildPersonaPrompt returns non-empty string", () => {
    const prompt = buildPersonaPrompt({
      modality: "text",
      honorific: "sir",
      focusMode: false,
    });
    expect(prompt.length).toBeGreaterThan(20);
  });

  it("personaTelemetrySchema parses valid telemetry", () => {
    const input = {
      speechAct: "answer",
      constraints: { focusMode: false, ttsSafe: true, maxWords: null },
      tooling: { toolsUsed: [], hasToolResults: false },
      heuristicFallbackUsed: false,
      intent: { type: "conversational", confidence: null },
    };
    const parsed = parsePersonaTelemetry(input);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(personaTelemetrySchema.parse(parsed.value)).toBeTruthy();
    }
  });
});

