import type { Obligation as SharedObligation } from "@alfred/type";

export type Obligation = SharedObligation;

export type PolicyRole = {
  scopes: string[];
};

export type PolicyCondition = {
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
};

export type PolicyResourceMatch = {
  kind?: string;
  ids?: string[];
};

export type PolicyRule = {
  id: string;
  effect?: "allow" | "deny";
  actions: string[];
  roles?: string[];
  resource?: PolicyResourceMatch;
  conditions?: PolicyCondition[];
  obligations?: Obligation[];
  description?: string;
  priority?: number;
};

export type PolicyDocument = {
  roles: Record<string, PolicyRole>;
  rules: PolicyRule[];
  scopes: string[];
};

export type PolicySubject = {
  id: string;
  roles: string[];
  scopes?: string[];
};

export type PolicyResource = {
  kind: string;
  id?: string;
  attrs?: Record<string, unknown>;
};

export type EvaluateInput = {
  subject: PolicySubject;
  action: string;
  resource: PolicyResource;
  context?: Record<string, unknown>;
  traceId?: string;
};

export type Decision = {
  allow: boolean;
  obligations: Obligation[];
  reason?: string;
  ruleIds?: string[];
};

export const DEFAULT_POLICY_PATH = "config/policy.yaml";
