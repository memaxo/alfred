/**
 * Orb Component
 *
 * Adapted from ui.elevenlabs.io/docs/components/orb
 * Floating orb for visual feedback during agent operations
 */

import { cn } from "@/lib/utils";

type OrbProps = {
  status: "idle" | "thinking" | "speaking" | "listening";
  className?: string;
};

export function Orb({ status, className }: OrbProps) {
  const statusConfig = {
    idle: "bg-gray-400",
    thinking: "bg-blue-400 animate-pulse",
    speaking: "bg-green-400 animate-pulse",
    listening: "bg-purple-400 animate-pulse",
  };

  return (
    <div className={cn("flex items-center justify-center", className)}>
      <div
        className={cn(
          "size-16 rounded-full shadow-lg transition-all",
          statusConfig[status]
        )}
      />
    </div>
  );
}
