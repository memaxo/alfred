/**
 * Filtering and detection logic for research aggregator
 */

/**
 * Detect framework versions from content strings
 */
export function detectFrameworkVersion(content: string): string | undefined {
  const patterns = [
    { name: "React", regex: /"react":\s*"[\^~]?(\d+\.\d+)/i },
    { name: "Next.js", regex: /"next":\s*"[\^~]?(\d+\.\d+)/i },
    {
      name: "TanStack Router",
      regex: /"@tanstack\/react-router":\s*"[\^~]?(\d+\.\d+)/i,
    },
    {
      name: "TanStack Query",
      regex: /"@tanstack\/react-query":\s*"[\^~]?(\d+\.\d+)/i,
    },
    // Generic fallback for common mentions
    { name: "React", regex: /React\s+(\d+\.\d+)/i },
    { name: "Next.js", regex: /Next\.js\s+(\d+\.\d+)/i },
  ];

  for (const { name, regex } of patterns) {
    const match = content.match(regex);
    if (match?.[1]) {
      return `${name} ${match[1]}`;
    }
  }

  return undefined;
}

/**
 * Filter results by date
 */
export function applyDateFilter<T extends { date?: Date }>(
  results: T[],
  filter: "recent" | "all"
): T[] {
  if (filter === "all") {
    return results;
  }

  const twoYearsAgo = new Date();
  twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);

  return results.filter((r) => !r.date || r.date >= twoYearsAgo);
}
