import type { NodeProps } from "@xyflow/react";

import { structuredPlanSchema } from "@alfred/plan/schema";
import { useStore } from "@tanstack/react-form";
import { skipToken } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import {
  Check,
  FileText,
  LayoutGrid,
  List,
  Loader2,
  RefreshCw,
  ScrollText,
  Workflow,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { GenUIErrorBoundary, UISchemaRenderer } from "@/components/genui";
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
import { useWorkflowPlan } from "@/hooks/use-workflow-phase";
import {
  useWorkflowSubscription,
  type WorkflowEscalation,
  type WorkflowStep,
} from "@/hooks/use-workflow-subscription";
import { useDesktopStore } from "@/store/desktop";
import { trpc } from "@/utils/trpc";

import { WorkflowCognitiveBadge } from "./cognitive";
import { CompilationView } from "./compilation-view";
import { EventInspector } from "./event-inspector";
import { ExecutionPanel } from "./execution-panel";
import { RunList } from "./run-list";
import { WorkflowCanvas } from "./workflow-canvas";

type AutoLevel = "read" | "low" | "medium" | "high";

const autoOptions: AutoLevel[] = ["read", "low", "medium", "high"];

type StructuredPlan = z.infer<typeof structuredPlanSchema>;

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
  planId: z.string().optional(),
  plan: structuredPlanSchema.optional(),
  activeView: z
    .enum(["list", "canvas", "compilation", "events", "runs"])
    .default("list")
    .optional(),
  steps: z.array(z.any()).optional(),
  executionStartTime: z.number().optional(),
  lastEventTime: z.number().optional(),
  summaryText: z.string().optional(),
  escalation: z
    .object({
      agentId: z.string(),
      reason: z.string(),
      details: z.string(),
      suggestions: z.array(z.string()).optional(),
      severity: z.enum(["warning", "blocking"]),
      timestamp: z.number(),
    })
    .optional(),
});

export function WorkflowWindow({ id, data, selected }: NodeProps) {
  const lod = useLOD();
  const navigate = useNavigate();

  const parsed = workflowWindowDataSchema.safeParse(data);
  const windowData = parsed.success
    ? parsed.data
    : { type: "workflow" as const, viewMode: "full" as const };

  const status = windowData.status ?? "Idle";
  const runId = windowData.runId ?? windowData.resourceRef?.id;
  const plan = windowData.plan as StructuredPlan | undefined;
  const activeView = windowData.activeView ?? "list";
  const { summaryText } = windowData;
  const escalation = windowData.escalation as WorkflowEscalation | undefined;

  const [autoLevel, setAutoLevel] = useState<AutoLevel>(
    windowData.auto ?? "low"
  );
  const [mode, setMode] = useState<"sequential" | "parallel">(
    windowData.mode ?? "sequential"
  );

  const updateWindowData = useDesktopStore((s) => s.updateWindowData);
  const addNotification = useDesktopStore((s) => s.addNotification);
  const lastNotifiedStatusRef = useRef<string | null>(null);

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
        requirement: trimmed,
        auto: autoLevel,
        mode,
        status: "planning",
        messages: [],
      });
    },
  });

  const requirement = useStore(startForm.store, (s) => s.values.requirement);
  const planRequirement = windowData.requirement ?? requirement;

  const {
    run,
    stop,
    steps: currentSteps,
    status: runStatus,
    error: runError,
    escalation: runEscalation,
  } = useWorkflowSubscription({
    kind: "resume",
    onWindowUpdate: (update) => {
      updateWindowData(id, update);

      const status = typeof update.status === "string" ? update.status : null;
      if (!status || lastNotifiedStatusRef.current === status) {
        return;
      }
      lastNotifiedStatusRef.current = status;

      if (status === "completed") {
        const summary =
          typeof update.summaryText === "string" ? update.summaryText : null;
        addNotification({
          type: "success",
          title: "Workflow completed",
          message: summary ?? planRequirement,
          group: "Workflows",
          actions: [
            {
              label: "Open",
              onClick: () => {
                const s = useDesktopStore.getState();
                s.setMode("desktop");
                s.restoreWindow(id);
                s.focusWindow(id);
              },
            },
          ],
        });
      }

      if (status === "suspended" && update.escalation) {
        const escalation = update.escalation as WorkflowEscalation;
        addNotification({
          type: escalation.severity === "blocking" ? "error" : "warning",
          title:
            escalation.severity === "blocking"
              ? "Workflow needs input"
              : "Workflow escalation",
          message: escalation.details,
          group: "Workflows",
          actions: [
            {
              label: "Open",
              onClick: () => {
                const s = useDesktopStore.getState();
                s.setMode("desktop");
                s.restoreWindow(id);
                s.focusWindow(id);
              },
            },
          ],
        });
      }
    },
    onError: (err) => {
      toast.error(`Workflow failed: ${err.message}`);
      addNotification({
        type: "error",
        title: "Workflow failed",
        message: err.message,
        group: "Workflows",
        actions: [
          {
            label: "Open",
            onClick: () => {
              const s = useDesktopStore.getState();
              s.setMode("desktop");
              s.restoreWindow(id);
              s.focusWindow(id);
            },
          },
        ],
      });
    },
  });

  const planning = useWorkflowPlan({
    requirement: planRequirement,
    onPlanReady: (out) => {
      updateWindowData(id, {
        runId: out.runId,
        planId: out.planId,
        plan: out.structuredPlan as StructuredPlan,
        status: "suspended",
        activeView: "canvas",
      });
      toast.success("Plan ready");
    },
    onError: (err) => {
      updateWindowData(id, { status: "failed" });
      toast.error(`Planning failed: ${err.message}`);
    },
  });
  const planStatus = planning.status;
  const planSteps = planning.steps;
  const startPlanning = planning.start;
  const clearPlanning = planning.clear;

  const approve = trpc.workflow.phase.approveAndExecute.useMutation({
    onSuccess: ({ runId }) => {
      updateWindowData(id, {
        runId,
        status: "running",
        activeView: "list",
        escalation: undefined,
      });
      run({
        runId,
        dryRun: import.meta.env.VITE_TEST_MODE === "true",
      });
      toast.success("Approved. Executing.");
    },
    onError: (err) => {
      toast.error(`Failed to approve: ${err.message}`);
    },
  });

  const updatePlan = trpc.workflow.phase.updatePlan.useMutation({
    onError: (err) => {
      toast.error(`Failed to save edits: ${err.message}`);
    },
  });

  const showExecutionPanel = Boolean(runId) || planStatus !== "idle";

  const genuiSchemas = useMemo(() => {
    if (!runId) {
      return null;
    }

    const steps =
      currentSteps.length > 0
        ? currentSteps
        : ((windowData.steps as WorkflowStep[]) ?? planSteps);

    const phases = steps.map((s) => {
      const status =
        s.status === "completed"
          ? ("completed" as const)
          : s.status === "running"
            ? ("running" as const)
            : s.status === "failed"
              ? ("error" as const)
              : ("pending" as const);

      return {
        id: s.id,
        name: s.name,
        status,
        progress: status === "completed" ? 100 : status === "running" ? 10 : 0,
        tasks: [
          {
            id: s.id,
            name: s.name,
            status,
            duration: typeof s.duration === "number" ? s.duration : undefined,
          },
        ],
      };
    });

    const planSchema = plan
      ? {
          component: "plan",
          props: {
            plan: {
              requirement: plan.intent ?? "",
              tasks: plan.phases.flatMap((p) =>
                p.tasks.map((t) => ({
                  id: t.id,
                  title: t.title,
                  status: "pending" as const,
                }))
              ),
            },
          },
        }
      : null;

    return {
      timeline: {
        component: "workflow-timeline",
        props: {
          workflowId: runId,
          title: plan?.title ?? "Workflow",
          phases,
          elapsed: 0,
        },
      },
      plan: planSchema,
    } as const;
  }, [currentSteps, plan, planSteps, runId, windowData.steps]);

  const persistedPlanQuery = trpc.workflow.phase.getPlan.useQuery(
    runId ? { runId } : skipToken,
    { enabled: Boolean(runId) && !plan }
  );

  // Fetch events for the event inspector
  const eventsQuery = trpc.workflow.events.useQuery(
    runId ? { runId } : skipToken,
    { enabled: Boolean(runId) && activeView === "events" }
  );

  // Fetch runs for the run list
  const runsQuery = trpc.workflow.listRuns.useQuery(
    { limit: 50 },
    { enabled: activeView === "runs" }
  );

  // Cancel mutation for run list actions
  const cancelMutation = trpc.workflow.cancel.useMutation({
    onSuccess: () => {
      toast.success("Workflow cancelled");
      runsQuery.refetch();
    },
    onError: (err) => {
      toast.error(`Failed to cancel: ${err.message}`);
    },
  });

  useEffect(() => {
    const { data } = persistedPlanQuery;
    if (!data || plan) {
      return;
    }
    updateWindowData(id, {
      runId: data.runId,
      planId: data.planId,
      plan: data.structuredPlan as StructuredPlan,
      status: data.snapshot.status,
      activeView: data.snapshot.status === "suspended" ? "canvas" : "list",
    });
  }, [persistedPlanQuery.data, plan, updateWindowData, id]);

  const handleGenerate = () => {
    void startForm.handleSubmit();
  };

  const handleApprove = () => {
    if (!runId) {
      return;
    }
    approve.mutate({ runId });
  };

  const handleReject = () => {
    clearPlanning();
    updateWindowData(id, {
      plan: null,
      planId: undefined,
      runId: undefined,
      status: "Idle",
      activeView: "list",
      steps: [],
    });
  };

  const handleRevise = () => {
    clearPlanning();
    updateWindowData(id, {
      plan: null,
      planId: undefined,
      runId: undefined,
      status: "planning",
      activeView: "list",
      steps: [],
    });
    startPlanning();
  };

  const setView = (view: typeof activeView) => {
    updateWindowData(id, { activeView: view });
  };

  const handleSelectRun = (selectedRunId: string) => {
    updateWindowData(id, {
      runId: selectedRunId,
      activeView: "list",
    });
  };

  const handleCancelRun = (cancelRunId: string) => {
    cancelMutation.mutate({ runId: cancelRunId });
  };

  const handlePlanChange = (updatedPlan: StructuredPlan) => {
    updateWindowData(id, {
      plan: updatedPlan,
    });

    if (runId) {
      updatePlan.mutate({
        runId,
        structuredPlan: updatedPlan,
      });
    }
  };

  useEffect(() => {
    if (windowData.requirement && windowData.requirement !== requirement) {
      startForm.setFieldValue("requirement", windowData.requirement);
    }
  }, [windowData.requirement, requirement, startForm]);

  useEffect(() => {
    if (windowData.status === "planning" && planStatus === "idle") {
      startPlanning();
    }
  }, [windowData.status, planStatus, startPlanning]);

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
      {/* View switcher */}
      <div className="flex items-center rounded-lg border border-white/10 bg-white/5">
        <Button
          className={`h-6 w-6 ${activeView === "list" ? "text-biolum" : "text-biolum-dim"}`}
          onClick={() => setView("list")}
          size="icon"
          title="Execution View"
          variant="ghost"
        >
          <List className="h-3.5 w-3.5" />
        </Button>
        {plan && (
          <Button
            className={`h-6 w-6 ${activeView === "canvas" ? "text-biolum" : "text-biolum-dim"}`}
            onClick={() => setView("canvas")}
            size="icon"
            title="Canvas View"
            variant="ghost"
          >
            <LayoutGrid className="h-3.5 w-3.5" />
          </Button>
        )}
        {runId && (
          <Button
            className={`h-6 w-6 ${activeView === "compilation" ? "text-biolum" : "text-biolum-dim"}`}
            onClick={() => setView("compilation")}
            size="icon"
            title="Compilation"
            variant="ghost"
          >
            <FileText className="h-3.5 w-3.5" />
          </Button>
        )}
        {runId && (
          <Button
            className={`h-6 w-6 ${activeView === "events" ? "text-biolum" : "text-biolum-dim"}`}
            onClick={() => setView("events")}
            size="icon"
            title="Event Inspector"
            variant="ghost"
          >
            <ScrollText className="h-3.5 w-3.5" />
          </Button>
        )}
        <Button
          className={`h-6 w-6 ${activeView === "runs" ? "text-biolum" : "text-biolum-dim"}`}
          onClick={() => setView("runs")}
          size="icon"
          title="All Runs"
          variant="ghost"
        >
          <Workflow className="h-3.5 w-3.5" />
        </Button>
      </div>
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

            {status === "suspended" && runId && (
              <div className="-translate-x-1/2 fade-in slide-in-from-bottom-4 absolute bottom-4 left-1/2 flex animate-in items-center gap-2 rounded-xl border border-white/10 bg-void-surface/80 p-2 shadow-2xl backdrop-blur-xl duration-300">
                <Button
                  className="h-9 px-4 font-bold text-red-400 text-xs uppercase tracking-widest hover:bg-red-400/10 hover:text-red-300"
                  disabled={approve.isPending}
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
                  disabled={planStatus === "planning" || approve.isPending}
                  onClick={handleRevise}
                  size="sm"
                  variant="ghost"
                >
                  <RefreshCw
                    className={`mr-2 h-3.5 w-3.5 ${planStatus === "planning" ? "animate-spin" : ""}`}
                  />
                  Iterate
                </Button>
                <Button
                  className="h-9 rounded-lg bg-biolum px-6 font-black text-void text-xs uppercase tracking-widest shadow-[0_0_20px_rgba(var(--biolum-rgb),0.4)] hover:bg-biolum-bright"
                  disabled={approve.isPending}
                  onClick={handleApprove}
                  size="sm"
                >
                  {approve.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Check className="mr-2 h-3.5 w-3.5" />
                  )}
                  Approve Plan
                </Button>
              </div>
            )}
          </div>
        ) : activeView === "compilation" && runId ? (
          <div className="h-full p-4">
            <CompilationView runId={runId} />
          </div>
        ) : activeView === "events" && runId ? (
          <div className="h-full p-4">
            <EventInspector
              events={(eventsQuery.data ?? []).map((e) => ({
                id: e.eventId,
                type: e.eventType,
                timestamp: e.timestamp ?? new Date().toISOString(),
                data: e.eventData as Record<string, unknown> | undefined,
              }))}
              isLoading={eventsQuery.isLoading}
            />
          </div>
        ) : activeView === "runs" ? (
          <div className="h-full p-4">
            <RunList
              onCancelRun={handleCancelRun}
              onSelectRun={handleSelectRun}
              runs={(runsQuery.data ?? []).map((r) => ({
                id: r.id,
                requirement: r.requirement ?? "Untitled",
                status: r.status as
                  | "running"
                  | "suspended"
                  | "completed"
                  | "failed"
                  | "cancelled",
                createdAt: r.created ?? new Date().toISOString(),
                updatedAt: r.updated ?? new Date().toISOString(),
                projectId: r.projectId,
              }))}
              selectedRunId={runId}
            />
          </div>
        ) : (
          <div className="flex flex-col gap-3 p-4">
            {showExecutionPanel ? (
              <div className="flex flex-col gap-3">
                {genuiSchemas ? (
                  <GenUIErrorBoundary>
                    <div className="rounded-2xl border border-white/10 bg-void-surface/40 p-3 backdrop-blur">
                      <UISchemaRenderer schema={genuiSchemas.timeline} />
                    </div>
                    {genuiSchemas.plan ? (
                      <div className="rounded-2xl border border-white/10 bg-void-surface/40 p-3 backdrop-blur">
                        <UISchemaRenderer schema={genuiSchemas.plan} />
                      </div>
                    ) : null}
                  </GenUIErrorBoundary>
                ) : null}

                {runId ? <WorkflowCognitiveBadge streamId={runId} /> : null}

                <ExecutionPanel
                  className="h-[300px]"
                  error={runError}
                  escalation={runEscalation ?? escalation ?? null}
                  isRunning={
                    runStatus === "running" || runStatus === "connecting"
                  }
                  onClose={() => {}}
                  onStop={stop}
                  steps={
                    currentSteps.length > 0
                      ? currentSteps
                      : ((windowData.steps as WorkflowStep[]) ?? planSteps)
                  }
                />

                {status === "completed" && runId && (
                  <div className="rounded-2xl border border-white/10 bg-void-surface/40 p-3 backdrop-blur">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold text-biolum text-sm">
                          Completed
                        </p>
                        {summaryText && (
                          <p className="mt-1 text-biolum-dim text-xs">
                            {summaryText}
                          </p>
                        )}
                      </div>
                      <Button
                        onClick={() =>
                          navigate({
                            to: "/workflow/$runId",
                            params: { runId },
                          })
                        }
                        size="sm"
                        type="button"
                        variant="outline"
                      >
                        Open Work
                      </Button>
                    </div>
                  </div>
                )}
              </div>
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
                        disabled={
                          (planStatus as
                            | "idle"
                            | "planning"
                            | "ready"
                            | "error") === "planning"
                        }
                        onClick={handleGenerate}
                        size="sm"
                        type="button"
                        variant="outline"
                      >
                        {(planStatus as
                          | "idle"
                          | "planning"
                          | "ready"
                          | "error") === "planning" ? (
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
