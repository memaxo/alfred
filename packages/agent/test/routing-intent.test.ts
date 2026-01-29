/**
 * Intent-based tool routing tests.
 *
 * Tests the routing system that maps user intents to appropriate
 * tool catalogs while maintaining ≤5 tools per agent.
 *
 * @see docs/execplans/alfred-web-unification.md Milestone 2
 */

import { describe, expect, test } from "bun:test";

import {
  INTENT_CATEGORIES,
  TOOL_CATALOGS,
  getCatalogForIntent,
  routeToolsByIntent,
  classifyIntentHeuristic,
} from "../src/routing/intent.js";

describe("intent routing", () => {
  describe("catalog definitions", () => {
    test("all catalogs have ≤5 tools", () => {
      for (const [key, catalog] of Object.entries(TOOL_CATALOGS)) {
        expect(
          catalog.tools.length,
          `Catalog ${key} has ${catalog.tools.length} tools, max is 5`
        ).toBeLessThanOrEqual(5);
      }
    });

    test("all catalogs have required metadata", () => {
      for (const [key, catalog] of Object.entries(TOOL_CATALOGS)) {
        expect(catalog.id).toBe(key);
        expect(catalog.name).toBeDefined();
        expect(catalog.description).toBeDefined();
        expect(catalog.capabilities).toBeDefined();
        expect(catalog.tools).toBeDefined();
      }
    });

    test("intent categories match catalog keys", () => {
      const catalogKeys = Object.keys(TOOL_CATALOGS);
      const categoryValues = INTENT_CATEGORIES;

      for (const category of categoryValues) {
        expect(
          catalogKeys.includes(category),
          `Category ${category} missing from TOOL_CATALOGS`
        ).toBe(true);
      }
    });
  });

  describe("getCatalogForIntent", () => {
    test("returns catalog for valid intent", () => {
      const catalog = getCatalogForIntent("personal");
      expect(catalog).toBeDefined();
      expect(catalog.id).toBe("personal");
    });

    test("returns personal catalog for unknown intent", () => {
      const catalog = getCatalogForIntent(
        "unknown" as (typeof INTENT_CATEGORIES)[number]
      );
      expect(catalog).toBeDefined();
      expect(catalog.id).toBe("personal");
    });
  });

  describe("classifyIntentHeuristic", () => {
    test("classifies personal intents", () => {
      expect(classifyIntentHeuristic("remind me to call mom")).toBe("personal");
      expect(classifyIntentHeuristic("create a note about ideas")).toBe(
        "personal"
      );
      expect(classifyIntentHeuristic("set a timer for 5 minutes")).toBe(
        "personal"
      );
    });

    test("classifies voice intents", () => {
      expect(classifyIntentHeuristic("start voice call")).toBe("voice");
      expect(classifyIntentHeuristic("mute microphone")).toBe("voice");
    });

    test("classifies code edit intents", () => {
      expect(classifyIntentHeuristic("fix the bug in utils.ts")).toBe(
        "code_edit"
      );
      expect(classifyIntentHeuristic("add a function to handle errors")).toBe(
        "code_edit"
      );
    });

    test("classifies git intents", () => {
      expect(classifyIntentHeuristic("commit changes")).toBe("git");
      expect(classifyIntentHeuristic("create a new branch")).toBe("git");
    });

    test("classifies deploy intents", () => {
      expect(classifyIntentHeuristic("deploy this branch")).toBe("deploy");
      expect(classifyIntentHeuristic("create preview build")).toBe("deploy");
    });

    test("classifies infrastructure intents", () => {
      expect(classifyIntentHeuristic("start the docker container")).toBe(
        "infrastructure"
      );
      expect(classifyIntentHeuristic("check container status")).toBe(
        "infrastructure"
      );
    });

    test("classifies knowledge intents", () => {
      expect(classifyIntentHeuristic("find related documentation")).toBe(
        "knowledge"
      );
      expect(classifyIntentHeuristic("what do we know about auth")).toBe(
        "knowledge"
      );
    });

    test("classifies workflow intents", () => {
      expect(classifyIntentHeuristic("refactor the entire module")).toBe(
        "workflow"
      );
      expect(classifyIntentHeuristic("implement the full feature")).toBe(
        "workflow"
      );
    });

    test("classifies handoff intents", () => {
      expect(classifyIntentHeuristic("handoff to orchestrator")).toBe(
        "handoff"
      );
      expect(classifyIntentHeuristic("escalate this task")).toBe("handoff");
    });

    test("defaults to personal for ambiguous inputs", () => {
      expect(classifyIntentHeuristic("hello")).toBe("personal");
      expect(classifyIntentHeuristic("help")).toBe("personal");
    });
  });

  describe("routeToolsByIntent", () => {
    test("returns valid catalog for personal intents", async () => {
      const result = await routeToolsByIntent("create a note about meeting");
      expect(result.catalog).toBeDefined();
      expect(result.catalog.tools.length).toBeGreaterThan(0);
      expect(result.confidence).toBeGreaterThan(0);
      expect(["llm", "fallback"]).toContain(result.source);
    });

    test("returns valid catalog for git operations", async () => {
      const result = await routeToolsByIntent("commit all changes");
      expect(result.catalog).toBeDefined();
      expect(result.catalog.tools.length).toBeGreaterThan(0);
    });

    test("returns valid catalog for deploy operations", async () => {
      const result = await routeToolsByIntent("deploy preview for this branch");
      expect(result.catalog).toBeDefined();
      expect(result.catalog.tools.length).toBeGreaterThan(0);
    });
  });
});
