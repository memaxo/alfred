import { createRequire } from "node:module";

export interface TokenEstimator {
  estimate(text: string): number;
  estimateLines(lines: string[]): number;
}

const DEFAULT_DIVISOR = 4;

function heuristicCount(text: string) {
  if (!text) {
    return 0;
  }
  return Math.ceil(text.length / DEFAULT_DIVISOR);
}

interface Encoder {
  encode: (text: string) => number[];
  free?: () => void;
}

export function createTokenEstimator(opts?: {
  model?: string;
}): TokenEstimator {
  let encoder: Encoder | null = null;
  const cache = new Map<string, number>();

  const remember = (key: string, value: number) => {
    if (cache.size >= 256) {
      const first = cache.keys().next();
      if (!first.done) {
        cache.delete(first.value);
      }
    }
    cache.set(key, value);
    return value;
  };

  try {
    const require = createRequire(import.meta.url);
    // tiktoken is optional; fall back silently if unavailable.
    const tiktoken = require("tiktoken");
    if (tiktoken && typeof tiktoken.encoding_for_model === "function") {
      const encoding = tiktoken.encoding_for_model(
        opts?.model ?? process.env.MASTRA_MODEL ?? "gpt-4o-mini"
      );
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
      return remember(text, heuristicCount(text));
    }
    const cached = cache.get(text);
    if (cached !== undefined) {
      return cached;
    }
    try {
      return remember(text, encoder.encode(text).length);
    } catch {
      return remember(text, heuristicCount(text));
    }
  };

  return {
    estimate,
    estimateLines(lines: string[]) {
      if (!Array.isArray(lines) || lines.length === 0) {
        return 0;
      }
      let total = 0;
      for (const line of lines) {
        total += estimate(line);
      }
      return total;
    },
  };
}
