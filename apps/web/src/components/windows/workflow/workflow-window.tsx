import type { AssistantUIMessage } from "@alfred/agent";
import { type StructuredPlan, structuredPlanSchema } from "@alfred/plan";
import type { NodeProps } from "@xyflow/react";
import {
  Check,
  CheckCircle,
  LayoutGrid,
  List,
  Loader2,
  RefreshCw,
  Workflow,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  SmallCard,
  TinyDot,
  useLOD,
  WindowFrame,
} from "@/components/windows/shared";
import { deriveActions } from "@/hooks/use-assistant-stream";
import { authClient } from "@/lib/auth-client";
import { useDesktopStore } from "@/store/desktop";
import { trpc } from "@/utils/trpc";
import { WorkflowCanvas } from "./workflow-canvas";

type AutoLevel = "read" | "low" | "medium" | "high";

const autoOptions: AutoLevel[] = ["read", "low", "medium", "high"];

const workflowWindowDataSchema = z.object({
  type: z.literal("workflow"),
  label: z.string().optional(),
  resourceRef: z
    .object({
      type: z.literal("workflow_run"),
      id: z.string(),
    })
    .optional(),
  viewMode: z.enum(["compact", "full", "maximized"]).default("full"),
  requirement: z.string().optional(),
  auto: z.enum(["read", "low", "medium", "high"]).optional(),
  mode: z.enum(["sequential", "parallel"]).optional(),
  status: z.string().optional(),
  messages: z.array(z.unknown()).optional(),
  runId: z.string().optional(),
  plan: structuredPlanSchema.optional(),
  activeView: z.enum(["list", "canvas"]).default("list").optional(),
});

export function WorkflowWindow({ id, data, selected }: NodeProps) {
  const lod = useLOD();

  const parsed = workflowWindowDataSchema.safeParse(data);
  const windowData = parsed.success
    ? parsed.data
    : { type: "workflow" as const, viewMode: "full" as const };

  const messages = (windowData.messages ?? []) as AssistantUIMessage[];
  const status = windowData.status ?? "Idle";
  const hasRun = Boolean(windowData.runId || windowData.resourceRef?.id);
  const plan = windowData.plan as StructuredPlan | undefined;
  const activeView = windowData.activeView ?? "list";

  const [requirementDraft, setRequirementDraft] = useState(
    windowData.requirement ?? ""
  );
  const [autoLevel, setAutoLevel] = useState<AutoLevel>(
    windowData.auto ?? "low"
  );
  const [mode, setMode] = useState<"sequential" | "parallel">(
    windowData.mode ?? "sequential"
  );

  const { data: session } = authClient.useSession();
  const updateWindow = useDesktopStore((s) => s.updateWindow);

  const generatePlan = trpc.plan.generate.useMutation({
    onSuccess: (generatedPlan) => {
      updateWindow(id, {
        plan: generatedPlan,
        activeView: "canvas",
      });
      toast.success("Plan generated successfully");
    },
    onError: (error) => {
      toast.error(`Failed to generate plan: ${error.message}`);
    },
  });

  const handleGenerate = (event?: React.FormEvent) => {
    event?.preventDefault();
    if (!requirementDraft.trim()) {
      toast.error("Requirement is required");
      return;
    }

    if (!session?.user?.id) {
      toast.error("User session required");
      return;
    }

    generatePlan.mutate({
      intent: {
        id: crypto.randomUUID(),
        description: requirementDraft.trim(),
        source: "chat",
        userId: session.user.id,
        timestamp: new Date(),
        context: {
          existingPatterns: [],
          constraints: [],
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
        preferParallel: mode === "parallel",
      },
    });
  };

  const approvePlan = trpc.plan.approve.useMutation({
    onSuccess: (result) => {
      updateWindow(id, {
        runId: result.runId,
        status: "running",
        activeView: "list",
      });
      toast.success("Plan approved. Execution started.");
    },
    onError: (error) => {
      toast.error(`Failed to approve plan: ${error.message}`);
    },
  });

  const rejectPlan = trpc.plan.reject.useMutation({
    onSuccess: () => {
      updateWindow(id, {
        plan: null,
        activeView: "list",
      });
      toast.info("Plan rejected.");
    },
    onError: (error) => {
      toast.error(`Failed to reject plan: ${error.message}`);
    },
  });

  const handleApprove = () => {
    if (!plan) {
      return;
    }
    approvePlan.mutate({ planId: plan.id });
  };

  const handleReject = () => {
    if (!plan) {
      return;
    }
    rejectPlan.mutate({ planId: plan.id });
  };

  const handleRevise = () => {
    // For now, just regenerate. Ideally we'd pass feedback.
    handleGenerate();
  };

  const toggleView = () => {
    updateWindow(id, {
      activeView: activeView === "list" ? "canvas" : "list",
    });
  };

  const handlePlanChange = (updatedPlan: StructuredPlan) => {
    updateWindow(id, {
      plan: updatedPlan,
    });
  };

  useEffect(() => {
    if (windowData.requirement && windowData.requirement !== requirementDraft) {
      setRequirementDraft(windowData.requirement);
    }
  }, [windowData.requirement, requirementDraft]);

  const actions = useMemo(() => deriveActions(messages), [messages]);
  const activeAction = actions.find((a) => a.status === "running");
  const completedActions = actions.filter((a) => a.status === "completed");

  const handleStart = (event: React.FormEvent) => {
    event.preventDefault();
    if (!requirementDraft.trim()) {
      toast.error("Requirement is required");
      return;
    }
    updateWindow(id, {
      draft: {
        requirement: requirementDraft.trim(),
        auto: autoLevel,
        mode,
        status: "pending",
        title: requirementDraft.trim().slice(0, 64),
        description: requirementDraft.trim(),
        messages: [],
      },
    });
  };

  const statusBadgeClass =
    status === "completed"
      ? "text-emerald-300"
      : status === "failed"
        ? "text-red-400"
        : status === "running"
          ? "text-biolum"
          : "text-biolum-faint";

  if (lod === "tiny") {
    return (
      <TinyDot
        color={status === "running" ? "bg-biolum" : "bg-biolum-dim"}
        shadow={
          status === "running"
            ? "shadow-[0_0_8px_rgba(var(--biolum-rgb),1)] animate-pulse"
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
        icon={
          status === "running" ? (
            <Workflow className="h-3 w-3 animate-spin" />
          ) : (
            <Workflow className="h-3 w-3" />
          )
        }
        label={windowData.label ?? "Workflow"}
        textColor="text-biolum"
      />
    );
  }

  const headerIcon = (
    <div className="flex items-center gap-1">
      {plan && (
        <Button
          className="h-6 w-6 text-biolum-dim hover:text-biolum"
          onClick={toggleView}
          size="icon"
          title={activeView === "list" ? "Switch to Canvas" : "Switch to List"}
          variant="ghost"
        >
          {activeView === "list" ? (
            <LayoutGrid className="h-3.5 w-3.5" />
          ) : (
            <List className="h-3.5 w-3.5" />
          )}
        </Button>
      )}
      <Workflow
        className={`h-4 w-4 ${status === "running" ? "animate-spin text-biolum" : "text-biolum-dim"}`}
      />
    </div>
  );

  return (
    <WindowFrame
      actions={headerIcon}
      height={activeView === "canvas" ? 600 : undefined}
      id={id}
      selected={selected}
      title={windowData.label ?? "Workflow"}
      width={activeView === "canvas" ? 800 : 480}
      windowType="workflow"
    >
      <div className="relative flex h-full flex-col overflow-hidden">
        {activeView === "canvas" && plan ? (
          <div className="min-h-0 flex-1">
            <WorkflowCanvas onPlanChange={handlePlanChange} plan={plan} />

            {!hasRun && (
              <div className="-translate-x-1/2 fade-in slide-in-from-bottom-4 absolute bottom-4 left-1/2 flex animate-in items-center gap-2 rounded-xl border border-white/10 bg-void-surface/80 p-2 shadow-2xl backdrop-blur-xl duration-300">
                <Button
                  className="h-9 px-4 font-bold text-red-400 text-xs uppercase tracking-widest hover:bg-red-400/10 hover:text-red-300"
                  disabled={rejectPlan.isPending}
                  onClick={handleReject}
                  size="sm"
                  variant="ghost"
                >
                  <X className="mr-2 h-3.5 w-3.5" />
                  Discard
                </Button>
                <div className="h-4 w-px bg-white/10" />
                <Button
                  className="h-9 px-4 font-bold text-biolum-dim text-xs uppercase tracking-widest hover:bg-biolum/10 hover:text-biolum"
                  disabled={generatePlan.isPending}
                  onClick={handleRevise}
                  size="sm"
                  variant="ghost"
                >
                  <RefreshCw
                    className={`mr-2 h-3.5 w-3.5 ${generatePlan.isPending ? "animate-spin" : ""}`}
                  />
                  Iterate
                </Button>
                <Button
                  className="h-9 rounded-lg bg-biolum px-6 font-black text-void text-xs uppercase tracking-widest shadow-[0_0_20px_rgba(var(--biolum-rgb),0.4)] hover:bg-biolum-bright"
                  disabled={approvePlan.isPending}
                  onClick={handleApprove}
                  size="sm"
                >
                  {approvePlan.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Check className="mr-2 h-3.5 w-3.5" />
                  )}
                  Approve Plan
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-3 p-4">
            {hasRun ? (
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className={`font-medium text-sm ${statusBadgeClass}`}>
                    {status}
                  </span>
                  {windowData.requirement && (
                    <span className="max-w-[200px] truncate text-biolum-faint text-xs">
                      {windowData.requirement}
                    </span>
                  )}
                </div>
                <ScrollArea className="h-[250px]">
                  <div className="space-y-2">
                    {completedActions.map((action) => (
                      <div
                        className="flex items-start gap-2 rounded border border-white/10 bg-white/5 p-2"
                        key={action.id}
                      >
                        <CheckCircle className="mt-0.5 h-4 w-4 text-emerald-400" />
                        <div className="flex-1">
                          <div className="font-medium text-sm text-white">
                            {action.name}
                          </div>
                        </div>
                      </div>
                    ))}
                    {activeAction && (
                      <div className="flex items-start gap-2 rounded border border-biolum/30 bg-biolum/10 p-2">
                        <Loader2 className="mt-0.5 h-4 w-4 animate-spin text-biolum" />
                        <div className="flex-1">
                          <div className="font-medium text-sm text-white">
                            {activeAction.name}
                          </div>
                          <div className="mt-1 text-biolum-dim text-xs">
                            Running...
                          </div>
                        </div>
                      </div>
                    )}
                    {actions.length === 0 && (
                      <div className="py-4 text-center text-biolum-faint text-sm">
                        {status === "pending"
                          ? "Waiting to start..."
                          : "No actions yet"}
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </div>
            ) : (
              <form className="flex flex-col gap-3" onSubmit={handleStart}>
                <Textarea
                  className="min-h-[100px] resize-none"
                  onChange={(e) => setRequirementDraft(e.target.value)}
                  placeholder="What should the workflow accomplish?"
                  value={requirementDraft}
                />
                <div className="flex items-center gap-2">
                  <Select
                    onValueChange={(v) => setAutoLevel(v as AutoLevel)}
                    value={autoLevel}
                  >
                    <SelectTrigger className="w-[100px]">
                      <SelectValue placeholder="Auto" />
                    </SelectTrigger>
                    <SelectContent>
                      {autoOptions.map((opt) => (
                        <SelectItem key={opt} value={opt}>
                          {opt.charAt(0).toUpperCase() + opt.slice(1)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    onValueChange={(v) =>
                      setMode(v as "sequential" | "parallel")
                    }
                    value={mode}
                  >
                    <SelectTrigger className="w-[110px]">
                      <SelectValue placeholder="Mode" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sequential">Sequential</SelectItem>
                      <SelectItem value="parallel">Parallel</SelectItem>
                    </SelectContent>
                  </Select>
                  <div className="flex-1" />
                  <div className="flex gap-2">
                    <Button
                      disabled={generatePlan.isPending}
                      onClick={handleGenerate}
                      size="sm"
                      type="button"
                      variant="outline"
                    >
                      {generatePlan.isPending ? (
                        <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                      ) : (
                        <LayoutGrid className="mr-2 h-3 w-3" />
                      )}
                      Generate Plan
                    </Button>
                    <Button size="sm" type="submit">
                      Start
                    </Button>
                  </div>
                </div>
              </form>
            )}
          </div>
        )}
      </div>
    </WindowFrame>
  );
}
