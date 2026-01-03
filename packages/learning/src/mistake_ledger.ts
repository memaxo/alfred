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

/**
 * Get mistakes with optional filtering and pagination.
 */
export function getMistakes(options?: {
  limit?: number;
  category?: string;
  since?: Date;
}): MistakeEntry[] {
  let results = [...ledger];

  if (options?.category) {
    results = results.filter((entry) => entry.category === options.category);
  }

  if (options?.since) {
    const sinceTime = options.since.getTime();
    results = results.filter(
      (entry) => new Date(entry.ts).getTime() >= sinceTime
    );
  }

  // Sort by timestamp descending (most recent first)
  results.sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());

  if (options?.limit && options.limit > 0) {
    results = results.slice(0, options.limit);
  }

  return results;
}

/**
 * Accuracy metrics by category.
 */
export type AccuracyMetrics = {
  category: string;
  total: number;
  errorRate: number;
  trend: "improving" | "stable" | "declining";
};

/**
 * Compute accuracy metrics by category from the mistake ledger.
 * Returns error rates and trends per category.
 */
export function getAccuracyMetrics(): AccuracyMetrics[] {
  const entries = getLedger();
  if (entries.length === 0) {
    return [];
  }

  // Group by category
  const grouped = new Map<string, MistakeEntry[]>();
  for (const entry of entries) {
    const key = entry.category ?? "uncategorized";
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key)?.push(entry);
  }

  const metrics: AccuracyMetrics[] = [];
  const totalEntries = entries.length;

  for (const [category, items] of grouped.entries()) {
    // Sort items by timestamp
    const sorted = [...items].sort(
      (a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime()
    );

    // Calculate trend: compare first half vs second half
    const midpoint = Math.floor(sorted.length / 2);
    const firstHalf = sorted.slice(0, midpoint).length;
    const secondHalf = sorted.slice(midpoint).length;

    let trend: "improving" | "stable" | "declining" = "stable";
    if (sorted.length >= 4) {
      if (secondHalf < firstHalf * 0.8) {
        trend = "improving";
      } else if (secondHalf > firstHalf * 1.2) {
        trend = "declining";
      }
    }

    metrics.push({
      category,
      total: items.length,
      errorRate: items.length / totalEntries,
      trend,
    });
  }

  // Sort by total errors descending
  metrics.sort((a, b) => b.total - a.total);

  return metrics;
}

/**
 * Learning insights based on recent patterns.
 */
export type LearningInsight = {
  id: string;
  type: "pattern" | "improvement" | "concern";
  title: string;
  description: string;
  confidence: number;
  category?: string;
  actionable: boolean;
};

/**
 * Generate learning insights from mistake patterns.
 */
export function getInsights(): LearningInsight[] {
  const metrics = getAccuracyMetrics();
  const insights: LearningInsight[] = [];

  for (const metric of metrics) {
    if (metric.trend === "improving") {
      insights.push({
        id: `insight-${metric.category}-improving`,
        type: "improvement",
        title: `${metric.category} improving`,
        description: `Error rate in ${metric.category} has decreased over recent interactions.`,
        confidence: 0.7,
        category: metric.category,
        actionable: false,
      });
    } else if (metric.trend === "declining") {
      insights.push({
        id: `insight-${metric.category}-concern`,
        type: "concern",
        title: `${metric.category} needs attention`,
        description: `Error rate in ${metric.category} has increased. Consider reviewing recent mistakes.`,
        confidence: 0.8,
        category: metric.category,
        actionable: true,
      });
    }

    if (metric.total >= 5) {
      insights.push({
        id: `insight-${metric.category}-pattern`,
        type: "pattern",
        title: `Recurring ${metric.category} issues`,
        description: `${metric.total} errors recorded in ${metric.category}. This may indicate a systematic issue.`,
        confidence: Math.min(0.9, 0.5 + metric.total * 0.05),
        category: metric.category,
        actionable: true,
      });
    }
  }

  // Sort by confidence descending
  insights.sort((a, b) => b.confidence - a.confidence);

  return insights;
}
