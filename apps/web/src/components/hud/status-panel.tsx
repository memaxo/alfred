/**
 * JARVIS-Style Status Panel
 *
 * Holographic floating panel for real-time system status display.
 * Inspired by Iron Man HUD with ALFRED's void/bioluminescent aesthetic.
 *
 * @module hud/status-panel
 */

"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Activity, AlertTriangle, CheckCircle2, Cpu, Zap } from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";

export type StatusLevel = "nominal" | "warning" | "critical" | "processing";

export type StatusItem = {
  id: string;
  label: string;
  value: string | number;
  status: StatusLevel;
  detail?: string;
};

export type StatusPanelProps = {
  /** Panel title */
  title?: string;
  /** Status items to display */
  items: StatusItem[];
  /** Position on screen */
  position?: "top-left" | "top-right" | "bottom-left" | "bottom-right";
  /** Whether panel is expanded */
  expanded?: boolean;
  /** Toggle expansion callback */
  onToggle?: () => void;
  /** Additional className */
  className?: string;
  /** Enable scan line effect */
  scanLines?: boolean;
  /** Panel transparency (0-1) */
  transparency?: number;
};

const STATUS_COLORS: Record<StatusLevel, string> = {
  nominal: "text-emerald-400",
  warning: "text-amber-400",
  critical: "text-red-400",
  processing: "text-cyan-400",
};

const STATUS_GLOW: Record<StatusLevel, string> = {
  nominal: "shadow-emerald-500/20",
  warning: "shadow-amber-500/20",
  critical: "shadow-red-500/30",
  processing: "shadow-cyan-500/30",
};

const STATUS_ICONS: Record<
  StatusLevel,
  React.ComponentType<{ className?: string }>
> = {
  nominal: CheckCircle2,
  warning: AlertTriangle,
  critical: Zap,
  processing: Activity,
};

const POSITION_CLASSES: Record<
  NonNullable<StatusPanelProps["position"]>,
  string
> = {
  "top-left": "top-4 left-4",
  "top-right": "top-4 right-4",
  "bottom-left": "bottom-4 left-4",
  "bottom-right": "bottom-4 right-4",
};

/**
 * Individual status item row
 */
function StatusRow({
  item,
  reduceMotion,
}: {
  item: StatusItem;
  reduceMotion: boolean;
}) {
  const Icon = STATUS_ICONS[item.status];

  return (
    <motion.div
      animate={{ opacity: 1, x: 0 }}
      className="flex items-center justify-between gap-4 py-1.5"
      exit={reduceMotion ? undefined : { opacity: 0, x: 10 }}
      initial={reduceMotion ? false : { opacity: 0, x: -10 }}
      transition={reduceMotion ? { duration: 0 } : undefined}
    >
      <div className="flex items-center gap-2">
        <Icon className={cn("h-3.5 w-3.5", STATUS_COLORS[item.status])} />
        <span className="font-mono text-white/70 text-xs uppercase tracking-wide">
          {item.label}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "font-medium font-mono text-xs",
            STATUS_COLORS[item.status]
          )}
        >
          {item.value}
        </span>
        {item.status === "processing" && (
          <motion.span
            animate={reduceMotion ? { opacity: 1 } : { opacity: [0.3, 1, 0.3] }}
            className="h-1.5 w-1.5 rounded-full bg-cyan-400"
            transition={
              reduceMotion
                ? { duration: 0 }
                : { duration: 1, repeat: Number.POSITIVE_INFINITY }
            }
          />
        )}
      </div>
    </motion.div>
  );
}

/**
 * Scan line overlay effect
 */
function ScanLineOverlay({ reduceMotion }: { reduceMotion: boolean }) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-lg">
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0, 255, 136, 0.02) 2px, rgba(0, 255, 136, 0.02) 4px)",
        }}
      />
      {reduceMotion ? null : (
        <motion.div
          animate={{ y: ["0%", "100%", "0%"] }}
          className="absolute inset-x-0 h-px bg-gradient-to-r from-transparent via-cyan-400/30 to-transparent"
          transition={{
            duration: 4,
            repeat: Number.POSITIVE_INFINITY,
            ease: "linear",
          }}
        />
      )}
    </div>
  );
}

/**
 * Holographic border effect
 */
function HolographicBorder({ reduceMotion }: { reduceMotion: boolean }) {
  return (
    <>
      {/* Corner accents */}
      <div className="-left-px -top-px absolute h-4 w-4 border-cyan-400/40 border-t border-l" />
      <div className="-right-px -top-px absolute h-4 w-4 border-cyan-400/40 border-t border-r" />
      <div className="-bottom-px -left-px absolute h-4 w-4 border-cyan-400/40 border-b border-l" />
      <div className="-bottom-px -right-px absolute h-4 w-4 border-cyan-400/40 border-r border-b" />

      {/* Animated border pulse */}
      {reduceMotion ? (
        <div className="absolute inset-0 rounded-lg border border-cyan-400/20" />
      ) : (
        <motion.div
          animate={{ opacity: [0.2, 0.4, 0.2] }}
          className="absolute inset-0 rounded-lg border border-cyan-400/20"
          transition={{ duration: 2, repeat: Number.POSITIVE_INFINITY }}
        />
      )}
    </>
  );
}

/**
 * JARVIS-style floating status panel
 */
export function StatusPanel({
  title = "SYSTEMS",
  items,
  position = "top-right",
  expanded = true,
  onToggle,
  className,
  scanLines = true,
  transparency = 0.85,
}: StatusPanelProps) {
  const reduceMotion = useReducedMotion() ?? false;
  const overallStatus = React.useMemo(() => {
    if (items.some((i) => i.status === "critical")) {
      return "critical";
    }
    if (items.some((i) => i.status === "warning")) {
      return "warning";
    }
    if (items.some((i) => i.status === "processing")) {
      return "processing";
    }
    return "nominal";
  }, [items]);

  return (
    <motion.div
      animate={{ opacity: 1, scale: 1 }}
      className={cn("fixed z-50 w-64", POSITION_CLASSES[position], className)}
      exit={reduceMotion ? undefined : { opacity: 0, scale: 0.95 }}
      initial={reduceMotion ? false : { opacity: 0, scale: 0.95 }}
      transition={reduceMotion ? { duration: 0 } : undefined}
    >
      <div
        className={cn(
          "relative rounded-lg border border-white/10 shadow-xl",
          STATUS_GLOW[overallStatus]
        )}
        style={{
          backgroundColor: `rgba(0, 0, 0, ${transparency})`,
          backdropFilter: "blur(8px)",
        }}
      >
        <HolographicBorder reduceMotion={reduceMotion} />
        {scanLines && <ScanLineOverlay reduceMotion={reduceMotion} />}

        {/* Header */}
        <button
          className="flex w-full items-center justify-between border-white/10 border-b px-4 py-2"
          onClick={onToggle}
          type="button"
        >
          <div className="flex items-center gap-2">
            <Cpu className={cn("h-4 w-4", STATUS_COLORS[overallStatus])} />
            <span className="font-mono text-white/80 text-xs uppercase tracking-widest">
              {title}
            </span>
          </div>
          <motion.div
            animate={
              !reduceMotion && overallStatus === "processing"
                ? { scale: [1, 1.2, 1], opacity: [0.7, 1, 0.7] }
                : { scale: 1, opacity: 1 }
            }
            className={cn("h-2 w-2 rounded-full", STATUS_COLORS[overallStatus])}
            style={{
              boxShadow:
                overallStatus === "nominal"
                  ? "0 0 8px rgba(52, 211, 153, 0.5)"
                  : overallStatus === "warning"
                    ? "0 0 8px rgba(251, 191, 36, 0.5)"
                    : overallStatus === "critical"
                      ? "0 0 12px rgba(248, 113, 113, 0.7)"
                      : "0 0 8px rgba(34, 211, 238, 0.5)",
            }}
            transition={
              reduceMotion
                ? { duration: 0 }
                : { duration: 1, repeat: Number.POSITIVE_INFINITY }
            }
          />
        </button>

        {/* Content */}
        <AnimatePresence>
          {expanded && (
            <motion.div
              animate={{ height: "auto", opacity: 1 }}
              className="overflow-hidden"
              exit={{ height: 0, opacity: 0 }}
              initial={reduceMotion ? false : { height: 0, opacity: 0 }}
              transition={reduceMotion ? { duration: 0 } : { duration: 0.2 }}
            >
              <div className="divide-y divide-white/5 px-4 py-2">
                {items.map((item) => (
                  <StatusRow
                    item={item}
                    key={item.id}
                    reduceMotion={reduceMotion}
                  />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Footer timestamp */}
        <div className="border-white/5 border-t px-4 py-1.5">
          <span className="font-mono text-[10px] text-white/30">
            LAST UPDATE:{" "}
            {new Date().toLocaleTimeString("en-US", {
              hour12: false,
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            })}
          </span>
        </div>
      </div>
    </motion.div>
  );
}

/**
 * Compact status indicator for minimal display
 */
export function StatusIndicator({
  status,
  label,
  pulse = false,
  className,
}: {
  status: StatusLevel;
  label?: string;
  pulse?: boolean;
  className?: string;
}) {
  const reduceMotion = useReducedMotion() ?? false;
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <motion.div
        animate={
          !reduceMotion && pulse
            ? { scale: [1, 1.3, 1], opacity: [0.7, 1, 0.7] }
            : {}
        }
        className={cn("h-2 w-2 rounded-full", STATUS_COLORS[status])}
        style={{
          boxShadow:
            status === "nominal"
              ? "0 0 6px rgba(52, 211, 153, 0.4)"
              : status === "critical"
                ? "0 0 8px rgba(248, 113, 113, 0.6)"
                : "0 0 6px rgba(34, 211, 238, 0.4)",
        }}
        transition={
          reduceMotion
            ? { duration: 0 }
            : { duration: 1.5, repeat: Number.POSITIVE_INFINITY }
        }
      />
      {label && (
        <span className="font-mono text-white/60 text-xs uppercase tracking-wide">
          {label}
        </span>
      )}
    </div>
  );
}
