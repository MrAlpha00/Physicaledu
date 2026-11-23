import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database";
import type { Phase4EventRow, Phase4EntryRow, Phase4MatchRow, Phase4SportRow } from "@/types/database";

/** All Phase 4 notifications reuse the Phase 3 notification table and preferences. */
export async function notifyPhaseUsers(
  userIds: string[],
  title: string,
  body: string,
  category = "future_event",
  link: string | null = "/events",
): Promise<void> {
  const unique = [...new Set(userIds.filter(Boolean))];
  if (!unique.length) return;
  const supabase = await createClient();
  await Promise.all(unique.map((userId) =>
    supabase.rpc("phase3_notify_user", {
      p_user_id: userId,
      p_title: title,
      p_body: body,
      p_category: category,
      p_link: link,
      p_priority: "normal",
      p_announcement_id: null,
    }),
  ));
}

function toJson(value: unknown): Json {
  return value as Json;
}

/** Publishes an event to the existing Phase 3 calendar without duplicating source records. */
export async function syncEventToCalendar(event: Phase4EventRow): Promise<string | null> {
  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("phase4_calendar_links").select("calendar_event_id")
    .eq("source_type", "event").eq("source_id", event.id).maybeSingle();

  const startsAt = event.starts_on ? `${event.starts_on}T09:00:00+05:30` : null;
  const endsAt = event.ends_on ? `${event.ends_on}T18:00:00+05:30` : null;
  if (!startsAt || !endsAt) return existing?.calendar_event_id ?? null;

  const { data, error } = await supabase.rpc("admin_save_calendar_event", {
    p_event_id: existing?.calendar_event_id ?? null,
    p_data: toJson({
      title: event.name,
      description: event.description ?? "",
      category: "competition",
      starts_at: startsAt,
      ends_at: endsAt,
      venue: event.venue ?? "",
      visibility: event.is_public ? "public" : "authenticated",
      status: ["published", "registration_open", "registration_closed", "ongoing", "completed"].includes(event.status)
        ? "published" : "draft",
      is_recurring: false,
      attachment_file_id: event.banner_file_id ?? "",
    }),
    p_audiences: toJson([{ audience_type: "all_students" }]),
    p_recurrence: null,
  });
  if (error || !data?.[0]?.id) return existing?.calendar_event_id ?? null;
  const calendarEventId = data[0].id;
  await supabase.from("phase4_calendar_links").upsert({
    source_type: "event", source_id: event.id, calendar_event_id: calendarEventId,
  });
  return calendarEventId;
}

/** Scheduled and postponed matches keep their existing calendar entry in sync. */
export async function syncMatchToCalendar(
  match: Phase4MatchRow,
  event: Phase4EventRow,
  sport: Phase4SportRow,
): Promise<string | null> {
  if (!match.starts_at) return null;
  const supabase = await createClient();
  const endsAt = match.ends_at
    ?? new Date(new Date(match.starts_at).getTime() + 60 * 60 * 1000).toISOString();
  const cancelled = ["cancelled", "postponed"].includes(match.status);

  const { data, error } = await supabase.rpc("admin_save_calendar_event", {
    p_event_id: match.calendar_event_id ?? null,
    p_data: toJson({
      title: `${event.name} — ${sport.name} M${match.match_number}`,
      description: `${sport.name} match ${match.match_number}${match.venue ? ` at ${match.venue}` : ""}`,
      category: "competition",
      starts_at: match.starts_at,
      ends_at: endsAt,
      venue: match.venue ?? "",
      visibility: event.is_public && sport.is_public ? "public" : "authenticated",
      status: cancelled ? "archived" : "published",
      is_recurring: false,
      attachment_file_id: "",
    }),
    p_audiences: toJson([{ audience_type: "all_students" }]),
    p_recurrence: null,
  });
  if (error || !data?.[0]?.id) return match.calendar_event_id;
  const calendarEventId = data[0].id;
  await supabase.from("phase4_calendar_links").upsert({
    source_type: "match", source_id: match.id, calendar_event_id: calendarEventId,
  });
  return calendarEventId;
}

/** Records suggested achievements once a final has a confirmed winner. Idempotent by source reference. */
export async function recordFinalWinnerAchievements(matchId: string): Promise<number> {
  const supabase = await createClient();
  const { data: match } = await supabase
    .from("tournament_matches").select("draw_id,winner_entry_id,round_name,status")
    .eq("id", matchId).maybeSingle();
  if (!match?.winner_entry_id || match.round_name !== "Final" || match.status !== "completed") return 0;
  const { data: draw } = await supabase
    .from("tournament_draws").select("competition_id").eq("id", match.draw_id).maybeSingle();
  if (!draw) return 0;
  const { data: sport } = await supabase
    .from("event_sports").select("*").eq("id", draw.competition_id).maybeSingle();
  if (!sport) return 0;
  const [{ data: entry }, { data: event }] = await Promise.all([
    supabase.from("competition_entries").select("*").eq("id", match.winner_entry_id).maybeSingle(),
    supabase.from("sports_events").select("*").eq("id", sport.event_id).maybeSingle(),
  ]);
  if (!entry || !event) return 0;
  return recordWinnerAchievements(entry, event, sport, matchId);
}

/** Confirmed final results can suggest verified achievements for the sports profile. */
export async function recordWinnerAchievements(
  entry: Phase4EntryRow,
  event: Phase4EventRow,
  sport: Phase4SportRow,
  matchId: string,
): Promise<number> {
  const supabase = await createClient();
  const { data: members } = await supabase
    .from("competition_entry_members")
    .select("student_directory_id")
    .eq("entry_id", entry.id)
    .eq("is_substitute", false);
  if (!members?.length) return 0;
  const label = entry.team_name ?? members[0]?.student_directory_id ?? "Entry";
  const reference = `phase4:${event.id}:${sport.id}:${matchId}:${entry.id}`;
  let created = 0;
  for (const member of members) {
    const { data: existing } = await supabase
      .from("sports_achievements").select("id").eq("source_reference", reference).maybeSingle();
    if (existing) continue;
    const { error } = await supabase.from("sports_achievements").insert({
      student_directory_id: member.student_directory_id,
      title: `${sport.name} winner — ${label}`,
      sport: sport.name,
      event_name: event.name,
      academic_year: event.academic_year,
      achievement_date: event.ends_on ?? event.starts_on ?? new Date().toISOString().slice(0, 10),
      position_result: "Winner",
      award_description: `Confirmed winner of ${sport.name} at ${event.name}.`,
      verification_status: "pending",
      source_type: "future_event",
      source_reference: reference,
    });
    if (!error) created += 1;
  }
  return created;
}
