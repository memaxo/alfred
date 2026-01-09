"use client";

/**
 * Window Animation Hook
 *
 * Provides smooth exponential decay animations for window lifecycle events.
 * Uses motion library spring physics with accessibility support.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useReducedMotion } from "../accessibility/hooks";
import { ANIMATION_CONFIG } from "./config";

export type WindowAnimationState =
  | "spawning"
  | "idle"
  | "closing"
  | "resizing"
  | "tiling"
  | "minimizing"
  | "restoring";

type AnimationStyles = {
  opacity: number;
  scale: number;
  x: number;
  y: number;
  blur?: number;
};

type UseWindowAnimationOptions = {
  onCloseComplete?: () => void;
  onMinimizeComplete?: () => void;
  onRestoreComplete?: () => void;
};

export function useWindowAnimation(options: UseWindowAnimationOptions = {}) {
  const { onCloseComplete, onMinimizeComplete, onRestoreComplete } = options;
  const prefersReducedMotion = useReducedMotion();
  const [animationState, setAnimationState] =
    useState<WindowAnimationState>("spawning");
  const [styles, setStyles] = useState<AnimationStyles>({
    opacity: 0,
    scale: 0.9,
    x: 0,
    y: 20,
    blur: 10,
  });
  const animationRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);

  // Exponential decay interpolation
  const exponentialDecay = useCallback(
    (
      start: number,
      end: number,
      progress: number,
      stiffness: number,
      damping: number
    ) => {
      // Approximate spring physics with exponential decay
      const decay = Math.exp((-progress * stiffness) / damping);
      const overshoot = 1 + decay * 0.05 * Math.sin(progress * stiffness * 0.1);
      return (
        start + (end - start) * (1 - decay) * (progress < 0.8 ? overshoot : 1)
      );
    },
    []
  );

  // Animate spawn
  const animateSpawn = useCallback(() => {
    if (prefersReducedMotion) {
      setStyles({ opacity: 1, scale: 1, x: 0, y: 0, blur: 0 });
      setAnimationState("idle");
      return;
    }

    const { stiffness, damping } = ANIMATION_CONFIG.spawn;
    const duration = ANIMATION_CONFIG.duration.spawn;
    startTimeRef.current = performance.now();

    const animate = (time: number) => {
      const elapsed = time - startTimeRef.current;
      const progress = Math.min(elapsed / duration, 1);

      setStyles({
        opacity: exponentialDecay(0, 1, progress, stiffness, damping),
        scale: exponentialDecay(0.9, 1, progress, stiffness, damping),
        x: 0,
        y: exponentialDecay(20, 0, progress, stiffness, damping),
        blur: exponentialDecay(10, 0, progress, stiffness, damping),
      });

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        setStyles({ opacity: 1, scale: 1, x: 0, y: 0, blur: 0 });
        setAnimationState("idle");
      }
    };

    animationRef.current = requestAnimationFrame(animate);
  }, [prefersReducedMotion, exponentialDecay]);

  // Animate close
  const animateClose = useCallback(() => {
    if (prefersReducedMotion) {
      onCloseComplete?.();
      return;
    }

    setAnimationState("closing");
    const { stiffness, damping } = ANIMATION_CONFIG.close;
    const duration = ANIMATION_CONFIG.duration.close;
    startTimeRef.current = performance.now();

    const animate = (time: number) => {
      const elapsed = time - startTimeRef.current;
      const progress = Math.min(elapsed / duration, 1);

      setStyles({
        opacity: exponentialDecay(1, 0, progress, stiffness, damping),
        scale: exponentialDecay(1, 0.9, progress, stiffness, damping),
        x: 0,
        y: exponentialDecay(0, -20, progress, stiffness, damping),
        blur: exponentialDecay(0, 10, progress, stiffness, damping),
      });

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        onCloseComplete?.();
      }
    };

    animationRef.current = requestAnimationFrame(animate);
  }, [prefersReducedMotion, exponentialDecay, onCloseComplete]);

  // Animate minimize
  const animateMinimize = useCallback(
    (targetX = 0, targetY = 500) => {
      if (prefersReducedMotion) {
        onMinimizeComplete?.();
        return;
      }

      setAnimationState("minimizing");
      const { stiffness, damping } = ANIMATION_CONFIG.tile;
      const duration = ANIMATION_CONFIG.duration.tile;
      startTimeRef.current = performance.now();

      const animate = (time: number) => {
        const elapsed = time - startTimeRef.current;
        const progress = Math.min(elapsed / duration, 1);

        setStyles({
          opacity: exponentialDecay(1, 0, progress, stiffness, damping),
          scale: exponentialDecay(1, 0.1, progress, stiffness, damping),
          x: exponentialDecay(0, targetX, progress, stiffness, damping),
          y: exponentialDecay(0, targetY, progress, stiffness, damping),
          blur: exponentialDecay(0, 5, progress, stiffness, damping),
        });

        if (progress < 1) {
          animationRef.current = requestAnimationFrame(animate);
        } else {
          onMinimizeComplete?.();
        }
      };

      animationRef.current = requestAnimationFrame(animate);
    },
    [prefersReducedMotion, exponentialDecay, onMinimizeComplete]
  );

  // Animate restore
  const animateRestore = useCallback(
    (startX = 0, startY = 500) => {
      if (prefersReducedMotion) {
        onRestoreComplete?.();
        return;
      }

      setAnimationState("restoring");
      const { stiffness, damping } = ANIMATION_CONFIG.spawn;
      const duration = ANIMATION_CONFIG.duration.spawn;
      startTimeRef.current = performance.now();

      const animate = (time: number) => {
        const elapsed = time - startTimeRef.current;
        const progress = Math.min(elapsed / duration, 1);

        setStyles({
          opacity: exponentialDecay(0, 1, progress, stiffness, damping),
          scale: exponentialDecay(0.1, 1, progress, stiffness, damping),
          x: exponentialDecay(startX, 0, progress, stiffness, damping),
          y: exponentialDecay(startY, 0, progress, stiffness, damping),
          blur: exponentialDecay(5, 0, progress, stiffness, damping),
        });

        if (progress < 1) {
          animationRef.current = requestAnimationFrame(animate);
        } else {
          setAnimationState("idle");
          onRestoreComplete?.();
        }
      };

      animationRef.current = requestAnimationFrame(animate);
    },
    [prefersReducedMotion, exponentialDecay, onRestoreComplete]
  );

  // Start tile animation
  const startTileAnimation = useCallback(() => {
    if (prefersReducedMotion) {
      return;
    }
    setAnimationState("tiling");
    // Tile animation handled by CSS transitions on bounds
    setTimeout(() => setAnimationState("idle"), ANIMATION_CONFIG.duration.tile);
  }, [prefersReducedMotion]);

  // Start resize animation
  const startResizeAnimation = useCallback(() => {
    if (prefersReducedMotion) {
      return;
    }
    setAnimationState("resizing");
  }, [prefersReducedMotion]);

  const endResizeAnimation = useCallback(() => {
    setAnimationState("idle");
  }, []);

  // Initial spawn animation
  useEffect(() => {
    animateSpawn();
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [animateSpawn]);

  // CSS transform string
  const transform = `translate(${styles.x}px, ${styles.y}px) scale(${styles.scale})`;
  const filter = styles.blur ? `blur(${styles.blur}px)` : "none";

  return {
    animationState,
    styles: {
      opacity: styles.opacity,
      transform,
      filter,
      willChange:
        animationState !== "idle" ? "transform, opacity, filter" : "auto",
    },
    animateClose,
    animateMinimize,
    animateRestore,
    startTileAnimation,
    startResizeAnimation,
    endResizeAnimation,
    isAnimating: animationState !== "idle",
  };
}
