# Troubleshooting Guide

**Owner:** Infrastructure  
**Last Updated:** 2025-11-26

## Purpose

This guide helps developers diagnose and fix common issues encountered when working with ALFRED.

## Build & Development Issues

### Build Verification Failures

**Symptom:** `scripts/verify-build.ts` fails with "Server code leaked into client bundle"

**Cause:** Server-only packages imported at top level in API routes

**Solution:**
1. Find the leaked package in error output
2. Convert to variable-based dynamic import:
   ```typescript
   // ❌ BEFORE
   import { db } from "@alfred/db";
   
   // ✅ AFTER
   const dbPkg = "@alfred/db";
   const { db } = await import(dbPkg);
   ```
3. Ensure package is in `apps/web/vite.config.ts` `ssr.external` array

**Reference:** `.ruler/21-tanstack-start.md` rule 21

### Type Errors After Changes

**Symptom:** TypeScript errors after modifying code

**Solution:**
```bash
# Check all type errors
bun run typecheck

# Fix specific package
cd packages/<package>
bun run typecheck
```

**Common Causes:**
- Missing type imports
- Incorrect type assertions
- Circular dependencies

### Database Connection Errors

**Symptom:** `ECONNREFUSED` or "database does not exist" errors

**Solution:**
```bash
# Start Postgres
bun run db:start

# Verify connection
bun run db:migrate

# Check DATABASE_URL in .env
echo $DATABASE_URL
```

**Common Issues:**
- Postgres not running
- Wrong `DATABASE_URL`
- Missing pgvector extension

### Migration Failures

**Symptom:** Migration fails with "relation already exists" or "column already exists"

**Solution:**
1. Check migration status:
   ```bash
   bun run db:migrate --plan
   ```
2. If migration partially applied:
   - Manually fix database state
   - Or rollback and reapply
3. Ensure migrations are idempotent (use `IF NOT EXISTS`)

**Reference:** `.ruler/04-database.md` rule 3

## Runtime Issues

### Workflow Timeouts

**Symptom:** Workflows fail with timeout errors

**Diagnosis:**
- Check `workflow_stream_duration_seconds` metric
- Review workflow logs for slow operations
- Verify external API responses

**Solution:**
- Increase timeout (default: 30 minutes)
- Break workflow into smaller steps
- Add retry logic for transient failures

**Reference:** `.ruler/17-workflow-patterns.md` rule 2

### Workflow Suspension Not Resuming

**Symptom:** Suspended workflows don't resume after biometric elevation

**Diagnosis:**
1. Check `workflow_runs` table: `status = 'suspended'`
2. Verify `resume` endpoint called with elevated token
3. Check `run_registry` for registered resume handler

**Solution:**
- Verify biometric challenge completed
- Check elevated token has `elevated=true` claim
- Ensure `workflow.resume` endpoint called correctly

**Reference:** `docs/execplans/suspend-resume-biometric.md`

### Cognitive Loop Not Processing Events

**Symptom:** Cognitive state not updating, events not persisting

**Diagnosis:**
1. Check `cognitive_events` table for new events
2. Verify `runCognitiveLoop` called from voice/chat
3. Check logs for `cognitive_*` errors

**Solution:**
- Verify `cognitiveRepo` initialized correctly
- Check event payload format matches `Event` type
- Ensure `streamId` consistent across calls

**Reference:** `docs/guides/cognitive-architecture.md`

## Voice System Issues

### Voice Pool Crashes

**Symptom:** STT/TTS pools crash or restart frequently

**Diagnosis:**
1. Check pool logs for Python errors
2. Verify model files exist
3. Check system resources (memory, CPU)

**Solution:**
- Restart pools: `POST /api/admin/voice/restart-pool`
- Check Python dependencies installed
- Verify model paths in config

**Reference:** `docs/architecture/voice.md`

### Voice WebSocket Disconnects

**Symptom:** Voice sessions disconnect unexpectedly

**Diagnosis:**
1. Check `voice_session_duration_seconds` metric
2. Review WebSocket error logs
3. Verify network stability

**Solution:**
- Check idle timeout (default: 5 minutes)
- Verify WebSocket keepalive configured
- Review client-side reconnection logic

### VAD Not Detecting Speech

**Symptom:** Auto-stop not triggering, VAD always low

**Diagnosis:**
1. Check `voice_vad_level` metric
2. Verify audio input format (sample rate, channels)
3. Check Silero VAD model loaded

**Solution:**
- Verify audio format matches expected (16kHz, mono)
- Check VAD threshold settings
- Restart STT pool to reload VAD model

## Linear Integration Issues

### Activities Not Appearing

**Symptom:** Linear activities not showing in issue timeline

**Diagnosis:**
1. Check `linear_activity_emissions_total{status="failure"}` metric
2. Verify OAuth token valid (`linear_installations` table)
3. Check Linear API logs

**Solution:**
- Re-authenticate Linear OAuth
- Verify `LINEAR_CLIENT_ID` and `LINEAR_CLIENT_SECRET` correct
- Check Linear API rate limits

**Reference:** `docs/guides/linear-integration.md`

### 10-Second Timeout

**Symptom:** First activity not emitted within 10 seconds

**Diagnosis:**
- Check `linear_activity_duration_seconds{type="thought"}` metric
- Verify Linear API reachable
- Check for rate limiting (429 errors)

**Solution:**
- Ensure `emitLinearActivity` called immediately on workflow start
- Use `Promise.race` with 9-second timeout
- Check network connectivity to Linear API

### Webhook Not Working

**Symptom:** Webhook events not triggering workflows

**Diagnosis:**
1. Check `linear_webhook_events_total` metric
2. Verify webhook signature verification logs
3. Ensure webhook endpoint accessible

**Solution:**
- Verify `LINEAR_WEBHOOK_SECRET` matches Linear settings
- Use ngrok for local development
- Check webhook handler logs for errors

## Memory System Issues

### Memory Decay Too Aggressive

**Symptom:** Memory nodes decaying too quickly

**Diagnosis:**
- Check `memoryNodesDecayedTotal` metric
- Review decay configuration (`decayLimit`, `confidenceFloor`)
- Verify `updated` timestamps updating correctly

**Solution:**
- Adjust `decayLimit` (default: 1000 per cycle)
- Increase `confidenceFloor` (default: 0.01)
- Verify Active Recall touching nodes on retrieval

**Reference:** `docs/execplans/memory-system-hardening.md`

### Memory Maintenance Slow

**Symptom:** `processMemoryMaintenance` takes too long

**Diagnosis:**
- Check `memoryMaintenanceDurationSeconds` metric
- Review bulk update queries
- Verify indexes exist

**Solution:**
- Optimize bulk updates (use `UPDATE ... FROM (VALUES ...)`)
- Add indexes for decay queries
- Increase maintenance interval

## Testing Issues

### Tests Failing with Database Errors

**Symptom:** Tests fail with "database does not exist" or connection errors

**Solution:**
```bash
# Use SQLite fallback (fast, no DB required)
bun run test:sqlite

# Or set DATABASE_URL for Postgres tests
RUN_DB_TESTS=1 bun test
```

**Reference:** `.ruler/05-testing.md` rule 7

### E2E Tests Timing Out

**Symptom:** Playwright tests timeout in CI

**Solution:**
- Use `VITE_TEST_MODE=true` for "Lite Mode"
- Disable heavy visualizations (Mindscape physics)
- Increase timeout in `playwright.config.ts`

**Reference:** `.ruler/22-bun-runtime.md` rule 16

### Mock Issues in Tests

**Symptom:** Tests fail because real systems not mocked

**Solution:**
- Use fixtures from `@alfred/test-kit` instead of mocks
- Use `@alfred/test-kit/voice/runtime-fixture` for voice tests
- Use `@alfred/test-kit/workflow/runtime-fixture` for workflow tests

**Reference:** `.ruler/05-testing.md` rule 17

## Performance Issues

### Slow Query Performance

**Symptom:** Database queries exceed <10ms budget

**Diagnosis:**
1. Check query execution plans
2. Verify indexes exist
3. Review query patterns

**Solution:**
- Add indexes matching query predicates
- Use batch operations instead of loops
- Optimize with `EXPLAIN ANALYZE`

**Reference:** `.ruler/19-drizzle-patterns.md` rule 9

### Hot Path Exceeding Budgets

**Symptom:** Cognitive transitions exceed <100µs budget

**Diagnosis:**
- Instrument with `performance.now()`
- Check Prometheus metrics
- Profile with Bun profiler

**Solution:**
- Optimize hot loops (avoid allocations)
- Use pure functions (no side effects)
- Cache expensive computations

**Reference:** `.ruler/09-purity-and-performance.md` rule 2

## Getting Help

### Logs

Check structured logs for context:
```bash
# Search logs for error
rg "error_type" logs/

# Check specific run
rg "runId.*abc123" logs/
```

### Metrics

Check Prometheus metrics:
```bash
curl http://localhost:3000/api/metrics | grep metric_name
```

### Debugging

Enable debug logging:
```bash
LOG_LEVEL=debug bun run dev
```

## Related Documentation

- [Developer Onboarding](./developer-onboarding.md) - Setup and common workflows
- [Common Patterns](./common-patterns.md) - Code patterns and anti-patterns
- [Error Handling Rules](../../.ruler/16-error-handling.md) - Error handling standards

