export type ModelContextInfo = {
    maxContextTokens: number;
    defaultHistoryRatio?: number;
};
export declare function resetModelContextOverrides(): void;
export declare function getModelContextInfo(modelId: string): ModelContextInfo;
