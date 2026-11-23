"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveGamingProfileAction } from "@/app/(student)/games/actions";
import type { Phase5GamingProfileRow } from "@/types/database";

export function ProfileForm({ profile }: { profile: Phase5GamingProfileRow | null }) {
  const [status, setStatus] = useState<{ ok: boolean; message: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = (formData: FormData) => {
    setStatus(null);
    startTransition(async () => {
      const response = await saveGamingProfileAction({ ok: false, message: "" }, formData);
      setStatus({ ok: response.ok, message: response.message });
    });
  };

  return (
    <form
      action={(formData) => submit(formData)}
      className="space-y-5 border border-navy/10 bg-white p-6"
    >
      <div>
        <Label htmlFor="gamingName">Gaming name</Label>
        <Input id="gamingName" name="gamingName" defaultValue={profile?.gaming_name ?? ""} maxLength={40} required className="mt-1" />
        <p className="mt-1 text-xs text-ink-muted">Shown on leaderboards and match rooms. Your USN and email are never exposed.</p>
      </div>

      <div>
        <Label htmlFor="visibility">Profile visibility</Label>
        <select id="visibility" name="visibility" defaultValue={profile?.visibility ?? "private"}
          className="mt-1 w-full border border-input bg-white px-3 py-2 text-sm text-navy">
          <option value="private">Private — visible only to match opponents</option>
          <option value="public">Public — shown on leaderboards</option>
        </select>
      </div>

      <div>
        <Label htmlFor="bio">Short bio</Label>
        <textarea id="bio" name="bio" rows={3} maxLength={500} defaultValue={profile?.bio ?? ""}
          className="mt-1 w-full border border-input bg-white px-3 py-2 text-sm text-navy" placeholder="Your favourite game or playing style" />
      </div>

      <div className="space-y-2 border-t border-navy/10 pt-4">
        <label className="flex items-center gap-3 text-sm text-navy">
          <input type="checkbox" name="searchable" defaultChecked={profile?.searchable ?? true} className="size-4 accent-[#3564E9]" />
          Let other students find me by gaming name
        </label>
        <label className="flex items-center gap-3 text-sm text-navy">
          <input type="checkbox" name="challengesEnabled" defaultChecked={profile?.challenges_enabled ?? true} className="size-4 accent-[#3564E9]" />
          Allow students to challenge me
        </label>
      </div>

      {status ? <p className={`text-sm ${status.ok ? "text-[#33521b]" : "text-coral-dark"}`}>{status.message}</p> : null}
      {profile?.is_moderated ? <p className="text-sm text-coral-dark">This display name was flagged by moderation. Choose a new name to continue.</p> : null}

      <Button type="submit" disabled={pending} className="w-full">{pending ? "Saving…" : "Save gaming profile"}</Button>
    </form>
  );
}
