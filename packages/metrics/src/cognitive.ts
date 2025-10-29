export type CognitiveLoad = {
  tokensIn: number;
  tokensOut: number;
  steps: number;
  tools: string[];
};

const loadHistory: CognitiveLoad[] = [];

export function trackLoad(load: CognitiveLoad): void {
  loadHistory.push({ ...load, tools: [...load.tools] });
}

export function getRecentLoad(count = 10): CognitiveLoad[] {
  if (count <= 0) {
    return [];
  }
  return loadHistory.slice(-count);
}
