"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { saveSportsProfile } from "@/app/(student)/my-sports-profile/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FileUploadControl } from "@/components/phase3/file-upload-control";
import { Phase3Notice } from "@/components/phase3/common";
import { SportsActionNotice } from "./action-notice";
import type { ActionState } from "@/types/domain";

export interface SportsProfileFormData {
  userId: string;
  biography: string | null;
  sportsInterests: string[];
  preferredSports: string[];
  isPublic: boolean;
}

function toTags(value: string): string[] {
  return [...new Set(value.split(",").map((tag) => tag.trim()).filter(Boolean))].slice(0, 20);
}

export function SportsProfileForm({ profile }: { profile: SportsProfileFormData }) {
  const router = useRouter();
  const [biography, setBiography] = useState(profile.biography ?? "");
  const [interests, setInterests] = useState(profile.sportsInterests.join(", "));
  const [preferred, setPreferred] = useState(profile.preferredSports.join(", "));
  const [isPublic, setIsPublic] = useState(profile.isPublic);
  const [photoFileId, setPhotoFileId] = useState("");
  const [notice, setNotice] = useState<ActionState | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice(null);
    const form = new FormData(event.currentTarget);
    const uploaded = String(form.get("profilePhotoFileId") ?? "");
    if (uploaded) setPhotoFileId(uploaded);

    startTransition(async () => {
      const result = await saveSportsProfile({
        biography,
        sportsInterests: toTags(interests),
        preferredSports: toTags(preferred),
        isPublic,
        profilePhotoFileId: uploaded || photoFileId || undefined,
      });
      setNotice(result);
      if (result.status === "success") router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="space-y-5 border-t-4 border-t-lime bg-white p-6 shadow-sm">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cobalt">Your profile</p>
        <h2 className="mt-1 font-barlow text-3xl leading-none text-navy">Edit sports profile</h2>
        <p className="mt-2 text-xs text-ink-muted">Interests and preferred sports accept comma-separated values, up to 20 of each.</p>
      </div>

      <label className="block text-[10px] font-bold uppercase tracking-[0.14em] text-ink-muted">
        Biography
        <Textarea className="mt-2" rows={5} maxLength={1500} value={biography} onChange={(event) => setBiography(event.target.value)} placeholder="Tell the PE department about your sports journey." />
      </label>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="block text-[10px] font-bold uppercase tracking-[0.14em] text-ink-muted">
          Sports interests
          <Input className="mt-2" value={interests} onChange={(event) => setInterests(event.target.value)} placeholder="Cricket, Badminton, Athletics" />
        </label>
        <label className="block text-[10px] font-bold uppercase tracking-[0.14em] text-ink-muted">
          Preferred sports
          <Input className="mt-2" value={preferred} onChange={(event) => setPreferred(event.target.value)} placeholder="Football, Volleyball" />
        </label>
      </div>

      <FileUploadControl
        name="profilePhotoFileId"
        parentType="sports_profile_photo"
        parentId={profile.userId}
        visibility="private"
        label="Profile photo (optional)"
        accept=".jpg,.jpeg,.png,.webp"
      />

      <label className="flex cursor-pointer items-start gap-3 border border-navy/15 bg-navy/[0.02] p-4">
        <input
          type="checkbox"
          checked={isPublic}
          onChange={(event) => setIsPublic(event.target.checked)}
          className="mt-0.5 size-4 accent-[#3564e9]"
        />
        <span>
          <span className="block text-sm font-bold text-navy">Make my sports profile public</span>
          <span className="mt-1 block text-xs text-ink-muted">
            Off by default. If enabled, your name, department, year/semester, interests and verified achievements appear in the public student sports directory. USN, email and private fields are never published.
          </span>
        </span>
      </label>

      {!isPublic ? (
        <Phase3Notice tone="warning">Your profile is currently private. Check the box above only if you want a public page.</Phase3Notice>
      ) : (
        <Phase3Notice>Your profile is currently public. Uncheck the box to remove the public page.</Phase3Notice>
      )}

      <SportsActionNotice state={notice} />

      <Button type="submit" variant="default" disabled={pending}>
        {pending ? "Saving…" : "Save sports profile"}
      </Button>
    </form>
  );
}
