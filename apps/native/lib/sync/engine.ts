import type { TRPCClient } from "@trpc/client";

import { logger } from "@alfred/logger";
import NetInfo from "@react-native-community/netinfo";
import { eq } from "drizzle-orm";
import { AppState, type AppStateStatus } from "react-native";

import type { TRPCAppRouter } from "@/utils/trpc";

import { db, notes, reminders, timers, bookmarks } from "../db";
import {
  getPendingItems,
  markAttempted,
  markCompleted,
  getQueueCount,
  type SyncAction,
} from "./queue";

type SyncStatus = "idle" | "syncing" | "error";

interface SyncState {
  status: SyncStatus;
  lastSyncAt: Date | null;
  pendingCount: number;
  isOnline: boolean;
  error: string | null;
}

type SyncListener = (state: SyncState) => void;

class SyncEngine {
  private state: SyncState = {
    status: "idle",
    lastSyncAt: null,
    pendingCount: 0,
    isOnline: true,
    error: null,
  };

  private listeners: Set<SyncListener> = new Set();
  private trpcClient: TRPCClient<TRPCAppRouter> | null = null;
  private syncInterval: ReturnType<typeof setInterval> | null = null;
  private isInitialized = false;

  async initialize(trpcClient: TRPCClient<TRPCAppRouter>): Promise<void> {
    if (this.isInitialized) return;

    this.trpcClient = trpcClient;
    this.isInitialized = true;

    // Monitor network status
    NetInfo.addEventListener((state) => {
      const wasOffline = !this.state.isOnline;
      this.state.isOnline = state.isConnected ?? false;
      this.notifyListeners();

      // Sync when coming back online
      if (wasOffline && this.state.isOnline) {
        void this.sync();
      }
    });

    // Monitor app state
    AppState.addEventListener("change", (nextState: AppStateStatus) => {
      if (nextState === "active" && this.state.isOnline) {
        void this.sync();
      }
    });

    // Periodic sync every 5 minutes
    this.syncInterval = setInterval(
      () => {
        if (this.state.isOnline && this.state.status === "idle") {
          void this.sync();
        }
      },
      5 * 60 * 1000
    );

    // Initial sync
    await this.updatePendingCount();
    if (this.state.isOnline) {
      void this.sync();
    }
  }

  subscribe(listener: SyncListener): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(): void {
    this.listeners.forEach((l) => l(this.state));
  }

  private async updatePendingCount(): Promise<void> {
    this.state.pendingCount = await getQueueCount();
    this.notifyListeners();
  }

  async sync(): Promise<void> {
    if (
      !this.trpcClient ||
      !this.state.isOnline ||
      this.state.status === "syncing"
    ) {
      return;
    }

    this.state.status = "syncing";
    this.state.error = null;
    this.notifyListeners();

    try {
      const items = await getPendingItems();

      for (const item of items) {
        try {
          await this.processSyncItem(
            item.tableName,
            item.recordId,
            item.action as SyncAction,
            item.payload
          );
          await markCompleted(item.id);
        } catch (error) {
          const message =
            error instanceof Error ? error.message : String(error);
          logger.warn("sync_item_failed", { item: item.id, error: message });
          await markAttempted(item.id, message);
        }
      }

      // Clear pending flags on synced records
      await this.clearPendingFlags();

      this.state.status = "idle";
      this.state.lastSyncAt = new Date();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error("sync_failed", { error: message });
      this.state.status = "error";
      this.state.error = message;
    }

    await this.updatePendingCount();
  }

  private async processSyncItem(
    tableName: string,
    recordId: string,
    action: SyncAction,
    payload: unknown
  ): Promise<void> {
    if (!this.trpcClient) throw new Error("tRPC client not initialized");

    switch (tableName) {
      case "notes":
        await this.syncNote(recordId, action, payload);
        break;
      case "reminders":
        await this.syncReminder(recordId, action, payload);
        break;
      case "timers":
        await this.syncTimer(recordId, action, payload);
        break;
      case "bookmarks":
        await this.syncBookmark(recordId, action, payload);
        break;
      default:
        logger.warn("unknown_sync_table", { tableName });
    }
  }

  private async syncNote(
    recordId: string,
    action: SyncAction,
    payload: unknown
  ): Promise<void> {
    if (!this.trpcClient) return;
    const data = payload as Record<string, unknown> | null;

    switch (action) {
      case "create":
        await this.trpcClient.note.create.mutate({
          content: String(data?.body ?? data?.content ?? ""),
          title: data?.title ? String(data.title) : undefined,
        });
        break;
      case "update":
        await this.trpcClient.note.update.mutate({
          id: recordId,
          title: data?.title ? String(data.title) : undefined,
          content: data?.body ? String(data.body) : undefined,
        });
        break;
      case "delete":
        await this.trpcClient.note.delete.mutate({ id: recordId });
        break;
    }
  }

  private async syncReminder(
    recordId: string,
    action: SyncAction,
    payload: unknown
  ): Promise<void> {
    if (!this.trpcClient) return;
    const data = payload as Record<string, unknown> | null;

    switch (action) {
      case "create": {
        const dueAt = data?.dueAt ?? data?.due;
        const dueStr = dueAt
          ? new Date(dueAt as string | number).toISOString()
          : new Date().toISOString();
        await this.trpcClient.remind.create.mutate({
          title: String(data?.title ?? "Reminder"),
          due: dueStr,
          description: data?.body ? String(data.body) : undefined,
        });
        break;
      }
      case "update":
        if (data?.completedAt) {
          await this.trpcClient.remind.fire.mutate({ id: recordId });
        }
        break;
      case "delete":
        await this.trpcClient.remind.delete.mutate({ id: recordId });
        break;
    }
  }

  private async syncTimer(
    recordId: string,
    action: SyncAction,
    payload: unknown
  ): Promise<void> {
    if (!this.trpcClient) return;
    const data = payload as Record<string, unknown> | null;

    switch (action) {
      case "create": {
        // API expects duration in seconds, local stores in ms
        const durationMs = Number(data?.durationMs ?? data?.duration ?? 0);
        const durationSec = Math.ceil(durationMs / 1000);
        await this.trpcClient.timer.create.mutate({
          label: data?.label ? String(data.label) : undefined,
          duration: durationSec,
        });
        break;
      }
      case "update":
        if (data?.completedAt) {
          await this.trpcClient.timer.done.mutate({ id: recordId });
        }
        break;
      case "delete":
        await this.trpcClient.timer.cancel.mutate({ id: recordId });
        break;
    }
  }

  private async syncBookmark(
    recordId: string,
    action: SyncAction,
    payload: unknown
  ): Promise<void> {
    if (!this.trpcClient) return;
    const data = payload as Record<string, unknown> | null;

    switch (action) {
      case "create":
        await this.trpcClient.book.create.mutate({
          url: String(data?.url ?? ""),
          title: data?.title ? String(data.title) : undefined,
          tags: Array.isArray(data?.tags) ? (data.tags as string[]) : undefined,
        });
        break;
      case "delete":
        await this.trpcClient.book.delete.mutate({ id: recordId });
        break;
    }
  }

  private async clearPendingFlags(): Promise<void> {
    const now = new Date();
    await db
      .update(notes)
      .set({ pendingSync: false, syncedAt: now })
      .where(eq(notes.pendingSync, true));
    await db
      .update(reminders)
      .set({ pendingSync: false, syncedAt: now })
      .where(eq(reminders.pendingSync, true));
    await db
      .update(timers)
      .set({ pendingSync: false, syncedAt: now })
      .where(eq(timers.pendingSync, true));
    await db
      .update(bookmarks)
      .set({ pendingSync: false, syncedAt: now })
      .where(eq(bookmarks.pendingSync, true));
  }

  getState(): SyncState {
    return { ...this.state };
  }

  destroy(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
    this.listeners.clear();
    this.isInitialized = false;
  }
}

export const syncEngine = new SyncEngine();
