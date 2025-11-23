# ExecPlan: Policy Memory Confidence

## Purpose
Integrate memory confidence into the Policy Decision Point (PDP). Ensure that high-stakes actions are not approved if they rely primarily on low-confidence or stale memory nodes, forcing the agent to verify information or request human approval.

## Plan
- [ ] **Context Awareness**: Mechanism to track which memory nodes were used to generate a plan or tool call. (This may require passing `provenance` or `source_confidence` metadata through the context).
- [ ] **Policy Rule Definition**: Add a new Policy Rule type or check in `packages/agent/src/orchestrator/tool/policy.ts`:
    - `REQUIRE_HIGH_CONFIDENCE_CONTEXT`: If the action relies on data derived from memory, that memory must have confidence > X.
- [ ] **Enforcement Logic**: Update the `checkPolicy` function to evaluate this rule. If the context confidence is low, return a `violation` or `obligation`.
    - Possible Obligation: `verify_information` (Agent must run a research/verify step).
    - Possible Obligation: `human_approval` (Escalate to user).
- [ ] **Integration**: Apply this policy to sensitive tool definitions (e.g., `deploy`, `email`, `payment`).

## Progress
- [x] Context Awareness
- [x] Policy Rule Definition
- [x] Enforcement Logic
- [x] Integration

## Surprises & Discoveries
- The `policy` package uses a generic rule evaluation engine (`evaluateCondition`) that supports `gt`, `lt`, `eq` operators on context fields. Therefore, no code changes were needed in `packages/policy` to support the *logic* of the rule, only plumbing the data was required.
- The `CodexToolInput` schema was updated to include `confidence` in the `context` object.
- `enforcePolicy` in `packages/agent/src/orchestrator/tool/codex/policy.ts` was updated to pass `memory_confidence` to the policy evaluator.

## Decision Log
- Decided to add `confidence` to `CodexToolInput.context` rather than a top-level field to keep the schema clean and grouped with other context metadata.
- Decided not to hardcode the rule in TypeScript but rather enable the capability for the Policy Engine to evaluate it. This aligns with the design of `@alfred/policy` being data-driven.

## Outcomes & Retrospective
- The system now supports policies based on Memory Confidence.
- A new `memory_confidence` field is available in the Policy Context for all `droid.exec` actions.
- Verified via unit tests that the confidence value is correctly propagated to the policy evaluator.

