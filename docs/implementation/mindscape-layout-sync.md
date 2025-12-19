# Mindscape Layout Database Sync

## Overview

Cross-device layout persistence for Mindscape node positions using a background sync service with debouncing, batching, and low resource impact.

## Architecture

### Components

1. **`layout-sync.ts`** - Background sync service singleton
   - Debounced writes (5s delay after last change)
   - Batched updates (max 50 nodes per batch)
   - Polling fallback (30s interval)
   - Uses `requestIdleCallback` for low-priority background work

2. **`use-layout-sync.ts`** - React hook integration
   - Monitors React Flow node position changes
   - Queues updates to sync service
   - Handles page visibility/unload events

3. **Storage** - `user_preferences` table
   - Key: `"mindscape:layout"`
   - Value: JSONB snapshot with node positions
   - Last-write-wins conflict resolution

## Implementation Details

### Sync Strategy

**Debouncing**: Waits 5 seconds after the last position change before syncing. This prevents excessive DB writes during dragging.

**Batching**: Groups up to 50 node position updates into a single DB write. Reduces network overhead and DB load.

**Polling**: Falls back to periodic sync (every 30s) even if no changes detected, ensuring eventual consistency.

**Background Processing**: Uses `requestIdleCallback` when available to perform sync during browser idle time, minimizing impact on UI responsiveness.

### Resource Impact

- **CPU**: Minimal - sync runs during idle time or low-priority intervals
- **Network**: Batched writes reduce request count by ~50x (assuming 50 nodes)
- **Storage**: Only stores node IDs + positions (~100 bytes per node)
- **Memory**: In-memory queue limited to pending updates

### Conflict Resolution

Last-write-wins strategy using `updatedAt` timestamp. When loading layout:
1. Load from DB (if available)
2. Merge with localStorage (prefer DB for conflicts)
3. Apply to React Flow nodes

### Integration Points

**Canvas Component** (`apps/web/src/components/mindscape/canvas.tsx`):
```typescript
// Enable layout sync to database
useLayoutSync();
```

**Store Persistence** (`apps/web/src/store/mindscape.ts`):
- Keeps localStorage as primary (fast, offline-capable)
- DB sync runs in background (cross-device sync)

## Usage

The sync service automatically activates when:
1. User is authenticated (`session.user.id` exists)
2. Mindscape canvas is mounted
3. Node positions change (drag, physics simulation)

No manual intervention required - fully automatic background sync.

## Configuration

Constants in `layout-sync.ts`:
- `SYNC_DEBOUNCE_MS = 5000` - Delay before syncing
- `SYNC_INTERVAL_MS = 30000` - Polling interval
- `MAX_BATCH_SIZE = 50` - Max nodes per batch

## Error Handling

- Sync failures are logged but don't break UI
- Falls back to localStorage if DB unavailable
- Retries on next sync cycle (polling)

## Future Enhancements

1. **Conflict Merging**: Merge layouts from multiple devices instead of last-write-wins
2. **Partial Updates**: Only sync changed nodes (currently syncs all nodes in batch)
3. **Versioning**: Track layout versions for rollback/recovery
4. **Analytics**: Track layout patterns for auto-layout improvements
