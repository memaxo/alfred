import { useCallback, useEffect, useState } from "react";

import { syncEngine } from "./engine";
import {
  getQueueCount,
  clearQueue as clearSyncQueue,
  retryFailed,
} from "./queue";

interface SyncStatus {
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  lastSyncAt: Date | null;
  error: string | null;
}

export function useSyncStatus(): SyncStatus {
  const [status, setStatus] = useState<SyncStatus>(() => {
    const state = syncEngine.getState();
    return {
      isOnline: state.isOnline,
      isSyncing: state.status === "syncing",
      pendingCount: state.pendingCount,
      lastSyncAt: state.lastSyncAt,
      error: state.error,
    };
  });

  useEffect(() => {
    return syncEngine.subscribe((state) => {
      setStatus({
        isOnline: state.isOnline,
        isSyncing: state.status === "syncing",
        pendingCount: state.pendingCount,
        lastSyncAt: state.lastSyncAt,
        error: state.error,
      });
    });
  }, []);

  return status;
}

interface SyncActions {
  syncNow: () => Promise<void>;
  clearQueue: () => Promise<void>;
  retryFailed: () => Promise<void>;
}

export function useSyncActions(): SyncActions {
  const syncNow = useCallback(async () => {
    await syncEngine.sync();
  }, []);

  const clearQueue = useCallback(async () => {
    await clearSyncQueue();
  }, []);

  const retry = useCallback(async () => {
    await retryFailed();
    await syncEngine.sync();
  }, []);

  return {
    syncNow,
    clearQueue,
    retryFailed: retry,
  };
}

export function usePendingCount(): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    void getQueueCount().then(setCount);

    return syncEngine.subscribe((state) => {
      setCount(state.pendingCount);
    });
  }, []);

  return count;
}
