/** Pure Connect Four rules — no persistence, transport or rendering. */
import type { Json } from "@/types/database";
import { num, opponent } from "../engine-utils";
import { completed, continued, rejected, type GameEngine, type Outcome } from "../types";

export const COLUMNS = 7;
export const ROWS = 6;
/** 0 = empty, 1 = player 0 (red), 2 = player 1 (yellow). */
export type Disc = 0 | 1 | 2;
export type ConnectFourBoard = Disc[][]; // [column][row], row 0 is the bottom

export interface ConnectFourState {
  version: number;
  seq: number;
  turn: 0 | 1 | null;
  status: "active" | "completed";
  outcome: Outcome | null;
  board: ConnectFourBoard;
  lastColumn: number | null;
}

export type ConnectFourConfig = Record<string, Json>;

export function emptyBoard(): ConnectFourBoard {
  return Array.from({ length: COLUMNS }, () => Array<Disc>(ROWS).fill(0));
}

export function landingRow(board: ConnectFourBoard, column: number): number {
  if (column < 0 || column >= COLUMNS) return -1;
  for (let row = 0; row < ROWS; row += 1) {
    if (board[column][row] === 0) return row;
  }
  return -1;
}

export function winningLine(board: ConnectFourBoard, column: number, row: number, disc: Disc): Array<[number, number]> | null {
  const directions: Array<[number, number]> = [[1, 0], [0, 1], [1, 1], [1, -1]];
  for (const [dx, dy] of directions) {
    const cells: Array<[number, number]> = [[column, row]];
    for (const sign of [1, -1]) {
      let x = column + dx * sign;
      let y = row + dy * sign;
      while (x >= 0 && x < COLUMNS && y >= 0 && y < ROWS && board[x][y] === disc) {
        cells.push([x, y]);
        x += dx * sign;
        y += dy * sign;
      }
    }
    if (cells.length >= 4) return cells.slice(0, 4);
  }
  return null;
}

export const connectFourEngine: GameEngine<ConnectFourState, ConnectFourConfig> = {
  slug: "connect-four",

  create(_config: ConnectFourConfig = {}) {
    return {
      version: 1,
      seq: 0,
      turn: 0,
      status: "active",
      outcome: null,
      board: emptyBoard(),
      lastColumn: null,
    };
  },

  turn(state) {
    return state.turn;
  },

  outcome(state) {
    return state.outcome;
  },

  legal(state, actor) {
    if (state.status !== "active" || state.turn !== actor) return [];
    const moves: string[] = [];
    for (let column = 0; column < COLUMNS; column += 1) {
      if (landingRow(state.board, column) >= 0) moves.push(String(column));
    }
    return moves;
  },

  apply(state, action, _config) {
    if (action.type === "rematch" || action.type === "reset") {
      if (state.status !== "completed") return rejected(state, "Only a finished game can be reset.");
      return {
        state: { ...connectFourEngine.create(), version: state.version + 1, seq: state.seq + 1 },
        events: [{ type: "rematch", message: "A fresh board is ready." }],
        accepted: true,
      };
    }
    if (action.type !== "drop") return rejected(state, "Unknown Connect Four action.");
    if (state.status !== "active") return rejected(state, "This match has already finished.");
    if (state.turn !== action.actor) return rejected(state, "It is not your turn.");

    const column = num(action.payload, "column", -1);
    if (!Number.isInteger(column) || column < 0 || column >= COLUMNS) {
      return rejected(state, "Choose a column from 1 to 7.");
    }
    const row = landingRow(state.board, column);
    if (row < 0) return rejected(state, "That column is full.");

    const disc: Disc = action.actor === 0 ? 1 : 2;
    const board = state.board.map((values) => [...values]);
    board[column][row] = disc;
    const colour = disc === 1 ? "Red" : "Yellow";
    const line = winningLine(board, column, row, disc);

    if (line) {
      return completed(
        state,
        { kind: "win", winner: action.actor, reason: `${colour} connected four.` },
        [
          { type: "drop", message: `${colour} dropped in column ${column + 1}.` },
          { type: "win", message: `${colour} connects four!`, data: { line: JSON.stringify(line) } },
        ],
        { board, lastColumn: column },
      );
    }

    const full = board.every((values) => values.every((value) => value !== 0));
    if (full) {
      return completed(
        state,
        { kind: "draw", winner: null, reason: "The board is full." },
        [
          { type: "drop", message: `${colour} dropped in column ${column + 1}.` },
          { type: "draw", message: "The match is a draw." },
        ],
        { board, lastColumn: column },
      );
    }

    return continued(
      state,
      [{ type: "drop", message: `${colour} dropped in column ${column + 1}.` }],
      { board, lastColumn: column, turn: opponent(action.actor) as 0 | 1 },
    );
  },

  toJson(state) {
    return state as unknown as Json;
  },

  fromJson(value) {
    return value as unknown as ConnectFourState;
  },
};
