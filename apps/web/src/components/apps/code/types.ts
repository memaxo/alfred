export interface FileTab {
  id: string;
  path: string;
  name: string;
  language: string;
  content: string;
  isDirty: boolean;
  isLoading?: boolean;
  originalContent?: string;
}

export interface EditorSettings {
  fontSize: number;
  wordWrap: "on" | "off" | "wordWrapColumn" | "bounded";
  minimap: boolean;
  tabSize: number;
  lineNumbers: "on" | "off" | "relative";
}

export type SplitDirection = "horizontal" | "vertical" | null;

export interface EditorPane {
  id: string;
  activeTabId: string | null;
  tabs: FileTab[];
}

export const DEFAULT_EDITOR_SETTINGS: EditorSettings = {
  fontSize: 14,
  wordWrap: "on",
  minimap: true,
  tabSize: 2,
  lineNumbers: "on",
};

export const LANGUAGE_MAP: Record<string, string> = {
  ts: "typescript",
  tsx: "typescriptreact",
  js: "javascript",
  jsx: "javascriptreact",
  json: "json",
  md: "markdown",
  css: "css",
  scss: "scss",
  less: "less",
  html: "html",
  xml: "xml",
  svg: "xml",
  yaml: "yaml",
  yml: "yaml",
  toml: "ini",
  py: "python",
  rb: "ruby",
  rs: "rust",
  go: "go",
  java: "java",
  kt: "kotlin",
  swift: "swift",
  c: "c",
  cpp: "cpp",
  h: "c",
  hpp: "cpp",
  cs: "csharp",
  php: "php",
  sql: "sql",
  sh: "shell",
  bash: "shell",
  zsh: "shell",
  ps1: "powershell",
  dockerfile: "dockerfile",
  makefile: "makefile",
  lua: "lua",
  r: "r",
  scala: "scala",
  graphql: "graphql",
  prisma: "prisma",
  vue: "vue",
  svelte: "svelte",
};

export function getLanguageFromPath(path: string): string {
  const name = path.split("/").pop() ?? "";
  const extension = name.split(".").pop()?.toLowerCase() ?? "";

  if (name.toLowerCase() === "dockerfile") {
    return "dockerfile";
  }
  if (name.toLowerCase() === "makefile") {
    return "makefile";
  }

  return LANGUAGE_MAP[extension] ?? "plaintext";
}
