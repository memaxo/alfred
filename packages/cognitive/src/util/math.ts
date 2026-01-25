/**
 * Mathematical utilities and branded type constructors
 */

// Branded types for type safety
export type Timestamp = number & { readonly _: unique symbol };
export type Confidence = number & {
  readonly _: unique symbol;
  readonly min: 0;
  readonly max: 1;
};
export type Autonomy = number & {
  readonly _: unique symbol;
  readonly min: 0;
  readonly max: 1;
};

// Clamp value to [0, 1]
export const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));

// Brand constructors
export const timestamp = (n: number): Timestamp => {
  if (!Number.isFinite(n)) {
    throw new TypeError("Timestamp must be a finite number");
  }
  if (n < 0) {
    throw new Error("Timestamp cannot be negative");
  }
  return n as Timestamp;
};

export const confidence = (n: number): Confidence => {
  if (n < 0 || n > 1) {
    throw new Error("Invalid confidence");
  }
  return n as Confidence;
};

export const autonomy = (n: number): Autonomy => {
  if (n < 0 || n > 1) {
    throw new Error("Invalid autonomy");
  }
  return n as Autonomy;
};

// Constants
export const MS_PER_DAY = 1000 * 60 * 60 * 24;
export const CONFIDENCE_DECAY_RATE = 0.95;
