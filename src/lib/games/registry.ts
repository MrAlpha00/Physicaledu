/** Uniform engine registry used by the authoritative match service. */
import type { BaseState, GameEngine, GameSlug } from "./types";
import { chessEngine } from "./engines/chess";
import { carromEngine } from "./engines/carrom";
import { ticTacToeEngine } from "./engines/tic-tac-toe";
import { connectFourEngine } from "./engines/connect-four";
import { penaltyEngine } from "./engines/penalty-shootout";
import { basketballEngine } from "./engines/basketball";

export type AnyGameState = BaseState;
export type AnyGameConfig = Record<string, import("@/types/database").Json>;

export const GAME_ENGINES = {
  chess: chessEngine,
  carrom: carromEngine,
  "tic-tac-toe": ticTacToeEngine,
  "connect-four": connectFourEngine,
  "penalty-shootout": penaltyEngine,
  basketball: basketballEngine,
} as unknown as Record<GameSlug, GameEngine<AnyGameState, AnyGameConfig>>;

export function engineFor(slug: GameSlug): GameEngine<AnyGameState, AnyGameConfig> {
  return GAME_ENGINES[slug];
}

export { chessEngine, carromEngine, ticTacToeEngine, connectFourEngine, penaltyEngine, basketballEngine };
