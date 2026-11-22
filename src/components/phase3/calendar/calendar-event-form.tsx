"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";
import { saveCalendarEvent } from "@/app/(admin)/admin/calendar/actions";
import { FileUploadControl } from "@/components/phase3/file-upload-control";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { audienceLabel, expandCalendarOccurrences } from "@/lib/operations/phase3";
import { istLocalInputToIso, toIstLocalInput } from "@/lib/time/india";
import type { Phase3AudienceInput, Phase3RecurrenceInput, DepartmentOption } from "@/types/domain";
import type {
  CalendarCategory,
  CalendarStatus,
  CalendarVisibility,
  Phase3AudienceType,
  Phase3CalendarEventRow,
  Phase3CalendarOverrideRow,
  Phase3RecurrenceRuleRow,
  RecurrenceFrequency,
} from "@/types/database";
import { CalendarActionNotice } from "./action-notice";
import { CalendarField, CalendarSelect } from "./form-controls";
import { OccurrencePreview } from "./occurrence-preview";

const CATEGORIES: CalendarCategory[] = [
  "pe_class", "sports_practice", "competition", "fitness_activity",
  "department_activity", "announcement", "deadline", "other",
];
const VISIBILITIES: CalendarVisibility[] = ["public", "authenticated", "pe_only"];
const STATUSES: CalendarStatus[] = ["draft", "published", "archived"];
const FREQUENCIES: RecurrenceFrequency[] = ["daily", "weekly", "monthly"];
const AUDIENCE_TYPES: Phase3AudienceType[] = [
  "all_students", "active_pe", "department", "semester", "selected_students", "group",
];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export interface CalendarEventInitialValue {
  id: string;
  ruleId: string | null;
  title: string;
  description: string;
  category: CalendarCategory;
  startsAt: string;
  endsAt: string;
  venue: string;
  visibility: CalendarVisibility;
  status: CalendarStatus;
  isRecurring: boolean;
  attachmentFileId: string;
  audiences: Phase3AudienceInput[];
  recurrence: Phase3RecurrenceInput | null;
}

interface AudienceRow {
  audienceType: Phase3AudienceType;
  departmentId: string;
  semester: string;
  studentDirectoryId: string;
  groupId: string;
}

function audienceToRow(audience: Phase3AudienceInput): AudienceRow {
  return {
    audienceType: audience.audienceType,
    departmentId: audience.departmentId ?? "",
    semester: audience.semester === null || audience.semester === undefined ? "" : String(audience.semester),
    studentDirectoryId: audience.studentDirectoryId ?? "",
    groupId: audience.groupId ?? "",
  };
}

export function CalendarEventForm({
  initial,
  departments,
  groups,
  students,
  overrides,
}: {
  initial: CalendarEventInitialValue | null;
  departments: DepartmentOption[];
  groups: Array<{ id: string; name: string; isActive: boolean }>;
  students: Array<{ id: string; full_name: string; department_id: string; semester: number | null }>;
  overrides: Phase3CalendarOverrideRow[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [notice, setNotice] = useState<{ message: string; error: boolean } | null>(null);
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [category, setCategory] = useState<CalendarCategory>(initial?.category ?? "pe_class");
  const [startsAt, setStartsAt] = useState(initial?.startsAt ?? toIstLocalInput(new Date()));
  const [endsAt, setEndsAt] = useState(
    initial?.endsAt ?? toIstLocalInput(new Date(Date.now() + 60 * 60 * 1000)),
  );
  const [venue, setVenue] = useState(initial?.venue ?? "");
  const [visibility, setVisibility] = useState<CalendarVisibility>(initial?.visibility ?? "pe_only");
  const [status, setStatus] = useState<CalendarStatus>(initial?.status ?? "draft");
  const [isRecurring, setIsRecurring] = useState(initial?.isRecurring ?? false);
  const [frequency, setFrequency] = useState<RecurrenceFrequency>(initial?.recurrence?.frequency ?? "weekly");
  const [intervalCount, setIntervalCount] = useState(String(initial?.recurrence?.intervalCount ?? 1));
  const [byWeekday, setByWeekday] = useState<number[]>(initial?.recurrence?.byWeekday ?? []);
  const [endsOn, setEndsOn] = useState(initial?.recurrence?.endsOn ?? "");
  const [occurrenceLimit, setOccurrenceLimit] = useState(
    initial?.recurrence?.occurrenceLimit === null || initial?.recurrence?.occurrenceLimit === undefined
      ? ""
      : String(initial.recurrence.occurrenceLimit),
  );
  const [audiences, setAudiences] = useState<AudienceRow[]>(
    initial?.audiences.length ? initial.audiences.map(audienceToRow) : [{ audienceType: "all_students" } as AudienceRow],
  );

  const startIso = istLocalInputToIso(startsAt);
  const endIso = istLocalInputToIso(endsAt);

  const preview = useMemo(() => {
    const syntheticEvent: Phase3CalendarEventRow = {
      id: initial?.id || "preview-event",
      title: title || "Untitled event",
      description: description || null,
      category,
      starts_at: startIso,
      ends_at: endIso,
      venue: venue || null,
      visibility,
      // Preview an expanded series even while the saved event is still a draft.
      status: "published",
      is_recurring: isRecurring,
      attachment_file_id: initial?.attachmentFileId || null,
      created_by: null,
      published_at: null,
      created_at: "",
      updated_at: "",
    };
    const rule: Phase3RecurrenceRuleRow | null = isRecurring
      ? {
          id: initial?.ruleId || "preview-rule",
          event_id: syntheticEvent.id,
          frequency,
          interval_count: Number(intervalCount) || 1,
          by_weekday: byWeekday.length ? byWeekday : null,
          ends_on: endsOn || null,
          occurrence_limit: occurrenceLimit === "" ? null : Number(occurrenceLimit),
          created_at: "",
          updated_at: "",
        }
      : null;
    const from = new Date();
    const to = new Date(from.getTime() + 120 * 24 * 60 * 60 * 1000);
    const expanded = expandCalendarOccurrences(syntheticEvent, rule, overrides, from, to, 60);
    // An unsaved rule cannot accept overrides, so only expose a saved rule id.
    return initial?.ruleId
      ? expanded
      : expanded.map((occurrence) => ({ ...occurrence, ruleId: null }));
  }, [
    initial?.id, initial?.ruleId, initial?.attachmentFileId,
    title, description, category, startIso, endIso, venue, visibility,
    isRecurring, frequency, intervalCount, byWeekday, endsOn, occurrenceLimit, overrides,
  ]);

  function setAudience(index: number, patch: Partial<AudienceRow>) {
    setAudiences((rows) => rows.map((row, position) => (position === index ? { ...row, ...patch } : row)));
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice(null);
    const uploadedFileId = String(new FormData(event.currentTarget).get("attachmentUpload") ?? "");
    startTransition(async () => {
      const result = await saveCalendarEvent({
        id: initial?.id,
        title,
        description,
        category,
        startsAt,
        endsAt,
        venue,
        visibility,
        status,
        isRecurring,
        attachmentFileId: uploadedFileId || initial?.attachmentFileId || "",
        audiences: audiences.map((row) => ({
          audienceType: row.audienceType,
          departmentId: row.departmentId,
          semester: row.semester === "" ? "" : Number(row.semester),
          studentDirectoryId: row.studentDirectoryId,
          groupId: row.groupId,
        })),
        recurrence: isRecurring
          ? {
              frequency,
              intervalCount: Number(intervalCount),
              byWeekday,
              endsOn,
              occurrenceLimit: occurrenceLimit === "" ? "" : Number(occurrenceLimit),
            }
          : null,
      });
      setNotice({ message: result.message, error: result.status === "error" });
      if (result.status === "success") {
        if (!initial?.id && result.eventId) router.push(`/admin/calendar/${result.eventId}`);
        else router.refresh();
      }
    });
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(320px,0.85fr)_minmax(0,1.15fr)]">
      <form onSubmit={submit} className="space-y-5 border-t-4 border-t-cobalt bg-white p-6 shadow-sm">
        <div>
          <p className="eyebrow text-cobalt">Event details</p>
          <h2 className="mt-1 text-2xl font-bold">{initial ? "Edit event" : "New calendar event"}</h2>
        </div>

        <CalendarField label="Title" htmlFor="cal-title">
          <Input id="cal-title" required minLength={3} maxLength={120} value={title} onChange={(event) => setTitle(event.target.value)} />
        </CalendarField>
        <CalendarField label="Description" htmlFor="cal-description">
          <Textarea
            id="cal-description"
            rows={4}
            maxLength={3000}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </CalendarField>
        <div className="grid gap-4 sm:grid-cols-2">
          <CalendarField label="Category" htmlFor="cal-category">
            <CalendarSelect id="cal-category" value={category} onChange={(event) => setCategory(event.target.value as CalendarCategory)}>
              {CATEGORIES.map((value) => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}
            </CalendarSelect>
          </CalendarField>
          <CalendarField label="Venue" htmlFor="cal-venue">
            <Input id="cal-venue" maxLength={120} value={venue} onChange={(event) => setVenue(event.target.value)} placeholder="Ground, hall or online" />
          </CalendarField>
          <CalendarField label="Starts (IST)" htmlFor="cal-start">
            <Input id="cal-start" type="datetime-local" required value={startsAt} onChange={(event) => setStartsAt(event.target.value)} />
          </CalendarField>
          <CalendarField label="Ends (IST)" htmlFor="cal-end">
            <Input id="cal-end" type="datetime-local" required value={endsAt} onChange={(event) => setEndsAt(event.target.value)} />
          </CalendarField>
          <CalendarField label="Visibility" htmlFor="cal-visibility">
            <CalendarSelect id="cal-visibility" value={visibility} onChange={(event) => setVisibility(event.target.value as CalendarVisibility)}>
              {VISIBILITIES.map((value) => <option key={value} value={value}>{value}</option>)}
            </CalendarSelect>
          </CalendarField>
          <CalendarField label="Status" htmlFor="cal-status">
            <CalendarSelect id="cal-status" value={status} onChange={(event) => setStatus(event.target.value as CalendarStatus)}>
              {STATUSES.map((value) => <option key={value} value={value}>{value}</option>)}
            </CalendarSelect>
          </CalendarField>
        </div>

        <div className="border-t border-navy/10 pt-4">
          <label className="flex items-center gap-2 text-sm font-bold">
            <input
              type="checkbox"
              className="size-4 accent-[#3564e9]"
              checked={isRecurring}
              onChange={(event) => setIsRecurring(event.target.checked)}
            />
            Repeating event
          </label>
          {isRecurring ? (
            <div className="mt-4 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <CalendarField label="Frequency" htmlFor="cal-frequency">
                  <CalendarSelect id="cal-frequency" value={frequency} onChange={(event) => setFrequency(event.target.value as RecurrenceFrequency)}>
                    {FREQUENCIES.map((value) => <option key={value} value={value}>{value}</option>)}
                  </CalendarSelect>
                </CalendarField>
                <CalendarField label="Repeat every" htmlFor="cal-interval">
                  <Input
                    id="cal-interval"
                    type="number"
                    min={1}
                    max={12}
                    value={intervalCount}
                    onChange={(event) => setIntervalCount(event.target.value)}
                  />
                </CalendarField>
              </div>
              {frequency === "weekly" || frequency === "daily" ? (
                <CalendarField label="Weekdays" hint="Weekly rules require at least one weekday. Daily rules can be limited to these days.">
                  <div className="mt-2 flex flex-wrap gap-2">
                    {WEEKDAYS.map((label, day) => (
                      <label key={day} className="cursor-pointer border border-navy/15 bg-chalk/50 px-2 py-1 text-xs font-bold">
                        <input
                          type="checkbox"
                          className="mr-1 accent-[#c8f169]"
                          checked={byWeekday.includes(day)}
                          onChange={(event) =>
                            setByWeekday((days) =>
                              event.target.checked ? [...days, day].sort((a, b) => a - b) : days.filter((value) => value !== day),
                            )
                          }
                        />
                        {label}
                      </label>
                    ))}
                  </div>
                </CalendarField>
              ) : null}
              <div className="grid gap-4 sm:grid-cols-2">
                <CalendarField label="Ends on (IST)" htmlFor="cal-ends-on">
                  <Input id="cal-ends-on" type="date" value={endsOn} onChange={(event) => setEndsOn(event.target.value)} />
                </CalendarField>
                <CalendarField label="Or occurrence limit" htmlFor="cal-limit" hint="Set one of these to stop the series.">
                  <Input
                    id="cal-limit"
                    type="number"
                    min={1}
                    max={260}
                    value={occurrenceLimit}
                    onChange={(event) => setOccurrenceLimit(event.target.value)}
                  />
                </CalendarField>
              </div>
            </div>
          ) : null}
        </div>

        <div className="border-t border-navy/10 pt-4">
          <div className="flex items-center justify-between gap-2">
            <p className="eyebrow text-cobalt">Audiences</p>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setAudiences((rows) => [...rows, { audienceType: "all_students" } as AudienceRow])}
            >
              <Plus /> Add row
            </Button>
          </div>
          <div className="mt-3 space-y-4">
            {audiences.map((audience, index) => (
              <div key={index} className="space-y-3 border border-navy/10 bg-chalk/40 p-3">
                <div className="flex items-end gap-2">
                  <div className="flex-1">
                    <CalendarField label={`Audience ${index + 1}`} htmlFor={`cal-audience-type-${index}`}>
                      <CalendarSelect
                        id={`cal-audience-type-${index}`}
                        value={audience.audienceType}
                        onChange={(event) =>
                          setAudience(index, {
                            audienceType: event.target.value as Phase3AudienceType,
                            departmentId: "", semester: "", studentDirectoryId: "", groupId: "",
                          })
                        }
                      >
                        {AUDIENCE_TYPES.map((value) => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}
                      </CalendarSelect>
                    </CalendarField>
                  </div>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    aria-label={`Remove audience ${index + 1}`}
                    disabled={audiences.length === 1}
                    onClick={() => setAudiences((rows) => rows.filter((_, position) => position !== index))}
                  >
                    <Trash2 />
                  </Button>
                </div>
                {audience.audienceType === "department" ? (
                  <CalendarField label="Department" htmlFor={`cal-audience-department-${index}`}>
                    <CalendarSelect
                      id={`cal-audience-department-${index}`}
                      value={audience.departmentId}
                      onChange={(event) => setAudience(index, { departmentId: event.target.value })}
                    >
                      <option value="">Choose department</option>
                      {departments.map((department) => (
                        <option key={department.id} value={department.id}>{department.code} · {department.name}</option>
                      ))}
                    </CalendarSelect>
                  </CalendarField>
                ) : null}
                {audience.audienceType === "semester" ? (
                  <CalendarField label="Semester" htmlFor={`cal-audience-semester-${index}`}>
                    <Input
                      id={`cal-audience-semester-${index}`}
                      type="number"
                      min={1}
                      max={12}
                      value={audience.semester}
                      onChange={(event) => setAudience(index, { semester: event.target.value })}
                    />
                  </CalendarField>
                ) : null}
                {audience.audienceType === "selected_students" ? (
                  <CalendarField label="Student" htmlFor={`cal-audience-student-${index}`}>
                    <CalendarSelect
                      id={`cal-audience-student-${index}`}
                      value={audience.studentDirectoryId}
                      onChange={(event) => setAudience(index, { studentDirectoryId: event.target.value })}
                    >
                      <option value="">Choose student</option>
                      {students.map((student) => (
                        <option key={student.id} value={student.id}>
                          {student.full_name} · {departments.find((department) => department.id === student.department_id)?.code ?? "—"}
                        </option>
                      ))}
                    </CalendarSelect>
                  </CalendarField>
                ) : null}
                {audience.audienceType === "group" ? (
                  <CalendarField label="Student group" htmlFor={`cal-audience-group-${index}`}>
                    <CalendarSelect
                      id={`cal-audience-group-${index}`}
                      value={audience.groupId}
                      onChange={(event) => setAudience(index, { groupId: event.target.value })}
                    >
                      <option value="">Choose group</option>
                      {groups.map((group) => (
                        <option key={group.id} value={group.id}>{group.name}</option>
                      ))}
                    </CalendarSelect>
                  </CalendarField>
                ) : null}
                <p className="text-[11px] text-ink-muted">
                  {audienceLabel(
                    {
                      audienceType: audience.audienceType,
                      departmentId: audience.departmentId,
                      semester: audience.semester === "" ? null : Number(audience.semester),
                      studentDirectoryId: audience.studentDirectoryId,
                      groupId: audience.groupId,
                    },
                    departments.find((department) => department.id === audience.departmentId)?.name,
                    students.find((student) => student.id === audience.studentDirectoryId)?.full_name,
                    groups.find((group) => group.id === audience.groupId)?.name,
                  )}
                </p>
              </div>
            ))}
          </div>
        </div>

        {initial?.id ? (
          <FileUploadControl
            name="attachmentUpload"
            parentType="calendar_attachment"
            parentId={initial.id}
            label="Event attachment"
          />
        ) : (
          <p className="border border-dashed border-navy/20 p-3 text-xs text-ink-muted">
            Save the event first, then add a supporting attachment from the edit form.
          </p>
        )}
        {initial?.attachmentFileId ? (
          <p className="text-[11px] text-cobalt">An attachment is already linked. Uploading replaces it.</p>
        ) : null}
        {initial?.isRecurring ? (
          <p className="text-[11px] text-coral-dark">
            Saving this event rebuilds its recurrence rule; any saved overrides will be cleared.
          </p>
        ) : null}

        <CalendarActionNotice state={notice ? { status: notice.error ? "error" : "success", message: notice.message } : null} />
        <Button type="submit" variant="lime" disabled={pending} className="w-full">
          {pending ? "Saving…" : initial ? "Save changes" : "Create event"}
        </Button>
      </form>

      <div className="space-y-4">
        <OccurrencePreview occurrences={preview} overrides={overrides} />
      </div>
    </div>
  );
}
