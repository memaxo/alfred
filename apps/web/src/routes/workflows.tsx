import { createFileRoute } from "@tanstack/react-router";
import type { inferRouterOutputs } from "@trpc/server";
import { Eye } from "lucide-react";
import { useState } from "react";
import { RouteError } from "@/components/route-error";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@radix-ui/react-select";
import { BiolumBadge, type BiolumBadgeVariant } from "@/components/tremor";
import { WorkflowDetailModal } from "@/components/workflow-detail-modal";
import type { TRPCAppRouter } from "@/utils/trpc";
import { trpc } from "@/utils/trpc";

export const Route = createFileRoute("/workflows")({
  component: WorkflowsRoute,
  errorComponent: RouteError,
});

type WorkflowStatus = "running" | "suspended" | "completed" | "failed" | "cancelled";
type RouterOutputs = inferRouterOutputs<TRPCAppRouter>;
type WorkflowRun = RouterOutputs["workflow"]["listRuns"][number];

const statusVariants: Record<WorkflowStatus, BiolumBadgeVariant> = {
  running: "default",
  suspended: "warning",
  completed: "success",
  failed: "error",
  cancelled: "default",
};

function formatDuration(startedAt: Date | null, completedAt: Date | null): string {
  if (!startedAt) return "—";
  const end = completedAt ?? new Date();
  const durationMs = end.getTime() - startedAt.getTime();
  const seconds = Math.floor(durationMs / 1000);
  
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ${seconds % 60}s`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}

function WorkflowsRoute() {
  const [statusFilter, setStatusFilter] = useState<WorkflowStatus | "all">("all");
  const [selectedWorkflow, setSelectedWorkflow] = useState<WorkflowRun | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const workflowsQuery = trpc.workflow.listRuns.useQuery({
    status: statusFilter === "all" ? undefined : statusFilter,
    limit: 20,
    offset: 0,
  });

  const workflows: WorkflowRun[] = workflowsQuery.data ?? [];
  const isLoading = workflowsQuery.isLoading;

  const handleViewDetails = (workflow: WorkflowRun) => {
    setSelectedWorkflow(workflow);
    setDetailsOpen(true);
  };

  const handleCloseDetails = () => {
    setDetailsOpen(false);
    setSelectedWorkflow(null);
  };

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 py-10">
      {/* Header with Filters */}
      <Card className="rounded-3xl border border-white/10 bg-void-surface/40 backdrop-blur-xl shadow-none">
        <CardHeader>
          <CardTitle className="text-biolum tracking-tighter">Workflow History</CardTitle>
          <CardDescription className="text-biolum-dim">
            View and manage your workflow executions.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 items-center">
            <label htmlFor="status-filter" className="text-biolum-dim text-sm">
              Status:
            </label>
            <Select
              value={statusFilter}
              onValueChange={(value) => setStatusFilter(value as WorkflowStatus | "all")}
            >
              <SelectTrigger
                id="status-filter"
                className="w-40 rounded-full border border-white/10 bg-void-surface/20 px-4 py-2 text-biolum"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-3xl border border-white/10 bg-void-surface/90 backdrop-blur-xl">
                <SelectItem value="all" className="text-biolum">All</SelectItem>
                <SelectItem value="running" className="text-biolum">Running</SelectItem>
                <SelectItem value="completed" className="text-biolum">Completed</SelectItem>
                <SelectItem value="failed" className="text-biolum">Failed</SelectItem>
                <SelectItem value="suspended" className="text-biolum">Suspended</SelectItem>
                <SelectItem value="cancelled" className="text-biolum">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Workflows Table */}
      <Card className="rounded-3xl border border-white/10 bg-void-surface/40 backdrop-blur-xl shadow-none">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="text-biolum-dim text-center py-12">
              Loading workflows...
            </div>
          ) : workflows.length === 0 ? (
            <div className="text-biolum-dim text-center py-12">
              <p>No workflows found.</p>
              {statusFilter !== "all" && (
                <button
                  type="button"
                  onClick={() => setStatusFilter("all")}
                  className="mt-4 text-biolum underline hover:text-biolum-dim"
                >
                  Show all workflows
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b border-white/10">
                  <tr>
                    <th className="px-6 py-4 text-left text-biolum-dim text-sm font-medium tracking-tight">
                      ID
                    </th>
                    <th className="px-6 py-4 text-left text-biolum-dim text-sm font-medium tracking-tight">
                      Status
                    </th>
                    <th className="px-6 py-4 text-left text-biolum-dim text-sm font-medium tracking-tight">
                      Workflow
                    </th>
                    <th className="px-6 py-4 text-left text-biolum-dim text-sm font-medium tracking-tight">
                      Started
                    </th>
                    <th className="px-6 py-4 text-left text-biolum-dim text-sm font-medium tracking-tight">
                      Duration
                    </th>
                    <th className="px-6 py-4 text-left text-biolum-dim text-sm font-medium tracking-tight">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {workflows.map((workflow) => (
                    <tr
                      key={workflow.id}
                      className="border-b border-white/10 hover:bg-void-surface/40 transition-colors"
                    >
                      <td className="px-6 py-4 text-biolum text-sm font-mono">
                        {workflow.id.slice(0, 8)}
                      </td>
                      <td className="px-6 py-4">
                        <BiolumBadge variant={statusVariants[workflow.status]}>
                          {workflow.status}
                        </BiolumBadge>
                      </td>
                      <td className="px-6 py-4 text-biolum text-sm">
                        {workflow.workflowId}
                      </td>
                      <td className="px-6 py-4 text-biolum-dim text-sm">
                        {workflow.startedAt
                          ? new Date(workflow.startedAt).toLocaleString()
                          : "—"}
                      </td>
                      <td className="px-6 py-4 text-biolum-dim text-sm">
                        {formatDuration(workflow.startedAt, workflow.completedAt)}
                      </td>
                      <td className="px-6 py-4">
                        <button
                          type="button"
                          onClick={() => handleViewDetails(workflow)}
                          className="flex items-center gap-1 text-biolum text-sm hover:text-biolum-dim transition-colors"
                        >
                          <Eye className="h-4 w-4" />
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Workflow Detail Modal */}
      <WorkflowDetailModal
        workflow={selectedWorkflow}
        open={detailsOpen}
        onClose={handleCloseDetails}
      />
    </div>
  );
}

