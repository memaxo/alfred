import type { Obligation as SharedObligation } from "@alfred/type";

export type Obligation = SharedObligation;

export interface PolicyRole {
  scopes: string[];
}

export interface PolicyCondition {
  /**
   * Source object for the condition. Currently only `context` is supported.
   */
  source?: "context";
  /**
   * Dot-separated path to a value within the source object.
   */
  field: string;
  equals?: unknown;
  notEquals?: unknown;
  in?: unknown[];
  notIn?: unknown[];
  exists?: boolean;
  gt?: number;
  gte?: number;
  lt?: number;
  lte?: number;
}

export interface PolicyResourceMatch {
  kind?: string;
  ids?: string[];
}

export interface PolicyRule {
  id: string;
  effect?: "allow" | "deny";
  actions: string[];
  roles?: string[];
  resource?: PolicyResourceMatch;
  conditions?: PolicyCondition[];
  obligations?: Obligation[];
  description?: string;
  priority?: number;
}

export interface PolicyDocument {
  roles: Record<string, PolicyRole>;
  rules: PolicyRule[];
  scopes: string[];
}

export interface PolicySubject {
  id: string;
  roles: string[];
  scopes?: string[];
}

export interface PolicyResource {
  kind: string;
  id?: string;
  attrs?: Record<string, unknown>;
}

export interface EvaluateInput {
  subject: PolicySubject;
  action: string;
  resource: PolicyResource;
  context?: Record<string, unknown>;
  traceId?: string;
}

export interface Decision {
  allow: boolean;
  obligations: Obligation[];
  reason?: string;
  ruleIds?: string[];
}

export const DEFAULT_POLICY_PATH = "config/policy.yaml";
