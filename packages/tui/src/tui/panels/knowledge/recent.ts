/**
 * ALFRED TUI Recent Knowledge
 *
 * Displays recently added or modified knowledge items.
 */

import { colors } from "../../theme";
import { dim, fg, truncate } from "../../typography";

// ─── Types ───────────────────────────────────────────────────────────────────

export type KnowledgeItemType = "fact" | "relation" | "insight" | "anchor";

export type RecentKnowledgeItem = {
  id: string;
  type: KnowledgeItemType;
  content: string;
  timestamp: number;
  source?: string;
};

// ─── Time Formatting ─────────────────────────────────────────────────────────

function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;

  if (diff < 60_000) {
    return "just now";
  }
  if (diff < 3_600_000) {
    return `${Math.floor(diff / 60_000)}m ago`;
  }
  if (diff < 86_400_000) {
    return `${Math.floor(diff / 3_600_000)}h ago`;
  }
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

// ─── Item Rendering ──────────────────────────────────────────────────────────

function getTypeIcon(type: KnowledgeItemType): string {
  switch (type) {
    case "fact":
      return fg(colors.primary)("◆");
    case "relation":
      return fg(colors.success)("─");
    case "insight":
      return fg(colors.warning)("★");
    case "anchor":
      return fg(colors.muted)("⚓");
  }
}

export function renderRecentItem(
  item: RecentKnowledgeItem,
  width: number
): string {
  const icon = getTypeIcon(item.type);
  const time = dim(formatRelativeTime(item.timestamp));
  const content = truncate(item.content, width - 15);

  return `${icon} ${content} ${time}`;
}

export function renderRecentItems(
  items: RecentKnowledgeItem[],
  width: number,
  maxItems = 5
): string[] {
  const lines: string[] = [];

  if (items.length === 0) {
    lines.push(dim("  No recent activity"));
    return lines;
  }

  // Sort by timestamp descending
  const sorted = [...items].sort((a, b) => b.timestamp - a.timestamp);
  const visible = sorted.slice(0, maxItems);

  for (const item of visible) {
    lines.push(`  ${renderRecentItem(item, width - 2)}`);
  }

  if (items.length > maxItems) {
    lines.push(dim(`  ... and ${items.length - maxItems} more`));
  }

  return lines;
}

// ─── Grouped by Type ─────────────────────────────────────────────────────────

export function groupByType(
  items: RecentKnowledgeItem[]
): Map<KnowledgeItemType, RecentKnowledgeItem[]> {
  const groups = new Map<KnowledgeItemType, RecentKnowledgeItem[]>();

  for (const item of items) {
    const existing = groups.get(item.type) ?? [];
    existing.push(item);
    groups.set(item.type, existing);
  }

  return groups;
}

export function renderRecentByType(
  items: RecentKnowledgeItem[],
  width: number
): string[] {
  const lines: string[] = [];
  const groups = groupByType(items);

  const typeOrder: KnowledgeItemType[] = [
    "insight",
    "fact",
    "relation",
    "anchor",
  ];

  for (const type of typeOrder) {
    const group = groups.get(type);
    if (!group || group.length === 0) {
      continue;
    }

    const typeLabel = `${type.charAt(0).toUpperCase() + type.slice(1)}s`;
    lines.push(dim(`  ${typeLabel}:`));

    const sorted = [...group].sort((a, b) => b.timestamp - a.timestamp);
    for (const item of sorted.slice(0, 3)) {
      lines.push(`    ${renderRecentItem(item, width - 4)}`);
    }

    lines.push("");
  }

  return lines;
}

// ─── Activity Timeline ───────────────────────────────────────────────────────

export function renderActivityTimeline(
  items: RecentKnowledgeItem[],
  width: number,
  hours = 24
): string[] {
  const lines: string[] = [];
  const now = Date.now();
  const startTime = now - hours * 3_600_000;

  // Filter to items in time range
  const inRange = items.filter((item) => item.timestamp >= startTime);

  if (inRange.length === 0) {
    lines.push(dim("  No activity in the last 24 hours"));
    return lines;
  }

  // Group by hour
  const hourBuckets = new Map<number, number>();
  for (let h = 0; h < hours; h++) {
    hourBuckets.set(h, 0);
  }

  for (const item of inRange) {
    const hoursAgo = Math.floor((now - item.timestamp) / 3_600_000);
    if (hoursAgo < hours) {
      hourBuckets.set(hoursAgo, (hourBuckets.get(hoursAgo) ?? 0) + 1);
    }
  }

  // Render timeline
  const maxCount = Math.max(...hourBuckets.values());
  const barChars = ["▁", "▂", "▃", "▄", "▅", "▆", "▇", "█"];

  const timelineWidth = Math.min(hours, width - 10);
  const timeline: string[] = [];

  for (let h = timelineWidth - 1; h >= 0; h--) {
    const count = hourBuckets.get(h) ?? 0;
    const ratio = maxCount > 0 ? count / maxCount : 0;
    const charIndex = Math.min(Math.floor(ratio * 8), 7);
    const char = barChars[charIndex] ?? "▁";
    const color = count > 0 ? colors.primary : colors.muted;
    timeline.push(fg(color)(char));
  }

  lines.push(`  ${timeline.join("")}`);
  lines.push(
    `  ${dim("24h ago")}${" ".repeat(timelineWidth - 10)}${dim("now")}`
  );

  // Summary
  lines.push("");
  lines.push(
    `  ${fg(colors.primary)(inRange.length.toString())} items in last ${hours}h`
  );

  return lines;
}

// ─── Mock Recent Items ───────────────────────────────────────────────────────

export function createMockRecentItems(count = 10): RecentKnowledgeItem[] {
  const types: KnowledgeItemType[] = ["fact", "relation", "insight", "anchor"];
  const contents = [
    "User preferences for dark mode",
    "Connection between project A and B",
    "Pattern discovered in workflow timing",
    "Key timestamp for meeting",
    "Relationship between concepts",
    "New insight about user behavior",
    "Anchor point for navigation",
    "Extracted fact from conversation",
  ];

  return Array.from({ length: count }, (_, i) => {
    const type = types[i % types.length] ?? "fact";
    const content = contents[i % contents.length] ?? "Knowledge item";
    return {
      id: `item-${i}`,
      type,
      content,
      timestamp: Date.now() - Math.floor(Math.random() * 86_400_000),
      source: i % 3 === 0 ? "conversation" : undefined,
    };
  });
}
