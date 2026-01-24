"use client";

/**
 * Focus Mode - Hide distractions and enhance focus environment
 *
 * @see docs/execplans/desktop-evolution-prd.md Section 7.3
 */

import { Bell, BellOff, Clock, Focus, Music, X } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export type FocusModeSettings = {
  hideNotifications: boolean;
  hideDock: boolean;
  dimBackground: boolean;
  playAmbientSound: boolean;
  duration: number | null; // minutes, null for indefinite
};

type FocusModeProps = {
  isActive: boolean;
  settings: FocusModeSettings;
  onSettingsChange: (settings: Partial<FocusModeSettings>) => void;
  onEnd: () => void;
  className?: string;
};

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export function FocusMode({
  isActive,
  settings,
  onSettingsChange,
  onEnd,
  className,
}: FocusModeProps) {
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);

  // Timer effect
  useEffect(() => {
    if (!(isActive && settings.duration)) {
      setTimeRemaining(null);
      return;
    }

    setTimeRemaining(settings.duration * 60);

    const interval = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev === null || prev <= 1) {
          onEnd();
          return null;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isActive, settings.duration, onEnd]);

  if (!isActive) {
    return null;
  }

  return (
    <>
      {/* Dimmed background overlay */}
      {settings.dimBackground && (
        <div className="pointer-events-none fixed inset-0 z-40 bg-void/30" />
      )}

      {/* Focus mode indicator */}
      <div
        className={cn(
          "fixed top-4 right-4 z-50 rounded-xl border border-white/10 bg-void-surface/95 p-4 shadow-xl backdrop-blur-sm",
          className
        )}
      >
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-biolum/20">
            <Focus className="h-5 w-5 text-biolum" />
          </div>

          <div>
            <div className="font-medium">Focus Mode</div>
            {timeRemaining && (
              <div className="flex items-center gap-1 text-biolum-dim text-sm">
                <Clock className="h-3 w-3" />
                {formatTime(timeRemaining)}
              </div>
            )}
          </div>

          <Button
            className="ml-4 h-8 w-8"
            onClick={onEnd}
            size="icon"
            variant="ghost"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Quick settings */}
        <div className="mt-3 flex gap-2">
          <Button
            className={cn(
              "h-8",
              settings.hideNotifications && "bg-biolum/20 text-biolum"
            )}
            onClick={() =>
              onSettingsChange({
                hideNotifications: !settings.hideNotifications,
              })
            }
            size="sm"
            variant="outline"
          >
            {settings.hideNotifications ? (
              <BellOff className="mr-1 h-3 w-3" />
            ) : (
              <Bell className="mr-1 h-3 w-3" />
            )}
            DND
          </Button>

          <Button
            className={cn(
              "h-8",
              settings.playAmbientSound && "bg-biolum/20 text-biolum"
            )}
            onClick={() =>
              onSettingsChange({
                playAmbientSound: !settings.playAmbientSound,
              })
            }
            size="sm"
            variant="outline"
          >
            <Music className="mr-1 h-3 w-3" />
            Ambient
          </Button>
        </div>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FOCUS MODE TRIGGER
// ─────────────────────────────────────────────────────────────────────────────

type FocusModeTriggerProps = {
  isActive: boolean;
  onToggle: () => void;
  className?: string;
};

export function FocusModeTrigger({
  isActive,
  onToggle,
  className,
}: FocusModeTriggerProps) {
  return (
    <Button
      className={cn("gap-2", isActive && "bg-biolum/20 text-biolum", className)}
      onClick={onToggle}
      size="sm"
      variant="ghost"
    >
      <Focus className="h-4 w-4" />
      <span>Focus</span>
    </Button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// UTILITIES
// ─────────────────────────────────────────────────────────────────────────────

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}
