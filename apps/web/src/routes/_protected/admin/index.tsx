import { createFileRoute, Link } from "@tanstack/react-router";
import { Grid, Text, Title } from "@tremor/react";
import { Activity, Mic } from "lucide-react";
import { VoidCard } from "@/components/tremor/void-card";

export const Route = createFileRoute("/_protected/admin/")({
  component: AdminIndex,
});

function AdminIndex() {
  const adminTools = [
    {
      title: "Performance Metrics",
      description:
        "Real-time system performance, graph queries, and AI latency stats.",
      href: "/admin/metrics",
      icon: <Activity className="h-6 w-6 text-emerald-400" />,
    },
    {
      title: "Voice Operations",
      description: "Monitor and manage voice pools, sessions, and telemetry.",
      href: "/admin/voice",
      icon: <Mic className="h-6 w-6 text-blue-400" />,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-semibold text-biolum text-xl">
          Tools & Diagnostics
        </h2>
        <p className="text-biolum-dim">
          Select an administrative tool to monitor system health.
        </p>
      </div>

      <Grid className="gap-6" numItemsLg={2} numItemsSm={1}>
        {adminTools.map((tool) => (
          <Link key={tool.href} to={tool.href}>
            <VoidCard className="h-full cursor-pointer transition-colors hover:bg-white/5">
              <div className="flex items-start gap-4">
                <div className="rounded-2xl bg-white/5 p-3">{tool.icon}</div>
                <div>
                  <Title className="text-biolum">{tool.title}</Title>
                  <Text className="mt-1 text-biolum-dim">
                    {tool.description}
                  </Text>
                </div>
              </div>
            </VoidCard>
          </Link>
        ))}
      </Grid>
    </div>
  );
}
