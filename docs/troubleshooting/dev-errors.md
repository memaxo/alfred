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
These warnings are **informational only** and can be safely ignored. The dynamic imports are working as intended. To suppress warnings, add `/* @vite-ignore */` comments:

```typescript
// Example: packages/runtime/src/orchestrator/review.js
const { workflowRepo } = await import(
  /* @vite-ignore */
  `${dbPkg}/repo/workflow`
);
```

**Note:** Suppressing warnings is optional. The code functions correctly without suppression.

## Issue 3: Voice Pools Initialization Failure

### Error
```
[ERROR] voice_pools_init_failed {
  error: "ENOENT: no such file or directory, posix_spawn '/Users/jackmazac/.local/bin/uv'",
}
```

### Root Cause
UV (Python package manager) is not installed or not in PATH. This is expected when:
- Local voice models are not being used (`VOICE_PROVIDER=openai` by default)
- UV is not installed for local voice processing

### Solution

**If using local voice models:**
```bash
# Install UV
curl -LsSf https://astral.sh/uv/install.sh | sh

# Or install Python dependencies manually
cd packages/voice && ./scripts/install-deps.sh
```

**If using OpenAI voice (default):**
This error can be safely ignored. The voice system will fall back to OpenAI APIs.

## Additional Notes

### Route File Warnings
```
Route file ".../__tests__/graceful.test.ts" does not contain any route piece.
```
These are expected. Test files in `__tests__` directories are not route files and can be ignored.

### Database Unavailable Warning
```
[WARN] db_unavailable_skipping_services
```
This is expected when the database is not running. Start it with `bun run db:start`.

## Quick Fix Checklist

- [x] **Database user created** - The `alfred` user has been created in the database
- [ ] Verify connection works (restart dev server)
- [ ] Run migrations: `bun run db:migrate` (if not already done)
- [ ] (Optional) Install UV if using local voice models
- [ ] (Optional) Suppress Vite warnings with `/* @vite-ignore */` comments

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
- Changed from `db.execute({ sql: "SELECT 1" })` to `db.execute(sql\`SELECT 1\`)` using Drizzle's `sql` template

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

