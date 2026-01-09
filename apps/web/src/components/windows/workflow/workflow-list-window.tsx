import type { inferRouterOutputs } from "@trpc/server";
import type { NodeProps } from "@xyflow/react";
import { ListChecks, PlusCircle } from "lucide-react";
import { useMemo, useState } from "react";
import { Virtuoso } from "react-virtuoso";
import { z } from "zod";
import { BiolumBadge } from "@/components/tremor";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  SmallCard,
  TinyDot,
  useLOD,
  WindowFrame,
} from "@/components/windows/shared";
import { WorkflowDetailModal } from "@/components/workflow-detail-modal";
import { useDesktopStore } from "@/store/desktop";
import { type TRPCAppRouter, trpc } from "@/utils/trpc";

const statusOptions = [
  "all",
  "running",
  "completed",
  "failed",
  "suspended",
  "cancelled",
] as const;
type WorkflowStatusFilter = (typeof statusOptions)[number];

type WorkflowRun =
  inferRouterOutputs<TRPCAppRouter>["workflow"]["listRuns"][number];

const statusVariants: Record<
  string,
  React.ComponentProps<typeof BiolumBadge>["variant"]
> = {
  running: "default",
  completed: "success",
  failed: "error",
  suspended: "warning",
  cancelled: "default",
};

const workflowListWindowDataSchema = z.object({
  type: z.literal("workflowlist"),
  label: z.string().optional(),
  viewMode: z.enum(["compact", "full", "maximized"]).default("full"),
  filter: z.enum(statusOptions).optional(),
});

export function WorkflowListWindow({ id, data, selected }: NodeProps) {
  const lod = useLOD();

  const parsed = workflowListWindowDataSchema.safeParse(data);
  const windowData = parsed.success
    ? parsed.data
    : { type: "workflowlist" as const, viewMode: "full" as const };

  const [detailRun, setDetailRun] = useState<WorkflowRun | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<WorkflowStatusFilter>(
    windowData.filter ?? "all"
  );

  const updateWindowData = useDesktopStore((s) => s.updateWindowData);
  const spawnWindow = useDesktopStore((s) => s.spawnWindow);
  const windows = useDesktopStore((s) => s.windows);
  const focusWindow = useDesktopStore((s) => s.focusWindow);

  const workflowsQuery = trpc.workflow.listRuns.useQuery({
    status:
      statusFilter === "all"
        ? undefined
        : (statusFilter as
            | "running"
            | "completed"
            | "failed"
            | "suspended"
            | "cancelled"),
    limit: 20,
    offset: 0,
  });

  const workflows = workflowsQuery.data ?? [];

  const handleFilterChange = (value: WorkflowStatusFilter) => {
    setStatusFilter(value);
    updateWindowData(id, { draft: { filter: value } });
  };

  const focusWorkflowWindow = (run: WorkflowRun) => {
    const existing = windows.find((w) => {
      if (w.type !== "workflow") {
        return false;
      }
      const ref = w.data.resourceRef;
      return ref?.type === "workflow_run" && ref.id === run.id;
    });

    if (existing) {
      focusWindow(existing.id);
      return;
    }

    spawnWindow("workflow", { type: "workflow_run", id: run.id });
  };

  const spawnNewWorkflow = () => {
    spawnWindow("workflow");
  };

  const sortedWorkflows = useMemo(
    () =>
      [...workflows].sort(
        (a, b) =>
          new Date(b.created ?? 0).getTime() -
          new Date(a.created ?? 0).getTime()
      ),
    [workflows]
  );

  const runningCount = workflows.filter((w) => w.status === "running").length;

  if (lod === "tiny") {
    return (
      <TinyDot
        color={runningCount > 0 ? "bg-biolum" : "bg-biolum-dim"}
        shadow={
          runningCount > 0
            ? "shadow-[0_0_8px_rgba(var(--biolum-rgb),1)]"
            : "shadow-biolum-dim/50"
        }
      />
    );
  }

  if (lod === "small") {
    return (
      <SmallCard
        borderColor="border-biolum/20"
        hoverColor="hover:border-biolum/40"
        icon={<ListChecks className="h-3 w-3" />}
        label={`Workflows (${runningCount})`}
        textColor="text-biolum"
      />
    );
  }

  return (
    <>
      <WindowFrame
        actions={
          <Button
            className="h-6 w-6"
            onClick={spawnNewWorkflow}
            size="icon"
            variant="ghost"
          >
            <PlusCircle className="h-4 w-4" />
          </Button>
        }
        id={id}
        selected={selected}
        title="Workflows"
        width={400}
        windowType="workflowlist"
      >
        <div className="flex flex-col gap-3 p-4">
          <div className="flex items-center justify-between">
            <Select
              onValueChange={(v) =>
                handleFilterChange(v as WorkflowStatusFilter)
              }
              value={statusFilter}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Filter" />
              </SelectTrigger>
              <SelectContent>
                {statusOptions.map((opt) => (
                  <SelectItem key={opt} value={opt}>
                    {opt === "all"
                      ? "All"
                      : opt.charAt(0).toUpperCase() + opt.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-biolum-faint text-xs">
              {workflows.length} workflow{workflows.length !== 1 ? "s" : ""}
            </span>
          </div>

          {sortedWorkflows.length === 0 ? (
            <div className="h-[280px] py-8 text-center text-biolum-faint text-sm">
              {workflowsQuery.isLoading ? "Loading..." : "No workflows found"}
            </div>
          ) : (
            <Virtuoso
              className="h-[280px]"
              data={sortedWorkflows}
              itemContent={(_, run) => (
                <div className="pb-2">
                  <button
                    className="flex w-full items-center justify-between rounded border border-white/5 bg-white/5 px-3 py-2 text-left transition-colors hover:border-biolum/30 hover:bg-white/10"
                    onClick={() => focusWorkflowWindow(run)}
                    onDoubleClick={() => {
                      setDetailRun(run);
                      setDetailOpen(true);
                    }}
                    type="button"
                  >
                    <div className="flex flex-col gap-0.5">
                      <span className="font-medium text-sm text-white">
                        {run.workflowId ?? "Untitled"}
                      </span>
                      <span className="text-biolum-faint text-xs">
                        {run.created
                          ? new Date(run.created).toLocaleString()
                          : "Not started"}
                      </span>
                    </div>
                    <BiolumBadge
                      variant={statusVariants[run.status] ?? "default"}
                    >
                      {run.status}
                    </BiolumBadge>
                  </button>
                </div>
              )}
            />
          )}
        </div>
      </WindowFrame>
      {detailRun && (
        <WorkflowDetailModal
          onClose={() => {
            setDetailOpen(false);
            setDetailRun(null);
          }}
          open={detailOpen}
          workflow={detailRun}
        />
      )}
    </>
  );
}
