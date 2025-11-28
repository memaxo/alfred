/**
 * Domain classification for knowledge extraction.
 * Fast heuristic-based domain detection for agent context.
 */

import {
  isDevTool,
  isFramework,
  isProgrammingLanguage,
} from "./code.js";

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
} as const;

/**
 * Fast domain classification from text.
 * Returns array of detected domains, ordered by confidence.
 * Performance budget: <1ms
 */
export function classifyDomain(text: string): string[] {
  const normalized = text.toLowerCase();
  const domainScores = new Map<string, number>();

  // Check keyword matches
  for (const [domain, keywords] of Object.entries(DOMAIN_KEYWORDS)) {
    let score = 0;
    for (const keyword of keywords) {
      if (normalized.includes(keyword)) {
        score += 1;
      }
    }
    if (score > 0) {
      domainScores.set(domain, score);
    }
  }

  // Boost Coding domain for code-related terms
  if (
    isProgrammingLanguage(normalized) ||
    isFramework(normalized) ||
    isDevTool(normalized)
  ) {
    const current = domainScores.get("Coding") ?? 0;
    domainScores.set("Coding", current + 2);
  }

  // Sort by score descending
  const sorted = Array.from(domainScores.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([domain]) => domain);

  return sorted;
}

