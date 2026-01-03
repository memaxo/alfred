"use client";

/**
 * Clock Widget - Menu bar clock with date
 */

import { useEffect, useState } from "react";

export function Clock() {
  const [time, setTime] = useState<Date | null>(null);

  useEffect(() => {
    // Set initial time on client
    setTime(new Date());

    // Update every minute
    const interval = setInterval(() => {
      setTime(new Date());
    }, 60_000);

    return () => clearInterval(interval);
  }, []);

  if (!time) {
    return <div className="w-32" />; // Placeholder to prevent layout shift
  }

  const dayName = time.toLocaleDateString("en-US", { weekday: "short" });
  const monthDay = time.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
  const timeStr = time.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  return (
    <button
      aria-label="Date and time"
      className="flex items-center gap-2 rounded px-2 py-1 text-biolum-dim text-sm transition-colors hover:bg-white/5 hover:text-biolum"
      type="button"
    >
      <span>
        {dayName} {monthDay}
      </span>
      <span className="font-medium text-biolum">{timeStr}</span>
    </button>
  );
}
