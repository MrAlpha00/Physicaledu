/**
 * All user-facing dates in VARSITY use Asia/Kolkata. Instants are stored as
 * timestamptz; these helpers never read the visitor's or server's local clock
 * for display/date-boundary decisions.
 */

const IST = "Asia/Kolkata";

export const VISITOR_DATE_PRESETS = [
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "this_week", label: "This week" },
  { value: "last_week", label: "Last week" },
  { value: "this_month", label: "This month" },
  { value: "last_month", label: "Last month" },
  { value: "all", label: "All time" },
  { value: "custom", label: "Custom range" },
] as const;

export type VisitorDatePreset = (typeof VISITOR_DATE_PRESETS)[number]["value"];

export interface DateRange {
  start: Date | null;
  end: Date | null;
  label: string;
}

function istParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: IST,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return { year: Number(get("year")), month: Number(get("month")), day: Number(get("day")) };
}

export function istDateString(value: Date | string = new Date()): string {
  const date = typeof value === "string" ? new Date(value) : value;
  const { year, month, day } = istParts(date);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function addIstDays(dateString: string, days: number): string {
  const [year, month, day] = dateString.split("-").map(Number);
  const result = new Date(Date.UTC(year, month - 1, day + days));
  return result.toISOString().slice(0, 10);
}

/** UTC instant corresponding to 00:00:00 on the given India date. */
export function istDayStart(dateString: string): Date {
  return new Date(`${dateString}T00:00:00+05:30`);
}

/** Exclusive UTC instant corresponding to 00:00:00 on the following India date. */
export function istDayEnd(dateString: string): Date {
  return new Date(`${addIstDays(dateString, 1)}T00:00:00+05:30`);
}

/** Format an instant as a datetime-local value using Asia/Kolkata. */
export function toIstLocalInput(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value;
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: IST,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

/** Convert a datetime-local input value into an IST timestamptz string. */
export function istLocalInputToIso(value: string): string {
  const normalized = value.length === 16 ? `${value}:00` : value;
  return /([+-]\d{2}:\d{2}|Z)$/.test(normalized) ? new Date(normalized).toISOString() : `${normalized}+05:30`;
}

export function formatIstDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: IST,
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

export function formatIstTime(value: string | Date | null | undefined): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: IST,
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(value));
}

export function formatIstDateTime(value: string | Date | null | undefined): string {
  if (!value) return "—";
  return `${formatIstDate(value)} · ${formatIstTime(value)} IST`;
}

/** Monday-based India week start for the supplied date. */
export function istWeekStart(dateString: string): string {
  const [year, month, day] = dateString.split("-").map(Number);
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay(); // 0 = Sunday
  const offset = weekday === 0 ? -6 : 1 - weekday;
  return addIstDays(dateString, offset);
}

export function resolveDateRange(
  preset: VisitorDatePreset,
  now: Date = new Date(),
  custom?: { from?: string; to?: string },
): DateRange {
  const today = istDateString(now);

  switch (preset) {
    case "today":
      return {
        start: istDayStart(today),
        end: istDayEnd(today),
        label: `Today (${today}, IST)`,
      };
    case "yesterday": {
      const yesterday = addIstDays(today, -1);
      return {
        start: istDayStart(yesterday),
        end: istDayEnd(yesterday),
        label: `Yesterday (${yesterday}, IST)`,
      };
    }
    case "this_week": {
      const start = istWeekStart(today);
      return { start: istDayStart(start), end: istDayEnd(today), label: `Week of ${start}` };
    }
    case "last_week": {
      const thisStart = istWeekStart(today);
      const start = addIstDays(thisStart, -7);
      const end = addIstDays(thisStart, -1);
      return { start: istDayStart(start), end: istDayEnd(end), label: `${start} – ${end}` };
    }
    case "this_month": {
      const start = `${today.slice(0, 7)}-01`;
      return { start: istDayStart(start), end: istDayEnd(today), label: `${today.slice(0, 7)}` };
    }
    case "last_month": {
      const [year, month] = today.split("-").map(Number);
      const lastMonth = month === 1 ? `${year - 1}-12` : `${year}-${String(month - 1).padStart(2, "0")}`;
      return {
        start: istDayStart(`${lastMonth}-01`),
        end: istDayStart(`${today.slice(0, 4)}-01`),
        label: lastMonth,
      };
    }
    case "custom": {
      const from = custom?.from;
      const to = custom?.to;
      return {
        start: from ? istDayStart(from) : null,
        end: to ? istDayEnd(to) : null,
        label: from || to ? `${from ?? "Beginning"} – ${to ?? "Now"}` : "Custom range",
      };
    }
    case "all":
    default:
      return { start: null, end: null, label: "All time" };
  }
}
