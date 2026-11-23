"use client";

import { useState, useTransition } from "react";
import { Flag, ShieldAlert, SkipForward } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { resignAction, submitDisputeAction, submitReportAction } from "@/app/(student)/games/actions";
import type { GameSlug } from "@/lib/games/types";

interface MatchFormsProps {
  publicId: string;
  slug: GameSlug;
  reportedUserId: string | null;
  canResign: boolean;
}

export function MatchForms({ publicId, slug, reportedUserId, canResign }: MatchFormsProps) {
  const [status, setStatus] = useState<{ ok: boolean; message: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = (formData: FormData, action: (prev: { ok: boolean; message: string }, data: FormData) => Promise<{ ok: boolean; message: string }>) => {
    setStatus(null);
    startTransition(async () => {
      const response = await action({ ok: false, message: "" }, formData);
      setStatus({ ok: response.ok, message: response.message });
    });
  };

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <div className="border border-navy/10 bg-white p-4">
        <h3 className="flex items-center gap-2 font-heading text-lg font-bold uppercase tracking-wide text-navy"><SkipForward className="size-4" /> Concede</h3>
        <p className="mt-1 text-xs text-ink-muted">Resigning records a rated loss. Use it only when you intend to forfeit.</p>
        <Button variant="outline" size="sm" className="mt-3" disabled={pending || !canResign}
          onClick={() => startTransition(async () => {
            const response = await resignAction(publicId);
            setStatus({ ok: response.ok, message: response.message });
          })}>
          Resign match
        </Button>
      </div>

      <form action={(formData) => {
        formData.set("matchId", publicId);
        formData.set("gameSlug", slug);
        if (reportedUserId) formData.set("reportedUserId", reportedUserId);
        submit(formData, submitReportAction);
      }} className="border border-navy/10 bg-white p-4">
        <h3 className="flex items-center gap-2 font-heading text-lg font-bold uppercase tracking-wide text-navy"><Flag className="size-4" /> Report</h3>
        <Label htmlFor="report-reason" className="mt-3 block text-xs">Reason</Label>
        <select id="report-reason" name="reason" className="mt-1 w-full border border-input bg-white px-2 py-1.5 text-sm text-navy">
          <option value="abuse">Abuse</option><option value="cheating">Cheating</option><option value="harassment">Harassment</option>
          <option value="inappropriate_name">Inappropriate name</option><option value="dispute">Result dispute</option><option value="other">Other</option>
        </select>
        <Label htmlFor="report-details" className="mt-2 block text-xs">Details</Label>
        <textarea id="report-details" name="details" rows={2} minLength={10} maxLength={2000} required className="mt-1 w-full border border-input bg-white px-2 py-1.5 text-sm text-navy" />
        <Button type="submit" variant="outline" size="sm" className="mt-3" disabled={pending}>Submit report</Button>
      </form>

      <form action={(formData) => {
        formData.set("publicId", publicId);
        submit(formData, submitDisputeAction);
      }} className="border border-navy/10 bg-white p-4">
        <h3 className="flex items-center gap-2 font-heading text-lg font-bold uppercase tracking-wide text-navy"><ShieldAlert className="size-4" /> Dispute</h3>
        <Label htmlFor="dispute-reason" className="mt-3 block text-xs">Short reason</Label>
        <Input id="dispute-reason" name="reason" minLength={5} maxLength={200} required className="mt-1" />
        <Label htmlFor="dispute-details" className="mt-2 block text-xs">Details</Label>
        <textarea id="dispute-details" name="details" rows={2} maxLength={2000} className="mt-1 w-full border border-input bg-white px-2 py-1.5 text-sm text-navy" />
        <Button type="submit" variant="outline" size="sm" className="mt-3" disabled={pending}>Open dispute</Button>
      </form>
      {status ? <p className={`md:col-span-3 text-sm ${status.ok ? "text-[#33521b]" : "text-coral-dark"}`}>{status.message}</p> : null}
    </div>
  );
}
