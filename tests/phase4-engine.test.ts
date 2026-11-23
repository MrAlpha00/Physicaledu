import { describe, expect, it } from 'vitest'
import {
  createRandom,
  generateManualKnockout,
  generateTournament,
  nextPowerOfTwo,
  orderEntries,
  placeKnockoutEntries,
  roundName,
  seededOrder,
  shuffle,
} from '../src/lib/tournament/engine'
import type { TournamentEntry } from '../src/lib/tournament/types'

const entries: TournamentEntry[] = [
  { entryId: 'a', label: 'A', seed: 1 },
  { entryId: 'b', label: 'B', seed: 2 },
  { entryId: 'c', label: 'C', seed: 3 },
  { entryId: 'd', label: 'D', seed: 4 },
]

describe('Phase 4 tournament engine — primitives', () => {
  it('uses a deterministic seeded random generator', () => {
    const first = createRandom(42)
    const second = createRandom(42)
    expect(Array.from({ length: 5 }, () => first())).toEqual(
      Array.from({ length: 5 }, () => second()),
    )
    expect(createRandom(43)()).not.toBe(createRandom(42)())
  })

  it('computes bracket sizes and round labels', () => {
    expect(nextPowerOfTwo(1)).toBe(1)
    expect(nextPowerOfTwo(3)).toBe(4)
    expect(nextPowerOfTwo(17)).toBe(32)
    expect(seededOrder(8)).toEqual([1, 8, 4, 5, 2, 7, 3, 6])
    expect(roundName(2)).toBe('Final')
    expect(roundName(4)).toBe('Semifinal')
    expect(roundName(8)).toBe('Quarterfinal')
    expect(roundName(10)).toBe('Round of 10')
  })

  it('shuffles without mutating the source', () => {
    const source = [1, 2, 3, 4, 5]
    const result = shuffle(source, createRandom(7))
    expect(result).toHaveLength(source.length)
    expect([...result].sort()).toEqual(source)
    expect(source).toEqual([1, 2, 3, 4, 5])
  })

  it('validates manual draw orders and respects seeds', () => {
    expect(() => orderEntries(entries, 'manual', 1)).toThrow('exactly one position')
    expect(() => orderEntries(entries, 'manual', 1, ['a', 'b', 'c', 'c'])).toThrow('duplicate')
    expect(() => orderEntries(entries, 'manual', 1, ['a', 'b', 'c', 'unknown'])).toThrow('unknown entry')
    expect(orderEntries(entries, 'manual', 1, ['d', 'c', 'b', 'a']).map(e => e.entryId)).toEqual(['d', 'c', 'b', 'a'])
    expect(orderEntries(entries, 'seeded', 1).map(e => e.entryId)).toEqual(['a', 'b', 'c', 'd'])
  })

  it('places non power-of-two fields with bye gaps', () => {
    const positions = placeKnockoutEntries(entries.slice(0, 3), 4, 'manual', 0, ['a', 'b', 'c'])
    expect(positions.map(entry => entry?.entryId ?? null)).toEqual(['a', 'b', 'c', null])
    const seeded = placeKnockoutEntries(entries, 4, 'seeded', 1)
    expect(seeded[0]?.entryId).toBe('a')
    expect(seeded[3]?.entryId).toBe('b')
  })
})

describe('Phase 4 tournament engine — formats', () => {
  it('generates a complete knockout bracket with progression edges', () => {
    const plan = generateTournament({ format: 'knockout', entries, drawMode: 'manual', manualOrder: ['a', 'b', 'c', 'd'] })
    expect(plan.bracketSize).toBe(4)
    expect(plan.rounds.map(round => round.name)).toEqual(['Semifinal', 'Final'])
    expect(plan.matches).toHaveLength(3)
    expect(plan.matches.filter(match => match.isBye)).toHaveLength(0)
    expect(plan.edges).toHaveLength(2)
    expect(plan.edges.every(edge => edge.feed !== 'loser')).toBe(true)
    const final = plan.matches.find(match => match.roundName === 'Final')!
    expect(final.slotA.sourceMatchKey).toBe(plan.matches[0].key)
    expect(final.slotB.sourceMatchKey).toBe(plan.matches[1].key)
  })

  it('generates byes and pre-advances bye winners', () => {
    const plan = generateTournament({
      format: 'knockout',
      entries: entries.slice(0, 3),
      drawMode: 'manual',
      manualOrder: ['a', 'b', 'c'],
    })
    const byes = plan.matches.filter(match => match.isBye)
    expect(byes).toHaveLength(1)
    expect(byes[0].byeWinnerEntryId).toBe('c')
    const final = plan.matches.find(match => match.roundName === 'Final')!
    expect(final.slotB.entryId).toBe('c')
    expect(final.slotB.fromBye).toBe(true)
  })

  it('adds a third-place match fed by semifinal losers', () => {
    const plan = generateTournament({
      format: 'knockout',
      entries,
      drawMode: 'manual',
      manualOrder: ['a', 'b', 'c', 'd'],
      thirdPlace: true,
    })
    const third = plan.matches.find(match => match.stage === 'third_place')!
    expect(third).toBeDefined()
    expect(plan.edges.filter(edge => edge.feed === 'loser')).toHaveLength(2)
    expect(plan.edges.filter(edge => edge.targetMatchKey === third.key)).toHaveLength(2)
  })

  it('generates single and double round-robin schedules', () => {
    const single = generateTournament({ format: 'round_robin', entries, drawMode: 'manual', manualOrder: ['a', 'b', 'c', 'd'] })
    expect(single.matches).toHaveLength(6)
    expect(single.rounds).toHaveLength(3)
    expect(single.edges).toHaveLength(0)
    const double = generateTournament({ format: 'round_robin', entries, drawMode: 'manual', manualOrder: ['a', 'b', 'c', 'd'], legs: 2 })
    expect(double.matches).toHaveLength(12)
    expect(new Set(double.matches.map(match => match.key)).size).toBe(12)
    const reverse = double.matches.find(match => match.key.startsWith('rr2-'))!
    const original = single.matches.find(match => match.key === reverse.key.replace('rr2-', 'rr'))!
    expect(reverse.slotA.entryId).toBe(original.slotB.entryId)
    expect(reverse.slotB.entryId).toBe(original.slotA.entryId)
  })

  it('generates group-stage matches plus a qualifier bracket', () => {
    const plan = generateTournament({
      format: 'group_knockout',
      entries,
      drawMode: 'manual',
      manualOrder: ['a', 'b', 'c', 'd'],
      groupCount: 2,
      qualifiersPerGroup: 1,
    })
    expect(plan.groups.map(group => group.key)).toEqual(['g1', 'g2'])
    expect(plan.groups.flatMap(group => group.entryIds)).toEqual(['a', 'c', 'b', 'd'])
    expect(plan.matches.filter(match => match.stage === 'group')).toHaveLength(2)
    expect(plan.matches.some(match => match.stage === 'knockout')).toBe(true)
    expect(plan.qualifiersPerGroup).toBe(1)
  })

  it('supports explicit manual pairings', () => {
    const plan = generateManualKnockout(entries, [['a', null], ['c', 'd']])
    const byes = plan.matches.filter(match => match.isBye)
    expect(byes).toHaveLength(1)
    expect(byes[0].byeWinnerEntryId).toBe('a')
    expect(plan.drawMode).toBe('manual')
  })

  it('rejects invalid fields before generating a plan', () => {
    expect(() => generateTournament({ format: 'knockout', entries: [] })).toThrow('At least one approved entry')
    expect(() => generateTournament({ format: 'knockout', entries: [entries[0], entries[0]] })).toThrow('same entry twice')
    expect(() => generateTournament({ format: 'group_knockout', entries })).toThrow('at least two groups')
  })

  it('produces identical plans for identical seeds', () => {
    const options = { format: 'knockout' as const, entries, drawSeed: 99 }
    const withoutTimestamp = (plan: ReturnType<typeof generateTournament>) => {
      const { generatedAt: _generatedAt, ...rest } = plan
      return rest
    }
    expect(withoutTimestamp(generateTournament(options))).toEqual(withoutTimestamp(generateTournament(options)))
  })
})
