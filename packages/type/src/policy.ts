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

export type ObligationResumeEvent = "bio-authz" | "mfa-authz" | "human-authz";

const defaultResumeEventByType: Record<ObligationKind, ObligationResumeEvent> =
  {
    biometric: "bio-authz",
    mfa: "mfa-authz",
    confirmation: "human-authz",
  };

const allowedResumeEvents = new Set<ObligationResumeEvent>([
  "bio-authz",
  "mfa-authz",
  "human-authz",
]);

function coerceResumeEvent(
  value: unknown,
  fallback: ObligationResumeEvent
): ObligationResumeEvent {
  if (typeof value === "string" && allowedResumeEvents.has(value as any)) {
    return value as ObligationResumeEvent;
  }
  return fallback;
}

export function resolveObligationResumeEvents(
  obligations: Obligation[]
): ObligationResumeEvent[] {
  const events = new Set<ObligationResumeEvent>();
  for (const obligation of obligations) {
    const defaultEvent =
      defaultResumeEventByType[obligation.type] ?? "human-authz";
    const override = (obligation.metadata?.resumeEvent as unknown) ?? undefined;
    events.add(coerceResumeEvent(override, defaultEvent));
  }
  if (events.size === 0) {
    events.add("human-authz");
  }
  return Array.from(events);
}
