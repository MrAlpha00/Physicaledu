/** Pure Tic-Tac-Toe rules — no persistence, transport or rendering. */
import type { Json } from "@/types/database";
import { num, opponent } from "../engine-utils";
import {
  completed,
  continued,
  rejected,
  type GameEngine,
  type Outcome,
  type PlayerIndex,
} from "../types";

export type Mark = "X" | "O";
export interface TicTacToeState {
  version: number;
  seq: number;
  turn: PlayerIndex | null;
  status: "active" | "completed";
  outcome: Outcome | null;
  board: Array<Mark | null>;
  moveCount: number;
}

export type TicTacToeConfig = Record<string, Json>;

const LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
] as const;

export function markFor(player: PlayerIndex): Mark {
  return player === 0 ? "X" : "O";
}

export function findWinner(board: Array<Mark | null>): { mark: Mark; line: readonly number[] } | null {
  for (const line of LINES) {
    const [a, b, c] = line;
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return { mark: board[a] as Mark, line };
    }
  }
  return null;
}

export const ticTacToeEngine: GameEngine<TicTacToeState, TicTacToeConfig> = {
  slug: "tic-tac-toe",

  create(_config: TicTacToeConfig = {}) {
    return {
      version: 1,
      seq: 0,
      turn: 0,
      status: "active",
      outcome: null,
      board: Array(9).fill(null),
      moveCount: 0,
    };
  },

  turn(state) {
    return state.turn;
  },

  outcome(state) {
    return state.outcome;
  },

  canAct(state, actor, action) {
    if (action.type === "reset" || action.type === "rematch") return true;
    return state.turn === actor;
  },

  legal(state, actor) {
    if (state.status !== "active" || state.turn !== actor) return [];
    return state.board.flatMap((cell, index) => (cell === null ? [String(index)] : []));
  },

  apply(state, action, _config) {
    if (action.type === "rematch" || action.type === "reset") {
      if (state.status !== "completed") return rejected(state, "Only a finished game can be reset.");
      return {
        state: { ...ticTacToeEngine.create({}), version: state.version + 1, seq: state.seq + 1 },
        events: [{ type: "rematch", message: "A fresh board is ready." }],
        accepted: true,
      };
    }
    if (action.type !== "move") return rejected(state, "Unknown Tic-Tac-Toe action.");
    if (state.status !== "active") return rejected(state, "This match has already finished.");
    if (state.turn !== action.actor) return rejected(state, "It is not your turn.");

    const cell = num(action.payload, "cell", -1);
    if (!Number.isInteger(cell) || cell < 0 || cell > 8) return rejected(state, "Choose a square on the board.");
    if (state.board[cell] !== null) return rejected(state, "That square is already taken.");

    const mark = markFor(action.actor);
    const board = [...state.board];
    board[cell] = mark;
    const winner = findWinner(board);

    if (winner) {
      return completed(
        state,
        { kind: "win", winner: winner.mark === "X" ? 0 : 1, reason: `${mark} completed a line.` },
        [
          { type: "move", message: `${mark} played square ${cell + 1}.` },
          { type: "win", message: `${mark} wins!`, data: { line: winner.line.join(",") } },
        ],
        { board, moveCount: state.moveCount + 1 },
      );
    }

    if (board.every((value) => value !== null)) {
      return completed(
        state,
        { kind: "draw", winner: null, reason: "The board is full." },
        [
          { type: "move", message: `${mark} played square ${cell + 1}.` },
          { type: "draw", message: "The match is a draw." },
        ],
        { board, moveCount: state.moveCount + 1 },
      );
    }

    return continued(
      state,
      [{ type: "move", message: `${mark} played square ${cell + 1}.` }],
      { board, moveCount: state.moveCount + 1, turn: opponent(action.actor) },
    );
  },

  toJson(state) {
    return state as unknown as Json;
  },

  fromJson(value) {
    return value as unknown as TicTacToeState;
  },
};
