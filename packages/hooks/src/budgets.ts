import type { HookBudget, HookFailMode } from "@alfred/type";

export function resolveBudgetMs(
  eventType: string,
  budgets: readonly HookBudget[]
): number {
  const category = eventType.split(":")[0] ?? "workflow";
  const match = budgets.find((b) => b.category === category);
  return match?.budgetMs ?? 500;
}

export function resolveFailMode(
  eventType: string,
  override: HookFailMode | undefined,
  defaults: Partial<Record<string, HookFailMode>>
): HookFailMode {
  if (override) {
    return override;
  }

  const exact = defaults[eventType];
  if (exact) {
    return exact;
  }

  let best: { key: string; mode: HookFailMode } | null = null;

  for (const [key, mode] of Object.entries(defaults)) {
    if (!mode) {
      continue;
    }

    if (key.endsWith(":") && eventType.startsWith(key)) {
      if (!best || key.length > best.key.length) {
        best = { key, mode };
      }
    }
  }

  return best?.mode ?? "open";
}
