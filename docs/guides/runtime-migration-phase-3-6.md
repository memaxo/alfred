# Phase 3.6: Runtime Migration - Local Setup

**Context**: Single-user local system. No production deployment, no staged rollout needed.

## Simple Migration Plan

### Step 1: Enable Runtime (5 minutes)

```bash
# In your .env or export in shell
export USE_WORKFLOW_RUNTIME=true

# Restart your dev server
bun run dev
```

### Step 2: Test It Works (15 minutes)

**Try a simple workflow:**
```bash
# Via UI or API
# Create a test workflow like "create a hello.txt file"
```

**Check the logs:**
```bash
grep "runtime_execution" logs/
grep "runtime_phase" logs/
```

**Verify metrics appear:**
```bash
curl http://localhost:3000/api/metrics | grep runtime_
```

**Check Grafana (if you have it running):**
- Open Grafana dashboards
- Should see runtime metrics incrementing
- Workflows should still complete successfully

### Step 3: Use It for a While (1-2 days)

Just use Alfred normally. If things work fine, proceed to cleanup.

**What to watch for:**
- Workflows complete successfully
- Resume/cancel still work
- Events look the same in UI
- No weird errors in logs

**If something breaks:**
```bash
# Roll back immediately
export USE_WORKFLOW_RUNTIME=false
# Restart
bun run dev
```

### Step 4: Clean Up Deprecated Code (30 minutes)

Once you're confident runtime works, remove the old code.

**4.1 Remove feature flag logic:**

```typescript
// packages/api/src/routers/workflow.ts

// DELETE these lines:
const USE_WORKFLOW_RUNTIME = process.env.USE_WORKFLOW_RUNTIME === "true";

// DELETE the conditional in createWorkflowExecutor:
function createWorkflowExecutor(...) {
  // Delete: if (USE_WORKFLOW_RUNTIME) { ... } else { ... }
  
  // Keep only the runtime path:
  const model = openai(process.env.OPENAI_MODEL_PLAN ?? "gpt-4o");
  return createRuntime({
    input: { /* ... */ },
    model,
    signal: abortController.signal,
  });
}
```

**4.2 Remove old runner:**

```bash
# Delete the deprecated runner file
rm packages/api/src/workflow/runner.ts

# Remove import from workflow.ts
# Delete line: import { runPlanV6 } from '../workflow/runner';
```

**4.3 Update tests:**

```bash
# Find tests that reference runPlanV6
grep -r "runPlanV6" packages/api/test/

# Update them to test createRuntime instead
# Or delete them if they're duplicates of runtime tests
```

**4.4 Run tests to verify:**

```bash
cd packages/api
bun test

cd ../runtime
bun test
```

### Step 5: Done! 

That's it. Runtime is now the default, old code is gone.

## Troubleshooting

### Issue: Workflows fail with runtime

**Check logs:**
```bash
grep "runtime_execution_failed" logs/ | jq .
```

**Common causes:**
- Model API key issues
- Database connection problems
- Missing environment variables

**Quick fix:**
```bash
# Roll back
export USE_WORKFLOW_RUNTIME=false
# Fix the issue
# Try again
```

### Issue: Metrics not appearing

**Verify runtime is enabled:**
```bash
# Should see runtime metrics
curl -s http://localhost:3000/api/metrics | grep runtime_executions_total
```

**If zero:**
- Runtime might not be enabled (check env var)
- No workflows have run yet (try creating one)

### Issue: Events look different

**Compare events:**
```bash
# Old runner events
grep "workflow_stream_events" logs/ | jq .eventData

# New runtime events  
grep "runtime_execution" logs/ | jq .
```

Events should be identical. If not, that's a bug.

## Quick Reference

### Enable Runtime
```bash
export USE_WORKFLOW_RUNTIME=true
```

### Disable Runtime (rollback)
```bash
export USE_WORKFLOW_RUNTIME=false
```

### Check Runtime Status
```bash
curl -s http://localhost:3000/api/metrics | grep runtime_executions_total
```

### View Runtime Logs
```bash
grep "runtime_" logs/ | tail -50
```

## Files to Delete (Step 4)

- `packages/api/src/workflow/runner.ts` - The old runner
- Feature flag code in `packages/api/src/routers/workflow.ts` (lines 35, 49-105)
- Import statement for `runPlanV6` (line 32)

## That's It

No canary deployments. No monitoring periods. No rollout plans.

Just:
1. Enable it
2. Test it  
3. Use it for a bit
4. Delete the old code

Done.
