import { ThumbsDown, ThumbsUp } from "lucide-react";
import { Button } from "@/components/ui/button";

export type CognitiveFeedbackControlsProps = {
  disabled?: boolean;
  onPositive: () => void;
  onNegative: () => void;
  testIdPrefix?: string;
};

export function CognitiveFeedbackControls({
  disabled,
  onPositive,
  onNegative,
  testIdPrefix,
}: CognitiveFeedbackControlsProps) {
  const positiveId = testIdPrefix ? `${testIdPrefix}-positive` : undefined;
  const negativeId = testIdPrefix ? `${testIdPrefix}-negative` : undefined;

  return (
    <div className="flex items-center gap-2 text-muted-foreground text-xs">
      <span className="text-[0.65rem] uppercase tracking-[0.2em]">
        Feedback
      </span>
      <Button
        aria-label="Mark response as helpful"
        className="h-7 w-7 rounded-full border border-white/10 bg-transparent text-muted-foreground hover:bg-white/10"
        data-testid={positiveId}
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
        data-testid={negativeId}
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
