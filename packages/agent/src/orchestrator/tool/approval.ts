import { requireToolScopesAndPolicy } from "@alfred/auth/token";
import { logger } from "@alfred/logger";

import * as metrics from "../../metrics";

export interface AITool<TInput, TOutput> {
  name?: string;
  description: string;
  parameters?: unknown;
  inputSchema?: unknown;
  execute: (input: TInput) => Promise<TOutput> | TOutput;
  needsApproval?: (input: TInput) => Promise<boolean> | boolean;
}

/**
 * Wraps a tool with AI SDK v6 'needsApproval' logic based on ALFRED policy.
 *
 * @param tool The original AI SDK tool definition
 * @param policyCheck A function that returns the required scopes and resource context for the input
 */
export function withPolicyApproval<TInput, TOutput>(
  tool: AITool<TInput, TOutput>,
  policyCheck: (input: TInput) => {
    action: string;
    resource: { kind: string; id: string };
    scopes: string[];
    authz?: string;
    context?: Record<string, unknown>;
  }
): AITool<TInput, TOutput> {
  const needsApproval = async (input: TInput) => {
    type PolicyContext = ReturnType<typeof policyCheck>;
    let policyContext: PolicyContext | null = null;

    try {
      const check = policyCheck(input);
      policyContext = check;
      const { authz } = check;

      if (!authz) {
        return true;
      }

      const result = await requireToolScopesAndPolicy(authz, check.scopes, {
        action: check.action,
        context: check.context,
        resource: check.resource,
      });

      const obligationTypes = new Set(
        result.decision.obligations.map((o) =>
          typeof o === "string" ? o : o.type
        )
      );

      if (obligationTypes.has("require_confirmation")) {
        return true;
      }

      if (
        obligationTypes.has("require_biometric") &&
        result.claims.mfa !== "passkey"
      ) {
        return true;
      }

      return false;
    } catch (error) {
      const descriptor = (tool as { name?: string }).name ?? tool.description;
      const toolName = descriptor ?? "unknown_tool";

      logger.warn("policy_check_failed_in_approval", {
        action: policyContext?.action ?? "unknown_action",
        error: error instanceof Error ? error.message : String(error),
        resource: policyContext?.resource ?? null,
        tool: toolName,
      });
      // Metrics labels must stay low-cardinality; descriptions are not stable IDs.
      if (tool.name) {
        metrics.recordPolicyCheckFailure(tool.name);
      }
      // Security: fail closed by requiring human approval when policy enforcement errors, so unverified actions never auto-run.
      return true;
    }
  };

  return {
    ...tool,
    needsApproval,
  } as AITool<TInput, TOutput>;
}
