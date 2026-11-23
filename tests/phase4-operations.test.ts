import { beforeEach, describe, expect, it, vi } from 'vitest'

const { rpcMock, fromMock } = vi.hoisted(() => ({
  rpcMock: vi.fn(),
  fromMock: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({ rpc: rpcMock, from: fromMock })),
}))

import {
  notifyPhaseUsers,
  recordWinnerAchievements,
  syncEventToCalendar,
  syncMatchToCalendar,
} from '@/lib/operations/phase4'
import type {
  Phase4EntryRow,
  Phase4EventRow,
  Phase4MatchRow,
  Phase4SportRow,
} from '@/types/database'

function query(data: unknown, error: unknown = null) {
  const chain: Record<string, unknown> = { data, error }
  chain.select = vi.fn(() => chain)
  chain.eq = vi.fn(() => chain)
  chain.maybeSingle = vi.fn(async () => ({ data, error }))
  chain.upsert = vi.fn(async () => ({ error: null }))
  chain.insert = vi.fn(async () => ({ error: null }))
  return chain
}

const event = {
  id: 'event-1',
  name: 'Annual Sports Day',
  description: 'Annual competition',
  academic_year: '2026-27',
  starts_on: '2026-08-10',
  ends_on: '2026-08-12',
  venue: 'Main Ground',
  is_public: true,
  status: 'published',
  banner_file_id: null,
} as unknown as Phase4EventRow

const sport = { id: 'sport-1', name: 'Basketball', is_public: true } as unknown as Phase4SportRow
const entry = { id: 'entry-1', team_name: 'Tigers' } as unknown as Phase4EntryRow
const match = {
  id: 'match-1',
  match_number: 3,
  status: 'scheduled',
  starts_at: '2026-08-12T09:00:00.000Z',
  ends_at: null,
  venue: 'Court 1',
  calendar_event_id: null,
} as unknown as Phase4MatchRow

describe('Phase 4 integrated operations', () => {
  beforeEach(() => {
    rpcMock.mockReset()
    fromMock.mockReset()
  })

  it('deduplicates notification recipients and reuses Phase 3 notifications', async () => {
    await notifyPhaseUsers(['user-1', 'user-2', 'user-1', ''], 'Result', 'Body', 'future_event', '/events')
    expect(rpcMock).toHaveBeenCalledTimes(2)
    expect(rpcMock).toHaveBeenCalledWith('phase3_notify_user', expect.objectContaining({
      p_user_id: 'user-1',
      p_category: 'future_event',
      p_link: '/events',
    }))
    rpcMock.mockClear()
    await notifyPhaseUsers([], 'Result', 'Body')
    expect(rpcMock).not.toHaveBeenCalled()
  })

  it('syncs a published event to the existing calendar and stores the link', async () => {
    const linkQuery = query({ calendar_event_id: null })
    const upsertQuery = query(null)
    fromMock.mockReturnValueOnce(linkQuery).mockReturnValueOnce(upsertQuery)
    rpcMock.mockResolvedValueOnce({ data: [{ id: 'calendar-1' }], error: null })

    const id = await syncEventToCalendar(event)
    expect(id).toBe('calendar-1')
    expect(rpcMock).toHaveBeenCalledWith('admin_save_calendar_event', expect.objectContaining({
      p_event_id: null,
      p_data: expect.objectContaining({ title: event.name, category: 'competition', status: 'published' }),
      p_audiences: [{ audience_type: 'all_students' }],
    }))
    expect(upsertQuery.upsert).toHaveBeenCalledWith({
      source_type: 'event', source_id: event.id, calendar_event_id: 'calendar-1',
    })
  })

  it('skips calendar sync for unscheduled matches', async () => {
    const id = await syncMatchToCalendar({ ...match, starts_at: null }, event, sport)
    expect(id).toBeNull()
    expect(rpcMock).not.toHaveBeenCalled()
  })

  it('creates idempotent, pending winner achievements from confirmed results', async () => {
    fromMock
      .mockReturnValueOnce(query([{ student_directory_id: 'student-1' }, { student_directory_id: 'student-2' }]))
      .mockReturnValueOnce(query({ id: 'achievement-1' }))
      .mockReturnValueOnce(query(null))
      .mockReturnValueOnce(query(null))
    const created = await recordWinnerAchievements(entry, event, sport, 'match-1')
    expect(created).toBe(1)
    const insertPayload = (fromMock.mock.results[3].value.insert as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(insertPayload).toMatchObject({
      source_type: 'future_event',
      verification_status: 'pending',
      position_result: 'Winner',
      source_reference: 'phase4:event-1:sport-1:match-1:entry-1',
    })
  })
})
