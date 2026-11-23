import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MatchView } from "@/lib/data/phase5";
import type { Outcome } from "@/lib/games/types";
import type { Json } from "@/types/database";

const h = vi.hoisted(() => {
  const rpcCalls: Array<{ name: string; params: Record<string, unknown> }> = [];
  const inserts: Array<{ table: string; row: Record<string, unknown> }> = [];
  const selected: Record<string, unknown> = {};
  let rules: Array<Record<string, unknown>> = [];

  const builder = (table: string) => {
    const chain: Record<string, unknown> = {};
    const select = vi.fn(() => chain);
    const eq = vi.fn(() => chain);
    chain.select = select;
    chain.eq = eq;
    chain.maybeSingle = vi.fn(async () => ({ data: selected[table] ?? null }));
    chain.insert = vi.fn(async (row: Record<string, unknown>) => {
      inserts.push({ table, row });
      return { error: null };
    });
    chain.then = (resolve: (value: unknown) => unknown) =>
      Promise.resolve(table === "game_achievement_rules" ? { data: rules } : { data: null }).then(resolve);
    return chain;
  };

  const client = {
    rpc: vi.fn(async (name: string, params: Record<string, unknown>) => {
      rpcCalls.push({ name, params });
      return { error: null };
    }),
    from: vi.fn((table: string) => builder(table)),
  };

  return {
    rpcCalls,
    inserts,
    selected,
    client,
    setRules(value: Array<Record<string, unknown>>) { rules = value; },
  };
});

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn(async () => h.client) }));

import {
  awardGameAchievements,
  notifyGameUsers,
  recordGameParticipation,
  writeGameAudit,
} from "@/lib/operations/phase5";

const winner = "11111111-1111-4111-8111-111111111111";
const loser = "22222222-2222-4222-8222-222222222222";
const outcome: Outcome = { kind: "win", winner: 0, reason: "Test win." };

function match(overrides: Partial<MatchView> = {}): MatchView {
  return {
    id: "33333333-3333-4333-8333-333333333333",
    public_id: "abcdef1234567890",
    game_slug: "chess",
    mode: "ranked",
    status: "completed",
    config: {},
    state: {},
    version: 2,
    server_seq: 2,
    outcome: outcome as unknown as Json,
    challenge_id: null,
    started_at: "2026-06-01T11:00:00.000Z",
    ended_at: "2026-06-01T12:00:00.000Z",
    created_by: winner,
    created_at: "2026-06-01T11:00:00.000Z",
    updated_at: "2026-06-01T12:00:00.000Z",
    players: [
      {
        match_id: "33333333-3333-4333-8333-333333333333",
        player_index: 0, user_id: winner, display_name: "Ace", ready: true, connected: true,
        rating_before: 1200, rating_after: 1216, rating_delta: 16, joined_at: "2026-06-01T11:00:00.000Z",
      },
      {
        match_id: "33333333-3333-4333-8333-333333333333",
        player_index: 1, user_id: loser, display_name: "Rook", ready: true, connected: true,
        rating_before: 1200, rating_after: 1184, rating_delta: -16, joined_at: "2026-06-01T11:00:00.000Z",
      },
    ],
    result: null,
    actions: [],
    ...overrides,
  };
}

beforeEach(() => {
  h.rpcCalls.length = 0;
  h.inserts.length = 0;
  for (const key of Object.keys(h.selected)) delete h.selected[key];
  h.setRules([]);
});

describe("Phase 5 — notification and audit operations", () => {
  it("reuses Phase 3 notifications with the general category and deduplicates recipients", async () => {
    await notifyGameUsers([], "Nobody", "No recipients");
    expect(h.rpcCalls).toHaveLength(0);

    await notifyGameUsers([winner, winner, loser], "Challenge", "You were challenged", "/games/challenges");
    expect(h.rpcCalls).toHaveLength(2);
    expect(h.rpcCalls[0].name).toBe("phase3_notify_user");
    expect(h.rpcCalls[0].params).toMatchObject({
      p_user_id: winner, p_category: "general", p_priority: "normal", p_link: "/games/challenges",
    });
  });

  it("writes audited events through the shared phase3_log RPC", async () => {
    await writeGameAudit("phase5_rating_adjusted", "game_ratings", winner, { before: 1200, after: 1300 });
    expect(h.rpcCalls).toMatchObject([{ name: "phase3_log", params: { p_action: "phase5_rating_adjusted" } }]);
  });
});

describe("Phase 5 — achievements and sports records", () => {
  it("only awards achievements for completed ranked wins with a verified student profile", async () => {
    expect(await awardGameAchievements(match({ mode: "practice" }), outcome)).toBe(0);
    expect(await awardGameAchievements(match({ status: "active" }), outcome)).toBe(0);
    expect(await awardGameAchievements(match(), { kind: "draw", winner: null, reason: "Draw." })).toBe(0);
    expect(h.inserts).toHaveLength(0);

    expect(await awardGameAchievements(match(), outcome)).toBe(0);
    expect(h.inserts).toHaveLength(0);

    h.selected.profiles = { student_directory_id: "student-1" };
    const created = await awardGameAchievements(match(), outcome);
    expect(created).toBe(1);
    expect(h.inserts).toMatchObject([{
      table: "sports_achievements",
      row: { source_type: "future_game", source_reference: `phase5:ranked_win:${match().id}:${winner}` },
    }]);
    expect(h.rpcCalls.some((call) => call.name === "phase3_notify_user")).toBe(true);
  });

  it("is idempotent and only awards threshold rules after enough wins", async () => {
    h.selected.profiles = { student_directory_id: "student-1" };
    h.selected.sports_achievements = { id: "existing" };
    expect(await awardGameAchievements(match(), outcome)).toBe(0);
    expect(h.inserts).toHaveLength(0);

    delete h.selected.sports_achievements;
    h.selected.game_ratings = { wins: 10 };
    h.setRules([
      { code: "ranked_win", title: "Ranked Victory", description: "Win a ranked game.", criteria: { type: "win" } },
      { code: "game_specialist", title: "Game Specialist", description: "Ten wins.", criteria: { type: "wins", threshold: 10 } },
    ]);
    expect(await awardGameAchievements(match(), outcome)).toBe(2);
    expect(h.inserts).toHaveLength(2);
  });

  it("records participation only for ranked completed matches, once per player", async () => {
    expect(await recordGameParticipation(match({ mode: "friendly" }))).toBe(0);
    expect(await recordGameParticipation(match({ status: "active" }))).toBe(0);
    expect(h.inserts).toHaveLength(0);

    expect(await recordGameParticipation(match())).toBe(0);
    h.selected.profiles = { student_directory_id: "student-1" };
    expect(await recordGameParticipation(match())).toBe(2);
    expect(h.inserts.every((item) => item.table === "sports_participation_records")).toBe(true);

    h.inserts.length = 0;
    h.selected.sports_participation_records = { id: "existing" };
    expect(await recordGameParticipation(match())).toBe(0);
  });
});
