import { describe, expect, it, mock } from "bun:test";

import type { WorkflowIntent } from "../intent/types.js";
import type { ResearchResult } from "../research/types.js";

import {
  generatePhasedPlan,
  generatePlanVariants,
} from "../generate/phased.js";

describe("generatePhasedPlan", () => {
  it("should generate a valid plan structure", async () => {
    const intent: WorkflowIntent = {
      id: "test-intent-1",
      description: "Add dark mode toggle",
      source: "chat",
      userId: "user-1",
      timestamp: new Date(),
      context: {
        projectId: "proj-1",
        codebase: "/app",
        existingPatterns: [],
        constraints: [],
      },
    };

    const research: ResearchResult = {
      external: [],
      internal: {
        existingCode: [],
        patterns: [],
        conventions: [],
      },
      metadata: {
        totalSources: 0,
        tokenCount: 0,
        researchDurationMs: 0,
      },
    };

    const mockGenerateObject = mock(async () => ({
      object: {
        phases: [
          {
            id: "phase-1",
            name: "Design System",
            description: "Add dark tokens",
            tasks: [
              {
                id: "task-1",
                title: "Add tokens",
                requirement: "Add dark color tokens",
                acceptance: ["tokens exist"],
                filesHint: ["tailwind.config.js"],
              },
            ],
            dependsOn: [],
            estimatedDurationMs: 600_000,
            agentType: "codex",
          },
        ],
        resources: {
          agentCount: 1,
          strategy: "sequential",
          isolation: "container",
        },
        evaluationCriteria: [
          { name: "builds", weight: 0.5, threshold: "pass" },
        ],
      },
    }));

    mock.module("ai", () => ({
      generateObject: mockGenerateObject,
    }));

    const plan = await generatePhasedPlan(intent, research);

    expect(plan.phases).toHaveLength(1);
    expect(plan.phases[0].id).toBe("phase-1");
    expect(plan.phases[0].tasks).toHaveLength(1);
    expect(plan.resources.agentCount).toBe(1);
    expect(plan.evaluationCriteria).toHaveLength(1);
  });

  it("should include variant hint in prompt when provided", async () => {
    const intent: WorkflowIntent = {
      id: "test-intent-2",
      description: "Add feature",
      source: "chat",
      userId: "user-1",
      timestamp: new Date(),
      context: {
        existingPatterns: [],
        constraints: [],
      },
    };

    const research: ResearchResult = {
      external: [
        {
          id: "ext-1",
          source: "https://example.com/doc",
          title: "Documentation",
          summary: "Use TypeScript",
          reliability: 0.9,
          relevanceScore: 0.8,
        },
      ],
      internal: {
        existingCode: [],
        patterns: [{ id: "p-1", name: "use-typescript", confidence: 0.9 }],
        conventions: [
          { id: "c-1", description: "Use strict types", confidence: 1 },
        ],
      },
      metadata: {
        totalSources: 1,
        tokenCount: 100,
        researchDurationMs: 1000,
      },
    };

    let receivedPrompt = "";

    const mockGenerateObject = mock(async (args) => {
      receivedPrompt = args.prompt || "";
      return {
        object: {
          phases: [],
          resources: {
            agentCount: 1,
            strategy: "sequential",
            isolation: "container",
          },
          evaluationCriteria: [],
        },
      };
    });

    mock.module("ai", () => ({
      generateObject: mockGenerateObject,
    }));

    await generatePhasedPlan(intent, research, {
      variantHint: "Optimize for speed",
    });

    expect(receivedPrompt).toContain("Optimization Hint: Optimize for speed");
    expect(receivedPrompt).toContain("External Research:");
    expect(receivedPrompt).toContain("Internal Context:");
  });

  it("should pass abort signal to LLM call when provided", async () => {
    const intent: WorkflowIntent = {
      id: "test-intent-3",
      description: "Test abort",
      source: "chat",
      userId: "user-1",
      timestamp: new Date(),
      context: {
        existingPatterns: [],
        constraints: [],
      },
    };

    const research: ResearchResult = {
      external: [],
      internal: {
        existingCode: [],
        patterns: [],
        conventions: [],
      },
      metadata: {
        totalSources: 0,
        tokenCount: 0,
        researchDurationMs: 0,
      },
    };

    const abortController = new AbortController();
    abortController.abort();

    let receivedSignal: AbortSignal | undefined;

    const mockGenerateObject = mock(async (args) => {
      receivedSignal = args.abortSignal;
      return {
        object: {
          phases: [],
          resources: {
            agentCount: 1,
            strategy: "sequential",
            isolation: "container",
          },
          evaluationCriteria: [],
        },
      };
    });

    mock.module("ai", () => ({
      generateObject: mockGenerateObject,
    }));

    try {
      await generatePhasedPlan(intent, research, {
        signal: abortController.signal,
      });
    } catch {}

    expect(receivedSignal).toBeDefined();
    expect(receivedSignal?.aborted).toBe(true);
  });
});

describe("generatePlanVariants", () => {
  it("should generate multiple variants up to count", async () => {
    const intent: WorkflowIntent = {
      id: "test-intent-4",
      description: "Add feature",
      source: "chat",
      userId: "user-1",
      timestamp: new Date(),
      context: {
        existingPatterns: [],
        constraints: [],
      },
    };

    const research: ResearchResult = {
      external: [],
      internal: {
        existingCode: [],
        patterns: [],
        conventions: [],
      },
      metadata: {
        totalSources: 0,
        tokenCount: 0,
        researchDurationMs: 0,
      },
    };

    const mockGenerateObject = mock(async (args) => {
      const prompt = args.prompt || "";
      const hint = prompt.includes("Optimization Hint:")
        ? prompt.split("Optimization Hint: ")[1]?.split("\n")[0]
        : "default";

      return {
        object: {
          phases: [
            {
              id: "phase-1",
              name: "Phase 1",
              description: hint.includes("speed")
                ? "Fast approach"
                : (hint.includes("robust")
                  ? "Robust approach"
                  : "Balanced approach"),
              tasks: [],
              dependsOn: [],
              estimatedDurationMs: 600_000,
              agentType: "codex",
            },
          ],
          resources: {
            agentCount: 1,
            strategy: "sequential",
            isolation: "container",
          },
          evaluationCriteria: [],
        },
      };
    });

    mock.module("ai", () => ({
      generateObject: mockGenerateObject,
    }));

    const variants = await generatePlanVariants(intent, research, 2);

    expect(variants).toHaveLength(2);
    expect(variants[0].phases[0].description).toBe("Fast approach");
    expect(variants[1].phases[0].description).toBe("Robust approach");
  });

  it("should cap variants at maximum available hints", async () => {
    const intent: WorkflowIntent = {
      id: "test-intent-5",
      description: "Add feature",
      source: "chat",
      userId: "user-1",
      timestamp: new Date(),
      context: {
        existingPatterns: [],
        constraints: [],
      },
    };

    const research: ResearchResult = {
      external: [],
      internal: {
        existingCode: [],
        patterns: [],
        conventions: [],
      },
      metadata: {
        totalSources: 0,
        tokenCount: 0,
        researchDurationMs: 0,
      },
    };

    const mockGenerateObject = mock(async () => ({
      object: {
        phases: [],
        resources: {
          agentCount: 1,
          strategy: "sequential",
          isolation: "container",
        },
        evaluationCriteria: [],
      },
    }));

    mock.module("ai", () => ({
      generateObject: mockGenerateObject,
    }));

    const variants = await generatePlanVariants(intent, research, 10);

    expect(variants.length).toBeLessThanOrEqual(3);
  });
});
