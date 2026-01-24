import type { Obligation } from "@alfred/type";

import { TRPCError } from "@trpc/server";

export class PolicyObligationError extends TRPCError {
  readonly action: string;
  readonly obligations: Obligation[];

  constructor(
    action: string,
    obligations: Obligation[],
    metadata?: Record<string, unknown>
  ) {
    super({
      code: "PRECONDITION_FAILED",
      message: "obligation_required",
      cause: {
        action,
        obligations,
        ...(metadata ?? {}),
      },
    });
    this.name = "PolicyObligationError";
    this.action = action;
    this.obligations = obligations;
  }
}
