import { describe, expect, it } from 'vitest'
import {
  competitionRulesSchema,
  drawSchema,
  eligibilityRuleSchema,
  eventSchema,
  invitationSchema,
  invitationTokenSchema,
  matchScheduleSchema,
  organizerMatchUpdateSchema,
  participantInvitationTokenSchema,
  paymentProofSchema,
  paymentSettingsSchema,
  registrationSchema,
  resultSchema,
  sportSchema,
} from '../src/lib/validations/phase4'

const id = '11111111-1111-4111-8111-111111111111'
const id2 = '22222222-2222-4222-8222-222222222222'

describe('Phase 4 validation schemas', () => {
  it('validates event names, slugs and defaults', () => {
    const parsed = eventSchema.parse({
      name: 'Annual Sports Day',
      slug: 'annual-sports-day',
      academicYear: '2026-27',
    })
    expect(parsed.status).toBe('draft')
    expect(parsed.isPublic).toBe(false)
    expect(parsed.description).toBe('')
    expect(eventSchema.safeParse({
      name: 'Bad Slug',
      slug: 'Bad_Slug',
      academicYear: '2026-27',
    }).success).toBe(false)
  })

  it('validates sport configuration and tournament defaults', () => {
    const parsed = sportSchema.parse({
      eventId: id,
      name: 'Basketball',
      slug: 'basketball',
      mode: 'team',
    })
    expect(parsed.tournamentFormat).toBe('knockout')
    expect(parsed.drawMode).toBe('random')
    expect(parsed.tiebreakers).toEqual([
      'competition_points', 'point_difference', 'points_scored', 'wins',
    ])
    expect(sportSchema.safeParse({
      eventId: id,
      name: 'Badminton',
      slug: 'badminton',
      mode: 'team',
      groupCount: 1,
    }).success).toBe(false)
  })

  it('validates registration rules and rejects duplicate members', () => {
    const base = {
      kind: 'team' as const,
      teamName: 'Tigers',
      members: [
        { usn: '4SI21CS001', weightKg: 62, isCaptain: true },
        { usn: '4SI21CS002', weightKg: 68 },
      ],
    }
    expect(registrationSchema.parse(base).members).toHaveLength(2)
    expect(registrationSchema.safeParse({
      ...base,
      members: [base.members[0], base.members[0]],
    }).success).toBe(false)
    expect(registrationSchema.safeParse({
      ...base,
      members: [{ usn: 'not a usn' }],
    }).success).toBe(false)
  })

  it('requires a team name for team registrations', () => {
    expect(registrationSchema.safeParse({
      kind: 'team',
      members: [{ usn: '4SI21CS001' }],
    }).success).toBe(false)
    expect(registrationSchema.safeParse({
      kind: 'individual',
      members: [{ usn: '4SI21CS001' }],
    }).success).toBe(true)
  })

  it('validates eligibility, payment, rules and result payloads', () => {
    expect(eligibilityRuleSchema.parse({
      competitionId: id,
      ruleType: 'max_weight',
      ruleValue: { kg: 70 },
    }).ruleType).toBe('max_weight')
    expect(paymentSettingsSchema.parse({ competitionId: id }).paymentUnit).toBe('team')
    expect(competitionRulesSchema.parse({ competitionId: id }).minTeamSize).toBeUndefined()
    expect(resultSchema.parse({
      matchId: id,
      winnerEntryId: id2,
      scoreA: '21-18, 21-19',
      scoreB: '18-21, 19-21',
    }).winnerEntryId).toBe(id2)
    expect(resultSchema.safeParse({ matchId: id, winnerEntryId: 'not-uuid' }).success).toBe(false)
  })

  it('validates draw, schedule, proof, invitation and confirmation inputs', () => {
    expect(drawSchema.parse({ competitionId: id, drawSeed: 42 }).drawSeed).toBe(42)
    expect(drawSchema.safeParse({ competitionId: 'bad' }).success).toBe(false)
    expect(matchScheduleSchema.safeParse({
      matchId: id,
      status: 'ongoing',
      venue: 'Court 1',
    }).success).toBe(true)
    expect(organizerMatchUpdateSchema.safeParse({
      matchId: id,
      status: 'not-a-status',
    }).success).toBe(false)
    expect(paymentProofSchema.safeParse({
      entryId: id,
      proofFileId: id2,
      transactionReference: 'TXN123',
    }).success).toBe(true)
    expect(invitationSchema.parse({ competitionId: id, studentDirectoryId: id2 }).expiresHours).toBe(72)
    expect(invitationTokenSchema.safeParse({ token: 'short' }).success).toBe(false)
    expect(participantInvitationTokenSchema.safeParse({
      token: 'abcdefghijklmnopqrstuvwxyz123456',
      accept: true,
    }).success).toBe(true)
  })
})
