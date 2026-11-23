import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Json } from "@/types/database";
import { applyAuthoritativeAction, canJoinMatch, createMatchEnvelope, isTerminalStatus, participantIndex } from "@/lib/games/match-service";
import type { GameAction, MatchEnvelope } from "@/lib/games/types";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/0005_phase5_games_multiplayer.sql"),
  "utf8",
);
const middleware = readFileSync(resolve(process.cwd(), "src/lib/supabase/middleware.ts"), "utf8");
const actionSource = readFileSync(resolve(process.cwd(), "src/app/(student)/games/actions.ts"), "utf8");

const phase5Tables = [
  "game_catalog", "game_settings", "game_achievement_rules", "gaming_profiles",
  "game_ratings", "game_challenges", "challenge_history", "game_matches",
  "game_rating_history", "game_match_players", "game_match_actions",
  "game_match_state_snapshots", "game_match_results", "guest_game_sessions",
  "guest_match_sessions", "game_reports", "match_disputes", "gaming_restrictions",
  "rating_adjustment_history",
];

function envelope(mode: "ranked" | "guest" = "ranked"): MatchEnvelope {
  return createMatchEnvelope({
    id: "match-id",
    slug: "tic-tac-toe",
    mode,
    players: [
      { userId: mode === "ranked" ? "user-a" : null, guestId: mode === "guest" ? "guest-a" : undefined, displayName: "A" },
      { userId: mode === "ranked" ? "user-b" : null, guestId: mode === "guest" ? "guest-b" : undefined, displayName: "B" },
    ],
    now: new Date("2026-06-01T12:00:00.000Z"),
  });
}

function move(seq: number, version: number, actor: 0 | 1, cell = 0): GameAction {
  return { seq, expectedVersion: version, actor, type: "move", payload: { cell } };
}

describe("Phase 5 migration — RLS and privilege boundaries", () => {
  it("creates and protects every Phase 5 table with explicit RLS", () => {
    for (const table of phase5Tables) {
      expect(migration).toContain(`create table public.${table}`);
      expect(migration).toContain(`alter table public.${table} enable row level security`);
    }
  });

  it("keeps private match state behind participant policies", () => {
    expect(migration).toContain("create policy phase5_matches_participant_read");
    expect(migration).toContain("create policy phase5_match_players_read");
    expect(migration).toContain("create policy phase5_actions_participant_read");
    expect(migration).toContain("create policy phase5_snapshots_participant_read");
    for (const line of migration.split("\n")) {
      if (line.includes("policy") && /matches_participant|match_players_read|actions_participant|snapshots_participant/.test(line)) {
        expect(line).not.toContain("to anon");
      }
    }
  });

  it("never lets guests or anonymous callers reach authoritative action persistence", () => {
    expect(migration).toContain("revoke all on function public.phase5_submit_action");
    expect(migration).toContain("grant execute on function public.phase5_submit_action");
    const submitBlock = migration.slice(
      migration.indexOf("revoke all on function public.phase5_submit_action"),
      migration.indexOf("alter publication supabase_realtime"),
    );
    expect(submitBlock).toContain("to service_role");
    expect(submitBlock).not.toMatch(/grant execute on function public\.phase5_submit_action[^\n]*to (anon|authenticated)/);
    expect(actionSource).toContain("createAdminClient()");
  });

  it("uses pinned search paths and audited definer RPCs", () => {
    const definerFunctions = migration.match(/language (?:plpgsql|sql) security definer[^\n]*/g) ?? [];
    expect(definerFunctions.length).toBeGreaterThan(15);
    for (const line of definerFunctions) expect(line).toContain("set search_path = public, pg_temp");
    expect(migration).toContain("phase3_log");
  });

  it("adds realtime tables without disabling RLS and protects student prefixes in middleware", () => {
    expect(migration).toContain("alter publication supabase_realtime add table public.game_matches");
    expect(migration).not.toContain("alter table public.game_matches disable row level security");
    for (const prefix of ["/games/dashboard", "/games/challenges", "/games/match", "/games/profile", "/games/history"]) {
      expect(middleware).toContain(`"${prefix}"`);
    }
  });

  it("does not expose academic identifiers in public gaming profile columns", () => {
    const profileTable = migration.slice(migration.indexOf("create table public.gaming_profiles"), migration.indexOf("create table public.game_ratings"));
    expect(profileTable).not.toContain("usn");
    expect(profileTable).not.toContain("email");
    expect(migration).toContain("phase5_search_profiles");
  });
});

describe("Phase 5 — authoritative action boundary", () => {
  it("verifies participation, status, turn, sequence and version", () => {
    const match = { ...envelope(), status: "active" as const };
    expect(participantIndex(match, "user-a")).toBe(0);
    expect(participantIndex(match, "stranger")).toBeNull();
    expect(canJoinMatch(match, "stranger")).toBe(false);

    const base = { userId: "user-a" };
    expect(applyAuthoritativeAction(match, move(1, 1, 0), { userId: "stranger" }).ok).toBe(false);
    expect(applyAuthoritativeAction({ ...match, status: "waiting" }, move(1, 1, 0), base).ok).toBe(false);
    expect(applyAuthoritativeAction(match, move(2, 1, 0), base).error).toContain("sequence");
    expect(applyAuthoritativeAction(match, move(1, 2, 0), base).error).toContain("outdated");
    expect(applyAuthoritativeAction(match, move(1, 1, 1), base).ok).toBe(false);
    expect(applyAuthoritativeAction(match, { ...move(1, 1, 0), type: "DROP ALL" }, base).ok).toBe(false);
    expect(applyAuthoritativeAction(match, { ...move(1, 1, 0), payload: { blob: "x".repeat(5000) } as Record<string, Json> }, base).ok).toBe(false);

    const valid = applyAuthoritativeAction(match, move(1, 1, 0), base);
    expect(valid.ok).toBe(true);
    expect(valid.match?.version).toBe(match.version + 1);
    expect(valid.match?.status).toBe("active");
  });

  it("rejects ranked matches without two authenticated students", () => {
    const match = { ...envelope("guest"), mode: "ranked" as const, status: "active" as const };
    const result = applyAuthoritativeAction(match, move(1, 1, 0), { userId: null, guestId: "guest-a" });
    expect(result.ok).toBe(false);
    expect(result.error).toContain("authenticated students");
  });

  it("classifies terminal states without letting clients write outcomes", () => {
    const match = envelope();
    expect(isTerminalStatus(match)).toBe(false);
    expect(isTerminalStatus({ ...match, status: "completed" })).toBe(true);
    expect(isTerminalStatus({ ...match, status: "disputed" })).toBe(true);
    const actionSourceNoClientScore = actionSource.includes("applyAuthoritativeAction(envelope, action");
    expect(actionSourceNoClientScore).toBe(true);
  });
});
