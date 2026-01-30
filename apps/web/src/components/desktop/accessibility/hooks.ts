/**
 * Accessibility React Hooks
 *
 * Provides React hooks for accessibility features.
 */

import { useCallback, useEffect, useRef, useState } from "react";

import {
  announce,
  createFocusRestoration,
  createFocusTrap,
  type FocusTrapOptions,
  type LiveRegionOptions,
} from "@/lib/accessibility";

/**
 * Hook for managing focus traps (modals, dialogs)
 */
export function useFocusTrap(
  containerRef: React.RefObject<HTMLElement | null>,
  isActive: boolean,
  options: FocusTrapOptions = {}
) {
  const trapRef = useRef<ReturnType<typeof createFocusTrap> | null>(null);

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    trapRef.current = createFocusTrap(containerRef.current, options);

    if (isActive) {
      trapRef.current.activate();
    }

    return () => {
      trapRef.current?.deactivate();
    };
  }, [
    containerRef,
    isActive,
    options.initialFocus,
    options.returnFocus,
    options.escapeDeactivates,
  ]);

  useEffect(() => {
    if (trapRef.current) {
      if (isActive) {
        trapRef.current.activate();
      } else {
        trapRef.current.deactivate();
      }
    }
  }, [isActive]);

  return {
    activate: () => trapRef.current?.activate(),
    deactivate: () => trapRef.current?.deactivate(),
  };
}

/**
 * Hook for announcing messages to screen readers
 */
export function useAnnounce() {
  const announceMessage = useCallback(
    (message: string, options?: LiveRegionOptions) => {
      announce(message, options);
    },
    []
  );

  const announcePolite = useCallback((message: string) => {
    announce(message, { politeness: "polite" });
  }, []);

  const announceAssertive = useCallback((message: string) => {
    announce(message, { politeness: "assertive" });
  }, []);

  return { announce: announceMessage, announcePolite, announceAssertive };
}

/**
 * Hook for focus restoration across window transitions
 */
export function useFocusRestoration() {
  const restorationRef = useRef(createFocusRestoration());

  const save = useCallback((windowId: string) => {
    restorationRef.current.save(windowId);
  }, []);

  const restore = useCallback(
    (windowId: string) => restorationRef.current.restore(windowId),
    []
  );

  const clear = useCallback((windowId: string) => {
    restorationRef.current.clear(windowId);
  }, []);

  return { save, restore, clear };
}

/**
 * Hook for detecting keyboard vs mouse navigation
 */
export function useKeyboardNavigation() {
  const [isKeyboardUser, setIsKeyboardUser] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Tab") {
        setIsKeyboardUser(true);
      }
    };

    const handleMouseDown = () => {
      setIsKeyboardUser(false);
    };

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handleMouseDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handleMouseDown);
    };
  }, []);

  return isKeyboardUser;
}

/**
 * Hook for managing reduced motion preference
 */
export function useReducedMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mediaQuery.matches);

    const handleChange = (e: MediaQueryListEvent) => {
      setPrefersReducedMotion(e.matches);
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  return prefersReducedMotion;
}

/**
 * Hook for managing high contrast preference
 */
export function useHighContrast() {
  const [prefersHighContrast, setPrefersHighContrast] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-contrast: more)");
    setPrefersHighContrast(mediaQuery.matches);

    const handleChange = (e: MediaQueryListEvent) => {
      setPrefersHighContrast(e.matches);
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  return prefersHighContrast;
}
