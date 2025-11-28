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
 * Development tools (~40 entries)
 */
export const DEV_TOOLS = [
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
  "git",
  "github",
  "gitlab",
  "bitbucket",
  "jenkins",
  "circleci",
  "travis",
  "github-actions",
  "gitlab-ci",
  "azure-devops",
  "aws",
  "gcp",
  "azure",
  "vercel",
  "netlify",
  "cloudflare",
  "nginx",
  "apache",
  "redis",
  "postgres",
  "postgresql",
  "mysql",
  "mongodb",
  "elasticsearch",
  "kafka",
  "rabbitmq",
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
 * Check if a term is a programming language
 */
export function isProgrammingLanguage(term: string): boolean {
  const normalized = term.toLowerCase();
  return PROGRAMMING_LANGUAGES.some((lang) => normalized === lang);
}

/**
 * Check if a term is a framework
 */
export function isFramework(term: string): boolean {
  const normalized = term.toLowerCase();
  return FRAMEWORKS.some((fw) => normalized === fw);
}

/**
 * Check if a term is a development tool
 */
export function isDevTool(term: string): boolean {
  const normalized = term.toLowerCase();
  return DEV_TOOLS.some((tool) => normalized === tool);
}

/**
 * Get language from file extension
 */
export function getLanguageFromExtension(ext: string): string | null {
  return FILE_EXTENSIONS[ext.toLowerCase()] ?? null;
}

