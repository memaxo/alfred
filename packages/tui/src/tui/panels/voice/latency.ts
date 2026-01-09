import type { VoiceLatencyStats } from "../../subscriptions/voice";
import { colors } from "../../theme";
import { bold, dim, fg } from "../../typography";

export type VoiceLatencySummary = {
  worstP99: number;
  sttP50: number;
  sttP99: number;
  ttsP50: number;
  ttsP99: number;
};

export function calculateLatencySummary(
  latency: VoiceLatencyStats
): VoiceLatencySummary {
  const worstP99 = Math.max(latency.sttP99, latency.ttsP99);
  return { worstP99, ...latency };
}

export function renderVoiceLatency(
  latency: VoiceLatencyStats,
  _width: number
): string[] {
  const stt = `${dim("STT:")}  p50 ${Math.round(latency.sttP50)}ms  p99 ${Math.round(latency.sttP99)}ms`;
  const tts = `${dim("TTS:")}  p50 ${Math.round(latency.ttsP50)}ms  p99 ${Math.round(latency.ttsP99)}ms`;
  return [`  ${stt}`, `  ${tts}`];
}

export function renderLatencySummary(summary: VoiceLatencySummary): string {
  const color =
    summary.worstP99 > 1200
      ? colors.error
      : summary.worstP99 > 600
        ? colors.warning
        : colors.success;
  return `${bold(dim("  Overall:"))} ${fg(color)(`${Math.round(summary.worstP99)}ms p99 (worst)`)}`;
}
