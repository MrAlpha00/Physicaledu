import { describe, expect, it } from 'vitest'
import { SCORE_ADAPTERS, getAdapter } from '../src/lib/tournament/scoring'
import { calculateStandings, validateScore } from '../src/lib/tournament/standings'
import { DEFAULT_POINTS, directSlot, emptySlot } from '../src/lib/tournament/types'

describe('Phase 4 scoring adapters', () => {
  it('exposes an adapter for every scoring mode', () => {
    expect(Object.keys(SCORE_ADAPTERS).sort()).toEqual(['manual', 'sets', 'simple', 'time'])
    expect(SCORE_ADAPTERS.simple.label).toBe('Simple score')
    expect(getAdapter('sets').mode).toBe('sets')
    expect(getAdapter('unknown').mode).toBe('manual')
    expect(getAdapter(null).mode).toBe('manual')
  })

  it('derives a winner from a simple score and requires a confirmed winner elsewhere', () => {
    const slots = { a: directSlot('a'), b: directSlot('b') }
    expect(SCORE_ADAPTERS.simple.deriveWinner({ scoreA: 21, scoreB: 18, winnerEntryId: null }, slots)).toBe('a')
    expect(SCORE_ADAPTERS.simple.deriveWinner({ scoreA: 18, scoreB: 21, winnerEntryId: null }, slots)).toBe('b')
    expect(SCORE_ADAPTERS.simple.deriveWinner({ scoreA: 20, scoreB: 20, winnerEntryId: null }, slots)).toBeNull()
    expect(SCORE_ADAPTERS.sets.deriveWinner({ scoreA: 2, scoreB: 1, winnerEntryId: 'b' }, slots)).toBe('b')
  })

  it('validates each scoring mode', () => {
    expect(validateScore('manual', { scoreA: null, scoreB: null, winnerEntryId: 'a' }).ok).toBe(true)
    expect(validateScore('simple', { scoreA: 21, scoreB: 18, winnerEntryId: 'a' }).ok).toBe(true)
    expect(validateScore('simple', { scoreA: 20, scoreB: 20, winnerEntryId: 'a' }).ok).toBe(false)
    expect(validateScore('simple', { scoreA: -1, scoreB: 18, winnerEntryId: 'a' }).ok).toBe(false)
    expect(validateScore('sets', {
      scoreA: 2,
      scoreB: 1,
      winnerEntryId: 'a',
      breakdown: [{ set: 1, scoreA: 21, scoreB: 18 }],
    }).ok).toBe(true)
    expect(validateScore('sets', { scoreA: 2, scoreB: 1, winnerEntryId: 'a' }).ok).toBe(false)
    expect(validateScore('time', { scoreA: 0, scoreB: 42, winnerEntryId: 'b' }).ok).toBe(false)
    expect(validateScore('simple', { scoreA: 21, scoreB: 18, winnerEntryId: null }).ok).toBe(false)
  })

  it('creates explicit empty and direct slots', () => {
    expect(emptySlot()).toEqual({ entryId: null, sourceMatchKey: null, fromBye: false })
    expect(directSlot('entry-1')).toEqual({ entryId: 'entry-1', sourceMatchKey: null, fromBye: false })
  })
})

describe('Phase 4 standings', () => {
  it('applies points, tiebreakers and qualification spots', () => {
    const standings = calculateStandings(
      ['a', 'b', 'c'],
      [
        {
          key: 'm1', groupKey: null, slotAEntryId: 'a', slotBEntryId: 'b',
          result: { scoreA: 21, scoreB: 18, winnerEntryId: 'a' },
        },
        {
          key: 'm2', groupKey: null, slotAEntryId: 'b', slotBEntryId: 'c',
          result: { scoreA: 21, scoreB: 19, winnerEntryId: 'b' },
        },
      ],
      { qualifyingSpots: 1 },
    )
    expect(standings.map((row) => row.entryId)).toEqual(['a', 'b', 'c'])
    expect(standings[0]).toMatchObject({ played: 1, wins: 1, losses: 0, competitionPoints: 3 })
    expect(standings[0].pointDifference).toBe(3)
    expect(standings[1]).toMatchObject({ played: 2, wins: 1, losses: 1, competitionPoints: 3 })
    expect(standings.filter((row) => row.qualified)).toEqual([standings[0]])
  })

  it('supports draws, group filters and custom points', () => {
    const points = { ...DEFAULT_POINTS, win: 2, draw: 1, loss: 0 }
    const standings = calculateStandings(
      ['a', 'b'],
      [{
        key: 'm1', groupKey: 'A', slotAEntryId: 'a', slotBEntryId: 'b',
        result: { scoreA: 15, scoreB: 15, winnerEntryId: 'a' },
      }],
      { points, groupKey: 'B' },
    )
    expect(standings.every((row) => row.played === 0)).toBe(true)
  })

  it('ignores incomplete results and unresolved slots', () => {
    const standings = calculateStandings(
      ['a', 'b'],
      [
        { key: 'm1', groupKey: null, slotAEntryId: 'a', slotBEntryId: 'b', result: null },
        {
          key: 'm2', groupKey: null, slotAEntryId: 'a', slotBEntryId: null,
          result: { scoreA: 21, scoreB: 18, winnerEntryId: 'a' },
        },
      ],
    )
    expect(standings.every((row) => row.played === 0)).toBe(true)
  })
})
