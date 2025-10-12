import type { EvaluateInput, PolicyCondition, PolicyResourceMatch, PolicyRule } from "./types";

function patternMatch(value: string | undefined, pattern?: string): boolean {
  if (!pattern) return true;
  if (!value) return false;
  if (pattern === "*") return true;
  if (pattern.endsWith(".*")) {
    const prefix = pattern.slice(0, -2);
    return value.startsWith(prefix);
  }
  return value === pattern;
}

function patternMatchAny(value: string, candidates: string[]): boolean {
  return candidates.some(candidate => patternMatch(value, candidate));
}

function matchesResource(resource: EvaluateInput["resource"], match?: PolicyResourceMatch): boolean {
  if (!match) return true;
  if (!patternMatch(resource.kind, match.kind)) {
    return false;
  }
  if (match.ids && match.ids.length > 0) {
    if (!resource.id) {
      return false;
    }
    return match.ids.includes(resource.id);
  }
  return true;
}

function getValue(source: Record<string, unknown> | undefined, path: string): unknown {
  if (!source) return undefined;
  const segments = path.split(".");
  let current: unknown = source;
  for (const segment of segments) {
    if (current && typeof current === "object" && segment in current) {
      current = (current as Record<string, unknown>)[segment];
    } else {
      return undefined;
    }
  }
  return current;
}

function evaluateCondition(condition: PolicyCondition, ctx: EvaluateInput): boolean {
  const source = condition.source ?? "context";
  if (source !== "context") {
    return true;
  }
  const value = getValue(ctx.context ?? {}, condition.field);

  if (condition.exists === true && value === undefined) {
    return false;
  }
  if (condition.exists === false && value !== undefined) {
    return false;
  }
  if ("equals" in condition && condition.equals !== undefined) {
    return value === condition.equals;
  }
  if ("notEquals" in condition && condition.notEquals !== undefined) {
    return value !== condition.notEquals;
  }
  if (condition.in) {
    return condition.in.includes(value);
  }
  if (condition.notIn) {
    return !condition.notIn.includes(value);
  }
  return true;
}

export function ruleMatches(
  rule: PolicyRule,
  input: EvaluateInput,
  subjectRoles: string[],
): boolean {
  if (!patternMatchAny(input.action, rule.actions)) {
    return false;
  }

  if (rule.roles && rule.roles.length > 0) {
    const hasRole = rule.roles.some(role => subjectRoles.includes(role));
    if (!hasRole) {
      return false;
    }
  }

  if (!matchesResource(input.resource, rule.resource)) {
    return false;
  }

  if (rule.conditions && rule.conditions.length > 0) {
    for (const condition of rule.conditions) {
      if (!evaluateCondition(condition, input)) {
        return false;
      }
    }
  }

  return true;
}
