# ExecPlan Verification

## Core Principle

ExecPlans must accurately reflect implementation status. When verifying features or completing work, systematically check the codebase and update ExecPlan status immediately.

## Rules

1. **Status verification.** When verifying ExecPlan completion status, use systematic codebase search (`rg`, `grep`, `codebase_search`) to find actual implementation before updating status. Never mark ExecPlans complete based on assumptions.

2. **Linear sync.** When updating ExecPlan status, also update corresponding Linear issues to match. Use `mcp_Linear_update_issue` to sync status, description, and progress.

3. **Immediate updates.** Update ExecPlan `Progress`, `Outcomes & Retrospective`, and status immediately after verification—before moving to the next task. Don't batch updates.

4. **Implementation evidence.** When marking ExecPlans complete, include specific file paths and line numbers in the `Outcomes & Retrospective` section to document evidence.

5. **Partial completion.** Mark ExecPlans as "Mostly Complete ⚠️" when core functionality is done but minor items remain. Document remaining work clearly.

6. **Status accuracy.** ExecPlan status must match actual codebase state. If an ExecPlan says "Proposed" but implementation exists, update it immediately.

