import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/0003_phase3_department_management.sql"),
  "utf8",
);
const phase1 = readFileSync(
  resolve(process.cwd(), "supabase/migrations/0001_phase1_foundation.sql"),
  "utf8",
);
const phase2 = readFileSync(
  resolve(process.cwd(), "supabase/migrations/0002_phase2_daily_operations.sql"),
  "utf8",
);

const phase3Tables = [...migration.matchAll(/^create table public\.([a-z0-9_]+)/gim)].map((match) => match[1]);

describe("Phase 3 migration safety", () => {
  it("is additive and keeps the Phase 1/2 foundations intact", () => {
    expect(phase1.length).toBeGreaterThan(0);
    expect(phase2.length).toBeGreaterThan(0);
    expect(migration).toContain("Additive only");

    const destructiveStatements = migration
      .split(/\r?\n/)
      .some((line) => /^(drop|truncate|alter table .* drop|delete from)\b/i.test(line));
    expect(destructiveStatements).toBe(false);
    expect(migration).toContain("after 0001_phase1_foundation.sql and 0002_phase2_daily_operations.sql");
  });

  it("enables RLS on every Phase 3 table", () => {
    expect(phase3Tables.length).toBeGreaterThan(20);
    for (const table of phase3Tables) {
      expect(migration, `RLS missing on ${table}`).toMatch(
        new RegExp(`alter table public\\.${table} enable row level security`),
      );
    }
  });

  it("never grants anonymous access to private Phase 3 records", () => {
    for (const table of [
      "feedback_requests",
      "feedback_replies",
      "notifications",
      "email_announcements",
      "email_recipients",
      "equipment_transactions",
      "equipment_maintenance_records",
      "sports_participation_records",
      "announcement_audiences",
      "notification_preferences",
    ]) {
      expect(migration).not.toMatch(new RegExp(`grant select on public\\.${table}[^;]*to anon`, "i"));
    }
    expect(migration).toMatch(/public\.pe_calendar_events,\s*public\.calendar_recurrence_rules/);
    expect(migration).toMatch(/public\.game_rule_categories, public\.game_rule_posts/);
  });

  it("checks PE Admin inside privileged RPCs", () => {
    expect(migration).toContain("create or replace function public.admin_save_calendar_event");
    expect(migration).toContain("if not public.is_pe_admin() then raise exception 'PE Admin access required'; end if;");
    expect(migration).toContain("grant execute on function public.admin_save_calendar_event(uuid, jsonb, jsonb, jsonb) to authenticated");
  });

  it("preserves recurrence rule rows when editing an event", () => {
    const functionBody = migration.slice(
      migration.indexOf("create or replace function public.admin_save_calendar_event"),
      migration.indexOf("create or replace function public.admin_save_calendar_override"),
    );
    expect(functionBody).toContain("on conflict (event_id) do update set");
    expect(functionBody).not.toContain("delete from public.calendar_recurrence_rules where event_id = v_id;\n  if p_recurrence");
  });

  it("uses random object keys and keeps original filenames as metadata", () => {
    expect(migration).toContain("gen_random_uuid()::text || '.' || v_extension");
    expect(migration).toContain("'phase3/' || p_parent_type || '/' || p_parent_id::text");
    expect(migration).toContain("sanitize_filename_for_phase3(p_original_filename)");
  });

  it("enforces the daily email cap and distinct accepted/delivered statuses", () => {
    expect(migration).toContain("email_daily_usage");
    expect(migration).toContain("least");
    expect(migration).toContain("p_batch_size");
    expect(migration).toContain("record_email_provider_event");
    expect(migration).toContain("accepted");
    expect(migration).toContain("delivered");
  });
});
