import { useState, useEffect, useRef } from "react";
import { InteractionManager } from "react-native";

/**
 * Defers heavy component mounting until after interactions complete.
 * Useful for expensive GenUI components like charts and matrices.
 */
export function useLazyComponent(enabled: boolean = true): boolean {
  const [isReady, setIsReady] = useState(!enabled);
  const mountedRef = useRef(true);

  useEffect(() => {
    if (!enabled) {
      setIsReady(true);
      return;
    }

    mountedRef.current = true;

    const handle = InteractionManager.runAfterInteractions(() => {
      if (mountedRef.current) {
        setIsReady(true);
      }
    });

    return () => {
      mountedRef.current = false;
      handle.cancel();
    };
  }, [enabled]);

  return isReady;
}

/**
 * Defers mounting with a minimum delay for smooth transitions.
 */
export function useDeferredMount(delayMs: number = 100): boolean {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsMounted(true), delayMs);
    return () => clearTimeout(timer);
  }, [delayMs]);

  return isMounted;
}

export default useLazyComponent;
