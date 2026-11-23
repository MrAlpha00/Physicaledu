import { describe, expect, it } from 'vitest'
import {
  canSubmitParticipantResult,
  getMatchWinnerId,
  getResultState,
  getScoringSummary,
  matchesDeadline,
  normalizeSetScores,
  parseSetScores,
  scoreShape,
  validateMatchResult,
} from '../src/lib/tournament/scoring'
import type { MatchNode, Participant } from '../src/lib/tournament/types'

const participants: Participant[] = [
  { id: 'a', label: 'A', seed: 1, demo: true },
  { id: 'b', label: 'B', seed: 2, demo: false },
  { id: 'c', label: 'C', seed: undefined, demo: false },
]

const match: MatchNode = {
  id: 'm1',
  kind: 'match',
  label: 'Final',
  round: 1,
  seq: 1,
  lane: 'championship',
  participantAId: 'a',
  participantBId: 'b',
  scores: [],
  status: 'pending',
}

describe('Phase 4 result validation', () => {
  it('parses and normalizes set scores', () => {
    expect(parseSetScores('21-18, 15-21, 21-19')).toEqual([
      [21, 18],
      [15, 21],
      [21, 19],
    ])
    expect(parseSetScores('21:18; 15:21')).toEqual([
      [21, 18],
      [15, 21],
    ])
    expect(normalizeSetScores([[21, 18], [15, 21]])).toEqual([[21, 18], [15, 21]])
    expect(scoreShape('bad')).toBeNull()
  })

  it('rejects incomplete, negative and tied results', () => {
    expect(validateMatchResult({ scores: [] }, match, participants).valid).toBe(false)
    expect(validateMatchResult({ scores: [[21, 18]] }, match, participants).valid).toBe(false)
    expect(validateMatchResult({ scores: [[20, 20], [21, 18]] }, match, participants).valid).toBe(false)
    expect(validateMatchResult({ scores: [[21, -1], [21, 18]] }, match, participants).valid).toBe(false)
    const bye = { ...match, participantBId: null }
    expect(validateMatchResult({ scores: [] }, bye, participants).valid).toBe(true)
  })

  it('rejects scores for participants not in the match and missing winner', () => {
    expect(validateMatchResult({ scores: [[21, 18], [21, 18]], winnerId: 'c' }, match, participants).valid).toBe(false)
    expect(validateMatchResult({ scores: [[21, 18], [21, 18]], winnerId: null }, match, participants).valid).toBe(false)
  })

  it('accepts a valid two-set result and computes the winner', () => {
    const result = validateMatchResult(
      { scores: [[21, 18], [21, 19]], winnerId: 'a' },
      match,
      participants,
    )
    expect(result.valid).toBe(true)
    expect(getMatchWinnerId({ ...match, scores: [[21, 18], [21, 19]], winnerId: 'a' }, participants)).toBe('a')
  })

  it('summarizes sets and points and protects draws', () => {
    const scores = [[21, 18], [15, 21], [21, 19]]
    expect(getScoringSummary(scores, 'a', 'b')).toEqual({
      setsA: 2,
      setsB: 1,
      pointsA: 57,
      pointsB: 58,
      winnerId: 'a',
    })
    expect(validateMatchResult({ scores: [[21, 21], [21, 21]] }, match, participants).valid).toBe(false)
  })

  it('classifies result states from match status and data', () => {
    expect(getResultState(match)).toBe('pending')
    expect(getResultState({ ...match, status: 'live' })).toBe('live')
    expect(getResultState({ ...match, status: 'completed', winnerId: 'a' })).toBe('completed')
    expect(getResultState({ ...match, status: 'completed', winnerId: null })).toBe('needs-review')
    expect(getResultState({ ...match, status: 'walkover', winnerId: 'b' })).toBe('walkover')
  })

  it('allows participant submissions only before the deadline and for real participants', () => {
    const now = '2026-06-10T12:00:00.000Z'
    const deadline = '2026-06-11T00:00:00.000Z'
    expect(canSubmitParticipantResult(now, deadline)).toBe(true)
    expect(canSubmitParticipantResult('2026-06-12T00:00:00.000Z', deadline)).toBe(false)
    expect(matchesDeadline('2026-06-09T00:00:00.000Z', now)).toBe(false)
    expect(matchesDeadline('2026-06-11T00:00:00.000Z', now)).toBe(true)
  })
})
