/**
 * SSE Connection Tracking and Rate Limiting
 *
 * Tracks active SSE connections per user and enforces connection limits
 * and rate limiting to prevent resource exhaustion.
 */

import { randomUUID } from "node:crypto";

const DEFAULT_MAX_CONNECTIONS_PER_USER =
  Number.parseInt(process.env.SSE_MAX_CONNECTIONS_PER_USER ?? "", 10) || 5;
const DEFAULT_MAX_GLOBAL_CONNECTIONS =
  Number.parseInt(process.env.SSE_MAX_GLOBAL_CONNECTIONS ?? "", 10) || 100;
const DEFAULT_CONNECTION_TIMEOUT_MS =
  Number.parseInt(process.env.SSE_CONNECTION_TIMEOUT_MS ?? "", 10) ||
  30 * 60 * 1000; // 30 minutes
const DEFAULT_RATE_LIMIT_PER_MINUTE =
  Number.parseInt(process.env.SSE_RATE_LIMIT_PER_MINUTE ?? "", 10) || 10;

type ConnectionInfo = {
  connectionId: string;
  userId: string;
  endpoint: string;
  createdAt: number;
  timeoutAt: number;
};

type RateLimitBucket = { count: number; resetAt: number };

// Track connections per user
const userConnections = new Map<string, Set<string>>();
// Track all connections
const connections = new Map<string, ConnectionInfo>();
// Rate limiting buckets per user
const rateLimitBuckets = new Map<string, RateLimitBucket>();

let cleanupTimer: ReturnType<typeof setInterval> | null = null;

function checkRateLimit(
  userId: string,
  maxPerMinute: number
): { allowed: boolean; resetAt: number | null } {
  const now = Date.now();
  const bucket = rateLimitBuckets.get(userId);

  if (!bucket || now > bucket.resetAt) {
    rateLimitBuckets.set(userId, { count: 1, resetAt: now + 60_000 });
    return { allowed: true, resetAt: now + 60_000 };
  }

  if (bucket.count >= maxPerMinute) {
    return { allowed: false, resetAt: bucket.resetAt };
  }

  bucket.count++;
  return { allowed: true, resetAt: bucket.resetAt };
}

function cleanupExpiredConnections(): void {
  const now = Date.now();
  const expired: string[] = [];

  for (const [connectionId, info] of connections.entries()) {
    if (now > info.timeoutAt) {
      expired.push(connectionId);
    }
  }

  for (const connectionId of expired) {
    removeConnection(connectionId);
  }
}

function startCleanupTimer(): void {
  if (cleanupTimer) {
    return;
  }

  cleanupTimer = setInterval(() => {
    cleanupExpiredConnections();
  }, 10_000); // Run every 10 seconds
}

export function createConnection(
  userId: string,
  endpoint: string
): { connectionId: string; allowed: boolean; reason?: string } {
  // Check global connection limit
  if (connections.size >= DEFAULT_MAX_GLOBAL_CONNECTIONS) {
    return {
      connectionId: "",
      allowed: false,
      reason: "max_global_connections",
    };
  }

  // Check user connection limit
  const userConnSet = userConnections.get(userId) ?? new Set();
  if (userConnSet.size >= DEFAULT_MAX_CONNECTIONS_PER_USER) {
    return {
      connectionId: "",
      allowed: false,
      reason: "max_user_connections",
    };
  }

  // Check rate limit
  const rateLimit = checkRateLimit(userId, DEFAULT_RATE_LIMIT_PER_MINUTE);
  if (!rateLimit.allowed) {
    return {
      connectionId: "",
      allowed: false,
      reason: "rate_limit_exceeded",
    };
  }

  const connectionId = randomUUID();
  const now = Date.now();

  const info: ConnectionInfo = {
    connectionId,
    userId,
    endpoint,
    createdAt: now,
    timeoutAt: now + DEFAULT_CONNECTION_TIMEOUT_MS,
  };

  connections.set(connectionId, info);

  if (!userConnections.has(userId)) {
    userConnections.set(userId, new Set());
  }
  userConnections.get(userId)?.add(connectionId);

  startCleanupTimer();

  return { connectionId, allowed: true };
}

export function removeConnection(connectionId: string): void {
  const info = connections.get(connectionId);
  if (!info) {
    return;
  }

  connections.delete(connectionId);

  const userConnSet = userConnections.get(info.userId);
  if (userConnSet) {
    userConnSet.delete(connectionId);
    if (userConnSet.size === 0) {
      userConnections.delete(info.userId);
    }
  }
}

export function updateConnectionActivity(connectionId: string): void {
  const info = connections.get(connectionId);
  if (!info) {
    return;
  }

  // Reset timeout on activity
  info.timeoutAt = Date.now() + DEFAULT_CONNECTION_TIMEOUT_MS;
}

export function getConnectionCount(userId?: string): number {
  if (userId) {
    return userConnections.get(userId)?.size ?? 0;
  }
  return connections.size;
}

export function getConnectionInfo(connectionId: string): ConnectionInfo | null {
  return connections.get(connectionId) ?? null;
}

export function stopCleanupTimer(): void {
  if (cleanupTimer) {
    clearInterval(cleanupTimer);
    cleanupTimer = null;
  }
}

export function clearAllConnections(): void {
  connections.clear();
  userConnections.clear();
  rateLimitBuckets.clear();
  stopCleanupTimer();
}
