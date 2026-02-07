/**
 * Offline Message Queue Hook
 *
 * Provides message queuing when the user is offline.
 * Messages are stored in localStorage and retried when connectivity returns.
 *
 * Storage budget: Max 10 messages (~1KB total)
 */

import { useCallback, useEffect, useState } from "react";

const QUEUE_KEY = "alfred_offline_message_queue";
const MAX_QUEUE_SIZE = 10;

interface QueuedMessage {
  id: string;
  content: string;
  timestamp: number;
  retryCount: number;
  conversationId?: string;
}

interface UseOfflineQueueReturn {
  queueMessage: (content: string, conversationId?: string | null) => boolean;
  pendingMessages: QueuedMessage[];
  retryAll: () => QueuedMessage[];
  clearQueue: () => void;
  removeFromQueue: (id: string) => void;
}

function loadQueue(): QueuedMessage[] {
  try {
    const stored = localStorage.getItem(QUEUE_KEY);
    if (stored) {
      return JSON.parse(stored) as QueuedMessage[];
    }
  } catch {
    // Ignore parse errors
  }
  return [];
}

function saveQueue(queue: QueuedMessage[]): void {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch {
    // Ignore storage errors (e.g., quota exceeded)
  }
}

export function useOfflineQueue(): UseOfflineQueueReturn {
  const [pendingMessages, setPendingMessages] = useState<QueuedMessage[]>([]);
  const [isOnline, setIsOnline] = useState(true);

  // Load queue on mount
  useEffect(() => {
    setPendingMessages(loadQueue());
  }, []);

  // Monitor online status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    setIsOnline(navigator.onLine);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const queueMessage = useCallback(
    (content: string, conversationId?: string | null): boolean => {
      if (isOnline) {
        return false; // Don't queue if online
      }

      const queue = loadQueue();
      if (queue.length >= MAX_QUEUE_SIZE) {
        return false; // Queue is full
      }

      const newMessage: QueuedMessage = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        content,
        timestamp: Date.now(),
        retryCount: 0,
        conversationId: conversationId ?? undefined,
      };

      const updatedQueue = [...queue, newMessage];
      saveQueue(updatedQueue);
      setPendingMessages(updatedQueue);

      return true;
    },
    [isOnline]
  );

  const retryAll = useCallback((): QueuedMessage[] => {
    const queue = loadQueue();
    const failed: QueuedMessage[] = [];
    const retryable: QueuedMessage[] = [];

    for (const message of queue) {
      const nextRetryCount = message.retryCount + 1;
      if (nextRetryCount >= 3) {
        failed.push({ ...message, retryCount: nextRetryCount });
      } else {
        retryable.push({ ...message, retryCount: nextRetryCount });
      }
    }

    saveQueue(failed);
    setPendingMessages(failed);

    return retryable;
  }, []);

  const clearQueue = useCallback(() => {
    localStorage.removeItem(QUEUE_KEY);
    setPendingMessages([]);
  }, []);

  const removeFromQueue = useCallback((id: string) => {
    const queue = loadQueue();
    const updated = queue.filter((m) => m.id !== id);
    saveQueue(updated);
    setPendingMessages(updated);
  }, []);

  return {
    queueMessage,
    pendingMessages,
    retryAll,
    clearQueue,
    removeFromQueue,
  };
}
