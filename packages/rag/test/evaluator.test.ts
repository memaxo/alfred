import { describe, expect, it } from "bun:test";

import {
  canUseDirectly,
  evaluateRetrieval,
  shouldTriggerFallback,
} from "../src/evaluator";

describe("rag/evaluator", () => {
  it("falls back on empty results", () => {
    const r = evaluateRetrieval("how to configure tailscale", []);
    expect(r.action).toBe("fallback");
    expect(r.score).toBe(0);
    expect(r.reason.toLowerCase()).toContain("no documents");
    expect(r.metrics.coverage).toBe(0);
    expect(Array.isArray(r.suggestions)).toBe(true);
  });

  it("uses directly for high-quality results", () => {
    const docs = [
      {
        content: "Tailscale configuration: enable exit nodes and set ACLs.",
        score: 0.95,
      },
      {
        content:
          "To configure tailscale, edit the ACL policy file and apply it.",
        score: 0.9,
      },
    ];
    const r = evaluateRetrieval("configure tailscale ACL policy", docs);
    expect(r.action).toBe("use");
    expect(r.score).toBeGreaterThanOrEqual(0.7);
    expect(r.metrics.coverage).toBeGreaterThanOrEqual(0.5);
  });

  it("falls back when no relevant docs exist", () => {
    const docs = [
      { content: "A totally unrelated document.", score: 0.1 },
      { content: "More unrelated content.", score: 0.2 },
    ];
    const r = evaluateRetrieval("configure tailscale ACL policy", docs);
    expect(r.action).toBe("fallback");
    expect(r.suggestions?.length).toBeGreaterThan(0);
  });

  it("refines when results are ambiguous quality", () => {
    const docs = [
      {
        content: "Tailscale is a VPN.",
        score: 0.55,
      },
      {
        content: "ACLs can control access. Policies exist.",
        score: 0.55,
      },
    ];
    const r = evaluateRetrieval("configure tailscale acl policy", docs, {
      useThreshold: 0.9,
      fallbackThreshold: 0.1,
      minCoverage: 0.9,
    });
    expect(r.action).toBe("refine");
    expect(r.suggestions?.length).toBeGreaterThan(0);
  });

  it("shouldTriggerFallback matches average score threshold", () => {
    expect(shouldTriggerFallback([], 0.3)).toBe(true);
    expect(
      shouldTriggerFallback(
        [
          { content: "x", score: 0.2 },
          { content: "y", score: 0.2 },
        ],
        0.3
      )
    ).toBe(true);
    expect(
      shouldTriggerFallback(
        [
          { content: "x", score: 0.4 },
          { content: "y", score: 0.4 },
        ],
        0.3
      )
    ).toBe(false);
  });

  it("canUseDirectly matches top score threshold", () => {
    expect(canUseDirectly([], 0.7)).toBe(false);
    expect(canUseDirectly([{ content: "x", score: 0.6 }], 0.7)).toBe(false);
    expect(canUseDirectly([{ content: "x", score: 0.71 }], 0.7)).toBe(true);
  });
});
