import type { NodeProps } from "@xyflow/react";
import { MindscapeNode } from "./mindscape-node";
import { 
  Plan, 
  PlanHeader, 
  PlanTitle, 
  PlanDescription, 
  PlanContent, 
  PlanFooter 
} from "@/components/ai-elements/plan";
import { Task, TaskTrigger, TaskContent, TaskItem } from "@/components/ai-elements/task";
import { Tool, ToolHeader, ToolTitle, ToolContent } from "@/components/ai-elements/tool";
import { CodeBlock } from "@/components/ai-elements/code-block";

export function WorkflowNode({ id, data, selected }: NodeProps) {
  const tasks = (data?.tasks as any[]) || [];
  const currentTool = data?.currentTool as any;

  return (
    <MindscapeNode
      id={id}
      title={(data?.label as string) || "Workflow"}
      selected={selected}
      className="w-[400px]"
    >
      <div className="p-4">
        <Plan className="border-0 bg-transparent">
          <PlanHeader className="px-0 pt-0">
            <PlanTitle>{(data?.title as string) || "Execution Plan"}</PlanTitle>
            <PlanDescription>{(data?.description as string) || "Processing request..."}</PlanDescription>
          </PlanHeader>
          
          <PlanContent className="px-0 pb-0">
            <div className="space-y-2">
              {tasks.map((task: any, i: number) => (
                <Task key={i} defaultOpen={task.status === 'running'}>
                  <TaskTrigger title={task.title} />
                  <TaskContent>
                    <TaskItem>{task.description}</TaskItem>
                    {task.tools?.map((tool: any, j: number) => (
                      <div key={j} className="mt-2">
                         <span className="text-xs font-mono text-biolum">{tool.name}</span>
                      </div>
                    ))}
                  </TaskContent>
                </Task>
              ))}
            </div>

            {currentTool && (
              <div className="mt-4 pt-4 border-t border-white/10">
                 <Tool>
                    <ToolHeader>
                       <ToolTitle>{currentTool.name}</ToolTitle>
                    </ToolHeader>
                    <ToolContent>
                       <CodeBlock 
                         language="json" 
                         value={JSON.stringify(currentTool.args, null, 2)} 
                         className="bg-black/30"
                       />
                    </ToolContent>
                 </Tool>
              </div>
            )}
          </PlanContent>
          
          <PlanFooter className="px-0 pb-0 pt-4">
             <div className="text-biolum-dim text-xs uppercase tracking-wider">
                Status: {(data?.status as string) || "Idle"}
             </div>
          </PlanFooter>
        </Plan>
      </div>
    </MindscapeNode>
  );
}

