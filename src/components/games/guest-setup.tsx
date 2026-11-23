"use client";

import { useState, useTransition } from "react";
import { Dices, Play, Users } from "lucide-react";
import { GameStage } from "@/components/games/game-stage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { randomGuestNameAction, prepareGuestMatchAction } from "@/app/(public)/games/actions";
import { gameConfigFor } from "@/lib/games/catalog";
import { engineFor } from "@/lib/games/registry";
import type { GameSlug, MatchMode } from "@/lib/games/types";
import type { Json } from "@/types/database";

interface GuestSetupProps {
  slug: GameSlug;
  gameName: string;
  initialMode: "local" | "practice";
  timeControls?: readonly string[];
}

export function GuestSetup({ slug, gameName, initialMode, timeControls = ["unlimited", "5", "10", "15"] }: GuestSetupProps) {
  const [mode, setMode] = useState<"local" | "practice">(initialMode);
  const [playerOne, setPlayerOne] = useState("");
  const [playerTwo, setPlayerTwo] = useState("");
  const [timeControl, setTimeControl] = useState("10");
  const [attempts, setAttempts] = useState(slug === "penalty-shootout" ? 5 : 10);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [session, setSession] = useState<{ names: [string, string]; config: Record<string, Json>; initialState: Json } | null>(null);

  const start = () => {
    setError(null);
    const config: Record<string, Json> = { ...gameConfigFor(slug) };
    if (slug === "chess") config.timeControl = timeControl;
    if (slug === "penalty-shootout" || slug === "basketball") config.attempts = attempts;
    startTransition(async () => {
      const response = await prepareGuestMatchAction({ gameSlug: slug, playerOne, playerTwo, mode, config });
      if (!response.ok || !response.names || !response.config) {
        setError(response.message ?? "Could not start the game.");
        return;
      }
      const finalConfig = response.config as Record<string, Json>;
      const initialState = engineFor(slug).toJson(engineFor(slug).create(finalConfig));
      setSession({ names: response.names, config: finalConfig, initialState });
    });
  };

  if (session) {
    const matchMode: MatchMode = mode === "practice" ? "practice" : "guest";
    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-navy/10 pb-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-cobalt">{gameName}</p>
            <h2 className="font-heading text-3xl font-bold uppercase tracking-tight text-navy">{mode === "practice" ? "Practice session" : "Local match"}</h2>
          </div>
          <Button variant="outline" size="sm" onClick={() => setSession(null)}>Change players</Button>
        </div>
        <GameStage
          slug={slug}
          mode={matchMode}
          names={session.names}
          config={session.config}
          initialState={session.initialState}
          notice={mode === "practice"
            ? "Practice runs locally on this device. Nothing is saved and no rating changes."
            : "Pass-and-play: both players share this screen. Guest games never affect student ratings, achievements or history."}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl border border-navy/10 bg-white p-6 shadow-sm md:p-8">
      <p className="font-heading text-sm font-bold uppercase tracking-[0.2em] text-cobalt">Set up your game</p>
      <h2 className="mt-2 font-heading text-3xl font-bold uppercase tracking-tight text-navy">Who is playing?</h2>

      <div className="mt-6 grid grid-cols-2 gap-2">
        {(["local", "practice"] as const).map((item) => (
          <button key={item} type="button" onClick={() => setMode(item)}
            className={`border px-4 py-3 text-left transition ${mode === item ? "border-navy bg-navy text-chalk" : "border-navy/20 bg-chalk/50 text-navy hover:border-navy"}`}>
            <span className="flex items-center gap-2 font-heading text-lg font-bold uppercase tracking-wide">
              {item === "local" ? <Users className="size-4" /> : <Play className="size-4" />}
              {item === "local" ? "Two players" : "Practice"}
            </span>
            <span className="mt-1 block text-[0.7rem] opacity-70">{item === "local" ? "Pass the screen" : "Local solo session"}</span>
          </button>
        ))}
      </div>

      <div className="mt-6 space-y-4">
        <div>
          <Label htmlFor="player-one">Player 1 name</Label>
          <div className="mt-1 flex gap-2">
            <Input id="player-one" value={playerOne} onChange={(event) => setPlayerOne(event.target.value)} maxLength={40} placeholder="Enter a name" />
            <Button type="button" variant="outline" size="icon" aria-label="Random name for player 1"
              onClick={() => void randomGuestNameAction(playerTwo).then(setPlayerOne)}><Dices className="size-4" /></Button>
          </div>
        </div>
        <div>
          <Label htmlFor="player-two">{mode === "practice" ? "Opponent name" : "Player 2 name"}</Label>
          <div className="mt-1 flex gap-2">
            <Input id="player-two" value={playerTwo} onChange={(event) => setPlayerTwo(event.target.value)} maxLength={40} placeholder="Enter a name" />
            <Button type="button" variant="outline" size="icon" aria-label="Random name for player 2"
              onClick={() => void randomGuestNameAction(playerOne).then(setPlayerTwo)}><Dices className="size-4" /></Button>
          </div>
        </div>

        {slug === "chess" ? (
          <div>
            <Label htmlFor="time-control">Clock</Label>
            <select id="time-control" value={timeControl} onChange={(event) => setTimeControl(event.target.value)}
              className="mt-1 w-full border border-input bg-white px-3 py-2 text-sm text-navy">
              {timeControls.map((control) => <option key={control} value={control}>{control === "unlimited" ? "Unlimited" : `${control} minutes`}</option>)}
            </select>
          </div>
        ) : null}
        {slug === "penalty-shootout" || slug === "basketball" ? (
          <div>
            <Label htmlFor="attempts">Attempts per player</Label>
            <Input id="attempts" type="number" min={1} max={slug === "penalty-shootout" ? 10 : 30} value={attempts}
              onChange={(event) => setAttempts(Number(event.target.value))} className="mt-1" />
          </div>
        ) : null}
      </div>

      {error ? <p className="mt-4 border-l-4 border-l-coral bg-coral/10 px-3 py-2 text-sm text-coral-dark">{error}</p> : null}

      <Button className="mt-6 w-full" size="lg" disabled={pending} onClick={start}>
        {pending ? "Starting…" : "Start game"}
      </Button>
      <p className="mt-4 text-xs leading-relaxed text-ink-muted">
        Guest and practice sessions are stored only in this browser tab. They never affect Elo ratings, leaderboards, achievements or verified student history.
      </p>
    </div>
  );
}
