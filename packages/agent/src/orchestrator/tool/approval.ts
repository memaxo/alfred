import { requireToolScopesAndPolicy } from "@alfred/auth/token";
import type { Tool } from "ai";

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
    try {
      const check = policyCheck(input);
      const authz = check.authz;

      if (!authz) {
        return true;
      }

      const result = await requireToolScopesAndPolicy(authz, check.scopes, {
        action: check.action,
        resource: check.resource,
        context: check.context,
      });

      const obligations = (result as any).obligations as string[] | undefined;

      if (obligations?.includes("require_confirmation")) {
        return true;
      }

      if (
        obligations?.includes("require_biometric") &&
        result.claims.mfa !== "passkey"
      ) {
        return true;
      }

      return false;
    } catch (error) {
      console.warn("policy_check_failed_in_approval", {
        tool: tool.description,
        error: error instanceof Error ? error.message : String(error),
      });
      return true;
    }
  };

  return {
    ...tool,
    needsApproval,
  } as Tool<TInput, TOutput>;
}
