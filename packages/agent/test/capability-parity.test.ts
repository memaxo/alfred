/**
 * Capability parity tests.
 *
 * Ensures every capability in the registry has either:
 * 1. Tool coverage (can be executed by an agent), or
 * 2. An explicit uiOnly marker (human-only action)
 *
 * @see docs/execplans/alfred-web-unification.md Milestone 2
 */

import { describe, expect, test } from "bun:test";

import {
  capabilities,
  getToolCapabilities,
  getUiOnlyCapabilities,
} from "../src/capability.js";
import { hasToolCoverage } from "../src/routing/intent.js";

describe("capability parity", () => {
  test("every capability has coverage or is marked uiOnly", () => {
    const uncovered: string[] = [];

    for (const cap of capabilities) {
      if (cap.uiOnly) {
        // UI-only capabilities don't need tool coverage
        continue;
      }

      if (!hasToolCoverage(cap.id)) {
        uncovered.push(cap.id);
      }
    }

    if (uncovered.length > 0) {
      console.error("Uncovered capabilities:", uncovered);
    }

    expect(uncovered).toEqual([]);
  });

  test("uiOnly capabilities are excluded from tool capabilities", () => {
    const toolCaps = getToolCapabilities();
    const uiOnlyCaps = getUiOnlyCapabilities();

    // No overlap between tool and uiOnly capabilities
    const toolIds = new Set(toolCaps.map((c) => c.id));
    const uiOnlyIds = new Set(uiOnlyCaps.map((c) => c.id));

    for (const id of uiOnlyIds) {
      expect(toolIds.has(id)).toBe(false);
    }
  });

  test("all tool-covered capabilities have matching routing catalog", () => {
    const toolCaps = getToolCapabilities();

    for (const cap of toolCaps) {
      const covered = hasToolCoverage(cap.id);
      expect(covered, `Capability ${cap.id} has no tool coverage`).toBe(true);
    }
  });

  test("capabilities have required metadata", () => {
    for (const cap of capabilities) {
      expect(cap.id).toBeDefined();
      expect(cap.title).toBeDefined();
      expect(cap.summary).toBeDefined();
      expect(cap.category).toBeDefined();
      expect(cap.risk).toBeDefined();

      // High-risk capabilities should declare elevation requirement
      if (cap.risk === "high") {
        expect(
          cap.requiresElevation !== undefined,
          `High-risk capability ${cap.id} should declare requiresElevation`
        ).toBe(true);
      }
    }
  });

  test("capability registry is non-empty", () => {
    expect(capabilities.length).toBeGreaterThan(0);
  });

  test("uiOnly capabilities have rationale via webWindowType", () => {
    const uiOnlyCaps = getUiOnlyCapabilities();

    for (const cap of uiOnlyCaps) {
      // UI-only capabilities should have a window type for the human interface
      expect(
        cap.webWindowType,
        `UI-only capability ${cap.id} should have webWindowType`
      ).toBeDefined();
    }
  });
});
