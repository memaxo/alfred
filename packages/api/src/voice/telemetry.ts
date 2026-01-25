import type client from "prom-client";

import {
  voiceAssistantDurationSeconds,
  voiceSessionJitterMillis,
  voiceSessionPacketLossTotal,
  voiceSessionRttMillis,
  voiceSttDurationSeconds,
  voiceTtsDurationSeconds,
} from "@alfred/voice/metrics";

export interface HistogramSummary {
  count: number;
  average: number | null;
  p50: number | null;
  p95: number | null;
  unit: "seconds" | "milliseconds";
}

export interface VoiceTelemetrySnapshot {
  sttLatency: HistogramSummary;
  ttsLatency: HistogramSummary;
  assistantLatency: HistogramSummary;
  roundTrip: HistogramSummary;
  jitter: HistogramSummary;
  packetLossTotal: number;
}

type HistogramMetric = client.Histogram<string>;
type CounterMetric = client.Counter<string>;

export async function collectVoiceTelemetry(): Promise<VoiceTelemetrySnapshot> {
  const [
    sttLatency,
    ttsLatency,
    assistantLatency,
    roundTrip,
    jitter,
    packetLossTotal,
  ] = await Promise.all([
    summarizeHistogram(voiceSttDurationSeconds, "seconds"),
    summarizeHistogram(voiceTtsDurationSeconds, "seconds"),
    summarizeHistogram(voiceAssistantDurationSeconds, "seconds"),
    summarizeHistogram(voiceSessionRttMillis, "milliseconds"),
    summarizeHistogram(voiceSessionJitterMillis, "milliseconds"),
    summarizeCounter(voiceSessionPacketLossTotal),
  ]);

  return {
    sttLatency,
    ttsLatency,
    assistantLatency,
    roundTrip,
    jitter,
    packetLossTotal,
  };
}

async function summarizeCounter(counter: CounterMetric): Promise<number> {
  const metric = await counter.get();
  if (!metric?.values?.length) {
    return 0;
  }
  return metric.values.reduce((sum, value) => sum + (value.value ?? 0), 0);
}

async function summarizeHistogram(
  histogram: HistogramMetric,
  unit: HistogramSummary["unit"]
): Promise<HistogramSummary> {
  const metric = await histogram.get();
  const buckets = new Map<number, number>();
  let totalCount = 0;
  let totalSum = 0;

  for (const value of metric?.values ?? []) {
    const { metricName, value: sampleValue, labels } = value;
    if (metricName?.endsWith("_bucket")) {
      const rawLe = labels?.le ?? "Infinity";
      const le =
        rawLe === "+Inf" || rawLe === "Infinity"
          ? Number.POSITIVE_INFINITY
          : Number(rawLe);
      buckets.set(le, (buckets.get(le) ?? 0) + (sampleValue ?? 0));
    } else if (metricName?.endsWith("_count")) {
      totalCount += sampleValue ?? 0;
    } else if (metricName?.endsWith("_sum")) {
      totalSum += sampleValue ?? 0;
    }
  }

  const sortedBuckets = [...buckets.entries()].sort((a, b) => a[0] - b[0]);

  return {
    unit,
    count: totalCount,
    average: computeAverage(totalSum, totalCount),
    p50: computePercentile(sortedBuckets, totalCount, 0.5),
    p95: computePercentile(sortedBuckets, totalCount, 0.95),
  };
}

function computeAverage(sum: number, count: number): number | null {
  if (!(count && Number.isFinite(sum))) {
    return null;
  }
  return sum / count;
}

function computePercentile(
  buckets: [number, number][],
  totalCount: number,
  percentile: number
): number | null {
  if (!(totalCount && buckets.length)) {
    return null;
  }
  const target = totalCount * percentile;
  for (const [le, cumulative] of buckets) {
    if (cumulative >= target) {
      if (!Number.isFinite(le)) {
        const finiteFallback = [...buckets]
          .filter(([maybeLe]) => Number.isFinite(maybeLe))
          .pop()?.[0];
        return finiteFallback ?? null;
      }
      return le;
    }
  }
  const last = buckets.at(-1)?.[0];
  return last !== undefined && Number.isFinite(last) ? last : null;
}
