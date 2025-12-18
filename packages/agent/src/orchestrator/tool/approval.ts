import { requireToolScopesAndPolicy } from "@alfred/auth/token";
import { logger } from "@alfred/logger";
import type { Tool } from "ai";

import { recordPolicyCheckFailure } from "../../metrics";

/**
 * Wraps a tool with AI SDK v6 'needsApproval' logic based on ALFRED policy.
 *
 * @param tool The original AI SDK tool definition
 * @param policyCheck A function that returns the required scopes and resource context for the input
 */
export function withPolicyApproval<TInput, TOutput>(
  tool: Tool<TInput, TOutput>,
  policyCheck: (input: TInput) => {
    action: string;
    resource: { kind: string; id: string };
    scopes: string[];
    authz?: string;
    context?: Record<string, unknown>;
  }
): Tool<TInput, TOutput> {
  const needsApproval = async (input: TInput) => {
    type PolicyContext = ReturnType<typeof policyCheck>;
    let policyContext: PolicyContext | null = null;

    try {
      const check = policyCheck(input);
      policyContext = check;
      const authz = check.authz;

      if (!authz) {
        return true;
      }

      const result = await requireToolScopesAndPolicy(authz, check.scopes, {
        action: check.action,
        resource: check.resource,
        context: check.context,
      });

      const obligationTypes = result.decision.obligations.map((o) =>
        typeof o === "string" ? o : o.type
      );

      if (obligationTypes.includes("require_confirmation")) {
        return true;
      }

      if (
        obligationTypes.includes("require_biometric") &&
        result.claims.mfa !== "passkey"
      ) {
        return true;
      }

      return false;
    } catch (error) {
      const descriptor = (tool as { name?: string }).name ?? tool.description;
      const toolName = descriptor ?? "unknown_tool";

      logger.warn("policy_check_failed_in_approval", {
        tool: toolName,
        action: policyContext?.action ?? "unknown_action",
        resource: policyContext?.resource ?? null,
        error: error instanceof Error ? error.message : String(error),
      });
      recordPolicyCheckFailure(toolName);
      // Security: fail closed by requiring human approval when policy enforcement errors, so unverified actions never auto-run.
      return true;
    }
  };

  return {
    ...tool,
    needsApproval,
  } as Tool<TInput, TOutput>;
}
