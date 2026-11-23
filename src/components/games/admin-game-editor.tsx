"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveGameAction, saveSettingsAction } from "@/app/(admin)/admin/games/actions";
import type { Phase5GameRow, Phase5GameSettingsRow } from "@/types/database";

const CHECKS: Array<{ name: string; label: string }> = [
  { name: "isEnabled", label: "Game enabled" },
  { name: "guestEnabled", label: "Guest play" },
  { name: "competitiveEnabled", label: "Ranked play" },
  { name: "challengeEnabled", label: "Challenges" },
  { name: "practiceEnabled", label: "Practice" },
  { name: "leaderboardVisible", label: "Leaderboard visible" },
];

function textLines(value: unknown): string {
  return Array.isArray(value) ? value.map((item) => String(item)).join("\n") : "";
}

export function AdminGameEditor({ game, settings }: { game: Phase5GameRow; settings: Phase5GameSettingsRow | null }) {
  const [status, setStatus] = useState<{ ok: boolean; message: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const run = (formData: FormData, action: typeof saveGameAction | typeof saveSettingsAction) => {
    setStatus(null);
    startTransition(async () => {
      const response = await action({ ok: false, message: "" }, formData);
      setStatus({ ok: response.ok, message: response.message });
    });
  };

  return (
    <details className="group border border-navy/10 bg-white">
      <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-3 px-5 py-4 font-heading text-2xl font-bold uppercase tracking-wide text-navy hover:bg-chalk/60">
        <span>{game.short_name} · {game.name}</span>
        <span className="text-xs font-bold uppercase tracking-widest text-ink-muted">{game.is_enabled ? "Enabled" : "Disabled"} · {game.slug}</span>
      </summary>
      <div className="grid gap-6 border-t border-navy/10 p-5 lg:grid-cols-2">
        <form action={(formData) => { formData.set("gameSlug", game.slug); run(formData, saveGameAction); }} className="space-y-3">
          <h3 className="font-heading text-xl font-bold uppercase tracking-wide text-cobalt">Catalog & instructions</h3>
          <Input type="hidden" name="gameSlug" value={game.slug} />
          <div className="grid gap-3 sm:grid-cols-2">
            <div><Label htmlFor={`name-${game.slug}`}>Name</Label><Input id={`name-${game.slug}`} name="name" defaultValue={game.name} required className="mt-1" /></div>
            <div><Label htmlFor={`short-${game.slug}`}>Short name</Label><Input id={`short-${game.slug}`} name="shortName" defaultValue={game.short_name} required className="mt-1" /></div>
          </div>
          <div><Label htmlFor={`tagline-${game.slug}`}>Tagline</Label><Input id={`tagline-${game.slug}`} name="tagline" defaultValue={game.tagline} className="mt-1" /></div>
          <div><Label htmlFor={`desc-${game.slug}`}>Description</Label><textarea id={`desc-${game.slug}`} name="description" rows={3} defaultValue={game.description} className="mt-1 w-full border border-input bg-white px-3 py-2 text-sm text-navy" /></div>
          <div><Label htmlFor={`instructions-${game.slug}`}>Instructions</Label><textarea id={`instructions-${game.slug}`} name="instructions" rows={3} defaultValue={game.instructions} className="mt-1 w-full border border-input bg-white px-3 py-2 text-sm text-navy" /></div>
          <div><Label htmlFor={`rules-${game.slug}`}>Rules (one per line)</Label><textarea id={`rules-${game.slug}`} name="rules" rows={4} defaultValue={textLines(game.rules)} className="mt-1 w-full border border-input bg-white px-3 py-2 text-sm text-navy" /></div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div><Label htmlFor={`cat-${game.slug}`}>Category</Label><Input id={`cat-${game.slug}`} name="category" defaultValue={game.category} className="mt-1" /></div>
            <div><Label htmlFor={`accent-${game.slug}`}>Accent colour</Label><Input id={`accent-${game.slug}`} name="accent" defaultValue={game.accent} className="mt-1" /></div>
            <div><Label htmlFor={`order-${game.slug}`}>Sort order</Label><Input id={`order-${game.slug}`} name="sortOrder" type="number" min={0} max={100} defaultValue={game.sort_order} className="mt-1" /></div>
          </div>
          <div><Label htmlFor={`maintenance-${game.slug}`}>Maintenance message</Label><Input id={`maintenance-${game.slug}`} name="maintenanceMessage" defaultValue={game.maintenance_message ?? ""} className="mt-1" /></div>
          <div className="flex flex-wrap gap-3">
            {CHECKS.map((check) => (
              <label key={check.name} className="flex items-center gap-2 text-xs font-semibold text-navy">
                <input type="checkbox" name={check.name} defaultChecked={Boolean(game[check.name as keyof Phase5GameRow])} className="size-4 accent-[#3564E9]" />
                {check.label}
              </label>
            ))}
          </div>
          <Button type="submit" size="sm" disabled={pending}>Save game details</Button>
        </form>

        <form action={(formData) => { formData.set("gameSlug", game.slug); run(formData, saveSettingsAction); }} className="space-y-3 border-l-0 lg:border-l lg:border-navy/10 lg:pl-6">
          <h3 className="font-heading text-xl font-bold uppercase tracking-wide text-cobalt">Ratings, seasons & limits</h3>
          <Input type="hidden" name="gameSlug" value={game.slug} />
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              { name: "startingRating", label: "Starting rating", value: settings?.starting_rating ?? 1200 },
              { name: "kFactor", label: "K factor", value: settings?.k_factor ?? 32 },
              { name: "defaultAttempts", label: "Default attempts", value: settings?.default_attempts ?? 10 },
              { name: "penaltyAttempts", label: "Penalty attempts", value: settings?.penalty_attempts ?? 5 },
              { name: "queenValue", label: "Queen value", value: settings?.queen_value ?? 3 },
              { name: "coinValue", label: "Coin value", value: settings?.coin_value ?? 1 },
              { name: "challengeExpiryMinutes", label: "Challenge expiry (min)", value: settings?.challenge_expiry_minutes ?? 60 },
              { name: "challengeRateLimit", label: "Challenge rate limit", value: settings?.challenge_rate_limit ?? 8 },
              { name: "reconnectionGraceMinutes", label: "Reconnect grace (min)", value: settings?.reconnection_grace_minutes ?? 5 },
            ].map((field) => (
              <div key={field.name}><Label htmlFor={`${field.name}-${game.slug}`}>{field.label}</Label><Input id={`${field.name}-${game.slug}`} name={field.name} type="number" defaultValue={field.value} className="mt-1" /></div>
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><Label htmlFor={`seasonKey-${game.slug}`}>Season key</Label><Input id={`seasonKey-${game.slug}`} name="seasonKey" defaultValue={settings?.season_key ?? "all-time"} className="mt-1" /></div>
            <div><Label htmlFor={`seasonLabel-${game.slug}`}>Season label</Label><Input id={`seasonLabel-${game.slug}`} name="seasonLabel" defaultValue={settings?.season_label ?? "All time"} className="mt-1" /></div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor={`defaultTimeControl-${game.slug}`}>Default chess clock</Label>
              <select id={`defaultTimeControl-${game.slug}`} name="defaultTimeControl" defaultValue={settings?.default_time_control ?? "10"} className="mt-1 w-full border border-input bg-white px-3 py-2 text-sm text-navy">
                <option value="unlimited">Unlimited</option><option value="5">5 minutes</option><option value="10">10 minutes</option><option value="15">15 minutes</option>
              </select>
            </div>
            <div><Label htmlFor={`chessTimeControls-${game.slug}`}>Allowed clocks</Label><Input id={`chessTimeControls-${game.slug}`} name="chessTimeControls" defaultValue={Array.isArray(settings?.chess_time_controls) ? (settings?.chess_time_controls as string[]).join(",") : "unlimited,5,10,15"} className="mt-1" /></div>
          </div>
          <label className="flex items-center gap-2 text-sm font-semibold text-navy">
            <input type="checkbox" name="suddenDeath" defaultChecked={settings?.sudden_death ?? true} className="size-4 accent-[#3564E9]" />
            Enable sudden death
          </label>
          <Button type="submit" size="sm" disabled={pending}>Save settings</Button>
        </form>
      </div>
      {status ? <p className={`border-t border-navy/10 px-5 py-3 text-sm ${status.ok ? "text-[#33521b]" : "text-coral-dark"}`}>{status.message}</p> : null}
    </details>
  );
}
