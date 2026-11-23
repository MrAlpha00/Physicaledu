"use client";

import { useState, useTransition } from "react";
import { Search, Send, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createChallengeAction, searchOpponentsAction } from "@/app/(student)/games/actions";
import { GAME_LIST } from "@/lib/games/catalog";
import type { GameSlug } from "@/lib/games/types";

interface Opponent {
  userId: string;
  gamingName: string;
  departmentName: string | null;
}

export function ChallengeForm({ defaultSlug }: { defaultSlug?: GameSlug }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Opponent[]>([]);
  const [selected, setSelected] = useState<Opponent | null>(null);
  const [slug, setSlug] = useState<GameSlug>(defaultSlug ?? "chess");
  const [message, setMessage] = useState("");
  const [timeControl, setTimeControl] = useState("10");
  const [status, setStatus] = useState<{ ok: boolean; message: string } | null>(null);
  const [searching, startSearch] = useTransition();
  const [sending, startSend] = useTransition();

  const search = () => {
    setStatus(null);
    startSearch(async () => {
      const response = await searchOpponentsAction(query);
      if (!response.ok) setStatus({ ok: false, message: response.message ?? "Search failed." });
      setResults(response.results);
    });
  };

  const send = () => {
    setStatus(null);
    if (!selected) {
      setStatus({ ok: false, message: "Choose an opponent from the search results." });
      return;
    }
    const formData = new FormData();
    formData.set("gameSlug", slug);
    formData.set("opponentId", selected.userId);
    formData.set("message", message);
    if (slug === "chess") formData.set("timeControl", timeControl);
    startSend(async () => {
      const response = await createChallengeAction({ ok: false, message: "" }, formData);
      setStatus({ ok: response.ok, message: response.message });
      if (response.ok) {
        setSelected(null);
        setResults([]);
        setMessage("");
      }
    });
  };

  return (
    <div className="space-y-6 border border-navy/10 bg-white p-6">
      <div>
        <Label htmlFor="challenge-game">Game</Label>
        <select id="challenge-game" value={slug} onChange={(event) => setSlug(event.target.value as GameSlug)}
          className="mt-1 w-full border border-input bg-white px-3 py-2 text-sm text-navy">
          {GAME_LIST.map((game) => <option key={game.slug} value={game.slug}>{game.name}</option>)}
        </select>
      </div>
      {slug === "chess" ? (
        <div>
          <Label htmlFor="challenge-clock">Clock</Label>
          <select id="challenge-clock" value={timeControl} onChange={(event) => setTimeControl(event.target.value)}
            className="mt-1 w-full border border-input bg-white px-3 py-2 text-sm text-navy">
            <option value="unlimited">Unlimited</option><option value="5">5 minutes</option><option value="10">10 minutes</option><option value="15">15 minutes</option>
          </select>
        </div>
      ) : null}

      <div>
        <Label htmlFor="opponent-search">Find an opponent</Label>
        <div className="mt-1 flex gap-2">
          <Input id="opponent-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by gaming name" minLength={2} maxLength={40}
            onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); search(); } }} />
          <Button variant="outline" size="icon" aria-label="Search opponents" disabled={searching} onClick={search}><Search className="size-4" /></Button>
        </div>
        <p className="mt-1 text-xs text-ink-muted">Only students who opted into public search appear here. USNs and email addresses are never exposed.</p>
      </div>

      {results.length ? (
        <div className="max-h-56 space-y-2 overflow-y-auto border border-navy/10 p-2">
          {results.map((opponent) => (
            <button key={opponent.userId} type="button" onClick={() => setSelected(opponent)}
              className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm transition ${selected?.userId === opponent.userId ? "bg-lime text-navy" : "bg-chalk/50 text-navy hover:bg-chalk"}`}>
              <span className="flex items-center gap-2"><UserCheck className="size-4" />{opponent.gamingName}</span>
              <span className="text-xs opacity-70">{opponent.departmentName ?? "Verified student"}</span>
            </button>
          ))}
        </div>
      ) : null}
      {selected ? <p className="text-sm font-semibold text-navy">Selected: {selected.gamingName}</p> : null}

      <div>
        <Label htmlFor="challenge-message">Message (optional)</Label>
        <textarea id="challenge-message" value={message} onChange={(event) => setMessage(event.target.value)} maxLength={240} rows={3}
          className="mt-1 w-full border border-input bg-white px-3 py-2 text-sm text-navy" placeholder="Good luck!" />
      </div>

      {status ? <p className={`text-sm ${status.ok ? "text-[#33521b]" : "text-coral-dark"}`}>{status.message}</p> : null}

      <Button className="w-full" disabled={sending} onClick={send}><Send className="size-4" /> {sending ? "Sending…" : "Send invitation"}</Button>
    </div>
  );
}
