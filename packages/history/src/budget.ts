import type { HistoryBudget } from "./types";

const DEFAULT_MIN_SYSTEM_RESERVE = 2000;
const DEFAULT_MIN_HEADROOM = 2000;

function parseEnvNumber(raw: string | undefined): number | null {
  if (!raw) {
    return null;
  }
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

export function getHistoryBudgetDefaults(): Partial<HistoryBudget> {
  const ratio = parseEnvNumber(process.env.HISTORY_CONTEXT_RATIO);
  const minSystem = parseEnvNumber(process.env.HISTORY_MIN_SYSTEM_RESERVE);
  const minHeadroom = parseEnvNumber(process.env.HISTORY_MIN_HEADROOM);

  const overrides: Partial<HistoryBudget> = {};
  if (typeof ratio === "number") {
    overrides.historyRatio = ratio;
  }
  overrides.minSystemReserveTokens =
    typeof minSystem === "number" ? minSystem : DEFAULT_MIN_SYSTEM_RESERVE;
  overrides.minHeadroomTokens =
    typeof minHeadroom === "number" ? minHeadroom : DEFAULT_MIN_HEADROOM;
  return overrides;
}

export function mergeHistoryBudget(
  overrides?: Partial<HistoryBudget>
): Partial<HistoryBudget> {
  if (!overrides) {
    return getHistoryBudgetDefaults();
  }
  return {
    ...getHistoryBudgetDefaults(),
    ...overrides,
  };
}
