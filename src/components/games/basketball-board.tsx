"use client";

import { useEffect, useState } from "react";
import { BoardShell } from "@/components/games/common";
import type { BoardProps } from "./board-types";
import { shotQuality, type BasketballState } from "@/lib/games/engines/basketball";
import { cn } from "@/lib/utils";

export function BasketballBoard({ state, names, active, onAction, disabled, lastMessage }: BoardProps<BasketballState>) {
  const [angle, setAngle] = useState(52);
  const [power, setPower] = useState(72);
  const [timing, setTiming] = useState(50);
  const [flight, setFlight] = useState(0);

  const last = state.lastShot;
  useEffect(() => {
    if (last) setFlight((value) => value + 1);
  }, [last?.index, last]);

  const quality = Math.round(shotQuality(angle, power, timing) * 100);
  const control = Math.round(-60 + (100 - power) * 1.6 + Math.abs(angle - 52) * 1.4);
  const path = `M 36 210 Q 200 ${control} 364 64`;
  const canShoot = !disabled && state.status === "active";

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4">
      <div className="grid grid-cols-2 gap-2">
        {([0, 1] as const).map((index) => {
          const taken = state.shots.filter((shot) => shot.actor === index).length;
          return (
            <div key={index} className={cn("border px-3 py-2", active === index ? "border-lime bg-lime/10" : "border-white/10")}>
              <p className="truncate text-[0.65rem] font-bold uppercase tracking-widest text-chalk/50">{names[index]}</p>
              <p className="font-heading text-3xl font-bold leading-none text-chalk">{state.scores[index]}</p>
              <p className="text-[0.65rem] text-chalk/50">{taken}/{state.attempts} shots {state.phase === "sudden" ? "· sudden death" : ""}</p>
            </div>
          );
        })}
      </div>

      <BoardShell className="bg-[#b9703f] p-0">
        <svg viewBox="0 0 400 240" className="size-full" role="img" aria-label="Basketball free-throw lane">
          <rect width="400" height="240" fill="#b9703f" />
          <path d="M0 40 L400 40 M0 220 L400 220 M60 40 L60 220 M340 40 L340 220 M60 130 A140 140 0 0 0 340 130" stroke="#f4f2e9" strokeWidth="2" fill="none" opacity="0.65" />
          <rect x="150" y="18" width="60" height="46" fill="none" stroke="#f4f2e9" strokeWidth="4" />
          <ellipse cx="180" cy="64" rx="18" ry="5" fill="none" stroke="#f4f2e9" strokeWidth="3" />
          <path d={path} fill="none" stroke="#c8f169" strokeWidth="2" strokeDasharray="6 6" opacity={canShoot ? 0.85 : 0.35} />
          <circle cx="36" cy="210" r="11" fill="#f27a5c" stroke="#101d2c" strokeWidth="2" />
          {last ? (
            <g key={flight}>
              <circle r="9" fill="#f27a5c" stroke="#101d2c" strokeWidth="2">
                <animateMotion dur="0.75s" fill="freeze" path={path} />
              </circle>
            </g>
          ) : null}
          <text x="200" y="234" textAnchor="middle" fill="#f4f2e9" fontSize="10" letterSpacing="2">
            FREE THROW · VARSITY COURT
          </text>
        </svg>
      </BoardShell>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="border border-white/10 bg-white/5 p-4">
          {[
            { label: "Angle", hint: "30° – 75°", value: angle, min: 30, max: 75, set: setAngle },
            { label: "Power", hint: "1 – 100", value: power, min: 1, max: 100, set: setPower },
            { label: "Release timing", hint: "0 – 100", value: timing, min: 0, max: 100, set: setTiming },
          ].map((controlItem) => (
            <label key={controlItem.label} className="mb-3 block text-xs font-bold uppercase tracking-widest text-chalk/70">
              <span className="flex justify-between"><span>{controlItem.label}</span><span className="text-lime">{controlItem.value}</span></span>
              <input
                type="range" min={controlItem.min} max={controlItem.max} value={controlItem.value}
                disabled={!canShoot}
                onChange={(event) => controlItem.set(Number(event.target.value))}
                className="mt-1 w-full accent-[#c8f169]"
              />
              <span className="text-[0.6rem] font-normal normal-case tracking-normal text-chalk/40">{controlItem.hint}</span>
            </label>
          ))}
          <button type="button" disabled={!canShoot} onClick={() => onAction("shoot", { angle, power, timing })}
            className="w-full bg-coral px-4 py-3 text-xs font-bold uppercase tracking-widest text-navy transition hover:bg-lime disabled:opacity-40">
            {canShoot ? `Shoot · ${names[active ?? 0]}` : "Waiting for turn"}
          </button>
        </div>
        <div className="flex flex-col justify-between border border-white/10 bg-white/5 p-4">
          <div>
            <p className="text-[0.65rem] font-bold uppercase tracking-widest text-chalk/50">Shot quality</p>
            <p className="font-heading text-5xl font-bold leading-none text-lime">{quality}%</p>
            <p className="mt-2 text-xs leading-relaxed text-chalk/60">
              Angle, power and release timing are submitted as an intent. The server calculates the result from the same deterministic model — the preview is guidance, not authority.
            </p>
          </div>
          <div className="mt-4 space-y-1 text-xs text-chalk/70">
            {state.shots.slice(-5).map((shot) => (
              <p key={shot.index}>
                <span className="font-bold">{names[shot.actor]}</span> · shot {shot.index + 1} · {shot.made ? "made" : "missed"}
              </p>
            ))}
          </div>
        </div>
      </div>
      {lastMessage ? <p className="text-center text-sm text-lime">{lastMessage}</p> : null}
    </div>
  );
}
