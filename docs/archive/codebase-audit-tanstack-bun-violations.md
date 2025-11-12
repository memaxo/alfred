# Codebase Audit: TanStack Start & Bun Runtime Rule Violations

**Date:** 2025-01-27  
**Scope:** Systematic audit of TanStack Start rules (`.ruler/21-tanstack-start.md`) and Bun runtime standards (`.ruler/22-bun-runtime.md`)

## Executive Summary

**Total Violations Found:** 8  
**Critical:** 0  
**High:** 5  
**Medium:** 2  
**Low:** 1

## TanStack Start Violations

### ✅ Compliance: Router Instance Pattern

**Status:** COMPLIANT

**File:** `apps/web/src/router.tsx`

**Verification:**
- ✅ Exports `getRouter` function (line 45)
- ✅ Returns new router instance per call
- ✅ No singleton router export

---

### ✅ Compliance: Root Route Components

**Status:** COMPLIANT

**File:** `apps/web/src/routes/__root.tsx`

**Verification:**
- ✅ Includes `<HeadContent />` in `<head>` (line 52)
- ✅ Includes `<Scripts />` in `<body>` (line 62)

---

### ✅ Compliance: File-Based Routing

**Status:** COMPLIANT

**Verification:**
- ✅ All routes use `createFileRoute`
- ✅ No manual path construction found
- ✅ Route paths match file structure

---

### ⚠️ Observation: Server Functions Pattern

**Status:** NO VIOLATION (Different Pattern Used)

**Finding:** The codebase uses TanStack Start's `server.handlers` pattern instead of `createServerFn()`. This is acceptable as server routes are explicitly server-only.

**Files Using Server Routes:**
- `apps/web/src/routes/api/ai/$.ts` - Uses `server.handlers`
- `apps/web/src/routes/api/linear/webhook.ts` - Uses `server.handlers`
- `apps/web/src/routes/healthz/deps.ts` - Uses `server.handlers`

**Note:** Server routes (`server.handlers`) are server-only by design and don't require `createServerFn()`. The rule applies when using `createServerFn()` for isomorphic operations.

---

### ✅ Compliance: Route Loaders Are Isomorphic

**Status:** COMPLIANT

**Files Checked:**
- `apps/web/src/routes/ai.tsx` - Loader returns simple data (no server-only operations)
- `apps/web/src/routes/api/ai/$.ts` - Loader returns simple data

**Verification:**
- ✅ No direct database access in loaders
- ✅ No `process.env` access in loaders (except in server routes)
- ✅ Loaders are pure data returns

---

### ✅ Compliance: Environment Variables

**Status:** COMPLIANT

**Files Checked:**
- `apps/web/src/server/bootstrap.ts` - Server-only file, `process.env` access is correct
- `apps/web/src/routes/api/linear/webhook.ts` - Server route handler, `process.env` access is correct

**Verification:**
- ✅ No `process.env` access in client components
- ✅ Server-only code correctly accesses `process.env`
- ✅ No secrets exposed to client bundle

---

## Bun Runtime Violations

### Violation 1: Node.js fs/promises in Migration Script

**File:** `packages/db/scripts/migrate.ts`  
**Lines:** 8, 64  
**Severity:** HIGH  
**Rule:** `.ruler/22-bun-runtime.md` rule #1, #5

**Current Code:**
```typescript
import { readdir, readFile } from "node:fs/promises";
// ...
const sql = await readFile(migration.path, "utf8");
```

**Expected Code:**
```typescript
// Use Bun.file for file operations
const file = Bun.file(migration.path);
const sql = await file.text();

// Use Bun.readdir for directory listing
const entries = await Array.fromAsync(Bun.readdir(MIGRATIONS_DIR));
```

**Impact:** Using Node.js compatibility layer instead of Bun-native APIs reduces performance. Migration scripts run frequently and benefit from Bun's optimized file I/O.

**Recommendation:** Replace `node:fs/promises` with `Bun.file` and `Bun.readdir`.

---

### Violation 2: dotenv Package in Migration Script

**File:** `packages/db/scripts/migrate.ts`  
**Lines:** 11, 17-18  
**Severity:** HIGH  
**Rule:** `.ruler/22-bun-runtime.md` rule #7

**Current Code:**
```typescript
import dotenv from "dotenv";
// ...
dotenv.config({ path: join(__dirname, "../.env") });
dotenv.config();
```

**Expected Code:**
```typescript
// Remove dotenv import and config calls
// Bun automatically loads .env files
const databaseUrl = process.env.DATABASE_URL;
```

**Impact:** Unnecessary dependency and runtime overhead. Bun automatically loads `.env` files, making `dotenv` redundant.

**Recommendation:** Remove `dotenv` import and all `dotenv.config()` calls. Rely on Bun's automatic `.env` loading.

---

### Violation 3: dotenv Package in Drizzle Config

**File:** `packages/db/drizzle.config.ts`  
**Lines:** 3, 8-10  
**Severity:** HIGH  
**Rule:** `.ruler/22-bun-runtime.md` rule #7

**Current Code:**
```typescript
import dotenv from "dotenv";
// ...
dotenv.config({
  path: join(__dirname, ".env"),
});
```

**Expected Code:**
```typescript
// Remove dotenv import and config call
// Bun automatically loads .env files
export default defineConfig({
  schema: "./src/schema",
  out: "./src/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL || "",
  },
});
```

**Impact:** Unnecessary dependency. Drizzle Kit runs via Bun, which automatically loads `.env` files.

**Recommendation:** Remove `dotenv` import and `dotenv.config()` call.

---

### Violation 4: Node.js fs/promises in Policy Loader

**File:** `packages/policy/src/load.ts`  
**Lines:** 1, 61, 67  
**Severity:** HIGH  
**Rule:** `.ruler/22-bun-runtime.md` rule #1, #5

**Current Code:**
```typescript
import { readFile, stat } from "node:fs/promises";
// ...
const stats = await stat(resolvedPath);
const raw = await readFile(resolvedPath, "utf8");
```

**Expected Code:**
```typescript
// Use Bun.file for file operations
const file = Bun.file(resolvedPath);
const stats = await file.stat();
const raw = await file.text();
```

**Impact:** Policy loading is a performance-critical path. Using Bun-native APIs improves performance and reduces memory allocations.

**Recommendation:** Replace `node:fs/promises` with `Bun.file`.

---

### Violation 5: Node.js fs/promises in Agent Context Flow

**File:** `packages/agent/src/orchestrator/flow/context.ts`  
**Lines:** 1, 166, 188, 515  
**Severity:** HIGH  
**Rule:** `.ruler/22-bun-runtime.md` rule #1, #5

**Current Code:**
```typescript
import { readdir, readFile, stat } from "node:fs/promises";
// ...
entries = await readdir(current, { withFileTypes: true });
stats = await stat(resolvedPath);
const content = await readFile(fullPath, "utf8");
```

**Expected Code:**
```typescript
// Use Bun-native APIs
const entries = await Array.fromAsync(Bun.readdir(current));
const file = Bun.file(resolvedPath);
const stats = await file.stat();
const content = await file.text();
```

**Impact:** Context gathering is a hot path in the agent orchestrator. Node.js compatibility layer adds overhead to file operations that run frequently during workflow execution.

**Recommendation:** Replace `node:fs/promises` with `Bun.file` and `Bun.readdir`. Note: `Bun.readdir` doesn't support `withFileTypes`, so directory entry type checking may need adjustment.

---

### Violation 6: Missing TypeScript Bun Configuration

**File:** `apps/web/tsconfig.json`  
**Lines:** 6  
**Severity:** MEDIUM  
**Rule:** `.ruler/22-bun-runtime.md` rule #6

**Current Code:**
```json
{
  "compilerOptions": {
    "module": "ESNext",
    // Missing: "module": "Preserve"
    // Missing: "allowImportingTsExtensions": true
  }
}
```

**Expected Code:**
```json
{
  "compilerOptions": {
    "module": "Preserve",
    "allowImportingTsExtensions": true,
    "verbatimModuleSyntax": true  // Already present ✅
  }
}
```

**Impact:** Missing Bun-specific TypeScript settings prevents native TypeScript execution optimizations and extensioned imports. However, the app works because Vite handles bundling.

**Recommendation:** Add `module: "Preserve"` and `allowImportingTsExtensions: true` to enable Bun's native TypeScript features. Note: This may require Vite config adjustments if Vite doesn't support these settings.

---

### Violation 7: Missing TypeScript Bun Configuration in Base Config

**File:** `packages/tsconfig/tsconfig.json`  
**File:** `tsconfig.base.json`  
**Lines:** 5  
**Severity:** MEDIUM  
**Rule:** `.ruler/22-bun-runtime.md` rule #6

**Current Code:**
```json
{
  "compilerOptions": {
    "module": "ESNext",
    // Missing: "module": "Preserve"
    // Missing: "allowImportingTsExtensions": true
  }
}
```

**Expected Code:**
```json
{
  "compilerOptions": {
    "module": "Preserve",
    "allowImportingTsExtensions": true,
    "verbatimModuleSyntax": true  // Already present ✅
  }
}
```

**Impact:** Base TypeScript config doesn't enable Bun-native features. Packages extending this config won't benefit from Bun's TypeScript optimizations.

**Recommendation:** Update base configs to include Bun-specific settings. Consider creating separate base configs for Bun packages vs. Vite/bundler packages if compatibility issues arise.

---

### Violation 8: Node.js fs in Test Files

**Files:**
- `packages/agent/test/droid-tool.test.ts`
- `packages/agent/test/codex-tool.test.ts`

**Severity:** LOW  
**Rule:** `.ruler/22-bun-runtime.md` rule #1, #5

**Impact:** Test files using Node.js compatibility APIs. Lower priority as tests don't run in production, but migrating to Bun-native APIs improves test performance and consistency.

**Recommendation:** Migrate test files to use `Bun.file` and `Bun.readdir` for consistency and performance.

---

## Summary by Severity

### Critical (0)
None found.

### High (5)
1. Node.js fs/promises in migration script (`packages/db/scripts/migrate.ts`)
2. dotenv package in migration script (`packages/db/scripts/migrate.ts`)
3. dotenv package in Drizzle config (`packages/db/drizzle.config.ts`)
4. Node.js fs/promises in policy loader (`packages/policy/src/load.ts`)
5. Node.js fs/promises in agent context flow (`packages/agent/src/orchestrator/flow/context.ts`)

### Medium (2)
6. Missing TypeScript Bun configuration (`apps/web/tsconfig.json`)
7. Missing TypeScript Bun configuration in base configs (`packages/tsconfig/tsconfig.json`, `tsconfig.base.json`)

### Low (1)
8. Node.js fs in test files (multiple test files)

---

## Compliance Summary

### TanStack Start Rules: ✅ FULLY COMPLIANT

- ✅ Router instance pattern
- ✅ Root route components
- ✅ File-based routing
- ✅ Route loaders are isomorphic
- ✅ Environment variables (server-only access)
- ✅ Server routes pattern (using `server.handlers` instead of `createServerFn`)

### Bun Runtime Standards: ⚠️ PARTIAL COMPLIANCE

**Compliant:**
- ✅ Web-standard APIs (`fetch`, `URL`, `Request`/`Response`)
- ✅ Direct TypeScript execution (`bun run` for `.ts` files)
- ✅ No `express` or Node.js HTTP servers (using TanStack Start)

**Non-Compliant:**
- ❌ Node.js `fs` imports (5 files)
- ❌ `dotenv` package usage (2 files)
- ❌ Missing Bun TypeScript config (3 files)

---

## Recommended Action Plan

### Phase 1: High Priority (Performance Impact)

1. **Migrate migration script** (`packages/db/scripts/migrate.ts`)
   - Replace `node:fs/promises` with `Bun.file` and `Bun.readdir`
   - Remove `dotenv` dependency

2. **Migrate Drizzle config** (`packages/db/drizzle.config.ts`)
   - Remove `dotenv` dependency

3. **Migrate policy loader** (`packages/policy/src/load.ts`)
   - Replace `node:fs/promises` with `Bun.file`

4. **Migrate agent context flow** (`packages/agent/src/orchestrator/flow/context.ts`)
   - Replace `node:fs/promises` with `Bun.file` and `Bun.readdir`
   - Adjust directory entry type checking for `Bun.readdir` API differences

### Phase 2: Medium Priority (Configuration)

5. **Update TypeScript configs**
   - Add `module: "Preserve"` and `allowImportingTsExtensions: true` to `apps/web/tsconfig.json`
   - Evaluate impact on Vite bundling
   - Consider separate base configs for Bun vs. bundler packages

### Phase 3: Low Priority (Consistency)

6. **Migrate test files**
   - Update test files to use Bun-native APIs
   - Verify test compatibility

---

## Notes

1. **Server Routes vs. Server Functions:** The codebase uses TanStack Start's `server.handlers` pattern, which is server-only by design. The `createServerFn()` rule applies when using server functions for isomorphic operations, not server routes.

2. **TypeScript Config Trade-offs:** Adding `module: "Preserve"` may conflict with Vite's bundling. Consider testing thoroughly or creating separate configs for Bun-only packages.

3. **Bun.readdir API Differences:** `Bun.readdir` doesn't support `withFileTypes`. Migration will require adjusting directory entry type checking logic.

4. **dotenv Removal:** After removing `dotenv`, verify that `.env` files are loaded correctly by Bun in all execution contexts (scripts, drizzle-kit, etc.).

---

## Verification Commands

```bash
# Verify no dotenv imports remain
grep -r "import.*dotenv\|require.*dotenv" --include="*.ts" --include="*.tsx" | grep -v node_modules | grep -v docs

# Verify no node:fs imports in source (excluding tests)
grep -r "from.*node:fs\|from.*['\"]fs['\"]" --include="*.ts" --include="*.tsx" | grep -v node_modules | grep -v docs | grep -v test

# Verify TypeScript configs
grep -r '"module":' tsconfig*.json packages/*/tsconfig.json apps/*/tsconfig.json
```

---

**Audit Completed:** 2025-01-27  
**Next Review:** After Phase 1 migrations complete

