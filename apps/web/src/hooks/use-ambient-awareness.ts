/**
 * Ambient Awareness Hook
 *
 * Powers JARVIS-style proactive intelligence by monitoring
 * system state, time, and user activity to surface relevant
 * information before it's requested.
 *
 * @module hooks/use-ambient-awareness
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { formatGreeting, getTransition } from "@alfred/persona";

/**
 * Time of day categories
 */
export type TimeOfDay = "morning" | "afternoon" | "evening" | "night";

/**
 * User focus state
 */
export type FocusState = "deep" | "shallow" | "idle" | "away";

/**
 * System status levels
 */
export type SystemStatus = "nominal" | "degraded" | "critical" | "unknown";

/**
 * Ambient awareness state
 */
export type AmbientState = {
  // Temporal awareness
  time: {
    current: Date;
    timeOfDay: TimeOfDay;
    isWorkingHours: boolean;
    sessionDuration: number; // minutes
    timeSinceLastInteraction: number; // minutes
  };

  // User awareness
  user: {
    focusState: FocusState;
    interactionCount: number;
    lastActivity: Date;
    fatiguePrediction: number; // 0-1
  };

  // System awareness (placeholders for actual integrations)
  systems: {
    overall: SystemStatus;
    build?: { status: SystemStatus; message?: string };
    api?: { status: SystemStatus; latencyMs?: number };
    database?: { status: SystemStatus; connectionCount?: number };
  };

  // Contextual data
  context: {
    currentTask?: string;
    pendingItems: number;
    upcomingDeadlines: Array<{ name: string; due: Date }>;
  };
};

/**
 * Proactive trigger definition
 */
export type ProactiveTrigger = {
  id: string;
  condition: (state: AmbientState) => boolean;
  priority: "low" | "medium" | "high" | "critical";
  message: (state: AmbientState) => { title: string; body?: string };
  cooldownMs: number;
  type: "info" | "warning" | "success" | "critical";
};

/**
 * Ambient awareness configuration
 */
export type AmbientConfig = {
  /** Enable ambient awareness loop (time/user activity tracking). */
  enabled?: boolean;
  /** Update interval in ms */
  updateInterval?: number;
  /** Working hours start (0-23) */
  workingHoursStart?: number;
  /** Working hours end (0-23) */
  workingHoursEnd?: number;
  /** Enable proactive notifications */
  proactiveEnabled?: boolean;
  /** Custom triggers */
  customTriggers?: ProactiveTrigger[];
};

/**
 * Determine time of day from hour
 */
function getTimeOfDay(hour: number): TimeOfDay {
  if (hour >= 5 && hour < 12) {
    return "morning";
  }
  if (hour >= 12 && hour < 17) {
    return "afternoon";
  }
  if (hour >= 17 && hour < 22) {
    return "evening";
  }
  return "night";
}

/**
 * Default proactive triggers
 */
const DEFAULT_TRIGGERS: ProactiveTrigger[] = [
  {
    id: "long_session",
    condition: (s) => s.time.sessionDuration > 120, // 2 hours
    priority: "low",
    message: (s) => ({
      title: "Extended session detected",
      body: `We've been at this for ${Math.round(s.time.sessionDuration / 60)} hours. Perhaps a brief respite?`,
    }),
    cooldownMs: 30 * 60 * 1000, // 30 minutes
    type: "info",
  },
  {
    id: "late_night",
    condition: (s) =>
      s.time.timeOfDay === "night" && s.time.sessionDuration > 30,
    priority: "low",
    message: () => ({
      title: "Burning the midnight oil",
      body: "It’s quite late. Shall I dim the display?",
    }),
    cooldownMs: 60 * 60 * 1000, // 1 hour
    type: "info",
  },
  {
    id: "user_idle",
    condition: (s) =>
      s.time.timeSinceLastInteraction > 15 && s.user.focusState !== "away",
    priority: "low",
    message: () => ({
      title: "Systems on standby",
      body: "I’ll be here when you need me.",
    }),
    cooldownMs: 30 * 60 * 1000, // 30 minutes
    type: "info",
  },
  {
    id: "system_degraded",
    condition: (s) => s.systems.overall === "degraded",
    priority: "high",
    message: () => ({
      title: "System performance anomaly",
      body: "I've detected some degradation. Investigating now.",
    }),
    cooldownMs: 5 * 60 * 1000, // 5 minutes
    type: "warning",
  },
  {
    id: "system_critical",
    condition: (s) => s.systems.overall === "critical",
    priority: "critical",
    message: () => ({
      title: "Critical system alert",
      body: "Immediate attention required.",
    }),
    cooldownMs: 1 * 60 * 1000, // 1 minute
    type: "critical",
  },
  {
    id: "fatigue_warning",
    condition: (s) => s.user.fatiguePrediction > 0.7,
    priority: "medium",
    message: (s) => ({
      title: "Fatigue indicators elevated",
      body: `Based on ${s.time.sessionDuration} minutes of activity, efficiency may be declining. Consider a break.`,
    }),
    cooldownMs: 45 * 60 * 1000, // 45 minutes
    type: "warning",
  },
];

const EMPTY_CUSTOM_TRIGGERS: ProactiveTrigger[] = [];

/**
 * Hook for JARVIS-style ambient awareness
 */
export function useAmbientAwareness(
  config: AmbientConfig = {},
  onTrigger?: (trigger: ProactiveTrigger, state: AmbientState) => void
) {
  const {
    enabled = true,
    updateInterval = 30_000, // 30 seconds
    workingHoursStart = 9,
    workingHoursEnd = 18,
    proactiveEnabled = true,
    customTriggers = EMPTY_CUSTOM_TRIGGERS,
  } = config;

  const sessionStartRef = useRef(Date.now());
  const lastInteractionRef = useRef(Date.now());
  const interactionCountRef = useRef(0);
  const triggerCooldownsRef = useRef<Map<string, number>>(new Map());

  const [state, setState] = useState<AmbientState>(() => {
    const now = new Date();
    const hour = now.getHours();

    return {
      time: {
        current: now,
        timeOfDay: getTimeOfDay(hour),
        isWorkingHours: hour >= workingHoursStart && hour < workingHoursEnd,
        sessionDuration: 0,
        timeSinceLastInteraction: 0,
      },
      user: {
        focusState: "idle",
        interactionCount: 0,
        lastActivity: now,
        fatiguePrediction: 0,
      },
      systems: {
        overall: "nominal",
      },
      context: {
        pendingItems: 0,
        upcomingDeadlines: [],
      },
    };
  });

  /**
   * Record user interaction
   */
  const recordInteraction = useCallback(() => {
    lastInteractionRef.current = Date.now();
    interactionCountRef.current += 1;
  }, []);

  /**
   * Update system status
   */
  const updateSystemStatus = useCallback(
    (updates: Partial<AmbientState["systems"]>) => {
      setState((prev) => ({
        ...prev,
        systems: { ...prev.systems, ...updates },
      }));
    },
    []
  );

  /**
   * Update context
   */
  const updateContext = useCallback(
    (updates: Partial<AmbientState["context"]>) => {
      setState((prev) => ({
        ...prev,
        context: { ...prev.context, ...updates },
      }));
    },
    []
  );

  /**
   * Calculate fatigue prediction based on session length and time of day
   */
  const calculateFatigue = useCallback(
    (sessionMinutes: number, timeOfDay: TimeOfDay): number => {
      // Base fatigue from session length
      let fatigue = Math.min(1, sessionMinutes / 240); // Max at 4 hours

      // Increase fatigue at night
      if (timeOfDay === "night") {
        fatigue *= 1.3;
      }

      // Slight increase in late afternoon
      if (timeOfDay === "evening") {
        fatigue *= 1.1;
      }

      return Math.min(1, fatigue);
    },
    []
  );

  /**
   * Determine focus state from interaction patterns
   */
  const determineFocusState = useCallback(
    (timeSinceLastMs: number, recentInteractions: number): FocusState => {
      if (timeSinceLastMs > 15 * 60 * 1000) {
        return "away"; // 15 min
      }
      if (timeSinceLastMs > 5 * 60 * 1000) {
        return "idle"; // 5 min
      }
      if (recentInteractions > 10) {
        return "deep"; // High activity
      }
      return "shallow";
    },
    []
  );

  /**
   * Check and fire triggers
   */
  const checkTriggers = useCallback(
    (currentState: AmbientState) => {
      if (!(proactiveEnabled && onTrigger)) {
        return;
      }

      const now = Date.now();
      const allTriggers = [...DEFAULT_TRIGGERS, ...customTriggers];

      for (const trigger of allTriggers) {
        // Check cooldown
        const lastFired = triggerCooldownsRef.current.get(trigger.id) ?? 0;
        if (now - lastFired < trigger.cooldownMs) {
          continue;
        }

        // Check condition
        if (trigger.condition(currentState)) {
          triggerCooldownsRef.current.set(trigger.id, now);
          onTrigger(trigger, currentState);
        }
      }
    },
    [proactiveEnabled, customTriggers, onTrigger]
  );

  /**
   * Main update loop
   */
  useEffect(() => {
    if (!enabled) {
      return;
    }
    const update = () => {
      const now = new Date();
      const hour = now.getHours();
      const sessionMs = Date.now() - sessionStartRef.current;
      const sessionMinutes = sessionMs / 60_000;
      const timeSinceLastMs = Date.now() - lastInteractionRef.current;
      const timeSinceLastMinutes = timeSinceLastMs / 60_000;
      const timeOfDay = getTimeOfDay(hour);

      const newState: AmbientState = {
        time: {
          current: now,
          timeOfDay,
          isWorkingHours: hour >= workingHoursStart && hour < workingHoursEnd,
          sessionDuration: sessionMinutes,
          timeSinceLastInteraction: timeSinceLastMinutes,
        },
        user: {
          focusState: determineFocusState(
            timeSinceLastMs,
            interactionCountRef.current
          ),
          interactionCount: interactionCountRef.current,
          lastActivity: new Date(lastInteractionRef.current),
          fatiguePrediction: calculateFatigue(sessionMinutes, timeOfDay),
        },
        systems: state.systems, // Preserve system state
        context: state.context, // Preserve context
      };

      setState(newState);
      checkTriggers(newState);
    };

    // Initial update
    update();

    // Periodic updates
    const interval = setInterval(update, updateInterval);
    return () => clearInterval(interval);
  }, [
    enabled,
    updateInterval,
    workingHoursStart,
    workingHoursEnd,
    calculateFatigue,
    determineFocusState,
    checkTriggers,
    state.systems,
    state.context,
  ]);

  /**
   * Listen for user interactions
   */
  useEffect(() => {
    if (!enabled) {
      return;
    }
    const events = ["mousedown", "keydown", "scroll", "touchstart"];

    const handleInteraction = () => {
      recordInteraction();
    };

    for (const event of events) {
      window.addEventListener(event, handleInteraction, { passive: true });
    }

    return () => {
      for (const event of events) {
        window.removeEventListener(event, handleInteraction);
      }
    };
  }, [enabled, recordInteraction]);

  return {
    state,
    recordInteraction,
    updateSystemStatus,
    updateContext,
  };
}

/**
 * JARVIS-style greeting based on time of day
 */
export function getJarvisGreeting(state: AmbientState): string {
  const base = formatGreeting({
    timeOfDay: state.time.timeOfDay,
    honorific: "neutral",
  });
  const tail = getTransition("greet", "neutral");
  return `${base} ${tail}`.trim();
}

/**
 * JARVIS-style status summary
 */
export function getJarvisStatusSummary(state: AmbientState): string {
  const parts: string[] = [];

  // System status
  if (state.systems.overall === "nominal") {
    parts.push("All systems nominal.");
  } else if (state.systems.overall === "degraded") {
    parts.push("Some systems showing degradation.");
  } else if (state.systems.overall === "critical") {
    parts.push("Critical alerts require attention.");
  }

  // Session info
  if (state.time.sessionDuration > 60) {
    parts.push(
      `Session duration: ${Math.round(state.time.sessionDuration / 60)} hours.`
    );
  }

  // Pending items
  if (state.context.pendingItems > 0) {
    parts.push(`${state.context.pendingItems} items pending your review.`);
  }

  // Upcoming deadlines
  const urgentDeadlines = state.context.upcomingDeadlines.filter(
    (d) => d.due.getTime() - Date.now() < 24 * 60 * 60 * 1000 // Within 24 hours
  );
  if (urgentDeadlines.length > 0) {
    parts.push(
      `${urgentDeadlines.length} deadline${urgentDeadlines.length > 1 ? "s" : ""} within 24 hours.`
    );
  }

  return parts.join(" ");
}
