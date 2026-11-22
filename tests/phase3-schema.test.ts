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

  it("exposes only caller-scoped identity wrappers to clients", () => {
    expect(migration).toContain("create or replace function public.current_phase3_student_directory_id()");
    expect(migration).toContain("create or replace function public.current_can_view_calendar_event(p_event_id uuid)");
    expect(migration).toContain("create or replace function public.current_matches_announcement(p_announcement_id uuid)");
    expect(migration).toContain("grant execute on function public.current_can_view_calendar_event(uuid) to anon, authenticated;");
    expect(migration).not.toMatch(/grant execute on function public\.can_view_calendar_event\(uuid, uuid\)/);
    expect(migration).not.toMatch(/grant execute on function public\.phase3_matches_audience\(jsonb, uuid\)/);
  });

  it("targets announcements and hides internal feedback notes", () => {
    expect(migration).toContain("using (public.current_matches_announcement(id));");
    expect(migration).toContain("is_internal boolean not null default false");
    expect(migration).toMatch(/feedback_status_history_own_read[\s\S]{0,220}is_internal = false/);
  });

  it("keeps profile photos private and validates their ownership", () => {
    expect(migration).toContain("Profile photo must be your own uploaded image");
    expect(migration).toContain("Profile photos are private: only the uploader (handled above) or an admin");
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
    expect(functionBody).toContain("(p_recurrence->>'remove')::boolean");
    expect(functionBody).not.toContain("delete from public.calendar_recurrence_rules where event_id = v_id;\n  if p_recurrence");
    expect(functionBody).not.toMatch(/returning id into v_rule_id;\s*else\s*delete from public\.calendar_recurrence_rules/);
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

    expect(migration).toContain("create unique index email_recipients_provider_idx");
    expect(migration).toContain("np.channel = 'email' and np.enabled = false");
    expect(migration).toContain("now() - interval '15 minutes'");
    expect(migration).toContain("on conflict (provider_event_id) do nothing\n  returning recipient_id into v_recipient_id");
    expect(migration).toContain("grant execute on function public.record_email_provider_event(text, text, text, jsonb) to service_role;");
  });

  it("keeps stock, maintenance and attachment flows consistent", () => {
    expect(migration).toContain("v_item.available_quantity + p_quantity_delta > v_item.quantity + p_quantity_delta");
    expect(migration).toContain("Use the issue/return flow to change transaction status");
    expect(migration).toContain("Asset does not belong to this item or is not available");
    expect(migration).toContain("cost = coalesce(p_cost, cost)");
    expect(migration).toContain("create or replace function public.student_attach_phase3_file(");
    expect(migration).toContain("grant execute on function public.student_attach_phase3_file(text, uuid, uuid) to authenticated;");
  });
});
