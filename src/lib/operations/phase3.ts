import type {
  EquipmentInventoryStatus,
  EquipmentTransactionStatus,
  Phase3CalendarEventRow,
  Phase3CalendarOverrideRow,
  Phase3EquipmentItemRow,
  Phase3EquipmentTransactionRow,
  Phase3RecurrenceRuleRow,
} from "@/types/database";
import type {
  CalendarOccurrenceView,
  Phase3AudienceInput,
  Phase3ReportRow,
} from "@/types/domain";
import { istDateString } from "@/lib/time/india";

/** Pure, testable rules shared by admin tools, student pages and exports. */

export const EQUIPMENT_CONDITIONS = ["excellent", "good", "fair", "poor", "unusable"] as const;
export const MAINTENANCE_TERMINAL_STATUSES = ["completed", "unrepairable", "cancelled"] as const;
export const FEEDBACK_TERMINAL_STATUSES = ["resolved", "rejected", "closed"] as const;

export function equipmentInventoryStatus(
  item: Pick<
    Phase3EquipmentItemRow,
    "quantity" | "available_quantity" | "borrowed_quantity" | "maintenance_quantity" | "damaged_quantity" | "retired_quantity" | "is_active"
  >,
): EquipmentInventoryStatus {
  if (!item.is_active) return "unavailable";
  if (item.retired_quantity === item.quantity && item.retired_quantity > 0) return "retired";
  if (item.damaged_quantity === item.quantity && item.damaged_quantity > 0) return "damaged";
  if (item.maintenance_quantity === item.quantity && item.maintenance_quantity > 0) return "under_maintenance";
  if (item.available_quantity === 0) return "fully_borrowed";
  if (item.available_quantity < item.quantity) return "partially_available";
  return "available";
}

export function isEquipmentTransactionOverdue(
  transaction: Pick<Phase3EquipmentTransactionRow, "expected_return_at" | "quantity_issued" | "quantity_returned" | "status">,
  now: Date = new Date(),
): boolean {
  if (transaction.status === "returned" || transaction.status === "cancelled") return false;
  if (transaction.quantity_returned >= transaction.quantity_issued) return false;
  return new Date(transaction.expected_return_at).getTime() < now.getTime();
}

export function displayEquipmentTransactionStatus(
  transaction: Pick<Phase3EquipmentTransactionRow, "expected_return_at" | "quantity_issued" | "quantity_returned" | "status">,
  now: Date = new Date(),
): EquipmentTransactionStatus {
  if (
    (transaction.status === "issued" || transaction.status === "partially_returned") &&
    isEquipmentTransactionOverdue(transaction, now)
  ) {
    return "overdue";
  }
  return transaction.status;
}

export function canBulkBorrow(
  item: Pick<Phase3EquipmentItemRow, "tracking_mode" | "available_quantity" | "is_active">,
  quantity: number,
): boolean {
  return item.is_active && item.tracking_mode === "bulk" && quantity > 0 && quantity <= item.available_quantity;
}

export function canMaintenanceTransition(from: string, to: string): boolean {
  if ((MAINTENANCE_TERMINAL_STATUSES as readonly string[]).includes(from)) return false;
  return ["reported", "under_review", "scheduled", "in_progress", "completed", "unrepairable", "cancelled"].includes(to);
}

export function canFeedbackTransition(from: string, to: string): boolean {
  if (from === "closed") return false;
  return ["submitted", "under_review", "in_progress", "waiting_for_student", "resolved", "rejected", "closed"].includes(to);
}

function istWeekday(date: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    weekday: "short",
  }).formatToParts(date);
  const value = parts.find((part) => part.type === "weekday")?.value ?? "Sun";
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(value);
}

function addUtcDays(date: Date, days: number): Date {
  const next = new Date(date.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function addUtcMonths(date: Date, months: number): Date {
  const next = new Date(date.getTime());
  const day = next.getUTCDate();
  next.setUTCDate(1);
  next.setUTCMonth(next.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + 1, 0)).getUTCDate();
  next.setUTCDate(Math.min(day, lastDay));
  return next;
}

function withinWindow(date: Date, start: Date, end: Date): boolean {
  return date.getTime() >= start.getTime() && date.getTime() <= end.getTime();
}

/**
 * Expands recurrence rules inside a bounded window. It never persists generated
 * rows: an event can have a long rule without creating thousands of DB records.
 */
export function expandCalendarOccurrences(
  event: Phase3CalendarEventRow,
  rule: Phase3RecurrenceRuleRow | null,
  overrides: Phase3CalendarOverrideRow[],
  windowStart: Date,
  windowEnd: Date,
  maxOccurrences = 260,
): CalendarOccurrenceView[] {
  const baseStart = new Date(event.starts_at);
  const baseEnd = new Date(event.ends_at);
  const duration = baseEnd.getTime() - baseStart.getTime();
  const overrideMap = new Map(overrides.map((override) => [override.occurrence_starts_at, override]));
  const results: CalendarOccurrenceView[] = [];

  const pushOccurrence = (start: Date, ruleId: string | null, allowOverride: boolean) => {
    if (!withinWindow(start, windowStart, windowEnd)) return;
    if (results.length >= maxOccurrences) return;

    const override = allowOverride ? overrideMap.get(start.toISOString()) : undefined;
    if (override?.is_cancelled) return;

    const occurrenceStart = override?.starts_at ? new Date(override.starts_at) : start;
    const occurrenceEnd = override?.ends_at
      ? new Date(override.ends_at)
      : new Date(occurrenceStart.getTime() + duration);

    results.push({
      occurrenceId: `${ruleId ?? event.id}:${start.toISOString()}`,
      eventId: event.id,
      ruleId,
      title: override?.title ?? event.title,
      description: override?.description ?? event.description,
      category: event.category,
      startsAt: occurrenceStart.toISOString(),
      endsAt: occurrenceEnd.toISOString(),
      venue: override?.venue ?? event.venue,
      visibility: event.visibility,
      status: event.status,
      isOverride: Boolean(override),
      isCancelled: false,
    });
  };

  pushOccurrence(baseStart, null, false);

  if (!rule || !event.is_recurring || event.status !== "published") {
    return results.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  }

  const limit = Math.min(rule.occurrence_limit ?? maxOccurrences, maxOccurrences);
  const weekdays = rule.by_weekday?.length
    ? [...rule.by_weekday].sort((a, b) => a - b)
    : null;
  let generated = 0;
  let cursor = new Date(baseStart.getTime());

  if (rule.frequency === "weekly" && weekdays) {
    let weekAnchor = new Date(baseStart.getTime());
    while (weekAnchor.getUTCDay() !== 0) weekAnchor = addUtcDays(weekAnchor, -1);

    for (let period = 0; period < 400 && generated < limit; period += 1) {
      for (const weekday of weekdays) {
        if (generated >= limit) break;
        const candidate = addUtcDays(weekAnchor, period * 7 * rule.interval_count + weekday);
        if (candidate.getTime() <= baseStart.getTime()) continue;
        if (rule.ends_on && istDateString(candidate) > rule.ends_on) {
          generated = limit;
          break;
        }
        if (candidate.getTime() > windowEnd.getTime()) continue;
        generated += 1;
        pushOccurrence(candidate, rule.id, true);
      }
      const lastCandidate = addUtcDays(weekAnchor, (period + 1) * 7 * rule.interval_count);
      if (lastCandidate.getTime() > windowEnd.getTime()) break;
    }
  } else {
    for (let index = 1; index <= 400 && generated < limit; index += 1) {
      if (rule.frequency === "monthly") {
        cursor = addUtcMonths(baseStart, index * rule.interval_count);
      } else {
        cursor = addUtcDays(baseStart, index * rule.interval_count);
      }

      if (rule.frequency === "daily" && weekdays && !weekdays.includes(istWeekday(cursor))) continue;
      if (rule.ends_on && istDateString(cursor) > rule.ends_on) break;
      if (cursor.getTime() > windowEnd.getTime()) break;

      generated += 1;
      pushOccurrence(cursor, rule.id, true);
    }
  }

  const seen = new Set<string>();
  return results
    .filter((item) => {
      if (seen.has(item.occurrenceId)) return false;
      seen.add(item.occurrenceId);
      return true;
    })
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

export function remainingEmailCapacity(acceptedToday: number, dailyLimit: number): number {
  return Math.max(0, Math.min(dailyLimit, 100) - Math.max(0, acceptedToday));
}

export function planEmailBatch(
  pendingRecipients: Array<{ id: string; attempts: number }>,
  capacity: number,
  batchSize = 25,
): string[] {
  const take = Math.min(Math.max(0, batchSize), 25, Math.max(0, capacity));
  return pendingRecipients
    .filter((recipient) => recipient.attempts < 3)
    .slice(0, take)
    .map((recipient) => recipient.id);
}

export function audienceLabel(audience: Phase3AudienceInput, departmentName?: string | null, studentName?: string | null, groupName?: string | null): string {
  switch (audience.audienceType) {
    case "all_students": return "All students";
    case "active_pe": return "Active PE students";
    case "department": return departmentName ?? "Department";
    case "semester": return `Semester ${audience.semester ?? ""}`.trim();
    case "selected_students": return studentName ?? "Selected students";
    case "group": return groupName ?? "Student group";
    default: return "Students";
  }
}

export function aggregateReportRows(values: Array<{ label: string; value: number; detail?: string | null }>): Phase3ReportRow[] {
  const totals = new Map<string, Phase3ReportRow>();
  for (const value of values) {
    const existing = totals.get(value.label) ?? { label: value.label, value: 0, detail: value.detail ?? null };
    totals.set(value.label, { ...existing, value: existing.value + value.value });
  }
  return [...totals.values()].sort((a, b) => b.value - a.value || a.label.localeCompare(b.label));
}

export function percentage(part: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((part / total) * 1000) / 10;
}
