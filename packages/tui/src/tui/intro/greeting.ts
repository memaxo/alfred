/**
 * ALFRED TUI Greeting
 *
 * Time-appropriate greetings in the style of a proper butler.
 */

import { formatGreeting, getTransition, timeOfDayFromHour } from "@alfred/persona";
import { colors } from "../theme";
import { dim, fg } from "../typography";

// ─── Types ───────────────────────────────────────────────────────────────────

export type TimeOfDay = "morning" | "afternoon" | "evening" | "night";

// ─── Time Detection ──────────────────────────────────────────────────────────

export function getTimeOfDay(date: Date = new Date()): TimeOfDay {
  return timeOfDayFromHour(date.getHours());
}

// ─── Greeting Selection ──────────────────────────────────────────────────────

export function getGreeting(timeOfDay?: TimeOfDay): string {
  const time = timeOfDay ?? getTimeOfDay();
  const base = formatGreeting({ timeOfDay: time, honorific: "neutral" });
  const tail = getTransition("greet", "neutral");
  return `${base} ${tail}`.trim();
}

export function getGreetingForTime(date: Date = new Date()): string {
  const timeOfDay = getTimeOfDay(date);
  return getGreeting(timeOfDay);
}

// ─── Rendered Greeting ───────────────────────────────────────────────────────

export function renderGreeting(greeting?: string): string {
  const text = greeting ?? getGreeting();
  const primary = fg(colors.primary);
  const muted = fg(colors.textMuted);

  return `  ${primary("»")} ${muted(text)}`;
}

// ─── Greeting Animation Frames ───────────────────────────────────────────────

export function greetingAnimationFrames(greeting?: string): string[] {
  const text = greeting ?? getGreeting();
  const primary = fg(colors.primary);
  const textColor = fg(colors.text);

  const frames: string[] = [];
  const prefix = `  ${primary("»")} `;

  // Type out the greeting character by character
  for (let i = 0; i <= text.length; i++) {
    const visibleText = text.slice(0, i);
    const cursor = i < text.length ? dim("▌") : "";
    frames.push(prefix + textColor(visibleText) + cursor);
  }

  // Add a few frames with blinking cursor at the end
  frames.push(prefix + textColor(text) + dim("▌"));
  frames.push(`${prefix + textColor(text)} `);
  frames.push(prefix + textColor(text) + dim("▌"));
  frames.push(prefix + textColor(text));

  return frames;
}

// ─── Status-aware Greeting ───────────────────────────────────────────────────

export function getStatusGreeting(
  hasWarnings: boolean,
  hasErrors: boolean
): string {
  const timeOfDay = getTimeOfDay();

  if (hasErrors) {
    return `${formatGreeting({ timeOfDay, honorific: "neutral" })} Some systems require your attention.`;
  }

  if (hasWarnings) {
    return `${formatGreeting({ timeOfDay, honorific: "neutral" })} Operational, though not at full capacity.`;
  }

  return getGreeting(timeOfDay);
}

// ─── Farewell Messages ───────────────────────────────────────────────────────

export function getFarewell(): string {
  return getTransition("close", "neutral");
}

export function renderFarewell(): string {
  const text = getFarewell();
  const primary = fg(colors.primary);
  const muted = fg(colors.textMuted);

  return `  ${primary("»")} ${muted(text)}`;
}
