"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCheck, LoaderCircle, Search, UserRoundCheck } from "lucide-react";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/shared/empty-state";
import { VerificationBadge } from "@/components/shared/status-badge";
import { verifyStudentProfile } from "@/app/(admin)/admin/students/actions";
import { formatDate } from "@/lib/utils";
import type { ActionState, StudentAccountRow } from "@/types/domain";

export function StudentAccountsTable({ students }: { students: StudentAccountRow[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [peFilter, setPeFilter] = useState("all");
  const [notice, setNotice] = useState<ActionState | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return students.filter((student) => {
      const matchesTerm =
        !term ||
        student.fullName.toLowerCase().includes(term) ||
        student.email.toLowerCase().includes(term) ||
        (student.usn ?? "").toLowerCase().includes(term);
      const matchesStatus =
        statusFilter === "all" || student.verificationStatus === statusFilter;
      const matchesPe = peFilter === "all" || (peFilter === "pe" ? student.isPeStudent : !student.isPeStudent);
      return matchesTerm && matchesStatus && matchesPe;
    });
  }, [students, query, statusFilter, peFilter]);

  async function onVerify(id: string) {
    setBusyId(id);
    setNotice(null);
    const result = await verifyStudentProfile(id);
    setNotice(result);
    setBusyId(null);
    if (result.status === "success") router.refresh();
  }

  return (
    <div className="space-y-4">
      {notice ? (
        <p
          role="status"
          className={`border-l-4 p-3 text-sm ${
            notice.status === "success"
              ? "border-l-lime bg-lime/15 text-[#33521b]"
              : "border-l-coral bg-coral/10 text-[#8b3725]"
          }`}
        >
          {notice.message}
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-[1fr_180px_150px]">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-muted" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search name, USN or email"
            className="pl-9"
            aria-label="Search student accounts"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger aria-label="Filter by verification status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All verification states</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="verified">Verified</SelectItem>
            <SelectItem value="suspended">Suspended</SelectItem>
          </SelectContent>
        </Select>
        <Select value={peFilter} onValueChange={setPeFilter}>
          <SelectTrigger aria-label="Filter by PE membership">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All students</SelectItem>
            <SelectItem value="pe">PE students</SelectItem>
            <SelectItem value="general">Non-PE students</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {students.length === 0 ? (
        <EmptyState
          icon={UserRoundCheck}
          title="No registered accounts"
          description="Student accounts appear here as soon as students complete registration."
        />
      ) : filtered.length === 0 ? (
        <EmptyState icon={Search} title="No matches" description="Adjust your search or filters." />
      ) : (
        <div className="border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead>USN / Department</TableHead>
                <TableHead>Verification</TableHead>
                <TableHead>PE</TableHead>
                <TableHead>Registered</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((student) => (
                <TableRow key={student.id}>
                  <TableCell>
                    <p className="font-bold">{student.fullName}</p>
                    <p className="text-xs text-ink-muted">{student.email}</p>
                  </TableCell>
                  <TableCell>
                    <p className="font-mono text-xs">{student.usn ?? "—"}</p>
                    <p className="text-xs text-ink-muted">
                      {student.departmentCode ?? "Not linked"}
                    </p>
                  </TableCell>
                  <TableCell>
                    <VerificationBadge status={student.verificationStatus} />
                  </TableCell>
                  <TableCell>
                    {student.isPeStudent ? <Badge variant="cobalt">PE student</Badge> : <Badge variant="muted">No</Badge>}
                  </TableCell>
                  <TableCell className="text-xs text-ink-muted">
                    {formatDate(student.createdAt)}
                  </TableCell>
                  <TableCell className="text-right">
                    {student.verificationStatus === "pending" ? (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busyId === student.id}
                        onClick={() => onVerify(student.id)}
                      >
                        {busyId === student.id ? <LoaderCircle className="animate-spin" /> : <CheckCheck />}
                        Verify
                      </Button>
                    ) : (
                      <span className="text-xs text-ink-muted">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
