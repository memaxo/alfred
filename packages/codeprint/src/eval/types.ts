export interface EvalCase {
  id: string;
  query: string;
  relevantFiles: string[];
  irrelevantFiles?: string[];
  workspace?: string;
  description?: string;
}

export type EvalMethod = "keyword" | "rerank" | "symbol" | "dependency";

export interface EvalResult {
  caseId: string;
  query: string;
  precision: number;
  recall: number;
  mrr: number;
  ndcg: number;
  latencyMs: number;
  method: EvalMethod;
  returnedFiles: string[];
  relevantReturned: string[];
  relevantMissed: string[];
  irrelevantReturned: string[];
}

export interface EvalSummary {
  totalCases: number;
  avgPrecision: number;
  avgRecall: number;
  avgMrr: number;
  avgNdcg: number;
  avgLatencyMs: number;
  methodBreakdown: {
    keyword: number;
    rerank: number;
  };
  results: EvalResult[];
}

export interface EvalDataset {
  name: string;
  description: string;
  workspace: string;
  cases: EvalCase[];
}
