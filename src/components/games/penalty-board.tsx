"use client";

import { useState } from "react";
import { BoardShell } from "@/components/games/common";
import type { BoardProps } from "./board-types";
import type { Direction, Height, PenaltyState } from "@/lib/games/engines/penalty-shootout";
import { cn } from "@/lib/utils";

const DIRECTIONS: Direction[] = ["left", "center", "right"];
const HEIGHTS: Height[] = ["low", "high"];

export function PenaltyBoard({ state, names, active, onAction, disabled, viewer, lastMessage }: BoardProps<PenaltyState>) {
  const [direction, setDirection] = useState<Direction>("center");
  const [height, setHeight] = useState<Height>("low");
  const [power, setPower] = useState(68);
  const [saveDirection, setSaveDirection] = useState<Direction>("center");
  const [saveHeight, setSaveHeight] = useState<Height>("low");

  const attacker = state.current.attacker;
  const shooterRole = attacker;
  const keeperRole = attacker === 0 ? 1 : 0;
  const canShoot = !disabled && (viewer === undefined || viewer === null || viewer === shooterRole) && state.current.shot === null;
  const canSave = !disabled && (viewer === undefined || viewer === null || viewer === keeperRole) && state.current.save === null;
  const last = state.history[state.history.length - 1];

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4">
      <div className="grid grid-cols-2 gap-2">
        <div className={cn("border px-3 py-2", active === 0 ? "border-lime bg-lime/10" : "border-white/10")}>
          <p className="text-[0.65rem] font-bold uppercase tracking-widest text-chalk/50">{names[0]}</p>
          <p className="font-heading text-3xl font-bold leading-none text-chalk">{state.scores[0]}</p>
        </div>
        <div className={cn("border px-3 py-2 text-right", active === 1 ? "border-lime bg-lime/10" : "border-white/10")}>
          <p className="text-[0.65rem] font-bold uppercase tracking-widest text-chalk/50">{names[1]}</p>
          <p className="font-heading text-3xl font-bold leading-none text-chalk">{state.scores[1]}</p>
        </div>
      </div>

      <BoardShell className="p-3">
        <div className="relative aspect-[16/9] w-full overflow-hidden bg-gradient-to-b from-[#2f6fb0] to-[#1b4b7d]">
          <div className="absolute inset-x-[8%] bottom-[8%] top-[14%] border-2 border-white/70 bg-white/5">
            <div className="grid size-full grid-cols-3 grid-rows-2">
              {HEIGHTS.flatMap((row) => DIRECTIONS.map((column) => {
                const chosen = last && last.shot?.direction === column && last.shot?.height === row;
                return (
                  <div key={`${row}-${column}`} className="flex items-center justify-center border border-white/15">
                    {chosen ? (
                      <span className={cn("text-4xl", last?.goal ? "text-lime" : "text-coral")}>{last?.goal ? "●" : "✕"}</span>
                    ) : null}
                  </div>
                );
              }))}
            </div>
          </div>
          <div className="absolute bottom-[4%] left-1/2 -translate-x-1/2 text-[0.6rem] font-bold uppercase tracking-[0.3em] text-white/60">
            {state.phase === "sudden" ? "Sudden death" : `Attempt ${state.history.length + 1} of ${state.attempts * 2}`}
          </div>
        </div>
      </BoardShell>

      <div className="grid gap-3 md:grid-cols-2">
        <div className={cn("border p-4", canShoot ? "border-lime/60 bg-lime/10" : "border-white/10 bg-white/5")}>
          <p className="font-heading text-lg font-bold uppercase tracking-wide text-lime">Shooter · {names[shooterRole]}</p>
          <p className="mt-1 text-xs text-chalk/60">{state.current.shot ? "Shot locked. Waiting for the keeper." : "Choose your shot — hidden until both are in."}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {DIRECTIONS.map((item) => (
              <button key={item} type="button" disabled={!canShoot} onClick={() => setDirection(item)}
                className={cn("border px-3 py-1.5 text-xs font-bold uppercase tracking-wide", direction === item ? "border-lime bg-lime text-navy" : "border-white/25 text-chalk")}>
                {item}
              </button>
            ))}
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {HEIGHTS.map((item) => (
              <button key={item} type="button" disabled={!canShoot} onClick={() => setHeight(item)}
                className={cn("border px-3 py-1.5 text-xs font-bold uppercase tracking-wide", height === item ? "border-lime bg-lime text-navy" : "border-white/25 text-chalk")}>
                {item}
              </button>
            ))}
          </div>
          <label className="mt-3 block text-xs font-bold uppercase tracking-widest text-chalk/60">
            Power · {power}
            <input type="range" min={1} max={100} value={power} disabled={!canShoot}
              onChange={(event) => setPower(Number(event.target.value))} className="mt-1 w-full accent-[#c8f169]" />
          </label>
          <button type="button" disabled={!canShoot} onClick={() => onAction("shoot", { direction, height, power })}
            className="mt-3 w-full bg-lime px-4 py-2 text-xs font-bold uppercase tracking-widest text-navy disabled:opacity-40">
            {state.current.shot ? "Shot locked" : "Take the penalty"}
          </button>
        </div>

        <div className={cn("border p-4", canSave ? "border-cobalt bg-cobalt/15" : "border-white/10 bg-white/5")}>
          <p className="font-heading text-lg font-bold uppercase tracking-wide text-[#9bb6ff]">Keeper · {names[keeperRole]}</p>
          <p className="mt-1 text-xs text-chalk/60">{state.current.save ? "Dive locked. Waiting for the shooter." : "Pick a dive before the shot is revealed."}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {DIRECTIONS.map((item) => (
              <button key={item} type="button" disabled={!canSave} onClick={() => setSaveDirection(item)}
                className={cn("border px-3 py-1.5 text-xs font-bold uppercase tracking-wide", saveDirection === item ? "border-cobalt bg-cobalt text-white" : "border-white/25 text-chalk")}>
                {item}
              </button>
            ))}
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {HEIGHTS.map((item) => (
              <button key={item} type="button" disabled={!canSave} onClick={() => setSaveHeight(item)}
                className={cn("border px-3 py-1.5 text-xs font-bold uppercase tracking-wide", saveHeight === item ? "border-cobalt bg-cobalt text-white" : "border-white/25 text-chalk")}>
                {item}
              </button>
            ))}
          </div>
          <button type="button" disabled={!canSave} onClick={() => onAction("save", { direction: saveDirection, height: saveHeight })}
            className="mt-3 w-full bg-cobalt px-4 py-2 text-xs font-bold uppercase tracking-widest text-white disabled:opacity-40">
            {state.current.save ? "Dive locked" : "Commit dive"}
          </button>
        </div>
      </div>
      {lastMessage ? <p className="text-center text-sm text-lime">{lastMessage}</p> : null}
      {last ? <p className="text-center text-xs text-chalk/50">Last attempt: {last.goal ? "goal" : "saved"} · {last.shot?.direction} {last.shot?.height}</p> : null}
    </div>
  );
}
