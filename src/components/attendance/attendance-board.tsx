"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, LoaderCircle, Search, ShieldX, UserCheck } from "lucide-react";
import {
  finaliseAttendance,
  reviewAttendance,
  setAttendanceSessionStatus,
} from "@/app/(admin)/admin/classroom/attendance/actions";
import { AttendanceBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { splitAttendanceRows, submissionLabel } from "@/lib/operations/attendance";
import { createClient } from "@/lib/supabase/client";
import { cn, initials } from "@/lib/utils";
import { formatIstDateTime, formatIstTime } from "@/lib/time/india";
import type { AttendanceSessionStatus } from "@/types/database";
import type {
  AttendanceOverview,
  AttendanceRecordView,
  AttendanceSessionSummary,
} from "@/types/domain";

const PAGE_SIZE = 25;

export function AttendanceBoard({
  session,
  records,
  overview,
  departments,
}: {
  session: AttendanceSessionSummary;
  records: AttendanceRecordView[];
  overview: AttendanceOverview;
  departments: Array<{ id: string; code: string; name: string }>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [notice, setNotice] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [department, setDepartment] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [noteTarget, setNoteTarget] = useState<{
    recordId: string;
    decision: "approve" | "deny" | "present" | "absent" | "excused";
    name: string;
  } | null>(null);
  const [note, setNote] = useState("");
  const [finaliseOpen, setFinaliseOpen] = useState(false);
  const [remainingStatus, setRemainingStatus] = useState<"absent" | "excused">("absent");

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`attendance-${session.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "attendance_records",
          filter: `session_id=eq.${session.id}`,
        },
        () => router.refresh(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [router, session.id]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return records.filter((record) => {
      const matchesDepartment = department === "all" || record.departmentId === department;
      const matchesSearch =
        !term ||
        record.fullName.toLowerCase().includes(term) ||
        record.usn.toLowerCase().includes(term);
      return matchesDepartment && matchesSearch;
    });
  }, [department, records, search]);

  useEffect(() => setPage(0), [department, search]);
  const groups = useMemo(() => splitAttendanceRows(filtered), [filtered]);
  const visibleSubmitted = groups.submitted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const visibleNotSubmitted = groups.notSubmitted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const maxPages = Math.max(
    1,
    Math.ceil(Math.max(groups.submitted.length, groups.notSubmitted.length) / PAGE_SIZE),
  );

  function act(fn: () => Promise<{ status: string; message: string }>) {
    setNotice(null);
    startTransition(async () => {
      const result = await fn();
      setNotice({ tone: result.status === "success" ? "ok" : "error", text: result.message });
      if (result.status === "success") router.refresh();
    });
  }

  function review(
    recordId: string,
    decision: "approve" | "deny" | "present" | "absent" | "excused",
    name: string,
  ) {
    if (decision === "deny" || decision === "absent" || decision === "excused") {
      setNoteTarget({ recordId, decision, name });
      setNote("");
      return;
    }
    act(() => reviewAttendance({ recordId, decision }));
  }

  function changeStatus(status: AttendanceSessionStatus) {
    act(() => setAttendanceSessionStatus(session.id, status));
  }

  const counters = [
    { label: "Confirmed present", value: overview.confirmedPresent, accent: "bg-[#8fb63c]" },
    { label: "Pending verification", value: overview.pending, accent: "bg-coral" },
    { label: "Represented", value: overview.represented, accent: "bg-cobalt" },
    { label: "Not submitted", value: overview.notSubmitted, accent: "bg-navy" },
    { label: "Absent", value: overview.absent, accent: "bg-navy-deep" },
    { label: "Excused", value: overview.excused, accent: "bg-ink-muted" },
  ];

  return (
    <div className="space-y-8">
      {notice ? (
        <p
          role="status"
          className={`border-l-4 p-4 text-sm ${
            notice.tone === "ok"
              ? "border-l-[#8fb63c] bg-lime/40 text-[#33521b]"
              : "border-l-coral bg-coral/10 text-[#8b3725]"
          }`}
        >
          {notice.text}
        </p>
      ) : null}

      <section className="border-b-2 border-navy pb-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="eyebrow text-cobalt">Attendance session overview</p>
            <h1 className="mt-3 text-4xl font-bold leading-none sm:text-5xl">{session.title}</h1>
            <p className="mt-3 text-xs font-bold uppercase tracking-[0.1em] text-ink-muted">
              {formatIstDateTime(session.classDate)} · {formatIstTime(session.startsAt)}–
              {formatIstTime(session.expectedEndsAt)} IST · {session.status}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {session.status === "draft" ? (
              <Button variant="lime" disabled={pending} onClick={() => changeStatus("open")}>
                Open session
              </Button>
            ) : null}
            {session.status === "open" ? (
              <Button variant="default" disabled={pending} onClick={() => changeStatus("closed")}>
                Close session
              </Button>
            ) : null}
            {session.status === "closed" ? (
              <Dialog open={finaliseOpen} onOpenChange={setFinaliseOpen}>
                <DialogTrigger asChild>
                  <Button variant="cobalt" disabled={pending}>Finalise attendance</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Confirm finalisation</DialogTitle>
                    <DialogDescription>
                      {overview.notSubmitted} students have not submitted. They will be marked{" "}
                      {remainingStatus}. Pending submissions stay pending for review.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {counters.map((counter) => (
                      <div key={counter.label} className="border border-border p-3">
                        <p className="text-[0.6rem] font-bold uppercase tracking-[0.1em] text-ink-muted">
                          {counter.label}
                        </p>
                        <p className="stat-number mt-2 text-3xl">{counter.value}</p>
                      </div>
                    ))}
                  </div>
                  <div>
                    <Label htmlFor="remaining-status">Remaining students</Label>
                    <select
                      id="remaining-status"
                      className="mt-2 h-10 w-full border border-input bg-card px-3 text-sm"
                      value={remainingStatus}
                      onChange={(event) => setRemainingStatus(event.target.value as "absent" | "excused")}
                    >
                      <option value="absent">Mark absent</option>
                      <option value="excused">Mark excused</option>
                    </select>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setFinaliseOpen(false)}>Cancel</Button>
                    <Button
                      disabled={pending}
                      onClick={() =>
                        act(async () => {
                          const result = await finaliseAttendance(session.id, remainingStatus);
                          setFinaliseOpen(false);
                          return result;
                        })
                      }
                    >
                      Finalise
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            ) : null}
          </div>
        </div>
      </section>

      <section aria-label="Live counters">
        <div className="grid grid-cols-2 gap-px border border-border bg-border sm:grid-cols-3 xl:grid-cols-6">
          {counters.map((counter) => (
            <div key={counter.label} className="relative bg-card p-4">
              <div className={`absolute inset-x-0 top-0 h-1 ${counter.accent}`} />
              <p className="eyebrow text-ink-muted">{counter.label}</p>
              <p className="stat-number mt-3 text-4xl">{counter.value}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setDepartment("all")}
              className={cn(
                "border px-3 py-2 text-[0.65rem] font-extrabold uppercase tracking-[0.12em]",
                department === "all" ? "border-navy bg-navy text-lime" : "border-border bg-card text-ink-muted",
              )}
            >
              All
            </button>
            {departments.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setDepartment(item.id)}
                className={cn(
                  "border px-3 py-2 text-[0.65rem] font-extrabold uppercase tracking-[0.12em]",
                  department === item.id
                    ? "border-navy bg-navy text-lime"
                    : "border-border bg-card text-ink-muted hover:border-navy",
                )}
              >
                {item.code}
              </button>
            ))}
          </div>
          <div className="relative w-full lg:max-w-xs">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-muted" />
            <Input
              aria-label="Search by name or USN"
              className="pl-9"
              placeholder="Search name or USN"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
        </div>

        <h2 className="border-b-2 border-navy pb-3 text-2xl font-bold">
          Group A — Submitted attendance
        </h2>
        {visibleSubmitted.length === 0 ? (
          <p className="border border-dashed border-border bg-card/60 p-6 text-sm text-ink-muted">
            No submitted attendance in this filter.
          </p>
        ) : (
          <div className="overflow-x-auto border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Claim</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Decision</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleSubmitted.map((record) => (
                  <TableRow key={record.recordId}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <span className="flex size-9 shrink-0 items-center justify-center bg-navy/5 text-xs font-bold text-navy">
                          {initials(record.fullName)}
                        </span>
                        <div>
                          <p className="font-bold">{record.fullName}</p>
                          <p className="font-mono text-xs text-ink-muted">{record.usn}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs">
                      {record.departmentCode} · Sem {record.semester}
                    </TableCell>
                    <TableCell>{submissionLabel(record.submittedType)}</TableCell>
                    <TableCell className="text-xs text-ink-muted">
                      {record.submittedAt ? formatIstTime(record.submittedAt) : "—"}
                    </TableCell>
                    <TableCell><AttendanceBadge status={record.status} /></TableCell>
                    <TableCell>
                      {record.status === "pending" ? (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="lime"
                            disabled={pending}
                            onClick={() => review(record.recordId, "approve", record.fullName)}
                          >
                            <Check /> Agree
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            disabled={pending}
                            onClick={() => review(record.recordId, "deny", record.fullName)}
                          >
                            <ShieldX /> Deny
                          </Button>
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={pending}
                          onClick={() =>
                            review(
                              record.recordId,
                              record.status === "present" ? "absent" : "present",
                              record.fullName,
                            )
                          }
                        >
                          Correct
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        <h2 className="border-b-2 border-navy pb-3 pt-6 text-2xl font-bold">
          Group B — Not submitted
        </h2>
        {visibleNotSubmitted.length === 0 ? (
          <p className="border border-dashed border-border bg-card/60 p-6 text-sm text-ink-muted">
            Every filtered student has a record.
          </p>
        ) : (
          <div className="overflow-x-auto border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>USN</TableHead>
                  <TableHead>Department & semester</TableHead>
                  <TableHead className="text-right">Physical verification</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleNotSubmitted.map((record) => (
                  <TableRow key={record.recordId}>
                    <TableCell className="font-bold">{record.fullName}</TableCell>
                    <TableCell className="font-mono text-xs">{record.usn}</TableCell>
                    <TableCell className="text-xs">
                      {record.departmentCode} · Sem {record.semester}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap justify-end gap-2">
                        <Button size="sm" variant="lime" disabled={pending} onClick={() => review(record.recordId, "present", record.fullName)}>
                          <UserCheck /> Present
                        </Button>
                        <Button size="sm" variant="destructive" disabled={pending} onClick={() => review(record.recordId, "absent", record.fullName)}>
                          Absent
                        </Button>
                        <Button size="sm" variant="outline" disabled={pending} onClick={() => review(record.recordId, "excused", record.fullName)}>
                          Excused
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        <div className="flex items-center justify-between text-xs font-bold uppercase tracking-[0.1em] text-ink-muted">
          <span>Page {page + 1} of {maxPages}</span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage((value) => value - 1)}>
              Previous
            </Button>
            <Button size="sm" variant="outline" disabled={page >= maxPages - 1} onClick={() => setPage((value) => value + 1)}>
              Next
            </Button>
          </div>
        </div>
      </section>

      <Dialog open={Boolean(noteTarget)} onOpenChange={() => setNoteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm {noteTarget?.decision}</DialogTitle>
            <DialogDescription>
              {noteTarget?.name} — the decision and note are written to the attendance audit
              history.
            </DialogDescription>
          </DialogHeader>
          <div>
            <Label htmlFor="attendance-note">Administrative note (optional)</Label>
            <Input
              id="attendance-note"
              className="mt-2"
              value={note}
              maxLength={500}
              onChange={(event) => setNote(event.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNoteTarget(null)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={pending}
              onClick={() => {
                if (!noteTarget) return;
                const target = noteTarget;
                setNoteTarget(null);
                act(() => reviewAttendance({ recordId: target.recordId, decision: target.decision, note }));
              }}
            >
              {pending ? <LoaderCircle className="animate-spin" /> : null}
              Confirm decision
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
