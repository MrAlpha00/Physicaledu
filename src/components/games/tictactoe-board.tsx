"use client";

import { BoardShell } from "@/components/games/common";
import type { BoardProps } from "./board-types";
import type { Mark, TicTacToeState } from "@/lib/games/engines/tic-tac-toe";
import { cn } from "@/lib/utils";

const LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];

function winningCells(state: TicTacToeState): number[] {
  for (const line of LINES) {
    const [a, b, c] = line;
    if (state.board[a] && state.board[a] === state.board[b] && state.board[a] === state.board[c]) return line;
  }
  return [];
}

export function TicTacToeBoard({ state, active, onAction, disabled, names }: BoardProps<TicTacToeState>) {
  const winners = winningCells(state);
  const mark: Mark = active === 1 ? "O" : "X";

  return (
    <div className="mx-auto w-full max-w-lg">
      <div className="mb-3 flex items-center justify-between gap-3 text-xs font-bold uppercase tracking-widest">
        <span className={cn(active === 0 ? "text-lime" : "text-chalk/45")}>{names[0]} · X</span>
        <span className="text-chalk/60">{state.status === "completed" ? "Finished" : `${mark} to play`}</span>
        <span className={cn(active === 1 ? "text-lime" : "text-chalk/45")}>{names[1]} · O</span>
      </div>
      <BoardShell className="aspect-square">
        <div className="grid size-full grid-cols-3 grid-rows-3 gap-1 bg-navy p-1">
          {state.board.map((cell, index) => (
            <button
              key={index}
              type="button"
              disabled={disabled || cell !== null || state.status === "completed"}
              onClick={() => onAction("move", { cell: index })}
              aria-label={`Square ${index + 1}${cell ? `, ${cell}` : ", empty"}`}
              className={cn(
                "flex min-h-[4.5rem] items-center justify-center bg-chalk font-heading text-5xl font-bold text-navy transition sm:text-6xl",
                cell === null && !disabled && state.status === "active" ? "hover:bg-lime" : "",
                winners.includes(index) ? "bg-lime" : "",
              )}
            >
              {cell ?? <span className="text-2xl text-navy/15">·</span>}
            </button>
          ))}
        </div>
      </BoardShell>
    </div>
  );
}
