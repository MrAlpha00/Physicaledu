import { createClient } from "@/lib/supabase/server";
import type { MatchView } from "@/lib/data/phase5";
import type { Outcome } from "@/lib/games/types";
import type { Json } from "@/types/database";

/** Phase 5 notifications reuse the Phase 3 notification table (no new category). */
export async function notifyGameUsers(
  userIds: string[],
  title: string,
  body: string,
  link: string | null = "/games/dashboard",
): Promise<void> {
  const unique = [...new Set(userIds.filter(Boolean))];
  if (!unique.length) return;
  const supabase = await createClient();
  await Promise.all(unique.map((userId) =>
    supabase.rpc("phase3_notify_user", {
      p_user_id: userId,
      p_title: title,
      p_body: body,
      p_category: "general",
      p_link: link,
      p_priority: "normal",
      p_announcement_id: null,
    }),
  ));
}

export async function writeGameAudit(
  action: string,
  entityType: string,
  entityId: string,
  details: Record<string, Json> = {},
): Promise<void> {
  const supabase = await createClient();
  await supabase.rpc("phase3_log", {
    p_action: action,
    p_entity_type: entityType,
    p_entity_id: entityId,
    p_details: details as Json,
  });
}

export interface GameAchievementRule {
  code: string;
  title: string;
  description: string;
  criteria: Record<string, unknown>;
}

const DEFAULT_RULES: GameAchievementRule[] = [
  { code: "ranked_win", title: "Ranked Victory", description: "Win a competitive ranked game.", criteria: { type: "win" } },
  { code: "game_specialist", title: "Game Specialist", description: "Reach ten ranked wins in one game.", criteria: { type: "wins", threshold: 10 } },
];

async function achievementRules(): Promise<GameAchievementRule[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("game_achievement_rules")
    .select("code, title, description, criteria")
    .eq("is_enabled", true);
  if (!data?.length) return DEFAULT_RULES;
  return data.map((row) => ({
    code: row.code,
    title: row.title,
    description: row.description,
    criteria: row.criteria && typeof row.criteria === "object" ? (row.criteria as Record<string, unknown>) : {},
  }));
}

/**
 * Achievement rules only ever read a completed, ranked, non-disputed result.
 * Inserts are idempotent via a stable source_reference.
 */
export async function awardGameAchievements(match: MatchView, outcome: Outcome | null): Promise<number> {
  if (match.mode !== "ranked" || match.status !== "completed") return 0;
  if (!outcome || outcome.kind !== "win" || outcome.winner === null) return 0;
  const winner = match.players.find((player) => player.player_index === outcome.winner);
  if (!winner?.user_id) return 0;

  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles").select("student_directory_id").eq("id", winner.user_id).maybeSingle();
  if (!profile?.student_directory_id) return 0;

  const rules = await achievementRules();
  const { data: rating } = await supabase.from("game_ratings")
    .select("wins").eq("user_id", winner.user_id).eq("game_slug", match.game_slug).maybeSingle();
  const winCount = rating?.wins ?? 0;
  const gameName = match.game_slug.replace(/-/g, " ");
  let created = 0;

  for (const rule of rules) {
    const kind = typeof rule.criteria.type === "string" ? rule.criteria.type : "win";
    const threshold = typeof rule.criteria.threshold === "number" ? rule.criteria.threshold : 10;
    if (kind === "wins" && winCount < threshold) continue;
    if (kind !== "wins" && kind !== "win") continue;
    const reference = kind === "wins"
      ? `phase5:${rule.code}:${match.game_slug}:${winner.user_id}`
      : `phase5:${rule.code}:${match.id}:${winner.user_id}`;
    const { data: existing } = await supabase
      .from("sports_achievements").select("id").eq("source_reference", reference).maybeSingle();
    if (existing) continue;

    const { error } = await supabase.from("sports_achievements").insert({
      student_directory_id: profile.student_directory_id,
      title: `${rule.title} — ${gameName}`,
      sport: gameName,
      event_name: null,
      academic_year: null,
      achievement_date: (match.ended_at ?? match.updated_at).slice(0, 10),
      position_result: "Winner",
      award_description: rule.description,
      verification_status: "pending",
      source_type: "future_game",
      source_reference: reference,
    });
    if (!error) {
      created += 1;
      await notifyGameUsers(
        [winner.user_id],
        "Achievement unlocked",
        `${rule.title} — ${gameName}`,
        "/games/dashboard",
      );
    }
  }
  return created;
}

/** Ranked participation is recorded through the existing sports record system. */
export async function recordGameParticipation(match: MatchView): Promise<number> {
  if (match.mode !== "ranked" || match.status !== "completed") return 0;
  const supabase = await createClient();
  let created = 0;
  for (const player of match.players) {
    if (!player.user_id) continue;
    const reference = `phase5:participation:${match.id}:${player.user_id}`;
    const { data: existing } = await supabase
      .from("sports_participation_records").select("id").eq("source_reference", reference).maybeSingle();
    if (existing) continue;
    const { data: profile } = await supabase
      .from("profiles").select("student_directory_id").eq("id", player.user_id).maybeSingle();
    if (!profile?.student_directory_id) continue;
    const { error } = await supabase.from("sports_participation_records").insert({
      student_directory_id: profile.student_directory_id,
      source_type: "future_game",
      source_reference: reference,
      sport: match.game_slug.replace(/-/g, " "),
      activity_title: `Ranked ${match.game_slug} match`,
      participated_at: match.ended_at ?? match.updated_at,
      is_verified: true,
    });
    if (!error) created += 1;
  }
  return created;
}
