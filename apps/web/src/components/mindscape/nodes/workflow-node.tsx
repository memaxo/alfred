import type { AssistantUIMessage } from "@alfred/agent";
import type { NodeProps } from "@xyflow/react";
import { Workflow } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { CodeBlock } from "@/components/ai-elements/code-block";
import {
  Plan,
  PlanContent,
  PlanDescription,
  PlanFooter,
  PlanHeader,
  PlanTitle,
} from "@/components/ai-elements/plan";
import {
  Task,
  TaskContent,
  TaskItem,
  TaskTrigger,
} from "@/components/ai-elements/task";
import { Tool, ToolContent, ToolHeader } from "@/components/ai-elements/tool";
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
import { deriveActions } from "@/hooks/use-assistant-stream";
import { useMindscapeStore } from "@/store/mindscape";
import { workflowNodeDataSchema } from "@/store/mindscape.schemas";
import { trpc } from "@/utils/trpc";
import { useLOD } from "../lod";
import { MindscapeNode } from "./mindscape-node";

type AutoLevel = "read" | "low" | "medium" | "high";

const autoOptions: AutoLevel[] = ["read", "low", "medium", "high"];

export function WorkflowNode({ id, data, selected }: NodeProps) {
  const lod = useLOD();
  // Validate and parse node data
  const result = workflowNodeDataSchema.safeParse(data);
  const validatedData = result.success
    ? result.data
    : {
        messages: undefined,
        status: undefined,
        title: undefined,
        description: undefined,
        label: undefined,
      };

  const messages = (validatedData.messages ?? []) as AssistantUIMessage[];
  const status = validatedData.status ?? "Idle";
  const hasRun = Boolean(validatedData.runId);

  const [requirementDraft, setRequirementDraft] = useState(
    validatedData.requirement ?? ""
  );
  const [autoLevel, setAutoLevel] = useState<AutoLevel>(
    (validatedData.auto as AutoLevel) ?? "low"
  );
  const [mode, setMode] = useState<"sequential" | "parallel">(
    (validatedData.mode as "sequential" | "parallel") ?? "sequential"
  );

  const updateArtifactData = useMindscapeStore(
    (state) => state.updateArtifactData
  );

  useEffect(() => {
    if (
      validatedData.requirement &&
      validatedData.requirement !== requirementDraft
    ) {
      setRequirementDraft(validatedData.requirement);
    }
  }, [validatedData.requirement, requirementDraft]);

  const eventsQuery = trpc.workflow.events.useQuery(
    { runId: validatedData.runId ?? "" },
    { enabled: hasRun }
  );
  const events = eventsQuery.data ?? [];

  const actions = useMemo(() => deriveActions(messages), [messages]);

  const activeAction = actions.find((a) => a.status === "running");
  const completedActions = actions.filter((a) => a.status === "completed");

  const handleStart = (event: React.FormEvent) => {
    event.preventDefault();
    if (!requirementDraft.trim()) {
      toast.error("Requirement is required");
      return;
    }
    updateArtifactData(id, {
      requirement: requirementDraft.trim(),
      auto: autoLevel,
      mode,
      status: "pending",
      title: requirementDraft.trim().slice(0, 64),
      description: requirementDraft.trim(),
      messages: [],
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

  // LOD 0: Tiny
  if (lod === "tiny") {
    return (
      <div className="flex h-3 w-3 items-center justify-center rounded-full bg-biolum/40 backdrop-blur-sm">
        <div
          className={`h-1.5 w-1.5 rounded-full ${status === "running" ? "animate-pulse bg-biolum shadow-[0_0_8px_rgba(var(--biolum-rgb),1)]" : "bg-biolum-dim"}`}
        />
      </div>
    );
  }

  // LOD 1: Small
  if (lod === "small") {
    return (
      <div className="flex w-[140px] flex-col items-center gap-2 rounded-xl border border-biolum/20 bg-void-surface/40 p-2 text-center backdrop-blur-md transition-colors hover:border-biolum/40">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-biolum/10 text-biolum">
          {status === "running" ? (
            <Workflow className="h-4 w-4 animate-spin" />
          ) : (
            <Workflow className="h-4 w-4" />
          )}
        </div>
        <div className="flex flex-col items-center">
          <span className="line-clamp-1 w-full font-medium text-[10px] text-biolum-dim leading-tight tracking-tight">
            {validatedData.label ?? "Workflow"}
          </span>
          <span
            className={`text-[9px] uppercase tracking-wider ${statusBadgeClass}`}
          >
            {status}
          </span>
        </div>
      </div>
    );
  }

  // LOD 2/3: Full
  return (
    <MindscapeNode
      className="w-[400px]"
      id={id}
      selected={selected}
      title={validatedData.label ?? "Workflow"}
    >
      <div className="flex flex-col gap-4 p-4">
        {!hasRun && (
          <form className="space-y-3" onSubmit={handleStart}>
            <Textarea
              aria-label="Requirement"
              className="min-h-[100px]"
              onChange={(event) => setRequirementDraft(event.target.value)}
              placeholder="Describe what Alfred should do"
              value={requirementDraft}
            />
            <div className="flex items-center gap-2">
              <Select
                onValueChange={(value) => setAutoLevel(value as AutoLevel)}
                value={autoLevel}
              >
                <SelectTrigger className="w-[140px]" size="sm">
                  <SelectValue placeholder="Autonomy" />
                </SelectTrigger>
                <SelectContent>
                  {autoOptions.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                onValueChange={(value) =>
                  setMode(value as "sequential" | "parallel")
                }
                value={mode}
              >
                <SelectTrigger className="w-[140px]" size="sm">
                  <SelectValue placeholder="Mode" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sequential">Sequential</SelectItem>
                  <SelectItem value="parallel">Parallel</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button
                className="flex-1"
                disabled={!requirementDraft.trim()}
                type="submit"
              >
                Launch Workflow
              </Button>
              <Button
                onClick={() => setRequirementDraft("")}
                type="button"
                variant="ghost"
              >
                Clear
              </Button>
            </div>
          </form>
        )}

        <Plan className="border-0 bg-transparent">
          <PlanHeader className="px-0 pt-0">
            <PlanTitle>{validatedData.title ?? "Execution Plan"}</PlanTitle>
            <PlanDescription>
              {validatedData.description ?? "Processing request..."}
            </PlanDescription>
          </PlanHeader>

          <PlanContent className="px-0 pb-0">
            <div className="space-y-2">
              {/* Render completed actions as tasks */}
              {completedActions.map((action) => (
                <Task defaultOpen={false} key={action.id}>
                  <TaskTrigger title={action.name} />
                  <TaskContent>
                    <TaskItem>Completed</TaskItem>
                    <div className="mt-2">
                      <span className="font-mono text-biolum text-xs">
                        {JSON.stringify(action.args).slice(0, 50)}...
                      </span>
                    </div>
                  </TaskContent>
                </Task>
              ))}

              {/* Render active action */}
              {activeAction && (
                <Task defaultOpen={true} key={activeAction.id}>
                  <TaskTrigger
                    className="animate-pulse text-biolum"
                    title={activeAction.name}
                  />
                  <TaskContent>
                    <TaskItem>Running...</TaskItem>
                  </TaskContent>
                </Task>
              )}
            </div>

            {activeAction && (
              <div className="mt-4 border-white/10 border-t pt-4">
                <Tool>
                  <ToolHeader
                    state="input-available"
                    title={activeAction.name}
                    type="tool-call"
                  />
                  <ToolContent>
                    <CodeBlock
                      className="bg-black/30"
                      code={JSON.stringify(activeAction.args, null, 2)}
                      language="json"
                    />
                  </ToolContent>
                </Tool>
              </div>
            )}
          </PlanContent>

          <PlanFooter className="px-0 pt-4 pb-0">
            <div
              className={`text-xs uppercase tracking-wider ${statusBadgeClass}`}
            >
              Status: {status}
            </div>
          </PlanFooter>
        </Plan>

        {hasRun && (
          <div className="space-y-2 border-white/10 border-t pt-3">
            <div className="flex items-center justify-between text-biolum-faint text-xs">
              <span>Run ID: {validatedData.runId?.slice(0, 12)}</span>
              <Button
                disabled={eventsQuery.isFetching}
                onClick={() => eventsQuery.refetch()}
                size="sm"
                variant="ghost"
              >
                Refresh events
              </Button>
            </div>
            <ScrollArea className="h-[140px] rounded-md border border-white/10">
              {eventsQuery.isLoading ? (
                <p className="p-3 text-center text-biolum-faint text-sm">
                  Loading events…
                </p>
              ) : events.length === 0 ? (
                <p className="p-3 text-center text-biolum-faint text-sm">
                  No events recorded for this run yet.
                </p>
              ) : (
                <ul className="divide-y divide-white/5 text-sm">
                  {events.slice(0, 10).map((event) => (
                    <li className="p-3" key={event.id}>
                      <div className="flex items-center justify-between text-biolum-faint text-xs">
                        <span>{event.eventType}</span>
                        {event.timestamp && (
                          <span>
                            {new Date(event.timestamp).toLocaleTimeString()}
                          </span>
                        )}
                      </div>
                      {event.eventData && (
                        <pre className="mt-2 whitespace-pre-wrap break-words text-[11px] text-biolum-faint">
                          {JSON.stringify(event.eventData, null, 2)}
                        </pre>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </ScrollArea>
          </div>
        )}
      </div>
    </MindscapeNode>
  );
}
