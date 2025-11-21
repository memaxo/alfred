import type { Node, NodeProps } from "@xyflow/react";
import type { inferRouterOutputs } from "@trpc/server";
import { ListChecks, PlusCircle } from "lucide-react";
import { useMemo, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { BiolumBadge } from "@/components/tremor";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { WorkflowDetailModal } from "@/components/workflow-detail-modal";
import { MindscapeNode } from "./mindscape-node";
import { workflowListNodeDataSchema } from "@/store/mindscape.schemas";
import { useMindscapeStore, type ArtifactData } from "@/store/mindscape";
import { trpc, type TRPCAppRouter } from "@/utils/trpc";
import { createSpawnNode } from "../spawn";

const statusOptions = ["all", "running", "completed", "failed", "suspended", "cancelled"] as const;
type WorkflowStatusFilter = (typeof statusOptions)[number];

type WorkflowRun = inferRouterOutputs<TRPCAppRouter>["workflow"]["listRuns"][number];

const statusVariants: Record<string, React.ComponentProps<typeof BiolumBadge>["variant"]> = {
  running: "default",
  completed: "success",
  failed: "error",
  suspended: "warning",
  cancelled: "default",
};

export function WorkflowListNode({ id, data, selected, x = 0, y = 0 }: NodeProps) {
  const parsed = workflowListNodeDataSchema.safeParse(data);
  const [detailRun, setDetailRun] = useState<WorkflowRun | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const filter = parsed.success ? parsed.data.filter ?? "all" : "all";
  const [statusFilter, setStatusFilter] = useState<WorkflowStatusFilter>(filter as WorkflowStatusFilter);

  const utils = trpc.useUtils();
  const workflowsQuery = trpc.workflow.listRuns.useQuery({
    status: statusFilter === "all" ? undefined : (statusFilter as WorkflowRun["status"]),
    limit: 20,
    offset: 0,
  });

  const workflows = workflowsQuery.data ?? [];

  const { nodes, addArtifact, focusNode, updateArtifactData } = useMindscapeStore(
    useShallow((state) => ({
      nodes: state.nodes,
      addArtifact: state.addArtifact,
      focusNode: state.focusNode,
      updateArtifactData: state.updateArtifactData,
    }))
  );

  const handleFilterChange = (value: WorkflowStatusFilter) => {
    setStatusFilter(value);
    updateArtifactData(id, { filter: value } as Partial<ArtifactData>);
  };

  const focusWorkflowNode = (run: WorkflowRun) => {
    const existing = nodes.find(
      (node) => node.type === "workflow" && (node.data as any)?.runId === run.id
    );
    if (existing) {
      focusNode(existing.id);
      return;
    }
    const derivedId = `workflow-${run.id}`;
    const newNode: Node<ArtifactData> = {
      id: derivedId,
      type: "workflow" as const,
      position: { x: x + 420, y },
      data: {
        label: run.workflowId ?? "Workflow",
        title: run.workflowId ?? "Workflow",
        description: run.summary ?? undefined,
        status: run.status,
        runId: run.id,
        messages: [],
      },
    };
    addArtifact(newNode);
    focusNode(derivedId);
  };

  const spawnNewWorkflow = () => {
    const node = createSpawnNode("workflow", nodes.length);
    if (!node) return;
    addArtifact(node);
    focusNode(node.id);
  };

  const sortedWorkflows = useMemo(() => {
    return [...workflows].sort((a, b) => {
      const timeA = a.startedAt ? new Date(a.startedAt).getTime() : 0;
      const timeB = b.startedAt ? new Date(b.startedAt).getTime() : 0;
      return timeB - timeA;
    });
  }, [workflows]);

  return (
    <>
      <MindscapeNode
        className="w-[420px] border-white/10 bg-void-surface/30"
        headerActions={<ListChecks className="h-4 w-4 text-biolum" />}
        id={id}
        selected={selected}
        title="Workflows"
      >
        <div className="flex flex-col gap-3 p-4">
          <div className="flex items-center justify-between gap-2">
            <Select value={statusFilter} onValueChange={(value) => handleFilterChange(value as WorkflowStatusFilter)}>
              <SelectTrigger className="min-w-[140px]" size="sm">
                <SelectValue placeholder="Filter" />
              </SelectTrigger>
              <SelectContent>
                {statusOptions.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option === "all" ? "All" : option.charAt(0).toUpperCase() + option.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" variant="outline" onClick={() => utils.workflow.listRuns.invalidate()}>
              Refresh
            </Button>
            <Button size="sm" className="gap-1" onClick={spawnNewWorkflow}>
              <PlusCircle className="h-4 w-4" /> New Run
            </Button>
          </div>

          <ScrollArea className="h-[240px] rounded-lg border border-white/5">
            {workflowsQuery.isLoading ? (
              <p className="p-4 text-center text-sm text-biolum-faint">Loading workflows…</p>
            ) : sortedWorkflows.length === 0 ? (
              <p className="p-4 text-center text-sm text-biolum-faint">No runs in this filter.</p>
            ) : (
              <ul className="divide-y divide-white/5">
                {sortedWorkflows.map((workflow) => (
                  <li className="flex flex-col gap-2 p-3" key={workflow.id}>
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="text-biolum text-sm font-semibold">
                          {workflow.workflowId ?? workflow.id.slice(0, 8)}
                        </p>
                        <p className="text-biolum-faint text-xs">
                          {workflow.startedAt
                            ? new Date(workflow.startedAt).toLocaleString()
                            : "Scheduled"}
                        </p>
                      </div>
                      <BiolumBadge variant={statusVariants[workflow.status] ?? "default"}>
                        {workflow.status}
                      </BiolumBadge>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-biolum-faint">
                      <span>Run ID: {workflow.id.slice(0, 10)}</span>
                      {workflow.completedAt && (
                        <span>
                          • Finished {new Date(workflow.completedAt).toLocaleTimeString()}
                        </span>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => focusWorkflowNode(workflow)}
                      >
                        Open in Mindscape
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setDetailRun(workflow);
                          setDetailOpen(true);
                        }}
                      >
                        Inspect
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </ScrollArea>
        </div>
      </MindscapeNode>

      <WorkflowDetailModal
        open={detailOpen}
        workflow={detailRun}
        onClose={() => setDetailOpen(false)}
      />
    </>
  );
}
