/**
 * Domain classification for knowledge extraction.
 * Hybrid system: sync static fallback with async learned associations.
 * Performance budget: <1ms for sync path
 */

import { isDevTool, isFramework, isProgrammingLanguage } from "./code.js";

/**
 * Topic detection result for extraction
 */
export type TopicResult = {
  topics: string[];
  hasCodeBlock: boolean;
  primaryDomain: string | null;
  confidenceBoost: number;
};

/**
 * Domain classification result with source tracking
 */
export type DomainResult = {
  domain: string;
  confidence: number;
  source: "learned" | "static" | "seed";
};

/**
 * Confidence threshold for learned knowledge to override static
 */
export const LEARNED_OVERRIDE_THRESHOLD = 0.8;

/**
 * Metric recording callbacks (set via registerClassificationMetrics)
 * Enables external packages to instrument without circular dependencies
 */
type ClassificationMetrics = {
  recordSource: (domain: string, source: "learned" | "static" | "seed") => void;
  recordCacheHit: (hit: boolean) => void;
  recordDuration: (method: "sync" | "async", durationMs: number) => void;
};

let metrics: ClassificationMetrics | null = null;

/**
 * Register metric recording callbacks
 * Call from @alfred/api or similar to wire up Prometheus counters
 */
export function registerClassificationMetrics(m: ClassificationMetrics): void {
  metrics = m;
}

/**
 * Cache TTL for domain associations
 * Set to 5 minutes based on research showing 300-600s optimal for preference data
 * (Reference: alfred-memory-review.md - "60s is too short for domain preferences")
 */
const CACHE_TTL_MS = 300_000; // 5 minutes

/**
 * Cached domain association
 */
type CachedAssociation = {
  domains: DomainResult[];
  expiresAt: number;
};

/**
 * In-memory cache for learned domain associations
 * Enables sync path to return cached learned results
 */
const domainCache = new Map<string, CachedAssociation>();

/**
 * Maximum cache entries to prevent unbounded memory growth
 */
const MAX_CACHE_ENTRIES = 1000;

/**
 * Domain keyword maps for fast classification
 */
const DOMAIN_KEYWORDS: Record<string, readonly string[]> = {
  Coding: [
    "code",
    "programming",
    "software",
    "development",
    "developer",
    "function",
    "class",
    "method",
    "variable",
    "api",
    "sdk",
    "library",
    "package",
    "module",
    "import",
    "export",
    "compile",
    "runtime",
    "debug",
    "test",
    "unit",
    "integration",
    "deploy",
    "build",
    "repository",
    "commit",
    "merge",
    "branch",
    "pull-request",
    "pr",
    "issue",
    "bug",
    "feature",
    "refactor",
    "optimize",
    "performance",
    "algorithm",
    "data-structure",
    "framework",
    "library",
    "dependency",
    "npm",
    "yarn",
    "pip",
    "cargo",
    "maven",
    "gradle",
  ],
  Security: [
    "security",
    "vulnerability",
    "exploit",
    "attack",
    "defense",
    "encryption",
    "decrypt",
    "cipher",
    "hash",
    "password",
    "authentication",
    "authorization",
    "token",
    "jwt",
    "oauth",
    "ssl",
    "tls",
    "certificate",
    "firewall",
    "intrusion",
    "malware",
    "virus",
    "trojan",
    "ransomware",
    "phishing",
    "xss",
    "csrf",
    "sql-injection",
    "cve",
    "cwe",
    "owasp",
    "penetration",
    "pentest",
    "audit",
    "compliance",
    "gdpr",
    "hipaa",
    "pci",
    "kali",
    "metasploit",
    "burp",
    "nmap",
    "wireshark",
  ],
  AI: [
    "ai",
    "artificial-intelligence",
    "machine-learning",
    "ml",
    "deep-learning",
    "neural-network",
    "nn",
    "transformer",
    "llm",
    "gpt",
    "chatgpt",
    "claude",
    "bert",
    "openai",
    "anthropic",
    "training",
    "inference",
    "model",
    "dataset",
    "epoch",
    "gradient",
    "backpropagation",
    "supervised",
    "unsupervised",
    "reinforcement",
    "nlp",
    "natural-language",
    "computer-vision",
    "cv",
    "embedding",
    "vector",
    "similarity",
    "rag",
    "retrieval-augmented",
    "fine-tuning",
    "prompt",
    "prompting",
    "chain-of-thought",
    "cot",
    "agent",
    "autonomous",
  ],
  Politics: [
    "politics",
    "political",
    "government",
    "congress",
    "senate",
    "house",
    "representative",
    "senator",
    "president",
    "presidential",
    "election",
    "campaign",
    "vote",
    "voting",
    "ballot",
    "democrat",
    "republican",
    "party",
    "policy",
    "legislation",
    "bill",
    "law",
    "amendment",
    "constitution",
    "supreme-court",
    "judge",
    "justice",
    "federal",
    "state",
    "local",
    "municipal",
    "mayor",
    "governor",
  ],
  News: [
    "news",
    "headline",
    "article",
    "journalism",
    "journalist",
    "reporter",
    "breaking",
    "update",
    "reuters",
    "ap",
    "associated-press",
    "bloomberg",
    "cnn",
    "bbc",
    "nytimes",
    "washington-post",
    "wsj",
    "wall-street-journal",
    "guardian",
    "economist",
    "time",
    "newsweek",
    "usatoday",
  ],
  SocialMedia: [
    "social-media",
    "twitter",
    "x.com",
    "facebook",
    "instagram",
    "tiktok",
    "youtube",
    "reddit",
    "linkedin",
    "snapchat",
    "discord",
    "twitch",
    "mastodon",
    "threads",
    "bluesky",
    "post",
    "tweet",
    "viral",
    "follower",
    "following",
    "influencer",
    "content-creator",
    "hashtag",
    "trending",
    "share",
    "like",
    "retweet",
    "repost",
    "dm",
    "direct-message",
    "feed",
    "timeline",
    "algorithm",
    "engagement",
  ],
  Music: [
    "music",
    "song",
    "album",
    "artist",
    "singer",
    "musician",
    "band",
    "concert",
    "tour",
    "spotify",
    "apple-music",
    "soundcloud",
    "bandcamp",
    "vinyl",
    "record",
    "playlist",
    "track",
    "genre",
    "rock",
    "pop",
    "hip-hop",
    "rap",
    "jazz",
    "classical",
    "electronic",
    "edm",
    "country",
    "folk",
    "indie",
    "metal",
    "punk",
    "rnb",
    "soul",
    "blues",
    "reggae",
    "latin",
    "kpop",
    "producer",
    "dj",
    "remix",
    "sample",
    "beat",
    "lyrics",
    "melody",
    "chord",
    "instrument",
    "guitar",
    "piano",
    "drum",
    "bass",
    "synthesizer",
  ],
  Movies: [
    "movie",
    "film",
    "cinema",
    "director",
    "actor",
    "actress",
    "screenplay",
    "script",
    "hollywood",
    "bollywood",
    "netflix",
    "hulu",
    "disney-plus",
    "hbo-max",
    "prime-video",
    "amazon-prime",
    "streaming",
    "box-office",
    "premiere",
    "trailer",
    "sequel",
    "prequel",
    "franchise",
    "trilogy",
    "documentary",
    "animation",
    "animated",
    "pixar",
    "marvel",
    "dc",
    "oscar",
    "academy-award",
    "emmy",
    "golden-globe",
    "cannes",
    "sundance",
    "imdb",
    "rotten-tomatoes",
    "cinematography",
    "editing",
    "special-effects",
    "vfx",
    "cgi",
    "soundtrack",
    "score",
  ],
} as const;

/**
 * Check if a keyword exists as a whole word in text.
 * Prevents false positives like "sunny" matching "nn".
 * Performance budget: <0.1ms per keyword
 */
function hasKeywordAsWord(text: string, keyword: string): boolean {
  // For very short keywords (<=2 chars), require exact word match
  // to prevent false positives like "nn" in "sunny" or "cv" in "recovery"
  if (keyword.length <= 2) {
    const regex = new RegExp(`\\b${keyword}\\b`, "i");
    return regex.test(text);
  }
  // For longer keywords, substring match is acceptable
  return text.includes(keyword);
}

/**
 * Extract words from text for programming language/framework checks.
 * Splits on whitespace and common delimiters.
 */
function extractWords(text: string): string[] {
  return text.split(/[\s,;:'"()[\]{}|<>]+/).filter((w) => w.length > 0);
}

/**
 * Internal static domain classification.
 * Pure keyword matching against DOMAIN_KEYWORDS.
 * Performance budget: <1ms
 */
function classifyDomainStatic(text: string): string[] {
  const normalized = text.toLowerCase();
  const domainScores = new Map<string, number>();

  // Check keyword matches with word boundary awareness
  for (const [domain, keywords] of Object.entries(DOMAIN_KEYWORDS)) {
    let score = 0;
    for (const keyword of keywords) {
      if (hasKeywordAsWord(normalized, keyword)) {
        score += 1;
      }
    }
    if (score > 0) {
      domainScores.set(domain, score);
    }
  }

  // Boost Coding domain for code-related terms (check individual words)
  const words = extractWords(normalized);
  for (const word of words) {
    if (isProgrammingLanguage(word) || isFramework(word) || isDevTool(word)) {
      const current = domainScores.get("Coding") ?? 0;
      domainScores.set("Coding", current + 2);
      break; // Only boost once per text
    }
  }

  // Sort by score descending
  const sorted = Array.from(domainScores.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([domain]) => domain);

  return sorted;
}

/**
 * Normalize cache key for consistent lookups
 */
function getCacheKey(text: string): string {
  return text.toLowerCase().trim().substring(0, 500);
}

/**
 * Evict oldest cache entries if limit exceeded
 */
function evictCacheIfNeeded(): void {
  if (domainCache.size > MAX_CACHE_ENTRIES) {
    const firstKey = domainCache.keys().next().value;
    if (firstKey) {
      domainCache.delete(firstKey);
    }
  }
}

/**
 * Fast domain classification from text (sync).
 * Returns cached learned results if available, otherwise static fallback.
 * Performance budget: <1ms
 *
 * For non-hot paths, prefer classifyDomainWithLearning() for graph-backed results.
 */
export function classifyDomain(text: string): DomainResult[] {
  const start = performance.now();
  const cacheKey = getCacheKey(text);
  const cached = domainCache.get(cacheKey);

  // Return cached learned results if valid
  if (cached && cached.expiresAt > Date.now()) {
    metrics?.recordCacheHit(true);
    for (const result of cached.domains) {
      metrics?.recordSource(result.domain, result.source);
    }
    metrics?.recordDuration("sync", performance.now() - start);
    return cached.domains;
  }

  metrics?.recordCacheHit(false);

  // Sync static fallback (guaranteed <1ms)
  const staticDomains = classifyDomainStatic(text);
  const results = staticDomains.map((domain) => ({
    domain,
    confidence: 0.5,
    source: "static" as const,
  }));

  for (const result of results) {
    metrics?.recordSource(result.domain, result.source);
  }
  metrics?.recordDuration("sync", performance.now() - start);

  return results;
}

/**
 * Async domain classification with graph-based learning.
 * Queries learned associations first, falls back to static.
 * Populates cache for subsequent sync calls.
 *
 * @param text - Text to classify
 * @param resource - Resource scope for graph queries (default: "user")
 * @param findAssociations - Optional graph query function (for dependency injection)
 */
export async function classifyDomainWithLearning(
  text: string,
  resource = "user",
  findAssociations?: (
    text: string,
    resource: string,
    limit?: number
  ) => Promise<DomainResult[]>
): Promise<DomainResult[]> {
  const start = performance.now();
  const cacheKey = getCacheKey(text);

  // Check cache first
  const cached = domainCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    metrics?.recordCacheHit(true);
    for (const result of cached.domains) {
      metrics?.recordSource(result.domain, result.source);
    }
    metrics?.recordDuration("async", performance.now() - start);
    return cached.domains;
  }

  metrics?.recordCacheHit(false);

  // Query graph for learned associations if function provided
  if (findAssociations) {
    try {
      const learned = await findAssociations(text, resource, 5);

      if (learned.length > 0) {
        // Check for high-confidence learned results that should override static
        const highConfidence = learned.filter(
          (l) =>
            l.source !== "seed" && l.confidence >= LEARNED_OVERRIDE_THRESHOLD
        );

        const results =
          highConfidence.length > 0
            ? highConfidence // Use ONLY learned if above threshold
            : learned; // Otherwise use all learned results

        // Cache for future sync calls
        domainCache.set(cacheKey, {
          domains: results,
          expiresAt: Date.now() + CACHE_TTL_MS,
        });
        evictCacheIfNeeded();

        // Record metrics
        for (const result of results) {
          metrics?.recordSource(result.domain, result.source);
        }
        metrics?.recordDuration("async", performance.now() - start);

        return results;
      }
    } catch {
      // Graph query failed, fall through to static
    }
  }

  // Fall back to static
  const staticDomains = classifyDomainStatic(text);
  const results = staticDomains.map((domain) => ({
    domain,
    confidence: 0.5,
    source: "static" as const,
  }));

  // Record metrics
  for (const result of results) {
    metrics?.recordSource(result.domain, result.source);
  }
  metrics?.recordDuration("async", performance.now() - start);

  // Don't cache static results to avoid blocking future learned lookups
  return results;
}

/**
 * Update cache with learned association (called after learning)
 */
export function updateDomainCache(text: string, domains: DomainResult[]): void {
  const cacheKey = getCacheKey(text);
  domainCache.set(cacheKey, {
    domains,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
  evictCacheIfNeeded();
}

/**
 * Clear domain cache (for testing)
 */
export function clearDomainCache(): void {
  domainCache.clear();
}

/**
 * Get cache stats (for metrics)
 */
export function getDomainCacheStats(): { size: number; maxSize: number } {
  return {
    size: domainCache.size,
    maxSize: MAX_CACHE_ENTRIES,
  };
}

/**
 * Confidence boost multipliers per domain.
 * Coding gets highest boost per ExecPlan strategy.
 */
const DOMAIN_CONFIDENCE_BOOSTS: Record<string, number> = {
  Coding: 1.2, // Highest boost for primary interest
  AI: 1.15, // High boost for AI/ML content
  Security: 1.1, // Security is valuable
  Politics: 1.05, // Moderate boost
  News: 1.0, // No boost, neutral
  SocialMedia: 0.95, // Slight reduction for noise
  Music: 1.0, // Neutral
  Movies: 1.0, // Neutral
};

/**
 * Code block detection regex.
 * Matches triple backticks (with optional language) or indented code blocks.
 */
const CODE_BLOCK_REGEX = /```[\s\S]*?```|`[^`]+`/;

/**
 * Code-related patterns that strongly indicate coding content.
 */
const CODE_PATTERNS = [
  /function\s+\w+\s*\(/i, // function declarations
  /const\s+\w+\s*=/i, // const declarations
  /let\s+\w+\s*=/i, // let declarations
  /import\s+.+from\s+['"]/, // ES imports
  /export\s+(default\s+)?(function|class|const)/, // ES exports
  /class\s+\w+(\s+extends\s+\w+)?/, // class declarations
  /async\s+function/, // async functions
  /=>\s*{/, // arrow functions
  /\.\s*(map|filter|reduce|forEach)\s*\(/, // array methods
  /npm\s+(install|i|run|start|test)/, // npm commands
  /bun\s+(install|run|test|add)/, // bun commands
  /git\s+(push|pull|commit|merge|rebase)/, // git commands
  /docker\s+(run|build|push|pull)/, // docker commands
  /\w+\.(ts|tsx|js|jsx|py|rs|go)/, // file extensions
  /http[s]?:\/\/localhost/, // localhost URLs
  /\{[\s\S]*:[\s\S]*\}/, // JSON-like objects
];

/**
 * Detect if text contains code blocks or code-related patterns.
 * Performance budget: <0.5ms
 */
function detectCodePresence(text: string): boolean {
  // Check for explicit code blocks
  if (CODE_BLOCK_REGEX.test(text)) {
    return true;
  }

  // Check for code patterns
  return CODE_PATTERNS.some((pattern) => pattern.test(text));
}

/**
 * Detect topics from text with confidence boosting.
 * Combines domain classification with code detection.
 * Performance budget: <1ms
 *
 * @param text - Text to analyze
 * @returns TopicResult with topics, code detection, and confidence boost
 */
export function detectTopics(text: string): TopicResult {
  const domains = classifyDomainStatic(text);
  const hasCodeBlock = detectCodePresence(text);

  // If code is detected but Coding wasn't in domains, add it
  let topics = [...domains];
  if (hasCodeBlock && !topics.includes("Coding")) {
    topics = ["Coding", ...topics];
  }

  // Determine primary domain (first in list after sorting by relevance)
  const primaryDomain = topics[0] ?? null;

  // Calculate confidence boost based on primary domain
  let confidenceBoost = 1.0;
  if (primaryDomain) {
    confidenceBoost = DOMAIN_CONFIDENCE_BOOSTS[primaryDomain] ?? 1.0;
  }

  // Extra boost for code blocks (compounds with domain boost)
  if (hasCodeBlock) {
    confidenceBoost *= 1.1;
  }

  // Cap at 1.5x to prevent runaway confidence
  confidenceBoost = Math.min(confidenceBoost, 1.5);

  return {
    topics,
    hasCodeBlock,
    primaryDomain,
    confidenceBoost,
  };
}

/**
 * Calculate boosted confidence based on detected topics.
 * Applies domain-specific multipliers.
 * Result is clamped to [0, 1].
 *
 * @param baseConfidence - Original confidence score
 * @param topicResult - Result from detectTopics()
 * @returns Boosted confidence clamped to [0, 1]
 */
export function applyTopicBoost(
  baseConfidence: number,
  topicResult: TopicResult
): number {
  const boosted = baseConfidence * topicResult.confidenceBoost;
  return Math.min(1.0, Math.max(0, boosted));
}
