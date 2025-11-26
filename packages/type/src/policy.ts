export type ObligationKind =
  | "biometric"
  | "mfa"
  | "confirmation"
  | (string & {});

export type Obligation = {
  /**
   * Category of follow-up action the user or system must satisfy (e.g. biometric, MFA).
   */
  type: ObligationKind;
  /**
   * Human-readable reason describing why the obligation is required.
   */
  reason: string;
  /**
   * Optional, structured metadata that provides additional context (e.g. rule ids, scopes).
   */
  metadata?: Record<string, unknown> | null;
};
