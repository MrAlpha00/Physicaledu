"use client";

import { useMemo, useState } from "react";
import { BoardShell } from "@/components/games/common";
import type { BoardProps } from "./board-types";
import { chessFromFen, legalChessMoves, timeControlMs, type ChessState } from "@/lib/games/engines/chess";
import { cn } from "@/lib/utils";
import type { Json } from "@/types/database";

const GLYPHS: Record<string, Record<string, string>> = {
  w: { k: "♔", q: "♕", r: "♖", b: "♗", n: "♘", p: "♙" },
  b: { k: "♚", q: "♛", r: "♜", b: "♝", n: "♞", p: "♟" },
};
const FILES = "abcdefgh";
const PROMOTIONS: Array<{ key: string; label: string }> = [
  { key: "q", label: "Queen" }, { key: "r", label: "Rook" }, { key: "b", label: "Bishop" }, { key: "n", label: "Knight" },
];

export function ChessBoard({ state, active, onAction, disabled, names }: BoardProps<ChessState>) {
  const [selected, setSelected] = useState<string | null>(null);
  const [promotion, setPromotion] = useState<{ from: string; to: string } | null>(null);
  const chess = useMemo(() => chessFromFen(state.fen), [state.fen]);
  const board = chess.board();
  const moves = useMemo(() => (disabled ? [] : legalChessMoves(state)), [state, disabled]);
  const destinations = moves.filter((move) => move.from === selected).map((move) => move.to as string);
  const inCheck = chess.inCheck();

  const handleSquare = (square: string) => {
    if (disabled || state.status === "completed" || promotion) return;
    if (selected && destinations.includes(square)) {
      const move = moves.find((item) => item.from === selected && item.to === square);
      if (move?.promotion) {
        setPromotion({ from: selected, to: square });
      } else {
        onAction("move", { from: selected, to: square, now: Date.now() });
        setSelected(null);
      }
      return;
    }
    const piece = chess.get(square as never);
    if (piece && piece.color === (active === 0 ? "w" : "b")) setSelected(square);
    else setSelected(null);
  };

  const clocked = timeControlMs(state.timeControl) !== null;
  const format = (ms: number) => {
    const total = Math.max(0, Math.ceil(ms / 1000));
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
  };

  return (
    <div className="mx-auto w-full max-w-2xl">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs font-bold uppercase tracking-widest">
        <span className={cn(active === 0 ? "text-lime" : "text-chalk/45")}>
          {names[0]} · White {clocked ? `(${format(state.clocksMs[0])})` : ""}
        </span>
        <span className={inCheck ? "text-coral" : "text-chalk/60"}>
          {inCheck ? "Check!" : state.status === "completed" ? "Finished" : "Your move"}
        </span>
        <span className={cn(active === 1 ? "text-lime" : "text-chalk/45")}>
          {names[1]} · Black {clocked ? `(${format(state.clocksMs[1])})` : ""}
        </span>
      </div>
      <BoardShell className="aspect-square">
        <div className="grid size-full grid-cols-8 grid-rows-8">
          {board.map((rank, rowIndex) =>
            rank.map((piece, columnIndex) => {
              const square = `${FILES[columnIndex]}${8 - rowIndex}`;
              const light = (rowIndex + columnIndex) % 2 === 0;
              const isSelected = selected === square;
              const isDestination = destinations.includes(square);
              return (
                <button
                  key={square}
                  type="button"
                  onClick={() => handleSquare(square)}
                  aria-label={`${square}${piece ? ` ${piece.color === "w" ? "white" : "black"} ${piece.type}` : ""}`}
                  className={cn(
                    "relative flex min-h-0 items-center justify-center text-2xl leading-none sm:text-4xl md:text-5xl",
                    light ? "bg-[#e8dfc8]" : "bg-[#76914a]",
                    isSelected ? "!bg-[#f4d35e]" : "",
                    isDestination ? "after:absolute after:inset-[35%] after:rounded-full after:bg-cobalt/40 after:content-['']" : "",
                  )}
                >
                  <span className={piece?.color === "w" ? "text-[#f8f6ef] drop-shadow-[0_1px_1px_rgba(0,0,0,0.6)]" : "text-[#1a1a1a]"}>
                    {piece ? GLYPHS[piece.color][piece.type] : ""}
                  </span>
                  {rowIndex === 7 ? <span className="absolute bottom-0 right-0.5 text-[0.5rem] font-bold text-navy/60">{FILES[columnIndex]}</span> : null}
                  {columnIndex === 0 ? <span className="absolute left-0.5 top-0 text-[0.5rem] font-bold text-navy/60">{8 - rowIndex}</span> : null}
                </button>
              );
            }),
          )}
        </div>
        {promotion ? (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-navy/80 text-chalk">
            <p className="font-heading text-xl font-bold uppercase tracking-wide">Promote to</p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {PROMOTIONS.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => {
                    onAction("move", { from: promotion.from, to: promotion.to, promotion: item.key, now: Date.now() } as Record<string, Json>);
                    setPromotion(null);
                    setSelected(null);
                  }}
                  className="border border-lime bg-chalk px-3 py-2 font-heading text-xs font-bold uppercase tracking-wide text-navy hover:bg-lime"
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </BoardShell>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-chalk/60">
        <span>{state.history.length} moves played · {state.timeControl} min clock</span>
        {!disabled && state.status === "active" ? (
          <button type="button" onClick={() => onAction("offerDraw", { now: Date.now() })} className="underline hover:text-lime">
            Offer draw
          </button>
        ) : null}
      </div>
    </div>
  );
}
