/**
 * ALFRED TUI Greeting
 *
 * Time-appropriate greetings in the style of a proper butler.
 */

import { colors } from "../theme";
import { dim, fg } from "../typography";

// ─── Types ───────────────────────────────────────────────────────────────────

export type TimeOfDay = "morning" | "afternoon" | "evening" | "night";

// ─── Time Detection ──────────────────────────────────────────────────────────

export function getTimeOfDay(date: Date = new Date()): TimeOfDay {
  const hour = date.getHours();

  if (hour >= 5 && hour < 12) {
    return "morning";
  }
  if (hour >= 12 && hour < 17) {
    return "afternoon";
  }
  if (hour >= 17 && hour < 21) {
    return "evening";
  }
  return "night";
}

// ─── Greeting Messages ───────────────────────────────────────────────────────

const GREETINGS: Record<TimeOfDay, string[]> = {
  morning: [
    "Good morning, Sir. How may I assist you today?",
    "Good morning, Sir. I trust you slept well.",
    "Good morning, Sir. A fresh day awaits.",
  ],
  afternoon: [
    "Good afternoon, Sir. How may I be of service?",
    "Good afternoon, Sir. I hope the day finds you well.",
    "Good afternoon, Sir. At your service.",
  ],
  evening: [
    "Good evening, Sir. How may I assist?",
    "Good evening, Sir. Ready when you are.",
    "Good evening, Sir. What shall we accomplish tonight?",
  ],
  night: [
    "Good evening, Sir. Burning the midnight oil?",
    "Good evening, Sir. The quiet hours are often the most productive.",
    "Good evening, Sir. I shall endeavor to be brief.",
  ],
};

// ─── Greeting Selection ──────────────────────────────────────────────────────

export function getGreeting(timeOfDay?: TimeOfDay): string {
  const time = timeOfDay ?? getTimeOfDay();
  const options = GREETINGS[time];
  const index = Math.floor(Math.random() * options.length);
  return options[index] ?? options[0] ?? "";
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
    switch (timeOfDay) {
      case "morning":
        return "Good morning, Sir. I'm afraid we have some issues to address.";
      case "afternoon":
        return "Good afternoon, Sir. Some systems require your attention.";
      case "evening":
        return "Good evening, Sir. I regret to report some difficulties.";
      case "night":
        return "Good evening, Sir. There appear to be some complications.";
    }
  }

  if (hasWarnings) {
    switch (timeOfDay) {
      case "morning":
        return "Good morning, Sir. All essential systems are operational.";
      case "afternoon":
        return "Good afternoon, Sir. Systems are functional with minor caveats.";
      case "evening":
        return "Good evening, Sir. Ready to proceed with most capabilities.";
      case "night":
        return "Good evening, Sir. Operational, though not at full capacity.";
    }
  }

  return getGreeting(timeOfDay);
}

// ─── Farewell Messages ───────────────────────────────────────────────────────

export function getFarewell(): string {
  const timeOfDay = getTimeOfDay();

  const farewells: Record<TimeOfDay, string[]> = {
    morning: ["Have a productive day, Sir.", "Until we meet again, Sir."],
    afternoon: [
      "Very good, Sir. Until later.",
      "I shall be here should you need me.",
    ],
    evening: ["Have a pleasant evening, Sir.", "Rest well when you do, Sir."],
    night: ["Do try to get some rest, Sir.", "Until tomorrow, Sir."],
  };

  const options = farewells[timeOfDay];
  const index = Math.floor(Math.random() * options.length);
  return options[index] ?? options[0] ?? "";
}

export function renderFarewell(): string {
  const text = getFarewell();
  const primary = fg(colors.primary);
  const muted = fg(colors.textMuted);

  return `  ${primary("»")} ${muted(text)}`;
}
