import type { Obligation, ObligationResumeEvent } from "@alfred/type";

import { useCallback, useState } from "react";

export type ResumeTarget = "workflow" | "droid";

export interface UseObligationResumeArgs {
  target: ResumeTarget;
}

interface PendingState {
  runId: string | null;
  obligations: Obligation[];
  resumeEvents: ObligationResumeEvent[];
}

const DEFAULT_RESUME_EVENT: ObligationResumeEvent = "human-authz";

export function useObligationResume({ target }: UseObligationResumeArgs) {
  const [isOpen, setIsOpen] = useState(false);
  const [pending, setPending] = useState<PendingState | null>(null);

  const prompt = useCallback(
    (payload: {
      runId: string;
      obligations: Obligation[];
      resumeEvents?: ObligationResumeEvent[];
    }) => {
      setPending({
        runId: payload.runId,
        obligations: payload.obligations,
        resumeEvents:
          payload.resumeEvents && payload.resumeEvents.length > 0
            ? payload.resumeEvents
            : [DEFAULT_RESUME_EVENT],
      });
      setIsOpen(true);
    },
    []
  );

  const close = useCallback(() => {
    setIsOpen(false);
    setPending(null);
  }, []);

  return {
    isOpen,
    pending,
    target,
    prompt,
    close,
  };
}
