import { ThumbsDown, ThumbsUp } from "lucide-react";
import { Button } from "@/components/ui/button";

export type CognitiveFeedbackControlsProps = {
  disabled?: boolean;
  onPositive: () => void;
  onNegative: () => void;
};

export function CognitiveFeedbackControls({
  disabled,
  onPositive,
  onNegative,
}: CognitiveFeedbackControlsProps) {
  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <span className="uppercase tracking-[0.2em] text-[0.65rem]">
        Feedback
      </span>
      <Button
        aria-label="Mark response as helpful"
        className="h-7 w-7 rounded-full border border-white/10 bg-transparent text-muted-foreground hover:bg-white/10"
        disabled={disabled}
        onClick={onPositive}
        size="icon"
        type="button"
        variant="ghost"
      >
        <ThumbsUp className="size-3.5" />
      </Button>
      <Button
        aria-label="Mark response as needs revision"
        className="h-7 w-7 rounded-full border border-white/10 bg-transparent text-muted-foreground hover:bg-white/10"
        disabled={disabled}
        onClick={onNegative}
        size="icon"
        type="button"
        variant="ghost"
      >
        <ThumbsDown className="size-3.5" />
      </Button>
    </div>
  );
}
