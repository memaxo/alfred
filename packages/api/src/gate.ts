import type { EvaluateInput, PolicyResource } from "@alfred/policy";
import type { Obligation } from "@alfred/type";

import * as policyRepo from "@alfred/db/repo/policy";
import { evaluate } from "@alfred/policy";
import { TRPCError } from "@trpc/server";

import type { Context } from "./context";

import { PolicyObligationError } from "./errors";
import { t } from "./trpc";
import {
  getSessionUser,
  getSessionUserId,
  getSessionUserRoles,
  getSessionUserScopes,
} from "./utils/session";

type MapResourceFn = (
  input: unknown,
  ctx: Context,
  path?: string
) => PolicyResource;
type BuildContextFn = (input: unknown, ctx: Context) => Record<string, unknown>;

interface PolicyEnforcementOptions {
  /**
   * Determines how the middleware reacts when obligations are present.
   * "error" (default) throws PRECONDITION_FAILED immediately.
   * "passThrough" leaves handling to downstream code (ctx.policy.obligations).
   */
  handleObligations?: "error" | "passThrough";
}

function defaultResource(
  path: string | undefined,
  action: string
): PolicyResource {
  return {
    kind: "route",
    id: path ?? action,
  };
}

export async function enforcePolicy(
  ctx: Context,
  input: unknown,
  path: string | undefined,
  action: string,
  mapResource?: MapResourceFn,
  buildContext?: BuildContextFn,
  options?: PolicyEnforcementOptions
): Promise<{ obligations: Obligation[] }> {
  const sessionUser = getSessionUser(ctx.session);
  const subjectId = getSessionUserId(sessionUser);
  const subjectRoles = getSessionUserRoles(sessionUser);
  const resource = mapResource
    ? mapResource(input, ctx, path)
    : defaultResource(path, action);
  const policyContext = buildContext ? buildContext(input, ctx) : {};

  const evaluation: EvaluateInput = {
    subject: {
      id: subjectId,
      roles: subjectRoles,
      scopes: getSessionUserScopes(sessionUser) ?? undefined,
    },
    action,
    resource,
    context: policyContext,
  };

  const decision = await evaluate(evaluation);
  const obligations = (decision.obligations ?? []) as Obligation[];
  const obligationHandling = options?.handleObligations ?? "error";

  const inputRecord = (input ?? {}) as Record<string, unknown>;
  const projectId = inputRecord.projectId as string | undefined;

  await policyRepo.createAuditLog({
    userId: subjectId,
    projectId,
    action,
    resource,
    decision: decision.allow ? "allow" : "deny",
    traceId: null,
    obligations,
    context: policyContext,
  });

  try {
    const { policyDecisionsTotal, policyObligationsTotal } =
      await import("@alfred/api/metrics");
    const decisionLabel = decision.allow ? "allow" : "deny";
    policyDecisionsTotal.labels(action, decisionLabel).inc();
    if (obligations.length > 0) {
      for (const obligation of obligations) {
        policyObligationsTotal.labels(action, obligation.type).inc();
      }
    }
  } catch {
    // Metrics failures must never affect policy enforcement.
  }

  if (!decision.allow) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: decision.reason ?? "forbidden",
    });
  }

  if (obligations.length > 0 && obligationHandling === "error") {
    throw new PolicyObligationError(action, obligations);
  }

  return { obligations };
}

export function requirePolicy(
  action: string,
  mapResource?: MapResourceFn,
  buildContext?: BuildContextFn,
  options?: PolicyEnforcementOptions
) {
  return t.middleware(async ({ ctx, input, path, next }) => {
    const { obligations } = await enforcePolicy(
      ctx,
      input,
      path,
      action,
      mapResource,
      buildContext,
      options
    );

    return next({
      ctx: {
        ...ctx,
        policy: {
          obligations,
        },
      },
    });
  });
}
