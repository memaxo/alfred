import type { AssistantUIMessage } from "@alfred/agent";
import type { NodeProps } from "@xyflow/react";
import { CheckCircle, Loader2, Workflow } from "lucide-react";
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
import { useDesktopStore } from "@/store/desktop";

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

  const [requirementDraft, setRequirementDraft] = useState(
    windowData.requirement ?? ""
  );
  const [autoLevel, setAutoLevel] = useState<AutoLevel>(
    windowData.auto ?? "low"
  );
  const [mode, setMode] = useState<"sequential" | "parallel">(
    windowData.mode ?? "sequential"
  );

  const updateWindow = useDesktopStore((s) => s.updateWindow);

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
    <Workflow
      className={`h-4 w-4 ${status === "running" ? "animate-spin text-biolum" : "text-biolum-dim"}`}
    />
  );

  return (
    <WindowFrame
      actions={headerIcon}
      id={id}
      selected={selected}
      title={windowData.label ?? "Workflow"}
      width={480}
      windowType="workflow"
    >
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
                onValueChange={(v) => setMode(v as "sequential" | "parallel")}
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
              <Button size="sm" type="submit">
                Start
              </Button>
            </div>
          </form>
        )}
      </div>
    </WindowFrame>
  );
}
