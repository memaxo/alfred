import { createFileRoute } from "@tanstack/react-router";
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
import { trpc } from "@/utils/trpc";
import { VoidCard } from "@/components/tremor/void-card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

const REFRESH_INTERVAL_MS = 5000;
const MAX_HISTORY_POINTS = 20;

type TremorColor = "emerald" | "blue" | "amber" | "red";

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

export const Route = createFileRoute("/_protected/admin/metrics")({
  component: MetricsDashboardRoute,
});

function MetricsDashboardRoute() {
  return <MetricsDashboardView />;
}

export function MetricsDashboardView() {
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const { data: stats, isLoading, refetch, isRefetching } = trpc.admin.getPerformanceStats.useQuery(undefined, {
    refetchInterval: REFRESH_INTERVAL_MS,
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

  if (isLoading && !stats) {
    return <MetricsSkeleton />;
  }

  if (!stats) {
    return <div className="p-10 text-center text-biolum-dim">No metrics data available.</div>;
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-biolum-dim text-sm">System Performance</p>
          <h1 className="font-semibold text-2xl text-biolum">Operational Dashboard</h1>
        </div>
        <div className="flex items-center gap-4">
          {isRefetching && (
            <Badge color="emerald">
              Live Sync
            </Badge>
          )}
          <Button onClick={() => refetch()} variant="outline" size="sm">
            Refresh
          </Button>
        </div>
      </div>

      <Grid className="gap-6" numItemsSm={2} numItemsLg={4}>
        <StatCard
          title="Graph Queries"
          metric={stats.graph.queriesTotal.toString()}
          icon={<Database className="h-5 w-5" />}
          subtext="Total database traversals"
        />
        <StatCard
          title="Assistant Requests"
          metric={stats.assistant.requestsTotal.toString()}
          icon={<MessageSquare className="h-5 w-5" />}
          subtext="Total AI generations"
        />
        <StatCard
          title="Droid Executions"
          metric={stats.tools.droidRunsTotal.toString()}
          icon={<Cpu className="h-5 w-5" />}
          subtext="Autonomous agent tasks"
        />
        <StatCard
          title="System Health"
          metric={stats.system.healthChecksTotal.toString()}
          icon={<Heart className="h-5 w-5" />}
          subtext="Completed health checks"
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
                  className="mt-4 h-72"
                  data={history}
                  index="time"
                  categories={["graphQueries", "assistantRequests", "droidRuns"]}
                  colors={["emerald", "blue", "amber"]}
                  showLegend={true}
                  yAxisWidth={40}
                />
              </VoidCard>

              <VoidCard>
                <Title>Throughput Distribution</Title>
                <Flex className="mt-4 flex-col gap-4">
                  <ProgressBarValue
                    label="Graph Queries"
                    value={stats.graph.queriesTotal}
                    max={Math.max(stats.graph.queriesTotal, stats.assistant.requestsTotal, stats.tools.droidRunsTotal) * 1.2}
                    color="emerald"
                  />
                  <ProgressBarValue
                    label="Assistant Requests"
                    value={stats.assistant.requestsTotal}
                    max={Math.max(stats.graph.queriesTotal, stats.assistant.requestsTotal, stats.tools.droidRunsTotal) * 1.2}
                    color="blue"
                  />
                  <ProgressBarValue
                    label="Droid Runs"
                    value={stats.tools.droidRunsTotal}
                    max={Math.max(stats.graph.queriesTotal, stats.assistant.requestsTotal, stats.tools.droidRunsTotal) * 1.2}
                    color="amber"
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
                    <Metric className="text-emerald-400">{stats.graph.ragHits}</Metric>
                  </div>
                  <div className="rounded-2xl bg-white/5 p-4">
                    <Text>RAG Empty</Text>
                    <Metric className="text-amber-400">{stats.graph.ragEmpty}</Metric>
                  </div>
                </div>
                <div className="mt-6">
                  <Text>Search Efficiency (Hits vs Empty)</Text>
                  <ProgressBar
                    className="mt-2"
                    value={(stats.graph.ragHits / (stats.graph.ragHits + stats.graph.ragEmpty || 1)) * 100}
                    color="emerald"
                  />
                </div>
              </VoidCard>

              <VoidCard>
                <Title>Graph Latency (P50)</Title>
                <AreaChart
                  className="mt-4 h-72"
                  data={history}
                  index="time"
                  categories={["graphLatency"]}
                  colors={["emerald"]}
                  valueFormatter={(v) => `${v.toFixed(3)}s`}
                  showLegend={false}
                  yAxisWidth={60}
                />
              </VoidCard>
            </div>
          </TabPanel>

          <TabPanel>
             <div className="mt-6 grid gap-6 lg:grid-cols-3">
                <LatencyCard title="Graph Query" summary={stats.graph.queryLatency} budget={0.001} />
                <LatencyCard title="Graph Context" summary={stats.graph.contextLatency} budget={0.01} />
                <LatencyCard title="Assistant Gen" summary={stats.assistant.generateLatency} budget={2.0} />
                <LatencyCard title="Droid Exec" summary={stats.tools.droidDuration} budget={5.0} />
             </div>
          </TabPanel>
        </TabPanels>
      </TabGroup>
    </div>
  );
}

function StatCard({ title, metric, icon, subtext }: { title: string; metric: string; icon: React.ReactNode; subtext: string }) {
  return (
    <VoidCard>
      <Flex alignItems="start">
        <div>
          <Text className="text-biolum-dim">{title}</Text>
          <Metric className="text-biolum">{metric}</Metric>
        </div>
        <div className="rounded-full bg-white/5 p-2 text-biolum">
          {icon}
        </div>
      </Flex>
      <Text className="mt-2 text-xs text-biolum-dim">{subtext}</Text>
    </VoidCard>
  );
}

function ProgressBarValue({ label, value, max, color }: { label: string; value: number; max: number; color: TremorColor }) {
  return (
    <div className="w-full">
      <Flex>
        <Text>{label}</Text>
        <Text>{value}</Text>
      </Flex>
      <ProgressBar value={(value / (max || 1)) * 100} color={color} className="mt-2" />
    </div>
  );
}

function LatencyCard({ title, summary, budget }: { title: string; summary: LatencySummary; budget?: number }) {
  const formatValue = (v: number | null | undefined) => (v !== null && v !== undefined ? `${v.toFixed(3)}s` : "—");
  const isOverBudget = budget !== undefined && summary.p50 !== null && summary.p50 !== undefined && summary.p50 > budget;
  
  return (
    <VoidCard className={isOverBudget ? "ring-2 ring-red-500/50" : ""}>
      <Flex>
        <Title>{title} Latency</Title>
        {budget !== undefined && (
          <Badge color={isOverBudget ? "red" : "emerald"} size="xs">
            Budget: {budget < 0.001 ? `${(budget * 1000000).toFixed(0)}µs` : `${(budget * 1000).toFixed(0)}ms`}
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
      <Grid className="gap-6" numItemsSm={2} numItemsLg={4}>
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-32 w-full" />
        ))}
      </Grid>
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-96 w-full" />
    </div>
  );
}
