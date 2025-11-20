# Server Entry Point Implementation Plan

**Date**: 2025-01-15  
**Purpose**: Create `apps/web/src/server.ts` as a separate server-only entry point for Bun executable compilation

## Overview

TanStack Start supports an optional `src/server.ts` file that serves as the server entry point. This file:
- Handles all SSR-related work
- Handles server routes and server function requests
- Can be customized for server-specific initialization
- Is the perfect entry point for `bun build --compile`

## Current Architecture

### Current Entry Points

1. **`apps/web/src/router.tsx`** (Isomorphic)
   - Exports `getRouter()` function
   - Contains client-side React Query setup
   - Used by TanStack Start for both server and client

2. **`apps/web/src/server/bootstrap.ts`** (Server-only)
   - Initializes reminder scheduler
   - Currently called via HMR hooks (development only)
   - Not called in production builds

3. **`packages/api/src/index.ts`** (Server-only)
   - Initializes compression worker
   - Initializes voice pools (if local models enabled)
   - Exports `appRouter` for tRPC

### Problem

- Server initialization code is scattered
- Bootstrap code only runs in development (via HMR)
- No clear server entry point for executable compilation
- Schedulers and workers may not start in production

## Solution: Create `apps/web/src/server.ts`

### File Structure

```
apps/web/src/
├── server.ts          # 🆕 Server entry point (for bun build --compile)
├── server/
│   └── bootstrap.ts  # Server initialization (existing)
├── router.tsx         # Router configuration (existing)
└── routes/            # Route definitions (existing)
```

### Implementation Plan

#### Step 1: Create Server Entry Point

**File**: `apps/web/src/server.ts`

```typescript
import handler, { type ServerEntry } from '@tanstack/react-start/server-entry'
import { initServer } from './server/bootstrap'

// Initialize server-side services
initServer()

// Export default handler conforming to ServerEntry interface
export default {
  fetch(request: Request, opts?: RequestOptions): Promise<Response> {
    return handler.fetch(request, opts)
  },
} satisfies ServerEntry
```

**Key Points**:
- Uses TanStack Start's default handler
- Calls `initServer()` before handling requests
- Conforms to `ServerEntry` interface
- Can be used as entry point for `bun build --compile`

#### Step 2: Enhance Bootstrap Function

**File**: `apps/web/src/server/bootstrap.ts`

**Current State**:
- Only initializes reminder scheduler
- Uses HMR hooks (development only)

**Enhancements Needed**:
- Initialize compression worker (from `@alfred/api`)
- Initialize voice pools (if `VOICE_PROVIDER=local`)
- Handle graceful shutdown
- Remove HMR-specific code (not needed in executable)

**Updated Implementation**:

```typescript
import {
  startReminderScheduler,
  stopReminderScheduler,
} from "@alfred/api/scheduler/remind";
import { logger } from "@alfred/api/utils/logger";

// Import compression worker initialization
// Note: This is currently in @alfred/api/src/index.ts
// May need to export initialization function separately

// Import voice pool initialization
import { initializeVoicePools, shutdownVoicePools } from "@alfred/api/voice/pools";

let initialized = false;

export function initServer() {
  if (initialized) {
    return;
  }

  initialized = true;

  // Initialize reminder scheduler (if enabled)
  if (process.env.SCHED_REMIND === "1") {
    startReminderScheduler({ logger });
    logger.info("assistant_remind_scheduler_init", {
      message: "Scheduler init requested (SCHED_REMIND=1)",
    });
  } else {
    logger.info("assistant_remind_scheduler_disabled", {
      message: "Scheduler disabled (unset SCHED_REMIND)",
    });
  }

  // Initialize compression worker (if enabled)
  // Note: Currently initialized in @alfred/api/src/index.ts
  // May need to extract to separate function

  // Initialize voice pools (if using local models)
  if (process.env.VOICE_PROVIDER === "local") {
    initializeVoicePools().catch((error) => {
      logger.error("voice_pools_init_failed", {
        error: error instanceof Error ? error.message : String(error),
      });
    });
  }

  // Handle graceful shutdown
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

export function shutdown() {
  if (!initialized) {
    return;
  }

  logger.info("server_shutdown_initiated");

  // Stop reminder scheduler
  try {
    stopReminderScheduler();
  } catch (error) {
    logger.error("reminder_scheduler_stop_failed", {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  // Shutdown voice pools
  if (process.env.VOICE_PROVIDER === "local") {
    shutdownVoicePools().catch((error) => {
      logger.error("voice_pools_shutdown_failed", {
        error: error instanceof Error ? error.message : String(error),
      });
    });
  }

  initialized = false;
  logger.info("server_shutdown_complete");
}
```

#### Step 3: Extract API Initialization

**Current Issue**: `packages/api/src/index.ts` initializes compression worker and voice pools, but this code only runs when the module is imported.

**Solution**: Export initialization functions that can be called explicitly.

**File**: `packages/api/src/init.ts` (new)

```typescript
import { compressionWorkerOverrides } from "@alfred/agent/orchestrator/config";
import { startCompressionWorker } from "@alfred/agent/orchestrator/compression-worker";
import { initializeVoicePools, shutdownVoicePools } from "./voice/pools";
import { logger } from "./utils/logger";

export function initApiServices() {
  // Initialize compression worker (if enabled)
  const compressionConfig = compressionWorkerOverrides();
  if (compressionConfig.enabled) {
    startCompressionWorker(compressionConfig);
    logger.info("compression_worker_init", {
      message: "Compression worker started",
    });
  }

  // Initialize voice pools (if using local models)
  if (process.env.VOICE_PROVIDER === "local") {
    initializeVoicePools().catch((error) => {
      logger.error("voice_pools_init_failed", {
        error: error instanceof Error ? error.message : String(error),
      });
    });
  }
}

export function shutdownApiServices() {
  // Shutdown voice pools
  if (process.env.VOICE_PROVIDER === "local") {
    shutdownVoicePools().catch((error) => {
      logger.error("voice_pools_shutdown_failed", {
        error: error instanceof Error ? error.message : String(error),
      });
    });
  }
}
```

**Update**: `packages/api/src/index.ts`

```typescript
// Keep existing initialization for backward compatibility
import { initApiServices } from "./init";

// Auto-initialize if module is imported (existing behavior)
initApiServices();

export type { AppRouter } from "./routers/index";
export { appRouter } from "./routers/index";
export { initApiServices, shutdownApiServices } from "./init";
```

#### Step 4: Update Bootstrap to Use API Init

**File**: `apps/web/src/server/bootstrap.ts`

```typescript
import {
  startReminderScheduler,
  stopReminderScheduler,
} from "@alfred/api/scheduler/remind";
import { initApiServices, shutdownApiServices } from "@alfred/api/init";
import { logger } from "@alfred/api/utils/logger";

let initialized = false;

export function initServer() {
  if (initialized) {
    return;
  }

  initialized = true;

  // Initialize reminder scheduler (if enabled)
  if (process.env.SCHED_REMIND === "1") {
    startReminderScheduler({ logger });
    logger.info("assistant_remind_scheduler_init", {
      message: "Scheduler init requested (SCHED_REMIND=1)",
    });
  }

  // Initialize API services (compression worker, voice pools)
  initApiServices();

  // Handle graceful shutdown
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

export function shutdown() {
  if (!initialized) {
    return;
  }

  logger.info("server_shutdown_initiated");

  // Stop reminder scheduler
  try {
    stopReminderScheduler();
  } catch (error) {
    logger.error("reminder_scheduler_stop_failed", {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  // Shutdown API services
  shutdownApiServices();

  initialized = false;
  logger.info("server_shutdown_complete");
}
```

## Build Configuration

### For TanStack Start (Development/Production)

TanStack Start will automatically use `src/server.ts` if it exists. No changes needed to Vite config.

### For Bun Executable

**Build Command**:
```bash
bun build --compile \
  --minify \
  --sourcemap \
  --bytecode \
  --target=bun-linux-x64 \
  ./apps/web/src/server.ts \
  --outfile alfred-server
```

**Why `server.ts` instead of `router.tsx`?**
- `server.ts` is server-only (no client code)
- Contains initialization logic
- Smaller bundle size
- Faster startup

## Testing Strategy

### Unit Tests

1. **Test `initServer()` function**
   - Verify schedulers start when env flags set
   - Verify voice pools initialize when `VOICE_PROVIDER=local`
   - Verify compression worker starts when enabled

2. **Test `shutdown()` function**
   - Verify graceful shutdown of all services
   - Verify error handling

### Integration Tests

1. **Test server entry point**
   - Verify handler responds to requests
   - Verify SSR works correctly
   - Verify API routes work

2. **Test executable build**
   - Build executable
   - Run executable
   - Verify all services start
   - Verify HTTP endpoints work

## Migration Path

### Phase 1: Create Server Entry Point (Non-Breaking)

1. Create `apps/web/src/server.ts`
2. Enhance `apps/web/src/server/bootstrap.ts`
3. Extract `packages/api/src/init.ts`
4. Test that existing dev workflow still works

### Phase 2: Test Executable Build

1. Build executable with `bun build --compile`
2. Test executable in isolated environment
3. Verify all services start correctly
4. Verify HTTP endpoints work

### Phase 3: Update Documentation

1. Update deployment docs
2. Update build scripts
3. Document server entry point usage

## Open Questions

1. **Compression Worker**: Currently initialized in `@alfred/api/src/index.ts`. Should we extract to `init.ts` or keep as-is?

2. **HMR Support**: Should we keep HMR hooks in bootstrap for development, or remove entirely?

3. **Error Handling**: How should we handle initialization failures? Fail fast or continue with degraded functionality?

4. **Health Checks**: Should we add a health check endpoint that verifies all services are initialized?

## References

- [TanStack Start Server Entry Point](docs/reference/tanstack-start/guide/server-entry-point.md)
- [TanStack Start Execution Model](docs/reference/tanstack-start/guide/execution-model.md)
- [Bun Executables](docs/reference/bun/bundler/executables.md)
- [Deployment Architecture](docs/architecture/deployment-proxmox.md)

