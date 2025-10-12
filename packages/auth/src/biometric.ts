import { getRedis } from "./redis";

const memoryTickets = new Map<string, number>();

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
    await redis.set(`bio:${sessionId}`, String(ttlSec), {
      EX: ttlSec,
    });
  } else {
    memorySet(sessionId, ttlSec);
  }
}

export async function requireRecentBiometric(sessionId: string) {
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
