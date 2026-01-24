import type { auth } from "@alfred/auth";
import type { Obligation } from "@alfred/type";

import {
  mapWorkflowResource,
  type WorkflowInputPayload,
} from "@alfred/agent/workflow/schema";
import { consumeRouteRateLimit } from "@alfred/api/trpc";
import * as policyRepo from "@alfred/db/repo/policy";
import { evaluate } from "@alfred/policy";

import { policyDecisionsTotal, policyObligationsTotal } from "../metrics";
import {
  getSessionUser,
  getSessionUserId,
  getSessionUserRoles,
  getSessionUserScopes,
} from "../utils/session";

type Session = Awaited<ReturnType<(typeof auth)["api"]["getSession"]>>;

type EnforceArgs = {
  request?: Request;
  session: Session | null;
  input: WorkflowInputPayload;
};

type EnforcementResult = {
  obligations: Obligation[];
};

export async function enforceWorkflowPlanPolicy({
  session,
  input,
}: EnforceArgs): Promise<EnforcementResult> {
  if (!session?.user?.id) {
    const error = new Error("session_required");
    (error as unknown as Record<string, unknown>).statusCode = 401;
    throw error;
  }

  const user = getSessionUser(session);
  const subjectId = getSessionUserId(user);

  consumeRouteRateLimit("workflow.streamPipeline", session.user.id);

  const resource = mapWorkflowResource(input);
  const evaluation = {
    subject: {
      id: subjectId,
      roles: getSessionUserRoles(user),
      scopes: getSessionUserScopes(user) ?? undefined,
    },
    action: "workflow.plan",
    resource,
    context: {},
  } as const;

  const decision = await evaluate(evaluation);

  await policyRepo.createAuditLog({
    userId: subjectId,
    action: "workflow.plan",
    resource,
    decision: decision.allow ? "allow" : "deny",
    traceId: null,
    obligations: decision.obligations,
    context: {},
  });

  policyDecisionsTotal
    .labels("workflow.plan", decision.allow ? "allow" : "deny")
    .inc();
  if (decision.obligations && decision.obligations.length > 0) {
    for (const obligation of decision.obligations) {
      policyObligationsTotal.labels("workflow.plan", obligation.type).inc();
    }
  }

  if (!decision.allow) {
    const error = new Error(decision.reason ?? "access_denied");
    (error as unknown as Record<string, unknown>).statusCode = 403;
    throw error;
  }

  return {
    obligations: decision.obligations ?? [],
  };
}
