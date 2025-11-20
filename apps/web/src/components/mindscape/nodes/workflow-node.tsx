import type { UIMessage } from "@alfred/type/stream";
import type { NodeProps } from "@xyflow/react";
import { useMemo } from "react";
import {
  Plan,
  PlanContent,
  PlanDescription,
  PlanFooter,
  PlanHeader,
  PlanTitle,
} from "@/components/ai-elements/plan";
import { Task, TaskContent, TaskItem, TaskTrigger } from "@/components/ai-elements/task";
import { Tool, ToolContent, ToolHeader } from "@/components/ai-elements/tool";
import { CodeBlock } from "@/components/ai-elements/code-block";
import { deriveActions } from "@/hooks/use-assistant-stream";
import { MindscapeNode } from "./mindscape-node";

export function WorkflowNode({ id, data, selected }: NodeProps) {
  const messages = (data?.messages as UIMessage[]) || [];
  const status = (data?.status as string) || "Idle";

  const actions = useMemo(() => deriveActions(messages), [messages]);
  
  const activeAction = actions.find(a => a.status === 'running');
  const completedActions = actions.filter(a => a.status === 'completed');

  return (
    <MindscapeNode
      className="w-[400px]"
      id={id}
      selected={selected}
      title={(data?.label as string) || "Workflow"}
    >
      <div className="p-4">
        <Plan className="border-0 bg-transparent">
          <PlanHeader className="px-0 pt-0">
            <PlanTitle>{(data?.title as string) || "Execution Plan"}</PlanTitle>
            <PlanDescription>
              {(data?.description as string) || "Processing request..."}
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
                  <TaskTrigger className="animate-pulse text-biolum" title={activeAction.name} />
                  <TaskContent>
                    <TaskItem>Running...</TaskItem>
                  </TaskContent>
                </Task>
              )}
            </div>

            {activeAction && (
              <div className="mt-4 border-t border-white/10 pt-4">
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

          <PlanFooter className="px-0 pb-0 pt-4">
            <div className="text-biolum-dim text-xs uppercase tracking-wider">
              Status: {status}
            </div>
          </PlanFooter>
        </Plan>
      </div>
    </MindscapeNode>
  );
}

