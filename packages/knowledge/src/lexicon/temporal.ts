/**
 * Temporal patterns for knowledge extraction.
 */

/**
 * Regex pattern for detecting recurring temporal expressions.
 */
export const RECURRENCE_REGEX =
  /\bevery\s+(?<interval>(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|weekday|weekend|week|month|quarter|year)(?:\s+(?:morning|afternoon|evening))?)/gi;

