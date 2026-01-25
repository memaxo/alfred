"use client";

/**
 * ReviewDependencyGraph - Modal showing review impact and dependencies
 * Visualizes which tasks are blocked by a pending review
 */

import {
  ArrowRight,
  CheckCircle2,
  Circle,
  Clock,
  GitBranch,
} from "lucide-react";
import { useMemo } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { trpc } from "@/utils/trpc";

interface ReviewDependencyGraphProps {
  reviewId: string | null;
  onClose: () => void;
}

interface DependencyNode {
  id: string;
  label: string;
  type: "review" | "task" | "workflow";
  status: "blocked" | "pending" | "completed";
  isCritical?: boolean;
}

interface DependencyEdge {
  from: string;
  to: string;
}

export function ReviewDependencyGraph({
  reviewId,
  onClose,
}: ReviewDependencyGraphProps) {
  const { data: review, isLoading } = trpc.review.fullContext.useQuery(
    { reviewId: reviewId! },
    { enabled: !!reviewId }
  );

  // Generate mock dependency data based on review context
  const { nodes, blockedCount } = useMemo(() => {
    if (!review) {
      return { nodes: [], edges: [], blockedCount: 0 };
    }

    const nodes: DependencyNode[] = [
      {
        id: review.id,
        label: getSummary(review.reviewType, review.subjectData),
        type: "review",
        status: "pending",
        isCritical:
          review.priority === "critical" || review.priority === "high",
      },
    ];

    const edges: DependencyEdge[] = [];
    let blockedCount = 0;

    // Add blocked tasks based on review type
    if (review.reviewType === "workflow") {
      nodes.push({
        id: "task-1",
        label: "Downstream workflow step",
        type: "task",
        status: "blocked",
      });
      edges.push({ from: review.id, to: "task-1" });
      blockedCount++;
    }

    if (review.reviewType === "code") {
      nodes.push(
        {
          id: "task-merge",
          label: "PR merge",
          type: "task",
          status: "blocked",
          isCritical: true,
        },
        {
          id: "task-deploy",
          label: "Deployment",
          type: "task",
          status: "blocked",
        }
      );
      edges.push(
        { from: review.id, to: "task-merge" },
        { from: "task-merge", to: "task-deploy" }
      );
      blockedCount += 2;
    }

    if (review.reviewType === "tool_execution") {
      nodes.push({
        id: "task-tool",
        label: "Tool operation completion",
        type: "task",
        status: "blocked",
      });
      edges.push({ from: review.id, to: "task-tool" });
      blockedCount++;
    }

    // Add similar reviews as context
    if (review.similarReviews?.length) {
      review.similarReviews.slice(0, 2).forEach((similar, i) => {
        nodes.push({
          id: `similar-${i}`,
          label: similar.summary,
          type: "review",
          status: similar.verdict === "approved" ? "completed" : "pending",
        });
      });
    }

    return { nodes, edges, blockedCount };
  }, [review]);

  if (!reviewId) {
    return null;
  }

  return (
    <Dialog open={!!reviewId} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitBranch className="w-5 h-5" />
            Impact Analysis
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-4 py-4">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : (
          <div className="py-4 space-y-6">
            {/* Summary */}
            <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-lg">
              <div className="flex-1">
                <p className="text-sm font-medium">
                  This review blocks {blockedCount} downstream{" "}
                  {blockedCount === 1 ? "task" : "tasks"}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Approving will unblock the following work items
                </p>
              </div>
              {blockedCount > 0 && (
                <Badge variant="destructive">{blockedCount} blocked</Badge>
              )}
            </div>

            {/* Graph visualization */}
            <div className="border rounded-lg p-4">
              <div className="flex flex-col gap-4">
                {nodes.map((node, index) => (
                  <div key={node.id} className="flex items-center gap-3">
                    {/* Connector line */}
                    {index > 0 && (
                      <div className="w-6 flex justify-center">
                        <ArrowRight className="w-4 h-4 text-muted-foreground" />
                      </div>
                    )}
                    {index === 0 && <div className="w-6" />}

                    {/* Node */}
                    <div
                      className={cn(
                        "flex-1 flex items-center gap-3 p-3 rounded-lg border",
                        node.status === "blocked" &&
                          "border-destructive/50 bg-destructive/5",
                        node.status === "pending" &&
                          "border-yellow-500/50 bg-yellow-500/5",
                        node.status === "completed" &&
                          "border-green-500/50 bg-green-500/5",
                        node.isCritical && "ring-2 ring-destructive/30"
                      )}
                    >
                      <NodeIcon status={node.status} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {node.label}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="text-xs">
                            {node.type}
                          </Badge>
                          {node.isCritical && (
                            <Badge variant="destructive" className="text-xs">
                              Critical path
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Risk factors */}
            {review?.riskFactors && review.riskFactors.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-2">Risk Factors</h4>
                <ul className="space-y-1">
                  {review.riskFactors.map((factor, i) => (
                    <li
                      key={i}
                      className="text-xs text-muted-foreground flex items-center gap-2"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-destructive" />
                      {factor}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button variant="outline" onClick={onClose}>
                Close
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function NodeIcon({ status }: { status: DependencyNode["status"] }) {
  switch (status) {
    case "completed": {
      return <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />;
    }
    case "blocked": {
      return <Clock className="w-5 h-5 text-destructive shrink-0" />;
    }
    case "pending": {
      return <Circle className="w-5 h-5 text-yellow-500 shrink-0" />;
    }
  }
}

function getSummary(reviewType: string, subjectData: unknown): string {
  const data = subjectData as Record<string, unknown>;
  switch (reviewType) {
    case "tool_execution": {
      return `Tool: ${data.toolName ?? "unknown"}`;
    }
    case "memory": {
      return `Memory: ${(data.fact as string)?.slice(0, 30) ?? "..."}`;
    }
    case "code": {
      return `PR #${data.prNumber ?? "?"}: ${data.prTitle ?? "Code review"}`;
    }
    case "workflow": {
      return `Workflow: ${data.decision ?? "decision"}`;
    }
    default: {
      return "Review";
    }
  }
}
