"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePeAdmin } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { istLocalInputToIso } from "@/lib/time/india";
import {
  calendarEventSchema,
  calendarOverrideSchema,
  type AudienceInput,
  type CalendarEventInput,
  type CalendarOverrideInput,
} from "@/lib/validations/phase3";
import type { Json } from "@/types/database";
import type { ActionState } from "@/types/domain";

function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Check the form and try again.";
}

function toIso(value: string | undefined | null): string | null {
  if (!value) return null;
  const iso = /([+-]\d{2}:\d{2}|Z)$/.test(value) ? new Date(value).toISOString() : istLocalInputToIso(value);
  return Number.isNaN(Date.parse(iso)) ? null : iso;
}

function refreshCalendar(eventId?: string) {
  revalidatePath("/admin/calendar");
  if (eventId) revalidatePath(`/admin/calendar/${eventId}`);
  revalidatePath("/calendar");
  revalidatePath("/dashboard");
}

function audiencePayload(audience: AudienceInput): Record<string, string | number> {
  const payload: Record<string, string | number> = { audience_type: audience.audienceType };
  if (audience.departmentId) payload.department_id = audience.departmentId;
  if (audience.semester !== "" && audience.semester !== undefined) payload.semester = Number(audience.semester);
  if (audience.studentDirectoryId) payload.student_directory_id = audience.studentDirectoryId;
  if (audience.groupId) payload.group_id = audience.groupId;
  return payload;
}

export async function saveCalendarEvent(input: CalendarEventInput): Promise<ActionState & { eventId?: string }> {
  await requirePeAdmin();
  const parsed = calendarEventSchema.safeParse(input);
  if (!parsed.success) return { status: "error", message: firstIssue(parsed.error) };

  const data = parsed.data;
  const startsAt = toIso(data.startsAt);
  const endsAt = toIso(data.endsAt);
  if (!startsAt || !endsAt) return { status: "error", message: "Choose valid start and end times." };
  if (new Date(endsAt).getTime() <= new Date(startsAt).getTime()) {
    return { status: "error", message: "End time must be after the start time." };
  }

  for (const audience of data.audiences) {
    if (audience.audienceType === "department" && !audience.departmentId) {
      return { status: "error", message: "Choose a department for every department audience." };
    }
    if (audience.audienceType === "semester" && (audience.semester === "" || !audience.semester)) {
      return { status: "error", message: "Choose a semester for every semester audience." };
    }
    if (audience.audienceType === "selected_students" && !audience.studentDirectoryId) {
      return { status: "error", message: "Choose a student for every selected-student audience." };
    }
    if (audience.audienceType === "group" && !audience.groupId) {
      return { status: "error", message: "Choose a group for every group audience." };
    }
  }

  let recurrence: Json | null = null;
  if (data.isRecurring) {
    if (!data.recurrence) return { status: "error", message: "Choose a recurrence rule." };
    const rule = data.recurrence;
    if (rule.frequency === "weekly" && (!rule.byWeekday || rule.byWeekday.length === 0)) {
      return { status: "error", message: "Choose at least one weekday for a weekly rule." };
    }
    if (!rule.endsOn && (rule.occurrenceLimit === "" || !rule.occurrenceLimit)) {
      return { status: "error", message: "Set an end date or an occurrence limit for the rule." };
    }
    const payload: Record<string, Json> = {
      frequency: rule.frequency,
      interval_count: rule.intervalCount,
    };
    if (rule.byWeekday?.length) payload.by_weekday = rule.byWeekday;
    if (rule.endsOn) payload.ends_on = rule.endsOn;
    if (typeof rule.occurrenceLimit === "number") payload.occurrence_limit = rule.occurrenceLimit;
    recurrence = payload;
  }

  const eventData: Record<string, string | boolean> = {
    title: data.title,
    description: data.description ?? "",
    category: data.category,
    starts_at: startsAt,
    ends_at: endsAt,
    venue: data.venue ?? "",
    visibility: data.visibility,
    status: data.status,
    is_recurring: data.isRecurring,
    attachment_file_id: data.attachmentFileId ?? "",
  };

  const supabase = await createClient();
  const { data: saved, error } = await supabase.rpc("admin_save_calendar_event", {
    p_event_id: data.id || null,
    p_data: eventData,
    p_audiences: data.audiences.map(audiencePayload),
    p_recurrence: recurrence,
  });
  if (error) return { status: "error", message: error.message || "The event could not be saved." };

  const eventId = saved?.[0]?.id ?? data.id ?? "";
  refreshCalendar(eventId || undefined);
  return {
    status: "success",
    message: data.id ? "Event updated." : "Event created.",
    eventId,
  };
}

export async function saveCalendarOverride(input: CalendarOverrideInput): Promise<ActionState> {
  await requirePeAdmin();
  const parsed = calendarOverrideSchema.safeParse(input);
  if (!parsed.success) return { status: "error", message: firstIssue(parsed.error) };

  const data = parsed.data;
  if (Number.isNaN(Date.parse(data.occurrenceStartsAt))) {
    return { status: "error", message: "The occurrence time is invalid." };
  }
  const startsAt = toIso(data.startsAt);
  const endsAt = toIso(data.endsAt);
  if ((data.startsAt && !startsAt) || (data.endsAt && !endsAt)) {
    return { status: "error", message: "Choose valid override times." };
  }
  if (startsAt && endsAt && new Date(endsAt).getTime() <= new Date(startsAt).getTime()) {
    return { status: "error", message: "Override end time must be after its start time." };
  }

  const supabase = await createClient();
  const { data: rule } = await supabase
    .from("calendar_recurrence_rules")
    .select("event_id")
    .eq("id", data.ruleId)
    .maybeSingle();
  if (!rule) return { status: "error", message: "Recurrence rule not found." };

  const { error } = await supabase.rpc("admin_save_calendar_override", {
    p_rule_id: data.ruleId,
    p_occurrence_starts_at: new Date(data.occurrenceStartsAt).toISOString(),
    p_data: {
      is_cancelled: data.isCancelled,
      title: data.title ?? "",
      starts_at: startsAt ?? "",
      ends_at: endsAt ?? "",
      venue: data.venue ?? "",
      description: data.description ?? "",
    },
  });
  if (error) return { status: "error", message: error.message || "The occurrence could not be updated." };

  refreshCalendar(rule.event_id);
  return {
    status: "success",
    message: data.isCancelled ? "Occurrence cancelled for this series." : "Occurrence updated for this series.",
  };
}
