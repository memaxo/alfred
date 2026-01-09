/**
 * Ralph Wiggum Loop Tests
 *
 * Tests for iterative agent execution with promise-based completion detection.
 */

import { beforeEach, describe, expect, it, mock } from "bun:test";
import {
  createRalphState,
  deactivateRalphState,
  extractPromise,
  isPromiseMatch,
  runRalphLoop,
  updateRalphState,
} from "./ralph.js";

// ─────────────────────────────────────────────────────────────────────────────
// Mock Setup
// ─────────────────────────────────────────────────────────────────────────────

// Mock toolCodex
const mockCodexExecute = mock(() =>
  Promise.resolve({
    result: "Task in progress...",
    artifacts: [],
  })
);

// Mock toolDroid
const mockDroidExecute = mock(() =>
  Promise.resolve({
    result: "Working on it...",
    artifacts: [],
  })
);

// Mock toolOpenCode
const mockOpenCodeExecute = mock(() =>
  Promise.resolve({
    result: "OpenCode iteration...",
    artifacts: [],
  })
);

mock.module("../tool/codex/index.js", () => ({
  toolCodex: {
    execute: mockCodexExecute,
  },
}));

mock.module("../tool/droid.js", () => ({
  toolDroid: {
    execute: mockDroidExecute,
  },
  droidInputSchema: {},
}));

mock.module("../tool/opencode/index.js", () => ({
  toolOpenCode: {
    execute: mockOpenCodeExecute,
  },
  opencodeInputSchema: {},
}));

// Mock metrics (no-op)
mock.module("./metrics.js", () => ({
  recordRalphIteration: () => {},
  recordRalphCompletion: () => {},
  recordRalphStuck: () => {},
  recordRalphTimeout: () => {},
}));

// Mock logger
mock.module("@alfred/logger", () => ({
  logger: {
    info: () => {},
    warn: () => {},
    error: () => {},
    debug: () => {},
  },
}));

// Mock LoopDetector
mock.module("@alfred/cognitive", () => ({
  LoopDetector: class MockLoopDetector {
    check() {
      return { loop: false };
    }
    reset() {}
    getTransitionCount() {
      return 0;
    }
    getWindowSize() {
      return 0;
    }
  },
}));

beforeEach(() => {
  mockCodexExecute.mockReset();
  mockDroidExecute.mockReset();
  mockOpenCodeExecute.mockReset();

  // Default mock implementations
  mockCodexExecute.mockImplementation(() =>
    Promise.resolve({
      result: "Task in progress...",
      artifacts: [],
    })
  );

  mockDroidExecute.mockImplementation(() =>
    Promise.resolve({
      result: "Working on it...",
      artifacts: [],
    })
  );

  mockOpenCodeExecute.mockImplementation(() =>
    Promise.resolve({
      result: "OpenCode iteration...",
      artifacts: [],
    })
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// Promise Detection Tests
// ─────────────────────────────────────────────────────────────────────────────

describe("extractPromise", () => {
  it("extracts promise text from valid tag", () => {
    const output = "Some text <promise>TASK COMPLETE</promise> more text";
    expect(extractPromise(output)).toBe("TASK COMPLETE");
  });

  it("returns null when no promise tag present", () => {
    const output = "Just some regular output without any promise";
    expect(extractPromise(output)).toBeNull();
  });

  it("handles multiline promise content", () => {
    const output = `Result: <promise>
      MULTI
      LINE
      PROMISE
    </promise>`;
    expect(extractPromise(output)).toBe("MULTI\n      LINE\n      PROMISE");
  });

  it("handles empty promise tag", () => {
    const output = "Output <promise></promise> done";
    expect(extractPromise(output)).toBe("");
  });

  it("is case insensitive for tag", () => {
    const output = "Test <PROMISE>DONE</PROMISE> end";
    expect(extractPromise(output)).toBe("DONE");
  });

  it("extracts first promise when multiple present", () => {
    const output = "<promise>FIRST</promise> <promise>SECOND</promise>";
    expect(extractPromise(output)).toBe("FIRST");
  });
});

describe("isPromiseMatch", () => {
  it("returns true when extracted matches expected", () => {
    expect(isPromiseMatch("TASK COMPLETE", "TASK COMPLETE")).toBe(true);
  });

  it("returns true for case-insensitive match", () => {
    expect(isPromiseMatch("task complete", "TASK COMPLETE")).toBe(true);
  });

  it("returns true for partial match", () => {
    expect(isPromiseMatch("Task is COMPLETE now", "COMPLETE")).toBe(true);
  });

  it("returns false when no match", () => {
    expect(isPromiseMatch("STILL WORKING", "COMPLETE")).toBe(false);
  });

  it("returns true for any promise when expected is undefined", () => {
    expect(isPromiseMatch("ANYTHING", undefined)).toBe(true);
  });

  it("returns false when extracted is null", () => {
    expect(isPromiseMatch(null, "COMPLETE")).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// State Management Tests
// ─────────────────────────────────────────────────────────────────────────────

describe("createRalphState", () => {
  it("creates initial state with defaults", () => {
    const state = createRalphState("Test prompt", { maxIterations: 5 });

    expect(state.iteration).toBe(0);
    expect(state.prompt).toBe("Test prompt");
    expect(state.config.maxIterations).toBe(5);
    expect(state.results).toEqual([]);
    expect(state.active).toBe(true);
    expect(state.startedAt).toBeGreaterThan(0);
  });

  it("merges config with defaults", () => {
    const state = createRalphState("Prompt", {
      maxIterations: 20,
      completionPromise: "DONE",
    });

    expect(state.config.maxIterations).toBe(20);
    expect(state.config.completionPromise).toBe("DONE");
    expect(state.config.stallMs).toBe(60_000); // default
  });
});

describe("updateRalphState", () => {
  it("increments iteration and appends result", () => {
    const initial = createRalphState("Prompt", { maxIterations: 10 });
    const updated = updateRalphState(initial, "First result");

    expect(updated.iteration).toBe(1);
    expect(updated.results).toEqual(["First result"]);
    expect(updated.active).toBe(true);
  });

  it("preserves original state immutability", () => {
    const initial = createRalphState("Prompt", { maxIterations: 10 });
    const _updated = updateRalphState(initial, "Result");

    expect(initial.iteration).toBe(0);
    expect(initial.results).toEqual([]);
  });
});

describe("deactivateRalphState", () => {
  it("sets active to false", () => {
    const state = createRalphState("Prompt", { maxIterations: 10 });
    const deactivated = deactivateRalphState(state);

    expect(deactivated.active).toBe(false);
    expect(state.active).toBe(true); // original unchanged
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Integration Tests
// ─────────────────────────────────────────────────────────────────────────────

describe("runRalphLoop", () => {
  it("completes when promise detected on first iteration", async () => {
    mockCodexExecute.mockImplementation(() =>
      Promise.resolve({
        result: "Done! <promise>TASK COMPLETE</promise>",
        artifacts: [{ path: "file.ts", kind: "file" }],
      })
    );

    const result = await runRalphLoop({
      executor: "codex",
      prompt: "Fix the bug",
      config: {
        maxIterations: 5,
        completionPromise: "TASK COMPLETE",
      },
      toolInput: {
        out: "text",
        auto: "low",
      },
    });

    expect(result.completed).toBe(true);
    expect(result.iterations).toBe(1);
    expect(result.promiseDetected).toBe("TASK COMPLETE");
    expect(result.artifacts).toHaveLength(1);
    expect(mockCodexExecute).toHaveBeenCalledTimes(1);
  });

  it("iterates until promise detected", async () => {
    let callCount = 0;
    mockCodexExecute.mockImplementation(() => {
      callCount++;
      if (callCount < 3) {
        return Promise.resolve({
          result: "Still working...",
          artifacts: [],
        });
      }
      return Promise.resolve({
        result: "Finally! <promise>DONE</promise>",
        artifacts: [],
      });
    });

    const result = await runRalphLoop({
      executor: "codex",
      prompt: "Complex task",
      config: {
        maxIterations: 10,
        completionPromise: "DONE",
      },
      toolInput: {
        out: "text",
        auto: "low",
      },
    });

    expect(result.completed).toBe(true);
    expect(result.iterations).toBe(3);
    expect(result.promiseDetected).toBe("DONE");
  });

  it("stops at max iterations when no promise", async () => {
    mockCodexExecute.mockImplementation(() =>
      Promise.resolve({
        result: "Never completing...",
        artifacts: [],
      })
    );

    const result = await runRalphLoop({
      executor: "codex",
      prompt: "Impossible task",
      config: {
        maxIterations: 3,
        completionPromise: "NEVER_HAPPENS",
      },
      toolInput: {
        out: "text",
        auto: "low",
      },
    });

    expect(result.completed).toBe(false);
    expect(result.iterations).toBe(3);
    expect(result.stuckReason).toBe("max_iterations");
    expect(mockCodexExecute).toHaveBeenCalledTimes(3);
  });

  it("works with droid executor", async () => {
    mockDroidExecute.mockImplementation(() =>
      Promise.resolve({
        result: "Droid done! <promise>FINISHED</promise>",
        artifacts: [],
      })
    );

    const result = await runRalphLoop({
      executor: "droid",
      prompt: "Droid task",
      config: {
        maxIterations: 5,
        completionPromise: "FINISHED",
      },
      toolInput: {
        out: "text",
        auto: "low",
      },
    });

    expect(result.completed).toBe(true);
    expect(result.promiseDetected).toBe("FINISHED");
    expect(mockDroidExecute).toHaveBeenCalledTimes(1);
  });

  it("accepts any promise when completionPromise not specified", async () => {
    mockCodexExecute.mockImplementation(() =>
      Promise.resolve({
        result: "<promise>ARBITRARY COMPLETION</promise>",
        artifacts: [],
      })
    );

    const result = await runRalphLoop({
      executor: "codex",
      prompt: "Open-ended task",
      config: {
        maxIterations: 5,
        // No completionPromise specified
      },
      toolInput: {
        out: "text",
        auto: "low",
      },
    });

    expect(result.completed).toBe(true);
    expect(result.promiseDetected).toBe("ARBITRARY COMPLETION");
  });

  it("handles abort signal", async () => {
    const controller = new AbortController();
    controller.abort();

    const result = await runRalphLoop({
      executor: "codex",
      prompt: "Aborted task",
      config: {
        maxIterations: 10,
      },
      toolInput: {
        out: "text",
        auto: "low",
      },
      signal: controller.signal,
    });

    expect(result.completed).toBe(false);
    expect(result.stuckReason).toBe("aborted");
    expect(mockCodexExecute).not.toHaveBeenCalled();
  });

  it("continues after iteration errors", async () => {
    let callCount = 0;
    mockCodexExecute.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.reject(new Error("Temporary failure"));
      }
      return Promise.resolve({
        result: "<promise>RECOVERED</promise>",
        artifacts: [],
      });
    });

    const result = await runRalphLoop({
      executor: "codex",
      prompt: "Flaky task",
      config: {
        maxIterations: 5,
        completionPromise: "RECOVERED",
      },
      toolInput: {
        out: "text",
        auto: "low",
      },
    });

    expect(result.completed).toBe(true);
    expect(result.iterations).toBe(2);
  });

  it("accumulates artifacts across iterations", async () => {
    let callCount = 0;
    mockCodexExecute.mockImplementation(() => {
      callCount++;
      if (callCount < 3) {
        return Promise.resolve({
          result: "Working...",
          artifacts: [{ path: `file${callCount}.ts`, kind: "file" }],
        });
      }
      return Promise.resolve({
        result: "<promise>DONE</promise>",
        artifacts: [{ path: "final.ts", kind: "file" }],
      });
    });

    const result = await runRalphLoop({
      executor: "codex",
      prompt: "Multi-file task",
      config: {
        maxIterations: 5,
        completionPromise: "DONE",
      },
      toolInput: {
        out: "text",
        auto: "low",
      },
    });

    expect(result.artifacts).toHaveLength(3);
    expect(result.artifacts.map((a) => a.path)).toEqual([
      "file1.ts",
      "file2.ts",
      "final.ts",
    ]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Edge Cases
// ─────────────────────────────────────────────────────────────────────────────

describe("edge cases", () => {
  it("handles empty result from executor", async () => {
    mockCodexExecute.mockImplementation(() =>
      Promise.resolve({
        result: "",
        artifacts: [],
      })
    );

    const result = await runRalphLoop({
      executor: "codex",
      prompt: "Silent task",
      config: {
        maxIterations: 2,
      },
      toolInput: {
        out: "text",
        auto: "low",
      },
    });

    expect(result.completed).toBe(false);
    expect(result.iterations).toBe(2);
    expect(result.result).toBe("");
  });

  it("handles promise at very end of output", async () => {
    mockCodexExecute.mockImplementation(() =>
      Promise.resolve({
        result: "Long output...\n\n<promise>END</promise>",
        artifacts: [],
      })
    );

    const result = await runRalphLoop({
      executor: "codex",
      prompt: "Task",
      config: {
        maxIterations: 5,
        completionPromise: "END",
      },
      toolInput: {
        out: "text",
        auto: "low",
      },
    });

    expect(result.completed).toBe(true);
  });

  it("iteration 0 prompt has no iteration context", async () => {
    let receivedPrompt = "";
    mockCodexExecute.mockImplementation(
      (args: { input: { prompt: string } }) => {
        receivedPrompt = args.input.prompt;
        return Promise.resolve({
          result: "<promise>DONE</promise>",
          artifacts: [],
        });
      }
    );

    await runRalphLoop({
      executor: "codex",
      prompt: "Original prompt",
      config: {
        maxIterations: 5,
      },
      toolInput: {
        out: "text",
        auto: "low",
      },
    });

    expect(receivedPrompt).toBe("Original prompt");
  });

  it("subsequent iterations include context", async () => {
    let callCount = 0;
    let secondPrompt = "";

    mockCodexExecute.mockImplementation(
      (args: { input: { prompt: string } }) => {
        callCount++;
        if (callCount === 2) {
          secondPrompt = args.input.prompt;
          return Promise.resolve({
            result: "<promise>DONE</promise>",
            artifacts: [],
          });
        }
        return Promise.resolve({
          result: "Not done yet",
          artifacts: [],
        });
      }
    );

    await runRalphLoop({
      executor: "codex",
      prompt: "Base prompt",
      config: {
        maxIterations: 5,
        completionPromise: "DONE",
      },
      toolInput: {
        out: "text",
        auto: "low",
      },
    });

    expect(secondPrompt).toContain("Base prompt");
    expect(secondPrompt).toContain("Ralph Loop");
    expect(secondPrompt).toContain("Iteration 2");
  });
});
