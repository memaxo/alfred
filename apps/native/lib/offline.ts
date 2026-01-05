/**
 * Offline/Resilience Utilities
 *
 * Provides offline detection and retry logic for API calls.
 */

import NetInfo from "@react-native-community/netinfo";
import { useEffect, useState } from "react";

export function useNetworkStatus() {
  const [isConnected, setIsConnected] = useState(true);
  const [isInternetReachable, setIsInternetReachable] = useState(true);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsConnected(state.isConnected ?? false);
      setIsInternetReachable(state.isInternetReachable ?? false);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  return { isConnected, isInternetReachable };
}

export function withRetry<A extends readonly unknown[], R>(
  fn: (...args: A) => Promise<R>,
  maxRetries = 3,
  delayMs = 1000
): (...args: A) => Promise<R> {
  return async (...args: A) => {
    let lastError: Error | null = null;
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await fn(...args);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        if (i < maxRetries - 1) {
          await new Promise((resolve) =>
            setTimeout(resolve, delayMs * (i + 1))
          );
        }
      }
    }
    throw lastError;
  };
}
