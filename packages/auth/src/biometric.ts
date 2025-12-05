import { logger } from "@alfred/logger";
import { getRedis } from "./redis";

const memoryTickets = new Map<string, number>();

/**
 * Check if biometric bypass is enabled.
 * Only allows bypass in non-production environments with explicit BIO_AUTH_BYPASS flag.
 * This is for development/CI only - production always enforces biometric verification.
 */
function isBioBypassEnabled(): boolean {
  if (process.env.NODE_ENV === "production") {
    return false;
  }
  return process.env.BIO_AUTH_BYPASS === "true";
}

function memorySet(sessionId: string, ttlSec: number) {
  const expiresAt = Math.floor(Date.now() / 1000) + ttlSec;
  memoryTickets.set(sessionId, expiresAt);
  const timer = setTimeout(() => {
    memoryTickets.delete(sessionId);
  }, ttlSec * 1000);
  if (typeof timer.unref === "function") {
    timer.unref();
  }
}

export async function setBiometricTicket(sessionId: string, ttlSec: number) {
  const redis = getRedis();
  if (redis) {
    await (
      redis.set as unknown as (
        key: string,
        value: string,
        options: { EX: number }
      ) => Promise<string>
    )(`bio:${sessionId}`, String(ttlSec), {
      EX: ttlSec,
    });
  } else {
    memorySet(sessionId, ttlSec);
  }
}

export async function requireRecentBiometric(sessionId: string) {
  // Bypass for development when BIO_AUTH_BYPASS is enabled
  if (isBioBypassEnabled()) {
    logger.warn("biometric_bypassed", {
      sessionId,
      reason: "BIO_AUTH_BYPASS=true",
    });
    return;
  }

  const now = Math.floor(Date.now() / 1000);
  const redis = getRedis();
  if (redis) {
    const ttl = await redis.ttl(`bio:${sessionId}`);
    if (ttl <= 0) {
      throw new Error("biometric_required");
    }
    return;
  }

  const expiresAt = memoryTickets.get(sessionId);
  if (!expiresAt || expiresAt <= now) {
    throw new Error("biometric_required");
  }
}

/**
 * Auto-grant biometric ticket when bypass is enabled.
 * Call this after successful email sign-in to enable elevated operations
 * without requiring passkey in development.
 */
export async function autoGrantBiometricIfBypassed(sessionId: string) {
  if (isBioBypassEnabled()) {
    logger.warn("biometric_auto_granted", {
      sessionId,
      reason: "BIO_AUTH_BYPASS=true",
    });
    // Grant a 1-hour ticket in development mode
    await setBiometricTicket(sessionId, 3600);
  }
}
