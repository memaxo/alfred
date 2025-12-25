/**
 * Reliability scoring logic for external research sources
 */

const DOMAIN_AUTHORITY: Record<string, number> = {
  "react.dev": 1.0,
  "nextjs.org": 1.0,
  "tanstack.com": 1.0,
  "github.com": 0.9,
  "stackoverflow.com": 0.7,
  "medium.com": 0.5,
  "dev.to": 0.5,
};

/**
 * Calculate reliability score (0.0-1.0) for a source
 */
export function calculateReliability(params: {
  url: string;
  publishedDate?: Date;
  content: string;
  projectFrameworks?: Record<string, string>; // e.g., { "react": "18.2" }
}): number {
  let score = 0.5; // Base score for unknown blogs/sites

  const url = new URL(params.url);

  // 1. HTTPS requirement
  if (url.protocol !== "https:") {
    return 0.0;
  }

  // 2. Domain authority
  for (const [domain, authority] of Object.entries(DOMAIN_AUTHORITY)) {
    if (url.hostname === domain || url.hostname.endsWith(`.${domain}`)) {
      score = authority;
      break;
    }
  }

  // 3. Freshness (decay after 1 year)
  if (params.publishedDate) {
    const ageInYears =
      (Date.now() - params.publishedDate.getTime()) / (1000 * 60 * 60 * 24 * 365);
    if (ageInYears < 1) {
      // Keep score (1.0 factor)
    } else if (ageInYears > 3) {
      score *= 0.6; // Decay to 60%
    } else {
      // Linear decay between 1 and 3 years: 1.0 to 0.6
      const factor = 1.0 - (ageInYears - 1) * 0.2;
      score *= factor;
    }
  }

  // 4. Framework version match (optional boost)
  // This logic depends on version detection which might be handled elsewhere,
  // but we can add placeholders for boosts here if version is passed.

  return Math.min(Math.max(score, 0), 1);
}

/**
 * Calculate semantic relevance score (0.0-1.0) between source and intent
 */
export function calculateRelevance(
  source: { title: string; summary: string; content?: string },
  intentDescription: string
): number {
  const query = intentDescription.toLowerCase();
  const title = source.title.toLowerCase();
  const summary = source.summary.toLowerCase();
  const content = (source.content ?? "").toLowerCase();

  let matches = 0;
  const terms = query.split(/\s+/).filter((t) => t.length > 3);

  if (terms.length === 0) return 0.5;

  for (const term of terms) {
    if (title.includes(term)) matches += 2; // Title matches count double
    if (summary.includes(term)) matches += 1;
    if (content.includes(term)) matches += 0.5;
  }

  const maxPossible = terms.length * 3.5;
  return Math.min(matches / maxPossible + 0.2, 1.0); // Bias slightly upwards
}
