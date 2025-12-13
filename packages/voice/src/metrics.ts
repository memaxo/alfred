import { metricsRegistry } from "@alfred/metrics/registry";
import client from "prom-client";

// Re-export commonly used types from API metrics if needed
export type VoiceMetricStatus = "ok" | "error" | "cancel";

const ensureCounter = (config: client.CounterConfiguration<string>) => {
  const existing = metricsRegistry.getSingleMetric(config.name);
  if (existing) {
    return existing as client.Counter<string>;
  }
  return new client.Counter(config);
};

const ensureHistogram = (config: client.HistogramConfiguration<string>) => {
  const existing = metricsRegistry.getSingleMetric(config.name);
  if (existing) {
    return existing as client.Histogram<string>;
  }
  return new client.Histogram(config);
};

const coerceProvider = (provider?: string) =>
  provider && provider.length > 0 ? provider : "unknown";

const observeDuration = (
  histogram: client.Histogram,
  provider: string,
  durationSeconds?: number
) => {
  if (typeof durationSeconds !== "number") {
    return;
  }
  if (!Number.isFinite(durationSeconds) || durationSeconds < 0) {
    return;
  }
  histogram.observe({ provider }, durationSeconds);
};

export const voiceSttTotal = ensureCounter({
  name: "voice_stt_total",
  help: "Count of voice STT invocations grouped by provider and status.",
  labelNames: ["provider", "status"] as const,
  registers: [metricsRegistry],
});

export const voiceSttDurationSeconds = ensureHistogram({
  name: "voice_stt_duration_seconds",
  help: "Duration of voice STT inference in seconds grouped by provider.",
  labelNames: ["provider"] as const,
  buckets: [0.1, 0.25, 0.5, 1, 2, 5, 10],
  registers: [metricsRegistry],
});

export const voiceTtsTotal = ensureCounter({
  name: "voice_tts_total",
  help: "Count of voice TTS invocations grouped by provider and status.",
  labelNames: ["provider", "status"] as const,
  registers: [metricsRegistry],
});

export const voiceTtsDurationSeconds = ensureHistogram({
  name: "voice_tts_duration_seconds",
  help: "Duration of voice TTS synthesis in seconds grouped by provider.",
  labelNames: ["provider"] as const,
  buckets: [0.05, 0.1, 0.25, 0.5, 1, 2, 5],
  registers: [metricsRegistry],
});

export const voiceAssistantTotal = ensureCounter({
  name: "voice_assistant_total",
  help: "Count of voice assistant (LLM/orchestrator) invocations grouped by provider and status.",
  labelNames: ["provider", "status"] as const,
  registers: [metricsRegistry],
});

export const voiceAssistantDurationSeconds = ensureHistogram({
  name: "voice_assistant_duration_seconds",
  help: "Duration of voice assistant (LLM/orchestrator) inference in seconds grouped by provider.",
  labelNames: ["provider"] as const,
  buckets: [0.1, 0.25, 0.5, 1, 2, 5, 10, 20],
  registers: [metricsRegistry],
});

export function recordVoiceStt({
  provider,
  status,
  durationSeconds,
}: {
  provider?: string;
  status: VoiceMetricStatus;
  durationSeconds?: number;
}) {
  const normalizedProvider = coerceProvider(provider);
  voiceSttTotal.inc({ provider: normalizedProvider, status });
  observeDuration(voiceSttDurationSeconds, normalizedProvider, durationSeconds);
}

export function recordVoiceTts({
  provider,
  status,
  durationSeconds,
}: {
  provider?: string;
  status: VoiceMetricStatus;
  durationSeconds?: number;
}) {
  const normalizedProvider = coerceProvider(provider);
  voiceTtsTotal.inc({ provider: normalizedProvider, status });
  observeDuration(voiceTtsDurationSeconds, normalizedProvider, durationSeconds);
}

export function recordVoiceAssistant({
  provider,
  status,
  durationSeconds,
}: {
  provider?: string;
  status: VoiceMetricStatus;
  durationSeconds?: number;
}) {
  const normalizedProvider = coerceProvider(provider);
  voiceAssistantTotal.inc({ provider: normalizedProvider, status });
  observeDuration(
    voiceAssistantDurationSeconds,
    normalizedProvider,
    durationSeconds
  );
}

export const voiceStreamEventsTotal = ensureCounter({
  name: "voice_stream_events_total",
  help: "Count of voice stream events grouped by event type and status.",
  labelNames: ["event", "status"] as const,
  registers: [metricsRegistry],
});

export const voiceStreamLatencySeconds = ensureHistogram({
  name: "voice_stream_latency_seconds",
  help: "Latency of voice stream operations in seconds grouped by stage.",
  labelNames: ["stage"] as const,
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2, 5],
  registers: [metricsRegistry],
});

const ensureGauge = (config: client.GaugeConfiguration<string>) => {
  const existing = metricsRegistry.getSingleMetric(config.name);
  if (existing) {
    return existing as client.Gauge<string>;
  }
  return new client.Gauge(config);
};

export const voiceQueueDepthCurrent = ensureGauge({
  name: "voice_queue_depth_current",
  help: "Current depth of voice queue.",
  registers: [metricsRegistry],
});

export const voiceQueueDrainDurationSeconds = ensureHistogram({
  name: "voice_queue_drain_duration_seconds",
  help: "Duration of voice queue drain operations in seconds.",
  registers: [metricsRegistry],
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30],
});

export const voiceTranscodeDurationSeconds = ensureHistogram({
  name: "voice_transcode_duration_seconds",
  help: "Duration of voice transcoding operations in seconds grouped by type.",
  labelNames: ["type"] as const,
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2, 5],
  registers: [metricsRegistry],
});

export const voiceProcessHealth = ensureGauge({
  name: "voice_process_health",
  help: "Health status of voice processes (1 = healthy, 0 = unhealthy) grouped by type.",
  labelNames: ["type"] as const,
  registers: [metricsRegistry],
});

export const voiceSessionPacketLossTotal = ensureCounter({
  name: "voice_session_packet_loss_total",
  help: "Total count of lost voice packets reported by client",
  labelNames: ["session_id"] as const,
  registers: [metricsRegistry],
});

export const voiceSessionJitterMillis = ensureHistogram({
  name: "voice_session_jitter_millis",
  help: "Voice session jitter in milliseconds reported by client",
  labelNames: ["session_id"] as const,
  buckets: [1, 5, 10, 20, 50, 100, 200],
  registers: [metricsRegistry],
});

export const voiceSessionRttMillis = ensureHistogram({
  name: "voice_session_rtt_millis",
  help: "Voice session round-trip time in milliseconds reported by client",
  labelNames: ["session_id"] as const,
  buckets: [10, 20, 50, 100, 200, 500, 1000],
  registers: [metricsRegistry],
});
