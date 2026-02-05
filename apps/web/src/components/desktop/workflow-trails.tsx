/**
 * Workflow Trails - Desktop overlay for workflow execution visualization
 *
 * Shows glowing paths between windows when workflows run, with animated data
 * packets flowing along the paths. Supports reduced motion and respects
 * the PRD's "Workflow Trails" creative concept.
 *
 * Features:
 * - Glowing paths connecting affected windows
 * - Animated data packets showing data flow
 * - Fading trails for completed steps
 * - Reduced motion support
 * - Driven by real workflow events (no simulation)
 *
 * @see docs/execplans/desktop-evolution-prd.md Part III - Creative Ideas
 */

import { STAGE_ORDER, type StageName } from "@alfred/pipeline";
import { motion, useReducedMotion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useShallow } from "zustand/react/shallow";

import type { WindowInstance, WindowType } from "@/store/desktop/types.new";

import { cn } from "@/lib/utils";
import { useDesktopStore } from "@/store/desktop";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

interface WorkflowTrail {
  id: string;
  fromWindowId: string;
  toWindowId: string;
  status: "active" | "completed" | "failed" | "fading";
  startTime: number;
  endTime?: number;
  stepIndex: number;
  dataType?: string;
}

interface TrailPoint {
  x: number;
  y: number;
}

interface TrailPath {
  trail: WorkflowTrail;
  from: TrailPoint;
  to: TrailPoint;
  controlPoint: TrailPoint;
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

type WorkflowRunStatus =
  | "idle"
  | "connecting"
  | "running"
  | "completed"
  | "error"
  | "suspended";

type WorkflowStepStatus = "pending" | "running" | "completed" | "failed";

interface WorkflowStep {
  id: string;
  name: string;
  status: WorkflowStepStatus;
}

function getWindowCenter(windowId: string): TrailPoint | null {
  const element = document.querySelector(`[data-window-id="${windowId}"]`);
  if (!element) {
    return null;
  }

  const rect = element.getBoundingClientRect();
  return {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2,
  };
}

function calculateControlPoint(from: TrailPoint, to: TrailPoint): TrailPoint {
  // Create a gentle curve - control point is offset perpendicular to the line
  const midX = (from.x + to.x) / 2;
  const midY = (from.y + to.y) / 2;
  const offset = Math.min(100, Math.abs(to.x - from.x) * 0.2);

  // Offset perpendicular to create curve
  return {
    x: midX + offset,
    y: midY - offset,
  };
}

function createBezierPath(
  from: TrailPoint,
  control: TrailPoint,
  to: TrailPoint
): string {
  return `M ${from.x} ${from.y} Q ${control.x} ${control.y} ${to.x} ${to.y}`;
}

function isStageName(value: string): value is StageName {
  return (STAGE_ORDER as readonly string[]).includes(value);
}

function getWorkflowSteps(window: WindowInstance): WorkflowStep[] {
  const raw = (window.data as Record<string, unknown> | undefined)?.steps;
  if (!Array.isArray(raw)) {
    return [];
  }

  const out: WorkflowStep[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") {
      continue;
    }
    const obj = item as Record<string, unknown>;
    const id = typeof obj.id === "string" ? obj.id : undefined;
    const name = typeof obj.name === "string" ? obj.name : id;
    const status = typeof obj.status === "string" ? obj.status : undefined;
    if (!id || !name) {
      continue;
    }
    if (
      status !== "pending" &&
      status !== "running" &&
      status !== "completed" &&
      status !== "failed"
    ) {
      continue;
    }
    out.push({ id, name, status });
  }

  // Prefer pipeline stage order when IDs match StageName
  const sorted = [...out];
  sorted.sort((a, b) => {
    const ai = isStageName(a.id) ? STAGE_ORDER.indexOf(a.id) : Number.MAX_VALUE;
    const bi = isStageName(b.id) ? STAGE_ORDER.indexOf(b.id) : Number.MAX_VALUE;
    return ai - bi;
  });
  return sorted;
}

function getWorkflowStatus(window: WindowInstance): WorkflowRunStatus {
  const raw = (window.data as Record<string, unknown> | undefined)?.status;
  return raw === "connecting" ||
    raw === "running" ||
    raw === "completed" ||
    raw === "error" ||
    raw === "suspended"
    ? raw
    : "idle";
}

const STAGE_SURFACES: Record<StageName, readonly WindowType[]> = {
  init: ["linear", "project", "taskmanager"],
  context: ["files", "agentfs", "knowledge", "rag"],
  plan: ["plan", "code"],
  schedule: ["agents", "plan"],
  execute: ["agents", "terminal", "codex"],
  review: ["reviews", "pr-review"],
  learn: ["learning", "knowledge"],
  summarize: ["chat", "taskmanager"],
} as const;

function pickBestWindowId(
  windows: readonly WindowInstance[],
  activeWorkspaceId: number,
  preferredTypes: readonly WindowType[]
): string | null {
  const candidates = windows.filter(
    (w) =>
      w.workspaceId === activeWorkspaceId &&
      w.state !== "minimized" &&
      preferredTypes.includes(w.type)
  );
  if (candidates.length === 0) {
    return null;
  }

  const focused = candidates.find((w) => w.isFocused);
  if (focused) {
    return focused.id;
  }

  return candidates.reduce((a, b) =>
    a.lastFocusedAt > b.lastFocusedAt ? a : b
  ).id;
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

function TrailPathComponent({
  path,
  isReducedMotion,
}: {
  path: TrailPath;
  isReducedMotion: boolean;
}) {
  const pathD = createBezierPath(path.from, path.controlPoint, path.to);
  const isCompleted = path.trail.status === "completed";
  const isFailed = path.trail.status === "failed";
  const isFading = path.trail.status === "fading";

  const pathVariants = {
    initial: { pathLength: 0, opacity: 0 },
    active: { pathLength: 1, opacity: 1 },
    completed: { pathLength: 1, opacity: isFading ? 0 : 0.6 },
  };

  const transition = isReducedMotion
    ? { duration: 0 }
    : {
        pathLength: { duration: 0.8, ease: "easeOut" },
        opacity: { duration: 0.3 },
      };

  return (
    <>
      {/* Glow effect */}
      <motion.path
        d={pathD}
        fill="none"
        initial="initial"
        stroke="url(#trailGlow)"
        strokeLinecap="round"
        strokeWidth={8}
        style={{
          filter: "blur(4px)",
        }}
        transition={transition}
        variants={pathVariants}
        animate={isCompleted ? "completed" : "active"}
      />

      {/* Main trail line */}
      <motion.path
        d={pathD}
        fill="none"
        initial="initial"
        stroke={isFailed ? "#EF4444" : (isCompleted ? "#10B981" : "#A855F7")}
        strokeLinecap="round"
        strokeWidth={3}
        transition={transition}
        variants={pathVariants}
        animate={isCompleted ? "completed" : "active"}
      />

      {/* Data packet animation */}
      {!isCompleted && !isReducedMotion && <DataPacket pathD={pathD} />}
    </>
  );
}

function DataPacket({ pathD }: { pathD: string }) {
  return (
    <motion.circle r={5} fill="#FBBF24" filter="url(#glow)">
      <animateMotion dur="1.5s" repeatCount="indefinite" path={pathD} />
      <animate
        attributeName="opacity"
        dur="1.5s"
        repeatCount="indefinite"
        values="1;0.5;1"
      />
    </motion.circle>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

interface WorkflowTrailsProps {
  className?: string;
}

export function WorkflowTrails({ className }: WorkflowTrailsProps) {
  const [trails, setTrails] = useState<WorkflowTrail[]>([]);
  const trailsRef = useRef<WorkflowTrail[]>([]);
  const reducedMotion = useReducedMotion();

  const { activeWorkspaceId, mode, windows } = useDesktopStore(
    useShallow((s) => ({
      activeWorkspaceId: s.activeWorkspaceId,
      mode: s.mode,
      windows: s.windows,
    }))
  );

  // Derive trails from real workflow window state (no simulation).
  //
  // Workflow execution events are already reduced into `window.data.steps/status`
  // by `useWorkflowSubscription()` inside `WorkflowWindow`.
  useEffect(() => {
    if (mode !== "desktop") {
      setTrails([]);
      return;
    }

    const workflowWindows = windows.filter(
      (w) =>
        w.workspaceId === activeWorkspaceId &&
        w.state !== "minimized" &&
        w.type === "workflow"
    );
    const activeWorkflow = workflowWindows
      .map((w) => ({ window: w, status: getWorkflowStatus(w) }))
      .find((w) => w.status === "running" || w.status === "connecting");

    if (!activeWorkflow) {
      setTrails([]);
      return;
    }

    const steps = getWorkflowSteps(activeWorkflow.window).filter((s) =>
      isStageName(s.id)
    ) as (WorkflowStep & { id: StageName })[];

    const newTrails: WorkflowTrail[] = [];
    for (const [index, step] of steps.entries()) {
      const targetWindowId = pickBestWindowId(
        windows,
        activeWorkspaceId,
        STAGE_SURFACES[step.id]
      );
      if (!targetWindowId) {
        continue;
      }

      const existingTrail = trailsRef.current.find(
        (t) => t.id === `${activeWorkflow.window.id}:${step.id}`
      );

      const status: WorkflowTrail["status"] =
        step.status === "failed"
          ? "failed"
          : (step.status === "completed"
            ? "completed"
            : "active");

      if (existingTrail) {
        // Keep existing timing but update completion/failure status
        const shouldSetEndTime =
          status !== "active" &&
          existingTrail.status === "active" &&
          typeof existingTrail.endTime !== "number";
        newTrails.push({
          ...existingTrail,
          status,
          endTime: shouldSetEndTime ? Date.now() : existingTrail.endTime,
        });
        continue;
      }

      newTrails.push({
        id: `${activeWorkflow.window.id}:${step.id}`,
        fromWindowId: activeWorkflow.window.id,
        toWindowId: targetWindowId,
        status,
        startTime: Date.now(),
        stepIndex: index,
        dataType: step.name,
      });
    }

    trailsRef.current = newTrails;
    setTrails(newTrails);

    // Fade out completed trails after delay
    const timeout = setTimeout(() => {
      setTrails((prev) =>
        prev.map((t) =>
          t.status === "completed" ? { ...t, status: "fading" } : t
        )
      );
    }, 3000);

    return () => clearTimeout(timeout);
  }, [activeWorkspaceId, mode, windows]);

  // Calculate trail paths based on window positions
  const trailPaths = useMemo(() => {
    if (mode !== "desktop") {
      return [];
    }

    return trails
      .filter((trail) => trail.status !== "fading")
      .map((trail): TrailPath | null => {
        const from = getWindowCenter(trail.fromWindowId);
        const to = getWindowCenter(trail.toWindowId);

        if (!from || !to) {
          return null;
        }

        const controlPoint = calculateControlPoint(from, to);

        return {
          trail,
          from,
          to,
          controlPoint,
        };
      })
      .filter((path): path is TrailPath => path !== null);
  }, [trails, mode, reducedMotion]);

  // Clean up fading trails
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setTrails((prev) =>
        prev.filter((t) => {
          if (t.status !== "fading") {
            return true;
          }
          return t.endTime && now - t.endTime < 5000;
        })
      );
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Don't render if not in desktop mode or no trails
  if (mode !== "desktop" || trailPaths.length === 0) {
    return null;
  }

  return (
    <svg
      aria-hidden="true"
      className={cn("pointer-events-none fixed inset-0 z-450", className)}
      style={{ width: "100vw", height: "100vh" }}
    >
      <title>Workflow execution trails</title>
      <defs>
        {/* Glow filter */}
        <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        {/* Trail glow gradient */}
        <linearGradient id="trailGlow" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#A855F7" stopOpacity="0.8" />
          <stop offset="50%" stopColor="#FBBF24" stopOpacity="1" />
          <stop offset="100%" stopColor="#A855F7" stopOpacity="0.8" />
        </linearGradient>
      </defs>

      {trailPaths.map((path) => (
        <TrailPathComponent
          key={path.trail.id}
          isReducedMotion={!!reducedMotion}
          path={path}
        />
      ))}
    </svg>
  );
}

export default WorkflowTrails;
