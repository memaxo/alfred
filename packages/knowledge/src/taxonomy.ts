/**
 * Domain Taxonomy for Knowledge Prioritization
 * Defines key domains and their associated keywords/patterns.
 */

export const DOMAINS = {
  coding: {
    description:
      "Software development, programming languages, frameworks, tools, and infrastructure.",
    keywords: [
      // Languages
      "typescript",
      "javascript",
      "python",
      "rust",
      "go",
      "c++",
      "java",
      "sql",
      "html",
      "css",
      "bash",
      "sh",
      "json",
      "yaml",
      "toml",
      // Frameworks & Runtimes
      "react",
      "nextjs",
      "vue",
      "angular",
      "svelte",
      "node",
      "bun",
      "deno",
      "express",
      "fastify",
      "nest",
      "trpc",
      "graphql",
      "rest",
      // Tools & Infra
      "git",
      "docker",
      "kubernetes",
      "aws",
      "gcp",
      "azure",
      "vercel",
      "linux",
      "macos",
      "terminal",
      "cli",
      "vim",
      "vscode",
      "editor",
      // Concepts
      "api",
      "backend",
      "frontend",
      "fullstack",
      "database",
      "schema",
      "migration",
      "deploy",
      "ci/cd",
      "testing",
      "debug",
      "refactor",
      "optimize",
      "async",
      "promise",
      "component",
      "hook",
      "state",
      "store",
      "context",
    ],
    patterns: [
      /```[\s\S]*?```/g, // Code blocks
      /const\s+\w+\s*=/g, // JS/TS var decl
      /function\s+\w+/g, // Function decl
      /import\s+.*\s+from/g, // Imports
      /class\s+\w+/g, // Class decl
    ],
  },
  ai: {
    description:
      "Artificial Intelligence, Machine Learning, LLMs, and neural networks.",
    keywords: [
      "llm",
      "transformer",
      "gpt",
      "claude",
      "llama",
      "bert",
      "diffusion",
      "embedding",
      "vector",
      "rag",
      "retrieval",
      "inference",
      "training",
      "fine-tuning",
      "model",
      "token",
      "context window",
      "prompt",
      "agent",
      "hallucination",
      "temperature",
      "top-p",
      "seed",
      "neural network",
      "deep learning",
      "machine learning",
      "ml",
      "nlp",
      "cv",
    ],
    patterns: [],
  },
  cybersecurity: {
    description:
      "Information security, vulnerabilities, threats, and defense mechanisms.",
    keywords: [
      "exploit",
      "vulnerability",
      "cve",
      "0day",
      "zero-day",
      "malware",
      "virus",
      "trojan",
      "ransomware",
      "phishing",
      "social engineering",
      "firewall",
      "vpn",
      "encryption",
      "decryption",
      "hashing",
      "auth",
      "authentication",
      "authorization",
      "oauth",
      "jwt",
      "token",
      "key",
      "secret",
      "password",
      "credential",
      "breach",
      "leak",
      "attack",
      "defense",
      "pentest",
      "penetration testing",
      "red team",
      "blue team",
      "security",
      "secure",
      "insecure",
      "risk",
      "threat",
      "mitigation",
    ],
    patterns: [],
  },
  politics: {
    description:
      "Government, policy, elections, law, and international relations.",
    keywords: [
      "government",
      "policy",
      "law",
      "regulation",
      "election",
      "vote",
      "campaign",
      "candidate",
      "party",
      "democrat",
      "republican",
      "liberal",
      "conservative",
      "senate",
      "house",
      "congress",
      "president",
      "prime minister",
      "minister",
      "parliament",
      "supreme court",
      "judge",
      "rights",
      "freedom",
      "democracy",
      "autocracy",
      "dictatorship",
      "war",
      "peace",
      "treaty",
      "diplomacy",
      "foreign policy",
      "domestic policy",
      "tax",
      "budget",
    ],
    patterns: [],
  },
  news: {
    description:
      "Current events, journalism, breaking news, and media coverage.",
    keywords: [
      "breaking",
      "headline",
      "report",
      "article",
      "journalism",
      "media",
      "press",
      "broadcast",
      "coverage",
      "update",
      "development",
      "story",
      "source",
      "interview",
      "statement",
      "announce",
      "reveal",
      "confirm",
    ],
    patterns: [],
  },
  social_media: {
    description:
      "Social networks, online communities, trends, and digital interaction.",
    keywords: [
      "twitter",
      "x.com",
      "tweet",
      "post",
      "thread",
      "retweet",
      "like",
      "follow",
      "follower",
      "algorithm",
      "feed",
      "timeline",
      "viral",
      "trend",
      "trending",
      "hashtag",
      "influencer",
      "creator",
      "content",
      "platform",
      "network",
      "community",
    ],
    patterns: [
      /@\w+/g, // Mentions
      /#\w+/g, // Hashtags
    ],
  },
  music: {
    description: "Musical arts, songs, albums, artists, and audio streaming.",
    keywords: [
      "song",
      "track",
      "album",
      "artist",
      "band",
      "singer",
      "musician",
      "genre",
      "pop",
      "rock",
      "hip hop",
      "rap",
      "jazz",
      "classical",
      "electronic",
      "dance",
      "techno",
      "house",
      "instrument",
      "guitar",
      "piano",
      "drum",
      "beat",
      "melody",
      "harmony",
      "rhythm",
      "lyrics",
      "concert",
      "tour",
      "festival",
      "playlist",
      "stream",
      "spotify",
      "apple music",
    ],
    patterns: [],
  },
  movies: {
    description: "Cinema, films, television, directing, and acting.",
    keywords: [
      "film",
      "movie",
      "cinema",
      "director",
      "actor",
      "actress",
      "cast",
      "plot",
      "screenplay",
      "script",
      "scene",
      "shot",
      "trailer",
      "teaser",
      "review",
      "rating",
      "box office",
      "award",
      "oscar",
      "genre",
      "action",
      "comedy",
      "drama",
      "horror",
      "thriller",
      "sci-fi",
      "documentary",
      "animation",
      "series",
      "tv show",
      "season",
      "episode",
    ],
    patterns: [],
  },
} as const;

export type Domain = keyof typeof DOMAINS;

function escapeRegExp(string: string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Detect domains present in text based on keywords and patterns.
 */
export function detectDomains(text: string): Domain[] {
  const lowerText = text.toLowerCase();
  const detected = new Set<Domain>();

  for (const [domain, config] of Object.entries(DOMAINS)) {
    const d = domain as Domain;

    // Check keywords
    for (const keyword of config.keywords) {
      // Use boundary check for short keywords to avoid false positives (e.g., "go" in "going")
      if (keyword.length <= 3) {
        // Correctly escape special characters (like + in C++)
        if (new RegExp(`\\b${escapeRegExp(keyword)}\\b`).test(lowerText)) {
          detected.add(d);
          break;
        }
      } else if (lowerText.includes(keyword)) {
        detected.add(d);
        break;
      }
    }

    // Check patterns if not already detected
    if (!detected.has(d) && config.patterns) {
      for (const pattern of config.patterns) {
        if (pattern.test(text)) {
          detected.add(d);
          break;
        }
      }
    }
  }

  return Array.from(detected);
}

/**
 * Calculate confidence boost multiplier based on domain relevance.
 * Coding gets the highest boost.
 */
export function getDomainBoost(domains: Domain[]): number {
  if (domains.length === 0) {
    return 1.0;
  }

  let maxBoost = 1.0;

  for (const domain of domains) {
    let boost = 1.0;
    switch (domain) {
      case "coding":
        boost = 1.25; // Highest priority
        break;
      case "ai":
      case "cybersecurity":
        boost = 1.15; // High priority
        break;
      default:
        boost = 1.05; // Slight boost for other known interests
    }
    if (boost > maxBoost) {
      maxBoost = boost;
    }
  }

  return maxBoost;
}
