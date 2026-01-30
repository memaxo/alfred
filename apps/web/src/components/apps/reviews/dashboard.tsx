/**
 * ReviewsDashboard - Main composition component for PM Reviews dashboard
 *
 * Layout:
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │  ALFRED Reviews                                [Dashboard] [All Reviews]│
 * ├─────────────────────────────────────────────────────────────────────────┤
 * │  ┌─────────────────────────────────────┐  ┌───────────────────────────┐ │
 * │  │      BlockedWorkQueue               │  │   RiskAssessmentPanel     │ │
 * │  │      (Primary view - left 60%)      │  │   TrustProgressBar        │ │
 * │  └─────────────────────────────────────┘  └───────────────────────────┘ │
 * │  ┌─────────────────────────────────────────────────────────────────────┐│
 * │  │ ReviewCycleTimeChart (collapsible)                                  ││
 * │  └─────────────────────────────────────────────────────────────────────┘│
 * │  ┌─────────────────────────────────────────────────────────────────────┐│
 * │  │ AgentActivityFeed (bottom ticker)                                   ││
 * │  └─────────────────────────────────────────────────────────────────────┘│
 * └─────────────────────────────────────────────────────────────────────────┘
 */

import { LayoutDashboard, Table2 } from "lucide-react";
import { useState } from "react";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/utils/trpc";

import { AgentActivityFeed } from "./activity-feed";
import { BlockedWorkQueue } from "./blocked-queue";
import { ReviewContextDrawer } from "./context-drawer";
import { ReviewCycleTimeChart } from "./cycle-chart";
import { ReviewDependencyGraph } from "./dependency-graph";
import { ReviewErrorBoundary } from "./error-boundary";
import { ReviewTable } from "./review-table";
import { RiskAssessmentPanel } from "./risk-panel";
import { TrustProgressBar } from "./trust-progress";

export function ReviewsDashboard() {
  const utils = trpc.useUtils();
  const [selectedReviewId, setSelectedReviewId] = useState<string | null>(null);
  const [impactReviewId, setImpactReviewId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"dashboard" | "table">(
    "dashboard"
  );

  const submitMutation = trpc.review.submit.useMutation({
    onSuccess: () => {
      utils.review.blocked.invalidate();
      utils.review.queue.invalidate();
      utils.review.riskSummary.invalidate();
      utils.review.activityFeed.invalidate();
      utils.review.trustProgress.invalidate();
      setSelectedReviewId(null);
    },
  });

  const handleApprove = (reviewId: string) => {
    submitMutation.mutate({ reviewId, verdict: "approve" });
  };

  const handleReject = (reviewId: string) => {
    submitMutation.mutate({ reviewId, verdict: "reject" });
  };

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b shrink-0">
        <h1 className="text-2xl font-bold">ALFRED Reviews</h1>
        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as typeof activeTab)}
        >
          <TabsList>
            <TabsTrigger value="dashboard" className="gap-2">
              <LayoutDashboard className="w-4 h-4" />
              Dashboard
            </TabsTrigger>
            <TabsTrigger value="table" className="gap-2">
              <Table2 className="w-4 h-4" />
              All Reviews
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === "dashboard" ? (
          <div className="h-full flex flex-col">
            {/* Main content area */}
            <div className="flex-1 flex overflow-hidden">
              {/* Left: Blocked Work Queue (60%) */}
              <div className="flex-[3] border-r overflow-hidden">
                <ReviewErrorBoundary title="Failed to load blocked queue">
                  <BlockedWorkQueue
                    onSelectReview={setSelectedReviewId}
                    onShowImpact={setImpactReviewId}
                    className="h-full"
                  />
                </ReviewErrorBoundary>
              </div>

              {/* Right: Risk + Trust (40%) */}
              <div className="flex-[2] overflow-auto">
                <ReviewErrorBoundary title="Failed to load risk panel">
                  <RiskAssessmentPanel />
                </ReviewErrorBoundary>
                <div className="border-t" />
                <ReviewErrorBoundary title="Failed to load trust progress">
                  <TrustProgressBar />
                </ReviewErrorBoundary>
              </div>
            </div>

            {/* Cycle time chart (collapsible) */}
            <ReviewErrorBoundary title="Failed to load cycle time chart">
              <ReviewCycleTimeChart />
            </ReviewErrorBoundary>

            {/* Activity feed (bottom ticker) */}
            <ReviewErrorBoundary title="Failed to load activity feed">
              <AgentActivityFeed />
            </ReviewErrorBoundary>
          </div>
        ) : (
          <div className="p-6 overflow-auto h-full">
            <ReviewErrorBoundary title="Failed to load reviews table">
              <ReviewTable onSelectReview={setSelectedReviewId} />
            </ReviewErrorBoundary>
          </div>
        )}
      </div>

      {/* Drawers & Modals */}
      <ReviewContextDrawer
        reviewId={selectedReviewId}
        onClose={() => setSelectedReviewId(null)}
        onApprove={handleApprove}
        onReject={handleReject}
      />

      {/* Dependency Graph Modal */}
      <ReviewDependencyGraph
        reviewId={impactReviewId}
        onClose={() => setImpactReviewId(null)}
      />
    </div>
  );
}
