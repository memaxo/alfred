/**
 * AgentActivityFeed - Real-time horizontal ticker of review events
 */

import { formatDistanceToNow } from "date-fns";
import { Activity } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useEffect, useRef } from "react";

import { cn } from "@/lib/utils";
import { trpc } from "@/utils/trpc";

interface AgentActivityFeedProps {
  className?: string;
}

export function AgentActivityFeed({ className }: AgentActivityFeedProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data } = trpc.review.activityFeed.useQuery(
    { limit: 20 },
    { refetchInterval: 3000 }
  );

  const events = data ?? [];

  // Auto-scroll to start on new events
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollLeft = 0;
    }
  }, [events.length]);

  const eventIcons: Record<string, string> = {
    created: "📝",
    approved: "✅",
    rejected: "❌",
    auto_approved: "🤖",
  };

  const eventColors: Record<string, string> = {
    created: "border-blue-500/30 bg-blue-500/10",
    approved: "border-green-500/30 bg-green-500/10",
    rejected: "border-red-500/30 bg-red-500/10",
    auto_approved: "border-purple-500/30 bg-purple-500/10",
  };

  return (
    <div className={cn("border-t border-border bg-muted/30", className)}>
      <div
        ref={scrollRef}
        className="flex items-center gap-3 px-4 py-2 overflow-x-auto scrollbar-hide"
      >
        <div className="flex items-center gap-2 shrink-0">
          <Activity className="w-4 h-4 text-muted-foreground" />
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Activity
          </span>
        </div>

        <AnimatePresence mode="popLayout">
          {events.map((event) => (
            <motion.div
              key={event.id}
              initial={{ opacity: 0, x: -20, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 20, scale: 0.9 }}
              transition={{ duration: 0.2 }}
              className={cn(
                "flex items-center gap-2 text-sm shrink-0",
                "px-3 py-1.5 rounded-full",
                "border",
                eventColors[event.type] ?? "border-border bg-background/50"
              )}
            >
              <span>{eventIcons[event.type] ?? "📋"}</span>
              <span className="text-foreground max-w-[200px] truncate">
                {event.summary}
              </span>
              {event.agent && (
                <span className="text-muted-foreground">• {event.agent}</span>
              )}
              <span className="text-muted-foreground text-xs">
                {formatDistanceToNow(new Date(event.timestamp), {
                  addSuffix: true,
                })}
              </span>
            </motion.div>
          ))}
        </AnimatePresence>

        {events.length === 0 && (
          <span className="text-sm text-muted-foreground">
            No recent activity
          </span>
        )}
      </div>
    </div>
  );
}
