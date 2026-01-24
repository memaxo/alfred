"use client";

/**
 * Focus Indicator - Visual focus ring for accessibility
 *
 * Provides a visible focus indicator that follows the focused element.
 */

import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

export function FocusIndicator() {
  const [focusRect, setFocusRect] = useState<DOMRect | null>(null);
  const [isKeyboardUser, setIsKeyboardUser] = useState(false);

  useEffect(() => {
    // Detect keyboard vs mouse user
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Tab") {
        setIsKeyboardUser(true);
      }
    };

    const handleMouseDown = () => {
      setIsKeyboardUser(false);
      setFocusRect(null);
    };

    // Track focus changes
    const handleFocusIn = (e: FocusEvent) => {
      if (!isKeyboardUser) {
        return;
      }

      const target = e.target as HTMLElement;
      if (target && target !== document.body) {
        const rect = target.getBoundingClientRect();
        setFocusRect(rect);
      }
    };

    const handleFocusOut = () => {
      setFocusRect(null);
    };

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("focusin", handleFocusIn);
    document.addEventListener("focusout", handleFocusOut);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("focusin", handleFocusIn);
      document.removeEventListener("focusout", handleFocusOut);
    };
  }, [isKeyboardUser]);

  if (!(focusRect && isKeyboardUser)) {
    return null;
  }

  return (
    <div
      aria-hidden="true"
      className={cn(
        "pointer-events-none fixed z-[9998] rounded-lg border-2 border-biolum transition-all duration-150",
        "shadow-[0_0_0_2px_rgba(34,211,238,0.3)]"
      )}
      style={{
        top: focusRect.top - 4,
        left: focusRect.left - 4,
        width: focusRect.width + 8,
        height: focusRect.height + 8,
      }}
    />
  );
}
