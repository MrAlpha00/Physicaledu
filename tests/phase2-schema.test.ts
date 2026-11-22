import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/0002_phase2_daily_operations.sql"),
  "utf8",
);
const foundation = readFileSync(
  resolve(process.cwd(), "supabase/migrations/0001_phase1_foundation.sql"),
  "utf8",
);
const envExample = readFileSync(resolve(process.cwd(), ".env.example"), "utf8");

const phase2Tables = [
  "attendance_sessions",
  "attendance_records",
  "class_tasks",
  "task_audiences",
  "task_submissions",
  "stored_files",
  "visitor_purposes",
  "visitor_records",
  "pe_rooms",
  "room_activities",
  "room_sessions",
  "qr_codes",
];

describe("phase 2 migration safety", () => {
  it("is additive and leaves the Phase 1 foundation present", () => {
    expect(foundation.length).toBeGreaterThan(0);
    expect(migration).toContain("Additive only");
    expect(migration.toLowerCase()).not.toMatch(/\bdrop\b|\btruncate\b|\bdelete from\b/);
  });

  it("enables RLS on every Phase 2 table", () => {
    for (const table of phase2Tables) {
      expect(migration).toContain(`create table public.${table}`);
      expect(migration).toMatch(
        new RegExp(`alter table public\\.${table} enable row level security`),
      );
    }
  });

  it("defines task matching only after task_audiences exists", () => {
    expect(migration.indexOf("create table public.task_audiences")).toBeLessThan(
      migration.indexOf("create or replace function public.student_matches_task"),
    );
  });

  it("keeps the public visitor board projection privacy-safe", () => {
    expect(migration).toContain("get_today_visitors");
    expect(migration).toContain("visitor_label");
    expect(migration).toContain("purpose_label");
    expect(migration).toContain("visitor_records_admin_all");
    expect(migration).not.toContain("grant select on public.visitor_records to anon");
  });

  it("restricts the admin audit wrapper to PE admins", () => {
    expect(migration).toContain("create or replace function public.admin_log_action");
    expect(migration).toContain("if not public.is_pe_admin() then");
    expect(migration).toContain(
      "grant execute on function public.admin_log_action(text, text, text, jsonb) to authenticated",
    );
  });

  it("enables realtime only for the live board tables", () => {
    expect(migration).toContain("alter publication supabase_realtime add table public.attendance_records");
    expect(migration).toContain("alter publication supabase_realtime add table public.room_sessions");
  });

  it("does not embed credentials in the migration", () => {
    for (const secret of [
      "R2_SECRET_ACCESS_KEY=",
      "TURNSTILE_SECRET_KEY=",
      "SUPABASE_SECRET_KEY=",
    ]) {
      expect(migration).not.toContain(secret);
    }
  });
});

describe("environment template", () => {
  it("documents every required Phase 2 variable without values", () => {
    const required = [
      "NEXT_PUBLIC_SUPABASE_URL",
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
      "SUPABASE_SECRET_KEY",
      "R2_ACCOUNT_ID",
      "R2_ACCESS_KEY_ID",
      "R2_SECRET_ACCESS_KEY",
      "R2_BUCKET_NAME",
      "R2_ENDPOINT",
      "NEXT_PUBLIC_TURNSTILE_SITE_KEY",
      "TURNSTILE_SECRET_KEY",
      "NEXT_PUBLIC_SITE_URL",
    ];
    for (const name of required) {
      expect(envExample).toContain(`${name}=`);
    }
    for (const line of envExample.split(/\r?\n/)) {
      const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (match) expect(match[2].trim()).toBe("");
    }
  });
});
