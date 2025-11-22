
export type CodeFile = {
  path: string;
  content: string;
  startLine?: number;
  endLine?: number;
  tokens?: number;
};

// ingestCodeFiles moved to @alfred/agent to break circular dependency
