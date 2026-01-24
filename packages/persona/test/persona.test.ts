import { describe, expect, it } from "bun:test";

import {
  buildPersonaPrompt,
  parsePersonaTelemetry,
  personaTelemetrySchema,
} from "../src/index.js";

describe("@alfred/persona", () => {
  it("buildPersonaPrompt returns non-empty string", () => {
    const prompt = buildPersonaPrompt({
      focusMode: false,
      honorific: "sir",
      modality: "text",
    });
    expect(prompt.length).toBeGreaterThan(20);
  });

  it("personaTelemetrySchema parses valid telemetry", () => {
    const input = {
      constraints: { focusMode: false, ttsSafe: true, maxWords: null },
      heuristicFallbackUsed: false,
      intent: { type: "conversational", confidence: null },
      speechAct: "answer",
      tooling: { toolsUsed: [], hasToolResults: false },
    };
    const parsed = parsePersonaTelemetry(input);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(personaTelemetrySchema.parse(parsed.value)).toBeTruthy();
    }
  });
});
