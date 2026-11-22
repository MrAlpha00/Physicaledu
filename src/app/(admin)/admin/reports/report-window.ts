import type { ReportWindow } from "@/lib/data/phase3-reports";
import {
  istDateString,
  istDayEnd,
  istDayStart,
  resolveDateRange,
  VISITOR_DATE_PRESETS,
  type VisitorDatePreset,
} from "@/lib/time/india";

export interface ReportSearchParams {
  preset?: string | null;
  from?: string | null;
  to?: string | null;
}

export interface ResolvedReportWindow {
  preset: VisitorDatePreset;
  fromParam: string;
  toParam: string;
  label: string;
  window: ReportWindow;
}

const DEFAULT_PRESET: VisitorDatePreset = "this_month";
const EARLIEST_DATE = "2000-01-01";

function isIsoDate(value?: string | null): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function normalizeDate(value?: string | null): string | null {
  return isIsoDate(value) ? value : null;
}

export function resolveReportWindow(params: ReportSearchParams, now: Date = new Date()): ResolvedReportWindow {
  const today = istDateString(now);
  const from = normalizeDate(params.from);
  const to = normalizeDate(params.to);

  // Supplying a date always means a custom range; otherwise the preset wins.
  const requested = from || to ? "custom" : params.preset;
  const preset = (
    requested && VISITOR_DATE_PRESETS.some((option) => option.value === requested)
      ? requested
      : DEFAULT_PRESET
  ) as VisitorDatePreset;

  const range = resolveDateRange(preset, now, { from: from ?? undefined, to: to ?? undefined });
  const fromParam = range.start ? istDateString(range.start) : EARLIEST_DATE;
  const toParam = range.end ? istDateString(range.end) : today;
  const windowStart = range.start ?? istDayStart(EARLIEST_DATE);
  const windowEnd = range.end ?? istDayEnd(today);

  return {
    preset,
    fromParam,
    toParam,
    label: range.label,
    window: {
      from: windowStart <= windowEnd ? windowStart : windowEnd,
      to: windowStart <= windowEnd ? windowEnd : windowStart,
    },
  };
}

export function reportWindowFromSearchParams(params: URLSearchParams, now?: Date): ResolvedReportWindow {
  return resolveReportWindow(
    { preset: params.get("preset"), from: params.get("from"), to: params.get("to") },
    now,
  );
}
