import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { expandCalendarOccurrences } from "@/lib/operations/phase3";
import type { Phase3CalendarOverrideRow } from "@/types/database";
import type {
  CalendarEventView,
  CalendarOccurrenceView,
  Phase3AudienceInput,
  Phase3RecurrenceInput,
} from "@/types/domain";
import { istDateString, istDayEnd, istDayStart } from "@/lib/time/india";

function mapAudience(row: {
  audience_type: CalendarEventView["audiences"][number]["audienceType"];
  department_id: string | null;
  semester: number | null;
  student_directory_id: string | null;
  group_id: string | null;
}): Phase3AudienceInput {
  return {
    audienceType: row.audience_type,
    departmentId: row.department_id,
    semester: row.semester,
    studentDirectoryId: row.student_directory_id,
    groupId: row.group_id,
  };
}

export const getAdminCalendarEvents = cache(async (): Promise<CalendarEventView[]> => {
  const supabase = await createClient();
  const [eventsResult, audiencesResult, rulesResult] = await Promise.all([
    supabase.from("pe_calendar_events").select("*").order("starts_at", { ascending: false }).limit(300),
    supabase.from("calendar_audiences").select("*"),
    supabase.from("calendar_recurrence_rules").select("*"),
  ]);

  const audiencesByEvent = new Map<string, Phase3AudienceInput[]>();
  (audiencesResult.data ?? []).forEach((row) => {
    const list = audiencesByEvent.get(row.event_id) ?? [];
    list.push(mapAudience(row));
    audiencesByEvent.set(row.event_id, list);
  });
  const rulesByEvent = new Map((rulesResult.data ?? []).map((row) => [row.event_id, row]));

  return (eventsResult.data ?? []).map((row) => {
    const rule = rulesByEvent.get(row.id);
    const recurrence: Phase3RecurrenceInput | null = rule
      ? {
          frequency: rule.frequency,
          intervalCount: rule.interval_count,
          byWeekday: rule.by_weekday ?? undefined,
          endsOn: rule.ends_on,
          occurrenceLimit: rule.occurrence_limit,
        }
      : null;
    return {
      occurrenceId: `${row.id}:${row.starts_at}`,
      eventId: row.id,
      ruleId: rule?.id ?? null,
      title: row.title,
      description: row.description,
      category: row.category,
      startsAt: row.starts_at,
      endsAt: row.ends_at,
      venue: row.venue,
      visibility: row.visibility,
      status: row.status,
      isOverride: false,
      isCancelled: false,
      audiences: audiencesByEvent.get(row.id) ?? [],
      recurrence,
      canManage: true,
    };
  });
});

async function loadOccurrences(from: Date, to: Date): Promise<CalendarOccurrenceView[]> {
  const supabase = await createClient();
  const [eventsResult, rulesResult, overridesResult] = await Promise.all([
    supabase
      .from("pe_calendar_events")
      .select("*")
      .eq("status", "published")
      .gte("ends_at", from.toISOString())
      .lte("starts_at", to.toISOString())
      .limit(300),
    supabase.from("calendar_recurrence_rules").select("*"),
    supabase.from("calendar_event_overrides").select("*"),
  ]);

  const rulesByEvent = new Map((rulesResult.data ?? []).map((row) => [row.event_id, row]));
  const overridesByRule = new Map<string, typeof overridesResult.data>();
  (overridesResult.data ?? []).forEach((row) => {
    const list = overridesByRule.get(row.rule_id) ?? [];
    list.push(row);
    overridesByRule.set(row.rule_id, list);
  });

  return (eventsResult.data ?? []).flatMap((event) => {
    const rule = rulesByEvent.get(event.id) ?? null;
    return expandCalendarOccurrences(event, rule, overridesByRule.get(rule?.id ?? "") ?? [], from, to);
  });
}

export async function getCalendarOccurrences(from: Date, to: Date): Promise<CalendarOccurrenceView[]> {
  return loadOccurrences(from, to);
}

export async function getUpcomingCalendarOccurrences(limit = 12): Promise<CalendarOccurrenceView[]> {
  const from = new Date();
  const to = new Date(from.getTime() + 1000 * 60 * 60 * 24 * 120);
  const occurrences = await loadOccurrences(from, to);
  return occurrences
    .filter((item) => !item.isCancelled && new Date(item.endsAt).getTime() >= from.getTime())
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
    .slice(0, limit);
}

export async function getTodayCalendarOccurrences(): Promise<CalendarOccurrenceView[]> {
  const day = istDateString();
  return getCalendarOccurrences(istDayStart(day), istDayEnd(day));
}
