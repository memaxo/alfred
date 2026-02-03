import { CheckIcon, XIcon } from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { LiveWaveform } from "@/components/ui/live-waveform";
import { cn } from "@/lib/utils";

export type VoiceButtonState =
  | "idle"
  | "recording"
  | "processing"
  | "success"
  | "error";

export interface VoiceButtonProps extends Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  "onError"
> {
  /**
   * Current state of the voice button
   * @default "idle"
   */
  state?: VoiceButtonState;

  /**
   * Callback when button is clicked
   */
  onPress?: () => void;

  /**
   * Content to display on the left side (label)
   * Can be a string or ReactNode for custom components
   */
  label?: React.ReactNode;

  /**
   * Content to display on the right side (e.g., keyboard shortcut)
   * Can be a string or ReactNode for custom components
   * @example "⌥Space" or <kbd>⌘K</kbd>
   */
  trailing?: React.ReactNode;

  /**
   * Icon to display in the center when idle (for icon size buttons)
   */
  icon?: React.ReactNode;

  /**
   * Custom variant for the button
   * @default "outline"
   */
  variant?:
    | "default"
    | "destructive"
    | "outline"
    | "secondary"
    | "ghost"
    | "link";

  /**
   * Size of the button
   * @default "default"
   */
  size?: "default" | "sm" | "lg" | "icon";

  /**
   * Custom className for the button
   */
  className?: string;

  /**
   * Custom className for the waveform container
   */
  waveformClassName?: string;

  /**
   * Duration in ms to show success/error states
   * @default 1500
   */
  feedbackDuration?: number;

  /**
   * Disable the button
   */
  disabled?: boolean;
}

export const VoiceButton = ({
  state = "idle",
  onPress,
  label,
  trailing,
  icon,
  variant = "outline",
  size = "default",
  className,
  waveformClassName,
  feedbackDuration = 1500,
  disabled,
  onClick,
  ref,
  ...props
}: VoiceButtonProps & { ref?: React.RefObject<HTMLButtonElement | null> }) => {
  const [showFeedback, setShowFeedback] = React.useState(false);

  React.useEffect(() => {
    if (state === "success" || state === "error") {
      setShowFeedback(true);
      const timeout = setTimeout(
        () => setShowFeedback(false),
        feedbackDuration
      );
      return () => clearTimeout(timeout);
    }
    // Reset feedback when state changes away from success/error
    setShowFeedback(false);
  }, [state, feedbackDuration]);

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    onClick?.(e);
    onPress?.();
  };

  const isRecording = state === "recording";
  const isProcessing = state === "processing";
  const isSuccess = state === "success";
  const isError = state === "error";

  const buttonVariant = variant;
  const isDisabled = disabled || isProcessing;

  const displayLabel = label;

  const shouldShowWaveform = isRecording || isProcessing || showFeedback;
  const shouldShowTrailing = !shouldShowWaveform && trailing;

  return (
    <Button
      aria-label="Voice Button"
      className={cn(
        "gap-2 transition-all duration-200",
        size === "icon" && "relative",
        className
      )}
      disabled={isDisabled}
      onClick={handleClick}
      ref={ref}
      size={size}
      type="button"
      variant={buttonVariant}
      {...props}
    >
      {size !== "icon" && displayLabel && (
        <span className="inline-flex shrink-0 items-center justify-start">
          {displayLabel}
        </span>
      )}

      <div
        className={cn(
          "relative box-content flex shrink-0 items-center justify-center overflow-hidden transition-all duration-300",
          size === "icon"
            ? "absolute inset-0 rounded-sm border-0"
            : "h-5 w-24 rounded-sm border",
          isRecording
            ? "bg-primary/10 dark:bg-primary/5"
            : size === "icon"
              ? "border-0 bg-muted/50"
              : "border-border bg-muted/50",
          waveformClassName
        )}
      >
        {shouldShowWaveform && (
          <LiveWaveform
            active={isRecording}
            barGap={1}
            barRadius={4}
            barWidth={2}
            className="fade-in absolute inset-0 h-full w-full animate-in duration-300"
            fadeEdges={false}
            height={20}
            mode="static"
            processing={isProcessing || isSuccess}
            sensitivity={1.8}
            smoothingTimeConstant={0.85}
          />
        )}

        {shouldShowTrailing && (
          <div className="fade-in absolute inset-0 flex animate-in items-center justify-center duration-300">
            {typeof trailing === "string" ? (
              <span className="select-none px-1.5 font-medium font-mono text-[10px] text-muted-foreground">
                {trailing}
              </span>
            ) : (
              trailing
            )}
          </div>
        )}

        {!(shouldShowWaveform || shouldShowTrailing) &&
          icon &&
          size === "icon" && (
            <div className="fade-in absolute inset-0 flex animate-in items-center justify-center duration-300">
              {icon}
            </div>
          )}

        {isSuccess && showFeedback && (
          <div className="fade-in absolute inset-0 flex animate-in items-center justify-center bg-background/80 duration-300">
            <span className="font-medium text-[10px] text-primary">
              <CheckIcon className="size-3.5" />
            </span>
          </div>
        )}

        {/* Error Icon */}
        {isError && showFeedback && (
          <div className="fade-in absolute inset-0 flex animate-in items-center justify-center bg-background/80 duration-300">
            <span className="font-medium text-[10px] text-destructive">
              <XIcon className="size-3.5" />
            </span>
          </div>
        )}
      </div>
    </Button>
  );
};

VoiceButton.displayName = "VoiceButton";
