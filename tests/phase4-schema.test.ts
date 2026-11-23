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

describe('Phase 4 migration', () => {
  it('creates the event, registration, file and tournament tables', () => {
    for (const table of [
      'public.phase4_events',
      'public.phase4_event_sports',
      'public.phase4_registration_windows',
      'public.phase4_entries',
      'public.phase4_entry_participants',
      'public.phase4_entry_rosters',
      'public.phase4_payment_proofs',
      'public.phase4_files',
      'public.phase4_organizer_invitations',
      'public.phase4_sport_organizer_assignments',
      'public.phase4_tournaments',
      'public.phase4_tournament_nodes',
      'public.phase4_matches',
    ]) {
      expect(migration).toContain(`create table if not exists ${table}`)
    }
  })

  it('enables row level security and defines readable policies on every Phase 4 table', () => {
    const tables = [
      'phase4_events',
      'phase4_event_sports',
      'phase4_registration_windows',
      'phase4_entries',
      'phase4_entry_participants',
      'phase4_entry_rosters',
      'phase4_payment_proofs',
      'phase4_files',
      'phase4_organizer_invitations',
      'phase4_sport_organizer_assignments',
      'phase4_tournaments',
      'phase4_tournament_nodes',
      'phase4_matches',
    ]
    for (const table of tables) {
      expect(migration).toMatch(new RegExp(`alter table public\\.${table}\\s+enable row level security`))
      expect(migration).toMatch(new RegExp(`create policy ${table}_[a-z_]+ on public\\.${table}`))
    }
  })

  it('never grants public access to private payment proofs', () => {
    const proofPolicies = migration
      .split('\n')
      .filter(line => line.includes('create policy phase4_payment_proofs'))
      .join('\n')
    expect(proofPolicies).not.toContain('to public')
    expect(proofPolicies).not.toContain('using (true)')
    expect(proofPolicies).toContain('phase4_is_admin()')
    expect(proofPolicies).toContain('phase4_owns_entry')
  })

  it('requires admin or scoped sport-organizer access for draw and match changes', () => {
    expect(migration).toContain('create or replace function public.phase4_has_sport_access')
    expect(migration).toContain('permission denied for sport')
    expect(migration).toContain('create or replace function public.phase4_save_draw')
    expect(migration).toContain('create or replace function public.phase4_admin_update_match')
    expect(migration).toContain('create or replace function public.phase4_organizer_update_match')
    expect(migration).toContain('phase4_has_sport_access(p_sport_id, v_admin)')
    expect(migration).toContain('not v_admin and not v_organizer')
  })

  it('validates the complete draw plan before persisting it', () => {
    expect(migration).toContain('create or replace function public.phase4_validate_plan')
    expect(migration).toContain('p_expected_team_count integer')
    expect(migration).toContain('p_expected_participant_count integer')
    expect(migration).toContain('p_nodes jsonb')
    expect(migration).toContain('p_edges jsonb')
    expect(migration).toContain('duplicate match id')
    expect(migration).toContain('unknown participant')
    expect(migration).toContain('unknown source')
    expect(migration).toContain('cycle detected')
    expect(migration).toContain('invalid plan')
  })

  it('persists draw nodes and matches in one transaction', () => {
    const saveDraw = migration.slice(
      migration.indexOf('create or replace function public.phase4_save_draw'),
      migration.indexOf('create or replace function public.phase4_save_node_positions'),
    )
    expect(saveDraw).toContain('returns jsonb')
    expect(saveDraw).toContain('language plpgsql')
    expect(saveDraw).toContain('security definer')
    expect(saveDraw).toContain('insert into public.phase4_tournament_nodes')
    expect(saveDraw).toContain('insert into public.phase4_matches')
    expect(saveDraw).toContain('on conflict (id) do update')
    expect(saveDraw).toContain('validate_plan ->>')
    expect(saveDraw).toContain('commit')
  })

  it('protects file authorization, upload confirmation and private downloads', () => {
    expect(migration).toContain('create or replace function public.phase4_authorize_upload')
    expect(migration).toContain('create or replace function public.phase4_confirm_upload')
    expect(migration).toContain('create or replace function public.phase4_authorize_download')
    expect(migration).toContain('phase4_can_view_file')
    expect(migration).toContain('purpose in (\'payment_proof\'')
    expect(migration).toContain('lower(p_content_type) like \'image/%\'')
    expect(migration).toContain('p_file_size_bytes > 10485760')
    expect(migration).toContain('does not belong to entry')
  })

  it('uses transactional proof submission and verification with notifications', () => {
    expect(migration).toContain('create or replace function public.phase4_submit_payment_proof')
    expect(migration).toContain('create or replace function public.phase4_verify_payment')
    expect(migration).toContain('phase4_notify_users')
    expect(migration).toContain('public.notifications')
    expect(migration).toContain('p_proof_file_id')
    expect(migration).toContain('p_note')
  })

  it('keeps organiser invitations scoped to one sport and validates acceptance', () => {
    expect(migration).toContain('create or replace function public.phase4_create_organizer_invitation')
    expect(migration).toContain('create or replace function public.phase4_accept_organizer_invitation')
    expect(migration).toContain('lower(trim(p_email))')
    expect(migration).toContain('token sha256')
    expect(migration).toContain('expired or already used')
    expect(migration).toContain('on conflict (sport_id, user_id)')
  })

  it('enforces publication and draw-lock gates on result submission', () => {
    expect(migration).toContain('create or replace function public.phase4_submit_match_result')
    expect(migration).toContain('create or replace function public.phase4_correct_match_result')
    expect(migration).toContain('advance_on_result is true')
    expect(migration).toContain('locked is not true')
    expect(migration).toContain('phase4_apply_match_result')
    expect(migration).toContain('phase4_notify_users')
  })

  it('enables realtime for public tournament state', () => {
    expect(migration).toMatch(/alter publication supabase_realtime add table public\.phase4_tournaments;/)
    expect(migration).toMatch(/alter publication supabase_realtime add table public\.phase4_matches;/)
    expect(migration).toMatch(/alter publication supabase_realtime add table public\.phase4_tournament_nodes;/)
    expect(migration).toContain('replica identity full')
  })

  it('adds indexes for the main query and RLS paths', () => {
    for (const fragment of [
      'phase4_events (status)',
      'phase4_event_sports (event_id)',
      'phase4_entries (sport_id, status)',
      'phase4_payment_proofs (status, created_at)',
      'phase4_files (entry_id)',
      'phase4_tournament_nodes (tournament_id, lane, seq)',
      'phase4_matches (tournament_id, round_number)',
    ]) {
      expect(migration).toContain(fragment)
    }
  })

  it('has matching TypeScript row and RPC declarations', () => {
    for (const type of [
      'Phase4EventRow',
      'Phase4EventSportRow',
      'Phase4EntryRow',
      'Phase4PaymentProofRow',
      'Phase4FileRow',
      'Phase4MatchRow',
      'Phase4TournamentRow',
      'Phase4SaveDrawArgs',
      'Phase4AuthorizeUploadArgs',
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
