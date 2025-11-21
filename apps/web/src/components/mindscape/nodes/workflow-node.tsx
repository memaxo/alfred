import type { AssistantUIMessage } from "@alfred/agent";
import type { NodeProps } from "@xyflow/react";
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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { deriveActions } from "@/hooks/use-assistant-stream";
import { workflowNodeDataSchema } from "@/store/mindscape.schemas";
import { useMindscapeStore } from "@/store/mindscape";
import { trpc } from "@/utils/trpc";
import { MindscapeNode } from "./mindscape-node";

type AutoLevel = "read" | "low" | "medium" | "high";

const autoOptions: AutoLevel[] = ["read", "low", "medium", "high"];

export function WorkflowNode({ id, data, selected }: NodeProps) {
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
  
  const messages = (validatedData.messages ??
    []) as AssistantUIMessage[];
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

  const updateArtifactData = useMindscapeStore((state) => state.updateArtifactData);

  useEffect(() => {
    if (validatedData.requirement && validatedData.requirement !== requirementDraft) {
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
              placeholder="Describe what Alfred should do"
              value={requirementDraft}
              onChange={(event) => setRequirementDraft(event.target.value)}
              className="min-h-[100px]"
            />
            <div className="flex items-center gap-2">
              <Select value={autoLevel} onValueChange={(value) => setAutoLevel(value as AutoLevel)}>
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
              <Select value={mode} onValueChange={(value) => setMode(value as "sequential" | "parallel")}>
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
              <Button type="submit" disabled={!requirementDraft.trim()} className="flex-1">
                Launch Workflow
              </Button>
              <Button type="button" variant="ghost" onClick={() => setRequirementDraft("")}>
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
            <div className={`text-xs uppercase tracking-wider ${statusBadgeClass}`}>
              Status: {status}
            </div>
          </PlanFooter>
        </Plan>

        {hasRun && (
          <div className="space-y-2 border-t border-white/10 pt-3">
            <div className="flex items-center justify-between text-xs text-biolum-faint">
              <span>Run ID: {validatedData.runId?.slice(0, 12)}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => eventsQuery.refetch()}
                disabled={eventsQuery.isFetching}
              >
                Refresh events
              </Button>
            </div>
            <ScrollArea className="h-[140px] rounded-md border border-white/10">
              {eventsQuery.isLoading ? (
                <p className="p-3 text-center text-sm text-biolum-faint">
                  Loading events…
                </p>
              ) : events.length === 0 ? (
                <p className="p-3 text-center text-sm text-biolum-faint">
                  No events recorded for this run yet.
                </p>
              ) : (
                <ul className="divide-y divide-white/5 text-sm">
                  {events.slice(0, 10).map((event) => (
                    <li className="p-3" key={event.id}>
                      <div className="flex items-center justify-between text-xs text-biolum-faint">
                        <span>{event.eventType}</span>
                        {event.timestamp && (
                          <span>{new Date(event.timestamp).toLocaleTimeString()}</span>
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
