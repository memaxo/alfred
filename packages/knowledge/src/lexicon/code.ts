/**
 * Code-related lexicon for knowledge extraction.
 * Used to detect programming languages, frameworks, tools, and file extensions.
 */

/**
 * Programming languages (~50 entries)
 */
export const PROGRAMMING_LANGUAGES = [
  "javascript",
  "typescript",
  "python",
  "java",
  "c",
  "cpp",
  "csharp",
  "go",
  "rust",
  "ruby",
  "php",
  "swift",
  "kotlin",
  "scala",
  "clojure",
  "haskell",
  "erlang",
  "elixir",
  "ocaml",
  "fsharp",
  "dart",
  "lua",
  "perl",
  "r",
  "matlab",
  "sql",
  "html",
  "css",
  "scss",
  "sass",
  "less",
  "xml",
  "json",
  "yaml",
  "toml",
  "markdown",
  "shell",
  "bash",
  "zsh",
  "powershell",
  "batch",
  "assembly",
  "fortran",
  "cobol",
  "pascal",
  "ada",
  "lisp",
  "prolog",
  "smalltalk",
] as const;

/**
 * Frameworks and libraries (~80 entries)
 */
export const FRAMEWORKS = [
  // Frontend
  "react",
  "vue",
  "angular",
  "svelte",
  "nextjs",
  "next",
  "nuxt",
  "remix",
  "gatsby",
  "astro",
  "solid",
  "preact",
  "lit",
  "alpine",
  "ember",
  "backbone",
  "jquery",
  "bootstrap",
  "tailwind",
  "material-ui",
  "mui",
  "chakra",
  "antd",
  "vuetify",
  "quasar",

  // Backend
  "express",
  "koa",
  "fastify",
  "hapi",
  "nest",
  "nestjs",
  "django",
  "flask",
  "fastapi",
  "rails",
  "sinatra",
  "spring",
  "springboot",
  "quarkus",
  "micronaut",
  "vertx",
  "play",
  "akka",
  "phoenix",
  "plug",
  "gin",
  "echo",
  "fiber",
  "chi",
  "gorilla",
  "actix",
  "rocket",
  "axum",
  "warp",
  "tower",

  // Mobile
  "react-native",
  "flutter",
  "xamarin",
  "ionic",
  "cordova",
  "swiftui",
  "uikit",

  // Testing
  "jest",
  "vitest",
  "mocha",
  "jasmine",
  "cypress",
  "playwright",
  "puppeteer",
  "selenium",
  "pytest",
  "unittest",
  "rspec",
  "junit",
  "testng",
  "gtest",
  "criterion",

  // Build tools
  "webpack",
  "vite",
  "rollup",
  "esbuild",
  "swc",
  "turbo",
  "nx",
  "turborepo",
] as const;

/**
 * Development tools (~50 entries)
 */
export const DEV_TOOLS = [
  // Runtimes
  "node",
  "nodejs",
  "bun",
  "deno",
  // Containers & Orchestration
  "docker",
  "kubernetes",
  "k8s",
  "terraform",
  "ansible",
  "puppet",
  "chef",
  "vagrant",
  "packer",
  "consul",
  "vault",
  "nomad",
  // Version Control
  "git",
  "github",
  "gitlab",
  "bitbucket",
  // CI/CD
  "jenkins",
  "circleci",
  "travis",
  "github-actions",
  "gitlab-ci",
  "azure-devops",
  // Cloud
  "aws",
  "gcp",
  "azure",
  "vercel",
  "netlify",
  "cloudflare",
  // Servers
  "nginx",
  "apache",
  // Databases
  "redis",
  "postgres",
  "postgresql",
  "mysql",
  "mongodb",
  "elasticsearch",
  // Message Queues
  "kafka",
  "rabbitmq",
  // Monitoring
  "prometheus",
  "grafana",
] as const;

/**
 * File extensions mapped to programming languages
 */
export const FILE_EXTENSIONS: Record<string, string> = {
  ".js": "javascript",
  ".jsx": "javascript",
  ".mjs": "javascript",
  ".cjs": "javascript",
  ".ts": "typescript",
  ".tsx": "typescript",
  ".py": "python",
  ".pyw": "python",
  ".java": "java",
  ".c": "c",
  ".h": "c",
  ".cpp": "cpp",
  ".cc": "cpp",
  ".cxx": "cpp",
  ".hpp": "cpp",
  ".cs": "csharp",
  ".go": "go",
  ".rs": "rust",
  ".rb": "ruby",
  ".php": "php",
  ".swift": "swift",
  ".kt": "kotlin",
  ".scala": "scala",
  ".clj": "clojure",
  ".hs": "haskell",
  ".erl": "erlang",
  ".ex": "elixir",
  ".exs": "elixir",
  ".ml": "ocaml",
  ".fs": "fsharp",
  ".dart": "dart",
  ".lua": "lua",
  ".pl": "perl",
  ".pm": "perl",
  ".r": "r",
  ".m": "matlab",
  ".sql": "sql",
  ".html": "html",
  ".htm": "html",
  ".css": "css",
  ".scss": "scss",
  ".sass": "sass",
  ".less": "less",
  ".xml": "xml",
  ".json": "json",
  ".yaml": "yaml",
  ".yml": "yaml",
  ".toml": "toml",
  ".md": "markdown",
  ".sh": "shell",
  ".bash": "bash",
  ".zsh": "zsh",
  ".ps1": "powershell",
  ".bat": "batch",
  ".asm": "assembly",
  ".s": "assembly",
};

/**
 * Code lexicon result with source tracking
 */
export interface CodeLexiconResult {
  result: boolean;
  source: "learned" | "static";
  confidence: number;
}

/**
 * Confidence threshold for learned code lexicon to override static
 */
const LEARNED_OVERRIDE_THRESHOLD = 0.8;

/**
 * Cache for learned code lexicon associations
 */
interface CachedCodeAssociation {
  result: boolean;
  source: "learned" | "static";
  confidence: number;
  expiresAt: number;
}

const codeLexiconCache = new Map<string, CachedCodeAssociation>();
/**
 * Cache TTL for code lexicon associations
 * Set to 5 minutes based on research showing 300-600s optimal for preference data
 */
const CACHE_TTL_MS = 300_000; // 5 minutes
const MAX_CACHE_ENTRIES = 500;

/**
 * Evict oldest cache entries if limit exceeded
 */
function evictCacheIfNeeded(): void {
  if (codeLexiconCache.size > MAX_CACHE_ENTRIES) {
    const firstKey = codeLexiconCache.keys().next().value;
    if (firstKey) {
      codeLexiconCache.delete(firstKey);
    }
  }
}

/**
 * Check if a term is a programming language (sync, static-only)
 */
export function isProgrammingLanguage(term: string): boolean {
  const normalized = term.toLowerCase();
  return PROGRAMMING_LANGUAGES.some((lang) => normalized === lang);
}

/**
 * Check if a term is a framework (sync, static-only)
 */
export function isFramework(term: string): boolean {
  const normalized = term.toLowerCase();
  return FRAMEWORKS.some((fw) => normalized === fw);
}

/**
 * Check if a term is a development tool (sync, static-only)
 */
export function isDevTool(term: string): boolean {
  const normalized = term.toLowerCase();
  return DEV_TOOLS.some((tool) => normalized === tool);
}

/**
 * Get language from file extension (deterministic, no learning needed)
 */
export function getLanguageFromExtension(ext: string): string | null {
  return FILE_EXTENSIONS[ext.toLowerCase()] ?? null;
}

/**
 * Check if a term is a programming language with graph-based learning.
 * Queries learned associations first, falls back to static.
 *
 * @param term - Term to check
 * @param resource - Resource scope for graph queries (default: "user")
 * @param findCodeAssociation - Optional graph query function
 */
export async function isProgrammingLanguageWithLearning(
  term: string,
  resource = "user",
  findCodeAssociation?: (
    term: string,
    category: "language" | "framework" | "tool",
    resource: string
  ) => Promise<CodeLexiconResult | null>
): Promise<CodeLexiconResult> {
  const cacheKey = `lang:${term.toLowerCase()}`;
  const cached = codeLexiconCache.get(cacheKey);

  if (cached && cached.expiresAt > Date.now()) {
    return {
      result: cached.result,
      source: cached.source,
      confidence: cached.confidence,
    };
  }

  // Query graph for learned associations if function provided
  if (findCodeAssociation) {
    try {
      const learned = await findCodeAssociation(term, "language", resource);
      if (learned && learned.confidence >= LEARNED_OVERRIDE_THRESHOLD) {
        codeLexiconCache.set(cacheKey, {
          ...learned,
          expiresAt: Date.now() + CACHE_TTL_MS,
        });
        evictCacheIfNeeded();
        return learned;
      }
    } catch {
      // Graph query failed, fall through to static
    }
  }

  // Fall back to static
  const staticResult = isProgrammingLanguage(term);
  return {
    result: staticResult,
    source: "static",
    confidence: staticResult ? 0.85 : 0.5,
  };
}

/**
 * Check if a term is a framework with graph-based learning.
 * Queries learned associations first, falls back to static.
 *
 * @param term - Term to check
 * @param resource - Resource scope for graph queries (default: "user")
 * @param findCodeAssociation - Optional graph query function
 */
export async function isFrameworkWithLearning(
  term: string,
  resource = "user",
  findCodeAssociation?: (
    term: string,
    category: "language" | "framework" | "tool",
    resource: string
  ) => Promise<CodeLexiconResult | null>
): Promise<CodeLexiconResult> {
  const cacheKey = `fw:${term.toLowerCase()}`;
  const cached = codeLexiconCache.get(cacheKey);

  if (cached && cached.expiresAt > Date.now()) {
    return {
      result: cached.result,
      source: cached.source,
      confidence: cached.confidence,
    };
  }

  // Query graph for learned associations if function provided
  if (findCodeAssociation) {
    try {
      const learned = await findCodeAssociation(term, "framework", resource);
      if (learned && learned.confidence >= LEARNED_OVERRIDE_THRESHOLD) {
        codeLexiconCache.set(cacheKey, {
          ...learned,
          expiresAt: Date.now() + CACHE_TTL_MS,
        });
        evictCacheIfNeeded();
        return learned;
      }
    } catch {
      // Graph query failed, fall through to static
    }
  }

  // Fall back to static
  const staticResult = isFramework(term);
  return {
    result: staticResult,
    source: "static",
    confidence: staticResult ? 0.82 : 0.5,
  };
}

/**
 * Check if a term is a dev tool with graph-based learning.
 * Queries learned associations first, falls back to static.
 *
 * @param term - Term to check
 * @param resource - Resource scope for graph queries (default: "user")
 * @param findCodeAssociation - Optional graph query function
 */
export async function isDevToolWithLearning(
  term: string,
  resource = "user",
  findCodeAssociation?: (
    term: string,
    category: "language" | "framework" | "tool",
    resource: string
  ) => Promise<CodeLexiconResult | null>
): Promise<CodeLexiconResult> {
  const cacheKey = `tool:${term.toLowerCase()}`;
  const cached = codeLexiconCache.get(cacheKey);

  if (cached && cached.expiresAt > Date.now()) {
    return {
      result: cached.result,
      source: cached.source,
      confidence: cached.confidence,
    };
  }

  // Query graph for learned associations if function provided
  if (findCodeAssociation) {
    try {
      const learned = await findCodeAssociation(term, "tool", resource);
      if (learned && learned.confidence >= LEARNED_OVERRIDE_THRESHOLD) {
        codeLexiconCache.set(cacheKey, {
          ...learned,
          expiresAt: Date.now() + CACHE_TTL_MS,
        });
        evictCacheIfNeeded();
        return learned;
      }
    } catch {
      // Graph query failed, fall through to static
    }
  }

  // Fall back to static
  const staticResult = isDevTool(term);
  return {
    result: staticResult,
    source: "static",
    confidence: staticResult ? 0.8 : 0.5,
  };
}

/**
 * Clear code lexicon cache (for testing)
 */
export function clearCodeLexiconCache(): void {
  codeLexiconCache.clear();
}
