import * as policyRepo from "@alfred/db/repo/policy";
import { evaluate } from "@alfred/policy";
import type { EvaluateInput, PolicyResource } from "@alfred/policy";
import { TRPCError } from "@trpc/server";
import type { Context } from "./context";
import { t } from "./trpc";
import { policyDecisionsTotal, policyObligationsTotal } from "./metrics";

type MapResourceFn = (input: unknown, ctx: Context, path?: string) => PolicyResource;
type BuildContextFn = (input: unknown, ctx: Context) => Record<string, unknown>;

function defaultResource(path: string | undefined, action: string): PolicyResource {
  return {
    kind: "route",
    id: path ?? action,
  };
}

export function requirePolicy(
  action: string,
  mapResource?: MapResourceFn,
  buildContext?: BuildContextFn,
) {
  return t.middleware(async ({ ctx, input, path, next }) => {
    const sessionUser = ctx.session?.user as (Context["session"] extends { user: infer U } ? U : any) | undefined;
    const subjectId = sessionUser?.id ?? "anonymous";
    const rawRoles: unknown[] = Array.isArray((sessionUser as any)?.roles)
      ? (sessionUser as any).roles
      : [];
    const subjectRoles = rawRoles
      .filter((role): role is string => typeof role === "string")
      .map(role => role.trim())
      .filter(role => role.length > 0);
    const resource = mapResource ? mapResource(input, ctx, path) : defaultResource(path, action);
    const policyContext = buildContext ? buildContext(input, ctx) : {};

    const evaluation: EvaluateInput = {
      subject: {
        id: subjectId,
        roles: subjectRoles,
        scopes: Array.isArray((sessionUser as any)?.scopes) ? (sessionUser as any).scopes : undefined,
      },
      action,
      resource,
      context: policyContext,
    };

    const decision = await evaluate(evaluation);

    await policyRepo.createAuditLog({
      userId: subjectId,
      action,
      resource,
      decision: decision.allow ? "allow" : "deny",
      traceId: null,
      obligations: decision.obligations,
      context: policyContext,
    });

    const decisionLabel = decision.allow ? "allow" : "deny";
    policyDecisionsTotal.labels(action, decisionLabel).inc();
    if (decision.obligations && decision.obligations.length > 0) {
      for (const obligation of decision.obligations) {
        policyObligationsTotal.labels(action, obligation).inc();
      }
    }

    if (!decision.allow) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: decision.reason ?? "forbidden",
      });
    }

    return next({
      ctx: {
        ...ctx,
        policy: {
          obligations: decision.obligations,
        },
      },
    });
  });
}
