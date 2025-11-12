export declare function nowNs(): bigint;
export declare function withBudget<T>(label: string, budgetMs: number, fn: () => T | Promise<T>): Promise<T>;
export declare function mark(label: string): void;
export declare function measure(startLabel: string, endLabel?: string): number;
export type VoiceMetricLabel = "fast_capture_start" | "fast_stream_flush" | "stt_local_start" | "stt_local_complete" | "stt_local_error" | "tts_local_start" | "tts_local_complete" | "tts_local_error" | "voice_stream_start" | "voice_stream_connected" | "voice_stream_end" | "voice_stream_error";
export declare function markVoice(label: VoiceMetricLabel): void;
//# sourceMappingURL=performance.d.ts.map