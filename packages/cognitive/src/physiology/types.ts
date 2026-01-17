/**
 * Physiological state types (homeostasis)
 */

export type Physiology = {
  energy: number; // 0..1 (decreases with steps)
  boredom: number; // 0..1 (increases with repetition)
  frustration: number; // 0..1 (increases with errors)
  entropy: number; // 0..1 (increases with unpredictability)
};

export type PhysiologyEvent =
  | "step"
  | "success"
  | "error"
  | "entropy_high"
  | "entropy_low";
