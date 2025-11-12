const markers = new Map<string, bigint>();

export function nowNs(): bigint {
  return process.hrtime.bigint();
}

export async function withBudget<T>(
  label: string,
  budgetMs: number,
  fn: () => T | Promise<T>
): Promise<T> {
  const start = nowNs();
  try {
    const result = await fn();
    const elapsedMs = Number(nowNs() - start) / 1_000_000;
    if (elapsedMs > budgetMs) {
      console.warn(
        `[metrics] Budget breach for ${label}: ${elapsedMs.toFixed(3)}ms > ${budgetMs}ms`
      );
    }
    return result;
  } catch (error) {
    const elapsedMs = Number(nowNs() - start) / 1_000_000;
    console.error(
      `[metrics] ${label} failed after ${elapsedMs.toFixed(3)}ms`,
      error
    );
    throw error;
  }
}

export function mark(label: string): void {
  markers.set(label, nowNs());
}

export function measure(startLabel: string, endLabel?: string): number {
  const start = markers.get(startLabel);
  if (!start) {
    return 0;
  }
  const end = endLabel ? (markers.get(endLabel) ?? nowNs()) : nowNs();
  const diff = end - start;
  return Number(diff) / 1_000_000;
}

export type VoiceMetricLabel =
  | "fast_capture_start"
  | "fast_stream_flush"
  | "stt_local_start"
  | "stt_local_complete"
  | "stt_local_error"
  | "tts_local_start"
  | "tts_local_complete"
  | "tts_local_error"
  | "voice_stream_start"
  | "voice_stream_connected"
  | "voice_stream_end"
  | "voice_stream_error";

export function markVoice(label: VoiceMetricLabel): void {
  mark(label);
}
