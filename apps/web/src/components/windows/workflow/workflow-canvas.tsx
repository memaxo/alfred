import React, { useMemo, useCallback, useState } from 'react';
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  useNodesState,
  useEdgesState,
  Panel,
  Handle,
  Position,
  addEdge,
  type Connection,
  type Node,
  type Edge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { type StructuredPlan, type Phase } from '@alfred/plan';
import { Plus, X, Settings2, Shield, Search, Terminal, Brain, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface WorkflowCanvasProps {
  plan: StructuredPlan;
  onPlanChange?: (plan: StructuredPlan) => void;
}

const AGENT_ICONS = {
  codex: <Terminal className="w-3 h-3" />,
  research: <Search className="w-3 h-3" />,
  review: <Shield className="w-3 h-3" />,
  orchestrator: <Brain className="w-3 h-3" />,
  droid: <Zap className="w-3 h-3" />,
  'claude-code': <Terminal className="w-3 h-3" />,
};

const PhaseNode = ({ data, selected }: { data: Phase; selected?: boolean }) => {
  return (
    <div className={`rounded-xl border ${selected ? 'border-biolum shadow-[0_0_15px_rgba(var(--biolum-rgb),0.3)]' : 'border-white/10'} bg-void-surface/80 p-4 shadow-xl backdrop-blur-md min-w-[220px] group hover:border-biolum/40 transition-all relative`}>
      <Handle type="target" position={Position.Top} className="w-2 h-2 bg-biolum border-none" />
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-1.5 bg-biolum/10 px-1.5 py-0.5 rounded">
            <span className="text-biolum capitalize">
              {AGENT_ICONS[data.agentType as keyof typeof AGENT_ICONS] ?? AGENT_ICONS.codex}
            </span>
            <span className="font-bold text-biolum tracking-tighter text-[10px] uppercase">
              {data.agentType}
            </span>
          </div>
          <span className="text-[10px] text-biolum-faint tabular-nums">
            {Math.round(data.estimatedDurationMs / 1000)}s
          </span>
        </div>
        <h3 className="font-semibold text-white text-sm leading-tight mt-1 truncate">
          {data.name}
        </h3>
        <p className="text-biolum-dim text-[10px] line-clamp-2 mt-1 opacity-70 group-hover:opacity-100 transition-opacity">
          {data.description}
        </p>
        <div className="mt-2 flex items-center gap-2">
          <div className="h-1 flex-1 bg-white/5 rounded-full overflow-hidden">
            <div className="h-full bg-biolum w-0" />
          </div>
          <span className="text-[10px] text-biolum-dim">0%</span>
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} className="w-2 h-2 bg-biolum border-none" />
    </div>
  );
};

const nodeTypes = {
  phase: PhaseNode,
};

export function WorkflowCanvas({ plan, onPlanChange }: WorkflowCanvasProps) {
  const [selectedPhaseId, setSelectedPhaseId] = useState<string | null>(null);

  const initialNodes: Node[] = useMemo(() => {
    return plan.phases.map((phase, index) => ({
      id: phase.id,
      type: 'phase',
      data: phase,
      position: { x: 250, y: index * 150 },
    }));
  }, [plan.phases]);

  const initialEdges: Edge[] = useMemo(() => {
    const edges: Edge[] = [];
    for (const phase of plan.phases) {
      for (const depId of phase.dependsOn) {
        edges.push({
          id: `${depId}-${phase.id}`,
          source: depId,
          target: phase.id,
          animated: true,
          style: { stroke: 'var(--color-biolum)', strokeWidth: 2, opacity: 0.5 },
        });
      }
    }
    return edges;
  }, [plan.phases]);

  const [nodes, _setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedPhaseId(node.id);
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedPhaseId(null);
  }, []);

  const onConnect = useCallback(
    (params: Connection) => {
      setEdges((eds) => {
        const newEdges = addEdge({ ...params, animated: true, style: { stroke: 'var(--color-biolum)', strokeWidth: 2, opacity: 0.5 } }, eds);
        
        if (onPlanChange) {
          const updatedPhases = plan.phases.map(phase => {
            if (phase.id === params.target) {
              const deps = new Set([...phase.dependsOn, params.source!]);
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

  const onEdgeDelete = useCallback((deletedEdges: Edge[]) => {
    if (onPlanChange) {
      const deletedTargets = new Set(deletedEdges.map(e => e.target));
      const updatedPhases = plan.phases.map(phase => {
        if (deletedTargets.has(phase.id)) {
          const removedSources = new Set(deletedEdges.filter(e => e.target === phase.id).map(e => e.source));
          const deps = phase.dependsOn.filter(d => !removedSources.has(d));
          return { ...phase, dependsOn: deps };
        }
        return phase;
      });
      onPlanChange({ ...plan, phases: updatedPhases });
    }
  }, [onPlanChange, plan]);

  const onNodesDelete = useCallback((deletedNodes: Node[]) => {
    if (onPlanChange) {
      const deletedIds = new Set(deletedNodes.map(n => n.id));
      const updatedPhases = plan.phases
        .filter(p => !deletedIds.has(p.id))
        .map(p => ({
          ...p,
          dependsOn: p.dependsOn.filter(d => !deletedIds.has(d))
        }));
      onPlanChange({ ...plan, phases: updatedPhases });
      if (selectedPhaseId && deletedIds.has(selectedPhaseId)) {
        setSelectedPhaseId(null);
      }
    }
  }, [onPlanChange, plan, selectedPhaseId]);

  const addPhase = useCallback(() => {
    if (!onPlanChange) return;
    
    const newId = `phase-${Date.now()}`;
    const newPhase: Phase = {
      id: newId,
      name: 'New Phase',
      description: 'Describe the phase objectives...',
      agentType: 'codex',
      tasks: [],
      dependsOn: [],
      estimatedDurationMs: 60000,
    };

    onPlanChange({
      ...plan,
      phases: [...plan.phases, newPhase],
    });
  }, [onPlanChange, plan]);

  const updatePhase = useCallback((id: string, patch: Partial<Phase>) => {
    if (!onPlanChange) return;
    const updatedPhases = plan.phases.map(p => p.id === id ? { ...p, ...patch } : p);
    onPlanChange({ ...plan, phases: updatedPhases });
  }, [onPlanChange, plan]);

  const selectedPhase = useMemo(() => 
    plan.phases.find(p => p.id === selectedPhaseId),
    [plan.phases, selectedPhaseId]
  );

  return (
    <div className="w-full h-full min-h-[400px] bg-void relative flex">
      <div className="flex-1 relative">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onEdgesDelete={onEdgeDelete}
          onNodesDelete={onNodesDelete}
          onNodeClick={onNodeClick}
          onPaneClick={onPaneClick}
          nodeTypes={nodeTypes}
          fitView
        >
          <Background color="#222" gap={20} variant={BackgroundVariant.Dots} />
          <Controls showInteractive={false} className="bg-void-surface border-white/10" />
          <Panel position="top-right" className="flex flex-col gap-2">
            <div className="bg-void-surface/60 backdrop-blur-md border border-white/10 p-2 rounded-lg flex items-center gap-3 px-3 shadow-2xl">
               <div className="flex items-center gap-1.5">
                 <div className="w-2 h-2 rounded-full bg-biolum animate-pulse" />
                 <span className="text-white font-medium text-[10px] uppercase tracking-wider tabular-nums">Phased Planning</span>
               </div>
               <div className="w-px h-3 bg-white/10" />
               <span className="text-biolum-dim font-medium text-[10px] uppercase tracking-wider">{plan.phases.length} Phases</span>
            </div>
            <Button 
              size="sm" 
              className="bg-biolum/20 hover:bg-biolum/30 text-biolum border border-biolum/30 h-8 text-[10px] uppercase tracking-widest font-bold shadow-lg"
              onClick={addPhase}
            >
              <Plus className="w-3 h-3 mr-1" /> Add Phase
            </Button>
          </Panel>
        </ReactFlow>
      </div>

      {selectedPhase && (
        <div className="w-72 bg-void-surface/95 border-l border-white/10 backdrop-blur-xl p-4 flex flex-col gap-4 animate-in slide-in-from-right duration-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-biolum font-bold text-xs uppercase tracking-widest">
              <Settings2 className="w-3 h-3" />
              Edit Phase
            </div>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setSelectedPhaseId(null)}>
              <X className="w-3 h-3" />
            </Button>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] uppercase text-biolum-dim font-bold tracking-widest ml-1">Name</label>
            <Input 
              value={selectedPhase.name} 
              onChange={(e) => updatePhase(selectedPhase.id, { name: e.target.value })}
              className="bg-white/5 border-white/10 text-sm h-8"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] uppercase text-biolum-dim font-bold tracking-widest ml-1">Agent Type</label>
            <Select 
              value={selectedPhase.agentType} 
              onValueChange={(v) => updatePhase(selectedPhase.id, { agentType: v as Phase['agentType'] })}
            >
              <SelectTrigger className="bg-white/5 border-white/10 text-sm h-8">
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
            <label className="text-[10px] uppercase text-biolum-dim font-bold tracking-widest ml-1">Description</label>
            <Textarea 
              value={selectedPhase.description} 
              onChange={(e) => updatePhase(selectedPhase.id, { description: e.target.value })}
              className="bg-white/5 border-white/10 text-[11px] min-h-[80px] resize-none"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] uppercase text-biolum-dim font-bold tracking-widest ml-1">Duration (ms)</label>
            <Input 
              type="number"
              value={selectedPhase.estimatedDurationMs} 
              onChange={(e) => updatePhase(selectedPhase.id, { estimatedDurationMs: parseInt(e.target.value) || 0 })}
              className="bg-white/5 border-white/10 text-sm h-8"
            />
          </div>

          <div className="mt-auto border-t border-white/5 pt-4">
             <div className="flex flex-col gap-2">
               <span className="text-[10px] uppercase text-biolum-dim font-bold tracking-widest ml-1">Tasks</span>
               <div className="text-[10px] text-white/40 italic ml-1">
                 {selectedPhase.tasks.length} subtasks assigned to this phase.
               </div>
             </div>
          </div>
        </div>
      )}
    </div>
  );
}
