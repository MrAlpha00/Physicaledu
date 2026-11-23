import { describe, expect, it } from "vitest";
import type { Json } from "@/types/database";
import type { GameAction, PlayerIndex } from "@/lib/games/types";
import { ticTacToeEngine, findWinner, type TicTacToeState } from "@/lib/games/engines/tic-tac-toe";
import { connectFourEngine, landingRow, type ConnectFourState } from "@/lib/games/engines/connect-four";
import { chessEngine, chessFromFen, type ChessState } from "@/lib/games/engines/chess";
import { penaltyEngine, resolvePenalty, type PenaltyState } from "@/lib/games/engines/penalty-shootout";
import { basketballEngine, resolveShot, shotQuality, type BasketballState } from "@/lib/games/engines/basketball";
import { carromEngine, initialPieces, isLegalStrikerPlacement, simulateShot, type CarromState } from "@/lib/games/engines/carrom";

function action(actor: PlayerIndex, seq: number, type: string, payload: Record<string, Json> = {}): GameAction {
  return { seq, expectedVersion: 1, actor, type, payload };
}

function playMoves<S extends { version: number; seq: number; status: string }>(
  engine: {
    apply(state: S, action: GameAction, config: never): { state: S; accepted: boolean };
  },
  state: S,
  moves: Array<[PlayerIndex, string, Record<string, Json>]>,
): S {
  let current = state;
  for (const [actor, type, payload] of moves) {
    const result = engine.apply(current, action(actor, current.seq + 1, type, payload), undefined as never);
    expect(result.accepted).toBe(true);
    current = result.state;
  }
  return current;
}

describe("Phase 5 — pure game engines", () => {
  it("Tic-Tac-Toe detects a win, a draw, and rejects illegal moves", () => {
    const state = ticTacToeEngine.create();
    expect(findWinner(["X", "X", "X", null, null, null, null, null, null])?.mark).toBe("X");

    const won = playMoves(ticTacToeEngine as never, state as TicTacToeState, [
      [0, "move", { cell: 0 }], [1, "move", { cell: 3 }],
      [0, "move", { cell: 1 }], [1, "move", { cell: 4 }],
      [0, "move", { cell: 2 }],
    ]);
    expect(won.status).toBe("completed");
    expect(won.outcome).toMatchObject({ kind: "win", winner: 0 });

    const drawn = playMoves(ticTacToeEngine as never, ticTacToeEngine.create(), [
      [0, "move", { cell: 0 }], [1, "move", { cell: 1 }],
      [0, "move", { cell: 2 }], [1, "move", { cell: 4 }],
      [0, "move", { cell: 3 }], [1, "move", { cell: 6 }],
      [0, "move", { cell: 5 }], [1, "move", { cell: 8 }],
      [0, "move", { cell: 7 }],
    ]);
    expect(drawn.outcome).toMatchObject({ kind: "draw", winner: null });

    const wrongTurn = ticTacToeEngine.apply(state, action(1, 1, "move", { cell: 0 }), {});
    expect(wrongTurn.accepted).toBe(false);
    const after = ticTacToeEngine.apply(state, action(0, 1, "move", { cell: 0 }), {}).state;
    const occupied = ticTacToeEngine.apply(after, action(1, 2, "move", { cell: 0 }), {});
    expect(occupied.accepted).toBe(false);
  });

  it("Connect Four enforces gravity, column capacity and vertical wins", () => {
    const empty = connectFourEngine.create();
    expect(landingRow(empty.board, 3)).toBe(0);
    const won = playMoves(connectFourEngine as never, empty, [
      [0, "drop", { column: 0 }], [1, "drop", { column: 1 }],
      [0, "drop", { column: 0 }], [1, "drop", { column: 1 }],
      [0, "drop", { column: 0 }], [1, "drop", { column: 2 }],
      [0, "drop", { column: 0 }],
    ]);
    expect(won.outcome).toMatchObject({ kind: "win", winner: 0 });
    expect(landingRow(won.board, 0)).toBe(-1);

    const fullColumn = connectFourEngine.apply(won, action(1, won.seq + 1, "drop", { column: 0 }), {});
    expect(fullColumn.accepted).toBe(false);
  });

  it("Chess delegates legal moves and checkmate to chess.js and supports promotion", () => {
    const mate = playMoves(chessEngine as never, chessEngine.create({}), [
      [0, "move", { from: "f2", to: "f3" }],
      [1, "move", { from: "e7", to: "e5" }],
      [0, "move", { from: "g2", to: "g4" }],
      [1, "move", { from: "d8", to: "h4" }],
    ]);
    expect(mate.outcome).toMatchObject({ kind: "win", winner: 1 });

    const promotionState: ChessState = {
      ...chessEngine.create({ timeControl: "unlimited" }),
      fen: "8/P7/8/8/8/8/8/K6k w - - 0 1",
    };
    const promoted = chessEngine.apply(promotionState, action(0, 1, "move", { from: "a7", to: "a8", promotion: "q" }), { timeControl: "unlimited" });
    expect(promoted.accepted).toBe(true);
    expect(promoted.state.fen).toContain("Q");
    expect(() => chessFromFen("not a fen")).toThrow();
  });

  it("Penalty Shootout hides choices before resolving and handles sudden death", () => {
    expect(resolvePenalty({ direction: "left", height: "low", power: 60 }, { direction: "left", height: "low" }, 0)).toBe(false);
    expect(resolvePenalty({ direction: "left", height: "low", power: 60 }, { direction: "right", height: "high" }, 0)).toBe(true);

    let state = penaltyEngine.create({ attempts: 1, suddenDeath: false });
    let step = penaltyEngine.apply(state, action(0, 1, "shoot", { direction: "left", height: "low", power: 60 }), {});
    expect(step.accepted).toBe(true);
    expect(step.state.current.shot).not.toBeNull();
    expect(step.state.current.save).toBeNull();
    expect(step.state.status).toBe("active");
    step = penaltyEngine.apply(step.state, action(1, 2, "save", { direction: "right", height: "high" }), {});
    expect(step.state.outcome).toMatchObject({ kind: "win", winner: 0 });

    const duplicate = penaltyEngine.apply(state, action(0, 1, "shoot", { direction: "center", height: "low", power: 60 }), {});
    expect(duplicate.accepted).toBe(true);
    const keeperWrongRole = penaltyEngine.apply(duplicate.state, action(0, 2, "save", { direction: "left", height: "low" }), {});
    expect(keeperWrongRole.accepted).toBe(false);
    expect((state as PenaltyState).turn).toBeNull();
  });

  it("Basketball computes shots on the server and rejects impossible parameters", () => {
    expect(shotQuality(52, 72, 50)).toBeGreaterThan(0.9);
    expect(resolveShot(0, 52, 72, 50)).toBe(true);
    expect(resolveShot(0, 30, 1, 0)).toBe(false);

    const state = basketballEngine.create({ attempts: 1, suddenDeath: false });
    const invalid = basketballEngine.apply(state, action(0, 1, "shoot", { angle: 12, power: 72, timing: 50 }), {});
    expect(invalid.accepted).toBe(false);

    const first = basketballEngine.apply(state, action(0, 1, "shoot", { angle: 52, power: 72, timing: 50 }), {});
    const second = basketballEngine.apply(first.state, action(1, 2, "shoot", { angle: 30, power: 1, timing: 0 }), {});
    expect(second.state.outcome).toMatchObject({ kind: "win", winner: 0 });
    expect(second.state.scores).toEqual([1, 0]);
    expect((second.state as BasketballState).shots).toHaveLength(2);
  });

  it("Carrom simulation is deterministic and striker placement is bounded", () => {
    const pieces = initialPieces();
    expect(pieces).toHaveLength(11);
    expect(isLegalStrikerPlacement(pieces, 50, 82, 0)).toBe(true);
    expect(isLegalStrikerPlacement(pieces, 50, 20, 0)).toBe(false);
    expect(isLegalStrikerPlacement(pieces, 50, 82, 1)).toBe(false);

    const first = simulateShot(pieces, -Math.PI / 2, 64);
    const second = simulateShot(pieces, -Math.PI / 2, 64);
    expect(first).toEqual(second);
    expect(first.hitAny).toBe(true);

    const state = carromEngine.create({ queenValue: 3, coinValue: 1 });
    const illegal = carromEngine.apply(state, action(0, 1, "strike", { angle: -Math.PI / 2, power: 64, strikerX: 50, strikerY: 20 }), {});
    expect(illegal.accepted).toBe(false);
    const legal = carromEngine.apply(state, action(0, 1, "strike", { angle: -Math.PI / 2, power: 64, strikerX: 50, strikerY: 82 }), {});
    expect(legal.accepted).toBe(true);
    expect((legal.state as CarromState).shotCount).toBe(1);
  });
});
