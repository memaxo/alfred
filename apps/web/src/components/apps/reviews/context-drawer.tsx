"use client";

/**
 * ReviewContextDrawer - Slide-out panel showing full review context
 */

import { formatDistanceToNow } from "date-fns";
import { AlertTriangle, FileText, History, Lightbulb, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/utils/trpc";

interface ReviewContextDrawerProps {
  reviewId: string | null;
  onClose: () => void;
  onApprove: (reviewId: string) => void;
  onReject: (reviewId: string) => void;
}

export function ReviewContextDrawer({
  reviewId,
  onClose,
  onApprove,
  onReject,
}: ReviewContextDrawerProps) {
  const { data: review, isLoading } = trpc.review.fullContext.useQuery(
    { reviewId: reviewId! },
    { enabled: !!reviewId }
  );

  return (
    <Sheet open={!!reviewId} onOpenChange={() => onClose()}>
      <SheetContent className="w-[500px] sm:max-w-[500px] p-0">
        <SheetHeader className="p-6 pb-0">
          <SheetTitle className="flex items-center justify-between">
            Review Details
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </SheetTitle>
        </SheetHeader>

        {isLoading ? (
          <DrawerSkeleton />
        ) : review ? (
          <ScrollArea className="h-[calc(100vh-8rem)]">
            <div className="space-y-6 p-6">
              {/* Header */}
              <div>
                <h3 className="text-lg font-semibold">
                  {getSummary(
                    review.reviewType,
                    review.subjectData as Record<string, unknown>
                  )}
                </h3>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <Badge variant="outline" className="capitalize">
                    {review.reviewType.replace("_", " ")}
                  </Badge>
                  <Badge
                    variant={
                      review.priority === "high" ||
                      review.priority === "critical"
                        ? "destructive"
                        : "secondary"
                    }
                  >
                    {review.priority} priority
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    {formatDistanceToNow(new Date(review.createdAt!))} ago
                  </span>
                </div>
              </div>

              <Separator />

              {/* Trigger context */}
              {review.triggerContext && (
                <Section icon={Lightbulb} title="What triggered this">
                  <p className="text-sm text-muted-foreground">
                    {review.triggerContext}
                  </p>
                </Section>
              )}

              {/* Agent reasoning */}
              {review.agentReasoning && (
                <Section icon={Lightbulb} title="Agent's reasoning">
                  <pre className="text-sm text-muted-foreground whitespace-pre-wrap font-mono bg-muted/50 p-3 rounded">
                    {review.agentReasoning}
                  </pre>
                </Section>
              )}

              {/* Related files */}
              {review.relatedFiles && review.relatedFiles.length > 0 && (
                <Section icon={FileText} title="Related files">
                  <ul className="space-y-1">
                    {review.relatedFiles.map((file, i) => (
                      <li
                        key={i}
                        className="text-sm font-mono text-muted-foreground truncate"
                        title={file}
                      >
                        {file}
                      </li>
                    ))}
                  </ul>
                </Section>
              )}

              {/* Risk factors */}
              {review.riskFactors && review.riskFactors.length > 0 && (
                <Section icon={AlertTriangle} title="Risk factors">
                  <ul className="space-y-1">
                    {review.riskFactors.map((factor, i) => (
                      <li
                        key={i}
                        className="text-sm text-yellow-500 flex items-start gap-2"
                      >
                        <span>⚠️</span>
                        <span>{factor}</span>
                      </li>
                    ))}
                  </ul>
                </Section>
              )}

              {/* Similar past reviews */}
              {review.similarReviews && review.similarReviews.length > 0 && (
                <Section icon={History} title="Similar past reviews">
                  <div className="space-y-2">
                    {review.similarReviews.map((similar) => (
                      <div
                        key={similar.id}
                        className="flex items-center justify-between text-sm"
                      >
                        <span className="text-muted-foreground truncate max-w-[250px]">
                          {similar.summary}
                        </span>
                        <Badge
                          variant={
                            similar.verdict === "approved"
                              ? "secondary"
                              : "destructive"
                          }
                          className="text-xs"
                        >
                          {similar.verdict}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </Section>
              )}

              <Separator />

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <Button
                  variant="destructive"
                  className="flex-1"
                  onClick={() => onReject(review.id)}
                >
                  Reject
                </Button>
                <Button
                  variant="default"
                  className="flex-1"
                  onClick={() => onApprove(review.id)}
                >
                  Approve
                </Button>
              </div>
            </div>
          </ScrollArea>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-4 h-4 text-muted-foreground" />
        <h4 className="text-sm font-semibold text-foreground">{title}</h4>
      </div>
      {children}
    </div>
  );
}

function getSummary(
  reviewType: string,
  subjectData: Record<string, unknown>
): string {
  switch (reviewType) {
    case "tool_execution":
      return `Tool: ${subjectData.toolName ?? "unknown"}`;
    case "memory":
      return `Memory: ${(subjectData.fact as string)?.slice(0, 50) ?? "..."}`;
    case "message":
      return `Message: ${(subjectData.messageContent as string)?.slice(0, 50) ?? "..."}`;
    case "workflow":
      return `Workflow: ${subjectData.decision ?? "decision"}`;
    case "code":
      return `PR #${subjectData.prNumber ?? "?"}: ${subjectData.prTitle ?? "Code review"}`;
    default:
      return "Review";
  }
}

function DrawerSkeleton() {
  return (
    <div className="space-y-6 p-6">
      <div>
        <Skeleton className="h-6 w-3/4 mb-2" />
        <div className="flex gap-2">
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-5 w-24" />
        </div>
      </div>
      <Skeleton className="h-px w-full" />
      {[1, 2, 3].map((i) => (
        <div key={i}>
          <Skeleton className="h-4 w-32 mb-2" />
          <Skeleton className="h-16 w-full" />
        </div>
      ))}
    </div>
  );
}
