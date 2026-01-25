/**
 * Subscription Manager
 *
 * Single WebSocket connection with multiplexed streams.
 * Handles reconnection, cursor-based resume, and stream lifecycle.
 */

import type {
  ClientMessage,
  ServerMessage,
  SubscriptionState,
} from "@alfred/type";

type EventHandler<T = unknown> = (event: T) => void;
type StatusHandler = (status: SubscriptionState["status"]) => void;

interface StreamSubscription {
  handler: EventHandler;
  onStatus?: StatusHandler;
  cursor: string | null;
  status: SubscriptionState["status"];
}

const RECONNECT_DELAYS = [1000, 2000, 5000, 10_000, 30_000];
const HEARTBEAT_INTERVAL = 30_000;

class SubscriptionManager {
  private ws: WebSocket | null = null;
  private readonly streams = new Map<string, StreamSubscription>();
  private reconnectAttempt = 0;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private readonly url: string;

  constructor(url = "/api/subscriptions") {
    this.url = url;
  }

  private getWebSocketUrl(): string {
    if (typeof window === "undefined") {
      return this.url;
    }
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    return `${protocol}//${window.location.host}${this.url}`;
  }

  private connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      return;
    }
    if (this.ws?.readyState === WebSocket.CONNECTING) {
      return;
    }

    try {
      this.ws = new WebSocket(this.getWebSocketUrl());
      this.setupWebSocket();
    } catch {
      this.scheduleReconnect();
    }
  }

  private setupWebSocket(): void {
    if (!this.ws) {
      return;
    }

    this.ws.onopen = () => {
      this.reconnectAttempt = 0;
      this.startHeartbeat();

      // Resubscribe all streams with their cursors
      for (const [streamId, sub] of this.streams) {
        sub.status = "connecting";
        sub.onStatus?.("connecting");
        this.sendSubscribe(streamId, sub.cursor);
      }
    };

    this.ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data) as ServerMessage;
        this.handleMessage(message);
      } catch {}
    };

    this.ws.onclose = () => {
      this.stopHeartbeat();
      this.updateAllStreamStatus("disconnected");
      this.scheduleReconnect();
    };

    this.ws.onerror = (_error) => {
      this.updateAllStreamStatus("error");
    };
  }

  private handleMessage(message: ServerMessage): void {
    // Type-safe narrowing: check type first to properly narrow the union
    if (message.type === "event") {
      // StreamEnvelope has both type and streamId
      const sub = this.streams.get(message.streamId);
      if (!sub) {
        return;
      }
      sub.cursor = message.event.cursor;
      sub.handler(message.event);
      return;
    }

    if (message.type === "subscribed") {
      const sub = this.streams.get(message.streamId);
      if (!sub) {
        return;
      }
      sub.status = "connected";
      sub.cursor = message.cursor;
      sub.onStatus?.("connected");
      return;
    }

    if (message.type === "unsubscribed") {
      this.streams.delete(message.streamId);
      return;
    }

    if (message.type === "error") {
      if (message.streamId) {
        const sub = this.streams.get(message.streamId);
        if (sub) {
          sub.status = "error";
          sub.onStatus?.("error");
        }
      }
      // Global errors (without streamId) are silently logged
      return;
    }
  }

  private sendSubscribe(streamId: string, cursor: string | null): void {
    if (this.ws?.readyState !== WebSocket.OPEN) {
      return;
    }

    const msg: ClientMessage = {
      type: "subscribe",
      streamId,
      cursor: cursor ?? undefined,
    };
    this.ws.send(JSON.stringify(msg));
  }

  private sendUnsubscribe(streamId: string): void {
    if (this.ws?.readyState !== WebSocket.OPEN) {
      return;
    }

    const msg: ClientMessage = { type: "unsubscribe", streamId };
    this.ws.send(JSON.stringify(msg));
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimeout) {
      return;
    }
    if (this.streams.size === 0) {
      return; // No active subscriptions
    }

    const delay =
      RECONNECT_DELAYS[
        Math.min(this.reconnectAttempt, RECONNECT_DELAYS.length - 1)
      ];
    this.reconnectAttempt++;

    this.reconnectTimeout = setTimeout(() => {
      this.reconnectTimeout = null;
      this.connect();
    }, delay);
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: "ping" }));
      }
    }, HEARTBEAT_INTERVAL);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  private updateAllStreamStatus(status: SubscriptionState["status"]): void {
    for (const sub of this.streams.values()) {
      sub.status = status;
      sub.onStatus?.(status);
    }
  }

  /**
   * Subscribe to a stream with optional cursor for resume.
   */
  subscribe<T>(
    streamId: string,
    handler: EventHandler<T>,
    options?: { cursor?: string; onStatus?: StatusHandler }
  ): () => void {
    const existing = this.streams.get(streamId);
    if (existing) {
      existing.handler = handler as EventHandler;
      existing.onStatus = options?.onStatus;
      return () => this.unsubscribe(streamId);
    }

    this.streams.set(streamId, {
      handler: handler as EventHandler,
      onStatus: options?.onStatus,
      cursor: options?.cursor ?? null,
      status: "connecting",
    });

    // Connect if not already connected
    if (!this.ws || this.ws.readyState === WebSocket.CLOSED) {
      this.connect();
    } else if (this.ws.readyState === WebSocket.OPEN) {
      this.sendSubscribe(streamId, options?.cursor ?? null);
    }

    return () => this.unsubscribe(streamId);
  }

  /**
   * Unsubscribe from a stream.
   */
  unsubscribe(streamId: string): void {
    const sub = this.streams.get(streamId);
    if (!sub) {
      return;
    }

    this.sendUnsubscribe(streamId);
    this.streams.delete(streamId);

    // Close connection if no more streams
    if (this.streams.size === 0) {
      this.disconnect();
    }
  }

  /**
   * Get current cursor for a stream (for persistence).
   */
  getCursor(streamId: string): string | null {
    return this.streams.get(streamId)?.cursor ?? null;
  }

  /**
   * Get subscription state for a stream.
   */
  getState(streamId: string): SubscriptionState | null {
    const sub = this.streams.get(streamId);
    if (!sub) {
      return null;
    }

    return {
      streamId,
      cursor: sub.cursor,
      status: sub.status,
      lastEventAt: null,
    };
  }

  /**
   * Disconnect and cleanup.
   */
  disconnect(): void {
    this.stopHeartbeat();
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.streams.clear();
  }
}

// Singleton instance
export const subscriptionManager = new SubscriptionManager();
