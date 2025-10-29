import { createRequire } from "node:module";

export interface TokenEstimator {
  estimate(text: string): number;
  estimateLines(lines: string[]): number;
}

const DEFAULT_DIVISOR = 4;

function heuristicCount(text: string) {
  if (!text) return 0;
  return Math.ceil(text.length / DEFAULT_DIVISOR);
}

type Encoder = {
  encode: (text: string) => number[];
  free?: () => void;
};

export function createTokenEstimator(opts?: { model?: string }): TokenEstimator {
  let encoder: Encoder | null = null;

  try {
    const require = createRequire(import.meta.url);
    // tiktoken is optional; fall back silently if unavailable.
    const tiktoken = require("tiktoken");
    if (tiktoken && typeof tiktoken.encoding_for_model === "function") {
      const encoding = tiktoken.encoding_for_model(opts?.model ?? process.env.MASTRA_MODEL ?? "gpt-4o-mini");
      encoder = {
        encode: (text: string) => encoding.encode(text),
        free: () => encoding.free(),
      };
    }
  } catch {
    encoder = null;
  }

  const estimate = (text: string) => {
    if (!encoder) {
      return heuristicCount(text);
    }
    try {
      return encoder.encode(text).length;
    } catch {
      return heuristicCount(text);
    }
  };

  return {
    estimate,
    estimateLines(lines: string[]) {
      if (!Array.isArray(lines) || lines.length === 0) {
        return 0;
      }
      if (!encoder) {
        return heuristicCount(lines.join("\n"));
      }
      try {
        let total = 0;
        for (const line of lines) {
          total += encoder.encode(line).length;
        }
        return total;
      } catch {
        return heuristicCount(lines.join("\n"));
      }
    },
  };
}
