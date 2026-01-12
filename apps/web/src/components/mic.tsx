/**
 * Mic Selector Component
 *
 * Adapted from ui.elevenlabs.io/docs/components/mic-selector
 * Microphone input selection for voice recording
 */

import {
  MicSelector,
  type MicSelectorProps,
} from "@/components/ui/mic-selector";

export type MicProps = MicSelectorProps;

export function Mic({
  value,
  onValueChange,
  muted,
  onMutedChange,
  disabled,
  className,
}: MicProps) {
  return (
    <MicSelector
      className={className}
      disabled={disabled}
      muted={muted}
      onMutedChange={onMutedChange}
      onValueChange={onValueChange}
      value={value}
    />
  );
}
