"use client";

import { useMemo, useState } from "react";
import { Pencil, Search, UsersRound } from "lucide-react";
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
import type { DirectoryRow } from "@/types/domain";

export function DirectoryTable({
  records,
  departments,
  onEdit,
}: {
  records: DirectoryRow[];
  departments: { id: string; code: string; name: string }[];
  onEdit: (record: DirectoryRow) => void;
}) {
  const [query, setQuery] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [semesterFilter, setSemesterFilter] = useState("all");

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

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-[1fr_190px_150px]">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-muted" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search official records"
            className="pl-9"
            aria-label="Search official directory"
          />
        </div>
        <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
          <SelectTrigger aria-label="Filter directory by department">
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
          <SelectTrigger aria-label="Filter directory by semester">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All semesters</SelectItem>
            {Array.from({ length: 12 }, (_, index) => String(index + 1)).map((semester) => (
              <SelectItem key={semester} value={semester}>
                Semester {semester}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {records.length === 0 ? (
        <EmptyState
          icon={UsersRound}
          title="Official directory is empty"
          description="Import the college student list or add records manually. Imported records do not create login accounts."
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
                <TableHead>Source</TableHead>
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
                  <TableCell>
                    <p className="text-sm font-semibold">{record.departmentCode}</p>
                    <p className="text-xs text-ink-muted">{record.departmentName}</p>
                  </TableCell>
                  <TableCell className="text-sm">
                    {record.academicYear} / {record.semester}
                  </TableCell>
                  <TableCell>
                    {record.profile ? (
                      <VerificationBadge status={record.profile.verificationStatus} />
                    ) : (
                      <Badge variant="muted">No account</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-xs capitalize text-ink-muted">{record.source}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onEdit(record)}
                      aria-label={`Correct ${record.fullName}`}
                    >
                      <Pencil /> Correct
                    </Button>
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
