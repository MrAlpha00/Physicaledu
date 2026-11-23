import { describe, expect, it } from 'vitest'
import { generateTournament } from '../src/lib/tournament/engine'
import {
  buildFlowGraph,
  buildFlowGraphFromDatabase,
  extractNodePositions,
  readTournamentPlan,
  validateTournamentGraph,
} from '../src/lib/tournament/graph'
import type { TournamentEntry, TournamentPlan } from '../src/lib/tournament/types'

const entries: TournamentEntry[] = [
  { entryId: 'a', label: 'Team A', seed: 1 },
  { entryId: 'b', label: 'Team B', seed: 2 },
  { entryId: 'c', label: 'Team C', seed: 3 },
  { entryId: 'd', label: 'Team D', seed: 4 },
]

function fourTeamPlan(): TournamentPlan {
  return generateTournament({
    format: 'knockout',
    entries,
    drawMode: 'manual',
    manualOrder: ['a', 'b', 'c', 'd'],
  })
}

describe('Phase 4 tournament graph validation', () => {
  it('accepts a generated bracket', () => {
    expect(validateTournamentGraph(fourTeamPlan())).toEqual({ valid: true, errors: [] })
  })

  it('rejects duplicate match numbers, keys and same-competitor matches', () => {
    const plan = fourTeamPlan()
    const duplicate = structuredClone(plan)
    duplicate.matches[1].key = duplicate.matches[0].key
    expect(validateTournamentGraph(duplicate).errors).toContain(`Duplicate match key ${duplicate.matches[0].key}.`)

    const sameCompetitor = fourTeamPlan()
    sameCompetitor.matches[0].slotB.entryId = 'a'
    expect(validateTournamentGraph(sameCompetitor).errors.join(' ')).toContain('contains the same competitor twice')

    const duplicateNumbers = fourTeamPlan()
    duplicateNumbers.matches[1].matchNumber = duplicateNumbers.matches[0].matchNumber
    expect(validateTournamentGraph(duplicateNumbers).errors).toContain('Match numbers are not unique.')
  })

  it('rejects unknown, self, duplicate, same-round and invalid-feed edges', () => {
    const unknown = fourTeamPlan()
    unknown.edges[0].targetMatchKey = 'missing'
    expect(validateTournamentGraph(unknown).errors.join(' ')).toContain('Edge references an unknown match')

    const self = fourTeamPlan()
    self.edges[0].targetMatchKey = self.edges[0].sourceMatchKey
    expect(validateTournamentGraph(self).errors.join(' ')).toContain('cannot feed itself')

    const duplicate = fourTeamPlan()
    duplicate.edges.push({ ...duplicate.edges[0] })
    expect(validateTournamentGraph(duplicate).errors.join(' ')).toContain('multiple incoming feeds')

    const sameRound = fourTeamPlan()
    sameRound.edges[0].targetMatchKey = sameRound.matches[1].key
    expect(validateTournamentGraph(sameRound).errors.join(' ')).toContain('stays in the same round')

    const badFeed = fourTeamPlan()
    badFeed.edges[0].feed = 'loser'
    expect(validateTournamentGraph(badFeed).errors.join(' ')).toContain('only valid for a third-place match')
  })

  it('detects progression cycles and competitor duplication in the first round', () => {
    const cycle = fourTeamPlan()
    cycle.matches[0].roundKey = 'r2'
    cycle.matches[2].roundKey = 'r1'
    cycle.edges.push({ sourceMatchKey: cycle.matches[2].key, targetMatchKey: cycle.matches[0].key, targetSlot: 'a' })
    expect(validateTournamentGraph(cycle).errors.join(' ')).toContain('cycle')

    const duplicateCompetitor = fourTeamPlan()
    duplicateCompetitor.matches[1].slotB.entryId = 'a'
    expect(validateTournamentGraph(duplicateCompetitor).errors.join(' ')).toContain('multiple first-round slots')
  })

  it('does not trust unvalidated stored payloads', () => {
    expect(readTournamentPlan(null)).toBeNull()
    expect(readTournamentPlan([] as never)).toBeNull()
    expect(readTournamentPlan({ matches: [], rounds: [] })).toBeNull()
    expect(readTournamentPlan({ matches: [], rounds: [], edges: [], groups: [] })).toEqual({
      matches: [], rounds: [], edges: [], groups: [],
    })
  })
})

describe('Phase 4 React Flow canvas projection', () => {
  it('builds round, match and participant nodes plus feed and progression edges', () => {
    const plan = fourTeamPlan()
    const graph = buildFlowGraph(plan, {
      entries: entries.map(entry => ({ id: entry.entryId, label: entry.label })),
    })
    expect(graph.nodes.filter(node => node.type === 'roundNode')).toHaveLength(2)
    expect(graph.nodes.filter(node => node.type === 'matchNode')).toHaveLength(3)
    expect(graph.nodes.filter(node => node.type === 'participantNode')).toHaveLength(4)
    expect(graph.edges.filter(edge => edge.id.startsWith('feed:'))).toHaveLength(4)
    expect(graph.edges.filter(edge => edge.id.startsWith('progress:'))).toHaveLength(2)
    const final = graph.nodes.find(node => node.id === `match:${plan.matches[2].key}`)!
    expect(final.data.sublabel).toBe('Team A vs Team B')
  })

  it('uses database overlays for status, winner and compact labels', () => {
    const plan = fourTeamPlan()
    const graph = buildFlowGraphFromDatabase(plan, {
      compact: true,
      matches: [{ matchNumber: 1, status: 'completed', winnerEntryId: 'a', venue: 'Court 1' }],
    })
    const first = graph.nodes.find(node => node.id === `match:${plan.matches[0].key}`)!
    expect(first.data.status).toBe('completed')
    expect(first.data.winnerEntryId).toBe('a')
    expect(first.data.sublabel).toBe('Court 1')
  })

  it('applies saved positions and extracts rounded positions only', () => {
    const plan = fourTeamPlan()
    const key = `match:${plan.matches[0].key}`
    const graph = buildFlowGraph(plan, { positions: { [key]: { x: 12.4, y: 88.6 } } })
    expect(graph.nodes.find(node => node.id === key)?.position).toEqual({ x: 12.4, y: 88.6 })
    expect(extractNodePositions(graph.nodes)[key]).toEqual({ x: 12, y: 89 })
    expect(Object.keys(extractNodePositions(graph.nodes))).toHaveLength(graph.nodes.length)
  })
})
