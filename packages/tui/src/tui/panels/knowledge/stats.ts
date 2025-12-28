/**
 * ALFRED TUI Knowledge Stats
 *
 * Displays knowledge graph statistics.
 */

import { colors, progressChars } from "../../theme";
import { bold, dim, fg } from "../../typography";

// ─── Types ───────────────────────────────────────────────────────────────────

export type KnowledgeStats = {
  facts: number;
  relations: number;
  insights: number;
  anchors: number;
};

// ─── Stat Formatting ─────────────────────────────────────────────────────────

function formatCount(count: number): string {
  if (count < 1000) {
    return count.toString();
  }
  if (count < 1_000_000) {
    return `${(count / 1000).toFixed(1)}K`;
  }
  return `${(count / 1_000_000).toFixed(1)}M`;
}

// ─── Stats Rendering ─────────────────────────────────────────────────────────

export function renderKnowledgeStat(
  label: string,
  count: number,
  icon: string,
  color: string,
  _width: number
): string {
  const iconStyled = fg(color)(icon);
  const countStyled = bold(fg(color)(formatCount(count)));
  const labelStyled = dim(label);

  return `${iconStyled} ${countStyled} ${labelStyled}`;
}

export function renderKnowledgeStats(
  stats: KnowledgeStats,
  width: number
): string[] {
  const lines: string[] = [];

  // Facts
  lines.push(
    renderKnowledgeStat("facts", stats.facts, "◆", colors.primary, width)
  );

  // Relations
  lines.push(
    renderKnowledgeStat(
      "relations",
      stats.relations,
      "─",
      colors.success,
      width
    )
  );

  // Insights
  lines.push(
    renderKnowledgeStat("insights", stats.insights, "★", colors.warning, width)
  );

  // Anchors
  lines.push(
    renderKnowledgeStat("anchors", stats.anchors, "⚓", colors.muted, width)
  );

  return lines;
}

export function renderKnowledgeStatsCompact(stats: KnowledgeStats): string {
  const facts = `${fg(colors.primary)("◆")}${formatCount(stats.facts)}`;
  const relations = `${fg(colors.success)("─")}${formatCount(stats.relations)}`;
  const insights = `${fg(colors.warning)("★")}${formatCount(stats.insights)}`;

  return `${facts} ${relations} ${insights}`;
}

// ─── Stats Grid ──────────────────────────────────────────────────────────────

export function renderKnowledgeStatsGrid(
  stats: KnowledgeStats,
  width: number
): string[] {
  const lines: string[] = [];
  const halfWidth = Math.floor(width / 2);

  // Row 1: Facts and Relations
  const factsCell = renderKnowledgeStat(
    "facts",
    stats.facts,
    "◆",
    colors.primary,
    halfWidth
  );
  const relationsCell = renderKnowledgeStat(
    "relations",
    stats.relations,
    "─",
    colors.success,
    halfWidth
  );
  lines.push(`${factsCell.padEnd(halfWidth)}${relationsCell}`);

  // Row 2: Insights and Anchors
  const insightsCell = renderKnowledgeStat(
    "insights",
    stats.insights,
    "★",
    colors.warning,
    halfWidth
  );
  const anchorsCell = renderKnowledgeStat(
    "anchors",
    stats.anchors,
    "⚓",
    colors.muted,
    halfWidth
  );
  lines.push(`${insightsCell.padEnd(halfWidth)}${anchorsCell}`);

  return lines;
}

// ─── Stats Summary ───────────────────────────────────────────────────────────

export function getKnowledgeSummary(stats: KnowledgeStats): string {
  const total = stats.facts + stats.relations + stats.insights;

  if (total === 0) {
    return dim("Knowledge graph is empty");
  }

  if (total < 100) {
    return dim("Building knowledge...");
  }

  if (stats.insights > stats.facts * 0.1) {
    return fg(colors.success)("Rich insights available");
  }

  return dim("Growing knowledge base");
}

// ─── Growth Indicator ────────────────────────────────────────────────────────

export function renderGrowthIndicator(
  current: number,
  previous: number
): string {
  if (previous === 0) {
    return dim("new");
  }

  const growth = ((current - previous) / previous) * 100;

  if (Math.abs(growth) < 1) {
    return dim("stable");
  }

  const arrow = growth > 0 ? "↑" : "↓";
  const color = growth > 0 ? colors.success : colors.error;

  return `${fg(color)(arrow)}${Math.abs(growth).toFixed(0)}%`;
}

// ─── Stats Bar Chart ─────────────────────────────────────────────────────────

export function renderStatsBarChart(
  stats: KnowledgeStats,
  width: number
): string[] {
  const lines: string[] = [];
  const maxValue = Math.max(
    stats.facts,
    stats.relations,
    stats.insights,
    stats.anchors
  );
  const barWidth = width - 15;

  const items = [
    { label: "Facts", value: stats.facts, color: colors.primary },
    { label: "Relations", value: stats.relations, color: colors.success },
    { label: "Insights", value: stats.insights, color: colors.warning },
    { label: "Anchors", value: stats.anchors, color: colors.muted },
  ];

  for (const item of items) {
    const ratio = maxValue > 0 ? item.value / maxValue : 0;
    const filled = Math.round(ratio * barWidth);
    const bar = fg(item.color)(progressChars.filled.repeat(filled));
    const label = dim(item.label.padEnd(10));
    const count = formatCount(item.value);

    lines.push(`${label}${bar} ${count}`);
  }

  return lines;
}

// ─── Mock Stats ──────────────────────────────────────────────────────────────

export function createMockStats(): KnowledgeStats {
  return {
    facts: Math.floor(1000 + Math.random() * 500),
    relations: Math.floor(500 + Math.random() * 300),
    insights: Math.floor(50 + Math.random() * 50),
    anchors: Math.floor(100 + Math.random() * 100),
  };
}
