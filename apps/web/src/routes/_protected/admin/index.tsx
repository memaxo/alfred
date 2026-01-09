import { createFileRoute, Link } from "@tanstack/react-router";
import { Grid, Text, Title } from "@tremor/react";
import { Activity, Mic, Monitor, Shield } from "lucide-react";
import { VoidCard } from "@/components/tremor/void-card";

export const Route = createFileRoute("/_protected/admin/")({
  component: AdminIndex,
});

function AdminIndex() {
  const adminTools = [
    {
      title: "Admin Hub",
      description:
        "The canonical desktop-first management experience for all operations.",
      href: "/",
      search: { spawn: "admin" },
      icon: <Shield className="h-6 w-6 text-biolum" />,
    },
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
    <div className="space-y-6 font-sans text-biolum">
      <div className="rounded-2xl border border-biolum/20 bg-biolum/5 p-6 shadow-[0_0_20px_rgba(0,243,255,0.05)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="flex items-center gap-2 font-semibold text-biolum text-xl">
              <Monitor className="h-5 w-5" />
              Desktop First Experience
            </h2>
            <p className="mt-2 max-w-2xl text-biolum-dim text-sm leading-relaxed">
              Administrative tools have moved to the integrated ALFRED Desktop.
              The Desktop UI provides a more responsive, tabbed experience with
              cross-tool integration.
            </p>
          </div>
          <Link search={{ spawn: "admin" }} to="/">
            <button
              className="rounded-lg bg-biolum px-4 py-2 font-medium text-sm text-void transition-all hover:bg-biolum-bright active:scale-95"
              type="button"
            >
              Launch Desktop Admin
            </button>
          </Link>
        </div>
      </div>

      <div>
        <h2 className="font-semibold text-biolum text-xl">Legacy Web Views</h2>
        <p className="text-biolum-dim">
          Deep links to specific diagnostic views.
        </p>
      </div>

      <Grid className="gap-6" numItemsLg={3} numItemsSm={1}>
        {adminTools.map((tool) => (
          <Link key={tool.title} search={tool.search} to={tool.href}>
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
