# patterns

Reusable patterns and helpers for ALFRED tests.

## Router tests (tRPC)

Use `@alfred/test-kit/router` to standardize caller setup and common assertions.

```ts
import { describe, it, mock, vi } from "bun:test";
import { assertAuthGuard, assertPolicyEnforced, createAuthedCaller, createUnauthedCaller } from "@alfred/test-kit/router";
import type { Obligation } from "@alfred/type";

const evaluateMock = vi.fn().mockResolvedValue({ allow: true, obligations: [] as Obligation[] });
mock.module("@alfred/policy", () => ({ evaluate: evaluateMock, registerCacheObs: vi.fn() }));

describe("workflow router", () => {
  it("requires auth", async () => {
    const unauthed = await createUnauthedCaller();
    await assertAuthGuard(() => unauthed.workflow.start({ requirement: "x", auto: "low" }));
  });

  it("invokes policy middleware", async () => {
    const caller = await createAuthedCaller("user-1", { roles: ["owner"], scopes: ["workflow.plan"] });
    await caller.workflow.start({ requirement: "x", auto: "low" });
    await assertPolicyEnforced({ action: "workflow.plan", evaluate: evaluateMock });
  });
});
```

## Repository tests (DB)

Use `@alfred/test-kit/repo` for consistent DB isolation, cleanup, and performance checks.

```ts
import { afterAll, beforeAll, beforeEach, describe, it } from "bun:test";
import { assertQueryBudget, createIsolatedDb, resetTables } from "@alfred/test-kit/repo";
import { sql } from "drizzle-orm";

let dbh: Awaited<ReturnType<typeof createIsolatedDb>>;

describe("repo tests", () => {
  beforeAll(async () => {
    dbh = await createIsolatedDb();
  });

  afterAll(async () => {
    await dbh.close();
  });

  beforeEach(async () => {
    await resetTables(dbh.db, ["user_profiles", "user_preferences"]);
  });

  it("stays within query budget", async () => {
    await assertQueryBudget(async () => {
      await dbh.db.execute(sql`select 1`);
    }, 25);
  });
});
```

## Scheduler tests

Use `@alfred/test-kit/scheduler` for deterministic time and concurrency-guard assertions.

```ts
import { describe, it, vi } from "bun:test";
import { assertConcurrencyGuard, createMockTime } from "@alfred/test-kit/scheduler";
// Example: in `packages/api/test`, import the scheduler under test via a relative path.
import { startReminderScheduler, stopReminderScheduler } from "../../src/scheduler/remind";

describe("remind scheduler", () => {
  it("skips overlapping ticks", async () => {
    const time = createMockTime(new Date("2025-01-27T12:00:00Z"));
    const tickSpy = vi.fn();

    await assertConcurrencyGuard({
      tickSpy,
      startScheduler: () => {
        startReminderScheduler({ intervalMs: 50, now: time.now });
      },
      stopScheduler: () => {
        stopReminderScheduler();
      },
    });
  });
});
```

