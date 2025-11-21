// import { nowNs } from "@alfred/metrics/performance";

function nowNs(): bigint {
  return process.hrtime.bigint();
}

type MaybePromise<T> = T | Promise<T>;

type Runner<T> = () => MaybePromise<T>;

function elapsedMs(start: bigint): number {
  return Number(nowNs() - start) / 1_000_000;
}

function logBudget(_label: string, duration: number, budgetMs: number): void {
  if (duration > budgetMs) {
  }
}

export function measureSync<T>(
  label: string,
  budgetMs: number,
  fn: () => T
): T {
  const start = nowNs();
  try {
    return fn();
  } finally {
    logBudget(label, elapsedMs(start), budgetMs);
  }
}

export async function measureAsync<T>(
  label: string,
  budgetMs: number,
  fn: Runner<T>
): Promise<T> {
  const start = nowNs();
  try {
    return await fn();
  } finally {
    logBudget(label, elapsedMs(start), budgetMs);
  }
}
