/**
 * Mindscape Visualization Utilities
 */

// Note: This file contains duplicate implementations of utility functions also found in @alfred/knowledge
// We should eventually import them from there, but for now we keep them here for component isolation.

/**
 * Returns Tailwind classes for the confidence visual treatment.
 * - High (> 0.8): Full opacity
 * - Medium (0.5 - 0.8): Reduced opacity (0.8)
 * - Low (< 0.5): Low opacity (0.6), desaturated text
 * - Archived: Very low opacity (0.4), dashed border
 */
export function getConfidenceStyle(
  confidence: number | undefined | null,
  archived: string | undefined | null
): {
  container: string;
  text: string;
  border: string;
} {
  if (archived) {
    return {
      container: "opacity-40 grayscale",
      text: "text-white/40",
      border: "border-dashed border-white/20",
    };
  }

  if (typeof confidence !== "number") {
    return {
      container: "opacity-100",
      text: "text-white/80",
      border: "border-white/10",
    };
  }

  if (confidence >= 0.8) {
    return {
      container: "opacity-100",
      text: "text-white",
      border: "border-white/10", // Or biolum for selected
    };
  }

  if (confidence >= 0.5) {
    return {
      container: "opacity-90",
      text: "text-white/80",
      border: "border-white/10",
    };
  }

  // Low confidence
  return {
    container: "opacity-70 grayscale-[0.5]",
    text: "text-white/60",
    border: "border-white/5",
  };
}

export function formatConfidence(confidence: number): string {
  return `${Math.round(confidence * 100)}%`;
}
