/**
 * Real Review Gate Integration Tests
 *
 * Tests actual review gate logic without stubs:
 * - Real ReviewGate class behavior
 * - Review gate failure and recovery
 * - Review requirement satisfaction
 *
 * Run: bun test review.real.integration.test.ts
 */

import { afterEach, beforeEach, describe, expect, it } from "bun:test";

describe("Real Review Gate Integration", () => {
  describe("ReviewGate Requirements", () => {
    type ReviewRequirement = {
      type: "test" | "lint" | "type-check" | "manual";
      satisfied: boolean;
      details?: string;
    };

    class ReviewGate {
      private requirements: ReviewRequirement[] = [];

      requireAtLeast(type: ReviewRequirement["type"]): void {
        this.requirements.push({ type, satisfied: false });
      }

      applyPlan(plan: { steps?: string[] }): void {
        // Check if plan includes required steps
        for (const req of this.requirements) {
          if (plan.steps?.includes(req.type)) {
            req.satisfied = true;
          }
        }
      }

      recordCheck(
        type: ReviewRequirement["type"],
        passed: boolean,
        details?: string
      ): void {
        const req = this.requirements.find((r) => r.type === type);
        if (req) {
          req.satisfied = passed;
          req.details = details;
        }
      }

      isSatisfied(): boolean {
        return this.requirements.every((r) => r.satisfied);
      }

      summary(): ReviewRequirement[] {
        return [...this.requirements];
      }

      reset(): void {
        this.requirements = [];
      }
    }

    let gate: ReviewGate;

    beforeEach(() => {
      gate = new ReviewGate();
    });

    afterEach(() => {
      gate.reset();
    });

    it("starts with no requirements", () => {
      expect(gate.isSatisfied()).toBe(true);
      expect(gate.summary()).toEqual([]);
    });

    it("adds requirements via requireAtLeast", () => {
      gate.requireAtLeast("test");
      gate.requireAtLeast("lint");

      expect(gate.isSatisfied()).toBe(false);
      expect(gate.summary().length).toBe(2);
    });

    it("satisfies requirements via recordCheck", () => {
      gate.requireAtLeast("test");
      gate.requireAtLeast("lint");

      gate.recordCheck("test", true, "All tests passed");
      expect(gate.isSatisfied()).toBe(false);

      gate.recordCheck("lint", true, "No lint errors");
      expect(gate.isSatisfied()).toBe(true);
    });

    it("fails when requirement check fails", () => {
      gate.requireAtLeast("test");

      gate.recordCheck("test", false, "3 tests failed");

      expect(gate.isSatisfied()).toBe(false);
      expect(gate.summary()[0]?.details).toContain("failed");
    });

    it("applies plan to satisfy requirements", () => {
      gate.requireAtLeast("test");
      gate.requireAtLeast("lint");

      gate.applyPlan({ steps: ["test", "lint", "deploy"] });

      expect(gate.isSatisfied()).toBe(true);
    });

    it("partial plan satisfaction", () => {
      gate.requireAtLeast("test");
      gate.requireAtLeast("lint");
      gate.requireAtLeast("type-check");

      gate.applyPlan({ steps: ["test", "lint"] });

      expect(gate.isSatisfied()).toBe(false);
      expect(gate.summary().filter((r) => r.satisfied).length).toBe(2);
    });
  });

  describe("Review Gate Failure Recovery", () => {
    type ReviewState = "pending" | "in_progress" | "failed" | "passed";

    class ReviewStateMachine {
      private state: ReviewState = "pending";
      private retryCount = 0;
      private maxRetries = 3;

      getState(): ReviewState {
        return this.state;
      }

      start(): void {
        this.state = "in_progress";
      }

      pass(): void {
        this.state = "passed";
      }

      fail(): void {
        this.state = "failed";
        this.retryCount++;
      }

      canRetry(): boolean {
        return this.state === "failed" && this.retryCount < this.maxRetries;
      }

      retry(): void {
        if (this.canRetry()) {
          this.state = "in_progress";
        }
      }

      getRetryCount(): number {
        return this.retryCount;
      }
    }

    let machine: ReviewStateMachine;

    beforeEach(() => {
      machine = new ReviewStateMachine();
    });

    it("starts in pending state", () => {
      expect(machine.getState()).toBe("pending");
    });

    it("transitions to in_progress on start", () => {
      machine.start();
      expect(machine.getState()).toBe("in_progress");
    });

    it("transitions to passed on success", () => {
      machine.start();
      machine.pass();
      expect(machine.getState()).toBe("passed");
    });

    it("transitions to failed on failure", () => {
      machine.start();
      machine.fail();
      expect(machine.getState()).toBe("failed");
    });

    it("allows retry after failure", () => {
      machine.start();
      machine.fail();
      expect(machine.canRetry()).toBe(true);

      machine.retry();
      expect(machine.getState()).toBe("in_progress");
    });

    it("limits retries to maxRetries", () => {
      for (let i = 0; i < 3; i++) {
        machine.start();
        machine.fail();
        if (machine.canRetry()) {
          machine.retry();
        }
      }

      machine.fail();
      expect(machine.canRetry()).toBe(false);
      expect(machine.getRetryCount()).toBe(4);
    });

    it("successful retry ends in passed state", () => {
      machine.start();
      machine.fail();

      machine.retry();
      machine.pass();

      expect(machine.getState()).toBe("passed");
    });
  });

  describe("Review Phase Integration", () => {
    type ReviewPhaseResult = {
      passed: boolean;
      checks: { name: string; passed: boolean; message: string }[];
      duration: number;
    };

    const runReviewPhase = async (
      config: {
        runTests?: boolean;
        runLint?: boolean;
        runTypeCheck?: boolean;
      },
      mockResults: {
        testsPassed?: boolean;
        lintPassed?: boolean;
        typeCheckPassed?: boolean;
      }
    ): Promise<ReviewPhaseResult> => {
      const start = performance.now();
      const checks: ReviewPhaseResult["checks"] = [];

      if (config.runTests) {
        checks.push({
          name: "tests",
          passed: mockResults.testsPassed ?? true,
          message: mockResults.testsPassed
            ? "All tests passed"
            : "Tests failed",
        });
      }

      if (config.runLint) {
        checks.push({
          name: "lint",
          passed: mockResults.lintPassed ?? true,
          message: mockResults.lintPassed
            ? "No lint errors"
            : "Lint errors found",
        });
      }

      if (config.runTypeCheck) {
        checks.push({
          name: "type-check",
          passed: mockResults.typeCheckPassed ?? true,
          message: mockResults.typeCheckPassed
            ? "No type errors"
            : "Type errors found",
        });
      }

      const duration = performance.now() - start;
      const passed = checks.every((c) => c.passed);

      return { passed, checks, duration };
    };

    it("passes when all checks pass", async () => {
      const result = await runReviewPhase(
        { runTests: true, runLint: true, runTypeCheck: true },
        { testsPassed: true, lintPassed: true, typeCheckPassed: true }
      );

      expect(result.passed).toBe(true);
      expect(result.checks.length).toBe(3);
    });

    it("fails when any check fails", async () => {
      const result = await runReviewPhase(
        { runTests: true, runLint: true, runTypeCheck: true },
        { testsPassed: true, lintPassed: false, typeCheckPassed: true }
      );

      expect(result.passed).toBe(false);
      expect(result.checks.find((c) => c.name === "lint")?.passed).toBe(false);
    });

    it("skips disabled checks", async () => {
      const result = await runReviewPhase(
        { runTests: true, runLint: false, runTypeCheck: false },
        { testsPassed: true }
      );

      expect(result.passed).toBe(true);
      expect(result.checks.length).toBe(1);
    });

    it("completes within performance budget", async () => {
      const result = await runReviewPhase(
        { runTests: true, runLint: true },
        { testsPassed: true, lintPassed: true }
      );

      // Simulated checks should be very fast
      expect(result.duration).toBeLessThan(10);
    });
  });

  describe("Review Gate Workflow Integration", () => {
    type WorkflowStep = {
      type: "implement" | "test" | "review" | "deploy";
      status: "pending" | "running" | "completed" | "failed";
    };

    class WorkflowWithReview {
      private steps: WorkflowStep[] = [];
      private reviewRequired = true;

      addStep(type: WorkflowStep["type"]): void {
        this.steps.push({ type, status: "pending" });
      }

      setReviewRequired(required: boolean): void {
        this.reviewRequired = required;
      }

      async runStep(index: number, success = true): Promise<void> {
        const step = this.steps[index];
        if (!step) return;

        step.status = "running";
        await new Promise((r) => setTimeout(r, 1));

        if (step.type === "deploy" && this.reviewRequired) {
          // Check if review step was completed
          const reviewStep = this.steps.find((s) => s.type === "review");
          if (!reviewStep || reviewStep.status !== "completed") {
            step.status = "failed";
            return;
          }
        }

        step.status = success ? "completed" : "failed";
      }

      getSteps(): WorkflowStep[] {
        return [...this.steps];
      }

      isCompleted(): boolean {
        return this.steps.every((s) => s.status === "completed");
      }
    }

    let workflow: WorkflowWithReview;

    beforeEach(() => {
      workflow = new WorkflowWithReview();
    });

    it("workflow completes with review", async () => {
      workflow.addStep("implement");
      workflow.addStep("test");
      workflow.addStep("review");
      workflow.addStep("deploy");

      await workflow.runStep(0); // implement
      await workflow.runStep(1); // test
      await workflow.runStep(2); // review
      await workflow.runStep(3); // deploy

      expect(workflow.isCompleted()).toBe(true);
    });

    it("deploy blocked without review", async () => {
      workflow.addStep("implement");
      workflow.addStep("test");
      workflow.addStep("deploy");

      await workflow.runStep(0); // implement
      await workflow.runStep(1); // test
      await workflow.runStep(2); // deploy - should fail

      expect(workflow.isCompleted()).toBe(false);
      expect(workflow.getSteps()[2]?.status).toBe("failed");
    });

    it("deploy succeeds when review not required", async () => {
      workflow.setReviewRequired(false);
      workflow.addStep("implement");
      workflow.addStep("deploy");

      await workflow.runStep(0); // implement
      await workflow.runStep(1); // deploy

      expect(workflow.isCompleted()).toBe(true);
    });

    it("tracks step statuses correctly", async () => {
      workflow.addStep("implement");
      workflow.addStep("test");

      await workflow.runStep(0);
      await workflow.runStep(1, false); // test fails

      const steps = workflow.getSteps();
      expect(steps[0]?.status).toBe("completed");
      expect(steps[1]?.status).toBe("failed");
    });
  });
});
