import {
  droidExecDurationSeconds,
  droidExecRunsTotal,
} from "@alfred/agent/orchestrator/tool/droid/metrics";
import { cognitiveFeedbackSubmissionsTotal } from "@alfred/metrics/shared";
import type client from "prom-client";
import {
  assistantGenerateDurationSeconds,
  assistantGenerateRequestsTotal,
  graphContextDurationSeconds,
  graphQueriesTotal,
  graphQueryDurationSeconds,
  graphRagEmptyTotal,
  graphRagHitsTotal,
} from "../metrics";
import { healthChecksTotal } from "../metrics/health";

export type HistogramSummary = {
  count: number;
  average: number | null;
  p50: number | null;
  p95: number | null;
  unit: "seconds" | "milliseconds";
};

export type PerformanceTelemetrySnapshot = {
  generatedAt: number;
  graph: {
    queriesTotal: number;
    queryLatency: HistogramSummary;
    contextLatency: HistogramSummary;
    ragHits: number;
    ragEmpty: number;
  };
  assistant: {
    requestsTotal: number;
    generateLatency: HistogramSummary;
  };
  tools: {
    droidRunsTotal: number;
    droidDuration: HistogramSummary;
  };
  system: {
    healthChecksTotal: number;
    cognitiveFeedbackTotal: number;
  };
};

type HistogramMetric = client.Histogram<string>;
type CounterMetric = client.Counter<string>;

export async function collectPerformanceTelemetry(): Promise<PerformanceTelemetrySnapshot> {
  const [
    graphQueriesTotalVal,
    graphQueryLatency,
    graphContextLatency,
    graphRagHitsVal,
    graphRagEmptyVal,
    assistantRequestsTotalVal,
    assistantGenerateLatency,
    droidRunsTotalVal,
    droidDuration,
    healthChecksTotalVal,
    cognitiveFeedbackTotalVal,
  ] = await Promise.all([
    summarizeCounter(graphQueriesTotal),
    summarizeHistogram(graphQueryDurationSeconds, "seconds"),
    summarizeHistogram(graphContextDurationSeconds, "seconds"),
    summarizeCounter(graphRagHitsTotal),
    summarizeCounter(graphRagEmptyTotal),
    summarizeCounter(assistantGenerateRequestsTotal),
    summarizeHistogram(assistantGenerateDurationSeconds, "seconds"),
    summarizeCounter(droidExecRunsTotal),
    summarizeHistogram(droidExecDurationSeconds, "seconds"),
    summarizeCounter(healthChecksTotal),
    summarizeCounter(cognitiveFeedbackSubmissionsTotal),
  ]);

  return {
    generatedAt: Date.now(),
    graph: {
      queriesTotal: graphQueriesTotalVal,
      queryLatency: graphQueryLatency,
      contextLatency: graphContextLatency,
      ragHits: graphRagHitsVal,
      ragEmpty: graphRagEmptyVal,
    },
    assistant: {
      requestsTotal: assistantRequestsTotalVal,
      generateLatency: assistantGenerateLatency,
    },
    tools: {
      droidRunsTotal: droidRunsTotalVal,
      droidDuration,
    },
    system: {
      healthChecksTotal: healthChecksTotalVal,
      cognitiveFeedbackTotal: cognitiveFeedbackTotalVal,
    },
  };
}

async function summarizeCounter(counter: CounterMetric): Promise<number> {
  try {
    const metric = await counter.get();
    if (!metric?.values?.length) {
      return 0;
    }
    return metric.values.reduce((sum, value) => sum + (value.value ?? 0), 0);
  } catch (_error) {
    return 0;
  }
}

async function summarizeHistogram(
  histogram: HistogramMetric,
  unit: HistogramSummary["unit"]
): Promise<HistogramSummary> {
  try {
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
  } catch (_error) {
    return {
      unit,
      count: 0,
      average: null,
      p50: null,
      p95: null,
    };
  }
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
