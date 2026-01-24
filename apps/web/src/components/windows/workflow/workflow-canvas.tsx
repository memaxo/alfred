import type { phaseSchema, structuredPlanSchema } from "@alfred/plan/schema";
import type React from "react";
import type { infer as ZodInfer } from "zod";

import {
  addEdge,
  Background,
  BackgroundVariant,
  type Connection,
  Controls,
  type Edge,
  Handle,
  type Node,
  Panel,
  Position,
  ReactFlow,
  useEdgesState,
  useNodesState,
} from "@xyflow/react";
import {
  Brain,
  Plus,
  Search,
  Settings2,
  Shield,
  Terminal,
  X,
  Zap,
} from "lucide-react";
import "@xyflow/react/dist/style.css";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type Phase = ZodInfer<typeof phaseSchema>;
type StructuredPlan = ZodInfer<typeof structuredPlanSchema>;

type WorkflowCanvasProps = {
  plan: StructuredPlan;
  onPlanChange?: (plan: StructuredPlan) => void;
};

const AGENT_ICONS = {
  codex: <Terminal className="h-3 w-3" />,
  research: <Search className="h-3 w-3" />,
  review: <Shield className="h-3 w-3" />,
  orchestrator: <Brain className="h-3 w-3" />,
  droid: <Zap className="h-3 w-3" />,
  "claude-code": <Terminal className="h-3 w-3" />,
};

const PhaseNode = ({ data, selected }: { data: Phase; selected?: boolean }) => (
  <div
    className={`rounded-xl border ${selected ? "border-biolum shadow-[0_0_15px_rgba(var(--biolum-rgb),0.3)]" : "border-white/10"} group relative min-w-[220px] bg-void-surface/80 p-4 shadow-xl backdrop-blur-md transition-all hover:border-biolum/40`}
  >
    <Handle
      className="h-2 w-2 border-none bg-biolum"
      position={Position.Top}
      type="target"
    />
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-1.5 rounded bg-biolum/10 px-1.5 py-0.5">
          <span className="text-biolum capitalize">
            {AGENT_ICONS[data.agentType as keyof typeof AGENT_ICONS] ??
              AGENT_ICONS.codex}
          </span>
          <span className="font-bold text-[10px] text-biolum uppercase tracking-tighter">
            {data.agentType}
          </span>
        </div>
        <span className="text-[10px] text-biolum-faint tabular-nums">
          {Math.round(data.estimatedDurationMs / 1000)}s
        </span>
      </div>
      <h3 className="mt-1 truncate font-semibold text-sm text-white leading-tight">
        {data.name}
      </h3>
      <p className="mt-1 line-clamp-2 text-[10px] text-biolum-dim opacity-70 transition-opacity group-hover:opacity-100">
        {data.description}
      </p>
      <div className="mt-2 flex items-center gap-2">
        <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/5">
          <div className="h-full w-0 bg-biolum" />
        </div>
        <span className="text-[10px] text-biolum-dim">0%</span>
      </div>
    </div>
    <Handle
      className="h-2 w-2 border-none bg-biolum"
      position={Position.Bottom}
      type="source"
    />
  </div>
);

const nodeTypes = {
  phase: PhaseNode,
};

export function WorkflowCanvas({ plan, onPlanChange }: WorkflowCanvasProps) {
  const [selectedPhaseId, setSelectedPhaseId] = useState<string | null>(null);

  const initialNodes: Node[] = useMemo(
    () =>
      plan.phases.map((phase, index) => ({
        id: phase.id,
        type: "phase",
        data: phase,
        position: { x: 250, y: index * 150 },
      })),
    [plan.phases]
  );

  const initialEdges: Edge[] = useMemo(() => {
    const edges: Edge[] = [];
    for (const phase of plan.phases) {
      for (const depId of phase.dependsOn) {
        edges.push({
          id: `${depId}-${phase.id}`,
          source: depId,
          target: phase.id,
          animated: true,
          style: {
            stroke: "var(--color-biolum)",
            strokeWidth: 2,
            opacity: 0.5,
          },
        });
      }
    }
    return edges;
  }, [plan.phases]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  useEffect(() => {
    setNodes(initialNodes);
    setEdges(initialEdges);
  }, [initialNodes, initialEdges, setNodes, setEdges]);

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedPhaseId(node.id);
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedPhaseId(null);
  }, []);

  const onConnect = useCallback(
    (params: Connection) => {
      setEdges((eds) => {
        const newEdges = addEdge(
          {
            ...params,
            animated: true,
            style: {
              stroke: "var(--color-biolum)",
              strokeWidth: 2,
              opacity: 0.5,
            },
          },
          eds
        );

        if (onPlanChange) {
          const updatedPhases = plan.phases.map((phase) => {
            if (phase.id === params.target && params.source) {
              const deps = new Set([...phase.dependsOn, params.source]);
              return { ...phase, dependsOn: Array.from(deps) };
            }
            return phase;
          });
          onPlanChange({ ...plan, phases: updatedPhases });
        }

        return newEdges;
      });
    },
    [setEdges, onPlanChange, plan]
  );

  const onEdgeDelete = useCallback(
    (deletedEdges: Edge[]) => {
      if (onPlanChange) {
        const deletedTargets = new Set(deletedEdges.map((e) => e.target));
        const updatedPhases = plan.phases.map((phase) => {
          if (deletedTargets.has(phase.id)) {
            const removedSources = new Set(
              deletedEdges
                .filter((e) => e.target === phase.id)
                .map((e) => e.source)
            );
            const deps = phase.dependsOn.filter((d) => !removedSources.has(d));
            return { ...phase, dependsOn: deps };
          }
          return phase;
        });
        onPlanChange({ ...plan, phases: updatedPhases });
      }
    },
    [onPlanChange, plan]
  );

  const onNodesDelete = useCallback(
    (deletedNodes: Node[]) => {
      if (onPlanChange) {
        const deletedIds = new Set(deletedNodes.map((n) => n.id));
        const updatedPhases = plan.phases
          .filter((p) => !deletedIds.has(p.id))
          .map((p) => ({
            ...p,
            dependsOn: p.dependsOn.filter((d) => !deletedIds.has(d)),
          }));
        onPlanChange({ ...plan, phases: updatedPhases });
        if (selectedPhaseId && deletedIds.has(selectedPhaseId)) {
          setSelectedPhaseId(null);
        }
      }
    },
    [onPlanChange, plan, selectedPhaseId]
  );

  const addPhase = useCallback(() => {
    if (!onPlanChange) {
      return;
    }

    const newId = `phase-${Date.now()}`;
    const newPhase: Phase = {
      id: newId,
      name: "New Phase",
      description: "Describe the phase objectives...",
      agentType: "codex",
      tasks: [],
      dependsOn: [],
      estimatedDurationMs: 60_000,
    };

    onPlanChange({
      ...plan,
      phases: [...plan.phases, newPhase],
    });
  }, [onPlanChange, plan]);

  const updatePhase = useCallback(
    (id: string, patch: Partial<Phase>) => {
      if (!onPlanChange) {
        return;
      }
      const updatedPhases = plan.phases.map((p) =>
        p.id === id ? { ...p, ...patch } : p
      );
      onPlanChange({ ...plan, phases: updatedPhases });
    },
    [onPlanChange, plan]
  );

  const selectedPhase = useMemo(
    () => plan.phases.find((p) => p.id === selectedPhaseId),
    [plan.phases, selectedPhaseId]
  );

  return (
    <div className="relative flex h-full min-h-[400px] w-full bg-void">
      <div className="relative flex-1">
        <ReactFlow
          edges={edges}
          fitView
          nodes={nodes}
          nodeTypes={nodeTypes}
          onConnect={onConnect}
          onEdgesChange={onEdgesChange}
          onEdgesDelete={onEdgeDelete}
          onNodeClick={onNodeClick}
          onNodesChange={onNodesChange}
          onNodesDelete={onNodesDelete}
          onPaneClick={onPaneClick}
        >
          <Background color="#222" gap={20} variant={BackgroundVariant.Dots} />
          <Controls
            className="border-white/10 bg-void-surface"
            showInteractive={false}
          />
          <Panel className="flex flex-col gap-2" position="top-right">
            <div className="flex items-center gap-3 rounded-lg border border-white/10 bg-void-surface/60 p-2 px-3 shadow-2xl backdrop-blur-md">
              <div className="flex items-center gap-1.5">
                <div className="h-2 w-2 animate-pulse rounded-full bg-biolum" />
                <span className="font-medium text-[10px] text-white uppercase tabular-nums tracking-wider">
                  Phased Planning
                </span>
              </div>
              <div className="h-3 w-px bg-white/10" />
              <span className="font-medium text-[10px] text-biolum-dim uppercase tracking-wider">
                {plan.phases.length} Phases
              </span>
            </div>
            <Button
              className="h-8 border border-biolum/30 bg-biolum/20 font-bold text-[10px] text-biolum uppercase tracking-widest shadow-lg hover:bg-biolum/30"
              onClick={addPhase}
              size="sm"
            >
              <Plus className="mr-1 h-3 w-3" /> Add Phase
            </Button>
          </Panel>
        </ReactFlow>
      </div>

      {selectedPhase && (
        <div className="slide-in-from-right flex w-72 animate-in flex-col gap-4 border-white/10 border-l bg-void-surface/95 p-4 backdrop-blur-xl duration-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-bold text-biolum text-xs uppercase tracking-widest">
              <Settings2 className="h-3 w-3" />
              Edit Phase
            </div>
            <Button
              className="h-6 w-6"
              onClick={() => setSelectedPhaseId(null)}
              size="icon"
              variant="ghost"
            >
              <X className="h-3 w-3" />
            </Button>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="ml-1 font-bold text-[10px] text-biolum-dim uppercase tracking-widest">
              Name
            </label>
            <Input
              className="h-8 border-white/10 bg-white/5 text-sm"
              onChange={(e) =>
                updatePhase(selectedPhase.id, { name: e.target.value })
              }
              value={selectedPhase.name}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="ml-1 font-bold text-[10px] text-biolum-dim uppercase tracking-widest">
              Agent Type
            </label>
            <Select
              onValueChange={(v) =>
                updatePhase(selectedPhase.id, {
                  agentType: v as Phase["agentType"],
                })
              }
              value={selectedPhase.agentType}
            >
              <SelectTrigger className="h-8 border-white/10 bg-white/5 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="codex">Codex (Coding)</SelectItem>
                <SelectItem value="research">Research</SelectItem>
                <SelectItem value="review">Review</SelectItem>
                <SelectItem value="orchestrator">Orchestrator</SelectItem>
                <SelectItem value="droid">Droid</SelectItem>
                <SelectItem value="claude-code">Claude Code</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="ml-1 font-bold text-[10px] text-biolum-dim uppercase tracking-widest">
              Description
            </label>
            <Textarea
              className="min-h-[80px] resize-none border-white/10 bg-white/5 text-[11px]"
              onChange={(e) =>
                updatePhase(selectedPhase.id, { description: e.target.value })
              }
              value={selectedPhase.description}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="ml-1 font-bold text-[10px] text-biolum-dim uppercase tracking-widest">
              Duration (ms)
            </label>
            <Input
              className="h-8 border-white/10 bg-white/5 text-sm"
              onChange={(e) =>
                updatePhase(selectedPhase.id, {
                  estimatedDurationMs: Number.parseInt(e.target.value, 10) || 0,
                })
              }
              type="number"
              value={selectedPhase.estimatedDurationMs}
            />
          </div>

          <div className="mt-auto border-white/5 border-t pt-4">
            <div className="flex flex-col gap-2">
              <span className="ml-1 font-bold text-[10px] text-biolum-dim uppercase tracking-widest">
                Tasks
              </span>
              <div className="ml-1 text-[10px] text-white/40 italic">
                {selectedPhase.tasks.length} subtasks assigned to this phase.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
