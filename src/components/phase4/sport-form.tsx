"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveSport } from "@/app/(admin)/admin/events/actions";
import { Phase4ActionNotice } from "@/components/phase4/action-notice";
import { Phase4FileUploadControl } from "@/components/phase4/file-upload-control";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ActionState } from "@/types/domain";
import type { Json, Phase4EventStatus, Phase4RulesRow, Phase4SportRow } from "@/types/database";

const fieldClass = "w-full border border-navy/20 bg-white px-3 py-2 text-sm";

type Points = { win?: number; draw?: number; loss?: number; tiebreakers?: string[] };

function readPoints(points: Json): Points {
  if (!points || typeof points !== "object" || Array.isArray(points)) return {};
  return points as Points;
}

function toSlug(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function SportForm({
  eventId,
  sport,
  rules,
}: {
  eventId: string;
  sport: Phase4SportRow | null;
  rules: Phase4RulesRow | null;
}) {
  const router = useRouter();
  const [notice, setNotice] = useState<ActionState | null>(null);
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState(sport?.name ?? "");
  const [slug, setSlug] = useState(sport?.slug ?? "");
  const points = readPoints(sport?.points ?? null);

  function submit(formData: FormData) {
    const tiebreakers = formData.getAll("tiebreakers").map(String) as Array<
      "competition_points" | "point_difference" | "points_scored" | "wins" | "head_to_head"
    >;
    startTransition(async () => {
      const result = await saveSport({
        id: sport?.id,
        eventId,
        name: String(formData.get("name") ?? ""),
        slug: String(formData.get("slug") ?? ""),
        description: String(formData.get("description") ?? ""),
        category: String(formData.get("category") ?? ""),
        mode: String(formData.get("mode")) as "team" | "individual",
        venue: String(formData.get("venue") ?? ""),
        registrationStart: String(formData.get("registrationStart") ?? "") || null,
        registrationDeadline: String(formData.get("registrationDeadline") ?? "") || null,
        competitionDate: String(formData.get("competitionDate") ?? "") || null,
        maxEntries: Number(formData.get("maxEntries")) || null,
        isPublic: formData.get("isPublic") === "on",
        status: String(formData.get("status") ?? "draft") as Phase4EventStatus,
        scoringMode: String(formData.get("scoringMode") ?? "simple") as "simple",
        tournamentFormat: String(formData.get("tournamentFormat") ?? "knockout") as "knockout",
        drawMode: String(formData.get("drawMode") ?? "random") as "random",
        thirdPlace: formData.get("thirdPlace") === "on",
        groupCount: Number(formData.get("groupCount")) || null,
        qualifiersPerGroup: Number(formData.get("qualifiersPerGroup")) || null,
        legs: Number(formData.get("legs") ?? 1),
        pointsWin: Number(formData.get("pointsWin") ?? 3),
        pointsDraw: Number(formData.get("pointsDraw") ?? 1),
        pointsLoss: Number(formData.get("pointsLoss") ?? 0),
        tiebreakers: tiebreakers.length ? tiebreakers : ["competition_points"],
        autoAdvance: formData.get("autoAdvance") === "on",
        organizerResultsRequireApproval: formData.get("organizerResultsRequireApproval") === "on",
        publicRules: String(formData.get("publicRules") ?? ""),
        imageFileId: String(formData.get("imageFileId") ?? "") || null,
      });
      setNotice(result);
      if (result.status === "success") {
        router.refresh();
        if (!sport && result.sportId) router.push(`/admin/events/${eventId}/sports/${result.sportId}`);
      }
    });
  }

  return (
    <form action={submit} className="space-y-6">
      <Phase4ActionNotice state={notice} />
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="name">Competition name</Label>
          <Input id="name" name="name" required value={name} className={fieldClass} onChange={(change) => {
            setName(change.target.value);
            if (!sport) setSlug(toSlug(change.target.value));
          }} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="slug">URL slug</Label>
          <Input id="slug" name="slug" required value={slug} className={fieldClass} onChange={(change) => setSlug(change.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="mode">Registration mode</Label>
          <select id="mode" name="mode" defaultValue={sport?.mode ?? "team"} className={fieldClass}>
            <option value="team">Team</option>
            <option value="individual">Individual</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="category">Category</Label>
          <Input id="category" name="category" defaultValue={sport?.category ?? ""} className={fieldClass} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="status">Status</Label>
          <select id="status" name="status" defaultValue={sport?.status ?? "draft"} className={fieldClass}>
            {["draft", "published", "registration_open", "registration_closed", "ongoing", "completed", "archived"].map((status) => (
              <option key={status} value={status}>{status.replaceAll("_", " ")}</option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="venue">Venue</Label>
          <Input id="venue" name="venue" defaultValue={sport?.venue ?? ""} className={fieldClass} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="maxEntries">Maximum entries</Label>
          <Input id="maxEntries" name="maxEntries" type="number" min={1} defaultValue={sport?.max_entries ?? ""} className={fieldClass} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="competitionDate">Competition date</Label>
          <Input id="competitionDate" name="competitionDate" type="datetime-local" defaultValue={sport?.competition_date?.slice(0, 16) ?? ""} className={fieldClass} />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea id="description" name="description" rows={3} defaultValue={sport?.description ?? ""} className={fieldClass} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="publicRules">Public rules summary</Label>
        <Textarea id="publicRules" name="publicRules" rows={4} defaultValue={rules?.public_rules ?? ""} className={fieldClass} />
      </div>

      <div className="grid gap-4 border-t border-navy/10 pt-6 md:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="tournamentFormat">Tournament format</Label>
          <select id="tournamentFormat" name="tournamentFormat" defaultValue={sport?.tournament_format ?? "knockout"} className={fieldClass}>
            <option value="knockout">Knockout</option>
            <option value="round_robin">Round robin</option>
            <option value="group_knockout">Group stage + knockout</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="drawMode">Draw mode</Label>
          <select id="drawMode" name="drawMode" defaultValue={sport?.draw_mode ?? "random"} className={fieldClass}>
            <option value="random">Random</option>
            <option value="seeded">Seeded</option>
            <option value="manual">Manual</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="scoringMode">Scoring mode</Label>
          <select id="scoringMode" name="scoringMode" defaultValue={sport?.scoring_mode ?? "simple"} className={fieldClass}>
            <option value="simple">Simple score</option>
            <option value="sets">Sets</option>
            <option value="time">Time</option>
            <option value="manual">Manual</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="groupCount">Groups</Label>
          <Input id="groupCount" name="groupCount" type="number" min={2} max={32} defaultValue={sport?.group_count ?? ""} className={fieldClass} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="qualifiersPerGroup">Qualifiers per group</Label>
          <Input id="qualifiersPerGroup" name="qualifiersPerGroup" type="number" min={1} defaultValue={sport?.qualifiers_per_group ?? ""} className={fieldClass} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="legs">Legs</Label>
          <select id="legs" name="legs" defaultValue={sport?.legs ?? 1} className={fieldClass}>
            <option value={1}>Single</option>
            <option value={2}>Home and away</option>
          </select>
        </div>
      </div>

      <div className="grid gap-4 border-t border-navy/10 pt-6 md:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="pointsWin">Points — win</Label>
          <Input id="pointsWin" name="pointsWin" type="number" min={0} defaultValue={points.win ?? 3} className={fieldClass} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="pointsDraw">Points — draw</Label>
          <Input id="pointsDraw" name="pointsDraw" type="number" min={0} defaultValue={points.draw ?? 1} className={fieldClass} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="pointsLoss">Points — loss</Label>
          <Input id="pointsLoss" name="pointsLoss" type="number" min={0} defaultValue={points.loss ?? 0} className={fieldClass} />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Tiebreakers</Label>
        <div className="flex flex-wrap gap-4 border border-navy/15 p-4">
          {[
            ["competition_points", "Competition points"],
            ["point_difference", "Point difference"],
            ["points_scored", "Points scored"],
            ["wins", "Wins"],
            ["head_to_head", "Head to head"],
          ].map(([value, label]) => (
            <label key={value} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="tiebreakers"
                value={value}
                defaultChecked={(points.tiebreakers ?? ["competition_points", "point_difference", "points_scored", "wins"]).includes(value)}
                className="size-4 accent-[#3564E9]"
              />
              {label}
            </label>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap gap-6 border-t border-navy/10 pt-6">
        <label className="flex items-center gap-2 text-sm font-semibold">
          <input type="checkbox" name="isPublic" defaultChecked={sport?.is_public ?? true} className="size-4 accent-[#3564E9]" /> Public competition
        </label>
        <label className="flex items-center gap-2 text-sm font-semibold">
          <input type="checkbox" name="thirdPlace" defaultChecked={sport?.third_place ?? false} className="size-4 accent-[#3564E9]" /> Third-place match
        </label>
        <label className="flex items-center gap-2 text-sm font-semibold">
          <input type="checkbox" name="autoAdvance" defaultChecked={sport?.auto_advance ?? true} className="size-4 accent-[#3564E9]" /> Auto-advance winners
        </label>
        <label className="flex items-center gap-2 text-sm font-semibold">
          <input type="checkbox" name="organizerResultsRequireApproval" defaultChecked={sport?.organizer_results_require_approval ?? false} className="size-4 accent-[#3564E9]" /> Organiser results need approval
        </label>
      </div>
      <Button type="submit" variant="lime" disabled={pending}>
        {pending ? "Saving…" : sport ? "Save competition" : "Add competition"}
      </Button>
    </form>
  );
}
