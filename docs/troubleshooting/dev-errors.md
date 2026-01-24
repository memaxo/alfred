# Development Server Error Investigation

**Date:** 2025-12-04  
**Status:** ✅ Resolved

## Summary

Three categories of issues were identified when running `bun run dev:web`:

1. **Database Authentication Failure** (Critical)
2. **Vite Dynamic Import Warnings** (Non-critical, informational)
3. **Voice Pools Initialization Failure** (Non-critical, expected when UV not installed)

## Issue 1: Database Authentication Failure

### Error

```
error: password authentication failed for user "alfred"
code: "28P01"
```

### Root Cause

Mismatch between database credentials in environment configuration and Docker setup:

- **`config/env.example`**: `DATABASE_URL=postgresql://alfred:alfred@localhost:5432/alfred`
- **`packages/db/docker-compose.yml`**: Creates database with user `postgres` and password `password`

### Solution

**Option A: Update `.env` to match Docker (Recommended)**

```bash
# In your .env file (root or apps/web/.env)
DATABASE_URL=postgresql://postgres:password@localhost:5432/alfred
```

**Option B: Update Docker to match env.example**

```yaml
# In packages/db/docker-compose.yml
environment:
  POSTGRES_USER: alfred
  POSTGRES_PASSWORD: alfred
```

**Option C: Create database user manually**

```bash
# Connect to Postgres
docker exec -it alfred-postgres psql -U postgres

# Create user and grant permissions
CREATE USER alfred WITH PASSWORD 'alfred';
GRANT ALL PRIVILEGES ON DATABASE alfred TO alfred;
\q
```

### Verification

```bash
# Check database is running
bun run db:start

# Verify connection
psql postgresql://postgres:password@localhost:5432/alfred -c "SELECT 1;"
```

## Issue 2: Vite Dynamic Import Warnings

### Warning

```
The above dynamic import cannot be analyzed by Vite.
See https://github.com/rollup/plugins/tree/master/packages/dynamic-import-vars#limitations
```

### Root Cause

Variable-based dynamic imports (e.g., `await import(\`${dbPkg}/repo/workflow\`)`) are intentionally used to prevent server-only code from leaking into client bundles. Vite cannot statically analyze these, but they work correctly at runtime.

### Solution

These warnings are expected **only** when a code path contains an intentionally opaque import and is missing a suppression comment.

ALFRED’s current baseline is **quiet by default**: the dev server should produce **zero** Vite “dynamic import cannot be analyzed” warnings while preserving SSR isolation.

To keep the variable-based pattern (SSR hardening) and suppress Vite’s analyzer warning, add `/* @vite-ignore */` inside the `import()` call:

```typescript
// Example: variable-based SSR-safe import with analyzer suppression
const { workflowRepo } = await import(
  /* @vite-ignore */
  `${dbPkg}/repo/workflow`
);
```

This suppression is safe: it does not make the import “more static”; it only tells Vite not to try to analyze it.

## Issue 3: Voice Pools Initialization Failure

### Error

```
[ERROR] voice_pools_init_failed {
  error: "ENOENT: no such file or directory, posix_spawn '/Users/jackmazac/.local/bin/uv'",
}
```

### Root Cause

The local voice pools use `uv` (Python package manager) to launch and manage the Python processes. This error occurs when `uv` is not runnable.

### Solution

**If using local voice models:**

```bash
# Install UV
curl -LsSf https://astral.sh/uv/install.sh | sh

# Or install Python dependencies manually
cd packages/voice && ./scripts/install-deps.sh
```

**If not using local voice models:**
Set `VOICE_PROVIDER=openai` (or another cloud provider) so the pools are never initialized.

**Baseline expectation (quiet by default):**

- If `VOICE_PROVIDER` selects a local provider but `uv` is missing/unrunnable, ALFRED should log a single WARN about skipping voice pools.
- ERROR-level `voice_pools_init_failed` should only happen when local voice is explicitly enabled and `uv` is runnable, but pool initialization still fails (a true defect).

## Additional Notes

### Route File Warnings

```
Route file ".../__tests__/graceful.test.ts" does not contain any route piece.
```

These are treated as a defect. Test files must not live under `apps/web/src/routes/**` because the route scanner will try to interpret them as routes.

If you see this warning:

- Move the offending `*.test.*` / `*.spec.*` file out of `apps/web/src/routes/**` (for example into `apps/web/src/tests/**`).
- Run the guard test: `cd apps/web && bun test src/tests/routes/hygiene.test.ts`.

### Database Unavailable Warning

```
[WARN] db_unavailable_skipping_services
```

This is expected when the database is not running (or migrations are not applied). Start it with `bun run db:start`.

**Quiet-by-default policy:**

- DB-dependent recovery loops (codex cleanup, plan resume, workflow rehydration) are **opt-in in dev** via `ENABLE_DB_RECOVERY=1`.
- In production, those recovery loops are enabled by default; if the DB is missing/misconfigured you should see **WARN**-level `resume_interrupted_plans_db_unavailable` instead of an ERROR crash.

## Quick Fix Checklist

- [x] **Database user created** - The `alfred` user has been created in the database
- [ ] Verify connection works (restart dev server)
- [ ] Run migrations: `bun run db:migrate` (if not already done)
- [ ] Install UV if using local voice models
- [ ] Add `/* @vite-ignore */` to any intentional variable-based `import()` callsites still producing Vite warnings
- [ ] Ensure no `*.test.*` / `*.spec.*` files exist under `apps/web/src/routes/**` (guarded by `apps/web/src/tests/routes/hygiene.test.ts`)
- [ ] Run the dev-noise guard: `cd apps/web && bun test src/tests/dev/noise.test.ts`

## Applied Fixes

### Database Authentication (Fixed)

- ✅ Created `alfred` user in PostgreSQL database
- ✅ Granted all privileges on `alfred` database
- ✅ Granted schema permissions on `public` schema
- ✅ Transferred ownership of all existing tables to `alfred` user
- ✅ Transferred ownership of all sequences to `alfred` user
- ✅ Set default privileges for future tables/sequences
- ✅ Successfully ran database migrations (3 new migrations applied)

### Database Availability Check (Fixed)

- ✅ Fixed `packages/api/src/utils/service-availability.ts` to use correct Drizzle SQL syntax
- Changed from `db.execute({ sql: "SELECT 1" })` to `db.execute(sql\`SELECT 1\`)`using Drizzle's`sql` template

### Voice Environment (Fixed)

- ✅ Installed Python 3.12 via UV (`uv python install 3.12`)
- ✅ Removed corrupted `.venv` with stub Python file
- ✅ Simplified `pyproject.toml` to avoid cross-platform resolution conflicts
- ✅ Regenerated `uv.lock` for macOS
- ✅ Core voice dependencies (PyTorch, silero-vad) working

### Validation Results

- ✅ Database connection: Working (`SELECT 1` returns successfully)
- ✅ Service availability: `isDbAvailable()` returns `true`
- ✅ UV availability: `isUvAvailable()` returns `true`
- ✅ Dev server: Starts and responds to requests
- ✅ Auth endpoint: `/api/auth/get-session` returns correctly

The dev server now starts without critical errors. Restart to verify.

## Issue 4: Better Auth Module Resolution Failure

### Error

```
[commonjs--resolver] Missing "./tanstack-start" specifier in "better-auth" package
error during build:
Cannot find module 'better-auth/tanstack-start'
```

### Root Cause

Version mismatch between `better-auth` core package and its plugins (`@better-auth/expo`, `@better-auth/passkey`). The `./tanstack-start` subpath export was introduced in `better-auth@1.4.x`, but older versions (1.3.x) only exported `./react-start`.

### Solution

**Align all Better Auth packages to the same minor version:**

```json
// package.json (catalog)
{
  "workspaces": {
    "catalog": {
      "better-auth": "1.4.7"
    }
  }
}

// packages/auth/package.json
{
  "dependencies": {
    "better-auth": "catalog:",
    "@better-auth/expo": "1.4.7",
    "@better-auth/passkey": "1.4.7"
  }
}

// apps/native/package.json
{
  "dependencies": {
    "better-auth": "catalog:",
    "@better-auth/expo": "1.4.7"
  }
}
```

### Verification

```bash
# Reinstall dependencies
bun install --frozen-lockfile

# Verify TypeScript resolution
bun run typecheck

# Verify Vite SSR build
bun run verify:build
```

### Important Notes

- All `better-auth` packages (`better-auth`, `@better-auth/expo`, `@better-auth/passkey`) must be on the same minor version (e.g., all 1.4.x) to avoid subpath export mismatches.
- Use the catalog version for `better-auth` and pin exact versions for plugins.
- The import in `packages/auth/src/index.ts` uses `better-auth/tanstack-start`, which requires `better-auth@1.4.0` or higher.

## Related Documentation

- Database setup: `README.md` → Database Setup
- Environment configuration: `config/env.example`
- SSR hardening: `docs/execplans/ssr-hardening-plan.md`
- Voice local models: `.ruler/25-voice-local-models.md`
- Better Auth integration: `docs/reference/better-auth/integrations/tanstack.md`
