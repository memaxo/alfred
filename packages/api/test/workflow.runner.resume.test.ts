import { describe, expect, it } from "bun:test";
// Import mock-metrics first - it provides metrics stubs including runnerStepsTotal/runnerErrorsTotal
import "./utils/mock-metrics";

import { runPlanV6 } from "@alfred/api/workflow/runner";

async function* _takeUntil<T>(
  gen: AsyncGenerator<T>,
  predicate: (e: any) => boolean
) {
  for await (const e of gen) {
    yield e;
    if (predicate(e)) {
      return;
    }
  }
}

describe("workflow runner resume", () => {
  it("accepts bio-authz resume and continues", async () => {
    const runner = runPlanV6(
      { requirement: "deploy", auto: "medium", context: { enable: false } },
      { stepTimeoutMs: 2000, workflowTimeoutMs: 5000 }
    );

    const collected: any[] = [];
    const it = runner.stream[Symbol.asyncIterator]();
    while (true) {
      const { value, done } = await it.next();
      if (done) {
        break;
      }
      collected.push(value);
      if ((value as any)?.type === "require-scope") {
        break;
      }
    }
    await runner.resume({ event: "bio-authz", authz: "Bearer test" });
    // Continue draining until done
    while (true) {
      const { value, done } = await it.next();
      if (done) {
        break;
      }
      collected.push(value);
    }

    const hasAck = collected.some(
      (e) =>
        e?.type === "notice" &&
        /Authorization 'bio-authz' acknowledged/i.test(e?.message ?? "")
    );
    const completed = collected.some(
      (e) => e?.type === "progress" && e?.pct === 100
    );
    expect(hasAck).toBe(true);
    expect(completed).toBe(true);
  });
});
