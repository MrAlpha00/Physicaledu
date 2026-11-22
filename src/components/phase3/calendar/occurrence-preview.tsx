"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { CalendarClock } from "lucide-react";
import { saveCalendarOverride } from "@/app/(admin)/admin/calendar/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formatIstDate, formatIstTime, toIstLocalInput } from "@/lib/time/india";
import type { Phase3CalendarOverrideRow } from "@/types/database";
import type { CalendarOccurrenceView } from "@/types/domain";
import { CalendarField } from "./form-controls";

function originalStart(occurrence: CalendarOccurrenceView): string | null {
  if (!occurrence.ruleId) return null;
  const separator = occurrence.occurrenceId.indexOf(":");
  return separator === -1 ? null : occurrence.occurrenceId.slice(separator + 1);
}

/**
 * Preview rows are derived in memory. Only an explicit override submission is
 * persisted; generated occurrences are never written to the database.
 */
export function OccurrencePreview({
  occurrences,
  overrides,
  maxRows = 18,
}: {
  occurrences: CalendarOccurrenceView[];
  overrides: Phase3CalendarOverrideRow[];
  maxRows?: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [notice, setNotice] = useState<{ id: string; message: string; error: boolean } | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [isCancelled, setIsCancelled] = useState(false);
  const [title, setTitle] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [venue, setVenue] = useState("");
  const [description, setDescription] = useState("");

  const overriddenKeys = useMemo(
    () => new Set(overrides.map((override) => override.occurrence_starts_at)),
    [overrides],
  );
  const rows = occurrences.slice(0, maxRows);

  function openEditor(occurrence: CalendarOccurrenceView) {
    setNotice(null);
    if (editing === occurrence.occurrenceId) {
      setEditing(null);
      return;
    }
    setEditing(occurrence.occurrenceId);
    setIsCancelled(overriddenKeys.has(originalStart(occurrence) ?? ""));
    setTitle(occurrence.title);
    setStartsAt(toIstLocalInput(occurrence.startsAt));
    setEndsAt(toIstLocalInput(occurrence.endsAt));
    setVenue(occurrence.venue ?? "");
    setDescription(occurrence.description ?? "");
  }

  function submit(occurrence: CalendarOccurrenceView) {
    const startKey = originalStart(occurrence);
    if (!occurrence.ruleId || !startKey) {
      setNotice({ id: occurrence.occurrenceId, message: "Only generated occurrences can be overridden.", error: true });
      return;
    }
    setNotice(null);
    startTransition(async () => {
      const result = await saveCalendarOverride({
        ruleId: occurrence.ruleId as string,
        occurrenceStartsAt: startKey,
        isCancelled,
        title,
        startsAt,
        endsAt,
        venue,
        description,
      });
      setNotice({ id: occurrence.occurrenceId, message: result.message, error: result.status === "error" });
      if (result.status === "success") {
        setEditing(null);
        router.refresh();
      }
    });
  }

  return (
    <section className="border border-navy/10 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-navy px-5 py-4">
        <div>
          <p className="eyebrow text-cobalt">Next 120 days</p>
          <h3 className="mt-1 text-xl font-bold">Occurrence preview</h3>
        </div>
        <span className="text-xs text-ink-muted">
          {rows.length} of {occurrences.length} shown · computed in memory
        </span>
      </div>
      {rows.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-ink-muted">
          No occurrences in the next 120 days. Publish the event with a valid recurrence rule to see them here.
        </p>
      ) : (
        <ol className="divide-y divide-navy/10">
          {rows.map((occurrence) => {
            const key = originalStart(occurrence);
            const hasOverride = Boolean(key && overriddenKeys.has(key));
            const active = editing === occurrence.occurrenceId;
            return (
              <li key={occurrence.occurrenceId} className="px-5 py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex gap-3">
                    <div className="flex size-10 shrink-0 flex-col items-center justify-center border border-navy/15 bg-chalk/60 font-barlow leading-none">
                      <span className="text-base font-bold text-cobalt">{formatIstDate(occurrence.startsAt).slice(0, 2)}</span>
                      <span className="text-[9px] uppercase tracking-wide text-ink-muted">
                        {formatIstDate(occurrence.startsAt).slice(3, 6)}
                      </span>
                    </div>
                    <div>
                      <p className="text-sm font-bold">{occurrence.title}</p>
                      <p className="mt-1 text-xs text-ink-muted">
                        {formatIstTime(occurrence.startsAt)} – {formatIstTime(occurrence.endsAt)} IST
                        {occurrence.venue ? ` · ${occurrence.venue}` : ""}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {occurrence.isOverride ? (
                          <span className="eyebrow rounded-sm bg-cobalt/10 px-2 py-1 text-[9px] text-cobalt">Edited occurrence</span>
                        ) : null}
                        {hasOverride && occurrence.isCancelled ? (
                          <span className="eyebrow rounded-sm bg-coral/10 px-2 py-1 text-[9px] text-coral-dark">Cancelled</span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                  {occurrence.ruleId ? (
                    <Button type="button" size="sm" variant="outline" onClick={() => openEditor(occurrence)}>
                      {active ? "Close" : hasOverride ? "Edit override" : "Override"}
                    </Button>
                  ) : (
                    <span className="text-[11px] text-ink-muted">Base event time</span>
                  )}
                </div>

                {notice?.id === occurrence.occurrenceId ? (
                  <p
                    role={notice.error ? "alert" : "status"}
                    className={`mt-3 border-l-4 px-3 py-2 text-xs font-semibold ${
                      notice.error ? "border-l-coral bg-coral/10 text-coral-dark" : "border-l-lime bg-lime/25 text-[#33521b]"
                    }`}
                  >
                    {notice.message}
                  </p>
                ) : null}

                {active ? (
                  <div className="mt-4 grid gap-4 border-t border-navy/10 pt-4 md:grid-cols-2">
                    <label className="flex items-center gap-2 text-sm font-semibold md:col-span-2">
                      <input
                        type="checkbox"
                        className="size-4 accent-[#c4462f]"
                        checked={isCancelled}
                        onChange={(event) => setIsCancelled(event.target.checked)}
                      />
                      Cancel this occurrence (keeps the rest of the series)
                    </label>
                    <CalendarField label="Occurrence title" htmlFor={`override-title-${occurrence.occurrenceId}`}>
                      <Input
                        id={`override-title-${occurrence.occurrenceId}`}
                        value={title}
                        onChange={(event) => setTitle(event.target.value)}
                        maxLength={120}
                        disabled={isCancelled}
                      />
                    </CalendarField>
                    <CalendarField label="Venue" htmlFor={`override-venue-${occurrence.occurrenceId}`}>
                      <Input
                        id={`override-venue-${occurrence.occurrenceId}`}
                        value={venue}
                        onChange={(event) => setVenue(event.target.value)}
                        maxLength={120}
                        disabled={isCancelled}
                      />
                    </CalendarField>
                    <CalendarField label="New start (IST)" htmlFor={`override-start-${occurrence.occurrenceId}`}>
                      <Input
                        id={`override-start-${occurrence.occurrenceId}`}
                        type="datetime-local"
                        value={startsAt}
                        onChange={(event) => setStartsAt(event.target.value)}
                        disabled={isCancelled}
                      />
                    </CalendarField>
                    <CalendarField label="New end (IST)" htmlFor={`override-end-${occurrence.occurrenceId}`}>
                      <Input
                        id={`override-end-${occurrence.occurrenceId}`}
                        type="datetime-local"
                        value={endsAt}
                        onChange={(event) => setEndsAt(event.target.value)}
                        disabled={isCancelled}
                      />
                    </CalendarField>
                    <div className="md:col-span-2">
                      <CalendarField label="Description" htmlFor={`override-description-${occurrence.occurrenceId}`}>
                        <Textarea
                          id={`override-description-${occurrence.occurrenceId}`}
                          value={description}
                          onChange={(event) => setDescription(event.target.value)}
                          rows={3}
                          maxLength={3000}
                          disabled={isCancelled}
                        />
                      </CalendarField>
                    </div>
                    <div className="flex items-center gap-2 md:col-span-2">
                      <Button type="button" size="sm" variant={isCancelled ? "destructive" : "cobalt"} disabled={pending} onClick={() => submit(occurrence)}>
                        {pending ? "Saving…" : isCancelled ? "Cancel occurrence" : "Save override"}
                      </Button>
                      {hasOverride ? (
                        <span className="text-[11px] text-ink-muted">Saving empty fields clears this override.</span>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ol>
      )}
      <div className="flex items-start gap-2 border-t border-navy/10 bg-chalk/50 px-5 py-3 text-[11px] text-ink-muted">
        <CalendarClock className="mt-0.5 size-3.5 shrink-0" />
        <span>Overrides are stored as rules for a series. Generated dates are recalculated, never inserted as events.</span>
      </div>
    </section>
  );
}
