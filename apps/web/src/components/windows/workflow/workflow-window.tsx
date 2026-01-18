import { type StructuredPlan, structuredPlanSchema } from "@alfred/plan";
import { useStore } from "@tanstack/react-form";
import type { NodeProps } from "@xyflow/react";
import {
  Check,
  LayoutGrid,
  List,
  Loader2,
  RefreshCw,
  Workflow,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
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
import { useAppForm, useSubmitInvalidFocus } from "@/form";
import { useFocusedContext } from "@/hooks/use-focused-context";
import {
  useWorkflowSubscription,
  type WorkflowStep,
} from "@/hooks/use-workflow-subscription";
import { authClient } from "@/lib/auth-client";
import { useDesktopStore } from "@/store/desktop";
import { trpc } from "@/utils/trpc";
import { ExecutionPanel } from "./execution-panel";
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
  steps: z.array(z.any()).optional(),
  executionStartTime: z.number().optional(),
  lastEventTime: z.number().optional(),
});

export function WorkflowWindow({ id, data, selected }: NodeProps) {
  const lod = useLOD();

  const parsed = workflowWindowDataSchema.safeParse(data);
  const windowData = parsed.success
    ? parsed.data
    : { type: "workflow" as const, viewMode: "full" as const };

  const status = windowData.status ?? "Idle";
  const hasRun = Boolean(windowData.runId || windowData.resourceRef?.id);
  const plan = windowData.plan as StructuredPlan | undefined;
  const activeView = windowData.activeView ?? "list";

  const [autoLevel, setAutoLevel] = useState<AutoLevel>(
    windowData.auto ?? "low"
  );
  const [mode, setMode] = useState<"sequential" | "parallel">(
    windowData.mode ?? "sequential"
  );

  const { content, nodeType } = useFocusedContext();
  const { data: session } = authClient.useSession();
  const updateWindowData = useDesktopStore((s) => s.updateWindowData);

  const { ref, onSubmitInvalid } = useSubmitInvalidFocus();
  const startForm = useAppForm({
    defaultValues: {
      requirement: windowData.requirement ?? "",
    },
    onSubmitInvalid,
    validators: {
      onSubmit: z.object({
        requirement: z.string().refine((value) => value.trim().length > 0, {
          message: "Requirement is required",
        }),
      }),
    },
    onSubmit: ({ value }) => {
      const trimmed = value.requirement.trim();
      if (!trimmed) {
        toast.error("Requirement is required");
        return;
      }
      updateWindowData(id, {
        draft: {
          requirement: trimmed,
          auto: autoLevel,
          mode,
          status: "pending",
          title: trimmed.slice(0, 64),
          description: trimmed,
          messages: [],
        },
      });
    },
  });

  const requirement = useStore(startForm.store, (s) => s.values.requirement);

  const {
    run,
    stop,
    steps: currentSteps,
    status: runStatus,
    error: runError,
  } = useWorkflowSubscription({
    onWindowUpdate: (update) => {
      updateWindowData(id, update);
    },
    onError: (err) => {
      toast.error(`Workflow failed: ${err.message}`);
    },
  });

  const generatePlan = trpc.plan.generate.useMutation({
    onSuccess: (generatedPlan) => {
      updateWindowData(id, {
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
    if (!requirement.trim()) {
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
        description: requirement.trim(),
        source: "chat",
        userId: session.user.id,
        timestamp: new Date(),
        context: {
          existingPatterns: [],
          constraints: [],
          focusedContent: content,
          focusedNodeType: nodeType,
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
      updateWindowData(id, {
        runId: result.runId,
        status: "running",
        activeView: "list",
      });

      // Start execution subscription
      run({
        requirement: requirement.trim(),
        runId: result.runId,
        auto: autoLevel,
        mode,
        projectId: windowData.resourceRef?.id,
        planId: plan?.id,
      });

      toast.success("Plan approved. Execution started.");
    },
    onError: (error) => {
      toast.error(`Failed to approve plan: ${error.message}`);
    },
  });

  const rejectPlan = trpc.plan.reject.useMutation({
    onSuccess: () => {
      updateWindowData(id, {
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
    updateWindowData(id, {
      activeView: activeView === "list" ? "canvas" : "list",
    });
  };

  const handlePlanChange = (updatedPlan: StructuredPlan) => {
    updateWindowData(id, {
      plan: updatedPlan,
    });
  };

  useEffect(() => {
    if (windowData.requirement && windowData.requirement !== requirement) {
      startForm.setFieldValue("requirement", windowData.requirement);
    } else if (!requirement && content) {
      // Pre-populate from focused context if empty
      startForm.setFieldValue("requirement", content.slice(0, 500));
    }
  }, [windowData.requirement, requirement, content, startForm]);

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
              <ExecutionPanel
                className="h-[300px]"
                error={runError}
                isRunning={
                  runStatus === "running" || runStatus === "connecting"
                }
                onClose={() => {}}
                onStop={stop}
                steps={
                  currentSteps.length > 0
                    ? currentSteps
                    : ((windowData.steps as WorkflowStep[]) ?? [])
                }
              />
            ) : (
              <startForm.AppForm>
                <form
                  className="flex flex-col gap-3"
                  onSubmit={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    void startForm.handleSubmit();
                  }}
                  ref={ref}
                >
                  <startForm.AppField name="requirement">
                    {(field) => (
                      <Textarea
                        aria-invalid={field.state.meta.errors.length > 0}
                        className="min-h-[100px] resize-none"
                        onBlur={field.handleBlur}
                        onChange={(e) => field.handleChange(e.target.value)}
                        placeholder="What should the workflow accomplish?"
                        value={field.state.value}
                      />
                    )}
                  </startForm.AppField>
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
              </startForm.AppForm>
            )}
          </div>
        )}
      </div>
    </WindowFrame>
  );
}
