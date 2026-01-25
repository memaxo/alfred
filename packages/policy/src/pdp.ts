import type { Decision, EvaluateInput, Obligation, PolicyRule } from "./types";

import { loadPolicy } from "./load";
import { ruleMatches } from "./rule";

const CACHE_TTL_MS = 30_000;

interface CachedDecision {
  expiresAt: number;
  decision: Decision;
}

const cache = new Map<string, CachedDecision>();

type CacheObserver = (result: "hit" | "miss") => void;

let cacheObserver: CacheObserver | null = null;

export function registerCacheObs(observer: CacheObserver | null) {
  cacheObserver = observer;
}

function computeCacheKey(input: EvaluateInput): string {
  const resourceKey = `${input.resource.kind}:${input.resource.id ?? "*"}`;
  const rolesKey = input.subject.roles.sort().join(",");
  const contextKey = input.context ? JSON.stringify(input.context) : "";
  return [rolesKey, input.action, resourceKey, contextKey].join("|");
}

function aggregateObligations(rules: PolicyRule[]): Obligation[] {
  const map = new Map<string, Obligation>();
  for (const rule of rules) {
    if (!rule.obligations) {
      continue;
    }
    for (const obligation of rule.obligations) {
      const metaKey = JSON.stringify(obligation.metadata ?? null);
      const key = `${obligation.type}:${obligation.reason}:${metaKey}`;
      if (map.has(key)) {
        continue;
      }
      map.set(key, obligation);
    }
  }
  return [...map.values()];
}

export async function evaluate(input: EvaluateInput): Promise<Decision> {
  const key = computeCacheKey(input);
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    cacheObserver?.("hit");
    return cached.decision;
  }

  cacheObserver?.("miss");

  const policy = await loadPolicy();
  const subjectRoles =
    input.subject.roles.length > 0 ? input.subject.roles : ["user"];

  // Determine scopes granted by roles (plus explicit subject scopes)
  const scopeSet = new Set<string>(input.subject.scopes ?? []);
  for (const role of subjectRoles) {
    const policyRole = policy.roles[role];
    if (policyRole) {
      for (const scope of policyRole.scopes) {
        scopeSet.add(scope);
      }
    }
  }

  const hasScope =
    scopeSet.has(input.action) || policy.scopes.includes(input.action);

  // Gather all matching rules
  const matchingRules = (policy.rules ?? [])
    .filter((rule) => ruleMatches(rule, input, subjectRoles))
    .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));

  const hasAllowRule = matchingRules.some(
    (rule) => (rule.effect ?? "allow") === "allow"
  );

  if (!(hasScope || hasAllowRule)) {
    const decision: Decision = {
      allow: false,
      obligations: [],
      reason: "missing_scope",
    };
    cache.set(key, { decision, expiresAt: Date.now() + CACHE_TTL_MS });
    return decision;
  }

  const denyRule = matchingRules.find(
    (rule) => (rule.effect ?? "allow") === "deny"
  );
  if (denyRule) {
    const decision: Decision = {
      allow: false,
      obligations: denyRule.obligations ?? [],
      reason: denyRule.description ?? denyRule.id ?? "denied",
      ruleIds: [denyRule.id],
    };
    cache.set(key, { decision, expiresAt: Date.now() + CACHE_TTL_MS });
    return decision;
  }

  const allowRules = matchingRules.filter(
    (rule) => (rule.effect ?? "allow") === "allow"
  );
  const obligations = aggregateObligations(allowRules);
  const decision: Decision = {
    allow: true,
    obligations,
    reason:
      allowRules.length > 0
        ? allowRules
            .map((rule) => rule.description ?? rule.id)
            .filter(Boolean)
            .join(", ") || undefined
        : undefined,
    ruleIds: allowRules.map((rule) => rule.id),
  };

  cache.set(key, { decision, expiresAt: Date.now() + CACHE_TTL_MS });
  return decision;
}
