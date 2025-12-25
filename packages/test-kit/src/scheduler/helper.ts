type MockTime = {
  now: () => Date;
  set: (value: Date) => void;
  advanceMs: (ms: number) => void;
};

type SpyFn = {
  mockImplementation: (
    fn: (...args: unknown[]) => Promise<unknown> | unknown
  ) => unknown;
  mock: { calls: unknown[][] };
};

function sleep(ms: number): Promise<void> {
  return Bun.sleep(ms);
}

/**
 * Deterministic time helper for scheduler tests.
 * Use `mockTime.now` to inject time into schedulers that accept a `now()` option.
 */
export function createMockTime(start = new Date("2025-01-01T00:00:00Z")): MockTime {
  let t = start.getTime();
  return {
    now: () => new Date(t),
    set: (value) => {
      t = value.getTime();
    },
    advanceMs: (ms) => {
      t += ms;
    },
  };
}

/**
 * Verifies a scheduler's "busy" / overlap guard by blocking the first tick and
 * ensuring the tick function is not invoked again until it resolves.
 *
 * The scheduler under test must:
 * - call `tickSpy` during its tick
 * - skip overlapping ticks (i.e., `tickSpy` should only run once while blocked)
 */
export async function assertConcurrencyGuard(options: {
  tickSpy: SpyFn;
  startScheduler: () => void;
  stopScheduler: () => void;
  blockedResult?: unknown;
  waitMs?: {
    first?: number;
    second?: number;
    settle?: number;
  };
}): Promise<void> {
  let blocked = true;
  const waitUntilUnblocked = async (): Promise<void> => {
    while (blocked) {
      await sleep(1);
    }
  };

  options.tickSpy.mockImplementation(async () => {
    await waitUntilUnblocked();
    return options.blockedResult ?? [];
  });

  const firstWait = options.waitMs?.first ?? 60;
  const secondWait = options.waitMs?.second ?? 60;
  const settle = options.waitMs?.settle ?? 20;

  options.startScheduler();

  // Allow first tick to start.
  await sleep(firstWait);
  // Allow the scheduler to attempt the second tick while first is still blocked.
  await sleep(secondWait);
  // Small settle time for setTimeout scheduling drift.
  await sleep(settle);

  if (options.tickSpy.mock.calls.length !== 1) {
    throw new Error(
      `Expected concurrency guard to keep tick calls at 1, got ${options.tickSpy.mock.calls.length}.`
    );
  }

  blocked = false;
  // Give the blocked tick a moment to unwind and reset internal scheduler state.
  await sleep(10);
  options.stopScheduler();
}

