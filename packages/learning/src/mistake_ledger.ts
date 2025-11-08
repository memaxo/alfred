import type {
  KnowledgeConfidence,
  KnowledgeInsight,
} from "@alfred/type/knowledge";

export type MistakeEntry = {
  id: string;
  cause: string;
  effect: string;
  category: string;
  context?: Record<string, unknown>;
  ts: string;
};

const ledger: MistakeEntry[] = [];

const confidence = (value: number) =>
  Math.max(0, Math.min(1, value)) as KnowledgeConfidence;

export function recordMistake(entry: MistakeEntry): void {
  ledger.push({ ...entry });
}

export function analyzeMistakes(
  entries: MistakeEntry[] = ledger
): KnowledgeInsight[] {
  if (entries.length === 0) {
    return [];
  }

  const grouped = new Map<string, MistakeEntry[]>();
  for (const entry of entries) {
    const key = entry.category ?? "uncategorized";
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key)!.push(entry);
  }

  const insights: KnowledgeInsight[] = [];
  for (const [category, items] of grouped.entries()) {
    insights.push({
      id: `mistake-${category}-${items.length}`,
      derived: items.map((item) => item.id),
      conclusion: `Observed ${items.length} issue(s) in ${category}.`,
      confidence: confidence(
        Math.min(1, items.length / Math.max(entries.length, 1))
      ),
      rationale: `Recent mistakes indicate focus area: ${category}.`,
    });
  }

  return insights;
}
