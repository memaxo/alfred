import { renderHonorific, type HonorificPreference } from "./honorific.js";

export type TimeOfDay = "morning" | "afternoon" | "evening" | "night";
export type TransitionKind =
  | "greet"
  | "ack"
  | "clarify"
  | "answer"
  | "tooling"
  | "recover"
  | "close";

export function timeOfDayFromHour(hour: number): TimeOfDay {
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

export function formatGreeting(input: {
  timeOfDay: TimeOfDay;
  honorific: HonorificPreference;
}): string {
  const h = renderHonorific(input.honorific);
  switch (input.timeOfDay) {
    case "morning":
      return `Good morning, ${h}.`;
    case "afternoon":
      return `Good afternoon, ${h}.`;
    case "evening":
      return `Good evening, ${h}.`;
    case "night":
      return `Good evening, ${h}.`;
  }
}

export function getTransition(
  kind: TransitionKind,
  honorific: HonorificPreference
): string {
  const h = renderHonorific(honorific);
  switch (kind) {
    case "greet":
      return `At your service, ${h}.`;
    case "ack":
      return `Very good, ${h}.`;
    case "clarify":
      return `One moment, ${h}—I need a detail.`;
    case "answer":
      return "";
    case "tooling":
      return `I’ll check that for you, ${h}.`;
    case "recover":
      return `Understood, ${h}. Something went wrong; I’ll recover.`;
    case "close":
      return `Until later, ${h}.`;
  }
}

