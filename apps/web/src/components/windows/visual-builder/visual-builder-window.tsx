/**
 * Visual Builder Canvas Component
 *
 * Interactive React Flow canvas for building and editing workflow plans.
 * Integrates with ALFRED's plan generation system and desktop window management.
 */

"use client";

import {
  addEdge,
  Background,
  BackgroundVariant,
  type Connection,
  Controls,
  type Edge,
  type Node,
  ReactFlow,
  useEdgesState,
  useNodesState,
} from "@xyflow/react";
import {
  CheckCircle,
  Clock,
  Download,
  GitBranch,
  Play,
  Upload,
  Zap,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import type { WindowComponentProps } from "@/components/desktop/windows/types";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { trpc } from "@/utils/trpc";

import "@xyflow/react/dist/style.css";

// Custom node types for the visual builder
const nodeTypes = {
  phase: PhaseNode,
  step: StepNode,
  dependency: DependencyNode,
};

interface PhaseData {
  title: string;
  status: string;
  description: string;
}

interface StepData {
  title: string;
  agent: string;
  description: string;
}

interface DependencyData {
  label: string;
}

// Phase node component
function PhaseNode({ data }: { data: PhaseData }) {
  return (
    <Card className="min-w-[200px] border-2 border-purple-500/20 bg-purple-50/50 dark:bg-purple-950/50">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <GitBranch className="h-4 w-4 text-purple-600" />
          {data.title}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-1">
          <Badge className="text-xs" variant="outline">
            {data.status}
          </Badge>
          <p className="text-muted-foreground text-xs">{data.description}</p>
        </div>
      </CardContent>
    </Card>
  );
}

// Step node component
function StepNode({ data }: { data: StepData }) {
  return (
    <Card className="min-w-[180px] border border-blue-500/20 bg-blue-50/50 dark:bg-blue-950/50">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Zap className="h-3 w-3 text-blue-600" />
          {data.title}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-1">
          <Badge className="text-xs" variant="secondary">
            {data.agent}
          </Badge>
          <p className="text-muted-foreground text-xs">{data.description}</p>
        </div>
      </CardContent>
    </Card>
  );
}

// Dependency node component
function DependencyNode({ data }: { data: DependencyData }) {
  return (
    <div className="rounded border bg-gray-100 px-2 py-1 text-xs dark:bg-gray-800">
      {data.label}
    </div>
  );
}

// Tool panel component
function ToolPanel({
  onGeneratePlan,
  onLoadPlan,
  onSavePlan,
  isGenerating,
}: {
  onGeneratePlan: (intent: string) => void;
  onLoadPlan: () => void;
  onSavePlan: () => void;
  isGenerating: boolean;
}) {
  const [intent, setIntent] = useState("");

  return (
    <div className="space-y-4">
      <div>
        <h3 className="mb-2 font-medium text-sm">Quick Actions</h3>
        <div className="space-y-2">
          <Input
            className="h-8 text-xs"
            disabled={isGenerating}
            onChange={(e) => setIntent(e.target.value)}
            placeholder="Enter intent..."
            value={intent}
          />
          <Button
            className="w-full"
            disabled={!intent || isGenerating}
            onClick={() => onGeneratePlan(intent)}
            size="sm"
          >
            {isGenerating ? (
              <>
                <Clock className="mr-2 h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Play className="mr-2 h-4 w-4" />
                Generate Plan
              </>
            )}
          </Button>
          <div className="grid grid-cols-2 gap-2">
            <Button onClick={onLoadPlan} size="sm" variant="outline">
              <Upload className="mr-1 h-4 w-4" />
              Load
            </Button>
            <Button onClick={onSavePlan} size="sm" variant="outline">
              <Download className="mr-1 h-4 w-4" />
              Save
            </Button>
          </div>
        </div>
      </div>

      <Separator />

      <div>
        <h3 className="mb-2 font-medium text-sm">Template Library</h3>
        <div className="space-y-1">
          <Button className="h-8 w-full justify-start text-xs" variant="ghost">
            <GitBranch className="mr-2 h-3 w-3" />
            Feature Development
          </Button>
          <Button className="h-8 w-full justify-start text-xs" variant="ghost">
            <Zap className="mr-2 h-3 w-3" />
            Bug Investigation
          </Button>
          <Button className="h-8 w-full justify-start text-xs" variant="ghost">
            <Clock className="mr-2 h-3 w-3" />
            Code Review
          </Button>
        </div>
      </div>

      <Separator />

      <div>
        <h3 className="mb-2 font-medium text-sm">Pattern Suggestions</h3>
        <div className="space-y-2">
          <div className="rounded border border-green-200 bg-green-50 p-2 dark:border-green-800 dark:bg-green-950">
            <div className="mb-1 flex items-center gap-2">
              <CheckCircle className="h-3 w-3 text-green-600" />
              <Badge className="text-xs" variant="secondary">
                95% match
              </Badge>
            </div>
            <p className="text-muted-foreground text-xs">
              React component pattern
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// Properties panel component
function PropertiesPanel({ selectedNode }: { selectedNode: Node | null }) {
  if (!selectedNode) {
    return (
      <div className="py-8 text-center text-muted-foreground">
        <div className="text-sm">No node selected</div>
        <div className="mt-1 text-xs">Click on a node to edit properties</div>
      </div>
    );
  }

  // oxlint-disable noExplicitAny: Internal node data
  const data = selectedNode.data as any;

  return (
    <div className="space-y-4">
      <div>
        <h3 className="mb-2 font-medium text-sm">{data.title || data.label}</h3>
        <div className="space-y-3">
          {data.title !== undefined && (
            <div>
              <label className="font-medium text-muted-foreground text-xs">
                Title
              </label>
              <Input
                className="mt-1 h-8 text-sm"
                placeholder="Node title"
                value={data.title || ""}
              />
            </div>
          )}
          {data.label !== undefined && (
            <div>
              <label className="font-medium text-muted-foreground text-xs">
                Label
              </label>
              <Input
                className="mt-1 h-8 text-sm"
                placeholder="Node label"
                value={data.label || ""}
              />
            </div>
          )}
          {data.description !== undefined && (
            <div>
              <label className="font-medium text-muted-foreground text-xs">
                Description
              </label>
              <Input
                className="mt-1 h-8 text-sm"
                placeholder="Node description"
                value={data.description || ""}
              />
            </div>
          )}
          {selectedNode.type === "step" && (
            <div>
              <label className="font-medium text-muted-foreground text-xs">
                Agent
              </label>
              <Input
                className="mt-1 h-8 text-sm"
                placeholder="Agent type"
                value={data.agent || ""}
              />
            </div>
          )}
        </div>
      </div>

      <Separator />

      <div>
        <h4 className="mb-2 font-medium text-muted-foreground text-xs">
          Metadata
        </h4>
        <div className="space-y-1 text-xs">
          <div className="flex justify-between">
            <span>Type:</span>
            <Badge className="text-xs" variant="outline">
              {selectedNode.type}
            </Badge>
          </div>
          <div className="flex justify-between">
            <span>ID:</span>
            <span className="font-mono">{selectedNode.id.slice(0, 8)}...</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// Main Visual Builder component
export function VisualBuilderWindow(_props: WindowComponentProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  // tRPC mutations
  const generatePlanMutation = trpc.plan.generate.useMutation({
    onSuccess: () => {
      setIsGenerating(false);
      toast.success("Plan generated successfully");
    },
    onError: (error) => {
      setIsGenerating(false);
      toast.error(`Failed to generate plan: ${error.message}`);
    },
  });

  // Generate initial plan from intent
  const generatePlan = useCallback(
    (intentDescription: string) => {
      setIsGenerating(true);
      try {
        generatePlanMutation.mutate({
          intent: {
            id: crypto.randomUUID(),
            description: intentDescription,
            source: "visual-builder",
            userId: "user-id-placeholder",
            timestamp: new Date(),
            context: {
              existingPatterns: [],
              constraints: [],
              focusedContent: null,
              focusedNodeType: null,
            },
          },
          research: {
            external: [],
            internal: {
              existingCode: [],
              patterns: [],
              conventions: [],
            },
            metadata: {
              totalSources: 0,
              tokenCount: 0,
              researchDurationMs: 0,
            },
          },
          options: {
            maxPhases: 5,
            preferParallel: false,
          },
        });
      } catch {
        setIsGenerating(false);
      }
    },
    [generatePlanMutation]
  );

  // Initialize with a sample plan for visualization demo
  useEffect(() => {
    const demoPlan = {
      phases: [
        {
          id: "phase-1",
          title: "Research & Analysis",
          description: "Gather requirements and analyze existing code",
          steps: [
            {
              id: "step-1",
              title: "Code Exploration",
              description: "Explore codebase structure",
              agent: "codex",
            },
            {
              id: "step-2",
              title: "Requirements Analysis",
              description: "Define technical requirements",
              agent: "research",
            },
          ],
        },
        {
          id: "phase-2",
          title: "Implementation",
          description: "Build the solution",
          steps: [
            {
              id: "step-3",
              title: "Core Development",
              description: "Implement main functionality",
              agent: "codex",
            },
            {
              id: "step-4",
              title: "Testing",
              description: "Write and run tests",
              agent: "codex",
            },
          ],
        },
      ],
    };

    // Convert plan to React Flow nodes
    const planNodes: Node[] = [];
    const planEdges: Edge[] = [];

    demoPlan.phases.forEach((phase, phaseIndex) => {
      const phaseX = 100 + phaseIndex * 400;
      const phaseY = 100;

      // Add phase node
      planNodes.push({
        id: phase.id,
        type: "phase",
        position: { x: phaseX, y: phaseY },
        data: {
          title: phase.title,
          description: phase.description,
          status: "pending",
        },
      });

      // Add step nodes
      phase.steps.forEach((step, stepIndex) => {
        const stepX = phaseX + 250;
        const stepY = phaseY + stepIndex * 100;

        planNodes.push({
          id: step.id,
          type: "step",
          position: { x: stepX, y: stepY },
          data: {
            title: step.title,
            description: step.description,
            agent: step.agent,
          },
        });

        // Connect phase to step
        planEdges.push({
          id: `${phase.id}->${step.id}`,
          source: phase.id,
          target: step.id,
          type: "smoothstep",
          className: "stroke-purple-500",
        });

        // Connect steps sequentially
        if (stepIndex > 0) {
          const prevStep = phase.steps[stepIndex - 1];
          if (prevStep) {
            planEdges.push({
              id: `${prevStep.id}->${step.id}`,
              source: prevStep.id,
              target: step.id,
              type: "smoothstep",
              className: "stroke-blue-500",
            });
          }
        }
      });

      // Connect phases sequentially
      if (phaseIndex > 0) {
        const prevPhase = demoPlan.phases[phaseIndex - 1];
        if (prevPhase) {
          const lastStepOfPrevPhase = prevPhase.steps.at(-1);
          const firstStepOfCurrentPhase = phase.steps[0];

          if (lastStepOfPrevPhase && firstStepOfCurrentPhase) {
            planEdges.push({
              id: `${lastStepOfPrevPhase.id}->${firstStepOfCurrentPhase.id}`,
              source: lastStepOfPrevPhase.id,
              target: firstStepOfCurrentPhase.id,
              type: "smoothstep",
              className: "stroke-green-500",
              animated: true,
            });
          }
        }
      }
    });

    setNodes(planNodes);
    setEdges(planEdges);
  }, [setNodes, setEdges]);

  // Handle new connections
  const onConnect = useCallback(
    (params: Connection) => {
      setEdges((eds) => addEdge(params, eds));
    },
    [setEdges]
  );

  // Handle node selection
  const onNodeClick = useCallback((_event: React.MouseEvent, node: Node) => {
    setSelectedNode(node);
  }, []);

  const onSavePlan = useCallback(() => {}, [nodes, edges]);

  const onLoadPlan = useCallback(() => {}, []);

  return (
    <div className="flex h-full">
      {/* Left Tool Panel */}
      <div className="w-64 border-r bg-background/50 p-4">
        <ToolPanel
          isGenerating={isGenerating}
          onGeneratePlan={generatePlan}
          onLoadPlan={onLoadPlan}
          onSavePlan={onSavePlan}
        />
      </div>

      {/* Center Canvas */}
      <div className="relative flex-1">
        <ReactFlow
          className="bg-background"
          edges={edges}
          fitView
          nodes={nodes}
          nodeTypes={nodeTypes}
          onConnect={onConnect}
          onEdgesChange={onEdgesChange}
          onNodeClick={onNodeClick}
          onNodesChange={onNodesChange}
        >
          <Background gap={16} size={1} variant={BackgroundVariant.Dots} />
          <Controls />
        </ReactFlow>
      </div>

      {/* Right Properties Panel */}
      <div className="w-64 border-l bg-background/50 p-4">
        <ScrollArea className="h-full">
          <PropertiesPanel selectedNode={selectedNode} />
        </ScrollArea>
      </div>
    </div>
  );
}
