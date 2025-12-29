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

/**
 * AgentFS-derived mistake entry from learning bridge.
 * Compatible with @alfred/agent/agentfs/learning-bridge MistakeEntry.
 */
export type AgentFSMistakeEntry = {
  id: string;
  category: string;
  description: string;
  context: Record<string, unknown>;
  severity: "low" | "medium" | "high";
  timestamp: string;
};

const ledger: MistakeEntry[] = [];

const confidence = (value: number) =>
  Math.max(0, Math.min(1, value)) as KnowledgeConfidence;

export function recordMistake(entry: MistakeEntry): void {
  ledger.push({ ...entry });
}

/**
 * Record an AgentFS-derived mistake entry to the ledger.
 *
 * Converts AgentFS format from @alfred/agent/agentfs/learning-bridge
 * to the ledger format for tracking.
 *
 * @param entry AgentFS mistake entry from learning bridge
 */
export function recordAgentFSMistake(entry: AgentFSMistakeEntry): void {
  ledger.push({
    id: entry.id,
    cause: entry.category,
    effect: entry.description,
    category: entry.category,
    context: entry.context,
    ts: entry.timestamp,
  });
}

/**
 * Record multiple AgentFS-derived mistake entries.
 *
 * @param entries Array of AgentFS mistake entries
 * @returns Number of entries recorded
 */
export function recordAgentFSMistakes(entries: AgentFSMistakeEntry[]): number {
  for (const entry of entries) {
    recordAgentFSMistake(entry);
  }
  return entries.length;
}

/**
 * Process an AgentFS database and integrate mistakes into the ledger.
 *
 * This is a convenience function that extracts mistakes from an AgentFS
 * database path using the learning bridge and records them.
 *
 * @param agentfsDbPath Path to the AgentFS database file
 * @returns Object with count of mistakes recorded and insights generated
 * @throws Error if database file not found or AgentFS SDK unavailable
 */
export async function processAgentFSForLearning(
  agentfsDbPath: string,
  opts?: {
    processForLearning?: (dbPath: string) => Promise<{
      patterns: unknown[];
      mistakes: AgentFSMistakeEntry[];
      insights: Array<{
        id: string;
        derived: string[];
        conclusion: string;
        confidence: { value: number };
        rationale: string;
      }>;
    }>;
  }
): Promise<{ mistakesRecorded: number; insights: KnowledgeInsight[] }> {
  try {
    const processForLearning = opts?.processForLearning;
    if (!processForLearning) {
      throw new Error("agentfs_learning_bridge_missing");
    }
    const { mistakes, insights: agentfsInsights } =
      await processForLearning(agentfsDbPath);

    const recorded = recordAgentFSMistakes(mistakes as AgentFSMistakeEntry[]);

    // Convert AgentFS insights to KnowledgeInsight format
    const knowledgeInsights: KnowledgeInsight[] = agentfsInsights.map(
      (insight) => ({
        id: insight.id,
        derived: insight.derived,
        conclusion: insight.conclusion,
        confidence: confidence(insight.confidence.value),
        rationale: insight.rationale,
      })
    );

    return { mistakesRecorded: recorded, insights: knowledgeInsights };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    throw new Error(`agentfs_learning_integration_failed: ${msg}`);
  }
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
    grouped.get(key)?.push(entry);
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

// Export ledger for testing purposes
export function getLedger(): MistakeEntry[] {
  return [...ledger];
}

export function clearLedger(): void {
  ledger.length = 0;
}
