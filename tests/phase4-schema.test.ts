import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/0004_phase4_events_tournaments.sql'),
  'utf8',
)
const databaseTypes = readFileSync(resolve(process.cwd(), 'src/types/database.ts'), 'utf8')
const middleware = readFileSync(
  resolve(process.cwd(), 'src/lib/supabase/middleware.ts'),
  'utf8',
)

const phase4Tables = [
  'phase4_files',
  'sports_events',
  'event_sports',
  'competition_rules',
  'competition_eligibility_rules',
  'competition_entries',
  'competition_entry_members',
  'registration_history',
  'participant_invitations',
  'competition_payment_settings',
  'competition_payment_records',
  'payment_verification_history',
  'tournament_draws',
  'tournament_stages',
  'tournament_groups',
  'tournament_participants',
  'tournament_matches',
  'tournament_match_slots',
  'tournament_match_results',
  'tournament_match_result_history',
  'tournament_standings',
  'tournament_graph_edges',
  'tournament_node_positions',
  'sport_organizer_assignments',
  'organizer_invitations',
  'organizer_activity_logs',
  'phase4_calendar_links',
]

describe('Phase 4 migration — schema', () => {
  it('creates the event, registration, payment, file and tournament tables', () => {
    for (const table of phase4Tables) {
      expect(migration).toContain(`create table public.${table}`)
    }
  })

  it('enables row level security on every Phase 4 table', () => {
    for (const table of phase4Tables) {
      expect(migration).toContain(`alter table public.${table} enable row level security`)
    }
  })

  it('defines read policies for public, admin and scoped organiser access', () => {
    expect(migration).toContain('create policy phase4_events_public_read')
    expect(migration).toContain('create policy phase4_sports_public_read')
    expect(migration).toContain('create policy phase4_matches_public_read')
    expect(migration).toContain('create policy phase4_results_public_read')
    expect(migration).toContain('create policy phase4_matches_organizer_read')
    expect(migration).toContain('create policy phase4_entries_organizer_read')
    expect(migration).toContain('public.phase4_has_sport_access(d.competition_id)')
    expect(migration).toContain('using (public.phase4_is_admin()) with check (public.phase4_is_admin())')
  })

  it('does not expose private payment proofs to the public or organisers', () => {
    expect(migration).toContain('create policy phase4_payment_records_admin_all')
    expect(migration).toContain('create policy phase4_payment_records_owner_read')
    expect(migration).toContain('using (public.phase4_owns_entry(entry_id))')
    for (const line of migration.split('\n')) {
      if (line.includes('policy') && line.includes('payment_records')) {
        expect(line).not.toContain('to anon')
        expect(line).not.toContain('phase4_has_sport_access')
      }
    }
    expect(migration).toContain(
      'comment on table public.competition_payment_records is \'Private payment proofs; never exposed to organisers or public pages.\'',
    )
  })

  it('keeps weight and identity fields behind configurable rules and snapshots', () => {
    expect(migration).toContain('weight_kg numeric(6,2)')
    expect(migration).toContain('require_manual_identity_verification boolean')
    expect(migration).toContain('rules_snapshot jsonb')
    expect(migration).toContain('registration_rule_snapshot jsonb')
    expect(migration).toContain('custom_questions jsonb')
  })

  it('adds indexes for the main query and RLS paths', () => {
    for (const fragment of [
      'competition_entries (competition_id, status)',
      'competition_entries_captain_idx',
      'competition_entry_members_directory_idx',
      'competition_payment_settings',
      'tournament_draws_competition_idx',
      'tournament_matches_draw_idx',
      'tournament_matches_organizer_idx',
      'sport_organizer_assignments_user_idx',
      'phase4_files_parent_idx',
    ]) {
      expect(migration).toContain(fragment)
    }
  })

  it('enables realtime for live tournament and registration state', () => {
    expect(migration).toContain('alter publication supabase_realtime add table public.tournament_matches')
    expect(migration).toContain('alter publication supabase_realtime add table public.competition_entries')
  })
})

describe('Phase 4 migration — transactional operations', () => {
  it('validates the complete draw plan before saving it', () => {
    expect(migration).toContain('create or replace function public.phase4_validate_plan(p_plan jsonb)')
    expect(migration).toContain('Duplicate match identifiers in draw.')
    expect(migration).toContain('A match is missing a slot.')
    expect(migration).toContain('Progression edge references an unknown match.')
    expect(migration).toContain('A match slot has multiple incoming feeds.')
    expect(migration).toContain('Tournament progression contains a cycle.')
    expect(migration).toContain('v_errors := public.phase4_validate_plan(p_plan)')
    expect(migration).toContain('raise exception \'Invalid tournament draw: %\'')
  })

  it('persists draw stages, groups, matches, slots and edges with admin access checks', () => {
    const saveDraw = migration.slice(
      migration.indexOf('create or replace function public.phase4_save_draw'),
      migration.indexOf('create or replace function public.phase4_save_node_positions'),
    )
    expect(saveDraw).toContain('if not public.phase4_is_admin() then')
    expect(saveDraw).toContain('insert into public.tournament_draws')
    expect(saveDraw).toContain('insert into public.tournament_stages')
    expect(saveDraw).toContain('insert into public.tournament_groups')
    expect(saveDraw).toContain('insert into public.tournament_matches')
    expect(saveDraw).toContain('insert into public.tournament_match_slots')
    expect(saveDraw).toContain('insert into public.tournament_graph_edges')
    expect(saveDraw).toContain('insert into public.tournament_standings')
    expect(saveDraw).toContain('phase3_log(\'tournament_draw_generated\'')
  })

  it('requires a reason to redraw after results or unlock a draw', () => {
    expect(migration).toContain('A locked draw requires an administrative reason to regenerate.')
    expect(migration).toContain('Regenerating after results require an administrative reason.')
    expect(migration).toContain('Unlocking a bracket requires a reason.')
    expect(migration).toContain('status = case when p_locked then \'locked\' else \'active\' end')
  })

  it('only accepts valid canvas node keys when persisting positions', () => {
    expect(migration).toContain("v_key !~ '^(match|participant|round):'")
    expect(migration).toContain('on conflict (draw_id, node_key) do update')
  })

  it('advances winners and updates standings when results are submitted', () => {
    const submit = migration.slice(
      migration.indexOf('create or replace function public.phase4_submit_match_result'),
      migration.indexOf('create or replace function public.phase4_correct_match_result'),
    )
    expect(submit).toContain('select * into v_match from public.tournament_matches where id = p_match_id for update')
    expect(submit).toContain('result submission is not permitted for this assignment')
    expect(submit).toContain('assigned to another organiser')
    expect(submit).toContain('The selected winner is not part of this match.')
    expect(submit).toContain('insert into public.tournament_match_results')
    expect(submit).toContain('insert into public.tournament_match_result_history')
    expect(submit).toContain('where e.source_match_id = p_match_id and e.feed = \'winner\'')
    expect(submit).toContain('update public.tournament_standings')
    expect(submit).toContain("perform public.phase4_notify_users(\n    v_notify, 'Match result submitted'")
  })

  it('audits corrections and blocks editing submitted results as an organiser', () => {
    expect(migration).toContain('A correction reason is required.')
    expect(migration).toContain("values (p_match_id, v_old.id, auth.uid(), 'corrected'")
    expect(migration).toContain('A submitted result cannot be changed through match management.')
    expect(migration).toContain('Unsupported match status.')
  })

  it('keeps organiser invitations scoped to one sport and validates acceptance', () => {
    expect(migration).toContain('create or replace function public.phase4_create_organizer_invitation')
    expect(migration).toContain('create or replace function public.phase4_accept_organizer_invitation')
    expect(migration).toContain('p_expires_hours not between 1 and 720')
    expect(migration).toContain('encode(digest')
    expect(migration).toContain('on conflict (competition_id, user_id)')
    expect(migration).toContain('unique (competition_id, user_id)')
  })

  it('submits payment proofs transactionally with scope checks', () => {
    const proof = migration.slice(
      migration.indexOf('create or replace function public.phase4_submit_payment_proof'),
      migration.indexOf('create or replace function public.phase4_respond_participant_invitation'),
    )
    expect(proof).toContain('p_proof_file_id')
    expect(proof).toContain("f.parent_type = 'payment_proof'")
    expect(proof).toContain('Attach a confirmed payment proof for this registration.')
    expect(proof).toContain('insert into public.payment_verification_history')
    expect(proof).toContain('phase4_notify_users')
  })

  it('authorizes uploads, confirms sizes, and protects private downloads', () => {
    expect(migration).toContain('create or replace function public.phase4_authorize_upload')
    expect(migration).toContain('create or replace function public.phase4_confirm_upload')
    expect(migration).toContain('create or replace function public.phase4_authorize_download')
    expect(migration).toContain('p_byte_size > 10485760')
    expect(migration).toContain("p_content_type not in ('image/png', 'image/jpeg', 'image/webp', 'application/pdf')")
    expect(migration).toContain("if p_parent_type = 'payment_proof' then v_object_visibility := 'private'")
    expect(migration).toContain('You cannot confirm this upload.')
    expect(migration).toContain('public.phase4_can_view_file(f.id)')
    expect(migration).toContain("revoke all on function public.phase4_authorize_download(uuid) from public")
  })
})

describe('Phase 4 migration — application wiring', () => {
  it('has matching TypeScript row and RPC declarations', () => {
    for (const type of [
      'Phase4EventRow',
      'Phase4SportRow',
      'Phase4EntryRow',
      'Phase4PaymentRecordRow',
      'Phase4FileRow',
      'Phase4MatchRow',
      'Phase4DrawRow',
      'Phase4StandingRow',
    ]) {
      expect(databaseTypes).toContain(`export type ${type}`)
    }
    for (const rpc of [
      'phase4_save_draw',
      'phase4_submit_match_result',
      'phase4_authorize_upload',
      'phase4_authorize_download',
    ]) {
      expect(databaseTypes).toContain(`${rpc}:`)
    }
  })

  it('protects the student and organiser routes in middleware', () => {
    expect(middleware).toContain("'/my-events'")
    expect(middleware).toContain("'/organizer'")
    expect(middleware).toContain('PROTECTED_PREFIXES')
  })
})
