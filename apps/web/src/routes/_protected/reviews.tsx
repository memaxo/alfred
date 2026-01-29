import { createFileRoute } from "@tanstack/react-router";

import { ReviewsDashboard } from "@/components/apps/reviews";

export const Route = createFileRoute("/_protected/reviews")({
  component: ReviewsPage,
});

function ReviewsPage() {
  return (
    <div className="h-screen">
      <ReviewsDashboard />
    </div>
  );
}
