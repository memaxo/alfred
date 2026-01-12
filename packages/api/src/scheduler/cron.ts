import { CronExpressionParser } from "cron-parser";

const shortcuts = ["daily", "weekly", "monthly"] as const;
type Shortcut = (typeof shortcuts)[number];

const weekdayToCron: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

function ensureSixFields(value: string): string {
  const cron = value.trim();
  const parts = cron.split(/\s+/);
  if (parts.length === 5) {
    return `0 ${cron}`;
  }
  if (parts.length === 6) {
    return cron;
  }
  throw new Error("cron_fields_invalid");
}

function parseShortcut(value: string): Shortcut | null {
  for (const s of shortcuts) {
    if (value === s) {
      return s;
    }
  }
  return null;
}

function localParts(date: Date, tz: string) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const parts = fmt.formatToParts(date);
  const map = new Map<string, string>();
  for (const p of parts) {
    if (p.type !== "literal") {
      map.set(p.type, p.value);
    }
  }

  const minute = Number(map.get("minute"));
  const hour = Number(map.get("hour"));
  const day = Number(map.get("day"));
  const weekday = map.get("weekday");

  if (
    !(Number.isFinite(minute) && Number.isFinite(hour) && Number.isFinite(day))
  ) {
    throw new Error("cron_local_parts_invalid");
  }
  if (!weekday || weekdayToCron[weekday] === undefined) {
    throw new Error("cron_local_weekday_invalid");
  }

  return {
    minute,
    hour,
    day,
    weekday: weekdayToCron[weekday],
  };
}

export function normalizeRecurring(
  recurringRaw: string,
  baseDueAt: Date,
  tz: string
): { cron: string; kind: "shortcut" | "cron" } {
  const recurring = recurringRaw.trim();
  if (recurring.length === 0) {
    throw new Error("cron_recurring_empty");
  }

  const shortcut = parseShortcut(recurring);
  if (!shortcut) {
    return { cron: ensureSixFields(recurring), kind: "cron" };
  }

  const p = localParts(baseDueAt, tz);
  if (shortcut === "daily") {
    return { cron: `0 ${p.minute} ${p.hour} * * *`, kind: "shortcut" };
  }
  if (shortcut === "weekly") {
    return {
      cron: `0 ${p.minute} ${p.hour} * * ${p.weekday}`,
      kind: "shortcut",
    };
  }
  return { cron: `0 ${p.minute} ${p.hour} ${p.day} * *`, kind: "shortcut" };
}

export function isRecurringValid(recurringRaw: string): boolean {
  const value = recurringRaw.trim();
  if (value.length === 0) {
    return false;
  }
  if (parseShortcut(value)) {
    return true;
  }
  try {
    CronExpressionParser.parse(ensureSixFields(value), { strict: true });
    return true;
  } catch {
    return false;
  }
}

export type NextDueAtInput = {
  recurring: string;
  after: Date;
  baseDueAt: Date;
  tz: string;
  maxTransitions?: number;
};

export function nextDueAt({
  recurring,
  after,
  baseDueAt,
  tz,
  maxTransitions = 25,
}: NextDueAtInput): Date {
  const { cron } = normalizeRecurring(recurring, baseDueAt, tz);

  const interval = CronExpressionParser.parse(cron, {
    currentDate: after,
    tz,
    strict: true,
  });

  for (let i = 0; i < maxTransitions; i++) {
    const next = interval.next() as unknown;
    const nextDate =
      next instanceof Date
        ? next
        : next && typeof next === "object" && "toDate" in next
          ? // biome-ignore lint/suspicious/noExplicitAny: cron-parser's CronDate typing is not exported consistently
            ((next as any).toDate?.() as Date)
          : new Date(String(next));
    if (nextDate.getTime() > after.getTime()) {
      return nextDate;
    }
  }

  throw new Error("cron_next_due_exceeded");
}
