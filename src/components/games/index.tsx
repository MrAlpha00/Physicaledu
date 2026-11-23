"use client";

import { BasketballBoard } from "./basketball-board";
import { CarromBoard } from "./carrom-board";
import { ChessBoard } from "./chess-board";
import { ConnectFourBoard } from "./connectfour-board";
import { PenaltyBoard } from "./penalty-board";
import { TicTacToeBoard } from "./tictactoe-board";
import { engineFor } from "@/lib/games/registry";
import type { GameSlug, PlayerIndex } from "@/lib/games/types";
import type { Json } from "@/types/database";

export interface GameBoardProps {
  slug: GameSlug;
  state: Json;
  names: [string, string];
  active: PlayerIndex | null;
  onAction: (type: string, payload: Record<string, Json>) => void;
  disabled?: boolean;
  lastMessage?: string;
  viewer?: PlayerIndex | null;
}

export function GameBoard({ slug, state, names, active, onAction, disabled, lastMessage, viewer }: GameBoardProps) {
  if (!slug) return null;
  const typed = engineFor(slug).fromJson(state);
  const shared = { names, active, onAction, disabled, lastMessage, viewer };

  switch (slug) {
    case "chess":
      return <ChessBoard {...shared} state={typed as never} />;
    case "carrom":
      return <CarromBoard {...shared} state={typed as never} />;
    case "tic-tac-toe":
      return <TicTacToeBoard {...shared} state={typed as never} />;
    case "connect-four":
      return <ConnectFourBoard {...shared} state={typed as never} />;
    case "penalty-shootout":
      return <PenaltyBoard {...shared} state={typed as never} />;
    case "basketball":
      return <BasketballBoard {...shared} state={typed as never} />;
    default:
      return null;
  }
}
