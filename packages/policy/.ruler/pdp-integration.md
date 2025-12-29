# PDP Integration Patterns

## Core Principle

Call `evaluate()` for authorization. Cache decisions 30s by key. Deny rules override allow rules. Obligations aggregate.

## Rules

1. **Evaluation call.** Call `evaluate({ subject, action, resource, context? })`. Subject requires: `id`, `roles[]`, `scopes?`. Resource requires: `kind`, `id?`.

2. **Cache key format.** Format as `sortedRoles|action|kind:id|jsonContext`. Must be deterministic for same inputs.

3. **Cache TTL.** Decisions cache 30 seconds (`CACHE_TTL_MS`). Never cache decisions longer.

4. **Cache observers.** Register observer via `registerCacheObs()` for hit/miss metrics. Must call on every cache lookup.

5. **Scope derivation.** Merge subject scopes with role scopes. Use Set for de-duplication. Default to `["user"]` when roles empty.

6. **Rule matching.** Call `ruleMatches(rule, input, subjectRoles)`. Filter to matching rules. Sort by `priority` descending.

7. **Deny precedence.** Find first deny rule when `effect: "deny"`. Deny decisions ignore allow rules. Return deny obligations.

8. **Allow determination.** Allow when scope matches OR allow rule exists. Return aggregated obligations from all allow rules.

9. **Obligation aggregation.** Use `aggregateObligations(allowRules)`. Deduplicate by `type:reason:metadata`. Never return duplicates.

10. **Decision response.** Return `{ allow, obligations[], reason?, ruleIds[] }`. Set `reason: "missing_scope"` when no scope/rules match.

## See Also

- `.ruler/policy.md` for security expectations
