"use client";

import {
  AreaChart,
  Badge,
  Flex,
  Grid,
  Metric,
  ProgressBar,
  Tab,
  TabGroup,
  TabList,
  TabPanel,
  TabPanels,
  Text,
  Title,
} from "@tremor/react";
import {
  Activity,
  Brain,
  Cpu,
  Database,
  Heart,
  MessageSquare,
  Zap,
} from "lucide-react";
import { useEffect, useState } from "react";
import { BiometricGate, isBiometricError } from "@/components/admin/gate";
import { VoidCard } from "@/components/tremor/void-card";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/utils/trpc";

const REFRESH_INTERVAL_MS = 5000;
const MAX_HISTORY_POINTS = 20;

type HistoryPoint = {
  time: string;
  graphQueries: number;
  assistantRequests: number;
  droidRuns: number;
  graphLatency: number;
  assistantLatency: number;
};

type LatencySummary = {
  p50?: number | null;
  p95?: number | null;
  average?: number | null;
  count?: number | null;
};

export function MetricsDashboardView() {
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const {
    data: stats,
    isLoading,
    refetch,
    isRefetching,
    error,
  } = trpc.admin.getPerformanceStats.useQuery(undefined, {
    refetchInterval: REFRESH_INTERVAL_MS,
    retry: false,
  });

  useEffect(() => {
    if (stats) {
      setHistory((prev) => {
        const newPoint = {
          time: new Date(stats.generatedAt).toLocaleTimeString(),
          graphQueries: stats.graph.queriesTotal,
          assistantRequests: stats.assistant.requestsTotal,
          droidRuns: stats.tools.droidRunsTotal,
          graphLatency: stats.graph.queryLatency.p50 ?? 0,
          assistantLatency: stats.assistant.generateLatency.p50 ?? 0,
        };
        const updated = [...prev, newPoint];
        if (updated.length > MAX_HISTORY_POINTS) {
          return updated.slice(updated.length - MAX_HISTORY_POINTS);
        }
        return updated;
      });
    }
  }, [stats]);

  if (isBiometricError(error)) {
    return <BiometricGate onRetry={() => refetch()} />;
  }

  if (isLoading && !stats) {
    return <MetricsSkeleton />;
  }

  if (!stats) {
    return (
      <div className="p-10 text-center text-biolum-dim">
        No metrics data available.
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-biolum-dim text-sm">System Performance</p>
          <h1 className="font-semibold text-2xl text-biolum">
            Operational Dashboard
          </h1>
        </div>
        <div className="flex items-center gap-4">
          {isRefetching && <Badge color="emerald">Live Sync</Badge>}
          <button
            className="rounded-lg border border-white/10 px-3 py-1 text-sm transition-colors hover:bg-white/5"
            onClick={() => refetch()}
            type="button"
          >
            Refresh
          </button>
        </div>
      </div>

      <Grid className="gap-6" numItemsLg={4} numItemsSm={2}>
        <StatCard
          icon={<Database className="h-5 w-5" />}
          metric={stats.graph.queriesTotal.toString()}
          subtext="Total database traversals"
          title="Graph Queries"
        />
        <StatCard
          icon={<MessageSquare className="h-5 w-5" />}
          metric={stats.assistant.requestsTotal.toString()}
          subtext="Total AI generations"
          title="Assistant Requests"
        />
        <StatCard
          icon={<Cpu className="h-5 w-5" />}
          metric={stats.tools.droidRunsTotal.toString()}
          subtext="Autonomous agent tasks"
          title="Droid Executions"
        />
        <StatCard
          icon={<Heart className="h-5 w-5" />}
          metric={stats.system.healthChecksTotal.toString()}
          subtext="Completed health checks"
          title="System Health"
        />
      </Grid>

      <TabGroup>
        <TabList className="mt-8">
          <Tab icon={Activity}>Overview</Tab>
          <Tab icon={Brain}>Graph & RAG</Tab>
          <Tab icon={Zap}>Latency</Tab>
        </TabList>
        <TabPanels>
          <TabPanel>
            <div className="mt-6 grid gap-6 lg:grid-cols-2">
              <VoidCard>
                <Title>Activity Trends</Title>
                <Text>Requests over the last {MAX_HISTORY_POINTS} samples</Text>
                <AreaChart
                  categories={[
                    "graphQueries",
                    "assistantRequests",
                    "droidRuns",
                  ]}
                  className="mt-4 h-72"
                  colors={["emerald", "blue", "amber"]}
                  data={history}
                  index="time"
                  showLegend={true}
                  yAxisWidth={40}
                />
              </VoidCard>

              <VoidCard>
                <Title>Throughput Distribution</Title>
                <Flex className="mt-4 flex-col gap-4">
                  <ProgressBarValue
                    color="emerald"
                    label="Graph Queries"
                    max={
                      Math.max(
                        stats.graph.queriesTotal,
                        stats.assistant.requestsTotal,
                        stats.tools.droidRunsTotal
                      ) * 1.2
                    }
                    value={stats.graph.queriesTotal}
                  />
                  <ProgressBarValue
                    color="blue"
                    label="Assistant Requests"
                    max={
                      Math.max(
                        stats.graph.queriesTotal,
                        stats.assistant.requestsTotal,
                        stats.tools.droidRunsTotal
                      ) * 1.2
                    }
                    value={stats.assistant.requestsTotal}
                  />
                  <ProgressBarValue
                    color="amber"
                    label="Droid Runs"
                    max={
                      Math.max(
                        stats.graph.queriesTotal,
                        stats.assistant.requestsTotal,
                        stats.tools.droidRunsTotal
                      ) * 1.2
                    }
                    value={stats.tools.droidRunsTotal}
                  />
                </Flex>
              </VoidCard>
            </div>
          </TabPanel>

          <TabPanel>
            <div className="mt-6 grid gap-6 lg:grid-cols-2">
              <VoidCard>
                <Title>Graph RAG Performance</Title>
                <div className="mt-4 grid grid-cols-2 gap-4">
                  <div className="rounded-2xl bg-white/5 p-4">
                    <Text>RAG Hits</Text>
                    <Metric className="text-emerald-400">
                      {stats.graph.ragHits}
                    </Metric>
                  </div>
                  <div className="rounded-2xl bg-white/5 p-4">
                    <Text>RAG Empty</Text>
                    <Metric className="text-amber-400">
                      {stats.graph.ragEmpty}
                    </Metric>
                  </div>
                </div>
                <div className="mt-6">
                  <Text>Search Efficiency (Hits vs Empty)</Text>
                  <ProgressBar
                    className="mt-2"
                    color="emerald"
                    value={
                      (stats.graph.ragHits /
                        (stats.graph.ragHits + stats.graph.ragEmpty || 1)) *
                      100
                    }
                  />
                </div>
              </VoidCard>

              <VoidCard>
                <Title>Graph Latency (P50)</Title>
                <AreaChart
                  categories={["graphLatency"]}
                  className="mt-4 h-72"
                  colors={["emerald"]}
                  data={history}
                  index="time"
                  showLegend={false}
                  valueFormatter={(v) => `${v.toFixed(3)}s`}
                  yAxisWidth={60}
                />
              </VoidCard>
            </div>
          </TabPanel>

          <TabPanel>
            <div className="mt-6 grid gap-6 lg:grid-cols-3">
              <LatencyCard
                budget={0.001}
                summary={stats.graph.queryLatency}
                title="Graph Query"
              />
              <LatencyCard
                budget={0.01}
                summary={stats.graph.contextLatency}
                title="Graph Context"
              />
              <LatencyCard
                budget={2.0}
                summary={stats.assistant.generateLatency}
                title="Assistant Gen"
              />
              <LatencyCard
                budget={5.0}
                summary={stats.tools.droidDuration}
                title="Droid Exec"
              />
            </div>
          </TabPanel>
        </TabPanels>
      </TabGroup>
    </div>
  );
}

function StatCard({
  title,
  metric,
  icon,
  subtext,
}: {
  title: string;
  metric: string;
  icon: React.ReactNode;
  subtext: string;
}) {
  return (
    <VoidCard>
      <Flex alignItems="start">
        <div>
          <Text className="text-biolum-dim">{title}</Text>
          <Metric className="text-biolum">{metric}</Metric>
        </div>
        <div className="rounded-full bg-white/5 p-2 text-biolum">{icon}</div>
      </Flex>
      <Text className="mt-2 text-biolum-dim text-xs">{subtext}</Text>
    </VoidCard>
  );
}

function ProgressBarValue({
  label,
  value,
  max,
  color,
}: {
  label: string;
  value: number;
  max: number;
  color: TremorColor;
}) {
  return (
    <div className="w-full">
      <Flex>
        <Text>{label}</Text>
        <Text>{value}</Text>
      </Flex>
      <ProgressBar
        className="mt-2"
        color={color}
        value={(value / (max || 1)) * 100}
      />
    </div>
  );
}

function LatencyCard({
  title,
  summary,
  budget,
}: {
  title: string;
  summary: LatencySummary;
  budget?: number;
}) {
  const formatValue = (v: number | null | undefined) =>
    v !== null && v !== undefined ? `${v.toFixed(3)}s` : "—";
  const isOverBudget =
    budget !== undefined &&
    summary.p50 !== null &&
    summary.p50 !== undefined &&
    summary.p50 > budget;

  return (
    <VoidCard className={isOverBudget ? "ring-2 ring-red-500/50" : ""}>
      <Flex>
        <Title>{title} Latency</Title>
        {budget !== undefined && (
          <Badge color={isOverBudget ? "red" : "emerald"}>
            Budget:{" "}
            {budget < 0.001
              ? `${(budget * 1_000_000).toFixed(0)}µs`
              : `${(budget * 1000).toFixed(0)}ms`}
          </Badge>
        )}
      </Flex>
      <div className="mt-4 space-y-2 font-mono text-sm">
        <Flex>
          <Text>P50</Text>
          <Text className="text-biolum">{formatValue(summary.p50)}</Text>
        </Flex>
        <Flex>
          <Text>P95</Text>
          <Text className="text-biolum">{formatValue(summary.p95)}</Text>
        </Flex>
        <Flex>
          <Text>Avg</Text>
          <Text className="text-biolum">{formatValue(summary.average)}</Text>
        </Flex>
        <Flex>
          <Text>Samples</Text>
          <Text className="text-biolum">{summary.count ?? "—"}</Text>
        </Flex>
      </div>
    </VoidCard>
  );
}

function MetricsSkeleton() {
  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-10 w-24" />
      </div>
      <Grid className="gap-6" numItemsLg={4} numItemsSm={2}>
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton className="h-32 w-full" key={i} />
        ))}
      </Grid>
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-96 w-full" />
    </div>
  );
}
