process.env.DATABASE_URL = "sqlite::memory:";
process.env.OPENAI_API_KEY ??= "test-key";
process.env.DISABLE_TRPC_METRICS = "1";
process.env.DISABLE_METRICS_HOOKS = "1";

import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "bun:test";
import type { WorkflowEvent } from "@alfred/type";

const [
  { WorkflowTestHarness },
  { toObservable },
  { createWorkflowCaller },
] = await Promise.all([
  import("./utils/workflow-server"),
  import("./utils/stream"),
  import("./utils/workflow-caller"),
]);

const minimalInput = {
  requirement: "TRPC workflow integration",
  auto: "low" as const,
  mode: "sequential" as const,
};

describe("workflowRouter.stream integration", () => {
  let harness: WorkflowTestHarness;

  beforeAll(() => {
    harness = new WorkflowTestHarness();
  });

  beforeEach(async () => {
    await harness.reset();
  });

  afterAll(async () => {
    await harness.close();
  });

  it("streams workflow events end-to-end", async () => {
    const caller = await harness.createCaller();
    const events: WorkflowEvent[] = [];

    const subscription = await caller.stream(minimalInput);
    const observable = toObservable<WorkflowEvent>(subscription);

    await new Promise<void>((resolve, reject) => {
      const sub = observable.subscribe({
        next: (event) => events.push(event),
        error: (error) => {
          sub.unsubscribe?.();
          reject(error);
        },
        complete: () => {
          sub.unsubscribe?.();
          resolve();
        },
      });
    });

    expect(events.length).toBeGreaterThan(0);
    expect(events.some((event) => event.type === "run")).toBeTruthy();
  });

  it("rejects unauthenticated callers", async () => {
    const caller = await createWorkflowCaller({ user: null });
    await expect(caller.stream(minimalInput)).rejects.toMatchObject({
      message: "Authentication required",
    });
  });
});
