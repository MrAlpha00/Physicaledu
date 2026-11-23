import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  PHASE4_EXPORT_DATASETS,
  eventExportRows,
  matchExportRows,
  participationExportRows,
  paymentExportRows,
  registrationExportRows,
  standingExportRows,
} from '../src/lib/export/phase4'
import type { EntryView, MatchView } from '../src/lib/data/phase4'
import type {
  Phase4EventRow,
  Phase4SportRow,
  Phase4StandingRow,
} from '../src/types/database'

const event = {
  id: 'event-1',
  name: 'Annual Sports Day',
  slug: 'annual-sports-day',
  academic_year: '2026-27',
  status: 'published',
  venue: 'Main Ground',
  starts_on: '2026-08-10',
  ends_on: '2026-08-12',
  registration_closes_at: '2026-08-01T00:00:00.000Z',
  is_public: true,
} as unknown as Phase4EventRow

const sport = {
  id: 'sport-1',
  event_id: event.id,
  name: 'Basketball',
  mode: 'team',
  status: 'ongoing',
} as unknown as Phase4SportRow

const entry = {
  id: 'entry-1',
  team_name: 'Tigers',
  kind: 'team',
  status: 'approved',
  payment_status: 'verified',
  seed: 1,
  submitted_at: '2026-07-20T00:00:00.000Z',
  members: [{ usn: '4SI21CS001', is_captain: true }],
  payment: {
    id: 'payment-1',
    status: 'verified',
    transaction_reference: 'TXN-123',
    claimed_amount: 500,
    proof_file_id: 'file-1',
    note: null,
    verified_at: '2026-07-21T00:00:00.000Z',
  },
} as unknown as EntryView

const match = {
  id: 'match-1',
  round_name: 'Final',
  round_number: 2,
  match_number: 3,
  status: 'completed',
  starts_at: '2026-08-12T09:00:00.000Z',
  venue: 'Court 1',
  is_bye: false,
  winner_entry_id: entry.id,
  result: { score_a: '21-18, 21-19', score_b: '18-21, 19-21', result_note: 'Clean finish' },
} as unknown as MatchView

const standing = {
  group_key: 'overall',
  position: 1,
  entry_id: entry.id,
  played: 3,
  wins: 3,
  draws: 0,
  losses: 0,
  points_for: 63,
  points_against: 57,
  point_difference: 6,
  competition_points: 9,
  qualified: true,
} as unknown as Phase4StandingRow

describe('Phase 4 report rows', () => {
  it('exposes all six audited datasets', () => {
    expect(PHASE4_EXPORT_DATASETS).toEqual([
      'events', 'registrations', 'payments', 'matches', 'standings', 'participation',
    ])
  })

  it('produces event and registration rows without private file fields', () => {
    expect(eventExportRows([event])[0]).toMatchObject({
      id: event.id,
      name: event.name,
      slug: event.slug,
      is_public: true,
    })
    const row = registrationExportRows([entry], sport, event)[0]
    expect(row).toMatchObject({
      entry_id: entry.id,
      event: event.name,
      competition: sport.name,
      team: 'Tigers',
      captain_usn: '4SI21CS001',
      member_count: 1,
      payment_status: 'verified',
    })
    expect(JSON.stringify(row)).not.toContain('proof_file_id')
  })

  it('includes proof metadata only in the admin payment dataset', () => {
    const row = paymentExportRows([entry], sport, event)[0]
    expect(row).toMatchObject({
      payment_id: 'payment-1',
      transaction_reference: 'TXN-123',
      proof_file_id: 'file-1',
    })
    expect(paymentExportRows([{ ...entry, payment: null } as unknown as EntryView], sport, event)).toEqual([])
  })

  it('maps match and standing rows to human-readable competitors', () => {
    const names = [{ id: entry.id, label: 'Tigers' }]
    expect(matchExportRows([match], sport, event, names)[0]).toMatchObject({
      match_id: match.id,
      winner: 'Tigers',
      score_a: '21-18, 21-19',
      result_note: 'Clean finish',
    })
    expect(standingExportRows([standing], sport, event, names)[0]).toMatchObject({
      competitor: 'Tigers',
      competition_points: 9,
      qualified: true,
    })
  })

  it('summarizes participation without exposing individual documents', () => {
    const row = participationExportRows([{ entries: [entry], sport, event }])[0]
    expect(row).toMatchObject({
      event: event.name,
      competition: sport.name,
      total_entries: 1,
      approved_entries: 1,
      verified_payments: 1,
      pending_payments: 0,
    })
    expect(JSON.stringify(row)).not.toContain('proof')
  })
})

describe('Phase 4 export and print wiring', () => {
  it('routes exports through the audited API and shares rows with print', () => {
    const route = readFileSync(resolve(process.cwd(), 'src/app/api/phase4/exports/route.ts'), 'utf8')
    const print = readFileSync(resolve(process.cwd(), 'src/app/print/phase4/page.tsx'), 'utf8')
    expect(route).toContain('getPhase4ExportRows')
    expect(route).toContain('buildPhase3Workbook')
    expect(route).toContain('admin_log_action')
    expect(route).toContain('text/csv')
    expect(print).toContain('getPhase4ExportRows')
  })

  it('serves private proof downloads through an authorized route', () => {
    const route = readFileSync(
      resolve(process.cwd(), 'src/app/api/phase4/files/[id]/download/route.ts'),
      'utf8',
    )
    const action = readFileSync(
      resolve(process.cwd(), 'src/lib/actions/phase4-files.ts'),
      'utf8',
    )
    expect(route).toContain('createPhase4DownloadUrl')
    expect(action).toContain('phase4_authorize_download')
    expect(action).toContain('createPresignedDownload')
  })
})
