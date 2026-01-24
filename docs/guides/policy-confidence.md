# Policy: Memory Confidence

## Overview

ALFRED's Policy Decision Point (PDP) supports enforcing confidence thresholds on memory used during agent execution. This ensures that high-stakes actions (like deployments or payments) are not performed based on low-confidence or stale information.

## Configuration

### Numeric Conditions

The policy engine supports numeric comparison operators for conditions targeting the `context` object:

- `gt`: Greater than
- `gte`: Greater than or equal
- `lt`: Less than
- `lte`: Less than or equal

### Usage

To enforce memory confidence, the agent or tool executor must inject the confidence score into the policy context when requesting approval.

```typescript
// Example: Agent requesting tool execution
await requireToolScopesAndPolicy(authz, ["deploy.write"], {
  action: "deploy.create",
  resource: { kind: "deployment", id: "prod" },
  context: {
    memoryConfidence: 0.45, // Derived from the memory nodes used in reasoning
  },
});
```

### Policy Rule Example

Add this rule to `config/policy.yaml` to block low-confidence deployments:

```yaml
- id: deny-low-confidence-deploy
  description: "Prevent deployments based on low-confidence memory"
  effect: deny
  actions: ["deploy.create", "deploy.update"]
  conditions:
    - field: memoryConfidence
      lte: 0.5
  obligations:
    - "verify_information"
```

## Integration Pattern

1.  **Agent**: When retrieving memory, calculate the aggregate confidence (e.g., minimum or average of relevant nodes).
2.  **Orchestrator**: Pass this `memoryConfidence` in the `context` when calling `tool.execute`.
3.  **Tool**: Forward the `context` to `requireToolScopesAndPolicy`.
4.  **Policy**: Evaluate the rule. If denied, the agent receives an error and must perform the obligation (e.g., search/verify) to improve confidence before retrying.
