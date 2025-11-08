/**
 * Cohere rerank integration for RAG
 * Optional reranking step to improve retrieval quality
 *
 * TODO: Migrate to AI SDK v6 rerank() when @ai-sdk/cohere adds rerankingModel() support
 */
export type RerankOptions = {
    query: string;
    documents: Array<{
        id: string;
        text: string;
    }>;
    topN?: number;
    model?: "rerank-v3.5" | "rerank-english-v3.0" | "rerank-multilingual-v3.0";
};
export type RerankResult = {
    id: string;
    text: string;
    score: number;
    index: number;
};
/**
 * Reranks documents using Cohere API.
 * Gated by COHERE_API_KEY env var - returns original order if not configured.
 *
 * Note: Currently uses manual API calls. Will migrate to AI SDK v6 rerank()
 * when @ai-sdk/cohere adds rerankingModel() support.
 */
export declare function rerank({ query, documents, topN, model, }: RerankOptions): Promise<RerankResult[]>;
//# sourceMappingURL=rerank.d.ts.map