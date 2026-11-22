"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ClipboardList, LoaderCircle, Search, UserPlus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/shared/empty-state";
import { VerificationBadge } from "@/components/shared/status-badge";
import { setPeMembership } from "@/app/(admin)/admin/pe-roster/actions";
import { formatDate } from "@/lib/utils";
import type { ActionState, DepartmentOption, DirectoryRow } from "@/types/domain";
import { cn } from "@/lib/utils";

export function PeRosterManager({
  records,
  departments,
}: {
  records: DirectoryRow[];
  departments: DepartmentOption[];
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [semesterFilter, setSemesterFilter] = useState("all");
  const [addOpen, setAddOpen] = useState(false);
  const [dialogQuery, setDialogQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<DirectoryRow | null>(null);
  const [notice, setNotice] = useState<ActionState | null>(null);
  const [busy, setBusy] = useState(false);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return records.filter((record) => {
      const matchesTerm =
        !term ||
        record.fullName.toLowerCase().includes(term) ||
        record.usn.toLowerCase().includes(term);
      const matchesDepartment =
        departmentFilter === "all" || record.departmentId === departmentFilter;
      const matchesSemester =
        semesterFilter === "all" || String(record.semester) === semesterFilter;
      return matchesTerm && matchesDepartment && matchesSemester;
    });
  }, [records, query, departmentFilter, semesterFilter]);

  const candidates = useMemo(() => {
    const term = dialogQuery.trim().toLowerCase();
    return filtered.filter((record) => {
      if (record.membership?.status === "active") return false;
      return !term || record.fullName.toLowerCase().includes(term) || record.usn.toLowerCase().includes(term);
    });
  }, [filtered, dialogQuery]);

  const activeCount = records.filter((record) => record.membership?.status === "active").length;
  const selected = records.find((record) => record.id === selectedId) ?? null;

  async function changeMembership(record: DirectoryRow, active: boolean) {
    setBusy(true);
    setNotice(null);
    const result = await setPeMembership(record.id, active, active ? "Added from PE Roster" : "Removed from PE Roster");
    setBusy(false);
    setNotice(result);
    setConfirmTarget(null);
    if (result.status === "success") {
      setAddOpen(false);
      setSelectedId(null);
      router.refresh();
    }
  }

  return (
    <div className="space-y-7">
      {notice ? (
        <p
          role="status"
          className={`border-l-4 p-4 text-sm ${
            notice.status === "success"
              ? "border-l-lime bg-lime/15 text-[#33521b]"
              : "border-l-coral bg-coral/10 text-[#8b3725]"
          }`}
        >
          {notice.message}
        </p>
      ) : null}

      <section aria-label="PE roster counts" className="grid gap-px border border-border bg-border sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Official records", value: records.length, accent: "bg-navy" },
          { label: "Active PE students", value: activeCount, accent: "bg-[#8fb63c]" },
          { label: "Registered accounts", value: records.filter((record) => record.profile).length, accent: "bg-cobalt" },
          { label: "Without account", value: records.filter((record) => !record.profile).length, accent: "bg-coral" },
        ].map((card) => (
          <div key={card.label} className="relative bg-card p-5">
            <div className={`absolute inset-x-0 top-0 h-1 ${card.accent}`} />
            <p className="eyebrow text-ink-muted">{card.label}</p>
            <p className="stat-number mt-3 text-4xl">{card.value}</p>
          </div>
        ))}
      </section>

      <section className="space-y-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="grid flex-1 gap-3 md:grid-cols-[1fr_190px_150px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-muted" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search by name or USN"
                className="pl-9"
                aria-label="Search students"
              />
            </div>
            <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
              <SelectTrigger aria-label="Filter by department">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All departments</SelectItem>
                {departments.map((department) => (
                  <SelectItem key={department.id} value={department.id}>
                    {department.code}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={semesterFilter} onValueChange={setSemesterFilter}>
              <SelectTrigger aria-label="Filter by semester">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All semesters</SelectItem>
                {Array.from({ length: 12 }, (_, index) => String(index + 1)).map((semester) => (
                  <SelectItem key={semester} value={semester}>Semester {semester}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            onClick={() => {
              setAddOpen(true);
              setDialogQuery("");
              setSelectedId(null);
            }}
            className="self-start"
          >
            <UserPlus /> Add PE Students
          </Button>
        </div>

        {records.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title="Official directory is empty"
            description="Import or manually add official student records before building the PE roster."
          />
        ) : filtered.length === 0 ? (
          <EmptyState icon={Search} title="No matches" description="Adjust your search or filters." />
        ) : (
          <div className="border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Year / Sem</TableHead>
                  <TableHead>Account</TableHead>
                  <TableHead>PE status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell>
                      <p className="font-bold">{record.fullName}</p>
                      <p className="font-mono text-xs text-ink-muted">{record.usn}</p>
                    </TableCell>
                    <TableCell className="text-sm font-semibold">{record.departmentCode}</TableCell>
                    <TableCell className="text-sm">{record.academicYear} / {record.semester}</TableCell>
                    <TableCell>
                      {record.profile ? (
                        <VerificationBadge status={record.profile.verificationStatus} />
                      ) : (
                        <Badge variant="muted">No account</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {record.membership?.status === "active" ? (
                        <Badge variant="cobalt">Active PE</Badge>
                      ) : record.membership ? (
                        <Badge variant="muted">Inactive</Badge>
                      ) : (
                        <Badge variant="muted">Not enrolled</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {record.membership?.status === "active" ? (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy}
                          onClick={() => setConfirmTarget(record)}
                        >
                          Remove
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy}
                          onClick={() => changeMembership(record, true)}
                        >
                          {record.membership ? "Reactivate" : "Add"}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      {/* ADD PE STUDENTS WORKFLOW */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>Add PE Students</DialogTitle>
            <DialogDescription>
              Select an official student record to preview it before adding it to the
              active PE class. Membership history is preserved.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-5 lg:grid-cols-[1.25fr_0.75fr]">
            <div className="min-w-0">
              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-muted" />
                <Input
                  value={dialogQuery}
                  onChange={(event) => setDialogQuery(event.target.value)}
                  placeholder="Search name or USN"
                  className="pl-9"
                  aria-label="Search candidates"
                />
              </div>
              <div className="max-h-80 overflow-y-auto border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Student</TableHead>
                      <TableHead>Dept</TableHead>
                      <TableHead>Sem</TableHead>
                      <TableHead>Account</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {candidates.map((record) => (
                      <TableRow
                        key={record.id}
                        onClick={() => setSelectedId(record.id)}
                        data-state={selectedId === record.id ? "selected" : undefined}
                        className="cursor-pointer"
                      >
                        <TableCell>
                          <p className="font-bold">{record.fullName}</p>
                          <p className="font-mono text-xs text-ink-muted">{record.usn}</p>
                        </TableCell>
                        <TableCell className="text-sm">{record.departmentCode}</TableCell>
                        <TableCell className="text-sm">{record.semester}</TableCell>
                        <TableCell>
                          {record.profile ? (
                            <Badge variant="lime">Registered</Badge>
                          ) : (
                            <Badge variant="muted">Not registered</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {candidates.length === 0 ? (
                  <p className="p-6 text-center text-sm text-ink-muted">
                    No eligible students match this search.
                  </p>
                ) : null}
              </div>
            </div>

            <div className="border border-border bg-chalk/60 p-5">
              <p className="eyebrow text-ink-muted">Student preview</p>
              {selected ? (
                <div className="mt-4 space-y-4">
                  <div>
                    <p className="font-heading text-2xl font-bold uppercase leading-none">{selected.fullName}</p>
                    <p className="mt-2 font-mono text-sm text-ink-muted">{selected.usn}</p>
                  </div>
                  <dl className="divide-y divide-border border-y border-border text-sm">
                    <div className="flex justify-between gap-3 py-2.5"><dt className="text-ink-muted">Department</dt><dd className="text-right font-bold">{selected.departmentCode}</dd></div>
                    <div className="flex justify-between gap-3 py-2.5"><dt className="text-ink-muted">Academic year</dt><dd className="font-bold">{selected.academicYear}</dd></div>
                    <div className="flex justify-between gap-3 py-2.5"><dt className="text-ink-muted">Semester</dt><dd className="font-bold">{selected.semester}</dd></div>
                    <div className="flex justify-between gap-3 py-2.5"><dt className="text-ink-muted">Registration</dt><dd className="text-right font-bold">{selected.profile ? "Registered" : "No account yet"}</dd></div>
                    <div className="flex justify-between gap-3 py-2.5"><dt className="text-ink-muted">Verification</dt><dd>{selected.profile ? <VerificationBadge status={selected.profile.verificationStatus} /> : <Badge variant="muted">Not applicable</Badge>}</dd></div>
                    <div className="flex justify-between gap-3 py-2.5"><dt className="text-ink-muted">PE history</dt><dd className="text-right text-xs font-bold">{selected.membership ? `Last active until ${formatDate(selected.membership.endedAt ?? selected.membership.enrolledAt)}` : "None"}</dd></div>
                  </dl>
                  <Button
                    className="w-full"
                    disabled={busy}
                    onClick={() => changeMembership(selected, true)}
                  >
                    {busy ? <LoaderCircle className="animate-spin" /> : <UserPlus />}
                    {selected.membership ? "Reactivate PE membership" : "Add to PE Class"}
                  </Button>
                  <Button variant="outline" className="w-full" onClick={() => setSelectedId(null)}>
                    Cancel
                  </Button>
                </div>
              ) : (
                <div className={cn("mt-6 flex flex-col items-center text-center text-sm text-ink-muted")}>
                  <ClipboardList className="size-7" />
                  <p className="mt-3">Select a student from the list to see their details.</p>
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(confirmTarget)} onOpenChange={(open) => !open && setConfirmTarget(null)}>
        <AlertDialogContent>
          <AlertDialogTitle>Remove from PE class?</AlertDialogTitle>
          <AlertDialogDescription>
            {confirmTarget?.fullName} will be removed from active PE membership. Their
            college account and official record are not deleted, and membership
            history is retained.
          </AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirmTarget && changeMembership(confirmTarget, false)}>
              Remove from PE class
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
