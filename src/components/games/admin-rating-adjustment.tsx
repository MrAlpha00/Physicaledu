"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { adjustRatingAction } from "@/app/(admin)/admin/games/actions";
import { GAME_LIST } from "@/lib/games/catalog";

export function AdminRatingAdjustment() {
  const [status, setStatus] = useState<{ ok: boolean; message: string } | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form action={(formData) => {
      setStatus(null);
      startTransition(async () => {
        const response = await adjustRatingAction({ ok: false, message: "" }, formData);
        setStatus({ ok: response.ok, message: response.message });
      });
    }} className="space-y-4 border border-navy/10 bg-white p-6">
      <div>
        <Label htmlFor="adjust-user">User ID</Label>
        <Input id="adjust-user" name="userId" required className="mt-1" placeholder="UUID" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="adjust-game">Game</Label>
          <select id="adjust-game" name="gameSlug" className="mt-1 w-full border border-input bg-white px-3 py-2 text-sm text-navy">
            {GAME_LIST.map((game) => <option key={game.slug} value={game.slug}>{game.name}</option>)}
          </select>
        </div>
        <div><Label htmlFor="adjust-rating">New rating</Label><Input id="adjust-rating" name="rating" type="number" min={100} max={5000} required className="mt-1" /></div>
      </div>
      <div><Label htmlFor="adjust-reason">Reason (audited)</Label><textarea id="adjust-reason" name="reason" rows={3} minLength={5} maxLength={500} required className="mt-1 w-full border border-input bg-white px-3 py-2 text-sm text-navy" /></div>
      {status ? <p className={`text-sm ${status.ok ? "text-[#33521b]" : "text-coral-dark"}`}>{status.message}</p> : null}
      <Button type="submit" disabled={pending} className="w-full">{pending ? "Applying…" : "Apply audited adjustment"}</Button>
      <p className="text-xs text-ink-muted">Manual adjustments are logged and never created by guest, practice, cancelled or disputed matches.</p>
    </form>
  );
}
