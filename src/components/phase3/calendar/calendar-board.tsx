"use client";

import { useMemo, useState } from "react";
import { CalendarDays } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { formatIstDate, formatIstTime, istDateString } from "@/lib/time/india";
import type { CalendarCategory } from "@/types/database";

const WEEK_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export interface CalendarOccurrenceItem {
  occurrenceId: string;
  title: string;
  startsAt: string;
  endsAt: string;
  venue: string | null;
  category: CalendarCategory;
  isOverride: boolean;
}

function monthLabel(month: string): string {
  const [year, value] = month.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(year, value - 1, 1)),
  );
}

function shiftMonth(month: string, delta: number): string {
  const [year, value] = month.split("-").map(Number);
  const next = new Date(Date.UTC(year, value - 1 + delta, 1));
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function CalendarBoard({ occurrences }: { occurrences: CalendarOccurrenceItem[] }) {
  const today = istDateString();
  const now = new Date();
  const [month, setMonth] = useState(today.slice(0, 7));
  const [selectedDate, setSelectedDate] = useState(today);

  const byDate = useMemo(() => {
    const grouped = new Map<string, CalendarOccurrenceItem[]>();
    for (const occurrence of occurrences) {
      const key = istDateString(occurrence.startsAt);
      const list = grouped.get(key) ?? [];
      list.push(occurrence);
      grouped.set(key, list);
    }
    for (const list of grouped.values()) list.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
    return grouped;
  }, [occurrences]);

  const [year, monthNumber] = month.split("-").map(Number);
  const daysInMonth = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  const leadingBlanks = (new Date(Date.UTC(year, monthNumber - 1, 1)).getUTCDay() + 6) % 7;
  const cells: Array<{ date: string; day: number } | null> = [
    ...Array.from({ length: leadingBlanks }, () => null),
    ...Array.from({ length: daysInMonth }, (_, index) => ({
      date: `${month}-${String(index + 1).padStart(2, "0")}`,
      day: index + 1,
    })),
  ];
  const dayEvents = byDate.get(selectedDate) ?? [];
  const upcoming = useMemo(
    () =>
      occurrences
        .filter((occurrence) => new Date(occurrence.endsAt).getTime() >= now.getTime())
        .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
        .slice(0, 6),
    [occurrences, now],
  );

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(320px,1fr)_minmax(300px,0.75fr)]">
      <section className="border border-navy/15 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3 border-b-2 border-navy pb-3">
          <h2 className="text-2xl font-bold">{monthLabel(month)}</h2>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setMonth((value) => shiftMonth(value, -1))}
              className="border border-navy/20 px-3 py-1 text-xs font-bold uppercase hover:border-navy"
              aria-label="Previous month"
            >
              ←
            </button>
            <button
              type="button"
              onClick={() => { setMonth(today.slice(0, 7)); setSelectedDate(today); }}
              className="border border-navy/20 px-3 py-1 text-xs font-bold uppercase hover:border-navy"
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => setMonth((value) => shiftMonth(value, 1))}
              className="border border-navy/20 px-3 py-1 text-xs font-bold uppercase hover:border-navy"
              aria-label="Next month"
            >
              →
            </button>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-7 gap-px bg-navy/10">
          {WEEK_LABELS.map((label) => (
            <div key={label} className="bg-chalk/60 py-2 text-center text-[10px] font-bold uppercase tracking-widest text-ink-muted">
              {label}
            </div>
          ))}
          {cells.map((cell, index) =>
            cell ? (
              <button
                key={cell.date}
                type="button"
                onClick={() => setSelectedDate(cell.date)}
                aria-pressed={selectedDate === cell.date}
                className={`min-h-20 bg-white p-2 text-left transition-colors hover:bg-lime/20 ${
                  selectedDate === cell.date ? "ring-2 ring-inset ring-cobalt" : ""
                } ${cell.date === today ? "bg-cobalt/5" : ""}`}
              >
                <span className={`font-barlow text-lg font-bold ${cell.date === today ? "text-cobalt" : "text-navy"}`}>
                  {cell.day}
                </span>
                {(byDate.get(cell.date) ?? []).slice(0, 2).map((occurrence) => (
                  <span key={occurrence.occurrenceId} className="mt-1 block truncate border-l-2 border-l-lime pl-1 text-[10px] text-ink-muted">
                    {formatIstTime(occurrence.startsAt)} {occurrence.title}
                  </span>
                ))}
                {(byDate.get(cell.date)?.length ?? 0) > 2 ? (
                  <span className="mt-1 block text-[10px] font-bold text-cobalt">
                    +{(byDate.get(cell.date)?.length ?? 0) - 2} more
                  </span>
                ) : null}
              </button>
            ) : (
              <div key={`blank-${index}`} className="min-h-20 bg-chalk/30" aria-hidden="true" />
            ),
          )}
        </div>
        <p className="mt-3 text-[11px] text-ink-muted">All dates and times are India Standard Time (IST).</p>
      </section>

      <div className="space-y-6">
        <section className="border-l-4 border-l-lime bg-white p-5 shadow-sm">
          <p className="eyebrow text-cobalt">Agenda</p>
          <h2 className="mt-1 text-2xl font-bold">{formatIstDate(`${selectedDate}T00:00:00+05:30`)}</h2>
          {dayEvents.length === 0 ? (
            <div className="mt-4">
              <EmptyState
                icon={CalendarDays}
                title="Nothing scheduled"
                description="No eligible events fall on this date. Pick another day or review the upcoming list."
              />
            </div>
          ) : (
            <ul className="mt-4 divide-y divide-navy/10">
              {dayEvents.map((occurrence) => (
                <li key={occurrence.occurrenceId} className="py-3">
                  <p className="text-sm font-bold">{occurrence.title}</p>
                  <p className="mt-1 text-xs text-ink-muted">
                    {formatIstTime(occurrence.startsAt)} – {formatIstTime(occurrence.endsAt)} IST
                    {occurrence.venue ? ` · ${occurrence.venue}` : ""}
                  </p>
                  <p className="mt-1 text-[11px] uppercase tracking-wide text-cobalt">
                    {occurrence.category.replaceAll("_", " ")}
                    {occurrence.isOverride ? " · updated" : ""}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="border border-navy/15 bg-white p-5 shadow-sm">
          <p className="eyebrow text-ink-muted">Coming up</p>
          <h3 className="mt-1 text-xl font-bold">Next events</h3>
          {upcoming.length === 0 ? (
            <p className="mt-3 text-sm text-ink-muted">No upcoming events are available to your account.</p>
          ) : (
            <ol className="mt-3 space-y-3">
              {upcoming.map((occurrence) => (
                <li key={occurrence.occurrenceId} className="flex gap-3 border-b border-navy/10 pb-3 last:border-0 last:pb-0">
                  <span className="w-20 shrink-0 text-xs font-bold text-cobalt">{formatIstDate(occurrence.startsAt)}</span>
                  <span className="text-xs">
                    <span className="block font-bold">{occurrence.title}</span>
                    <span className="text-ink-muted">{formatIstTime(occurrence.startsAt)} IST</span>
                  </span>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </div>
  );
}
