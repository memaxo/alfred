/**
 * Policy Engine Wrapper
 *
 * Wraps policy evaluation functions from @alfred/policy
 * Provides pure policy decisions without side effects
 */

import { type Decision, type EvaluateInput, evaluate } from "@alfred/policy";

/**
 * PolicyEngine provides policy evaluation operations
 *
 * All methods are pure - they evaluate policy and return decisions.
 * No persistence, no audit logging (runtime handles that).
 */
export class PolicyEngine {
  /**
   * Evaluate policy for an action
   *
   * Returns decision (allow/deny) with optional obligations
   */
  async evaluate(input: EvaluateInput): Promise<Decision> {
    return evaluate(input);
  }

  /**
   * Check if action is permitted
   *
   * Convenience method for simple allow/deny checks
   */
  async isPermitted(input: EvaluateInput): Promise<boolean> {
    const decision = await evaluate(input);
    return decision.allow;
  }

  /**
   * Get obligations for permitted action
   *
   * Returns empty array if denied or no obligations
   */
  async getObligations(input: EvaluateInput): Promise<string[]> {
    const decision = await evaluate(input);
    if (!decision.allow) {
      return [];
    }
    return decision.obligations ?? [];
  }
}
