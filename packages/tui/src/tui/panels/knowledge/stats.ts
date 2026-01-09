import { colors } from "../../theme";
import { bold, dim, fg } from "../../typography";

export type KnowledgeStats = {
  facts: number;
  notes: number;
  relations: number;
  lastIngestAt: number;
};

export function createMockStats(): KnowledgeStats {
  return {
    facts: 200 + Math.floor(Math.random() * 50),
    notes: 80 + Math.floor(Math.random() * 30),
    relations: 500 + Math.floor(Math.random() * 120),
    lastIngestAt: Date.now() - Math.floor(Math.random() * 60_000),
  };
}

export function getKnowledgeSummary(stats: KnowledgeStats): string {
  const total = stats.facts + stats.notes + stats.relations;
  return `${total} items`;
}

export function renderKnowledgeStatsGrid(
  stats: KnowledgeStats,
  _width: number
): string[] {
  const when = new Date(stats.lastIngestAt).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
  return [
    bold("Knowledge"),
    `  ${dim("Facts:")} ${fg(colors.primary)(String(stats.facts))}`,
    `  ${dim("Notes:")} ${fg(colors.muted)(String(stats.notes))}`,
    `  ${dim("Relations:")} ${fg(colors.warning)(String(stats.relations))}`,
    `  ${dim("Last ingest:")} ${dim(when)}`,
  ];
}

export type KnowledgeStatsSummary = {
  facts: number;
  relations: number;
  insights: number;
  anchors: number;
};

export function renderKnowledgeStats(
  stats: KnowledgeStatsSummary,
  _width: number
): string[] {
  return [
    bold("Knowledge"),
    `  ${dim("Facts:")} ${fg(colors.primary)(String(stats.facts))}`,
    `  ${dim("Relations:")} ${fg(colors.warning)(String(stats.relations))}`,
    `  ${dim("Insights:")} ${fg(colors.success)(String(stats.insights))}`,
    `  ${dim("Anchors:")} ${fg(colors.muted)(String(stats.anchors))}`,
  ];
}
