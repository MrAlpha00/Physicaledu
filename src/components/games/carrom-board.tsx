"use client";

import { useState } from "react";
import { BoardShell } from "@/components/games/common";
import type { BoardProps } from "./board-types";
import { initialPieces, isLegalStrikerPlacement, legalStrikerZone, POCKETS, type CarromState } from "@/lib/games/engines/carrom";
import { cn } from "@/lib/utils";

export function CarromBoard({ state, names, active, onAction, disabled, lastMessage }: BoardProps<CarromState>) {
  const striker = state.pieces.find((piece) => piece.kind === "striker");
  const [placement, setPlacement] = useState<{ x: number; y: number } | null>(null);
  const [angleDeg, setAngleDeg] = useState(active === 1 ? 90 : -90);
  const [power, setPower] = useState(62);

  const actor = active ?? 0;
  const zone = legalStrikerZone(actor);
  const position = placement ?? (striker ? { x: striker.x, y: striker.y } : { x: 50, y: actor === 0 ? 82 : 18 });
  const legalPlacement = isLegalStrikerPlacement(state.pieces, position.x, position.y, actor);
  const radians = (angleDeg * Math.PI) / 180;
  const aimLength = 12 + power * 0.2;
  const aimEnd = {
    x: position.x + Math.cos(radians) * aimLength,
    y: position.y + Math.sin(radians) * aimLength,
  };
  const canShoot = !disabled && state.status === "active" && striker !== undefined && legalPlacement;

  const placeStriker = (event: React.MouseEvent<SVGSVGElement>) => {
    if (!canShoot) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    if (isLegalStrikerPlacement(state.pieces, x, y, actor)) setPlacement({ x, y });
  };

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4">
      <div className="grid grid-cols-2 gap-2">
        {([0, 1] as const).map((index) => (
          <div key={index} className={cn("border px-3 py-2", active === index ? "border-lime bg-lime/10" : "border-white/10")}>
            <p className="truncate text-[0.65rem] font-bold uppercase tracking-widest text-chalk/50">{names[index]}</p>
            <p className="font-heading text-3xl font-bold leading-none text-chalk">{state.scores[index]}</p>
          </div>
        ))}
      </div>

      <BoardShell className="bg-[#7b4a24] p-2">
        <svg viewBox="0 0 100 100" className="aspect-square size-full touch-none" onClick={placeStriker} role="img" aria-label="Carrom board">
          <rect x="2" y="2" width="96" height="96" fill="#a5652f" stroke="#e8c98f" strokeWidth="1.5" />
          <rect x="7" y="7" width="86" height="86" fill="none" stroke="#e8c98f" strokeWidth="0.5" opacity="0.6" />
          <rect x={actor === 0 ? 4 : 4} y={zone.min - 4} width="92" height={zone.max - zone.min + 8}
            fill="#c8f169" opacity="0.07" stroke="#c8f169" strokeWidth="0.4" />
          <path d="M50 12 L88 50 L50 88 L12 50 Z" fill="none" stroke="#e8c98f" strokeWidth="0.4" opacity="0.5" />
          {POCKETS.map((pocket, index) => <circle key={index} cx={pocket.x} cy={pocket.y} r="3.6" fill="#101d2c" stroke="#e8c98f" strokeWidth="0.5" />)}
          {canShoot ? (
            <line x1={position.x} y1={position.y} x2={aimEnd.x} y2={aimEnd.y}
              stroke="#c8f169" strokeWidth="0.8" strokeDasharray="2 1.5" markerEnd="url(#aim-arrow)" />
          ) : null}
          <defs>
            <marker id="aim-arrow" markerWidth="5" markerHeight="5" refX="4" refY="2.5" orient="auto">
              <path d="M0 0 L5 2.5 L0 5 Z" fill="#c8f169" />
            </marker>
          </defs>
          {state.pieces.filter((piece) => piece.kind !== "striker").map((piece) => (
            <circle key={piece.id} cx={piece.x} cy={piece.y} r={piece.kind === "queen" ? 2.3 : 2.1}
              fill={piece.kind === "queen" ? "#c8f169" : piece.id.endsWith("1") || piece.id.endsWith("3") || piece.id.endsWith("5") || piece.id.endsWith("7") || piece.id.endsWith("9") ? "#f4f2e9" : "#101d2c"}
              stroke="#3d2412" strokeWidth="0.4" />
          ))}
          {striker ? <circle cx={position.x} cy={position.y} r="2.8" fill="#3564e9" stroke="#f4f2e9" strokeWidth="0.6" /> : null}
        </svg>
      </BoardShell>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="border border-white/10 bg-white/5 p-4">
          <p className="text-xs font-bold uppercase tracking-widest text-chalk/70">Placement · {names[actor]}</p>
          <p className="mt-1 text-xs text-chalk/50">Tap a spot inside your half of the board to position the striker.</p>
          <label className="mt-3 block text-xs font-bold uppercase tracking-widest text-chalk/70">
            <span className="flex justify-between"><span>Aim angle</span><span className="text-lime">{angleDeg}°</span></span>
            <input type="range" min={-180} max={180} value={angleDeg} disabled={!canShoot}
              onChange={(event) => setAngleDeg(Number(event.target.value))} className="mt-1 w-full accent-[#c8f169]" />
          </label>
          <label className="mt-3 block text-xs font-bold uppercase tracking-widest text-chalk/70">
            <span className="flex justify-between"><span>Power</span><span className="text-lime">{power}</span></span>
            <input type="range" min={1} max={100} value={power} disabled={!canShoot}
              onChange={(event) => setPower(Number(event.target.value))} className="mt-1 w-full accent-[#c8f169]" />
          </label>
          <button type="button" disabled={!canShoot} onClick={() => {
            onAction("strike", { angle: radians, power, strikerX: position.x, strikerY: position.y });
            setPlacement(null);
          }} className="mt-4 w-full bg-coral px-4 py-3 text-xs font-bold uppercase tracking-widest text-navy hover:bg-lime disabled:opacity-40">
            Shoot
          </button>
        </div>
        <div className="border border-white/10 bg-white/5 p-4 text-xs leading-relaxed text-chalk/65">
          <p className="font-heading text-lg font-bold uppercase tracking-wide text-lime">Rules reminder</p>
          <ul className="mt-2 list-disc space-y-1 pl-4">
            <li>Pocket a coin to keep your turn.</li>
            <li>Cover the queen with a coin in the same shot to score 3.</li>
            <li>Pocketing the striker or hitting nothing is a foul.</li>
          </ul>
          {state.lastShot ? (
            <p className="mt-4 border-t border-white/10 pt-3">
              Last shot: {state.lastShot.foul ? `foul (${state.lastShot.foulReason})` : `${state.lastShot.pocketed.length} pocketed`} · {state.lastShot.points} points
            </p>
          ) : null}
        </div>
      </div>
      {lastMessage ? <p className="text-center text-sm text-lime">{lastMessage}</p> : null}
      {initialPieces().length > 0 && state.pieces.length === 0 ? <p className="text-center text-sm">Board cleared.</p> : null}
    </div>
  );
}
