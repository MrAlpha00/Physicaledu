/**
 * Chess engine adapter. All rules (legal moves, check, checkmate, stalemate,
 * draws, castling, en passant and promotion) are delegated to the maintained
 * chess.js rules library. This module is the only authoritative entry point.
 */
import { Chess, type Square } from "chess.js";
import type { Json } from "@/types/database";
import { num, opponent, str } from "../engine-utils";
import { completed, continued, rejected, type GameEngine, type Outcome } from "../types";

export type ChessTimeControl = "unlimited" | "5" | "10" | "15";
export interface ChessConfig extends Record<string, Json> {
  timeControl?: ChessTimeControl;
}

export interface ChessState {
  version: number;
  seq: number;
  turn: 0 | 1 | null;
  status: "active" | "completed";
  outcome: Outcome | null;
  fen: string;
  history: string[];
  lastMove: { from: string; to: string } | null;
  timeControl: ChessTimeControl;
  clocksMs: [number, number];
  lastActionAt: string;
  drawOffers: number[];
}

const SQUARE = /^[a-h][1-8]$/;

export function chessFromFen(fen: string): Chess {
  return new Chess(fen);
}

export function timeControlMs(control: ChessTimeControl): number | null {
  if (control === "unlimited") return null;
  const minutes = Number(control);
  return Number.isFinite(minutes) && minutes > 0 ? minutes * 60_000 : null;
}

export function legalChessMoves(state: ChessState) {
  const chess = chessFromFen(state.fen);
  return chess.moves({ verbose: true });
}

function positionOutcome(chess: Chess): Outcome | null {
  const mover = chess.turn() === "w" ? 0 : 1;
  if (chess.isCheckmate()) {
    return { kind: "win", winner: opponent(mover as 0 | 1), reason: "Checkmate." };
  }
  if (chess.isStalemate()) return { kind: "draw", winner: null, reason: "Stalemate." };
  if (chess.isInsufficientMaterial()) return { kind: "draw", winner: null, reason: "Insufficient material." };
  if (chess.isThreefoldRepetition()) return { kind: "draw", winner: null, reason: "Threefold repetition." };
  if (chess.isDrawByFiftyMoves()) return { kind: "draw", winner: null, reason: "Fifty-move rule." };
  if (chess.isDraw()) return { kind: "draw", winner: null, reason: "Draw by engine rules." };
  return null;
}

/** Applies the configured clock to the player who just acted. */
function applyClock(state: ChessState, actor: 0 | 1, now: number | null): { clocks: [number, number]; flag: boolean } {
  const total = timeControlMs(state.timeControl);
  if (total === null) return { clocks: state.clocksMs, flag: false };
  if (now === null) return { clocks: state.clocksMs, flag: false };
  const previous = Date.parse(state.lastActionAt);
  const elapsed = Number.isFinite(previous) ? Math.max(0, now - previous) : 0;
  const clocks: [number, number] = [...state.clocksMs];
  clocks[actor] = Math.max(0, clocks[actor] - elapsed);
  return { clocks, flag: clocks[actor] <= 0 };
}

export const chessEngine: GameEngine<ChessState, ChessConfig> = {
  slug: "chess",

  create(config) {
    const control: ChessTimeControl =
      config.timeControl === "5" || config.timeControl === "10" || config.timeControl === "15" || config.timeControl === "unlimited"
        ? config.timeControl
        : "10";
    const total = timeControlMs(control);
    return {
      version: 1,
      seq: 0,
      turn: 0,
      status: "active",
      outcome: null,
      fen: new Chess().fen(),
      history: [],
      lastMove: null,
      timeControl: control,
      clocksMs: total === null ? [0, 0] : [total, total],
      lastActionAt: new Date().toISOString(),
      drawOffers: [],
    };
  },

  turn(state) {
    if (state.status !== "active") return null;
    try {
      return chessFromFen(state.fen).turn() === "w" ? 0 : 1;
    } catch {
      return state.turn;
    }
  },

  outcome(state) {
    return state.outcome;
  },

  legal(state, actor) {
    if (state.status !== "active" || chessEngine.turn(state) !== actor) return [];
    return legalChessMoves(state).map((move) => `${move.from}>${move.to}${move.promotion ?? ""}`);
  },

  apply(state, action, _config) {
    if (action.type === "rematch") {
      if (state.status !== "completed") return rejected(state, "Only a finished game can be reset.");
      return {
        state: { ...chessEngine.create({ timeControl: state.timeControl }), version: state.version + 1, seq: state.seq + 1 },
        events: [{ type: "rematch", message: "A fresh chess match is ready." }],
        accepted: true,
      };
    }

    if (state.status !== "active") return rejected(state, "This match has already finished.");

    if (action.type === "resign" || action.type === "timeout") {
      if (action.actor !== chessEngine.turn(state)) return rejected(state, "Only the player to move can concede.");
      const winner = opponent(action.actor as 0 | 1);
      return completed(
        state,
        {
          kind: "win",
          winner,
          reason: action.type === "resign" ? "Resignation." : "Time forfeited.",
        },
        [{ type: action.type, message: action.type === "resign" ? "Player resigned." : "Flag fall — time forfeited." }],
      );
    }

    if (action.type === "offerDraw") {
      if (action.actor !== chessEngine.turn(state)) return rejected(state, "Only the player to move may offer a draw.");
      const offers = [...new Set([...state.drawOffers, action.actor])];
      if (offers.length >= 2) {
        return completed(
          state,
          { kind: "draw", winner: null, reason: "Draw by mutual agreement." },
          [{ type: "draw", message: "Draw agreed." }],
          { drawOffers: offers },
        );
      }
      return continued(state, [{ type: "draw_offer", message: "A draw was offered." }], { drawOffers: offers });
    }

    if (action.type === "declineDraw") {
      return continued(state, [{ type: "draw_declined", message: "The draw offer was declined." }], { drawOffers: [] });
    }

    if (action.type !== "move") return rejected(state, "Unknown chess action.");
    if (action.actor !== chessEngine.turn(state)) return rejected(state, "It is not your turn.");

    const from = str(action.payload, "from");
    const to = str(action.payload, "to");
    const promotionRaw = str(action.payload, "promotion", "");
    if (!SQUARE.test(from) || !SQUARE.test(to)) return rejected(state, "Enter a valid board square.");
    const promotion = ["q", "r", "b", "n"].includes(promotionRaw) ? promotionRaw : undefined;

    const chess = chessFromFen(state.fen);
    let san: string;
    try {
      const move = chess.move({ from: from as Square, to: to as Square, promotion });
      san = move.san;
    } catch {
      return rejected(state, "That move is not legal in this position.");
    }

    const now = action.payload.now !== undefined ? num(action.payload, "now") : null;
    const { clocks, flag } = applyClock(state, action.actor as 0 | 1, now);
    const clockPatch = { clocksMs: clocks, lastActionAt: now !== null ? new Date(now).toISOString() : state.lastActionAt };
    const basePatch = {
      fen: chess.fen(),
      history: [...state.history, san],
      lastMove: { from, to },
      drawOffers: [],
      ...clockPatch,
    };

    if (flag) {
      return completed(
        state,
        { kind: "win", winner: opponent(action.actor as 0 | 1), reason: "Time forfeited." },
        [{ type: "move", message: `${san} — flag fall.` }],
        basePatch,
      );
    }

    const positionOutcomeValue = positionOutcome(chess);
    if (positionOutcomeValue) {
      return completed(
        state,
        positionOutcomeValue,
        [
          { type: "move", message: san },
          { type: positionOutcomeValue.kind === "win" ? "checkmate" : "draw", message: positionOutcomeValue.reason },
        ],
        basePatch,
      );
    }

    return continued(state, [{ type: "move", message: san }], {
      ...basePatch,
      turn: opponent(action.actor as 0 | 1),
    });
  },

  toJson(state) {
    return state as unknown as Json;
  },

  fromJson(value) {
    return value as unknown as ChessState;
  },
};
