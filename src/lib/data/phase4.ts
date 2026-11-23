import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { isCurrentUserPeAdmin } from "@/lib/auth/session";
import type {
  Phase4AssignmentRow,
  Phase4DrawRow,
  Phase4EligibilityRow,
  Phase4EntryRow,
  Phase4EntryStatus,
  Phase4EventRow,
  Phase4FileRow,
  Phase4InvitationRow,
  Phase4MatchRow,
  Phase4MemberRow,
  Phase4PaymentRecordRow,
  Phase4PaymentSettingsRow,
  Phase4ResultRow,
  Phase4RulesRow,
  Phase4SlotRow,
  Phase4SportRow,
  Phase4StandingRow,
} from "@/types/database";

export interface SportContext {
  event: Phase4EventRow;
  sport: Phase4SportRow;
  rules: Phase4RulesRow | null;
  eligibility: Phase4EligibilityRow[];
  payment: Phase4PaymentSettingsRow | null;
}

export interface EntryView extends Phase4EntryRow {
  members: Phase4MemberRow[];
  payment: Phase4PaymentRecordRow | null;
}

export interface MatchView extends Phase4MatchRow {
  slots: Phase4SlotRow[];
  entries: Phase4EntryRow[];
  result: Phase4ResultRow | null;
}

export const getAdminEvents = cache(async (): Promise<Phase4EventRow[]> => {
  const supabase = await createClient();
  if (!(await isCurrentUserPeAdmin())) return [];
  const { data } = await supabase
    .from("sports_events")
    .select("*")
    .order("starts_on", { ascending: false });
  return data ?? [];
});

export const getAdminEvent = cache(async (eventId: string): Promise<Phase4EventRow | null> => {
  const supabase = await createClient();
  if (!(await isCurrentUserPeAdmin())) return null;
  const { data } = await supabase.from("sports_events").select("*").eq("id", eventId).maybeSingle();
  return data ?? null;
});

export const getAdminSports = cache(async (eventId?: string): Promise<Phase4SportRow[]> => {
  const supabase = await createClient();
  if (!(await isCurrentUserPeAdmin())) return [];
  let query = supabase.from("event_sports").select("*").order("name");
  if (eventId) query = query.eq("event_id", eventId);
  const { data } = await query;
  return data ?? [];
});

export const getSportContext = cache(async (
  eventId: string,
  sportId: string,
): Promise<SportContext | null> => {
  const supabase = await createClient();
  const [{ data: event }, { data: sport }] = await Promise.all([
    supabase.from("sports_events").select("*").eq("id", eventId).maybeSingle(),
    supabase.from("event_sports").select("*").eq("id", sportId).eq("event_id", eventId).maybeSingle(),
  ]);
  if (!event || !sport) return null;
  const [{ data: rules }, { data: eligibility }, { data: payment }] = await Promise.all([
    supabase.from("competition_rules").select("*").eq("competition_id", sportId).maybeSingle(),
    supabase.from("competition_eligibility_rules").select("*").eq("competition_id", sportId),
    supabase.from("competition_payment_settings").select("*").eq("competition_id", sportId).maybeSingle(),
  ]);
  return {
    event,
    sport,
    rules: rules ?? null,
    eligibility: eligibility ?? [],
    payment: payment ?? null,
  };
});

export const getPublicEvents = cache(async (): Promise<Phase4EventRow[]> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("sports_events")
    .select("*")
    .eq("is_public", true)
    .in("status", ["published", "registration_open", "registration_closed", "ongoing", "completed"])
    .order("starts_on", { ascending: false });
  return data ?? [];
});

export const getPublicEvent = cache(async (slug: string): Promise<Phase4EventRow | null> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("sports_events").select("*").eq("slug", slug).eq("is_public", true).maybeSingle();
  return data ?? null;
});

export const getPublicSports = cache(async (eventId: string): Promise<Phase4SportRow[]> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("event_sports")
    .select("*")
    .eq("event_id", eventId)
    .eq("is_public", true)
    .neq("status", "draft")
    .order("name");
  return data ?? [];
});

export const getPublicSport = cache(async (
  eventId: string,
  slug: string,
): Promise<Phase4SportRow | null> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("event_sports").select("*").eq("event_id", eventId).eq("slug", slug)
    .eq("is_public", true).neq("status", "draft").maybeSingle();
  return data ?? null;
});

export async function getEntries(
  competitionId: string,
  status?: Phase4EntryStatus,
): Promise<EntryView[]> {
  const supabase = await createClient();
  let query = supabase.from("competition_entries").select("*").eq("competition_id", competitionId);
  if (status) query = query.eq("status", status);
  const { data: entries } = await query.order("created_at", { ascending: false });
  if (!entries?.length) return [];
  const ids = entries.map((entry) => entry.id);
  const [{ data: members }, { data: payments }] = await Promise.all([
    supabase.from("competition_entry_members").select("*").in("entry_id", ids),
    supabase.from("competition_payment_records").select("*").in("entry_id", ids),
  ]);
  return entries.map((entry) => ({
    ...entry,
    members: (members ?? []).filter((member) => member.entry_id === entry.id),
    payment: (payments ?? []).find((payment) => payment.entry_id === entry.id) ?? null,
  }));
}

export async function getMyEntries(userId: string): Promise<EntryView[]> {
  const supabase = await createClient();
  const { data: entries } = await supabase
    .from("competition_entries")
    .select("*")
    .eq("captain_user_id", userId)
    .order("created_at", { ascending: false });
  if (!entries?.length) return [];
  const ids = entries.map((entry) => entry.id);
  const [{ data: members }, { data: payments }, { data: sports }] = await Promise.all([
    supabase.from("competition_entry_members").select("*").in("entry_id", ids),
    supabase.from("competition_payment_records").select("*").in("entry_id", ids),
    supabase.from("event_sports").select("*").in("id", [...new Set(entries.map((entry) => entry.competition_id))]),
  ]);
  void sports;
  return entries.map((entry) => ({
    ...entry,
    members: (members ?? []).filter((member) => member.entry_id === entry.id),
    payment: (payments ?? []).find((payment) => payment.entry_id === entry.id) ?? null,
  }));
}

export async function getEntryDetail(entryId: string): Promise<{
  entry: Phase4EntryRow;
  members: Phase4MemberRow[];
  payment: Phase4PaymentRecordRow | null;
  rules: Phase4RulesRow | null;
} | null> {
  const supabase = await createClient();
  const { data: entry } = await supabase.from("competition_entries").select("*").eq("id", entryId).maybeSingle();
  if (!entry) return null;
  const [{ data: members }, { data: payment }, { data: rules }] = await Promise.all([
    supabase.from("competition_entry_members").select("*").eq("entry_id", entryId),
    supabase.from("competition_payment_records").select("*").eq("entry_id", entryId).maybeSingle(),
    supabase.from("competition_rules").select("*").eq("competition_id", entry.competition_id).maybeSingle(),
  ]);
  return { entry, members: members ?? [], payment: payment ?? null, rules: rules ?? null };
}

export async function getActiveDraw(competitionId: string): Promise<Phase4DrawRow | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("tournament_draws")
    .select("*")
    .eq("competition_id", competitionId)
    .in("status", ["active", "locked"])
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ?? null;
}

export async function getCanvasPositions(drawId: string): Promise<Record<string, { x: number; y: number }>> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("tournament_node_positions").select("node_key,position").eq("draw_id", drawId);
  const positions: Record<string, { x: number; y: number }> = {};
  for (const row of data ?? []) {
    const value = row.position;
    if (!value || typeof value !== "object" || Array.isArray(value)) continue;
    const point = value as { x?: unknown; y?: unknown };
    if (typeof point.x === "number" && typeof point.y === "number") {
      positions[row.node_key] = { x: point.x, y: point.y };
    }
  }
  return positions;
}

export async function getDrawHistory(competitionId: string): Promise<Phase4DrawRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("tournament_draws").select("*").eq("competition_id", competitionId)
    .order("version", { ascending: false });
  return data ?? [];
}

export async function getMatches(competitionId: string): Promise<MatchView[]> {
  const draw = await getActiveDraw(competitionId);
  if (!draw) return [];
  const supabase = await createClient();
  const { data: matches } = await supabase
    .from("tournament_matches").select("*").eq("draw_id", draw.id)
    .order("round_number").order("match_number");
  if (!matches?.length) return [];
  const ids = matches.map((match) => match.id);
  const [{ data: slots }, { data: results }] = await Promise.all([
    supabase.from("tournament_match_slots").select("*").in("match_id", ids),
    supabase.from("tournament_match_results").select("*").in("match_id", ids),
  ]);
  const entryIds = [...new Set((slots ?? []).map((slot) => slot.entry_id).filter((id): id is string => Boolean(id)))];
  const { data: entries } = entryIds.length
    ? await supabase.from("competition_entries").select("*").in("id", entryIds)
    : { data: [] };
  return matches.map((match) => ({
    ...match,
    slots: (slots ?? []).filter((slot) => slot.match_id === match.id),
    entries: (entries ?? []).filter((entry) =>
      (slots ?? []).some((slot) => slot.match_id === match.id && slot.entry_id === entry.id)),
    result: (results ?? []).find((result) => result.match_id === match.id) ?? null,
  }));
}

export async function getMatchDetail(matchId: string): Promise<{
  match: Phase4MatchRow;
  slots: Phase4SlotRow[];
  entries: Phase4EntryRow[];
  result: Phase4ResultRow | null;
  competitionId: string | null;
} | null> {
  const supabase = await createClient();
  const { data: match } = await supabase.from("tournament_matches").select("*").eq("id", matchId).maybeSingle();
  if (!match) return null;
  const [{ data: slots }, { data: result }, { data: draw }] = await Promise.all([
    supabase.from("tournament_match_slots").select("*").eq("match_id", matchId),
    supabase.from("tournament_match_results").select("*").eq("match_id", matchId).maybeSingle(),
    supabase.from("tournament_draws").select("competition_id").eq("id", match.draw_id).maybeSingle(),
  ]);
  const entryIds = (slots ?? []).map((slot) => slot.entry_id).filter((id): id is string => Boolean(id));
  const { data: entries } = entryIds.length
    ? await supabase.from("competition_entries").select("*").in("id", entryIds)
    : { data: [] };
  return {
    match,
    slots: slots ?? [],
    entries: entries ?? [],
    result: result ?? null,
    competitionId: draw?.competition_id ?? null,
  };
}

export async function getStandings(competitionId: string): Promise<Phase4StandingRow[]> {
  const draw = await getActiveDraw(competitionId);
  if (!draw) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("tournament_standings").select("*").eq("draw_id", draw.id)
    .order("group_key").order("competition_points", { ascending: false });
  return data ?? [];
}

export async function getOrganizerAssignments(userId: string): Promise<Array<{
  assignment: Phase4AssignmentRow;
  sport: Phase4SportRow;
  event: Phase4EventRow;
}>> {
  const supabase = await createClient();
  const { data: assignments } = await supabase
    .from("sport_organizer_assignments")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "active");
  if (!assignments?.length) return [];
  const sportIds = assignments.map((assignment) => assignment.competition_id);
  const { data: sports } = await supabase.from("event_sports").select("*").in("id", sportIds);
  const eventIds = [...new Set((sports ?? []).map((sport) => sport.event_id))];
  const { data: events } = eventIds.length
    ? await supabase.from("sports_events").select("*").in("id", eventIds)
    : { data: [] };
  return assignments.flatMap((assignment) => {
    const sport = (sports ?? []).find((item) => item.id === assignment.competition_id);
    const event = sport ? (events ?? []).find((item) => item.id === sport.event_id) : null;
    return sport && event ? [{ assignment, sport, event }] : [];
  });
}

export async function getSportAssignments(competitionId: string): Promise<Phase4AssignmentRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("sport_organizer_assignments").select("*")
    .eq("competition_id", competitionId).eq("status", "active");
  return data ?? [];
}

export async function getSportInvitations(competitionId: string): Promise<Phase4InvitationRow[]> {
  const supabase = await createClient();
  if (!(await isCurrentUserPeAdmin())) return [];
  const { data } = await supabase
    .from("organizer_invitations").select("*").eq("competition_id", competitionId)
    .order("created_at", { ascending: false });
  return data ?? [];
}

export async function getPublicFiles(ids: Array<string | null>): Promise<Phase4FileRow[]> {
  const filtered = ids.filter((id): id is string => Boolean(id));
  if (!filtered.length) return [];
  const supabase = await createClient();
  const { data } = await supabase.from("phase4_files").select("*").in("id", filtered);
  return (data ?? []).filter((file) => file.visibility === "public" && file.upload_status === "confirmed");
}

export interface EventDashboardMetrics {
  totalEvents: number;
  publishedEvents: number;
  activeEvents: number;
  totalSports: number;
  teamEntries: number;
  individualEntries: number;
  pendingApprovals: number;
  pendingPayments: number;
  approvedEntries: number;
  upcomingMatches: number;
  ongoingMatches: number;
  completedMatches: number;
  pendingResults: number;
  completedCompetitions: number;
}

export async function getEventDashboardMetrics(): Promise<EventDashboardMetrics> {
  const supabase = await createClient();
  const empty: EventDashboardMetrics = {
    totalEvents: 0, publishedEvents: 0, activeEvents: 0, totalSports: 0,
    teamEntries: 0, individualEntries: 0, pendingApprovals: 0, pendingPayments: 0,
    approvedEntries: 0, upcomingMatches: 0, ongoingMatches: 0, completedMatches: 0,
    pendingResults: 0, completedCompetitions: 0,
  };
  if (!(await isCurrentUserPeAdmin())) return empty;
  const [events, sports, entries, matches] = await Promise.all([
    supabase.from("sports_events").select("status"),
    supabase.from("event_sports").select("status"),
    supabase.from("competition_entries").select("status,kind,payment_status"),
    supabase.from("tournament_matches").select("status,starts_at,is_bye"),
  ]);
  const eventRows = events.data ?? [];
  const sportRows = sports.data ?? [];
  const entryRows = entries.data ?? [];
  const matchRows = (matches.data ?? []).filter((match) => !match.is_bye);
  return {
    totalEvents: eventRows.length,
    publishedEvents: eventRows.filter((event) => event.status !== "draft").length,
    activeEvents: eventRows.filter((event) => ["registration_open", "ongoing"].includes(event.status)).length,
    totalSports: sportRows.length,
    teamEntries: entryRows.filter((entry) => entry.kind === "team").length,
    individualEntries: entryRows.filter((entry) => entry.kind === "individual").length,
    pendingApprovals: entryRows.filter((entry) => ["submitted", "under_review"].includes(entry.status)).length,
    pendingPayments: entryRows.filter((entry) => entry.payment_status === "pending_verification").length,
    approvedEntries: entryRows.filter((entry) => entry.status === "approved").length,
    upcomingMatches: matchRows.filter((match) => ["scheduled", "ready"].includes(match.status)).length,
    ongoingMatches: matchRows.filter((match) => match.status === "ongoing").length,
    completedMatches: matchRows.filter((match) => match.status === "completed").length,
    pendingResults: matchRows.filter((match) => match.status === "result_submitted").length,
    completedCompetitions: sportRows.filter((sport) => sport.status === "completed").length,
  };
}

/** Active directory options for scoped organiser invitations (admin only). */
export const getPhase4DirectoryOptions = cache(async (): Promise<Array<{
  id: string;
  fullName: string;
  usn: string;
  semester: number;
  academicYear: number;
}>> => {
  const supabase = await createClient();
  if (!(await isCurrentUserPeAdmin())) return [];
  const { data } = await supabase
    .from("student_directory").select("id,full_name,usn,semester,academic_year")
    .eq("is_active", true).order("full_name").limit(2000);
  return (data ?? []).map((student) => ({
    id: student.id,
    fullName: student.full_name,
    usn: student.usn,
    semester: student.semester,
    academicYear: student.academic_year,
  }));
});

export async function getOrganizerMatchViews(userId: string): Promise<Array<{
  assignment: Phase4AssignmentRow;
  sport: Phase4SportRow;
  event: Phase4EventRow;
  matches: MatchView[];
}>> {
  const assignments = await getOrganizerAssignments(userId);
  return Promise.all(assignments.map(async (item) => ({
    ...item,
    matches: await getMatches(item.sport.id),
  })));
}

/** Invitations are shown without token hashes; acceptance requires the private link token. */
export async function getMyOrganizerInvitations(userId: string): Promise<Array<{
  invitation: Phase4InvitationRow;
  sport: Phase4SportRow;
  event: Phase4EventRow;
}>> {
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles").select("student_directory_id").eq("id", userId).maybeSingle();
  if (!profile?.student_directory_id) return [];
  const { data: invitations } = await supabase
    .from("organizer_invitations").select("*")
    .eq("student_directory_id", profile.student_directory_id)
    .is("accepted_at", null).is("revoked_at", null)
    .order("expires_at", { ascending: false });
  if (!invitations?.length) return [];
  const sportIds = [...new Set(invitations.map((item) => item.competition_id))];
  const { data: sports } = await supabase.from("event_sports").select("*").in("id", sportIds);
  const eventIds = [...new Set((sports ?? []).map((sport) => sport.event_id))];
  const { data: events } = eventIds.length
    ? await supabase.from("sports_events").select("*").in("id", eventIds)
    : { data: [] };
  return invitations.flatMap((invitation) => {
    const sport = (sports ?? []).find((item) => item.id === invitation.competition_id);
    const event = sport ? (events ?? []).find((item) => item.id === sport.event_id) : null;
    return sport && event ? [{ invitation, sport, event }] : [];
  });
}
