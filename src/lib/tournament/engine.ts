import {
  DEFAULT_POINTS,
  directSlot,
  emptySlot,
  type GeneratedGroup,
  type GeneratedMatch,
  type GeneratedRound,
  type TournamentEntry,
  type TournamentGenerationOptions,
  type TournamentPlan,
  type TournamentProgressionEdge,
  type TournamentSlot,
} from "./types";

/** Deterministic PRNG (mulberry32) — the seed is persisted with the draw. */
export function createRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function nextPowerOfTwo(value: number): number {
  if (value <= 1) return 1;
  let size = 1;
  while (size < value) size *= 2;
  return size;
}

/** Standard seeded bracket order: 1vLast, then the middle seeds. */
export function seededOrder(size: number): number[] {
  let order = [1];
  while (order.length < size) {
    const next: number[] = [];
    const count = order.length;
    for (const seed of order) {
      next.push(seed);
      next.push(2 * count + 1 - seed);
    }
    order = next;
  }
  return order;
}

export function roundName(participantCount: number): string {
  switch (participantCount) {
    case 2:
      return "Final";
    case 4:
      return "Semifinal";
    case 8:
      return "Quarterfinal";
    case 16:
      return "Round of 16";
    case 32:
      return "Round of 32";
    case 64:
      return "Round of 64";
    default:
      return `Round of ${participantCount}`;
  }
}

/**
 * Resolves the entry order for a draw. Manual order must contain every entry
 * exactly once; seeded draws never invent rankings for unseeded entries.
 */
export function orderEntries(
  entries: TournamentEntry[],
  drawMode: TournamentGenerationOptions["drawMode"],
  drawSeed: number,
  manualOrder?: string[],
): TournamentEntry[] {
  if (drawMode === "manual") {
    if (!manualOrder || manualOrder.length !== entries.length) {
      throw new Error("Manual draw requires exactly one position for every entry.");
    }
    const byId = new Map(entries.map((entry) => [entry.entryId, entry]));
    if (new Set(manualOrder).size !== manualOrder.length) {
      throw new Error("Manual draw contains a duplicate entry position.");
    }
    return manualOrder.map((id) => {
      const entry = byId.get(id);
      if (!entry) throw new Error(`Manual draw references unknown entry ${id}.`);
      return entry;
    });
  }

  if (drawMode === "seeded") {
    const seeded = entries.filter((entry) => typeof entry.seed === "number");
    const unseeded = entries.filter((entry) => typeof entry.seed !== "number");
    const sortedSeeded = [...seeded].sort((a, b) => {
      const difference = (a.seed ?? 0) - (b.seed ?? 0);
      return difference !== 0 ? difference : a.entryId.localeCompare(b.entryId);
    });
    const random = createRandom(drawSeed);
    const shuffledUnseeded = shuffle(unseeded, random);
    return [...sortedSeeded, ...shuffledUnseeded];
  }

  return shuffle(entries, createRandom(drawSeed));
}

export function shuffle<T>(items: T[], random: () => number): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

/** Distributes entries across bracket positions, leaving bye gaps for a non power-of-two field. */
export function placeKnockoutEntries(
  entries: TournamentEntry[],
  size: number,
  drawMode: TournamentGenerationOptions["drawMode"],
  drawSeed: number,
  manualOrder?: string[],
): Array<TournamentEntry | null> {
  const ordered = orderEntries(entries, drawMode, drawSeed, manualOrder);
  const positions: Array<TournamentEntry | null> = Array.from({ length: size }, () => null);

  if (drawMode === "seeded" && ordered.some((entry) => typeof entry.seed === "number")) {
    const order = seededOrder(size);
    ordered.forEach((entry, index) => {
      positions[order[index] - 1] = entry;
    });
    let cursor = 0;
    for (let index = 0; index < size; index += 1) {
      if (!positions[index]) {
        while (cursor < ordered.length && positions.includes(ordered[cursor])) cursor += 1;
        positions[index] = ordered[cursor] ?? null;
        cursor += 1;
      }
    }
  } else {
    ordered.forEach((entry, index) => {
      const position = Math.floor((index * size) / ordered.length);
      positions[position] = entry;
    });
  }

  return positions;
}

interface BracketBuild {
  matches: GeneratedMatch[];
  rounds: GeneratedRound[];
  edges: TournamentProgressionEdge[];
  finalMatchKey: string | null;
  semifinalKeys: string[];
}

function buildBracket(
  participants: Array<TournamentEntry | null>,
  options: TournamentGenerationOptions,
  keyPrefix = "m",
): BracketBuild {
  const size = nextPowerOfTwo(participants.length);
  const slots = [...participants];
  while (slots.length < size) slots.push(null);
  if (slots.length === 1) slots.push(null);

  const matches: GeneratedMatch[] = [];
  const rounds: GeneratedRound[] = [];
  const edges: TournamentProgressionEdge[] = [];
  const matchKeysByRound: string[][] = [];
  let roundIndex = 1;
  let matchCounter = 1;

  let currentSlots = slots;
  while (currentSlots.length > 1) {
    const roundKey = `r${roundIndex}`;
    const entrantCount = currentSlots.length;
    const roundMatchKeys: string[] = [];

    for (let index = 0; index < currentSlots.length; index += 2) {
      const left = currentSlots[index] ?? null;
      const right = currentSlots[index + 1] ?? null;
      if (!left && !right) continue;

      const key = `${keyPrefix}${matchCounter}`;
      matchCounter += 1;
      roundMatchKeys.push(key);
      const isBye = !left || !right;
      const advancing = (left ?? right) as TournamentEntry;
      const match: GeneratedMatch = {
        key,
        matchNumber: matches.length + 1,
        roundKey,
        roundName: roundName(entrantCount),
        stage: "knockout",
        groupKey: null,
        slotA: left ? directSlot(left.entryId) : emptySlot(),
        slotB: right ? directSlot(right.entryId) : emptySlot(),
        isBye,
        byeWinnerEntryId: isBye ? advancing.entryId : null,
        scheduledAt: null,
        venue: null,
      };
      matches.push(match);
    }

    rounds.push({
      key: roundKey,
      name: roundName(entrantCount),
      roundNumber: roundIndex,
      stage: "knockout",
      groupKey: null,
      matchKeys: roundMatchKeys,
    });
    matchKeysByRound.push(roundMatchKeys);

    const nextSlots: Array<TournamentEntry | null> = [];
    for (let index = 0; index < roundMatchKeys.length; index += 2) {
      const sourceKey = roundMatchKeys[index];
      const sourceMatch = matches.find((match) => match.key === sourceKey);
      if (sourceMatch?.isBye && sourceMatch.byeWinnerEntryId) {
        nextSlots.push({ entryId: sourceMatch.byeWinnerEntryId, seed: null, label: "" });
      } else {
        nextSlots.push(null);
      }
    }
    currentSlots = nextSlots;
    roundIndex += 1;
  }

  // Progression is derived from the authoritative round structure. A match
  // always feeds the corresponding slot of the next round's match.
  for (let index = 0; index < matchKeysByRound.length - 1; index += 1) {
    const sourceKeys = matchKeysByRound[index];
    const targetKeys = matchKeysByRound[index + 1];
    targetKeys.forEach((targetKey, targetIndex) => {
      const sourceA = sourceKeys[targetIndex * 2];
      const sourceB = sourceKeys[targetIndex * 2 + 1];
      if (!sourceA || !sourceB) return;
      const targetMatch = matches.find((match) => match.key === targetKey);
      if (!targetMatch) return;
      targetMatch.slotA = { ...targetMatch.slotA, sourceMatchKey: sourceA };
      targetMatch.slotB = { ...targetMatch.slotB, sourceMatchKey: sourceB };
      edges.push({ sourceMatchKey: sourceA, targetMatchKey: targetKey, targetSlot: "a" });
      edges.push({ sourceMatchKey: sourceB, targetMatchKey: targetKey, targetSlot: "b" });
    });
  }

  // Bye winners are known before any ball is bowled; carry them through the
  // slot metadata so the canvas and advancement service stay consistent.
  const matchByKey = new Map(matches.map((match) => [match.key, match]));
  for (const match of matches) {
    for (const [slot, sourceKey] of [
      [match.slotA, match.slotA.sourceMatchKey],
      [match.slotB, match.slotB.sourceMatchKey],
    ] as Array<[TournamentSlot, string | null]>) {
      if (!sourceKey) continue;
      const source = matchByKey.get(sourceKey);
      if (source?.isBye && source.byeWinnerEntryId) {
        slot.entryId = source.byeWinnerEntryId;
        slot.fromBye = true;
      }
    }
  }

  if (options.thirdPlace) {
    const semifinalKeys = rounds.find((round) => round.name === "Semifinal")?.matchKeys ?? [];
    if (semifinalKeys.length === 2) {
      const key = `${keyPrefix}third`;
      matches.push({
        key,
        matchNumber: matches.length + 1,
        roundKey: "third",
        roundName: "Third Place",
        stage: "third_place",
        groupKey: null,
        slotA: { ...emptySlot(), sourceMatchKey: semifinalKeys[0] },
        slotB: { ...emptySlot(), sourceMatchKey: semifinalKeys[1] },
        isBye: false,
        byeWinnerEntryId: null,
        scheduledAt: null,
        venue: null,
      });
      rounds.push({
        key: "third",
        name: "Third Place",
        roundNumber: rounds.length + 1,
        stage: "third_place",
        groupKey: null,
        matchKeys: [key],
      });
      edges.push({
        sourceMatchKey: semifinalKeys[0],
        targetMatchKey: key,
        targetSlot: "a",
        feed: "loser",
      });
      edges.push({
        sourceMatchKey: semifinalKeys[1],
        targetMatchKey: key,
        targetSlot: "b",
        feed: "loser",
      });
    }
  }

  return {
    matches,
    rounds,
    edges,
    finalMatchKey: matches.find((match) => match.roundName === "Final")?.key ?? null,
    semifinalKeys: rounds.find((round) => round.name === "Semifinal")?.matchKeys ?? [],
  };
}

export function buildRoundRobin(
  entries: TournamentEntry[],
  options: TournamentGenerationOptions,
  groupKey: string | null = null,
  keyPrefix = "rr",
): { matches: GeneratedMatch[]; rounds: GeneratedRound[] } {
  const rotation = [...entries];
  if (rotation.length % 2 !== 0) rotation.push(null as unknown as TournamentEntry);
  const total = rotation.length;
  const matches: GeneratedMatch[] = [];
  const rounds: GeneratedRound[] = [];
  let counter = 1;

  for (let round = 0; round < total - 1; round += 1) {
    const roundKey = `${keyPrefix}-r${round + 1}`;
    const matchKeys: string[] = [];
    for (let index = 0; index < total / 2; index += 1) {
      const left = rotation[index];
      const right = rotation[total - 1 - index];
      if (!left || !right) continue;
      const key = `${keyPrefix}${counter}`;
      counter += 1;
      matchKeys.push(key);
      matches.push({
        key,
        matchNumber: matches.length + 1,
        roundKey,
        roundName: groupKey ? `Matchday ${round + 1}` : `Round ${round + 1}`,
        stage: groupKey ? "group" : "league",
        groupKey,
        slotA: directSlot(left.entryId),
        slotB: directSlot(right.entryId),
        isBye: false,
        byeWinnerEntryId: null,
        scheduledAt: null,
        venue: null,
      });
    }
    rounds.push({
      key: roundKey,
      name: groupKey ? `Matchday ${round + 1}` : `Round ${round + 1}`,
      roundNumber: round + 1,
      stage: groupKey ? "group" : "league",
      groupKey,
      matchKeys,
    });
    const fixed = rotation[0];
    rotation[0] = rotation[total - 1];
    rotation[total - 1] = fixed;
    for (let index = 1; index < total - 1; index += 1) {
      rotation[index] = rotation[index + 1] ?? rotation[index];
    }
  }

  if ((options.legs ?? 1) > 1) {
    const firstLeg = [...matches];
    firstLeg.forEach((match, index) => {
      const key = `${keyPrefix}2-${index + 1}`;
      matches.push({
        ...match,
        key,
        matchNumber: matches.length + 1,
        slotA: { ...match.slotB },
        slotB: { ...match.slotA },
      });
      const targetRound = rounds.find((round) => round.key === match.roundKey);
      targetRound?.matchKeys.push(key);
    });
  }

  return { matches, rounds };
}

export function generateTournament(options: TournamentGenerationOptions): TournamentPlan {
  if (!options.entries.length) {
    throw new Error("At least one approved entry is required to generate a tournament.");
  }
  if (new Set(options.entries.map((entry) => entry.entryId)).size !== options.entries.length) {
    throw new Error("A tournament cannot contain the same entry twice.");
  }
  if (options.format === "group_knockout" && !(options.groupCount && options.groupCount > 1)) {
    throw new Error("Group stage tournaments require at least two groups.");
  }

  const drawMode = options.drawMode ?? "random";
  const drawSeed = options.drawSeed ?? 20270101;
  const points = options.points ?? DEFAULT_POINTS;
  const generatedAt = options.generatedAt ?? new Date().toISOString();
  const ordered = orderEntries(options.entries, drawMode, drawSeed, options.manualOrder);

  if (options.format === "round_robin") {
    const { matches, rounds } = buildRoundRobin(ordered, options);
    return {
      format: options.format,
      drawMode,
      drawSeed,
      version: options.version ?? 1,
      generatedAt,
      bracketSize: ordered.length,
      groups: [],
      rounds,
      matches,
      edges: [],
      points,
      thirdPlace: false,
      qualifiersPerGroup: 0,
      legs: options.legs ?? 1,
    };
  }

  if (options.format === "group_knockout") {
    const groupCount = Math.min(options.groupCount ?? 2, ordered.length);
    const groups: GeneratedGroup[] = Array.from({ length: groupCount }, (_, index) => ({
      key: `g${index + 1}`,
      name: `Group ${String.fromCharCode(65 + index)}`,
      entryIds: [],
    }));
    ordered.forEach((entry, index) => groups[index % groupCount].entryIds.push(entry.entryId));
    const byId = new Map(ordered.map((entry) => [entry.entryId, entry]));
    const matches: GeneratedMatch[] = [];
    const rounds: GeneratedRound[] = [];

    groups.forEach((group) => {
      const groupEntries = group.entryIds.map((id) => byId.get(id)!);
      const built = buildRoundRobin(groupEntries, { ...options, legs: 1 }, group.key, `${group.key}-rr`);
      matches.push(...built.matches);
      rounds.push(...built.rounds);
    });

    const qualifiersPerGroup = Math.max(1, options.qualifiersPerGroup ?? 1);
    const qualifiers: TournamentEntry[] = [];
    groups.forEach((group) => {
      for (let rank = 1; rank <= qualifiersPerGroup; rank += 1) {
        qualifiers.push({
          entryId: `qualifier:${group.key}:${rank}`,
          label: `${group.name} qualifier ${rank}`,
          seed: rank,
        });
      }
    });

    const bracket = buildBracket(qualifiers, { ...options, drawMode: "manual", manualOrder: qualifiers.map((q) => q.entryId), thirdPlace: options.thirdPlace });
    return {
      format: options.format,
      drawMode,
      drawSeed,
      version: options.version ?? 1,
      generatedAt,
      bracketSize: nextPowerOfTwo(qualifiers.length),
      groups,
      rounds: [...rounds, ...bracket.rounds],
      matches: [...matches, ...bracket.matches],
      edges: bracket.edges,
      points,
      thirdPlace: options.thirdPlace ?? false,
      qualifiersPerGroup,
      legs: options.legs ?? 1,
    };
  }

  const bracket = buildBracket(ordered, options);
  return {
    format: options.format,
    drawMode,
    drawSeed,
    version: options.version ?? 1,
    generatedAt,
    bracketSize: nextPowerOfTwo(ordered.length),
    groups: [],
    rounds: bracket.rounds,
    matches: bracket.matches,
    edges: bracket.edges,
    points,
    thirdPlace: options.thirdPlace ?? false,
    qualifiersPerGroup: 0,
    legs: options.legs ?? 1,
  };
}

/** Serves manual pairings: each array entry is a pair of entry ids (or a null bye). */
export function generateManualKnockout(
  entries: TournamentEntry[],
  pairings: Array<[string | null, string | null]>,
  options: TournamentGenerationOptions = { format: "knockout", entries: [] },
): TournamentPlan {
  const byId = new Map(entries.map((entry) => [entry.entryId, entry]));
  const firstRound: Array<TournamentEntry | null> = [];
  pairings.forEach(([left, right]) => {
    firstRound.push(left ? (byId.get(left) ?? null) : null);
    firstRound.push(right ? (byId.get(right) ?? null) : null);
  });
  const bracket = buildBracket(firstRound, { ...options, drawMode: "manual" });
  return {
    format: "knockout",
    drawMode: "manual",
    drawSeed: options.drawSeed ?? 0,
    version: options.version ?? 1,
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    bracketSize: nextPowerOfTwo(firstRound.length),
    groups: [],
    rounds: bracket.rounds,
    matches: bracket.matches,
    edges: bracket.edges,
    points: options.points ?? DEFAULT_POINTS,
    thirdPlace: options.thirdPlace ?? false,
    qualifiersPerGroup: 0,
    legs: 1,
  };
}
