"use client";

import { useState } from "react";
import { BoardShell } from "@/components/games/common";
import type { BoardProps } from "./board-types";
import { landingRow, ROWS, type ConnectFourState } from "@/lib/games/engines/connect-four";
import { cn } from "@/lib/utils";

export function ConnectFourBoard({ state, active, onAction, disabled, names }: BoardProps<ConnectFourState>) {
  const [preview, setPreview] = useState<number | null>(null);

  return (
    <div className="mx-auto w-full max-w-2xl">
      <div className="mb-3 flex items-center justify-between gap-3 text-xs font-bold uppercase tracking-widest">
        <span className={cn(active === 0 ? "text-coral" : "text-chalk/45")}>{names[0]} · Red</span>
        <span className="text-chalk/60">{state.status === "completed" ? "Finished" : "Drop a disc"}</span>
        <span className={cn(active === 1 ? "text-lime" : "text-chalk/45")}>{names[1]} · Yellow</span>
      </div>
      <BoardShell className="p-2">
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: 7 }, (_, column) => (
            <button
              key={`header-${column}`}
              type="button"
              disabled={disabled || landingRow(state.board, column) < 0 || state.status === "completed"}
              onMouseEnter={() => setPreview(column)}
              onMouseLeave={() => setPreview(null)}
              onClick={() => onAction("drop", { column })}
              aria-label={`Drop in column ${column + 1}`}
              className="flex h-8 items-center justify-center rounded-sm bg-chalk/10 text-[0.6rem] font-bold text-chalk/60 transition hover:bg-lime hover:text-navy disabled:opacity-30"
            >
              {column + 1}
            </button>
          ))}
          {Array.from({ length: ROWS }, (_, rowIndex) => {
            const row = ROWS - 1 - rowIndex;
            return Array.from({ length: 7 }, (_, column) => {
              const disc = state.board[column][row];
              const canPreview = preview === column && landingRow(state.board, column) === row && !disabled && state.status === "active";
              const isLast = state.lastColumn === column;
              return (
                <button
                  key={`${column}-${row}`}
                  type="button"
                  disabled={disabled || state.status === "completed" || landingRow(state.board, column) !== row}
                  onClick={() => onAction("drop", { column })}
                  aria-label={`Column ${column + 1}, row ${row + 1}`}
                  className={cn(
                    "relative aspect-square min-h-[2.5rem] rounded-full border-2 border-navy/60 transition",
                    disc === 1 ? "bg-coral" : disc === 2 ? "bg-lime" : "bg-chalk",
                    canPreview ? (active === 0 ? "!bg-coral/50" : "!bg-lime/50") : "",
                    isLast && disc !== 0 ? "ring-2 ring-white/70" : "",
                  )}
                >
                  {disc === 0 ? <span className="absolute inset-2 rounded-full bg-navy/80" /> : null}
                </button>
              );
            });
          })}
        </div>
      </BoardShell>
      <p className="mt-3 text-center text-xs text-chalk/50">Tap a column or its number to drop your disc.</p>
    </div>
  );
}
