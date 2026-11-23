"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { moderateNameAction, setRestrictionAction } from "@/app/(admin)/admin/games/actions";
import { GAME_LIST } from "@/lib/games/catalog";

export function AdminModerationForms() {
  const [status, setStatus] = useState<{ ok: boolean; message: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const run = (formData: FormData, action: typeof moderateNameAction | typeof setRestrictionAction) => {
    setStatus(null);
    startTransition(async () => {
      const response = await action({ ok: false, message: "" }, formData);
      setStatus({ ok: response.ok, message: response.message });
    });
  };

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <form action={(formData) => run(formData, moderateNameAction)} className="space-y-3 border border-navy/10 bg-white p-5">
        <h3 className="font-heading text-xl font-bold uppercase tracking-wide text-cobalt">Display name moderation</h3>
        <div><Label htmlFor="mod-user">User ID</Label><Input id="mod-user" name="userId" required className="mt-1" placeholder="UUID" /></div>
        <div>
          <Label htmlFor="mod-action">Action</Label>
          <select id="mod-action" name="action" className="mt-1 w-full border border-input bg-white px-3 py-2 text-sm text-navy">
            <option value="flag">Flag name</option><option value="clear">Clear flag</option>
          </select>
        </div>
        <div><Label htmlFor="mod-note">Note</Label><Input id="mod-note" name="note" className="mt-1" /></div>
        <Button type="submit" size="sm" disabled={pending}>Apply</Button>
      </form>

      <form action={(formData) => {
        const raw = String(formData.get("expiresAt") ?? "");
        if (raw) formData.set("expiresAt", new Date(raw).toISOString());
        run(formData, setRestrictionAction);
      }} className="space-y-3 border border-navy/10 bg-white p-5">
        <h3 className="font-heading text-xl font-bold uppercase tracking-wide text-cobalt">Player restriction</h3>
        <div><Label htmlFor="restrict-user">User ID</Label><Input id="restrict-user" name="userId" required className="mt-1" placeholder="UUID" /></div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="restrict-game">Game</Label>
            <select id="restrict-game" name="gameSlug" className="mt-1 w-full border border-input bg-white px-3 py-2 text-sm text-navy">
              <option value="">All games</option>
              {GAME_LIST.map((game) => <option key={game.slug} value={game.slug}>{game.shortName}</option>)}
            </select>
          </div>
          <div>
            <Label htmlFor="restrict-type">Type</Label>
            <select id="restrict-type" name="type" className="mt-1 w-full border border-input bg-white px-3 py-2 text-sm text-navy">
              <option value="all">All play</option><option value="ranked">Ranked</option><option value="challenge">Challenges</option><option value="public_profile">Public profile</option>
            </select>
          </div>
        </div>
        <div><Label htmlFor="restrict-reason">Reason</Label><Input id="restrict-reason" name="reason" minLength={5} required className="mt-1" /></div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div><Label htmlFor="restrict-expiry">Expires at</Label><Input id="restrict-expiry" name="expiresAt" type="datetime-local" className="mt-1" /></div>
          <label className="flex items-end gap-2 pb-2 text-sm font-semibold text-navy"><input type="checkbox" name="active" defaultChecked className="size-4 accent-[#3564E9]" /> Active</label>
        </div>
        <Button type="submit" size="sm" disabled={pending}>Apply restriction</Button>
      </form>
      {status ? <p className={`lg:col-span-2 text-sm ${status.ok ? "text-[#33521b]" : "text-coral-dark"}`}>{status.message}</p> : null}
    </div>
  );
}
