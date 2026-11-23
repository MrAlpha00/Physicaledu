import type { GeneratedMatch, TournamentPlan } from "./types";

export interface GraphValidationResult {
  valid: boolean;
  errors: string[];
}

export interface CanvasNodeData {
  label: string;
  sublabel?: string;
  matchKey?: string;
  roundKey?: string;
  entryId?: string;
  status?: string;
  winnerEntryId?: string | null;
  isBye?: boolean;
  seed?: number | null;
  paymentStatus?: string | null;
  groupKey?: string | null;
}

export interface CanvasNode {
  id: string;
  type: "matchNode" | "participantNode" | "roundNode";
  position: { x: number; y: number };
  data: CanvasNodeData;
}

export interface CanvasEdge {
  id: string;
  source: string;
  target: string;
  type: "smoothstep";
  animated?: boolean;
  label?: string;
  style?: Record<string, string | number>;
}

/**
 * Validates the authoritative tournament graph before it is persisted or
 * rendered. This is deliberately independent of React Flow: the database is
 * the source of truth and the canvas only consumes validated data.
 */
export function validateTournamentGraph(plan: TournamentPlan): GraphValidationResult {
  const errors: string[] = [];
  const matches = new Map<string, GeneratedMatch>();

  for (const match of plan.matches) {
    if (matches.has(match.key)) errors.push(`Duplicate match key ${match.key}.`);
    matches.set(match.key, match);
    if (match.slotA.entryId && match.slotA.entryId === match.slotB.entryId) {
      errors.push(`Match ${match.key} contains the same competitor twice.`);
    }
    if (match.isBye && !match.byeWinnerEntryId) {
      errors.push(`Bye match ${match.key} has no advancing competitor.`);
    }
    if (!match.isBye && (!match.slotA.entryId || !match.slotB.entryId) &&
        (!match.slotA.sourceMatchKey || !match.slotB.sourceMatchKey)) {
      errors.push(`Match ${match.key} has an unresolved slot.`);
    }
  }

  if (new Set(plan.matches.map((match) => match.matchNumber)).size !== plan.matches.length) {
    errors.push("Match numbers are not unique.");
  }

  const incoming = new Map<string, number>();
  const adjacency = new Map<string, string[]>();
  for (const edge of plan.edges) {
    const source = matches.get(edge.sourceMatchKey);
    const target = matches.get(edge.targetMatchKey);
    if (!source || !target) {
      errors.push(`Edge references an unknown match (${edge.sourceMatchKey} -> ${edge.targetMatchKey}).`);
      continue;
    }
    if (edge.sourceMatchKey === edge.targetMatchKey) {
      errors.push(`Match ${edge.sourceMatchKey} cannot feed itself.`);
    }
    const slotId = `${edge.targetMatchKey}:${edge.targetSlot}`;
    incoming.set(slotId, (incoming.get(slotId) ?? 0) + 1);
    if ((incoming.get(slotId) ?? 0) > 1) errors.push(`Slot ${slotId} has multiple incoming feeds.`);
    if ((edge.feed ?? "winner") === "loser" && target.stage !== "third_place") {
      errors.push(`Loser feed into ${edge.targetMatchKey} is only valid for a third-place match.`);
    }
    if ((edge.feed ?? "winner") === "winner" && target.stage === "third_place") {
      errors.push(`Third-place match ${edge.targetMatchKey} must be fed by losing semifinalists.`);
    }
    if (source.roundKey === target.roundKey) {
      errors.push(`Progression from ${edge.sourceMatchKey} to ${edge.targetMatchKey} stays in the same round.`);
    }
    adjacency.set(edge.sourceMatchKey, [...(adjacency.get(edge.sourceMatchKey) ?? []), edge.targetMatchKey]);
  }

  // Cycle detection — a tournament graph must be a DAG.
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const hasCycle = (key: string): boolean => {
    if (visiting.has(key)) return true;
    if (visited.has(key)) return false;
    visiting.add(key);
    for (const next of adjacency.get(key) ?? []) {
      if (hasCycle(next)) return true;
    }
    visiting.delete(key);
    visited.add(key);
    return false;
  };
  if ([...adjacency.keys()].some(hasCycle)) errors.push("Tournament progression contains a cycle.");

  // A competitor may not occupy two first-round slots of the same stage.
  const firstRound = plan.rounds.find((round) => round.stage === "knockout");
  if (firstRound) {
    const seen = new Set<string>();
    for (const key of firstRound.matchKeys) {
      const match = matches.get(key);
      for (const entryId of [match?.slotA.entryId, match?.slotB.entryId]) {
        if (!entryId) continue;
        if (seen.has(entryId)) errors.push(`Competitor ${entryId} occupies multiple first-round slots.`);
        seen.add(entryId);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

export interface FlowBuildOptions {
  positions?: Record<string, { x: number; y: number }>;
  /** Hide entrant details in public/organiser views. */
  compact?: boolean;
}

/** Converts validated tournament data into VARSITY canvas nodes and edges. */
export function buildFlowGraph(
  plan: TournamentPlan,
  options: FlowBuildOptions = {},
): { nodes: CanvasNode[]; edges: CanvasEdge[] } {
  const nodes: CanvasNode[] = [];
  const edges: CanvasEdge[] = [];
  const roundOrder = new Map(plan.rounds.map((round) => [round.key, round.roundNumber]));
  const positionFor = (key: string, fallback: { x: number; y: number }) => options.positions?.[key] ?? fallback;

  plan.rounds.forEach((round) => {
    nodes.push({
      id: `round:${round.key}`,
      type: "roundNode",
      position: positionFor(`round:${round.key}`, { x: (round.roundNumber - 1) * 430, y: -110 }),
      data: { label: round.name.toUpperCase(), sublabel: round.groupKey ? round.groupKey.toUpperCase() : undefined, roundKey: round.key },
    });
  });

  const participantPositions = new Map<string, { x: number; y: number }>();
  plan.matches.forEach((match) => {
    const round = plan.rounds.find((item) => item.key === match.roundKey);
    const column = (round?.roundNumber ?? 1) - 1;
    const baseY = (match.matchNumber - 1) * 190;
    nodes.push({
      id: `match:${match.key}`,
      type: "matchNode",
      position: positionFor(`match:${match.key}`, { x: column * 430 + 160, y: baseY }),
      data: {
        label: match.isBye ? `M${match.matchNumber} · BYE` : `M${match.matchNumber}`,
        sublabel: match.venue ?? match.roundName,
        matchKey: match.key,
        roundKey: match.roundKey,
        status: "scheduled",
        winnerEntryId: match.byeWinnerEntryId,
        isBye: match.isBye,
        groupKey: match.groupKey,
      },
    });

    ([["a", match.slotA], ["b", match.slotB]] as const).forEach(([slotName, slot]) => {
      if (!slot.entryId || participantPositions.has(slot.entryId)) return;
      const position = positionFor(`participant:${slot.entryId}`, {
        x: column * 430 - 10,
        y: baseY + (slotName === "a" ? 8 : 78),
      });
      participantPositions.set(slot.entryId, position);
      nodes.push({
        id: `participant:${slot.entryId}`,
        type: "participantNode",
        position,
        data: {
          label: slot.fromBye ? `${slot.entryId} (BYE)` : slot.entryId,
          sublabel: slot.fromBye ? "Advanced by bye" : "Qualified competitor",
          entryId: slot.entryId,
          isBye: slot.fromBye,
        },
      });
      edges.push({
        id: `feed:${slot.entryId}:${match.key}:${slotName}`,
        source: `participant:${slot.entryId}`,
        target: `match:${match.key}`,
        type: "smoothstep",
        style: { stroke: "#3564E9", strokeWidth: 1.5 },
      });
    });
  });

  plan.edges.forEach((edge) => {
    const sourceRound = roundOrder.get(plan.matches.find((match) => match.key === edge.sourceMatchKey)?.roundKey ?? "") ?? 0;
    const targetRound = roundOrder.get(plan.matches.find((match) => match.key === edge.targetMatchKey)?.roundKey ?? "") ?? 0;
    edges.push({
      id: `progress:${edge.sourceMatchKey}:${edge.targetMatchKey}:${edge.targetSlot}`,
      source: `match:${edge.sourceMatchKey}`,
      target: `match:${edge.targetMatchKey}`,
      type: "smoothstep",
      animated: targetRound > sourceRound,
      label: (edge.feed ?? "winner") === "loser" ? "LOSER" : "WINNER",
      style: { stroke: "#C8F169", strokeWidth: 2 },
    });
  });

  return { nodes, edges };
}

/** Visual rearrangement must only save positions, never change pairings. */
export function extractNodePositions(
  nodes: Array<{ id: string; position: { x: number; y: number } }>,
): Record<string, { x: number; y: number }> {
  const positions: Record<string, { x: number; y: number }> = {};
  nodes.forEach((node) => {
    positions[node.id] = { x: Math.round(node.position.x), y: Math.round(node.position.y) };
  });
  return positions;
}
