import { colors } from "../../theme";
import { dim, fg, truncate } from "../../typography";

export type RecentKnowledgeItem = {
  id: string;
  kind: "fact" | "note" | "relation";
  title: string;
  updatedAt: number;
};

export function createMockRecentItems(n: number): RecentKnowledgeItem[] {
  const kinds: RecentKnowledgeItem["kind"][] = ["fact", "note", "relation"];
  return Array.from({ length: n }, (_, i) => {
    const kind = kinds[i % kinds.length] ?? "note";
    return {
      id: `k-${i}`,
      kind,
      title:
        kind === "fact"
          ? `Fact #${i}`
          : kind === "relation"
            ? `Relation #${i}`
            : `Note #${i}`,
      updatedAt: Date.now() - i * 60_000,
    };
  });
}

export function renderRecentItems(
  items: RecentKnowledgeItem[],
  width: number
): string[] {
  const icon = (k: RecentKnowledgeItem["kind"]) =>
    k === "fact" ? "•" : k === "relation" ? "↔" : "✎";
  const color = (k: RecentKnowledgeItem["kind"]) =>
    k === "fact"
      ? colors.primary
      : k === "relation"
        ? colors.warning
        : colors.muted;
  return items.map((it) => {
    const when = new Date(it.updatedAt).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
    return `  ${fg(color(it.kind))(icon(it.kind))} ${truncate(it.title, Math.max(10, width - 12))} ${dim(when)}`;
  });
}

export function renderActivityTimeline(
  items: RecentKnowledgeItem[],
  width: number
): string[] {
  const byKind = items.reduce(
    (acc, it) => {
      acc[it.kind] = (acc[it.kind] ?? 0) + 1;
      return acc;
    },
    {} as Record<RecentKnowledgeItem["kind"], number>
  );

  return [
    `  ${dim("Facts:")} ${String(byKind.fact ?? 0)}`,
    `  ${dim("Notes:")} ${String(byKind.note ?? 0)}`,
    `  ${dim("Relations:")} ${String(byKind.relation ?? 0)}`,
    dim(`  ${"─".repeat(Math.max(0, Math.min(width - 4, 30)))}`),
  ];
}

export type RecentInsight = {
  id: string;
  text: string;
  timestamp: Date;
};

export function renderRecentInsights(
  insights: RecentInsight[],
  width: number
): string[] {
  if (insights.length === 0) {
    return [dim("  No recent insights")];
  }

  return insights.map((it) => {
    const when = it.timestamp.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
    return `  ${fg(colors.primary)("✦")} ${truncate(it.text, Math.max(10, width - 12))} ${dim(when)}`;
  });
}
