"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveEvent } from "@/app/(admin)/admin/events/actions";
import { Phase4ActionNotice } from "@/components/phase4/action-notice";
import { Phase4FileUploadControl } from "@/components/phase4/file-upload-control";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ActionState } from "@/types/domain";
import type { Phase4EventRow } from "@/types/database";

const fieldClass = "w-full border border-navy/20 bg-white px-3 py-2 text-sm";

type EventStatus = "draft" | "published" | "registration_open" | "registration_closed" | "ongoing" | "completed" | "archived";

function toDateTimeInput(value: string | null) {
  return value ? new Date(value).toISOString().slice(0, 16) : "";
}

function fromDateTimeInput(value: string | null) {
  return value ? new Date(value).toISOString() : null;
}

function toSlug(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function EventForm({ event }: { event: Phase4EventRow | null }) {
  const router = useRouter();
  const [notice, setNotice] = useState<ActionState | null>(null);
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState(event?.name ?? "");
  const [slug, setSlug] = useState(event?.slug ?? "");

  function submit(formData: FormData) {
    startTransition(async () => {
      const result = await saveEvent({
        id: event?.id,
        name: String(formData.get("name") ?? ""),
        slug: String(formData.get("slug") ?? ""),
        description: String(formData.get("description") ?? ""),
        academicYear: String(formData.get("academicYear") ?? ""),
        startsOn: String(formData.get("startsOn") ?? "") || null,
        endsOn: String(formData.get("endsOn") ?? "") || null,
        registrationOpensAt: fromDateTimeInput(String(formData.get("registrationOpensAt") ?? "") || null),
        registrationClosesAt: fromDateTimeInput(String(formData.get("registrationClosesAt") ?? "") || null),
        venue: String(formData.get("venue") ?? ""),
        instructions: String(formData.get("instructions") ?? ""),
        contactInformation: String(formData.get("contactInformation") ?? ""),
        isPublic: formData.get("isPublic") === "on",
        status: String(formData.get("status") ?? "draft") as EventStatus,
        bannerFileId: String(formData.get("bannerFileId") ?? "") || null,
        logoFileId: String(formData.get("logoFileId") ?? "") || null,
      });
      setNotice(result);
      if (result.status === "success") {
        router.refresh();
        if (!event && result.eventId) router.push(`/admin/events/${result.eventId}`);
      }
    });
  }

  return (
    <form action={submit} className="space-y-6">
      <Phase4ActionNotice state={notice} />
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="name">Event name</Label>
          <Input
            id="name"
            name="name"
            required
            minLength={3}
            value={name}
            className={fieldClass}
            onChange={(change) => {
              setName(change.target.value);
              if (!event) setSlug(toSlug(change.target.value));
            }}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="slug">URL slug</Label>
          <Input id="slug" name="slug" required value={slug} className={fieldClass} onChange={(change) => setSlug(change.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="academicYear">Academic year</Label>
          <Input id="academicYear" name="academicYear" required defaultValue={event?.academic_year ?? "2026-27"} className={fieldClass} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="venue">Venue</Label>
          <Input id="venue" name="venue" defaultValue={event?.venue ?? ""} className={fieldClass} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="startsOn">Starts on</Label>
          <Input id="startsOn" name="startsOn" type="date" defaultValue={event?.starts_on ?? ""} className={fieldClass} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="endsOn">Ends on</Label>
          <Input id="endsOn" name="endsOn" type="date" defaultValue={event?.ends_on ?? ""} className={fieldClass} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="registrationOpensAt">Registration opens</Label>
          <Input id="registrationOpensAt" name="registrationOpensAt" type="datetime-local" defaultValue={toDateTimeInput(event?.registration_opens_at ?? null)} className={fieldClass} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="registrationClosesAt">Registration closes</Label>
          <Input id="registrationClosesAt" name="registrationClosesAt" type="datetime-local" defaultValue={toDateTimeInput(event?.registration_closes_at ?? null)} className={fieldClass} />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea id="description" name="description" rows={4} defaultValue={event?.description ?? ""} className={fieldClass} />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="instructions">Participant instructions</Label>
          <Textarea id="instructions" name="instructions" rows={4} defaultValue={event?.instructions ?? ""} className={fieldClass} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="contactInformation">Contact information</Label>
          <Textarea id="contactInformation" name="contactInformation" rows={4} defaultValue={event?.contact_information ?? ""} className={fieldClass} />
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="status">Status</Label>
          <select id="status" name="status" defaultValue={event?.status ?? "draft"} className={fieldClass}>
            {["draft", "published", "registration_open", "registration_closed", "ongoing", "completed", "archived"].map((status) => (
              <option key={status} value={status}>{status.replaceAll("_", " ")}</option>
            ))}
          </select>
        </div>
        <label className="flex items-center gap-3 self-end border border-navy/15 px-4 py-3 text-sm font-semibold">
          <input type="checkbox" name="isPublic" defaultChecked={event?.is_public ?? false} className="size-4 accent-[#3564E9]" />
          Visible on the public events site
        </label>
      </div>
      {event ? (
        <div className="grid gap-4 md:grid-cols-2">
          <Phase4FileUploadControl
            name="bannerFileId"
            parentType="event_banner"
            parentId={event.id}
            label="Event banner"
            visibility="public"
            initialFileId={event.banner_file_id ?? ""}
          />
          <Phase4FileUploadControl
            name="logoFileId"
            parentType="event_logo"
            parentId={event.id}
            label="Event logo"
            visibility="public"
            initialFileId={event.logo_file_id ?? ""}
          />
        </div>
      ) : (
        <p className="text-xs text-ink-muted">Save the event first to attach a banner or logo.</p>
      )}
      <Button type="submit" variant="lime" disabled={pending}>
        {pending ? "Saving…" : event ? "Save event" : "Create event"}
      </Button>
    </form>
  );
}
