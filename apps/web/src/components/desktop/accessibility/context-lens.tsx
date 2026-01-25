"use client";

/**
 * Context Lens - Hover tooltip showing context information
 *
 * @see docs/execplans/desktop-evolution-prd.md Section 7.3
 */

import { Info } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface ContextInfo {
  title: string;
  description?: string;
  metadata?: Record<string, string>;
  shortcuts?: { key: string; action: string }[];
}

interface ContextLensProps {
  info: ContextInfo;
  children: React.ReactNode;
  position?: "top" | "bottom" | "left" | "right";
  delay?: number;
  className?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export function ContextLens({
  info,
  children,
  position = "top",
  delay = 500,
  className,
}: ContextLensProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [coords, setCoords] = useState({ x: 0, y: 0 });
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const triggerRef = useRef<HTMLDivElement>(null);

  const handleMouseEnter = () => {
    timeoutRef.current = setTimeout(() => {
      if (triggerRef.current) {
        const rect = triggerRef.current.getBoundingClientRect();
        setCoords({
          x: rect.left + rect.width / 2,
          y: position === "bottom" ? rect.bottom : rect.top,
        });
      }
      setIsVisible(true);
    }, delay);
  };

  const handleMouseLeave = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setIsVisible(false);
  };

  useEffect(
    () => () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    },
    []
  );

  return (
    <>
      <div
        className={className}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        ref={triggerRef}
      >
        {children}
      </div>

      {isVisible && (
        <ContextLensTooltip coords={coords} info={info} position={position} />
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TOOLTIP
// ─────────────────────────────────────────────────────────────────────────────

interface TooltipProps {
  info: ContextInfo;
  coords: { x: number; y: number };
  position: "top" | "bottom" | "left" | "right";
}

function ContextLensTooltip({ info, coords, position }: TooltipProps) {
  const offsetY = position === "bottom" ? 8 : -8;

  return (
    <div
      className={cn(
        "fixed z-50 w-64 rounded-lg border border-white/10 bg-void-surface/95 p-3 shadow-xl backdrop-blur-sm",
        "fade-in-0 zoom-in-95 animate-in",
        position === "bottom" ? "origin-top" : "origin-bottom"
      )}
      style={{
        left: coords.x,
        top: coords.y + offsetY,
        transform: `translateX(-50%) ${position === "top" ? "translateY(-100%)" : ""}`,
      }}
    >
      {/* Title */}
      <div className="flex items-center gap-2">
        <Info className="h-4 w-4 text-biolum" />
        <span className="font-medium">{info.title}</span>
      </div>

      {/* Description */}
      {info.description && (
        <p className="mt-1 text-biolum-dim text-sm">{info.description}</p>
      )}

      {/* Metadata */}
      {info.metadata && Object.keys(info.metadata).length > 0 && (
        <div className="mt-2 space-y-1">
          {Object.entries(info.metadata).map(([key, value]) => (
            <div className="flex justify-between text-xs" key={key}>
              <span className="text-biolum-dim">{key}</span>
              <span>{value}</span>
            </div>
          ))}
        </div>
      )}

      {/* Shortcuts */}
      {info.shortcuts && info.shortcuts.length > 0 && (
        <div className="mt-2 border-white/5 border-t pt-2">
          <div className="mb-1 text-biolum-dim text-xs">Shortcuts</div>
          {info.shortcuts.map((shortcut) => (
            <div
              className="flex items-center justify-between text-xs"
              key={shortcut.key}
            >
              <span>{shortcut.action}</span>
              <kbd className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-xs">
                {shortcut.key}
              </kbd>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
