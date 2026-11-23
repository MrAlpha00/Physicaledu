import {
  getAdminEvents,
  getAdminSports,
  getEntries,
  getMatches,
  getStandings,
  type EntryView,
  type MatchView,
} from "@/lib/data/phase4";
import type { ExportRow } from "@/lib/data/phase3-reports";
import type {
  Phase4EventRow,
  Phase4MatchRow,
  Phase4PaymentRecordRow,
  Phase4SportRow,
  Phase4StandingRow,
} from "@/types/database";

export const PHASE4_EXPORT_DATASETS = [
  "events",
  "registrations",
  "payments",
  "matches",
  "standings",
  "participation",
] as const;

export type Phase4ExportDataset = (typeof PHASE4_EXPORT_DATASETS)[number];

export const PHASE4_EXPORT_LABELS: Record<Phase4ExportDataset, string> = {
  events: "Sports events",
  registrations: "Competition registrations",
  payments: "Payment verification",
  matches: "Tournament matches",
  standings: "Competition standings",
  participation: "Participation summary",
};

type Named = { id: string; label: string };

function entryLabel(entry: { id: string; team_name: string | null }): string {
  return entry.team_name ?? `Competitor ${entry.id.slice(0, 8)}`;
}

export function eventExportRows(events: Phase4EventRow[]): ExportRow[] {
  return events.map((event) => ({
    id: event.id,
    name: event.name,
    slug: event.slug,
    academic_year: event.academic_year,
    status: event.status,
    venue: event.venue,
    starts_on: event.starts_on,
    ends_on: event.ends_on,
    registration_closes_at: event.registration_closes_at,
    is_public: event.is_public,
  }));
}

export function registrationExportRows(
  entries: EntryView[],
  sport: Phase4SportRow,
  event: Phase4EventRow,
): ExportRow[] {
  return entries.map((entry) => ({
    entry_id: entry.id,
    event: event.name,
    competition: sport.name,
    kind: entry.kind,
    team: entry.team_name,
    captain_usn: entry.members.find((member) => member.is_captain)?.usn ?? null,
    member_count: entry.members.length,
    status: entry.status,
    payment_status: entry.payment_status,
    seed: entry.seed,
    submitted_at: entry.submitted_at,
  }));
}

export function paymentExportRows(
  entries: EntryView[],
  sport: Phase4SportRow,
  event: Phase4EventRow,
): ExportRow[] {
  return entries.flatMap((entry) => {
    const payments: Array<Phase4PaymentRecordRow | null> = entry.payment ? [entry.payment] : [];
    return payments.map((payment) => ({
      payment_id: payment!.id,
      event: event.name,
      competition: sport.name,
      entry_id: entry.id,
      team: entry.team_name,
      status: payment!.status,
      transaction_reference: payment!.transaction_reference,
      claimed_amount: payment!.claimed_amount,
      proof_file_id: payment!.proof_file_id,
      note: payment!.note,
      verified_at: payment!.verified_at,
    }));
  });
}

export function matchExportRows(
  matches: MatchView[],
  sport: Phase4SportRow,
  event: Phase4EventRow,
  entries: Named[],
): ExportRow[] {
  const labels = new Map(entries.map((entry) => [entry.id, entry.label]));
  return matches.map((match: MatchView) => ({
    match_id: match.id,
    event: event.name,
    competition: sport.name,
    round: match.round_name,
    round_number: match.round_number,
    match_number: match.match_number,
    status: match.status,
    starts_at: match.starts_at,
    venue: match.venue,
    is_bye: match.is_bye,
    winner: match.winner_entry_id ? labels.get(match.winner_entry_id) ?? match.winner_entry_id : null,
    score_a: match.result?.score_a ?? null,
    score_b: match.result?.score_b ?? null,
    result_note: match.result?.result_note ?? null,
  }));
}

export function standingExportRows(
  standings: Phase4StandingRow[],
  sport: Phase4SportRow,
  event: Phase4EventRow,
  entries: Named[],
): ExportRow[] {
  const labels = new Map(entries.map((entry) => [entry.id, entry.label]));
  return standings.map((standing) => ({
    event: event.name,
    competition: sport.name,
    group: standing.group_key,
    position: standing.position,
    competitor: labels.get(standing.entry_id) ?? standing.entry_id,
    played: standing.played,
    wins: standing.wins,
    draws: standing.draws,
    losses: standing.losses,
    points_for: standing.points_for,
    points_against: standing.points_against,
    point_difference: standing.point_difference,
    competition_points: standing.competition_points,
    qualified: standing.qualified,
  }));
}

export function participationExportRows(
  entriesBySport: Array<{ entries: EntryView[]; sport: Phase4SportRow; event: Phase4EventRow }>,
): ExportRow[] {
  return entriesBySport.map(({ entries, sport, event }) => ({
    event: event.name,
    competition: sport.name,
    mode: sport.mode,
    status: sport.status,
    total_entries: entries.length,
    approved_entries: entries.filter((entry) => entry.status === "approved").length,
    pending_review: entries.filter((entry) => ["submitted", "under_review"].includes(entry.status)).length,
    verified_payments: entries.filter((entry) => entry.payment_status === "verified").length,
    pending_payments: entries.filter((entry) => entry.payment_status === "pending_verification").length,
  }));
}

/** Server-side dataset assembly shared by the XLSX/CSV route and print view. */
export async function getPhase4ExportRows(
  dataset: Phase4ExportDataset,
  filters: { eventId?: string; sportId?: string } = {},
): Promise<ExportRow[]> {
  const [events, allSports] = await Promise.all([
    getAdminEvents(),
    getAdminSports(filters.eventId),
  ]);
  if (dataset === "events") {
    return eventExportRows(events.filter((event) => !filters.eventId || event.id === filters.eventId));
  }

  const eventMap = new Map(events.map((event) => [event.id, event]));
  const sports = allSports.filter((sport) => {
    if (filters.sportId && sport.id !== filters.sportId) return false;
    if (filters.eventId && sport.event_id !== filters.eventId) return false;
    return Boolean(eventMap.get(sport.event_id));
  });

  const payloads = await Promise.all(sports.map(async (sport) => {
    const [entries, matches, standings] = await Promise.all([
      getEntries(sport.id),
      getMatches(sport.id),
      getStandings(sport.id),
    ]);
    return {
      sport,
      event: eventMap.get(sport.event_id)!,
      entries,
      matches,
      standings,
      names: entries.map((entry) => ({ id: entry.id, label: entryLabel(entry) })),
    };
  }));

  switch (dataset) {
    case "registrations":
      return payloads.flatMap((item) => registrationExportRows(item.entries, item.sport, item.event));
    case "payments":
      return payloads.flatMap((item) => paymentExportRows(item.entries, item.sport, item.event));
    case "matches":
      return payloads.flatMap((item) => matchExportRows(item.matches, item.sport, item.event, item.names));
    case "standings":
      return payloads.flatMap((item) => standingExportRows(item.standings, item.sport, item.event, item.names));
    case "participation":
      return participationExportRows(payloads.map(({ entries, sport, event }) => ({ entries, sport, event })));
    default:
      return [];
  }
}
